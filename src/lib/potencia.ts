/**
 * OPTIMIZADOR DE POTENCIAS Y LECTURA DE LA CURVA.
 *
 * Todo lo que convierte el dato crudo de Datadis en un euro que enseñar al
 * cliente. Sin red y sin base de datos, para que los tests lo ejecuten tal cual
 * (`npm run test:potencia`), porque aquí un error no se ve en pantalla: se ve en
 * la factura de un cliente dentro de dos meses.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EL CRITERIO POR DEFECTO ES *NUNCA BAJAR DE LO MEDIDO*
 *
 * La tentación es plantear esto como una optimización fina: bajo la potencia
 * hasta que el ahorro del término fijo se coma la penalización por excesos.
 * Con los datos que tenemos eso es una trampa, y conviene entender por qué.
 *
 * El maxímetro de Datadis da UN máximo por periodo y mes. La penalización real
 * se cobra por CADA cuarto de hora en exceso. Así que si calculo la penalización
 * sumando los máximos mensuales, estoy contando un cuarto de hora por mes
 * cuando puede haber habido cincuenta. El resultado es que bajar la potencia
 * *parece* más barato de lo que es, y el optimizador recomendaría dejar al
 * cliente corto. Ese error no lo paga la hoja de cálculo, lo paga él.
 *
 * Por eso el modo por defecto (`prudente`) no baja nunca por debajo del máximo
 * medido más un margen: el ahorro sale de lo que sobra, que es donde de verdad
 * está el dinero —casi todo el mundo tiene contratado bastante más de lo que ha
 * usado nunca—, y no de apurar el límite.
 *
 * El modo `agresivo` existe porque a veces un pico anual aislado no justifica
 * pagar potencia todo el año, pero devuelve la penalización marcada como COTA
 * INFERIOR y así lo dice la pantalla. No es el modo por defecto a propósito.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { TarifaAcceso } from './tarifas.ts';

/**
 * Precio del término de exceso de potencia para tarifas de 6 periodos, €/kW.
 *
 * PENDIENTE DE VALIDAR CONTRA UNA FACTURA REAL, igual que los coeficientes de
 * `consumo-estimado.ts`. Está aquí solo, con nombre, para que se cambie en un
 * sitio y no haya cinco copias por el código. Mientras no esté comprobado, la
 * penalización que sale de aquí es orientativa y la pantalla lo advierte.
 */
export const KE_EXCESO_EUR_KW = 1.4064;

/** Margen de seguridad sobre el máximo medido, en tanto por uno. */
export const MARGEN_PRUDENTE = 0.05;

/**
 * Precios del término de potencia, €/kW·AÑO (peaje + cargos), por periodo.
 *
 * El término de potencia es regulado: lo fija la CNMC y es el mismo para todo el
 * mundo, así que se puede tener aquí en vez de pedírselo al cliente. Lo que NO
 * es fijo es el año: se revisan por resolución, y estos son los valores de
 * referencia que circulan desde la entrada de las tarifas TD.
 *
 * ESTÁN SIN VALIDAR CONTRA UNA FACTURA DE 2026. Se pueden sobreescribir sin
 * tocar código desde `luz_config`, clave `precios_potencia_kw_anio`, y la
 * pantalla avisa cuando el euro sale de estos valores por defecto y no de unos
 * revisados. Mientras no se validen, el ahorro en kW es sólido y el ahorro en €
 * es orientativo.
 */
export const PRECIOS_POTENCIA_REFERENCIA: Record<TarifaAcceso, number[]> = {
  // 2.0TD: solo dos periodos de potencia (punta y valle)
  '2.0': [30.67266, 1.4243],
  '3.0': [22.988759, 17.175671, 8.364901, 6.618875, 3.025769, 1.957593],
  // La 6.1TD es alta tensión y tiene sus propios valores, bastante más bajos
  '6.1': [17.6, 13.16, 6.4, 5.07, 2.32, 1.5],
};

/** De €/kW·año a €/kW·día, que es lo que come `calcularCoste` en tarifas.ts. */
export function precioPotenciaDia(tarifa: TarifaAcceso, anuales?: number[]): number[] {
  const base = anuales?.length ? anuales : PRECIOS_POTENCIA_REFERENCIA[tarifa];
  return base.map((v) => (Number(v) || 0) / 365);
}

