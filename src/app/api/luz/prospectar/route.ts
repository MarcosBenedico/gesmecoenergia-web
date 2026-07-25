import { NextRequest, NextResponse } from 'next/server';
import { ElementoOSM, Prospecto, distKm, procesarElementos } from '@/lib/prospeccion';

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

export const maxDuration = 60;

const OVERPASS = 'https://overpass-api.de/api/interpreter';
const UA = 'GesmecoEnergia-Prospeccion/1.0 (gesmecoenergia.com)';
const RADIO_DEFECTO_KM = 2;
const RADIO_MAX_KM = 5;
const MAX_VERTICES_RUTA = 25;    // con más, el corredor se hace enorme y Overpass se atraganta
const MAX_RESULTADOS = 60;
const KM_YA_ES_CLIENTE = 0.15;

const cache = new Map<string, { en: number; datos: Prospecto[] }>();
const CACHE_MS = 30 * 60 * 1000;

function consultaOverpass(ruta: { lat: number; lon: number }[], radioM: number): string {
  const a = `around:${Math.round(radioM)},${ruta.map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join(',')}`;
  // Se piden TODOS los edificios, no solo los etiquetados: en esta zona las
  // naves de las granjas están como `building=yes` a secas, y filtrando por
  // etiqueta se quedaba fuera justo lo que más interesa. La criba se hace
  // luego por forma y tamaño, en procesarElementos().
  //
  // Las balsas no son candidatos: son la pista de que unas naves son una
  // explotación ganadera. Y `residential` marca los cascos urbanos, para
  // descartar lo que cae dentro del pueblo.
  return `[out:json][timeout:60];
(
  way["building"](${a});
  way["landuse"~"^(farmyard|industrial|greenhouse_horticulture)$"](${a});
  way["man_made"~"^(silo|storage_tank|pumping_station|water_well)$"](${a});
  way["water"="basin"](${a});
  way["landuse"="basin"](${a});
  way["landuse"="residential"](${a});
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

    // Vértices repartidos de forma uniforme a lo largo del recorrido
    const paso = Math.max(1, Math.ceil(ruta.length / MAX_VERTICES_RUTA));
    const vertices = ruta.filter((_, i) => i % paso === 0);
    const ultimo = ruta[ruta.length - 1];
    if (vertices[vertices.length - 1] !== ultimo) vertices.push(ultimo);

    const clave = JSON.stringify({ vertices, radioKm });
    const guardado = cache.get(clave);
    if (guardado && Date.now() - guardado.en < CACHE_MS) {
      return NextResponse.json({
        ok: true, cacheado: true, radio_km: radioKm,
        prospectos: quitarClientes(guardado.datos, body.excluir),
      });
    }

    let elementos: ElementoOSM[];
    try {
      const res = await fetch(OVERPASS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: `data=${encodeURIComponent(consultaOverpass(vertices, radioKm * 1000))}`,
        signal: AbortSignal.timeout(50000),
      });
      if (!res.ok) {
        return NextResponse.json(
          {
            error: res.status === 429 || res.status === 504
              ? 'El mapa público está saturado ahora mismo. Prueba otra vez en un par de minutos.'
              : `El servicio de mapas respondió ${res.status}.`,
          },
          { status: 503 }
        );
      }
      elementos = ((await res.json()) as { elements?: ElementoOSM[] }).elements || [];
    } catch {
      return NextResponse.json(
        { error: 'No se pudo consultar el mapa (OpenStreetMap). Inténtalo de nuevo en un momento.' },
        { status: 503 }
      );
    }

    const prospectos = procesarElementos(elementos, ruta, radioKm);
    cache.set(clave, { en: Date.now(), datos: prospectos });

    return NextResponse.json({
      ok: true,
      radio_km: radioKm,
      revisados: elementos.length,
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
