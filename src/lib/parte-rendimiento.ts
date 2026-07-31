/**
 * RENDIMIENTO DEL DÍA — ¿ha sido un día productivo, y qué queda colgando?
 *
 * El parte ya contaba QUÉ pasó. Lo que faltaba era el juicio: si eso que pasó
 * mueve el negocio o solo mueve la base de datos.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ NO SE CUENTAN ACCIONES
 *
 * Contar filas de auditoría premia teclear. Una tarde rellenando cuarenta
 * teléfonos son cuarenta acciones y cero euros más cerca; una visita que acaba
 * con la factura en la mano es UNA acción y desbloquea toda la oferta. Si el
 * parte dijera «40 vs 1», estaría enseñando exactamente lo contrario de lo que
 * pasó.
 *
 * Por eso cada acción vale según LO QUE HABILITA:
 *
 *   · produce   — pasa dinero o cierra: alta de cliente, contrato firmado,
 *                 comisión cobrada, visita resuelta.
 *   · prepara   — quita un bloqueo para poder cerrar: meter el consumo, subir
 *                 el estado del suministro, enviar la oferta.
 *   · mantiene  — el dato queda mejor pero nadie está más cerca de firmar.
 *   · retrocede — algo se ha caído. Cuenta en negativo, porque contarlo como
 *                 «actividad» haría que perder clientes subiera la nota.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA VENTANA SON 7 DÍAS, Y ES A PROPÓSITO
 *
 * Comparar el día de hoy contra «lo normal» necesita una referencia, y la única
 * honrada es el propio ritmo del equipo, no una cifra inventada. Siete días
 * cubren la semana entera —incluidos los lunes de teléfono y los viernes de
 * cierres— sin arrastrar meses de una cartera que era otra.
 *
 * Y lo mismo para lo que queda pendiente: se enseña lo vencido de los últimos
 * siete días. Lo más viejo NO se esconde, se cuenta aparte: una lista que
 * silencia lo que lleva un mes parado tranquiliza, y eso es peor que no tenerla.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Accion } from './parte-diario.ts';

// ── Qué aporta cada cosa ────────────────────────────────────────────────────

export type Aporte = 'produce' | 'prepara' | 'mantiene' | 'retrocede';

export const ETIQUETA_APORTE: Record<Aporte, string> = {
  produce: 'Produce',
  prepara: 'Prepara el cierre',
  mantiene: 'Mantiene el dato',
  retrocede: 'Retrocede',
};

/**
 * Lo que vale cada acción. Los números no son sagrados, pero sí su ORDEN: una
 * cosa que produce vale más que diez que solo ordenan el fichero, y un
 * retroceso resta.
 */
export const PUNTOS_APORTE: Record<Aporte, number> = {
  produce: 10,
  prepara: 4,
  mantiene: 1,
  retrocede: -3,
};

/** Campos cuyo relleno desbloquea de verdad la venta. */
const CAMPOS_QUE_DESBLOQUEAN = new Set([
  'consumo_anual_kwh', 'potencias_kw', 'tarifa_acceso', 'cups',
  'fecha_fin_contrato', 'fecha_limite_preaviso', 'comercializadora_actual',
  'coste_anual_estimado',
]);

/** Campos que son dinero contante. */
const CAMPOS_DINERO = new Set(['importe_cobrado', 'fecha_cobro', 'fecha_firma', 'fecha_activacion_real']);

/**
 * Qué aporta una acción del parte.
 *
 * El orden de las comprobaciones importa: primero lo que cierra, luego lo que
 * desbloquea, y solo al final el cajón de «dato». Al revés, un contrato firmado
 * que además corrigió el teléfono contaría como mantenimiento.
 */
export function aporteDe(a: Accion): Aporte {
  if (a.tipo === 'retroceso') return 'retrocede';

  // Dinero y firmas: lo que de verdad cierra
  if (a.cambios.some((c) => CAMPOS_DINERO.has(c.campo))) return 'produce';

  // Altas que meten trabajo nuevo en la casa
  if (a.operacion === 'INSERT') {
    if (['luz_clientes', 'luz_cups', 'luz_pipeline', 'luz_contratos', 'luz_visitas'].includes(a.tabla)) {
      return 'produce';
    }
    return 'prepara';
  }

  // Una visita con resultado es una visita hecha, no un dato apuntado
  if (a.tabla === 'luz_visitas' && a.cambios.some((c) => c.campo === 'resultado')) return 'produce';

  if (a.tipo === 'avance') return 'prepara';
  if (a.cambios.some((c) => CAMPOS_QUE_DESBLOQUEAN.has(c.campo))) return 'prepara';

  return 'mantiene';
}

// ── Rendimiento ─────────────────────────────────────────────────────────────