/** Por debajo de esta potencia en todos los periodos, la tarifa que toca es la 2.0TD. */
export const UMBRAL_20TD_KW = 15;

/** tan φ a partir del cual la reactiva se penaliza (equivale a cos φ < 0,95). */
export const TAN_PHI_PENALIZA = 0.33;

/** Una potencia contratada solo se puede cambiar una vez cada 12 meses. */
export const MESES_ENTRE_CAMBIOS = 12;

// ── Entradas ───────────────────────────────────────────────────────────────

/** Una lectura de máximo: de dónde sale el periodo importa, ver `FuenteDemanda`. */
export interface LecturaMaximo {
  periodo: number;
  potencia_kw: number;
  fecha?: string;
}

/**
 * De dónde viene la demanda por periodo. Cambia la confianza del resultado.
 *
 *  · `maximetro`   — lo dice la distribuidora, con su propio reparto de periodos
 *                    y su propio máximo cuartohorario. Es la buena.
 *  · `curva_horaria` — deducida de kWh por hora. Una hora es un promedio, así que
 *                    APLANA los picos: la demanda real fue mayor. Sirve para el
 *                    perfil, no para apurar la potencia.
 */
export type FuenteDemanda = 'maximetro' | 'curva_horaria';

export interface EntradaOptimizacion {
  tarifa: TarifaAcceso;
  /** kW contratados hoy, P1..Pn. */
  potencias_contratadas: number[];
  /** €/kW·día por periodo. Sin esto no hay euros, solo kW. */
  precios_potencia: number[];
  /** Todas las lecturas de máximo disponibles del rango analizado. */
  lecturas: LecturaMaximo[];
  fuente: FuenteDemanda;
  /** Días que cubre el análisis. Se anualiza a 365 para hablar en €/año. */
  dias_analizados: number;
  modo?: 'prudente' | 'agresivo';
  margen?: number;
  /** Inicio del contrato actual: para saber si ya se puede cambiar la potencia. */
  fecha_inicio_contrato?: string | null;
}

// ── Salidas ────────────────────────────────────────────────────────────────

export interface PeriodoOptimizado {
  periodo: number;
  contratada_kw: number;
  /** Máximo medido en el periodo. 0 si no hay lecturas de ese periodo. */
  maxima_medida_kw: number;
  /** Cuántas lecturas respaldan ese máximo. Con una sola, poca confianza. */
  lecturas: number;
  recomendada_kw: number;
  /** kW que sobran (positivo) o que faltan (negativo). */
  diferencia_kw: number;
  /** € al año que se ahorran solo en el término de potencia de este periodo. */
  ahorro_anual: number;
  /** True si está consumiendo por encima de lo contratado: hay penalización. */
  en_exceso: boolean;
}

export type Confianza = 'alta' | 'media' | 'baja';

