#!/usr/bin/env node
/**
 * FICHA DE SEGUIMIENTO DE CLIENTE — una hoja A4 por cliente, para llevar encima.
 *
 *   node scripts/ficha-cliente.mjs "JOSAN ESPLUS" "AGUSTÍN" "MARC SUSAGNA"
 *   node scripts/ficha-cliente.mjs --datos=volcado.json
 *
 * Replica la hoja que ya usa Marcos a mano y la rellena con lo que hay en el
 * sistema. Lo que no está en la base de datos se queda EN BLANCO, con su raya
 * para escribir: una ficha a medias que se completa en la visita es útil, y una
 * ficha con huecos inventados es peor que no llevar nada.
 *
 * POR QUÉ UNA HOJA DE PAPEL EXISTIENDO EL PANEL
 *
 * Porque en una granja no se saca el móvil: se llevan guantes, hay ruido y a
 * veces no hay cobertura. Lo que se apunta se apunta en papel y se mete luego.
 * La ficha además ordena la conversación — las ocho secciones son las ocho
 * cosas que hay que preguntar, y con la hoja delante no se olvida ninguna.
 *
 * REGLA DE HONESTIDAD: el bloque «Lo que ya sabemos» separa lo que dice el
 * expediente de lo que es deducción mía. Lo deducido va marcado como tal. Un
 * comercial que se planta delante del cliente con un dato inventado por un
 * informe pierde la venta y la confianza, y no sabe cuál de las dos cosas le
 * ha pasado.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const desdeArchivo = args.find((a) => a.startsWith('--datos='))?.slice(8);
const nombres = args.filter((a) => !a.startsWith('--'));

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fecha = (f) => f ? new Date(`${f}T12:00:00`).toLocaleDateString('es-ES') : '';

/** Una dirección que en realidad es un enlace de Google Maps no se puede leer en papel. */
const esEnlace = (d) => /^https?:\/\//i.test(String(d || ''));
const direccionLegible = (d) => {
  if (!d) return '';
  if (!esEnlace(d)) return d;
  const c = String(d).match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  return c ? `Coordenadas ${Number(c[1]).toFixed(5)}, ${Number(c[2]).toFixed(5)}` : '(ubicación en el mapa del gestor)';
};

const ESTADO_LABEL = {
  detectado: 'Detectado', contacto_iniciado: 'Contacto iniciado', en_analisis: 'En análisis',
  prospecto: 'Prospecto', factura_solicitada: 'Factura solicitada', factura_recibida: 'Factura recibida',
  pendiente_ofertar: 'Pendiente de ofertar', oferta_enviada: 'Oferta enviada',
  pendiente_firma: 'Pendiente de firma', doc_incompleta: 'Documentación incompleta',
  datos_incompletos: 'Datos incompletos', ganado: 'Ganado', activo: 'Activo',
};
const label = (e) => ESTADO_LABEL[e] || (e ? String(e).replace(/_/g, ' ') : '');

/** Fila vacía con raya, para escribir a mano. */
const campo = (etiqueta, valor = '', ancho = '') =>
  `<div class="campo" style="${ancho}"><span class="et">${esc(etiqueta)}</span><span class="val">${esc(valor)}</span></div>`;

const casilla = (t) => `<div class="chk"><span class="caja"></span>${esc(t)}</div>`;

/** Filas en blanco de una tabla, para rellenar a mano en la visita. */
const vacias = (n, cols) => Array.from({ length: n }, () => `<tr>${'<td>&nbsp;</td>'.repeat(cols)}</tr>`).join('');