export type Veredicto = 'productivo' | 'normal' | 'flojo' | 'sin_actividad' | 'sin_referencia';

export interface Rendimiento {
  /** Puntos del día, sumando el aporte de cada acción. */
  puntos: number;
  acciones: number;
  reparto: Record<Aporte, number>;
  /** Qué parte del trabajo del día movió el negocio, de 0 a 100. */
  pct_util: number;
  /** Media de puntos de los días CON actividad de la ventana anterior. */
  media_referencia: number | null;
  dias_comparados: number;
  /** Diferencia con la media, en %. `null` si no hay con qué comparar. */
  variacion_pct: number | null;
  veredicto: Veredicto;
  /** La razón, escrita para leerla. Nunca se enseña el veredicto a secas. */
  porque: string;
}

const vacio = (): Record<Aporte, number> => ({ produce: 0, prepara: 0, mantiene: 0, retrocede: 0 });

/** Los puntos de una lista de acciones. Se usa para el día y para el histórico. */
export function puntosDe(acciones: Accion[]): number {
  return acciones.reduce((s, a) => s + PUNTOS_APORTE[aporteDe(a)], 0);
}

/**
 * El rendimiento de un día, comparado con el ritmo propio de los días
 * anteriores.
 *
 * `puntosPorDiaAnterior` son los días de la ventana YA calculados; los días sin
 * nada se descartan antes de promediar. Si se contaran, un puente de tres días
 * hundiría la media y el jueves siguiente saldría «excelente» sin haber hecho
 * nada distinto.
 */
export function rendimientoDelDia(
  acciones: Accion[],
  puntosPorDiaAnterior: number[] = []
): Rendimiento {
  const reparto = vacio();
  for (const a of acciones) reparto[aporteDe(a)]++;

  const puntos = puntosDe(acciones);
  const utiles = reparto.produce + reparto.prepara;
  const pct_util = acciones.length ? Math.round((utiles / acciones.length) * 100) : 0;

  const conActividad = puntosPorDiaAnterior.filter((p) => p > 0);
  const media = conActividad.length
    ? conActividad.reduce((s, p) => s + p, 0) / conActividad.length
    : null;

  const variacion =
    media && media > 0 ? Math.round(((puntos - media) / media) * 100) : null;

  let veredicto: Veredicto;
  let porque: string;

  if (!acciones.length) {
    veredicto = 'sin_actividad';
    porque = 'No se registró nada. O no se trabajó en el sistema, o se trabajó y no se apuntó.';
  } else if (reparto.produce === 0 && reparto.prepara === 0) {
    veredicto = 'flojo';
    porque = `${acciones.length} ${acciones.length === 1 ? 'movimiento' : 'movimientos'}, pero ninguno acerca un cierre: todo fue ordenar datos.`;
  } else if (media === null) {
    veredicto = 'sin_referencia';
    porque = `${reparto.produce} ${reparto.produce === 1 ? 'cosa que produce' : 'cosas que producen'} y ${reparto.prepara} que preparan el cierre. Aún no hay días anteriores con los que comparar.`;
  } else if (variacion !== null && variacion >= 25) {
    veredicto = 'productivo';
    porque = `Un ${variacion} % por encima del ritmo de los últimos días: ${reparto.produce} ${reparto.produce === 1 ? 'cosa que produce' : 'cosas que producen'} y ${reparto.prepara} que preparan el cierre.`;
  } else if (variacion !== null && variacion <= -25) {
    veredicto = 'flojo';
    porque = `Un ${Math.abs(variacion)} % por debajo del ritmo de los últimos días.${reparto.produce === 0 ? ' No se cerró nada.' : ''}`;
  } else {
    veredicto = 'normal';
    porque = `En la línea de los últimos días: ${reparto.produce} ${reparto.produce === 1 ? 'cosa que produce' : 'cosas que producen'} y ${reparto.prepara} que preparan el cierre.`;
  }

  if (reparto.retrocede > 0) {
    porque += ` Ojo: ${reparto.retrocede} ${reparto.retrocede === 1 ? 'cosa fue' : 'cosas fueron'} hacia atrás.`;
  }

  return {
    puntos,
    acciones: acciones.length,
    reparto,
    pct_util,
    media_referencia: media === null ? null : Math.round(media * 10) / 10,
    dias_comparados: conActividad.length,
    variacion_pct: variacion,
    veredicto,
    porque,
  };
}

export interface RendimientoPersona {
  persona: string;
  puntos: number;
  acciones: number;
  reparto: Record<Aporte, number>;
  pct_util: number;
}