export interface ResultadoOptimizacion {
  periodos: PeriodoOptimizado[];
  coste_actual_anual: number;
  coste_optimo_anual: number;
  /** Lo que se ahorra al año. Nunca negativo: si no hay nada, es 0. */
  ahorro_anual: number;
  /** Penalización estimada por excesos. Cota INFERIOR, ver cabecera del archivo. */
  penalizacion_estimada: number;
  confianza: Confianza;
  /** Frases listas para enseñar. Cada una es una acción o un riesgo, no relleno. */
  avisos: string[];
  /** Si conviene cambiar de tarifa de acceso, cuál y por qué. */
  cambio_tarifa: { a: TarifaAcceso; porque: string } | null;
  /** Cuándo se puede tocar la potencia, si hay que esperar. */
  puede_cambiar_desde: string | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Cuántos periodos de potencia tiene cada tarifa. */
export function periodosPotencia(tarifa: TarifaAcceso): number {
  return tarifa === '2.0' ? 2 : 6;
}

/**
 * Máximo medido por periodo, y con cuántas lecturas se sostiene.
 * Se ignoran periodos fuera de rango: un dato corrupto no debe crear un P7.
 */
export function demandaPorPeriodo(
  lecturas: LecturaMaximo[],
  nPeriodos: number
): { max: number[]; cuenta: number[] } {
  const max = new Array(nPeriodos).fill(0);
  const cuenta = new Array(nPeriodos).fill(0);
  for (const l of lecturas) {
    const i = l.periodo - 1;
    if (i < 0 || i >= nPeriodos) continue;
    const kw = Number(l.potencia_kw);
    if (!Number.isFinite(kw) || kw <= 0) continue;
    cuenta[i]++;
    if (kw > max[i]) max[i] = kw;
  }
  return { max, cuenta };
}

/**
 * Penalización por excesos, como COTA INFERIOR.
 *
 * Cuenta un cuarto de hora en exceso por cada lectura que supere lo contratado.
 * La realidad puede ser muchas veces peor, porque los excesos se cobran por
 * cada cuarto de hora y aquí solo se ven los máximos. Se llama cota inferior
 * justamente para que nadie la lea como «esto es lo que costará».
 */
export function penalizacionExcesos(
  lecturas: LecturaMaximo[],
  contratadas: number[],
  ke = KE_EXCESO_EUR_KW
): number {
  let total = 0;
  for (const l of lecturas) {
    const pc = contratadas[l.periodo - 1];
    if (!Number.isFinite(pc) || pc <= 0) continue;
    const exceso = l.potencia_kw - pc;
    if (exceso > 0) total += ke * exceso;
  }
  return r2(total);
}

/**
 * Cuándo se puede volver a cambiar la potencia contratada.
 * Devuelve null si ya se puede hoy (o si no sabemos la fecha de inicio).
 */
export function proximoCambioPotencia(
  fechaInicioContrato: string | null | undefined,
  hoy = new Date()
): string | null {
  if (!fechaInicioContrato) return null;
  const inicio = new Date(fechaInicioContrato + 'T00:00:00Z');
  if (Number.isNaN(inicio.getTime())) return null;
  const permitido = new Date(inicio);
  permitido.setUTCMonth(permitido.getUTCMonth() + MESES_ENTRE_CAMBIOS);
  if (permitido <= hoy) return null;
  return permitido.toISOString().slice(0, 10);
}

/**
 * El cálculo principal.
 *
 * Anualiza a 365 días desde los días realmente analizados: comparar un análisis
 * de 3 meses con uno de 12 sin anualizar daría ahorros que no se parecen entre
 * sí y nadie se creería la cifra.
 */
export function optimizarPotencias(entrada: EntradaOptimizacion): ResultadoOptimizacion {
  const n = periodosPotencia(entrada.tarifa);
  const modo = entrada.modo || 'prudente';
  const margen = entrada.margen ?? MARGEN_PRUDENTE;
  const dias = Math.max(1, entrada.dias_analizados || 365);

  const { max, cuenta } = demandaPorPeriodo(entrada.lecturas, n);
  const contratadas = Array.from({ length: n }, (_, i) => Number(entrada.potencias_contratadas[i]) || 0);
  const precios = Array.from({ length: n }, (_, i) => Number(entrada.precios_potencia[i]) || 0);

  const avisos: string[] = [];

  // ── Recomendación por periodo ──
  const recomendadas = max.map((medida, i) => {
    // Sin lecturas de ese periodo no se toca: bajar a ciegas es como no medir.
    if (cuenta[i] === 0) return contratadas[i];

    if (modo === 'prudente') {
      const conMargen = medida * (1 + margen);
      // Nunca por debajo de lo medido, pero tampoco se sube por encima de lo
      // que ya tiene contratado si le sobra: eso sería inventarse una subida.
      return Math.max(conMargen, medida);
    }
    // Agresivo: se queda en lo medido justo, sin margen.
    return medida;
  });

  // ── Euros ──
  const periodos: PeriodoOptimizado[] = recomendadas.map((rec, i) => {
    const anualActual = contratadas[i] * precios[i] * 365;
    const anualOptimo = rec * precios[i] * 365;
    return {
      periodo: i + 1,
      contratada_kw: r2(contratadas[i]),
      maxima_medida_kw: r2(max[i]),
      lecturas: cuenta[i],
      recomendada_kw: r2(rec),
      diferencia_kw: r2(contratadas[i] - rec),
      ahorro_anual: r2(Math.max(0, anualActual - anualOptimo)),
      en_exceso: cuenta[i] > 0 && max[i] > contratadas[i],
    };
  });

  const costeActual = r2(contratadas.reduce((s, kw, i) => s + kw * precios[i] * 365, 0));
  const costeOptimo = r2(recomendadas.reduce((s, kw, i) => s + kw * precios[i] * 365, 0));

  // La penalización se anualiza igual que el resto, con los datos que haya.
  const penalizacionRango = penalizacionExcesos(entrada.lecturas, contratadas);
  const penalizacion = r2((penalizacionRango * 365) / dias);

  // ── Confianza ──
  // Es tan importante como la cifra: un ahorro de 900 € con confianza baja no
  // se le enseña a un cliente como si fuera un presupuesto.
  const periodosConDatos = cuenta.filter((c) => c > 0).length;
  const lecturasTotales = cuenta.reduce((s, c) => s + c, 0);
  let confianza: Confianza = 'alta';
  if (entrada.fuente === 'curva_horaria') confianza = 'baja';
  else if (periodosConDatos < n || lecturasTotales < 6 || dias < 90) confianza = 'media';

  if (entrada.fuente === 'curva_horaria') {
    avisos.push(
      'Demanda deducida de la curva horaria: una hora es un promedio y aplana los picos, así que la real fue mayor. No ajustes potencias con esto, pide los maxímetros.'
    );
  }
  if (periodosConDatos < n) {
    const faltan = cuenta.map((c, i) => (c === 0 ? `P${i + 1}` : null)).filter(Boolean).join(', ');
    avisos.push(`Sin lecturas en ${faltan}: esos periodos se dejan como están, no se recomienda nada a ciegas.`);
  }
  if (dias < 365) {
    avisos.push(`Análisis de ${dias} días anualizado a 365. Con un año completo entra el pico de verano y el de invierno, que es cuando se decide la potencia.`);
  }

  // ── Excesos: aquí el consejo es subir, no bajar ──
  const enExceso = periodos.filter((p) => p.en_exceso);
  if (enExceso.length) {
    avisos.push(
      `Consumo por encima de lo contratado en ${enExceso.map((p) => `P${p.periodo}`).join(', ')}: está pagando penalización por excesos. Aquí toca SUBIR potencia, y la cifra de penalización es una cota inferior.`
    );
  }

  // ── ¿Se está en la tarifa que toca? ──
  let cambioTarifa: ResultadoOptimizacion['cambio_tarifa'] = null;
  const topeRecomendado = Math.max(...recomendadas.filter((_, i) => cuenta[i] > 0), 0);
  if (entrada.tarifa === '3.0' && periodosConDatos === n && topeRecomendado > 0 && topeRecomendado <= UMBRAL_20TD_KW) {
    cambioTarifa = {
      a: '2.0',
      porque: `Nunca ha pasado de ${r2(topeRecomendado)} kW y la 3.0TD es para más de ${UMBRAL_20TD_KW} kW. Pasar a 2.0TD suele valer más que ajustar las seis potencias, pero hay que comprobar el coste del cambio con la distribuidora.`,
    };
  }
  if (entrada.tarifa === '2.0' && topeRecomendado > UMBRAL_20TD_KW) {
    cambioTarifa = {
      a: '3.0',
      porque: `Ha llegado a ${r2(topeRecomendado)} kW, por encima del límite de la 2.0TD. Con la 3.0TD se contratan seis potencias y se puede pedir mucha menos en las horas flojas.`,
    };
  }

  const puedeCambiarDesde = proximoCambioPotencia(entrada.fecha_inicio_contrato);
  if (puedeCambiarDesde) {
    avisos.push(`La potencia solo se cambia una vez cada 12 meses: la siguiente ventana es a partir del ${puedeCambiarDesde}.`);
  }

  return {
    periodos,
    coste_actual_anual: costeActual,
    coste_optimo_anual: costeOptimo,
    ahorro_anual: r2(Math.max(0, costeActual - costeOptimo)),
    penalizacion_estimada: penalizacion,
    confianza,
    avisos,
    cambio_tarifa: cambioTarifa,
    puede_cambiar_desde: puedeCambiarDesde,
  };
}

// ── Calendario de periodos ─────────────────────────────────────────────────

/**
 * A qué periodo cae una hora concreta, para repartir la curva.
 *
 * OJO CON PARA QUÉ SE USA ESTO: el reparto bueno de periodos es el que manda la
 * distribuidora en el maxímetro, y es el que usa el optimizador. Esto es para
 * el perfil de consumo —cuánto se gasta en punta y cuánto en valle—, donde un
 * puñado de horas mal clasificadas no mueve una decisión.
 *
 * Calendario peninsular. No cubre Canarias, Baleares, Ceuta y Melilla, que
 * tienen tramos propios, ni los festivos autonómicos (solo los nacionales).
 */
const TEMPORADAS: Record<number, number> = {
  1: 1, 2: 1, 7: 1, 12: 1,   // alta:       punta P1, llano P2
  3: 2, 11: 2,               // media-alta: punta P2, llano P3
  6: 3, 8: 3, 9: 3,          // media:      punta P3, llano P4
  4: 4, 5: 4, 10: 4,         // baja:       punta P4, llano P5
};

/** Domingo de Pascua por el algoritmo de Gauss; hace falta para el Viernes Santo. */
function domingoPascua(anio: number): Date {
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anio, mes - 1, dia));
}

