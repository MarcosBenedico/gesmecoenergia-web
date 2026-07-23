/**
 * Calculadora de presupuestos fotovoltaicos (Calculadora FV).
 * ÚNICA fuente de verdad del cálculo: la usan el frontend (vista previa)
 * y el backend (validación al guardar). Importes SIN IVA como base.
 *
 * Reglas:
 *  - Potencia ≤ 10 kW  → sin ingeniería, margen 25 %.
 *  - Potencia > 10 kW  → + ingeniería (1.800 € por defecto), margen 20 %.
 *  - El IVA se añade AL FINAL: nunca forma parte de la base del margen.
 */

export const INGENIERIA_DEFECTO = 1800;
export const MARGEN_DEFECTO_HASTA_10KW = 25;
export const MARGEN_DEFECTO_MAS_10KW = 20;
export const LIMITE_KW = 10;
export const MARGEN_MAXIMO_RAZONABLE = 40; // % — por encima, advertencia

export const ESTADOS_FV = [
  'borrador', 'pendiente_costes', 'pendiente_ingenieria', 'pendiente_revision',
  'aprobado', 'enviado', 'aceptado', 'rechazado', 'cancelado',
] as const;
export const ESTADO_FV_LABEL: Record<string, string> = {
  borrador: 'Borrador', pendiente_costes: 'Pendiente de costes', pendiente_ingenieria: 'Pendiente de ingeniería',
  pendiente_revision: 'Pendiente de revisión', aprobado: 'Aprobado internamente', enviado: 'Enviado al cliente',
  aceptado: 'Aceptado', rechazado: 'Rechazado', cancelado: 'Cancelado',
};
/** Estados que impiden el borrado físico (se archivan, nunca se eliminan). */
export const ESTADOS_FV_PROTEGIDOS: string[] = ['aprobado', 'enviado', 'aceptado'];

export const CONCEPTOS_FV = [
  'Instalación fotovoltaica', 'Materiales', 'Mano de obra', 'Ingeniería', 'Proyecto técnico',
  'Dirección de obra', 'Legalización', 'Tramitación', 'Baterías', 'Sistema de backup',
  'Estructura', 'Obra civil', 'Otros',
] as const;

export interface ConceptoFV {
  concepto: string;
  proveedor: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  incluido: boolean;      // ¿forma parte del coste base?
  observaciones: string;
}

export interface EntradaCalculoFV {
  potencia_kw: number;
  presupuesto_instalador: number;   // "X" — presupuesto de Óscar, sin IVA
  coste_ingenieria: number;         // sin IVA (solo aplica si potencia > 10 kW)
  margen_pct: number;               // % de margen comercial realmente usado
  iva_pct: number;                  // % de IVA (se añade al final)
  otros_costes?: number;            // suma de conceptos extra incluidos en el coste base
}

export interface ResultadoCalculoFV {
  aplica_ingenieria: boolean;
  coste_ingenieria_aplicado: number;
  otros_costes: number;
  coste_base: number;
  margen_pct: number;
  margen_importe: number;
  precio_sin_iva: number;
  iva_pct: number;
  iva_importe: number;
  precio_con_iva: number;
}

/** Margen por defecto según la potencia. */
export const margenPorDefecto = (potenciaKw: number): number =>
  potenciaKw > LIMITE_KW ? MARGEN_DEFECTO_MAS_10KW : MARGEN_DEFECTO_HASTA_10KW;

/** Redondeo a 2 decimales solo al presentar; el cálculo interno mantiene precisión. */
export const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function calcularFV(e: EntradaCalculoFV): ResultadoCalculoFV {
  const aplica = e.potencia_kw > LIMITE_KW;
  const ingenieria = aplica ? e.coste_ingenieria : 0;   // nunca se aplica dos veces ni en ≤10 kW
  const otros = e.otros_costes || 0;
  const costeBase = e.presupuesto_instalador + ingenieria + otros;
  const margenImporte = costeBase * (e.margen_pct / 100);
  const precioSinIva = costeBase + margenImporte;       // el margen SIEMPRE sobre la base sin IVA
  const ivaImporte = precioSinIva * (e.iva_pct / 100);
  return {
    aplica_ingenieria: aplica,
    coste_ingenieria_aplicado: r2(ingenieria),
    otros_costes: r2(otros),
    coste_base: r2(costeBase),
    margen_pct: e.margen_pct,
    margen_importe: r2(margenImporte),
    precio_sin_iva: r2(precioSinIva),
    iva_pct: e.iva_pct,
    iva_importe: r2(ivaImporte),
    precio_con_iva: r2(precioSinIva + ivaImporte),
  };
}

/** Validación compartida. Devuelve la lista de errores (vacía = válido). */
export function validarEntradaFV(e: EntradaCalculoFV): string[] {
  const errores: string[] = [];
  if (!(e.potencia_kw > 0)) errores.push('La potencia debe ser mayor que cero.');
  if (!(e.presupuesto_instalador > 0)) errores.push('El presupuesto del instalador debe ser mayor que cero.');
  if (e.coste_ingenieria < 0) errores.push('El coste de ingeniería no puede ser negativo.');
  if (e.margen_pct < 0) errores.push('El margen no puede ser negativo.');
  if ((e.otros_costes || 0) < 0) errores.push('Los otros costes no pueden ser negativos.');
  if (e.iva_pct < 0 || e.iva_pct > 30) errores.push('El IVA debe estar entre 0 % y 30 %.');
  return errores;
}

/** Advertencias no bloqueantes para mostrar en pantalla. */
export function advertenciasFV(e: EntradaCalculoFV): string[] {
  const avisos: string[] = [];
  const defecto = margenPorDefecto(e.potencia_kw);
  if (e.margen_pct < defecto) avisos.push(`Margen por debajo del predeterminado (${defecto} %).`);
  if (e.margen_pct > MARGEN_MAXIMO_RAZONABLE) avisos.push(`Margen superior al ${MARGEN_MAXIMO_RAZONABLE} %: revísalo.`);
  if (e.potencia_kw > LIMITE_KW && e.coste_ingenieria !== INGENIERIA_DEFECTO) {
    avisos.push(`Ingeniería modificada respecto al valor por defecto (${INGENIERIA_DEFECTO} €).`);
  }
  if (Math.abs(e.potencia_kw - LIMITE_KW) <= 0.5 && e.potencia_kw !== LIMITE_KW) {
    avisos.push('Potencia muy cerca del límite de 10 kW: comprueba el tramo aplicado.');
  }
  return avisos;
}

