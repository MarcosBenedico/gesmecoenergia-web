/**
 * ÓRDENES DE MAGNITUD DE CONSUMO POR TIPO DE ACTIVIDAD
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  MARCOS: ESTOS NÚMEROS HAY QUE VALIDARLOS.                            │
 * │                                                                       │
 * │  Son cifras de sector, de memoria, no medidas de vuestra cartera.     │
 * │  Sirven para ORDENAR a quién visitar primero, no para ofertar ni para │
 * │  decirle nada a un cliente. Tú tienes cientos de facturas reales de   │
 * │  granjas de la zona: con mirar diez y ajustar los números de abajo,   │
 * │  esto pasa de orientativo a bueno de verdad.                          │
 * │                                                                       │
 * │  Está todo en este archivo y en una sola tabla, a propósito.          │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Por qué se mide el consumo y no el tejado: lo que se vende son placas para
 * ahorrar en la factura. Un tejado enorme sobre un almacén que enciende dos
 * bombillas no vale nada; una granja mediana con ventilación 24 h vale mucho.
 * El tamaño solo importa porque más metros de nave son más animales, y más
 * animales son más ventilación.
 */

export type ActividadConsumo =
  | 'granja_intensiva'
  | 'granja_generica'
  | 'invernadero'
  | 'industria'
  | 'nave_almacen'
  | 'riego'
  | 'taller_comercio'
  | 'desconocido';

interface Perfil {
  etiqueta: string;
  /** kWh al año por m² construido. Valor central. */
  kwh_m2_anio: number;
  /** Cuánto se puede desviar arriba y abajo (0,5 = ±50 %). */
  dispersion: number;
  /** Qué consume, en una frase que David pueda usar en la puerta. */
  motor: string;
  /**
   * Qué parte del consumo cae en horas de sol. Es lo que de verdad decide si
   * las placas amortizan: una granja ventila también de noche, pero el pico
   * de calor —y por tanto de ventilación— es al mediodía.
   */
  encaje_solar: 'excelente' | 'bueno' | 'regular';
}

export const PERFILES: Record<ActividadConsumo, Perfil> = {
  granja_intensiva: {
    etiqueta: 'Granja intensiva',
    kwh_m2_anio: 30,
    dispersion: 0.6,
    motor: 'Ventilación forzada todo el año, motores de alimentación y, en maternidad, calefacción.',
    encaje_solar: 'excelente',
  },
  granja_generica: {
    etiqueta: 'Explotación ganadera',
    kwh_m2_anio: 18,
    dispersion: 0.7,
    motor: 'Ventilación, bombeo de agua y, si hay leche, tanque de frío.',
    encaje_solar: 'bueno',
  },
  invernadero: {
    etiqueta: 'Invernadero',
    kwh_m2_anio: 22,
    dispersion: 0.8,
    motor: 'Riego, climatización y ventiladores.',
    encaje_solar: 'excelente',
  },
  industria: {
    etiqueta: 'Industria',
    kwh_m2_anio: 60,
    dispersion: 0.8,
    motor: 'Maquinaria en horario de trabajo; si hay frío industrial, se dispara.',
    encaje_solar: 'excelente',
  },
  nave_almacen: {
    etiqueta: 'Nave o almacén',
    kwh_m2_anio: 12,
    dispersion: 0.9,
    motor: 'Poco más que iluminación y alguna carretilla, salvo que haya cámara de frío.',
    encaje_solar: 'regular',
  },
  riego: {
    etiqueta: 'Bombeo de riego',
    kwh_m2_anio: 0,
    dispersion: 0.9,
    motor: 'Bombas en campaña: pocos meses, pero mucha potencia y factura muy alta.',
    encaje_solar: 'excelente',
  },
  taller_comercio: {
    etiqueta: 'Taller o comercio',
    kwh_m2_anio: 45,
    dispersion: 0.8,
    motor: 'Iluminación, clima y equipos en horario de apertura.',
    encaje_solar: 'bueno',
  },
  desconocido: {
    etiqueta: 'Sin clasificar',
    kwh_m2_anio: 15,
    dispersion: 1,
    motor: 'No se sabe qué hay dentro: habría que verlo al pasar.',
    encaje_solar: 'regular',
  },
};

export interface RangoConsumo {
  /** kWh/año, extremo bajo del rango. */
  min: number;
  /** kWh/año, extremo alto. */
  max: number;
  /** Valor central, el que se usa para ordenar. */
  centro: number;
  perfil: Perfil;
}

/** Redondea a una cifra significativa y media, para no aparentar precisión. */
function redondear(n: number): number {
  if (n <= 0) return 0;
  const escala = Math.pow(10, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / escala) * escala;
}

/**
 * Rango de consumo anual a partir de los metros construidos.
 * Devuelve null si no hay base para decir nada (sin metros, o riego, que no
 * depende de la superficie sino de las hectáreas regadas).
 */
export function estimarConsumo(actividad: ActividadConsumo, m2_construidos: number): RangoConsumo | null {
  const perfil = PERFILES[actividad];
  if (!perfil.kwh_m2_anio || m2_construidos <= 0) return null;

  const centro = m2_construidos * perfil.kwh_m2_anio;
  return {
    centro: redondear(centro),
    min: redondear(centro * (1 - perfil.dispersion)),
    max: redondear(centro * (1 + perfil.dispersion)),
    perfil,
  };
}

/** "40.000 – 160.000 kWh/año" */
export function textoRango(r: RangoConsumo): string {
  const f = (n: number) => n.toLocaleString('es-ES');
  return `${f(r.min)} – ${f(r.max)} kWh/año`;
}

/**
 * Tramo comercial: cómo de gordo es el cliente. Los cortes son los que separan
 * a efectos de propuesta un autoconsumo pequeño de uno que merece estudio.
 */
export function tramoConsumo(kwh: number): { texto: string; peso: number } {
  if (kwh >= 300000) return { texto: 'Consumo muy alto', peso: 40 };
  if (kwh >= 100000) return { texto: 'Consumo alto', peso: 32 };
  if (kwh >= 40000) return { texto: 'Consumo medio-alto', peso: 24 };
  if (kwh >= 15000) return { texto: 'Consumo medio', peso: 14 };
  return { texto: 'Consumo bajo', peso: 5 };
}
