/**
 * VISTAS GUARDADAS Y COLUMNAS DEL LISTADO DE CLIENTES.
 *
 * El análisis operativo pide dos cosas para el listado, y las pide juntas
 * porque por separado no sirven de nada:
 *
 *   · Filtros por tipo de relación, etapa, responsable, zona y estado de
 *     seguimiento.
 *   · Columnas configurables y vistas guardadas, personales y de equipo.
 *
 * POR QUÉ VAN JUNTAS: un listado con catorce columnas y once filtros es una
 * herramienta potentísima que nadie usa dos veces, porque montarla cuesta
 * treinta segundos cada mañana y el que tiene prisa se queda con la de por
 * defecto. La vista guardada es lo que convierte esa configuración en un
 * botón. Sin vistas, las columnas configurables solo añaden trabajo.
 *
 * EL ESTADO DE SEGUIMIENTO NO SE CALCULA AQUÍ.
 *
 * Sale de `seguimiento.ts` (`estaEnRojo` sobre los plazos de cada etapa) y la
 * etapa sale de `etapas.ts`. Si este archivo tuviera su propia idea de qué
 * está parado, el listado diría una cosa y el panel de Seguimiento otra, y no
 * habría manera de saber a cuál creer. Es el mismo motivo por el que el
 * Dashboard tampoco tiene criterio propio de urgencia.
 *
 * NADA DE ESTO CAMBIA UN DATO. Son filtros y columnas: deciden qué se ve.
 */

import { estaEnRojo, type Etapa } from './seguimiento.ts';

// ── Columnas ────────────────────────────────────────────────────────────────

export interface Columna {
  clave: string;
  titulo: string;
  /** Sale en la vista de fábrica. */
  porDefecto: boolean;
  /**
   * No se puede quitar. Solo el nombre: una tabla de clientes sin la columna
   * del nombre no es una tabla mal configurada, es una pantalla rota.
   */
  fija?: boolean;
  /** Para qué sirve. Se enseña en el selector; sin esto se marcan a ciegas. */
  pista?: string;
}

/**
 * El catálogo, EN EL ORDEN EN QUE SE PINTAN. Elegir columnas cambia cuáles se
 * ven, nunca en qué orden: dejar reordenar añade una decisión más a cambio de
 * nada, y dos personas mirando la misma pantalla dejarían de ver lo mismo.
 */
export const COLUMNAS_CLIENTE: Columna[] = [
  { clave: 'prioridad', titulo: 'Pr.', porDefecto: true, pista: 'A, B o C' },
  { clave: 'nombre', titulo: 'Cliente', porDefecto: true, fija: true },
  { clave: 'clasificacion', titulo: 'Qué es', porDefecto: true, pista: 'Objetivo, precliente o cliente' },
  { clave: 'completitud', titulo: 'Qué falta', porDefecto: true, pista: 'Qué le falta para poder ofertarle' },
  { clave: 'seguimiento', titulo: 'Seguimiento', porDefecto: false, pista: 'Cuánto lleva parado y si eso ya es un problema' },
  { clave: 'tipo', titulo: 'Tipo', porDefecto: true },
  { clave: 'cups', titulo: 'CUPS', porDefecto: true, pista: 'Cuántos suministros tiene' },
  { clave: 'consumo', titulo: 'Consumo anual', porDefecto: true },
  { clave: 'comercializadora', titulo: 'Comercializadora', porDefecto: true },
  { clave: 'estado', titulo: 'Estado', porDefecto: true },
  { clave: 'zona', titulo: 'Zona', porDefecto: true },
  { clave: 'responsable', titulo: 'Responsable', porDefecto: true },
  { clave: 'accion', titulo: 'Próxima acción', porDefecto: true },
  // El NIF no es una columna: va bajo el nombre, siempre. Ponerlo aparte
  // duplicaba el dato en pantalla y lo dejaba oculto por defecto justo cuando
  // se busca a alguien por él.
  { clave: 'telefono', titulo: 'Teléfono', porDefecto: false, pista: 'Para llamar sin abrir la ficha' },
  { clave: 'alta', titulo: 'Alta', porDefecto: true },
];

export const COLUMNAS_POR_DEFECTO: string[] =
  COLUMNAS_CLIENTE.filter((c) => c.porDefecto).map((c) => c.clave);

/**
 * Deja la selección de columnas en algo que se puede pintar:
 * en el orden del catálogo, sin claves inventadas, sin repetidas y con las
 * fijas siempre dentro. Una vista guardada hace meses puede traer el nombre de
 * una columna que ya no existe, y eso no puede romper la pantalla.
 */