export const fmtEur2 = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

/* ═══════════ PRESUPUESTADOR: partidas, dimensionado y confianza ═══════════ */

export const POTENCIA_PANEL_W = 515; // Jinko 515 W (panel inicial de referencia)

export const NIVELES_CONFIANZA = ['alta', 'media', 'baja', 'pendiente'] as const;
export const CONFIANZA_LABEL: Record<string, string> = {
  alta: '🟢 Alta', media: '🟡 Media', baja: '🔴 Baja', pendiente: '⚪ Pendiente de visita',
};

export interface PartidaFV extends ConceptoFV {
  codigo_catalogo?: string | null;
  marca?: string | null;
  ajuste_pct: number;      // % sobre el precio base (p. ej. 10 = +10 %)
  ajuste_fijo: number;     // € añadidos tras el porcentaje
  opcional: boolean;
  visible_cliente: boolean;
  fuente?: string | null;      // de qué presupuesto/catálogo sale el precio
  confianza?: string | null;   // alta | media | baja | pendiente
  motivo_ajuste?: string | null;
}

/** precio_ajustado = precio_base × (1 + ajuste_pct/100) + ajuste_fijo */
export const precioAjustado = (p: PartidaFV): number =>
  Number(p.precio_unitario) * (1 + (Number(p.ajuste_pct) || 0) / 100) + (Number(p.ajuste_fijo) || 0);

export const importePartida = (p: PartidaFV): number =>
  (Number(p.cantidad) || 0) * precioAjustado(p);

/** Coste directo = suma de partidas incluidas (las opcionales no incluidas no suman). */
export const costeDirecto = (partidas: PartidaFV[]): number =>
  r2(partidas.filter((p) => p.incluido && p.concepto?.trim()).reduce((s, p) => s + importePartida(p), 0));

/** nº paneles = redondear hacia arriba(kWp × 1000 / W panel) — nunca por consumo/producción. */
export const numeroPaneles = (kwp: number, potenciaPanelW = POTENCIA_PANEL_W): number =>
  kwp > 0 ? Math.ceil((kwp * 1000) / potenciaPanelW) : 0;

/** Confianza global del presupuesto: la peor de las partidas incluidas. */
export function confianzaGlobal(partidas: PartidaFV[]): string {
  const orden = ['alta', 'media', 'baja', 'pendiente'];
  let peor = 0;
  for (const p of partidas.filter((x) => x.incluido && x.concepto?.trim())) {
    const i = orden.indexOf(p.confianza || 'media');
    if (i > peor) peor = i;
  }
  return orden[peor];
}

/** Reparto por intervalos (curva de carga) — base para las fases siguientes. */
export function repartoIntervalo(consumo: number, generacion: number) {
  return {
    autoconsumo: Math.min(consumo, generacion),
    excedente: Math.max(generacion - consumo, 0),
    consumo_red: Math.max(consumo - generacion, 0),
  };
}

/* ═══════════ FRANJA DE CONSUMO Y OPTIMIZACIÓN PLACAS/BATERÍA ═══════════ */

/**
 * Franja del consumo FUERTE del cliente. No es todo su consumo, pero sí dónde
 * se concentra: determina cuánta producción solar se aprovecha directamente
 * (coincidencia) y cuánto valor añade una batería (trasladar el sol del
 * mediodía a las horas de consumo).
 */
export const FRANJAS_CONSUMO = ['manana', 'mediodia', 'tarde', 'diurno', 'noche', 'todo_dia'] as const;
export type FranjaConsumo = (typeof FRANJAS_CONSUMO)[number];

export const FRANJA_LABEL: Record<string, string> = {
  manana: '🌅 Por la mañana', mediodia: '☀️ A mediodía', tarde: '🌇 Por la tarde',
  diurno: '🌤️ Durante el día', noche: '🌙 Por la noche', todo_dia: '🔄 Todo el día',
};

/**
 * Perfil solar de cada franja:
 *  - coincidencia: % de la producción que se autoconsume SIN batería (el sol produce
 *    ~70 % de su energía entre las 11h y las 17h; cuanto más lejos el consumo de ese
 *    pico, menor coincidencia).
 *  - utilBateria: cuánto sentido tiene desplazar energía con batería en esa franja.
 * Valores orientativos de diseño, ajustables con la curva real del cliente.
 */
export const PERFIL_FRANJA: Record<string, { coincidencia: number; utilBateria: 'baja' | 'media' | 'alta'; explicacion: string }> = {
  mediodia: { coincidencia: 75, utilBateria: 'baja', explicacion: 'El consumo fuerte coincide con el pico solar (11h–17h): la mayoría de la producción se aprovecha al momento y la batería aporta poco.' },
  diurno: { coincidencia: 65, utilBateria: 'media', explicacion: 'Consumo repartido en horas de sol: buena coincidencia directa; una batería pequeña rescata el excedente del mediodía para primera y última hora.' },
  manana: { coincidencia: 50, utilBateria: 'media', explicacion: 'El sol de primera hora es más débil: parte del pico de mediodía sobra. La batería puede guardarlo para la mañana siguiente o la tarde.' },
  tarde: { coincidencia: 40, utilBateria: 'alta', explicacion: 'El pico solar es a mediodía y el consumo por la tarde: sin batería gran parte se vierte a red a precio bajo; con batería esa energía se traslada a la tarde.' },
  noche: { coincidencia: 25, utilBateria: 'alta', explicacion: 'De noche no hay sol: casi toda la producción sobraría. La batería es la pieza clave — guarda el día para consumirlo de noche.' },
  todo_dia: { coincidencia: 55, utilBateria: 'media', explicacion: 'Consumo continuo (frío industrial, granja...): coincidencia media de forma natural y batería útil para las horas sin sol.' },
};

/** Capacidad útil (kWh) de las baterías del catálogo de Óscar (~90 % de profundidad de descarga). */
export const CAPACIDAD_BATERIA: Record<string, number> = { 'BAT-FEL-16': 14.4, 'BAT-EVE-32': 28.8 };

/** Una línea de justificación: qué, cómo se calcula, cuánto da y de dónde sale. */
export interface LineaJustificacion { concepto: string; formula: string; valor: string; fuente: string }

export interface OpcionBateria {
  codigo: string | null;          // null = sin batería
  nombre: string;
  capacidad_util: number;         // kWh
  coste: number;                  // € sin IVA (0 si no hay)
  pct_auto_efectivo: number;      // coincidencia + aporte batería
  aporte_anual_kwh: number;       // energía desplazada por la batería al año
  inversion: number;
  ahorro_neto_anual: number;
  amortizacion: number | null;
  elegida: boolean;
}

