/**
 * EL ESTADO DE UN EXPEDIENTE ENERGÉTICO.
 *
 * Contesta las tres preguntas de la página 2 del documento: qué requiere
 * atención, qué está sin próxima acción y qué está esperando al cliente. Y por
 * cada expediente, la de la página 3: qué le pasa y qué hay que hacer ahora.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NO TIENE CRITERIO PROPIO DE URGENCIA
 *
 * Las fases y sus plazos salen de `energia.ts`, la cobertura de datos también,
 * y las tareas de `luz_tareas`. Si este archivo tuviera su propia idea de qué
 * está parado, el listado diría una cosa y la ficha otra del mismo expediente
 * — que es el fallo que `etapas.ts` vino a arreglar en el lado comercial.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * LA REGLA MADRE, TAMBIÉN AQUÍ
 *
 * Ningún expediente abierto puede estar sin siguiente acción, con responsable
 * y con fecha. Es lo mismo que exige `reglas-cartera.ts` para la venta, y por
 * el mismo motivo: un expediente sin siguiente paso no está parado, está
 * abandonado, y nadie se entera hasta que el cliente llama.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * «PENDIENTE PRINCIPAL» DICE QUÉ FALTA, NUNCA «PENDIENTE»
 *
 * «Faltan 5 meses de facturas para poder calcular el año» se resuelve.
 * «Pendiente» hay que investigarlo — y no se investiga, se ignora.
 */

import {
  FASE, cobertura, DIAS_MINIMOS_ANUAL,
  type FaseEnergia, type Pelota, type PeriodoMedido,
} from './energia.ts';

// ── Entradas ────────────────────────────────────────────────────────────────

export interface TareaDeExpediente {
  descripcion?: string | null;
  fecha_limite?: string | null;
  estado?: string | null;
  responsable?: string | null;
}

export interface EntradaExpediente {
  id: string;
  cliente: string;
  clienteId: string;
  objetivo: string;
  fase: FaseEnergia;
  responsable?: string | null;
  actualizadoEn?: string | null;
  /** Las medidas de este expediente, solo con su periodo: aquí solo se cuenta cobertura. */
  medidas?: PeriodoMedido[];
  /** Cuántos suministros tiene vinculados el cliente. */
  suministros?: number;
  /** Actuaciones abiertas del expediente. */
  actuaciones?: { estado: string; ahorro_previsto_eur?: number | null }[];
  /** ¿Hay una línea base aprobada? Lo necesita la fase de verificación. */
  tieneLineaBaseAprobada?: boolean;
  /** Tareas abiertas colgando de este expediente. */
  tareas?: TareaDeExpediente[];
}

const ABIERTAS = ['pendiente', 'en_curso', 'bloqueada'];

// ── Salida ──────────────────────────────────────────────────────────────────

export type NivelExpediente = 'critico' | 'atencion' | 'en_plazo' | 'esperando' | 'cerrado';

/**
 * Cada nivel con SU TEXTO. Un color de borde no se ve con sol en la pantalla
 * del móvil, y para quien no distingue rojo de ámbar no dice nada en ninguna
 * pantalla. Es la misma regla que en `ficha-suministro.ts`.
 */
export const NIVEL: Record<NivelExpediente, { texto: string; tono: string; orden: number }> = {
  critico: { texto: 'Requiere acción ya', tono: 'border-red-500/50 bg-red-500/[0.06] text-red-300', orden: 0 },
  atencion: { texto: 'Requiere atención', tono: 'border-amber-500/50 bg-amber-500/[0.06] text-amber-300', orden: 1 },
  esperando: { texto: 'Esperando al cliente', tono: 'border-sky-500/40 bg-sky-500/[0.04] text-sky-300', orden: 2 },
  en_plazo: { texto: 'En plazo', tono: 'border-emerald-500/40 bg-emerald-500/[0.04] text-emerald-400', orden: 3 },
  cerrado: { texto: 'Cerrado', tono: 'border-border/40 bg-card/60 text-muted', orden: 4 },
};

export interface EstadoExpediente {
  fase: FaseEnergia;
  faseTitulo: string;
  pelota: Pelota;
  /** Días desde el último movimiento. Null si no se sabe. */
  diasParado: number | null;
  /** Qué falta EXACTAMENTE para poder avanzar. Nunca la palabra «pendiente». */
  pendientePrincipal: string;
  /** La tarea abierta más cercana. */
  proximaAccion: { texto: string; fecha: string | null; responsable: string | null; vencida: boolean } | null;
  nivel: NivelExpediente;
  etiqueta: string;
  /** Si no tiene siguiente acción y debería. La regla madre. */
  sinAccion: boolean;
}

