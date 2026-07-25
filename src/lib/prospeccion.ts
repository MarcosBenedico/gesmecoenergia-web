/**
 * PROSPECCIÓN SOBRE LA RUTA — aprovechar el viaje.
 *
 * Cuando David sale a ver a un cliente, pasa por delante de granjas y naves que
 * no están en la cartera. Esto las saca a la luz: coge el corredor de la ruta y
 * enseña qué hay alrededor que merezca una parada.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DE DÓNDE SALEN LOS DATOS Y QUÉ FIABILIDAD TIENEN — leer antes de fiarse:
 *
 * La fuente es OpenStreetMap (Overpass), que es un mapa hecho por voluntarios.
 * Eso significa dos cosas, y las dos importan:
 *
 *   1. NO sabemos el consumo de nadie. Eso no está en ningún mapa público.
 *      Lo que se ve aquí son SEÑALES FÍSICAS de que probablemente haya consumo:
 *      que sea una granja, que sea una nave, cuántos metros de tejado tiene.
 *      La puntuación es una prioridad de visita, no una estimación de factura.
 *
 *   2. La cobertura es incompleta y desigual. En la Litera y el Cinca hay
 *      bastantes granjas mapeadas, pero faltan muchas, y muchas otras están
 *      como "edificio" a secas, sin decir qué son. Que algo no salga aquí no
 *      quiere decir que no exista.
 *
 * Los kWp son orientativos: salen de los metros de tejado, no de un estudio.
 * Sirven para decidir a quién visitar, no para ofertar.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type TipoProspecto =
  | 'granja'
  | 'nave'
  | 'industrial'
  | 'invernadero'
  | 'silo'
  | 'riego'
  | 'comercio'
  | 'edificio_grande';

export interface Prospecto {
  /** id de OSM, con prefijo de tipo: 'way/123456'. Estable entre consultas. */
  id: string;
  tipo: TipoProspecto;
  /** Nombre si OSM lo tiene. Muchas veces no lo tiene. */
  nombre: string | null;
  lat: number;
  lon: number;
  /** Superficie del polígono en m². 0 si es un punto. */
  area_m2: number;
  /**
   * true si `area_m2` es la parcela entera (una granja, un polígono), no un
   * tejado. Cambia por completo lo que se puede deducir: en una parcela solo
   * una parte está construida.
   */
  es_parcela: boolean;
  /** Distancia en línea recta al punto más cercano de la ruta, en km. */
  km_desvio: number;
  /** Tejado aprovechable estimado → kWp. Orientativo. */
  kwp_estimado: number;
  /**
   * true solo si el kWp sale de tejados medidos en el mapa. Cuando sale de una
   * parcela es una regla de tres sobre cuánto suele estar construido, y dar un
   * número concreto sería engañar: se enseña el tamaño del recinto y se dice
   * que el tejado hay que verlo.
   */
  kwp_fiable: boolean;
  /** OSM dice que ya tiene placas. */
  ya_tiene_placas: boolean;
  /** 0-100. Prioridad de visita, no estimación de consumo. */
  puntuacion: number;
  /** Por qué puntúa así, en lenguaje llano. Se enseña siempre. */
  motivos: string[];
  /** Pueblo/municipio si OSM lo trae. */
  municipio: string | null;
}

export const TIPO_PROSPECTO_LABEL: Record<TipoProspecto, string> = {
  granja: '🐖 Granja',
  nave: '🏭 Nave',
  industrial: '🏗️ Polígono / industria',
  invernadero: '🌱 Invernadero',
  silo: '🌾 Silo / almacén agrícola',
  riego: '💧 Riego / bombeo',
  comercio: '🏪 Comercio o taller',
  edificio_grande: '📦 Edificio grande sin clasificar',
};

/**
 * Puntos base por tipo. El criterio es el perfil de consumo típico:
 * una granja de porcino o avícola ventila y alimenta las 24 horas —consumo alto
 * y constante, que es justo donde el autoconsumo amortiza mejor—, mientras que
 * un comercio consume menos y de forma más irregular.
 */
const PUNTOS_TIPO: Record<TipoProspecto, number> = {
  granja: 40,
  industrial: 36,
  nave: 34,
  invernadero: 28,
  riego: 26,
  silo: 20,
  comercio: 14,
  edificio_grande: 12,
};