/**
 * El mismo cálculo por persona.
 *
 * NO es para comparar a David con Nicola: hacen trabajos distintos y las
 * unidades no son las mismas. Sirve para ver de qué está hecho el día de cada
 * uno — si alguien lleva una semana solo en «mantiene», eso es un problema de
 * cómo está repartido el trabajo, no de esa persona.
 */
export function rendimientoPorPersona(acciones: Accion[]): RendimientoPersona[] {
  const mapa = new Map<string, Accion[]>();
  for (const a of acciones) {
    if (!mapa.has(a.persona)) mapa.set(a.persona, []);
    mapa.get(a.persona)!.push(a);
  }
  return [...mapa.entries()]
    .map(([persona, lista]) => {
      const reparto = vacio();
      for (const a of lista) reparto[aporteDe(a)]++;
      const utiles = reparto.produce + reparto.prepara;
      return {
        persona,
        puntos: puntosDe(lista),
        acciones: lista.length,
        reparto,
        pct_util: lista.length ? Math.round((utiles / lista.length) * 100) : 0,
      };
    })
    .sort((a, b) => b.puntos - a.puntos);
}

// ── Probabilidad de cierre ──────────────────────────────────────────────────

/**
 * Punto de partida por estado del embudo. Es la probabilidad «de manual»: lo
 * que vale una oportunidad por dónde está, antes de mirar su expediente.
 */
export const BASE_POR_ESTADO: Record<string, number> = {
  prospecto: 5,
  factura_solicitada: 10,
  doc_incompleta: 20,
  factura_recibida: 25,
  pendiente_permanencia: 30,
  pendiente_ofertar: 35,
  seguimiento: 45,
  oferta_enviada: 50,
  pendiente_firma: 75,
  ganado: 100,
  perdido: 0,
  revisar_adelante: 5,
};

export interface OportunidadAbierta {
  id: string;
  cliente_id: string;
  nombre_oportunidad?: string | null;
  estado?: string | null;
  probabilidad?: number | string | null;
  comision_potencial?: number | string | null;
  ahorro_potencial?: number | string | null;
  responsable?: string | null;
  fecha_proxima_accion?: string | null;
  proxima_accion?: string | null;
  actualizado_en?: string | null;
}

export interface DatosCliente {
  nombre?: string | null;
  telefono?: string | null;
  email?: string | null;
  /** Si alguno de sus suministros tiene consumo anual metido. */
  tiene_consumo?: boolean;
  /** Días desde la última visita con resultado útil, si la hay. */
  dias_desde_visita_util?: number | null;
}

export interface CierreProbable {
  id: string;
  cliente: string;
  oportunidad: string;
  estado: string;
  /** Lo que puso una persona en la ficha. Es una opinión, y se respeta como tal. */
  probabilidad_declarada: number | null;
  /** Lo que dice el expediente. */
  probabilidad_estimada: number;
  comision_potencial: number | null;
  /** Comisión × probabilidad estimada. Lo que cabe esperar, no lo que se sueña. */
  euros_esperados: number | null;
  dias_parado: number | null;
  /** Qué le falta para poder cerrarse. Vacío = nada la frena. */
  frena: string[];
  responsable: string | null;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** Días enteros entre dos fechas ISO. Negativo si la segunda es anterior. */
export function diasEntre(desde: string, hasta: string): number {
  const a = new Date(desde.slice(0, 10) + 'T12:00:00Z').getTime();
  const b = new Date(hasta.slice(0, 10) + 'T12:00:00Z').getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86400000);
}

/**
 * Qué probabilidad real tiene de cerrarse cada oportunidad abierta.
 *
 * Se parte del estado y se corrige con el expediente, porque la probabilidad
 * escrita a mano envejece: nadie vuelve a una ficha a bajarle el 60 % cuando
 * lleva un mes sin tocarse. Lo que no se hace nunca es tocar el número de la
 * persona — se enseñan los dos y se deja ver la diferencia, que es justo la
 * conversación que hay que tener.
 */
