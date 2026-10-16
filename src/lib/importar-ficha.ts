/**
 * QUÉ ES CADA FICHA QUE ENTRA POR LA IMPORTACIÓN.
 *
 * La plantilla completa no tenía columna para la clasificación ni para el
 * estado comercial, así que **todo lo importado nacía «precliente /
 * detectado»** — incluidas las filas que traían comercializadora final y
 * fecha de activación, o sea clientes firmados. La ficha se contradecía a sí
 * misma: el suministro en «activado» y el titular en «detectado».
 *
 * Aquí se decide qué se guarda, con dos reglas que no se tocan:
 *
 *  1. MANDA LO QUE ESCRIBA UNA PERSONA. Si la casilla trae un valor válido,
 *     se respeta tal cual. El cálculo solo rellena el hueco.
 *  2. LA DEDUCCIÓN NO RETROCEDE NUNCA. Si la ficha ya era «cliente» y la fila
 *     que llega no demuestra firma, se queda como cliente. Degradar a alguien
 *     porque su Excel venía incompleto es inventarse una pérdida, y encima
 *     silenciosa: nadie revisa a quién dejó de ser cliente tras una importación.
 *
 * Por qué deducir y no exigir la columna: son 388 filas. Pedir que se rellene
 * a mano en todas garantiza que se rellene mal en la mitad; pedirlo solo donde
 * el dato no se puede adivinar es lo que sí se hace.
 */

import { ES_CLASIFICACION, type Clasificacion, ORDEN } from './clasificacion.ts';

/** Lo que la fila demuestra por sí misma, sin que nadie lo escriba. */
export interface SenalesFila {
  /** Trae fecha de activación o contrato: hay una firma detrás. */
  activacion?: boolean;
  /** Estado del CUPS que viene en la fila. */
  estadoCups?: string | null;
  /** La fila trae CUPS. */
  tieneCups?: boolean;
  /** La fila trae consumo. */
  tieneConsumo?: boolean;
}

/** Estados de CUPS que solo se alcanzan con una firma detrás. */
const CUPS_FIRMADO = ['contrato_firmado', 'pendiente_activacion', 'activado'];

/**
 * Qué clasificación se deduce de la fila. Devuelve null cuando la fila no
 * demuestra nada: un objetivo del mapa y un precliente sin factura se parecen
 * demasiado como para adivinarlo, y adivinarlo mal ensucia justo el recuento
 * por el que se mira esta columna.
 */
export function clasificacionDeFila(s: SenalesFila): Clasificacion | null {
  if (s.activacion || (s.estadoCups && CUPS_FIRMADO.includes(s.estadoCups))) return 'cliente';
  if (s.tieneCups || s.tieneConsumo) return 'precliente';
  return null;
}

/** Lee la casilla de clasificación admitiendo cómo se escribe de verdad. */
export function leerClasificacion(texto: string): Clasificacion | null {
  const t = texto.trim().toLowerCase();
  if (!t) return null;
  if (ES_CLASIFICACION(t)) return t;
  if (/^(cliente|firmado|activo)$/.test(t)) return 'cliente';
  if (/^(precliente|pre-cliente|posible|posible cliente|seguimiento)$/.test(t)) return 'precliente';
  if (/^(objetivo|prospecto|puerta|candidato)$/.test(t)) return 'objetivo';
  return null;
}

/**
 * La clasificación que se guarda: lo escrito si vale, si no lo deducido, y
 * nunca por debajo de lo que la ficha ya era.
 */
export function clasificacionAGuardar(
  escrita: string, senales: SenalesFila, actual?: string | null
): Clasificacion | null {
  const elegida = leerClasificacion(escrita) || clasificacionDeFila(senales);
  if (!elegida) return null;
  // Lo escrito a mano manda incluso si baja: es una corrección a propósito.
  if (leerClasificacion(escrita)) return elegida;
  if (actual && ES_CLASIFICACION(actual) && ORDEN.indexOf(actual) > ORDEN.indexOf(elegida)) return null;
  return elegida;
}

/** Equivalencias del estado comercial, incluidas las etiquetas de la exportación. */
const ALIAS_ESTADO: Record<string, string> = {
  'detectado': 'detectado',
  'contacto iniciado': 'contacto_iniciado',
  'factura solicitada': 'factura_solicitada',
  'documentacion recibida': 'doc_recibida',
  'doc recibida': 'doc_recibida',
  'en analisis interno': 'en_analisis',
  'en analisis': 'en_analisis',
  'pendiente decision': 'pendiente_decision',
  'contrato en tramite': 'contrato_tramite',
  'cliente activo': 'activo',
  'activo': 'activo',
  'perdido': 'perdido',
  'no viable': 'no_viable',
  'revisar mas adelante': 'revisar_adelante',
};

/** Normaliza el estado comercial escrito. Devuelve null si no se reconoce. */
export function leerEstadoCliente(texto: string, validos: readonly string[]): string | null {
  const t = texto.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
  if (!t) return null;
  const directo = t.replace(/ /g, '_');
  if (validos.includes(directo)) return directo;
  const alias = ALIAS_ESTADO[t];
  return alias && validos.includes(alias) ? alias : null;
}

/**
 * LLAVE DE IDEMPOTENCIA de lo que cuelga del cliente.
 *
 * El cliente y el CUPS ya se actualizaban en vez de duplicarse, pero la
 * próxima acción, la comisión y la activación se insertaban sin mirar si ya
 * existían: pasar el mismo Excel dos veces dejaba dos tareas iguales, dos
 * comisiones por el mismo importe y dos contratos. Con una cartera que se
 * limpia a base de reimportar, eso es ensuciar la base justo mientras se
 * intenta limpiarla.
 *
 * La llave lleva el vínculo Y el hecho que la origina (la fecha, el importe),
 * nunca solo el tipo: igual que en los automatismos, una llave permanente
 * silenciaría la comisión del año siguiente sobre el mismo suministro.
 */
export const llaveImportacion = (partes: (string | number | null | undefined)[]) =>
  `[imp:${partes.map((p) => (p == null ? '' : String(p))).join('|')}]`;
