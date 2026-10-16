/**
 * FOCO DEL DÍA: a quién se sigue ahora y a quién se mira hoy sí o sí.
 *
 * La cartera creció más deprisa que las horas del día. Mi Día enseña lo que
 * toca por FECHA —vence un contrato, hay una tarea con su plazo— y eso está
 * bien, pero deja fuera dos cosas que una persona sí sabe y el sistema no:
 *
 *   1. «De este no quiero saber nada por ahora.» No está perdido, no se
 *      descarta, no se borra: es que hoy no toca. Hasta ahora la única forma
 *      de quitarlo de en medio era borrarlo o dejarlo ahí molestando, y las
 *      dos son malas. Borrar pierde el historial; dejarlo ahí llena la lista
 *      de cosas que se saltan todos los días, y una lista que se salta deja
 *      de mirarse entera — que es el fallo caro, porque entonces también se
 *      saltan las que sí importaban.
 *   2. «A este quiero verlo hoy, tenga fecha o no.» La decisión de a quién
 *      apretar hoy la toma una persona por la mañana y no hay ningún campo
 *      que la recoja; acaba en un papel y se pierde.
 *
 * Dos campos y nada más. Lo importante son las reglas de abajo.
 *
 * NO es un estado comercial ni una clasificación. `estado_comercial` dice por
 * dónde va el viaje y `clasificacion` qué tipo de relación es; esto dice si
 * YO me ocupo de él ESTA TEMPORADA. Mezclarlo con los otros dos haría que
 * aparcar a alguien cambiara su embudo, y entonces los informes mentirían.
 */

// Con extensión, para que Node ejecute los tests sin compilar nada.
import type { LuzCliente } from './luz.ts';
import type { ItemAgenda } from './agenda.ts';

/** Hoy en ISO corto, en hora local. Las fechas de la BD son `date`, sin zona. */
export function hoyISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Campos que añade `supabase_foco_dia.sql`. Opcionales: sin el SQL no existen. */
export interface CamposFoco {
  /** false = apartado del seguimiento. Por defecto true: nadie nace apartado. */
  seguimiento_activo?: boolean | null;
  /** Hasta cuándo está apartado. Null = sin fecha, hasta que alguien lo reactive. */
  pausado_hasta?: string | null;
  /** Por qué se apartó. Obligatorio en la pantalla, ver abajo. */
  motivo_pausa?: string | null;
  /** A quién se le fija en su día. Un nombre de responsable, no un booleano. */
  fijado_para?: string | null;
}

export type ClienteFoco = LuzCliente & CamposFoco;

export interface Pausa {
  /** Está apartado HOY. Es lo único que mira el resto del código. */
  pausado: boolean;
  hasta: string | null;
  motivo: string | null;
  /**
   * Estaba apartado con fecha y la fecha ya pasó: vuelve solo.
   *
   * Es la diferencia entre aparcar y olvidar. Una pausa sin fecha necesita que
   * alguien se acuerde de reactivarla, y nadie se acuerda: a los tres meses la
   * cartera «activa» son cuatro nombres y el resto está en un limbo que nadie
   * revisa. Con fecha, el cliente reaparece solo el día que toca, y eso se
   * dice en pantalla para que no parezca que ha salido de la nada.
   */
  vuelveSolo: boolean;
}

const SIN_PAUSA: Pausa = { pausado: false, hasta: null, motivo: null, vuelveSolo: false };

/**
 * Cómo está hoy el seguimiento de un cliente.
 *
 * La fecha MANDA sobre la marca. Si alguien apartó a un cliente hasta el 1 de
 * marzo, el 2 de marzo está activo aunque la casilla siga puesta: lo contrario
 * sería guardar una fecha y no hacerle caso, que es peor que no guardarla.
 */
export function pausaDe(c: ClienteFoco | null | undefined, hoy = hoyISO()): Pausa {
  if (!c) return SIN_PAUSA;
  // `undefined` es «la columna no existe todavía» (SQL sin ejecutar) y
  // `true` es activo: los dos significan lo mismo aquí, y por eso se compara
  // contra false explícito en vez de mirar si es verdadero.
  if (c.seguimiento_activo !== false) return SIN_PAUSA;
  const hasta = c.pausado_hasta || null;
  const caducada = !!hasta && hasta < hoy;
  return {
    pausado: !caducada,
    hasta,
    motivo: c.motivo_pausa || null,
    vuelveSolo: caducada,
  };
}

export const estaPausado = (c: ClienteFoco | null | undefined, hoy = hoyISO()): boolean =>
  pausaDe(c, hoy).pausado;

/**
 * ¿Está fijado para la persona que mira?
 *
 * Se guarda el NOMBRE y no un sí/no porque el día es de alguien: lo que David
 * decide apretar hoy no tiene por qué salirle a Nicola en su pantalla. Admite
 * «Marcos / David» por lo mismo que `esDe` en la agenda: hay clientes que
 * lleva más de uno.
 */
