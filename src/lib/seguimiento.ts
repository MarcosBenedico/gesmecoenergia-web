/**
 * SEGUIMIENTO DE PRECLIENTES — el panel de Marcos.
 *
 * Un precliente de energía casi nunca se pierde por un «no». Se pierde por
 * tres silencios, y ninguno de los tres hace ruido:
 *
 *   1. LA FACTURA QUE NUNCA LLEGA. Sin factura no hay estudio y sin estudio
 *      no hay oferta. Medido sobre la cartera real: de 22 preclientes que
 *      trajo David en un mes, 16 estaban parados justo ahí.
 *   2. LA VENTANA DE PREAVISO QUE SE CIERRA. Si se pasa, el contrato se
 *      renueva solo y el cliente queda bloqueado un año entero.
 *   3. LA ACTIVACIÓN QUE NO SE COMPLETA. Firmó y la comercializadora no lo
 *      activó. Es dinero ya ganado que se cae sin que nadie se entere.
 *
 * Por eso este archivo no calcula «estados»: calcula RELOJES. Un estado dice
 * dónde está; un reloj dice cuánto lleva ahí y si eso ya es un problema.
 *
 * LA IDEA QUE ORDENA TODO LO DEMÁS: DE QUIÉN ES LA PELOTA
 *
 * El plazo razonable no depende de la fase, depende de quién tiene que mover
 * ficha. Si la pelota es NUESTRA —hacer el estudio, presentar la oferta— cinco
 * días ya es tarde y la culpa es de casa. Si es del CLIENTE —mandar la
 * factura, contestar a una oferta— hay que darle aire, pero no infinito. Y si
 * es de la COMERCIALIZADORA —activar el suministro— el plazo es largo pero
 * hay que vigilarlo, porque ahí es donde se cae lo ya vendido.
 *
 * Usar el mismo listón para las tres cosas es lo que hace que un panel grite
 * cuando no debe y calle cuando sí. De ahí salen los números de abajo.
 */

// Con extensión, para que Node ejecute los tests sin compilar nada.
import type { LuzCups, LuzOportunidad, LuzContrato } from './luz.ts';

/** Quién tiene que mover ficha ahora mismo. */
export type Pelota = 'nuestra' | 'del_cliente' | 'de_la_comercializadora';

export type FaseSeguimiento =
  | 'esperando_factura'
  | 'falta_estudio'
  | 'esperando_respuesta'
  | 'cerrando'
  | 'esperando_activacion';

export interface DefinicionFase {
  id: FaseSeguimiento;
  titulo: string;
  /** Qué se está esperando exactamente. Se enseña bajo el título de la columna. */
  pista: string;
  pelota: Pelota;
  /** Días a partir de los cuales esto ya es un problema. */
  limiteDias: number;
}

/**
 * Los plazos. Cada uno con su motivo, porque un número sin motivo se acaba
 * cambiando por capricho y entonces el panel deja de significar nada.
 */
export const FASES: DefinicionFase[] = [
  {
    id: 'esperando_factura',
    titulo: 'Esperando factura',
    pista: 'Sin factura no hay estudio ni oferta',
    pelota: 'del_cliente',
    // Diez días es lo que tarda alguien en encontrar una factura entre otras
    // cosas. Más allá no es que esté ocupado: es que se ha olvidado, y hay
    // que volver a llamar en vez de seguir esperando.
    limiteDias: 10,
  },
  {
    id: 'falta_estudio',
    titulo: 'Falta el estudio',
    pista: 'Ya tenemos la factura. La pelota es nuestra',
    pelota: 'nuestra',
    // Cinco días. Aquí no hay a quién echarle la culpa: el cliente hizo su
    // parte y está esperando. Es el atasco más caro porque enfría a alguien
    // que ya había dicho que sí a mirarlo.
    limiteDias: 5,
  },
  {
    id: 'esperando_respuesta',
    titulo: 'Oferta enviada',
    pista: 'Presentada y sin respuesta',
    pelota: 'del_cliente',
    // Cuatro días. Una oferta que no se sigue a la semana se da por perdida
    // sola: el cliente entiende el silencio como que a nosotros tampoco nos
    // importaba tanto.
    limiteDias: 4,
  },
  {
    id: 'cerrando',
    titulo: 'Cerrando',
    pista: 'Falta firma o documentación',
    pelota: 'nuestra',
    // Siete días. Está dicho que sí y lo único que falta es papeleo; que se
    // caiga aquí es el peor final posible.
    limiteDias: 7,
  },
  {
    id: 'esperando_activacion',
    titulo: 'Esperando activación',
    pista: 'Firmado. Falta que la comercializadora lo active',
    pelota: 'de_la_comercializadora',
    // Veinte días es el plazo normal de un cambio de comercializadora. Pasado
    // eso hay que reclamar: casi siempre es un rechazo del ATR que nadie vio.
    limiteDias: 20,
  },
];