/**
 * ALGORITMO placas/batería: para un dimensionado dado, prueba cada opción de
 * batería del catálogo (incluida "sin batería"), calcula cuánta producción
 * extra aprovecha, su ahorro y su amortización, y elige la de MENOR
 * amortización (la más rentable para el cliente). Todo queda justificado.
 */
export function optimizarBateria(e: {
  produccion_anual_kwh: number;
  coincidencia_pct: number;           // autoconsumo directo sin batería (por franja)
  inversion_placas: number;           // € sin IVA del sistema sin batería
  precio_kwh: number; precio_compensacion: number; mantenimiento_anual: number;
  baterias: { codigo: string; nombre: string; coste: number }[];
}): { opciones: OpcionBateria[]; elegida: OpcionBateria } {
  const excedenteAnual = e.produccion_anual_kwh * (1 - e.coincidencia_pct / 100);
  const excedenteDiario = excedenteAnual / 365;

  const opciones: OpcionBateria[] = [
    { codigo: null, nombre: 'Sin batería', capacidad_util: 0, coste: 0 },
    ...e.baterias.map((b) => ({ codigo: b.codigo, nombre: b.nombre, capacidad_util: CAPACIDAD_BATERIA[b.codigo] || 10, coste: b.coste })),
  ].map((b) => {
    // La batería desplaza como mucho un ciclo diario: min(capacidad útil, excedente del día)
    const aporteDiario = Math.min(b.capacidad_util, excedenteDiario);
    const aporteAnual = r2(aporteDiario * 365);
    const pctEfectivo = Math.min(e.coincidencia_pct + (e.produccion_anual_kwh > 0 ? (aporteAnual / e.produccion_anual_kwh) * 100 : 0), 95);
    const inversion = r2(e.inversion_placas + b.coste);
    const a = ahorroSimple({
      produccion_anual_kwh: e.produccion_anual_kwh, pct_autoconsumo: r2(pctEfectivo),
      precio_kwh_evitado: e.precio_kwh, precio_compensacion: e.precio_compensacion,
      mantenimiento_anual: e.mantenimiento_anual, inversion,
    });
    return {
      codigo: b.codigo, nombre: b.nombre, capacidad_util: b.capacidad_util, coste: b.coste,
      pct_auto_efectivo: r2(pctEfectivo), aporte_anual_kwh: aporteAnual,
      inversion, ahorro_neto_anual: a.ahorro_neto_anual, amortizacion: a.amortizacion_anios, elegida: false,
    };
  });

  // La más rentable = menor amortización (empate → menor inversión). Sin ahorro positivo → sin batería.
  const validas = opciones.filter((o) => o.amortizacion != null);
  const elegida = (validas.length ? validas : opciones).reduce((mejor, o) =>
    (o.amortizacion ?? Infinity) < (mejor.amortizacion ?? Infinity) - 0.05
    || ((Math.abs((o.amortizacion ?? Infinity) - (mejor.amortizacion ?? Infinity)) <= 0.05) && o.inversion < mejor.inversion)
      ? o : mejor
  );
  elegida.elegida = true;
  return { opciones, elegida };
}

/**
 * Igual que `optimizarBateria`, pero el % de autoconsumo de cada opción sale de la
 * SIMULACIÓN ANUAL real mes a mes (`simularAnioFV`: cada mes con su propio sol y su
 * propio consumo) en vez de una fórmula rápida sobre un "día medio" anual. Es más
 * lento pero es el número que de verdad se aplica en la oferta final — usarlo aquí
 * evita que un escenario prometa un % y, al montarlo, el presupuesto acabe mostrando
 * otro (además de ser más correcto: invierno y verano no se comportan igual).
 */
export function optimizarBateriaHoraria(e: {
  produccion_anual_kwh: number;
  consumo_mensual_kwh: number[];
  franja?: string | null;
  inversion_placas: number;
  precio_kwh: number; precio_compensacion: number; mantenimiento_anual: number;
  baterias: { codigo: string; nombre: string; coste: number }[];
}): { opciones: OpcionBateria[]; elegida: OpcionBateria } {
  const candidatos = [
    { codigo: null as string | null, nombre: 'Sin batería', capacidad_util: 0, coste: 0 },
    ...e.baterias.map((b) => ({ codigo: b.codigo as string | null, nombre: b.nombre, capacidad_util: CAPACIDAD_BATERIA[b.codigo] || 10, coste: b.coste })),
  ];

  const opciones: OpcionBateria[] = candidatos.map((b) => {
    const anual = simularAnioFV({
      produccion_anual_kwh: e.produccion_anual_kwh, consumo_mensual_kwh: e.consumo_mensual_kwh,
      franja: e.franja, capacidad_bateria: b.capacidad_util,
    });
    const inversion = r2(e.inversion_placas + b.coste);
    const a = ahorroSimple({
      produccion_anual_kwh: e.produccion_anual_kwh, pct_autoconsumo: anual.pct_autoconsumo,
      precio_kwh_evitado: e.precio_kwh, precio_compensacion: e.precio_compensacion,
      mantenimiento_anual: e.mantenimiento_anual, inversion,
    });
    return {
      codigo: b.codigo, nombre: b.nombre, capacidad_util: b.capacidad_util, coste: b.coste,
      pct_auto_efectivo: anual.pct_autoconsumo, aporte_anual_kwh: anual.aporte_bateria,
      inversion, ahorro_neto_anual: a.ahorro_neto_anual, amortizacion: a.amortizacion_anios, elegida: false,
    };
  });

  const validas = opciones.filter((o) => o.amortizacion != null);
  const elegida = (validas.length ? validas : opciones).reduce((mejor, o) =>
    (o.amortizacion ?? Infinity) < (mejor.amortizacion ?? Infinity) - 0.05
    || ((Math.abs((o.amortizacion ?? Infinity) - (mejor.amortizacion ?? Infinity)) <= 0.05) && o.inversion < mejor.inversion)
      ? o : mejor
  );
  elegida.elegida = true;
  return { opciones, elegida };
}

/**
 * ¿Dónde rinde más el siguiente euro: en más placas o en más batería?
 * Compara el ahorro marginal por € invertido de ambas ampliaciones.
 */
