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
  pueblos: string[];  // nombres normalizados (minúsculas, sin acentos)
}

export const ZONAS: Zona[] = [
  {
    id: 'binefar', nombre: 'Binéfar (núcleo)', color: '#e11d48',
    pueblos: ['binefar'],
  },
  {
    id: 'san-esteban-estadilla', nombre: 'Litera Alta – Somontano', color: '#8b5cf6',
    pueblos: [
      'san esteban de litera', 'azanuy', 'alins del monte', 'calasanz', 'peralta de calasanz',
      'peralta de la sal', 'gabasa', 'estadilla', 'estada', 'fonz', 'almunia de san juan', 'cofita',
    ],
  },
  {
    id: 'tamarite-alcampell', nombre: 'La Litera (Tamarite)', color: '#0ea5e9',
    pueblos: [
      'tamarite', 'alcampell', 'altorricon', 'albelda', 'baells', 'nacha', 'castillonroy',
      'baldellou', 'camporrells', 'estopiñan', 'estopinan',
    ],
  },
  {
    id: 'alfarras-almacelles', nombre: 'Segrià Nord (Almacelles)', color: '#f59e0b',
    pueblos: [
      'alfarras', 'almenar', 'alguaire', 'rossello', 'rosello', 'torrefarrera', 'vilanova de segria',
      'benavent de segria', 'almacelles', 'ivars de noguera', 'albesa', 'algerri', 'la portella', 'corbins',
    ],
  },
  {
    id: 'alcarras-fraga', nombre: 'Bajo Cinca – Baix Segre (Fraga)', color: '#22c55e',
    pueblos: [
      'alcarras', 'fraga', 'soses', 'torres de segre', 'aitona', 'seros', 'massalcoreig',
      'torrente de cinca', 'torrent de cinca', 'velilla de cinca', 'miralsot', 'sudanell', 'montoliu',
    ],
  },
  {
    id: 'esplus-osso', nombre: 'Ribera del Cinca (Esplús)', color: '#14b8a6',
    pueblos: [
      'vencillon', 'esplus', 'osso de cinca', 'almudafar', 'albalate de cinca', 'belver de cinca',
      'zaidin', 'ontiñena', 'ontinena', 'chalamera', 'ballobar', 'alcolea de cinca',
    ],
  },
  {
    id: 'binaced-monzon', nombre: 'Cinca Medio (Monzón)', color: '#f97316',
    pueblos: [
      'binaced', 'valcarca', 'pueyo de santa cruz', 'monzon', 'selgua', 'conchel',
      'castejon del puente', 'ariestolas', 'alfantega', 'pomar de cinca', 'santalecina',
    ],
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
