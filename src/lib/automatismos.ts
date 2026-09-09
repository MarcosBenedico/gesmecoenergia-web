/**
 * AUTOMATIZACIONES DE FASE — reglas, no inteligencia.
 *
 * El análisis operativo lo pide con una condición que manda sobre todo lo
 * demás: «todas deben ser idempotentes: ejecutar dos veces no puede crear dos
 * tareas iguales». Y una lista de lo que NO se debe hacer que es igual de
 * importante que la de lo que sí:
 *
 *   · No cambiar una etapa comercial porque pasó el tiempo. Crear una alerta,
 *     nunca inventar un resultado.
 *   · No cerrar tareas solas si no hay evidencia de acción.
 *   · No crear una tarea cada día de retraso.
 *   · No tocar precios, ofertas, contratos, titularidad ni comercializadora.
 *
 * CÓMO SE CONSIGUE LA IDEMPOTENCIA SIN TOCAR LA BASE DE DATOS
 *
 * No hace falta una columna nueva ni un registro de ejecuciones: los vínculos
 * que la tarea ya lleva bastan. Pero la llave NO puede ser solo el par
 * (vínculo, tipo de tarea), y esto costó un repaso entero:
 *
 *   UNA LLAVE PERMANENTE «CUPS + revisar_preaviso» SILENCIA LA RENOVACIÓN
 *   DEL AÑO SIGUIENTE. La tarea del preaviso de 2027 se queda abierta —que
 *   es lo normal aquí, hay 89 tareas vencidas sin cerrar—, llega el ciclo de
 *   2028 y la regla ve «ya hay una de ese tipo» y calla. El contrato se
 *   renueva solo y NADIE SE ENTERA: el fallo silencioso de siempre.
 *
 * Así que hay dos clases de regla y cada una tiene su llave:
 *
 *   · REGLAS DE ESTADO (reclamar una firma, seguir una oferta). Valen
 *     mientras el expediente esté en esa fase y no se repiten: la llave es
 *     (vínculo, tipo). Mientras haya una abierta, silencio — que resuelve
 *     gratis lo de «no crear una tarea cada día de retraso».
 *
 *   · REGLAS DE CICLO (el preaviso, la primera factura, un cobro previsto).
 *     Vuelven a ocurrir sobre el MISMO expediente cada vez que se repite el
 *     hecho que las origina. La llave es (vínculo, tipo, CICLO), donde el
 *     ciclo es la fecha del hecho: el límite de preaviso, la activación, el
 *     cobro previsto. Dos tareas del mismo ciclo son la misma; una del ciclo
 *     que viene es otra distinta y tiene que poder crearse.
 *
 * Qué es «el mismo ciclo» se decide por cercanía (`VENTANA_CICLO`): una
 * corrección de la fecha mueve el preaviso unos días, una renovación lo mueve
 * un año. Y dentro de un ciclo ya atendido —la tarea existe y está cerrada—
 * no se vuelve a proponer nada: cerrarla fue una decisión de una persona y
 * pisarla es exactamente lo que no puede hacer un automatismo.
 *
 * ESTAS REGLAS NO ESCRIBEN NADA. Devuelven PROPUESTAS. Quien las aplica es una
 * persona desde la pantalla, y eso no es una limitación técnica: es que un
 * sistema que crea trabajo solo, en silencio y sobre datos reales, acaba
 * llenando las listas de tareas que nadie pidió — y entonces se deja de mirar
 * la lista, que es el único sitio donde vive el control.
 */

import { TAREAS_ABIERTAS } from './luz.ts';
import { sePuedeReclamar } from './cobros.ts';

/** Qué se propone hacer con la tarea. */
export type AccionPropuesta = 'crear' | 'actualizar';

export interface TareaPropuesta {
  cliente_id: string | null;
  cups_id?: string | null;
  pipeline_id?: string | null;
  contrato_id?: string | null;
  comision_id?: string | null;
  tipo_tarea: string;
  descripcion: string;
  responsable: string | null;
  fecha_limite: string;
  prioridad: string;
}

