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
  /**
   * El pueblo cabecera, tal y como se escribe en las listas.
   *
   * Sirve para que un cliente del que solo tenemos coordenadas caiga en la MISMA
   * caja que los que sí traen dirección. Si aquí saliera el nombre largo de la
   * zona, «Tamarite de Litera» y «La Litera (Tamarite)» serían dos grupos del
   * mismo viaje, y quien monta la ruta abriría uno y se dejaría el otro.
   */
  cabecera: string;
  pueblos: string[];  // nombres normalizados (minúsculas, sin acentos)
}

export const ZONAS: Zona[] = [
  {
    id: 'binefar', cabecera: 'Binéfar', nombre: 'Binéfar (núcleo)', color: '#e11d48',
    centro: { lat: 41.85, lon: 0.294 },
    pueblos: ['binefar'],
  },
  {
    id: 'san-esteban-estadilla', cabecera: 'San Esteban de Litera', nombre: 'Litera Alta – Somontano', color: '#8b5cf6',
    centro: { lat: 42.0, lon: 0.27 },
    pueblos: [
      'san esteban de litera', 'azanuy', 'alins del monte', 'calasanz', 'peralta de calasanz',
      'peralta de la sal', 'gabasa', 'estadilla', 'estada', 'fonz', 'almunia de san juan', 'cofita',
      'barbastro', 'el grado', 'graus', 'berbegal', 'ilche', 'monesma', 'benabarre',
    ],
  },
  {
    id: 'tamarite-alcampell', cabecera: 'Tamarite de Litera', nombre: 'La Litera (Tamarite)', color: '#0ea5e9',
    pueblos: [
      'tamarite', 'alcampell', 'altorricon', 'albelda', 'baells', 'nacha', 'castillonroy',
      'baldellou', 'camporrells', 'estopiñan', 'estopinan',
    ],
    centro: { lat: 41.87, lon: 0.43 },
  },
  {
    id: 'alfarras-almacelles', cabecera: 'Almacelles', nombre: 'Segrià Nord (Almacelles)', color: '#f59e0b',
    pueblos: [
      'alfarras', 'almenar', 'alguaire', 'rossello', 'rosello', 'torrefarrera', 'vilanova de segria',
      'benavent de segria', 'almacelles', 'ivars de noguera', 'albesa', 'algerri', 'la portella', 'corbins',
      'gimenells', 'sucs', 'raimat', 'vilanova de la barca', 'terminens', 'balaguer',
    ],
    centro: { lat: 41.73, lon: 0.55 },
  },
  {
    id: 'alcarras-fraga', cabecera: 'Fraga', nombre: 'Bajo Cinca – Baix Segre (Fraga)', color: '#22c55e',
    pueblos: [
      'alcarras', 'fraga', 'soses', 'torres de segre', 'aitona', 'seros', 'massalcoreig',
      'torrente de cinca', 'torrent de cinca', 'velilla de cinca', 'miralsot', 'sudanell', 'montoliu',
      'lleida', 'lerida', 'albatarrec', 'alcoletge', 'candasnos', 'peñalba', 'penalba', 'mequinenza',
    ],
    centro: { lat: 41.55, lon: 0.35 },
  },
  {
    id: 'esplus-osso', cabecera: 'Esplús', nombre: 'Ribera del Cinca (Esplús)', color: '#14b8a6',
    pueblos: [
      'vencillon', 'esplus', 'osso de cinca', 'almudafar', 'albalate de cinca', 'belver de cinca',
      'zaidin', 'ontiñena', 'ontinena', 'chalamera', 'ballobar', 'alcolea de cinca',
      'sarinena', 'albalatillo', 'castelflorite', 'villanueva de sijena', 'sena', 'san miguel de cinca', 'estiche',
    ],
    centro: { lat: 41.75, lon: 0.17 },
  },
  {
    // Fuera del radio habitual, pero hay cartera allí y necesita su etiqueta.
    id: 'barcelona', cabecera: 'Barcelona', nombre: 'Barcelona', color: '#ec4899',
    centro: { lat: 41.39, lon: 2.16 },
    pueblos: [
      'barcelona', 'hospitalet', 'badalona', 'sabadell', 'terrassa', 'mataro',
      'santa coloma', 'cornella', 'sant boi', 'sant cugat', 'granollers', 'mollet',
      'rubi', 'vic', 'manresa', 'igualada', 'vilafranca del penedes', 'vilanova i la geltru',
      'el prat', 'castelldefels', 'gava', 'viladecans', 'sitges', 'martorell',
      'cerdanyola', 'ripollet', 'montcada', 'esplugues', 'sant adria', 'premia',
      'berga', 'calella', 'arenys', 'la garriga', 'cardedeu',
    ],
  },
  {
    id: 'binaced-monzon', cabecera: 'Monzón', nombre: 'Cinca Medio (Monzón)', color: '#f97316',
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

/** Zona guardada a mano en la ficha del cliente (o null si no es válida). */
export function zonaPorId(id?: string | null): Zona | null {
  return (id && ZONAS.find((z) => z.id === id)) || null;
}

/** Zona de una parada, por orden de prioridad:
 *  1. la elegida a mano en la ficha del cliente (manda siempre),
 *  2. el pueblo reconocido en la dirección,
 *  3. la zona más cercana por coordenadas (cuando el mapa las ha calculado). */
export function zonaDeParada(
  direccion?: string | null,
  geo?: { lat: number; lon: number } | null,
  zonaManual?: string | null
): Zona | null {
  return zonaPorId(zonaManual) || zonaDeDireccion(direccion) || (geo ? zonaMasCercana(geo.lat, geo.lon) : null);
}
