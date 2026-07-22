'use client';

import { useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import {
  LuzCliente, LuzOportunidad, LuzTarea, PRIORIDADES, PRIORIDAD_LABEL,
  ESTADO_PIPELINE_LABEL, TIPOS_TAREA, TIPO_TAREA_LABEL, TAREAS_ABIERTAS,
  ResponsableEquipo, responsableSugerido, MOTIVOS_ELIMINACION, diasHasta, fmtFecha,
} from '@/lib/luz';
import {
  Card, Badge, BadgePrioridad, BadgeVencimiento, guardarLuz, useListaLuz,
  inputCls, labelCls, btnPrimario, btnSecundario, SelectorResponsable,
} from '../../ui';
import { PedirMotivo } from '../../motivo';

/* ══════════════ Próxima acción: dato único sincronizado con el Pipeline ══════════════ */
export function ProximaAccion({ cliente, oportunidades, onGuardado }: {
  cliente: LuzCliente;
  oportunidades: LuzOportunidad[];
  onGuardado: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState({ proxima_accion: '', fecha_proxima_accion: '', responsable: '', estado: '', prioridad: '' });
  const [err, setErr] = useState('');

  const abierta = oportunidades.find((o) => !['ganado', 'perdido', 'revisar_adelante'].includes(o.estado)) || null;
  const accion = abierta?.proxima_accion ?? cliente.proxima_accion;
  const fecha = abierta?.fecha_proxima_accion ?? cliente.fecha_proxima_accion;
  const dias = diasHasta(fecha);

  function abrir() {
    setF({
      proxima_accion: accion || '',
      fecha_proxima_accion: fecha || '',
      responsable: abierta?.responsable || cliente.responsable || '',
      estado: abierta?.estado || '',
      prioridad: cliente.prioridad || 'C',
    });
    setEditando(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    // Se guarda en el cliente y la API lo espeja en la oportunidad abierta (y viceversa).
    const e1 = await guardarLuz('clientes', 'PUT', {
      id: cliente.id,
      proxima_accion: f.proxima_accion || null,
      fecha_proxima_accion: f.fecha_proxima_accion || null,
      prioridad: f.prioridad,
      ...(f.responsable ? { responsable: f.responsable } : {}),
    });
    if (e1) { setErr(e1); return; }
    if (abierta && (f.estado !== abierta.estado || (f.responsable && f.responsable !== abierta.responsable))) {
      const e2 = await guardarLuz('pipeline', 'PUT', {
        id: abierta.id,
        ...(f.estado && f.estado !== abierta.estado ? { estado: f.estado } : {}),
        ...(f.responsable ? { responsable: f.responsable } : {}),
      });
      if (e2) { setErr(e2); return; }
    }
    setEditando(false);
    onGuardado();
  }

  const urgencia = dias == null ? '' : dias < 0 ? '!border-red-500/40 !bg-red-500/5' : dias <= 3 ? '!border-amber-500/40 !bg-amber-500/5' : '';

  return (
    <Card className={urgencia}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <h3 className="font-bold text-foreground flex items-center gap-2 flex-wrap">
          🎯 Próxima acción
          {abierta && <Badge tono="accent">{ESTADO_PIPELINE_LABEL[abierta.estado]} · sincronizada con Pipeline</Badge>}
        </h3>
        {!editando && <button onClick={abrir} className={btnSecundario}><Pencil className="w-4 h-4" /> {accion ? 'Editar' : 'Definir'}</button>}
      </div>

      {!editando ? (
        accion ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-semibold text-foreground">→ {accion}</p>
            <div className="flex items-center gap-2 flex-wrap">
              {fecha && <BadgeVencimiento fecha={fecha} />}
              <Badge>{abierta?.responsable || cliente.responsable || 'Sin asignar'}</Badge>
              <BadgePrioridad prioridad={cliente.prioridad} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-amber-400 font-semibold">⚠️ Este cliente no tiene próxima acción definida.</p>
        )
      ) : (
        <form onSubmit={guardar} className="space-y-3 mt-2">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className={labelCls}>¿Cuál es el siguiente paso? *</label>
              <input className={inputCls} value={f.proxima_accion} onChange={(e) => setF({ ...f, proxima_accion: e.target.value })}
                placeholder="Llamar al cliente, pedir factura, enviar comparativa, revisar permanencia..." autoFocus />
            </div>
            <div><label className={labelCls}>Fecha prevista</label><input className={inputCls} type="date" value={f.fecha_proxima_accion} onChange={(e) => setF({ ...f, fecha_proxima_accion: e.target.value })} /></div>
            <div>
              <label className={labelCls}>Responsable</label>
              <SelectorResponsable valor={f.responsable} onCambio={(v) => setF((x) => ({ ...x, responsable: v || '' }))} className={inputCls} />
            </div>
            {abierta && (
              <div>
                <label className={labelCls}>Etapa en el pipeline</label>
                <select className={inputCls} value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>
                  {Object.entries(ESTADO_PIPELINE_LABEL).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className={labelCls}>Prioridad del cliente</label>
              <select className={inputCls} value={f.prioridad} onChange={(e) => setF({ ...f, prioridad: e.target.value })}>
                {PRIORIDADES.map((p) => <option key={p} value={p}>{PRIORIDAD_LABEL[p]}</option>)}
              </select>
            </div>
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
          <div className="flex gap-2">
            <button type="submit" className={btnPrimario}>Guardar</button>
            <button type="button" onClick={() => setEditando(false)} className={btnSecundario}>Cancelar</button>
          </div>
        </form>
      )}
    </Card>
  );
}

/* ══════════════ Tareas del cliente: gestión completa + historial ══════════════ */
const TAREA_NUEVA = { descripcion: '', tipo_tarea: 'llamar_cliente', fecha_limite: '', prioridad: 'media', responsable: '', notas: '' };
type FormTareaT = typeof TAREA_NUEVA;

function FormTarea({ f, setF, onOk, onCancelar }: {
  f: FormTareaT; setF: (x: FormTareaT) => void;
  onOk: () => void; onCancelar: () => void;
}) {
  return (
    <div className="mb-3 p-3 rounded-xl bg-background/40 border border-border/30 space-y-2">
      <input className={inputCls} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} placeholder="Descripción *" />
      <div className="grid grid-cols-2 gap-2">
        <select className={inputCls} value={f.tipo_tarea} onChange={(e) => setF({ ...f, tipo_tarea: e.target.value })}>
          {TIPOS_TAREA.map((t) => <option key={t} value={t}>{TIPO_TAREA_LABEL[t]}</option>)}
        </select>
        <input className={inputCls} type="date" value={f.fecha_limite} onChange={(e) => setF({ ...f, fecha_limite: e.target.value })} />
        <select className={inputCls} value={f.prioridad} onChange={(e) => setF({ ...f, prioridad: e.target.value })}>
          <option value="alta">🔴 Alta</option><option value="media">🟡 Media</option><option value="baja">⚪ Baja</option>
        </select>
        <SelectorResponsable valor={f.responsable} onCambio={(v) => setF({ ...f, responsable: v || '' })} className={inputCls} />
      </div>
      <textarea className={`${inputCls} resize-none`} rows={2} value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} placeholder="Notas o comentarios (opcional)" />
      <div className="flex gap-2">
        <button type="button" onClick={onOk} className={btnPrimario}>Guardar</button>
        <button type="button" onClick={onCancelar} className={btnSecundario}>Cancelar</button>
      </div>
    </div>
  );
}

export function TareasCliente({ clienteId, tareas, recargar, clienteResponsable, setMsg }: {
  clienteId: string;
  tareas: LuzTarea[];
  recargar: () => void;
  clienteResponsable: string | null;
  setMsg: (m: string) => void;
}) {
  const [formNueva, setFormNueva] = useState<FormTareaT | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [fEdit, setFEdit] = useState<FormTareaT>(TAREA_NUEVA);
  const [verHistorial, setVerHistorial] = useState(false);
  const equipo = useListaLuz<ResponsableEquipo>('responsables', { activo: 'true' });

  const abiertas = tareas.filter((t) => TAREAS_ABIERTAS.includes(t.estado));
  const historial = tareas.filter((t) => !TAREAS_ABIERTAS.includes(t.estado))
    .sort((a, b) => (b.actualizado_en || '').localeCompare(a.actualizado_en || ''));

  // Eliminar con motivo: queda registrado en el Control General
  const [pidiendoBorrado, setPidiendoBorrado] = useState<LuzTarea | null>(null);

  async function confirmarBorrado(motivo: string) {
    if (!pidiendoBorrado) return;
    const t = pidiendoBorrado;
    const nota = `[Eliminada ${new Date().toLocaleDateString('es-ES')}] Motivo: ${motivo}`;
    await guardarLuz('tareas', 'PUT', { id: t.id, notas: t.notas ? `${t.notas}\n${nota}` : nota });
    const err = await guardarLuz('tareas', 'DELETE', { id: t.id });
    if (err) setMsg(err);
    setPidiendoBorrado(null);
    recargar();
  }

  async function guardarTarea(id: string | null, f: FormTareaT) {
    if (!f.descripcion.trim()) { setMsg('Escribe la descripción de la tarea.'); return false; }
    // Reparto automático: si no se elige responsable, las tareas administrativas
    // van a administración (Nicola) y las comerciales al comercial del cliente.
    const sugerido = !id && !f.responsable ? responsableSugerido(f.tipo_tarea, equipo.datos) : null;
    const body = {
      descripcion: f.descripcion.trim(),
      tipo_tarea: f.tipo_tarea,
      fecha_limite: f.fecha_limite || null,
      prioridad: f.prioridad,
      responsable: f.responsable || sugerido?.nombre || clienteResponsable || null,
      notas: f.notas || null,
    };
    const err = id
      ? await guardarLuz('tareas', 'PUT', { id, ...body })
      : await guardarLuz('tareas', 'POST', { ...body, cliente_id: clienteId });
    if (err) { setMsg(err.toLowerCase().includes('notas') ? 'Falta la columna "notas": ejecuta supabase_equipo_usuarios.sql en el SQL Editor de Supabase.' : err); return false; }
    setMsg('');
    recargar();
    return true;
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-foreground">Tareas ({abiertas.length})</h3>
        <button onClick={() => { setEditId(null); setFormNueva(formNueva ? null : { ...TAREA_NUEVA, responsable: clienteResponsable || '' }); }} className={btnSecundario}>
          {formNueva ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Tarea
        </button>
      </div>

      {formNueva && (
        <FormTarea f={formNueva} setF={setFormNueva}
          onOk={async () => { if (await guardarTarea(null, formNueva)) setFormNueva(null); }}
          onCancelar={() => setFormNueva(null)} />
      )}

      {abiertas.length === 0 && !formNueva && <p className="text-sm text-muted text-center py-3">Sin tareas abiertas.</p>}

      <div className="space-y-1.5">
        {abiertas.map((t) => (
          <div key={t.id} className="p-2.5 rounded-lg bg-card/60">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <input type="checkbox" checked={false}
                  onChange={async () => { await guardarLuz('tareas', 'PUT', { id: t.id, estado: 'completada' }); recargar(); }}
                  className="accent-[#22c55e] w-4 h-4 shrink-0" title="Marcar como completada" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{TIPO_TAREA_LABEL[t.tipo_tarea]?.split(' ')[0]} {t.descripcion}</p>
                  {t.notas && <p className="text-[10px] text-muted truncate">💬 {t.notas}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {t.prioridad === 'alta' && <Badge tono="rojo">alta</Badge>}
                {t.responsable && <Badge>{t.responsable}</Badge>}
                {t.fecha_limite && <BadgeVencimiento fecha={t.fecha_limite} />}
                <button
                  onClick={() => {
                    if (editId === t.id) { setEditId(null); return; }
                    setFormNueva(null);
                    setFEdit({
                      descripcion: t.descripcion, tipo_tarea: t.tipo_tarea, fecha_limite: t.fecha_limite || '',
                      prioridad: t.prioridad || 'media', responsable: t.responsable || '', notas: t.notas || '',
                    });
                    setEditId(t.id);
                  }}
                  className="text-muted hover:text-accent transition" title="Editar tarea"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPidiendoBorrado(t)}
                  className="text-muted hover:text-red-400 text-xs transition" title="Eliminar"
                >✕</button>
              </div>
            </div>
            {editId === t.id && (
              <div className="mt-2">
                <FormTarea f={fEdit} setF={setFEdit}
                  onOk={async () => { if (await guardarTarea(t.id, fEdit)) setEditId(null); }}
                  onCancelar={() => setEditId(null)} />
              </div>
            )}
          </div>
        ))}
      </div>

      {historial.length > 0 && (
        <div className="mt-3 pt-2 border-t border-border/30">
          <button onClick={() => setVerHistorial((v) => !v)} className="text-xs font-bold text-muted hover:text-foreground transition">
            {verHistorial ? '▾' : '▸'} Historial ({historial.length})
          </button>
          {verHistorial && (
            <div className="space-y-1 mt-2">
              {historial.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-card/40 opacity-70">
                  <p className="text-[11px] truncate line-through">{TIPO_TAREA_LABEL[t.tipo_tarea]?.split(' ')[0]} {t.descripcion}</p>
                  <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-muted">
                    <span>{t.estado === 'completada' ? '✓' : t.estado} · {fmtFecha(t.actualizado_en)}</span>
                    <button
                      onClick={async () => { await guardarLuz('tareas', 'PUT', { id: t.id, estado: 'pendiente' }); recargar(); }}
                      className="text-accent hover:underline" title="Reabrir"
                    >reabrir</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {pidiendoBorrado && (
        <PedirMotivo
          titulo="¿Por qué se elimina esta tarea?"
          subtitulo={`"${pidiendoBorrado.descripcion}" — el motivo queda registrado en el Control General.`}
          sugerencias={MOTIVOS_ELIMINACION}
          onGuardar={confirmarBorrado}
          onCancelar={() => setPidiendoBorrado(null)}
        />
      )}
    </Card>
  );
}
