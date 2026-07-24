import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

/**
 * NOTICIAS QUE MUEVEN EL PRECIO DE LA LUZ.
 *
 * Dos pasos:
 *  1. Lee los RSS públicos de medios especializados (sin clave ni suscripción)
 *     y preselecciona por temas que históricamente mueven el mercado.
 *  2. Pide a Claude que valore CADA titular: qué probabilidad tiene de afectar
 *     al precio, si empuja al alza o a la baja, en qué plazo y por qué.
 *
 * El paso 2 es opcional: si falta la clave o la llamada falla, se sirve igual
 * la lista con la clasificación por temas. Mejor una lista sin análisis que una
 * pantalla en blanco.
 */

export const revalidate = 1800; // media hora

const FUENTES = [
  { nombre: 'El Periódico de la Energía', url: 'https://elperiodicodelaenergia.com/feed/' },
  { nombre: 'Energías Renovables', url: 'https://www.energias-renovables.com/rss' },
];

/**
 * Temas que históricamente mueven el precio mayorista. El peso ordena: una
 * noticia de gas o de geopolítica pesa más que una de autoconsumo doméstico.
 */
const TEMAS: { etiqueta: string; peso: number; icono: string; claves: string[] }[] = [
  { etiqueta: 'Geopolítica', peso: 5, icono: '🌍', claves: ['trump', 'rusia', 'ucrania', 'china', 'opep', 'arancel', 'sancion', 'sanción', 'oriente medio', 'irán', 'iran', 'argelia', 'venezuela', 'guerra'] },
  { etiqueta: 'Gas y petróleo', peso: 5, icono: '🛢️', claves: ['gas natural', 'ttf', 'gnl', 'petróleo', 'petroleo', 'brent', 'barril', 'gasoducto', 'mibgas'] },
  { etiqueta: 'Regulación', peso: 4, icono: '⚖️', claves: ['cnmc', 'gobierno', 'ministerio', 'real decreto', 'bruselas', 'comisión europea', 'comision europea', 'impuesto', 'iva', 'peaje', 'cargo', 'subasta', 'reforma'] },
  { etiqueta: 'Nuclear', peso: 4, icono: '☢️', claves: ['nuclear', 'almaraz', 'ascó', 'asco', 'cofrentes', 'vandellós', 'vandellos', 'trillo'] },
  { etiqueta: 'Mercado', peso: 3, icono: '📈', claves: ['omie', 'omip', 'pool', 'mercado mayorista', 'precio de la luz', 'pvpc', 'futuros', 'megavatio'] },
  { etiqueta: 'Renovables', peso: 2, icono: '☀️', claves: ['eólica', 'eolica', 'fotovoltaica', 'solar', 'hidráulica', 'hidraulica', 'renovable', 'vertido', 'curtailment'] },
  { etiqueta: 'Meteorología', peso: 2, icono: '🌡️', claves: ['ola de calor', 'ola de frío', 'ola de frio', 'borrasca', 'sequía', 'sequia', 'temporal', 'anticiclón', 'anticiclon'] },
];

export type DireccionPrecio = 'sube' | 'baja' | 'neutro';
export type PlazoImpacto = 'inmediato' | 'corto' | 'medio' | 'largo';

export interface Noticia {
  titulo: string;
  enlace: string;
  fuente: string;
  fecha: string | null;
  temas: string[];
  iconos: string[];
  relevancia: number;
  /** Valoración de Claude (ausente si no se pudo analizar). */
  probabilidad?: number;          // 0-100: qué opciones hay de que mueva el precio
  direccion?: DireccionPrecio;    // hacia dónde lo empuja
  plazo?: PlazoImpacto;           // cuándo se notaría
  motivo?: string;                // por qué, en una frase
}

