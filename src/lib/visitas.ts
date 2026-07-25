/**
 * QUÉ PASA DESPUÉS DE UNA VISITA.
 *
 * Una visita no es solo un apunte en el historial: es lo único que mueve el
 * resto del sistema. Según lo que David conteste al salir de la puerta hay que
 * crear una tarea, mover el pipeline, o cerrar una oportunidad — y si no se
 * hace en ese momento no se hace nunca, porque él ya está arrancando la
 * furgoneta.
 *
 * Aquí se declara qué desencadena cada respuesta. Está separado de la pantalla
 * a propósito: son reglas de negocio, se prueban solas y se cambian sin tocar
 * nada visual.
 */

export const RESULTADOS_VISITA = ['no_estaba', 'no_interesa', 'volver', 'factura'] as const;
export type ResultadoVisita = (typeof RESULTADOS_VISITA)[number];

export interface DefResultado {
  clave: ResultadoVisita;
  /** Lo que lee David en el botón. En su idioma, no en el nuestro. */
  etiqueta: string;
  emoji: string;
  /** Colores del botón (fondo/borde/texto, en clases de Tailwind). */
  clases: string;
  /** Qué se apunta en el historial si no escribe nada. */
  notaPorDefecto: string;
  /** Días hasta la siguiente pasada. null = no se programa nada. */
  diasParaVolver: number | null;
  /** A qué estado pasa la oportunidad del pipeline, si la hay. */
  estadoPipeline: string | null;
  /** Si la oportunidad del mapa debe darse por descartada. */
  descartarProspecto: boolean;
  /** Pide la foto de la factura. */
  pideFactura: boolean;
  /** Explicación corta de qué va a pasar, para que no haya sorpresas. */
  consecuencia: string;
}

export const DEF_RESULTADOS: Record<ResultadoVisita, DefResultado> = {
  no_estaba: {
    clave: 'no_estaba',
    etiqueta: 'No estaba',
    emoji: '🚪',
    clases: 'border-slate-500/50 bg-slate-500/15 text-slate-300',
    notaPorDefecto: 'No había nadie.',
    // Tres días: lo justo para no pasar el mismo día de la semana otra vez
    diasParaVolver: 3,
    estadoPipeline: null,
    descartarProspecto: false,
    pideFactura: false,
    consecuencia: 'Se apunta la visita y queda para volver a pasar en 3 días.',
  },
  no_interesa: {
    clave: 'no_interesa',
    etiqueta: 'No le interesa',
    emoji: '✕',
    clases: 'border-red-500/50 bg-red-500/15 text-red-400',
    notaPorDefecto: 'Dijo que no le interesa.',
    diasParaVolver: null,
    estadoPipeline: 'perdido',
    // Esto es lo que impide que vuelva a salir en el mapa dentro de un mes
    descartarProspecto: true,
    pideFactura: false,
    consecuencia: 'Se cierra la oportunidad y deja de proponerse en el mapa. No se insiste.',
  },
  volver: {
    clave: 'volver',
    etiqueta: 'Volver otro día',
    emoji: '🕐',
    clases: 'border-amber-500/50 bg-amber-500/15 text-amber-300',
    notaPorDefecto: 'Hay interés, pero no era el momento.',
    diasParaVolver: 15,
    estadoPipeline: 'seguimiento',
    descartarProspecto: false,
    pideFactura: false,
    consecuencia: 'Se apunta en la agenda para la fecha que elijas.',
  },
  factura: {
    clave: 'factura',
    etiqueta: 'Me dio la factura',
    emoji: '🧾',
    clases: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400',
    notaPorDefecto: 'Nos dio la factura.',
    diasParaVolver: null,
    estadoPipeline: 'factura_recibida',
    descartarProspecto: false,
    pideFactura: true,
    consecuencia: 'Se lee la factura al momento y el cliente queda listo para estudiar.',
  },
};

/** Fecha en formato ISO corto, sumando días a hoy. */
export function fechaEnDias(dias: number, desde = new Date()): string {
  const d = new Date(desde);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Consumo anual a partir de lo que lee la factura.
 *
 * El lector devuelve el consumo MENSUAL por periodo (P1, P2, P3…), así que el
 * anual es la suma de los periodos por doce. Se redondea porque dar decimales
 * en un consumo anual estimado desde una sola factura sería fingir precisión:
 * un mes de invierno y uno de agosto no se parecen.
 */
export function consumoAnualDesdeFactura(consumos_kwh_mes?: number[] | null): number | null {
  if (!Array.isArray(consumos_kwh_mes) || !consumos_kwh_mes.length) return null;
  const mensual = consumos_kwh_mes.reduce((t, n) => t + (Number(n) || 0), 0);
  if (mensual <= 0) return null;
  return Math.round((mensual * 12) / 100) * 100;
}

/** Nota final que se guarda: lo que escriba David, o la de por defecto. */
export function notaDeVisita(resultado: ResultadoVisita, escrita?: string | null): string {
  const propia = (escrita || '').trim();
  return propia || DEF_RESULTADOS[resultado].notaPorDefecto;
}

/** El texto que se le enseña antes de confirmar, para que sepa qué va a pasar. */
export function resumenConsecuencia(resultado: ResultadoVisita, fecha?: string | null): string {
  const def = DEF_RESULTADOS[resultado];
  if (resultado === 'volver' && fecha) {
    const d = new Date(fecha);
    return `Se apunta en la agenda para el ${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}.`;
  }
  return def.consecuencia;
}