// ── Utilidades ──────────────────────────────────────────────────────────────

export function diasEntre(desde: string | null | undefined, hasta: string): number | null {
  if (!desde) return null;
  const a = new Date(`${String(desde).slice(0, 10)}T00:00:00`);
  const b = new Date(`${hasta.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Un año hacia atrás desde hoy, que es la ventana natural de un consumo. */
export function ventanaAnual(hoy: string): { desde: string; hasta: string } {
  const h = new Date(`${hoy.slice(0, 10)}T00:00:00`);
  const d = new Date(h);
  d.setFullYear(d.getFullYear() - 1);
  d.setDate(d.getDate() + 1);
  return { desde: d.toISOString().slice(0, 10), hasta: h.toISOString().slice(0, 10) };
}

// ── Qué le falta a cada fase ────────────────────────────────────────────────

/**
 * El pendiente principal, por fase.
 *
 * Devuelve UNA cosa, la que de verdad bloquea, no una lista. Una lista de
 * cinco pendientes en una fila de tabla no se lee; y si se leyera, no diría
 * por dónde empezar.
 */
export function pendienteDe(e: EntradaExpediente, hoy: string): string {
  const abiertas = (e.actuaciones || []).filter((a) =>
    !['cerrada', 'descartada'].includes(a.estado));

  switch (e.fase) {
    case 'diagnostico': {
      if (!e.suministros) return 'No hay ningún suministro vinculado: sin CUPS no se puede pedir la curva ni cruzar facturas';
      const { desde, hasta } = ventanaAnual(hoy);
      const c = cobertura(e.medidas || [], desde, hasta);
      if (c.diasCubiertos === 0) return 'No hay ni una medida cargada: sin datos no hay diagnóstico';
      if (!c.sePuedeAnualizar) {
        const meses = Math.max(1, Math.round((c.diasTotales - c.diasCubiertos) / 30));
        return `Faltan unos ${meses} meses de datos para poder dar una cifra anual (${c.diasCubiertos} de ${DIAS_MINIMOS_ANUAL} días)`;
      }
      return 'Los datos están: falta cerrar el diagnóstico y decidir dónde se puede mejorar';
    }
    case 'en_estudio':
      return abiertas.length === 0
        ? 'No hay ninguna actuación planteada todavía'
        : 'Cerrar los números de las alternativas y elegir cuál se propone';
    case 'propuesta':
      return 'El cliente tiene la propuesta y no ha contestado';
    case 'ejecucion':
      return 'Se está ejecutando: falta confirmar que está terminado';
    case 'verificacion':
      // Sin línea base aprobada NO se puede verificar nada. Es el bloqueo más
      // silencioso del módulo: se dan ahorros por buenos contra un modelo que
      // nadie aprobó, y eso no se sostiene delante de un auditor.
      return e.tieneLineaBaseAprobada
        ? 'Comparar el consumo posterior contra la línea base y firmar el ahorro'
        : 'Falta la línea base aprobada: sin ella no se puede verificar ningún ahorro';
    case 'seguimiento':
      return 'Toca la revisión periódica del cliente';
    case 'aparcado':
      return 'Aparcado a propósito: revisar cuándo se reactiva';
    case 'cerrado':
      return 'Terminado: no requiere más trabajo';
    default:
      return 'Revisar en qué punto está';
  }
}

// ── El estado completo ──────────────────────────────────────────────────────

export function estadoExpediente(e: EntradaExpediente, hoy: string): EstadoExpediente {
  const def = FASE[e.fase] || FASE.diagnostico;
  const cerrado = def.avance < 0;

  const abiertas = (e.tareas || []).filter((t) => !t.estado || ABIERTAS.includes(t.estado));
  const conFecha = abiertas
    .filter((t) => !!t.fecha_limite)
    .sort((a, b) => String(a.fecha_limite).localeCompare(String(b.fecha_limite)));
  const siguiente = conFecha[0] || abiertas[0] || null;

  const diasProxima = siguiente?.fecha_limite ? diasEntre(hoy, siguiente.fecha_limite) : null;
  const proximaAccion = siguiente
    ? {
      texto: siguiente.descripcion || 'Tarea sin describir',
      fecha: siguiente.fecha_limite ? String(siguiente.fecha_limite).slice(0, 10) : null,
      responsable: siguiente.responsable || null,
      vencida: diasProxima != null && diasProxima < 0,
    }
    : null;

  const diasParado = diasEntre(e.actualizadoEn, hoy);
  const pasado = diasParado != null && diasParado > def.limiteDias;

  // ── El nivel ──
  // Un expediente cerrado o aparcado no compite por atención: si lo hiciera,
  // la lista de lo que requiere acción se llenaría de cosas que se aparcaron a
  // propósito y dejaría de mirarse.
  let nivel: NivelExpediente;
  if (cerrado) nivel = 'cerrado';
  else if (proximaAccion?.vencida) nivel = 'critico';
  // Sin siguiente acción es crítico aunque no lleve tiempo parado: es la regla
  // madre. Un expediente abierto sin siguiente paso no avanza solo.
  else if (!proximaAccion) nivel = 'critico';
  else if (pasado) nivel = def.pelota === 'del_cliente' ? 'atencion' : 'critico';
  else if (def.pelota === 'del_cliente') nivel = 'esperando';
  else nivel = 'en_plazo';

  return {
    fase: e.fase,
    faseTitulo: def.titulo,
    pelota: def.pelota,
    diasParado,
    pendientePrincipal: pendienteDe(e, hoy),
    proximaAccion,
    nivel,
    etiqueta: NIVEL[nivel].texto,
    sinAccion: !cerrado && !proximaAccion,
  };
}

// ── La cabecera del listado ─────────────────────────────────────────────────

export interface CabeceraEnergia {
  requierenAtencion: number;
  sinProximaAccion: number;
  pendientesDelCliente: number;
  abiertos: number;
}

/**
 * Los tres contadores de la página 2, y ni uno más.
 *
 * Cada uno filtra la MISMA tabla al pulsarlo — «pulsar un contador filtra la
 * misma tabla», dice el documento. Un contador que no lleva a una lista no se
 * puede accionar: es decoración.
 */
export function cabecera(estados: EstadoExpediente[]): CabeceraEnergia {
  const vivos = estados.filter((s) => s.nivel !== 'cerrado');
  return {
    requierenAtencion: vivos.filter((s) => s.nivel === 'critico' || s.nivel === 'atencion').length,
    sinProximaAccion: vivos.filter((s) => s.sinAccion).length,
    /*
     * UN EXPEDIENTE SIN SIGUIENTE ACCIÓN NUNCA ESTÁ «PENDIENTE DEL CLIENTE».
     *
     * La fase puede decir que la pelota es suya —en diagnóstico se esperan sus
     * facturas—, pero si no hay ninguna tarea abierta es que NADIE SE LAS HA
     * PEDIDO. Contarlo como «esperando al cliente» es la excusa perfecta: el
     * expediente se queda quieto, sale en una lista que suena a que no
     * depende de nosotros, y nadie lo toca en tres meses.
     *
     * Esos van a «sin próxima acción», que es exactamente lo que son.
     */
    pendientesDelCliente: vivos.filter((s) => s.pelota === 'del_cliente' && !s.sinAccion).length,
    abiertos: vivos.length,
  };
}

/**
 * El orden de la lista: primero lo que se está cayendo.
 *
 * A igual nivel manda el TIEMPO PARADO, no el importe. Aquí no hay comisión
 * que ordene: un expediente parado seis semanas cuesta más que uno grande que
 * se movió ayer, porque el que lleva seis semanas es el que se pierde.
 */
export function ordenar<T extends { estado: EstadoExpediente }>(filas: T[]): T[] {
  return [...filas].sort((a, b) => {
    const na = NIVEL[a.estado.nivel].orden;
    const nb = NIVEL[b.estado.nivel].orden;
    if (na !== nb) return na - nb;
    return (b.estado.diasParado ?? 0) - (a.estado.diasParado ?? 0);
  });
}

/** Los filtros de la barra. Coinciden con los contadores para que cuadren. */
export type FiltroEnergia = '' | 'atencion' | 'sin_accion' | 'del_cliente' | 'mios';

export function aplicarFiltro(
  estado: EstadoExpediente,
  responsable: string | null | undefined,
  filtro: FiltroEnergia,
  yo: string
): boolean {
  if (estado.nivel === 'cerrado' && filtro !== '') return false;
  switch (filtro) {
    case 'atencion': return estado.nivel === 'critico' || estado.nivel === 'atencion';
    case 'sin_accion': return estado.sinAccion;
    // Mismo criterio que el contador: sin acción abierta, nadie le ha pedido
    // nada al cliente y el expediente es nuestro, no suyo.
    case 'del_cliente': return estado.pelota === 'del_cliente' && !estado.sinAccion;
    case 'mios': return !!yo && (responsable || '').toLowerCase() === yo.toLowerCase();
    default: return true;
  }
}