const MOTIVO_TIPO: Record<TipoProspecto, string> = {
  granja: 'Granja: ventilación y alimentación funcionan casi todo el día, que es donde el autoconsumo cunde más.',
  industrial: 'Suelo industrial: consumo en horario de trabajo, que coincide con las horas de sol.',
  nave: 'Nave: mucho tejado y consumo en horario diurno.',
  invernadero: 'Invernadero: climatización y riego, con consumo sostenido.',
  riego: 'Bombeo de riego: consumo muy concentrado y caro en campaña.',
  silo: 'Almacén agrícola: menos consumo, pero suele haber tejado grande y contacto fácil.',
  comercio: 'Comercio o taller: consumo menor, pero es visita rápida.',
  edificio_grande: 'Edificio grande sin clasificar en el mapa: puede ser una nave. Habría que verlo al pasar.',
};

/**
 * Metros cuadrados de tejado que hacen falta por cada kWp instalado.
 * Con paneles actuales (~450 W en ~2 m²) salen ~4,2 m²/kWp en el papel; se
 * usa 5,5 para dejar sitio a pasillos, sombras y orientación.
 */
const M2_POR_KWP = 5.5;
/** Fracción del tejado realmente aprovechable (lucernarios, extractores, canalones). */
const FRACCION_UTIL = 0.6;
/**
 * Qué parte de una parcela está construida. En una granja de la zona, entre las
 * naves, el estercolero, los silos y los viales, el tejado viene a ser un cuarto
 * del recinto. Es una regla gruesa, y por eso el número se marca como estimado.
 */
const OCUPACION_PARCELA = 0.25;

/** Metros de TEJADO a partir del polígono, sea parcela o edificio. */
export function tejadoDesdeArea(area_m2: number, es_parcela: boolean): number {
  if (area_m2 <= 0) return 0;
  return es_parcela ? area_m2 * OCUPACION_PARCELA : area_m2;
}

export function kwpDesdeArea(area_m2: number, es_parcela = false): number {
  const tejado = tejadoDesdeArea(area_m2, es_parcela);
  if (tejado <= 0) return 0;
  return Math.round((tejado * FRACCION_UTIL) / M2_POR_KWP);
}

/** Distancia haversine en km. */
export function distKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * Distancia en km de un punto al TRAMO que va de `a` a `b`.
 *
 * Se proyecta a metros alrededor del punto y se resuelve en plano: a estas
 * distancias la curvatura de la Tierra no cambia nada.
 */
export function kmAlTramo(
  p: { lat: number; lon: number },
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const mLat = 111132;
  const mLon = 111320 * Math.cos((p.lat * Math.PI) / 180);
  const px = 0, py = 0;
  const ax = (a.lon - p.lon) * mLon, ay = (a.lat - p.lat) * mLat;
  const bx = (b.lon - p.lon) * mLon, by = (b.lat - p.lat) * mLat;

  const dx = bx - ax, dy = by - ay;
  const largo2 = dx * dx + dy * dy;
  // Tramo de longitud cero: es un punto
  if (largo2 === 0) return Math.hypot(ax - px, ay - py) / 1000;

  // Dónde cae la proyección dentro del tramo, recortada a sus extremos
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / largo2));
  return Math.hypot(ax + t * dx - px, ay + t * dy - py) / 1000;
}

/**
 * Distancia al punto más cercano del RECORRIDO, contando los tramos enteros y
 * no solo las paradas.
 *
 * Es importante que sea así: entre Binéfar y Tamarite hay 11 km, y una granja
 * a pie de carretera a mitad de camino está a 5,5 km de las dos paradas pero a
 * 100 m de la ruta. Midiendo solo a las paradas se quedaba fuera justo lo que
 * más interesa, que es lo que se ve por la ventanilla.
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

/**
 * Área de un polígono en m² por la fórmula del área de Gauss, proyectando
 * grados a metros. A estas latitudes y con parcelas de este tamaño el error
 * es despreciable frente a la incertidumbre del propio dato.
 */
export function areaPoligono(puntos: { lat: number; lon: number }[]): number {
  if (puntos.length < 3) return 0;
  const latMedia = (puntos.reduce((s, p) => s + p.lat, 0) / puntos.length) * (Math.PI / 180);
  const mPorGradoLat = 111132;
  const mPorGradoLon = 111320 * Math.cos(latMedia);
  let suma = 0;
  for (let i = 0; i < puntos.length; i++) {
    const a = puntos[i];
    const b = puntos[(i + 1) % puntos.length];
    suma += a.lon * mPorGradoLon * (b.lat * mPorGradoLat) - b.lon * mPorGradoLon * (a.lat * mPorGradoLat);
  }
  return Math.abs(suma) / 2;
}

