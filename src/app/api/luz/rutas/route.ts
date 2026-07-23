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

/** Coordenadas escritas a mano ("41.85, 0.29") o dentro de un enlace de Google Maps. */
function coordsDirectas(texto: string): { lat: number; lon: number } | null {
  const t = texto.trim();
  // Enlace de Google Maps: .../@41.85,0.29,15z · ?q=41.85,0.29 · !3d41.85!4d0.29
  const patrones = [
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
    /[?&]q=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/, // "lat, lon" a pelo
  ];
  for (const re of patrones) {
    const m = t.match(re);
    if (m) {
      const lat = parseFloat(m[1]);
      const lon = parseFloat(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
    }
  }
  return null;
}

async function geocodificar(direccion: string): Promise<{ lat: number; lon: number } | null> {
  const directas = coordsDirectas(direccion);
  if (directas) return directas;
  const clave = direccion.trim().toLowerCase();
  if (cacheGeo.has(clave)) return cacheGeo.get(clave)!;
  // Enlace corto de Google Maps → seguir la redirección para sacar las coordenadas
  if (/maps\.app\.goo\.gl|goo\.gl\/maps/i.test(direccion)) {
    try {
      const res = await fetch(direccion.trim(), { redirect: 'follow' });
      const r = coordsDirectas(res.url) || coordsDirectas(await res.text().then((t) => t.slice(0, 5000)).catch(() => ''));
      cacheGeo.set(clave, r);
      return r;
    } catch {
      cacheGeo.set(clave, null);
      return null;
    }
  }
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
    const body = (await req.json()) as { origen?: string; paradas: Parada[]; accion?: string };
    const { origen, paradas } = body;
    if (!Array.isArray(paradas) || paradas.length === 0) {
      return NextResponse.json({ error: 'Selecciona al menos una parada.' }, { status: 400 });
    }

    // Modo "solo geocodificar": para pintar el mapa, sin calcular orden ni URL de Maps.
    if (body.accion === 'geocodificar') {
      if (paradas.length > 60) return NextResponse.json({ error: 'Máximo 60 ubicaciones por carga de mapa.' }, { status: 400 });
      const puntos: (Parada & { lat: number | null; lon: number | null })[] = [];
      for (const p of paradas) {
        const g = p.direccion?.trim() ? await geocodificar(p.direccion) : null;
        puntos.push({ ...p, lat: g?.lat ?? null, lon: g?.lon ?? null });
      }
      const origenGeo = origen?.trim() ? await geocodificar(origen.trim()) : await geocodificar(ORIGEN_DEFECTO);
      return NextResponse.json({ ok: true, puntos, origen: origenGeo });
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
      orden: ordenadas.map((p) => ({ id: p.id, nombre: p.nombre, direccion: p.direccion, ubicada: p.lat != null, lat: p.lat, lon: p.lon })),
      origen_geo: geoOrigen,
      km_estimados: Math.round(km),
      sin_ubicar: sinUbicar,
      url_maps: url,
      aviso: ordenadas.length > 10 ? 'Google Maps admite unas 10 paradas por trayecto: divide la ruta si no las carga todas.' : null,
    });
  } catch {
    return NextResponse.json({ error: 'No se pudo calcular la ruta.' }, { status: 500 });
  }
}
