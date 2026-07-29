/**
 * NOVEDADES DEL GRUPO.
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  MARCOS: ESTE ES EL ARCHIVO QUE HAY QUE TOCAR.                        │
 * │                                                                       │
 * │  Aquí NO he inventado ni una campaña. Lo que hay son cosas que puedo  │
 * │  verificar en el propio proyecto —la calculadora de facturas está     │
 * │  publicada, la microsede de Correbin está publicada— más las          │
 * │  entradas que tú añadas.                                              │
 * │                                                                       │
 * │  Poner novedades falsas en la portada es la forma más rápida de que   │
 * │  un cliente que se acerque a preguntar por una campaña que no existe  │
 * │  deje de fiarse del resto de la web. Así que las de verdad las pones  │
 * │  tú: añade un objeto arriba de su lista y ya sale.                    │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Cada novedad va a un panel. Hay cuatro: uno por empresa del grupo y otro
 * de la comarca —lo que hacemos en La Litera y alrededores—, que es el que
 * demuestra que esto no es una web de una empresa de fuera.
 */

export type AreaNovedad = 'energia' | 'asesoria' | 'seguros' | 'comarca';

export interface Novedad {
  /** Fecha ISO (YYYY-MM-DD). Ordena sola: la más reciente arriba. */
  fecha: string;
  titulo: string;
  /** Una o dos frases. Si no cabe en dos, es un artículo, no una novedad. */
  texto: string;
  /** Etiqueta corta: «Campaña», «Novedad», «Aviso», «Servicio nuevo»… */
  tipo: string;
  /** A dónde lleva, si lleva a algún sitio. */
  href?: string;
  /** Marca la que quieras destacar dentro de su panel. */
  destacada?: boolean;
}

export interface PanelNovedades {
  area: AreaNovedad;
  titulo: string;
  /** De qué va este panel, en una línea. */
  pie: string;
  /** Color de acento del panel. Cada empresa lleva el suyo. */
  color: string;
  href: string;
  novedades: Novedad[];
}

/**
 * Los colores son los de cada marca.
 * El azul y el rojo de Correbin salen de su propio logotipo (#364193 y
 * #bd1522), no de la paleta de la web, que usa otro azul.
 */
export const PANELES: PanelNovedades[] = [
  {
    area: 'energia',
    titulo: 'Gesmeco Energía',
    pie: 'Luz, gas y solar fotovoltaica',
    color: '#ff3333',
    href: '/energia',
    novedades: [
      {
        fecha: '2026-07-01',
        tipo: 'Herramienta',
        titulo: 'Analizador de facturas en la web',
        texto:
          'Se sube la factura de la luz y sale el desglose y una estimación de ahorro, sin registrarse y sin compromiso.',
        href: '/analizador',
        destacada: true,
      },
      {
        fecha: '2026-06-01',
        tipo: 'Servicio',
        titulo: 'Solar fotovoltaica llave en mano',
        texto:
          'Instalaciones dimensionadas al consumo real de la explotación: granjas, riegos y naves de la comarca.',
        href: '/servicios',
      },
    ],
  },
  {
    area: 'asesoria',
    titulo: 'Asesoría Gesmeco',
    pie: 'Fiscal, laboral y contable',
    color: '#c1272d',
    href: '/grupo',
    novedades: [
      {
        fecha: '2026-07-01',
        tipo: 'Servicio',
        titulo: 'Fiscal, laboral y contable en el mismo sitio',
        texto:
          'Impuestos, nóminas y Seguridad Social para autónomos y empresas, con trato directo y sin llamar a un 902.',
        href: '/grupo',
      },
    ],
  },
  {
    area: 'seguros',
    titulo: 'Correbin Asociados',
    pie: 'Correduría de seguros',
    color: '#364193',
    href: '/seguros',
    novedades: [
      {
        fecha: '2026-07-28',
        tipo: 'Novedad',
        titulo: 'Correbin estrena su propia web',
        texto:
          'Empresas, gerencia de riesgos, sectores y siniestros, con su identidad y su canal de contacto propio.',
        href: '/seguros',
        destacada: true,
      },
      {
        fecha: '2026-07-10',
        tipo: 'Servicio',
        titulo: 'Revisión de pólizas sin coste',
        texto:
          'Se miran las pólizas que ya tienes y se dice qué cubren, qué no y qué falta. Con los papeles delante.',
        href: '/seguros/revision-de-polizas',
      },
    ],
  },
  {
    area: 'comarca',
    titulo: 'En La Litera',
    pie: 'Lo que hacemos por la comarca',
    color: '#e5a000',
    href: '/sobre-nosotros',
    novedades: [
      {
        fecha: '2026-07-01',
        tipo: 'Comarca',
        titulo: 'Solar para el sector agroganadero',
        texto:
          'Granjas, riegos y naves de Binéfar, Tamarite, Alcampell y alrededores: el consumo de aquí no se parece al de una oficina.',
        href: '/sectores',
      },
      {
        fecha: '2026-06-15',
        tipo: 'Cercanía',
        titulo: 'Oficina en Binéfar, no un centro de llamadas',
        texto:
          'Se entra por la puerta y se habla con quien lleva tu expediente. Tres empresas, un solo teléfono.',
        href: '/contacto',
      },
    ],
  },
];

/** Las novedades de un panel, de la más reciente a la más antigua. */
export function ordenadas(p: PanelNovedades): Novedad[] {
  return [...p.novedades].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** «12 de julio de 2026» — para leer, no para archivar. */
export function fechaLarga(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Cuántas novedades hay en total, para el titular del bloque. */
export const TOTAL_NOVEDADES = PANELES.reduce((n, p) => n + p.novedades.length, 0);
