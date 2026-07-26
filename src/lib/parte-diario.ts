/**
 * EL PARTE DIARIO — qué pasó de verdad en la cartera un día concreto.
 *
 * David rellena su parte a mano. Este es el otro: el que sale solo de lo que ha
 * quedado registrado en el sistema, para poder cruzar lo que se dijo con lo que
 * se hizo, y para que Marcos no dependa de que alguien se acuerde de contárselo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DE DÓNDE SALE
 *
 * De `app_auditoria`, que graban los triggers de la base de datos con la fila
 * ENTERA antes y después de cada cambio. Eso permite decir "el estado pasó de
 * oferta enviada a contrato firmado" en vez del inútil "se modificó un CUPS".
 *
 * Y por eso este archivo es sobre todo un traductor: de nombres de columna a
 * castellano, y de un JSON a una frase que se entienda leyéndola en voz alta.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * LO QUE NO ES: un control horario. La auditoría marca cuándo se guardó algo en
 * el sistema, no cuándo se hizo el trabajo. Una visita de las nueve de la mañana
 * que Nicola mete a las seis de la tarde aparece a las seis. Sirve para saber
 * QUÉ pasó y quién lo movió, no para medir jornadas.
 */

import { ORDEN_ESTADO_CUPS, avanceCups } from './estados-luz.ts';

export type TipoCambio = 'alta' | 'avance' | 'retroceso' | 'dinero' | 'dato' | 'baja' | 'rutina';

/** Cuánto pesa cada tipo al ordenar: primero lo que mueve el negocio. */
export const PESO: Record<TipoCambio, number> = {
  alta: 100, avance: 90, dinero: 80, retroceso: 70, dato: 40, baja: 60, rutina: 10,
};

export const ETIQUETA_TIPO: Record<TipoCambio, string> = {
  alta: 'Alta nueva',
  avance: 'Avance',
  retroceso: 'Retroceso',
  dinero: 'Dinero',
  dato: 'Dato completado',
  baja: 'Baja',
  rutina: 'Rutina',
};

/** Columnas que no aportan nada al parte: ruido de máquina. */
const IGNORAR = new Set([
  'id', 'creado_en', 'actualizado_en', 'borrado_en', 'borrado_por', 'borrado_con',
  'datos_previos', 'cliente_id', 'cups_id', 'pipeline_id', 'contrato_id', 'comision_id',
  'foto_path', 'datos', 'osm_id',
]);

/** Nombre de columna → cómo lo diría una persona. */
const ETIQUETAS: Record<string, string> = {
  nombre: 'Nombre', nif: 'NIF', telefono: 'Teléfono', email: 'Email',
  persona_contacto: 'Persona de contacto', direccion_fiscal: 'Dirección fiscal',
  tipo_cliente: 'Tipo de cliente', responsable: 'Responsable', prioridad: 'Prioridad',
  estado_comercial: 'Estado del cliente', potencial_comercial: 'Potencial',
  origen_cliente: 'Origen', via_entrada: 'Vía de entrada', observaciones: 'Observaciones',
  fecha_ultimo_contacto: 'Último contacto', fecha_proxima_accion: 'Próxima acción (fecha)',
  proxima_accion: 'Próxima acción',

  cups: 'CUPS', alias_suministro: 'Alias', direccion_suministro: 'Dirección del suministro',
  tarifa_acceso: 'Tarifa', comercializadora_actual: 'Comercializadora',
  distribuidora: 'Distribuidora', potencias_kw: 'Potencias contratadas',
  consumo_anual_kwh: 'Consumo anual', coste_anual_estimado: 'Coste anual',
  tipo_contrato: 'Tipo de contrato', fecha_inicio_contrato: 'Inicio de contrato',
  fecha_fin_contrato: 'Fin de contrato', tiene_permanencia: 'Permanencia',
  fecha_fin_permanencia: 'Fin de permanencia', dias_preaviso: 'Días de preaviso',
  fecha_limite_preaviso: 'Límite de preaviso', penalizacion: 'Penalización',
  estado_cups: 'Estado del suministro',

  nombre_oportunidad: 'Oportunidad', tipo_oportunidad: 'Tipo de oportunidad',
  estado: 'Estado', probabilidad: 'Probabilidad', ahorro_potencial: 'Ahorro potencial',
  comision_potencial: 'Comisión potencial', importe_anual_estimado: 'Importe anual',
  motivo_perdida: 'Motivo de pérdida', fecha_revision: 'Fecha de revisión',

  comercializadora_final: 'Comercializadora', estado_contrato: 'Estado del contrato',
  fecha_envio_contrato: 'Enviado al cliente', fecha_firma: 'Firma',
  fecha_envio_comercializadora: 'Enviado a comercializadora',
  fecha_activacion_prevista: 'Activación prevista', fecha_activacion_real: 'Activación',
  documentacion_completa: 'Documentación completa', incidencia: 'Incidencia',

  comercializadora: 'Comercializadora', tipo_comision: 'Tipo de comisión',
  importe_previsto: 'Importe previsto', importe_cobrado: 'Importe cobrado',
  fecha_prevista_cobro: 'Cobro previsto', fecha_cobro: 'Fecha de cobro',
  estado_comision: 'Estado de la comisión', factura_referencia: 'Factura',

  tipo_tarea: 'Tipo de tarea', descripcion: 'Descripción', notas: 'Notas',
  fecha_limite: 'Fecha límite', titulo: 'Título', tipo_fecha: 'Tipo de fecha',
  fecha: 'Fecha', resultado: 'Resultado de la visita', proxima_visita: 'Próxima visita',
  registrada_por: 'Registrada por', motivo_descarte: 'Motivo de descarte',
  tipo: 'Tipo', municipio: 'Municipio', puntuacion: 'Puntuación',
};

