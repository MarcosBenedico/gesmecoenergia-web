/**
 * EL ESTUDIO COMPLETO — todo lo que hay que contarle al cliente, calculado.
 *
 * La comparativa dice a qué comercializadora irse. Eso es la mitad del
 * trabajo, y encima la mitad que cualquiera puede hacer con un comparador de
 * internet. La otra mitad es lo que justifica que exista un asesor:
 *
 *   · ¿Le sobra o le falta potencia contratada, y cuánto cuesta eso al año?
 *   · ¿Está pagando reactiva por un factor de potencia malo?
 *   · Si ya tiene placas, ¿cuánto vierte a la red y qué hace con ello?
 *   · ¿Cómo se reparte su consumo por meses y por periodos?
 *
 * Nada de esto sale de la comparativa; sale de la plantilla, que es
 * precisamente lo que hace que valga la pena rellenarla.
 *
 * ESTE ARCHIVO NO CALCULA NADA POR SU CUENTA. Delega:
 *   · potencias → `optimizarPotencias` de potencia.ts, que ya sabe que el
 *     maxímetro manda sobre la curva y que no hay que bajar de lo medido.
 *   · reactiva  → `diagnosticarReactiva`, con su umbral de tan φ.
 *   · costes    → `calcularCoste` de tarifas-base.ts.
 * Aquí solo se juntan y se ordenan para poder contarlos seguidos.
 */

import {
  calcularCoste, TARIFA_INFO, type CosteCalculado, type TarifaAcceso,
} from './tarifas-base.ts';
import {
  optimizarPotencias, diagnosticarReactiva, precioPotenciaDia,
  type LecturaMaximo, type ResultadoOptimizacion, type DiagnosticoReactiva,
} from './potencia.ts';
import type { LecturaPlantilla, FilaMes } from './plantilla-consumos.ts';

/** Un mes con su coste ya calculado, para la tabla del informe. */
export interface MesCalculado {
  mes: string;
  dias: number;
  energia: number[];
  consumoTotal: number;
  maximetro: number[];
  /** Maxímetro más alto del mes, que es el que decide si se pasa. */
  picoMes: number;
  reactiva: number;
  excedentes: number;
  /** Coste de la energía de ese mes con los precios actuales. */
  costeEnergia: number;
  /** Coste del término de potencia de ese mes. */
  costePotencia: number;
  costeTotal: number;
}

export interface RepartoPeriodo {
  periodo: string;
  consumoAnual: number;
  /** Qué parte del consumo total representa, en %. */
  porcentaje: number;
  precio: number;
  costeAnual: number;
}