function ficha(c, i, total) {
  const cups = c.cups || [];
  const pipe = (c.pipeline || [])[0];
  const pendientes = [...(c.tareas || []), ...(c.fechas || [])]
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

  return `
<article class="hoja">
  <div class="cab">
    <span>Ficha de seguimiento de cliente</span>
    <span>Gesmeco Energía · Ficha ${i} / ${total}</span>
  </div>

  <div class="titulo">
    <h1>${esc(c.nombre)}</h1>
    <div class="meta">
      <span class="badge">${esc((c.clasificacion || '').toUpperCase())}</span>
      <span class="alta">Alta: ${fecha(c.alta)} · Responsable: ${esc(c.responsable || '—')}</span>
    </div>
  </div>

  <h2>1. Identificación del cliente</h2>
  <div class="rejilla">
    ${campo('Razón social', c.nombre, 'flex:2')}
    ${campo('NIF / CIF', c.nif)}
    ${campo('Actividad', c.tipo_cliente)}
  </div>
  <div class="rejilla">
    ${campo('Domicilio fiscal', direccionLegible(c.direccion), 'flex:2')}
    ${campo('Código postal')}
    ${campo('Municipio')}
  </div>
  <div class="rejilla">
    ${campo('Persona de contacto', c.persona_contacto)}
    ${campo('Cargo')}
    ${campo('Móvil', c.telefono)}
    ${campo('Fijo')}
  </div>
  <div class="rejilla">
    ${campo('Correo electrónico', c.email, 'flex:1')}
    ${campo('IBAN (para el contrato)', '', 'flex:1')}
  </div>

  <h2>2. Puntos de suministro</h2>
  <table class="tabla">
    <tr class="th"><td>CUPS</td><td>Tarifa</td><td>Comercializadora</td><td>kWh / año</td><td>Fin contrato</td><td>Potencias contratadas (kW)</td></tr>
    ${cups.map((s) => `<tr>
      <td>${esc(s.cups || '')}</td><td>${esc(s.tarifa || '')}</td>
      <td>${esc(s.comercializadora || '')}</td>
      <td>${s.consumo ? Number(s.consumo).toLocaleString('es-ES') : ''}</td>
      <td>${fecha(s.fin_contrato)}</td><td>${esc(s.potencias || '')}</td></tr>`).join('')}
    ${vacias(Math.max(1, 3 - cups.length), 6)}
  </table>
  <div class="rejilla">
    ${campo('Distribuidora', cups[0]?.distribuidora)}
    ${campo('Permanencia hasta')}
    ${campo('Preaviso (días)')}
    ${campo('Penalización por baja')}
  </div>

  <h2>3. Lo que paga hoy</h2>
  <div class="rejilla">
    ${campo('Importe anual (EUR)')}
    ${campo('Precio medio EUR/kWh')}
    ${campo('Término de potencia')}
    ${campo('Excesos de potencia')}
    ${campo('Reactiva')}
  </div>

  <h2>4. Documentación recibida</h2>
  <div class="dosc">
    <div>
      ${casilla('Facturas de luz (12 meses)')}
      ${casilla('Factura de gas')}
      ${casilla('CIF / NIF de la empresa')}
      ${casilla('DNI del representante')}
    </div>
    <div>
      ${casilla('Escrituras o poder de representación')}
      ${casilla('Certificado de titularidad bancaria')}
      ${casilla('Autorización de datos (RGPD) firmada')}
      ${casilla('Autorización Datadis (curva de consumo)')}
    </div>
  </div>

  <h2>5. Histórico de gestiones</h2>
  <table class="tabla">
    <tr class="th"><td>Fecha</td><td>Vía</td><td>Con quién</td><td>Qué se habló</td><td>Próximo paso</td></tr>
    ${vacias(4, 5)}
  </table>

  <h2>6. Estudios y ofertas presentadas</h2>
  <table class="tabla">
    <tr class="th"><td>Fecha</td><td>Comercializadora</td><td>Precio ofertado</td><td>Ahorro EUR/año</td><td>Ahorro %</td><td>Resultado</td></tr>
    ${vacias(3, 6)}
  </table>

  <h2>7. Fotovoltaica</h2>
  <div class="rejilla">
    ${campo('Cubierta (tipo)')}
    ${campo('Superficie útil m²')}
    ${campo('Orientación')}
    ${campo('Potencia propuesta kWp')}
    ${campo('% consumo diurno')}
  </div>

  <h2>8. Situación y próximo paso</h2>
  <div class="rejilla">
    ${campo('Fase comercial', label(pipe?.estado || c.estado_comercial))}
    ${campo('Probabilidad de cierre', pipe?.probabilidad ? `${pipe.probabilidad}%` : '')}
    ${campo('Comisión estimada (EUR)', pipe?.comision || '')}
    ${campo('Fecha próxima acción', fecha(pipe?.fecha_proxima || pendientes[0]?.fecha))}
  </div>
  <div class="rejilla">
    ${campo('Próxima acción', pipe?.proxima_accion || pendientes[0]?.descripcion || '', 'flex:1')}
  </div>

  ${c.sabemos ? `<div class="saben">
    <b>Lo que ya sabemos</b>
    <p>${c.sabemos}</p>
  </div>` : ''}

  <div class="pie">
    Documento interno de Gesmeco Energía. Contiene datos personales: trátalo conforme al RGPD. No circular, no dejar a la vista.
    <span>${i} / ${total}</span>
  </div>
</article>`;
}

