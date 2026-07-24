'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { FileText, Plus, Trash2, Pencil, X, Printer, Save } from 'lucide-react';
import { LuzCliente, LuzCups, LuzProyecto, TARIFAS_ACCESO, fmtFecha } from '@/lib/luz';
import { Card, Badge, EstadoCarga, useListaLuz, guardarLuz, inputCls, labelCls, btnPrimario, btnSecundario } from '../ui';

/**
 * Automatizador de proyectos de ahorro de luz — cálculo POR PERIODOS.
 * Cada CUPS tiene sus periodos según la tarifa (P1-P3 en 2.0TD, P1-P6 en el resto).
 * Se meten los consumos por periodo de cada mes y, por periodo, tres precios
 * manuales en €/kWh: el actual, la oferta a precio fijo 12 meses y la indexada.
 * Calcula el ahorro y genera el documento profesional para el cliente.
 */

interface MesDato { mes: string; consumos: string[]; importe_eur: string }
interface CupsProyecto {
  cups_id: string;          // id en luz_cups o '' si se escribe a mano
  etiqueta: string;         // texto que ve el cliente (CUPS o alias)
  tarifa: string;
  meses: MesDato[];
  precios_actual: string[];     // €/kWh por periodo, situación actual
  precios_fijo: string[];       // €/kWh por periodo, oferta fija 12 meses
  precios_index: string[];      // €/kWh por periodo, oferta indexada (estimado)
  fijo_termino_mes: string;     // € fijos al mes en la oferta fija (opcional)
  index_cuota_mes: string;      // € gestión al mes en la indexada (opcional)
}
interface DatosProyecto { meses_mostrar: number; cups: CupsProyecto[] }

const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Nº de periodos de energía según la tarifa de acceso. */
const numPeriodos = (tarifa: string) => (tarifa === '2.0TD' || tarifa === 'otra' ? 3 : 6);

/** Tarifa base de las tablas de precios guardados ('2.0' | '3.0' | '6.1'). */
const tarifaBase = (tarifa: string) => (tarifa === '2.0TD' || tarifa === 'otra' ? '2.0' : tarifa === '3.0TD' ? '3.0' : '6.1');

interface TarifaGuardada { id: number; nombre: string; tarifa: string; precios_energia: number[] }

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
const num = (s: string) => { const v = parseFloat(String(s ?? '').replace(',', '.')); return isNaN(v) ? 0 : v; };
const eur = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const kwh = (v: number) => Math.round(v).toLocaleString('es-ES') + ' kWh';
const precio = (s: string) => (num(s) > 0 ? num(s).toFixed(4).replace('.', ',') : '—');

/** Ajusta un array de strings al tamaño pedido (rellena con ''). */
const ajustar = (arr: string[] | undefined, n: number) =>
  Array.from({ length: n }, (_, i) => arr?.[i] ?? '');

function cupsVacio(mesesMostrar: number, tarifa = '2.0TD'): CupsProyecto {
  const p = numPeriodos(tarifa);
  return {
    cups_id: '', etiqueta: '', tarifa,
    meses: ultimosMeses(mesesMostrar).map((mes) => ({ mes, consumos: Array(p).fill(''), importe_eur: '' })),
    precios_actual: Array(p).fill(''), precios_fijo: Array(p).fill(''), precios_index: Array(p).fill(''),
    fijo_termino_mes: '', index_cuota_mes: '',
  };
}

