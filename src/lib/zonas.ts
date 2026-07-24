/**
 * Zonas de actuación comercial alrededor de Binéfar.
 * La zona de un cliente se detecta automáticamente por el pueblo que
 * aparezca en su dirección (sin acentos, da igual mayúsculas).
 * Si un pueblo falta, se añade a su lista y listo.
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
    id: 'san-esteban-estadilla', nombre: 'San Esteban – Estadilla', color: '#8b5cf6',
    pueblos: [
      'san esteban de litera', 'azanuy', 'alins del monte', 'calasanz', 'peralta de calasanz',
      'peralta de la sal', 'gabasa', 'estadilla', 'estada', 'fonz', 'almunia de san juan', 'cofita',
    ],
  },
  {
    id: 'tamarite-alcampell', nombre: 'Tamarite – Alcampell', color: '#0ea5e9',
    pueblos: [
      'tamarite', 'alcampell', 'altorricon', 'albelda', 'baells', 'nacha', 'castillonroy',
      'baldellou', 'camporrells', 'estopiñan', 'estopinan',
    ],
  },
  {
    id: 'alfarras-almacelles', nombre: 'Alfarrás – Almenar – Almacelles', color: '#f59e0b',
    pueblos: [
      'alfarras', 'almenar', 'alguaire', 'rossello', 'rosello', 'torrefarrera', 'vilanova de segria',
      'benavent de segria', 'almacelles', 'ivars de noguera', 'albesa', 'algerri', 'la portella', 'corbins',
    ],
  },
  {
    id: 'alcarras-fraga', nombre: 'Alcarràs – Fraga', color: '#22c55e',
    pueblos: [
      'alcarras', 'fraga', 'soses', 'torres de segre', 'aitona', 'seros', 'massalcoreig',
      'torrente de cinca', 'torrent de cinca', 'velilla de cinca', 'miralsot', 'sudanell', 'montoliu',
    ],
  },
  {
    id: 'esplus-osso', nombre: 'Vencillón – Esplús – Osso de Cinca', color: '#14b8a6',
    pueblos: [
      'vencillon', 'esplus', 'osso de cinca', 'almudafar', 'albalate de cinca', 'belver de cinca',
      'zaidin', 'ontiñena', 'ontinena', 'chalamera', 'ballobar', 'alcolea de cinca',
    ],
  },
  {
    id: 'binaced-monzon', nombre: 'Binaced – Monzón', color: '#f97316',
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
