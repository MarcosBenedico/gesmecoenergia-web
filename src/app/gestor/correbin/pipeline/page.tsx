'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, X, Download, TrendingUp } from 'lucide-react';
import {
  VctOportunidad, VctCliente, ETAPAS_PIPELINE, ETAPA_LABEL, RAMOS, RAMO_LABEL,
  PIPELINE_CERRADO, fmtEur0, fmtFecha,
} from '@/lib/correbin';
import { BotonDescarga, Card, Kpi, Badge, EstadoCarga, useLista, guardar, inputCls, labelCls, btnPrimario, btnSecundario, SelectorResponsable } from '../ui';

const COLOR_ETAPA: Record<string, string> = {
  prospecto: 'border-border/40', doc_solicitada: 'border-secondary/40', doc_recibida: 'border-blue-500/40',
  propuesta_enviada: 'border-amber-500/40', seguimiento: 'border-accent/40',
  cerrado_ganado: 'border-emerald-500/40', cerrado_perdido: 'border-red-500/30',
};

const FORM_VACIO = {
  cliente_id: '', nombre_contacto: '', telefono: '', ramo: 'otros', compania_actual: '',
  etapa: 'prospecto', prima_estimada: '', probabilidad: '50', proxima_accion: '',
  fecha_proxima_accion: '', responsable: '', notas: '',
};