export const FASE = Object.fromEntries(FASES.map((f) => [f.id, f])) as Record<FaseSeguimiento, DefinicionFase>;

export const PELOTA_LABEL: Record<Pelota, string> = {
  nuestra: 'Nos toca a nosotros',
  del_cliente: 'Le toca al cliente',
  de_la_comercializadora: 'Le toca a la comercializadora',
};

/** Estados de pipeline que ya no están en juego. */
const PIPELINE_CERRADO = ['ganado', 'perdido'];

/**
 * En qué punto del viaje está un cliente.
 *
 * Se deduce de los datos reales —si hay CUPS con consumo, en qué estado está
 * la oportunidad, si hay contrato activado— y NO de un campo que alguien tenga
 * que mantener a mano. Se comprobó que los campos de estado van por detrás de
 * la realidad: hay contratos con la fecha de firma puesta que seguían
 * figurando como «pendiente de firma». Un panel que se creyera ese campo
 * estaría mintiendo.
 */
export function faseDe(e: {
  cups?: LuzCups[];
  pipeline?: LuzOportunidad[];
  contratos?: LuzContrato[];
}): FaseSeguimiento | null {
  const contratos = e.contratos || [];
  const cups = e.cups || [];
  const pipe = (e.pipeline || []).filter((o) => !PIPELINE_CERRADO.includes(o.estado));

  // 1. ¿Hay algo firmado que todavía no está activado? Manda sobre todo lo
  //    demás: es lo único que ya está vendido y se puede caer.
  const firmadoSinActivar = contratos.some(
    (c) => (c.fecha_firma || c.estado_contrato === 'firmado') && !c.fecha_activacion_real
  );
  if (firmadoSinActivar) return 'esperando_activacion';

  // Todo activado y sin nada abierto: fuera del panel.
  if (!pipe.length && contratos.length && contratos.every((c) => c.fecha_activacion_real)) return null;

  const estados = pipe.map((o) => o.estado);
  if (estados.some((s) => ['pendiente_firma', 'doc_incompleta'].includes(s))) return 'cerrando';
  if (estados.some((s) => ['oferta_enviada', 'seguimiento'].includes(s))) return 'esperando_respuesta';

  // 2. ¿Tenemos ya con qué trabajar? Un CUPS sin consumo no sirve para
  //    ofertar, así que cuenta como que la factura todavía no ha llegado.
  const tieneDatos = cups.some((c) => Number(c.consumo_anual_kwh) > 0);
  if (tieneDatos) return 'falta_estudio';

  // 3. Por defecto, lo que falta es la factura. Es el caso más común con
  //    diferencia y el que más clientes se lleva por delante.
  return 'esperando_factura';
}

