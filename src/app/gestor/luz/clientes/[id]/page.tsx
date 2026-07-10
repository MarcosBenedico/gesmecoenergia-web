'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, Plus, Pencil, X } from 'lucide-react';
import {
  LuzCliente, LuzCups, LuzOportunidad, LuzContrato, LuzComision, LuzTarea, LuzFechaCritica,
  TIPOS_CLIENTE, TIPO_CLIENTE_LABEL, PRIORIDADES, PRIORIDAD_LABEL, ESTADOS_CLIENTE, ESTADO_CLIENTE_LABEL,
  TARIFAS_ACCESO, ESTADOS_CUPS, ESTADO_CUPS_LABEL, ESTADO_PIPELINE_LABEL, ESTADO_CONTRATO_LABEL,
  ESTADO_COMISION_LABEL, TIPOS_TAREA, TIPO_TAREA_LABEL, TAREAS_ABIERTAS, TIPOS_OPORTUNIDAD,
  TIPO_OPORTUNIDAD_LABEL, tituloFechaCritica, fmtEur, fmtFecha, fmtKwh, normCups,
} from '@/lib/luz';
import {
  Card, Badge, BadgePrioridad, BadgeVencimiento, EstadoCarga, useListaLuz, guardarLuz,
  inputCls, labelCls, btnPrimario, btnSecundario, SelectorResponsable,
} from '../../ui';

const CUPS_VACIO = {
  cups: '', alias_suministro: '', direccion_suministro: '', tarifa_acceso: '2.0TD',
  comercializadora_actual: '', consumo_anual_kwh: '', fecha_fin_contrato: '',
  tiene_permanencia: false, fecha_fin_permanencia: '', dias_preaviso: '', responsable: '',
};

