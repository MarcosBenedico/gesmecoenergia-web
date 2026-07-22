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
