'use client';

import { useMemo, useState } from 'react';
import { FileText, Plus, Trash2, Pencil, X, Printer, Save } from 'lucide-react';
import { LuzCliente, LuzCups, LuzProyecto, TARIFAS_ACCESO, fmtFecha } from '@/lib/luz';
import { Card, Badge, EstadoCarga, useListaLuz, guardarLuz, inputCls, labelCls, btnPrimario, btnSecundario } from '../ui';

/**
 * Automatizador de proyectos de ahorro de luz.
 * Se eligen los CUPS a ofertar, se meten consumos e importes actuales por mes
 * (los meses que se quieran mostrar) y, por cada CUPS, dos ofertas:
 * precio FIJO a 12 meses e INDEXADO. Calcula el ahorro y genera el
 * documento profesional para presentar al cliente.
 */

interface MesDato { mes: string; consumo_kwh: string; importe_eur: string }
interface CupsProyecto {
  cups_id: string;          // id en luz_cups o '' si se escribe a mano
  etiqueta: string;         // texto que ve el cliente (CUPS o alias)
  tarifa: string;
  meses: MesDato[];
  fijo_precio_kwh: string;      // €/kWh oferta fija 12 meses
  fijo_termino_mes: string;     // € fijos al mes (potencia/cuota), opcional
  index_precio_kwh: string;     // €/kWh estimado indexado
  index_cuota_mes: string;      // € gestión al mes indexado, opcional
}
interface DatosProyecto { meses_mostrar: number; cups: CupsProyecto[] }