export function siguienteEuro(e: {
  produccion_anual_kwh: number; coincidencia_pct: number; pct_auto_efectivo: number;
  precio_kwh: number; precio_compensacion: number; coste_por_kwp: number; coste_por_kwh_bateria: number;
  prod_especifica: number;
}): { mejor: 'placas' | 'bateria' | 'ninguna'; retorno_placas: number; retorno_bateria: number; texto: string } {
  // +1 kWp de placas: produce prod_especifica kWh más, aprovechados según el % efectivo actual
  const ahorroKwpExtra = e.prod_especifica * ((e.pct_auto_efectivo / 100) * e.precio_kwh + (1 - e.pct_auto_efectivo / 100) * e.precio_compensacion);
  const retornoPlacas = e.coste_por_kwp > 0 ? ahorroKwpExtra / e.coste_por_kwp : 0;

  // +1 kWh de batería: convierte excedente (compensado) en autoconsumo (evitado), un ciclo/día
  const excedenteDiario = (e.produccion_anual_kwh * (1 - e.pct_auto_efectivo / 100)) / 365;
  const ciclosUtiles = Math.min(1, Math.max(excedenteDiario, 0)); // si no sobra energía, la batería no carga
  const ahorroKwhBateria = ciclosUtiles * 365 * (e.precio_kwh - e.precio_compensacion);
  const retornoBateria = e.coste_por_kwh_bateria > 0 ? ahorroKwhBateria / e.coste_por_kwh_bateria : 0;

  const mejor = retornoPlacas <= 0 && retornoBateria <= 0 ? 'ninguna' : retornoBateria > retornoPlacas ? 'bateria' : 'placas';
  const texto =
    mejor === 'ninguna' ? 'Con estas hipótesis, ampliar el sistema no mejora la rentabilidad.'
    : mejor === 'bateria'
      ? `El siguiente euro rinde más en BATERÍA: ${r2(retornoBateria * 100)} céntimos/año por € invertido, frente a ${r2(retornoPlacas * 100)} en placas (el excedente barato pasa a ser consumo evitado caro).`
      : `El siguiente euro rinde más en PLACAS: ${r2(retornoPlacas * 100)} céntimos/año por € invertido, frente a ${r2(retornoBateria * 100)} en batería (todavía se aprovecha bien la producción directa).`;
  return { mejor, retorno_placas: r2(retornoPlacas), retorno_bateria: r2(retornoBateria), texto };
}

/* ═══════════ PERFIL DE CLIENTE ═══════════ */

/**
 * Cada tipo de cliente entiende la luz de forma distinta. El perfil adapta el
 * lenguaje y el enfoque de la propuesta (una granja no piensa en "confort" sino
 * en coste por cabeza y en no parar la ventilación/ordeño).
 */
export const PERFILES_CLIENTE = ['residencial', 'empresa', 'granja_porcina', 'granja_vacuno', 'granja_avicola', 'granja_aislada', 'otro'] as const;
export type PerfilCliente = (typeof PERFILES_CLIENTE)[number];

export const PERFIL_LABEL: Record<string, string> = {
  residencial: '🏠 Vivienda / residencial', empresa: '🏢 Empresa / comercio',
  granja_porcina: '🐷 Granja porcina', granja_vacuno: '🐄 Granja de vacuno',
  granja_avicola: '🐔 Granja avícola', granja_aislada: '🔌 Explotación aislada (grupo gasoil)',
  otro: '⚙️ Otro',
};

/** Textos por defecto de la propuesta según el perfil (editables antes de imprimir). */
export const PERFIL_TEXTO: Record<string, { titular: string; intro: string; puntos: string[] }> = {
  residencial: {
    titular: 'Su casa, produciendo su propia energía',
    intro: 'Le proponemos una instalación pensada para su vivienda: producir durante el día la energía que consume, reducir la factura desde el primer mes y ganar independencia frente a las subidas de la luz.',
    puntos: ['Ahorro real en su factura mensual', 'Revalorización de su vivienda', 'Energía limpia y silenciosa'],
  },
  empresa: {
    titular: 'Energía para que su negocio gaste menos',
    intro: 'La luz es uno de sus costes fijos. Esta instalación convierte parte de ese gasto en una inversión que se amortiza y luego produce ahorro puro, con la tranquilidad de un suministro más estable.',
    puntos: ['Reducción de un coste fijo del negocio', 'Amortización y deducción fiscal', 'Imagen de empresa sostenible'],
  },
  granja_porcina: {
    titular: 'Menos coste de luz por cabeza, sin parar la explotación',
    intro: 'En una granja la luz no descansa: ventilación, calefacción de lechones, silos y agua funcionan todo el día. Esta instalación cubre buena parte de ese consumo con el sol y baja su coste energético por plaza, sin tocar su operativa.',
    puntos: ['Cubre el consumo constante de ventilación y clima', 'Menor coste energético por cabeza', 'Con acumulación, respaldo si falla la red'],
  },
  granja_vacuno: {
    titular: 'El sol para el ordeño, el frío de la leche y el agua',
    intro: 'El ordeño, el tanque de frío y el bombeo de agua consumen luz a diario y a horas concretas. Dimensionamos la instalación para cubrir ese consumo y, si interesa, guardamos energía para los ordeños de primera y última hora.',
    puntos: ['Cubre ordeño, tanque de frío y bombeo', 'Batería para los ordeños sin sol', 'Coste de la leche más competitivo'],
  },
  granja_avicola: {
    titular: 'Ventilación y clima asegurados, gastando menos',
    intro: 'En avicultura la ventilación y la temperatura no pueden fallar y consumen luz de forma continua. La instalación cubre ese consumo con energía solar y, con batería, añade respaldo para que las naves nunca se queden sin clima.',
    puntos: ['Cubre el consumo continuo de ventilación', 'Respaldo ante cortes de red', 'Menor coste por ave'],
  },
  granja_aislada: {
    titular: 'Deje de depender del grupo de gasoil',
    intro: 'Su explotación funciona hoy con un grupo electrógeno: cada hora de funcionamiento es gasoil quemado, ruido y mantenimiento. Con solar y baterías produce su energía de día, la guarda para la noche y reduce drásticamente —o elimina— el gasto de gasoil.',
    puntos: ['Menos litros de gasoil cada mes', 'Energía de día y de noche con baterías', 'Sin ruido ni mantenimiento del grupo'],
  },
  otro: {
    titular: 'Su instalación solar a medida',
    intro: 'Le proponemos una instalación fotovoltaica dimensionada para su consumo, con el objetivo de reducir su factura y amortizar la inversión.',
    puntos: ['Ahorro en la factura', 'Amortización clara', 'Energía limpia'],
  },
};

