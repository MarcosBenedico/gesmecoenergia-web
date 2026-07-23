'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import {
  LuzCliente, LuzOportunidad, LuzTarea, LuzVisita, PRIORIDADES, PRIORIDAD_LABEL,
  ESTADO_PIPELINE_LABEL, TIPOS_TAREA, TIPO_TAREA_LABEL, TAREAS_ABIERTAS,
  ResponsableEquipo, responsableSugerido, MOTIVOS_ELIMINACION, diasHasta, fmtFecha,
} from '@/lib/luz';
import {
  Card, Badge, BadgePrioridad, BadgeVencimiento, guardarLuz, useListaLuz,
  inputCls, labelCls, btnPrimario, btnSecundario, SelectorResponsable,
} from '../../ui';
import { PedirMotivo } from '../../motivo';
import { supabase } from '@/lib/supabase';

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


/* ══════════════ Historial de modificaciones del cliente (auditoría) ══════════════ */
interface RegistroAud { id: string; usuario: string | null; accion: string; antes: Record<string, unknown> | null; despues: Record<string, unknown> | null; creado_en: string }
const CAMPOS_OCULTOS = new Set(['actualizado_en', 'creado_en', 'id']);

export function HistorialCliente({ clienteId }: { clienteId: string }) {
  const [registros, setRegistros] = useState<RegistroAud[]>([]);
  const [visible, setVisible] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    supabase.from('app_auditoria')
      .select('id, usuario, accion, antes, despues, creado_en')
      .eq('tabla', 'luz_clientes').eq('registro_id', clienteId)
      .order('creado_en', { ascending: false }).limit(50)
      .then(({ data, error }) => {
        if (!error && data) { setRegistros(data as RegistroAud[]); setVisible(true); }
      });
  }, [clienteId]);

  if (!visible || registros.length === 0) return null;

  function cambios(r: RegistroAud): string[] {
    if (r.accion !== 'UPDATE' || !r.antes || !r.despues) return [];
    const out: string[] = [];
    for (const k of Object.keys(r.despues)) {
      if (CAMPOS_OCULTOS.has(k)) continue;
      if (JSON.stringify(r.antes[k] ?? null) !== JSON.stringify(r.despues[k] ?? null)) {
        const f = (v: unknown) => (v == null || v === '' ? 'vacío' : String(v).slice(0, 40));
        out.push(k.replace(/_/g, ' ') + ': ' + f(r.antes[k]) + ' → ' + f(r.despues[k]));
      }
    }
    return out;
  }

  return (
    <Card className="lg:col-span-2">
      <button onClick={() => setAbierto((v) => !v)} className="w-full text-left font-bold text-foreground text-sm">
        {abierto ? '▾' : '▸'} 🕓 Historial de modificaciones ({registros.length})
      </button>
      {abierto && (
        <div className="mt-2 divide-y divide-border/20">
          {registros.map((r) => {
            const cs = cambios(r);
            return (
              <div key={r.id} className="py-2 flex items-start gap-3 text-xs">
                <span className="shrink-0 text-[10px] text-muted tabular-nums w-28">{new Date(r.creado_en).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                <span className={`shrink-0 px-1.5 py-0.5 rounded-full border text-[9px] font-bold ${r.accion === 'INSERT' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'}`}>
                  {r.accion === 'INSERT' ? 'Alta' : 'Cambio'}
                </span>
                <span className="min-w-0 flex-1 text-muted leading-relaxed">
                  {r.accion === 'INSERT' ? 'Cliente dado de alta.' : cs.length ? cs.slice(0, 5).join(' · ') : 'Actualización'}
                </span>
                <span className="shrink-0 text-[10px] text-secondary">{r.usuario || 'sistema'}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ══════════════ Visitas y fotovoltaica: conectado con el mapa de rutas y el pipeline ══════════════ */
export function VisitasYFV({ cliente, oportunidades, onRecargar }: {
  cliente: LuzCliente;
  oportunidades: LuzOportunidad[];
  onRecargar: () => void;
}) {
  const visitas = useListaLuz<LuzVisita>('visitas', { cliente_id: cliente.id });
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState('');
  const [nueva, setNueva] = useState<{ fecha: string; notas: string } | null>(null);

  const HOY = new Date().toISOString().slice(0, 10);
  const opFV = oportunidades.find((o) => o.tipo_oportunidad === 'derivacion_fotovoltaica' && o.estado !== 'perdido') || null;
  const visitadoHoy = visitas.datos.some((v) => v.fecha === HOY);

  async function marcarInteresFV() {
    setGuardando(true); setErr('');
    const e = await guardarLuz('pipeline', 'POST', {
      cliente_id: cliente.id,
      nombre_oportunidad: `${cliente.nombre} · Derivación fotovoltaica`,
      tipo_oportunidad: 'derivacion_fotovoltaica',
      estado: 'prospecto',
      responsable: cliente.responsable || null,
      observaciones: 'Interés marcado desde la ficha del cliente',
    });
    setGuardando(false);
    if (e) { setErr(e); return; }
    onRecargar();
  }

  async function quitarInteresFV() {
    if (!opFV) return;
    if (!confirm('¿Quitar el interés en fotovoltaica? La oportunidad del pipeline pasará a "Perdido".')) return;
    setGuardando(true); setErr('');
    const e = await guardarLuz('pipeline', 'PUT', {
      id: opFV.id,
      estado: 'perdido',
      motivo_perdida: 'Sin interés en fotovoltaica (quitado desde la ficha del cliente)',
    });
    setGuardando(false);
    if (e) { setErr(e); return; }
    onRecargar();
  }

  async function registrarVisita(fecha: string, notas: string) {
    setGuardando(true); setErr('');
    const e = await guardarLuz('visitas', 'POST', {
      cliente_id: cliente.id,
      fecha,
      notas: notas || null,
      responsable: cliente.responsable || null,
    });
    setGuardando(false);
    if (e) { setErr(e); return; }
    setNueva(null);
    visitas.recargar();
    onRecargar(); // el "último contacto" del cliente avanza en el servidor
  }

  async function borrarVisita(id: string) {
    if (!confirm('¿Eliminar esta visita del historial?')) return;
    const e = await guardarLuz('visitas', 'DELETE', { id });
    if (e) { setErr(e); return; }
    visitas.recargar();
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="font-bold text-foreground">Visitas y fotovoltaica</h3>
        <div className="flex items-center gap-2">
          {!visitadoHoy && (
            <button onClick={() => registrarVisita(HOY, '')} disabled={guardando} className={btnSecundario}>
              ✓ Visitado hoy
            </button>
          )}
          <button onClick={() => setNueva(nueva ? null : { fecha: HOY, notas: '' })} className={btnSecundario}>
            <Plus className="w-3.5 h-3.5" /> Visita con fecha
          </button>
        </div>
      </div>

      {/* Interés en fotovoltaica: mismo dato que pinta el pin amarillo ☀️ en el mapa de rutas */}
      <div className={`flex items-center justify-between gap-2 flex-wrap rounded-xl border p-3 mb-3 ${
        opFV ? 'border-yellow-500/40 bg-yellow-500/10' : 'border-border/40 bg-card/40'
      }`}>
        <div className="text-xs">
          {opFV ? (
            <>
              <p className="font-bold text-yellow-300">☀️ Interesado en fotovoltaica</p>
              <p className="text-muted mt-0.5">
                Oportunidad en pipeline: {ESTADO_PIPELINE_LABEL[opFV.estado] || opFV.estado}. En el mapa de rutas sale con pin amarillo.
              </p>
            </>
          ) : (
            <p className="text-muted">Sin interés en fotovoltaica registrado.</p>
          )}
        </div>
        {opFV ? (
          <button onClick={quitarInteresFV} disabled={guardando} className={btnSecundario}>✕ Quitar interés</button>
        ) : (
          <button onClick={marcarInteresFV} disabled={guardando} className={btnSecundario}>☀️ Marcar interesado</button>
        )}
      </div>

      {err && <p className="text-xs text-red-400 mb-2">{err}</p>}

      {nueva && (
        <form
          onSubmit={(e) => { e.preventDefault(); registrarVisita(nueva.fecha, nueva.notas); }}
          className="flex items-end gap-2 flex-wrap rounded-xl border border-border/40 bg-card/40 p-3 mb-3"
        >
          <div>
            <label className={labelCls}>Fecha de la visita</label>
            <input type="date" required className={inputCls} value={nueva.fecha} max={HOY}
              onChange={(e) => setNueva({ ...nueva, fecha: e.target.value })} />
          </div>
          <div className="flex-1 min-w-40">
            <label className={labelCls}>Notas (opcional)</label>
            <input className={inputCls} value={nueva.notas} placeholder="Cómo fue la visita..."
              onChange={(e) => setNueva({ ...nueva, notas: e.target.value })} />
          </div>
          <button type="submit" disabled={guardando} className={btnPrimario}>Guardar</button>
          <button type="button" onClick={() => setNueva(null)} className={btnSecundario}><X className="w-3.5 h-3.5" /></button>
        </form>
      )}

      {visitas.faltaMigracion ? (
        <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
          ⚠️ Falta crear la tabla de visitas: ejecuta <b>supabase_visitas.sql</b> en el SQL Editor de Supabase.
        </p>
      ) : visitas.datos.length === 0 ? (
        <p className="text-xs text-muted text-center py-2">Sin visitas registradas todavía.</p>
      ) : (
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {visitas.datos.map((v) => (
            <div key={v.id} className="flex items-center gap-2 p-2 rounded-lg bg-card/50 border border-border/20 text-xs">
              <span className={`font-bold shrink-0 ${v.fecha === HOY ? 'text-emerald-400' : ''}`}>
                {v.fecha === HOY ? '✓ Hoy' : fmtFecha(v.fecha)}
              </span>
              <span className="text-muted truncate flex-1">{v.notas || '—'}</span>
              {v.responsable && <Badge tono="muted">{v.responsable}</Badge>}
              <button onClick={() => borrarVisita(v.id)} className="text-muted hover:text-red-400 shrink-0" title="Eliminar visita">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
