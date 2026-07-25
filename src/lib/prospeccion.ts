/**
 * PROSPECCIÓN — encontrar a quién venderle placas antes de que nos llame.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ BUSCA ESTO, Y QUÉ NO
 *
 * Busca CONSUMO, no tejado. Lo que se vende es ahorro en la factura: un almacén
 * enorme que enciende dos bombillas no vale nada, y una granja mediana con
 * ventilación las 24 horas vale mucho. Los metros solo cuentan porque más nave
 * son más animales, y más animales son más ventilación.
 *
 * NO sabe el consumo de nadie: eso no es público. Da un ORDEN DE MAGNITUD a
 * partir del tipo de sitio y su tamaño (ver `consumo-estimado.ts`), que sirve
 * para decidir a quién visitar primero y para nada más.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO RECONOCE UNA GRANJA CUANDO EL MAPA NO LO DICE
 *
 * En la Litera, casi ninguna granja está etiquetada como tal en OpenStreetMap:
 * las naves aparecen como `building=yes` a secas. Buscando etiquetas se queda
 * fuera justo lo que más interesa.
 *
 * Lo que sí se puede leer es la FORMA, que en ganadería intensiva es
 * inconfundible: naves largas y estrechas (60-100 m por 12-18 m), varias
 * paralelas, aisladas en el campo, y una balsa al lado. La balsa sí suele estar
 * mapeada, y una balsa junto a naves alargadas es purín.
 *
 * Por eso aquí no se clasifican edificios sueltos sino SITIOS: se agrupan los
 * edificios cercanos y se mira el conjunto. Además así una granja de cuatro
 * naves es una visita y no cuatro.
 *
 * La especie —cerdos, pollos, vacas— NO se puede deducir de forma fiable: las
 * naves se parecen demasiado. Eso lo resuelve la foto aérea, que se enseña al
 * lado: con los silos de pienso y el color de la balsa se ve en dos segundos.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Con extensión y separando los tipos para que Node pueda ejecutar este
// archivo tal cual en los tests, sin compilar nada.
import type { ActividadConsumo, RangoConsumo } from './consumo-estimado.ts';
import { estimarConsumo, tramoConsumo } from './consumo-estimado.ts';

export type TipoProspecto =
  | 'granja_intensiva'
  | 'granja'
  | 'invernadero'
  | 'industria'
  | 'nave'
  | 'riego'
  | 'comercio'
  | 'sin_clasificar';

export interface Prospecto {
  /** id de OSM del elemento principal del sitio: 'way/123456'. */
  id: string;
  tipo: TipoProspecto;
  nombre: string | null;
  lat: number;
  lon: number;

  /** Metros construidos sumando todas las naves del sitio. */
  m2_construidos: number;
  /** Cuántas naves/edificios forman el sitio. */
  n_edificios: number;
  /** Medidas de la nave más grande, que es lo que delata el uso. */
  nave_mayor: { largo: number; ancho: number } | null;
  /** Hay una balsa al lado (purines, o riego). */
  tiene_balsa: boolean;

  /** Distancia en línea recta al punto más cercano de la ruta, en km. */
  km_desvio: number;
  /** Orden de magnitud del consumo. null si no hay base para decir nada. */
  consumo: RangoConsumo | null;
  /** OSM dice que ya tiene placas. */
  ya_tiene_placas: boolean;

  /** 0-100. Prioridad de visita. */
  puntuacion: number;
  /** Por qué puntúa así, en lenguaje llano. */
  motivos: string[];
  /** Lo que hay que mirar en la foto aérea para confirmar de qué va esto. */
  que_mirar: string[];
  municipio: string | null;
}

export const TIPO_PROSPECTO_LABEL: Record<TipoProspecto, string> = {
  granja_intensiva: '🐖 Granja intensiva',
  granja: '🚜 Explotación ganadera',
  invernadero: '🌱 Invernadero',
  industria: '🏭 Industria',
  nave: '📦 Nave / almacén',
  riego: '💧 Riego o bombeo',
  comercio: '🏪 Taller o comercio',
  sin_clasificar: '❓ Por identificar',
};

