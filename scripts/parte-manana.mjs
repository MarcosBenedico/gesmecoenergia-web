#!/usr/bin/env node
/**
 * PARTE DE MAÑANA — PDF con todo lo que hay que gestionar sí o sí.
 *
 *   node scripts/parte-manana.mjs [YYYY-MM-DD]
 *
 * Saca de la base de datos, EN VIVO, todo lo pendiente de Marcos y de David y
 * lo imprime en un PDF para llevárselo. Sin fecha, usa mañana.
 *
 * Por qué existe pudiendo mirar la pantalla: la pantalla es para trabajar y
 * esto es para repasar — en el coche, en una reunión de equipo o antes de
 * empezar el día. Y porque una lista impresa se puede tachar.
 *
 * El PDF se dibuja pasando HTML por Chromium (Playwright), no con una librería
 * de PDF: el contenido es una tabla larga con texto variable, y dejar que el
 * navegador pagine y corte es mucho más fiable que ir midiendo cajas a mano.
 *
 * NO inventa prioridades: el orden sale de lo que dice el expediente —
 * primero lo que tiene fecha para el día pedido, luego lo que ya venció, y
 * dentro de eso lo que lleva más tiempo parado.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// ── Credenciales desde .env.local ──────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const CLAVE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SB || !CLAVE) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');

async function tabla(nombre, query) {
  const r = await fetch(`${URL_SB}/rest/v1/${nombre}?${query}`, {
    headers: { apikey: CLAVE, Authorization: `Bearer ${CLAVE}` },
  });
  if (!r.ok) throw new Error(`${nombre}: ${r.status} ${await r.text()}`);
  return r.json();
}

// ── Fechas ─────────────────────────────────────────────────────────────────
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const args = process.argv.slice(2);
const desdeArchivo = args.find((a) => a.startsWith('--datos='))?.slice(8);
const argFecha = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const hoy = new Date();
const objetivo = argFecha ? new Date(`${argFecha}T12:00:00`) : new Date(hoy.getTime() + 86400000);
const iso = (d) => d.toISOString().slice(0, 10);
const largo = (d) => `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
const ISO_OBJETIVO = iso(objetivo);
const ISO_HOY = iso(hoy);

/** Días de retraso respecto a hoy. Positivo = vencido. */
const retraso = (f) => f ? Math.round((new Date(ISO_HOY) - new Date(f)) / 86400000) : null;

