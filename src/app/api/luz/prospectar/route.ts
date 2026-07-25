import { NextRequest, NextResponse } from 'next/server';
import { ElementoOSM, Prospecto, densificarRuta, distKm, procesarElementos } from '@/lib/prospeccion';

/**
 * PROSPECCIÓN SOBRE LA RUTA
 *
 * POST { ruta: [{lat,lon}], radio_km?, excluir?: [{lat,lon}] }
 *  → granjas, naves y negocios de OpenStreetMap en el corredor de la ruta,
 *    puntuados por interés comercial.
 *
 * Aquí solo está la parte de red: consultar Overpass y cachear. Qué se
 * considera candidato y cómo se puntúa vive en `src/lib/prospeccion.ts`,
 * que se prueba con `npm run test:prospeccion`.
 *
 * `excluir` son los clientes que ya están en la cartera: lo que caiga a menos
 * de 150 m de uno de ellos no se enseña, para no proponer visitar a quien ya
 * es cliente. 150 m porque la dirección geocodificada de un cliente rara vez
 * cae justo encima de su nave.
 *
 * Overpass es gratuito y sin clave, pero es un servicio comunitario: una sola
 * consulta por petición, con timeout y caché en memoria.
 */

export const maxDuration = 120;

/**
 * Overpass es gratuito y comunitario, y a veces el principal va cargado. Se
 * prueban por orden: si el primero contesta 429 o 504, se va al siguiente en
 * vez de decirle a David que vuelva en un rato.
 */
const SERVIDORES_OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const UA = 'GesmecoEnergia-Prospeccion/1.0 (gesmecoenergia.com)';
/** Perímetro mínimo del contorno para que un edificio se traiga del mapa. */
const PERIMETRO_MINIMO_M = 100;
const RADIO_DEFECTO_KM = 2;
const RADIO_MAX_KM = 5;
const MAX_VERTICES_RUTA = 40;
/** Puntos de ruta por consulta. Con más, Overpass devuelve 504. */
const PUNTOS_POR_TRAMO = 3;
/**
 * Longitud máxima de cada salto del recorrido, en km.
 *
 * Lo que ahoga a Overpass es la LONGITUD del corredor, no el número de puntos.
 * Una ruta de Binéfar a Raimat son solo tres puntos —la salida y dos paradas—
 * pero 45 km de corredor: trocear "de tres en tres" no partía absolutamente
 * nada. Por eso primero se rellenan puntos intermedios y luego se agrupan.
 */
const KM_MAX_ENTRE_PUNTOS = 5;
/**
 * Tiempo total que se le da a la búsqueda. Al agotarse se devuelve lo que haya
 * con un aviso: mejor media zona que un error, y sobre todo mejor que la
 * función se quede sin tiempo y el navegador reciba una conexión cortada —que
 * es justo lo que pasaba.
 */
const MS_PRESUPUESTO = 45000;
/** Lo que se espera a un servidor antes de darlo por perdido y probar otro. */
const MS_ESPERA_SERVIDOR = 15000;
const MAX_RESULTADOS = 60;
const KM_YA_ES_CLIENTE = 0.15;

const cache = new Map<string, { en: number; datos: Prospecto[] }>();
const CACHE_MS = 30 * 60 * 1000;