/** Esquema del análisis. Sin restricciones numéricas: no las admite, se validan aquí. */
const SCHEMA_ANALISIS = {
  type: 'object',
  properties: {
    analisis: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          indice: { type: 'integer' },
          probabilidad: { type: 'integer' },
          direccion: { type: 'string', enum: ['sube', 'baja', 'neutro'] },
          plazo: { type: 'string', enum: ['inmediato', 'corto', 'medio', 'largo'] },
          motivo: { type: 'string' },
        },
        required: ['indice', 'probabilidad', 'direccion', 'plazo', 'motivo'],
        additionalProperties: false,
      },
    },
  },
  required: ['analisis'],
  additionalProperties: false,
};

const SISTEMA_ANALISIS =
  'Eres analista del mercado eléctrico español (OMIE, mercado diario). Valoras titulares de prensa '
  + 'energética por su efecto sobre el PRECIO MAYORISTA DE LA LUZ EN ESPAÑA, no por su importancia periodística.\n\n'
  + 'Para cada titular das:\n'
  + '· probabilidad (0-100): qué opciones reales hay de que ESE hecho mueva el precio en España. '
  + 'Sé exigente: un titular corporativo o de una tecnología concreta rara vez pasa de 25. '
  + 'Reserva más de 70 para lo que afecta al mix, al gas, a la demanda o a la regulación de forma directa.\n'
  + '· direccion: "sube" si empuja el precio al alza, "baja" si a la baja, "neutro" si no está claro '
  + 'o el efecto se compensa. Recuerda que en España el gas suele marcar el precio marginal, y que '
  + 'más renovable disponible o más nuclear tiende a bajarlo.\n'
  + '· plazo: inmediato (días), corto (semanas), medio (meses), largo (años).\n'
  + '· motivo: UNA frase corta y concreta en español explicando el mecanismo por el que afecta al precio. '
  + 'Nada de generalidades: di la cadena causal. Si no afecta, dilo claramente.\n\n'
  + 'No inventes datos que no estén en el titular. Si un titular es ambiguo, baja la probabilidad '
  + 'y ponlo neutro en vez de suponer.';

/**
 * Valora los titulares con Claude. Devuelve las noticias enriquecidas, o las
 * mismas de entrada si no se pudo analizar (sin clave, error de red, rechazo).
 */
async function analizarNoticias(noticias: Noticia[]): Promise<{ noticias: Noticia[]; analizado: boolean }> {
  if (!process.env.ANTHROPIC_API_KEY || noticias.length === 0) {
    return { noticias, analizado: false };
  }

  try {
    const cliente = new Anthropic();
    const lista = noticias.map((n, i) => `${i}. ${n.titulo}${n.fuente ? ` [${n.fuente}]` : ''}`).join('\n');

    const respuesta = await cliente.messages.create({
      model: 'claude-opus-4-8',
      // Holgado a propósito: el razonamiento cuenta contra este límite, y quedarse
      // corto trunca el JSON a media frase y tira todo el análisis por la borda.
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: SCHEMA_ANALISIS },
      },
      system: SISTEMA_ANALISIS,
      messages: [{
        role: 'user',
        content: `Valora estos ${noticias.length} titulares de hoy. Devuelve una entrada por cada uno, `
          + `usando "indice" para identificarlos:\n\n${lista}`,
      }],
    });

    // Rechazo o respuesta truncada: sin análisis, pero las noticias siguen sirviéndose
    if (respuesta.stop_reason === 'refusal' || respuesta.stop_reason === 'max_tokens') {
      return { noticias, analizado: false };
    }

    const texto = respuesta.content.find((b) => b.type === 'text');
    if (!texto || texto.type !== 'text') return { noticias, analizado: false };

    const { analisis } = JSON.parse(texto.text) as {
      analisis: { indice: number; probabilidad: number; direccion: DireccionPrecio; plazo: PlazoImpacto; motivo: string }[];
    };

    const porIndice = new Map(analisis.map((a) => [a.indice, a]));
    const enriquecidas = noticias.map((n, i) => {
      const a = porIndice.get(i);
      if (!a) return n;
      return {
        ...n,
        // El esquema no puede acotar el rango: se acota aquí
        probabilidad: Math.max(0, Math.min(100, Math.round(a.probabilidad))),
        direccion: a.direccion,
        plazo: a.plazo,
        motivo: a.motivo,
      };
    });
    return { noticias: enriquecidas, analizado: true };
  } catch {
    // Cualquier fallo del análisis degrada a la lista sin valorar, nunca rompe la pantalla
    return { noticias, analizado: false };
  }
}

