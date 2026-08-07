/**
 * AGENDA UNIFICADA: una sola lista de "qué hay que hacer y cuándo".
 *
 * Antes esto estaba partido en dos pantallas que se solapaban:
 *  - "Tareas y Alertas": cosas que alguien debe hacer.
 *  - "Fechas Críticas": una mezcla de dos cosas distintas —
 *      (a) fin de contrato / fin de permanencia / límite de preaviso, que YA
 *          están guardados en el propio CUPS y se copiaban a mano a otra tabla
 *          (y se quedaban desfasados si luego cambiaba el contrato), y
 *      (b) recordatorios de acciones (seguir una oferta, reclamar una firma,
 *          confirmar una activación) que ya existían como tipos de tarea.
 *
 * Ahora:
 *  - Las fechas del tipo (a) NO se guardan: se CALCULAN en vivo desde el CUPS
 *    cada vez que se abre la agenda. Imposible que se desincronicen, cero
 *    mantenimiento, y si Nicola renueva un contrato el aviso se corrige solo.
 *  - Todo lo demás (tareas reales y fechas críticas ya creadas a mano) se
 *    muestra en la misma lista, ordenado por urgencia.
 */

// Con extensión y separando los tipos, para que Node ejecute este archivo tal
// cual en los tests sin compilar nada (igual que en bandeja.ts y prospeccion.ts).
import type { LuzTarea, LuzCups, LuzFechaCritica, LuzOportunidad } from './luz.ts';
import {
  TIPO_TAREA_LABEL, TIPO_FECHA_LABEL, TIPO_FECHA_TONO,
  ESTADO_PIPELINE_LABEL, ESTADO_PIPELINE_TONO, PIPELINE_ABIERTO_SIN_REVISAR,
  TAREAS_ABIERTAS, diasHasta, normCups,
} from './luz.ts';

/** De dónde sale cada línea de la agenda. */
export type OrigenAgenda = 'tarea' | 'contrato' | 'fecha';

export type UrgenciaAgenda = 'vencido' | 'hoy' | 'semana' | 'mes' | 'lejano' | 'sin_fecha';

export interface ItemAgenda {
  /** Clave estable y única; las derivadas no tienen fila propia en la BD. */
  clave: string;
  origen: OrigenAgenda;
  /** id real en la BD (null en las derivadas del CUPS: no existen como fila). */
  id: string | null;
  tipo: string;
  tipoLabel: string;
  tono: string;
  titulo: string;
  detalle: string | null;
  fecha: string | null;
  dias: number | null;
  urgencia: UrgenciaAgenda;
  prioridad: string;
  responsable: string | null;
  estado: string;
  clienteId: string | null;
  clienteNombre: string | null;
  cupsId: string | null;
  cupsTexto: string | null;
  /** Las derivadas no se editan en la agenda: se corrigen en la ficha del CUPS. */
  editable: boolean;
  /**
   * Cuándo ENTRÓ esto en el sistema, que no es lo mismo que cuándo vence.
   * Es lo que permite ordenar por orden de llegada: lo que lleva más tiempo
   * esperando va primero y nada se queda enterrado bajo lo recién metido.
   * En las derivadas del CUPS no hay fila propia, así que se usa el alta del
   * suministro: es el momento en que ese aviso pasó a existir.
   */
  alta: string | null;
  /** En qué punto del embudo está ese cliente. Mismo estado y color que el Pipeline. */
  estadoPipeline?: string | null;
  estadoPipelineLabel?: string | null;
  estadoPipelineTono?: string | null;
}

const TONO_TAREA = 'bg-secondary/15 text-secondary border-secondary/30';

export function urgenciaDe(dias: number | null): UrgenciaAgenda {
  if (dias == null) return 'sin_fecha';
  if (dias < 0) return 'vencido';
  if (dias === 0) return 'hoy';
  if (dias <= 7) return 'semana';
  if (dias <= 31) return 'mes';
  return 'lejano';
}

export const URGENCIA_LABEL: Record<UrgenciaAgenda, string> = {
  vencido: 'Fuera de plazo', hoy: 'Para hoy', semana: 'Esta semana',
  mes: 'Este mes', lejano: 'Más adelante', sin_fecha: 'Sin fecha',
};

export const URGENCIA_TONO: Record<UrgenciaAgenda, string> = {
  vencido: 'bg-red-500/15 text-red-400 border-red-500/30',
  hoy: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  semana: 'bg-secondary/15 text-secondary border-secondary/30',
  mes: 'bg-card/80 text-muted border-border/50',
  lejano: 'bg-card/60 text-muted/70 border-border/30',
  sin_fecha: 'bg-card/60 text-muted/70 border-border/30',
};

