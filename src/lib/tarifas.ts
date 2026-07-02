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

export interface OfertaComercializadora {
  comercializadora: string;
  preciosEnergia: number[];
  preciosPotencia: number[];
  coste: CosteCalculado;
  ahorroAnual: number;
  ahorroPorcentaje: number;
}

export interface ResultadoComparativa {
  actual: CosteCalculado;
  ofertas: OfertaComercializadora[];
  mejorOferta: OfertaComercializadora | null;
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
    .select('tarifa, precios_energia, precios_potencia, comercializadoras(nombre)')
    .eq('tarifa', datos.tarifa);

  if (error) {
    console.error('Error cargando tarifas de comercializadoras:', error);
    return { actual, ofertas: [], mejorOferta: null };
  }

  const ofertas: OfertaComercializadora[] = (data || [])
    .filter((row: any) => Array.isArray(row.precios_energia) && Array.isArray(row.precios_potencia))
    .map((row: any) => {
      const coste = calcularCoste(datos, row.precios_energia, row.precios_potencia);
      const ahorroAnual = actual.total - coste.total;
      return {
        comercializadora: row.comercializadoras?.nombre || 'Comercializadora',
        preciosEnergia: row.precios_energia,
        preciosPotencia: row.precios_potencia,
        coste,
        ahorroAnual,
        ahorroPorcentaje: actual.total > 0 ? (ahorroAnual / actual.total) * 100 : 0,
      };
    })
    .sort((a, b) => b.ahorroAnual - a.ahorroAnual);

  return { actual, ofertas, mejorOferta: ofertas[0] || null };
}

/** Guarda el análisis en Supabase (tabla `analisis`). No lanza: devuelve true/false. */
export async function guardarAnalisisWeb(params: {
  nombre: string;
  telefono?: string;
  datos: DatosSuministro;
  resultado: ResultadoComparativa;
}): Promise<boolean> {
  const { nombre, telefono, datos, resultado } = params;
  const mejor = resultado.mejorOferta;

  const { error } = await supabase.from('analisis').insert([
    {
      nombre: nombre || 'Web (sin nombre)',
      telefono: telefono || null,
      tarifa: datos.tarifa,
      coste_actual: Math.round(resultado.actual.total * 100) / 100,
      coste_potencia: Math.round(resultado.actual.totalPotencia * 100) / 100,
      coste_energia: Math.round(resultado.actual.totalEnergia * 100) / 100,
      ahorro_total: mejor ? Math.round(mejor.ahorroAnual * 100) / 100 : 0,
      reduccion_porcentaje: mejor ? Math.round(mejor.ahorroPorcentaje * 10) / 10 : 0,
      consumo_anual: Math.round(datos.consumosMes.reduce((s, c) => s + (c || 0), 0) * 12),
      datos_json: JSON.stringify({
        origen: 'analizador-web',
        suministro: datos,
        ofertas: resultado.ofertas.map((o) => ({
          comercializadora: o.comercializadora,
          costeAnual: Math.round(o.coste.total * 100) / 100,
          ahorroAnual: Math.round(o.ahorroAnual * 100) / 100,
        })),
      }),
      fecha: new Date().toISOString(),
    },
  ]);

  if (error) {
    console.error('Error guardando análisis web:', error);
    return false;
  }
  return true;
}
