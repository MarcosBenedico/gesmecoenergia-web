/**
 * Motor de cálculo de tarifas eléctricas
 * Tarifas de acceso: 2.0TD (3 periodos energía, 2 potencia), 3.0TD y 6.1TD (6 y 6)
 * Cálculo anual: energía = kWh/mes × precio × 12 · potencia = kW × precio(€/kW·día) × 365
 */

import { supabase } from './supabase';

export type TarifaAcceso = '2.0' | '3.0' | '6.1';

export const TARIFA_INFO: Record<
  TarifaAcceso,
  {
    nombre: string;
    descripcion: string;
    periodosEnergia: string[];
    periodosPotencia: string[];
  }
> = {
  '2.0': {
    nombre: '2.0TD',
    descripcion: 'Hogares y pequeños negocios (hasta 15 kW)',
    periodosEnergia: ['P1 · Punta', 'P2 · Llano', 'P3 · Valle'],
    periodosPotencia: ['P1 · Punta', 'P2 · Valle'],
  },
  '3.0': {
    nombre: '3.0TD',
    descripcion: 'Negocios y explotaciones (más de 15 kW)',
    periodosEnergia: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
    periodosPotencia: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
  },
  '6.1': {
    nombre: '6.1TD',
    descripcion: 'Industria y alta tensión',
    periodosEnergia: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
    periodosPotencia: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
  },
};

export interface DatosSuministro {
  tarifa: TarifaAcceso;
  /** kWh consumidos en un mes medio, por periodo */
  consumosMes: number[];
  /** kW contratados por periodo */
  potencias: number[];
  /** €/kWh que paga actualmente, por periodo */
  preciosEnergia: number[];
  /** €/kW·día que paga actualmente, por periodo */
  preciosPotencia: number[];
}

export interface DesglosePeriodo {
  periodo: string;
  consumo: number;
  precio: number;
  costeAnual: number;
}

export interface CosteCalculado {
  energia: DesglosePeriodo[];
  potencia: DesglosePeriodo[];
  totalEnergia: number;
  totalPotencia: number;
  total: number;
}

/**
 * Comisión de Gesmeco: se suma SOLO al precio de la energía (€/kWh)
 * y se multiplica por el consumo. El cliente nunca la ve.
 *
 * Margen MÍNIMO (siempre garantizado):
 * - FEE_MIN (0.003) → escenario de MÁXIMO ahorro para el cliente
 * - FEE_MAX (0.008) → escenario de MÍNIMO ahorro para el cliente
 *
 * Banda objetivo de ahorro mostrado al cliente: 20%–30%.
 * Si el ahorro real supera la banda, se SUBE la comisión hasta que
 * el ahorro mostrado quede entre 20% y 30%. Si no se llega a la
 * banda, se aplica solo el margen mínimo (0.003–0.008).
 */
export const FEE_MIN = 0.003;
export const FEE_MAX = 0.008;
export const AHORRO_OBJETIVO_MAX = 0.30; // 30% → tope superior mostrado
export const AHORRO_OBJETIVO_MIN = 0.20; // 20% → tope inferior mostrado

export interface OfertaComercializadora {
  comercializadora: string;
  preciosEnergia: number[];
  preciosPotencia: number[];
  /** Coste anual para el cliente con fee mínimo (mejor caso cliente) */
  costeConFeeMin: CosteCalculado;
  /** Coste anual para el cliente con fee máximo (peor caso cliente) */
  costeConFeeMax: CosteCalculado;
  /** Ahorro anual del cliente en el mejor caso (fee 0.003) */
  ahorroMax: number;
  /** Ahorro anual del cliente en el peor caso (fee 0.008) */
  ahorroMin: number;
}

export interface ResultadoComparativa {
  actual: CosteCalculado;
  /** Uso interno / Supabase. NO mostrar al cliente. */
  ofertas: OfertaComercializadora[];
  /** Mejor oferta interna. NO mostrar nombre ni precios al cliente. */
  mejorOferta: OfertaComercializadora | null;
  /** Horquilla de ahorro anual a mostrar al cliente (ya acotada a >= 0) */
  rangoAhorro: { min: number; max: number; minPct: number; maxPct: number } | null;
  /**
   * Fee realmente aplicado tras ajustar a la banda 20-30% (interno).
   * paraAhorroMax → fee del extremo superior mostrado (el más bajo)
   * paraAhorroMin → fee del extremo inferior mostrado (el más alto)
   */
  feeAplicado: { paraAhorroMax: number; paraAhorroMin: number; ajustado: boolean };
  /** Comisión anual estimada para Gesmeco (interno): consumo anual × fee aplicado */
  comisionEstimada: { min: number; max: number };
}

export function numPeriodos(tarifa: TarifaAcceso) {
  return {
    energia: TARIFA_INFO[tarifa].periodosEnergia.length,
    potencia: TARIFA_INFO[tarifa].periodosPotencia.length,
  };
}