/** Orden de presentación: primero lo que arde. */
export const ORDEN_URGENCIA: UrgenciaAgenda[] = ['vencido', 'hoy', 'semana', 'mes', 'sin_fecha', 'lejano'];

/** Tareas abiertas → líneas de agenda. */
export function itemsDeTareas(tareas: LuzTarea[]): ItemAgenda[] {
  return tareas
    .filter((t) => TAREAS_ABIERTAS.includes(t.estado))
    .map((t) => {
      const dias = diasHasta(t.fecha_limite);
      return {
        clave: `tarea:${t.id}`,
        origen: 'tarea' as const,
        id: t.id,
        tipo: t.tipo_tarea,
        tipoLabel: TIPO_TAREA_LABEL[t.tipo_tarea] || t.tipo_tarea,
        tono: TONO_TAREA,
        titulo: t.descripcion,
        detalle: t.notas || null,
        fecha: t.fecha_limite,
        dias,
        urgencia: urgenciaDe(dias),
        prioridad: t.prioridad || 'C',
        responsable: t.responsable,
        estado: t.estado,
        clienteId: t.cliente_id,
        clienteNombre: t.luz_clientes?.nombre || null,
        cupsId: t.cups_id,
        cupsTexto: null,
        editable: true,
        alta: t.creado_en || null,
      };
    });
}

/**
 * Fechas críticas DERIVADAS del CUPS — el corazón del arreglo.
 *
 * No leen ninguna tabla de fechas: salen directamente de los campos del
 * suministro, así que siempre reflejan la realidad actual del contrato.
 * Se ignoran los CUPS ya cerrados (perdido / no viable) y las fechas que
 * quedan muy lejos, para no llenar la agenda de ruido.
 */
export function itemsDeCups(cups: LuzCups[], horizonteDias = 180): ItemAgenda[] {
  const items: ItemAgenda[] = [];
  const campos: [string, keyof LuzCups, string][] = [
    ['fin_contrato', 'fecha_fin_contrato', 'Vence el contrato'],
    ['fin_permanencia', 'fecha_fin_permanencia', 'Acaba la permanencia'],
    ['limite_preaviso', 'fecha_limite_preaviso', 'Último día para preavisar'],
  ];

  for (const c of cups) {
    if (['perdido', 'no_viable', 'activado'].includes(c.estado_cups)) continue;
    for (const [tipo, campo, texto] of campos) {
      const fecha = c[campo] as string | null;
      if (!fecha) continue;
      const dias = diasHasta(fecha);
      if (dias != null && dias > horizonteDias) continue;

      const nombre = c.luz_clientes?.nombre || 'Cliente';
      items.push({
        clave: `cups:${c.id}:${tipo}`,
        origen: 'contrato',
        id: null,
        tipo,
        tipoLabel: TIPO_FECHA_LABEL[tipo] || tipo,
        tono: TIPO_FECHA_TONO[tipo] || TONO_TAREA,
        // El nombre del cliente NO va aquí: viaja en `clienteNombre` para que
        // cada pantalla decida cuánto lo destaca (en Mi Día es el titular).
        titulo: texto,
        detalle: [c.comercializadora_actual, c.alias_suministro].filter(Boolean).join(' · ') || null,
        fecha,
        dias,
        urgencia: urgenciaDe(dias),
        prioridad: c.prioridad || c.luz_clientes?.prioridad || 'C',
        responsable: c.responsable,
        estado: 'pendiente',
        clienteId: c.cliente_id,
        clienteNombre: nombre,
        cupsId: c.id,
        cupsTexto: c.cups ? normCups(c.cups) : null,
        editable: false,
        alta: c.creado_en || null,
      });
    }
  }
  return items;
}

/**
 * Fechas críticas guardadas a mano que siguen teniendo sentido.
 * Se descartan las de los tres tipos que ahora se calculan solos: esas ya
 * vienen del CUPS y mostrarlas otra vez sería duplicar (y, si el contrato
 * cambió, mostrar además el dato viejo).
 */
export const TIPOS_FECHA_DERIVADOS: string[] = ['fin_contrato', 'fin_permanencia', 'limite_preaviso'];

export function itemsDeFechasManuales(fechas: LuzFechaCritica[]): ItemAgenda[] {
  return fechas
    .filter((f) => f.estado === 'pendiente' && !TIPOS_FECHA_DERIVADOS.includes(f.tipo_fecha))
    .map((f) => {
      const dias = diasHasta(f.fecha);
      return {
        clave: `fecha:${f.id}`,
        origen: 'fecha' as const,
        id: f.id,
        tipo: f.tipo_fecha,
        tipoLabel: TIPO_FECHA_LABEL[f.tipo_fecha] || f.tipo_fecha,
        tono: TIPO_FECHA_TONO[f.tipo_fecha] || TONO_TAREA,
        titulo: f.titulo,
        detalle: f.descripcion,
        fecha: f.fecha,
        dias,
        urgencia: urgenciaDe(dias),
        prioridad: f.prioridad || 'C',
        responsable: f.responsable,
        estado: f.estado,
        clienteId: f.cliente_id,
        clienteNombre: f.luz_clientes?.nombre || null,
        cupsId: f.cups_id,
        cupsTexto: null,
        editable: true,
        alta: f.creado_en || null,
      };
    });
}

