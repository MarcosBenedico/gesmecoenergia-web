/**
 * LA FICHA DE CLIENTE, EN CUATRO PESTAÑAS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * QUÉ PROBLEMA RESUELVE
 *
 * La ficha era una columna larguísima: cabecera, siguiente acción, cuatro
 * indicadores, suministros y, debajo, un plegable con oportunidades, fechas,
 * contratos, comisiones, visitas, seguimiento e historial. Todo cierto y todo
 * en el mismo sitio, así que para cualquier cosa había que recorrerla entera.
 *
 * Cuatro pestañas y cada una contesta UNA pregunta:
 *
 *   · RESUMEN               ¿qué hay que hacer con este cliente ahora?
 *   · CENTROS Y SUMINISTROS ¿qué puntos de consumo tiene y cómo están?
 *   · DOCUMENTOS            ¿qué papeles hay y cuáles están sin revisar?
 *   · HISTORIAL             ¿qué se ha hablado y qué se acordó?
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * «CENTRO» ES UN AGRUPAMIENTO, NO UNA TABLA NUEVA
 *
 * Un cliente con dos granjas quiere ver dos bloques, y eso NO exige inventar
 * una entidad «Centro» con su formulario, su migración y su mantenimiento: el
 * suministro ya lleva su dirección, y agrupar por ella da exactamente el mismo
 * resultado en pantalla sin un dato más que rellenar ni otro sitio donde se
 * pueda quedar desfasado.
 *
 * El día que haga falta de verdad —un centro con datos propios que no son de
 * ningún suministro— ya existe `energia_ubicaciones` para eso. Mientras tanto,
 * pedir que alguien cree el centro ANTES de poder apuntar un CUPS es asegurarse
 * de que el CUPS no se apunte: el que se ve en la puerta de una granja se
 * teclea con tres datos o no se teclea.
 *
 * Se agrupa por CÓDIGO POSTAL + calle normalizada, no por la cadena literal.
 * «Ctra. de Toledo km 12» y «CTRA TOLEDO KM 12, 45520» son el mismo sitio y
 * escritos por dos personas distintas; si cada variante fuera un centro, un
 * cliente con tres naves saldría con siete.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NINGÚN VOCABULARIO NUEVO
 *
 * La situación de un trabajo sale de `etapas.ts` y el bloqueo de
 * `ficha-suministro.ts`. Aquí no se decide qué es urgente ni cómo se llama una
 * fase: se pregunta. Si esta pantalla tuviera criterio propio, diría una cosa
 * y el Pipeline otra del mismo cliente, y no habría forma de saber cuál creer.
 */

import { ETAPA, etapaDe, ETAPAS_EN_JUEGO, type Etapa } from './etapas.ts';
import { estadoDeSuministro, diasHasta, comoSeLee, type EntradaSuministro } from './ficha-suministro.ts';

// ── Las pestañas ────────────────────────────────────────────────────────────

export interface DefPestanaCliente {
  id: string;
  titulo: string;
  /** Qué se viene a mirar aquí. Va en el título del navegador y en ayuda. */
  pregunta: string;
}

/**
 * En orden de cuántas veces se abren, no por afinidad temática. Quien entra a
 * mirar qué hay que hacer no debería tragarse antes la lista de documentos.
 */
export const PESTANAS_CLIENTE: DefPestanaCliente[] = [
  { id: 'resumen', titulo: 'Resumen', pregunta: '¿Qué hay que hacer con este cliente ahora?' },
  { id: 'centros', titulo: 'Centros y suministros', pregunta: '¿Qué puntos de consumo tiene y cómo están?' },
  { id: 'documentos', titulo: 'Documentos', pregunta: '¿Qué papeles hay y cuáles están sin revisar?' },
  { id: 'historial', titulo: 'Historial', pregunta: '¿Qué se ha hablado y qué se acordó?' },
];