export function calcularCoste(
  datos: Pick<DatosSuministro, 'tarifa' | 'consumosMes' | 'potencias'>,
  preciosEnergia: number[],
  preciosPotencia: number[]
): CosteCalculado {
  const info = TARIFA_INFO[datos.tarifa];

  const energia = info.periodosEnergia.map((periodo, i) => {
    const consumo = datos.consumosMes[i] || 0;
    const precio = preciosEnergia[i] || 0;
    return { periodo, consumo, precio, costeAnual: consumo * precio * 12 };
  });

  const potencia = info.periodosPotencia.map((periodo, i) => {
    const kw = datos.potencias[i] || 0;
    const precio = preciosPotencia[i] || 0;
    return { periodo, consumo: kw, precio, costeAnual: kw * precio * 365 };
  });

  const totalEnergia = energia.reduce((s, p) => s + p.costeAnual, 0);
  const totalPotencia = potencia.reduce((s, p) => s + p.costeAnual, 0);

  return { energia, potencia, totalEnergia, totalPotencia, total: totalEnergia + totalPotencia };
}

/**
 * Compara el coste actual del cliente contra todas las comercializadoras
 * con precios guardados en Supabase para su tarifa (Nufri, Alcanzia, ...).
 */
export async function compararConComercializadoras(
  datos: DatosSuministro
): Promise<ResultadoComparativa> {
  const actual = calcularCoste(datos, datos.preciosEnergia, datos.preciosPotencia);

  const { data, error } = await supabase
    .from('precios_comercializadoras')
    .select('*, comercializadoras(nombre)')
    .eq('tarifa', datos.tarifa);

  if (error) {
    console.error('Error cargando tarifas de comercializadoras:', error);
    return {
      actual,
      ofertas: [],
      mejorOferta: null,
      rangoAhorro: null,
      feeAplicado: { paraAhorroMax: FEE_MIN, paraAhorroMin: FEE_MAX, ajustado: false },
      comisionEstimada: { min: 0, max: 0 },
    };
  }

  const consumoAnual = datos.consumosMes.reduce((s, c) => s + (c || 0), 0) * 12;

  // Solo ofertas VIGENTES hoy: sin fechas = siempre válida; con fechas, hoy dentro del rango
  const hoy = new Date().toISOString().slice(0, 10);
  const vigente = (row: any) =>
    (!row.fecha_inicio || row.fecha_inicio <= hoy) && (!row.fecha_fin || row.fecha_fin >= hoy);

  const ofertas: OfertaComercializadora[] = (data || [])
    .filter((row: any) => Array.isArray(row.precios_energia) && Array.isArray(row.precios_potencia) && vigente(row))
    .map((row: any) => {
      // Fee sumado SOLO a los precios de energía, nunca a la potencia
      const preciosFeeMin = row.precios_energia.map((p: number) => p + FEE_MIN);
      const preciosFeeMax = row.precios_energia.map((p: number) => p + FEE_MAX);
      const costeConFeeMin = calcularCoste(datos, preciosFeeMin, row.precios_potencia);
      const costeConFeeMax = calcularCoste(datos, preciosFeeMax, row.precios_potencia);
      return {
        comercializadora: row.comercializadoras?.nombre || 'Comercializadora',
        preciosEnergia: row.precios_energia,
        preciosPotencia: row.precios_potencia,
        costeConFeeMin,
        costeConFeeMax,
        ahorroMax: actual.total - costeConFeeMin.total,
        ahorroMin: actual.total - costeConFeeMax.total,
      };
    })
    .sort((a, b) => b.ahorroMax - a.ahorroMax);

  const mejorOferta = ofertas[0] || null;

  // ── Ajuste del fee a la banda de ahorro 20%-30% ──
  // Ahorro con fee f (lineal): ahorro(f) = ahorroSinFee − consumoAnual × f
  // → fee necesario para un ahorro objetivo S: f = (ahorroSinFee − S) / consumoAnual
  let rangoAhorro: ResultadoComparativa['rangoAhorro'] = null;
  let feeAplicado = { paraAhorroMax: FEE_MIN, paraAhorroMin: FEE_MAX, ajustado: false };

  if (mejorOferta && consumoAnual > 0) {
    const costeSinFee = calcularCoste(
      datos,
      mejorOferta.preciosEnergia,
      mejorOferta.preciosPotencia
    );
    const ahorroSinFee = actual.total - costeSinFee.total;

    const feeParaObjetivo = (objetivoPct: number) =>
      (ahorroSinFee - actual.total * objetivoPct) / consumoAnual;

    // Extremo superior mostrado (máx. 30%): nunca por debajo del fee mínimo
    const feeSup = Math.max(FEE_MIN, feeParaObjetivo(AHORRO_OBJETIVO_MAX));
    // Extremo inferior mostrado (máx. 20%): nunca por debajo del fee máximo base
    const feeInf = Math.max(FEE_MAX, feeParaObjetivo(AHORRO_OBJETIVO_MIN));

    const ahorroMaxMostrado = ahorroSinFee - consumoAnual * feeSup;
    const ahorroMinMostrado = Math.max(0, ahorroSinFee - consumoAnual * feeInf);

    feeAplicado = {
      paraAhorroMax: Math.round(feeSup * 1e6) / 1e6,
      paraAhorroMin: Math.round(feeInf * 1e6) / 1e6,
      ajustado: feeSup > FEE_MIN || feeInf > FEE_MAX,
    };

    if (ahorroMaxMostrado > 0) {
      rangoAhorro = {
        min: ahorroMinMostrado,
        max: ahorroMaxMostrado,
        minPct: actual.total > 0 ? (ahorroMinMostrado / actual.total) * 100 : 0,
        maxPct: actual.total > 0 ? (ahorroMaxMostrado / actual.total) * 100 : 0,
      };
    }
  }

  return {
    actual,
    ofertas,
    mejorOferta,
    rangoAhorro,
    feeAplicado,
    comisionEstimada: {
      min: consumoAnual * feeAplicado.paraAhorroMax,
      max: consumoAnual * feeAplicado.paraAhorroMin,
    },
  };
}

