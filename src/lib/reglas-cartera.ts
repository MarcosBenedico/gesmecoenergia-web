/**
 * LA REGLA MADRE: NINGÚN EXPEDIENTE ABIERTO SIN SIGUIENTE ACCIÓN.
 *
 * El análisis operativo la llama así y es la única regla de la que cuelgan
 * todas las demás. Un expediente abierto sin responsable, sin acción concreta
 * y sin fecha no está en el sistema: está en la memoria de alguien.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * EL PROBLEMA CONCRETO QUE RESUELVE ESTE ARCHIVO
 *
 * Hoy `proxima_accion` es un campo de TEXTO LIBRE en `luz_clientes` y otro en
 * `luz_pipeline`. Al lado existe `luz_tareas`, con responsable, fecha límite y
 * estado. Son dos sitios para lo mismo, y cuando dos sitios dicen lo mismo
 * acaban diciendo cosas distintas:
 *
 *     La ficha pone «llamar mañana». La tarea real venció hace ocho días.
 *
 * Nadie miente: uno se actualizó y el otro no. Pero quien abre la ficha se
 * queda tranquilo y el cliente se cae.
 *
 * LA DECISIÓN: LA TAREA MANDA, EL CAMPO SE CONSERVA.
 *
 * `proximaAccionReal` sale SIEMPRE de la tarea abierta más urgente. El campo
 * de texto no se borra —hay cientos de fichas con notas escritas ahí y borrarlo
 * sería tirar información— pero deja de mandar: pasa a ser una nota, y cuando
 * contradice a la tarea, se dice en pantalla.
 *
 * No se migra nada automáticamente. El documento es explícito: «no realizar
 * una migración masiva de estados ni activar automatizaciones con datos reales
 * sin mostrar antes el mapeo». Esto detecta y avisa; corregir lo decide una
 * persona.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { TAREAS_ABIERTAS } from './luz.ts';

/** Una tarea, en lo mínimo que hace falta para razonar sobre ella. */
export interface TareaMin {
  id?: string;
  descripcion?: string | null;
  fecha_limite?: string | null;
  estado?: string | null;
  responsable?: string | null;
  cliente_id?: string | null;
  cups_id?: string | null;
  pipeline_id?: string | null;
}

export interface AccionCalculada {
  texto: string;
  fecha: string | null;
  dias: number | null;
  responsable: string | null;
  /** La tarea está bloqueada: no se puede hacer hasta desbloquearla. */
  bloqueada: boolean;
  tareaId: string | null;
}

