'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, Plus, Pencil, X } from 'lucide-react';
import {
  VctCliente, VctPoliza, VctTarea, VctVencimiento, VctOportunidad, VctProduccion,
  VctAnulacion, VctCambioMediador,
  RAMOS, RAMO_LABEL, PRIORIDADES, PRIORIDAD_LABEL, SEGMENTOS, SEGMENTO_LABEL,
  ESTADO_POLIZA_LABEL, ESTADOS_CARTERA_VIVA, ESTADO_VCT_LABEL, TIPO_PRODUCCION_LABEL,
  TIPO_ANULACION_LABEL, ESTADO_CM_LABEL, ETAPA_LABEL, TIPOS_TAREA, TIPO_TAREA_LABEL,
  ETAPAS_PIPELINE, TAREAS_ABIERTAS, fmtEur0, fmtFecha, diasHasta,
} from '@/lib/correbin';
import {
  Card, Badge, BadgePrioridad, BadgeSegmento, BadgeVencimiento, EstadoCarga,
  useLista, guardar, inputCls, labelCls, btnPrimario, btnSecundario, SelectorResponsable,
} from '../../ui';

const POLIZA_VACIA = {
  numero_poliza: '', ramo: 'hogar', compania: '', prima_anual: '', comision: '',
  fecha_efecto: '', fecha_vencimiento: '', forma_pago: 'anual', responsable: '', notas: '',
};