/* ═══════════ ESTACIONALIDAD (producción mes a mes) ═══════════ */

/**
 * Reparto típico de la producción solar a lo largo del año en el interior de
 * Aragón (% de la producción anual por mes). En verano se produce más del doble
 * que en invierno: esto es clave para explicar bien el autoconsumo y la batería.
 * Fuente de referencia: perfiles PVGIS para la zona; ajustable.
 */
export const PRODUCCION_MENSUAL_PCT = [5.2, 6.4, 8.6, 9.4, 10.6, 11.2, 11.8, 10.8, 9.0, 7.0, 5.2, 4.8];
export const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Producción mensual (kWh) a partir de la producción anual y el reparto estacional. */
export const produccionMensual = (anualKwh: number): number[] =>
  PRODUCCION_MENSUAL_PCT.map((p) => r2((anualKwh * p) / 100));

/* ═══════════ GRANJA AISLADA CON GRUPO DE GASOIL ═══════════ */

export const GASOIL_PRECIO_LITRO = 1.10;   // €/L gasóleo B (agrícola), editable
export const GASOIL_KWH_LITRO = 3.2;       // kWh eléctricos por litro en un grupo electrógeno
export const GASOIL_MANT_HORA = 0.6;       // € de mantenimiento por hora de grupo (aceite, filtros, desgaste)

/**
 * Convierte el gasto mensual de gasoil en su equivalente eléctrico y su coste
 * real por kWh. En aislada, cada kWh solar sustituye gasoil caro: por eso la
 * amortización es mucho más rápida que conectado a red.
 */
export function estimarGasoil(e: { gastoMensual: number; precioLitro?: number; kwhLitro?: number }) {
  const precio = e.precioLitro || GASOIL_PRECIO_LITRO;
  const kwhL = e.kwhLitro || GASOIL_KWH_LITRO;
  const gastoAnual = r2(e.gastoMensual * 12);
  const litrosAnio = precio > 0 ? r2(gastoAnual / precio) : 0;
  const kwhAnio = r2(litrosAnio * kwhL);
  const costeKwh = kwhAnio > 0 ? r2(gastoAnual / kwhAnio) : 0; // €/kWh real del gasoil
  return { gasto_anual: gastoAnual, litros_anio: litrosAnio, kwh_anio: kwhAnio, coste_kwh: costeKwh };
}

/* ═══════════ SIMULACIÓN HORARIA (24 h): SOL, CONSUMO Y BATERÍA ═══════════ */

/**
 * Reparto horario de la producción solar en un día medio (fracción de la
 * producción diaria por hora). El sol concentra ~70 % entre las 10 h y las 16 h.
 * Perfil de "temporada media" (marzo/abril/septiembre/octubre): días de ~11-12 h de sol.
 */
export const PERFIL_SOLAR_HORARIO = [
  0, 0, 0, 0, 0, 0, 0.005, 0.02, 0.045, 0.07, 0.09, 0.105,
  0.115, 0.12, 0.115, 0.10, 0.08, 0.055, 0.03, 0.012, 0.003, 0, 0, 0,
];

/**
 * Perfil solar de INVIERNO (noviembre–febrero): día corto (~9 h, sol de 8h a 17h
 * en Binéfar) y de menor altura — el amanecer y el ocaso aportan casi nada.
 * Orientativo (referencia PVGIS de la zona), ajustable.
 */
export const PERFIL_SOLAR_INVIERNO = [
  0, 0, 0, 0, 0, 0, 0, 0, 0.015, 0.05, 0.10, 0.15,
  0.185, 0.185, 0.15, 0.10, 0.05, 0.015, 0, 0, 0, 0, 0, 0,
];

/**
 * Perfil solar de VERANO (mayo–agosto): día largo (~15 h, sol de 6h a 21h) y
 * más plano — el pico es menos pronunciado porque hay más horas de sol fuerte.
 * Orientativo (referencia PVGIS de la zona), ajustable.
 */
export const PERFIL_SOLAR_VERANO = [
  0, 0, 0, 0, 0, 0.005, 0.02, 0.045, 0.065, 0.08, 0.09, 0.095,
  0.10, 0.10, 0.095, 0.09, 0.08, 0.065, 0.045, 0.02, 0.005, 0, 0, 0,
];

/** Días de cada mes (año no bisiesto; suficiente para el reparto orientativo). */
export const DIAS_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Índice de mes (0=Ene) → perfil solar horario según estación (Aragón interior). */
export function perfilSolarMes(mesIdx: number): number[] {
  if ([10, 11, 0, 1].includes(mesIdx)) return PERFIL_SOLAR_INVIERNO;   // Nov, Dic, Ene, Feb
  if ([4, 5, 6, 7].includes(mesIdx)) return PERFIL_SOLAR_VERANO;       // May, Jun, Jul, Ago
  return PERFIL_SOLAR_HORARIO;                                        // Mar, Abr, Sep, Oct
}

/** Reparto horario del consumo según la franja fuerte declarada por el cliente. */
export const PERFIL_CONSUMO_HORARIO: Record<string, number[]> = {
  manana:   [1, 1, 1, 1, 1, 2, 5, 8, 9, 9, 8, 7, 5, 3, 2, 2, 2, 3, 4, 4, 3, 2, 2, 1],
  mediodia: [1, 1, 1, 1, 1, 1, 2, 3, 4, 5, 7, 9, 10, 10, 9, 7, 5, 4, 3, 3, 3, 2, 2, 1],
  tarde:    [1, 1, 1, 1, 1, 1, 2, 3, 3, 3, 3, 4, 5, 5, 5, 6, 8, 9, 9, 8, 7, 5, 3, 2],
  diurno:   [1, 1, 1, 1, 1, 2, 4, 6, 7, 7, 7, 7, 7, 7, 7, 7, 6, 6, 5, 4, 3, 2, 1, 1],
  noche:    [6, 6, 5, 5, 5, 5, 4, 3, 2, 1, 1, 1, 1, 1, 1, 1, 2, 3, 4, 5, 6, 7, 7, 7],
  todo_dia: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
};

export interface HoraFV {
  h: number; produccion: number; consumo: number;
  directo: number; carga: number; descarga: number; vertido: number; red: number; soc: number;
}
export interface ResultadoHorarioFV {
  horas: HoraFV[];
  autoconsumo_directo: number;  // kWh/día que se usa al momento
  aporte_bateria: number;       // kWh/día que la batería traslada a horas sin sol
  vertido: number;              // kWh/día que se vierte a red
  red: number;                  // kWh/día que se sigue comprando
  pct_autoconsumo: number;      // % de la producción realmente aprovechado
}