const ACTIVIDAD: Record<TipoProspecto, ActividadConsumo> = {
  granja_intensiva: 'granja_intensiva',
  granja: 'granja_generica',
  invernadero: 'invernadero',
  industria: 'industria',
  nave: 'nave_almacen',
  riego: 'riego',
  comercio: 'taller_comercio',
  sin_clasificar: 'desconocido',
};

// ── Umbrales de forma ────────────────────────────────────────────────────────
/** Una nave ganadera o industrial es larga y estrecha; una casa, no. */
const NAVE_RATIO_MIN = 2.8;
const NAVE_ANCHO_MIN = 7;
const NAVE_ANCHO_MAX = 40;
const NAVE_LARGO_MIN = 30;
/** Edificios a menos de esto son el mismo sitio. */
export const KM_MISMO_SITIO = 0.1;
/** Una balsa a menos de esto de las naves es de la explotación. */
const KM_BALSA_CERCA = 0.35;
/** Por debajo de esto no merece ni aparecer. */
const M2_MINIMOS = 250;

/**
 * Topes para no confundir una explotación con media población.
 *
 * Agrupando por cercanía sin límite pasa lo que tenía que pasar: los edificios
 * se van encadenando —A cerca de B, B cerca de C— y acaba saliendo un "sitio"
 * de 42 naves que en realidad es un pueblo entero o un polígono. En una prueba
 * real, el complejo del Servicio Aragonés de Salud salió como granja intensiva
 * la primera de la lista. Una explotación de verdad tiene pocas naves y ocupa
 * poco terreno; lo que se pase de esto es tejido urbano y no un cliente.
 */
const MAX_EDIFICIOS_SITIO = 10;
const MAX_DIAMETRO_SITIO_KM = 0.4;

/**
 * AISLAMIENTO: la señal que de verdad separa el campo del pueblo.
 *
 * No se puede confiar en que el casco urbano esté dibujado en el mapa: en
 * Binéfar no lo está, y por eso una manzana de casas adosadas —largas,
 * estrechas, pegadas unas a otras— salía como "granja intensiva" la primera de
 * la lista, con 730 MWh estimados. La ortofoto lo dejó claro de un vistazo.
 *
 * Lo que no falla es que una explotación ganadera está SOLA en medio de los
 * campos. Se cuentan los edificios que hay alrededor y, si hay multitud, es
 * tejido urbano por mucho que las formas engañen.
 */
const KM_RADIO_VECINDARIO = 0.25;
/**
 * Se cuentan los edificios AJENOS al sitio: las naves de la propia granja no
 * cuentan contra ella. Sin esa distinción, una explotación de doce naves se
 * penalizaría a sí misma y quedaría descartada por "urbana".
 *
 * Medido sobre el corredor Binéfar–Tamarite, edificios en 250 m: centro de
 * Binéfar 17, granja de 8 naves 8, granja de la ortofoto 2. Descontando los
 * propios, las granjas se quedan en cero y el pueblo sigue teniendo de sobra.
 *
 * Esto va de la mano del tope de edificios por sitio: si un grupo pudiera
 * crecer sin límite, una manzana entera se absorbería a sí misma, se quedaría
 * sin vecinos ajenos y volvería a colarse como granja. Pasó exactamente eso.
 */
const VECINOS_URBANO = 6;
const VECINOS_AISLADO = 3;

/**
 * Nada de esto se visita para venderle placas por esta vía: son equipamientos
 * públicos, religiosos o deportivos. Alguno podría ser cliente, pero no se
 * capta llamando a la puerta de una granja.
 */
const ETIQUETAS_VETADAS = [
  'amenity', 'healthcare', 'leisure', 'tourism', 'historic', 'military', 'aeroway', 'public_transport',
];
const USOS_VETADOS = /^(church|chapel|cathedral|mosque|school|university|hospital|public|civic|government|train_station|transportation|sports_hall|stadium|toilets|service|kindergarten)$/;

// ═══════════════════════════════════════════════════════════════════════════
//  GEOMETRÍA
// ═══════════════════════════════════════════════════════════════════════════