/** Festivos de ámbito nacional. Los autonómicos no cuentan para el calendario TD. */
export function esFestivoNacional(fecha: string): boolean {
  const d = new Date(fecha + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return false;
  const mmdd = `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const fijos = ['01-01', '01-06', '05-01', '08-15', '10-12', '11-01', '12-06', '12-08', '12-25'];
  if (fijos.includes(mmdd)) return true;

  const pascua = domingoPascua(d.getUTCFullYear());
  const viernesSanto = new Date(pascua);
  viernesSanto.setUTCDate(viernesSanto.getUTCDate() - 2);
  return viernesSanto.toISOString().slice(0, 10) === fecha;
}

/** Periodo (1..6 en 3.0/6.1, 1..3 en 2.0) de una hora dada. */
export function periodoDeHora(fecha: string, hora: string, tarifa: TarifaAcceso): number {
  const d = new Date(fecha + 'T00:00:00Z');
  const h = Number(String(hora).slice(0, 2));
  const diaSemana = d.getUTCDay(); // 0 domingo, 6 sábado
  const noLaborable = diaSemana === 0 || diaSemana === 6 || esFestivoNacional(fecha);

  if (tarifa === '2.0') {
    if (noLaborable || h < 8) return 3;                       // valle
    if ((h >= 10 && h < 14) || (h >= 18 && h < 22)) return 1; // punta
    return 2;                                                  // llano
  }

  // 3.0TD y 6.1TD: P6 se come las noches y todo el fin de semana y festivos
  if (noLaborable || h < 8) return 6;
  const t = TEMPORADAS[d.getUTCMonth() + 1] || 4;
  const esPunta = (h >= 9 && h < 14) || (h >= 18 && h < 22);
  return esPunta ? t : t + 1;
}

// ── Lectura de la curva ────────────────────────────────────────────────────

export interface HoraCurva {
  fecha: string;
  hora: string;
  consumo_kwh: number;
  excedente_kwh?: number | null;
  metodo?: string;
}

export interface PerfilConsumo {
  /** kWh totales del rango. */
  total_kwh: number;
  /** kWh repartidos por periodo, según el calendario de arriba. */
  por_periodo: number[];
  /** % del total en cada periodo. */
  pct_por_periodo: number[];
  /** Media de kWh por cada hora del día, 0..23. Es la forma del consumo. */
  media_por_hora: number[];
  /** % del consumo que cae en horas con sol (8-18). El dato que quiere la FV. */
  pct_horas_solares: number;
  /** Horas con dato sobre las esperadas del rango: si baja de 90 %, hay huecos. */
  cobertura_pct: number;
  /** Cuántas horas vienen marcadas como estimadas por la distribuidora. */
  horas_estimadas: number;
  /** Días distintos con al menos una hora. Es lo que se usa para anualizar. */
  dias_con_dato: number;
  /** Máximo horario, en kW medios. NO es la potencia máxima: ver aviso. */
  punta_horaria_kw: number;
}

/**
 * Franja con sol aprovechable, en horas locales. Deliberadamente ancha y
 * conservadora: no es una simulación solar, es «cuánto consume mientras hay
 * luz». Lo fino lo hace `simularDiaFV` en fv.ts con la curva ya cargada.
 */
const HORA_SOL_INICIO = 8;
const HORA_SOL_FIN = 18;

/**
 * Resume la curva. Es lo que alimenta a la vez el perfil que se le enseña al
 * cliente y el `pct_autoconsumo` de la calculadora FV, que hasta ahora era una
 * hipótesis escrita a mano.
 */
export function perfilDeCurva(horas: HoraCurva[], tarifa: TarifaAcceso): PerfilConsumo {
  const nPeriodos = tarifa === '2.0' ? 3 : 6;
  const porPeriodo = new Array(nPeriodos).fill(0);
  const sumaHora = new Array(24).fill(0);
  const cuentaHora = new Array(24).fill(0);
  const dias = new Set<string>();

  let total = 0;
  let solares = 0;
  let estimadas = 0;
  let punta = 0;

  for (const h of horas) {
    const kwh = Number(h.consumo_kwh);
    if (!Number.isFinite(kwh)) continue;
    const hh = Number(String(h.hora).slice(0, 2));
    if (!Number.isFinite(hh) || hh < 0 || hh > 23) continue;

    total += kwh;
    dias.add(h.fecha);
    sumaHora[hh] += kwh;
    cuentaHora[hh]++;
    if (kwh > punta) punta = kwh;
    if (hh >= HORA_SOL_INICIO && hh < HORA_SOL_FIN) solares += kwh;
    if (/estim/i.test(String(h.metodo || ''))) estimadas++;

    const p = periodoDeHora(h.fecha, h.hora, tarifa);
    if (p >= 1 && p <= nPeriodos) porPeriodo[p - 1] += kwh;
  }

  const esperadas = dias.size * 24;
  return {
    total_kwh: r2(total),
    por_periodo: porPeriodo.map(r2),
    pct_por_periodo: porPeriodo.map((v) => (total > 0 ? r2((v / total) * 100) : 0)),
    media_por_hora: sumaHora.map((s, i) => (cuentaHora[i] > 0 ? r2(s / cuentaHora[i]) : 0)),
    pct_horas_solares: total > 0 ? r2((solares / total) * 100) : 0,
    cobertura_pct: esperadas > 0 ? r2((horas.length / esperadas) * 100) : 0,
    horas_estimadas: estimadas,
    dias_con_dato: dias.size,
    punta_horaria_kw: r2(punta),
  };
}

// ── Reactiva ───────────────────────────────────────────────────────────────

export interface DiagnosticoReactiva {
  penaliza: boolean;
  /** tan φ = reactiva / activa. Por encima de 0,33 se paga. */
  tan_phi: number;
  /** cos φ equivalente, que es como lo llama el electricista. */
  cos_phi: number;
  reactiva_kvarh: number;
  activa_kwh: number;
  mensaje: string;
}

/**
 * ¿Está pagando reactiva?
 *
 * No se pone precio a la penalización a propósito: el importe depende de tramos
 * y de la tarifa, y decir una cifra inventada aquí sería peor que no decir
 * nada. Lo que sí es sólido es el diagnóstico —si tan φ pasa de 0,33 se paga— y
 * eso ya basta para mandar a alguien a mirar la batería de condensadores, que es
 * una inversión que se recupera en meses.
 */
export function diagnosticarReactiva(reactivaKvarh: number, activaKwh: number): DiagnosticoReactiva {
  const activa = Number(activaKwh) || 0;
  const reactiva = Number(reactivaKvarh) || 0;
  if (activa <= 0) {
    return {
      penaliza: false, tan_phi: 0, cos_phi: 1, reactiva_kvarh: r2(reactiva), activa_kwh: 0,
      mensaje: 'Sin energía activa en el rango: no se puede calcular el factor de potencia.',
    };
  }
  const tan = reactiva / activa;
  const cos = 1 / Math.sqrt(1 + tan * tan);
  const penaliza = tan > TAN_PHI_PENALIZA;
  return {
    penaliza,
    tan_phi: Math.round(tan * 1000) / 1000,
    cos_phi: Math.round(cos * 1000) / 1000,
    reactiva_kvarh: r2(reactiva),
    activa_kwh: r2(activa),
    mensaje: penaliza
      ? `Factor de potencia ${(Math.round(cos * 100) / 100).toFixed(2)}, por debajo de 0,95: está pagando reactiva. Una batería de condensadores se suele recuperar en pocos meses; hay que verlo con el importe real de la factura.`
      : `Factor de potencia ${(Math.round(cos * 100) / 100).toFixed(2)}: dentro de lo que no se penaliza. Nada que hacer aquí.`,
  };
}