/** Días enteros entre dos fechas ISO. Null si falta alguna. */
export function diasEntre(desde: string | null | undefined, hasta: string): number | null {
  if (!desde) return null;
  const a = new Date(`${String(desde).slice(0, 10)}T00:00:00`);
  const b = new Date(`${hasta.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(a.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Cuándo se movió esto por última vez.
 *
 * Cuenta cualquier señal de vida, no solo los apuntes: si Nicola actualizó la
 * oportunidad ayer, el cliente no lleva un mes parado aunque nadie escribiera
 * una nota. Contar solo las notas haría que el panel señalara como abandonado
 * a quien sí se está trabajando, y a la tercera vez que eso pasa se deja de
 * mirar el panel.
 */
export function ultimoMovimiento(señales: (string | null | undefined)[]): string | null {
  const fechas = señales
    .filter((f): f is string => !!f)
    .map((f) => String(f).slice(0, 10))
    .sort();
  return fechas.length ? fechas[fechas.length - 1] : null;
}

export interface FichaSeguimiento {
  clienteId: string;
  nombre: string;
  telefono: string | null;
  fase: FaseSeguimiento;
  /** Días desde el último movimiento. Null si no hay ninguna señal. */
  diasParado: number | null;
  /** Ha pasado del plazo de su fase. */
  enRojo: boolean;
  /** Qué le falta para poder avanzar, en una frase. */
  queFalta: string;
  ultimoApunte: string | null;
  ultimaFecha: string | null;
  comision: number;
  /** Días hasta que se cierre la ventana de preaviso, si la hay. */
  diasPreaviso: number | null;
}

/**
 * Lo que hay que hacer para que este cliente avance. Una frase, no una lista:
 * la tarjeta se lee de un vistazo o no se lee.
 */
export function queFalta(fase: FaseSeguimiento, tieneTelefono: boolean): string {
  if (!tieneTelefono && fase === 'esperando_factura') {
    // Sin teléfono no se puede reclamar nada: hay que ir o buscar el contacto.
    return 'Falta el teléfono: hay que ir o conseguirlo';
  }
  switch (fase) {
    case 'esperando_factura': return 'Reclamar la factura';
    case 'falta_estudio': return 'Hacer el estudio y preparar la oferta';
    case 'esperando_respuesta': return 'Llamar para saber qué le ha parecido';
    case 'cerrando': return 'Cerrar firma y documentación';
    case 'esperando_activacion': return 'Comprobar la activación con la comercializadora';
  }
}

/**
 * La franja roja: lo que se muere si no se toca.
 *
 * Es a propósito una lista corta y con criterio estrecho. Si aquí cabe todo,
 * no es una alarma, es la misma lista otra vez — y entonces no sirve.
 */
export function seMuereEstaSemana(fichas: FichaSeguimiento[], diasVentana = 7): FichaSeguimiento[] {
  return fichas
    .filter((f) => (f.diasPreaviso != null && f.diasPreaviso >= 0 && f.diasPreaviso <= diasVentana)
      || (f.enRojo && (f.fase === 'esperando_respuesta' || f.fase === 'cerrando')))
    .sort((a, b) => {
      // Primero lo que tiene fecha de caducidad real; después lo más parado.
      const pa = a.diasPreaviso ?? 999;
      const pb = b.diasPreaviso ?? 999;
      return pa - pb || (b.diasParado ?? 0) - (a.diasParado ?? 0);
    });
}

/** Recuento por fase, para los relojes de la cabecera. */
export function relojes(fichas: FichaSeguimiento[]) {
  return FASES.map((f) => {
    const suyas = fichas.filter((x) => x.fase === f.id);
    const conDias = suyas.map((x) => x.diasParado).filter((d): d is number => d != null);
    return {
      ...f,
      total: suyas.length,
      enRojo: suyas.filter((x) => x.enRojo).length,
      // La media solo se enseña si hay de dónde sacarla: una media de un solo
      // dato no es una media, es ese dato disfrazado de estadística.
      diasMedios: conDias.length >= 2
        ? Math.round(conDias.reduce((s, d) => s + d, 0) / conDias.length)
        : null,
      comision: suyas.reduce((s, x) => s + x.comision, 0),
    };
  });
}
