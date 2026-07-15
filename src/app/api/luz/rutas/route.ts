import { NextRequest, NextResponse } from 'next/server';

/**
 * Planificador de rutas de visitas.
 * POST { origen, paradas: [{ id, nombre, direccion }] }
 *  → geolocaliza las direcciones (OpenStreetMap/Nominatim), ordena las paradas
 *    por cercanía (vecino más próximo + mejora 2-opt) y devuelve el orden
 *    eficiente + la URL de Google Maps lista para navegar.
 */

interface Parada { id: string; nombre: string; direccion: string }
interface ParadaGeo extends Parada { lat: number | null; lon: number | null }

const ORIGEN_DEFECTO = 'Avenida de Aragón 50, Binéfar, Huesca, España';

// Caché en memoria del proceso (las direcciones no cambian entre peticiones)
const cacheGeo = new Map<string, { lat: number; lon: number } | null>();

async function geocodificar(direccion: string): Promise<{ lat: number; lon: number } | null> {
  const clave = direccion.trim().toLowerCase();
  if (cacheGeo.has(clave)) return cacheGeo.get(clave)!;
  try {
    const q = /españa|spain/i.test(direccion) ? direccion : `${direccion}, España`;
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { 'User-Agent': 'GesmecoEnergia-Rutas/1.0 (gesmecoenergia.com)' } }
    );
    const json = await res.json();
    const r = Array.isArray(json) && json[0] ? { lat: parseFloat(json[0].lat), lon: parseFloat(json[0].lon) } : null;
    cacheGeo.set(clave, r);
    return r;
  } catch {
    cacheGeo.set(clave, null);
    return null;
  }
}

/** Distancia haversine en km. */
function dist(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Vecino más próximo desde el origen + mejora 2-opt. */
function ordenar(origen: { lat: number; lon: number }, paradas: ParadaGeo[]): ParadaGeo[] {
  const conGeo = paradas.filter((p) => p.lat != null) as (ParadaGeo & { lat: number; lon: number })[];
  const sinGeo = paradas.filter((p) => p.lat == null);

  // Vecino más próximo
  const ruta: typeof conGeo = [];
  const pendientes = [...conGeo];
  let actual = origen;
  while (pendientes.length) {
    let mejor = 0;
    for (let i = 1; i < pendientes.length; i++) {
      if (dist(actual, pendientes[i]) < dist(actual, pendientes[mejor])) mejor = i;
    }
    const [p] = pendientes.splice(mejor, 1);
    ruta.push(p);
    actual = p;
  }

  // 2-opt: deshacer cruces mientras mejore
  const largo = (r: typeof conGeo) => {
    let t = r.length ? dist(origen, r[0]) : 0;
    for (let i = 0; i < r.length - 1; i++) t += dist(r[i], r[i + 1]);
    return t;
  };
  let mejorado = true;
  while (mejorado && ruta.length > 3) {
    mejorado = false;
    for (let i = 0; i < ruta.length - 1; i++) {
      for (let j = i + 1; j < ruta.length; j++) {
        const nueva = [...ruta.slice(0, i), ...ruta.slice(i, j + 1).reverse(), ...ruta.slice(j + 1)];
        if (largo(nueva) < largo(ruta) - 0.01) {
          ruta.splice(0, ruta.length, ...nueva);
          mejorado = true;
        }
      }
    }
  }

  return [...ruta, ...sinGeo];
}

export async function POST(req: NextRequest) {
  try {
    const { origen, paradas } = (await req.json()) as { origen?: string; paradas: Parada[] };
    if (!Array.isArray(paradas) || paradas.length === 0) {
      return NextResponse.json({ error: 'Selecciona al menos una parada.' }, { status: 400 });
    }
    if (paradas.length > 20) {
      return NextResponse.json({ error: 'Máximo 20 paradas por ruta.' }, { status: 400 });
    }
    const dirOrigen = origen?.trim() || ORIGEN_DEFECTO;

    // Geocodificar origen y paradas (en serie: Nominatim pide moderación)
    const geoOrigen = await geocodificar(dirOrigen);
    const geo: ParadaGeo[] = [];
    for (const p of paradas) {
      const g = p.direccion?.trim() ? await geocodificar(p.direccion) : null;
      geo.push({ ...p, lat: g?.lat ?? null, lon: g?.lon ?? null });
    }

    const ordenadas = geoOrigen ? ordenar(geoOrigen, geo) : geo;
    const sinUbicar = ordenadas.filter((p) => p.lat == null).map((p) => p.nombre);

    // Distancia estimada del recorrido
    let km = 0;
    if (geoOrigen) {
      let ant: { lat: number; lon: number } = geoOrigen;
      for (const p of ordenadas) {
        if (p.lat == null || p.lon == null) continue;
        km += dist(ant, { lat: p.lat, lon: p.lon });
        ant = { lat: p.lat, lon: p.lon };
      }
    }

    // URL de Google Maps (origen → paradas en orden). Google admite ~9 intermedias.
    const puntos = ordenadas.map((p) => (p.lat != null ? `${p.lat},${p.lon}` : p.direccion));
    const destino = puntos[puntos.length - 1];
    const intermedias = puntos.slice(0, -1);
    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `&origin=${encodeURIComponent(dirOrigen)}` +
      `&destination=${encodeURIComponent(destino)}` +
      (intermedias.length ? `&waypoints=${encodeURIComponent(intermedias.join('|'))}` : '') +
      `&travelmode=driving`;

    return NextResponse.json({
      ok: true,
      orden: ordenadas.map((p) => ({ id: p.id, nombre: p.nombre, direccion: p.direccion, ubicada: p.lat != null })),
      km_estimados: Math.round(km),
      sin_ubicar: sinUbicar,
      url_maps: url,
      aviso: ordenadas.length > 10 ? 'Google Maps admite unas 10 paradas por trayecto: divide la ruta si no las carga todas.' : null,
    });
  } catch {
    return NextResponse.json({ error: 'No se pudo calcular la ruta.' }, { status: 500 });
  }
}
