/**
 * Dominio del módulo "Vencimientos y Cartera" (Correbin Asociados).
 * Capa interna de control comercial — Avant/iSegur sigue siendo la herramienta operativa.
 */

// ─────────────────────────────────────────────
// RAMOS
// ─────────────────────────────────────────────
export const RAMOS = [
  'hogar', 'auto', 'flota', 'vida', 'salud', 'rc', 'comercio', 'agrario', 'decesos', 'multirriesgo', 'otros',
] as const;
export type Ramo = (typeof RAMOS)[number];

export const RAMO_LABEL: Record<string, string> = {
  hogar: '🏠 Hogar', auto: '🚗 Auto', flota: '🚛 Flota', vida: '❤️ Vida', salud: '🩺 Salud',
  rc: '⚖️ RC', comercio: '🏪 Comercio', agrario: '🚜 Agrario', decesos: '🕊️ Decesos',
  multirriesgo: '🏭 Multirriesgo', otros: '📄 Otros',
};

// ─────────────────────────────────────────────
// PRIORIDADES DE CLIENTE (A-D)
// ─────────────────────────────────────────────
export const PRIORIDADES = ['A', 'B', 'C', 'D'] as const;
export type Prioridad = (typeof PRIORIDADES)[number];

export const PRIORIDAD_LABEL: Record<Prioridad, string> = {
  A: 'A · Cuenta estratégica (dirección)',
  B: 'B · Con potencial (revisión activa)',
  C: 'C · Ordinario (gestión normal)',
  D: 'D · Pequeño (no saturar calendario)',
};

export const PRIORIDAD_TONO: Record<Prioridad, string> = {
  A: 'bg-red-500/15 text-red-400 border-red-500/30',
  B: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  C: 'bg-card/80 text-muted border-border/50',
  D: 'bg-card/60 text-muted/60 border-border/30',
};

// ─────────────────────────────────────────────
// SEGMENTOS Y COLORES
// ─────────────────────────────────────────────
export const SEGMENTOS = [
  'gran_empresa', 'pyme_importante', 'pyme_media', 'flota_transporte',
  'ayuntamiento', 'vida_salud', 'particular_selectivo', 'particular_ordinario',
] as const;
export type Segmento = (typeof SEGMENTOS)[number];

export const SEGMENTO_LABEL: Record<string, string> = {
  gran_empresa: 'Gran empresa / cuenta A',
  pyme_importante: 'Pyme importante',
  pyme_media: 'Pyme media con potencial',
  flota_transporte: 'Flota / transporte',
  ayuntamiento: 'Ayuntamiento / institución',
  vida_salud: 'Vida, salud y personales',
  particular_selectivo: 'Particular selectivo',
  particular_ordinario: 'Particular ordinario',
};