/** Tabla → cómo se llama esa cosa en la conversación de la oficina. */
export const ENTIDADES: Record<string, { singular: string; emoji: string }> = {
  luz_clientes:        { singular: 'Cliente', emoji: '🏢' },
  luz_cups:            { singular: 'Suministro', emoji: '⚡' },
  luz_pipeline:        { singular: 'Oportunidad', emoji: '🎯' },
  luz_contratos:       { singular: 'Contrato', emoji: '📄' },
  luz_comisiones:      { singular: 'Comisión', emoji: '💶' },
  luz_tareas:          { singular: 'Tarea', emoji: '✅' },
  luz_fechas_criticas: { singular: 'Fecha crítica', emoji: '📅' },
  luz_visitas:         { singular: 'Visita', emoji: '🚗' },
  luz_prospectos:      { singular: 'Oportunidad del mapa', emoji: '📍' },
  luz_proyectos:       { singular: 'Proyecto de ahorro', emoji: '📐' },
};

// ── Entradas ───────────────────────────────────────────────────────────────

export interface FilaAuditoria {
  id: string;
  usuario: string | null;
  accion: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  tabla: string;
  registro_id: string | null;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  creado_en: string;
}

// ── Salidas ────────────────────────────────────────────────────────────────

export interface Cambio {
  campo: string;
  etiqueta: string;
  de: string;
  a: string;
  tipo: TipoCambio;
}

export interface Accion {
  hora: string;
  usuario: string;
  persona: string;
  tabla: string;
  entidad: string;
  emoji: string;
  titulo: string;
  cliente: string | null;
  operacion: string;
  tipo: TipoCambio;
  cambios: Cambio[];
  /** Frase de una línea, lista para leer. */
  frase: string;
}

export interface BloquePersona {
  persona: string;
  acciones: Accion[];
  altas: number;
  avances: number;
  retrocesos: number;
  total: number;
}

export interface ParteDiario {
  fecha: string;
  hay_movimiento: boolean;
  resumen: {
    acciones: number;
    personas: number;
    clientes_nuevos: number;
    suministros_nuevos: number;
    oportunidades_nuevas: number;
    contratos_firmados: number;
    activaciones: number;
    comisiones_cobradas: number;
    importe_cobrado: number;
    visitas: number;
    tareas_cerradas: number;
  };
  personas: BloquePersona[];
  /** Lo que se ha dado de alta hoy, por tipo. */
  altas: Accion[];
  /** Las mejoras: lo que ha avanzado en cada cliente. */
  avances: Accion[];
  /** Lo que ha ido para atrás. Sale aparte porque es lo que hay que mirar. */
  retrocesos: Accion[];
  /** Movimiento de dinero del día. */
  dinero: Accion[];
  /** Todo lo demás, por si hace falta el detalle. */
  resto: Accion[];
}

// ── Formato ────────────────────────────────────────────────────────────────

const ES_FECHA = /^\d{4}-\d{2}-\d{2}/;

