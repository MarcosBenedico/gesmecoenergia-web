/**
 * SEGUIMIENTO — el reloj de cada cliente.
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
 * Por eso este archivo no calcula «en qué punto está» —de eso se encarga
 * `etapas.ts`, que es el vocabulario único— sino CUÁNTO LLEVA AHÍ y si eso
 * ya es un problema. Un estado dice dónde; un reloj dice desde cuándo.
 *
 * ESTE ARCHIVO NO INVENTA SU PROPIA LISTA DE FASES.
 *
 * La tuvo: cinco fases propias que se parecían a las etapas pero no eran las
 * mismas. Con dos vocabularios, la misma tarjeta enseñaba dos etiquetas
 * distintas para lo mismo y había que traducir de cabeza. Ahora los plazos se
 * cuelgan de las etapas de `etapas.ts` y hay un solo idioma en todo el panel.
 *
 * LA IDEA QUE ORDENA LOS PLAZOS: DE QUIÉN ES LA PELOTA
 *
 * El plazo razonable no depende de la etapa, depende de quién tiene que mover
 * ficha. Si la pelota es NUESTRA —hacer el estudio, presentar la oferta—
 * cinco días ya es tarde y la culpa es de casa. Si es del CLIENTE —mandar la
 * factura, contestar a una oferta— hay que darle aire, pero no infinito. Y si
 * es de la COMERCIALIZADORA —activar el suministro— el plazo es largo pero
 * hay que vigilarlo, porque ahí es donde se cae lo ya vendido.
 *
 * Usar el mismo listón para las tres cosas es lo que hace que un panel grite
 * cuando no debe y calle cuando sí.
 */

import {
  ETAPAS, ETAPA, etapaDeCliente, type Etapa,
} from './etapas.ts';

export { ETAPA, ETAPAS, etapaDeCliente };
export type { Etapa };

/** Quién tiene que mover ficha ahora mismo. */
export type Pelota = 'nuestra' | 'del_cliente' | 'de_la_comercializadora';

export const PELOTA_LABEL: Record<Pelota, string> = {
  nuestra: 'Nos toca a nosotros',
  del_cliente: 'Le toca al cliente',
  de_la_comercializadora: 'Le toca a la comercializadora',
};

export interface Plazo {
  pelota: Pelota;
  /** Días a partir de los cuales esto ya es un problema. */
  limiteDias: number;
  /** Qué se está esperando exactamente. Se enseña bajo el título. */
  pista: string;
}

/**
 * El reloj de cada etapa, con su motivo escrito. Un número sin motivo se acaba
 * cambiando por capricho, y entonces el panel deja de significar nada.
 */
export const PLAZOS: Partial<Record<Etapa, Plazo>> = {
  detectado: {
    pelota: 'nuestra', limiteDias: 7,
    // Un detectado es alguien con quien no se ha hecho nada todavía. Una
    // semana sin tocarlo y deja de ser una oportunidad para ser una lista.
    pista: 'Nadie le ha pedido nada aún',
  },
  factura_solicitada: {
    pelota: 'del_cliente', limiteDias: 10,
    // Diez días es lo que tarda alguien en encontrar una factura entre otras
    // cosas. Más allá no es que esté ocupado: es que se ha olvidado, y hay
    // que volver a llamar en vez de seguir esperando.
    pista: 'Sin factura no hay estudio ni oferta',
  },
  en_analisis: {
    pelota: 'nuestra', limiteDias: 5,
    // Cinco días. Aquí no hay a quién echarle la culpa: el cliente hizo su
    // parte y está esperando. Es el atasco más caro porque enfría a alguien
    // que ya había dicho que sí a mirarlo.
    pista: 'Ya tenemos la factura. La pelota es nuestra',
  },
  propuesta_enviada: {
    pelota: 'del_cliente', limiteDias: 4,
    // Cuatro días. Una oferta que no se sigue a la semana se da por perdida
    // sola: el cliente entiende el silencio como que a nosotros tampoco nos
    // importaba tanto.
    pista: 'Presentada y sin respuesta',
  },
  pendiente_decision: {
    pelota: 'del_cliente', limiteDias: 6,
    pista: 'Le estamos esperando a él',
  },
  pendiente_firma: {
    pelota: 'nuestra', limiteDias: 7,
    // Está dicho que sí y lo único que falta es papeleo; que se caiga aquí es
    // el peor final posible.
    pista: 'Falta firma o documentación',
  },
  activacion: {
    pelota: 'de_la_comercializadora', limiteDias: 20,
    // Veinte días es el plazo normal de un cambio de comercializadora. Pasado
    // eso hay que reclamar: casi siempre es un rechazo del ATR que nadie vio.
    pista: 'Firmado. Falta que la comercializadora lo active',
  },
};