export interface EstudioCompleto {
  tarifa: TarifaAcceso;
  /** Coste actual con los precios de hoy. */
  actual: CosteCalculado;
  meses: MesCalculado[];
  reparto: RepartoPeriodo[];
  /** Análisis de potencias: subir, bajar o dejarlo. Null si no hay maxímetro. */
  potencia: ResultadoOptimizacion | null;
  /** Reactiva. Null si la factura no la trae. */
  reactiva: DiagnosticoReactiva | null;
  /** Excedentes vertidos al año, kWh. 0 si no tiene autoconsumo. */
  excedentesAnual: number;
  /**
   * Lo que se puede ganar sin cambiar de comercializadora: ajustar potencias.
   * Va aparte del ahorro de la comparativa porque son cosas distintas y
   * sumarlas sin decirlo es la manera de que luego no cuadre nada.
   */
  ahorroPotencia: number;
  /** Mes de más consumo y mes de menos, para hablar de estacionalidad. */
  mesPico: MesCalculado | null;
  mesValle: MesCalculado | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Junta la plantilla y los precios en un estudio que se puede contar entero.
 *
 * `preciosPotenciaAnuales` es opcional: si no se pasa, el análisis de potencia
 * usa los precios regulados de referencia de `potencia.ts`, que están sin
 * validar contra una factura de 2026 y así lo dice el informe.
 */
export function construirEstudio(
  lectura: LecturaPlantilla,
  opciones: { preciosPotenciaAnuales?: number[] } = {}
): EstudioCompleto | null {
  const tarifa = lectura.tarifa;
  if (!tarifa) return null;

  const info = TARIFA_INFO[tarifa];
  const nE = info.periodosEnergia.length;

  const actual = calcularCoste(
    { tarifa, consumosMes: lectura.consumosMes, potencias: lectura.potencias },
    lectura.preciosEnergia,
    lectura.preciosPotencia
  );

  // ── Mes a mes, con su coste ──
  const meses: MesCalculado[] = lectura.meses.map((m: FilaMes) => {
    const costeEnergia = m.energia.reduce(
      (s, kwh, i) => s + kwh * (lectura.preciosEnergia[i] || 0), 0);
    // El término de potencia se paga por días, no por meses: por eso va con
    // los días facturados de ESE mes y no con una media.
    const costePotencia = m.potenciaContratada.reduce(
      (s, kw, i) => s + kw * (lectura.preciosPotencia[i] || 0) * m.dias, 0);
    return {
      mes: m.mes,
      dias: m.dias,
      energia: m.energia,
      consumoTotal: m.energia.reduce((s, v) => s + v, 0),
      maximetro: m.maximetro,
      picoMes: Math.max(0, ...m.maximetro),
      reactiva: m.reactiva,
      excedentes: m.excedentes,
      costeEnergia: r2(costeEnergia),
      costePotencia: r2(costePotencia),
      costeTotal: r2(costeEnergia + costePotencia),
    };
  });

  // ── Reparto por periodo: dónde está el consumo de verdad ──
  const reparto: RepartoPeriodo[] = info.periodosEnergia.slice(0, nE).map((p, i) => {
    const consumoAnual = lectura.consumoAnualPorPeriodo[i] || 0;
    return {
      periodo: p,
      consumoAnual: Math.round(consumoAnual),
      porcentaje: lectura.consumoAnual > 0 ? (consumoAnual / lectura.consumoAnual) * 100 : 0,
      precio: lectura.preciosEnergia[i] || 0,
      costeAnual: r2(consumoAnual * (lectura.preciosEnergia[i] || 0)),
    };
  });

  // ── Potencias ──
  // Cada maxímetro mensual es una lectura. Se le pasan todas al optimizador,
  // que ya sabe cuántas hacen falta para fiarse de un máximo.
  const lecturas: LecturaMaximo[] = [];
  for (const m of lectura.meses) {
    m.maximetro.forEach((kw, i) => {
      if (kw > 0) lecturas.push({ periodo: i + 1, potencia_kw: kw });
    });
  }

  const potencia = lecturas.length
    ? optimizarPotencias({
      tarifa,
      potencias_contratadas: lectura.potencias,
      // Si el cliente nos ha dado sus precios de potencia, mandan los suyos:
      // es lo que paga de verdad. Si no, los regulados de referencia.
      precios_potencia: lectura.preciosPotencia.some((p) => p > 0)
        ? lectura.preciosPotencia
        : precioPotenciaDia(tarifa, opciones.preciosPotenciaAnuales),
      lecturas,
      fuente: 'maximetro',
      dias_analizados: lectura.diasTotales,
    })
    : null;

  // ── Reactiva ──
  const reactiva = lectura.reactivaAnual > 0
    ? diagnosticarReactiva(lectura.reactivaAnual, lectura.consumoAnual)
    : null;

  const conConsumo = meses.filter((m) => m.consumoTotal > 0);
  const ordenados = [...conConsumo].sort((a, b) => b.consumoTotal - a.consumoTotal);

  return {
    tarifa,
    actual,
    meses,
    reparto,
    potencia,
    reactiva,
    excedentesAnual: Math.round(lectura.excedentesAnual),
    ahorroPotencia: potencia ? Math.max(0, potencia.ahorro_anual) : 0,
    mesPico: ordenados[0] || null,
    mesValle: ordenados[ordenados.length - 1] || null,
  };
}

/**
 * Las recomendaciones técnicas en frases, ordenadas por lo que valen.
 *
 * Se devuelven como texto y no como banderas porque van al PDF que lee el
 * cliente: «bajar P3 de 40 a 32 kW ahorra 214 € al año» se entiende; un
 * `{periodo:3, accion:'bajar'}` hay que traducirlo, y quien traduce se
 * equivoca.
 */
export function recomendacionesTecnicas(e: EstudioCompleto): string[] {
  const frases: string[] = [];

  if (e.potencia) {
    const suben = e.potencia.periodos.filter((p) => p.en_exceso);
    const bajan = e.potencia.periodos.filter((p) => !p.en_exceso && p.diferencia_kw > 0.5);

    if (suben.length) {
      // Primero lo que está costando dinero AHORA, no lo que lo ahorraría.
      frases.push(
        `Subir potencia en ${suben.map((p) => `P${p.periodo}`).join(', ')}: el contador ha registrado `
        + `${suben.map((p) => `${p.maxima_medida_kw} kW`).join(' / ')} con `
        + `${suben.map((p) => `${p.contratada_kw} kW`).join(' / ')} contratados.`
      );
    }
    if (bajan.length && e.ahorroPotencia > 0) {
      frases.push(
        `Ajustar potencia en ${bajan.map((p) => `P${p.periodo}`).join(', ')} `
        + `(${bajan.map((p) => `${p.contratada_kw} → ${p.recomendada_kw} kW`).join(', ')}): `
        + `unos ${Math.round(e.ahorroPotencia)} € al año sin tocar nada más.`
      );
    }
    if (e.potencia.cambio_tarifa) {
      frases.push(`Cambiar a ${TARIFA_INFO[e.potencia.cambio_tarifa.a].nombre}: ${e.potencia.cambio_tarifa.porque}`);
    }
    if (e.potencia.puede_cambiar_desde) {
      frases.push(`La potencia no se puede tocar hasta el ${e.potencia.puede_cambiar_desde}: solo se permite un cambio cada 12 meses.`);
    }
  }

  if (e.reactiva?.penaliza) {
    frases.push(
      `Se está pagando energía reactiva (tan φ ${e.reactiva.tan_phi.toFixed(2)}). `
      + 'Una batería de condensadores lo corrige y se amortiza sola.'
    );
  }

  if (e.excedentesAnual > 0) {
    frases.push(
      `Vierte ${e.excedentesAnual.toLocaleString('es-ES')} kWh al año a la red. `
      + 'Conviene revisar que la compensación de excedentes esté bien aplicada en factura.'
    );
  }

  if (e.mesPico && e.mesValle && e.mesValle.consumoTotal > 0) {
    const veces = e.mesPico.consumoTotal / e.mesValle.consumoTotal;
    if (veces >= 2) {
      frases.push(
        `El consumo es muy estacional: ${e.mesPico.mes} gasta ${veces.toFixed(1)} veces `
        + `lo de ${e.mesValle.mes}. Con ese perfil, el precio del periodo punta pesa más de lo normal.`
      );
    }
  }

  return frases;
}
