/**
 * Dominio del módulo "Gestión Luz / Cartera Energética".
 * Cada CUPS: responsable, estado, fecha clave, próxima acción, contrato, activación y comisión.
 * NO sustituye a la comparativa de facturas existente.
 */

// ── Prioridades (A-D, mismas reglas que Correbin) ──
export const PRIORIDADES = ['A', 'B', 'C', 'D'] as const;
export type PrioridadLuz = (typeof PRIORIDADES)[number];

export const PRIORIDAD_LABEL: Record<string, string> = {
  A: 'A · Estratégico (seguimiento directo)',
  B: 'B · Con potencial (revisión activa)',
  C: 'C · Normal',
  D: 'D · Pequeño (no saturar calendario)',
};

export const PRIORIDAD_TONO: Record<string, string> = {
  A: 'bg-red-500/15 text-red-400 border-red-500/30',
  B: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  C: 'bg-card/80 text-muted border-border/50',
  D: 'bg-card/60 text-muted/60 border-border/30',
};

/** Ventanas de alerta (días antes) por prioridad del cliente. */
export const ALERTAS_POR_PRIORIDAD: Record<string, number[]> = {
  A: [120, 90, 60, 30, 15],
  B: [90, 60, 30, 15],
  C: [60, 30, 15],
  D: [],
};

// ── Tipos de cliente ──
export const TIPOS_CLIENTE = ['particular', 'autonomo', 'pyme', 'industria', 'comunidad', 'ayuntamiento', 'gran_cuenta'] as const;
export const TIPO_CLIENTE_LABEL: Record<string, string> = {
  particular: 'Particular', autonomo: 'Autónomo', pyme: 'Pyme', industria: 'Industria',
  comunidad: 'Comunidad', ayuntamiento: 'Ayuntamiento', gran_cuenta: 'Gran cuenta',
};

// ── Estados del cliente ──
export const ESTADOS_CLIENTE = [
  'detectado', 'contacto_iniciado', 'factura_solicitada', 'doc_recibida', 'en_analisis',
  'pendiente_decision', 'contrato_tramite', 'activo', 'perdido', 'no_viable', 'revisar_adelante',
] as const;
export const ESTADO_CLIENTE_LABEL: Record<string, string> = {
  detectado: 'Detectado', contacto_iniciado: 'Contacto iniciado', factura_solicitada: 'Factura solicitada',
  doc_recibida: 'Documentación recibida', en_analisis: 'En análisis interno', pendiente_decision: 'Pendiente decisión',
  contrato_tramite: 'Contrato en trámite', activo: 'Cliente activo', perdido: 'Perdido',
  no_viable: 'No viable', revisar_adelante: 'Revisar más adelante',
};

// ── Tarifas de acceso ──
export const TARIFAS_ACCESO = ['2.0TD', '3.0TD', '6.1TD', '6.2TD', 'otra'] as const;

// ── Estados del CUPS ──
export const ESTADOS_CUPS = [
  'sin_factura', 'factura_recibida', 'datos_incompletos', 'pendiente_permanencia', 'pendiente_ofertar',
  'oferta_enviada', 'pendiente_firma', 'contrato_firmado', 'pendiente_activacion', 'activado',
  'perdido', 'no_viable', 'revisar_adelante',
] as const;
export const ESTADO_CUPS_LABEL: Record<string, string> = {
  sin_factura: 'Sin factura', factura_recibida: 'Factura recibida', datos_incompletos: 'Datos incompletos',
  pendiente_permanencia: 'Pendiente revisar permanencia', pendiente_ofertar: 'Pendiente ofertar',
  oferta_enviada: 'Oferta enviada', pendiente_firma: 'Pendiente firma', contrato_firmado: 'Contrato firmado',
  pendiente_activacion: 'Pendiente activación', activado: 'Activado', perdido: 'Perdido',
  no_viable: 'No viable', revisar_adelante: 'Revisar más adelante',
};