/** Compatibilidad con proyectos antiguos (consumo único sin periodos). */
function normalizar(b: Partial<CupsProyecto> & { meses?: (Partial<MesDato> & { consumo_kwh?: string })[] }, mesesMostrar: number): CupsProyecto {
  const tarifa = b.tarifa || '2.0TD';
  const p = numPeriodos(tarifa);
  const plantilla = ultimosMeses(mesesMostrar);
  const mesesPrevios = Array.isArray(b.meses) ? b.meses : [];
  const meses = (mesesPrevios.length ? mesesPrevios.map((m) => m.mes || '') : plantilla).map((mes, i) => {
    const prev = mesesPrevios[i];
    const consumos = ajustar(prev?.consumos, p);
    if (prev?.consumo_kwh && !consumos.some((c) => c !== '')) consumos[0] = prev.consumo_kwh; // dato antiguo → P1
    return { mes: mes || plantilla[i] || plantilla[0], consumos, importe_eur: prev?.importe_eur ?? '' };
  });
  return {
    cups_id: b.cups_id || '', etiqueta: b.etiqueta || '', tarifa,
    meses,
    precios_actual: ajustar(b.precios_actual, p),
    precios_fijo: ajustar(b.precios_fijo, p),
    precios_index: ajustar(b.precios_index, p),
    fijo_termino_mes: b.fijo_termino_mes || '', index_cuota_mes: b.index_cuota_mes || '',
  };
}

