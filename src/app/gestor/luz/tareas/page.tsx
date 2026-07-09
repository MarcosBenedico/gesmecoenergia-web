'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, X, Download } from 'lucide-react';
import {
  LuzTarea, LuzCliente, TIPOS_TAREA, TIPO_TAREA_LABEL, ESTADOS_TAREA, ESTADO_TAREA_LABEL,
  TAREAS_ABIERTAS, diasHasta,
} from '@/lib/luz';
import { Card, Kpi, Badge, BadgeVencimiento, EstadoCarga, useListaLuz, guardarLuz, inputCls, labelCls, btnPrimario, btnSecundario, SelectorResponsable } from '../ui';

const FORM_VACIO = { descripcion: '', cliente_id: '', tipo_tarea: 'llamar_cliente', fecha_limite: '', prioridad: 'media', responsable: '' };

export default function TareasLuzPage() {
  const { datos, cargando, error, faltaMigracion, recargar } = useListaLuz<LuzTarea>('tareas');
  const clientes = useListaLuz<LuzCliente>('clientes');
  const [fEstado, setFEstado] = useState('abiertas');
  const [fResp, setFResp] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [errorForm, setErrorForm] = useState('');

  const responsables = useMemo(() => Array.from(new Set(datos.map((t) => t.responsable).filter(Boolean))) as string[], [datos]);
  const abiertas = datos.filter((t) => TAREAS_ABIERTAS.includes(t.estado));
  const vencidas = abiertas.filter((t) => (diasHasta(t.fecha_limite) ?? 1) < 0);

  const filtradas = useMemo(() => datos.filter((t) => {
    if (fEstado === 'abiertas' && !TAREAS_ABIERTAS.includes(t.estado)) return false;
    if (fEstado !== 'abiertas' && fEstado && t.estado !== fEstado) return false;
    if (fResp && t.responsable !== fResp) return false;
    return true;
  }).sort((a, b) => (a.fecha_limite || '9999').localeCompare(b.fecha_limite || '9999')), [datos, fEstado, fResp]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!form.descripcion.trim()) { setErrorForm('Escribe la tarea.'); return; }
    setErrorForm('');
    const err = await guardarLuz('tareas', 'POST', {
      ...form,
      cliente_id: form.cliente_id || null,
      fecha_limite: form.fecha_limite || null,
      responsable: form.responsable || null,
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
          <h2 className="text-xl font-black text-foreground">Tareas y Alertas</h2>
          <p className="text-xs text-muted mt-0.5">Qué hay que hacer y quién lo tiene que hacer. Las alertas viven en el Dashboard.</p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/luz/exportar?tipo=tareas${fResp ? `&responsable=${encodeURIComponent(fResp)}` : ''}`} className={btnSecundario} download>
            <Download className="w-4 h-4" /> Exportar abiertas
          </a>
          <button onClick={() => setMostrarForm((v) => !v)} className={btnPrimario}>
            {mostrarForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {mostrarForm ? 'Cancelar' : 'Nueva tarea'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi valor={abiertas.length} etiqueta="Abiertas" />
        <Kpi valor={vencidas.length} etiqueta="Fuera de plazo" color={vencidas.length ? 'text-red-400' : 'text-emerald-400'} />
        <Kpi valor={abiertas.filter((t) => diasHasta(t.fecha_limite) === 0).length} etiqueta="Para hoy" color="text-amber-400" />
      </div>

      {mostrarForm && (
        <Card>
          <form onSubmit={crear} className="space-y-3">
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Tipo</label>
                <select className={inputCls} value={form.tipo_tarea} onChange={(e) => setForm({ ...form, tipo_tarea: e.target.value })}>
                  {TIPOS_TAREA.map((t) => <option key={t} value={t}>{TIPO_TAREA_LABEL[t]}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Descripción *</label>
                <input className={inputCls} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Cliente</label>
                <select className={inputCls} value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
                  <option value="">— Sin cliente —</option>
                  {clientes.datos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Fecha límite</label><input className={inputCls} type="date" value={form.fecha_limite} onChange={(e) => setForm({ ...form, fecha_limite: e.target.value })} /></div>
              <div>
                <label className={labelCls}>Prioridad</label>
                <select className={inputCls} value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })}>
                  <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Responsable</label>
                <SelectorResponsable valor={form.responsable} onCambio={(v) => setForm((f) => ({ ...f, responsable: v || '' }))} className={inputCls} />
              </div>
            </div>
            {errorForm && <p className="text-xs text-red-400">{errorForm}</p>}
            <button type="submit" className={btnPrimario}>Crear tarea</button>
          </form>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        {[['abiertas', 'Abiertas'], ...ESTADOS_TAREA.map((e) => [e, ESTADO_TAREA_LABEL[e]])].map(([v, n]) => (
          <button key={v} onClick={() => setFEstado(v!)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${fEstado === v ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}>{n}</button>
        ))}
        <select className={selCls} value={fResp} onChange={(e) => setFResp(e.target.value)}>
          <option value="">Responsable: todos</option>
          {responsables.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <EstadoCarga cargando={cargando} error={error} faltaMigracion={faltaMigracion}
        vacio={!cargando && !error && filtradas.length === 0} textoVacio="Sin tareas con este filtro. 👌" sqlFile="supabase_luz.sql" />

      {filtradas.length > 0 && (
        <div className="space-y-2">
          {filtradas.map((t) => {
            const abierta = TAREAS_ABIERTAS.includes(t.estado);
            return (
              <div key={t.id} className={`flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/40 flex-wrap ${!abierta ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <input type="checkbox" checked={t.estado === 'completada'}
                    onChange={() => abierta && guardarLuz('tareas', 'PUT', { id: t.id, estado: 'completada' }).then(() => recargar())}
                    className="accent-[#22c55e] w-4 h-4 shrink-0" />
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${t.estado === 'completada' ? 'line-through' : ''}`}>
                      {TIPO_TAREA_LABEL[t.tipo_tarea]?.split(' ')[0] || '📌'} {t.descripcion}
                    </p>
                    <p className="text-[11px] text-muted truncate">
                      {t.cliente_id
                        ? <Link href={`/gestor/luz/clientes/${t.cliente_id}`} className="hover:text-accent">{t.luz_clientes?.nombre || 'Cliente'}</Link>
                        : 'Sin cliente'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {abierta && t.prioridad === 'alta' && <Badge tono="rojo">alta</Badge>}
                  {abierta && <BadgeVencimiento fecha={t.fecha_limite} />}
                  <select value={t.estado}
                    onChange={async (e) => { await guardarLuz('tareas', 'PUT', { id: t.id, estado: e.target.value }); recargar(); }}
                    className={selCls}>
                    {ESTADOS_TAREA.map((es) => <option key={es} value={es}>{ESTADO_TAREA_LABEL[es]}</option>)}
                  </select>
                  <SelectorResponsable valor={t.responsable} onCambio={async (v) => { await guardarLuz('tareas', 'PUT', { id: t.id, responsable: v }); recargar(); }} />
                  <button onClick={async () => { if (confirm('¿Borrar tarea?')) { await guardarLuz('tareas', 'DELETE', { id: t.id }); recargar(); } }} className="text-muted hover:text-red-400 text-xs px-1">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
