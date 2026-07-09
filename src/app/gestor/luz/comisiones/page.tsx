'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Download, Plus, X } from 'lucide-react';
import {
  LuzComision, LuzCliente, ESTADOS_COMISION, ESTADO_COMISION_LABEL, TIPOS_COMISION,
  TIPO_COMISION_LABEL, COMISION_PENDIENTE, diasHasta, fmtEur, fmtFecha,
} from '@/lib/luz';
import { Card, Kpi, Badge, EstadoCarga, useListaLuz, guardarLuz, inputCls, labelCls, btnPrimario, btnSecundario } from '../ui';

const FORM_VACIO = {
  cliente_id: '', comercializadora: '', tipo_comision: 'desconocida',
  importe_previsto: '', importe_cobrado: '', fecha_prevista_cobro: '', estado_comision: 'prevista',
};

function ComisionesContenido() {
  const sp = useSearchParams();
  const { datos, cargando, error, faltaMigracion, recargar } = useListaLuz<LuzComision>('comisiones');
  const clientes = useListaLuz<LuzCliente>('clientes');
  const [fEstado, setFEstado] = useState(sp.get('estado_comision') || '');
  const [fCia, setFCia] = useState('');
  const [fEspecial, setFEspecial] = useState(sp.get('pendientes') ? 'pendientes' : '');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [errorForm, setErrorForm] = useState('');

  const filtradas = useMemo(() => datos.filter((c) => {
    if (fEstado && c.estado_comision !== fEstado) return false;
    if (fCia && !c.comercializadora?.toLowerCase().includes(fCia.toLowerCase())) return false;
    if (fEspecial === 'pendientes' && !COMISION_PENDIENTE.includes(c.estado_comision)) return false;
    if (fEspecial === 'vencidas' && !(COMISION_PENDIENTE.includes(c.estado_comision) && (diasHasta(c.fecha_prevista_cobro) ?? 1) < 0)) return false;
    if (fEspecial === 'diferencias' && !((Number(c.importe_previsto) || 0) > (Number(c.importe_cobrado) || 0) && (Number(c.importe_cobrado) || 0) > 0)) return false;
    return true;
  }), [datos, fEstado, fCia, fEspecial]);

  const previsto = datos.filter((c) => COMISION_PENDIENTE.includes(c.estado_comision)).reduce((s, c) => s + (Number(c.importe_previsto) || 0) - (Number(c.importe_cobrado) || 0), 0);
  const cobrado = datos.reduce((s, c) => s + (Number(c.importe_cobrado) || 0), 0);
  const vencidas = datos.filter((c) => COMISION_PENDIENTE.includes(c.estado_comision) && (diasHasta(c.fecha_prevista_cobro) ?? 1) < 0);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente_id) { setErrorForm('Selecciona el cliente.'); return; }
    setErrorForm('');
    const err = await guardarLuz('comisiones', 'POST', {
      ...form,
      importe_previsto: parseFloat(form.importe_previsto) || 0,
      importe_cobrado: parseFloat(form.importe_cobrado) || 0,
      fecha_prevista_cobro: form.fecha_prevista_cobro || null,
    });
    if (err) { setErrorForm(err); return; }
    setForm(FORM_VACIO); setMostrarForm(false);
    recargar();
  }

  const selCls = 'rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 text-xs font-semibold';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Comisiones</h2>
          <p className="text-xs text-muted mt-0.5">Dinero previsto y cobrado de la cartera energética.</p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/luz/exportar?tipo=${fEspecial === 'pendientes' ? 'comisiones_pendientes' : 'comisiones'}${fEstado ? `&estado_comision=${fEstado}` : ''}${fCia ? `&comercializadora=${encodeURIComponent(fCia)}` : ''}`} className={btnSecundario} download>
            <Download className="w-4 h-4" /> Exportar
          </a>
          <button onClick={() => setMostrarForm((v) => !v)} className={btnPrimario}>
            {mostrarForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {mostrarForm ? 'Cancelar' : 'Registrar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi valor={fmtEur(cobrado)} etiqueta="Cobrado total" color="text-emerald-400" />
        <Kpi valor={fmtEur(previsto)} etiqueta="Pendiente de cobro" color="text-amber-400" />
        <Kpi valor={vencidas.length} etiqueta="⏰ Cobros vencidos" color={vencidas.length ? 'text-red-400' : 'text-emerald-400'} />
      </div>

      {mostrarForm && (
        <Card>
          <form onSubmit={crear} className="space-y-3">
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Cliente *</label>
                <select className={inputCls} value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
                  <option value="">— Selecciona —</option>
                  {clientes.datos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Comercializadora</label><input className={inputCls} value={form.comercializadora} onChange={(e) => setForm({ ...form, comercializadora: e.target.value })} /></div>
              <div>
                <label className={labelCls}>Tipo</label>
                <select className={inputCls} value={form.tipo_comision} onChange={(e) => setForm({ ...form, tipo_comision: e.target.value })}>
                  {TIPOS_COMISION.map((t) => <option key={t} value={t}>{TIPO_COMISION_LABEL[t]}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Importe previsto (€)</label><input className={inputCls} type="number" step="0.01" value={form.importe_previsto} onChange={(e) => setForm({ ...form, importe_previsto: e.target.value })} /></div>
              <div><label className={labelCls}>Fecha prevista cobro</label><input className={inputCls} type="date" value={form.fecha_prevista_cobro} onChange={(e) => setForm({ ...form, fecha_prevista_cobro: e.target.value })} /></div>
            </div>
            {errorForm && <p className="text-xs text-red-400">{errorForm}</p>}
            <button type="submit" className={btnPrimario}>Guardar</button>
          </form>
        </Card>
      )}

      <Card className="!p-3 space-y-2.5">
        <div className="flex gap-2 flex-wrap">
          <select className={selCls} value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
            <option value="">Estado: todos</option>
            {ESTADOS_COMISION.map((es) => <option key={es} value={es}>{ESTADO_COMISION_LABEL[es]}</option>)}
          </select>
          <input className={`${inputCls} !w-44`} value={fCia} onChange={(e) => setFCia(e.target.value)} placeholder="Comercializadora..." />
        </div>
        <div className="flex gap-1.5 flex-wrap text-xs">
          {[['', 'Todas'], ['pendientes', '💶 Pendientes'], ['vencidas', '🔴 Vencidas'], ['diferencias', '⚠️ Con diferencia']].map(([v, n]) => (
            <button key={v} onClick={() => setFEspecial(v)} className={`px-2.5 py-1.5 rounded-lg font-semibold ${fEspecial === v ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}>{n}</button>
          ))}
        </div>
      </Card>

      <EstadoCarga cargando={cargando} error={error} faltaMigracion={faltaMigracion}
        vacio={!cargando && !error && filtradas.length === 0}
        textoVacio="Sin comisiones con este filtro." sqlFile="supabase_luz.sql" />

      {filtradas.length > 0 && (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
                <th className="px-3 py-3">Cliente</th><th className="px-3 py-3">CUPS</th><th className="px-3 py-3">Comercializadora</th>
                <th className="px-3 py-3">Tipo</th><th className="px-3 py-3 text-right">Previsto</th>
                <th className="px-3 py-3 text-right">Cobrado</th><th className="px-3 py-3 text-right">Diferencia</th>
                <th className="px-3 py-3">Estado</th><th className="px-3 py-3">F. prevista</th><th className="px-3 py-3">F. cobro</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c) => {
                const prev = Number(c.importe_previsto) || 0;
                const cob = Number(c.importe_cobrado) || 0;
                const dif = prev - cob;
                const vencida = COMISION_PENDIENTE.includes(c.estado_comision) && (diasHasta(c.fecha_prevista_cobro) ?? 1) < 0;
                return (
                  <tr key={c.id} className={`border-b border-border/20 hover:bg-card/50 transition ${vencida ? 'bg-red-500/5' : ''}`}>
                    <td className="px-3 py-2 font-semibold text-xs">
                      {c.cliente_id
                        ? <Link href={`/gestor/luz/clientes/${c.cliente_id}`} className="hover:text-accent">{c.luz_clientes?.nombre || '—'}</Link>
                        : (c.luz_clientes?.nombre || '—')}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted">{c.luz_cups?.cups || '—'}</td>
                    <td className="px-3 py-2 text-xs">{c.comercializadora || '—'}</td>
                    <td className="px-3 py-2 text-xs"><Badge>{TIPO_COMISION_LABEL[c.tipo_comision]}</Badge></td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{fmtEur(prev)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <input
                        type="number" step="0.01"
                        className="w-20 rounded-md border border-border/40 bg-background/60 px-1 py-0.5 text-[11px] text-right tabular-nums"
                        defaultValue={cob || ''}
                        onBlur={async (e) => {
                          const nuevo = parseFloat(e.target.value) || 0;
                          if (nuevo !== cob) {
                            await guardarLuz('comisiones', 'PUT', {
                              id: c.id, importe_cobrado: nuevo,
                              estado_comision: nuevo >= prev && prev > 0 ? 'cobrada' : nuevo > 0 ? 'cobrada_parcial' : c.estado_comision,
                            });
                            recargar();
                          }
                        }}
                      />
                    </td>
                    <td className={`px-3 py-2 text-right font-bold tabular-nums ${dif > 0 && cob > 0 ? 'text-amber-400' : dif > 0 ? 'text-muted' : 'text-emerald-400'}`}>{fmtEur(dif)}</td>
                    <td className="px-3 py-2">
                      <select value={c.estado_comision}
                        onChange={async (e) => { await guardarLuz('comisiones', 'PUT', { id: c.id, estado_comision: e.target.value }); recargar(); }}
                        className="rounded-md border border-border/40 bg-background/60 px-1.5 py-0.5 text-[11px] font-semibold">
                        {ESTADOS_COMISION.map((es) => <option key={es} value={es}>{ESTADO_COMISION_LABEL[es]}</option>)}
                      </select>
                      {vencida && <span className="block text-[10px] text-red-400 font-bold mt-0.5">⏰ vencida</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{fmtFecha(c.fecha_prevista_cobro)}</td>
                    <td className="px-3 py-2 text-xs text-muted">{fmtFecha(c.fecha_cobro)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

export default function ComisionesPage() {
  return (
    <Suspense fallback={<div className="text-muted text-sm py-8 text-center">Cargando...</div>}>
      <ComisionesContenido />
    </Suspense>
  );
}