/** Cálculo de un CUPS por periodos: consumos, costes actuales y de las dos ofertas. */
function calcularCups(c: CupsProyecto) {
  const p = numPeriodos(c.tarifa);
  const filas = c.meses.filter((m) => m.consumos.some((x) => num(x) > 0) || num(m.importe_eur) > 0);
  const n = filas.length;
  const factor = n > 0 ? 12 / n : 0;

  // Consumo por periodo (suma de los meses) y anualizado
  const consumoP = Array.from({ length: p }, (_, i) => filas.reduce((s, m) => s + num(m.consumos[i]), 0));
  const consumoAnualP = consumoP.map((v) => v * factor);
  const consumo = consumoP.reduce((s, v) => s + v, 0);
  const consumoAnual = consumo * factor;

  const gastoFacturas = filas.reduce((s, m) => s + num(m.importe_eur), 0);
  const gastoFacturasAnual = gastoFacturas * factor;

  const coste = (precios: string[]) => consumoAnualP.reduce((s, v, i) => s + v * num(precios[i]), 0);
  const hayActual = c.precios_actual.some((x) => num(x) > 0);
  const hayFijo = c.precios_fijo.some((x) => num(x) > 0);
  const hayIndex = c.precios_index.some((x) => num(x) > 0);

  // Situación actual: con precios por periodo si están; si no, con los importes de factura
  const actualAnual = hayActual ? coste(c.precios_actual) : gastoFacturasAnual;
  const fijoAnual = hayFijo ? coste(c.precios_fijo) + num(c.fijo_termino_mes) * 12 : null;
  const indexAnual = hayIndex ? coste(c.precios_index) + num(c.index_cuota_mes) * 12 : null;

  return {
    p, n, factor, consumoP, consumoAnualP, consumo, consumoAnual,
    gastoFacturas, gastoFacturasAnual, hayActual,
    actualAnual,
    fijoAnual, ahorroFijo: fijoAnual != null ? actualAnual - fijoAnual : null,
    indexAnual, ahorroIndex: indexAnual != null ? actualAnual - indexAnual : null,
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

  // Precios guardados en Tarifas y Comparador: se cargan aquí con un clic
  const [tarifasGuardadas, setTarifasGuardadas] = useState<TarifaGuardada[]>([]);
  useEffect(() => {
    supabase.from('precios_comercializadoras').select('id, tarifa, precios_energia, comercializadoras(nombre)')
      .then(({ data }) => {
        setTarifasGuardadas(((data as unknown as { id: number; tarifa: string; precios_energia: number[]; comercializadoras?: { nombre: string } | null }[]) || [])
          .filter((r) => Array.isArray(r.precios_energia))
          .map((r) => ({ id: r.id, tarifa: r.tarifa, precios_energia: r.precios_energia, nombre: r.comercializadoras?.nombre || 'Comercializadora' })));
      });
  }, []);

  /** Rellenar los precios de una oferta con una tarifa guardada. */
  function cargarTarifaGuardada(i: number, lista: 'precios_fijo' | 'precios_index', idTarifa: string) {
    const t = tarifasGuardadas.find((x) => String(x.id) === idTarifa);
    if (!t) return;
    const p = numPeriodos(bloques[i].tarifa);
    setBloques((bs) => bs.map((b, k) => k !== i ? b : {
      ...b,
      [lista]: Array.from({ length: p }, (_, q) => (t.precios_energia[q] != null ? String(t.precios_energia[q]) : '')),
    }));
  }

  function nuevoProyecto() {
    setProyectoId(null); setClienteId(''); setTitulo(''); setMesesMostrar(6);
    setBloques([cupsVacio(6)]); setMsg(''); setEditando(true);
  }

  function abrirProyecto(pr: LuzProyecto) {
    const d = pr.datos as unknown as DatosProyecto;
    const mm = d.meses_mostrar || 6;
    setProyectoId(pr.id);
    setClienteId(pr.cliente_id || '');
    setTitulo(pr.titulo);
    setMesesMostrar(mm);
    setBloques(Array.isArray(d.cups) && d.cups.length ? d.cups.map((b) => normalizar(b, mm)) : [cupsVacio(mm)]);
    setMsg(''); setEditando(true);
  }

  /** Cambiar cuántos meses aparecen: recorta o añade filas en todos los CUPS. */
  function cambiarMeses(n: number) {
    const nn = Math.min(12, Math.max(1, n));
    setMesesMostrar(nn);
    const plantilla = ultimosMeses(nn);
    setBloques((bs) => bs.map((b) => ({
      ...b,
      meses: plantilla.map((mes) => b.meses.find((m) => m.mes === mes) || { mes, consumos: Array(numPeriodos(b.tarifa)).fill(''), importe_eur: '' }),
    })));
  }

  const setBloque = (i: number, cambios: Partial<CupsProyecto>) =>
    setBloques((bs) => bs.map((b, j) => (j === i ? { ...b, ...cambios } : b)));

  /** Cambiar la tarifa reajusta el nº de periodos en consumos y precios. */
  function cambiarTarifa(i: number, tarifa: string) {
    setBloques((bs) => bs.map((b, j) => {
      if (j !== i) return b;
      const p = numPeriodos(tarifa);
      return {
        ...b, tarifa,
        meses: b.meses.map((m) => ({ ...m, consumos: ajustar(m.consumos, p) })),
        precios_actual: ajustar(b.precios_actual, p),
        precios_fijo: ajustar(b.precios_fijo, p),
        precios_index: ajustar(b.precios_index, p),
      };
    }));
  }

  const setConsumo = (i: number, j: number, per: number, valor: string) =>
    setBloques((bs) => bs.map((b, k) => k !== i ? b : {
      ...b,
      meses: b.meses.map((m, l) => (l === j ? { ...m, consumos: m.consumos.map((c, q) => (q === per ? valor : c)) } : m)),
    }));
  const setMesCampo = (i: number, j: number, campo: 'mes' | 'importe_eur', valor: string) =>
    setBloques((bs) => bs.map((b, k) => k !== i ? b : { ...b, meses: b.meses.map((m, l) => (l === j ? { ...m, [campo]: valor } : m)) }));
  const setPrecio = (i: number, lista: 'precios_actual' | 'precios_fijo' | 'precios_index', per: number, valor: string) =>
    setBloques((bs) => bs.map((b, k) => k !== i ? b : { ...b, [lista]: b[lista].map((v, q) => (q === per ? valor : v)) }));

  /** Al elegir un CUPS del cliente, se rellena la etiqueta y la tarifa. */
  function elegirCups(i: number, id: string) {
    const s = cupsDelCliente.find((c) => c.id === id);
    if (s?.tarifa_acceso && s.tarifa_acceso !== bloques[i].tarifa) cambiarTarifa(i, s.tarifa_acceso);
    setBloque(i, {
      cups_id: id,
      etiqueta: s ? (s.alias_suministro ? `${s.alias_suministro} · ${s.cups}` : s.cups) : bloques[i].etiqueta,
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
    const conDatos = bloques.filter((b) => b.etiqueta.trim() || b.meses.some((m) => m.consumos.some((x) => num(x) > 0)));
    if (conDatos.length === 0) { setMsg('Rellena al menos un CUPS con datos para generar el documento.'); return; }

    let totalActual = 0, totalFijo = 0, totalIndex = 0, docFijo = false, docIndex = false;

    const secciones = conDatos.map((b, idx) => {
      const r = calcularCups(b);
      totalActual += r.actualAnual;
      if (r.fijoAnual != null) { totalFijo += r.fijoAnual; docFijo = true; }
      if (r.indexAnual != null) { totalIndex += r.indexAnual; docIndex = true; }
      const pers = Array.from({ length: r.p }, (_, i) => i);

      // Tabla de consumos por mes y periodo
      const cabPeriodos = pers.map((i) => `<th class="num">P${i + 1}</th>`).join('');
      const filasMeses = b.meses
        .filter((m) => m.consumos.some((x) => num(x) > 0) || num(m.importe_eur) > 0)
        .map((m) => `<tr><td>${nombreMes(m.mes)}</td>${pers.map((i) => `<td class="num">${num(m.consumos[i]) > 0 ? Math.round(num(m.consumos[i])).toLocaleString('es-ES') : '—'}</td>`).join('')}<td class="num">${num(m.importe_eur) > 0 ? eur(num(m.importe_eur)) : '—'}</td></tr>`)
        .join('');
      const totPeriodos = pers.map((i) => `<td class="num">${Math.round(r.consumoP[i]).toLocaleString('es-ES')}</td>`).join('');

      // Tabla de precios por periodo
      const filasPrecios = pers.map((i) => `<tr>
        <td><b>P${i + 1}</b></td>
        <td class="num">${kwh(r.consumoAnualP[i])}</td>
        <td class="num">${precio(b.precios_actual[i])}</td>
        <td class="num">${precio(b.precios_fijo[i])}</td>
        <td class="num">${precio(b.precios_index[i])}</td>
      </tr>`).join('');

      const tarjeta = (nombre: string, sub: string, coste: number | null, ahorro: number | null) => coste == null ? '' : `
        <div class="oferta">
          <p class="of-nombre">${nombre}</p>
          <p class="of-sub">${sub}</p>
          <p class="of-coste">${eur(coste)} <span>/año estimado</span></p>
          ${ahorro != null && ahorro > 0 ? `<p class="of-ahorro">Ahorro estimado: <b>${eur(ahorro)}</b> al año (${r.actualAnual > 0 ? Math.round((ahorro / r.actualAnual) * 100) : 0}%)</p>` : ahorro != null ? `<p class="of-igual">Coste similar al actual</p>` : ''}
        </div>`;

      return `
<h2>Suministro ${idx + 1} · ${b.etiqueta || 'CUPS'} <span class="tarifa">Tarifa ${b.tarifa} · ${r.p} periodos</span></h2>
<table>
  <thead><tr><th>Mes</th>${cabPeriodos}<th class="num">Importe factura</th></tr></thead>
  <tbody>${filasMeses}</tbody>
  <tfoot><tr class="suma"><td>Total ${r.n} mes${r.n === 1 ? '' : 'es'} (kWh)</td>${totPeriodos}<td class="num">${r.gastoFacturas > 0 ? eur(r.gastoFacturas) : '—'}</td></tr></tfoot>
</table>
<h2 style="margin-top:1.2rem">Precios por periodo (€/kWh)</h2>
<table>
  <thead><tr><th>Periodo</th><th class="num">Consumo anual</th><th class="num">Precio actual</th><th class="num">🔒 Oferta fija 12 m</th><th class="num">📈 Oferta indexada*</th></tr></thead>
  <tbody>${filasPrecios}</tbody>
</table>
<p class="anual">📊 Proyección anual: <b>${kwh(r.consumoAnual)}</b> → coste actual estimado <b>${eur(r.actualAnual)}</b>/año${!r.hayActual && r.gastoFacturas > 0 ? ' (según los importes de sus facturas)' : ''}.</p>
<div class="ofertas">
  ${tarjeta('🔒 Oferta PRECIO FIJO · 12 meses', `Precios por periodo de la tabla${num(b.fijo_termino_mes) > 0 ? ` + ${eur(num(b.fijo_termino_mes))}/mes` : ''} — mismo precio todo el año, sin sustos`, r.fijoAnual, r.ahorroFijo)}
  ${tarjeta('📈 Oferta INDEXADA', `Precios estimados por periodo${num(b.index_cuota_mes) > 0 ? ` + ${eur(num(b.index_cuota_mes))}/mes de gestión` : ''} — sigue el precio del mercado`, r.indexAnual, r.ahorroIndex)}
</div>`;
    }).join('');

    const resumen = conDatos.length > 1 ? `
<h2>Resumen del proyecto (${conDatos.length} suministros)</h2>
<table>
  <thead><tr><th>Escenario</th><th class="num">Coste anual estimado</th><th class="num">Ahorro anual</th></tr></thead>
  <tbody>
    <tr><td>Situación actual</td><td class="num">${eur(totalActual)}</td><td class="num">—</td></tr>
    ${docFijo ? `<tr><td>🔒 Con oferta a precio fijo</td><td class="num">${eur(totalFijo)}</td><td class="num"><b>${eur(totalActual - totalFijo)}</b></td></tr>` : ''}
    ${docIndex ? `<tr><td>📈 Con oferta indexada</td><td class="num">${eur(totalIndex)}</td><td class="num"><b>${eur(totalActual - totalIndex)}</b></td></tr>` : ''}
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
  td,th{padding:.45rem .7rem;text-align:left;font-size:.86rem}
  thead th{background:var(--oscuro);color:#fff;font-size:.68rem;letter-spacing:.1em;text-transform:uppercase}
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
  <li><b>Precio fijo 12 meses:</b> los precios por periodo se mantienen durante todo el año, pase lo que pase en el mercado.</li>
  <li><b>* Indexado:</b> el precio sigue el mercado mayorista (OMIE) hora a hora; los precios por periodo indicados son una estimación con el mercado actual y pueden variar al alza o a la baja.</li>
  <li>Proyección calculada a partir de los consumos reales por periodo facilitados por el cliente, extrapolados a 12 meses.</li>
  <li>La comparativa es orientativa hasta la oferta en firme de la comercializadora; no incluye variaciones de potencia contratada ni conceptos regulados ajenos a la energía.</li>
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
  const totActual = resultados.reduce((s, r) => s + r.actualAnual, 0);
  const totFijo = resultados.reduce((s, r) => s + (r.fijoAnual ?? 0), 0);
  const totIndex = resultados.reduce((s, r) => s + (r.indexAnual ?? 0), 0);
  const hayFijo = resultados.some((r) => r.fijoAnual != null);
  const hayIndex = resultados.some((r) => r.indexAnual != null);

  const cargando = clientes.cargando || proyectos.cargando;
  const inputMini = 'w-full rounded-md border border-border/40 bg-background/70 px-1.5 py-1 text-xs text-right tabular-nums';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2"><FileText className="w-5 h-5 text-accent" /> Automatizador de proyectos</h2>
          <p className="text-xs text-muted mt-0.5">
            Consumos por periodo de cada mes y precios €/kWh por periodo (actual, fijo 12 meses e indexado).
            2.0TD usa P1-P3; 3.0TD y 6.XTD usan P1-P6. Genera el documento listo para el cliente.
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
            const pers = Array.from({ length: r.p }, (_, q) => q);
            return (
              <Card key={i} className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="font-bold text-sm">🔌 Suministro {i + 1} <span className="text-muted font-semibold">· {r.p} periodos</span></h3>
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
                    <label className={labelCls}>Tarifa (marca los periodos)</label>
                    <select className={inputCls} value={b.tarifa} onChange={(e) => cambiarTarifa(i, e.target.value)}>
                      {TARIFAS_ACCESO.map((t) => <option key={t} value={t}>{t} · {numPeriodos(t)} periodos</option>)}
                    </select>
                  </div>
                </div>

                {/* Consumos por mes y periodo */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[560px]">
                    <thead>
                      <tr className="text-left text-[10px] uppercase text-muted border-b border-border/40">
                        <th className="py-1.5 pr-2 min-w-36">Mes</th>
                        {pers.map((q) => <th key={q} className="py-1.5 pr-2 text-right">P{q + 1} (kWh)</th>)}
                        <th className="py-1.5 text-right">Importe factura € <span className="normal-case font-normal">(opcional)</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.meses.map((m, j) => (
                        <tr key={j} className="border-b border-border/15">
                          <td className="py-1 pr-2">
                            <input className={`${inputCls} !py-1`} type="month" value={m.mes} onChange={(e) => setMesCampo(i, j, 'mes', e.target.value)} />
                          </td>
                          {pers.map((q) => (
                            <td key={q} className="py-1 pr-2">
                              <input className={inputMini} inputMode="decimal" value={m.consumos[q] ?? ''} onChange={(e) => setConsumo(i, j, q, e.target.value)} placeholder="0" />
                            </td>
                          ))}
                          <td className="py-1">
                            <input className={inputMini} inputMode="decimal" value={m.importe_eur} onChange={(e) => setMesCampo(i, j, 'importe_eur', e.target.value)} placeholder="0,00" />
                          </td>
                        </tr>
                      ))}
                      {r.n > 0 && (
                        <tr className="font-bold">
                          <td className="py-1.5 pr-2 text-[10px] uppercase text-muted">Total</td>
                          {pers.map((q) => <td key={q} className="py-1.5 pr-2 text-right tabular-nums">{Math.round(r.consumoP[q]).toLocaleString('es-ES')}</td>)}
                          <td className="py-1.5 text-right tabular-nums">{r.gastoFacturas > 0 ? eur(r.gastoFacturas) : '—'}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Precios €/kWh por periodo: actual, fijo, indexado */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[560px]">
                    <thead>
                      <tr className="text-left text-[10px] uppercase text-muted border-b border-border/40">
                        <th className="py-1.5 pr-2">Precios €/kWh</th>
                        {pers.map((q) => <th key={q} className="py-1.5 pr-2 text-right">P{q + 1}</th>)}
                        <th className="py-1.5 text-right">Fijo €/mes</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/15">
                        <td className="py-1 pr-2 font-bold">Actual</td>
                        {pers.map((q) => (
                          <td key={q} className="py-1 pr-2">
                            <input className={inputMini} inputMode="decimal" value={b.precios_actual[q] ?? ''} onChange={(e) => setPrecio(i, 'precios_actual', q, e.target.value)} placeholder="0,0000" />
                          </td>
                        ))}
                        <td className="py-1 text-right text-[10px] text-muted">—</td>
                      </tr>
                      <tr className="border-b border-border/15">
                        <td className="py-1 pr-2 font-bold">
                          🔒 Oferta fija 12 m
                          {tarifasGuardadas.some((t) => t.tarifa === tarifaBase(b.tarifa)) && (
                            <select
                              className="block mt-0.5 w-full max-w-40 rounded-md border border-border/40 bg-background/70 px-1 py-0.5 text-[10px] text-muted"
                              value=""
                              onChange={(e) => { if (e.target.value) cargarTarifaGuardada(i, 'precios_fijo', e.target.value); }}
                              title="Rellena los precios por periodo con una tarifa guardada en Tarifas y Comparador"
                            >
                              <option value="">⚡ Cargar comercializadora…</option>
                              {tarifasGuardadas.filter((t) => t.tarifa === tarifaBase(b.tarifa)).map((t) => (
                                <option key={t.id} value={t.id}>{t.nombre} · {t.tarifa}TD</option>
                              ))}
                            </select>
                          )}
                        </td>
                        {pers.map((q) => (
                          <td key={q} className="py-1 pr-2">
                            <input className={inputMini} inputMode="decimal" value={b.precios_fijo[q] ?? ''} onChange={(e) => setPrecio(i, 'precios_fijo', q, e.target.value)} placeholder="0,0000" />
                          </td>
                        ))}
                        <td className="py-1">
                          <input className={inputMini} inputMode="decimal" value={b.fijo_termino_mes} onChange={(e) => setBloque(i, { fijo_termino_mes: e.target.value })} placeholder="0" />
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 pr-2 font-bold">
                          📈 Oferta indexada
                          {tarifasGuardadas.some((t) => t.tarifa === tarifaBase(b.tarifa)) && (
                            <select
                              className="block mt-0.5 w-full max-w-40 rounded-md border border-border/40 bg-background/70 px-1 py-0.5 text-[10px] text-muted"
                              value=""
                              onChange={(e) => { if (e.target.value) cargarTarifaGuardada(i, 'precios_index', e.target.value); }}
                              title="Rellena los precios por periodo con una tarifa guardada en Tarifas y Comparador"
                            >
                              <option value="">⚡ Cargar comercializadora…</option>
                              {tarifasGuardadas.filter((t) => t.tarifa === tarifaBase(b.tarifa)).map((t) => (
                                <option key={t.id} value={t.id}>{t.nombre} · {t.tarifa}TD</option>
                              ))}
                            </select>
                          )}
                        </td>
                        {pers.map((q) => (
                          <td key={q} className="py-1 pr-2">
                            <input className={inputMini} inputMode="decimal" value={b.precios_index[q] ?? ''} onChange={(e) => setPrecio(i, 'precios_index', q, e.target.value)} placeholder="0,0000" />
                          </td>
                        ))}
                        <td className="py-1">
                          <input className={inputMini} inputMode="decimal" value={b.index_cuota_mes} onChange={(e) => setBloque(i, { index_cuota_mes: e.target.value })} placeholder="0" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-[10px] text-muted mt-1">Si no rellenas los precios «Actual», la situación actual se calcula con los importes de factura. La fila indexada admite una cuota de gestión en «Fijo €/mes».</p>
                </div>

                {/* Resultado del CUPS */}
                {r.n > 0 && (
                  <div className="rounded-xl border border-border/40 bg-card/40 p-3 text-[11px] space-y-1">
                    <p>📊 Proyección anual: <b>{kwh(r.consumoAnual)}</b> · situación actual <b className="text-foreground">{eur(r.actualAnual)}/año</b>{!r.hayActual && r.gastoFacturas > 0 ? ' (según importes de factura)' : ''}</p>
                    {r.fijoAnual != null && (
                      <p>🔒 Fija 12 m: <b>{eur(r.fijoAnual)}/año</b>
                        {r.ahorroFijo != null && (
                          <span className={r.ahorroFijo > 0 ? 'text-emerald-400 font-bold' : 'text-amber-300'}>
                            {' '}· {r.ahorroFijo > 0 ? `ahorra ${eur(r.ahorroFijo)} (${r.actualAnual > 0 ? Math.round((r.ahorroFijo / r.actualAnual) * 100) : 0}%)` : `${eur(-r.ahorroFijo)} más caro`}
                          </span>
                        )}
                      </p>
                    )}
                    {r.indexAnual != null && (
                      <p>📈 Indexada: <b>{eur(r.indexAnual)}/año</b>
                        {r.ahorroIndex != null && (
                          <span className={r.ahorroIndex > 0 ? 'text-emerald-400 font-bold' : 'text-amber-300'}>
                            {' '}· {r.ahorroIndex > 0 ? `ahorra ${eur(r.ahorroIndex)} (${r.actualAnual > 0 ? Math.round((r.ahorroIndex / r.actualAnual) * 100) : 0}%)` : `${eur(-r.ahorroIndex)} más caro`}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
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
