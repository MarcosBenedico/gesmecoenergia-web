'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Plus, Pencil, X, Trash2, Calculator, FileSpreadsheet, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  TARIFA_INFO, TarifaAcceso, compararConComercializadoras, ResultadoComparativa,
} from '@/lib/tarifas';
import { Card, Badge, inputCls, labelCls, btnPrimario, btnSecundario } from '../ui';

/**
 * Tarifas y Comparador (dentro de Gestión Luz).
 * - Ver tarifas: precios guardados por comercializadora y tarifa, editables.
 * - Nueva tarifa: alta de precios (energía y potencia por periodo).
 * - Comparativa: simulador de élite — coste actual vs todas las comercializadoras,
 *   con la banda de ahorro 20-30% para el cliente y la comisión interna.
 * Conectado con Proyectos de ahorro: allí se cargan estos precios con un clic.
 */

interface Comercializadora { id: number; nombre: string }
interface PrecioGuardado {
  id: number;
  comercializadora_id: number;
  tarifa: TarifaAcceso;
  precios_energia: number[];
  precios_potencia: number[];
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  comercializadoras?: { nombre: string } | null;
}

/** Estado de vigencia de una oferta de precios. */
function vigencia(p: { fecha_inicio?: string | null; fecha_fin?: string | null }) {
  const hoy = new Date().toISOString().slice(0, 10);
  if (p.fecha_inicio && p.fecha_inicio > hoy) return 'futura' as const;
  if (p.fecha_fin && p.fecha_fin < hoy) return 'caducada' as const;
  return 'vigente' as const;
}
const fmtF = (f?: string | null) => (f ? f.split('-').reverse().join('/') : '');
const textoVigencia = (p: { fecha_inicio?: string | null; fecha_fin?: string | null }) =>
  p.fecha_inicio || p.fecha_fin
    ? `${fmtF(p.fecha_inicio) || '…'} → ${fmtF(p.fecha_fin) || 'sin fin'}`
    : 'Sin fechas (siempre válida)';

const eur = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const p4 = (v: number) => (Number(v) || 0).toFixed(4).replace('.', ',');
const num = (s: string) => { const v = parseFloat(String(s).replace(',', '.')); return isNaN(v) ? 0 : v; };

function nPeriodos(t: TarifaAcceso) {
  return { e: TARIFA_INFO[t].periodosEnergia.length, p: TARIFA_INFO[t].periodosPotencia.length };
}