/** Extrae el contenido de una etiqueta, tolerando CDATA y atributos. */
function etiqueta(xml: string, nombre: string): string | null {
  const m = xml.match(new RegExp(`<${nombre}[^>]*>([\\s\\S]*?)</${nombre}>`, 'i'));
  if (!m) return null;
  return m[1].replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '').trim() || null;
}

const limpiar = (s: string) =>
  s.replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#8217;|&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#8220;|&#8221;/g, '"').replace(/&hellip;/g, '…')
    .replace(/\s+/g, ' ').trim();

/** Sin acentos y en minúsculas, para que "eólica" case con "eolica". */
const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function clasificar(titulo: string): { temas: string[]; iconos: string[]; relevancia: number } {
  const t = normalizar(titulo);
  const temas: string[] = [];
  const iconos: string[] = [];
  let relevancia = 0;
  for (const tema of TEMAS) {
    if (tema.claves.some((c) => t.includes(normalizar(c)))) {
      temas.push(tema.etiqueta);
      iconos.push(tema.icono);
      relevancia += tema.peso;
    }
  }
  return { temas, iconos, relevancia };
}

async function leerFuente(f: { nombre: string; url: string }): Promise<Noticia[]> {
  const res = await fetch(f.url, {
    headers: { 'User-Agent': 'GesmecoEnergia/1.0 (panel interno)' },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`${f.nombre} respondió ${res.status}`);
  const xml = await res.text();

  const items = xml.split(/<item[\s>]/i).slice(1, 41);
  const out: Noticia[] = [];
  for (const bruto of items) {
    const titulo = limpiar(etiqueta(bruto, 'title') || '');
    const enlace = (etiqueta(bruto, 'link') || '').trim();
    if (!titulo || !enlace) continue;
    const fechaTxt = etiqueta(bruto, 'pubDate');
    const fecha = fechaTxt ? new Date(fechaTxt) : null;
    out.push({
      titulo,
      enlace,
      fuente: f.nombre,
      fecha: fecha && !Number.isNaN(fecha.getTime()) ? fecha.toISOString() : null,
      ...clasificar(titulo),
    });
  }
  return out;
}

export async function GET() {
  const resultados = await Promise.allSettled(FUENTES.map(leerFuente));
  const noticias = resultados.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  const fallos = FUENTES.filter((_, i) => resultados[i].status === 'rejected').map((f) => f.nombre);

  // Sin duplicados entre medios (a veces replican el mismo titular)
  const vistos = new Set<string>();
  const unicas = noticias.filter((n) => {
    const clave = normalizar(n.titulo).slice(0, 70);
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });

  // Preselección por temas antes de gastar análisis: lo más prometedor primero
  unicas.sort((a, b) =>
    b.relevancia - a.relevancia || (b.fecha || '').localeCompare(a.fecha || '')
  );

  const { noticias: valoradas, analizado } = await analizarNoticias(unicas.slice(0, 25));

  // Con análisis manda la probabilidad real de mover el precio; sin él, los temas
  const ordenadas = analizado
    ? [...valoradas].sort((a, b) =>
        (b.probabilidad ?? 0) - (a.probabilidad ?? 0) || (b.fecha || '').localeCompare(a.fecha || ''))
    : valoradas;

  return NextResponse.json({
    ok: true,
    noticias: ordenadas,
    analizado,
    fallos,
    actualizado: new Date().toISOString(),
  });
}
