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
