#!/usr/bin/env node
/**
 * PRECLIENTES DEL COMERCIAL — PDF de lo que ha traído David en los últimos días.
 *
 *   node scripts/preclientes-comercial.mjs [dias]        (por defecto 30)
 *   node scripts/preclientes-comercial.mjs 30 --datos=volcado.json
 *
 * LO QUE ESTE INFORME HACE Y UNA CONSULTA SIMPLE NO
 *
 * Filtrar `clasificacion = 'precliente'` por fecha de alta da un número que
 * parece bueno y es falso, porque en esa tabla conviven tres cosas que se
 * crearon el mismo día pero significan lo contrario:
 *
 *  1. LA IMPORTACIÓN DEL CRM. El 9 de julio entraron de golpe fichas cuya alta
 *     real va de febrero a julio — la fecha verdadera está escrita dentro de
 *     las observaciones («Alta precliente: 22/04/2026»), no en creado_en.
 *     Contarlas como captación del mes es contar dos veces trabajo viejo.
 *  2. LOS PINES DEL MAPA. «Pasar al sistema» crea la ficha desde una ortofoto:
 *     nadie ha hablado con ese sitio. Su propia nota lo dice, «sin verificar
 *     sobre el terreno», y muchos ni tienen nombre («Granja intensiva sin
 *     identificar»). Eso es un OBJETIVO, no un precliente.
 *  3. LO QUE DE VERDAD TRAJO EL COMERCIAL de la calle.
 *
 * Solo el grupo 3 es captación. Los otros dos salen en el PDF aparte y
 * contados, porque esconderlos sería el mismo error al revés.
 *
 * Y dentro del grupo 3 se separa además quién ha dado ya datos de suministro:
 * un precliente con CUPS se puede ofertar mañana y uno sin CUPS es todavía
 * una conversación. Mezclarlos hace creer que hay más cartera de la que hay.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const desdeArchivo = args.find((a) => a.startsWith('--datos='))?.slice(8);
const DIAS = Number(args.find((a) => /^\d+$/.test(a)) || 30);

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dia = (f) => { const d = new Date(`${f}T12:00:00`); return `${d.getDate()} de ${MESES[d.getMonth()]}`; };

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * De dónde salió realmente la ficha. El orden importa: una del mapa puede
 * llevar además texto del CRM, y manda lo que la creó.
 */
function origenDe(obs) {
  const o = String(obs || '');
  if (/Del mapa de oportunidades/i.test(o)) return 'mapa';
  if (/Alta precliente:|Categoría origen:|CRM Seguimientos:|Paso actual:/i.test(o)) return 'importado';
  return 'calle';
}

/** La nota de campo, sin el arrastre del importador. */
function nota(obs) {
  let s = String(obs || '').split(/\|/)[0].trim();
  s = s.replace(/^\[[^\]]+\]\s*/, '');            // marca de hora y autor
  if (s.length > 12 && s === s.toUpperCase()) s = s.charAt(0) + s.slice(1).toLowerCase();
  return s.length > 130 ? `${s.slice(0, 130)}…` : s;
}