/** Color del segmento (nombre + clases de calendario/badge). */
export const SEGMENTO_COLOR: Record<string, { nombre: string; badge: string; evento: string; hex: string }> = {
  gran_empresa:         { nombre: 'rojo',     badge: 'bg-red-500/15 text-red-400 border-red-500/30',        evento: 'bg-red-500/20 text-red-300 border-red-500/40',        hex: 'FFDC2626' },
  pyme_importante:      { nombre: 'naranja',  badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30', evento: 'bg-orange-500/20 text-orange-300 border-orange-500/40', hex: 'FFEA580C' },
  pyme_media:           { nombre: 'amarillo', badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30', evento: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/40', hex: 'FFCA8A04' },
  flota_transporte:     { nombre: 'azul',     badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',      evento: 'bg-blue-500/20 text-blue-300 border-blue-500/40',      hex: 'FF2563EB' },
  ayuntamiento:         { nombre: 'morado',   badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30', evento: 'bg-purple-500/20 text-purple-300 border-purple-500/40', hex: 'FF9333EA' },
  vida_salud:           { nombre: 'verde',    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', evento: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', hex: 'FF059669' },
  particular_selectivo: { nombre: 'gris',     badge: 'bg-gray-500/15 text-gray-300 border-gray-500/30',      evento: 'bg-gray-500/20 text-gray-300 border-gray-500/40',      hex: 'FF6B7280' },
  particular_ordinario: { nombre: 'gris',     badge: 'bg-card/60 text-muted/70 border-border/30',            evento: 'bg-card/60 text-muted border-border/30',              hex: 'FF9CA3AF' },
};

/** Segmentos que NO deben saturar el calendario principal. */
export const SEGMENTOS_FUERA_CALENDARIO: string[] = ['particular_ordinario'];

/** Días de antelación de alerta por segmento. */
export const ALERTAS_POR_SEGMENTO: Record<string, number[]> = {
  gran_empresa: [120, 60, 30, 15],
  flota_transporte: [120, 60, 30, 15],
  ayuntamiento: [120, 60, 30, 15],
  pyme_importante: [90, 45, 15],
  pyme_media: [90, 45, 15],
  vida_salud: [60, 30, 7],
  particular_selectivo: [60, 30, 7],
  particular_ordinario: [],
};

// ─────────────────────────────────────────────
// PÓLIZAS
// ─────────────────────────────────────────────
export const ESTADOS_POLIZA = [
  'activa', 'pendiente_revision', 'sustituida', 'anulada', 'vencida', 'bloqueada', 'sin_datos', 'viva', 'externa',
] as const;
export type EstadoPoliza = (typeof ESTADOS_POLIZA)[number];

export const ESTADO_POLIZA_LABEL: Record<string, string> = {
  activa: 'Activa', viva: 'Activa', pendiente_revision: 'Pendiente revisión',
  sustituida: 'Sustituida', anulada: 'Anulada', vencida: 'Vencida',
  bloqueada: 'Bloqueada', sin_datos: 'Sin datos completos', externa: 'Externa',
};

/** Estados que cuentan como cartera viva. */
export const ESTADOS_CARTERA_VIVA: string[] = ['activa', 'viva', 'pendiente_revision', 'sin_datos'];

// ─────────────────────────────────────────────
// VENCIMIENTOS
// ─────────────────────────────────────────────
export const ESTADOS_VENCIMIENTO = [
  'pendiente_revisar', 'doc_solicitada', 'doc_recibida', 'en_analisis',
  'propuesta_solicitada', 'propuesta_recibida', 'propuesta_enviada',
  'seguimiento', 'renovado', 'sustituido', 'perdido', 'no_prioritario', 'bloqueado',
] as const;
export type EstadoVencimiento = (typeof ESTADOS_VENCIMIENTO)[number];

export const ESTADO_VCT_LABEL: Record<string, string> = {
  pendiente_revisar: 'Pendiente de revisar',
  doc_solicitada: 'Documentación solicitada',
  doc_recibida: 'Documentación recibida',
  en_analisis: 'En análisis',
  propuesta_solicitada: 'Propuesta solicitada',
  propuesta_recibida: 'Propuesta recibida',
  propuesta_enviada: 'Propuesta enviada',
  seguimiento: 'Seguimiento',
  renovado: 'Renovado',
  sustituido: 'Sustituido',
  perdido: 'Perdido',
  no_prioritario: 'No prioritario',
  bloqueado: 'Bloqueado',
};

/** Estados de vencimiento que se consideran cerrados. */
export const VCT_CERRADOS: string[] = ['renovado', 'sustituido', 'perdido', 'no_prioritario'];

/** Título automático: VTO - Cliente - Ramo - Prima - Compañía */
export function tituloVencimiento(cliente: string, ramo: string, prima: number, compania: string) {
  const primaTxt = prima > 0
    ? `${Math.round(prima).toLocaleString('es-ES')} EUR`
    : 'sin prima';
  return `VTO - ${cliente} - ${RAMO_LABEL[ramo]?.replace(/^\S+\s/, '') || ramo} - ${primaTxt} - ${compania || 'sin compañía'}`;
}

// ─────────────────────────────────────────────
// PRODUCCIÓN
// ─────────────────────────────────────────────
export const TIPOS_PRODUCCION = ['nueva', 'ampliacion', 'sustitucion', 'cambio_compania', 'regularizacion'] as const;
export type TipoProduccion = (typeof TIPOS_PRODUCCION)[number];

export const TIPO_PRODUCCION_LABEL: Record<string, string> = {
  nueva: 'Nueva producción real',
  ampliacion: 'Ampliación',
  sustitucion: 'Sustitución',
  cambio_compania: 'Cambio de compañía',
  regularizacion: 'Regularización',
};

/** Tipos que suman cartera nueva real (el resto es movimiento técnico). */
export const PRODUCCION_REAL: string[] = ['nueva', 'ampliacion'];

// ─────────────────────────────────────────────
// ANULACIONES
// ─────────────────────────────────────────────
export const TIPOS_ANULACION = ['real', 'sustitucion_tecnica', 'impago', 'venta_riesgo', 'error_admin', 'cambio_compania'] as const;
export type TipoAnulacion = (typeof TIPOS_ANULACION)[number];

export const TIPO_ANULACION_LABEL: Record<string, string> = {
  real: 'Anulación real',
  sustitucion_tecnica: 'Sustitución técnica',
  impago: 'Impago',
  venta_riesgo: 'Baja por venta del riesgo',
  error_admin: 'Error administrativo',
  cambio_compania: 'Cambio de compañía',
};

/** Tipos que restan cartera de verdad. */
export const ANULACION_RESTA_CARTERA: string[] = ['real', 'impago', 'venta_riesgo'];

// ─────────────────────────────────────────────
// CAMBIOS DE MEDIADOR
// ─────────────────────────────────────────────
export const ESTADOS_CAMBIO_MEDIADOR = [
  'detectado', 'carta_solicitada', 'carta_firmada', 'enviado_compania', 'aceptado', 'incorporado', 'rechazado',
] as const;
export type EstadoCambioMediador = (typeof ESTADOS_CAMBIO_MEDIADOR)[number];

export const ESTADO_CM_LABEL: Record<string, string> = {
  detectado: 'Detectado',
  carta_solicitada: 'Carta solicitada',
  carta_firmada: 'Carta firmada',
  enviado_compania: 'Enviado a compañía',
  aceptado: 'Aceptado',
  incorporado: 'Incorporado a código',
  rechazado: 'Rechazado',
};

// ─────────────────────────────────────────────
// PIPELINE
// ─────────────────────────────────────────────
export const ETAPAS_PIPELINE = [
  'prospecto', 'doc_solicitada', 'doc_recibida', 'propuesta_enviada', 'seguimiento', 'cerrado_ganado', 'cerrado_perdido',
] as const;
export type EtapaPipeline = (typeof ETAPAS_PIPELINE)[number];

export const ETAPA_LABEL: Record<string, string> = {
  prospecto: 'Prospecto / contactado',
  doc_solicitada: 'Doc. solicitada',
  doc_recibida: 'Doc. recibida',
  propuesta_enviada: 'Propuesta enviada',
  seguimiento: 'Seguimiento',
  cerrado_ganado: 'Cerrado GANADO',
  cerrado_perdido: 'Cerrado perdido',
  // compatibilidad v1
  contactado: 'Prospecto / contactado', cotizado: 'Doc. recibida',
  negociacion: 'Seguimiento', ganada: 'Cerrado GANADO', perdida: 'Cerrado perdido',
};

export const PIPELINE_CERRADO: string[] = ['cerrado_ganado', 'cerrado_perdido', 'ganada', 'perdida'];

// ─────────────────────────────────────────────
// TAREAS
// ─────────────────────────────────────────────
export const TIPOS_TAREA = [
  'llamar_cliente', 'pedir_poliza', 'pedir_recibo', 'pedir_carta_mediador', 'solicitar_cotizacion',
  'enviar_propuesta', 'seguimiento', 'confirmar_emision', 'confirmar_cobro', 'cargar_documentacion',
  'derivar_energia', 'derivar_asesoria',
] as const;
export type TipoTarea = (typeof TIPOS_TAREA)[number];

export const TIPO_TAREA_LABEL: Record<string, string> = {
  llamar_cliente: '📞 Llamar cliente',
  pedir_poliza: '📄 Pedir póliza',
  pedir_recibo: '🧾 Pedir recibo',
  pedir_carta_mediador: '✉️ Pedir carta de mediador',
  solicitar_cotizacion: '💬 Solicitar cotización',
  enviar_propuesta: '📤 Enviar propuesta',
  seguimiento: '👀 Seguimiento',
  confirmar_emision: '✅ Confirmar emisión',
  confirmar_cobro: '💶 Confirmar cobro',
  cargar_documentacion: '📁 Cargar documentación',
  derivar_energia: '⚡ Derivar a energía',
  derivar_asesoria: '📋 Derivar a asesoría',
};

export const ESTADOS_TAREA = ['pendiente', 'emitido', 'bloqueada', 'exclusion'] as const;
export const ESTADO_TAREA_LABEL: Record<string, string> = {
  pendiente: 'Pendiente', emitido: 'Emitido', bloqueada: 'Bloqueada', exclusion: 'Exclusión',
  // Estados históricos (registros anteriores): se muestran con su equivalente actual
  en_curso: 'Pendiente', completada: 'Emitido', hecha: 'Emitido', cancelada: 'Exclusión',
};
/** Equivalencia de estados históricos → estado actual (no se tocan los datos guardados). */
export const TAREA_ESTADO_EQUIVALENTE: Record<string, string> = {
  en_curso: 'pendiente', completada: 'emitido', hecha: 'emitido', cancelada: 'exclusion',
};
export const estadoTareaCanonico = (e: string): string => TAREA_ESTADO_EQUIVALENTE[e] || e;
export const TAREAS_ABIERTAS: string[] = ['pendiente', 'en_curso', 'bloqueada'];

// ─────────────────────────────────────────────
// ROLES (estructura preparada)
// ─────────────────────────────────────────────
export const ROLES = ['direccion', 'renovaciones', 'auto_particulares', 'comercial', 'administracion', 'derivaciones'] as const;
export const ROL_LABEL: Record<string, string> = {
  direccion: 'Dirección',
  renovaciones: 'Renovaciones / técnico',
  auto_particulares: 'Auto / particulares',
  comercial: 'Comercial',
  administracion: 'Administración',
  derivaciones: 'Derivaciones energía / asesoría',
};

// ─────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────
export interface VctCliente {
  id: string;
  nombre: string;
  nif: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  poblacion: string | null;
  contacto_principal: string | null;
  tipo: string;
  origen: string | null;
  responsable: string | null;
  prioridad: Prioridad;
  segmento: string;
  potencial_comercial: string | null;
  prima_total: number;
  comision_total: number;
  notas: string | null;
  activo: boolean;
  creado_en: string;
}

export interface VctPoliza {
  id: string;
  cliente_id: string;
  numero_poliza: string | null;
  ramo: string;
  compania: string;
  prima_anual: number;
  comision: number;
  fecha_efecto: string | null;
  fecha_vencimiento: string | null;
  forma_pago: string;
  estado: string;
  mediador: string;
  responsable: string | null;
  prioridad: string | null;
  segmento: string | null;
  origen_importacion: string | null;
  notas: string | null;
  vct_clientes?: { nombre: string; nif?: string | null; prioridad?: string; segmento?: string } | null;
}

export interface VctVencimiento {
  id: string;
  cliente_id: string;
  poliza_id: string | null;
  fecha_vct: string;
  titulo_evento: string;
  segmento: string;
  color: string;
  estado_vencimiento: string;
  responsable: string | null;
  fecha_ultimo_contacto: string | null;
  proxima_accion: string | null;
  fecha_proxima_accion: string | null;
  observaciones: string | null;
  /** v3: guardados en el propio vencimiento (importación directa) */
  numero_poliza?: string | null;
  compania?: string | null;
  vct_clientes?: { nombre: string; prioridad?: string; tipo?: string | null } | null;
  vct_polizas?: { numero_poliza: string | null; compania: string | null } | null;
}

/** Tomador, nº de póliza y compañía de un vencimiento (campo propio → póliza vinculada → título). */
export function infoVencimiento(v: VctVencimiento): { tomador: string; poliza: string; compania: string } {
  // El título automático tiene la forma: "VTO - Cliente - Ramo - Prima - Compañía"
  const partes = (v.titulo_evento || '').split(' - ');
  return {
    tomador: v.vct_clientes?.nombre || (partes.length >= 2 ? partes[1] : '') || '—',
    poliza: v.numero_poliza || v.vct_polizas?.numero_poliza || '—',
    compania: v.compania || v.vct_polizas?.compania || (partes.length >= 5 ? partes[partes.length - 1] : '') || '—',
  };
}

export interface VctProduccion {
  id: string;
  cliente_id: string | null;
  poliza_id: string | null;
  fecha_emision: string;
  fecha_efecto: string | null;
  ramo: string;
  compania: string | null;
  prima: number;
  comision: number;
  tipo_produccion: string;
  responsable: string | null;
  observaciones: string | null;
  vct_clientes?: { nombre: string } | null;
}

export interface VctAnulacion {
  id: string;
  cliente_id: string | null;
  poliza_id: string | null;
  fecha_anulacion: string;
  prima: number;
  motivo: string | null;
  tipo_anulacion: string;
  poliza_sustituta_id: string | null;
  afecta_cartera: boolean;
  responsable: string | null;
  observaciones: string | null;
  vct_clientes?: { nombre: string } | null;
}

export interface VctCambioMediador {
  id: string;
  cliente_id: string | null;
  prima: number;
  compania: string | null;
  ramo: string | null;
  carta_firmada: boolean;
  estado_compania: string | null;
  fecha_solicitud: string | null;
  fecha_envio_compania: string | null;
  fecha_entrada: string | null;
  estado: string;
  responsable: string | null;
  observaciones: string | null;
  vct_clientes?: { nombre: string } | null;
}

export interface VctOportunidad {
  id: string;
  cliente_id: string | null;
  nombre_contacto: string;
  telefono: string | null;
  ramo: string;
  compania_actual: string | null;
  etapa: string;
  prima_estimada: number;
  probabilidad: number;
  documentacion_recibida: boolean;
  proxima_accion: string | null;
  fecha_proxima_accion: string | null;
  resultado: string | null;
  fecha_prevista: string | null;
  responsable: string | null;
  notas: string | null;
  vct_clientes?: { nombre: string } | null;
}

export interface VctTarea {
  id: string;
  cliente_id: string | null;
  poliza_id: string | null;
  vencimiento_id: string | null;
  pipeline_id: string | null;
  tipo_tarea: string;
  titulo: string;
  descripcion: string | null;
  fecha_limite: string | null;
  prioridad: string;
  estado: string;
  responsable: string | null;
  vct_clientes?: { nombre: string } | null;
}

export interface VctResponsable {
  id: string;
  nombre: string;
  rol: string;
  activo: boolean;
}

// ─────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────
export function diasHasta(fechaISO: string | null | undefined): number | null {
  if (!fechaISO) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(fechaISO);
  f.setHours(0, 0, 0, 0);
  return Math.round((f.getTime() - hoy.getTime()) / 86400000);
}

export function urgenciaVencimiento(dias: number | null): 'vencida' | 'critica' | 'proxima' | 'normal' {
  if (dias == null) return 'normal';
  if (dias < 0) return 'vencida';
  if (dias <= 30) return 'critica';
  if (dias <= 60) return 'proxima';
  return 'normal';
}

/** ¿El vencimiento está dentro de la ventana de alerta de su segmento? */
export function enVentanaAlerta(segmento: string, dias: number | null): boolean {
  if (dias == null || dias < 0) return dias != null; // vencido = siempre alerta
  const ventanas = ALERTAS_POR_SEGMENTO[segmento] || [60, 30];
  const maxVentana = Math.max(...(ventanas.length ? ventanas : [60]));
  return dias <= maxVentana;
}

/** Normaliza nombre de cliente para emparejar (mayúsculas, sin espacios dobles ni puntuación). */
export function normalizarNombre(n: string): string {
  return n.trim().toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[.,;]/g, ' ')
    .replace(/\b(SL|SLU|SA|SAU|SCP|CB|SC)\b\.?/g, '$1')
    .replace(/\s+/g, ' ');
}

export const fmtFecha = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const fmtEur = (n: number | null | undefined) =>
  (n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

export const fmtEur0 = (n: number | null | undefined) =>
  (n || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €';

// Compatibilidad v1 (movimientos legacy)
export const TIPOS_MOVIMIENTO = ['produccion', 'anulacion', 'sustitucion', 'cambio_compania', 'cambio_mediador'] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];
export const TIPO_MOVIMIENTO_LABEL: Record<string, string> = {
  produccion: 'Producción nueva', anulacion: 'Anulación real', sustitucion: 'Sustitución',
  cambio_compania: 'Cambio de compañía', cambio_mediador: 'Cambio de mediador',
};
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