/** Un valor de la base de datos, dicho como lo diría una persona. */
export function formatearValor(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  if (Array.isArray(v)) return v.length ? v.join(' · ') : '—';
  const s = String(v);
  if (ES_FECHA.test(s)) {
    const [a, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${a}`;
  }
  // Los estados vienen en_minusculas_con_guiones
  if (/^[a-z0-9_]+$/.test(s) && s.includes('_')) return s.replace(/_/g, ' ');
  return s;
}

/** Hora local 'HH:MM' de una marca de tiempo ISO. */
export function horaDe(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** De un email a algo que se pueda leer: marcos@... → Marcos */
export function personaDe(usuario: string | null, mapa: Record<string, string> = {}): string {
  if (!usuario) return 'Sistema';
  if (mapa[usuario]) return mapa[usuario];
  const base = usuario.includes('@') ? usuario.split('@')[0] : usuario;
  const limpio = base.replace(/[._-]+/g, ' ').trim();
  return limpio ? limpio.charAt(0).toUpperCase() + limpio.slice(1) : usuario;
}

// ── El diff ────────────────────────────────────────────────────────────────

/** Estados que significan que algo se ha ganado o se ha cobrado. */
const ESTADOS_BUENOS = new Set(['activado', 'ganado', 'firmado', 'contrato_firmado', 'cobrada', 'activo']);
const ESTADOS_MALOS = new Set(['perdido', 'no_viable', 'rechazado', 'cancelado', 'anulada', 'incidencia']);

/**
 * Clasifica un cambio. Es lo que separa "esto es una mejora" de "alguien
 * corrigió una errata", y de ello depende que el parte tenga señal o sea otra
 * lista larga que nadie lee.
 */
export function clasificarCambio(campo: string, de: unknown, a: unknown): TipoCambio {
  const antes = String(de ?? '');
  const ahora = String(a ?? '');

  if (campo === 'estado_cups') {
    if (ESTADOS_MALOS.has(ahora)) return 'retroceso';
    const i = avanceCups(antes), j = avanceCups(ahora);
    if (j > i) return 'avance';
    if (i > j && j >= 0) return 'retroceso';
    return 'rutina';
  }

  if (campo === 'estado' || campo === 'estado_contrato' || campo === 'estado_comercial') {
    if (ESTADOS_MALOS.has(ahora)) return 'retroceso';
    if (ESTADOS_BUENOS.has(ahora)) return 'avance';
    return antes !== ahora ? 'avance' : 'rutina';
  }

  if (campo === 'estado_comision') return ahora === 'cobrada' ? 'dinero' : 'rutina';
  if (campo === 'importe_cobrado' || campo === 'fecha_cobro') return 'dinero';

  // Fechas que solo se rellenan cuando algo ha ocurrido de verdad
  if (['fecha_firma', 'fecha_activacion_real', 'fecha_envio_comercializadora'].includes(campo)) {
    return antes === '' && ahora !== '' ? 'avance' : 'rutina';
  }

  if (campo === 'resultado') return 'avance';
  if (campo === 'motivo_perdida' || campo === 'motivo_descarte') return 'retroceso';

  // Un dato que estaba vacío y ahora tiene contenido es trabajo hecho
  const vacioAntes = antes === '' || antes === 'null' || antes === '0';
  if (vacioAntes && ahora !== '' && ahora !== 'null') return 'dato';

  return 'rutina';
}

/** Qué ha cambiado entre dos versiones de la misma fila. */
export function diferencias(
  antes: Record<string, unknown> | null,
  despues: Record<string, unknown> | null
): Cambio[] {
  if (!antes || !despues) return [];
  const cambios: Cambio[] = [];
  for (const campo of Object.keys(despues)) {
    if (IGNORAR.has(campo)) continue;
    const a = antes[campo];
    const d = despues[campo];
    if (JSON.stringify(a ?? null) === JSON.stringify(d ?? null)) continue;
    cambios.push({
      campo,
      etiqueta: ETIQUETAS[campo] || campo.replace(/_/g, ' '),
      de: formatearValor(a),
      a: formatearValor(d),
      tipo: clasificarCambio(campo, a, d),
    });
  }
  // Lo que más pesa, primero
  return cambios.sort((x, y) => PESO[y.tipo] - PESO[x.tipo]);
}

/** El nombre por el que se conoce a esa fila. */
function tituloDe(tabla: string, fila: Record<string, unknown> | null): string {
  if (!fila) return 'Registro';
  const candidatos = ['nombre', 'cups', 'nombre_oportunidad', 'titulo', 'descripcion', 'alias_suministro'];
  for (const c of candidatos) {
    const v = fila[c];
    if (v && String(v).trim()) return String(v).trim();
  }
  return ENTIDADES[tabla]?.singular || 'Registro';
}

/** La línea que se lee en el parte. */
function fraseDe(op: string, entidad: string, titulo: string, cambios: Cambio[]): string {
  if (op === 'INSERT') return `Alta de ${entidad.toLowerCase()}: ${titulo}`;
  if (op === 'DELETE') return `Baja de ${entidad.toLowerCase()}: ${titulo}`;
  if (!cambios.length) return `${titulo}: cambio sin contenido`;
  const p = cambios[0];
  const resto = cambios.length > 1 ? ` (+${cambios.length - 1} más)` : '';
  return `${titulo} — ${p.etiqueta}: ${p.de} › ${p.a}${resto}`;
}

// ── El parte ───────────────────────────────────────────────────────────────

export interface FuentesParte {
  fecha: string;
  auditoria: FilaAuditoria[];
  /** email → nombre para mostrar. */
  nombresUsuario?: Record<string, string>;
  /** id de cliente → nombre, para colgar cada acción de su cliente. */
  clientes?: Record<string, string>;
}

export function construirParte({ fecha, auditoria, nombresUsuario = {}, clientes = {} }: FuentesParte): ParteDiario {
  const acciones: Accion[] = [];

  for (const f of auditoria) {
    const ent = ENTIDADES[f.tabla];
    if (!ent) continue; // tabla que no interesa en el parte
    const fila = f.despues || f.antes;
    const cambios = f.accion === 'UPDATE' ? diferencias(f.antes, f.despues) : [];

    // Un UPDATE que no cambió nada visible no se enseña: es ruido de guardado
    if (f.accion === 'UPDATE' && cambios.length === 0) continue;

    const tipo: TipoCambio =
      f.accion === 'INSERT' ? 'alta'
      : f.accion === 'DELETE' ? 'baja'
      : cambios[0]?.tipo || 'rutina';

    const idCliente = String((fila?.cliente_id as string) || '');
    const titulo = tituloDe(f.tabla, fila);

    acciones.push({
      hora: horaDe(f.creado_en),
      usuario: f.usuario || 'sistema',
      persona: personaDe(f.usuario, nombresUsuario),
      tabla: f.tabla,
      entidad: ent.singular,
      emoji: ent.emoji,
      titulo,
      cliente: clientes[idCliente] || null,
      operacion: f.accion,
      tipo,
      cambios,
      frase: fraseDe(f.accion, ent.singular, titulo, cambios),
    });
  }

  acciones.sort((a, b) => a.hora.localeCompare(b.hora));

  // ── Por persona ──
  const porPersona = new Map<string, Accion[]>();
  for (const a of acciones) {
    if (!porPersona.has(a.persona)) porPersona.set(a.persona, []);
    porPersona.get(a.persona)!.push(a);
  }
  const personas: BloquePersona[] = [...porPersona.entries()]
    .map(([persona, lista]) => ({
      persona,
      acciones: lista,
      altas: lista.filter((x) => x.tipo === 'alta').length,
      avances: lista.filter((x) => x.tipo === 'avance').length,
      retrocesos: lista.filter((x) => x.tipo === 'retroceso').length,
      total: lista.length,
    }))
    .sort((a, b) => b.total - a.total);

  // ── Contadores del día ──
  const cuenta = (t: string, op?: string) =>
    acciones.filter((a) => a.tabla === t && (!op || a.operacion === op)).length;

  const conCambio = (campo: string, valor?: string) =>
    acciones.filter((a) => a.cambios.some((c) => c.campo === campo && (!valor || c.a === valor)));

  const cobradas = acciones.filter(
    (a) => a.tabla === 'luz_comisiones' && a.cambios.some((c) => c.campo === 'importe_cobrado')
  );
  const importeCobrado = cobradas.reduce((s, a) => {
    const c = a.cambios.find((x) => x.campo === 'importe_cobrado');
    const n = Number(String(c?.a || '').replace(',', '.').replace(/[^\d.-]/g, ''));
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);

  const parte: ParteDiario = {
    fecha,
    hay_movimiento: acciones.length > 0,
    resumen: {
      acciones: acciones.length,
      personas: personas.length,
      clientes_nuevos: cuenta('luz_clientes', 'INSERT'),
      suministros_nuevos: cuenta('luz_cups', 'INSERT'),
      oportunidades_nuevas: cuenta('luz_pipeline', 'INSERT'),
      contratos_firmados: conCambio('fecha_firma').length,
      activaciones: conCambio('fecha_activacion_real').length,
      comisiones_cobradas: cobradas.length,
      importe_cobrado: Math.round(importeCobrado * 100) / 100,
      visitas: cuenta('luz_visitas'),
      tareas_cerradas: acciones.filter(
        (a) => a.tabla === 'luz_tareas' && a.cambios.some((c) => c.campo === 'estado' && /hecha|completad|cerrad/i.test(c.a))
      ).length,
    },
    personas,
    altas: acciones.filter((a) => a.tipo === 'alta'),
    avances: acciones.filter((a) => a.tipo === 'avance'),
    retrocesos: acciones.filter((a) => a.tipo === 'retroceso'),
    dinero: acciones.filter((a) => a.tipo === 'dinero'),
    resto: acciones.filter((a) => ['dato', 'rutina', 'baja'].includes(a.tipo)),
  };

  return parte;
}