export function normalizarColumnas(elegidas: string[] | null | undefined): string[] {
  const pedidas = new Set(Array.isArray(elegidas) ? elegidas : []);
  const salida = COLUMNAS_CLIENTE
    .filter((c) => c.fija || pedidas.has(c.clave))
    .map((c) => c.clave);
  // Si no queda ninguna elegible (vista corrupta o vacía), se vuelve a la de
  // fábrica: una tabla con una sola columna no le sirve a nadie.
  return salida.length > 1 ? salida : [...COLUMNAS_POR_DEFECTO];
}

// ── Filtros ─────────────────────────────────────────────────────────────────

/** Los tres estados de seguimiento por los que tiene sentido filtrar. */
export const ESTADOS_SEGUIMIENTO = [
  { clave: 'parado', titulo: '🔴 Parados de más', pista: 'Han pasado del plazo de su etapa' },
  { clave: 'al_dia', titulo: '🟢 Dentro de plazo', pista: 'Se movieron hace poco para lo que toca' },
  { clave: 'sin_señales', titulo: '⚪ Sin ninguna señal', pista: 'Nunca se ha apuntado nada suyo' },
] as const;

export type EstadoSeguimiento = (typeof ESTADOS_SEGUIMIENTO)[number]['clave'];

/**
 * En cuál de los tres cajones cae un cliente.
 *
 * «Sin ninguna señal» es su propio cajón y no se mete en «parados»: son cosas
 * distintas. Uno lleva tres semanas sin que nadie lo toque —hay que llamarle—;
 * el otro entró de una importación y no se ha tocado nunca —hay que mirarlo—.
 * Mezclarlos hace la lista inservible para las dos cosas.
 */
export function estadoSeguimientoDe(etapa: Etapa, diasParado: number | null): EstadoSeguimiento {
  if (diasParado == null) return 'sin_señales';
  return estaEnRojo(etapa, diasParado) ? 'parado' : 'al_dia';
}

export interface FiltrosCliente {
  /** Objetivo · precliente · cliente. */
  clasificacion: string;
  /** Etapa comercial. */
  estado: string;
  prioridad: string;
  tipo: string;
  responsable: string;
  zona: string;
  seguimiento: string;
  via: string;
  /** Los atajos de una línea: sin acción, A sin seguimiento, incompletos. */
  especial: string;
  desde: string;
  hasta: string;
}

export const FILTROS_VACIOS: FiltrosCliente = {
  clasificacion: '', estado: '', prioridad: '', tipo: '', responsable: '',
  zona: '', seguimiento: '', via: '', especial: '', desde: '', hasta: '',
};

/** Cuántos filtros hay puestos. Se enseña para poder quitarlos de una vez. */
export function contarFiltros(f: FiltrosCliente): number {
  return (Object.keys(FILTROS_VACIOS) as (keyof FiltrosCliente)[])
    .filter((k) => (f[k] || '') !== '').length;
}

/** Rellena lo que falte: una vista guardada puede venir de una versión antigua. */
export function normalizarFiltros(bruto: unknown): FiltrosCliente {
  const o = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>;
  const salida = { ...FILTROS_VACIOS };
  for (const k of Object.keys(FILTROS_VACIOS) as (keyof FiltrosCliente)[]) {
    salida[k] = typeof o[k] === 'string' ? (o[k] as string) : '';
  }
  return salida;
}

// ── Vistas guardadas ────────────────────────────────────────────────────────

export interface Vista {
  id: string;
  nombre: string;
  filtros: FiltrosCliente;
  columnas: string[];
  /** Quién la creó. Vacío en las de fábrica. */
  autor: string;
  /**
   * Compartida con el equipo. Las personales solo las ve su autor: si todas
   * fueran de equipo, la barra se llenaría de vistas de otro y la propia
   * dejaría de encontrarse, que es justo lo que las hace útiles.
   */
  compartida: boolean;
  /** Las de fábrica no se pueden borrar ni pisar. */
  deFabrica?: boolean;
}

const vista = (
  id: string, nombre: string, filtros: Partial<FiltrosCliente>, columnas?: string[]
): Vista => ({
  id, nombre,
  filtros: { ...FILTROS_VACIOS, ...filtros },
  columnas: normalizarColumnas(columnas || COLUMNAS_POR_DEFECTO),
  autor: '', compartida: true, deFabrica: true,
});

/**
 * Las vistas que vienen puestas. No son ejemplos: son las preguntas que ya se
 * hacían a mano cada mañana montando filtros a mano.
 */
