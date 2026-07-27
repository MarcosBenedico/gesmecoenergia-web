/**
 * MONTAR UNA RUTA CON LO QUE DAVID HAYA ELEGIDO — Y APROVECHAR EL VIAJE.
 *
 * David marca en Mi Día los clientes que quiere gestionar hoy y esto hace dos
 * cosas:
 *
 *   1. Los ORDENA por cercanía, para que la ruta no vaya y venga. Con seis
 *      paradas mal ordenadas se pierden veinte minutos, que es media visita.
 *
 *   2. Y busca en el mapa de oportunidades lo que cae DE PASO. Si va a Tamarite
 *      y a doscientos metros de la carretera hay una granja de cuatro naves sin
 *      tocar, eso es una puerta gratis: ya está el desplazamiento pagado.
 *
 * Lo segundo es lo que convierte una ruta de seis clientes en una mañana de
 * nueve puertas sin conducir un kilómetro más.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUIÉN OPTIMIZA DE VERDAD
 *
 * El orden que se calcula aquí es el del vecino más cercano: rápido, y sirve
 * para enseñar la lista en el orden en que se va a conducir. Pero la
 * optimización buena la hace Google con `optimize:true`, que sí conoce las
 * carreteras y los sentidos. Así que la lista se ordena para leerla y el enlace
 * se manda sin orden fijo para que Google lo resuelva mejor que nosotros.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { distKm, kmALaRuta } from './prospeccion.ts';
import { ORIGEN_RUTAS } from './plan-rutas.ts';

export interface Punto { lat: number; lon: number }

export interface Parada {
  /** Clave estable, para casar con la lista de la pantalla. */
  clave: string;
  nombre: string;
  coords: Punto | null;
  /** Por si no hay coordenadas: se manda la dirección tal cual a Google. */
  direccion?: string | null;
}

/** Coordenadas de la oficina, para calcular desde dónde se sale. */
export const COORD_OFICINA: Punto = { lat: 41.8517, lon: 0.2937 };

/**
 * Ordena las paradas empezando por la más cercana al origen y saltando cada vez
 * a la siguiente más próxima. No es el óptimo perfecto, pero en seis u ocho
 * paradas se acerca mucho y se calcula al instante.
 *
 * Las que no tienen coordenadas van al final, en el orden en que llegaron: no se
 * pueden colocar, pero tampoco se tiran.
 */
export function ordenarPorCercania(paradas: Parada[], origen: Punto = COORD_OFICINA): Parada[] {
  const conCoords = paradas.filter((p) => p.coords);
  const sinCoords = paradas.filter((p) => !p.coords);

  const orden: Parada[] = [];
  let actual = origen;
  const quedan = [...conCoords];

  while (quedan.length) {
    let mejor = 0;
    let mejorKm = Infinity;
    for (let i = 0; i < quedan.length; i++) {
      const d = distKm(actual, quedan[i].coords!);
      if (d < mejorKm) { mejorKm = d; mejor = i; }
    }
    const elegida = quedan.splice(mejor, 1)[0];
    orden.push(elegida);
    actual = elegida.coords!;
  }

  return [...orden, ...sinCoords];
}

/** Kilómetros del recorrido en línea recta, ida incluida y vuelta a la oficina. */
export function kmRuta(paradas: Parada[], origen: Punto = COORD_OFICINA): number {
  const pts = paradas.map((p) => p.coords).filter(Boolean) as Punto[];
  if (!pts.length) return 0;
  let total = distKm(origen, pts[0]);
  for (let i = 1; i < pts.length; i++) total += distKm(pts[i - 1], pts[i]);
  total += distKm(pts[pts.length - 1], origen);
  return Math.round(total * 10) / 10;
}

/**
 * Minutos de conducción, estimados a la basta.
 *
 * Se aplica un factor a la distancia en línea recta porque las carreteras de la
 * comarca no van rectas, y una velocidad media de comarcal. Es para decidir si
 * la mañana cabe, no para llegar a una hora clavada.
 */