/** Las etapas que aparecen en el panel, en orden y solo las que tienen reloj. */
export const ETAPAS_SEGUIMIENTO: Etapa[] = ETAPAS
  .filter((e) => PLAZOS[e.id])
  .sort((a, b) => a.avance - b.avance)
  .map((e) => e.id);

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
  etapa: Etapa;
  /** Días desde el último movimiento. Null si no hay ninguna señal. */
  diasParado: number | null;
  /** Ha pasado del plazo de su etapa. */
  enRojo: boolean;
  /** Qué le falta para poder avanzar, en una frase. */
  queFalta: string;
  ultimoApunte: string | null;
  ultimaFecha: string | null;
  comision: number;
  /** Días hasta que se cierre la ventana de preaviso, si la hay. */
  diasPreaviso: number | null;
  /** Incoherencias entre etiqueta y hechos, ya en castellano. */
  avisos: string[];
}

/**
 * Lo que hay que hacer para que este cliente avance. Una frase, no una lista:
 * la tarjeta se lee de un vistazo o no se lee.
 */
export function queFalta(etapa: Etapa, tieneTelefono: boolean): string {
  if (!tieneTelefono && (etapa === 'factura_solicitada' || etapa === 'detectado')) {
    // Sin teléfono no se puede reclamar nada: hay que ir o buscar el contacto.
    return 'Falta el teléfono: hay que ir o conseguirlo';
  }
  switch (etapa) {
    case 'detectado': return 'Llamar y pedir la factura';
    case 'factura_solicitada': return 'Reclamar la factura';
    case 'en_analisis': return 'Hacer el estudio y preparar la oferta';
    case 'propuesta_enviada': return 'Llamar para saber qué le ha parecido';
    case 'pendiente_decision': return 'Cerrar la decisión';
    case 'pendiente_firma': return 'Cerrar firma y documentación';
    case 'activacion': return 'Comprobar la activación con la comercializadora';
    default: return ETAPA[etapa].condicion;
  }
}

/** ¿Se ha pasado del plazo de su etapa? */
export function estaEnRojo(etapa: Etapa, diasParado: number | null): boolean {
  const p = PLAZOS[etapa];
  return !!p && diasParado != null && diasParado > p.limiteDias;
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
      || (f.enRojo && (f.etapa === 'propuesta_enviada' || f.etapa === 'pendiente_decision' || f.etapa === 'pendiente_firma')))
    .sort((a, b) => {
      // Primero lo que tiene fecha de caducidad real; después lo más parado.
      const pa = a.diasPreaviso ?? 999;
      const pb = b.diasPreaviso ?? 999;
      return pa - pb || (b.diasParado ?? 0) - (a.diasParado ?? 0);
    });
}

/** Recuento por etapa, para los relojes de la cabecera. */
export function relojes(fichas: FichaSeguimiento[]) {
  return ETAPAS_SEGUIMIENTO.map((id) => {
    const plazo = PLAZOS[id]!;
    const suyas = fichas.filter((x) => x.etapa === id);
    const conDias = suyas.map((x) => x.diasParado).filter((d): d is number => d != null);
    return {
      id,
      titulo: ETAPA[id].titulo,
      pista: plazo.pista,
      pelota: plazo.pelota,
      limiteDias: plazo.limiteDias,
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