function consultaOverpass(ruta: { lat: number; lon: number }[], radioM: number): string {
  const a = `around:${Math.round(radioM)},${ruta.map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join(',')}`;
  // No se filtra por etiqueta: en esta zona las naves de las granjas están
  // como `building=yes` a secas, y buscando etiquetas se pierde justo lo que
  // más interesa. Se filtra por TAMAÑO, con el perímetro del contorno.
  //
  // 100 m de perímetro deja fuera las viviendas (una casa de 12×10 tiene 44 m)
  // y deja pasar cualquier nave (una de 30×8, la más pequeña que se considera,
  // tiene 76 m... por eso el corte va por debajo de lo que parecería).
  //
  // Hace falta porque pedir todos los edificios con su geometría reventaba la
  // consulta en cuanto la ruta se alargaba: en una de Binéfar a Raimat, 45 km,
  // el servidor devolvía 504. Con el filtro, esa misma ruta baja a ~90 KB y
  // 13 segundos.
  //
  // Las balsas no son candidatos: son la pista de que unas naves son una
  // explotación ganadera. Y `residential` marca los cascos urbanos.
  return `[out:json][timeout:90];
(
  way["building"](if: length() > ${PERIMETRO_MINIMO_M})(${a});
  way["landuse"~"^(farmyard|industrial|greenhouse_horticulture|residential)$"](${a});
  way["man_made"~"^(silo|storage_tank|pumping_station|water_well)$"](${a});
  way["water"="basin"](${a});
  way["landuse"="basin"](${a});
);
out tags geom 6000;`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      ruta?: { lat: number; lon: number }[];
      radio_km?: number;
      excluir?: { lat: number; lon: number }[];
    };

    const ruta = (body.ruta || []).filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lon));
    if (ruta.length === 0) {
      return NextResponse.json(
        { error: 'Calcula la ruta primero: hace falta saber por dónde se pasa.' },
        { status: 400 }
      );
    }

    const radioKm = Math.min(RADIO_MAX_KM, Math.max(0.3, body.radio_km || RADIO_DEFECTO_KM));

    // Puntos intermedios para que ningún salto sea largo: sin esto, una ruta de
    // dos paradas separadas 45 km es un corredor gigante que Overpass rechaza,
    // y trocear por número de puntos no arregla nada.
    const densa = densificarRuta(ruta, KM_MAX_ENTRE_PUNTOS);

    // Y si aun así son demasiados (ruta larguísima), se reparten uniformemente
    const paso = Math.max(1, Math.ceil(densa.length / MAX_VERTICES_RUTA));
    const vertices = densa.filter((_, i) => i % paso === 0);
    const ultimo = densa[densa.length - 1];
    if (vertices[vertices.length - 1] !== ultimo) vertices.push(ultimo);

    const clave = JSON.stringify({ vertices, radioKm });
    const guardado = cache.get(clave);
    if (guardado && Date.now() - guardado.en < CACHE_MS) {
      return NextResponse.json({
        ok: true, cacheado: true, radio_km: radioKm,
        prospectos: quitarClientes(guardado.datos, body.excluir),
      });
    }

    // El recorrido se parte en tramos cortos y se consulta uno a uno.
    // Overpass no puede con un corredor largo de una vez: una ruta de Binéfar
    // a Raimat (45 km) devolvía 504 en todos los servidores, mientras que un
    // tramo de tres puntos se resuelve en dos segundos y medio. Los tramos se
    // solapan en un punto para que no queden huecos entre ellos.
    const tramos: { lat: number; lon: number }[][] = [];
    for (let i = 0; i < vertices.length; i += PUNTOS_POR_TRAMO - 1) {
      const trozo = vertices.slice(i, i + PUNTOS_POR_TRAMO);
      if (trozo.length) tramos.push(trozo);
      if (i + PUNTOS_POR_TRAMO >= vertices.length) break;
    }

    // Se juntan por id: los tramos solapados devuelven cosas repetidas
    const porId = new Map<string, ElementoOSM>();
    let tramosFallidos = 0;
    let ultimoFallo = '';

    // Un servidor que ya ha dicho que está saturado lo seguirá estando dentro
    // de dos segundos: se aparta para el resto de la búsqueda en vez de volver
    // a esperarle en cada tramo, que es tiempo tirado del presupuesto.
    const quemados = new Set<string>();

    const empezado = Date.now();
    for (const tramo of tramos) {
      // Si se acaba el tiempo se deja de pedir y se devuelve lo que haya: que
      // la función muera sin responder es lo peor que puede pasar, porque al
      // navegador le llega una conexión cortada y no se sabe ni por qué.
      if (Date.now() - empezado > MS_PRESUPUESTO) { tramosFallidos++; continue; }

      const consulta = consultaOverpass(tramo, radioKm * 1000);
      let hecho = false;
      for (const servidor of SERVIDORES_OVERPASS) {
        if (quemados.has(servidor)) continue;
        const queda = MS_PRESUPUESTO - (Date.now() - empezado);
        if (queda < 3000) break;
        try {
          const res = await fetch(servidor, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
            body: `data=${encodeURIComponent(consulta)}`,
            signal: AbortSignal.timeout(Math.min(MS_ESPERA_SERVIDOR, queda)),
          });
          if (res.ok) {
            const els = ((await res.json()) as { elements?: ElementoOSM[] }).elements || [];
            for (const el of els) porId.set(`${el.type}/${el.id}`, el);
            hecho = true;
            break;
          }
          ultimoFallo = String(res.status);
          // 429 es "vuelve más tarde": no tiene arreglo dentro de esta búsqueda
          if (res.status === 429) quemados.add(servidor);
        } catch {
          ultimoFallo = 'sin respuesta';
          quemados.add(servidor); // no responde: no se le espera otra vez
        }
      }
      if (!hecho) tramosFallidos++;
    }

    // Si no se pudo con ninguno, no hay nada que enseñar
    if (tramosFallidos === tramos.length) {
      return NextResponse.json(
        { error: `El mapa público no responde ahora mismo (${ultimoFallo}). Vuelve a intentarlo en un par de minutos.` },
        { status: 503 }
      );
    }

    const elementos = Array.from(porId.values());
    // Con algún tramo caído hay resultados, pero incompletos: hay que decirlo
    const aviso = tramosFallidos > 0
      ? `Falta un trozo de la ruta: ${tramosFallidos} de ${tramos.length} tramos no se han podido consultar. Vuelve a buscar en un rato para verlos.`
      : null;

    const prospectos = procesarElementos(elementos, ruta, radioKm);
    cache.set(clave, { en: Date.now(), datos: prospectos });

    return NextResponse.json({
      ok: true,
      radio_km: radioKm,
      revisados: elementos.length,
      aviso,
      prospectos: quitarClientes(prospectos, body.excluir),
    });
  } catch {
    return NextResponse.json({ error: 'No se pudo buscar por la zona.' }, { status: 500 });
  }
}

/** Quita los que ya son clientes y deja los mejores. */
function quitarClientes(lista: Prospecto[], excluir?: { lat: number; lon: number }[]): Prospecto[] {
  const cartera = (excluir || []).filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lon));
  return lista
    .filter((p) => !cartera.some((c) => distKm(c, p) < KM_YA_ES_CLIENTE))
    .sort((a, b) => b.puntuacion - a.puntuacion)
    .slice(0, MAX_RESULTADOS);
}
