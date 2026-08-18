/**
 * MOTOR DE COMPARATIVA Y ESCENARIOS (GL-06).
 *
 * El plan pide comparar «hasta tres alternativas con el mismo consumo y periodo
 * temporal», enseñar las hipótesis, avisar de lo que puede torcerlo y marcar
 * UNA recomendación explicada. Y añade cinco reglas de confianza, de las que
 * dos mandan sobre todo lo demás:
 *
 *   «Nunca ocultar servicios adicionales, permanencias o costes no energéticos.»
 *   «Permitir bloquear precios utilizados para que una propuesta antigua no
 *    cambie automáticamente.»
 *
 * POR QUÉ LA RECOMENDACIÓN NO ES «EL QUE MÁS AHORRA»
 *
 * Es la decisión de diseño que más cambia lo que sale por pantalla. Un indexado
 * gana casi siempre en la hoja de cálculo: se compara contra el precio de hoy y
 * el precio de hoy es lo único que se sabe. Pero lo que el cliente firma es un
 * año, no un día, y si el mercado sube el ahorro se convierte en un sobrecoste
 * con nuestro nombre encima. Igual con la permanencia: un fijo a 24 meses que
 * ahorra 40 € más que uno a 12 no ahorra 40 € más, ahorra 40 € y quita la
 * posibilidad de volver a mejorar dentro de un año.
 *
 * Así que la recomendación es EL QUE MÁS AHORRA ENTRE LOS QUE NO OBLIGAN A
 * EXPLICAR UN RIESGO, y el arriesgado solo se recomienda si no hay otro que
 * ahorre. Cuando el descartado ahorra bastante más, se dice en la frase: la
 * decisión es de Marcos, lo que no puede pasar es que el sistema la tome sin
 * enseñar la alternativa.
 *
 * LOS ESCENARIOS NO SE INVENTAN AQUÍ. Este archivo evalúa los que le den. De
 * dónde salen los precios (Supabase, `tarifas.ts`) y de dónde sale el ahorro de
 * unas placas (`fv.ts`) es cosa de quien llama, y así se puede probar entero
 * sin red.
 */

import {
  calcularCoste, TARIFA_INFO,
  type CosteCalculado, type TarifaAcceso,
} from './tarifas-base.ts';

/** «Comparar hasta tres alternativas», dice el plan. */
export const TOPE_ESCENARIOS = 3;

export type TipoEscenario =
  | 'fijo'
  | 'indexado'
  | 'optimizar_potencia'
  | 'fotovoltaica'
  | 'servicios';

export const TIPO_ESCENARIO_LABEL: Record<TipoEscenario, string> = {
  fijo: 'Precio fijo',
  indexado: 'Precio indexado',
  optimizar_potencia: 'Ajuste de potencias',
  fotovoltaica: 'Autoconsumo fotovoltaico',
  servicios: 'Servicios adicionales',
};

export type Riesgo = 'bajo' | 'medio' | 'alto';

const ORDEN_RIESGO: Record<Riesgo, number> = { bajo: 0, medio: 1, alto: 2 };

/**
 * De dónde salen los números de este escenario y qué se ha dado por supuesto.
 *
 * Va pegada al escenario y no en una nota aparte porque el plan lo pide así:
 * «mostrar fecha de precios, margen, servicios, impuestos y cualquier ajuste
 * manual». Una hipótesis que no viaja con el número se pierde en la primera
 * copia del PDF.
 */
export interface Hipotesis {
  /** Día en que se tomaron los precios. Sin esto, «ahorro» no significa nada. */
  fechaPrecios: string;
  /** Nuestro margen en €/kWh. Interno, nunca sale en la propuesta. */
  margenEurKwh: number;
  /** Si los precios llevan impuestos dentro o no. Mezclarlos falsea el ahorro. */
  incluyeImpuestos: boolean;
  /** Cualquier cosa que se haya tocado a mano, escrita. */
  ajustesManuales: string[];
  /**
   * Precios congelados: la propuesta ya se envió y no puede cambiar sola.
   * Sin esto, un cliente abre el PDF de hace un mes y los números no cuadran
   * con lo que se le dijo.
   */
  bloqueada: boolean;
}

export interface Escenario {
  id: string;
  tipo: TipoEscenario;
  titulo: string;
  comercializadora?: string | null;
  /** €/kWh por periodo, margen YA incluido. */
  preciosEnergia: number[];
  /** €/kW·día por periodo. */
  preciosPotencia: number[];
  /** Potencias propuestas, si el escenario las cambia. Null = deja las de hoy. */
  potencias?: number[] | null;
  /** Meses de permanencia que exige. 0 o null si no ata. */
  permanenciaMeses?: number | null;
  /** Coste de salida antes de tiempo, si lo hay. */
  penalizacionSalida?: number | null;
  /**
   * Ahorro anual que NO sale de los precios: producción fotovoltaica, un
   * servicio incluido, una subvención. Se suma aparte para que se vea de dónde
   * viene cada euro.
   */
  ahorroExtraAnual?: number | null;
  /** Inversión que hay que poner por delante (placas, baterías). */
  inversion?: number | null;
  hipotesis: Hipotesis;
}

