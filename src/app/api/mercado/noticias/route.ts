import { NextResponse } from 'next/server';

/**
 * NOTICIAS QUE MUEVEN EL PRECIO DE LA LUZ.
 *
 * Lee los RSS públicos de medios especializados (sin clave ni suscripción) y
 * destaca lo que suele mover el mercado: gas y petróleo, geopolítica, decisiones
 * regulatorias, nuclear, interconexiones y meteorología extrema.
 *
 * No predice nada ni interpreta: solo ordena y marca qué titulares tienen pinta
 * de afectar al precio, para leer cinco en vez de cincuenta. La lectura la pone
 * quien decide.
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

export interface Noticia {
  titulo: string;
  enlace: string;
  fuente: string;
  fecha: string | null;
  temas: string[];
  iconos: string[];
  relevancia: number;
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

  // Primero lo que más suele mover el precio; a igual relevancia, lo más reciente
  unicas.sort((a, b) =>
    b.relevancia - a.relevancia || (b.fecha || '').localeCompare(a.fecha || '')
  );

  return NextResponse.json({
    ok: true,
    noticias: unicas.slice(0, 30),
    fallos,
    actualizado: new Date().toISOString(),
  });
}