const normalizar = (a: number[]) => { const s = a.reduce((x, y) => x + y, 0) || 1; return a.map((v) => v / s); };

/**
 * Simula un día hora a hora: cuánto se autoconsume directo, cuánto carga y
 * descarga la batería, cuánto se vierte y cuánto se compra a la red.
 * Es el cálculo honesto para justificar la batería ante el cliente.
 */
export function simularDiaFV(e: {
  produccion_dia: number;      // kWh que producen las placas ese día
  consumo_dia: number;         // kWh que consume el cliente ese día
  franja?: string | null;      // perfil horario del consumo
  capacidad_bateria: number;   // kWh útiles de batería (0 = sin batería)
  rendimiento?: number;        // eficiencia de ida y vuelta de la batería
  perfil_solar?: number[];     // perfil horario solar a usar (por defecto, el de temporada media)
}): ResultadoHorarioFV {
  const solar = normalizar(e.perfil_solar || PERFIL_SOLAR_HORARIO);
  const consPerfil = normalizar(PERFIL_CONSUMO_HORARIO[e.franja || 'todo_dia'] || PERFIL_CONSUMO_HORARIO.todo_dia);
  const cap = Math.max(e.capacidad_bateria, 0);
  const ef = e.rendimiento ?? 0.92;

  let soc = 0;
  let horas: HoraFV[] = [];
  // Dos pasadas: la segunda arranca con el estado de carga real del día anterior
  for (let pasada = 0; pasada < 2; pasada++) {
    horas = [];
    for (let h = 0; h < 24; h++) {
      const produccion = e.produccion_dia * solar[h];
      const consumo = e.consumo_dia * consPerfil[h];
      const directo = Math.min(produccion, consumo);
      let sobra = produccion - directo;
      let falta = consumo - directo;
      let carga = 0, descarga = 0;
      if (cap > 0 && sobra > 0 && soc < cap) { carga = Math.min(sobra, cap - soc); soc += carga; sobra -= carga; }
      if (cap > 0 && falta > 0 && soc > 0) { descarga = Math.min(falta, soc * ef); soc -= descarga / ef; falta -= descarga; }
      horas.push({ h, produccion: r2(produccion), consumo: r2(consumo), directo: r2(directo), carga: r2(carga), descarga: r2(descarga), vertido: r2(sobra), red: r2(falta), soc: r2(soc) });
    }
  }
  const suma = (k: keyof HoraFV) => r2(horas.reduce((s, x) => s + (x[k] as number), 0));
  const directo = suma('directo'), aporte = suma('descarga');
  return {
    horas,
    autoconsumo_directo: directo,
    aporte_bateria: aporte,
    vertido: suma('vertido'),
    red: suma('red'),
    pct_autoconsumo: e.produccion_dia > 0 ? Math.min(r2(((directo + aporte) / e.produccion_dia) * 100), 100) : 0,
  };
}

export interface ResultadoMesFV extends ResultadoHorarioFV { mes: number; dias: number }
export interface ResultadoAnualFV {
  meses: ResultadoMesFV[];
  autoconsumo_directo: number;  // kWh/año
  aporte_bateria: number;       // kWh/año
  vertido: number;              // kWh/año
  red: number;                  // kWh/año
  pct_autoconsumo: number;      // % real del año completo (ponderado mes a mes, no un día medio)
}

/**
 * Simula el AÑO COMPLETO mes a mes: cada mes tiene su propio perfil solar
 * (día corto y bajo en invierno, largo y plano en verano) y su propio consumo
 * real (el que el cliente metió mes a mes, no una media anual repartida a lo
 * tonto). Es el cálculo "al milímetro": una granja que gasta el doble en
 * invierno por la calefacción, o un negocio de verano, no se puede simular
 * bien con un único "día medio" — aquí se simulan los 12 y se suman de verdad.
 * Esto es lo que decide el % de autoconsumo real y, con él, la amortización.
 */
export function simularAnioFV(e: {
  produccion_anual_kwh: number;
  consumo_mensual_kwh: number[];  // 12 valores (ene..dic); si faltan, se reparte el anual a partes iguales
  franja?: string | null;
  capacidad_bateria: number;
  rendimiento?: number;
}): ResultadoAnualFV {
  const prodMensual = produccionMensual(e.produccion_anual_kwh);
  const meses: ResultadoMesFV[] = DIAS_MES.map((dias, i) => {
    const consumoMes = e.consumo_mensual_kwh?.[i] || 0;
    const sim = simularDiaFV({
      produccion_dia: r2(prodMensual[i] / dias), consumo_dia: r2(consumoMes / dias),
      franja: e.franja, capacidad_bateria: e.capacidad_bateria, rendimiento: e.rendimiento,
      perfil_solar: perfilSolarMes(i),
    });
    return { ...sim, mes: i, dias };
  });
  const sumaAnual = (k: keyof ResultadoHorarioFV) => r2(meses.reduce((s, m) => s + (m[k] as number) * m.dias, 0));
  const autoDirecto = sumaAnual('autoconsumo_directo');
  const aporteBateria = sumaAnual('aporte_bateria');
  const produccionTotal = r2(prodMensual.reduce((s, p) => s + p, 0));
  return {
    meses,
    autoconsumo_directo: autoDirecto,
    aporte_bateria: aporteBateria,
    vertido: sumaAnual('vertido'),
    red: sumaAnual('red'),
    pct_autoconsumo: produccionTotal > 0 ? Math.min(r2(((autoDirecto + aporteBateria) / produccionTotal) * 100), 100) : 0,
  };
}

/** Capacidad de batería (kWh) que declara una partida del presupuesto. */
export function capacidadDeTexto(texto: string): number {
  const m = (texto || '').match(/([\d]+(?:[.,]\d+)?)\s*kwh/i);
  return m ? parseFloat(m[1].replace(',', '.')) : 0;
}

/* ═══════════ REFERENCIA DE MERCADO: BATERÍAS E INVERSORES ═══════════ */

/**
 * Precios de material (PVP orientativo, con IVA) en tiendas españolas fiables
 * — Autosolar, Damia Solar, Efecto Solar, Leroy Merlin, Suministros del Sol —
 * verificados en enero de 2026. Los precios de equipos fluctúan: confírmalos con
 * tu distribuidor antes de cerrar un presupuesto. No incluyen instalación.
 */