/** Lo que sabemos del suministro y del expediente, para poder avisar. */
export interface ContextoEstudio {
  tarifa: TarifaAcceso;
  consumosMes: number[];
  potencias: number[];
  preciosEnergiaActual: number[];
  preciosPotenciaActual: number[];
  /** Meses que le quedan de permanencia con su comercializadora de hoy. */
  permanenciaRestanteMeses?: number | null;
  /** Penalización por salir hoy de su contrato actual. */
  penalizacionActual?: number | null;
  /** Hay curva horaria de Datadis. Sin ella el perfil es una suposición. */
  tieneCurva?: boolean;
  /** Hay maxímetro. Sin él la potencia recomendada no se puede apurar. */
  tieneMaximetro?: boolean;
  /** Periodos en los que el cliente se pasa de la potencia contratada. */
  periodosEnExceso?: number[] | null;
  /** Algún dato de la base es estimado y no leído de una factura. */
  datosEstimados?: boolean;
}

export type TipoAlerta =
  | 'permanencia'
  | 'penalizacion'
  | 'falta_curva'
  | 'falta_maximetro'
  | 'exceso_potencia'
  | 'datos_estimados'
  | 'precios_viejos'
  | 'sin_ahorro';

export interface Alerta {
  tipo: TipoAlerta;
  /** Qué pasa. */
  texto: string;
  /** Si esto invalida el ahorro que se está enseñando o solo lo matiza. */
  afectaAlAhorro: boolean;
}

export interface EscenarioEvaluado {
  escenario: Escenario;
  coste: CosteCalculado;
  /** Coste anual total del escenario, con el ahorro extra ya descontado. */
  costeAnual: number;
  ahorroAnual: number;
  ahorroPct: number;
  riesgo: Riesgo;
  /** Por qué ese riesgo, escrito. Un semáforo sin motivo no se cree nadie. */
  porqueRiesgo: string[];
  /** Años en recuperar la inversión, si la hay y si ahorra algo. */
  retornoAnios: number | null;
  alertas: Alerta[];
}

/** A partir de cuántos precios viejos deja de valer una comparativa. */
export const DIAS_PRECIOS_CADUCADOS = 30;
/** Una permanencia por encima de esto ya es un compromiso serio. */
export const MESES_PERMANENCIA_LARGA = 12;