// ── Quién es quién ─────────────────────────────────────────────────────────
// David figura unas veces como "Sales" y otras como "David": si se filtra por
// uno solo, su lista sale a la mitad. Se aceptan los dos.
const ES = {
  marcos: (r) => /marcos/i.test(r.responsable || ''),
  david: (r) => /sales|david/i.test(r.responsable || ''),
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

/** El importador dejó basura tipo "Origen: cartera-9-7-2026.xlsx | Tipo precio: ..." */
function limpiar(t) {
  if (!t) return '';
  let s = String(t).split(/Origen:\s*cartera/i)[0].trim();
  // Las tareas escritas enteras en mayúsculas se leen peor y parecen gritos.
  if (s.length > 12 && s === s.toUpperCase()) {
    s = s.charAt(0) + s.slice(1).toLowerCase();
  }
  return s;
}

/** El título de las fechas derivadas lleva el CUPS y la comercializadora dentro. */
function tituloCorto(t) {
  const s = String(t || '');
  const m = s.match(/^LUZ - .*? - (?:ES\d+\.\.\.|sin CUPS) - (.+?)(?: - .*)?$/);
  return limpiar(m ? m[1] : s.replace(/^LUZ - /, ''));
}

/**
 * Lee de un JSON ya volcado en vez de la base de datos.
 *
 * Existe porque hay entornos sin salida a Supabase (un contenedor con la red
 * restringida, por ejemplo). El PDF se genera igual y con los mismos datos;
 * lo único que cambia es de dónde vienen.
 */
function desdeJson(ruta) {
  return JSON.parse(readFileSync(ruta, 'utf8')).map((r) => ({
    que: limpiar(r.que), tipo: r.ti, fecha: r.f, responsable: r.q,
    cliente: r.c, telefono: r.tel, clasificacion: r.cl, retraso: r.d,
  }));
}

async function principal() {
  const campos = 'select=*,luz_clientes(nombre,telefono,clasificacion)';
  if (desdeArchivo) return conLineas(desdeJson(desdeArchivo), []);

  const [tareas, fechas, pipeline] = await Promise.all([
    tabla('luz_tareas', `${campos}&borrado_en=is.null&estado=neq.completada`),
    tabla('luz_fechas_criticas', `${campos}&borrado_en=is.null&estado=eq.pendiente`),
    tabla('luz_pipeline', `${campos}&borrado_en=is.null`),
  ]);

  /** Normaliza tareas y fechas a una sola forma. */
  const lineas = [
    ...tareas.map((t) => ({
      que: limpiar(t.descripcion),
      tipo: t.tipo_tarea,
      fecha: t.fecha_limite,
      responsable: t.responsable,
      cliente: t.luz_clientes?.nombre,
      telefono: t.luz_clientes?.telefono,
      clasificacion: t.luz_clientes?.clasificacion,
    })),
    ...fechas
      // Un año a dos cifras (0026-...) sale con 730.000 días de retraso y
      // ensucia todo el parte. Se aparta hasta que se corrija el dato.
      .filter((f) => f.fecha && f.fecha > '2000-01-01')
      .map((f) => ({
        que: tituloCorto(f.titulo),
        tipo: f.tipo_fecha,
        fecha: f.fecha,
        responsable: f.responsable,
        cliente: f.luz_clientes?.nombre,
        telefono: f.luz_clientes?.telefono,
        clasificacion: f.luz_clientes?.clasificacion,
      })),
  ].map((l) => ({ ...l, retraso: retraso(l.fecha) }))
    // Solo lo que ya toca: con fecha, y esa fecha no está en el futuro.
    .filter((l) => l.fecha && l.fecha <= ISO_OBJETIVO);

  return conLineas(lineas, pipeline);
}

function conLineas(lineas, pipeline) {
  const de = (quien) => lineas.filter(ES[quien]).sort((a, b) => b.retraso - a.retraso);
  const mios = de('marcos');
  const suyos = de('david');

  /** Lo que vence justo el día del parte: no se puede aplazar más. */
  const delDia = (xs) => xs.filter((l) => l.fecha === ISO_OBJETIVO);
  /** Preavisos y permanencias: si se pasan, el contrato se renueva solo. */
  const caduca = (xs) => xs.filter(
    (l) => /limite_preaviso|fin_permanencia|fin_contrato/.test(l.tipo)
  ).sort((a, b) => b.retraso - a.retraso);
  const conTelefono = (xs) => xs.filter((l) => l.telefono && !caduca(xs).includes(l));

  const proximas = pipeline
    .filter((p) => !['ganado', 'perdido', 'revisar_adelante'].includes(p.estado))
    .filter((p) => p.proxima_accion && String(p.proxima_accion).trim().toUpperCase() !== 'CERRADA');

  /**
   * Qué se lee en la primera columna. Un punto no dice nada: si la línea es de
   * otro día, tiene que verse de qué día, o no se sabe si corre prisa.
   */
  const etiquetaFecha = (l) => {
    if (l.retraso > 0) return `+${l.retraso}d`;
    if (l.fecha === ISO_OBJETIVO) return 'HOY';
    const [, m, d] = l.fecha.split('-');
    return `${Number(d)}/${Number(m)}`;
  };

  const fila = (l) => `<tr>
    <td class="ret ${l.retraso > 0 ? 'venc' : 'prox'}">${etiquetaFecha(l)}</td>
    <td class="cli"><b>${esc(l.cliente || '—')}</b>${l.clasificacion ? `<span class="cla">${esc(l.clasificacion)}</span>` : ''}</td>
    <td class="que">${esc(l.que || l.tipo)}</td>
    <td class="tel">${esc(l.telefono || '')}</td>
    <td class="tick"></td>
  </tr>`;

  const bloque = (titulo, subtitulo, xs) => !xs.length ? '' : `
    <section>
      <h3>${esc(titulo)} <span class="n">${xs.length}</span></h3>
      ${subtitulo ? `<p class="sub">${esc(subtitulo)}</p>` : ''}
      <table>${xs.map(fila).join('')}</table>
    </section>`;

  const persona = (nombre, xs) => {
    const urgentes = caduca(xs);
    const conTel = conTelefono(xs);
    const resto = xs.filter((l) => !urgentes.includes(l) && !conTel.includes(l));
    return `
    <div class="persona">
      <h2>${esc(nombre)} <span class="tot">${xs.length} pendientes</span></h2>
      ${bloque('Vence hoy', 'No se puede mover a otro día.', delDia(xs))}
      ${bloque('Contratos que caducan', 'Si el plazo se pasa, el contrato se renueva solo y hay que esperar otro año.', urgentes)}
      ${bloque('Se pueden hacer por teléfono', 'Tienen número guardado.', conTel)}
      ${bloque('Requieren ir o buscar el contacto', 'Sin teléfono en la ficha.', resto)}
    </div>`;
  };

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Gestionar ${largo(objetivo)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font: 10pt/1.35 -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; margin: 0; }
  header { border-bottom: 2.5px solid #111; padding-bottom: 8px; margin-bottom: 14px; }
  h1 { font-size: 19pt; margin: 0 0 2px; letter-spacing: -0.3px; }
  .fecha { font-size: 11pt; color: #444; margin: 0; }
  .aviso { border-left: 3px solid #b45309; background: #fffbeb; padding: 8px 10px; margin: 12px 0; font-size: 9.5pt; }
  .aviso b { color: #92400e; }
  .persona { break-before: page; }
  .persona:first-of-type { break-before: auto; }
  h2 { font-size: 14pt; margin: 16px 0 4px; padding-bottom: 3px; border-bottom: 1.5px solid #111; }
  .tot { float: right; font-size: 9pt; font-weight: normal; color: #666; }
  h3 { font-size: 10.5pt; margin: 12px 0 2px; }
  h3 .n { background: #111; color: #fff; border-radius: 9px; padding: 0 6px; font-size: 8pt; margin-left: 4px; }
  .sub { font-size: 8.5pt; color: #666; margin: 0 0 5px; }
  section { break-inside: avoid-page; }
  table { width: 100%; border-collapse: collapse; }
  tr { break-inside: avoid; }
  td { border-bottom: 1px solid #e5e5e5; padding: 3.5px 4px; vertical-align: top; }
  .ret { width: 36px; font-size: 8pt; font-weight: 700; white-space: nowrap; }
  .ret.venc { color: #b91c1c; }
  .ret.prox { color: #15803d; }
  .cli { width: 27%; font-size: 9pt; }
  .cla { display: block; font-size: 7pt; color: #777; text-transform: uppercase; font-weight: normal; }
  .que { font-size: 8.8pt; color: #333; }
  .tel { width: 78px; font-size: 8.5pt; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .tick { width: 16px; border-bottom: 1px solid #e5e5e5; }
  .tick::after { content: ""; display: block; width: 11px; height: 11px; border: 1.2px solid #999; border-radius: 2px; }
  footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #ccc; font-size: 8pt; color: #666; }
</style></head><body>
<header>
  <h1>Lo que hay que gestionar sí o sí</h1>
  <p class="fecha">${largo(objetivo)} de ${objetivo.getFullYear()} · Gesmeco Energía</p>
</header>

${objetivo.getDay() === 0 || objetivo.getDay() === 6 ? `
<div class="aviso">
  <b>${largo(objetivo)} es fin de semana.</b> En el plan de rutas no es día de trabajo, así que
  esta lista es en realidad la del primer día hábil. Lo marcado como <b>HOY</b> vence justo ese día;
  todo lo demás ya venía vencido de antes.
</div>` : ''}

<div class="aviso">
  <b>Esta lista solo incluye lo que tiene fecha puesta.</b> Lo que está pendiente sin fecha
  no aparece aquí: no está retrasado, está sin planificar, y mezclarlo haría la lista inservible.
</div>

${persona('Marcos', mios)}
${persona('David', suyos)}

<footer>
  Generado el ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })} desde la base de datos.
  ${mios.length + suyos.length} líneas con fecha vencida o del día.
  Las oportunidades abiertas con próxima acción escrita (${proximas.length}) se consultan en el Pipeline.
</footer>
</body></html>`;

  const rutaHtml = '/tmp/parte-manana.html';
  const rutaPdf = process.env.SALIDA || `/tmp/gestionar-${ISO_OBJETIVO}.pdf`;
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
  console.log(`   Marcos: ${mios.length} · David: ${suyos.length}`);
  console.log(`   Vencen el ${ISO_OBJETIVO}: Marcos ${delDia(mios).length}, David ${delDia(suyos).length}`);
  console.log(`   Contratos que caducan: Marcos ${caduca(mios).length}, David ${caduca(suyos).length}`);
}

principal().catch((e) => { console.error(`\n❌ ${e.message}\n`); process.exit(1); });