export interface Propuesta {
  /**
   * Llave natural: vínculo + tipo (+ ciclo, cuando la regla se repite).
   * Dos propuestas con la misma clave son la misma cosa.
   */
  clave: string;
  /**
   * El hecho que origina esta vuelta de la regla, cuando se repite: la fecha
   * del preaviso, la de la activación, la del cobro previsto. Null en las
   * reglas de estado, que no vuelven. Va en pantalla para que se vea que la
   * del año que viene es otra tarea y no un duplicado.
   */
  ciclo?: string | null;
  /** Qué regla la genera, para poder desactivarla o discutirla. */
  regla: string;
  /** El porqué, en cristiano. Sin esto, nadie sabe si aplicar o no. */
  porque: string;
  accion: AccionPropuesta;
  /** Si es una actualización, de qué tarea. */
  tareaId?: string | null;
  /** Nombre del cliente/expediente, para la pantalla. */
  contexto: string;
  tarea: TareaPropuesta;
}

/**
 * Los plazos de cada regla, en días.
 *
 * El documento los quiere en manos de Dirección, no del código: aquí están los
 * valores por defecto y `proponerTareas` acepta los que vengan de `luz_config`.
 * Un plazo cambiado a mano en el código es un plazo que nadie sabe que existe.
 */
export interface PlazosAutomatismos {
  /** Días para reclamar una factura que se pidió. */
  pedirFactura: number;
  /** Días para preparar la oferta desde que llega la factura. */
  prepararOferta: number;
  /** Cadencia de seguimiento de una propuesta enviada. */
  seguirOferta: number;
  /** Días para reclamar una firma. */
  reclamarFirma: number;
  /** Días para enviar a la comercializadora lo firmado. */
  enviarComercializadora: number;
  /** Días para confirmar la activación desde el envío. */
  confirmarActivacion: number;
  /** Días tras la activación para revisar la primera factura. */
  revisarPrimeraFactura: number;
  /** Con cuántos días de antelación se prepara la renovación. */
  avisoPreaviso: number;
}

export const PLAZOS: PlazosAutomatismos = {
  pedirFactura: 5,
  prepararOferta: 3,
  seguirOferta: 4,
  reclamarFirma: 4,
  enviarComercializadora: 2,
  confirmarActivacion: 10,
  // Mes y medio: la primera factura del nuevo contrato tarda en llegar, y
  // pedirla antes solo consigue que la tarea se aplace tres veces.
  revisarPrimeraFactura: 45,
  // Sesenta días antes del límite de preaviso. Antes no hay nada que hacer;
  // después, se llega con prisa a algo que bloquea un año si se falla.
  avisoPreaviso: 60,
};

/** Suministros que ya no van a ninguna parte: no hay renovación que preparar. */
export const CUPS_SIN_RENOVACION: string[] = ['perdido', 'no_viable'];

/**
 * Cuántos días alrededor de la fecha propuesta se consideran EL MISMO CICLO.
 *
 * Es lo que separa «alguien corrigió el fin de contrato» de «ha pasado un año
 * y toca otra vez». Ciento veinte días: muy por encima de `avisoPreaviso` (60),
 * así que cualquier tarea de esta misma vuelta cae dentro; y muy por debajo de
 * los ~365 de la siguiente renovación, que queda fuera y puede crearse.
 */
export const VENTANA_CICLO = 120;

// ── Entradas ────────────────────────────────────────────────────────────────

export interface TareaExistente {
  id: string;
  tipo_tarea?: string | null;
  estado?: string | null;
  fecha_limite?: string | null;
  cliente_id?: string | null;
  cups_id?: string | null;
  pipeline_id?: string | null;
  contrato_id?: string | null;
  comision_id?: string | null;
}

export interface EntradaAutomatismos {
  clientes: { id: string; nombre: string; responsable?: string | null }[];
  cups: {
    id: string; cliente_id: string; cups: string; alias_suministro?: string | null;
    estado_cups: string; responsable?: string | null; fecha_limite_preaviso?: string | null;
  }[];
  pipeline: {
    id: string; cliente_id: string; estado: string;
    nombre_oportunidad?: string | null; responsable?: string | null; cups_id?: string | null;
  }[];
  contratos: {
    id: string; cliente_id: string; cups_id?: string | null; estado_contrato: string;
    responsable?: string | null; comercializadora_final?: string | null;
    fecha_firma?: string | null; fecha_activacion_real?: string | null;
  }[];
  comisiones: {
    id: string; cliente_id: string; estado_comision: string;
    fecha_prevista_cobro?: string | null; responsable?: string | null;
    // Los importes hacen falta para no reclamar un apunte vacío. Ver `cobros.ts`.
    importe_previsto?: number | string | null;
    importe_cobrado?: number | string | null;
  }[];
  tareas: TareaExistente[];
}

