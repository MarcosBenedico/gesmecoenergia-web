/**
 * EL ESTADO DE UN SUMINISTRO, CALCULADO EN UN SOLO SITIO.
 *
 * El documento de rediseño lo pide sin rodeos: «no duplicar lógica de cálculo
 * de estado en varios componentes; centralizarla en una función/selector común
 * que devuelva fase, alerta prioritaria, próxima acción y prioridad».
 *
 * POR QUÉ NO HAY NUEVE FASES NUEVAS
 *
 * El documento propone nueve fases (Pendiente de información, Facturas
 * recibidas, Análisis en curso...). Son, casi una a una, las etapas que ya
 * viven en `etapas.ts` con otro nombre. Crear un segundo catálogo sería
 * exactamente el fallo que `etapas.ts` vino a arreglar: dos vocabularios para
 * lo mismo, la misma tarjeta enseñando dos etiquetas distintas y todo el mundo
 * traduciendo de cabeza.
 *
 * Así que la FASE sale de `etapas.ts` y aquí se añade lo que el documento sí
 * aporta de nuevo, que es mucho:
 *
 *   · LA ALERTA ES INDEPENDIENTE DE LA FASE. «Un suministro puede estar en
 *     Contrato enviado y tener alerta Sin firma desde hace 5 días.» Antes, un
 *     problema o cambiaba el estado o no se veía.
 *   · EL BLOQUEO DICE QUÉ FALTA, no «pendiente». «Falta el consumo para poder
 *     ofertar» se puede resolver; «pendiente» hay que investigarlo.
 *   · LA PRIORIDAD SIEMPRE LLEVA TEXTO. El color acompaña, nunca sustituye:
 *     quien no distingue rojo de ámbar tiene que poder trabajar igual.
 *
 * Y una regla del documento que ordena todo lo demás: ROJO SOLO PARA BLOQUEO,
 * VENCIMIENTO O RIESGO REAL. Si todo lo no terminado sale en rojo, el rojo
 * deja de querer decir nada.
 */

import { ETAPA, etapaDe, type Etapa } from './etapas.ts';

/** Qué impide avanzar o qué reclama atención, al margen de la fase. */
export type TipoAlerta =
  | 'accion_vencida'
  | 'preaviso_cerrandose'
  | 'preaviso_perdido'
  | 'sin_firma'
  | 'sin_activar'
  | 'falta_dato'
  | 'sin_accion';

export interface AlertaSuministro {
  tipo: TipoAlerta;
  /** Qué pasa, en lenguaje de persona. */
  texto: string;
  /** Solo para bloqueo, vencimiento o riesgo real. */
  critica: boolean;
}

export type NivelPrioridad = 'critica' | 'hoy' | 'normal' | 'correcta' | 'incompleta';

/**
 * Cada nivel con su TEXTO OBLIGATORIO. El documento lo exige y con razón: una
 * tarjeta que solo se distingue por el color del borde es ilegible para quien
 * no distingue esos colores, y ambigua para todos los demás en una pantalla
 * con brillo de sol.
 */
export const PRIORIDAD: Record<NivelPrioridad, { texto: string; tono: string; orden: number }> = {
  critica: { texto: 'Requiere acción ya', tono: 'border-red-500/50 bg-red-500/[0.06] text-red-300', orden: 0 },
  hoy: { texto: 'Acción hoy', tono: 'border-amber-500/50 bg-amber-500/[0.06] text-amber-300', orden: 1 },
  normal: { texto: 'En plazo', tono: 'border-sky-500/40 bg-sky-500/[0.04] text-sky-300', orden: 2 },
  incompleta: { texto: 'Falta completar datos', tono: 'border-slate-500/40 bg-slate-500/[0.04] text-slate-300', orden: 3 },
  correcta: { texto: 'Sin acciones pendientes', tono: 'border-emerald-500/40 bg-emerald-500/[0.04] text-emerald-300', orden: 4 },
};

export interface EntradaSuministro {
  id: string;
  cups: string;
  alias?: string | null;
  direccion?: string | null;
  tarifa?: string | null;
  comercializadora?: string | null;
  tipoContrato?: string | null;
  estadoCups: string;
  consumoAnual?: number | null;
  potencias?: number[] | null;
  fechaFinContrato?: string | null;
  fechaLimitePreaviso?: string | null;
  fechaFinPermanencia?: string | null;
  /** Tareas abiertas de ESTE suministro. */
  tareas?: { descripcion?: string | null; fecha_limite?: string | null; estado?: string }[];
  /** Contratos de este suministro, para detectar firmado sin activar. */
  contratos?: { estado_contrato: string; fecha_firma?: string | null; fecha_activacion_real?: string | null }[];
}

