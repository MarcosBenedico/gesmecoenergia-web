'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, X, Download } from 'lucide-react';
import {
  VctCliente, VctTarea, TIPOS_TAREA, TIPO_TAREA_LABEL, ESTADOS_TAREA, ESTADO_TAREA_LABEL,
  TAREAS_ABIERTAS, estadoTareaCanonico, diasHasta,
} from '@/lib/correbin';
import { BotonDescarga, Card, Kpi, Badge, BadgeVencimiento, EstadoCarga, useLista, guardar, inputCls, labelCls, btnPrimario, btnSecundario, SelectorResponsable } from '../ui';

const FORM_VACIO = { titulo: '', descripcion: '', cliente_id: '', tipo_tarea: 'llamar_cliente', fecha_limite: '', prioridad: 'media', responsable: '', estado: 'pendiente' };

export default function TareasPage() {
  const { datos, cargando, error, faltaMigracion, recargar } = useLista<VctTarea>('tareas');
  const clientes = useLista<VctCliente>('clientes');

  const [fEstado, setFEstado] = useState('abiertas');
  const [fResp, setFResp] = useState('');
  const [fCliente, setFCliente] = useState('');
  const [buscarCliente, setBuscarCliente] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [errorForm, setErrorForm] = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const responsables = useMemo(
    () => Array.from(new Set(datos.map((t) => t.responsable).filter(Boolean))) as string[],
    [datos]
  );

  const abiertas = datos.filter((t) => TAREAS_ABIERTAS.includes(t.estado));
  const vencidas = abiertas.filter((t) => { const d = diasHasta(t.fecha_limite); return d != null && d < 0; });
  const paraHoy = abiertas.filter((t) => diasHasta(t.fecha_limite) === 0);

  // Clientes con tareas (para el filtro por cliente), filtrados por el buscador
  const clientesConTarea = useMemo(() => {
    const ids = new Set(datos.map((t) => t.cliente_id).filter(Boolean));
    const lista = clientes.datos.filter((c) => ids.has(c.id));
    const q = buscarCliente.trim().toLowerCase();
    return q ? lista.filter((c) => c.nombre.toLowerCase().includes(q)) : lista;
  }, [datos, clientes.datos, buscarCliente]);

  const filtradas = useMemo(() => datos.filter((t) => {
    // El filtro de estado compara sobre el estado equivalente actual (los históricos
    // en_curso/completada/cancelada cuentan como pendiente/emitido/exclusión).
    if (fEstado === 'abiertas' && !TAREAS_ABIERTAS.includes(t.estado)) return false;
    if (fEstado !== 'abiertas' && fEstado && estadoTareaCanonico(t.estado) !== fEstado) return false;
    if (fResp && t.responsable !== fResp) return false;
    if (fCliente && t.cliente_id !== fCliente) return false;
    return true;
  }).sort((a, b) => (a.fecha_limite || '9999').localeCompare(b.fecha_limite || '9999')), [datos, fEstado, fResp, fCliente]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim()) { setErrorForm('Escribe la tarea.'); return; }
    setErrorForm('');
    const err = await guardar('tareas', 'POST', {
      ...form,
      cliente_id: form.cliente_id || null,
      fecha_limite: form.fecha_limite || null,
      responsable: form.responsable || null,
    });
    if (err) { setErrorForm(err); return; }
    setForm(FORM_VACIO); setMostrarForm(false);
    recargar();
  }

  async function cambiar(t: VctTarea, campos: Record<string, unknown>) {
    const err = await guardar('tareas', 'PUT', { id: t.id, ...campos });
    if (!err) recargar();
  }

  async function borrar(t: VctTarea) {
    if (!confirm(`¿Borrar la tarea "${t.titulo}"?`)) return;
    const err = await guardar('tareas', 'DELETE', { id: t.id });
    if (!err) recargar();
  }

  const selCls = 'rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 text-xs font-semibold';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Tareas y alertas</h2>
          <p className="text-xs text-muted mt-0.5">Que ningún vencimiento importante se quede sin acción.</p>
        </div>
        <div className="flex gap-2">
          <BotonDescarga href={`/api/correbin/exportar?tipo=tareas${fResp ? `&responsable=${encodeURIComponent(fResp)}` : ''}`} className={btnSecundario}>Exportar abiertas</BotonDescarga>
          <button onClick={() => setMostrarForm((v) => !v)} className={btnPrimario}>
            {mostrarForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {mostrarForm ? 'Cancelar' : 'Nueva tarea'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi valor={abiertas.length} etiqueta="Abiertas" />
        <Kpi valor={vencidas.length} etiqueta="Fuera de plazo" color={vencidas.length ? 'text-red-400' : 'text-emerald-400'} />
        <Kpi valor={paraHoy.length} etiqueta="Para hoy" color={paraHoy.length ? 'text-amber-400' : 'text-foreground'} />
      </div>

      {mostrarForm && (
        <Card>
          <form onSubmit={crear} className="space-y-3">
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Tipo de tarea</label>
                <select className={inputCls} value={form.tipo_tarea} onChange={set('tipo_tarea')}>
                  {TIPOS_TAREA.map((t) => <option key={t} value={t}>{TIPO_TAREA_LABEL[t]}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Descripción *</label>
                <input className={inputCls} value={form.titulo} onChange={set('titulo')} placeholder="Qué hay que hacer" />
              </div>
              <div>
                <label className={labelCls}>Cliente</label>
                <select className={inputCls} value={form.cliente_id} onChange={set('cliente_id')}>
                  <option value="">— Sin cliente —</option>
                  {clientes.datos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Fecha límite</label><input className={inputCls} type="date" value={form.fecha_limite} onChange={set('fecha_limite')} /></div>
              <div>
                <label className={labelCls}>Prioridad</label>
                <select className={inputCls} value={form.prioridad} onChange={set('prioridad')}>
                  <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Responsable</label>
                <SelectorResponsable valor={form.responsable} onCambio={(v) => setForm((f) => ({ ...f, responsable: v || '' }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Estado</label>
                <select className={inputCls} value={form.estado} onChange={set('estado')}>
                  {ESTADOS_TAREA.map((es) => <option key={es} value={es}>{ESTADO_TAREA_LABEL[es]}</option>)}
                </select>
              </div>
            </div>
            {errorForm && <p className="text-xs text-red-400">{errorForm}</p>}
            <button type="submit" className={btnPrimario}>Crear tarea</button>
          </form>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        {[['abiertas', 'Abiertas'], ...ESTADOS_TAREA.map((e) => [e, ESTADO_TAREA_LABEL[e]])].map(([v, n]) => (
          <button key={v} onClick={() => setFEstado(v!)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${fEstado === v ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}>
            {n}
          </button>
        ))}
        <select className={selCls} value={fResp} onChange={(e) => setFResp(e.target.value)}>
          <option value="">Responsable: todos</option>
          {responsables.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        {/* Filtro por cliente (buscador + selector) */}
        <input
          className={`${selCls} w-36`}
          value={buscarCliente}
          onChange={(e) => setBuscarCliente(e.target.value)}
          placeholder="Buscar cliente..."
        />
        <select className={`${selCls} max-w-52`} value={fCliente} onChange={(e) => setFCliente(e.target.value)}>
          <option value="">Cliente: todos</option>
          {fCliente && !clientesConTarea.some((c) => c.id === fCliente) && (
            <option value={fCliente}>{clientes.datos.find((c) => c.id === fCliente)?.nombre || 'Cliente'}</option>
          )}
          {clientesConTarea.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        {fCliente && (
          <button onClick={() => { setFCliente(''); setBuscarCliente(''); }} className="text-xs font-semibold text-accent hover:text-accent-light">
            ✕ Quitar cliente
          </button>
        )}
      </div>

      <EstadoCarga cargando={cargando} error={error} faltaMigracion={faltaMigracion}
        vacio={!cargando && !error && filtradas.length === 0} textoVacio="Sin tareas con este filtro. 👌" />

      {filtradas.length > 0 && (
        <div className="space-y-2">
          {filtradas.map((t) => {
            const abierta = TAREAS_ABIERTAS.includes(t.estado);
            return (
              <div key={t.id} className={`flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/40 flex-wrap ${!abierta ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={!abierta && estadoTareaCanonico(t.estado) === 'emitido'}
                    onChange={() => abierta && cambiar(t, { estado: 'emitido', hecho_en: new Date().toISOString() })}
                    className="accent-[#22c55e] w-4 h-4 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${estadoTareaCanonico(t.estado) === 'emitido' ? 'line-through' : ''}`}>
                      {TIPO_TAREA_LABEL[t.tipo_tarea]?.split(' ')[0] || '📌'} {t.titulo}
                    </p>
                    <p className="text-[11px] text-muted truncate">
                      {t.cliente_id
                        ? <Link href={`/gestor/correbin/clientes/${t.cliente_id}`} className="hover:text-accent">{t.vct_clientes?.nombre || 'Cliente'}</Link>
                        : 'Sin cliente'}
                      {t.descripcion ? ` · ${t.descripcion}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {abierta && t.prioridad === 'alta' && <Badge tono="rojo">alta</Badge>}
                  {abierta && <BadgeVencimiento fecha={t.fecha_limite} />}
                  <select
                    value={estadoTareaCanonico(t.estado)}
                    onChange={(e) => cambiar(t, { estado: e.target.value, ...(e.target.value === 'emitido' ? { hecho_en: new Date().toISOString() } : {}) })}
                    className={selCls}
                  >
                    {ESTADOS_TAREA.map((es) => <option key={es} value={es}>{ESTADO_TAREA_LABEL[es]}</option>)}
                  </select>
                  <SelectorResponsable valor={t.responsable} onCambio={(v) => cambiar(t, { responsable: v })} />
                  <button onClick={() => borrar(t)} className="text-muted hover:text-red-400 text-xs px-1" title="Borrar">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