export interface RefMercado {
  marca: string;
  modelo: string;
  medida: number;        // kWh (batería) o kW (inversor)
  precio: number;        // € material, sin IVA (orientativo)
  detalle: string;       // fase, tipo, garantía...
}

/** Baterías LiFePO4 de marcas muy valoradas (capacidad útil aprox. en kWh). */
export const BATERIAS_MERCADO: RefMercado[] = [
  { marca: 'Pylontech', modelo: 'US3000C', medida: 3.5, precio: 800, detalle: '48 V · 10 años · miles de instalaciones' },
  { marca: 'Pylontech', modelo: 'US5000', medida: 4.8, precio: 1050, detalle: '48 V · 10 años · gran relación calidad-precio' },
  { marca: 'Huawei', modelo: 'LUNA2000-5', medida: 5.0, precio: 2300, detalle: 'Alta tensión · modular · 10 años garantía' },
  { marca: 'BYD', modelo: 'Battery-Box HVS 5.1', medida: 5.1, precio: 2800, detalle: 'Alta tensión · modular · 10 años garantía' },
  { marca: 'Huawei', modelo: 'LUNA2000-7', medida: 6.9, precio: 3000, detalle: 'Alta tensión · modular · 10 años garantía' },
  { marca: 'BYD', modelo: 'Battery-Box HVM 8.3', medida: 8.3, precio: 4000, detalle: 'Alta tensión · modular · 10 años garantía' },
  { marca: 'Sungrow', modelo: 'SBR096', medida: 9.6, precio: 3800, detalle: 'Alta tensión · modular · 10 años garantía' },
  { marca: 'Pylontech', modelo: 'Force-H2', medida: 10.6, precio: 2900, detalle: 'Alta tensión · modular · 10 años garantía' },
  { marca: 'Growatt', modelo: 'ARK 10.24H-A1', medida: 10.2, precio: 3500, detalle: 'Alta tensión · modular · 10 años garantía' },
  { marca: 'Fox ESS', modelo: 'ECS4100 (x3)', medida: 10.4, precio: 3300, detalle: 'Alta tensión · modular · 10 años garantía' },
  { marca: 'Huawei', modelo: 'LUNA2000-10', medida: 10.0, precio: 4200, detalle: 'Alta tensión · modular · 10 años garantía' },
  { marca: 'Sungrow', modelo: 'SBR128', medida: 12.8, precio: 5000, detalle: 'Alta tensión · modular · 10 años garantía' },
  { marca: 'Huawei', modelo: 'LUNA2000-15', medida: 15.0, precio: 6000, detalle: 'Alta tensión · modular · 10 años garantía' },
];

/**
 * Inversores de potencia REAL (kW enteros), marcas muy fiables y con muchísimas
 * valoraciones (Huawei, Sungrow, Fronius, SMA, GoodWe, Victron). Híbrido = admite
 * baterías; trifásico string = solo placas.
 */
export const INVERSORES_MERCADO: RefMercado[] = [
  { marca: 'Huawei', modelo: 'SUN2000-3KTL-L1', medida: 3, precio: 790, detalle: 'Monofásico híbrido · 10 años garantía' },
  { marca: 'Huawei', modelo: 'SUN2000-5KTL-L1', medida: 5, precio: 850, detalle: 'Monofásico híbrido · 10 años garantía' },
  { marca: 'Sungrow', modelo: 'SH5.0RS', medida: 5, precio: 1000, detalle: 'Monofásico híbrido · 10 años garantía' },
  { marca: 'Victron', modelo: 'MultiPlus-II 48/5000', medida: 5, precio: 1300, detalle: 'Híbrido/aislada · ideal off-grid · 5 años garantía' },
  { marca: 'Huawei', modelo: 'SUN2000-6KTL-M1', medida: 6, precio: 1100, detalle: 'Trifásico híbrido · 10 años garantía' },
  { marca: 'Sungrow', modelo: 'SH8.0RS', medida: 8, precio: 1400, detalle: 'Monofásico híbrido · 10 años garantía' },
  { marca: 'GoodWe', modelo: 'GW8K-ET', medida: 8, precio: 1500, detalle: 'Trifásico híbrido · muy valorado · 10 años garantía' },
  { marca: 'Huawei', modelo: 'SUN2000-10KTL-M1', medida: 10, precio: 1250, detalle: 'Trifásico híbrido · 10 años garantía' },
  { marca: 'Sungrow', modelo: 'SH10RS', medida: 10, precio: 1500, detalle: 'Trifásico híbrido · 10 años garantía' },
  { marca: 'SMA', modelo: 'Sunny Tripower 10.0', medida: 10, precio: 1900, detalle: 'Trifásico string · fiabilidad alemana · 5 años garantía' },
  { marca: 'Fronius', modelo: 'Symo GEN24 10.0 Plus', medida: 10, precio: 2400, detalle: 'Trifásico híbrido · calidad premium · 10 años garantía' },
  { marca: 'Huawei', modelo: 'SUN2000-12KTL-M2', medida: 12, precio: 1600, detalle: 'Trifásico string · 10 años garantía' },
  { marca: 'GoodWe', modelo: 'GW15K-ET', medida: 15, precio: 2000, detalle: 'Trifásico híbrido · muy valorado · 10 años garantía' },
  { marca: 'Huawei', modelo: 'SUN2000-15KTL-M2', medida: 15, precio: 1700, detalle: 'Trifásico string · 10 años garantía' },
  { marca: 'Fronius', modelo: 'Symo 15.0-3-M', medida: 15, precio: 2100, detalle: 'Trifásico string · calidad premium · 5 años garantía' },
  { marca: 'Sungrow', modelo: 'SG20RT', medida: 20, precio: 1700, detalle: 'Trifásico string · 10 años garantía' },
  { marca: 'Huawei', modelo: 'SUN2000-20KTL-M2', medida: 20, precio: 1900, detalle: 'Trifásico string · 10 años garantía' },
  { marca: 'Sungrow', modelo: 'SG25RT', medida: 25, precio: 2100, detalle: 'Trifásico string · 10 años garantía' },
  { marca: 'Sungrow', modelo: 'SG33RT', medida: 33, precio: 2500, detalle: 'Trifásico string · 10 años garantía' },
];

/* ═══════════ ALGORITMO: COMBINACIÓN MÁS ECONÓMICA ═══════════ */