// ── Fechas críticas ──
export const TIPOS_FECHA = [
  'fin_contrato', 'fin_permanencia', 'limite_preaviso', 'presentar_proyecto', 'revision_comercial',
  'seguimiento_oferta', 'contrato_pendiente_firma', 'activacion_pendiente', 'revision_comision', 'cliente_a_sin_accion',
] as const;
export const TIPO_FECHA_LABEL: Record<string, string> = {
  fin_contrato: 'Fin contrato', fin_permanencia: 'Fin permanencia', limite_preaviso: 'Límite preaviso',
  presentar_proyecto: 'Presentar proyecto', revision_comercial: 'Revisión comercial', seguimiento_oferta: 'Seguimiento oferta',
  contrato_pendiente_firma: 'Contrato pendiente firma', activacion_pendiente: 'Activación pendiente',
  revision_comision: 'Revisión comisión', cliente_a_sin_accion: 'Cliente A sin acción',
};
export const TIPO_FECHA_TONO: Record<string, string> = {
  fin_contrato: 'bg-red-500/15 text-red-400 border-red-500/30',
  fin_permanencia: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  limite_preaviso: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  presentar_proyecto: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
  revision_comercial: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  seguimiento_oferta: 'bg-secondary/15 text-secondary border-secondary/30',
  contrato_pendiente_firma: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  activacion_pendiente: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  revision_comision: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  cliente_a_sin_accion: 'bg-red-500/20 text-red-300 border-red-500/40',
};

/** Título automático: LUZ - Cliente - CUPS - Tipo fecha - Comercializadora */
export function tituloFechaCritica(cliente: string, cups: string, tipo: string, comercializadora?: string | null) {
  const cupsCorto = cups ? `${cups.slice(0, 6)}...` : 'sin CUPS';
  return `LUZ - ${cliente} - ${cupsCorto} - ${TIPO_FECHA_LABEL[tipo] || tipo} - ${comercializadora || 'sin comercializadora'}`;
}

// ── Pipeline ──
export const TIPOS_OPORTUNIDAD = [
  'cambio_comercializadora', 'renovacion', 'revision_permanencia', 'alta_nuevo', 'varios_cups',
  'comunidad', 'alto_consumo', 'derivacion_asesoria', 'derivacion_seguros', 'derivacion_fotovoltaica',
] as const;
export const TIPO_OPORTUNIDAD_LABEL: Record<string, string> = {
  cambio_comercializadora: 'Cambio comercializadora', renovacion: 'Renovación contrato',
  revision_permanencia: 'Revisión permanencia', alta_nuevo: 'Alta nuevo suministro',
  varios_cups: 'Varios CUPS', comunidad: 'Comunidad', alto_consumo: 'Empresa alto consumo',
  derivacion_asesoria: 'Derivación asesoría', derivacion_seguros: 'Derivación seguros',
  derivacion_fotovoltaica: 'Derivación fotovoltaica',
};

export const ESTADOS_PIPELINE = [
  'prospecto', 'factura_solicitada', 'factura_recibida', 'doc_incompleta', 'pendiente_permanencia',
  'pendiente_ofertar', 'oferta_enviada', 'seguimiento', 'pendiente_firma', 'ganado', 'perdido', 'revisar_adelante',
] as const;
export const ESTADO_PIPELINE_LABEL: Record<string, string> = {
  prospecto: 'Prospecto', factura_solicitada: 'Factura solicitada', factura_recibida: 'Factura recibida',
  doc_incompleta: 'Doc. incompleta', pendiente_permanencia: 'Pte. permanencia', pendiente_ofertar: 'Pte. ofertar',
  oferta_enviada: 'Oferta enviada', seguimiento: 'Seguimiento', pendiente_firma: 'Pendiente firma',
  ganado: 'GANADO', perdido: 'Perdido', revisar_adelante: 'Revisar más adelante',
};
export const PIPELINE_CERRADO: string[] = ['ganado', 'perdido'];
export const PIPELINE_ABIERTO_SIN_REVISAR: string[] = ['ganado', 'perdido', 'revisar_adelante'];