/** Días desde hoy hasta una fecha. Negativo si ya pasó. */
export function dias(fecha: string | null | undefined, hoy: string): number | null {
  if (!fecha) return null;
  const a = new Date(`${String(fecha).slice(0, 10)}T00:00:00`);
  const b = new Date(`${hoy.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

export const estaAbierta = (t: TareaMin) => !t.estado || TAREAS_ABIERTAS.includes(t.estado);

/**
 * La próxima acción de verdad: la tarea abierta más urgente del contexto.
 *
 * Ordena por fecha y, a igualdad, deja delante la que NO está bloqueada — una
 * bloqueada no se puede hacer, así que como «lo siguiente que toca» es peor
 * candidata que una que sí se puede hacer hoy.
 */
export function proximaAccionReal(tareas: TareaMin[], hoy: string): AccionCalculada | null {
  const abiertas = tareas.filter(estaAbierta);
  if (!abiertas.length) return null;

  const ordenadas = [...abiertas].sort((a, b) => {
    const fa = a.fecha_limite || '9999-12-31';
    const fb = b.fecha_limite || '9999-12-31';
    if (fa !== fb) return fa.localeCompare(fb);
    return Number(a.estado === 'bloqueada') - Number(b.estado === 'bloqueada');
  });

  const t = ordenadas[0];
  return {
    texto: t.descripcion || 'Tarea sin descripción',
    fecha: t.fecha_limite || null,
    dias: dias(t.fecha_limite, hoy),
    responsable: t.responsable || null,
    bloqueada: t.estado === 'bloqueada',
    tareaId: t.id || null,
  };
}

// ── Excepciones válidas a la regla madre ────────────────────────────────────

/**
 * Los únicos estados en los que un expediente puede estar sin próxima acción.
 *
 * El documento los enumera: ganado/activo sin seguimiento, perdido con motivo,
 * pospuesto con fecha de reactivación, archivado. Fuera de esta lista, no
 * tener acción es un fallo de control, no una situación.
 */
export const ESTADOS_SIN_ACCION_OK = [
  'ganado', 'activo', 'activado', 'perdido', 'no_viable',
  'revisar_adelante', 'pendiente_permanencia',
];

export interface Expediente {
  id: string;
  /** Cómo se llama en pantalla: nombre del cliente, alias del CUPS... */
  nombre: string;
  tipo: 'cliente' | 'suministro' | 'oportunidad' | 'contrato';
  estado: string;
  responsable?: string | null;
  /** Texto libre de `proxima_accion`. Es una nota, no manda. */
  accionManual?: string | null;
  fechaAccionManual?: string | null;
  tareas: TareaMin[];
  /** Última señal de vida: apunte, visita, actualización. */
  ultimaActividad?: string | null;
  /** Para los pospuestos: sin fecha de reactivación no es una excepción. */
  fechaReactivacion?: string | null;
  /** Para los perdidos: sin motivo tampoco. */
  motivo?: string | null;
}

/**
 * ¿Puede este expediente estar legítimamente sin próxima acción?
 *
 * «Pospuesto» sin fecha de reactivación NO es una excepción válida: es un
 * olvido con nombre bonito. Igual que «perdido» sin motivo — el documento
 * pide motivo registrado, y sin él no se puede aprender nada de la pérdida.
 */
export function excepcionValida(e: Expediente): boolean {
  if (!ESTADOS_SIN_ACCION_OK.includes(e.estado)) return false;
  if (e.estado === 'revisar_adelante' || e.estado === 'pendiente_permanencia') {
    return !!e.fechaReactivacion;
  }
  if (e.estado === 'perdido' || e.estado === 'no_viable') return !!e.motivo;
  return true;
}

export type TipoIncidencia =
  | 'sin_accion'
  | 'sin_responsable'
  | 'accion_vencida'
  | 'contradiccion'
  | 'bloqueada'
  | 'sin_actividad'
  | 'pospuesto_sin_fecha'
  | 'perdido_sin_motivo';

export interface Incidencia {
  tipo: TipoIncidencia;
  expedienteId: string;
  nombre: string;
  tipoExpediente: Expediente['tipo'];
  /** Qué pasa, escrito. */
  texto: string;
  /** Qué hay que hacer para quitarlo. */
  arreglo: string;
  responsable: string | null;
  /** Se puede perder algo por esto. */
  critica: boolean;
}

/**
 * Días sin actividad a partir de los cuales se avisa, por etapa.
 *
 * El documento los propone y son distintos a propósito: tres días parado en un
 * contrato es mucho —hay una firma esperando— y catorce en captación es normal.
 * Un único umbral para todo hace que o se llene de ruido o se calle donde
 * importa.
 */
export const DIAS_SIN_ACTIVIDAD: Record<string, number> = {
  contrato: 3,
  oportunidad: 7,
  suministro: 7,
  cliente: 14,
};

/**
 * Las incidencias de higiene de la cartera.
 *
 * Es lo que Dirección abre por la mañana. Cada una dice qué pasa, qué hacer y
 * de quién es — sin responsable no se puede reclamar nada, y una lista que no
 * se puede reclamar es una lista que no se mira.
 */
export function incidenciasDe(e: Expediente, hoy: string): Incidencia[] {
  const salida: Incidencia[] = [];
  const base = {
    expedienteId: e.id, nombre: e.nombre, tipoExpediente: e.tipo,
    responsable: e.responsable || null,
  };

  const accion = proximaAccionReal(e.tareas, hoy);
  const abierto = !ESTADOS_SIN_ACCION_OK.includes(e.estado);

  // ── La regla madre ──
  if (!accion && abierto) {
    salida.push({
      ...base, tipo: 'sin_accion', critica: true,
      texto: 'Expediente abierto sin ninguna acción programada',
      arreglo: 'Crear la siguiente acción con responsable y fecha',
    });
  }

  // Pospuesto sin fecha de reactivación: un olvido con nombre bonito.
  if (!accion && (e.estado === 'revisar_adelante' || e.estado === 'pendiente_permanencia') && !e.fechaReactivacion) {
    salida.push({
      ...base, tipo: 'pospuesto_sin_fecha', critica: true,
      texto: 'Pospuesto y sin fecha de reactivación: no volverá solo',
      arreglo: 'Poner la fecha en que hay que retomarlo',
    });
  }

  if ((e.estado === 'perdido' || e.estado === 'no_viable') && !e.motivo) {
    salida.push({
      ...base, tipo: 'perdido_sin_motivo', critica: false,
      texto: 'Cerrado sin motivo registrado',
      arreglo: 'Anotar por qué se perdió: sin eso no se aprende nada de la pérdida',
    });
  }

  if (abierto && !e.responsable) {
    salida.push({
      ...base, tipo: 'sin_responsable', critica: true,
      texto: 'Expediente abierto sin responsable',
      arreglo: 'Asignar a una persona: «de todos» es «de nadie»',
    });
  }

  if (accion?.dias != null && accion.dias < 0) {
    salida.push({
      ...base, tipo: 'accion_vencida', critica: true,
      responsable: accion.responsable || base.responsable,
      texto: `«${accion.texto}» venció hace ${Math.abs(accion.dias)} ${Math.abs(accion.dias) === 1 ? 'día' : 'días'}`,
      arreglo: 'Hacerla, reprogramarla o cerrarla con resultado',
    });
  }

  if (accion?.bloqueada) {
    salida.push({
      ...base, tipo: 'bloqueada', critica: false,
      responsable: accion.responsable || base.responsable,
      texto: `«${accion.texto}» está bloqueada`,
      arreglo: 'Resolver el bloqueo o cambiar la acción por otra que sí se pueda hacer',
    });
  }

  /**
   * LA CONTRADICCIÓN ENTRE LA NOTA Y LA TAREA.
   *
   * Es el caso que da nombre a este archivo: la ficha dice «llamar mañana» y
   * la tarea real está vencida. No se corrige solo —el documento prohíbe
   * cambiar datos por regla— pero se enseña, que es lo que permite arreglarlo.
   */
  if (e.accionManual?.trim() && accion) {
    const dManual = dias(e.fechaAccionManual, hoy);
    const distintaFecha = dManual != null && accion.dias != null && dManual !== accion.dias;
    const notaTranquila = dManual != null && dManual >= 0;
    const tareaVencida = accion.dias != null && accion.dias < 0;

    if (tareaVencida && notaTranquila) {
      salida.push({
        ...base, tipo: 'contradiccion', critica: true,
        texto: `La ficha dice «${e.accionManual.trim()}» para ${accion.dias === null ? 'más adelante' : 'una fecha futura'}, pero la tarea real venció hace ${Math.abs(accion.dias!)} días`,
        arreglo: 'Manda la tarea. Actualiza la nota o reprograma la tarea',
      });
    } else if (distintaFecha) {
      salida.push({
        ...base, tipo: 'contradiccion', critica: false,
        texto: 'La fecha escrita en la ficha no coincide con la de la tarea',
        arreglo: 'La tarea es la que vale: la nota de la ficha conviene actualizarla',
      });
    }
  }

  const dInactivo = dias(e.ultimaActividad, hoy);
  const umbral = DIAS_SIN_ACTIVIDAD[e.tipo] ?? 14;
  if (abierto && dInactivo != null && -dInactivo > umbral) {
    salida.push({
      ...base, tipo: 'sin_actividad', critica: false,
      texto: `${-dInactivo} días sin ninguna actividad`,
      arreglo: `En ${e.tipo === 'contrato' ? 'un contrato' : 'esta etapa'} se considera parado a partir de ${umbral} días`,
    });
  }

  return salida;
}

// ── La vista de excepciones de Dirección ────────────────────────────────────

export interface BloqueControl {
  tipo: TipoIncidencia;
  titulo: string;
  /** La pregunta que contesta. El documento pide que cada bloque tenga una. */
  pregunta: string;
  incidencias: Incidencia[];
}

/**
 * Los bloques del Control de Dirección, en orden de lo que se puede perder.
 *
 * El documento lo pide como VISTA DE EXCEPCIONES, no de actividad total: aquí
 * solo entra lo que está mal. Y cada bloque se abre a su lista exacta, porque
 * un número sin lista detrás no se puede accionar — es la misma lección del
 * Dashboard.
 */
export const BLOQUES_CONTROL: { tipo: TipoIncidencia; titulo: string; pregunta: string }[] = [
  { tipo: 'accion_vencida', titulo: 'Tareas vencidas', pregunta: '¿Qué no se hizo a tiempo y quién lo tiene?' },
  { tipo: 'contradiccion', titulo: 'La ficha y la tarea no dicen lo mismo', pregunta: '¿Dónde nos estamos quedando tranquilos sin motivo?' },
  { tipo: 'sin_accion', titulo: 'Abiertos sin próxima acción', pregunta: '¿Qué se puede perder por falta de seguimiento?' },
  { tipo: 'sin_responsable', titulo: 'Sin responsable', pregunta: '¿De quién es esto?' },
  { tipo: 'pospuesto_sin_fecha', titulo: 'Pospuestos sin fecha', pregunta: '¿Qué hemos aparcado y no volverá solo?' },
  { tipo: 'bloqueada', titulo: 'Bloqueadas', pregunta: '¿Qué necesita que alguien desatasque?' },
  { tipo: 'sin_actividad', titulo: 'Parados demasiado tiempo', pregunta: '¿Qué lleva semanas sin moverse?' },
  { tipo: 'perdido_sin_motivo', titulo: 'Cerrados sin motivo', pregunta: '¿De qué pérdidas no estamos aprendiendo nada?' },
];

export function controlDireccion(expedientes: Expediente[], hoy: string): BloqueControl[] {
  const todas = expedientes.flatMap((e) => incidenciasDe(e, hoy));
  return BLOQUES_CONTROL
    .map((b) => ({ ...b, incidencias: todas.filter((i) => i.tipo === b.tipo) }))
    // Un bloque vacío es una buena noticia, no una fila que ocupe sitio.
    .filter((b) => b.incidencias.length > 0);
}

/** Cuántas incidencias tiene cada responsable, para poder repartir. */
export function porResponsable(expedientes: Expediente[], hoy: string) {
  const m = new Map<string, { criticas: number; total: number }>();
  for (const e of expedientes) {
    for (const i of incidenciasDe(e, hoy)) {
      const quien = i.responsable || 'Sin asignar';
      const v = m.get(quien) || { criticas: 0, total: 0 };
      v.total++;
      if (i.critica) v.criticas++;
      m.set(quien, v);
    }
  }
  return [...m.entries()]
    .map(([responsable, v]) => ({ responsable, ...v }))
    .sort((a, b) => b.criticas - a.criticas || b.total - a.total);
}
