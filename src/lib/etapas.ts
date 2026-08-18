/**
 * ETAPAS · EL VOCABULARIO ÚNICO DEL VIAJE (GL-01)
 *
 * El plan de optimización pide «unificar estados de cliente, oportunidad,
 * suministro y contrato». Hoy cada uno de esos cuatro objetos tiene su propia
 * lista: 11 estados de cliente, 12 de oportunidad, 11 de suministro y 11 de
 * contrato. Ninguna coincide con las otras, así que el mismo cliente puede
 * leerse de cuatro maneras distintas según la pantalla.
 *
 * POR QUÉ ESTO NO RENOMBRA NADA EN LA BASE DE DATOS
 *
 * La tentación era reescribir los valores guardados a las siete etapas del
 * plan. Medido antes de decidir: 41 archivos del código comprueban esos
 * nombres literalmente, y encima habría que migrar producción. Eso pone en
 * riesgo la sincronización entre pipeline, CUPS y contrato —lo que más costó
 * afinar— a cambio de nada que el usuario note.
 *
 * Lo que el plan pide de verdad es UNA LECTURA COHERENTE, no que la columna
 * guarde esas palabras. Así que esto es una capa de traducción: cada objeto
 * sigue guardando lo suyo y todos se leen contra la misma escalera. Si algún
 * día se quiere migrar de verdad, este archivo es justo el mapa que hace
 * falta para hacerlo sin adivinar.
 *
 * LA ESCALERA, Y POR QUÉ TIENE DOS PELDAÑOS MÁS QUE EL PLAN
 *
 * El plan lista siete etapas comerciales y aparte los estados de contrato.
 * Como aquí conviven los cuatro objetos, la escalera llega hasta el final del
 * viaje real: hace falta un peldaño para «firmado pero la comercializadora
 * todavía no lo ha activado» —donde se cae dinero ya vendido— y otro para
 * «activo». Sin ellos, un contrato firmado y uno funcionando serían lo mismo.
 *
 * Y se conserva APARCADO, que el plan no contempla. Cubre permanencia en
 * vigor y «revisar más adelante»: dos situaciones en las que no se puede
 * hacer nada hasta una fecha. Meterlas en «pendiente de decisión» diría que
 * el cliente está decidiendo cuando en realidad está bloqueado por contrato,
 * y eso haría que alguien lo llamara para nada.
 */

export type Etapa =
  | 'detectado'
  | 'factura_solicitada'
  | 'en_analisis'
  | 'propuesta_enviada'
  | 'pendiente_decision'
  | 'pendiente_firma'
  | 'activacion'
  | 'activo'
  | 'aparcado'
  | 'perdido';

export interface DefinicionEtapa {
  id: Etapa;
  titulo: string;
  /** La condición del plan: qué tiene que ser cierto para estar aquí. */
  condicion: string;
  /** Posición en el viaje. Los que no avanzan valen -1. */
  avance: number;
  tono: string;
}

/**
 * Las etapas, en orden. Los textos de `condicion` salen literalmente del plan
 * (sección 11) porque son el contrato con el negocio: si alguien discute en
 * qué etapa está un cliente, se resuelve leyendo esta línea.
 */
