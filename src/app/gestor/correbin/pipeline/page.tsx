'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  VctOportunidad, ETAPAS_PIPELINE, ETAPA_LABEL, RAMOS, RAMO_LABEL, fmtEur, fmtFecha,
} from '@/lib/correbin';
import { Card, Kpi, EstadoCarga, useLista, guardar, inputCls, labelCls, btnPrimario } from '../ui';

const COLOR_ETAPA: Record<string, string> = {
  prospecto: 'border-border/40',
  contactado: 'border-secondary/40',
  cotizado: 'border-amber-500/40',
  negociacion: 'border-accent/40',
  ganada: 'border-emerald-500/40',
  perdida: 'border-red-500/30',
};

const FORM_VACIO = {
  nombre_contacto: '', telefono: '', ramo: 'hogar', compania_actual: '',
  etapa: 'prospecto', prima_estimada: '', fecha_prevista: '', responsable: '', notas: '',
};

export default function PipelinePage() {
  const { datos, cargando, error, faltaMigracion, recargar } = useLista<VctOportunidad>('oportunidades');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [errorForm, setErrorForm] = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const abiertas = datos.filter((o) => !['ganada', 'perdida'].includes(o.etapa));
  const primaJuego = abiertas.reduce((s, o) => s + (Number(o.prima_estimada) || 0), 0);
  const ganadas = datos.filter((o) => o.etapa === 'ganada');

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre_contacto.trim()) { setErrorForm('El nombre del contacto es obligatorio.'); return; }
    setErrorForm('');
    const err = await guardar('oportunidades', 'POST', {
      ...form,
      prima_estimada: parseFloat(form.prima_estimada) || 0,
      fecha_prevista: form.fecha_prevista || null,
    });
    if (err) { setErrorForm(err); return; }
    setForm(FORM_VACIO);
    setMostrarForm(false);
    recargar();
  }

  async function moverEtapa(o: VctOportunidad, etapa: string) {
    const err = await guardar('oportunidades', 'PUT', { id: o.id, etapa });
    if (!err) recargar();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Pipeline comercial</h2>
          <p className="text-xs text-muted mt-0.5">Oportunidades de negocio nuevo, de prospecto a póliza.</p>
        </div>
        <button onClick={() => setMostrarForm((v) => !v)} className={btnPrimario}>
          {mostrarForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {mostrarForm ? 'Cancelar' : 'Nueva oportunidad'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi valor={abiertas.length} etiqueta="Abiertas" color="text-secondary" />
        <Kpi valor={fmtEur(primaJuego)} etiqueta="Prima en juego" color="text-amber-400" />
        <Kpi valor={ganadas.length} etiqueta="Ganadas" color="text-emerald-400" />
      </div>

      {mostrarForm && (
        <Card>
          <form onSubmit={crear} className="space-y-3">
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Contacto *</label>
                <input className={inputCls} value={form.nombre_contacto} onChange={set('nombre_contacto')} placeholder="Nombre" />
              </div>
              <div>
                <label className={labelCls}>Teléfono</label>
                <input className={inputCls} value={form.telefono} onChange={set('telefono')} />
              </div>
              <div>
                <label className={labelCls}>Ramo</label>
                <select className={inputCls} value={form.ramo} onChange={set('ramo')}>
                  {RAMOS.map((r) => <option key={r} value={r}>{RAMO_LABEL[r]}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Compañía actual</label>
                <input className={inputCls} value={form.compania_actual} onChange={set('compania_actual')} placeholder="Con quién está" />
              </div>
              <div>
                <label className={labelCls}>Prima estimada (€)</label>
                <input className={inputCls} type="number" step="0.01" value={form.prima_estimada} onChange={set('prima_estimada')} />
              </div>
              <div>
                <label className={labelCls}>Vencimiento de su póliza</label>
                <input className={inputCls} type="date" value={form.fecha_prevista} onChange={set('fecha_prevista')} />
              </div>
              <div>
                <label className={labelCls}>Responsable</label>
                <input className={inputCls} value={form.responsable} onChange={set('responsable')} />
              </div>
              <div>
                <label className={labelCls}>Notas</label>
                <input className={inputCls} value={form.notas} onChange={set('notas')} />
              </div>
            </div>
            {errorForm && <p className="text-xs text-red-400">{errorForm}</p>}
            <button type="submit" className={btnPrimario}>Crear oportunidad</button>
          </form>
        </Card>
      )}

      <EstadoCarga
        cargando={cargando}
        error={error}
        faltaMigracion={faltaMigracion}
        vacio={!cargando && !error && datos.length === 0}
        textoVacio="Sin oportunidades. Crea la primera: cada vencimiento de la competencia es una."
      />

      {/* Columnas por etapa */}
      {datos.length > 0 && (
        <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-3">
          {ETAPAS_PIPELINE.map((etapa) => {
            const lista = datos.filter((o) => o.etapa === etapa);
            return (
              <div key={etapa} className={`rounded-2xl border bg-surface/40 p-3 ${COLOR_ETAPA[etapa]}`}>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted mb-2">
                  {ETAPA_LABEL[etapa]} <span className="text-foreground">({lista.length})</span>
                </p>
                <div className="space-y-2">
                  {lista.map((o) => (
                    <div key={o.id} className="p-2.5 rounded-lg bg-card/70 border border-border/30 space-y-1.5">
                      <p className="text-sm font-semibold leading-tight">{o.nombre_contacto}</p>
                      <p className="text-[11px] text-muted">
                        {RAMO_LABEL[o.ramo]} · {fmtEur(Number(o.prima_estimada))}
                        {o.compania_actual && <> · ahora en {o.compania_actual}</>}
                      </p>
                      {o.fecha_prevista && (
                        <p className="text-[10px] text-amber-400">vence {fmtFecha(o.fecha_prevista)}</p>
                      )}
                      <select
                        value={o.etapa}
                        onChange={(e) => moverEtapa(o, e.target.value)}
                        className="w-full rounded-md border border-border/40 bg-background/60 px-1.5 py-1 text-[11px] font-semibold"
                      >
                        {ETAPAS_PIPELINE.map((et) => <option key={et} value={et}>{ETAPA_LABEL[et]}</option>)}
                      </select>
                    </div>
                  ))}
                  {lista.length === 0 && <p className="text-[11px] text-muted/50 text-center py-3">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