export function distKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Distancia en km de un punto al tramo a→b (proyectando a metros; en plano). */
export function kmAlTramo(
  p: { lat: number; lon: number },
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const mLat = 111132;
  const mLon = 111320 * Math.cos((p.lat * Math.PI) / 180);
  const ax = (a.lon - p.lon) * mLon, ay = (a.lat - p.lat) * mLat;
  const bx = (b.lon - p.lon) * mLon, by = (b.lat - p.lat) * mLat;
  const dx = bx - ax, dy = by - ay;
  const largo2 = dx * dx + dy * dy;
  if (largo2 === 0) return Math.hypot(ax, ay) / 1000;
  const t = Math.max(0, Math.min(1, (-ax * dx - ay * dy) / largo2));
  return Math.hypot(ax + t * dx, ay + t * dy) / 1000;
}

/**
 * Distancia al RECORRIDO, contando los tramos enteros y no solo las paradas.
 * Entre Binéfar y Tamarite hay 11 km: una granja a pie de carretera a mitad de
 * camino está a 5,5 km de las dos paradas pero a 100 m de la ruta. Es justo lo
 * que se ve por la ventanilla, y midiendo a las paradas se quedaba fuera.
 */
export function kmALaRuta(p: { lat: number; lon: number }, ruta: { lat: number; lon: number }[]): number {
  if (!ruta.length) return 0;
  if (ruta.length === 1) return distKm(p, ruta[0]);
  let min = Infinity;
  for (let i = 0; i < ruta.length - 1; i++) {
    const d = kmAlTramo(p, ruta[i], ruta[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

/** Área de un polígono en m² (fórmula de Gauss sobre metros proyectados). */
export function areaPoligono(puntos: { lat: number; lon: number }[]): number {
  if (puntos.length < 3) return 0;
  const latMedia = (puntos.reduce((s, p) => s + p.lat, 0) / puntos.length) * (Math.PI / 180);
  const mLat = 111132;
  const mLon = 111320 * Math.cos(latMedia);
  let suma = 0;
  for (let i = 0; i < puntos.length; i++) {
    const a = puntos[i], b = puntos[(i + 1) % puntos.length];
    suma += a.lon * mLon * (b.lat * mLat) - b.lon * mLon * (a.lat * mLat);
  }
  return Math.abs(suma) / 2;
}

/**
 * Largo y ancho REALES del edificio, en metros.
 *
 * No vale la caja norte-sur: una nave girada 45° daría un cuadrado y parecería
 * un almacén cuadrado en vez de una nave alargada. Se prueban rotaciones y se
 * coge la caja de menor área, que es la que se ajusta al edificio.
 */
export function dimensionesNave(puntos: { lat: number; lon: number }[]): { largo: number; ancho: number } {
  if (puntos.length < 3) return { largo: 0, ancho: 0 };
  const latMedia = (puntos.reduce((s, p) => s + p.lat, 0) / puntos.length) * (Math.PI / 180);
  const mLon = 111320 * Math.cos(latMedia);
  const pts = puntos.map((p) => ({ x: p.lon * mLon, y: p.lat * 111132 }));

  let mejor = { area: Infinity, largo: 0, ancho: 0 };
  // Cada 3° basta: el error en las medidas es menor que el del propio dibujo
  for (let deg = 0; deg < 90; deg += 3) {
    const a = (deg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
      const x = p.x * ca + p.y * sa, y = -p.x * sa + p.y * ca;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const w = maxX - minX, h = maxY - minY;
    if (w * h < mejor.area) mejor = { area: w * h, largo: Math.max(w, h), ancho: Math.min(w, h) };
  }
  return { largo: Math.round(mejor.largo), ancho: Math.round(mejor.ancho) };
}

/** ¿Tiene forma de nave? Largo, estrecho y de tamaño de explotación. */
export function pareceNave(d: { largo: number; ancho: number }): boolean {
  if (d.ancho < NAVE_ANCHO_MIN || d.ancho > NAVE_ANCHO_MAX) return false;
  if (d.largo < NAVE_LARGO_MIN) return false;
  return d.largo / d.ancho >= NAVE_RATIO_MIN;
}

/** ¿Está el punto dentro del polígono? (ray casting). Para descartar cascos urbanos. */
export function dentroDe(p: { lat: number; lon: number }, poligono: { lat: number; lon: number }[]): boolean {
  if (poligono.length < 3) return false;
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i], b = poligono[j];
    if (a.lat > p.lat !== b.lat > p.lat &&
        p.lon < ((b.lon - a.lon) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lon) dentro = !dentro;
  }
  return dentro;
}

// ═══════════════════════════════════════════════════════════════════════════
//  DE OPENSTREETMAP A SITIOS
// ═══════════════════════════════════════════════════════════════════════════

export interface ElementoOSM {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

/**
 * Dónde está el elemento. Overpass no siempre manda lo mismo: al pedir `geom`
 * llegan `bounds` y `geometry` pero NO `center`. Hay que aceptar las tres
 * formas o se cae todo sin decir por qué.
 */
export function centroDe(e: ElementoOSM): { lat: number; lon: number } | null {
  if (e.center) return e.center;
  if (e.lat != null && e.lon != null) return { lat: e.lat, lon: e.lon };
  if (e.bounds) {
    return { lat: (e.bounds.minlat + e.bounds.maxlat) / 2, lon: (e.bounds.minlon + e.bounds.maxlon) / 2 };
  }
  if (e.geometry?.length) {
    const n = e.geometry.length;
    return {
      lat: e.geometry.reduce((s, p) => s + p.lat, 0) / n,
      lon: e.geometry.reduce((s, p) => s + p.lon, 0) / n,
    };
  }
  return null;
}

interface Edificio {
  id: string;
  lat: number;
  lon: number;
  area: number;
  dims: { largo: number; ancho: number };
  esNave: boolean;
  tags: Record<string, string>;
}

/** Un sitio: uno o varios edificios que son la misma explotación o empresa. */
interface Sitio {
  edificios: Edificio[];
  lat: number;
  lon: number;
}

/** Diámetro del sitio en km: lo que hay entre sus dos edificios más separados. */
function diametroKm(eds: Edificio[]): number {
  let max = 0;
  for (let i = 0; i < eds.length; i++) {
    for (let j = i + 1; j < eds.length; j++) {
      const d = distKm(eds[i], eds[j]);
      if (d > max) max = d;
    }
  }
  return max;
}

/**
 * Agrupa edificios cercanos: una granja son sus cuatro naves, y es UNA visita.
 *
 * El agrupamiento no crece sin límite. Si al meter un edificio el conjunto se
 * pasa de tamaño, no se mete: ese edificio abre su propio sitio. Sin este freno
 * los edificios se encadenan y acaba saliendo un "sitio" que es un pueblo.
 */
function agruparEnSitios(edificios: Edificio[]): Sitio[] {
  const sitios: Sitio[] = [];
  for (const ed of edificios) {
    const cerca = sitios.find(
      (s) =>
        s.edificios.length < MAX_EDIFICIOS_SITIO &&
        s.edificios.some((o) => distKm(o, ed) < KM_MISMO_SITIO) &&
        diametroKm([...s.edificios, ed]) <= MAX_DIAMETRO_SITIO_KM
    );
    if (cerca) {
      cerca.edificios.push(ed);
      cerca.lat = cerca.edificios.reduce((t, e) => t + e.lat, 0) / cerca.edificios.length;
      cerca.lon = cerca.edificios.reduce((t, e) => t + e.lon, 0) / cerca.edificios.length;
    } else {
      sitios.push({ edificios: [ed], lat: ed.lat, lon: ed.lon });
    }
  }
  return sitios;
}

/** Equipamientos públicos y similares: no son clientes de esta vía. */
function estaVetado(tags: Record<string, string>): boolean {
  if (ETIQUETAS_VETADAS.some((k) => tags[k])) return true;
  if (USOS_VETADOS.test(tags.building || '')) return true;
  return false;
}

/**
 * Qué es este sitio. Primero se hace caso a las etiquetas cuando las hay, y si
 * no —que es lo normal— se deduce de la forma.
 */
function clasificarSitio(
  s: Sitio,
  tieneBalsa: boolean,
  aislado: boolean
): { tipo: TipoProspecto; queMirar: string[] } {
  const tags = Object.assign({}, ...s.edificios.map((e) => e.tags)) as Record<string, string>;
  const naves = s.edificios.filter((e) => e.esNave);
  const queMirar: string[] = [];

  const etiquetaGranja =
    tags.landuse === 'farmyard' || !!tags.animal_keeping ||
    /^(farm_auxiliary|barn|stable|cowshed|sty|chicken_coop)$/.test(tags.building || '');

  // Ganadería intensiva: varias naves largas juntas, o una nave y una balsa,
  // Y sola en el campo. Sin la condición de aislamiento, una manzana de casas
  // adosadas cumple lo de "varias naves largas juntas" y se cuela arriba.
  const patronIntensivo = aislado && (naves.length >= 2 || (naves.length >= 1 && tieneBalsa));

  if (etiquetaGranja || patronIntensivo) {
    if (patronIntensivo) {
      queMirar.push(
        tieneBalsa
          ? 'Hay una balsa al lado: si es oscura, es de purines → cerdos o vacuno. Si es de agua limpia, riego.'
          : 'Mira si hay balsa fuera del encuadre y silos de pienso pegados a las naves.'
      );
      queMirar.push('Silos de pienso (cilindros metálicos junto a la nave) = ganadería intensiva confirmada.');
      queMirar.push('Extractores en el testero de la nave = ventilación forzada, que es el consumo gordo.');
    }
    return { tipo: patronIntensivo ? 'granja_intensiva' : 'granja', queMirar };
  }

  if (tags.landuse === 'greenhouse_horticulture' || tags.building === 'greenhouse') {
    return { tipo: 'invernadero', queMirar };
  }
  if (tags.man_made === 'pumping_station' || tags.man_made === 'water_well') {
    return { tipo: 'riego', queMirar };
  }
  if (tags.landuse === 'industrial' || /^(industrial|factory)$/.test(tags.building || '')) {
    queMirar.push('Camiones o muelles de carga = actividad real, no nave parada.');
    return { tipo: 'industria', queMirar };
  }
  if (tags.building === 'warehouse' || tags.industrial) {
    queMirar.push('¿Se ve equipo de frío en cubierta? Si hay cámara, el consumo se multiplica.');
    return { tipo: 'nave', queMirar };
  }
  if (tags.shop || tags.craft || tags.office || /^(commercial|retail)$/.test(tags.building || '')) {
    return { tipo: 'comercio', queMirar };
  }

  // Sin etiquetas y sin patrón: una nave suelta grande en el campo
  if (naves.length >= 1 && aislado) {
    queMirar.push('Nave aislada sin identificar: mira si hay silos (granja), muelle (almacén) o coches (taller).');
    return { tipo: 'nave', queMirar };
  }
  queMirar.push('El mapa no dice qué es. La foto es la única pista: mira accesos, vehículos y depósitos.');
  return { tipo: 'sin_clasificar', queMirar };
}

/**
 * Convierte la respuesta cruda de Overpass en sitios puntuados.
 *
 * Se cae casi todo lo que llega: cascos urbanos, edificios pequeños, y lo que
 * queda fuera del radio. De unos 800 elementos suelen salir 30-60 sitios.
 */
export function procesarElementos(
  elementos: ElementoOSM[],
  ruta: { lat: number; lon: number }[],
  radioKm: number
): Prospecto[] {
  const zonasResidenciales = elementos
    .filter((e) => e.tags?.landuse === 'residential' && e.geometry && e.geometry.length >= 3)
    .map((e) => e.geometry!);

  const esUrbano = (p: { lat: number; lon: number }) => zonasResidenciales.some((z) => dentroDe(p, z));

  // Balsas: la pista de que unas naves son una explotación ganadera
  const balsas: { lat: number; lon: number }[] = [];
  const edificios: Edificio[] = [];
  /**
   * Censo con el que se mide si un sitio está solo en el campo o metido en el
   * pueblo. Son los edificios grandes que devuelve el mapa: las viviendas
   * pequeñas ya no se piden porque barrerlas en una ruta larga tumbaba la
   * consulta, y resulta que con los grandes la señal se distingue igual.
   */
  const censo: { id: string; lat: number; lon: number }[] = [];

  for (const e of elementos) {
    const tags = e.tags || {};
    const centro = centroDe(e);
    if (!centro) continue;
    if (tags.building) censo.push({ id: `${e.type}/${e.id}`, ...centro });

    if (tags.water === 'basin' || tags.landuse === 'basin' || tags.man_made === 'storage_tank') {
      balsas.push(centro);
      continue;
    }
    if (tags.landuse === 'residential') continue;
    // Un recinto (landuse) no es un edificio: sus naves ya vienen por su cuenta
    if (tags.landuse && !tags.building) continue;
    if (!tags.building && !tags.man_made) continue;
    // Viviendas: nunca interesan
    if (/^(house|residential|apartments|detached|hut|garage|garages|shed)$/.test(tags.building || '')) continue;
    // Colegios, centros de salud, iglesias, polideportivos…
    if (estaVetado(tags)) continue;

    const geom = e.geometry && e.geometry.length >= 3 ? e.geometry : null;
    const area = geom ? areaPoligono(geom) : 0;
    const dims = geom ? dimensionesNave(geom) : { largo: 0, ancho: 0 };

    edificios.push({
      id: `${e.type}/${e.id}`,
      lat: centro.lat, lon: centro.lon,
      area, dims, esNave: pareceNave(dims), tags,
    });
  }

  const prospectos: Prospecto[] = [];

  for (const sitio of agruparEnSitios(edificios)) {
    const m2 = Math.round(sitio.edificios.reduce((t, e) => t + e.area, 0));
    if (m2 < M2_MINIMOS) continue;
    // Dentro del pueblo casi todo lo grande es un bloque de pisos
    if (esUrbano(sitio)) continue;

    const kmDesvio = kmALaRuta(sitio, ruta);
    if (kmDesvio > radioKm) continue;

    // Cuántos edificios AJENOS hay alrededor: pueblo o campo. Las naves del
    // propio sitio no cuentan, o una granja grande se descartaría a sí misma.
    const propios = new Set(sitio.edificios.map((e) => e.id));
    const vecinos = censo.reduce(
      (t, c) => t + (!propios.has(c.id) && distKm(c, sitio) < KM_RADIO_VECINDARIO ? 1 : 0),
      0
    );
    // En el meollo del pueblo no se puede decir quién es quién: no se propone nada
    if (vecinos > VECINOS_URBANO) continue;

    const tieneBalsa = balsas.some((b) => distKm(b, sitio) < KM_BALSA_CERCA);
    const { tipo, queMirar } = clasificarSitio(sitio, tieneBalsa, vecinos <= VECINOS_AISLADO);

    // Siempre lo primero que hay que mirar. OSM apenas registra instalaciones
    // solares: en una prueba, una industria con placas bien visibles en la
    // ortofoto figuraba en el mapa como si no tuviera nada. Ir a ofrecer
    // placas a quien ya las tiene es la peor forma de empezar una visita.
    queMirar.unshift('¿Se ven placas en la cubierta o en el aparcamiento? El mapa casi nunca lo registra; la foto sí.');

    const tags = Object.assign({}, ...sitio.edificios.map((e) => e.tags)) as Record<string, string>;
    const naveMayor = sitio.edificios
      .filter((e) => e.esNave)
      .sort((a, b) => b.dims.largo * b.dims.ancho - a.dims.largo * a.dims.ancho)[0];
    // El edificio más grande da el id del sitio: es el que mejor lo representa
    const principal = [...sitio.edificios].sort((a, b) => b.area - a.area)[0];

    const base = {
      id: principal.id,
      tipo,
      nombre: tags.name || tags.operator || tags['addr:housename'] || null,
      lat: sitio.lat,
      lon: sitio.lon,
      m2_construidos: m2,
      n_edificios: sitio.edificios.length,
      nave_mayor: naveMayor ? naveMayor.dims : null,
      tiene_balsa: tieneBalsa,
      km_desvio: Math.round(kmDesvio * 100) / 100,
      consumo: estimarConsumo(ACTIVIDAD[tipo], m2),
      ya_tiene_placas:
        tags['generator:source'] === 'solar' ||
        tags.power === 'generator' ||
        tags['roof:material'] === 'solar_panels',
      municipio: tags['addr:city'] || tags['addr:place'] || null,
    };

    prospectos.push({ ...base, que_mirar: queMirar, ...puntuar(base, radioKm) });
  }

  return prospectos.sort((a, b) => b.puntuacion - a.puntuacion);
}

// ═══════════════════════════════════════════════════════════════════════════
//  PUNTUACIÓN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Prioridad de visita, 0-100. Manda el consumo estimado (hasta 40 puntos),
 * porque es lo que decide si merece la pena una oferta. Después, lo bien que
 * encaja ese consumo con las horas de sol (hasta 20), lo poco que hay que
 * desviarse (hasta 20) y las pistas de que la cosa va en serio (hasta 20).
 */
export function puntuar(
  p: Omit<Prospecto, 'puntuacion' | 'motivos' | 'que_mirar'>,
  radioKm: number
): { puntuacion: number; motivos: string[] } {
  const motivos: string[] = [];
  let n = 0;

  if (p.consumo) {
    const tramo = tramoConsumo(p.consumo.centro);
    n += tramo.peso;
    motivos.push(
      `${tramo.texto}: del orden de ${p.consumo.min.toLocaleString('es-ES')}–${p.consumo.max.toLocaleString('es-ES')} kWh/año por tipo y tamaño. Es una estimación, no un dato.`
    );
    motivos.push(p.consumo.perfil.motor);

    const encaje = { excelente: 20, bueno: 12, regular: 4 }[p.consumo.perfil.encaje_solar];
    n += encaje;
    if (p.consumo.perfil.encaje_solar === 'excelente') {
      motivos.push('El consumo cae en horas de sol: es donde el autoconsumo amortiza mejor.');
    } else if (p.consumo.perfil.encaje_solar === 'regular') {
      motivos.push('⚠️ Puede que consuma poco de día, y entonces las placas rinden menos.');
    }
  } else {
    motivos.push('No hay base para estimar el consumo: habría que verlo.');
  }

  // Señales de que es una explotación de verdad y no una nave parada
  if (p.n_edificios >= 3) { n += 8; motivos.push(`${p.n_edificios} naves juntas: explotación de tamaño, no un cobertizo.`); }
  else if (p.n_edificios === 2) { n += 4; motivos.push('Dos naves: explotación pequeña o mediana.'); }

  if (p.nave_mayor && p.nave_mayor.largo >= 60) {
    n += 6;
    motivos.push(`Nave de ${p.nave_mayor.largo} × ${p.nave_mayor.ancho} m: medidas de nave ganadera o industrial.`);
  }
  if (p.tiene_balsa) { n += 6; motivos.push('Balsa al lado: casi seguro explotación ganadera con purines, o riego.'); }
  if (p.nombre) { n += 4; motivos.push(`Sale con nombre en el mapa («${p.nombre}»): se puede buscar antes de ir.`); }

  // Desvío
  const cerca = Math.max(0, 1 - p.km_desvio / Math.max(radioKm, 0.1));
  n += Math.round(20 * cerca);
  motivos.push(p.km_desvio < 0.4 ? 'Prácticamente de paso: no supone desvío.' : `A ${p.km_desvio.toFixed(1)} km de la ruta.`);

  if (p.ya_tiene_placas) {
    n -= 40;
    motivos.push('⚠️ En el mapa ya figura con placas. Aun así se le puede ofrecer batería, ampliación o cambio de comercializadora.');
  }

  return { puntuacion: Math.max(0, Math.min(100, n)), motivos };
}

/** Etiqueta corta del interés, para no obligar a interpretar un número. */
export function nivelInteres(puntuacion: number): { texto: string; tono: 'alto' | 'medio' | 'bajo' } {
  if (puntuacion >= 65) return { texto: 'Merece la pena', tono: 'alto' };
  if (puntuacion >= 40) return { texto: 'Si cuadra', tono: 'medio' };
  return { texto: 'Solo si sobra tiempo', tono: 'bajo' };
}