/** Prioridad A pesa más que D cuando dos cosas vencen el mismo día. */
const PESO_PRIORIDAD: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

/**
 * Cuelga a cada línea el estado del embudo de su cliente, con la misma
 * etiqueta y el mismo color que se ven en el Pipeline. Así, mirando la
 * agenda, se sabe de un vistazo en qué punto está cada uno sin tener que
 * cambiar de pantalla.
 *
 * Se busca primero la oportunidad de ESE suministro y, si no hay, la del
 * cliente. Manda la abierta: una oportunidad viva describe mejor dónde
 * está el cliente hoy que una que ya se cerró hace meses.
 */
export function conEstadoPipeline(items: ItemAgenda[], pipeline: LuzOportunidad[]): ItemAgenda[] {
  if (!pipeline || pipeline.length === 0) return items;

  const abierta = (o: LuzOportunidad) => !PIPELINE_ABIERTO_SIN_REVISAR.includes(o.estado);
  const elegir = (candidatas: LuzOportunidad[]) =>
    candidatas.find(abierta) || candidatas[0] || null;

  const porCups = new Map<string, LuzOportunidad[]>();
  const porCliente = new Map<string, LuzOportunidad[]>();
  for (const o of pipeline) {
    if (o.cups_id) porCups.set(o.cups_id, [...(porCups.get(o.cups_id) || []), o]);
    if (o.cliente_id) porCliente.set(o.cliente_id, [...(porCliente.get(o.cliente_id) || []), o]);
  }

  return items.map((i) => {
    const op = (i.cupsId && elegir(porCups.get(i.cupsId) || []))
      || (i.clienteId && elegir(porCliente.get(i.clienteId) || []))
      || null;
    if (!op) return i;
    return {
      ...i,
      estadoPipeline: op.estado,
      estadoPipelineLabel: ESTADO_PIPELINE_LABEL[op.estado] || op.estado,
      estadoPipelineTono: ESTADO_PIPELINE_TONO[op.estado] || ESTADO_PIPELINE_TONO.prospecto,
    };
  });
}

/** Monta la agenda completa, ya ordenada: lo más urgente y más prioritario arriba. */
export function construirAgenda(e: {
  tareas: LuzTarea[];
  cups: LuzCups[];
  fechas: LuzFechaCritica[];
  /** Opcional: si se pasa, cada línea llevará el estado del embudo de su cliente. */
  pipeline?: LuzOportunidad[];
  horizonteDias?: number;
}): ItemAgenda[] {
  const base = [
    ...itemsDeTareas(e.tareas),
    ...itemsDeCups(e.cups, e.horizonteDias),
    ...itemsDeFechasManuales(e.fechas),
  ];
  return conEstadoPipeline(base, e.pipeline || []).sort((a, b) => {
    const ua = ORDEN_URGENCIA.indexOf(a.urgencia);
    const ub = ORDEN_URGENCIA.indexOf(b.urgencia);
    if (ua !== ub) return ua - ub;
    if (a.dias != null && b.dias != null && a.dias !== b.dias) return a.dias - b.dias;
    return (PESO_PRIORIDAD[a.prioridad] ?? 2) - (PESO_PRIORIDAD[b.prioridad] ?? 2);
  });
}

/** ¿Le toca a esta persona? Soporta responsables compartidos tipo "Marcos / David". */
export function esDe(responsable: string | null, persona: string): boolean {
  if (!responsable) return false;
  const p = persona.trim().toLowerCase();
  return responsable.split('/').map((s) => s.trim().toLowerCase()).includes(p)
    || responsable.trim().toLowerCase() === p;
}

/** Recuento por urgencia, para las pastillas de arriba. */
export function resumenAgenda(items: ItemAgenda[]): Record<UrgenciaAgenda, number> {
  const base = { vencido: 0, hoy: 0, semana: 0, mes: 0, lejano: 0, sin_fecha: 0 } as Record<UrgenciaAgenda, number>;
  for (const i of items) base[i.urgencia]++;
  return base;
}