export const ETAPAS: DefinicionEtapa[] = [
  { id: 'detectado', titulo: 'Detectado', condicion: 'Aún sin información suficiente', avance: 0,
    tono: 'bg-card/80 text-muted border-border/50' },
  { id: 'factura_solicitada', titulo: 'Factura solicitada', condicion: 'Se espera documentación', avance: 1,
    tono: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  { id: 'en_analisis', titulo: 'En análisis', condicion: 'Factura validada y estudio en curso', avance: 2,
    tono: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  { id: 'propuesta_enviada', titulo: 'Propuesta enviada', condicion: 'Existe PDF vigente y fecha de envío', avance: 3,
    tono: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  { id: 'pendiente_decision', titulo: 'Pendiente de decisión', condicion: 'Siguiente acción y fecha obligatorias', avance: 4,
    tono: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  { id: 'pendiente_firma', titulo: 'Pendiente de firma', condicion: 'Contrato creado y responsable definido', avance: 5,
    tono: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  { id: 'activacion', titulo: 'Esperando activación', condicion: 'Firmado; la comercializadora aún no lo ha activado', avance: 6,
    tono: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  { id: 'activo', titulo: 'Activo', condicion: 'Suministro activado y en servicio', avance: 7,
    tono: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  { id: 'aparcado', titulo: 'Aparcado', condicion: 'Bloqueado por permanencia o pospuesto a una fecha', avance: -1,
    tono: 'bg-card/60 text-muted/80 border-border/40' },
  { id: 'perdido', titulo: 'Perdido', condicion: 'Cerrado sin venta; motivo registrado', avance: -1,
    tono: 'bg-red-500/15 text-red-400 border-red-500/30' },
];

export const ETAPA = Object.fromEntries(ETAPAS.map((e) => [e.id, e])) as Record<Etapa, DefinicionEtapa>;

/** Etapas que siguen en juego: ni ganadas, ni perdidas, ni aparcadas. */
export const ETAPAS_EN_JUEGO: Etapa[] = [
  'detectado', 'factura_solicitada', 'en_analisis', 'propuesta_enviada',
  'pendiente_decision', 'pendiente_firma', 'activacion',
];

// ── Traducción desde cada objeto ────────────────────────────────────────────

/** Oportunidad del pipeline → etapa. */
const DE_PIPELINE: Record<string, Etapa> = {
  prospecto: 'detectado',
  factura_solicitada: 'factura_solicitada',
  // Falta documentación: se sigue esperando papel, no es otra cosa.
  doc_incompleta: 'factura_solicitada',
  factura_recibida: 'en_analisis',
  pendiente_ofertar: 'en_analisis',
  oferta_enviada: 'propuesta_enviada',
  seguimiento: 'pendiente_decision',
  pendiente_firma: 'pendiente_firma',
  pendiente_permanencia: 'aparcado',
  revisar_adelante: 'aparcado',
  ganado: 'activo',
  perdido: 'perdido',
};

/** Suministro → etapa. */
const DE_CUPS: Record<string, Etapa> = {
  sin_factura: 'factura_solicitada',
  datos_incompletos: 'factura_solicitada',
  factura_recibida: 'en_analisis',
  pendiente_ofertar: 'en_analisis',
  oferta_enviada: 'propuesta_enviada',
  pendiente_firma: 'pendiente_firma',
  contrato_firmado: 'activacion',
  pendiente_activacion: 'activacion',
  activado: 'activo',
  pendiente_permanencia: 'aparcado',
  revisar_adelante: 'aparcado',
  perdido: 'perdido',
  no_viable: 'perdido',
};

/** Contrato → etapa. Todo contrato vive ya en la mitad final del viaje. */
const DE_CONTRATO: Record<string, Etapa> = {
  pendiente_preparar: 'pendiente_firma',
  enviado_cliente: 'pendiente_firma',
  pendiente_firma: 'pendiente_firma',
  firmado: 'activacion',
  enviado_comercializadora: 'activacion',
  pendiente_validacion: 'activacion',
  pendiente_activacion: 'activacion',
  activado: 'activo',
  rechazado: 'perdido',
  cancelado: 'perdido',
  // Una incidencia no es un peldaño: es que algo va mal en el que ya tenía.
  // Se deja donde estaba y la incidencia se enseña aparte.
  incidencia: 'activacion',
};

/** Estado comercial del cliente → etapa. */
const DE_CLIENTE: Record<string, Etapa> = {
  detectado: 'detectado',
  contacto_iniciado: 'detectado',
  factura_solicitada: 'factura_solicitada',
  doc_recibida: 'en_analisis',
  en_analisis: 'en_analisis',
  pendiente_decision: 'pendiente_decision',
  contrato_tramite: 'pendiente_firma',
  activo: 'activo',
  revisar_adelante: 'aparcado',
  perdido: 'perdido',
  no_viable: 'perdido',
};

/**
 * Traduce el estado guardado de cualquier objeto a la etapa común.
 *
 * Un estado desconocido devuelve `detectado` y NO revienta: los datos vienen
 * de importaciones y de gente escribiendo, así que aparecerá alguno que nadie
 * previó. Que la pantalla se caiga por eso sería mucho peor que enseñarlo en
 * el primer peldaño.
 */
export function etapaDe(objeto: 'pipeline' | 'cups' | 'contrato' | 'cliente', estado: string | null | undefined): Etapa {
  const tabla = objeto === 'pipeline' ? DE_PIPELINE
    : objeto === 'cups' ? DE_CUPS
    : objeto === 'contrato' ? DE_CONTRATO
    : DE_CLIENTE;
  return tabla[String(estado || '')] || 'detectado';
}

/**
 * La etapa REAL de un cliente, calculada desde sus cosas.
 *
 * El plan lo pide con todas las letras: «el estado del cliente se calcula
 * desde la relación real, no desde una etiqueta comercial arbitraria». Y hay
 * motivo: se comprobó que hay contratos con la fecha de firma puesta que
 * seguían marcados como «pendiente de firma». El campo va por detrás de los
 * hechos, así que mandan los hechos.
 *
 * Manda lo MÁS AVANZADO, no lo más reciente: un cliente con un suministro
 * activo y otro por estudiar es un cliente activo al que además le estamos
 * mirando algo, no un cliente en análisis.
 */
export function etapaDeCliente(e: {
  estadoComercial?: string | null;
  pipeline?: { estado: string }[];
  cups?: { estado_cups: string }[];
  contratos?: { estado_contrato: string; fecha_firma?: string | null; fecha_activacion_real?: string | null }[];
}): Etapa {
  const candidatas: Etapa[] = [];

  for (const o of e.pipeline || []) candidatas.push(etapaDe('pipeline', o.estado));
  for (const c of e.cups || []) candidatas.push(etapaDe('cups', c.estado_cups));
  for (const k of e.contratos || []) {
    // Los hechos por delante de la etiqueta: si hay fecha de activación está
    // activo, y si hay firma sin activación está esperando activación, diga lo
    // que diga el campo de estado.
    if (k.fecha_activacion_real) candidatas.push('activo');
    else if (k.fecha_firma) candidatas.push('activacion');
    else candidatas.push(etapaDe('contrato', k.estado_contrato));
  }

  // Sin nada colgando, lo único que hay es la etiqueta del cliente.
  if (!candidatas.length) return etapaDe('cliente', e.estadoComercial);

  const enJuego = candidatas.filter((x) => ETAPA[x].avance >= 0);
  if (!enJuego.length) {
    // Todo aparcado o perdido: aparcado gana, porque volverá.
    return candidatas.includes('aparcado') ? 'aparcado' : 'perdido';
  }
  return enJuego.reduce((a, b) => (ETAPA[a].avance >= ETAPA[b].avance ? a : b));
}

/**
 * Contradicciones entre objetos, que el plan prohíbe explícitamente
 * («no permitir estados incompatibles entre cliente, oportunidad y
 * suministro»).
 *
 * Devuelve frases para leer, no códigos: quien las ve tiene que poder
 * arreglarlo sin preguntar qué significan. Solo se avisa cuando la etiqueta va
 * POR DETRÁS de los hechos; al revés no, porque hoy los contratos se llevan
 * también en papel y adelantarse es normal.
 */
export function contradicciones(e: {
  nombre?: string;
  estadoComercial?: string | null;
  pipeline?: { estado: string }[];
  cups?: { estado_cups: string }[];
  contratos?: { estado_contrato: string; fecha_firma?: string | null; fecha_activacion_real?: string | null }[];
}): string[] {
  const avisos: string[] = [];

  for (const k of e.contratos || []) {
    if (k.fecha_activacion_real && k.estado_contrato !== 'activado') {
      avisos.push('El contrato tiene fecha de activación real pero no figura como activado.');
    } else if (k.fecha_firma && ['pendiente_preparar', 'enviado_cliente', 'pendiente_firma'].includes(k.estado_contrato)) {
      avisos.push('El contrato tiene fecha de firma pero sigue figurando como pendiente de firmar.');
    }
  }

  // Sin etiqueta no hay contradicción posible: no dice nada con lo que chocar.
  // Compararla contra el valor por defecto avisaría de un desfase inventado.
  const real = etapaDeCliente(e);
  const etiqueta = etapaDe('cliente', e.estadoComercial);
  if (e.estadoComercial && ETAPA[etiqueta].avance >= 0 && ETAPA[real].avance > ETAPA[etiqueta].avance) {
    avisos.push(`El cliente figura como «${ETAPA[etiqueta].titulo}» y sus datos ya están en «${ETAPA[real].titulo}».`);
  }

  return [...new Set(avisos)];
}
