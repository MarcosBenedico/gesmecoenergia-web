/**
 * EN QUÉ SITUACIÓN ESTÁ CADA COMISIÓN — Y DE QUIÉN DEPENDE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUÉ NO ES UN ESTADO NUEVO
 *
 * `ESTADOS_COMISION` ya existe en `luz.ts` y no hace falta otro vocabulario:
 * sería exactamente el fallo que `etapas.ts` vino a arreglar. Lo que faltaba
 * no era un estado más, era la CUENTA que nadie hacía:
 *
 *     un montón de «pendientes» no dice nada. «Prevista» y «vencida hace
 *     ocho meses» son la misma etiqueta y cosas opuestas: una es una
 *     previsión de febrero y la otra es dinero que se está perdiendo.
 *
 * Así que aquí el estado se cruza con la FECHA y con QUIÉN TIENE LA PELOTA, y
 * sale una situación que sí se puede accionar.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ANTES DE RECLAMAR HAY QUE RECLASIFICAR
 *
 * Medido en la cartera real: 29 comisiones «prevista» suman 217,34 € entre
 * todas, con fechas de enero a junio. Eso no es una cartera de cobro, es un
 * residuo de una importación. Reclamar 7 € a una comercializadora quema una
 * relación por nada, y dejarlo ahí hace que la lista de cobros no se mire.
 *
 * Por eso existe `necesitaRevision`: una comisión sin importe, o «prevista»
 * con la fecha pasada hace meses, NO se declara exigible ni se propone
 * reclamar — se marca para mirarla. Es la misma regla que en `factura.ts`: lo
 * dudoso se señala con el motivo escrito y NUNCA se corrige por nuestra
 * cuenta. Un cobro que no se puede justificar con un dato real no se reclama.
 */

import { COMISION_PENDIENTE } from './luz.ts';

/** Qué se puede hacer HOY con esta comisión. */
export type SituacionCobro =
  /** Está prevista para más adelante: no se reclama, se espera. */
  | 'no_exigible'
  /** Se puede pedir ya y todavía no se ha pasado el plazo. */
  | 'exigible'
  /** Se podía pedir y la fecha pasó: es dinero que se está perdiendo. */
  | 'vencido'
  /** Entró una parte y queda saldo. */
  | 'parcial'
  /** Cobrado del todo. */
  | 'cobrado'
  /** Perdida o cancelada: ya no cuenta. */
  | 'cerrado'
  /** El dato no da para decidir nada. Se mira antes de reclamar. */
  | 'por_revisar';

/**
 * Quién tiene que mover ficha. Es lo que contesta «¿esto depende de mí?», y
 * separarlo del estado es lo que permite tener una lista de «esperando a
 * terceros» que no se confunda con el trabajo propio.
 */
export type PelotaCobro = 'nuestra' | 'de_la_comercializadora';

export interface EntradaComision {
  id: string;
  cliente_id?: string | null;
  comercializadora?: string | null;
  estado_comision: string;
  importe_previsto?: number | string | null;
  importe_cobrado?: number | string | null;
  fecha_prevista_cobro?: string | null;
  fecha_cobro?: string | null;
}

export interface Cobro {
  id: string;
  situacion: SituacionCobro;
  /** Lo que queda por entrar. Nunca negativo. */
  saldo: number;
  previsto: number;
  cobrado: number;
  pelota: PelotaCobro;
  /** Días desde que se podía cobrar. Negativo si aún no toca. Null sin fecha. */
  diasVencido: number | null;
  /** La frase de la pantalla. Nunca vacía. */
  texto: string;
  /** Por qué no se puede dar por buena. Null si el dato es utilizable. */
  motivoRevision: string | null;
}

export const SITUACION_COBRO_LABEL: Record<SituacionCobro, string> = {
  no_exigible: 'Prevista, aún no toca',
  exigible: 'Se puede reclamar',
  vencido: 'Vencida sin cobrar',
  parcial: 'Cobrada a medias',
  cobrado: 'Cobrada',
  cerrado: 'Cerrada sin cobro',
  por_revisar: 'Sin datos para reclamar',
};