/** Nunca deja la ficha en blanco por una pestaña guardada que ya no existe. */
export function pestanaValidaCliente(v: string | null | undefined): string {
  return PESTANAS_CLIENTE.some((p) => p.id === v) ? (v as string) : PESTANAS_CLIENTE[0].id;
}

// ── Centros ─────────────────────────────────────────────────────────────────

export interface CentroDerivado {
  /** Llave estable del agrupamiento. No es un id de base de datos. */
  clave: string;
  /** Cómo se llama en pantalla: el alias más corto o la calle. */
  nombre: string;
  /** La dirección tal y como está escrita en el primer suministro. */
  direccion: string | null;
  /** Municipio y código postal, si se pueden leer. */
  municipio: string | null;
  suministros: EntradaSuministro[];
  /** Cuántos de sus suministros reclaman algo. */
  conAlerta: number;
}

/** Sitio para lo que no tiene dirección. Se dice, no se esconde. */
export const CENTRO_SIN_DIRECCION = 'sin-direccion';

const SIN_ACENTOS = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Reduce una dirección a algo comparable.
 *
 * Quita acentos, puntuación, las abreviaturas de vía (ctra, c/, avda…) y los
 * espacios de más. Lo que queda es «toledo km 12», que es igual escriba quien
 * escriba. NO intenta adivinar nada más: dos naves en la misma carretera con
 * kilómetros distintos siguen siendo dos centros, que es lo correcto.
 */
export function claveDeDireccion(direccion: string | null | undefined): string {
  const bruto = SIN_ACENTOS(String(direccion || '')).toLowerCase();
  if (!bruto.trim()) return CENTRO_SIN_DIRECCION;

  /*
   * EL CÓDIGO POSTAL ES EL ANCLA, Y ADEMÁS ES EL CORTE.
   *
   * En una dirección española lo que va ANTES del CP es la vía y el número, y
   * lo que va detrás es el municipio y la provincia — que sobran para
   * identificar el sitio y encima se escriben de mil maneras: «45520
   * Villaluenga (Toledo)» y «45520 VILLALUENGA» son el mismo pueblo, y
   * compararlos enteros partía en dos el mismo centro.
   *
   * LÍMITE CONOCIDO: si alguien escribe el CP al principio o al final del todo
   * («Villaluenga (Toledo), 45520»), la parte de delante ya no es la vía y esa
   * dirección hará centro aparte. Es un fallo VISIBLE —salen dos bloques con
   * nombres parecidos y se corrige la dirección— y no uno silencioso, que es la
   * diferencia que importa: fundir dos sitios distintos por listeza sí sería
   * silencioso, y eso no puede pasar.
   */
  const cp = bruto.match(/\b(\d{5})\b/)?.[1] || '';
  const antesDelCp = cp ? bruto.slice(0, bruto.indexOf(cp)) : bruto;

  const via = antesDelCp
    .replace(/\b(ctra|carretera|avda|avenida|c\/|calle|cno|camino|pol|poligono|pza|plaza|urb|urbanizacion|s\/n|km)\b/g, ' ')
    // Las partículas se van con lo demás: «Ctra. DE Toledo» y «CTRA TOLEDO»
    // son el mismo sitio, y sin quitarlas salían dos centros del mismo cliente.
    .replace(/\b(de|del|la|el|los|las|y)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const clave = `${cp} ${via}`.trim();
  return clave || CENTRO_SIN_DIRECCION;
}

/** El municipio y el CP legibles, si se pueden sacar de la dirección. */
function municipioDeDireccion(direccion: string | null | undefined): string | null {
  const t = String(direccion || '').trim();
  if (!t) return null;
  // «45520 Villaluenga (Toledo)» y «Villaluenga (Toledo), 45520» valen igual.
  const m = t.match(/\b\d{5}\b[^,\n]*/);
  if (m) return m[0].trim();
  const ultimo = t.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).pop();
  return ultimo && ultimo !== t ? ultimo : null;
}