export interface ProximaAccionSuministro {
  texto: string;
  fecha: string | null;
  /** Días hasta la fecha. Negativo si ya pasó. Null si no hay fecha. */
  dias: number | null;
  /** Cómo se lee la fecha: «Hoy», «Vencida hace 2 días», «23 ago». */
  cuando: string;
}

export interface EstadoSuministro {
  etapa: Etapa;
  /** Cómo se llama esa etapa en pantalla. Sale de `etapas.ts`. */
  fase: string;
  alerta: AlertaSuministro | null;
  /** Qué falta EXACTAMENTE para poder avanzar. Null si no hay bloqueo. */
  bloqueo: string | null;
  proximaAccion: ProximaAccionSuministro | null;
  prioridad: NivelPrioridad;
  /** El texto de la prioridad, ya resuelto. Nunca vacío. */
  etiquetaPrioridad: string;
}

/** Días desde hoy hasta una fecha. Negativo si ya pasó. */
export function diasHasta(fecha: string | null | undefined, hoy: string): number | null {
  if (!fecha) return null;
  const a = new Date(`${String(fecha).slice(0, 10)}T00:00:00`);
  const b = new Date(`${hoy.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

/** «Hoy», «Vencida hace 2 días», «En 5 días», «23 ago». */
export function comoSeLee(fecha: string | null | undefined, hoy: string): string {
  const d = diasHasta(fecha, hoy);
  if (d == null) return 'Sin fecha';
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Mañana';
  if (d === -1) return 'Vencida ayer';
  if (d < 0) return `Vencida hace ${Math.abs(d)} días`;
  if (d <= 7) return `En ${d} días`;
  return new Date(`${String(fecha).slice(0, 10)}T00:00:00`)
    .toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/** Cuántos días antes de que se cierre el preaviso ya es urgente. */
export const DIAS_PREAVISO_URGENTE = 30;
/** Días sin firmar un contrato enviado a partir de los cuales se reclama. */
export const DIAS_SIN_FIRMA = 7;
/** Días desde la firma sin activación a partir de los cuales se reclama. */
export const DIAS_SIN_ACTIVAR = 20;

const TAREAS_ABIERTAS = ['pendiente', 'en_curso'];

/**
 * El estado completo de un suministro: fase, alerta, bloqueo, acción y
 * prioridad. Es la única función que decide esto en toda la aplicación.
 */
export function estadoDeSuministro(s: EntradaSuministro, hoy: string): EstadoSuministro {
  const etapa = etapaDe('cups', s.estadoCups);
  const cerrado = etapa === 'activo' || etapa === 'perdido' || etapa === 'aparcado';

  // ── Próxima acción: la tarea abierta más cercana ──
  const abiertas = (s.tareas || [])
    .filter((t) => !t.estado || TAREAS_ABIERTAS.includes(t.estado))
    .sort((a, b) => (a.fecha_limite || '9999').localeCompare(b.fecha_limite || '9999'));

  const t0 = abiertas[0];
  const proximaAccion: ProximaAccionSuministro | null = t0
    ? {
      texto: t0.descripcion || 'Tarea sin descripción',
      fecha: t0.fecha_limite || null,
      dias: diasHasta(t0.fecha_limite, hoy),
      cuando: comoSeLee(t0.fecha_limite, hoy),
    }
    : null;

  // ── Bloqueo: qué falta EXACTAMENTE ──
  // Nunca «pendiente»: eso obliga a investigar. Se nombra el dato que falta,
  // y solo cuando de verdad impide el siguiente paso de SU etapa.
  let bloqueo: string | null = null;
  if (!cerrado) {
    if (!s.consumoAnual && (etapa === 'en_analisis' || etapa === 'propuesta_enviada')) {
      bloqueo = 'Falta el consumo anual: sin él no se puede calcular el ahorro';
    } else if (!s.tarifa && etapa !== 'detectado') {
      bloqueo = 'Falta la tarifa de acceso: sin ella no se puede comparar';
    } else if (!s.fechaFinContrato && etapa !== 'detectado' && etapa !== 'factura_solicitada') {
      bloqueo = 'Falta el fin de contrato: sin él no se puede calcular el preaviso';
    }
  }

  // ── Alerta: independiente de la fase ──
  // El orden importa: se queda la primera, y van de lo irrecuperable a lo
  // meramente incompleto. Un preaviso perdido bloquea al cliente un año.
  let alerta: AlertaSuministro | null = null;
  const poner = (tipo: TipoAlerta, texto: string, critica: boolean) => {
    if (!alerta) alerta = { tipo, texto, critica };
  };

  /**
   * EL PREAVISO SE VIGILA AUNQUE EL SUMINISTRO ESTÉ ACTIVO.
   *
   * Al principio lo silenciaba con el resto de lo «cerrado», y es justo al
   * revés: un cliente ACTIVO al que se le acaba el contrato es exactamente
   * quien tiene ventana de preaviso. Si se pasa, se renueva solo y queda
   * bloqueado un año — el cliente que ya es nuestro es el que más fácil se
   * pierde por no mirar una fecha.
   *
   * Solo se calla en lo perdido y lo aparcado, donde no hay nada que renovar.
   */
  const abandonado = etapa === 'perdido' || etapa === 'aparcado';
  const diasPreaviso = diasHasta(s.fechaLimitePreaviso, hoy);
  if (!abandonado && diasPreaviso != null) {
    if (diasPreaviso < 0) {
      poner('preaviso_perdido',
        `La ventana de preaviso se cerró hace ${Math.abs(diasPreaviso)} días: el contrato se renueva solo`, true);
    } else if (diasPreaviso <= DIAS_PREAVISO_URGENTE) {
      poner('preaviso_cerrandose',
        `Quedan ${diasPreaviso} ${diasPreaviso === 1 ? 'día' : 'días'} para poder preavisar`, true);
    }
  }

  if (proximaAccion?.dias != null && proximaAccion.dias < 0) {
    poner('accion_vencida', `${proximaAccion.texto} · ${proximaAccion.cuando}`, true);
  }

  for (const k of s.contratos || []) {
    const dFirma = diasHasta(k.fecha_firma, hoy);
    if (k.fecha_firma && !k.fecha_activacion_real && dFirma != null && -dFirma > DIAS_SIN_ACTIVAR) {
      poner('sin_activar',
        `Firmado hace ${-dFirma} días y sin constar la activación`, true);
    }
    if (!k.fecha_firma && ['enviado_cliente', 'pendiente_firma'].includes(k.estado_contrato)) {
      poner('sin_firma', 'Contrato enviado y todavía sin firmar', false);
    }
  }

  if (bloqueo) poner('falta_dato', bloqueo, false);

  if (!cerrado && !proximaAccion && !alerta) {
    poner('sin_accion', 'No hay ninguna acción programada', false);
  }

  // ── Prioridad ──
  // Rojo SOLO para bloqueo, vencimiento o riesgo real: si todo lo pendiente
  // sale en rojo, el rojo deja de significar nada.
  let prioridad: NivelPrioridad;
  const a = alerta as AlertaSuministro | null;
  if (a?.critica) prioridad = 'critica';
  else if (proximaAccion?.dias === 0) prioridad = 'hoy';
  else if (proximaAccion) prioridad = 'normal';
  else if (bloqueo || a) prioridad = 'incompleta';
  else prioridad = 'correcta';

  return {
    etapa,
    fase: ETAPA[etapa].titulo,
    alerta,
    bloqueo,
    proximaAccion,
    prioridad,
    etiquetaPrioridad: PRIORIDAD[prioridad].texto,
  };
}

// ── La banda «Siguiente acción» del cliente ─────────────────────────────────

export interface SiguienteAccion {
  texto: string;
  /** De qué suministro es, o «Cliente general». */
  contexto: string;
  /** Id del suministro, si es de uno. Null si es del cliente. */
  suministroId: string | null;
  cuando: string;
  dias: number | null;
  critica: boolean;
  /** Cuántas cosas más hay esperando además de esta. */
  otras: number;
}

export interface EntradaCliente {
  suministros: EntradaSuministro[];
  /** Tareas del cliente SIN suministro asignado. */
  tareasGenerales?: { descripcion?: string | null; fecha_limite?: string | null; estado?: string }[];
}

/**
 * Qué hay que hacer AHORA con este cliente, en una sola frase.
 *
 * El orden lo fija el documento y coincide con el del Dashboard: primero lo
 * vencido, luego lo de hoy, luego los bloqueos críticos, luego lo próximo.
 * Devuelve una sola cosa y cuántas más quedan — «si hay más de una alerta
 * importante, mostrar una principal y un enlace con contador».
 */
export function siguienteAccion(c: EntradaCliente, hoy: string): SiguienteAccion | null {
  interface Candidata extends SiguienteAccion { orden: number }
  const candidatas: Candidata[] = [];

  const meter = (base: Omit<SiguienteAccion, 'otras'>, orden: number) =>
    candidatas.push({ ...base, otras: 0, orden });

  for (const s of c.suministros) {
    const e = estadoDeSuministro(s, hoy);
    const contexto = s.alias || s.direccion || (s.cups ? `CUPS …${s.cups.slice(-6)}` : 'Suministro');

    if (e.proximaAccion && e.proximaAccion.dias != null && e.proximaAccion.dias < 0) {
      meter({ texto: e.proximaAccion.texto, contexto, suministroId: s.id, cuando: e.proximaAccion.cuando, dias: e.proximaAccion.dias, critica: true }, 0);
    } else if (e.proximaAccion?.dias === 0) {
      meter({ texto: e.proximaAccion.texto, contexto, suministroId: s.id, cuando: 'Hoy', dias: 0, critica: true }, 1);
    }

    // Un bloqueo crítico entra aunque no haya tarea: es justo el caso en que
    // nadie ha programado nada porque nadie se ha dado cuenta.
    if (e.alerta?.critica && e.alerta.tipo !== 'accion_vencida') {
      meter({ texto: e.alerta.texto, contexto, suministroId: s.id, cuando: '', dias: null, critica: true }, 2);
    }

    if (e.proximaAccion && e.proximaAccion.dias != null && e.proximaAccion.dias > 0) {
      meter({ texto: e.proximaAccion.texto, contexto, suministroId: s.id, cuando: e.proximaAccion.cuando, dias: e.proximaAccion.dias, critica: false }, 3);
    }
  }

  for (const t of c.tareasGenerales || []) {
    if (t.estado && !TAREAS_ABIERTAS.includes(t.estado)) continue;
    const d = diasHasta(t.fecha_limite, hoy);
    const orden = d == null ? 4 : d < 0 ? 0 : d === 0 ? 1 : 3;
    meter({
      texto: t.descripcion || 'Tarea sin descripción',
      contexto: 'Cliente general', suministroId: null,
      cuando: comoSeLee(t.fecha_limite, hoy), dias: d, critica: d != null && d <= 0,
    }, orden);
  }

  if (!candidatas.length) return null;

  candidatas.sort((x, y) => x.orden - y.orden || (x.dias ?? 9999) - (y.dias ?? 9999));
  return { ...candidatas[0], otras: candidatas.length - 1 };
}

// ── Los cuatro indicadores del resumen operativo ────────────────────────────

export interface ResumenOperativo {
  suministros: number;
  conAlerta: number;
  enGestion: number;
  /** Suministros a los que les falta un dato que bloquea. */
  bloqueados: number;
  /** Fecha del preaviso más próximo, o null. */
  proximoVencimiento: string | null;
  diasProximoVencimiento: number | null;
}

/**
 * Como mucho CUATRO indicadores, y solo si se pueden accionar.
 *
 * El documento prohíbe expresamente el panel decorativo: nada de importes,
 * ahorro o consumo agregados «si no están completos o no sirven para decidir
 * una acción». El consumo total del cliente es exactamente eso — una cifra
 * bonita que no cambia lo que se hace hoy — y por eso ya no está en la ficha.
 */
export function resumenOperativo(c: EntradaCliente, hoy: string): ResumenOperativo {
  let conAlerta = 0;
  let enGestion = 0;
  let bloqueados = 0;
  let mejor: { fecha: string; dias: number } | null = null;

  for (const s of c.suministros) {
    const e = estadoDeSuministro(s, hoy);
    if (e.alerta?.critica) conAlerta++;
    if (e.bloqueo) bloqueados++;
    if (!['activo', 'perdido', 'aparcado'].includes(e.etapa)) enGestion++;

    const d = diasHasta(s.fechaLimitePreaviso, hoy);
    if (s.fechaLimitePreaviso && d != null && d >= 0 && (!mejor || d < mejor.dias)) {
      mejor = { fecha: s.fechaLimitePreaviso.slice(0, 10), dias: d };
    }
  }

  return {
    suministros: c.suministros.length,
    conAlerta,
    enGestion,
    bloqueados,
    proximoVencimiento: mejor ? mejor.fecha : null,
    diasProximoVencimiento: mejor ? mejor.dias : null,
  };
}

/**
 * Cómo se presentan los suministros según cuántos hay.
 *
 * El documento lo fija: 1 → tarjeta expandida; 2-4 → tarjetas compactas;
 * 5+ → tabla densa. El motivo es real: una cascada de tarjetas grandes con
 * ocho suministros obliga a hacer scroll para saber cuál requiere atención,
 * que es justo lo que la ficha tiene que contestar sin moverse.
 */
export function modoDePresentacion(n: number): 'unica' | 'tarjetas' | 'tabla' {
  if (n <= 1) return 'unica';
  if (n <= 4) return 'tarjetas';
  return 'tabla';
}

/** Los suministros ordenados por lo que reclama atención primero. */
export function ordenarSuministros(ss: EntradaSuministro[], hoy: string): EntradaSuministro[] {
  return [...ss].sort((a, b) => {
    const ea = estadoDeSuministro(a, hoy);
    const eb = estadoDeSuministro(b, hoy);
    return PRIORIDAD[ea.prioridad].orden - PRIORIDAD[eb.prioridad].orden;
  });
}