export default function PipelinePage() {
  const { datos, cargando, error, faltaMigracion, recargar } = useLista<VctOportunidad>('oportunidades');
  const clientes = useLista<VctCliente>('clientes');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [errorForm, setErrorForm] = useState('');
  const [msg, setMsg] = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const abiertas = datos.filter((o) => !PIPELINE_CERRADO.includes(o.etapa));
  const sinAccion = abiertas.filter((o) => !o.proxima_accion);
  const primaJuego = abiertas.reduce((s, o) => s + (Number(o.prima_estimada) || 0), 0);
  const primaPonderada = abiertas.reduce((s, o) => s + (Number(o.prima_estimada) || 0) * ((o.probabilidad ?? 50) / 100), 0);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre_contacto.trim() && !form.cliente_id) { setErrorForm('Indica el contacto o elige un cliente.'); return; }
    setErrorForm('');
    const cliente = clientes.datos.find((c) => c.id === form.cliente_id);
    const err = await guardar('oportunidades', 'POST', {
      ...form,
      cliente_id: form.cliente_id || null,
      nombre_contacto: form.nombre_contacto || cliente?.nombre || '',
      prima_estimada: parseFloat(form.prima_estimada) || 0,
      probabilidad: parseInt(form.probabilidad) || 50,
      fecha_proxima_accion: form.fecha_proxima_accion || null,
    });
    if (err) { setErrorForm(err); return; }
    setForm(FORM_VACIO); setMostrarForm(false);
    recargar();
  }

  async function cambiar(o: VctOportunidad, campos: Record<string, unknown>) {
    const err = await guardar('oportunidades', 'PUT', { id: o.id, ...campos });
    if (!err) recargar();
  }

  /** Cerrado ganado → se convierte en producción nueva real. */
  async function convertirEnProduccion(o: VctOportunidad) {
    if (!confirm(`¿Convertir "${o.nombre_contacto}" (${fmtEur0(Number(o.prima_estimada))}) en producción nueva?`)) return;
    const err = await guardar('produccion', 'POST', {
      cliente_id: o.cliente_id,
      fecha_emision: new Date().toISOString().slice(0, 10),
      ramo: o.ramo,
      compania: null,
      prima: Number(o.prima_estimada) || 0,
      tipo_produccion: 'nueva',
      responsable: o.responsable,
      observaciones: `Convertida desde pipeline: ${o.nombre_contacto}${o.compania_actual ? ` (venía de ${o.compania_actual})` : ''}`,
    });
    if (err) { setMsg(err); return; }
    await guardar('oportunidades', 'PUT', { id: o.id, etapa: 'cerrado_ganado', resultado: 'Convertida en producción' });
    setMsg(`✓ Oportunidad convertida en producción nueva (${fmtEur0(Number(o.prima_estimada))}).`);
    recargar();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Pipeline comercial</h2>
          <p className="text-xs text-muted mt-0.5">Oportunidades vivas — NO es producción cerrada. Al ganar, se convierte en producción.</p>
        </div>
        <div className="flex gap-2">
          <BotonDescarga href="/api/correbin/exportar?tipo=pipeline" className={btnSecundario}>Exportar</BotonDescarga>
          <button onClick={() => setMostrarForm((v) => !v)} className={btnPrimario}>
            {mostrarForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {mostrarForm ? 'Cancelar' : 'Nueva oportunidad'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi valor={abiertas.length} etiqueta="Abiertas" color="text-secondary" />
        <Kpi valor={fmtEur0(primaJuego)} etiqueta="Prima en juego" color="text-amber-400" />
        <Kpi valor={fmtEur0(primaPonderada)} etiqueta="Ponderada por probabilidad" />
        <Kpi valor={sinAccion.length} etiqueta="⚠️ Sin próxima acción" color={sinAccion.length ? 'text-red-400' : 'text-emerald-400'} />
      </div>

      {msg && <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5">{msg}</p>}

      {mostrarForm && (
        <Card>
          <form onSubmit={crear} className="space-y-3">
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Cliente existente (opcional)</label>
                <select className={inputCls} value={form.cliente_id} onChange={set('cliente_id')}>
                  <option value="">— No es cliente aún —</option>
                  {clientes.datos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Contacto</label><input className={inputCls} value={form.nombre_contacto} onChange={set('nombre_contacto')} placeholder="Nombre si no es cliente" /></div>
              <div>
                <label className={labelCls}>Ramo</label>
                <select className={inputCls} value={form.ramo} onChange={set('ramo')}>
                  {RAMOS.map((r) => <option key={r} value={r}>{RAMO_LABEL[r]}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Compañía actual</label><input className={inputCls} value={form.compania_actual} onChange={set('compania_actual')} /></div>
              <div><label className={labelCls}>Prima estimada (€)</label><input className={inputCls} type="number" step="0.01" value={form.prima_estimada} onChange={set('prima_estimada')} /></div>
              <div><label className={labelCls}>Probabilidad (%)</label><input className={inputCls} type="number" min="0" max="100" value={form.probabilidad} onChange={set('probabilidad')} /></div>
              <div><label className={labelCls}>Próxima acción</label><input className={inputCls} value={form.proxima_accion} onChange={set('proxima_accion')} placeholder="Qué toca hacer" /></div>
              <div><label className={labelCls}>Fecha próx. acción</label><input className={inputCls} type="date" value={form.fecha_proxima_accion} onChange={set('fecha_proxima_accion')} /></div>
            </div>
            {errorForm && <p className="text-xs text-red-400">{errorForm}</p>}
            <button type="submit" className={btnPrimario}>Crear oportunidad</button>
          </form>
        </Card>
      )}

      <EstadoCarga cargando={cargando} error={error} faltaMigracion={faltaMigracion}
        vacio={!cargando && !error && datos.length === 0}
        textoVacio="Sin oportunidades. Cada vencimiento de la competencia es una." />

      {datos.length > 0 && (
        <div className="grid md:grid-cols-3 xl:grid-cols-7 gap-3">
          {ETAPAS_PIPELINE.map((etapa) => {
            const lista = datos.filter((o) => o.etapa === etapa || (etapa === 'prospecto' && ['contactado'].includes(o.etapa)) || (etapa === 'cerrado_ganado' && o.etapa === 'ganada') || (etapa === 'cerrado_perdido' && o.etapa === 'perdida'));
            return (
              <div key={etapa} className={`rounded-2xl border bg-surface/40 p-2.5 ${COLOR_ETAPA[etapa]}`}>
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-2">
                  {ETAPA_LABEL[etapa]} <span className="text-foreground">({lista.length})</span>
                </p>
                <div className="space-y-2">
                  {lista.map((o) => (
                    <div key={o.id} className="p-2.5 rounded-lg bg-card/70 border border-border/30 space-y-1.5">
                      <p className="text-xs font-semibold leading-tight">
                        {o.cliente_id
                          ? <Link href={`/gestor/correbin/clientes/${o.cliente_id}`} className="hover:text-accent">{o.vct_clientes?.nombre || o.nombre_contacto}</Link>
                          : o.nombre_contacto}
                      </p>
                      <p className="text-[10px] text-muted">
                        {RAMO_LABEL[o.ramo]} · {fmtEur0(Number(o.prima_estimada))} · {o.probabilidad ?? 50}%
                        {o.compania_actual && <> · en {o.compania_actual}</>}
                      </p>
                      {o.documentacion_recibida && <Badge tono="verde">doc ✓</Badge>}
                      {!PIPELINE_CERRADO.includes(o.etapa) && (
                        o.proxima_accion
                          ? <p className="text-[10px] text-secondary">→ {o.proxima_accion}{o.fecha_proxima_accion ? ` (${fmtFecha(o.fecha_proxima_accion)})` : ''}</p>
                          : <p className="text-[10px] text-red-400 font-bold">⚠️ SIN PRÓXIMA ACCIÓN</p>
                      )}
                      <select
                        value={o.etapa}
                        onChange={(e) => cambiar(o, { etapa: e.target.value })}
                        className="w-full rounded-md border border-border/40 bg-background/60 px-1.5 py-1 text-[10px] font-semibold"
                      >
                        {ETAPAS_PIPELINE.map((et) => <option key={et} value={et}>{ETAPA_LABEL[et]}</option>)}
                      </select>
                      {!PIPELINE_CERRADO.includes(o.etapa) && (
                        <input
                          className="w-full rounded-md border border-border/40 bg-background/60 px-1.5 py-1 text-[10px]"
                          defaultValue={o.proxima_accion || ''}
                          placeholder="próxima acción..."
                          onBlur={(e) => e.target.value !== (o.proxima_accion || '') && cambiar(o, { proxima_accion: e.target.value || null })}
                        />
                      )}
                      {(o.etapa === 'cerrado_ganado' || o.etapa === 'ganada') && o.resultado !== 'Convertida en producción' && (
                        <button
                          onClick={() => convertirEnProduccion(o)}
                          className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-500 transition"
                        >
                          <TrendingUp className="w-3 h-3" /> Convertir en producción
                        </button>
                      )}
                    </div>
                  ))}
                  {lista.length === 0 && <p className="text-[10px] text-muted/40 text-center py-2">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