const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Últimos n meses en formato YYYY-MM (el más antiguo primero). */
function ultimosMeses(n: number): string[] {
  const res: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n; i >= 1; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    res.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`);
  }
  return res;
}
const nombreMes = (ym: string) => {
  const [a, m] = ym.split('-');
  return `${MESES_LARGO[(parseInt(m) || 1) - 1]} ${a}`;
};
const num = (s: string) => { const v = parseFloat(String(s).replace(',', '.')); return isNaN(v) ? 0 : v; };
const eur = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const kwh = (v: number) => Math.round(v).toLocaleString('es-ES') + ' kWh';

function cupsVacio(mesesMostrar: number): CupsProyecto {
  return {
    cups_id: '', etiqueta: '', tarifa: '2.0TD',
    meses: ultimosMeses(mesesMostrar).map((mes) => ({ mes, consumo_kwh: '', importe_eur: '' })),
    fijo_precio_kwh: '', fijo_termino_mes: '', index_precio_kwh: '', index_cuota_mes: '',
  };
}

/** Cálculo de un CUPS: situación actual anualizada y coste de las dos ofertas. */
function calcularCups(c: CupsProyecto) {
  const filas = c.meses.filter((m) => num(m.consumo_kwh) > 0 || num(m.importe_eur) > 0);
  const n = filas.length;
  const consumo = filas.reduce((s, m) => s + num(m.consumo_kwh), 0);
  const gasto = filas.reduce((s, m) => s + num(m.importe_eur), 0);
  const factor = n > 0 ? 12 / n : 0;
  const consumoAnual = consumo * factor;
  const gastoAnual = gasto * factor;
  const precioMedio = consumo > 0 ? gasto / consumo : 0;
  const fijoAnual = num(c.fijo_precio_kwh) > 0 ? consumoAnual * num(c.fijo_precio_kwh) + num(c.fijo_termino_mes) * 12 : null;
  const indexAnual = num(c.index_precio_kwh) > 0 ? consumoAnual * num(c.index_precio_kwh) + num(c.index_cuota_mes) * 12 : null;
  return {
    n, consumo, gasto, consumoAnual, gastoAnual, precioMedio,
    fijoAnual, ahorroFijo: fijoAnual != null ? gastoAnual - fijoAnual : null,
    indexAnual, ahorroIndex: indexAnual != null ? gastoAnual - indexAnual : null,
  };
}

export default function ProyectosLuzPage() {
  const clientes = useListaLuz<LuzCliente>('clientes');
  const cups = useListaLuz<LuzCups>('cups');
  const proyectos = useListaLuz<LuzProyecto>('proyectos');

  // ── Editor ──
  const [editando, setEditando] = useState(false);
  const [proyectoId, setProyectoId] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [mesesMostrar, setMesesMostrar] = useState(6);
  const [bloques, setBloques] = useState<CupsProyecto[]>([]);
  const [msg, setMsg] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cliente = clientes.datos.find((c) => c.id === clienteId) || null;
  const cupsDelCliente = useMemo(() => cups.datos.filter((c) => c.cliente_id === clienteId), [cups.datos, clienteId]);

  function nuevoProyecto() {
    setProyectoId(null); setClienteId(''); setTitulo(''); setMesesMostrar(6);
    setBloques([cupsVacio(6)]); setMsg(''); setEditando(true);
  }

  function abrirProyecto(p: LuzProyecto) {
    const d = p.datos as unknown as DatosProyecto;
    setProyectoId(p.id);
    setClienteId(p.cliente_id || '');
    setTitulo(p.titulo);
    setMesesMostrar(d.meses_mostrar || 6);
    setBloques(Array.isArray(d.cups) && d.cups.length ? d.cups : [cupsVacio(d.meses_mostrar || 6)]);
    setMsg(''); setEditando(true);
  }

  /** Cambiar cuántos meses aparecen: recorta o añade filas en todos los CUPS. */
  function cambiarMeses(n: number) {
    const nn = Math.min(12, Math.max(1, n));
    setMesesMostrar(nn);
    const plantilla = ultimosMeses(nn);
    setBloques((bs) => bs.map((b) => ({
      ...b,
      meses: plantilla.map((mes) => b.meses.find((m) => m.mes === mes) || { mes, consumo_kwh: '', importe_eur: '' }),
    })));
  }

  const setBloque = (i: number, cambios: Partial<CupsProyecto>) =>
    setBloques((bs) => bs.map((b, j) => (j === i ? { ...b, ...cambios } : b)));
  const setMes = (i: number, j: number, campo: 'mes' | 'consumo_kwh' | 'importe_eur', valor: string) =>
    setBloques((bs) => bs.map((b, k) => k !== i ? b : { ...b, meses: b.meses.map((m, l) => (l === j ? { ...m, [campo]: valor } : m)) }));

  /** Al elegir un CUPS del cliente, se rellena la etiqueta y la tarifa. */
  function elegirCups(i: number, id: string) {
    const s = cupsDelCliente.find((c) => c.id === id);
    setBloque(i, {
      cups_id: id,
      etiqueta: s ? (s.alias_suministro ? `${s.alias_suministro} · ${s.cups}` : s.cups) : bloques[i].etiqueta,
      tarifa: s?.tarifa_acceso || bloques[i].tarifa,
    });
  }

  async function guardarProyecto() {
    if (!titulo.trim()) { setMsg('Pon un título al proyecto (p. ej. "Estudio Granja Pérez").'); return; }
    setGuardando(true); setMsg('');
    const datos: DatosProyecto = { meses_mostrar: mesesMostrar, cups: bloques };
    const body = { cliente_id: clienteId || null, titulo: titulo.trim(), datos };
    const err = proyectoId
      ? await guardarLuz('proyectos', 'PUT', { id: proyectoId, ...body })
      : await guardarLuz('proyectos', 'POST', body);
    setGuardando(false);
    if (err) { setMsg(err); return; }
    setMsg('✅ Proyecto guardado.');
    proyectos.recargar();
    if (!proyectoId) setEditando(false);
  }

  async function borrarProyecto(p: LuzProyecto) {
    if (!confirm(`¿Eliminar el proyecto "${p.titulo}"?`)) return;
    const err = await guardarLuz('proyectos', 'DELETE', { id: p.id });
    if (err) { setMsg(err); return; }
    proyectos.recargar();
  }

  // ── Documento para el cliente ──
  function generarDocumento() {
    const logo = `${window.location.origin}/logo-gesmeco.png`;
    const hoy = new Date().toLocaleDateString('es-ES');
    const conDatos = bloques.filter((b) => b.etiqueta.trim() || b.meses.some((m) => num(m.consumo_kwh) > 0));
    if (conDatos.length === 0) { setMsg('Rellena al menos un CUPS con datos para generar el documento.'); return; }

    let totalActual = 0, totalFijo = 0, totalIndex = 0, hayFijo = false, hayIndex = false;

    const secciones = conDatos.map((b, idx) => {
      const r = calcularCups(b);
      totalActual += r.gastoAnual;
      if (r.fijoAnual != null) { totalFijo += r.fijoAnual; hayFijo = true; }
      if (r.indexAnual != null) { totalIndex += r.indexAnual; hayIndex = true; }

      const filasMeses = b.meses
        .filter((m) => num(m.consumo_kwh) > 0 || num(m.importe_eur) > 0)
        .map((m) => `<tr><td>${nombreMes(m.mes)}</td><td class="num">${kwh(num(m.consumo_kwh))}</td><td class="num">${eur(num(m.importe_eur))}</td></tr>`)
        .join('');

      const tarjeta = (nombre: string, sub: string, coste: number | null, ahorro: number | null) => coste == null ? '' : `
        <div class="oferta">
          <p class="of-nombre">${nombre}</p>
          <p class="of-sub">${sub}</p>
          <p class="of-coste">${eur(coste)} <span>/año estimado</span></p>
          ${ahorro != null && ahorro > 0 ? `<p class="of-ahorro">Ahorro estimado: <b>${eur(ahorro)}</b> al año (${r.gastoAnual > 0 ? Math.round((ahorro / r.gastoAnual) * 100) : 0}%)</p>` : ahorro != null ? `<p class="of-igual">Coste similar al actual</p>` : ''}
        </div>`;

      return `
<h2>Suministro ${idx + 1} · ${b.etiqueta || 'CUPS'} <span class="tarifa">Tarifa ${b.tarifa}</span></h2>
<table>
  <thead><tr><th>Mes</th><th class="num">Consumo</th><th class="num">Importe actual</th></tr></thead>
  <tbody>${filasMeses}</tbody>
  <tfoot><tr class="suma"><td>Total ${r.n} mes${r.n === 1 ? '' : 'es'}</td><td class="num">${kwh(r.consumo)}</td><td class="num">${eur(r.gasto)}</td></tr></tfoot>
</table>
<p class="anual">📊 Proyección anual con sus consumos: <b>${kwh(r.consumoAnual)}</b> → gasto actual estimado <b>${eur(r.gastoAnual)}</b>/año
(precio medio ${r.precioMedio.toFixed(4).replace('.', ',')} €/kWh).</p>
<div class="ofertas">
  ${tarjeta('🔒 Oferta PRECIO FIJO · 12 meses', `${num(b.fijo_precio_kwh).toFixed(4).replace('.', ',')} €/kWh${num(b.fijo_termino_mes) > 0 ? ` + ${eur(num(b.fijo_termino_mes))}/mes` : ''} — mismo precio todo el año, sin sustos`, r.fijoAnual, r.ahorroFijo)}
  ${tarjeta('📈 Oferta INDEXADA', `${num(b.index_precio_kwh).toFixed(4).replace('.', ',')} €/kWh estimado${num(b.index_cuota_mes) > 0 ? ` + ${eur(num(b.index_cuota_mes))}/mes de gestión` : ''} — sigue el precio del mercado`, r.indexAnual, r.ahorroIndex)}
</div>`;
    }).join('');

    const resumen = conDatos.length > 1 ? `
<h2>Resumen del proyecto (${conDatos.length} suministros)</h2>
<table>
  <thead><tr><th>Escenario</th><th class="num">Coste anual estimado</th><th class="num">Ahorro anual</th></tr></thead>
  <tbody>
    <tr><td>Situación actual</td><td class="num">${eur(totalActual)}</td><td class="num">—</td></tr>
    ${hayFijo ? `<tr><td>🔒 Con oferta a precio fijo</td><td class="num">${eur(totalFijo)}</td><td class="num"><b>${eur(totalActual - totalFijo)}</b></td></tr>` : ''}
    ${hayIndex ? `<tr><td>📈 Con oferta indexada</td><td class="num">${eur(totalIndex)}</td><td class="num"><b>${eur(totalActual - totalIndex)}</b></td></tr>` : ''}
  </tbody>
</table>` : '';

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Proyecto de ahorro · ${titulo || cliente?.nombre || ''}</title>
<style>
  :root{--rojo:#e11d48;--oscuro:#131322;--gris:#5c5c6e}
  *{box-sizing:border-box} body{font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#1a1a2e;margin:0;background:#fff}
  .hoja{max-width:800px;margin:0 auto;padding:0 2.2rem 2.5rem}
  .banda{background:var(--oscuro);color:#fff;padding:1.6rem 2.2rem;display:flex;justify-content:space-between;align-items:center;gap:1.5rem}
  .banda img{height:52px;width:auto;display:block}
  .banda .ref{text-align:right;font-size:.8rem;color:#c9c9d6;line-height:1.6}
  .banda .ref b{color:#fff;font-size:1rem;display:block;letter-spacing:.06em}
  .franja{height:5px;background:linear-gradient(90deg,var(--rojo),#ff7a45,#00b7d9)}
  h2{font-size:.78rem;letter-spacing:.18em;text-transform:uppercase;color:var(--rojo);margin:1.9rem 0 .5rem;border-bottom:1px solid #eee;padding-bottom:.35rem}
  h2 .tarifa{float:right;color:var(--gris);letter-spacing:.04em}
  .dos{display:flex;gap:2rem} .dos>div{flex:1}
  .caja{background:#f8f8fa;border:1px solid #ececf1;border-radius:10px;padding:.9rem 1.1rem;font-size:.92rem;line-height:1.55}
  .caja b{display:block;font-size:1rem}
  p{line-height:1.6}
  table{width:100%;border-collapse:collapse;margin:.6rem 0}
  td,th{padding:.5rem .9rem;text-align:left;font-size:.9rem}
  thead th{background:var(--oscuro);color:#fff;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase}
  tbody td{border-bottom:1px solid #eee}
  .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .suma td{background:#f3f3f7;font-weight:800}
  .anual{background:#f8f8fa;border-left:3px solid var(--rojo);border-radius:0 8px 8px 0;padding:.6rem .9rem;font-size:.9rem}
  .ofertas{display:flex;gap:1rem;margin:.7rem 0}
  .oferta{flex:1;border:1.5px solid var(--oscuro);border-radius:12px;padding:.9rem 1.1rem}
  .of-nombre{font-weight:800;margin:0 0 .15rem}
  .of-sub{font-size:.8rem;color:var(--gris);margin:0 0 .5rem}
  .of-coste{font-size:1.35rem;font-weight:900;color:var(--oscuro);margin:0}
  .of-coste span{font-size:.75rem;font-weight:600;color:var(--gris)}
  .of-ahorro{margin:.35rem 0 0;color:#0a7d4f;font-size:.9rem}
  .of-igual{margin:.35rem 0 0;color:var(--gris);font-size:.85rem}
  ul{margin:.4rem 0;padding-left:1.2rem} li{margin:.25rem 0;font-size:.85rem;color:#3a3a4a}
  .firma{margin-top:2.6rem;display:flex;gap:2.5rem}
  .firma div{flex:1;border-top:1.5px solid var(--oscuro);padding-top:.45rem;font-size:.82rem;color:var(--gris)}
  .pie{margin-top:2rem;padding-top:.8rem;border-top:1px solid #eee;font-size:.75rem;color:var(--gris);text-align:center}
  @media print{.noprint{display:none} .banda,thead th,.franja,.suma td{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="banda">
  <img src="${logo}" alt="Gesmeco Energía">
  <div class="ref"><b>PROYECTO DE AHORRO</b>Fecha: ${hoy}<br>Validez: 15 días</div>
</div>
<div class="franja"></div>
<div class="hoja">
<div class="dos">
  <div><h2>Cliente</h2><div class="caja"><b>${cliente?.nombre || '—'}</b>${titulo ? titulo : ''}</div></div>
  <div><h2>Elaborado por</h2><div class="caja"><b>Gesmeco Energía</b>Avenida de Aragón, 50 · 22500 Binéfar (Huesca)<br>www.gesmecoenergia.com</div></div>
</div>
${secciones}
${resumen}
<h2>Condiciones y notas</h2>
<ul>
  <li><b>Precio fijo 12 meses:</b> el precio de la energía se mantiene durante todo el año, pase lo que pase en el mercado.</li>
  <li><b>Indexado:</b> el precio sigue el mercado mayorista (OMIE) hora a hora; el coste indicado es una estimación con los precios actuales y puede variar al alza o a la baja.</li>
  <li>Proyección calculada a partir de los consumos reales facilitados por el cliente, extrapolados a 12 meses.</li>
  <li>Importes con los mismos impuestos y peajes que las facturas facilitadas. La comparativa es orientativa hasta la oferta en firme de la comercializadora.</li>
  <li>Gesmeco Energía gestiona el cambio sin coste y sin cortes de suministro: usted no tiene que hacer nada.</li>
</ul>
<div class="firma"><div>Firma del cliente</div><div>Gesmeco Energía</div></div>
<p class="pie">Gesmeco Energía · Avenida de Aragón, 50 · 22500 Binéfar (Huesca) · www.gesmecoenergia.com</p>
<p class="noprint" style="margin-top:1.4rem;text-align:center"><button onclick="window.print()" style="padding:.7rem 1.6rem;font-weight:bold;font-size:1rem;background:#e11d48;color:#fff;border:none;border-radius:8px;cursor:pointer">🖨️ Imprimir / Guardar como PDF</button></p>
</div></body></html>`);
    w.document.close();
  }

  // ── Totales del editor (en pantalla) ──
  const resultados = bloques.map(calcularCups);
  const totActual = resultados.reduce((s, r) => s + r.gastoAnual, 0);
  const totFijo = resultados.reduce((s, r) => s + (r.fijoAnual ?? 0), 0);
  const totIndex = resultados.reduce((s, r) => s + (r.indexAnual ?? 0), 0);
  const hayFijo = resultados.some((r) => r.fijoAnual != null);
  const hayIndex = resultados.some((r) => r.indexAnual != null);

  const cargando = clientes.cargando || proyectos.cargando;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2"><FileText className="w-5 h-5 text-accent" /> Automatizador de proyectos</h2>
          <p className="text-xs text-muted mt-0.5">
            Elige los CUPS a ofertar, mete consumos e importes por mes y presenta dos ofertas por suministro:
            precio fijo 12 meses e indexado. Genera el documento listo para el cliente.
          </p>
        </div>
        {!editando && <button onClick={nuevoProyecto} className={btnPrimario}><Plus className="w-4 h-4" /> Nuevo proyecto</button>}
      </div>

      <EstadoCarga cargando={cargando} error={proyectos.error} faltaMigracion={proyectos.faltaMigracion} vacio={false} textoVacio="" sqlFile="supabase_proyectos_luz.sql" />
      {proyectos.faltaMigracion && (
        <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
          ⚠️ Falta crear la tabla de proyectos: ejecuta <b>supabase_proyectos_luz.sql</b> en el SQL Editor de Supabase. Mientras tanto puedes calcular y generar documentos, pero no guardar.
        </p>
      )}

      {msg && <p className={`text-xs rounded-lg p-2.5 border ${msg.startsWith('✅') ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-red-400 bg-red-500/10 border-red-500/30'}`}>{msg}</p>}

      {/* ── Lista de proyectos guardados ── */}
      {!editando && !cargando && (
        <Card>
          <h3 className="font-bold text-sm mb-3">Proyectos guardados ({proyectos.datos.length})</h3>
          {proyectos.datos.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">Todavía no hay proyectos. Pulsa «Nuevo proyecto» para crear el primero.</p>
          ) : (
            <div className="space-y-1.5">
              {proyectos.datos.map((p) => (
                <div key={p.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-card/60 border border-border/20">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{p.titulo}</p>
                    <p className="text-[10px] text-muted">
                      {p.luz_clientes?.nombre || 'Sin cliente'} · {(p.datos as unknown as DatosProyecto)?.cups?.length || 0} CUPS · {fmtFecha(p.creado_en?.slice(0, 10))}
                    </p>
                  </div>
                  <button onClick={() => abrirProyecto(p)} className={btnSecundario}><Pencil className="w-3.5 h-3.5" /> Abrir</button>
                  <button onClick={() => borrarProyecto(p)} className="text-muted hover:text-red-400 p-1.5" title="Eliminar proyecto"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Editor ── */}
      {editando && (
        <>
          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-bold text-sm">{proyectoId ? '✏️ Editando proyecto' : '🆕 Nuevo proyecto'}</h3>
              <button onClick={() => setEditando(false)} className={btnSecundario}><X className="w-3.5 h-3.5" /> Cerrar sin guardar</button>
            </div>
            <div className="grid md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label className={labelCls}>Título del proyecto *</label>
                <input className={inputCls} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="P. ej. Estudio Granja Pérez · 3 naves" />
              </div>
              <div>
                <label className={labelCls}>Cliente</label>
                <select className={inputCls} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                  <option value="">— Sin asociar —</option>
                  {clientes.datos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Meses en el proyecto (1-12)</label>
                <input className={inputCls} type="number" min={1} max={12} value={mesesMostrar} onChange={(e) => cambiarMeses(parseInt(e.target.value) || 6)} />
              </div>
            </div>
          </Card>

          {bloques.map((b, i) => {
            const r = resultados[i];
            return (
              <Card key={i} className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="font-bold text-sm">🔌 Suministro {i + 1}</h3>
                  {bloques.length > 1 && (
                    <button onClick={() => setBloques((bs) => bs.filter((_, j) => j !== i))} className="text-muted hover:text-red-400 text-xs font-bold">✕ Quitar este CUPS</button>
                  )}
                </div>

                <div className="grid md:grid-cols-3 gap-3">
                  {clienteId && cupsDelCliente.length > 0 && (
                    <div>
                      <label className={labelCls}>CUPS del cliente</label>
                      <select className={inputCls} value={b.cups_id} onChange={(e) => elegirCups(i, e.target.value)}>
                        <option value="">— Escribir a mano —</option>
                        {cupsDelCliente.map((s) => <option key={s.id} value={s.id}>{s.alias_suministro || s.cups}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>Etiqueta (lo que ve el cliente)</label>
                    <input className={inputCls} value={b.etiqueta} onChange={(e) => setBloque(i, { etiqueta: e.target.value })} placeholder="Nave principal · ES0021..." />
                  </div>
                  <div>
                    <label className={labelCls}>Tarifa</label>
                    <select className={inputCls} value={b.tarifa} onChange={(e) => setBloque(i, { tarifa: e.target.value })}>
                      {TARIFAS_ACCESO.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {/* Consumos e importes por mes */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] uppercase text-muted border-b border-border/40">
                        <th className="py-1.5 pr-2">Mes</th>
                        <th className="py-1.5 pr-2">Consumo (kWh)</th>
                        <th className="py-1.5">Importe factura (€)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.meses.map((m, j) => (
                        <tr key={j} className="border-b border-border/15">
                          <td className="py-1 pr-2">
                            <input className={`${inputCls} !py-1`} type="month" value={m.mes} onChange={(e) => setMes(i, j, 'mes', e.target.value)} />
                          </td>
                          <td className="py-1 pr-2">
                            <input className={`${inputCls} !py-1`} inputMode="decimal" value={m.consumo_kwh} onChange={(e) => setMes(i, j, 'consumo_kwh', e.target.value)} placeholder="0" />
                          </td>
                          <td className="py-1">
                            <input className={`${inputCls} !py-1`} inputMode="decimal" value={m.importe_eur} onChange={(e) => setMes(i, j, 'importe_eur', e.target.value)} placeholder="0,00" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Las dos ofertas */}
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border/40 bg-card/40 p-3 space-y-2">
                    <p className="text-xs font-bold">🔒 Oferta PRECIO FIJO · 12 meses</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className={labelCls}>€/kWh</label>
                        <input className={inputCls} inputMode="decimal" value={b.fijo_precio_kwh} onChange={(e) => setBloque(i, { fijo_precio_kwh: e.target.value })} placeholder="0,1390" /></div>
                      <div><label className={labelCls}>Fijo €/mes (opcional)</label>
                        <input className={inputCls} inputMode="decimal" value={b.fijo_termino_mes} onChange={(e) => setBloque(i, { fijo_termino_mes: e.target.value })} placeholder="0" /></div>
                    </div>
                    {r.fijoAnual != null && (
                      <p className="text-[11px]">
                        Coste anual estimado: <b>{eur(r.fijoAnual)}</b>
                        {r.ahorroFijo != null && (
                          <span className={r.ahorroFijo > 0 ? 'text-emerald-400 font-bold' : 'text-amber-300'}>
                            {' '}· {r.ahorroFijo > 0 ? `ahorra ${eur(r.ahorroFijo)}/año (${r.gastoAnual > 0 ? Math.round((r.ahorroFijo / r.gastoAnual) * 100) : 0}%)` : `${eur(-r.ahorroFijo)} más caro/año`}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl border border-border/40 bg-card/40 p-3 space-y-2">
                    <p className="text-xs font-bold">📈 Oferta INDEXADA</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className={labelCls}>€/kWh estimado</label>
                        <input className={inputCls} inputMode="decimal" value={b.index_precio_kwh} onChange={(e) => setBloque(i, { index_precio_kwh: e.target.value })} placeholder="0,1150" /></div>
                      <div><label className={labelCls}>Gestión €/mes (opcional)</label>
                        <input className={inputCls} inputMode="decimal" value={b.index_cuota_mes} onChange={(e) => setBloque(i, { index_cuota_mes: e.target.value })} placeholder="0" /></div>
                    </div>
                    {r.indexAnual != null && (
                      <p className="text-[11px]">
                        Coste anual estimado: <b>{eur(r.indexAnual)}</b>
                        {r.ahorroIndex != null && (
                          <span className={r.ahorroIndex > 0 ? 'text-emerald-400 font-bold' : 'text-amber-300'}>
                            {' '}· {r.ahorroIndex > 0 ? `ahorra ${eur(r.ahorroIndex)}/año (${r.gastoAnual > 0 ? Math.round((r.ahorroIndex / r.gastoAnual) * 100) : 0}%)` : `${eur(-r.ahorroIndex)} más caro/año`}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {r.n > 0 && (
                  <p className="text-[11px] text-muted">
                    📊 Con {r.n} mes{r.n === 1 ? '' : 'es'}: {kwh(r.consumo)} y {eur(r.gasto)} → proyección anual {kwh(r.consumoAnual)} · <b className="text-foreground">{eur(r.gastoAnual)}/año</b> · precio medio actual {r.precioMedio.toFixed(4).replace('.', ',')} €/kWh
                  </p>
                )}
              </Card>
            );
          })}

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setBloques((bs) => [...bs, cupsVacio(mesesMostrar)])} className={btnSecundario}>
              <Plus className="w-4 h-4" /> Añadir otro CUPS
            </button>
            <span className="flex-1" />
            {(hayFijo || hayIndex) && totActual > 0 && (
              <Badge tono="verde">
                Total: actual {eur(totActual)}/año{hayFijo ? ` · fijo ${eur(totFijo)}` : ''}{hayIndex ? ` · indexado ${eur(totIndex)}` : ''}
              </Badge>
            )}
            <button onClick={generarDocumento} className={btnSecundario}><Printer className="w-4 h-4" /> Documento para el cliente</button>
            <button onClick={guardarProyecto} disabled={guardando} className={btnPrimario}>
              <Save className="w-4 h-4" /> {guardando ? 'Guardando…' : 'Guardar proyecto'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