export default function FichaClienteLuz() {
  const params = useParams<{ id: string }>();
  const clienteId = params.id;

  const clientes = useListaLuz<LuzCliente>('clientes');
  const cliente = clientes.datos.find((c) => c.id === clienteId) || null;
  const cups = useListaLuz<LuzCups>('cups', { cliente_id: clienteId });
  const pipeline = useListaLuz<LuzOportunidad>('pipeline', { cliente_id: clienteId });
  const contratos = useListaLuz<LuzContrato>('contratos', { cliente_id: clienteId });
  const comisiones = useListaLuz<LuzComision>('comisiones', { cliente_id: clienteId });
  const tareas = useListaLuz<LuzTarea>('tareas', { cliente_id: clienteId });
  const fechas = useListaLuz<LuzFechaCritica>('fechas', { cliente_id: clienteId, estado: 'pendiente' });

  const [editando, setEditando] = useState(false);
  const [formC, setFormC] = useState<Record<string, string>>({});
  const [formCups, setFormCups] = useState<typeof CUPS_VACIO | null>(null);
  const [formTarea, setFormTarea] = useState<{ descripcion: string; tipo_tarea: string; fecha_limite: string } | null>(null);
  const [formOp, setFormOp] = useState<{ tipo_oportunidad: string; comision_potencial: string; proxima_accion: string; fecha_proxima_accion: string } | null>(null);
  const [msg, setMsg] = useState('');

  const consumoTotal = cups.datos.reduce((s, c) => s + (Number(c.consumo_anual_kwh) || 0), 0);
  const tareasAbiertas = tareas.datos.filter((t) => TAREAS_ABIERTAS.includes(t.estado));

  const setC = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFormC((f) => ({ ...f, [k]: e.target.value }));

  function empezarEdicion() {
    if (!cliente) return;
    setFormC({
      nombre: cliente.nombre, nif: cliente.nif || '', tipo_cliente: cliente.tipo_cliente,
      persona_contacto: cliente.persona_contacto || '', telefono: cliente.telefono || '',
      email: cliente.email || '', direccion_fiscal: cliente.direccion_fiscal || '',
      prioridad: cliente.prioridad, estado_comercial: cliente.estado_comercial,
      potencial_comercial: cliente.potencial_comercial || '', origen_cliente: cliente.origen_cliente || '',
      observaciones: cliente.observaciones || '', proxima_accion: cliente.proxima_accion || '',
      fecha_proxima_accion: cliente.fecha_proxima_accion || '',
    });
    setEditando(true);
  }

  async function guardarCliente(e: React.FormEvent) {
    e.preventDefault();
    const err = await guardarLuz('clientes', 'PUT', { id: clienteId, ...formC });
    if (err) { setMsg(err); return; }
    setEditando(false); setMsg('');
    clientes.recargar();
  }

  async function crearCups(e: React.FormEvent) {
    e.preventDefault();
    if (!formCups || normCups(formCups.cups).length < 10) { setMsg('Introduce un CUPS válido (empieza por ES, ~20 caracteres).'); return; }
    const finContrato = formCups.fecha_fin_contrato || null;
    const err = await guardarLuz('cups', 'POST', {
      ...formCups,
      cliente_id: clienteId,
      consumo_anual_kwh: parseFloat(formCups.consumo_anual_kwh) || 0,
      dias_preaviso: parseInt(formCups.dias_preaviso) || null,
      fecha_fin_contrato: finContrato,
      fecha_fin_permanencia: formCups.fecha_fin_permanencia || null,
      estado_cups: !finContrato || !parseFloat(formCups.consumo_anual_kwh) ? 'datos_incompletos' : 'factura_recibida',
      prioridad: cliente?.prioridad || 'C',
      responsable: formCups.responsable || cliente?.responsable || null,
    });
    if (err) { setMsg(err); return; }
    // Fecha crítica automática si hay fin de contrato
    if (finContrato && cliente) {
      await guardarLuz('fechas', 'POST', {
        cliente_id: clienteId, tipo_fecha: 'fin_contrato', fecha: finContrato,
        titulo: tituloFechaCritica(cliente.nombre, normCups(formCups.cups), 'fin_contrato', formCups.comercializadora_actual),
        prioridad: cliente.prioridad, responsable: formCups.responsable || cliente.responsable,
      });
      fechas.recargar();
    }
    setFormCups(null); setMsg('');
    cups.recargar();
  }

  async function crearTarea(e: React.FormEvent) {
    e.preventDefault();
    if (!formTarea?.descripcion.trim()) return;
    const err = await guardarLuz('tareas', 'POST', {
      ...formTarea, cliente_id: clienteId,
      fecha_limite: formTarea.fecha_limite || null,
      responsable: cliente?.responsable || null,
    });
    if (err) { setMsg(err); return; }
    setFormTarea(null);
    tareas.recargar();
  }

  async function crearOportunidad(e: React.FormEvent) {
    e.preventDefault();
    if (!formOp || !cliente) return;
    const err = await guardarLuz('pipeline', 'POST', {
      cliente_id: clienteId,
      nombre_oportunidad: `${cliente.nombre} · ${TIPO_OPORTUNIDAD_LABEL[formOp.tipo_oportunidad]}`,
      tipo_oportunidad: formOp.tipo_oportunidad,
      consumo_anual_kwh: consumoTotal,
      comision_potencial: parseFloat(formOp.comision_potencial) || 0,
      proxima_accion: formOp.proxima_accion || null,
      fecha_proxima_accion: formOp.fecha_proxima_accion || null,
      responsable: cliente.responsable || null,
    });
    if (err) { setMsg(err); return; }
    setFormOp(null);
    pipeline.recargar();
  }

  if (clientes.cargando) return <EstadoCarga cargando error="" vacio={false} textoVacio="" />;
  if (clientes.faltaMigracion || clientes.error) {
    return <EstadoCarga cargando={false} error={clientes.error} faltaMigracion={clientes.faltaMigracion} vacio={false} textoVacio="" sqlFile="supabase_luz.sql" />;
  }
  if (!cliente) {
    return (
      <div className="space-y-4">
        <Link href="/gestor/luz/clientes" className={btnSecundario}><ChevronLeft className="w-4 h-4" /> Volver</Link>
        <Card><p className="text-sm text-muted text-center py-6">Cliente no encontrado.</p></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/gestor/luz/clientes" className={btnSecundario}><ChevronLeft className="w-4 h-4" /> Clientes</Link>
        {tareasAbiertas.length > 0 || cliente.proxima_accion
          ? <Badge tono="verde">✓ Cliente trabajado</Badge>
          : <Badge tono="rojo">⚠️ Sin acción abierta</Badge>}
      </div>

      {msg && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">{msg}</p>}

      {/* Cabecera */}
      <Card>
        {!editando ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <BadgePrioridad prioridad={cliente.prioridad} />
                <div>
                  <h2 className="text-xl font-black text-foreground">{cliente.nombre}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge tono="accent">{TIPO_CLIENTE_LABEL[cliente.tipo_cliente]}</Badge>
                    <Badge>{ESTADO_CLIENTE_LABEL[cliente.estado_comercial]}</Badge>
                    <span className="text-[11px] text-muted">NIF: {cliente.nif || '—'}</span>
                  </div>
                </div>
              </div>
              <button onClick={empezarEdicion} className={btnSecundario}><Pencil className="w-4 h-4" /> Editar</button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                [cups.datos.length, 'CUPS'],
                [fmtKwh(consumoTotal), 'Consumo anual total'],
                [pipeline.datos.filter((o) => !['ganado', 'perdido'].includes(o.estado)).length, 'Oportunidades abiertas'],
                [tareasAbiertas.length, 'Tareas abiertas'],
              ].map(([v, n], i) => (
                <div key={i} className="p-3 rounded-lg bg-card/60 text-center">
                  <p className="text-lg font-black tabular-nums">{String(v)}</p>
                  <p className="text-[10px] uppercase font-bold text-muted">{String(n)}</p>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-x-8 gap-y-1 text-sm text-muted">
              <p>Contacto: <b className="text-foreground">{cliente.persona_contacto || '—'}</b></p>
              <p>Teléfono: <b className="text-foreground">{cliente.telefono || '—'}</b></p>
              <p>Email: <b className="text-foreground">{cliente.email || '—'}</b></p>
              <p className="flex items-center gap-2">Responsable:
                <SelectorResponsable valor={cliente.responsable} onCambio={async (v) => { await guardarLuz('clientes', 'PUT', { id: clienteId, responsable: v }); clientes.recargar(); }} />
              </p>
              <p>Próxima acción: <b className="text-foreground">{cliente.proxima_accion || '—'}</b>{cliente.fecha_proxima_accion && <span className="text-xs"> ({fmtFecha(cliente.fecha_proxima_accion)})</span>}</p>
              <p>Último contacto: <b className="text-foreground">{fmtFecha(cliente.fecha_ultimo_contacto)}</b></p>
            </div>
            {cliente.potencial_comercial && (
              <p className="text-sm text-secondary bg-secondary/10 border border-secondary/25 rounded-lg p-2.5">💡 {cliente.potencial_comercial}</p>
            )}
          </div>
        ) : (
          <form onSubmit={guardarCliente} className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              {([['nombre', 'Nombre *'], ['nif', 'CIF/NIF'], ['persona_contacto', 'Contacto'], ['telefono', 'Teléfono'],
                ['email', 'Email'], ['direccion_fiscal', 'Dirección fiscal'], ['origen_cliente', 'Origen'],
                ['proxima_accion', 'Próxima acción']] as const).map(([k, label]) => (
                <div key={k}><label className={labelCls}>{label}</label><input className={inputCls} value={formC[k] || ''} onChange={setC(k)} /></div>
              ))}
              <div><label className={labelCls}>Fecha próxima acción</label><input className={inputCls} type="date" value={formC.fecha_proxima_accion || ''} onChange={setC('fecha_proxima_accion')} /></div>
              <div>
                <label className={labelCls}>Tipo</label>
                <select className={inputCls} value={formC.tipo_cliente} onChange={setC('tipo_cliente')}>
                  {TIPOS_CLIENTE.map((t) => <option key={t} value={t}>{TIPO_CLIENTE_LABEL[t]}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Prioridad</label>
                <select className={inputCls} value={formC.prioridad} onChange={setC('prioridad')}>
                  {PRIORIDADES.map((p) => <option key={p} value={p}>{PRIORIDAD_LABEL[p]}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Estado</label>
                <select className={inputCls} value={formC.estado_comercial} onChange={setC('estado_comercial')}>
                  {ESTADOS_CLIENTE.map((es) => <option key={es} value={es}>{ESTADO_CLIENTE_LABEL[es]}</option>)}
                </select>
              </div>
              <div className="md:col-span-3"><label className={labelCls}>Potencial comercial</label><input className={inputCls} value={formC.potencial_comercial || ''} onChange={setC('potencial_comercial')} /></div>
            </div>
            <div><label className={labelCls}>Observaciones</label><textarea className={`${inputCls} resize-none`} rows={2} value={formC.observaciones || ''} onChange={setC('observaciones')} /></div>
            <div className="flex gap-2">
              <button type="submit" className={btnPrimario}>Guardar</button>
              <button type="button" onClick={() => setEditando(false)} className={btnSecundario}>Cancelar</button>
            </div>
          </form>
        )}
      </Card>

      {/* CUPS del cliente */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-foreground">Suministros / CUPS ({cups.datos.length})</h3>
          <button onClick={() => setFormCups(formCups ? null : { ...CUPS_VACIO })} className={btnPrimario}>
            {formCups ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {formCups ? 'Cancelar' : 'Añadir CUPS'}
          </button>
        </div>

        {formCups && (
          <form onSubmit={crearCups} className="mb-4 p-4 rounded-xl bg-background/40 border border-border/30 space-y-3">
            <div className="grid md:grid-cols-4 gap-3">
              <div className="md:col-span-2"><label className={labelCls}>CUPS *</label><input className={`${inputCls} font-mono uppercase`} value={formCups.cups} onChange={(e) => setFormCups({ ...formCups, cups: e.target.value })} placeholder="ES0021..." /></div>
              <div><label className={labelCls}>Alias</label><input className={inputCls} value={formCups.alias_suministro} onChange={(e) => setFormCups({ ...formCups, alias_suministro: e.target.value })} placeholder="Nave, oficina..." /></div>
              <div>
                <label className={labelCls}>Tarifa</label>
                <select className={inputCls} value={formCups.tarifa_acceso} onChange={(e) => setFormCups({ ...formCups, tarifa_acceso: e.target.value })}>
                  {TARIFAS_ACCESO.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Comercializadora actual</label><input className={inputCls} value={formCups.comercializadora_actual} onChange={(e) => setFormCups({ ...formCups, comercializadora_actual: e.target.value })} /></div>
              <div><label className={labelCls}>Consumo anual (kWh)</label><input className={inputCls} type="number" value={formCups.consumo_anual_kwh} onChange={(e) => setFormCups({ ...formCups, consumo_anual_kwh: e.target.value })} /></div>
              <div><label className={labelCls}>Fin contrato</label><input className={inputCls} type="date" value={formCups.fecha_fin_contrato} onChange={(e) => setFormCups({ ...formCups, fecha_fin_contrato: e.target.value })} /></div>
              <div><label className={labelCls}>Fin permanencia</label><input className={inputCls} type="date" value={formCups.fecha_fin_permanencia} onChange={(e) => setFormCups({ ...formCups, fecha_fin_permanencia: e.target.value })} /></div>
            </div>
            <button type="submit" className={btnPrimario}>Guardar CUPS</button>
          </form>
        )}

        {cups.datos.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">Sin suministros.</p>
        ) : (
          <div className="space-y-2">
            {cups.datos.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-card/60 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {c.alias_suministro || 'Suministro'} · {c.tarifa_acceso}
                    <span className="text-muted font-mono text-[10px] ml-2">{c.cups}</span>
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {c.comercializadora_actual || 'sin comercializadora'} · {fmtKwh(Number(c.consumo_anual_kwh))}
                    {c.fecha_fin_contrato ? ` · fin ${fmtFecha(c.fecha_fin_contrato)}` : ' · ⚠️ sin fin contrato'}
                    {!c.responsable && ' · ⚠️ sin responsable'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.fecha_fin_contrato && <BadgeVencimiento fecha={c.fecha_fin_contrato} />}
                  <select
                    value={c.estado_cups}
                    onChange={async (e) => { await guardarLuz('cups', 'PUT', { id: c.id, estado_cups: e.target.value }); cups.recargar(); }}
                    className="rounded-lg border border-border/40 bg-background/60 px-2 py-1 text-xs font-semibold"
                  >
                    {ESTADOS_CUPS.map((es) => <option key={es} value={es}>{ESTADO_CUPS_LABEL[es]}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Tareas */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-foreground">Tareas ({tareasAbiertas.length})</h3>
            <button onClick={() => setFormTarea(formTarea ? null : { descripcion: '', tipo_tarea: 'llamar_cliente', fecha_limite: '' })} className={btnSecundario}>
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
              <input className={inputCls} value={formTarea.descripcion} onChange={(e) => setFormTarea({ ...formTarea, descripcion: e.target.value })} placeholder="Descripción *" />
              <button type="submit" className={btnPrimario}>Crear</button>
            </form>
          )}
          {tareas.datos.length === 0 ? <p className="text-sm text-muted text-center py-3">Sin tareas.</p> : (
            <div className="space-y-1.5">
              {tareas.datos.map((t) => (
                <div key={t.id} className={`flex items-center justify-between gap-2 p-2.5 rounded-lg bg-card/60 ${!TAREAS_ABIERTAS.includes(t.estado) ? 'opacity-40' : ''}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <input type="checkbox" checked={!TAREAS_ABIERTAS.includes(t.estado)}
                      onChange={async () => { if (TAREAS_ABIERTAS.includes(t.estado)) { await guardarLuz('tareas', 'PUT', { id: t.id, estado: 'completada' }); tareas.recargar(); } }}
                      className="accent-[#22c55e] w-4 h-4 shrink-0" />
                    <p className="text-xs font-semibold truncate">{TIPO_TAREA_LABEL[t.tipo_tarea]?.split(' ')[0]} {t.descripcion}</p>
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
            <h3 className="font-bold text-foreground">Oportunidades ({pipeline.datos.length})</h3>
            <button onClick={() => setFormOp(formOp ? null : { tipo_oportunidad: 'cambio_comercializadora', comision_potencial: '', proxima_accion: '', fecha_proxima_accion: '' })} className={btnSecundario}>
              {formOp ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Oportunidad
            </button>
          </div>
          {formOp && (
            <form onSubmit={crearOportunidad} className="mb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select className={inputCls} value={formOp.tipo_oportunidad} onChange={(e) => setFormOp({ ...formOp, tipo_oportunidad: e.target.value })}>
                  {TIPOS_OPORTUNIDAD.map((t) => <option key={t} value={t}>{TIPO_OPORTUNIDAD_LABEL[t]}</option>)}
                </select>
                <input className={inputCls} type="number" step="0.01" value={formOp.comision_potencial} onChange={(e) => setFormOp({ ...formOp, comision_potencial: e.target.value })} placeholder="Comisión potencial €" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} value={formOp.proxima_accion} onChange={(e) => setFormOp({ ...formOp, proxima_accion: e.target.value })} placeholder="Próxima acción" />
                <input className={inputCls} type="date" value={formOp.fecha_proxima_accion} onChange={(e) => setFormOp({ ...formOp, fecha_proxima_accion: e.target.value })} />
              </div>
              <button type="submit" className={btnPrimario}>Crear</button>
            </form>
          )}
          {pipeline.datos.length === 0 ? <p className="text-sm text-muted text-center py-3">Sin oportunidades.</p> : (
            <div className="space-y-1.5">
              {pipeline.datos.map((o) => (
                <div key={o.id} className="p-2.5 rounded-lg bg-card/60 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold truncate">{TIPO_OPORTUNIDAD_LABEL[o.tipo_oportunidad]} · {fmtEur(Number(o.comision_potencial))}</span>
                    <Badge tono={o.estado === 'ganado' ? 'verde' : o.estado === 'perdido' ? 'rojo' : 'accent'}>{ESTADO_PIPELINE_LABEL[o.estado]}</Badge>
                  </div>
                  <p className="text-[10px] text-muted mt-0.5">{o.proxima_accion || '⚠️ sin próxima acción'}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Fechas críticas del cliente */}
        <Card>
          <h3 className="font-bold text-foreground mb-3">Fechas críticas</h3>
          {fechas.datos.length === 0 ? <p className="text-sm text-muted text-center py-3">Sin fechas críticas pendientes.</p> : (
            <div className="space-y-1.5">
              {fechas.datos.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-card/60">
                  <p className="text-xs font-semibold truncate">{f.titulo}</p>
                  <BadgeVencimiento fecha={f.fecha} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Contratos y comisiones */}
        <Card>
          <h3 className="font-bold text-foreground mb-3">Contratos y comisiones</h3>
          <div className="space-y-1.5 text-xs">
            {contratos.datos.map((c) => (
              <div key={c.id} className="flex justify-between gap-2 p-2 rounded-lg bg-card/60">
                <span><Badge tono={c.estado_contrato === 'activado' ? 'verde' : 'ambar'}>{ESTADO_CONTRATO_LABEL[c.estado_contrato]}</Badge> {c.comercializadora_final}</span>
                <span className="text-muted">{fmtFecha(c.fecha_activacion_real || c.fecha_activacion_prevista)}</span>
              </div>
            ))}
            {comisiones.datos.map((c) => (
              <div key={c.id} className="flex justify-between gap-2 p-2 rounded-lg bg-card/60">
                <span><Badge tono={c.estado_comision === 'cobrada' ? 'verde' : 'ambar'}>{ESTADO_COMISION_LABEL[c.estado_comision]}</Badge> {fmtEur(Number(c.importe_previsto))} previsto · {fmtEur(Number(c.importe_cobrado))} cobrado</span>
                <span className="text-muted">{fmtFecha(c.fecha_prevista_cobro)}</span>
              </div>
            ))}
            {contratos.datos.length + comisiones.datos.length === 0 && <p className="text-sm text-muted text-center py-3">Sin contratos ni comisiones.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
