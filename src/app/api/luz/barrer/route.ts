import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Prospecto, aFilaGuardable } from '@/lib/prospeccion';
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

    // Los que ya conocemos: para no pisar el trabajo hecho sobre ellos
    const ids = prospectos.map((p) => p.id);
    const conocidos = new Set<string>();
    // En trozos, que la lista puede ser larga y la URL tiene límite
    for (let i = 0; i < ids.length; i += 100) {
      const { data } = await supa
        .from('luz_prospectos')
        .select('osm_id')
        .in('osm_id', ids.slice(i, i + 100));
      for (const f of data || []) conocidos.add(f.osm_id as string);
    }

    const nuevos = prospectos.filter((p: Prospecto) => !conocidos.has(p.id));
    let guardados = 0;

    if (nuevos.length) {
      const filas = nuevos.map((p) => ({ ...aFilaGuardable(p), estado: 'nuevo' }));
      const { error: errIns } = await supa.from('luz_prospectos').insert(filas);
      if (errIns) {
        // Sin la tabla no se puede guardar nada: hay que decir qué falta
        const falta = /relation .*luz_prospectos.* does not exist|Could not find the table/i.test(errIns.message);
        return NextResponse.json(
          {
            error: falta
              ? 'Falta la tabla de oportunidades: ejecuta supabase_prospectos.sql en Supabase.'
              : `No se pudieron guardar: ${errIns.message}`,
          },
          { status: falta ? 400 : 500 }
        );
      }
      guardados = filas.length;
    }

    // A los ya conocidos solo se les refrescan los datos del mapa. El estado,
    // las notas y el motivo de descarte son trabajo de la casa y no se tocan.
    let actualizados = 0;
    for (const p of prospectos) {
      if (!conocidos.has(p.id)) continue;
      const { error: errUpd } = await supa
        .from('luz_prospectos')
        .update(aFilaGuardable(p))
        .eq('osm_id', p.id);
      if (!errUpd) actualizados++;
    }

    return NextResponse.json({
      ok: true,
      encontrados: prospectos.length,
      guardados,
      actualizados,
      aviso,
    });
  } catch {
    return NextResponse.json({ error: 'No se pudo barrer la zona.' }, { status: 500 });
  }
}