const dias = (desde: string, hasta: string): number | null => {
  const a = new Date(`${String(desde).slice(0, 10)}T00:00:00`);
  const b = new Date(`${String(hasta).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
};

/**
 * Coste anual de hoy: el listón contra el que se mide todo lo demás.
 */
export function costeActual(ctx: ContextoEstudio): CosteCalculado {
  return calcularCoste(
    { tarifa: ctx.tarifa, consumosMes: ctx.consumosMes, potencias: ctx.potencias },
    ctx.preciosEnergiaActual,
    ctx.preciosPotenciaActual
  );
}

/**
 * Evalúa un escenario contra la situación actual.
 *
 * El mismo consumo y el mismo periodo temporal para todos, que es lo que hace
 * que las cifras se puedan poner una al lado de la otra. Si cada escenario
 * usara su propio consumo, la comparación sería una ilusión óptica.
 */
export function evaluarEscenario(
  ctx: ContextoEstudio,
  esc: Escenario,
  hoy: string
): EscenarioEvaluado {
  const base = costeActual(ctx);

  const coste = calcularCoste(
    {
      tarifa: ctx.tarifa,
      consumosMes: ctx.consumosMes,
      // Solo el escenario de potencias cambia los kW; los demás comparan
      // sobre lo mismo que tiene hoy.
      potencias: esc.potencias?.length ? esc.potencias : ctx.potencias,
    },
    esc.preciosEnergia,
    esc.preciosPotencia
  );

  const extra = Number(esc.ahorroExtraAnual) || 0;
  const costeAnual = coste.total - extra;
  const ahorroAnual = base.total - costeAnual;
  const ahorroPct = base.total > 0 ? (ahorroAnual / base.total) * 100 : 0;

  // ── Riesgo ────────────────────────────────────────────────────────────────
  const porqueRiesgo: string[] = [];
  let riesgo: Riesgo = 'bajo';
  const sube = (a: Riesgo, motivo: string) => {
    porqueRiesgo.push(motivo);
    if (ORDEN_RIESGO[a] > ORDEN_RIESGO[riesgo]) riesgo = a;
  };

  if (esc.tipo === 'indexado') {
    // El ahorro de un indexado se calcula con el precio de hoy y se firma para
    // un año. No es una pega del cálculo: es que el cálculo no puede saberlo.
    sube('alto', 'El precio va a mercado: el ahorro de hoy no está garantizado mañana');
  }
  const perm = Number(esc.permanenciaMeses) || 0;
  if (perm > MESES_PERMANENCIA_LARGA) {
    sube('medio', `Ata ${perm} meses: no se podrá volver a mejorar en ese tiempo`);
  }
  if (esc.penalizacionSalida) {
    sube('medio', `Salir antes cuesta ${Math.round(esc.penalizacionSalida)} €`);
  }
  if (ctx.datosEstimados) {
    sube('medio', 'Parte de los datos son estimados, no leídos de una factura');
  }
  if (esc.tipo === 'optimizar_potencia' && !ctx.tieneMaximetro) {
    // Sin maxímetro la demanda sale de la curva, que aplana los picos: bajar
    // potencia con eso es dejar al cliente corto y que la penalización la
    // pague él.
    sube('alto', 'Se propone bajar potencia sin maxímetro: la demanda real pudo ser mayor');
  }
  if (esc.inversion && !extra) {
    sube('medio', 'Hay inversión por delante y el ahorro no está cuantificado');
  }

  // ── Alertas ───────────────────────────────────────────────────────────────
  const alertas: Alerta[] = [];
  const avisa = (tipo: TipoAlerta, texto: string, afectaAlAhorro: boolean) =>
    alertas.push({ tipo, texto, afectaAlAhorro });

  if (ctx.permanenciaRestanteMeses && ctx.permanenciaRestanteMeses > 0) {
    avisa('permanencia',
      `Le quedan ${ctx.permanenciaRestanteMeses} meses de permanencia con su comercializadora actual`,
      false);
  }
  if (ctx.penalizacionActual) {
    // Esto SÍ toca al ahorro: el primer año hay que restarlo.
    avisa('penalizacion',
      `Salir de su contrato actual cuesta ${Math.round(ctx.penalizacionActual)} €, que se comen parte del ahorro del primer año`,
      true);
  }
  if (esc.tipo === 'fotovoltaica' && !ctx.tieneCurva) {
    avisa('falta_curva',
      'Sin curva horaria, el autoconsumo es una suposición y el ahorro puede moverse mucho',
      true);
  }
  if (esc.tipo === 'optimizar_potencia' && !ctx.tieneMaximetro) {
    avisa('falta_maximetro',
      'Sin maxímetro no se puede saber el pico real: la potencia propuesta es orientativa',
      true);
  }
  if (ctx.periodosEnExceso?.length) {
    avisa('exceso_potencia',
      `Se pasa de la potencia contratada en ${ctx.periodosEnExceso.map((p) => `P${p}`).join(', ')}: ahí toca subir, no bajar`,
      true);
  }
  if (ctx.datosEstimados) {
    avisa('datos_estimados', 'Hay datos estimados en el estudio', true);
  }

  const antiguedad = dias(esc.hipotesis.fechaPrecios, hoy);
  if (!esc.hipotesis.bloqueada && antiguedad != null && antiguedad > DIAS_PRECIOS_CADUCADOS) {
    avisa('precios_viejos',
      `Los precios son de hace ${antiguedad} días: hay que refrescarlos antes de enviar`,
      true);
  }
  if (ahorroAnual <= 0) {
    avisa('sin_ahorro',
      'Con estos precios no hay ahorro que enseñar: su tarifa actual ya es buena',
      false);
  }

  const retornoAnios = esc.inversion && ahorroAnual > 0
    ? Math.round((esc.inversion / ahorroAnual) * 10) / 10
    : null;

  return { escenario: esc, coste, costeAnual, ahorroAnual, ahorroPct, riesgo, porqueRiesgo, retornoAnios, alertas };
}

/**
 * Evalúa varios escenarios sobre el mismo consumo y los ordena por ahorro.
 *
 * Corta en tres. No es capricho del plan: cinco alternativas con el mismo peso
 * es exactamente la lista que hace que el cliente diga «déjamelo mirar» y no
 * vuelva. Las que sobran no se pierden, simplemente no van en la comparativa.
 */
export function evaluarEscenarios(
  ctx: ContextoEstudio,
  escenarios: Escenario[],
  hoy: string,
  tope = TOPE_ESCENARIOS
): EscenarioEvaluado[] {
  return escenarios
    .map((e) => evaluarEscenario(ctx, e, hoy))
    .sort((a, b) => b.ahorroAnual - a.ahorroAnual)
    .slice(0, tope);
}

export interface Recomendacion {
  elegido: EscenarioEvaluado | null;
  /** La frase. El plan la quiere editable, así que esto es el punto de partida. */
  porque: string;
  /** El que más ahorraba pero se descartó por riesgo, si lo hubo. */
  descartadoPorRiesgo: EscenarioEvaluado | null;
}

/**
 * Marca UNA recomendación y la explica en una frase.
 *
 * Regla: el que más ahorra ENTRE LOS QUE NO OBLIGAN A EXPLICAR UN RIESGO. Un
 * escenario de riesgo alto solo se recomienda si no hay ningún otro que ahorre,
 * y entonces la frase lo dice. Ver la cabecera del archivo.
 */
export function recomendar(evaluados: EscenarioEvaluado[]): Recomendacion {
  const conAhorro = evaluados.filter((e) => e.ahorroAnual > 0);
  if (!conAhorro.length) {
    return {
      elegido: null,
      porque: 'Ninguna alternativa mejora lo que paga hoy. Su tarifa actual está bien negociada y lo honesto es decírselo.',
      descartadoPorRiesgo: null,
    };
  }

  const tranquilos = conAhorro.filter((e) => e.riesgo !== 'alto');
  const mejorDeTodos = conAhorro[0];

  if (!tranquilos.length) {
    return {
      elegido: mejorDeTodos,
      porque: `${mejorDeTodos.escenario.titulo}: ahorra ${Math.round(mejorDeTodos.ahorroAnual)} € al año, pero es la única opción que mejora y tiene riesgo — ${mejorDeTodos.porqueRiesgo[0]}.`,
      descartadoPorRiesgo: null,
    };
  }

  const elegido = tranquilos[0];
  const descartado = mejorDeTodos !== elegido ? mejorDeTodos : null;

  let porque = `${elegido.escenario.titulo}: ahorra ${Math.round(elegido.ahorroAnual)} € al año (${elegido.ahorroPct.toFixed(1)} %)`;
  const perm = Number(elegido.escenario.permanenciaMeses) || 0;
  porque += perm ? ` con ${perm} meses de permanencia.` : ' sin permanencia.';

  if (descartado) {
    // Se enseña siempre. Si el sistema descarta en silencio una opción que
    // ahorra 300 € más, está tomando la decisión por Marcos.
    const mas = Math.round(descartado.ahorroAnual - elegido.ahorroAnual);
    porque += ` ${descartado.escenario.titulo} ahorraría ${mas} € más, pero ${descartado.porqueRiesgo[0]!.toLowerCase()}.`;
  }

  return { elegido, porque, descartadoPorRiesgo: descartado };
}

/**
 * Todas las alertas de la comparativa, sin repetir la misma dos veces.
 *
 * Las alertas del contexto (permanencia, falta de curva) salen idénticas en
 * cada escenario. Enseñarlas tres veces es la forma más rápida de que se dejen
 * de leer las tres.
 */
export function alertasDeLaComparativa(evaluados: EscenarioEvaluado[]): Alerta[] {
  const vistas = new Set<string>();
  const salida: Alerta[] = [];
  for (const e of evaluados) {
    for (const a of e.alertas) {
      const clave = `${a.tipo}|${a.texto}`;
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      salida.push(a);
    }
  }
  // Primero lo que toca al ahorro que se está enseñando.
  return salida.sort((a, b) => Number(b.afectaAlAhorro) - Number(a.afectaAlAhorro));
}

/**
 * El resumen de la primera página: coste actual, propuesto, ahorro y qué ata.
 *
 * El plan lo pide literalmente y en ese orden, con permanencia y riesgo dentro.
 * Sale de aquí y no del componente para que el PDF y la pantalla no puedan
 * decir cifras distintas.
 */
export function resumenComparativa(ctx: ContextoEstudio, rec: Recomendacion) {
  const base = costeActual(ctx);
  const e = rec.elegido;
  return {
    costeActual: base.total,
    costePropuesto: e ? e.costeAnual : base.total,
    ahorroAnual: e ? e.ahorroAnual : 0,
    ahorroPct: e ? e.ahorroPct : 0,
    permanenciaMeses: e ? (Number(e.escenario.permanenciaMeses) || 0) : 0,
    riesgo: e ? e.riesgo : ('bajo' as Riesgo),
    tarifa: TARIFA_INFO[ctx.tarifa].nombre,
    consumoAnualKwh: ctx.consumosMes.reduce((s, c) => s + (Number(c) || 0), 0) * 12,
  };
}