// ── Contratos ──
export const ESTADOS_CONTRATO = [
  'pendiente_preparar', 'enviado_cliente', 'pendiente_firma', 'firmado', 'enviado_comercializadora',
  'pendiente_validacion', 'pendiente_activacion', 'activado', 'rechazado', 'cancelado', 'incidencia',
] as const;
export const ESTADO_CONTRATO_LABEL: Record<string, string> = {
  pendiente_preparar: 'Pendiente preparar', enviado_cliente: 'Enviado al cliente', pendiente_firma: 'Pendiente firma',
  firmado: 'Firmado', enviado_comercializadora: 'Enviado a comercializadora', pendiente_validacion: 'Pendiente validación',
  pendiente_activacion: 'Pendiente activación', activado: 'Activado', rechazado: 'Rechazado',
  cancelado: 'Cancelado', incidencia: 'Incidencia',
};
export const CONTRATO_EN_CURSO: string[] = [
  'pendiente_preparar', 'enviado_cliente', 'pendiente_firma', 'firmado',
  'enviado_comercializadora', 'pendiente_validacion', 'pendiente_activacion',
];

// ── Comisiones ──
export const TIPOS_COMISION = ['fija_factura', 'por_kwh', 'por_potencia', 'pago_unico', 'recurrente_mensual', 'recurrente_anual', 'mixta', 'desconocida'] as const;
export const TIPO_COMISION_LABEL: Record<string, string> = {
  fija_factura: 'Fija por factura', por_kwh: 'Por kWh', por_potencia: 'Por potencia', pago_unico: 'Pago único',
  recurrente_mensual: 'Recurrente mensual', recurrente_anual: 'Recurrente anual', mixta: 'Mixta', desconocida: 'Desconocida',
};

export const ESTADOS_COMISION = ['prevista', 'pendiente_validar', 'pendiente_cobro', 'cobrada', 'cobrada_parcial', 'reclamada', 'perdida', 'cancelada'] as const;
export const ESTADO_COMISION_LABEL: Record<string, string> = {
  prevista: 'Prevista', pendiente_validar: 'Pendiente validar', pendiente_cobro: 'Pendiente cobro',
  cobrada: 'Cobrada', cobrada_parcial: 'Cobrada parcial', reclamada: 'Reclamada', perdida: 'Perdida', cancelada: 'Cancelada',
};
export const COMISION_PENDIENTE: string[] = ['prevista', 'pendiente_validar', 'pendiente_cobro', 'reclamada', 'cobrada_parcial'];

// ── Tareas ──
export const TIPOS_TAREA = [
  'llamar_cliente', 'pedir_factura', 'pedir_autorizacion', 'pedir_documentacion', 'revisar_permanencia',
  'revisar_preaviso', 'preparar_oferta', 'enviar_oferta', 'seguimiento', 'enviar_contrato', 'reclamar_firma',
  'enviar_comercializadora', 'confirmar_activacion', 'revisar_comision', 'reclamar_comision', 'revisar_futuro',
] as const;
export const TIPO_TAREA_LABEL: Record<string, string> = {
  llamar_cliente: '📞 Llamar cliente', pedir_factura: '🧾 Pedir factura', pedir_autorizacion: '✍️ Pedir autorización',
  pedir_documentacion: '📁 Pedir documentación', revisar_permanencia: '🔒 Revisar permanencia',
  revisar_preaviso: '⏰ Revisar preaviso', preparar_oferta: '📊 Preparar oferta', enviar_oferta: '📤 Enviar oferta',
  seguimiento: '👀 Hacer seguimiento', enviar_contrato: '📄 Enviar contrato', reclamar_firma: '✒️ Reclamar firma',
  enviar_comercializadora: '📮 Enviar a comercializadora', confirmar_activacion: '✅ Confirmar activación',
  revisar_comision: '💶 Revisar comisión', reclamar_comision: '📢 Reclamar comisión', revisar_futuro: '🔮 Revisar en el futuro',
};
/**
 * Reparto automático del trabajo:
 * - Tareas ADMINISTRATIVAS (papeleo, contratos, cobros) → rol "administracion" (Nicola).
 * - Tareas COMERCIALES (hablar con el cliente, ofertas) → rol "comercial" (David).
 * Al crear una tarea se sugiere el responsable según su tipo; siempre se puede cambiar.
 */