export function estaFijadoPara(c: ClienteFoco | null | undefined, persona: string | null): boolean {
  if (!c || !persona || !c.fijado_para) return false;
  const p = persona.trim().toLowerCase();
  return c.fijado_para.split('/').map((s) => s.trim().toLowerCase()).includes(p);
}

export interface CarteraPartida<T> {
  /** Lo que se trabaja. */
  activo: T[];
  /** Lo de los clientes apartados. No se borra: se aparta y se cuenta. */
  pausado: T[];
}

/**
 * Parte cualquier lista que cuelgue de un cliente (líneas de agenda, fichas)
 * en lo de la cartera viva y lo de la apartada.
 *
 * Lo que NO tiene cliente se queda SIEMPRE en lo activo. Una tarea suelta sin
 * cliente no la ha apartado nadie, y esconderla por no saber de quién es sería
 * perderla en silencio — justo lo que esto viene a evitar.
 */
export function partirPorPausa<T extends { clienteId?: string | null }>(
  items: T[], clientes: ClienteFoco[], hoy = hoyISO()
): CarteraPartida<T> {
  const pausados = new Set(clientes.filter((c) => estaPausado(c, hoy)).map((c) => c.id));
  const activo: T[] = [];
  const pausado: T[] = [];
  for (const i of items) {
    (i.clienteId && pausados.has(i.clienteId) ? pausado : activo).push(i);
  }
  return { activo, pausado };
}

/** Atajo con el tipo de la agenda, que es donde más se usa. */
export const partirAgendaPorPausa = (
  items: ItemAgenda[], clientes: ClienteFoco[], hoy = hoyISO()
): CarteraPartida<ItemAgenda> => partirPorPausa(items, clientes, hoy);

/**
 * Los que una persona ha fijado para su día, y que NO están apartados.
 *
 * Apartado gana a fijado a propósito: si alguien aparta a un cliente que tenía
 * fijado, lo último que dijo es «este no», y dejarlo arriba sería desobedecer
 * la decisión más reciente. Se ordena por prioridad y nombre para que la lista
 * salga siempre igual y se reconozca de memoria.
 */
export function fijadosDe(
  clientes: ClienteFoco[], persona: string | null, hoy = hoyISO()
): ClienteFoco[] {
  const peso: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
  return clientes
    .filter((c) => estaFijadoPara(c, persona) && !estaPausado(c, hoy))
    .sort((a, b) =>
      (peso[a.prioridad] ?? 2) - (peso[b.prioridad] ?? 2)
      || a.nombre.localeCompare(b.nombre, 'es'));
}

/** Motivos que se ofrecen al apartar. Son los que se dicen en voz alta aquí. */
export const MOTIVOS_PAUSA = [
  'Acaba de renovar, no toca hasta el vencimiento',
  'Pidió que no le llamáramos por ahora',
  'Está en obras / parado el negocio',
  'No contesta: se deja descansar',
  'Lo lleva otro de momento',
];

/**
 * Cuánto se aparta, en días. `null` es sin fecha, y va el último a propósito:
 * una pausa sin fecha hay que acordarse de levantarla, y nadie se acuerda.
 */
export const PLAZOS_PAUSA: { dias: number | null; titulo: string }[] = [
  { dias: 30, titulo: '1 mes' },
  { dias: 90, titulo: '3 meses' },
  { dias: 180, titulo: '6 meses' },
  { dias: 365, titulo: '1 año' },
  { dias: null, titulo: 'Sin fecha' },
];

/** La fecha hasta la que se aparta, o null si es sin fecha. */
export function fechaHasta(dias: number | null, desde: Date = new Date()): string | null {
  if (dias == null) return null;
  const d = new Date(desde);
  d.setDate(d.getDate() + dias);
  return hoyISO(d);
}

/**
 * Lo que se manda al guardar. Se deja junto a la lógica para que la pantalla
 * no se invente los campos: apartar sin motivo es lo mismo que aplazar sin
 * motivo, y al mes la lista de apartados no significa nada.
 */
export function cambioPausa(motivo: string, dias: number | null, desde?: Date): CamposFoco {
  return {
    seguimiento_activo: false,
    pausado_hasta: fechaHasta(dias, desde),
    motivo_pausa: motivo.trim(),
  };
}

/** Volver a seguirlo: se limpia todo, no queda media pausa colgando. */
export const cambioReactivar = (): CamposFoco => ({
  seguimiento_activo: true,
  pausado_hasta: null,
  motivo_pausa: null,
});

/**
 * Fijar o soltar. Al fijar se guarda la persona; al soltar se pone a null y no
 * a cadena vacía, porque el API convierte '' en null igual pero el null
 * explícito dice lo que se quiere.
 */
export const cambioFijar = (persona: string | null): CamposFoco => ({
  fijado_para: persona || null,
});