/**
 * Agrupa los suministros en centros. Con un solo sitio devuelve un centro, no
 * cero: la pantalla es la misma tenga el cliente una nave o cinco.
 *
 * El orden es por número de suministros y luego alfabético, así el sitio
 * principal sale arriba sin que nadie tenga que marcarlo como principal — otro
 * campo que rellenar y otro que se queda mal.
 */
export function agruparEnCentros(
  suministros: EntradaSuministro[],
  hoy: string,
): CentroDerivado[] {
  const mapa = new Map<string, CentroDerivado>();
  for (const s of suministros) {
    const clave = claveDeDireccion(s.direccion);
    let c = mapa.get(clave);
    if (!c) {
      c = {
        clave,
        nombre: '',
        direccion: s.direccion || null,
        municipio: municipioDeDireccion(s.direccion),
        suministros: [],
        conAlerta: 0,
      };
      mapa.set(clave, c);
    }
    c.suministros.push(s);
    if (estadoDeSuministro(s, hoy).alerta) c.conAlerta++;
  }

  for (const c of mapa.values()) {
    /*
     * EL NOMBRE DEL CENTRO SALE DE LOS DATOS, no de un campo nuevo.
     *
     * Con un solo suministro es su alias («Nave principal»). Con varios, el
     * alias no vale —serían tres nombres para un sitio— así que se usa la
     * calle. Y sin dirección se dice que no la hay, en vez de dejarlo en
     * blanco: un centro sin nombre parece un fallo de la pantalla.
     */
    if (c.clave === CENTRO_SIN_DIRECCION) {
      c.nombre = 'Sin dirección';
    } else if (c.suministros.length === 1 && c.suministros[0].alias) {
      c.nombre = c.suministros[0].alias as string;
    } else {
      const calle = String(c.direccion || '').split(/[,\n]/)[0].trim();
      c.nombre = calle || 'Sin dirección';
    }
  }

  return [...mapa.values()].sort((a, b) => {
    // Lo que no tiene dirección va al final: es un hueco que rellenar, no el
    // sitio principal del cliente.
    if (a.clave === CENTRO_SIN_DIRECCION) return 1;
    if (b.clave === CENTRO_SIN_DIRECCION) return -1;
    return b.suministros.length - a.suministros.length || a.nombre.localeCompare(b.nombre);
  });
}

// ── Trabajos abiertos ───────────────────────────────────────────────────────

/** Cuánto reclama este trabajo. Se pinta con color Y con texto. */
export type TonoTrabajo = 'critico' | 'atencion' | 'en_curso' | 'pausado';

export interface TrabajoAbierto {
  id: string;
  /** De dónde sale, para poder abrirlo. */
  origen: 'pipeline' | 'expediente';
  /** Cómo se llama: «Renovación de luz», «Ampliación FV». */
  trabajo: string;
  /** En qué centro pasa, o null si no está atado a ninguno. */
  centro: string | null;
  /** La fase, en las palabras de `etapas.ts`. Nunca una inventada aquí. */
  situacion: string;
  tono: TonoTrabajo;
  /** Qué falta para avanzar, si algo falta. Nunca la palabra «pendiente». */
  bloqueo: string | null;
  /** Quién y cuándo. Null cuando NO hay siguiente acción, que es lo grave. */
  proximoPaso: { responsable: string | null; cuando: string; dias: number | null } | null;
  /** Para ordenar: primero lo que no tiene nadie detrás. */
  orden: number;
}

export const TONO_TRABAJO: Record<TonoTrabajo, { texto: string; punto: string; fila: string }> = {
  critico: { texto: 'Requiere acción ya', punto: 'bg-red-500', fila: 'text-red-300' },
  atencion: { texto: 'Falta algo para avanzar', punto: 'bg-amber-400', fila: 'text-amber-300' },
  en_curso: { texto: 'En marcha', punto: 'bg-sky-400', fila: 'text-sky-300' },
  pausado: { texto: 'Parado a propósito', punto: 'bg-slate-500', fila: 'text-muted' },
};

