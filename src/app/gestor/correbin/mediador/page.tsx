'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, X, Download } from 'lucide-react';
import {
  VctCambioMediador, VctCliente, ESTADOS_CAMBIO_MEDIADOR, ESTADO_CM_LABEL, fmtEur0, fmtFecha,
} from '@/lib/correbin';
import { Card, Kpi, Badge, EstadoCarga, useLista, guardar, inputCls, labelCls, btnPrimario, btnSecundario, SelectorResponsable } from '../ui';

const FORM_VACIO = {
  cliente_id: '', prima: '', compania: '', ramo: '', carta_firmada: false,
  estado_compania: '', fecha_solicitud: new Date().toISOString().slice(0, 10), estado: 'detectado', observaciones: '',
};

export default function CambiosMediadorPage() {
  const { datos, cargando, error, faltaMigracion, recargar } = useLista<VctCambioMediador>('cambios_mediador');
  const clientes = useLista<VctCliente>('clientes');
  const [fEstado, setFEstado] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [errorForm, setErrorForm] = useState('');

  const filtrados = useMemo(() => datos.filter((c) => !fEstado || c.estado === fEstado), [datos, fEstado]);

  const incorporada = datos.filter((c) => c.estado === 'incorporado').reduce((s, c) => s + (Number(c.prima) || 0), 0);
  const pendiente = datos.filter((c) => !['incorporado', 'rechazado'].includes(c.estado)).reduce((s, c) => s + (Number(c.prima) || 0), 0);
  const rechazada = datos.filter((c) => c.estado === 'rechazado').reduce((s, c) => s + (Number(c.prima) || 0), 0);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente_id) { setErrorForm('Selecciona el cliente.'); return; }
    setErrorForm('');
    const err = await guardar('cambios_mediador', 'POST', { ...form, prima: parseFloat(form.prima) || 0 });
    if (err) { setErrorForm(err); return; }
    setMostrarForm(false); setForm(FORM_VACIO);
    recargar();
  }

  async function cambiar(c: VctCambioMediador, campos: Record<string, unknown>) {
    const err = await guardar('cambios_mediador', 'PUT', { id: c.id, ...campos });
    if (!err) recargar();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Cambios de mediador</h2>
          <p className="text-xs text-muted mt-0.5">Qué prima está pendiente de entrar a código Correbin y cuál ya está dentro.</p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/correbin/exportar?tipo=mediador${fEstado ? `&estado=${fEstado}` : ''}`} className={btnSecundario} download>
            <Download className="w-4 h-4" /> Exportar
          </a>
          <button onClick={() => setMostrarForm((v) => !v)} className={btnPrimario}>
            {mostrarForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {mostrarForm ? 'Cancelar' : 'Registrar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi valor={fmtEur0(incorporada)} etiqueta="Prima incorporada a código" color="text-emerald-400" />
        <Kpi valor={fmtEur0(pendiente)} etiqueta="Prima pendiente de entrar" color="text-amber-400" />
        <Kpi valor={fmtEur0(rechazada)} etiqueta="Rechazada" color="text-red-400" />
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
              <div><label className={labelCls}>Prima (€)</label><input className={inputCls} type="number" step="0.01" value={form.prima} onChange={(e) => setForm({ ...form, prima: e.target.value })} /></div>
              <div><label className={labelCls}>Compañía</label><input className={inputCls} value={form.compania} onChange={(e) => setForm({ ...form, compania: e.target.value })} /></div>
              <div><label className={labelCls}>Ramo</label><input className={inputCls} value={form.ramo} onChange={(e) => setForm({ ...form, ramo: e.target.value })} /></div>
              <div>
                <label className={labelCls}>Estado</label>
                <select className={inputCls} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                  {ESTADOS_CAMBIO_MEDIADOR.map((s) => <option key={s} value={s}>{ESTADO_CM_LABEL[s]}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Fecha solicitud</label><input className={inputCls} type="date" value={form.fecha_solicitud} onChange={(e) => setForm({ ...form, fecha_solicitud: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-xs font-semibold text-muted mt-5 cursor-pointer">
                <input type="checkbox" checked={form.carta_firmada} onChange={(e) => setForm({ ...form, carta_firmada: e.target.checked })} />
                Carta de mediador firmada
              </label>
            </div>
            {errorForm && <p className="text-xs text-red-400">{errorForm}</p>}
            <button type="submit" className={btnPrimario}>Guardar</button>
          </form>
        </Card>
      )}

      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setFEstado('')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${!fEstado ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}>Todos</button>
        {ESTADOS_CAMBIO_MEDIADOR.map((s) => (
          <button key={s} onClick={() => setFEstado(s)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${fEstado === s ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}>
            {ESTADO_CM_LABEL[s]}
          </button>
        ))}
      </div>

      <EstadoCarga cargando={cargando} error={error} faltaMigracion={faltaMigracion}
        vacio={!cargando && !error && filtrados.length === 0} textoVacio="Sin cambios de mediador registrados." />

      {filtrados.length > 0 && (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
                <th className="px-3 py-3">Cliente</th><th className="px-3 py-3 text-right">Prima</th>
                <th className="px-3 py-3">Carta</th><th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Estado cía.</th><th className="px-3 py-3">F. entrada</th>
                <th className="px-3 py-3">Responsable</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id} className="border-b border-border/20 hover:bg-card/50 transition">
                  <td className="px-3 py-2 font-semibold">
                    {c.cliente_id
                      ? <Link href={`/gestor/correbin/clientes/${c.cliente_id}`} className="hover:text-accent">{c.vct_clientes?.nombre || '—'}</Link>
                      : (c.vct_clientes?.nombre || '—')}
                    {c.compania && <span className="block text-[10px] text-muted">{c.compania}{c.ramo ? ` · ${c.ramo}` : ''}</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">{fmtEur0(Number(c.prima))}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => cambiar(c, { carta_firmada: !c.carta_firmada })}
                      className={`text-xs font-bold ${c.carta_firmada ? 'text-emerald-400' : 'text-muted'}`}
                    >
                      {c.carta_firmada ? '✓ Firmada' : '○ Sin firmar'}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={c.estado}
                      onChange={(e) => cambiar(c, {
                        estado: e.target.value,
                        ...(e.target.value === 'incorporado' && !c.fecha_entrada ? { fecha_entrada: new Date().toISOString().slice(0, 10) } : {}),
                      })}
                      className="rounded-md border border-border/40 bg-background/60 px-1.5 py-0.5 text-[11px] font-semibold"
                    >
                      {ESTADOS_CAMBIO_MEDIADOR.map((s) => <option key={s} value={s}>{ESTADO_CM_LABEL[s]}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">{c.estado_compania || '—'}</td>
                  <td className="px-3 py-2 text-xs text-muted">{c.fecha_entrada ? fmtFecha(c.fecha_entrada) : '—'}</td>
                  <td className="px-3 py-2">
                    <SelectorResponsable valor={c.responsable} onCambio={(v) => cambiar(c, { responsable: v })} />
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