export const TAREAS_ADMINISTRATIVAS: string[] = [
  'pedir_autorizacion', 'pedir_documentacion', 'enviar_contrato', 'reclamar_firma',
  'enviar_comercializadora', 'confirmar_activacion', 'revisar_comision', 'reclamar_comision',
];
export const TAREAS_COMERCIALES: string[] = [
  'llamar_cliente', 'pedir_factura', 'preparar_oferta', 'enviar_oferta', 'seguimiento',
  'revisar_permanencia', 'revisar_preaviso', 'revisar_futuro',
];

export interface ResponsableEquipo { id: string; nombre: string; rol: string; activo: boolean }

/** Responsable sugerido para un tipo de tarea según los roles del equipo. */
export function responsableSugerido(tipoTarea: string, equipo: ResponsableEquipo[]): ResponsableEquipo | null {
  const rol = TAREAS_ADMINISTRATIVAS.includes(tipoTarea) ? 'administracion'
    : TAREAS_COMERCIALES.includes(tipoTarea) ? 'comercial'
    : null;
  if (!rol) return null;
  return equipo.find((r) => r.activo && r.rol === rol) || null;
}

/** Motivos rápidos para cuando algo se bloquea o se pierde (un toque y listo). */
export const MOTIVOS_BLOQUEO = ['Esperando al cliente', 'Falta documentación', 'Esperando a la comercializadora', 'Pendiente de decisión interna'];
export const MOTIVOS_PERDIDA = ['Precio no competitivo', 'Permanencia con penalización', 'No contesta', 'Se queda como está', 'Se fue con otro'];

export const ESTADOS_TAREA = ['pendiente', 'en_curso', 'completada', 'bloqueada', 'cancelada'] as const;
export const ESTADO_TAREA_LABEL: Record<string, string> = {
  pendiente: 'Pendiente', en_curso: 'En curso', completada: 'Completada', bloqueada: 'Bloqueada', cancelada: 'Cancelada',
};
export const TAREAS_ABIERTAS: string[] = ['pendiente', 'en_curso', 'bloqueada'];

// ── Interfaces ──
export interface LuzCliente {
  id: string;
  nombre: string;
  nif: string | null;
  tipo_cliente: string;
  persona_contacto: string | null;
  telefono: string | null;
  email: string | null;
  direccion_fiscal: string | null;
  responsable: string | null;
  prioridad: string;
  estado_comercial: string;
  potencial_comercial: string | null;
  origen_cliente: string | null;
  observaciones: string | null;
  fecha_ultimo_contacto: string | null;
  fecha_proxima_accion: string | null;
  proxima_accion: string | null;
}

export interface LuzCups {
  id: string;
  cliente_id: string;
  cups: string;
  alias_suministro: string | null;
  direccion_suministro: string | null;
  tarifa_acceso: string;
  comercializadora_actual: string | null;
  distribuidora: string | null;
  potencias_kw: number[];
  consumo_anual_kwh: number;
  coste_anual_estimado: number;
  tipo_contrato: string;
  fecha_inicio_contrato: string | null;
  fecha_fin_contrato: string | null;
  tiene_permanencia: boolean;
  fecha_fin_permanencia: string | null;
  dias_preaviso: number | null;
  fecha_limite_preaviso: string | null;
  penalizacion: string | null;
  estado_cups: string;
  responsable: string | null;
  prioridad: string | null;
  observaciones: string | null;
  luz_clientes?: { nombre: string; nif?: string | null; prioridad?: string } | null;
}