/** ¿Está el punto dentro del polígono? (ray casting). Para descartar cascos urbanos. */
export function dentroDe(p: { lat: number; lon: number }, poligono: { lat: number; lon: number }[]): boolean {
  if (poligono.length < 3) return false;
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i];
    const b = poligono[j];
    const cruza = a.lat > p.lat !== b.lat > p.lat;
    if (cruza && p.lon < ((b.lon - a.lon) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lon) dentro = !dentro;
  }
  return dentro;
}

/**
 * Puntúa un candidato. 0-100.
 *
 * Reparto: tipo de actividad (hasta 40), tamaño del tejado (hasta 30),
 * lo poco que hay que desviarse (hasta 20), y algún extra (hasta 10).
 * Si ya tiene placas baja mucho, pero no desaparece: sigue habiendo batería
 * y ampliación, y la comercializadora se le puede cambiar igual.
 */
export function puntuar(
  p: Omit<Prospecto, 'puntuacion' | 'motivos' | 'kwp_estimado' | 'kwp_fiable'>,
  radioKm: number
): { puntuacion: number; motivos: string[]; kwp_estimado: number; kwp_fiable: boolean } {
  const motivos: string[] = [];
  let n = PUNTOS_TIPO[p.tipo];
  motivos.push(MOTIVO_TIPO[p.tipo]);

  // Tamaño: se puntúa por el tejado, no por el recinto. 1.200 m² es el máximo.
  const tejado = tejadoDesdeArea(p.area_m2, p.es_parcela);
  n += Math.min(30, Math.round(tejado / 40));
  const kwp = kwpDesdeArea(p.area_m2, p.es_parcela);
  if (tejado >= 300) {
    motivos.push(
      p.es_parcela
        ? `Recinto de ~${Math.round(p.area_m2).toLocaleString('es-ES')} m². Los tejados no están dibujados en el mapa, así que la superficie aprovechable hay que verla allí.`
        : `Unos ${Math.round(tejado).toLocaleString('es-ES')} m² de tejado medidos en el mapa: darían para ~${kwp} kWp (orientativo).`
    );
  } else if (tejado > 0) {
    motivos.push(`Tejado pequeño (~${Math.round(tejado)} m²): poco recorrido para placas.`);
  }

  // Desvío: cuanto menos haya que salirse de la ruta, mejor
  const cerca = Math.max(0, 1 - p.km_desvio / Math.max(radioKm, 0.1));
  n += Math.round(20 * cerca);
  if (p.km_desvio < 0.5) motivos.push('Prácticamente de paso: no supone desvío.');
  else motivos.push(`A ${p.km_desvio.toFixed(1)} km de la ruta.`);

  if (p.nombre) { n += 5; motivos.push(`Sale con nombre en el mapa («${p.nombre}»): más fácil de identificar y buscar.`); }

  if (p.ya_tiene_placas) {
    n -= 40;
    motivos.push('⚠️ En el mapa ya figura con placas. Aun así se le puede ofrecer batería, ampliación o cambio de comercializadora.');
  }

  return {
    puntuacion: Math.max(0, Math.min(100, n)),
    motivos,
    kwp_estimado: kwp,
    kwp_fiable: !p.es_parcela,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  DE OPENSTREETMAP A CANDIDATOS
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
 * Dónde está el elemento.
 *
 * Overpass no siempre devuelve lo mismo: al pedir `geom` manda `bounds` y
 * `geometry` pero NO `center`, mientras que sin `geom` manda `center`. Hay que
 * aceptar las tres formas o se cae todo sin decir por qué.
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

/** Superficie mínima para que un edificio sin clasificar merezca aparecer. */
export const AREA_MIN_EDIFICIO_GRANDE = 500;
/** Dos polígonos a menos de esto son el mismo sitio (la parcela y su nave). */
export const KM_MISMO_SITIO = 0.06;
/** Dos polígonos con el MISMO nombre a menos de esto son el mismo negocio. */
export const KM_MISMO_NEGOCIO = 1.5;
/**
 * Un recinto industrial por encima de esto no es una empresa: es el polígono
 * entero, con docenas de naves dentro. Ofrecerlo como un candidato daría un
 * número de kWp enorme y falso, y además no se sabría ni a quién visitar.
 * Las naves de dentro salen igualmente por su cuenta, que es lo que interesa.
 */
export const AREA_MAX_RECINTO_INDUSTRIAL = 30000;

/** Clasifica según las etiquetas de OSM. null = no interesa. */
export function clasificar(t: Record<string, string>): TipoProspecto | null {
  const b = t.building || '';
  const lu = t.landuse || '';

  if (lu === 'farmyard' || t.animal_keeping || /^(farm_auxiliary|barn|stable|cowshed|sty|chicken_coop)$/.test(b)) return 'granja';
  if (lu === 'greenhouse_horticulture' || b === 'greenhouse') return 'invernadero';
  if (t.man_made === 'silo' || t.man_made === 'storage_tank' || b === 'silo') return 'silo';
  if (t.man_made === 'pumping_station' || t.man_made === 'water_well' || lu === 'basin') return 'riego';
  if (lu === 'industrial' || b === 'industrial' || b === 'factory') return 'industrial';
  if (b === 'warehouse' || t.industrial) return 'nave';
  if (t.shop || t.craft || t.office || b === 'commercial' || b === 'retail') return 'comercio';
  // Edificio sin clasificar: solo si además es grande y está fuera del casco urbano
  if (b === 'yes' || b === 'roof') return 'edificio_grande';
  return null;
}

/**
 * Convierte la respuesta cruda de Overpass en candidatos puntuados.
 *
 * Aquí se cae casi todo lo que llega: cascos urbanos, edificios pequeños,
 * comercios anónimos, lo que queda fuera del radio y los duplicados. De unos
 * 800 elementos suelen salir 30-60 candidatos.
 */
export function procesarElementos(
  elementos: ElementoOSM[],
  ruta: { lat: number; lon: number }[],
  radioKm: number
): Prospecto[] {
  // Para no proponer cada casa de cada pueblo como "edificio grande"
  const zonasResidenciales = elementos
    .filter((e) => e.tags?.landuse === 'residential' && e.geometry && e.geometry.length >= 3)
    .map((e) => e.geometry!);

  const candidatos: Prospecto[] = [];

  for (const e of elementos) {
    const tags = e.tags || {};
    if (tags.landuse === 'residential') continue;

    const tipo = clasificar(tags);
    if (!tipo) continue;

    const centro = centroDe(e);
    if (!centro) continue;

    const area = e.geometry && e.geometry.length >= 3 ? areaPoligono(e.geometry) : 0;

    if (tipo === 'edificio_grande') {
      if (area < AREA_MIN_EDIFICIO_GRANDE) continue;
      // Dentro del pueblo, un edificio grande casi siempre es un bloque de pisos
      if (zonasResidenciales.some((z) => dentroDe(centro, z))) continue;
    }
    // El recinto del polígono industrial no es un cliente: sus naves ya salen sueltas
    if (tipo === 'industrial' && tags.landuse === 'industrial' && area > AREA_MAX_RECINTO_INDUSTRIAL) continue;
    // Un comercio sin nombre no aporta nada: no se sabe ni a quién se visita
    if (tipo === 'comercio' && !tags.name) continue;

    const kmDesvio = kmALaRuta(centro, ruta);
    if (kmDesvio > radioKm) continue;

    const base = {
      id: `${e.type}/${e.id}`,
      tipo,
      nombre: tags.name || tags.operator || tags['addr:housename'] || null,
      lat: centro.lat,
      lon: centro.lon,
      area_m2: Math.round(area),
      // `landuse` delimita el recinto entero; `building`, solo el tejado
      es_parcela: !!tags.landuse,
      km_desvio: Math.round(kmDesvio * 100) / 100,
      ya_tiene_placas:
        tags['generator:source'] === 'solar' ||
        tags.power === 'generator' ||
        tags['roof:material'] === 'solar_panels',
      municipio: tags['addr:city'] || tags['addr:place'] || null,
    };

    candidatos.push({ ...base, ...puntuar(base, radioKm) });
  }

  // La parcela de la granja y sus naves salen por separado, y una granja con
  // cuatro naves sale cuatro veces. Nos quedamos con el mejor de cada grupo,
  // que es el que lleva más información: es UNA visita, no cuatro.
  const unicos: Prospecto[] = [];
  for (const p of candidatos.sort((a, b) => b.puntuacion - a.puntuacion)) {
    const repetido = unicos.some(
      (u) =>
        distKm(u, p) < KM_MISMO_SITIO ||
        (!!p.nombre && u.nombre === p.nombre && distKm(u, p) < KM_MISMO_NEGOCIO)
    );
    if (!repetido) unicos.push(p);
  }
  return unicos;
}

/** Etiqueta corta del interés, para no obligar a interpretar un número. */
export function nivelInteres(puntuacion: number): { texto: string; tono: 'alto' | 'medio' | 'bajo' } {
  if (puntuacion >= 65) return { texto: 'Merece la pena', tono: 'alto' };
  if (puntuacion >= 40) return { texto: 'Si cuadra', tono: 'medio' };
  return { texto: 'Solo si sobra tiempo', tono: 'bajo' };
}
