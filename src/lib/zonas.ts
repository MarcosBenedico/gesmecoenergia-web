/**
 * Zonas de actuación comercial alrededor de Binéfar.
 *
 * Son ORIENTATIVAS: sirven para ver de un vistazo si compensa juntar dos
 * visitas en la misma salida, no son límites administrativos exactos.
 * Los nombres siguen las comarcas de la zona (La Litera, Cinca Medio,
 * Bajo Cinca, Segrià...), que es como se habla del territorio.
 *
 * La zona de un cliente se detecta automáticamente por el pueblo que
 * aparezca en su dirección (sin acentos, da igual mayúsculas).
 * Si un pueblo falta o encaja mejor en otra zona, se cambia de lista y listo.
 */

export interface Zona {
  id: string;
  nombre: string;
  color: string;      // color de la zona (chips y mapa)
  centro: { lat: number; lon: number }; // centro aproximado, para asignar por cercanía
  pueblos: string[];  // nombres normalizados (minúsculas, sin acentos)
}

export const ZONAS: Zona[] = [
  {
    id: 'binefar', nombre: 'Binéfar (núcleo)', color: '#e11d48',
    centro: { lat: 41.85, lon: 0.294 },
    pueblos: ['binefar'],
  },
  {
    id: 'san-esteban-estadilla', nombre: 'Litera Alta – Somontano', color: '#8b5cf6',
    centro: { lat: 42.0, lon: 0.27 },
    pueblos: [
      'san esteban de litera', 'azanuy', 'alins del monte', 'calasanz', 'peralta de calasanz',
      'peralta de la sal', 'gabasa', 'estadilla', 'estada', 'fonz', 'almunia de san juan', 'cofita',
      'barbastro', 'el grado', 'graus', 'berbegal', 'ilche', 'monesma', 'benabarre',
    ],
  },
  {
    id: 'tamarite-alcampell', nombre: 'La Litera (Tamarite)', color: '#0ea5e9',
    pueblos: [
      'tamarite', 'alcampell', 'altorricon', 'albelda', 'baells', 'nacha', 'castillonroy',
      'baldellou', 'camporrells', 'estopiñan', 'estopinan',
    ],
    centro: { lat: 41.87, lon: 0.43 },
  },
  {
    id: 'alfarras-almacelles', nombre: 'Segrià Nord (Almacelles)', color: '#f59e0b',
    pueblos: [
      'alfarras', 'almenar', 'alguaire', 'rossello', 'rosello', 'torrefarrera', 'vilanova de segria',
      'benavent de segria', 'almacelles', 'ivars de noguera', 'albesa', 'algerri', 'la portella', 'corbins',
      'gimenells', 'sucs', 'raimat', 'vilanova de la barca', 'terminens', 'balaguer',
    ],
    centro: { lat: 41.73, lon: 0.55 },
  },
  {
    id: 'alcarras-fraga', nombre: 'Bajo Cinca – Baix Segre (Fraga)', color: '#22c55e',
    pueblos: [
      'alcarras', 'fraga', 'soses', 'torres de segre', 'aitona', 'seros', 'massalcoreig',
      'torrente de cinca', 'torrent de cinca', 'velilla de cinca', 'miralsot', 'sudanell', 'montoliu',
      'lleida', 'lerida', 'albatarrec', 'alcoletge', 'candasnos', 'peñalba', 'penalba', 'mequinenza',
    ],
    centro: { lat: 41.55, lon: 0.35 },
  },
  {
    id: 'esplus-osso', nombre: 'Ribera del Cinca (Esplús)', color: '#14b8a6',
    pueblos: [
      'vencillon', 'esplus', 'osso de cinca', 'almudafar', 'albalate de cinca', 'belver de cinca',
      'zaidin', 'ontiñena', 'ontinena', 'chalamera', 'ballobar', 'alcolea de cinca',
      'sarinena', 'albalatillo', 'castelflorite', 'villanueva de sijena', 'sena', 'san miguel de cinca', 'estiche',
    ],
    centro: { lat: 41.75, lon: 0.17 },
  },
  {
    id: 'binaced-monzon', nombre: 'Cinca Medio (Monzón)', color: '#f97316',
    pueblos: [
      'binaced', 'valcarca', 'pueyo de santa cruz', 'monzon', 'selgua', 'conchel',
      'castejon del puente', 'ariestolas', 'alfantega', 'pomar de cinca', 'santalecina',
    ],
    centro: { lat: 41.91, lon: 0.19 },
  },
];

/** Quita acentos y pasa a minúsculas para comparar. */
export function normalizarTexto(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Zona de una dirección (o null si no se reconoce el pueblo). */
export function zonaDeDireccion(direccion?: string | null): Zona | null {
  if (!direccion?.trim()) return null;
  const d = ` ${normalizarTexto(direccion)} `;
  for (const z of ZONAS) {
    for (const p of z.pueblos) {
      if (d.includes(p)) return z;
    }
  }
  return null;
}

/** Zona más cercana por coordenadas: garantiza que nadie se queda sin zona. */
export function zonaMasCercana(lat: number, lon: number): Zona {
  let mejor = ZONAS[0];
  let mejorDist = Infinity;
  for (const z of ZONAS) {
    // Distancia aproximada (grados corregidos por latitud): sobra para elegir zona
    const dLat = lat - z.centro.lat;
    const dLon = (lon - z.centro.lon) * Math.cos((lat * Math.PI) / 180);
    const d = dLat * dLat + dLon * dLon;
    if (d < mejorDist) { mejorDist = d; mejor = z; }
  }
  return mejor;
}

/** Zona de una parada: primero por el pueblo de la dirección; si no se
 *  reconoce y hay coordenadas, la zona más cercana. Con coordenadas nunca es null. */
export function zonaDeParada(direccion?: string | null, geo?: { lat: number; lon: number } | null): Zona | null {
  return zonaDeDireccion(direccion) || (geo ? zonaMasCercana(geo.lat, geo.lon) : null);
}