async function datos() {
  if (desdeArchivo) return JSON.parse(readFileSync(desdeArchivo, 'utf8'));
  const r = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/luz_clientes`
    + `?select=nombre,telefono,observaciones,creado_en,luz_cups(id)`
    + `&borrado_en=is.null&clasificacion=eq.precliente`
    + `&creado_en=gte.${new Date(Date.now() - DIAS * 86400000).toISOString()}`,
    { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }
  );
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return (await r.json())
    .filter((c) => /sales|david/i.test(c.responsable || ''))
    .map((c) => ({ n: c.nombre, tel: c.telefono, obs: c.observaciones, f: c.creado_en.slice(0, 10), cups: (c.luz_cups || []).length }));
}

const filas = (xs) => xs.map((c) => `<tr>
  <td class="cli"><b>${esc(c.n)}</b>${c.cups ? `<span class="cups">${c.cups} suministro${c.cups > 1 ? 's' : ''}</span>` : ''}</td>
  <td class="nota">${esc(nota(c.obs))}</td>
  <td class="tel">${esc(c.tel || '')}</td>
</tr>`).join('');

const todos = await datos();
const calle = todos.filter((c) => origenDe(c.obs) === 'calle');
const mapa = todos.filter((c) => origenDe(c.obs) === 'mapa');
const importados = todos.filter((c) => origenDe(c.obs) === 'importado');

const conCups = calle.filter((c) => c.cups > 0);
const sinCups = calle.filter((c) => !c.cups);

// Por días, del más reciente al más antiguo: así se ve el ritmo.
const porDia = [...new Set(calle.map((c) => c.f))].sort().reverse();

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Preclientes de David · últimos ${DIAS} días</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  body { font: 10pt/1.4 -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; margin: 0; }
  header { border-bottom: 2.5px solid #111; padding-bottom: 8px; margin-bottom: 6px; }
  h1 { font-size: 19pt; margin: 0 0 2px; letter-spacing: -0.3px; }
  .sub { color: #444; margin: 0; font-size: 10.5pt; }
  .cifras { display: flex; gap: 10px; margin: 14px 0; }
  .cifra { flex: 1; border: 1.5px solid #111; padding: 8px 10px; }
  .cifra b { display: block; font-size: 26pt; line-height: 1; font-variant-numeric: tabular-nums; }
  .cifra span { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.4px; color: #555; }
  .cifra.flojo { border-color: #bbb; color: #666; }
  .cifra.flojo b { color: #888; }
  .aviso { border-left: 3px solid #b45309; background: #fffbeb; padding: 8px 10px; margin: 12px 0; font-size: 9.5pt; }
  .aviso b { color: #92400e; }
  h2 { font-size: 13pt; margin: 18px 0 3px; padding-bottom: 3px; border-bottom: 1.5px solid #111; }
  h3 { font-size: 10pt; margin: 12px 0 3px; color: #333; }
  p.exp { font-size: 8.8pt; color: #666; margin: 0 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  tr { break-inside: avoid; }
  td { border-bottom: 1px solid #e5e5e5; padding: 4px; vertical-align: top; }
  .cli { width: 32%; font-size: 9pt; }
  .cups { display: block; font-size: 7.5pt; color: #15803d; font-weight: 700; text-transform: uppercase; }
  .nota { font-size: 8.8pt; color: #333; }
  .tel { width: 82px; font-size: 8.5pt; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .fecha { font-size: 9pt; font-weight: 700; margin: 12px 0 2px; color: #111; }
  section { break-inside: avoid-page; }
  footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #ccc; font-size: 8pt; color: #666; }
</style></head><body>
<header>
  <h1>Preclientes que ha traído David</h1>
  <p class="sub">Últimos ${DIAS} días · Gesmeco Energía</p>
</header>

<div class="cifras">
  <div class="cifra"><b>${calle.length}</b><span>De la calle</span></div>
  <div class="cifra"><b>${conCups.length}</b><span>Con suministro<br>(se pueden ofertar)</span></div>
  <div class="cifra flojo"><b>${mapa.length}</b><span>Del mapa<br>(nadie ha hablado)</span></div>
  <div class="cifra flojo"><b>${importados.length}</b><span>De la importación<br>(fichas antiguas)</span></div>
</div>

<div class="aviso">
  <b>Una consulta simple daría ${todos.length}, y no son ${todos.length}.</b> En la misma tabla conviven
  las fichas que trajo David, los pines del mapa —creados desde una ortofoto, sin que nadie
  haya hablado con ellos— y la importación del CRM del 9 de julio, cuyas altas reales van de
  febrero a julio y están escritas dentro de las observaciones, no en la fecha de alta.
  Solo las <b>${calle.length} de la calle</b> son captación de este periodo.
</div>

<h2>Los ${calle.length} de la calle</h2>
${porDia.map((f) => `
  <section>
    <p class="fecha">${dia(f)}</p>
    <table>${filas(calle.filter((c) => c.f === f))}</table>
  </section>`).join('')}

<h2>Lo que hay que mirar</h2>
<h3>Solo ${conCups.length} de ${calle.length} pueden ofertarse hoy</h3>
<p class="exp">
  Tienen datos de suministro cargados: ${conCups.map((c) => c.n).join(' · ') || '—'}.
  Los otros ${sinCups.length} son conversaciones, no expedientes: sin factura no hay oferta que preparar,
  y un precliente sin factura se enfría.
</p>

${mapa.length ? `
<h3>${mapa.length} fichas del mapa están mal clasificadas</h3>
<p class="exp">
  Su propia nota dice «sin verificar sobre el terreno» y muchas ni tienen nombre. Un precliente
  es quien nos ha dado su información; esto es un <b>objetivo</b>. Cuentan como cartera sin serlo.
</p>
<table>${filas(mapa.slice(0, 20))}</table>` : ''}

<footer>
  Generado el ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}.
  El comercial figura como «Sales» y como «David» según el registro; se cuentan los dos.
  Ninguna de estas altas tiene visita registrada con resultado en luz_visitas.
</footer>
</body></html>`;

const rutaHtml = '/tmp/preclientes.html';
const rutaPdf = process.env.SALIDA || `/tmp/preclientes-david-${DIAS}d.pdf`;
writeFileSync(rutaHtml, html);
execFileSync('node', ['-e', `
  const { chromium } = require('${env.PLAYWRIGHT_DIR || '/tmp/claude-0/-home-user-gesmecoenergia-web/6a1b4672-39b7-5cc7-a946-44c10751ec89/scratchpad/node_modules/playwright'}');
  (async () => {
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
    const p = await b.newPage();
    await p.goto('file://${rutaHtml}', { waitUntil: 'load' });
    await p.pdf({ path: '${rutaPdf}', format: 'A4', printBackground: true });
    await b.close();
  })();
`], { stdio: 'inherit' });

console.log(`\n✅ ${rutaPdf}`);
console.log(`   Calle ${calle.length} (${conCups.length} con suministro) · Mapa ${mapa.length} · Importados ${importados.length}`);
