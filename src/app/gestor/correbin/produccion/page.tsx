'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, X, Download } from 'lucide-react';
import {
  VctProduccion, VctCliente, RAMOS, RAMO_LABEL, TIPOS_PRODUCCION, TIPO_PRODUCCION_LABEL,
  PRODUCCION_REAL, fmtEur0, fmtFecha,
} from '@/lib/correbin';
import { Card, Kpi, Badge, EstadoCarga, useLista, guardar, inputCls, labelCls, btnPrimario, btnSecundario, SelectorResponsable } from '../ui';

const FORM_VACIO = {
  cliente_id: '', fecha_emision: new Date().toISOString().slice(0, 10), fecha_efecto: '',
  ramo: 'otros', compania: '', prima: '', comision: '', tipo_produccion: 'nueva', responsable: '', observaciones: '',
};

export default function ProduccionPage() {
  const anio = new Date().getFullYear();
  const { datos, cargando, error, faltaMigracion, recargar } = useLista<VctProduccion>('produccion');
  const clientes = useLista<VctCliente>('clientes');
  const [fTipo, setFTipo] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [errorForm, setErrorForm] = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const filtrados = useMemo(() => datos.filter((p) => !fTipo || p.tipo_produccion === fTipo), [datos, fTipo]);

  const delAnio = datos.filter((p) => p.fecha_emision?.startsWith(String(anio)));
  const real = delAnio.filter((p) => PRODUCCION_REAL.includes(p.tipo_produccion));
  const tecnica = delAnio.filter((p) => !PRODUCCION_REAL.includes(p.tipo_produccion));

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente_id) { setErrorForm('Selecciona el cliente.'); return; }
    setErrorForm('');
    const err = await guardar('produccion', 'POST', {
      ...form,
      prima: parseFloat(form.prima) || 0,
      comision: parseFloat(form.comision) || 0,
      fecha_efecto: form.fecha_efecto || null,
    });
    if (err) { setErrorForm(err); return; }
    setMostrarForm(false); setForm(FORM_VACIO);
    recargar();
  }

  const selCls = 'rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 text-xs font-semibold';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Producción</h2>
          <p className="text-xs text-muted mt-0.5">Solo &quot;nueva&quot; y &quot;ampliación&quot; suman cartera real; el resto es movimiento técnico.</p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/correbin/exportar?tipo=produccion${fTipo ? `&tipo_produccion=${fTipo}` : ''}`} className={btnSecundario} download>
            <Download className="w-4 h-4" /> Exportar
          </a>
          <button onClick={() => setMostrarForm((v) => !v)} className={btnPrimario}>
            {mostrarForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {mostrarForm ? 'Cancelar' : 'Registrar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi valor={fmtEur0(real.reduce((s, p) => s + (Number(p.prima) || 0), 0))} etiqueta={`Producción REAL ${anio} (${real.length})`} color="text-emerald-400" />
        <Kpi valor={fmtEur0(tecnica.reduce((s, p) => s + (Number(p.prima) || 0), 0))} etiqueta={`Movimiento técnico ${anio} (${tecnica.length})`} color="text-amber-400" />
        <Kpi valor={fmtEur0(real.reduce((s, p) => s + (Number(p.comision) || 0), 0))} etiqueta={`Comisión producción real ${anio}`} color="text-secondary" />
      </div>

      {mostrarForm && (
        <Card>
          <form onSubmit={crear} className="space-y-3">
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Cliente *</label>
                <select className={inputCls} value={form.cliente_id} onChange={set('cliente_id')}>
                  <option value="">— Selecciona —</option>
                  {clientes.datos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Tipo *</label>
                <select className={inputCls} value={form.tipo_produccion} onChange={set('tipo_produccion')}>
                  {TIPOS_PRODUCCION.map((t) => <option key={t} value={t}>{TIPO_PRODUCCION_LABEL[t]}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Fecha emisión</label><input className={inputCls} type="date" value={form.fecha_emision} onChange={set('fecha_emision')} /></div>
              <div><label className={labelCls}>Efecto</label><input className={inputCls} type="date" value={form.fecha_efecto} onChange={set('fecha_efecto')} /></div>
              <div>
                <label className={labelCls}>Ramo</label>
                <select className={inputCls} value={form.ramo} onChange={set('ramo')}>
                  {RAMOS.map((r) => <option key={r} value={r}>{RAMO_LABEL[r]}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Compañía</label><input className={inputCls} value={form.compania} onChange={set('compania')} /></div>
              <div><label className={labelCls}>Prima (€)</label><input className={inputCls} type="number" step="0.01" value={form.prima} onChange={set('prima')} /></div>
              <div><label className={labelCls}>Comisión (€)</label><input className={inputCls} type="number" step="0.01" value={form.comision} onChange={set('comision')} /></div>
            </div>
            {errorForm && <p className="text-xs text-red-400">{errorForm}</p>}
            <button type="submit" className={btnPrimario}>Guardar</button>
          </form>
        </Card>
      )}

      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setFTipo('')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${!fTipo ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}>Todos</button>
        {TIPOS_PRODUCCION.map((t) => (
          <button key={t} onClick={() => setFTipo(t)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${fTipo === t ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}>
            {TIPO_PRODUCCION_LABEL[t]}
          </button>
        ))}
      </div>

      <EstadoCarga cargando={cargando} error={error} faltaMigracion={faltaMigracion}
        vacio={!cargando && !error && filtrados.length === 0} textoVacio="Sin producción registrada." />

      {filtrados.length > 0 && (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
                <th className="px-3 py-3">Fecha</th><th className="px-3 py-3">Cliente</th><th className="px-3 py-3">Tipo</th>
                <th className="px-3 py-3">Ramo</th><th className="px-3 py-3">Compañía</th>
                <th className="px-3 py-3 text-right">Prima</th><th className="px-3 py-3 text-right">Comisión</th>
                <th className="px-3 py-3">Responsable</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id} className="border-b border-border/20 hover:bg-card/50 transition">
                  <td className="px-3 py-2 whitespace-nowrap text-muted">{fmtFecha(p.fecha_emision)}</td>
                  <td className="px-3 py-2 font-semibold">
                    {p.cliente_id
                      ? <Link href={`/gestor/correbin/clientes/${p.cliente_id}`} className="hover:text-accent">{p.vct_clientes?.nombre || '—'}</Link>
                      : (p.vct_clientes?.nombre || '—')}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tono={PRODUCCION_REAL.includes(p.tipo_produccion) ? 'verde' : 'ambar'}>
                      {TIPO_PRODUCCION_LABEL[p.tipo_produccion]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs">{RAMO_LABEL[p.ramo] || p.ramo}</td>
                  <td className="px-3 py-2 text-xs">{p.compania || '—'}</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">{fmtEur0(Number(p.prima))}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-secondary">{fmtEur0(Number(p.comision))}</td>
                  <td className="px-3 py-2">
                    <SelectorResponsable valor={p.responsable} onCambio={async (v) => { await guardar('produccion', 'PUT', { id: p.id, responsable: v }); recargar(); }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