export const VISTAS_DE_FABRICA: Vista[] = [
  vista('todos', 'Todos', {}),
  vista('mi_cartera_parada', 'Parados de más', { seguimiento: 'parado' },
    ['prioridad', 'clasificacion', 'seguimiento', 'estado', 'responsable', 'accion', 'telefono']),
  vista('clientes_reales', 'Clientes de verdad', { clasificacion: 'cliente' },
    ['prioridad', 'clasificacion', 'cups', 'consumo', 'comercializadora', 'estado', 'responsable']),
  vista('para_visitar', 'Objetivos por zona', { clasificacion: 'objetivo' },
    ['prioridad', 'zona', 'tipo', 'telefono', 'responsable', 'accion']),
  vista('sin_datos', 'Les faltan datos', { especial: 'incompletos' },
    ['prioridad', 'completitud', 'cups', 'telefono', 'responsable']),
  vista('sin_responsable', 'Sin responsable', { responsable: '—sin—' },
    ['prioridad', 'clasificacion', 'estado', 'zona', 'accion']),
];

/** Valor reservado del filtro de responsable para «no tiene ninguno». */
export const SIN_RESPONSABLE = '—sin—';

/**
 * Qué vistas ve esta persona: las de fábrica, las compartidas y las suyas.
 * Las personales de otro no salen — ver el comentario de `compartida`.
 */
export function vistasVisibles(guardadas: Vista[], usuario: string): Vista[] {
  const propias = guardadas.filter((v) => v.compartida || (v.autor && v.autor === usuario));
  return [...VISTAS_DE_FABRICA, ...propias];
}

/** ¿La configuración de pantalla es exactamente esta vista? Para marcarla activa. */
export function esLaVistaActiva(v: Vista, filtros: FiltrosCliente, columnas: string[]): boolean {
  const mismosFiltros = (Object.keys(FILTROS_VACIOS) as (keyof FiltrosCliente)[])
    .every((k) => (v.filtros[k] || '') === (filtros[k] || ''));
  const a = normalizarColumnas(v.columnas).join(',');
  const b = normalizarColumnas(columnas).join(',');
  return mismosFiltros && a === b;
}

/**
 * Valida lo que venga guardado. El blob de `luz_config` lo puede haber tocado
 * alguien a mano, y una vista rota no puede tumbar el listado de clientes.
 */
export function validarVistas(bruto: unknown): Vista[] {
  if (!Array.isArray(bruto)) return [];
  const salida: Vista[] = [];
  const ids = new Set<string>();
  for (const x of bruto) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id : '';
    const nombre = typeof o.nombre === 'string' ? o.nombre.trim() : '';
    if (!id || !nombre || ids.has(id)) continue;
    ids.add(id);
    salida.push({
      id, nombre,
      filtros: normalizarFiltros(o.filtros),
      columnas: normalizarColumnas(Array.isArray(o.columnas) ? o.columnas as string[] : null),
      autor: typeof o.autor === 'string' ? o.autor : '',
      compartida: o.compartida === true,
    });
  }
  return salida;
}

/**
 * Guarda una vista. Si ya hay una con ese nombre del mismo autor, la pisa en
 * vez de añadir otra: dos «Mis parados» distintas es lo que hace que la barra
 * deje de servir.
 */
export function guardarVista(
  guardadas: Vista[], nueva: Omit<Vista, 'id' | 'deFabrica'>, id: string
): Vista[] {
  const nombre = nueva.nombre.trim();
  if (!nombre) return guardadas;
  const chocaCon = guardadas.find(
    (v) => v.nombre.trim().toLowerCase() === nombre.toLowerCase() && v.autor === nueva.autor);
  const limpia: Vista = {
    ...nueva, nombre, id: chocaCon ? chocaCon.id : id,
    columnas: normalizarColumnas(nueva.columnas),
    filtros: normalizarFiltros(nueva.filtros),
  };
  return chocaCon
    ? guardadas.map((v) => (v.id === chocaCon.id ? limpia : v))
    : [...guardadas, limpia];
}

/**
 * Borra una vista propia. Las de fábrica no están aquí, así que no se pueden
 * tocar; las de otra persona tampoco — salvo dirección, porque si no una vista
 * compartida por alguien que ya no está se queda ahí para siempre.
 */
export function borrarVista(
  guardadas: Vista[], id: string, usuario: string, esAdmin = false
): Vista[] {
  return guardadas.filter((v) => !(v.id === id && (esAdmin || v.autor === usuario)));
}
