import { NextRequest, NextResponse } from 'next/server';
import { Prospecto, distKm } from '@/lib/prospeccion';
import { buscarProspectos } from './buscar';

/**
 * BÚSQUEDA SUELTA DE CANDIDATOS (sin guardar)
 *
 * POST { ruta: [{lat,lon}], radio_km?, excluir?: [{lat,lon}] }
 *
 * Se usa para mirar una zona sin comprometerse. Lo normal es barrer y guardar
 * (`/api/luz/barrer`), porque así se puede ir descartando y el mapa mejora con
 * el uso en vez de repetir siempre el mismo trabajo.
 *
 * `excluir` son los clientes que ya están en la cartera: lo que caiga a menos
 * de 150 m de uno de ellos no se enseña. 150 m porque la dirección
 * geocodificada de un cliente rara vez cae justo encima de su nave.
 */

export const maxDuration = 120;

const MAX_RESULTADOS = 60;
const KM_YA_ES_CLIENTE = 0.15;
const RADIO_DEFECTO_KM = 2;
const RADIO_MAX_KM = 5;

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
    const { prospectos, aviso, error } = await buscarProspectos(ruta, radioKm);
    if (error) return NextResponse.json({ error }, { status: 503 });

    return NextResponse.json({
      ok: true,
      radio_km: radioKm,
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