const clientes = desdeArchivo
  ? JSON.parse(readFileSync(desdeArchivo, 'utf8'))
  : await (async () => { throw new Error('Consulta en vivo pendiente de implementar; usa --datos por ahora.'); })();

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Fichas de seguimiento</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font: 8.5pt/1.3 -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; margin: 0; }
  .hoja { break-after: page; }
  .hoja:last-child { break-after: auto; }

  .cab { background: #1a1a1a; color: #fff; display: flex; justify-content: space-between;
         padding: 4px 8px; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.6px; }
  .titulo { border-bottom: 2.5px solid #111; padding: 6px 0 5px; margin-bottom: 6px;
            display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
  h1 { font-size: 16pt; margin: 0; letter-spacing: -0.2px; }
  .meta { text-align: right; flex-shrink: 0; }
  .badge { display: inline-block; background: #1a1a1a; color: #fff; padding: 3px 12px;
           font-size: 7.5pt; font-weight: 800; letter-spacing: 1px; }
  .alta { display: block; font-size: 6.5pt; color: #666; margin-top: 3px; }

  h2 { background: #1a1a1a; color: #fff; font-size: 7.5pt; font-weight: 700; margin: 7px 0 4px;
       padding: 2.5px 8px; text-transform: uppercase; letter-spacing: 0.5px; }

  .rejilla { display: flex; gap: 12px; margin-bottom: 5px; }
  .campo { flex: 1; min-width: 0; }
  .et { display: block; font-size: 6pt; color: #777; text-transform: uppercase; letter-spacing: 0.4px; }
  /* La raya es lo que invita a escribir: sin ella el hueco no se rellena. */
  .val { display: block; border-bottom: 0.8px solid #999; min-height: 13px;
         font-size: 8.5pt; font-weight: 600; padding-bottom: 1px; }

  .tabla { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  .tabla td { border: 0.8px solid #bbb; padding: 2px 4px; height: 14px; font-size: 8pt; }
  .tabla .th td { background: #f0f0f0; font-size: 5.8pt; text-transform: uppercase;
                  letter-spacing: 0.3px; color: #444; font-weight: 700; height: auto; }

  .dosc { display: flex; gap: 24px; }
  .chk { font-size: 8pt; margin-bottom: 3px; display: flex; align-items: center; gap: 6px; }
  .caja { width: 10px; height: 10px; border: 1px solid #666; display: inline-block; flex-shrink: 0; }

  .saben { border: 1px solid #111; padding: 5px 8px; margin-top: 7px; background: #fafafa; }
  .saben b { font-size: 6.5pt; text-transform: uppercase; letter-spacing: 0.6px; }
  .saben p { margin: 3px 0 0; font-size: 7.5pt; line-height: 1.4; }
  .saben i { color: #444; }

  .pie { margin-top: 10px; padding-top: 4px; border-top: 0.8px solid #ccc;
         font-size: 5.5pt; color: #888; display: flex; justify-content: space-between; }
</style></head><body>
${clientes.map((c, i) => ficha(c, i + 1, clientes.length)).join('')}
</body></html>`;

const rutaHtml = '/tmp/fichas.html';
const rutaPdf = process.env.SALIDA || '/tmp/fichas-clientes.pdf';
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

console.log(`\n✅ ${rutaPdf} · ${clientes.length} fichas`);