export interface EntradaTrabajos {
  pipeline: {
    id: string; estado: string; nombre_oportunidad?: string | null;
    tipo_oportunidad?: string | null; cups_id?: string | null;
    responsable?: string | null; fecha_proxima_accion?: string | null;
  }[];
  /** Expedientes energéticos abiertos, si el módulo está en uso. */
  expedientes?: {
    id: string; titulo?: string | null; fase: string; responsable?: string | null;
  }[];
  suministros: EntradaSuministro[];
  centros: CentroDerivado[];
  /** Tareas abiertas del cliente, para saber si hay siguiente acción. */
  tareas: {
    pipeline_id?: string | null; expediente_id?: string | null; cups_id?: string | null;
    descripcion?: string | null; fecha_limite?: string | null;
    responsable?: string | null; estado?: string | null;
  }[];
}

const TAREAS_ABIERTAS = ['pendiente', 'en_curso'];

/** Etapas que ya no se trabajan: no son un «trabajo abierto». */
const CERRADAS: Etapa[] = ['activo', 'perdido'];

/**
 * Los trabajos que hay abiertos con este cliente, cada uno con su siguiente
 * paso. Es la tabla de la pestaña Resumen.
 *
 * LO QUE NO TIENE SIGUIENTE ACCIÓN VA PRIMERO, siempre, aunque su fase parezca
 * tranquila. Es la regla madre de todo el control de cartera: un expediente
 * abierto sin nadie detrás es exactamente por donde se cae un cliente, y si se
 * ordenara por fase se quedaría enterrado bajo los que sí tienen a alguien
 * trabajándolos.
 */
export function trabajosAbiertos(e: EntradaTrabajos, hoy: string): TrabajoAbierto[] {
  const centroDe = (cupsId: string | null | undefined): string | null => {
    if (!cupsId) return null;
    return e.centros.find((c) => c.suministros.some((s) => s.id === cupsId))?.nombre || null;
  };

  const abiertas = e.tareas.filter((t) => !t.estado || TAREAS_ABIERTAS.includes(t.estado));

  const pasoDe = (campo: 'pipeline_id' | 'expediente_id', id: string, cupsId?: string | null) => {
    const suyas = abiertas
      .filter((t) => t[campo] === id || (cupsId && t.cups_id === cupsId))
      .sort((a, b) => (a.fecha_limite || '9999').localeCompare(b.fecha_limite || '9999'));
    const t = suyas[0];
    if (!t) return null;
    return {
      responsable: t.responsable || null,
      cuando: comoSeLee(t.fecha_limite, hoy),
      dias: diasHasta(t.fecha_limite, hoy),
    };
  };

  const salida: TrabajoAbierto[] = [];

  for (const o of e.pipeline) {
    const etapa = etapaDe('pipeline', o.estado);
    if (CERRADAS.includes(etapa)) continue;

    const sum = e.suministros.find((s) => s.id === o.cups_id);
    const est = sum ? estadoDeSuministro(sum, hoy) : null;
    const paso = pasoDe('pipeline_id', o.id, o.cups_id);

    // El tono NO se decide aquí de cero: sale de si hay bloqueo, de si la
    // acción está vencida y de si la etapa es de las que no avanzan.
    const vencida = paso?.dias != null && paso.dias < 0;
    const tono: TonoTrabajo =
      etapa === 'aparcado' ? 'pausado'
      : !paso || vencida ? 'critico'
      : est?.bloqueo ? 'atencion'
      : 'en_curso';

    salida.push({
      id: o.id,
      origen: 'pipeline',
      trabajo: o.nombre_oportunidad?.trim() || 'Oportunidad',
      centro: centroDe(o.cups_id),
      situacion: ETAPA[etapa].titulo,
      tono,
      bloqueo: est?.bloqueo || null,
      proximoPaso: paso,
      /*
       * Sin siguiente acción, lo primero de todo. Luego lo vencido, y dentro
       * de eso lo que lleva más retraso.
       *
       * LO APARCADO VA AL FINAL AUNQUE NO TENGA TAREA, y esto se vio mirando
       * la pantalla: una «Revisión eléctrica» aparcada a noviembre salía la
       * segunda de la lista y en rojo, por encima de trabajos vivos. Aparcar es
       * una decisión que alguien tomó; tratarla como un descolgado la
       * convierte en ruido y de paso desmiente el propio texto de la fila,
       * que dice «parado a propósito».
       */
      orden: tono === 'pausado' ? 9000
        : !paso ? 0
        : vencida ? 1000 + (paso.dias ?? 0)
        : 3000 + (paso.dias ?? 0),
    });
  }

  for (const x of e.expedientes || []) {
    const paso = pasoDe('expediente_id', x.id);
    const vencida = paso?.dias != null && paso.dias < 0;
    const parado = x.fase === 'cerrado' || x.fase === 'aparcado';
    if (x.fase === 'cerrado') continue;
    salida.push({
      id: x.id,
      origen: 'expediente',
      trabajo: x.titulo?.trim() || 'Expediente energético',
      centro: null,
      // La fase energética tiene su propio vocabulario y NO se traduce al
      // comercial: un expediente en estudio no es una «propuesta enviada».
      situacion: x.fase.replace(/_/g, ' '),
      tono: parado ? 'pausado' : !paso || vencida ? 'critico' : 'en_curso',
      bloqueo: null,
      proximoPaso: paso,
      orden: parado ? 9000 : !paso ? 0 : vencida ? 1000 + (paso.dias ?? 0) : 3000 + (paso.dias ?? 0),
    });
  }

  return salida.sort((a, b) => a.orden - b.orden || a.trabajo.localeCompare(b.trabajo));
}