/* ────────────────────────────────────────────────────────────────────────
   EL DÍA NO ES LA CARTERA: APARTAR LO VIEJO Y ELEGIR EL ORDEN

   Mi Día juntaba «vencido» y «de hoy» en una sola lista porque para quien
   está en la calle son lo mismo: las dos hay que hacerlas. Con una cartera
   pequeña eso funcionaba. Con la de julio de 2026 dejó de funcionar: la
   importación creó 74 líneas de golpe para el comercial, y el número grande
   de la pantalla —el que existe para decir «esto es lo de hoy»— pasó a
   marcar 74 cuando el ritmo demostrado son 9 puertas al día.

   Un número que no se puede hacer no se prioriza: se ignora. Y en cuanto se
   ignora uno, se ignoran todos, incluido el día que de verdad son tres cosas.

   Así que el día se parte en dos, y hay que tener cuidado con qué significa
   «viejo». Medido sobre la cartera real: NADA pasaba de 17 días de retraso,
   así que un corte a 30 días apartaba 1 línea de 74 y no arreglaba nada. El
   corte útil está bastante más abajo, y por eso se elige desde la pantalla
   en vez de quedar clavado aquí: el número correcto depende de cuánta
   cartera haya entrado de golpe, y eso cambia.
   ──────────────────────────────────────────────────────────────────────── */

/** Cortes que se ofrecen en la pantalla, en días de retraso. */
export const UMBRALES_ATRASO = [3, 7, 14, 30] as const;

export type ModoOrden = 'entrada' | 'urgencia';

export const MODO_ORDEN_LABEL: Record<ModoOrden, string> = {
  entrada: 'Por orden de llegada',
  urgencia: 'Por urgencia',
};

/**
 * Compara por ANTIGÜEDAD DE ENTRADA: lo que lleva más tiempo esperando, primero.
 *
 * Es el orden por defecto y no es un capricho de presentación. Ordenar por
 * prioridad hace que un cliente A recién metido adelante todos los días a uno
 * que lleva tres semanas esperando, y ese segundo no sale nunca: cada mañana
 * hay un A nuevo. Por orden de llegada la cola avanza — lo viejo sube solo
 * según lo de delante se va cerrando, sin que nadie tenga que acordarse.
 *
 * Sin fecha de alta van al final: no se sabe cuándo entraron, así que no
 * pueden reclamar antigüedad, pero tampoco se pierden.
 */
function porEntrada(a: ItemAgenda, b: ItemAgenda): number {
  if (a.alta && b.alta && a.alta !== b.alta) return a.alta < b.alta ? -1 : 1;
  if (a.alta && !b.alta) return -1;
  if (!a.alta && b.alta) return 1;
  // Empate real (mismo alta, típico de una importación): manda lo más vencido.
  return (a.dias ?? 99) - (b.dias ?? 99);
}

/** Compara por urgencia: cliente A primero y, dentro, lo más vencido. */
function porUrgencia(a: ItemAgenda, b: ItemAgenda): number {
  return (PESO_PRIORIDAD[a.prioridad] ?? 2) - (PESO_PRIORIDAD[b.prioridad] ?? 2)
    || (a.dias ?? 99) - (b.dias ?? 99);
}

/** Ordena una lista del día con el criterio elegido. No muta la original. */
export function ordenarDia(items: ItemAgenda[], modo: ModoOrden = 'entrada'): ItemAgenda[] {
  return [...items].sort(modo === 'entrada' ? porEntrada : porUrgencia);
}

export interface DiaPartido {
  /** Lo que se enseña arriba: vence hoy o lleva poco esperando. */
  activo: ItemAgenda[];
  /** Lo que lleva más de `umbral` días de retraso. No se borra: se aparta. */
  aparcado: ItemAgenda[];
}

/**
 * Parte lo de hoy (vencido + de hoy) en lo que se trabaja y lo aparcado.
 *
 * Solo se aparta lo que ARRASTRA retraso. Lo que vence hoy nunca se aparta,
 * por viejo que sea el registro: hoy es su día y apartarlo sería justo el
 * fallo que esto viene a evitar.
 *
 * `umbral` es el retraso máximo que se queda arriba: con 7, algo con 8 días
 * de retraso se aparca y algo con 7 se queda.
 */
export function partirPorAtraso(
  items: ItemAgenda[], umbral: number, modo: ModoOrden = 'entrada'
): DiaPartido {
  const activo: ItemAgenda[] = [];
  const aparcado: ItemAgenda[] = [];
  for (const i of items) {
    // `dias` es negativo cuando va con retraso, así que el retraso es -dias.
    const retraso = i.dias == null ? 0 : -i.dias;
    (retraso > umbral ? aparcado : activo).push(i);
  }
  return { activo: ordenarDia(activo, modo), aparcado: ordenarDia(aparcado, modo) };
}
