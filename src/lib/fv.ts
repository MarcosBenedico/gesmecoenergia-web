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