/** Cuántos trabajos abiertos se han quedado sin nadie detrás. */
export const trabajosSinAccion = (ts: TrabajoAbierto[]): number =>
  ts.filter((t) => !t.proximoPaso && t.tono !== 'pausado').length;

// ── Historial ───────────────────────────────────────────────────────────────

export type TipoApunte = 'visita' | 'llamada' | 'documento' | 'propuesta' | 'contrato' | 'tarea' | 'cambio';

export interface ApunteHistorial {
  id: string;
  tipo: TipoApunte;
  /** Fecha y hora ISO. Se agrupa por día. */
  cuando: string;
  hora: string;
  autor: string | null;
  titulo: string;
  /** Dónde pasó: centro · trabajo. Vacío si no consta. */
  contexto: string;
  detalle: string | null;
  /** Lo que quedó acordado, si se apuntó. */
  siguientePaso: string | null;
  /** Documento adjunto, si lo hay. */
  adjunto: { nombre: string; id: string } | null;
  /** Lo generó la base de datos, no una persona. Se puede ocultar. */
  delSistema: boolean;
}

export interface EntradaHistorial {
  visitas?: {
    id: string; fecha?: string | null; creado_en?: string | null; resultado?: string | null;
    notas?: string | null; responsable?: string | null; proxima_visita?: string | null;
  }[];
  tareas?: {
    id: string; descripcion?: string | null; estado?: string | null; tipo_tarea?: string | null;
    actualizado_en?: string | null; fecha_limite?: string | null; responsable?: string | null;
  }[];
  contratos?: {
    id: string; comercializadora_final?: string | null; fecha_firma?: string | null;
    fecha_activacion_real?: string | null; responsable?: string | null;
  }[];
  estudios?: {
    id: string; titulo?: string | null; version?: number | null; estado?: string | null;
    creado_en?: string | null; responsable?: string | null;
  }[];
  documentos?: {
    id: string; titulo?: string | null; tipo?: string | null; creado_en?: string | null;
    subido_por?: string | null; estado?: string | null;
    /** Centro · suministro al que pertenece, ya resuelto por la pantalla. */
    contexto?: string | null;
  }[];
  /** Cambios de la auditoría. Vienen apagados: son ruido salvo que se busquen. */
  cambios?: {
    id: string; creado_en: string; usuario?: string | null; accion: string; resumen?: string | null;
  }[];
}

