/**
 * FACTURA LEÍDA — validación y confianza (GL-05).
 *
 * El plan pide tres cosas que hoy no hacía nadie:
 *
 *   «Marcar cada dato como correcto, dudoso o pendiente de revisión.»
 *   «Bloquear la propuesta solo cuando falte un dato imprescindible;
 *    explicar cuál.»
 *   «Diferenciar claramente dato de factura, dato introducido y cálculo
 *    del sistema.»
 *
 * POR QUÉ IMPORTA TANTO AQUÍ Y NO EN OTRO SITIO
 *
 * Una factura leída por un modelo se equivoca de una manera muy concreta: no
 * devuelve basura evidente, devuelve un número plausible. Un 0,18 €/kWh que en
 * realidad era 0,018. Un consumo de un bimestre metido como mensual. Seis
 * periodos de los que solo se leyeron tres. Nada de eso rompe nada: la
 * comparativa sale, el ahorro sale, el PDF sale, y el error aparece cuando el
 * cliente compara la oferta con su factura de verdad — delante de él.
 *
 * Por eso la salida de este archivo no es «válido / no válido» sino un mapa:
 * qué dato es imprescindible, cuál es solo recomendable, de dónde salió cada
 * uno y cuál merece una segunda mirada.
 *
 * LA REGLA QUE ORDENA TODO: SOLO BLOQUEA LO QUE HACE MENTIR AL CÁLCULO.
 *
 * Que falte el CUPS es un incordio; que falten tres de los seis periodos hace
 * que el coste actual salga a la mitad y el ahorro al doble. Lo primero avisa,
 * lo segundo para la propuesta. Bloquear por todo tendría el mismo efecto que
 * no bloquear por nada: se acabaría saltando el aviso siempre.
 */

import { TARIFA_INFO, numPeriodos, type TarifaAcceso } from './tarifas-base.ts';
import { CONSUMO_MINIMO_CREIBLE } from './luz.ts';

/** De dónde sale cada número. El plan pide no mezclarlos nunca. */
export type Origen = 'factura' | 'introducido' | 'calculado' | 'estimado';

export const ORIGEN_LABEL: Record<Origen, string> = {
  factura: 'Leído de la factura',
  introducido: 'Puesto a mano',
  calculado: 'Calculado por el sistema',
  estimado: 'Estimado, sin dato real',
};

/** Cuánto nos fiamos de un dato concreto. */
export type Confianza = 'correcto' | 'dudoso' | 'falta';

export type Gravedad = 'bloquea' | 'revisar';

export interface Reparo {
  campo: string;
  gravedad: Gravedad;
  /** Qué pasa, en una frase que se pueda leer en voz alta al cliente. */
  texto: string;
  /** Qué hacer para quitarlo de en medio. */
  arreglo: string;
}

export interface FacturaLeida {
  tarifa?: TarifaAcceso | null;
  consumosMes?: (number | null)[] | null;
  potencias?: (number | null)[] | null;
  preciosEnergia?: (number | null)[] | null;
  preciosPotencia?: (number | null)[] | null;
  titular?: string | null;
  cups?: string | null;
  /** Lo que el lector automático quiso avisar por su cuenta. */
  observaciones?: string | null;
}

export interface Revision {
  /** Se puede generar una propuesta con esto delante. */
  puedeOfertar: boolean;
  /** Se puede además enseñar un ahorro (hacen falta los precios actuales). */
  puedeCompararAhorro: boolean;
  reparos: Reparo[];
  confianza: Record<string, Confianza>;
  /** Consumo anual que sale de los consumos mensuales leídos. */
  consumoAnual: number;
}

/**
 * Rangos de cordura. NO son límites legales: son la horquilla en la que cae
 * cualquier factura española real. Fuera de ahí casi siempre hay un decimal
 * corrido o una unidad confundida (€/kW·año leído como €/kW·día), que es
 * justo el error que no se nota hasta que es tarde.
 */
export const RANGO_PRECIO_ENERGIA = { min: 0.03, max: 0.60 };
export const RANGO_PRECIO_POTENCIA = { min: 0.005, max: 0.40 };

/** Tope de la 2.0TD. Por encima, la tarifa leída no puede ser esa. */
export const TOPE_KW_20TD = 15;

const num = (x: unknown): number => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};
const positivos = (xs: (number | null)[] | null | undefined) =>
  (xs || []).map(num).filter((n) => n > 0);