export function probabilidadesDeCierre(
  oportunidades: OportunidadAbierta[],
  clientes: Record<string, DatosCliente>,
  hoy: string
): CierreProbable[] {
  const salida: CierreProbable[] = [];

  for (const o of oportunidades) {
    const estado = String(o.estado || 'prospecto');
    if (estado === 'ganado' || estado === 'perdido') continue;

    const c = clientes[o.cliente_id] || {};
    const frena: string[] = [];
    let p = BASE_POR_ESTADO[estado] ?? 20;

    // El consumo es el que manda: sin él no hay oferta que enviar, y el estado
    // del embudo miente porque nadie lo baja al darse cuenta.
    const yaDeberiaOfertar = ['pendiente_ofertar', 'oferta_enviada', 'seguimiento', 'pendiente_firma'].includes(estado);
    if (!c.tiene_consumo) {
      if (yaDeberiaOfertar) {
        p -= 20;
        frena.push('Sin consumo metido: no se puede ofertar');
      } else {
        p -= 5;
        frena.push('Falta el consumo');
      }
    }

    if (!c.telefono && !c.email) {
      p -= 10;
      frena.push('Sin teléfono ni correo: no hay por dónde contactar');
    } else if (!c.email && ['oferta_enviada', 'seguimiento', 'pendiente_firma'].includes(estado)) {
      p -= 5;
      frena.push('Sin correo: la oferta no se le puede enviar');
    }

    const dias_parado = o.actualizado_en ? diasEntre(o.actualizado_en, hoy) : null;
    if (dias_parado !== null) {
      if (dias_parado > 30) { p -= 20; frena.push(`Parada ${dias_parado} días`); }
      else if (dias_parado > 14) { p -= 12; frena.push(`Parada ${dias_parado} días`); }
      else if (dias_parado > 7) { p -= 6; frena.push(`Parada ${dias_parado} días`); }
    }

    // Una visita reciente que trajo algo es la mejor señal que hay
    if (c.dias_desde_visita_util !== null && c.dias_desde_visita_util !== undefined && c.dias_desde_visita_util <= 14) {
      p += 10;
    }

    // El suelo no es 0 a propósito. Aquí solo entran oportunidades ABIERTAS, y
    // un 0 % se lee como «muerta»: invita a cerrarla. Estas no están muertas,
    // están atascadas —sin consumo, sin teléfono, paradas—, que es un problema
    // distinto y con una solución distinta: desatascarlas. El techo es 95
    // porque hasta la firma no hay nada seguro.
    const estimada = Math.max(3, Math.min(95, Math.round(p)));
    const comision = num(o.comision_potencial);

    salida.push({
      id: o.id,
      cliente: c.nombre || 'Sin nombre',
      oportunidad: o.nombre_oportunidad || 'Oportunidad',
      estado,
      probabilidad_declarada: num(o.probabilidad),
      probabilidad_estimada: estimada,
      comision_potencial: comision,
      euros_esperados: comision === null ? null : Math.round(comision * estimada) / 100,
      dias_parado,
      frena,
      responsable: o.responsable || null,
    });
  }

  // Por lo que cabe esperar ganar. Las que no tienen comisión puesta van
  // después pero NO se tiran: que falte el importe no las hace menos reales.
  return salida.sort((a, b) => (b.euros_esperados ?? -1) - (a.euros_esperados ?? -1));
}

// ── Lo que quedó colgando ───────────────────────────────────────────────────

export type OrigenPendiente = 'tarea' | 'cliente' | 'oportunidad' | 'visita';

export interface Pendiente {
  origen: OrigenPendiente;
  cliente: string;
  que: string;
  responsable: string | null;
  /** El día para el que estaba previsto. */
  para: string;
  /** Días de retraso. Siempre ≥ 1: lo de hoy no está pendiente todavía. */
  dias_retraso: number;
}

export interface TrabajoPendiente {
  /** Lo vencido dentro de la ventana, de lo más atrasado a lo menos. */
  items: Pendiente[];
  /** Lo que lleva vencido MÁS que la ventana. No se lista, pero se cuenta. */
  mas_viejos: number;
  ventana_dias: number;
}

export interface FuentePendiente {
  cliente: string;
  responsable?: string | null;
  que: string;
  para?: string | null;
  origen: OrigenPendiente;
}

/**
 * Lo que se quedó a medias los días anteriores y sigue sin hacerse.
 *
 * Solo cuenta lo que tiene FECHA puesta y esa fecha ya pasó. Una tarea sin
 * fecha no está retrasada, está sin planificar — es otro problema y mezclarlos
 * haría la lista inservible.
 *
 * Lo de hoy no entra: hoy todavía se puede hacer.
 */
export function trabajoPendiente(
  fuentes: FuentePendiente[],
  hoy: string,
  ventanaDias = 7
): TrabajoPendiente {
  const items: Pendiente[] = [];
  let mas_viejos = 0;

  for (const f of fuentes) {
    if (!f.para) continue;
    const retraso = diasEntre(f.para, hoy);
    if (retraso < 1) continue; // hoy o futuro: no está pendiente
    if (retraso > ventanaDias) { mas_viejos++; continue; }
    items.push({
      origen: f.origen,
      cliente: f.cliente,
      que: f.que,
      responsable: f.responsable || null,
      para: f.para.slice(0, 10),
      dias_retraso: retraso,
    });
  }

  items.sort((a, b) => b.dias_retraso - a.dias_retraso || a.cliente.localeCompare(b.cliente));
  return { items, mas_viejos, ventana_dias: ventanaDias };
}