export interface LuzFechaCritica {
  id: string;
  cliente_id: string;
  cups_id: string | null;
  tipo_fecha: string;
  fecha: string;
  titulo: string;
  descripcion: string | null;
  prioridad: string;
  estado: string;
  responsable: string | null;
  luz_clientes?: { nombre: string; prioridad?: string } | null;
}

export interface LuzOportunidad {
  id: string;
  cliente_id: string | null;
  cups_id: string | null;
  nombre_oportunidad: string;
  tipo_oportunidad: string;
  tarifa: string | null;
  comercializadora_actual: string | null;
  consumo_anual_kwh: number;
  importe_anual_estimado: number;
  ahorro_potencial: number;
  comision_potencial: number;
  estado: string;
  probabilidad: number;
  responsable: string | null;
  proxima_accion: string | null;
  fecha_proxima_accion: string | null;
  fecha_revision: string | null;
  motivo_perdida: string | null;
  observaciones: string | null;
  luz_clientes?: { nombre: string; prioridad?: string } | null;
}

export interface LuzContrato {
  id: string;
  cliente_id: string | null;
  cups_id: string | null;
  pipeline_id: string | null;
  comercializadora_final: string | null;
  tarifa_acceso: string | null;
  tipo_contrato: string;
  fecha_envio_contrato: string | null;
  fecha_firma: string | null;
  fecha_envio_comercializadora: string | null;
  fecha_activacion_prevista: string | null;
  fecha_activacion_real: string | null;
  estado_contrato: string;
  documentacion_completa: boolean;
  incidencia: string | null;
  responsable: string | null;
  observaciones: string | null;
  luz_clientes?: { nombre: string } | null;
  luz_cups?: { cups: string } | null;
}

export interface LuzComision {
  id: string;
  cliente_id: string | null;
  cups_id: string | null;
  contrato_id: string | null;
  comercializadora: string | null;
  tipo_comision: string;
  importe_previsto: number;
  importe_cobrado: number;
  fecha_prevista_cobro: string | null;
  fecha_cobro: string | null;
  estado_comision: string;
  factura_referencia: string | null;
  observaciones: string | null;
  luz_clientes?: { nombre: string } | null;
  luz_cups?: { cups: string } | null;
}

export interface LuzTarea {
  id: string;
  cliente_id: string | null;
  cups_id: string | null;
  pipeline_id: string | null;
  contrato_id: string | null;
  comision_id: string | null;
  tipo_tarea: string;
  descripcion: string;
  notas?: string | null;
  responsable: string | null;
  fecha_limite: string | null;
  estado: string;
  prioridad: string;
  actualizado_en?: string;
  luz_clientes?: { nombre: string } | null;
}

// ── Utilidades ──
export function diasHasta(fechaISO: string | null | undefined): number | null {
  if (!fechaISO) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(fechaISO);
  f.setHours(0, 0, 0, 0);
  return Math.round((f.getTime() - hoy.getTime()) / 86400000);
}

/** ¿Dentro de la ventana de alerta según la prioridad del cliente? */
export function enVentanaAlertaLuz(prioridad: string, dias: number | null): boolean {
  if (dias == null) return false;
  if (dias < 0) return true;
  const ventanas = ALERTAS_POR_PRIORIDAD[prioridad] || [60, 30];
  return ventanas.length > 0 && dias <= Math.max(...ventanas);
}

export const normCups = (c: string) => c.trim().toUpperCase().replace(/\s+/g, '');

export function normalizarNombre(n: string): string {
  return n.trim().toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[.,;]/g, ' ')
    .replace(/\s+/g, ' ');
}

export const fmtFecha = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const fmtEur = (n: number | null | undefined) =>
  (n || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €';

export const fmtKwh = (n: number | null | undefined) =>
  (n || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' kWh';