export default function TarifasLuzPage() {
  const [pestana, setPestana] = useState<'ver' | 'crear' | 'comparar'>('ver');
  const [comercios, setComercios] = useState<Comercializadora[]>([]);
  const [precios, setPrecios] = useState<PrecioGuardado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [msg, setMsg] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [c, p] = await Promise.all([
        supabase.from('comercializadoras').select('*').order('nombre'),
        supabase.from('precios_comercializadoras').select('*, comercializadoras(nombre)').order('tarifa'),
      ]);
      setComercios((c.data as Comercializadora[]) || []);
      setPrecios((p.data as PrecioGuardado[]) || []);
      if (c.error || p.error) setMsg((c.error || p.error)!.message);
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  // ── Ver / editar ──
  const [fTarifa, setFTarifa] = useState<'' | TarifaAcceso>('');
  const [editando, setEditando] = useState<PrecioGuardado | null>(null);
  const [formE, setFormE] = useState<{ energia: string[]; potencia: string[]; fecha_inicio: string; fecha_fin: string }>({ energia: [], potencia: [], fecha_inicio: '', fecha_fin: '' });
  const [verCaducadas, setVerCaducadas] = useState(false);

  const visibles = useMemo(
    () => precios
      .filter((p) => !fTarifa || p.tarifa === fTarifa)
      .filter((p) => verCaducadas || vigencia(p) !== 'caducada')
      .sort((a, b) =>
        (a.comercializadoras?.nombre || '').localeCompare(b.comercializadoras?.nombre || '')
        || a.tarifa.localeCompare(b.tarifa)
        || (a.fecha_inicio || '').localeCompare(b.fecha_inicio || '')),
    [precios, fTarifa, verCaducadas]
  );
  const nCaducadas = useMemo(() => precios.filter((p) => (!fTarifa || p.tarifa === fTarifa) && vigencia(p) === 'caducada').length, [precios, fTarifa]);

  function abrirEdicion(p: PrecioGuardado) {
    setEditando(p);
    setFormE({ energia: p.precios_energia.map(String), potencia: p.precios_potencia.map(String), fecha_inicio: p.fecha_inicio || '', fecha_fin: p.fecha_fin || '' });
  }

  const avisoColumnas = (m: string) =>
    /fecha_inicio|fecha_fin|column/i.test(m)
      ? 'Faltan las columnas de fechas: ejecuta supabase_tarifas_fechas.sql en el SQL Editor de Supabase.'
      : m;

  async function guardarEdicion() {
    if (!editando) return;
    const { error } = await supabase.from('precios_comercializadoras').update({
      precios_energia: formE.energia.map(num),
      precios_potencia: formE.potencia.map(num),
      fecha_inicio: formE.fecha_inicio || null,
      fecha_fin: formE.fecha_fin || null,
    }).eq('id', editando.id);
    if (error) { setMsg(avisoColumnas(error.message)); return; }
    setMsg('✅ Precios actualizados.');
    setEditando(null);
    cargar();
  }

  async function borrarPrecio(p: PrecioGuardado) {
    if (!confirm(`¿Eliminar la tarifa ${p.tarifa} de ${p.comercializadoras?.nombre}?`)) return;
    const { error } = await supabase.from('precios_comercializadoras').delete().eq('id', p.id);
    if (error) { setMsg(error.message); return; }
    cargar();
  }

  // ── Crear ──
  const [formC, setFormC] = useState({ comercializadora_id: '', nueva: '', tarifa: '2.0' as TarifaAcceso, energia: ['', '', ''], potencia: ['', ''], fecha_inicio: '', fecha_fin: '' });

  function cambiarTarifaCrear(t: TarifaAcceso) {
    const n = nPeriodos(t);
    setFormC((f) => ({ ...f, tarifa: t, energia: Array(n.e).fill(''), potencia: Array(n.p).fill('') }));
  }

  async function crearTarifa(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    let comercializadoraId = parseInt(formC.comercializadora_id) || 0;
    // Comercializadora nueva escrita a mano → se crea primero
    if (!comercializadoraId && formC.nueva.trim()) {
      const { data, error } = await supabase.from('comercializadoras').insert({ nombre: formC.nueva.trim() }).select('id').single();
      if (error) { setMsg(error.message); return; }
      comercializadoraId = data.id;
    }
    if (!comercializadoraId) { setMsg('Elige una comercializadora o escribe una nueva.'); return; }
    if (!formC.energia.some((x) => num(x) > 0)) { setMsg('Rellena al menos un precio de energía.'); return; }
    const base = {
      comercializadora_id: comercializadoraId,
      tarifa: formC.tarifa,
      precios_energia: formC.energia.map(num),
      precios_potencia: formC.potencia.map(num),
    };
    let { error } = await supabase.from('precios_comercializadoras').insert({
      ...base,
      fecha_inicio: formC.fecha_inicio || null,
      fecha_fin: formC.fecha_fin || null,
    });
    // Compatibilidad: si aún no existen las columnas de fechas, se guarda sin ellas y se avisa
    let sinFechas = false;
    if (error && /fecha_inicio|fecha_fin|column/i.test(error.message)) {
      ({ error } = await supabase.from('precios_comercializadoras').insert(base));
      sinFechas = !error;
    }
    if (error) { setMsg(avisoColumnas(error.message)); return; }
    setMsg(sinFechas
      ? '⚠️ Guardada SIN fechas: ejecuta supabase_tarifas_fechas.sql en Supabase para activar la vigencia.'
      : '✅ Tarifa creada.');
    setFormC({ comercializadora_id: '', nueva: '', tarifa: '2.0', energia: ['', '', ''], potencia: ['', ''], fecha_inicio: '', fecha_fin: '' });
    cargar();
    setPestana('ver');
  }

  // ── Comparativa ──
  const [simTarifa, setSimTarifa] = useState<TarifaAcceso>('2.0');
  const [simConsumos, setSimConsumos] = useState<string[]>(['', '', '']);
  const [simPotencias, setSimPotencias] = useState<string[]>(['', '']);
  const [simPreciosE, setSimPreciosE] = useState<string[]>(['', '', '']);
  const [simPreciosP, setSimPreciosP] = useState<string[]>(['', '']);
  const [simulando, setSimulando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoComparativa | null>(null);

  function cambiarTarifaSim(t: TarifaAcceso) {
    const n = nPeriodos(t);
    setSimTarifa(t);
    setSimConsumos(Array(n.e).fill(''));
    setSimPreciosE(Array(n.e).fill(''));
    setSimPotencias(Array(n.p).fill(''));
    setSimPreciosP(Array(n.p).fill(''));
    setResultado(null);
  }

  async function simular() {
    setSimulando(true); setMsg('');
    try {
      const r = await compararConComercializadoras({
        tarifa: simTarifa,
        consumosMes: simConsumos.map(num),
        potencias: simPotencias.map(num),
        preciosEnergia: simPreciosE.map(num),
        preciosPotencia: simPreciosP.map(num),
      });
      setResultado(r);
    } finally {
      setSimulando(false);
    }
  }

  const tabCls = (activa: boolean) =>
    `inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
      activa ? 'bg-accent text-white' : 'bg-card/70 text-muted border border-border/50 hover:text-foreground'
    }`;
  const filaInputs = (valores: string[], setter: (v: string[]) => void, etiquetas: string[]) => (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
      {valores.map((v, i) => (
        <div key={i}>
          <label className="block text-[10px] font-bold text-muted uppercase mb-1">{etiquetas[i] || `P${i + 1}`}</label>
          <input className={`${inputCls} !py-1.5 text-right tabular-nums`} inputMode="decimal" value={v} placeholder="0,0000"
            onChange={(e) => setter(valores.map((x, j) => (j === i ? e.target.value : x)))} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2"><TrendingUp className="w-5 h-5 text-accent" /> Tarifas y Comparador</h2>
          <p className="text-xs text-muted mt-0.5">
            Precios de las comercializadoras por tarifa y periodo, y el simulador con fee y comisión.
            Estos precios se cargan con un clic en los <Link href="/gestor/luz/proyectos" className="text-accent hover:underline">Proyectos de ahorro</Link>.
          </p>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setPestana('ver')} className={tabCls(pestana === 'ver')}><FileSpreadsheet className="w-3.5 h-3.5" /> Ver tarifas</button>
          <button onClick={() => setPestana('crear')} className={tabCls(pestana === 'crear')}><Plus className="w-3.5 h-3.5" /> Nueva tarifa</button>
          <button onClick={() => setPestana('comparar')} className={tabCls(pestana === 'comparar')}><Calculator className="w-3.5 h-3.5" /> Comparativa</button>
        </div>
      </div>

      {msg && <p className={`text-xs rounded-lg p-2.5 border ${msg.startsWith('✅') ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-red-400 bg-red-500/10 border-red-500/30'}`}>{msg}</p>}

      {/* ══ VER TARIFAS ══ */}
      {pestana === 'ver' && (
        <>
          <div className="flex gap-1.5 flex-wrap items-center">
            {(['', '2.0', '3.0', '6.1'] as const).map((t) => (
              <button key={t || 'todas'} onClick={() => setFTarifa(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${fTarifa === t ? 'bg-accent text-white' : 'bg-card/70 text-muted border border-border/50'}`}>
                {t ? `${t}TD` : 'Todas'}
              </button>
            ))}
            {nCaducadas > 0 && (
              <button onClick={() => setVerCaducadas((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${verCaducadas ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-card/70 text-muted border-border/50'}`}>
                {verCaducadas ? 'Ocultar caducadas' : `Ver caducadas (${nCaducadas})`}
              </button>
            )}
          </div>

          {cargando ? (
            <Card><p className="text-sm text-muted text-center py-4">Cargando tarifas…</p></Card>
          ) : visibles.length === 0 ? (
            <Card><p className="text-sm text-muted text-center py-6">No hay tarifas guardadas{fTarifa ? ` para ${fTarifa}TD` : ''}. Crea la primera en «Nueva tarifa».</p></Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {visibles.map((p) => {
                const info = TARIFA_INFO[p.tarifa];
                const editandoEste = editando?.id === p.id;
                return (
                  <Card key={p.id} className="!p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm">{p.comercializadoras?.nombre || 'Comercializadora'}</span>
                        <Badge tono="accent">{p.tarifa}TD</Badge>
                        {(() => {
                          const v = vigencia(p);
                          return (
                            <Badge tono={v === 'vigente' ? 'verde' : v === 'futura' ? 'ambar' : 'rojo'}>
                              {v === 'vigente' ? '✓ Vigente' : v === 'futura' ? '⏳ Empieza pronto' : '✕ Caducada'} · {textoVigencia(p)}
                            </Badge>
                          );
                        })()}
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => (editandoEste ? setEditando(null) : abrirEdicion(p))} className="text-muted hover:text-accent" title="Editar precios"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => borrarPrecio(p)} className="text-muted hover:text-red-400" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>

                    {editandoEste ? (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-muted uppercase">Energía €/kWh</p>
                        {filaInputs(formE.energia, (v) => setFormE((f) => ({ ...f, energia: v })), info.periodosEnergia)}
                        <p className="text-[10px] font-bold text-muted uppercase">Potencia €/kW·día</p>
                        {filaInputs(formE.potencia, (v) => setFormE((f) => ({ ...f, potencia: v })), info.periodosPotencia)}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-muted uppercase mb-1">Válida desde</label>
                            <input className={`${inputCls} !py-1.5`} type="date" value={formE.fecha_inicio} onChange={(e) => setFormE((f) => ({ ...f, fecha_inicio: e.target.value }))} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-muted uppercase mb-1">Válida hasta</label>
                            <input className={`${inputCls} !py-1.5`} type="date" value={formE.fecha_fin} onChange={(e) => setFormE((f) => ({ ...f, fecha_fin: e.target.value }))} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={guardarEdicion} className={btnPrimario}>Guardar</button>
                          <button onClick={() => setEditando(null)} className={btnSecundario}><X className="w-3.5 h-3.5" /> Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5 text-xs">
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          <span className="text-[10px] font-bold text-muted uppercase w-full">Energía €/kWh</span>
                          {p.precios_energia.map((v, i) => (
                            <span key={i} className="tabular-nums"><b className="text-muted font-bold text-[10px]">{info.periodosEnergia[i]?.split(' ')[0] || `P${i + 1}`}</b> {p4(v)}</span>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          <span className="text-[10px] font-bold text-muted uppercase w-full">Potencia €/kW·día</span>
                          {p.precios_potencia.map((v, i) => (
                            <span key={i} className="tabular-nums"><b className="text-muted font-bold text-[10px]">{info.periodosPotencia[i]?.split(' ')[0] || `P${i + 1}`}</b> {p4(v)}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ══ NUEVA TARIFA ══ */}
      {pestana === 'crear' && (
        <Card>
          <form onSubmit={crearTarifa} className="space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Comercializadora</label>
                <select className={inputCls} value={formC.comercializadora_id}
                  onChange={(e) => setFormC({ ...formC, comercializadora_id: e.target.value, nueva: '' })}>
                  <option value="">— Elegir —</option>
                  {comercios.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>…o comercializadora nueva</label>
                <input className={inputCls} value={formC.nueva} placeholder="Nombre (se crea al guardar)"
                  onChange={(e) => setFormC({ ...formC, nueva: e.target.value, comercializadora_id: '' })} />
              </div>
              <div>
                <label className={labelCls}>Tarifa de acceso</label>
                <select className={inputCls} value={formC.tarifa} onChange={(e) => cambiarTarifaCrear(e.target.value as TarifaAcceso)}>
                  {(['2.0', '3.0', '6.1'] as const).map((t) => <option key={t} value={t}>{TARIFA_INFO[t].nombre} — {TARIFA_INFO[t].descripcion}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Válida desde (opcional)</label>
                <input className={inputCls} type="date" value={formC.fecha_inicio} onChange={(e) => setFormC({ ...formC, fecha_inicio: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Válida hasta (opcional)</label>
                <input className={inputCls} type="date" value={formC.fecha_fin} onChange={(e) => setFormC({ ...formC, fecha_fin: e.target.value })} />
              </div>
              <p className="text-[11px] text-muted self-end pb-1">
                Sin fechas = siempre válida. Puedes tener varias ofertas de la misma comercializadora y tarifa con periodos distintos.
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted uppercase mb-1.5">Energía €/kWh</p>
              {filaInputs(formC.energia, (v) => setFormC((f) => ({ ...f, energia: v })), TARIFA_INFO[formC.tarifa].periodosEnergia)}
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted uppercase mb-1.5">Potencia €/kW·día</p>
              {filaInputs(formC.potencia, (v) => setFormC((f) => ({ ...f, potencia: v })), TARIFA_INFO[formC.tarifa].periodosPotencia)}
            </div>
            <button type="submit" className={btnPrimario}><Plus className="w-4 h-4" /> Guardar tarifa</button>
          </form>
        </Card>
      )}

      {/* ══ COMPARATIVA ══ */}
      {pestana === 'comparar' && (
        <>
          <Card className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs font-bold">Tarifa del cliente:</label>
              {(['2.0', '3.0', '6.1'] as const).map((t) => (
                <button key={t} onClick={() => cambiarTarifaSim(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${simTarifa === t ? 'bg-accent text-white' : 'bg-card/70 text-muted border border-border/50'}`}>
                  {t}TD
                </button>
              ))}
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted uppercase mb-1.5">Consumo de un mes medio (kWh por periodo)</p>
              {filaInputs(simConsumos, setSimConsumos, TARIFA_INFO[simTarifa].periodosEnergia)}
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted uppercase mb-1.5">Potencias contratadas (kW por periodo)</p>
              {filaInputs(simPotencias, setSimPotencias, TARIFA_INFO[simTarifa].periodosPotencia)}
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted uppercase mb-1.5">Precios ACTUALES del cliente · energía €/kWh</p>
              {filaInputs(simPreciosE, setSimPreciosE, TARIFA_INFO[simTarifa].periodosEnergia)}
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted uppercase mb-1.5">Precios ACTUALES del cliente · potencia €/kW·día</p>
              {filaInputs(simPreciosP, setSimPreciosP, TARIFA_INFO[simTarifa].periodosPotencia)}
            </div>
            <button onClick={simular} disabled={simulando} className={btnPrimario}>
              <Calculator className="w-4 h-4" /> {simulando ? 'Comparando…' : 'Comparar con todas las comercializadoras'}
            </button>
          </Card>

          {resultado && (
            <>
              <div className="grid md:grid-cols-3 gap-3">
                <Card className="!p-4 text-center">
                  <p className="text-[10px] uppercase font-bold text-muted">Coste actual del cliente</p>
                  <p className="text-2xl font-black tabular-nums mt-1">{eur(resultado.actual.total)}<span className="text-xs font-semibold text-muted">/año</span></p>
                  <p className="text-[10px] text-muted mt-0.5">Energía {eur(resultado.actual.totalEnergia)} · Potencia {eur(resultado.actual.totalPotencia)}</p>
                </Card>
                <Card className={`!p-4 text-center ${resultado.rangoAhorro ? '!border-emerald-500/40' : ''}`}>
                  <p className="text-[10px] uppercase font-bold text-muted">Ahorro para el cliente (lo que se enseña)</p>
                  {resultado.rangoAhorro ? (
                    <>
                      <p className="text-2xl font-black tabular-nums mt-1 text-emerald-400">
                        {eur(resultado.rangoAhorro.min)} – {eur(resultado.rangoAhorro.max)}
                      </p>
                      <p className="text-[10px] text-muted mt-0.5">({Math.round(resultado.rangoAhorro.minPct)}% – {Math.round(resultado.rangoAhorro.maxPct)}% anual)</p>
                    </>
                  ) : (
                    <p className="text-sm font-bold text-amber-300 mt-2">Sin ahorro con las tarifas guardadas</p>
                  )}
                </Card>
                <Card className="!p-4 text-center">
                  <p className="text-[10px] uppercase font-bold text-muted">Comisión Gesmeco (interno)</p>
                  <p className="text-2xl font-black tabular-nums mt-1 text-accent">
                    {eur(resultado.comisionEstimada.min)} – {eur(resultado.comisionEstimada.max)}
                  </p>
                  <p className="text-[10px] text-muted mt-0.5">
                    Fee {resultado.feeAplicado.paraAhorroMax.toFixed(4).replace('.', ',')} – {resultado.feeAplicado.paraAhorroMin.toFixed(4).replace('.', ',')} €/kWh
                    {resultado.feeAplicado.ajustado ? ' (ajustado a la banda 20-30%)' : ''}
                  </p>
                </Card>
              </div>

              {resultado.ofertas.length > 0 && (
                <Card className="!p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
                        <th className="px-3 py-2.5">Comercializadora (interno)</th>
                        <th className="px-3 py-2.5 text-right">Coste con fee mín.</th>
                        <th className="px-3 py-2.5 text-right">Coste con fee máx.</th>
                        <th className="px-3 py-2.5 text-right">Ahorro cliente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.ofertas.map((o, i) => (
                        <tr key={i} className={`border-b border-border/20 ${i === 0 ? 'bg-emerald-500/5' : ''}`}>
                          <td className="px-3 py-2 font-semibold">{i === 0 && '⭐ '}{o.comercializadora}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{eur(o.costeConFeeMin.total)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{eur(o.costeConFeeMax.total)}</td>
                          <td className={`px-3 py-2 text-right tabular-nums font-bold ${o.ahorroMax > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {eur(Math.max(0, o.ahorroMin))} – {eur(Math.max(0, o.ahorroMax))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}

              <div className="flex justify-end">
                <Link href="/gestor/luz/proyectos" className={btnSecundario}>
                  Montar el proyecto de ahorro con estos precios <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