/**
 * A partir de cuántos días de retraso una «prevista» deja de ser creíble.
 *
 * Una comisión que sigue como PREVISTA —o sea, que nadie ha confirmado que la
 * comercializadora la deba— con la fecha pasada hace tres meses no es una
 * deuda: es un apunte que se quedó ahí. Reclamarla sin comprobarla es pedir
 * dinero que igual no corresponde.
 */
export const DIAS_PREVISTA_CADUCA = 90;

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const dias = (desde: string | null | undefined, hoy: string): number | null => {
  if (!desde) return null;
  const a = new Date(`${String(desde).slice(0, 10)}T00:00:00`);
  const b = new Date(`${hoy.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
};

/** Estados en los que el cobro ya no se persigue. */
const CERRADOS = ['perdida', 'cancelada'];
/** Estados que significan «la comercializadora aún no lo ha confirmado». */
const SIN_CONFIRMAR = ['prevista', 'pendiente_validar'];

/**
 * La situación de UNA comisión. No escribe nada ni corrige ningún importe:
 * describe lo que hay y, cuando el dato no da, lo dice.
 */
export function situacionDeCobro(c: EntradaComision, hoy: string): Cobro {
  const previsto = num(c.importe_previsto);
  const cobrado = num(c.importe_cobrado);
  const saldo = Math.max(0, previsto - cobrado);
  const retraso = dias(c.fecha_prevista_cobro, hoy);
  const estado = c.estado_comision;

  const base = {
    id: c.id, previsto, cobrado, saldo, diasVencido: retraso,
  };

  if (CERRADOS.includes(estado)) {
    return {
      ...base, situacion: 'cerrado', pelota: 'nuestra',
      texto: 'Cerrada sin cobro', motivoRevision: null,
    };
  }

  if (estado === 'cobrada' || (previsto > 0 && cobrado >= previsto)) {
    return {
      ...base, situacion: 'cobrado', pelota: 'nuestra',
      texto: `Cobrada${c.fecha_cobro ? ` el ${String(c.fecha_cobro).slice(0, 10)}` : ''}`,
      motivoRevision: null,
    };
  }

  /*
   * LO QUE NO SE PUEDE RECLAMAR PORQUE NO SE SABE QUÉ ES.
   *
   * Va ANTES que todo lo demás a propósito: mientras el dato no dé, esta
   * comisión no puede figurar como exigible ni sumar en el importe que se
   * persigue. Un total inflado con apuntes de cero es peor que no tener total.
   */
  let motivo: string | null = null;
  if (previsto <= 0 && cobrado <= 0) {
    motivo = 'No tiene importe previsto: no se sabe cuánto se reclama.';
  } else if (!c.fecha_prevista_cobro) {
    motivo = 'No tiene fecha prevista de cobro: no se sabe si ya toca.';
  } else if (SIN_CONFIRMAR.includes(estado) && retraso != null && retraso > DIAS_PREVISTA_CADUCA) {
    motivo = `Sigue como «${estado === 'prevista' ? 'prevista' : 'pendiente de validar'}» y la fecha pasó hace ${retraso} días: hay que confirmar con la comercializadora que se debe antes de pedirla.`;
  }
  if (motivo) {
    return {
      ...base, situacion: 'por_revisar', pelota: 'nuestra',
      texto: 'Hay que revisarla antes de reclamar', motivoRevision: motivo,
    };
  }

  // Una comisión que la comercializadora aún no ha confirmado depende de ella;
  // una ya confirmada y vencida depende de que nosotros la reclamemos.
  const pelota: PelotaCobro = SIN_CONFIRMAR.includes(estado) ? 'de_la_comercializadora' : 'nuestra';

  if (cobrado > 0 && saldo > 0) {
    return {
      ...base, situacion: 'parcial', pelota,
      texto: `Entró una parte, quedan ${saldo.toFixed(2)} €`, motivoRevision: null,
    };
  }

  /*
   * VENCIDO SOLO LO QUE ESTÁ CONFIRMADO.
   *
   * Una comisión que la comercializadora todavía no ha validado y lleva unos
   * días pasada de fecha no es una deuda vencida: es su ciclo de liquidación,
   * que rara vez cae el día exacto. Pintarla en rojo desde el primer día haría
   * que el rojo de esta pantalla fuera el estado normal, y entonces la que sí
   * lleva medio año sin entrar no se distinguiría de las demás.
   *
   * Sigue saliendo para perseguir —`exigible`, con la pelota en el tercero—, y
   * si pasa de `DIAS_PREVISTA_CADUCA` se va a revisar, que es lo que toca.
   */
  if (retraso != null && retraso > 0 && pelota === 'nuestra') {
    return {
      ...base, situacion: 'vencido', pelota,
      texto: `Se podía cobrar hace ${retraso} días y no ha entrado`, motivoRevision: null,
    };
  }
  if (retraso != null && retraso > 0) {
    return {
      ...base, situacion: 'exigible', pelota,
      texto: `Prevista hace ${retraso} días: falta que la comercializadora la confirme`,
      motivoRevision: null,
    };
  }

  if (retraso != null && retraso >= 0) {
    return { ...base, situacion: 'exigible', pelota, texto: 'Toca cobrarla ya', motivoRevision: null };
  }

  return {
    ...base, situacion: 'no_exigible', pelota,
    texto: `Prevista para dentro de ${Math.abs(retraso ?? 0)} días`, motivoRevision: null,
  };
}

export interface ResumenCobros {
  /** Lo que se puede perseguir HOY con un dato detrás. */
  exigible: number;
  /** De eso, lo que ya se pasó de plazo. */
  vencido: number;
  /** Previsiones futuras. No se reclaman: se esperan. */
  previsto: number;
  /** Lo que está esperando a que conteste la comercializadora. */
  enTerceros: number;
  /** Cuánto dinero está bloqueado por no tener el dato bien. */
  porRevisar: number;
  cuantasPorRevisar: number;
  cobradoEnPlazo: number;
}

/**
 * El cuadro de cobros. Separa lo perseguible de lo que solo es una previsión,
 * porque sumarlo todo en un «pendiente» da una cifra que no se puede usar
 * para nada: ni para reclamar, ni para prever caja.
 */
export function resumenDeCobros(comisiones: EntradaComision[], hoy: string): ResumenCobros {
  const r: ResumenCobros = {
    exigible: 0, vencido: 0, previsto: 0, enTerceros: 0,
    porRevisar: 0, cuantasPorRevisar: 0, cobradoEnPlazo: 0,
  };
  for (const c of comisiones) {
    const s = situacionDeCobro(c, hoy);
    if (s.situacion === 'por_revisar') {
      r.porRevisar += s.saldo;
      r.cuantasPorRevisar++;
      continue;
    }
    if (s.situacion === 'cobrado') { r.cobradoEnPlazo += s.cobrado; continue; }
    if (s.situacion === 'cerrado') continue;
    if (s.situacion === 'no_exigible') { r.previsto += s.saldo; continue; }
    // Exigible, vencido y parcial son dinero que se persigue.
    r.exigible += s.saldo;
    if (s.situacion === 'vencido') r.vencido += s.saldo;
    if (s.pelota === 'de_la_comercializadora') r.enTerceros += s.saldo;
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    exigible: r2(r.exigible), vencido: r2(r.vencido), previsto: r2(r.previsto),
    enTerceros: r2(r.enTerceros), porRevisar: r2(r.porRevisar),
    cuantasPorRevisar: r.cuantasPorRevisar, cobradoEnPlazo: r2(r.cobradoEnPlazo),
  };
}

/**
 * ¿Se puede reclamar esta comisión sin quedar mal?
 *
 * Lo usa el automatismo de reclamar: la especificación lo pide con estas
 * palabras — «las comisiones pendientes deben reclasificarse con datos reales
 * antes de reclamar». Un aviso de cobro mal fundado cuesta más que el importe.
 */
export function sePuedeReclamar(c: EntradaComision, hoy: string): boolean {
  if (!COMISION_PENDIENTE.includes(c.estado_comision)) return false;
  const s = situacionDeCobro(c, hoy);
  return s.situacion === 'vencido' && s.saldo > 0;
}
