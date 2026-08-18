/**
 * TARIFAS — la parte que es solo aritmética.
 *
 * Está separada de `tarifas.ts` por un motivo práctico: aquel archivo abre una
 * conexión a Supabase al cargarse, así que cualquier cosa que lo importe deja
 * de poder probarse con `node scripts/test-*.mjs` sin variables de entorno.
 * Los periodos de cada tarifa y la fórmula del coste no necesitan base de
 * datos, y son justo lo que hay que poder probar a solas.
 *
 * `tarifas.ts` reexporta todo esto, así que nada de lo que ya importaba de
 * allí ha cambiado de sitio.
 */

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

export function numPeriodos(tarifa: TarifaAcceso) {
  return {
    energia: TARIFA_INFO[tarifa].periodosEnergia.length,
    potencia: TARIFA_INFO[tarifa].periodosPotencia.length,
  };
}

/**
 * Coste anual: energía = kWh/mes × precio × 12 · potencia = kW × €/kW·día × 365.
 */
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