/** Guarda el análisis en Supabase (tabla `analisis`). No lanza: devuelve true/false. */
export async function guardarAnalisisWeb(params: {
  nombre: string;
  telefono?: string;
  datos: DatosSuministro;
  resultado: ResultadoComparativa;
}): Promise<boolean> {
  const { nombre, telefono, datos, resultado } = params;
  const rango = resultado.rangoAhorro;
  const info = TARIFA_INFO[datos.tarifa];
  const r2 = (n: number) => Math.round(n * 100) / 100;

  // Mapea un array de valores a { "P1 · Punta": valor, ... } para lectura fácil
  const porPeriodo = (labels: string[], valores: number[]) =>
    Object.fromEntries(labels.map((label, i) => [label, valores[i] ?? 0]));

  const { error } = await supabase.from('analisis').insert([
    {
      nombre: nombre || 'Web (sin nombre)',
      telefono: telefono || null,
      tarifa: datos.tarifa,
      coste_actual: r2(resultado.actual.total),
      coste_potencia: r2(resultado.actual.totalPotencia),
      coste_energia: r2(resultado.actual.totalEnergia),
      ahorro_total: rango ? r2(rango.max) : 0,
      reduccion_porcentaje: rango ? Math.round(rango.maxPct * 10) / 10 : 0,
      consumo_anual: Math.round(datos.consumosMes.reduce((s, c) => s + (c || 0), 0) * 12),
      datos_json: {
        origen: 'analizador-web',

        '1_cliente': { nombre: nombre || null, telefono: telefono || null },

        '2_suministro': {
          tarifa: info.nombre,
          consumos_kwh_mes: porPeriodo(info.periodosEnergia, datos.consumosMes),
          potencias_contratadas_kw: porPeriodo(info.periodosPotencia, datos.potencias),
        },

        '3_precios_actuales_cliente': {
          energia_eur_kwh: porPeriodo(info.periodosEnergia, datos.preciosEnergia),
          potencia_eur_kw_dia: porPeriodo(info.periodosPotencia, datos.preciosPotencia),
        },

        '4_coste_actual_anual': {
          energia: r2(resultado.actual.totalEnergia),
          potencia: r2(resultado.actual.totalPotencia),
          total: r2(resultado.actual.total),
        },

        '5_mostrado_al_cliente': rango
          ? {
              ahorro_min_eur: r2(rango.min),
              ahorro_max_eur: r2(rango.max),
              ahorro_min_pct: Math.round(rango.minPct * 10) / 10,
              ahorro_max_pct: Math.round(rango.maxPct * 10) / 10,
            }
          : 'Sin ahorro mostrado (tarifa bien negociada)',

        '6_fee_aplicado': {
          fee_extremo_ahorro_max: resultado.feeAplicado.paraAhorroMax,
          fee_extremo_ahorro_min: resultado.feeAplicado.paraAhorroMin,
          ajustado_a_banda_20_30: resultado.feeAplicado.ajustado,
          fee_base_min: FEE_MIN,
          fee_base_max: FEE_MAX,
        },

        '7_comision_estimada_anual': {
          min_eur: r2(resultado.comisionEstimada.min),
          max_eur: r2(resultado.comisionEstimada.max),
        },

        '8_mejor_comercializadora': resultado.mejorOferta
          ? {
              nombre: resultado.mejorOferta.comercializadora,
              precios_energia_base: porPeriodo(
                info.periodosEnergia,
                resultado.mejorOferta.preciosEnergia
              ),
              precios_potencia_base: porPeriodo(
                info.periodosPotencia,
                resultado.mejorOferta.preciosPotencia
              ),
            }
          : null,

        '9_todas_las_ofertas': resultado.ofertas.map((o) => ({
          comercializadora: o.comercializadora,
          ahorro_max_con_fee_base: r2(o.ahorroMax),
          ahorro_min_con_fee_base: r2(o.ahorroMin),
        })),
      },
      fecha: new Date().toISOString(),
    },
  ]);

  if (error) {
    console.error('Error guardando análisis web:', error);
    return false;
  }
  return true;
}
