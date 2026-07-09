'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { VctCliente, VctTarea, diasHasta } from '@/lib/correbin';
import { Card, Kpi, Badge, BadgeVencimiento, EstadoCarga, useLista, guardar, inputCls, labelCls, btnPrimario } from '../ui';

const FORM_VACIO = { titulo: '', descripcion: '', cliente_id: '', fecha_limite: '', prioridad: 'media', responsable: '' };

export default function TareasPage() {
  const pendientes = useLista<VctTarea>('tareas', { estado: 'pendiente' });
  const hechas = useLista<VctTarea>('tareas', { estado: 'hecha', limite: '30' });
  const clientes = useLista<VctCliente>('clientes');

  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [errorForm, setErrorForm] = useState('');
  const [verHechas, setVerHechas] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const vencidas = pendientes.datos.filter((t) => { const d = diasHasta(t.fecha_limite); return d != null && d < 0; });
  const paraHoy = pendientes.datos.filter((t) => diasHasta(t.fecha_limite) === 0);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim()) { setErrorForm('Escribe la tarea.'); return; }
    setErrorForm('');
    const err = await guardar('tareas', 'POST', {
      ...form,
      cliente_id: form.cliente_id || null,
      fecha_limite: form.fecha_limite || null,
    });
    if (err) { setErrorForm(err); return; }
    setForm(FORM_VACIO);
    setMostrarForm(false);
    pendientes.recargar();
  }

  async function completar(t: VctTarea) {
    const err = await guardar('tareas', 'PUT', { id: t.id, estado: 'hecha', hecho_en: new Date().toISOString() });
    if (!err) { pendientes.recargar(); hechas.recargar(); }
  }

  async function borrar(t: VctTarea) {
    if (!confirm(`¿Borrar la tarea "${t.titulo}"?`)) return;
    const err = await guardar('tareas', 'DELETE', { id: t.id });
    if (!err) { pendientes.recargar(); hechas.recargar(); }
  }

  const FilaTarea = ({ t, hecha }: { t: VctTarea; hecha?: boolean }) => (
    <div className={`flex items-center justify-between gap-3 p-3 rounded-lg bg-card/60 ${hecha ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-3 min-w-0">
        <input
          type="checkbox"
          checked={!!hecha}
          onChange={() => !hecha && completar(t)}
          className="accent-[#22c55e] w-4 h-4 shrink-0"
        />
        <div className="min-w-0">
          <p className={`text-sm font-semibold truncate ${hecha ? 'line-through' : ''}`}>{t.titulo}</p>
          <p className="text-[11px] text-muted truncate">
            {t.cliente_id ? (
              <Link href={`/gestor/correbin/clientes/${t.cliente_id}`} className="hover:text-accent">
                {t.vct_clientes?.nombre || 'Cliente'}
              </Link>
            ) : 'Sin cliente'}
            {t.responsable ? ` · ${t.responsable}` : ''}
            {t.descripcion ? ` · ${t.descripcion}` : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!hecha && t.prioridad === 'alta' && <Badge tono="rojo">alta</Badge>}
        {!hecha && t.prioridad === 'baja' && <Badge>baja</Badge>}
        {!hecha && <BadgeVencimiento fecha={t.fecha_limite} />}
        <button onClick={() => borrar(t)} className="text-muted hover:text-red-400 text-xs px-1" title="Borrar">✕</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Tareas y alertas</h2>
          <p className="text-xs text-muted mt-0.5">Que ningún vencimiento importante se quede sin acción.</p>
        </div>
        <button onClick={() => setMostrarForm((v) => !v)} className={btnPrimario}>
          {mostrarForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {mostrarForm ? 'Cancelar' : 'Nueva tarea'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi valor={pendientes.datos.length} etiqueta="Pendientes" />
        <Kpi valor={vencidas.length} etiqueta="Fuera de plazo" color={vencidas.length > 0 ? 'text-red-400' : 'text-emerald-400'} />
        <Kpi valor={paraHoy.length} etiqueta="Para hoy" color={paraHoy.length > 0 ? 'text-amber-400' : 'text-foreground'} />
      </div>

      {mostrarForm && (
        <Card>
          <form onSubmit={crear} className="space-y-3">
            <div className="grid md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label className={labelCls}>Tarea *</label>
                <input className={inputCls} value={form.titulo} onChange={set('titulo')} placeholder="Llamar a ... antes del vencimiento" />
              </div>
              <div>
                <label className={labelCls}>Cliente</label>
                <select className={inputCls} value={form.cliente_id} onChange={set('cliente_id')}>
                  <option value="">— Sin cliente —</option>
                  {clientes.datos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Fecha límite</label>
                <input className={inputCls} type="date" value={form.fecha_limite} onChange={set('fecha_limite')} />
              </div>
              <div>
                <label className={labelCls}>Prioridad</label>
                <select className={inputCls} value={form.prioridad} onChange={set('prioridad')}>
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Responsable</label>
                <input className={inputCls} value={form.responsable} onChange={set('responsable')} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Detalle</label>
                <input className={inputCls} value={form.descripcion} onChange={set('descripcion')} />
              </div>
            </div>
            {errorForm && <p className="text-xs text-red-400">{errorForm}</p>}
            <button type="submit" className={btnPrimario}>Crear tarea</button>
          </form>
        </Card>
      )}

      <EstadoCarga
        cargando={pendientes.cargando}
        error={pendientes.error}
        faltaMigracion={pendientes.faltaMigracion}
        vacio={!pendientes.cargando && !pendientes.error && pendientes.datos.length === 0}
        textoVacio="Sin tareas pendientes. 👌"
      />

      {pendientes.datos.length > 0 && (
        <div className="space-y-2">
          {[...pendientes.datos]
            .sort((a, b) => (a.fecha_limite || '9999').localeCompare(b.fecha_limite || '9999'))
            .map((t) => <FilaTarea key={t.id} t={t} />)}
        </div>
      )}

      <button onClick={() => setVerHechas((v) => !v)} className="text-xs font-semibold text-muted hover:text-foreground transition">
        {verHechas ? '▾ Ocultar completadas' : `▸ Ver completadas (${hechas.datos.length})`}
      </button>
      {verHechas && (
        <div className="space-y-2">
          {hechas.datos.map((t) => <FilaTarea key={t.id} t={t} hecha />)}
        </div>
      )}
    </div>
  );
}