const soloFecha = (v: string | null | undefined): string =>
  String(v || '').slice(0, 10);

/**
 * Una fecha para LEER, no para una base de datos.
 *
 * Salía «Volver a pasar el 2026-09-11» dentro de una frase en castellano. Se
 * entiende, pero delata que eso lo escribió una máquina y a partir de ahí el
 * resto del apunte se lee con menos confianza.
 */
const fechaLegible = (v: string | null | undefined): string => {
  const t = String(v || '').slice(0, 10);
  const d = new Date(`${t}T00:00:00`);
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
};

const soloHora = (v: string | null | undefined): string => {
  const t = String(v || '');
  // Una fecha sin hora («2026-09-09») no tiene hora que enseñar, y poner
  // «00:00» haría parecer que se trabajó de madrugada.
  if (!t.includes('T')) return '';
  return new Date(t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};

/**
 * El historial del cliente: gestiones, documentos y acuerdos, en una sola
 * línea de tiempo.
 *
 * LOS CAMBIOS DEL SISTEMA VIENEN MARCADOS Y SE PUEDEN APAGAR. Un «se modificó
 * el campo observaciones» junto a «el cliente dijo que se lo piensa» hace que
 * el segundo no se lea: son la misma tipografía y solo uno importa. Pero
 * tampoco se borran, porque el día que hay que reconstruir qué pasó son lo
 * único que queda.
 */
export function historialDeCliente(e: EntradaHistorial): ApunteHistorial[] {
  const out: ApunteHistorial[] = [];

  for (const v of e.visitas || []) {
    const cuando = v.creado_en || v.fecha || '';
    if (!cuando) continue;
    out.push({
      id: `visita-${v.id}`, tipo: 'visita', cuando: soloFecha(cuando), hora: soloHora(cuando),
      autor: v.responsable || null,
      titulo: v.resultado ? `Visita · ${String(v.resultado).replace(/_/g, ' ')}` : 'Visita',
      contexto: '', detalle: v.notas || null,
      siguientePaso: v.proxima_visita ? `Volver a pasar el ${fechaLegible(v.proxima_visita)}` : null,
      adjunto: null, delSistema: false,
    });
  }

  for (const t of e.tareas || []) {
    if (t.estado !== 'completada') continue;
    const cuando = t.actualizado_en || t.fecha_limite || '';
    if (!cuando) continue;
    out.push({
      id: `tarea-${t.id}`, tipo: 'tarea', cuando: soloFecha(cuando), hora: soloHora(cuando),
      autor: t.responsable || null,
      titulo: t.descripcion || 'Tarea completada',
      contexto: '', detalle: null, siguientePaso: null, adjunto: null, delSistema: false,
    });
  }

  for (const k of e.contratos || []) {
    if (k.fecha_firma) {
      out.push({
        id: `firma-${k.id}`, tipo: 'contrato', cuando: soloFecha(k.fecha_firma), hora: soloHora(k.fecha_firma),
        autor: k.responsable || null,
        titulo: 'Contrato firmado',
        contexto: k.comercializadora_final || '', detalle: null, siguientePaso: null,
        adjunto: null, delSistema: false,
      });
    }
    if (k.fecha_activacion_real) {
      out.push({
        id: `alta-${k.id}`, tipo: 'contrato', cuando: soloFecha(k.fecha_activacion_real),
        hora: soloHora(k.fecha_activacion_real), autor: k.responsable || null,
        titulo: 'Suministro activado',
        contexto: k.comercializadora_final || '', detalle: null, siguientePaso: null,
        adjunto: null, delSistema: false,
      });
    }
  }

  for (const s of e.estudios || []) {
    if (!s.creado_en) continue;
    out.push({
      id: `estudio-${s.id}`, tipo: 'propuesta', cuando: soloFecha(s.creado_en), hora: soloHora(s.creado_en),
      autor: s.responsable || null,
      titulo: s.estado === 'bloqueado' ? 'Propuesta enviada' : 'Estudio preparado',
      contexto: s.titulo || '',
      detalle: s.version && s.version > 1 ? `Versión ${s.version}` : null,
      siguientePaso: null, adjunto: null, delSistema: false,
    });
  }

  for (const d of e.documentos || []) {
    if (!d.creado_en) continue;
    out.push({
      id: `doc-${d.id}`, tipo: 'documento', cuando: soloFecha(d.creado_en), hora: soloHora(d.creado_en),
      autor: d.subido_por || null,
      titulo: d.titulo || 'Documento',
      contexto: d.contexto || (d.tipo ? String(d.tipo).replace(/_/g, ' ') : ''),
      detalle: d.estado === 'por_revisar' ? 'Pendiente de revisión.' : null,
      siguientePaso: null,
      adjunto: { nombre: d.titulo || 'Documento', id: d.id },
      delSistema: false,
    });
  }

  for (const c of e.cambios || []) {
    out.push({
      id: `aud-${c.id}`, tipo: 'cambio', cuando: soloFecha(c.creado_en), hora: soloHora(c.creado_en),
      autor: c.usuario || null,
      titulo: c.accion === 'INSERT' ? 'Alta en el sistema' : 'Cambio guardado',
      contexto: '', detalle: c.resumen || null, siguientePaso: null, adjunto: null,
      delSistema: true,
    });
  }

  return out.sort((a, b) =>
    b.cuando.localeCompare(a.cuando) || (b.hora || '').localeCompare(a.hora || ''));
}

export interface DiaHistorial {
  fecha: string;
  /** «Hoy», «Ayer» o la fecha larga. */
  etiqueta: string;
  apuntes: ApunteHistorial[];
}

/** Agrupa por día, con «Hoy» y «Ayer» escritos como los diría una persona. */
export function agruparHistorialPorDia(apuntes: ApunteHistorial[], hoy: string): DiaHistorial[] {
  const mapa = new Map<string, ApunteHistorial[]>();
  for (const a of apuntes) {
    const v = mapa.get(a.cuando) || [];
    v.push(a);
    mapa.set(a.cuando, v);
  }
  return [...mapa.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([fecha, lista]) => {
      const d = diasHasta(fecha, hoy);
      const etiqueta =
        d === 0 ? 'Hoy'
        : d === -1 ? 'Ayer'
        : new Date(`${fecha}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
      return { fecha, etiqueta, apuntes: lista };
    });
}

// ── Cabecera ────────────────────────────────────────────────────────────────

export interface CabeceraFicha {
  /** Quién lleva a este cliente. */
  responsable: string | null;
  /** A quién se llama: nombre y cargo si constan. */
  contacto: string | null;
  /** Cuántos trabajos abiertos y cuántos sin nadie detrás. */
  trabajos: number;
  sinAccion: number;
  centros: number;
  suministros: number;
}

/**
 * Las cuatro cifras de la cabecera. Ninguna decorativa: cada una es algo que
 * se mira para decidir si esta ficha necesita atención antes de abrirla entera.
 */
export function cabeceraDeFicha(
  cliente: { responsable?: string | null; persona_contacto?: string | null; telefono?: string | null },
  centros: CentroDerivado[],
  trabajos: TrabajoAbierto[],
): CabeceraFicha {
  return {
    responsable: cliente.responsable?.trim() || null,
    contacto: cliente.persona_contacto?.trim() || null,
    trabajos: trabajos.length,
    sinAccion: trabajosSinAccion(trabajos),
    centros: centros.length,
    suministros: centros.reduce((s, c) => s + c.suministros.length, 0),
  };
}

/** Etapas en juego, reexportado para que la pantalla no importe de dos sitios. */
export { ETAPAS_EN_JUEGO };
