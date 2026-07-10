'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { UserPlus, X, Download } from 'lucide-react';
import { VctCliente, PRIORIDADES, PRIORIDAD_LABEL, SEGMENTOS, SEGMENTO_LABEL, fmtEur0 } from '@/lib/correbin';
import { Card, BadgePrioridad, BadgeSegmento, EstadoCarga, useLista, guardar, inputCls, labelCls, btnPrimario, btnSecundario, SelectorResponsable } from '../ui';

const FORM_VACIO = {
  nombre: '', nif: '', telefono: '', email: '', poblacion: '', contacto_principal: '',
  prioridad: 'C', segmento: 'particular_ordinario', potencial_comercial: '', origen: '', responsable: '', notas: '',
};

function ClientesContenido() {
  const sp = useSearchParams();
  const [buscar, setBuscar] = useState('');
  const [fPrioridad, setFPrioridad] = useState(sp.get('prioridad') || '');
  const [fSegmento, setFSegmento] = useState('');
  const { datos, cargando, error, faltaMigracion, recargar } = useLista<VctCliente>('clientes', buscar ? { buscar } : {});
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');

  const filtrados = useMemo(() => datos.filter((c) => {
    if (fPrioridad && (c.prioridad || 'C') !== fPrioridad) return false;
    if (fSegmento && c.segmento !== fSegmento) return false;
    return true;
  }), [datos, fPrioridad, fSegmento]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) { setErrorForm('El nombre es obligatorio.'); return; }
    setGuardando(true); setErrorForm('');
    const err = await guardar('clientes', 'POST', form);
    setGuardando(false);
    if (err) { setErrorForm(err); return; }
    setForm(FORM_VACIO); setMostrarForm(false);
    recargar();
  }

  const selCls = 'rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 text-xs font-semibold';
  const urlExport = `/api/correbin/exportar?tipo=clientes${fPrioridad ? `&prioridad=${fPrioridad}` : ''}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Clientes</h2>
          <p className="text-xs text-muted mt-0.5">{filtrados.length} cliente(s)</p>
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
              <div className="md:col-span-2">
                <label className={labelCls}>Nombre / Razón social *</label>
                <input className={inputCls} value={form.nombre} onChange={set('nombre')} />
              </div>
              <div><label className={labelCls}>CIF/NIF</label><input className={inputCls} value={form.nif} onChange={set('nif')} /></div>
              <div><label className={labelCls}>Teléfono</label><input className={inputCls} value={form.telefono} onChange={set('telefono')} /></div>
              <div><label className={labelCls}>Email</label><input className={inputCls} type="email" value={form.email} onChange={set('email')} /></div>
              <div><label className={labelCls}>Contacto principal</label><input className={inputCls} value={form.contacto_principal} onChange={set('contacto_principal')} /></div>
              <div>
                <label className={labelCls}>Prioridad</label>
                <select className={inputCls} value={form.prioridad} onChange={set('prioridad')}>
                  {PRIORIDADES.map((p) => <option key={p} value={p}>{PRIORIDAD_LABEL[p]}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Segmento</label>
                <select className={inputCls} value={form.segmento} onChange={set('segmento')}>
                  {SEGMENTOS.map((s) => <option key={s} value={s}>{SEGMENTO_LABEL[s]}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Responsable</label><input className={inputCls} value={form.responsable} onChange={set('responsable')} /></div>
              <div className="md:col-span-3">
                <label className={labelCls}>Potencial comercial</label>
                <input className={inputCls} value={form.potencial_comercial} onChange={set('potencial_comercial')} />
              </div>
            </div>
            {errorForm && <p className="text-xs text-red-400">{errorForm}</p>}
            <button type="submit" disabled={guardando} className={btnPrimario}>{guardando ? 'Guardando...' : 'Crear cliente'}</button>
          </form>
        </Card>
      )}

      <Card className="!p-3">
        <div className="flex gap-2 flex-wrap">
          <input className={`${inputCls} flex-1 min-w-48`} value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="🔍 Buscar por nombre..." />
          <select className={selCls} value={fPrioridad} onChange={(e) => setFPrioridad(e.target.value)}>
            <option value="">Prioridad: todas</option>
            {PRIORIDADES.map((p) => <option key={p} value={p}>Prioridad {p}</option>)}
          </select>
          <select className={selCls} value={fSegmento} onChange={(e) => setFSegmento(e.target.value)}>
            <option value="">Segmento: todos</option>
            {SEGMENTOS.map((s) => <option key={s} value={s}>{SEGMENTO_LABEL[s]}</option>)}
          </select>
        </div>
      </Card>

      <EstadoCarga
        cargando={cargando} error={error} faltaMigracion={faltaMigracion}
        vacio={!cargando && !error && filtrados.length === 0}
        textoVacio="Sin clientes con este filtro. Crea uno o usa la Importación Excel."
      />

      {filtrados.length > 0 && (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
                <th className="px-3 py-3">Pr.</th>
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3">Segmento</th>
                <th className="px-3 py-3 text-right">Prima total</th>
                <th className="px-3 py-3">Teléfono</th>
                <th className="px-3 py-3">Responsable</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id} className="border-b border-border/20 hover:bg-card/50 transition">
                  <td className="px-3 py-2"><BadgePrioridad prioridad={c.prioridad} /></td>
                  <td className="px-3 py-2">
                    <Link href={`/gestor/correbin/clientes/${c.id}`} className="font-semibold hover:text-accent transition">{c.nombre}</Link>
                    {c.nif && <span className="block text-[10px] text-muted font-mono">{c.nif}</span>}
                  </td>
                  <td className="px-3 py-2"><BadgeSegmento segmento={c.segmento} /></td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">{fmtEur0(Number(c.prima_total))}</td>
                  <td className="px-3 py-2 text-muted">{c.telefono || '—'}</td>
                  <td className="px-3 py-2">
                    <SelectorResponsable
                      valor={c.responsable}
                      onCambio={async (v) => { await guardar('clientes', 'PUT', { id: c.id, responsable: v }); recargar(); }}
                    />
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

export default function ClientesVct() {
  return (
    <Suspense fallback={<div className="text-muted text-sm py-8 text-center">Cargando...</div>}>
      <ClientesContenido />
    </Suspense>
  );
}
