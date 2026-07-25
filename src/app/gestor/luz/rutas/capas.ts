/**
 * CAPAS DEL MAPA.
 *
 * En rutas de visitas hacen falta dos vistas muy distintas, y ninguna sirve
 * para lo de la otra:
 *
 *  · CALLES para orientarse y planificar: carreteras, pueblos y nombres.
 *  · SATÉLITE para reconocer el sitio antes de llegar. En el campo, un cliente
 *    no es una calle con número: es "la nave larga que hay pasada la balsa".
 *    Ahí un mapa de carreteras no dice nada y una ortofoto lo dice todo.
 *
 * El satélite es el PNOA del Instituto Geográfico Nacional: ortofoto oficial
 * de España, gratuita, sin clave y con más detalle que los mapas comerciales
 * en zona rural. El híbrido le pone encima los nombres y las carreteras, que
 * es la vista que mejor funciona para preparar una ruta de verdad.
 */

export type ClaveCapa = 'calles' | 'satelite' | 'hibrido' | 'relieve';

export interface DefCapa {
  clave: ClaveCapa;
  nombre: string;
  emoji: string;
  /** Para qué sirve, en una frase. Se enseña al pasar por encima. */
  pista: string;
  /** true si el fondo es oscuro: los rótulos y trazos tienen que cambiar. */
  fondoOscuro: boolean;
}

export const CAPAS: DefCapa[] = [
  { clave: 'calles', nombre: 'Calles', emoji: '🗺️', fondoOscuro: false,
    pista: 'Carreteras y pueblos. Para planificar el recorrido.' },
  { clave: 'hibrido', nombre: 'Híbrido', emoji: '🛰️', fondoOscuro: true,
    pista: 'Foto aérea con los nombres encima. La mejor para preparar la ruta.' },
  { clave: 'satelite', nombre: 'Satélite', emoji: '📷', fondoOscuro: true,
    pista: 'Ortofoto limpia del IGN. Para reconocer naves, balsas y placas.' },
  { clave: 'relieve', nombre: 'Relieve', emoji: '⛰️', fondoOscuro: false,
    pista: 'Mapa base del IGN con el terreno. Útil en la zona de montaña.' },
];

/** Teselas de calles (CARTO Voyager): legibles y de estilo sobrio. */
export const TESELAS_CALLES = {
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  opciones: { attribution: '© OpenStreetMap · CARTO', subdomains: 'abcd', maxZoom: 20 },
};

/** Solo rótulos y carreteras, con el resto transparente: va encima del satélite. */
export const TESELAS_ROTULOS = {
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
  opciones: { attribution: '© OpenStreetMap · CARTO', subdomains: 'abcd', maxZoom: 20 },
};

/** Ortofoto oficial del IGN, servida por WMS. */
export const WMS_PNOA = {
  url: 'https://www.ign.es/wms-inspire/pnoa-ma',
  opciones: {
    layers: 'OI.OrthoimageCoverage',
    format: 'image/jpeg',
    transparent: false,
    attribution: 'PNOA © Instituto Geográfico Nacional',
    maxZoom: 20,
  },
};

/** Mapa base del IGN con relieve. */
export const WMS_IGN_BASE = {
  url: 'https://www.ign.es/wms-inspire/ign-base',
  opciones: {
    layers: 'IGNBaseTodo',
    format: 'image/png',
    transparent: false,
    attribution: '© Instituto Geográfico Nacional',
    maxZoom: 20,
  },
};

export const CAPA_POR_DEFECTO: ClaveCapa = 'hibrido';
/** Se recuerda la elegida: cada uno trabaja mejor con una. */
export const CLAVE_CAPA_GUARDADA = 'gesmeco:luz:capa-mapa';

export function capaGuardada(): ClaveCapa {
  if (typeof window === 'undefined') return CAPA_POR_DEFECTO;
  const v = localStorage.getItem(CLAVE_CAPA_GUARDADA) as ClaveCapa | null;
  return CAPAS.some((c) => c.clave === v) ? v! : CAPA_POR_DEFECTO;
}

export const esOscura = (clave: ClaveCapa) => !!CAPAS.find((c) => c.clave === clave)?.fondoOscuro;