const FACTOR_CARRETERA = 1.35;
const KM_HORA = 60;
export function minutosConduciendo(km: number): number {
  return Math.round((km * FACTOR_CARRETERA / KM_HORA) * 60);
}

/**
 * ¿Cabe la mañana?
 *
 * Se cuenta la conducción más un tiempo por parada. Veinte minutos por visita es
 * lo que sale de sus días buenos: 9 visitas en una franja de 4 horas y pico.
 */
export const MINUTOS_POR_PARADA = 20;
export function cabeEnLaManana(paradas: Parada[], minutosDisponibles = 345): {
  cabe: boolean; minutos: number; km: number; sobran: number;
} {
  const km = kmRuta(paradas);
  const minutos = minutosConduciendo(km) + paradas.length * MINUTOS_POR_PARADA;
  return { cabe: minutos <= minutosDisponibles, minutos, km, sobran: minutosDisponibles - minutos };
}

// ── Oportunidades de paso ──────────────────────────────────────────────────

export interface OportunidadCerca<T> {
  prospecto: T;
  /** Km en línea recta al punto más cercano del recorrido. */
  km_desvio: number;
}

/**
 * Lo que cae de paso.
 *
 * Se mide contra TODO el recorrido, no contra la parada más cercana: un sitio a
 * 300 m del tramo entre Binéfar y Tamarite no supone desvío ninguno, aunque esté
 * a 8 km de cualquiera de las dos paradas.
 *
 * Ordenadas por lo poco que desvían y, a igual desvío, por puntuación: primero
 * lo que no cuesta nada y más promete.
 */
export function oportunidadesDePaso<T extends { lat: number; lon: number; puntuacion?: number | null }>(
  paradas: Parada[],
  prospectos: T[],
  { kmMax = 2.5, tope = 8, origen = COORD_OFICINA }: { kmMax?: number; tope?: number; origen?: Punto } = {}
): OportunidadCerca<T>[] {
  const recorrido = [origen, ...(paradas.map((p) => p.coords).filter(Boolean) as Punto[]), origen];
  if (recorrido.length < 3) return [];

  return prospectos
    .map((p) => ({ prospecto: p, km_desvio: Math.round(kmALaRuta({ lat: p.lat, lon: p.lon }, recorrido) * 100) / 100 }))
    .filter((x) => x.km_desvio <= kmMax)
    .sort((a, b) => a.km_desvio - b.km_desvio
      || (Number(b.prospecto.puntuacion) || 0) - (Number(a.prospecto.puntuacion) || 0))
    .slice(0, tope);
}

// ── El enlace ──────────────────────────────────────────────────────────────

/** Google admite origen + destino + 8 intermedias en un enlace de este tipo. */
export const MAX_PARADAS = 10;

/**
 * Enlace de Google Maps con la ruta.
 *
 * Se manda con `optimize:true` a propósito: Google conoce las carreteras y los
 * sentidos, y ordena mejor que cualquier cálculo que hagamos aquí con líneas
 * rectas. Nuestro orden sirve para la lista, no para conducir.
 *
 * Y se vuelve a la oficina al final, porque la jornada acaba allí dejando los
 * papeles a Nicola.
 */
export function enlaceRutaOptima(
  paradas: Parada[],
  { origen = ORIGEN_RUTAS, volver = true }: { origen?: string; volver?: boolean } = {}
): string | null {
  const puntos = paradas
    .map((p) => (p.coords ? `${p.coords.lat},${p.coords.lon}` : p.direccion))
    .filter(Boolean) as string[];
  if (!puntos.length) return null;

  const usables = puntos.slice(0, MAX_PARADAS);
  const q = new URLSearchParams({ api: '1', travelmode: 'driving', origin: origen });

  if (volver) {
    q.set('destination', origen);
    q.set('waypoints', `optimize:true|${usables.join('|')}`);
  } else {
    q.set('destination', usables[usables.length - 1]);
    const medias = usables.slice(0, -1);
    if (medias.length) q.set('waypoints', `optimize:true|${medias.join('|')}`);
  }
  return `https://www.google.com/maps/dir/?${q}`;
}