const sumarDias = (hoy: string, n: number): string => {
  const d = new Date(`${hoy.slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const diasEntre = (desde: string | null | undefined, hasta: string): number | null => {
  if (!desde) return null;
  const a = new Date(`${String(desde).slice(0, 10)}T00:00:00`);
  const b = new Date(`${hasta.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(a.getTime())) return null;
  return Math.round((a.getTime() - b.getTime()) / 86400000);
};

/**
 * Genera las tareas que DEBERÍAN existir y todavía no existen.
 *
 * Nada de lo que devuelve se escribe: son propuestas para que alguien las
 * revise. Ver la cabecera del archivo.
 */
export function proponerTareas(
  e: EntradaAutomatismos,
  hoy: string,
  plazos: PlazosAutomatismos = PLAZOS
): Propuesta[] {
  const propuestas: Propuesta[] = [];
  const abiertas = e.tareas.filter((t) => !t.estado || TAREAS_ABIERTAS.includes(t.estado));
  const nombre = (id: string) => e.clientes.find((c) => c.id === id)?.nombre || 'Cliente';
  const responsableCliente = (id: string) => e.clientes.find((c) => c.id === id)?.responsable || null;

  /**
   * LA COMPROBACIÓN QUE HACE TODO ESTO IDEMPOTENTE.
   *
   * Si ya hay una tarea abierta de ese tipo colgando de ese mismo vínculo, la
   * regla calla. Ejecutar esto dos veces, o doscientas, da lo mismo.
   */
  const yaHay = (campo: keyof TareaExistente, id: string, tipo: string) =>
    abiertas.some((t) => t[campo] === id && t.tipo_tarea === tipo);

  /**
   * LA COMPROBACIÓN DE LAS REGLAS QUE SE REPITEN.
   *
   * Mira TODAS las tareas —abiertas y cerradas— de ese tipo y ese vínculo, y
   * se queda con las que caen dentro de la ventana del ciclo que se está
   * evaluando. Devuelve qué hacer:
   *
   *   · `atendido`  — hay una del ciclo ya cerrada: alguien lo resolvió. Callar.
   *   · `viva`      — hay una abierta de este ciclo. Solo se le puede mover la fecha.
   *   · null        — no hay ninguna de ESTE ciclo. Se puede crear, aunque
   *                   existan las de ciclos anteriores. Aquí está el arreglo.
   */
  const enElCiclo = (
    campo: keyof TareaExistente, id: string, tipo: string, fecha: string
  ): { estado: 'atendido' | 'viva'; tarea: TareaExistente } | null => {
    const delCiclo = e.tareas.filter((t) => {
      if (t[campo] !== id || t.tipo_tarea !== tipo) return false;
      const d = diasEntre(t.fecha_limite, fecha);
      // Una tarea sin fecha no se puede situar en ningún ciclo. Se cuenta como
      // de este: es lo prudente — antes callar de más que duplicar.
      return d == null || Math.abs(d) <= VENTANA_CICLO;
    });
    if (!delCiclo.length) return null;
    const viva = delCiclo.find((t) => !t.estado || TAREAS_ABIERTAS.includes(t.estado));
    return viva ? { estado: 'viva', tarea: viva } : { estado: 'atendido', tarea: delCiclo[0] };
  };

  // ══ Oportunidades ══════════════════════════════════════════════════════
  for (const o of e.pipeline) {
    const ctx = `${nombre(o.cliente_id)} · ${o.nombre_oportunidad || 'Oportunidad'}`;
    const resp = o.responsable || responsableCliente(o.cliente_id);
    const comun = {
      cliente_id: o.cliente_id, pipeline_id: o.id, cups_id: o.cups_id || null,
      responsable: resp, prioridad: 'media',
    };

    if (o.estado === 'factura_solicitada' && !yaHay('pipeline_id', o.id, 'pedir_factura')) {
      propuestas.push({
        clave: `pipeline:${o.id}:pedir_factura`,
        regla: 'Factura solicitada sin nadie detrás',
        porque: 'Se pidió la factura y no hay ninguna tarea de reclamarla: sin factura no hay estudio ni oferta.',
        accion: 'crear', contexto: ctx,
        tarea: { ...comun, tipo_tarea: 'pedir_factura', descripcion: 'Reclamar la factura al cliente', fecha_limite: sumarDias(hoy, plazos.pedirFactura) },
      });
    }

    if (['factura_recibida', 'pendiente_ofertar'].includes(o.estado)
      && !yaHay('pipeline_id', o.id, 'preparar_oferta')) {
      propuestas.push({
        clave: `pipeline:${o.id}:preparar_oferta`,
        regla: 'Factura en casa y estudio sin empezar',
        porque: 'El cliente ya hizo su parte y está esperando. Es el atasco más caro: enfría a alguien que ya había dicho que sí a mirarlo.',
        accion: 'crear', contexto: ctx,
        tarea: { ...comun, tipo_tarea: 'preparar_oferta', descripcion: 'Preparar el estudio y la oferta', fecha_limite: sumarDias(hoy, plazos.prepararOferta), prioridad: 'alta' },
      });
    }

    if (['oferta_enviada', 'seguimiento'].includes(o.estado)
      && !yaHay('pipeline_id', o.id, 'seguimiento')) {
      propuestas.push({
        clave: `pipeline:${o.id}:seguimiento`,
        regla: 'Propuesta enviada sin seguimiento',
        porque: 'Una oferta que no se sigue se da por perdida sola: el cliente entiende el silencio como que a nosotros tampoco nos importaba tanto.',
        accion: 'crear', contexto: ctx,
        tarea: { ...comun, tipo_tarea: 'seguimiento', descripcion: 'Llamar para saber qué le ha parecido la oferta', fecha_limite: sumarDias(hoy, plazos.seguirOferta), prioridad: 'alta' },
      });
    }
  }

  // ══ Contratos ══════════════════════════════════════════════════════════
  for (const k of e.contratos) {
    const ctx = `${nombre(k.cliente_id)} · ${k.comercializadora_final || 'Contrato'}`;
    const resp = k.responsable || responsableCliente(k.cliente_id);
    const comun = {
      cliente_id: k.cliente_id, contrato_id: k.id, cups_id: k.cups_id || null,
      responsable: resp, prioridad: 'alta',
    };

    if (['enviado_cliente', 'pendiente_firma'].includes(k.estado_contrato)
      && !yaHay('contrato_id', k.id, 'reclamar_firma')) {
      propuestas.push({
        clave: `contrato:${k.id}:reclamar_firma`,
        regla: 'Contrato enviado y sin firmar',
        porque: 'Está dicho que sí y solo falta papeleo. Que se caiga aquí es el peor final posible.',
        accion: 'crear', contexto: ctx,
        tarea: { ...comun, tipo_tarea: 'reclamar_firma', descripcion: 'Reclamar la firma del contrato', fecha_limite: sumarDias(hoy, plazos.reclamarFirma) },
      });
    }

    if (k.estado_contrato === 'firmado' && !yaHay('contrato_id', k.id, 'enviar_comercializadora')) {
      propuestas.push({
        clave: `contrato:${k.id}:enviar_comercializadora`,
        regla: 'Firmado y sin enviar',
        porque: 'El cliente ya firmó. Cada día que el contrato no sale es un día que se retrasa la activación y el cobro.',
        accion: 'crear', contexto: ctx,
        tarea: { ...comun, tipo_tarea: 'enviar_comercializadora', descripcion: 'Enviar el contrato a la comercializadora', fecha_limite: sumarDias(hoy, plazos.enviarComercializadora) },
      });
    }

    if (['enviado_comercializadora', 'pendiente_validacion', 'pendiente_activacion'].includes(k.estado_contrato)
      && !yaHay('contrato_id', k.id, 'confirmar_activacion')) {
      propuestas.push({
        clave: `contrato:${k.id}:confirmar_activacion`,
        regla: 'En tramitación sin vigilancia',
        porque: 'Es dinero ya vendido. Casi siempre que se cae aquí es por un rechazo del ATR que nadie vio.',
        accion: 'crear', contexto: ctx,
        tarea: { ...comun, tipo_tarea: 'confirmar_activacion', descripcion: 'Confirmar la activación con la comercializadora', fecha_limite: sumarDias(hoy, plazos.confirmarActivacion) },
      });
    }

    // Activado → revisar la primera factura. El documento lo pide como paso
    // obligatorio antes de dar una venta por cerrada: es donde se descubre
    // que lo aplicado no es lo pactado.
    // Es una REGLA DE CICLO: el ciclo es la activación. Si el mismo contrato
    // se reactiva —cambio de comercializadora sobre el mismo expediente—, hay
    // una primera factura nueva que revisar, y la tarea vieja no puede
    // silenciarla.
    if (k.estado_contrato === 'activado' && k.fecha_activacion_real) {
      const desde = diasEntre(k.fecha_activacion_real, hoy);
      // Solo si aún tiene sentido: no se propone revisar la primera factura de
      // un contrato activado hace dos años.
      if (desde != null && -desde <= plazos.revisarPrimeraFactura + 60) {
        const ciclo = k.fecha_activacion_real.slice(0, 10);
        const fecha = sumarDias(ciclo, plazos.revisarPrimeraFactura);
        if (!enElCiclo('contrato_id', k.id, 'revisar_futuro', fecha)) {
          propuestas.push({
            clave: `contrato:${k.id}:revisar_futuro:${ciclo}`, ciclo,
            regla: 'Activado sin verificar la primera factura',
            porque: 'Una venta no está cerrada hasta comprobar que lo que factura la comercializadora es lo que se pactó.',
            accion: 'crear', contexto: ctx,
            tarea: {
              ...comun, tipo_tarea: 'revisar_futuro', prioridad: 'media',
              descripcion: 'Revisar la primera factura del nuevo contrato',
              fecha_limite: fecha,
            },
          });
        }
      }
    }
  }

  // ══ Suministros: UNA SOLA TAREA VIVA DE RENOVACIÓN POR CUPS ════════════
  //
  // El documento es explícito: las alertas a 120/90/60/45/30 días «no deben
  // abrir 6 tareas duplicadas». La regla correcta es una sola tarea viva cuya
  // fecha se actualiza según el hito más cercano — por eso aquí, si ya existe,
  // se propone ACTUALIZARLA en vez de crear otra.
  for (const c of e.cups) {
    if (!c.fecha_limite_preaviso) continue;
    // Un suministro abandonado no tiene renovación que preparar. Ojo con la
    // tentación de excluir también los ACTIVADOS: un cliente activo cuyo
    // contrato se acaba es justamente quien tiene ventana de preaviso, y
    // callarlo ahí sería silenciar el caso más caro de todos.
    if (CUPS_SIN_RENOVACION.includes(c.estado_cups)) continue;
    const dias = diasEntre(c.fecha_limite_preaviso, hoy);
    if (dias == null || dias < 0 || dias > plazos.avisoPreaviso) continue;

    const ctx = `${nombre(c.cliente_id)} · ${c.alias_suministro || c.cups}`;
    const resp = c.responsable || responsableCliente(c.cliente_id);
    // La tarea se pone unos días antes del límite, nunca el mismo día: el
    // último día no da margen a que el cliente coja el teléfono.
    const fecha = sumarDias(c.fecha_limite_preaviso.slice(0, 10), -5);
    // EL CICLO ES LA FECHA DEL PREAVISO. La renovación del año que viene es
    // otro ciclo y tiene derecho a su propia tarea aunque la de este año se
    // haya quedado abierta sin cerrar.
    const ciclo = c.fecha_limite_preaviso.slice(0, 10);
    const clave = `cups:${c.id}:revisar_preaviso:${ciclo}`;
    const tarea = {
      cliente_id: c.cliente_id, cups_id: c.id, responsable: resp, prioridad: 'alta',
      tipo_tarea: 'revisar_preaviso',
      descripcion: 'Preparar la renovación antes de que se cierre el preaviso',
      fecha_limite: fecha,
    };
    const previa = enElCiclo('cups_id', c.id, 'revisar_preaviso', fecha);

    // Ya cerrada para ESTE ciclo: alguien la resolvió. No se reabre.
    if (previa?.estado === 'atendido') continue;

    if (!previa) {
      propuestas.push({
        clave, ciclo,
        regla: 'Preaviso acercándose',
        porque: `Quedan ${dias} días para poder preavisar. Si se pasa, el contrato se prorroga solo y el cliente puede quedar atado hasta un año más.`,
        accion: 'crear', contexto: ctx, tarea,
      });
    } else if ((previa.tarea.fecha_limite || '').slice(0, 10) !== fecha) {
      // Misma vuelta con otra fecha: alguien corrigió el fin de contrato. Se le
      // mueve la fecha a la que hay, no se crea una segunda. La pantalla aplica
      // SOLO `fecha_limite`, para no pisar una descripción escrita a mano.
      propuestas.push({
        clave, ciclo,
        regla: 'La renovación tiene la fecha desfasada',
        porque: 'Ya hay una tarea de renovación para este mismo preaviso, pero con otra fecha. Se actualiza esa en vez de crear una segunda.',
        accion: 'actualizar', tareaId: previa.tarea.id, contexto: ctx, tarea,
      });
    }
  }

  // ══ Comisiones vencidas ════════════════════════════════════════════════
  for (const m of e.comisiones) {
    /*
     * ANTES DE RECLAMAR, RECLASIFICAR. `sePuedeReclamar` deja fuera lo que no
     * tiene importe, lo que no tiene fecha y lo que sigue como «prevista» con
     * la fecha pasada hace meses — que en la cartera real son 29 apuntes que
     * suman 217 €. Pedirle 7 € a una comercializadora por un apunte que nadie
     * ha confirmado quema la relación por nada, y llena la lista de cobros de
     * ruido hasta que se deja de mirar.
     */
    if (!sePuedeReclamar(m, hoy)) continue;
    const d = diasEntre(m.fecha_prevista_cobro, hoy);
    if (d == null || d >= 0) continue;
    // También de ciclo: si un cobro parcial mueve la fecha prevista al mes que
    // viene, eso es otra reclamación. Y una ya cerrada no se reabre sola.
    const ciclo = String(m.fecha_prevista_cobro).slice(0, 10);
    if (enElCiclo('comision_id', m.id, 'reclamar_comision', ciclo)) continue;

    propuestas.push({
      clave: `comision:${m.id}:reclamar_comision:${ciclo}`, ciclo,
      regla: 'Comisión con el cobro vencido',
      porque: `La fecha prevista de cobro pasó hace ${Math.abs(d)} días. Es trabajo ya hecho que está sin cobrar.`,
      accion: 'crear', contexto: nombre(m.cliente_id),
      tarea: {
        cliente_id: m.cliente_id, comision_id: m.id,
        responsable: m.responsable || responsableCliente(m.cliente_id), prioridad: 'media',
        tipo_tarea: 'reclamar_comision', descripcion: 'Reclamar la comisión pendiente',
        fecha_limite: sumarDias(hoy, 3),
      },
    });
  }

  // Dos propuestas con la misma clave son la misma cosa: se deja una. No
  // debería pasar, pero si una regla nueva pisara a otra, el resultado sería
  // dos tareas idénticas — justo lo que esto viene a evitar.
  const vistas = new Set<string>();
  return propuestas.filter((p) => {
    if (vistas.has(p.clave)) return false;
    vistas.add(p.clave);
    return true;
  });
}

/** Las propuestas agrupadas por regla, para poder revisarlas de una en una. */
export function agruparPorRegla(ps: Propuesta[]) {
  const m = new Map<string, Propuesta[]>();
  for (const p of ps) {
    const v = m.get(p.regla) || [];
    v.push(p);
    m.set(p.regla, v);
  }
  return [...m.entries()]
    .map(([regla, propuestas]) => ({ regla, propuestas }))
    .sort((a, b) => b.propuestas.length - a.propuestas.length);
}