export default function FichaCliente() {
  const params = useParams<{ id: string }>();
  const clienteId = params.id;

  const clientes = useLista<VctCliente>('clientes');
  const cliente = clientes.datos.find((c) => c.id === clienteId) || null;

  const polizas = useLista<VctPoliza>('polizas', { cliente_id: clienteId });
  const vencimientos = useLista<VctVencimiento>('vencimientos', { cliente_id: clienteId });
  const tareas = useLista<VctTarea>('tareas', { cliente_id: clienteId });
  const pipeline = useLista<VctOportunidad>('oportunidades', { cliente_id: clienteId });
  const produccion = useLista<VctProduccion>('produccion', { cliente_id: clienteId });
  const anulaciones = useLista<VctAnulacion>('anulaciones', { cliente_id: clienteId });
  const mediador = useLista<VctCambioMediador>('cambios_mediador', { cliente_id: clienteId });

  const [editando, setEditando] = useState(false);
  const [formCliente, setFormCliente] = useState<Record<string, string>>({});
  const [formPoliza, setFormPoliza] = useState<typeof POLIZA_VACIA | null>(null);
  const [formTarea, setFormTarea] = useState<{ titulo: string; tipo_tarea: string; fecha_limite: string; responsable: string } | null>(null);
  const [formOportunidad, setFormOportunidad] = useState<{ ramo: string; prima_estimada: string; proxima_accion: string; fecha_proxima_accion: string } | null>(null);
  const [msg, setMsg] = useState('');

  // ¿Trabajado o abandonado? — última actividad registrada
  const ultimaActividad = useMemo(() => {
    const fechas: string[] = [
      ...tareas.datos.map((t) => t.fecha_limite || ''),
      ...vencimientos.datos.map((v) => v.fecha_ultimo_contacto || ''),
      ...produccion.datos.map((p) => p.fecha_emision),
    ].filter(Boolean);
    return fechas.length ? fechas.sort().reverse()[0] : null;
  }, [tareas.datos, vencimientos.datos, produccion.datos]);

  const tareasAbiertas = tareas.datos.filter((t) => TAREAS_ABIERTAS.includes(t.estado));
  const trabajado = tareasAbiertas.length > 0 || vencimientos.datos.some((v) => v.proxima_accion);

  const polizasVivas = polizas.datos.filter((p) => ESTADOS_CARTERA_VIVA.includes(p.estado));
  const primaTotal = polizasVivas.reduce((s, p) => s + (Number(p.prima_anual) || 0), 0);
  const comisionTotal = polizasVivas.reduce((s, p) => s + (Number(p.comision) || 0), 0);

  function empezarEdicion() {
    if (!cliente) return;
    setFormCliente({
      nombre: cliente.nombre || '', nif: cliente.nif || '', telefono: cliente.telefono || '',
      email: cliente.email || '', direccion: cliente.direccion || '', poblacion: cliente.poblacion || '',
      contacto_principal: cliente.contacto_principal || '', prioridad: cliente.prioridad || 'C',
      segmento: cliente.segmento || 'particular_ordinario', potencial_comercial: cliente.potencial_comercial || '',
      origen: cliente.origen || '', notas: cliente.notas || '',
    });
    setEditando(true);
  }

  async function guardarCliente(e: React.FormEvent) {
    e.preventDefault();
    const err = await guardar('clientes', 'PUT', { id: clienteId, ...formCliente });
    if (err) { setMsg(err); return; }
    setEditando(false); setMsg('');
    clientes.recargar();
  }

  async function cambiarCliente(campos: Record<string, unknown>) {
    const err = await guardar('clientes', 'PUT', { id: clienteId, ...campos });
    if (!err) clientes.recargar();
  }

  async function crearPoliza(e: React.FormEvent) {
    e.preventDefault();
    if (!formPoliza || !formPoliza.compania.trim()) { setMsg('La compañía es obligatoria.'); return; }
    const err = await guardar('polizas', 'POST', {
      ...formPoliza,
      cliente_id: clienteId,
      prima_anual: parseFloat(formPoliza.prima_anual) || 0,
      comision: parseFloat(formPoliza.comision) || 0,
      fecha_efecto: formPoliza.fecha_efecto || null,
      fecha_vencimiento: formPoliza.fecha_vencimiento || null,
      estado: !parseFloat(formPoliza.prima_anual) || !formPoliza.fecha_vencimiento ? 'sin_datos' : 'activa',
    });
    if (err) { setMsg(err); return; }
    setFormPoliza(null); setMsg('');
    polizas.recargar();
    // actualizar totales
    cambiarCliente({ prima_total: primaTotal + (parseFloat(formPoliza.prima_anual) || 0), comision_total: comisionTotal + (parseFloat(formPoliza.comision) || 0) });
  }

  async function crearTarea(e: React.FormEvent) {
    e.preventDefault();
    if (!formTarea?.titulo.trim()) return;
    const err = await guardar('tareas', 'POST', {
      ...formTarea,
      cliente_id: clienteId,
      fecha_limite: formTarea.fecha_limite || null,
      responsable: formTarea.responsable || cliente?.responsable || null,
    });
    if (err) { setMsg(err); return; }
    setFormTarea(null);
    tareas.recargar();
  }

  async function crearOportunidad(e: React.FormEvent) {
    e.preventDefault();
    if (!formOportunidad) return;
    const err = await guardar('oportunidades', 'POST', {
      cliente_id: clienteId,
      nombre_contacto: cliente?.nombre || '',
      ramo: formOportunidad.ramo,
      prima_estimada: parseFloat(formOportunidad.prima_estimada) || 0,
      proxima_accion: formOportunidad.proxima_accion || null,
      fecha_proxima_accion: formOportunidad.fecha_proxima_accion || null,
      responsable: cliente?.responsable || null,
    });
    if (err) { setMsg(err); return; }
    setFormOportunidad(null);
    pipeline.recargar();
  }

  const setC = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFormCliente((f) => ({ ...f, [k]: e.target.value }));
  const setP = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormPoliza((f) => (f ? { ...f, [k]: e.target.value } : f));

  if (clientes.cargando) return <EstadoCarga cargando error="" vacio={false} textoVacio="" />;
  if (clientes.faltaMigracion || clientes.error) {
    return <EstadoCarga cargando={false} error={clientes.error} faltaMigracion={clientes.faltaMigracion} vacio={false} textoVacio="" />;
  }
  if (!cliente) {
    return (
      <div className="space-y-4">
        <Link href="/gestor/correbin/clientes" className={btnSecundario}><ChevronLeft className="w-4 h-4" /> Volver</Link>
        <Card><p className="text-sm text-muted text-center py-6">Cliente no encontrado.</p></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/gestor/correbin/clientes" className={btnSecundario}><ChevronLeft className="w-4 h-4" /> Clientes</Link>
        <div className="flex items-center gap-2">
          {trabajado
            ? <Badge tono="verde">✓ Cliente trabajado</Badge>
            : <Badge tono="rojo">⚠️ Sin acción abierta (abandonado)</Badge>}
          {ultimaActividad && <span className="text-[11px] text-muted">última actividad: {fmtFecha(ultimaActividad)}</span>}
        </div>
      </div>

      {msg && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">{msg}</p>}

      {/* Cabecera del cliente */}
      <Card>
        {!editando ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <BadgePrioridad prioridad={cliente.prioridad} />
                <div>
                  <h2 className="text-xl font-black text-foreground">{cliente.nombre}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <BadgeSegmento segmento={cliente.segmento} />
                    <span className="text-[11px] text-muted">NIF: {cliente.nif || '—'}</span>
                  </div>
                </div>
              </div>
              <button onClick={empezarEdicion} className={btnSecundario}><Pencil className="w-4 h-4" /> Editar</button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-card/60 text-center">
                <p className="text-lg font-black text-emerald-400 tabular-nums">{fmtEur0(primaTotal)}</p>
                <p className="text-[10px] uppercase font-bold text-muted">Prima total viva</p>
              </div>
              <div className="p-3 rounded-lg bg-card/60 text-center">
                <p className="text-lg font-black text-secondary tabular-nums">{fmtEur0(comisionTotal)}</p>
                <p className="text-[10px] uppercase font-bold text-muted">Comisión total</p>
              </div>
              <div className="p-3 rounded-lg bg-card/60 text-center">
                <p className="text-lg font-black tabular-nums">{polizasVivas.length}</p>
                <p className="text-[10px] uppercase font-bold text-muted">Pólizas vivas</p>
              </div>
              <div className="p-3 rounded-lg bg-card/60 text-center">
                <p className="text-lg font-black tabular-nums">{tareasAbiertas.length}</p>
                <p className="text-[10px] uppercase font-bold text-muted">Tareas abiertas</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-x-8 gap-y-1 text-sm text-muted">
              <p>Contacto: <b className="text-foreground">{cliente.contacto_principal || '—'}</b></p>
              <p>Teléfono: <b className="text-foreground">{cliente.telefono || '—'}</b></p>
              <p>Email: <b className="text-foreground">{cliente.email || '—'}</b></p>
              <p>Dirección: <b className="text-foreground">{[cliente.direccion, cliente.poblacion].filter(Boolean).join(', ') || '—'}</b></p>
              <p className="flex items-center gap-2">Responsable:
                <SelectorResponsable valor={cliente.responsable} onCambio={(v) => cambiarCliente({ responsable: v })} />
              </p>
              <p className="flex items-center gap-2">Prioridad:
                <select
                  value={cliente.prioridad || 'C'}
                  onChange={(e) => cambiarCliente({ prioridad: e.target.value })}
                  className="rounded-lg border border-border/40 bg-background/60 px-2 py-1 text-xs font-bold"
                >
                  {PRIORIDADES.map((p) => <option key={p} value={p}>{PRIORIDAD_LABEL[p]}</option>)}
                </select>
              </p>
            </div>
            {cliente.potencial_comercial && (
              <p className="text-sm text-secondary bg-secondary/10 border border-secondary/25 rounded-lg p-2.5">
                💡 Potencial: {cliente.potencial_comercial}
              </p>
            )}
            {cliente.notas && <p className="text-sm text-muted italic">{cliente.notas}</p>}
          </div>
        ) : (
          <form onSubmit={guardarCliente} className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              {([['nombre', 'Nombre *'], ['nif', 'CIF/NIF'], ['telefono', 'Teléfono'], ['email', 'Email'],
                ['contacto_principal', 'Contacto principal'], ['direccion', 'Dirección'], ['poblacion', 'Población'], ['origen', 'Origen']] as const
              ).map(([k, label]) => (
                <div key={k}>
                  <label className={labelCls}>{label}</label>
                  <input className={inputCls} value={formCliente[k] || ''} onChange={setC(k)} />
                </div>
              ))}
              <div>
                <label className={labelCls}>Prioridad</label>
                <select className={inputCls} value={formCliente.prioridad} onChange={setC('prioridad')}>
                  {PRIORIDADES.map((p) => <option key={p} value={p}>{PRIORIDAD_LABEL[p]}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Segmento</label>
                <select className={inputCls} value={formCliente.segmento} onChange={setC('segmento')}>
                  {SEGMENTOS.map((s) => <option key={s} value={s}>{SEGMENTO_LABEL[s]}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Potencial comercial</label>
                <input className={inputCls} value={formCliente.potencial_comercial || ''} onChange={setC('potencial_comercial')} placeholder="Qué más se le puede hacer a este cliente" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Observaciones comerciales</label>
              <textarea className={`${inputCls} resize-none`} rows={2} value={formCliente.notas || ''} onChange={setC('notas')} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className={btnPrimario}>Guardar</button>
              <button type="button" onClick={() => setEditando(false)} className={btnSecundario}>Cancelar</button>
            </div>
          </form>
        )}
      </Card>

      {/* Pólizas */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-foreground">Pólizas ({polizas.datos.length})</h3>
          <button onClick={() => setFormPoliza(formPoliza ? null : { ...POLIZA_VACIA })} className={btnPrimario}>
            {formPoliza ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {formPoliza ? 'Cancelar' : 'Nueva póliza'}
          </button>
        </div>

        {formPoliza && (
          <form onSubmit={crearPoliza} className="mb-4 p-4 rounded-xl bg-background/40 border border-border/30 space-y-3">
            <div className="grid md:grid-cols-4 gap-3">
              <div><label className={labelCls}>Ramo</label>
                <select className={inputCls} value={formPoliza.ramo} onChange={setP('ramo')}>
                  {RAMOS.map((r) => <option key={r} value={r}>{RAMO_LABEL[r]}</option>)}
                </select></div>
              <div><label className={labelCls}>Compañía *</label>
                <input className={inputCls} value={formPoliza.compania} onChange={setP('compania')} /></div>
              <div><label className={labelCls}>Nº póliza</label>
                <input className={inputCls} value={formPoliza.numero_poliza} onChange={setP('numero_poliza')} /></div>
              <div><label className={labelCls}>Prima anual (€)</label>
                <input className={inputCls} type="number" step="0.01" value={formPoliza.prima_anual} onChange={setP('prima_anual')} /></div>
              <div><label className={labelCls}>Comisión (€)</label>
                <input className={inputCls} type="number" step="0.01" value={formPoliza.comision} onChange={setP('comision')} /></div>
              <div><label className={labelCls}>Efecto</label>
                <input className={inputCls} type="date" value={formPoliza.fecha_efecto} onChange={setP('fecha_efecto')} /></div>
              <div><label className={labelCls}>Vencimiento</label>
                <input className={inputCls} type="date" value={formPoliza.fecha_vencimiento} onChange={setP('fecha_vencimiento')} /></div>
              <div><label className={labelCls}>Responsable</label>
                <input className={inputCls} value={formPoliza.responsable} onChange={setP('responsable')} /></div>
            </div>
            <button type="submit" className={btnPrimario}>Guardar póliza</button>
          </form>
        )}

        {polizas.datos.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">Sin pólizas registradas.</p>
        ) : (
          <div className="space-y-2">
            {polizas.datos.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-card/60 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {RAMO_LABEL[p.ramo] || p.ramo} · {p.compania}
                    {p.numero_poliza && <span className="text-muted font-mono text-xs ml-2">{p.numero_poliza}</span>}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {Number(p.prima_anual) ? fmtEur0(Number(p.prima_anual)) : '⚠️ sin prima'}
                    {Number(p.comision) ? ` · com. ${fmtEur0(Number(p.comision))}` : ''}
                    {p.fecha_vencimiento ? ` · vence ${fmtFecha(p.fecha_vencimiento)}` : ' · ⚠️ sin vencimiento'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {p.fecha_vencimiento && ESTADOS_CARTERA_VIVA.includes(p.estado) && <BadgeVencimiento fecha={p.fecha_vencimiento} />}
                  <select
                    value={p.estado}
                    onChange={async (e) => { await guardar('polizas', 'PUT', { id: p.id, estado: e.target.value }); polizas.recargar(); }}
                    className="rounded-lg border border-border/40 bg-background/60 px-2 py-1 text-xs font-semibold"
                  >
                    {['activa', 'pendiente_revision', 'sustituida', 'anulada', 'vencida', 'bloqueada', 'sin_datos'].map((es) => (
                      <option key={es} value={es}>{ESTADO_POLIZA_LABEL[es]}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Vencimientos */}
        <Card>
          <h3 className="font-bold text-foreground mb-3">Vencimientos ({vencimientos.datos.length})</h3>
          {vencimientos.datos.length === 0 ? (
            <p className="text-sm text-muted text-center py-3">Sin vencimientos.</p>
          ) : (
            <div className="space-y-1.5">
              {vencimientos.datos.map((v) => (
                <div key={v.id} className="p-2.5 rounded-lg bg-card/60">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold truncate">{v.titulo_evento}</p>
                    <BadgeVencimiento fecha={v.fecha_vct} />
                  </div>
                  <p className="text-[10px] text-muted mt-0.5">
                    {ESTADO_VCT_LABEL[v.estado_vencimiento]} · {v.responsable || 'Sin asignar'}
                    {v.proxima_accion && <> · próx: {v.proxima_accion}</>}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Tareas */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-foreground">Tareas ({tareasAbiertas.length} abiertas)</h3>
            <button onClick={() => setFormTarea(formTarea ? null : { titulo: '', tipo_tarea: 'llamar_cliente', fecha_limite: '', responsable: '' })} className={btnSecundario}>
              {formTarea ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Tarea
            </button>
          </div>
          {formTarea && (
            <form onSubmit={crearTarea} className="mb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select className={inputCls} value={formTarea.tipo_tarea} onChange={(e) => setFormTarea({ ...formTarea, tipo_tarea: e.target.value })}>
                  {TIPOS_TAREA.map((t) => <option key={t} value={t}>{TIPO_TAREA_LABEL[t]}</option>)}
                </select>
                <input className={inputCls} type="date" value={formTarea.fecha_limite} onChange={(e) => setFormTarea({ ...formTarea, fecha_limite: e.target.value })} />
              </div>
              <input className={inputCls} value={formTarea.titulo} onChange={(e) => setFormTarea({ ...formTarea, titulo: e.target.value })} placeholder="Descripción de la tarea *" />
              <button type="submit" className={btnPrimario}>Crear tarea</button>
            </form>
          )}
          {tareas.datos.length === 0 ? (
            <p className="text-sm text-muted text-center py-3">Sin tareas.</p>
          ) : (
            <div className="space-y-1.5">
              {tareas.datos.map((t) => (
                <div key={t.id} className={`flex items-center justify-between gap-2 p-2.5 rounded-lg bg-card/60 ${!TAREAS_ABIERTAS.includes(t.estado) ? 'opacity-40' : ''}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={!TAREAS_ABIERTAS.includes(t.estado)}
                      onChange={async () => {
                        if (TAREAS_ABIERTAS.includes(t.estado)) {
                          await guardar('tareas', 'PUT', { id: t.id, estado: 'emitido', hecho_en: new Date().toISOString() });
                          tareas.recargar();
                        }
                      }}
                      className="accent-[#22c55e] w-4 h-4 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{TIPO_TAREA_LABEL[t.tipo_tarea]?.split(' ')[0]} {t.titulo}</p>
                      <p className="text-[10px] text-muted">{t.responsable || 'Sin asignar'}</p>
                    </div>
                  </div>
                  {t.fecha_limite && TAREAS_ABIERTAS.includes(t.estado) && <BadgeVencimiento fecha={t.fecha_limite} />}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Pipeline del cliente */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-foreground">Pipeline ({pipeline.datos.length})</h3>
            <button onClick={() => setFormOportunidad(formOportunidad ? null : { ramo: 'otros', prima_estimada: '', proxima_accion: '', fecha_proxima_accion: '' })} className={btnSecundario}>
              {formOportunidad ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Oportunidad
            </button>
          </div>
          {formOportunidad && (
            <form onSubmit={crearOportunidad} className="mb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select className={inputCls} value={formOportunidad.ramo} onChange={(e) => setFormOportunidad({ ...formOportunidad, ramo: e.target.value })}>
                  {RAMOS.map((r) => <option key={r} value={r}>{RAMO_LABEL[r]}</option>)}
                </select>
                <input className={inputCls} type="number" step="0.01" value={formOportunidad.prima_estimada} onChange={(e) => setFormOportunidad({ ...formOportunidad, prima_estimada: e.target.value })} placeholder="Prima estimada €" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} value={formOportunidad.proxima_accion} onChange={(e) => setFormOportunidad({ ...formOportunidad, proxima_accion: e.target.value })} placeholder="Próxima acción" />
                <input className={inputCls} type="date" value={formOportunidad.fecha_proxima_accion} onChange={(e) => setFormOportunidad({ ...formOportunidad, fecha_proxima_accion: e.target.value })} />
              </div>
              <button type="submit" className={btnPrimario}>Crear oportunidad</button>
            </form>
          )}
          {pipeline.datos.length === 0 ? (
            <p className="text-sm text-muted text-center py-3">Sin oportunidades.</p>
          ) : (
            <div className="space-y-1.5">
              {pipeline.datos.map((o) => (
                <div key={o.id} className="p-2.5 rounded-lg bg-card/60 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">{RAMO_LABEL[o.ramo]} · {fmtEur0(Number(o.prima_estimada))}</span>
                    <Badge tono={o.etapa === 'cerrado_ganado' ? 'verde' : o.etapa === 'cerrado_perdido' ? 'rojo' : 'accent'}>{ETAPA_LABEL[o.etapa] || o.etapa}</Badge>
                  </div>
                  <p className="text-[10px] text-muted mt-0.5">{o.proxima_accion || '⚠️ sin próxima acción'}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Históricos */}
        <Card>
          <h3 className="font-bold text-foreground mb-3">Histórico</h3>
          <div className="space-y-1.5 text-xs">
            {produccion.datos.map((p) => (
              <div key={p.id} className="flex justify-between gap-2 p-2 rounded-lg bg-card/60">
                <span><Badge tono="verde">{TIPO_PRODUCCION_LABEL[p.tipo_produccion]}</Badge> {RAMO_LABEL[p.ramo]} · {fmtEur0(Number(p.prima))}</span>
                <span className="text-muted">{fmtFecha(p.fecha_emision)}</span>
              </div>
            ))}
            {anulaciones.datos.map((a) => (
              <div key={a.id} className="flex justify-between gap-2 p-2 rounded-lg bg-card/60">
                <span><Badge tono={a.afecta_cartera ? 'rojo' : 'ambar'}>{TIPO_ANULACION_LABEL[a.tipo_anulacion]}</Badge> {fmtEur0(Number(a.prima))} {a.motivo && `· ${a.motivo}`}</span>
                <span className="text-muted">{fmtFecha(a.fecha_anulacion)}</span>
              </div>
            ))}
            {mediador.datos.map((c) => (
              <div key={c.id} className="flex justify-between gap-2 p-2 rounded-lg bg-card/60">
                <span><Badge tono={c.estado === 'incorporado' ? 'verde' : 'ambar'}>Mediador: {ESTADO_CM_LABEL[c.estado]}</Badge> {fmtEur0(Number(c.prima))}</span>
                <span className="text-muted">{c.fecha_entrada ? fmtFecha(c.fecha_entrada) : 'pendiente'}</span>
              </div>
            ))}
            {produccion.datos.length + anulaciones.datos.length + mediador.datos.length === 0 && (
              <p className="text-sm text-muted text-center py-3">Sin histórico.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
