/**
 * Dominio del módulo "Vencimientos y Cartera" (Correbin Asociados).
 * Capa interna de control comercial — Avant/iSegur sigue siendo la herramienta operativa.
 */

export const RAMOS = [
  'hogar', 'auto', 'vida', 'salud', 'rc', 'comercio', 'agrario', 'decesos', 'otros',
] as const;
export type Ramo = (typeof RAMOS)[number];

export const RAMO_LABEL: Record<Ramo, string> = {
  hogar: '🏠 Hogar',
  auto: '🚗 Auto',
  vida: '❤️ Vida',
  salud: '🩺 Salud',
  rc: '⚖️ RC',
  comercio: '🏪 Comercio',
  agrario: '🚜 Agrario',
  decesos: '🕊️ Decesos',
  otros: '📄 Otros',
};

export const ESTADOS_POLIZA = ['viva', 'anulada', 'sustituida', 'vencida', 'externa'] as const;
export type EstadoPoliza = (typeof ESTADOS_POLIZA)[number];

export const ESTADO_POLIZA_LABEL: Record<EstadoPoliza, string> = {
  viva: 'Viva',
  anulada: 'Anulada',
  sustituida: 'Sustituida',
  vencida: 'Vencida',
  externa: 'Externa (otro mediador)',
};

export const TIPOS_MOVIMIENTO = [
  'produccion', 'anulacion', 'sustitucion', 'cambio_compania', 'cambio_mediador',
] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

export const TIPO_MOVIMIENTO_LABEL: Record<TipoMovimiento, string> = {
  produccion: 'Producción nueva',
  anulacion: 'Anulación real',
  sustitucion: 'Sustitución',
  cambio_compania: 'Cambio de compañía',
  cambio_mediador: 'Cambio de mediador',
};

export const ETAPAS_PIPELINE = [
  'prospecto', 'contactado', 'cotizado', 'negociacion', 'ganada', 'perdida',
] as const;
export type EtapaPipeline = (typeof ETAPAS_PIPELINE)[number];

export const ETAPA_LABEL: Record<EtapaPipeline, string> = {
  prospecto: 'Prospecto',
  contactado: 'Contactado',
  cotizado: 'Cotizado',
  negociacion: 'Negociación',
  ganada: 'Ganada',
  perdida: 'Perdida',
};

export interface VctCliente {
  id: string;
  nombre: string;
  nif: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  poblacion: string | null;
  tipo: 'particular' | 'empresa' | 'agrario';
  origen: string | null;
  responsable: string | null;
  notas: string | null;
  activo: boolean;
  creado_en: string;
}

export interface VctPoliza {
  id: string;
  cliente_id: string;
  numero_poliza: string | null;
  ramo: Ramo;
  compania: string;
  prima_anual: number;
  fecha_efecto: string | null;
  fecha_vencimiento: string;
  forma_pago: string;
  estado: EstadoPoliza;
  mediador: string;
  responsable: string | null;
  notas: string | null;
  vct_clientes?: { nombre: string } | null;
}

export interface VctMovimiento {
  id: string;
  cliente_id: string | null;
  poliza_id: string | null;
  tipo: TipoMovimiento;
  fecha: string;
  motivo: string | null;
  compania_origen: string | null;
  compania_destino: string | null;
  mediador_origen: string | null;
  mediador_destino: string | null;
  prima: number;
  responsable: string | null;
  notas: string | null;
  vct_clientes?: { nombre: string } | null;
}

export interface VctOportunidad {
  id: string;
  cliente_id: string | null;
  nombre_contacto: string;
  telefono: string | null;
  ramo: Ramo;
  compania_actual: string | null;
  etapa: EtapaPipeline;
  prima_estimada: number;
  fecha_prevista: string | null;
  responsable: string | null;
  notas: string | null;
}

export interface VctTarea {
  id: string;
  cliente_id: string | null;
  poliza_id: string | null;
  titulo: string;
  descripcion: string | null;
  fecha_limite: string | null;
  prioridad: 'alta' | 'media' | 'baja';
  estado: 'pendiente' | 'hecha';
  responsable: string | null;
  vct_clientes?: { nombre: string } | null;
}

/** Días desde hoy hasta una fecha ISO (negativo = pasada). */
export function diasHasta(fechaISO: string | null | undefined): number | null {
  if (!fechaISO) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(fechaISO);
  f.setHours(0, 0, 0, 0);
  return Math.round((f.getTime() - hoy.getTime()) / 86400000);
}

/** Clasificación semafórica del vencimiento para cartera/calendario. */
export function urgenciaVencimiento(dias: number | null): 'vencida' | 'critica' | 'proxima' | 'normal' {
  if (dias == null) return 'normal';
  if (dias < 0) return 'vencida';
  if (dias <= 30) return 'critica';
  if (dias <= 60) return 'proxima';
  return 'normal';
}

export const fmtFecha = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const fmtEur = (n: number | null | undefined) =>
  (n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
