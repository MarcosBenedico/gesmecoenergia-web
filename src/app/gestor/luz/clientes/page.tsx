'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { UserPlus, X, Download } from 'lucide-react';
import {
  LuzCliente, LuzCups, TIPOS_CLIENTE, TIPO_CLIENTE_LABEL, PRIORIDADES, PRIORIDAD_LABEL,
  ESTADOS_CLIENTE, ESTADO_CLIENTE_LABEL, fmtKwh,
} from '@/lib/luz';
import { Card, BadgePrioridad, Badge, EstadoCarga, useListaLuz, guardarLuz, inputCls, labelCls, btnPrimario, btnSecundario, SelectorResponsable } from '../ui';

const FORM_VACIO = {
  nombre: '', nif: '', tipo_cliente: 'particular', persona_contacto: '', telefono: '', email: '',
  direccion_fiscal: '', responsable: '', prioridad: 'C', estado_comercial: 'detectado',
  potencial_comercial: '', origen_cliente: '', observaciones: '',
};

function ClientesLuzContenido() {
  const sp = useSearchParams();
  const [buscar, setBuscar] = useState('');
  const clientes = useListaLuz<LuzCliente>('clientes', buscar ? { buscar } : {});
  const cups = useListaLuz<LuzCups>('cups');

  const [fPrioridad, setFPrioridad] = useState(sp.get('prioridad') || '');
  const [fEstado, setFEstado] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [fResp, setFResp] = useState('');
  const [fEspecial, setFEspecial] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [errorForm, setErrorForm] = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Agregados por cliente desde sus CUPS
  const porCliente = useMemo(() => {
    const m = new Map<string, { n: number; consumo: number; comercializadora: string }>();
    for (const c of cups.datos) {
      const prev = m.get(c.cliente_id) || { n: 0, consumo: 0, comercializadora: '' };
      m.set(c.cliente_id, {
        n: prev.n + 1,
        consumo: prev.consumo + (Number(c.consumo_anual_kwh) || 0),
        comercializadora: prev.comercializadora || c.comercializadora_actual || '',
      });
    }
    return m;
  }, [cups.datos]);

  const responsables = useMemo(() => Array.from(new Set(clientes.datos.map((c) => c.responsable).filter(Boolean))) as string[], [clientes.datos]);

  const filtrados = useMemo(() => clientes.datos.filter((c) => {
    if (fPrioridad && c.prioridad !== fPrioridad) return false;
    if (fEstado && c.estado_comercial !== fEstado) return false;
    if (fTipo && c.tipo_cliente !== fTipo) return false;
    if (fResp && c.responsable !== fResp) return false;
    if (fEspecial === 'sin_accion' && c.proxima_accion) return false;
    if (fEspecial === 'a_sin_seguimiento' && !(c.prioridad === 'A' && !c.proxima_accion)) return false;
    return true;
  }), [clientes.datos, fPrioridad, fEstado, fTipo, fResp, fEspecial]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) { setErrorForm('El nombre es obligatorio.'); return; }
    setErrorForm('');
    const err = await guardarLuz('clientes', 'POST', form);
    if (err) { setErrorForm(err); return; }
    setForm(FORM_VACIO); setMostrarForm(false);
    clientes.recargar();
  }

  const selCls = 'rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 text-xs font-semibold';
  const urlExport = `/api/luz/exportar?tipo=clientes${fPrioridad ? `&prioridad=${fPrioridad}` : ''}${fEstado ? `&estado_comercial=${fEstado}` : ''}${fResp ? `&responsable=${encodeURIComponent(fResp)}` : ''}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Clientes Energía</h2>
          <p className="text-xs text-muted mt-0.5">{filtrados.length} cliente(s) · el centro es el cliente, debajo sus CUPS</p>
        </div>
        <div className="flex gap-2">
          <a href={urlExport} className={btnSecundario} download><Download className="w-4 h-4" /> Exportar</a>
          <button onClick={() => setMostrarForm((v) => !v)} className={btnPrimario}>
            {mostrarForm ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {mostrarForm ? 'Cancelar' : 'Nuevo cliente'}
          </button>
        </div>
      </div>

      {mostrarForm && (
        <Card>
          <form onSubmit={crear} className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2"><label className={labelCls}>Nombre / Razón social *</label><input className={inputCls} value={form.nombre} onChange={set('nombre')} /></div>
              <div><label className={labelCls}>CIF/NIF</label><input className={inputCls} value={form.nif} onChange={set('nif')} /></div>
              <div>
                <label className={labelCls}>Tipo de cliente</label>
                <select className={inputCls} value={form.tipo_cliente} onChange={set('tipo_cliente')}>
                  {TIPOS_CLIENTE.map((t) => <option key={t} value={t}>{TIPO_CLIENTE_LABEL[t]}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Persona de contacto</label><input className={inputCls} value={form.persona_contacto} onChange={set('persona_contacto')} /></div>
              <div><label className={labelCls}>Teléfono</label><input className={inputCls} value={form.telefono} onChange={set('telefono')} /></div>
              <div><label className={labelCls}>Email</label><input className={inputCls} type="email" value={form.email} onChange={set('email')} /></div>
              <div>
                <label className={labelCls}>Prioridad</label>
                <select className={inputCls} value={form.prioridad} onChange={set('prioridad')}>
                  {PRIORIDADES.map((p) => <option key={p} value={p}>{PRIORIDAD_LABEL[p]}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Estado</label>
                <select className={inputCls} value={form.estado_comercial} onChange={set('estado_comercial')}>
                  {ESTADOS_CLIENTE.map((es) => <option key={es} value={es}>{ESTADO_CLIENTE_LABEL[es]}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Origen</label><input className={inputCls} value={form.origen_cliente} onChange={set('origen_cliente')} placeholder="Web, oficina, derivación..." /></div>
              <div className="md:col-span-3"><label className={labelCls}>Potencial comercial</label><input className={inputCls} value={form.potencial_comercial} onChange={set('potencial_comercial')} /></div>
            </div>
            {errorForm && <p className="text-xs text-red-400">{errorForm}</p>}
            <button type="submit" className={btnPrimario}>Crear cliente</button>
          </form>
        </Card>
      )}

      <Card className="!p-3 space-y-2.5">
        <div className="flex gap-2 flex-wrap">
          <input className={`${inputCls} flex-1 min-w-48`} value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="🔍 Buscar cliente..." />
          <select className={selCls} value={fPrioridad} onChange={(e) => setFPrioridad(e.target.value)}>
            <option value="">Prioridad: todas</option>
            {PRIORIDADES.map((p) => <option key={p} value={p}>Prioridad {p}</option>)}
          </select>
          <select className={selCls} value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
            <option value="">Estado: todos</option>
            {ESTADOS_CLIENTE.map((es) => <option key={es} value={es}>{ESTADO_CLIENTE_LABEL[es]}</option>)}
          </select>
          <select className={selCls} value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
            <option value="">Tipo: todos</option>
            {TIPOS_CLIENTE.map((t) => <option key={t} value={t}>{TIPO_CLIENTE_LABEL[t]}</option>)}
          </select>
          <select className={selCls} value={fResp} onChange={(e) => setFResp(e.target.value)}>
            <option value="">Responsable: todos</option>
            {responsables.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="flex gap-1.5 flex-wrap text-xs">
          {[['', 'Todos'], ['sin_accion', '⚠️ Sin próxima acción'], ['a_sin_seguimiento', '🔴 Clientes A sin seguimiento']].map(([v, n]) => (
            <button key={v} onClick={() => setFEspecial(v)} className={`px-2.5 py-1.5 rounded-lg font-semibold ${fEspecial === v ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}>{n}</button>
          ))}
        </div>
      </Card>

      <EstadoCarga cargando={clientes.cargando} error={clientes.error} faltaMigracion={clientes.faltaMigracion}
        vacio={!clientes.cargando && !clientes.error && filtrados.length === 0}
        textoVacio="Sin clientes con este filtro. Crea uno o usa la Importación." sqlFile="supabase_luz.sql" />

      {filtrados.length > 0 && (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
                <th className="px-3 py-3">Pr.</th>
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3">Tipo</th>
                <th className="px-3 py-3 text-center">CUPS</th>
                <th className="px-3 py-3 text-right">Consumo anual</th>
                <th className="px-3 py-3">Comercializadora</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Responsable</th>
                <th className="px-3 py-3">Próxima acción</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const agg = porCliente.get(c.id);
                return (
                  <tr key={c.id} className="border-b border-border/20 hover:bg-card/50 transition">
                    <td className="px-3 py-2"><BadgePrioridad prioridad={c.prioridad} /></td>
                    <td className="px-3 py-2">
                      <Link href={`/gestor/luz/clientes/${c.id}`} className="font-semibold hover:text-accent transition">{c.nombre}</Link>
                      {c.nif && <span className="block text-[10px] font-mono text-muted">{c.nif}</span>}
                    </td>
                    <td className="px-3 py-2"><Badge>{TIPO_CLIENTE_LABEL[c.tipo_cliente] || c.tipo_cliente}</Badge></td>
                    <td className="px-3 py-2 text-center font-bold tabular-nums">{agg?.n || 0}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtKwh(agg?.consumo)}</td>
                    <td className="px-3 py-2 text-xs text-muted">{agg?.comercializadora || '—'}</td>
                    <td className="px-3 py-2">
                      <select
                        value={c.estado_comercial}
                        onChange={async (e) => { await guardarLuz('clientes', 'PUT', { id: c.id, estado_comercial: e.target.value }); clientes.recargar(); }}
                        className="rounded-md border border-border/40 bg-background/60 px-1.5 py-0.5 text-[11px] font-semibold max-w-32"
                      >
                        {ESTADOS_CLIENTE.map((es) => <option key={es} value={es}>{ESTADO_CLIENTE_LABEL[es]}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <SelectorResponsable valor={c.responsable} onCambio={async (v) => { await guardarLuz('clientes', 'PUT', { id: c.id, responsable: v }); clientes.recargar(); }} />
                    </td>
                    <td className="px-3 py-2 text-xs max-w-40 truncate">
                      {c.proxima_accion || <span className="text-amber-400">—</span>}
                    </td>
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

export default function ClientesLuz() {
  return (
    <Suspense fallback={<div className="text-muted text-sm py-8 text-center">Cargando...</div>}>
      <ClientesLuzContenido />
    </Suspense>
  );
}