/**
 * Revisa una factura leída y dice qué se puede hacer con ella.
 *
 * Nunca corrige nada. Un dato dudoso se marca y se deja tal cual: adivinar
 * aquí es exactamente el fallo del punto de los miles (ver `leerConsumo`), y
 * un número inventado por el sistema es peor que un hueco, porque el hueco se
 * ve y el número no.
 */
export function revisarFactura(f: FacturaLeida): Revision {
  const reparos: Reparo[] = [];
  const confianza: Record<string, Confianza> = {};
  const pega = (campo: string, gravedad: Gravedad, texto: string, arreglo: string) => {
    reparos.push({ campo, gravedad, texto, arreglo });
    // Un campo que ya bloquea no baja a «dudoso» por un reparo posterior.
    if (confianza[campo] !== 'falta') {
      confianza[campo] = gravedad === 'bloquea' ? 'falta' : 'dudoso';
    }
  };

  // ── Tarifa ────────────────────────────────────────────────────────────────
  const tarifa = f.tarifa && TARIFA_INFO[f.tarifa] ? f.tarifa : null;
  if (!tarifa) {
    pega('tarifa', 'bloquea',
      'No se ha leído la tarifa de acceso (2.0TD, 3.0TD o 6.1TD)',
      'Mírala en la primera página de la factura y ponla a mano');
  } else {
    confianza.tarifa = 'correcto';
  }

  const esperado = tarifa ? numPeriodos(tarifa) : null;

  // ── Consumos ──────────────────────────────────────────────────────────────
  const consumos = (f.consumosMes || []).map(num);
  const consumoAnual = consumos.reduce((s, c) => s + c, 0) * 12;

  if (!positivos(f.consumosMes).length) {
    pega('consumos', 'bloquea',
      'No hay ningún consumo por periodo',
      'Sin kWh no hay coste que comparar: métela del apartado de consumos');
  } else if (esperado && consumos.length !== esperado.energia) {
    // Este es el error caro: con menos periodos de los que toca, el coste
    // actual sale bajo y el ahorro sale inflado. Y no se ve por ningún lado.
    pega('consumos', 'bloquea',
      `Se han leído ${consumos.length} periodos de consumo y la ${TARIFA_INFO[tarifa!].nombre} tiene ${esperado.energia}`,
      'Completa los periodos que faltan: con menos, el ahorro sale inflado');
  } else {
    confianza.consumos = 'correcto';
    if (consumoAnual > 0 && consumoAnual < CONSUMO_MINIMO_CREIBLE) {
      pega('consumos', 'revisar',
        `Salen ${Math.round(consumoAnual)} kWh al año, menos de lo que gasta un garaje`,
        'Casi siempre es un punto de los miles perdido al teclear');
    }
  }

  // ── Potencias ─────────────────────────────────────────────────────────────
  const potencias = (f.potencias || []).map(num);
  if (!positivos(f.potencias).length) {
    pega('potencias', 'bloquea',
      'No hay ninguna potencia contratada',
      'El término de potencia es la mitad de la factura de muchos negocios');
  } else if (esperado && potencias.length !== esperado.potencia) {
    pega('potencias', 'bloquea',
      `Se han leído ${potencias.length} potencias y la ${TARIFA_INFO[tarifa!].nombre} tiene ${esperado.potencia}`,
      'Completa las que faltan antes de calcular nada');
  } else {
    confianza.potencias = 'correcto';
    // En 3.0TD y 6.1TD la potencia contratada no puede decrecer de P1 a P6.
    // Lo exige el reglamento, así que si decrece es que están desordenadas o
    // mal leídas, no que el cliente lo tenga así.
    if (tarifa !== '2.0' && potencias.length > 1) {
      const decrece = potencias.some((p, i) => i > 0 && p > 0 && potencias[i - 1] > 0 && p < potencias[i - 1]);
      if (decrece) {
        pega('potencias', 'revisar',
          'Las potencias bajan de un periodo al siguiente, y eso no está permitido en 3.0TD/6.1TD',
          'Comprueba el orden de los periodos: suelen estar cambiados');
      }
    }
    if (tarifa === '2.0' && Math.max(...potencias) > TOPE_KW_20TD) {
      pega('tarifa', 'revisar',
        `Pone 2.0TD pero hay ${Math.max(...potencias)} kW contratados, y la 2.0TD llega hasta ${TOPE_KW_20TD}`,
        'O la tarifa está mal leída o el suministro es 3.0TD');
    }
  }

  // ── Precios actuales ──────────────────────────────────────────────────────
  // NO BLOQUEAN. Sin ellos se puede ofertar igual —el precio nuevo no depende
  // del viejo—, lo que no se puede es decir cuánto ahorra. Que son dos cosas
  // distintas y tratarlas igual dejaría propuestas sin hacer por un dato que
  // solo sirve para el titular del PDF.
  const precioE = positivos(f.preciosEnergia);
  const precioP = positivos(f.preciosPotencia);
  const puedeCompararAhorro = precioE.length > 0 && precioP.length > 0;

  if (!precioE.length) {
    pega('precios_energia', 'revisar',
      'No se han leído los precios de la energía que paga ahora',
      'Sin ellos se puede ofertar, pero no se puede decir cuánto ahorra');
  } else {
    confianza.precios_energia = 'correcto';
    const fuera = precioE.filter((p) => p < RANGO_PRECIO_ENERGIA.min || p > RANGO_PRECIO_ENERGIA.max);
    if (fuera.length) {
      pega('precios_energia', 'revisar',
        `Hay precios de energía fuera de lo normal (${fuera.map((p) => p.toFixed(4)).join(', ')} €/kWh)`,
        'Casi siempre es un decimal corrido o el precio con impuestos incluidos');
    }
  }

  if (!precioP.length) {
    pega('precios_potencia', 'revisar',
      'No se han leído los precios de la potencia que paga ahora',
      'Búscalos en el desglose: suelen venir en €/kW·año, hay que dividir entre 365');
  } else {
    confianza.precios_potencia = 'correcto';
    const fuera = precioP.filter((p) => p < RANGO_PRECIO_POTENCIA.min || p > RANGO_PRECIO_POTENCIA.max);
    if (fuera.length) {
      pega('precios_potencia', 'revisar',
        `Hay precios de potencia fuera de lo normal (${fuera.map((p) => p.toFixed(4)).join(', ')} €/kW·día)`,
        'Si vienen en €/kW·año hay que dividirlos entre 365');
    }
  }

  // ── Identificación ────────────────────────────────────────────────────────
  // Tampoco bloquea: el estudio se hace igual y el CUPS se completa después.
  // Sin CUPS no se puede tramitar el cambio, así que se avisa, pero parar aquí
  // impediría preparar la oferta que es justo lo que hay que llevar a la visita.
  if (!f.cups) {
    pega('cups', 'revisar',
      'No se ha leído el CUPS del suministro',
      'Hace falta para tramitar el cambio, aunque no para preparar la oferta');
  } else {
    confianza.cups = 'correcto';
  }
  if (!f.titular) {
    pega('titular', 'revisar',
      'No se ha leído el titular del contrato',
      'El contrato hay que hacerlo a nombre del titular actual del suministro');
  } else {
    confianza.titular = 'correcto';
  }

  // Lo que el lector quiso avisar por su cuenta se conserva tal cual: lo pone
  // quien ha visto el documento y nosotros solo tenemos los números.
  if (f.observaciones && f.observaciones.trim()) {
    reparos.push({
      campo: 'lectura', gravedad: 'revisar',
      texto: f.observaciones.trim(),
      arreglo: 'Aviso del lector automático: compruébalo contra el documento',
    });
    confianza.lectura = 'dudoso';
  }

  return {
    puedeOfertar: !reparos.some((r) => r.gravedad === 'bloquea'),
    puedeCompararAhorro,
    reparos,
    confianza,
    consumoAnual,
  };
}

/**
 * Lo que hay que arreglar antes de poder ofertar, en una frase.
 *
 * Existe para el botón: el plan dice que cuando falte algo hay que enseñar qué
 * falta y no dejarlo en «revisar datos». Devuelve null cuando no bloquea nada.
 */
export function porQueNoSePuedeOfertar(r: Revision): string | null {
  const bloqueos = r.reparos.filter((x) => x.gravedad === 'bloquea');
  if (!bloqueos.length) return null;
  if (bloqueos.length === 1) return bloqueos[0].texto;
  return `${bloqueos[0].texto} (y ${bloqueos.length - 1} más)`;
}
