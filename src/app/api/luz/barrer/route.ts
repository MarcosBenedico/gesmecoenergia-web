import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  Prospecto, aFilaGuardable, coordsDeTexto, distKm, nombreComparable,
} from '@/lib/prospeccion';
import { buscarProspectos } from '../prospectar/buscar';

/**
 * BARRER UNA ZONA Y GUARDAR LO QUE SALGA
 *
 * POST { centro: {lat,lon}, radio_km }  → barrido circular de un municipio
 * POST { ruta: [{lat,lon}], radio_km }  → barrido del corredor de una ruta
 *
 * A diferencia de la búsqueda de antes, esto GUARDA. Una zona se barre una vez
 * y a partir de ahí el mapa de oportunidades es de la casa: se va revisando,
 * marcando y descartando, y lo descartado no vuelve a aparecer.
 *
 * Los que ya estaban se actualizan en sus datos del mapa (`osm_id` es único),
 * pero NUNCA se les toca el estado ni las notas: si David descartó una granja
 * hace un mes, volver a barrer la zona no puede resucitarla.
 */

export const maxDuration = 120;

/** Cliente Supabase con la sesión del usuario, para que RLS haga su trabajo. */
function clienteSupabase(req: NextRequest) {
  const auth = req.headers.get('authorization');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    auth ? { global: { headers: { Authorization: auth } } } : undefined
  );
}

/** Puntos de un círculo alrededor de un centro, para barrer un municipio. */
function anilloAlrededor(centro: { lat: number; lon: number }, radioKm: number) {
  const puntos: { lat: number; lon: number }[] = [centro];
  const mLat = radioKm / 111.132;
  const mLon = radioKm / (111.32 * Math.cos((centro.lat * Math.PI) / 180));
  // Ocho puntos cardinales a media distancia: cubre el círculo sin dejar hueco
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    puntos.push({ lat: centro.lat + mLat * 0.55 * Math.sin(a), lon: centro.lon + mLon * 0.55 * Math.cos(a) });
  }
  return puntos;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      centro?: { lat: number; lon: number };
      ruta?: { lat: number; lon: number }[];
      radio_km?: number;
    };

    const radioKm = Math.min(6, Math.max(0.5, body.radio_km || 3));

    let recorrido: { lat: number; lon: number }[];
    let radioCorredor: number;

    if (body.centro && Number.isFinite(body.centro.lat)) {
      // Barrido de zona: se recorre un anillo y se mira alrededor de cada punto
      recorrido = anilloAlrededor(body.centro, radioKm);
      radioCorredor = Math.min(2.5, radioKm * 0.6);
    } else if (body.ruta?.length) {
      recorrido = body.ruta.filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lon));
      radioCorredor = Math.min(5, radioKm);
    } else {
      return NextResponse.json({ error: 'Indica una zona o una ruta que barrer.' }, { status: 400 });
    }

    if (!recorrido.length) {
      return NextResponse.json({ error: 'La zona indicada no es válida.' }, { status: 400 });
    }

    const { prospectos, aviso, error } = await buscarProspectos(recorrido, radioCorredor);
    if (error) return NextResponse.json({ error }, { status: 503 });

    const supa = clienteSupabase(req);

    // ── Fuera lo que ya es cartera ──
    // Proponer visitar a un cliente propio ensucia el mapa y le quita
    // credibilidad justo cuando más falta hace que se la gane.
    const { descartados, quedan } = await quitarLosQueYaSonClientes(supa, prospectos);

    // Los que ya conocemos: para no pisar el trabajo hecho sobre ellos
    const ids = quedan.map((p) => p.id);
    const conocidos = new Set<string>();
    // En trozos, que la lista puede ser larga y la URL tiene límite
    for (let i = 0; i < ids.length; i += 100) {
      const { data } = await supa
        .from('luz_prospectos')
        .select('osm_id')
        .in('osm_id', ids.slice(i, i + 100));
      for (const f of data || []) conocidos.add(f.osm_id as string);
    }

    const nuevos = quedan.filter((p: Prospecto) => !conocidos.has(p.id));
    let guardados = 0;

    if (nuevos.length) {
      const filas = nuevos.map((p) => ({ ...aFilaGuardable(p), estado: 'nuevo' }));
      const { error: errIns } = await supa.from('luz_prospectos').insert(filas);
      if (errIns) {
        // Los dos fallos previsibles tienen causa concreta y arreglo concreto:
        // decirlos en cristiano ahorra media hora de búsqueda a ciegas.
        const faltaTabla = /relation .*luz_prospectos.* does not exist|Could not find the table/i.test(errIns.message);
        const sinPermiso = /row-level security|violates row-level/i.test(errIns.message);
        return NextResponse.json(
          {
            error: faltaTabla
              ? 'Falta la tabla de oportunidades: ejecuta supabase_prospectos.sql en Supabase.'
              : sinPermiso
                ? 'La sesión no ha llegado al servidor y Supabase rechaza el guardado. Vuelve a entrar en el panel y prueba otra vez.'
                : `No se pudieron guardar: ${errIns.message}`,
          },
          { status: faltaTabla || sinPermiso ? 400 : 500 }
        );
      }
      guardados = filas.length;
    }

    // A los ya conocidos solo se les refrescan los datos del mapa. El estado,
    // las notas y el motivo de descarte son trabajo de la casa y no se tocan.
    let actualizados = 0;
    for (const p of quedan) {
      if (!conocidos.has(p.id)) continue;
      const { error: errUpd } = await supa
        .from('luz_prospectos')
        .update(aFilaGuardable(p))
        .eq('osm_id', p.id);
      if (!errUpd) actualizados++;
    }

    // Queda constancia de qué territorio se ha mirado: sin esto se acaba
    // barriendo dos veces lo mismo mientras otra comarca sigue virgen.
    if (body.centro) {
      await apuntarBarrido(supa, {
        lat: body.centro.lat, lon: body.centro.lon, radio_km: radioKm,
        fecha: new Date().toISOString(), encontrados: prospectos.length, guardados,
      });
    }

    return NextResponse.json({
      ok: true,
      encontrados: prospectos.length,
      guardados,
      actualizados,
      ya_clientes: descartados,
      aviso,
    });
  } catch {
    return NextResponse.json({ error: 'No se pudo barrer la zona.' }, { status: 500 });
  }
}

