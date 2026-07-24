/**
 * ESTADO ÚNICO DEL VIAJE COMERCIAL.
 *
 * El problema que resuelve este archivo: el mismo hecho ("el cliente ha firmado")
 * vivía en cuatro sitios a la vez — `luz_clientes.estado_comercial`,
 * `luz_cups.estado_cups`, `luz_pipeline.estado` y `luz_contratos.estado_contrato`—
 * y había que actualizarlo a mano en todos. Si alguien se olvidaba de uno, los
 * números del panel mentían.
 *
 * La regla ahora: **el CUPS es la fuente de verdad del viaje comercial.**
 *  - Pipeline y Contrato son "vistas" de ese viaje: al cambiar su estado,
 *    empujan el estado del CUPS (traducción abajo).
 *  - El estado del cliente se DERIVA de sus CUPS: no se toca a mano.
 *
 * Cada entidad conserva los estados que solo le pertenecen (un contrato puede
 * estar "en incidencia" o "rechazado por la comercializadora"; eso no es un
 * estado del suministro). Por eso se traduce en vez de fusionar tablas: nada
 * se pierde y no hay que migrar datos existentes.
 */

/** Estados del CUPS ordenados por avance del viaje. Los terminales quedan fuera. */
export const ORDEN_ESTADO_CUPS: string[] = [
  'sin_factura', 'datos_incompletos', 'factura_recibida', 'pendiente_permanencia',
  'pendiente_ofertar', 'oferta_enviada', 'pendiente_firma', 'contrato_firmado',
  'pendiente_activacion', 'activado',
];

/** Estados que cierran el viaje (no compiten por "el más avanzado"). */
export const ESTADOS_CUPS_TERMINALES: string[] = ['perdido', 'no_viable', 'revisar_adelante'];

export const avanceCups = (estado: string): number => ORDEN_ESTADO_CUPS.indexOf(estado);

/**
 * Pipeline → CUPS. Mover una oportunidad en el embudo es mover el suministro.
 * `seguimiento` no retrocede el CUPS: seguir una oferta enviada sigue siendo
 * "oferta enviada" desde el punto de vista del suministro.
 */
export const PIPELINE_A_CUPS: Record<string, string> = {
  prospecto: 'sin_factura',
  factura_solicitada: 'sin_factura',
  factura_recibida: 'factura_recibida',
  doc_incompleta: 'datos_incompletos',
  pendiente_permanencia: 'pendiente_permanencia',
  pendiente_ofertar: 'pendiente_ofertar',
  oferta_enviada: 'oferta_enviada',
  seguimiento: 'oferta_enviada',
  pendiente_firma: 'pendiente_firma',
  ganado: 'contrato_firmado',
  perdido: 'perdido',
  revisar_adelante: 'revisar_adelante',
};

/**
 * Contrato → CUPS. Los estados internos de tramitación con la comercializadora
 * (enviado, pendiente de validación) son, para el suministro, "pendiente de
 * activación". `incidencia` NO se traduce: es un problema del contrato, el
 * suministro sigue donde estaba.
 */
export const CONTRATO_A_CUPS: Record<string, string> = {
  pendiente_preparar: 'pendiente_firma',
  enviado_cliente: 'pendiente_firma',
  pendiente_firma: 'pendiente_firma',
  firmado: 'contrato_firmado',
  enviado_comercializadora: 'pendiente_activacion',
  pendiente_validacion: 'pendiente_activacion',
  pendiente_activacion: 'pendiente_activacion',
  activado: 'activado',
  rechazado: 'perdido',
  cancelado: 'perdido',
};

/** CUPS → estado comercial del cliente. */
export const CUPS_A_CLIENTE: Record<string, string> = {
  sin_factura: 'contacto_iniciado',
  datos_incompletos: 'factura_solicitada',
  factura_recibida: 'doc_recibida',
  pendiente_permanencia: 'en_analisis',
  pendiente_ofertar: 'en_analisis',
  oferta_enviada: 'pendiente_decision',
  pendiente_firma: 'pendiente_decision',
  contrato_firmado: 'contrato_tramite',
  pendiente_activacion: 'contrato_tramite',
  activado: 'activo',
  perdido: 'perdido',
  no_viable: 'no_viable',
  revisar_adelante: 'revisar_adelante',
};

/**
 * Estado comercial que le corresponde a un cliente según TODOS sus CUPS.
 *
 * Reglas, en orden:
 *  1. Si algún suministro está activo, el cliente es un cliente activo — aunque
 *     tenga otros en trámite (ya factura con nosotros).
 *  2. Si hay algún suministro vivo, manda el más avanzado de todos.
 *  3. Si están todos cerrados, manda el "menos malo" (revisar antes que perdido):
 *     un cliente a revisar más adelante no es un cliente perdido.
 *
 * Devuelve null si no hay CUPS: sin suministros no se toca el estado del cliente
 * (puede ser un prospecto recién captado por David, y no queremos pisarlo).
 */
export function estadoClienteDesdeCups(estadosCups: string[]): string | null {
  const estados = estadosCups.filter(Boolean);
  if (estados.length === 0) return null;

  if (estados.includes('activado')) return 'activo';

  const vivos = estados.filter((e) => !ESTADOS_CUPS_TERMINALES.includes(e) && avanceCups(e) >= 0);
  if (vivos.length > 0) {
    const masAvanzado = vivos.reduce((mejor, e) => (avanceCups(e) > avanceCups(mejor) ? e : mejor));
    return CUPS_A_CLIENTE[masAvanzado] || null;
  }

  for (const terminal of ['revisar_adelante', 'no_viable', 'perdido']) {
    if (estados.includes(terminal)) return CUPS_A_CLIENTE[terminal] || null;
  }
  return null;
}

/**
 * ¿Debe el CUPS adoptar este estado nuevo?
 *
 * Sí siempre que sea un cambio real. La única protección es no RETROCEDER por
 * accidente: si el suministro ya está activado, que alguien mueva una vieja
 * oportunidad del pipeline a "seguimiento" no puede desactivarlo. Los cierres
 * (perdido / no viable) sí pueden aplicarse siempre: son decisiones explícitas.
 */
export function debeAplicarseAlCups(estadoActual: string, estadoNuevo: string): boolean {
  if (!estadoNuevo || estadoActual === estadoNuevo) return false;
  if (ESTADOS_CUPS_TERMINALES.includes(estadoNuevo)) return true;
  if (ESTADOS_CUPS_TERMINALES.includes(estadoActual)) return true; // reabrir un cerrado sí vale
  return avanceCups(estadoNuevo) > avanceCups(estadoActual);
}