export interface ComboEquipo {
  descripcion: string;   // "2× Pylontech US5000 (4,8 kWh)"
  marca: string;
  unidades: number;
  medida_total: number;  // kWh o kW que suma la combinación
  coste: number;         // € material sin IVA
  ratio: number;         // €/kWh o €/kW
  sobra: number;         // cuánto se pasa del objetivo (menos = mejor ajuste)
}

/**
 * Batería más económica del mercado para una capacidad objetivo.
 * Las baterías son modulares: se pueden apilar varias del mismo modelo.
 * Prueba cada modelo, calcula cuántas unidades hacen falta y su coste,
 * y devuelve las opciones ordenadas de más barata a más cara.
 */
export function bateriaEconomica(capacidadKwh: number, n = 3): ComboEquipo[] {
  if (capacidadKwh <= 0) return [];
  return BATERIAS_MERCADO.map((b) => {
    const unidades = Math.max(1, Math.ceil(capacidadKwh / b.medida));
    const medidaTotal = r2(unidades * b.medida);
    const coste = unidades * b.precio;
    return {
      descripcion: `${unidades}× ${b.marca} ${b.modelo} (${b.medida} kWh c/u)`,
      marca: b.marca, unidades, medida_total: medidaTotal, coste,
      ratio: r2(coste / medidaTotal), sobra: r2(medidaTotal - capacidadKwh),
    };
  }).sort((a, b) => a.coste - b.coste || a.sobra - b.sobra).slice(0, n);
}

/**
 * Inversor más económico del mercado que cubre la potencia objetivo.
 * Se admite un inversor algo por debajo del pico (hasta ~15 %): el
 * sobredimensionado DC/AC es habitual y sano. Ordena por coste.
 *
 * Si ningún inversor individual del catálogo llega a la potencia objetivo
 * (instalaciones grandes, > 28 kWp aprox.), se combinan varias unidades del
 * mismo modelo en paralelo — igual que se hace con las baterías modulares —
 * en vez de devolver una lista vacía.
 */
export function inversorEconomico(potenciaKw: number, n = 3): ComboEquipo[] {
  if (potenciaKw <= 0) return [];
  const minimo = potenciaKw * 0.85;
  const individuales = INVERSORES_MERCADO.filter((i) => i.medida >= minimo)
    .map((i) => ({
      descripcion: `${i.marca} ${i.modelo} (${i.medida} kW)`,
      marca: i.marca, unidades: 1, medida_total: i.medida, coste: i.precio,
      ratio: r2(i.precio / i.medida), sobra: r2(i.medida - potenciaKw),
    }));
  if (individuales.length > 0) {
    return individuales.sort((a, b) => a.coste - b.coste || Math.abs(a.sobra) - Math.abs(b.sobra)).slice(0, n);
  }
  return INVERSORES_MERCADO.map((i) => {
    const unidades = Math.max(1, Math.ceil(minimo / i.medida));
    const medidaTotal = r2(unidades * i.medida);
    const coste = unidades * i.precio;
    return {
      descripcion: `${unidades}× ${i.marca} ${i.modelo} (${i.medida} kW c/u, en paralelo)`,
      marca: i.marca, unidades, medida_total: medidaTotal, coste,
      ratio: r2(coste / medidaTotal), sobra: r2(medidaTotal - potenciaKw),
    };
  }).sort((a, b) => a.coste - b.coste || a.sobra - b.sobra).slice(0, n);
}

/* ═══════════ AYUDAS, BONIFICACIONES Y DEDUCCIONES ═══════════ */

/**
 * Estimación orientativa de las ayudas típicas para autoconsumo en vivienda.
 * NO es asesoramiento fiscal: los importes dependen de la situación de cada cliente
 * y de las ordenanzas de su municipio. Gesmeco (asesoría) lo confirma caso a caso.
 *
 * - Deducción IRPF por mejora de eficiencia energética (RD-ley 19/2021):
 *   40 % del importe cuando reduce ≥30 % el consumo de energía primaria no renovable,
 *   con base máxima de 7.500 € → hasta 3.000 € de deducción. Requiere certificado
 *   energético antes y después y tener cuota de IRPF suficiente.
 * - Bonificación IBI: los ayuntamientos pueden bonificar hasta el 50 % durante varios
 *   años (ordenanza municipal; en la comarca es habitual 30–50 % · 3–5 años).
 * - Bonificación ICIO: hasta el 95 % del impuesto de construcciones de la licencia.
 */
export const IRPF_PCT_DEDUCCION = 40;      // % sobre la inversión (caso autoconsumo vivienda)
export const IRPF_BASE_MAXIMA = 7500;      // € base máxima deducible
export const IBI_PCT_ORIENTATIVO = 40;     // % de bonificación (orientativo comarcal)
export const IBI_ANIOS_ORIENTATIVO = 4;    // años de bonificación (orientativo)

export function estimarAyudas(precioConIva: number, ibiAnual = 0) {
  const baseIrpf = Math.min(precioConIva, IRPF_BASE_MAXIMA);
  const deduccionIrpf = r2(baseIrpf * (IRPF_PCT_DEDUCCION / 100));
  const bonifIbiAnual = ibiAnual > 0 ? r2(ibiAnual * (IBI_PCT_ORIENTATIVO / 100)) : 0;
  const bonifIbiTotal = r2(bonifIbiAnual * IBI_ANIOS_ORIENTATIVO);
  return {
    base_irpf: baseIrpf,
    deduccion_irpf: deduccionIrpf,
    bonif_ibi_anual: bonifIbiAnual,
    bonif_ibi_total: bonifIbiTotal,
    ahorro_fiscal_estimado: r2(deduccionIrpf + bonifIbiTotal),
  };
}

/** Ahorro anual y amortización simple (estimación orientativa). */
export function ahorroSimple(e: {
  produccion_anual_kwh: number; pct_autoconsumo: number;   // 0-100
  precio_kwh_evitado: number; precio_compensacion: number; mantenimiento_anual: number;
  inversion: number;
}) {
  const auto = e.produccion_anual_kwh * (e.pct_autoconsumo / 100);
  const exc = e.produccion_anual_kwh - auto;
  const bruto = auto * e.precio_kwh_evitado + exc * e.precio_compensacion;
  const neto = bruto - e.mantenimiento_anual;
  return {
    ahorro_autoconsumo: r2(auto * e.precio_kwh_evitado),
    valor_excedentes: r2(exc * e.precio_compensacion),
    ahorro_neto_anual: r2(neto),
    amortizacion_anios: neto > 0 ? r2(e.inversion / neto) : null,  // nunca dividir entre cero
  };
}