/** Un sitio a menos de esto de un cliente conocido es ese cliente. */
const KM_ES_EL_MISMO = 0.15;

/** Clave de `luz_config` donde vive el historial de barridos. */
export const CLAVE_BARRIDOS = 'prospeccion_barridos';
/** Cuántos se recuerdan. De sobra para pintar la cobertura de la comarca. */
const MAX_BARRIDOS = 300;

export interface BarridoHecho {
  lat: number;
  lon: number;
  radio_km: number;
  fecha: string;
  encontrados: number;
  guardados: number;
}

/**
 * Apunta un barrido en `luz_config`, que ya existe y admite cualquier clave.
 * Se hace así, y no con una tabla nueva, para no obligar a ejecutar otro SQL
 * por algo que es un simple cuaderno de bitácora.
 */
async function apuntarBarrido(
  supa: ReturnType<typeof clienteSupabase>,
  barrido: BarridoHecho
) {
  try {
    const { data } = await supa.from('luz_config').select('valor').eq('clave', CLAVE_BARRIDOS).maybeSingle();
    let previos: BarridoHecho[] = [];
    try { previos = JSON.parse((data?.valor as string) || '[]'); } catch { previos = []; }
    if (!Array.isArray(previos)) previos = [];

    // Si se repite el mismo sitio y radio, se sustituye: interesa la última vez
    const mismos = (a: BarridoHecho) =>
      Math.abs(a.lat - barrido.lat) < 0.002 && Math.abs(a.lon - barrido.lon) < 0.002 && a.radio_km === barrido.radio_km;
    const lista = [barrido, ...previos.filter((b) => !mismos(b))].slice(0, MAX_BARRIDOS);

    await supa.from('luz_config').upsert({ clave: CLAVE_BARRIDOS, valor: JSON.stringify(lista) }, { onConflict: 'clave' });
  } catch {
    // El cuaderno es un extra: que falle no puede tumbar un barrido que ha ido bien
  }
}

/**
 * Quita del barrido lo que ya está en la cartera.
 *
 * Se compara de dos maneras, porque ninguna sola llega:
 *
 *   · POR SITIO — los clientes que entraron desde el mapa, o cuya dirección es
 *     un enlace de Google Maps, llevan las coordenadas dentro. 150 m de margen,
 *     porque la dirección de un cliente rara vez cae justo encima de su nave.
 *
 *   · POR NOMBRE — comparando sin acentos ni formas jurídicas, así "Casa
 *     Guardia S.L." y "casa guardia" son el mismo.
 *
 * LO QUE NO CUBRE: un cliente cuya dirección sea texto de calle y cuyo nombre
 * no esté en OpenStreetMap no se puede detectar sin geocodificar la cartera
 * entera, que son cientos de peticiones. Esos pocos habrá que descartarlos a
 * mano la primera vez, y con eso ya no vuelven a salir.
 */
async function quitarLosQueYaSonClientes(
  supa: ReturnType<typeof clienteSupabase>,
  prospectos: Prospecto[]
): Promise<{ descartados: number; quedan: Prospecto[] }> {
  const { data, error } = await supa.from('luz_clientes').select('nombre, direccion_fiscal');
  // Si no se puede leer la cartera, mejor guardar de más que perder hallazgos
  if (error || !data) return { descartados: 0, quedan: prospectos };

  const puntos: { lat: number; lon: number }[] = [];
  const nombres = new Set<string>();
  for (const c of data) {
    const g = coordsDeTexto(c.direccion_fiscal as string | null);
    if (g) puntos.push(g);
    const n = nombreComparable(c.nombre as string | null);
    if (n.length >= 4) nombres.add(n); // nombres muy cortos darían falsos positivos
  }

  const quedan = prospectos.filter((p) => {
    if (puntos.some((c) => distKm(c, p) < KM_ES_EL_MISMO)) return false;
    const n = nombreComparable(p.nombre);
    if (n.length >= 4 && nombres.has(n)) return false;
    return true;
  });

  return { descartados: prospectos.length - quedan.length, quedan };
}
