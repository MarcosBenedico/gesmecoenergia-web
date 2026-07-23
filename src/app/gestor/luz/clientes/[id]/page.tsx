'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, Plus, Pencil, X } from 'lucide-react';
import {
  LuzCliente, LuzCups, LuzOportunidad, LuzContrato, LuzComision, LuzTarea, LuzFechaCritica,
  TIPOS_CLIENTE, TIPO_CLIENTE_LABEL, PRIORIDADES, PRIORIDAD_LABEL, ESTADOS_CLIENTE, ESTADO_CLIENTE_LABEL,
  TARIFAS_ACCESO, ESTADOS_CUPS, ESTADO_CUPS_LABEL, ESTADO_PIPELINE_LABEL, ESTADOS_CONTRATO, ESTADO_CONTRATO_LABEL,
  ESTADOS_COMISION, ESTADO_COMISION_LABEL, TIPOS_COMISION, TIPO_COMISION_LABEL, TIPOS_FECHA, TIPO_FECHA_LABEL,
  TIPOS_TAREA, TIPO_TAREA_LABEL, TAREAS_ABIERTAS, TIPOS_OPORTUNIDAD,
  TIPO_OPORTUNIDAD_LABEL, tituloFechaCritica, fmtEur, fmtFecha, fmtKwh, normCups,
} from '@/lib/luz';
import {
  Card, Badge, BadgePrioridad, BadgeVencimiento, EstadoCarga, useListaLuz, guardarLuz,
  inputCls, labelCls, btnPrimario, btnSecundario, SelectorResponsable,
} from '../../ui';
import { ProximaAccion, TareasCliente, HistorialCliente, VisitasYFV } from './componentes';

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
  const [editCupsId, setEditCupsId] = useState<string | null>(null);
  const [formEditCups, setFormEditCups] = useState<Record<string, string>>({});
  const [formOp, setFormOp] = useState<{ tipo_oportunidad: string; comision_potencial: string; proxima_accion: string; fecha_proxima_accion: string } | null>(null);
  const [formFecha, setFormFecha] = useState<{ tipo_fecha: string; fecha: string; descripcion: string; cups_id: string } | null>(null);
  const [formContrato, setFormContrato] = useState<{ comercializadora_final: string; estado_contrato: string; fecha_activacion_prevista: string } | null>(null);
  const [formCom, setFormCom] = useState<{ comercializadora: string; tipo_comision: string; importe_previsto: string; fecha_prevista_cobro: string } | null>(null);
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

  function empezarEdicionCups(c: LuzCups) {
    setFormEditCups({
      alias_suministro: c.alias_suministro || '', direccion_suministro: c.direccion_suministro || '',
      tarifa_acceso: c.tarifa_acceso, comercializadora_actual: c.comercializadora_actual || '',
      distribuidora: c.distribuidora || '', consumo_anual_kwh: String(c.consumo_anual_kwh || ''),
      coste_anual_estimado: String(c.coste_anual_estimado || ''),
      fecha_fin_contrato: c.fecha_fin_contrato || '', fecha_fin_permanencia: c.fecha_fin_permanencia || '',
      dias_preaviso: String(c.dias_preaviso ?? ''), penalizacion: c.penalizacion || '',
      responsable: c.responsable || '', observaciones: c.observaciones || '',
    });
    setEditCupsId(c.id);
  }

  async function guardarEdicionCups(e: React.FormEvent) {
    e.preventDefault();
    if (!editCupsId) return;
    const original = cups.datos.find((c) => c.id === editCupsId);
    const err = await guardarLuz('cups', 'PUT', {
      id: editCupsId,
      ...formEditCups,
      consumo_anual_kwh: parseFloat(formEditCups.consumo_anual_kwh) || 0,
      coste_anual_estimado: parseFloat(formEditCups.coste_anual_estimado) || 0,
      dias_preaviso: parseInt(formEditCups.dias_preaviso) || null,
      fecha_fin_contrato: formEditCups.fecha_fin_contrato || null,
      fecha_fin_permanencia: formEditCups.fecha_fin_permanencia || null,
      tiene_permanencia: !!formEditCups.fecha_fin_permanencia,
    });
    if (err) { setMsg(err); return; }
    // Si se acaba de poner fin de contrato y antes no lo tenía → fecha crítica automática
    if (formEditCups.fecha_fin_contrato && original && !original.fecha_fin_contrato && cliente) {
      await guardarLuz('fechas', 'POST', {
        cliente_id: clienteId, cups_id: editCupsId, tipo_fecha: 'fin_contrato', fecha: formEditCups.fecha_fin_contrato,
        titulo: tituloFechaCritica(cliente.nombre, original.cups, 'fin_contrato', formEditCups.comercializadora_actual),
        prioridad: cliente.prioridad, responsable: formEditCups.responsable || cliente.responsable,
      });
      fechas.recargar();
    }
    setEditCupsId(null); setMsg('');
    cups.recargar();
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

  async function crearFecha(e: React.FormEvent) {
    e.preventDefault();
    if (!formFecha?.fecha || !cliente) { setMsg('Indica la fecha.'); return; }
    const cupsSel = cups.datos.find((c) => c.id === formFecha.cups_id);
    const err = await guardarLuz('fechas', 'POST', {
      cliente_id: clienteId, cups_id: formFecha.cups_id || null,
      tipo_fecha: formFecha.tipo_fecha, fecha: formFecha.fecha,
      titulo: tituloFechaCritica(cliente.nombre, cupsSel?.cups || '', formFecha.tipo_fecha, cupsSel?.comercializadora_actual),
      descripcion: formFecha.descripcion || null,
      prioridad: cliente.prioridad || 'C', responsable: cliente.responsable,
    });
    if (err) { setMsg(err); return; }
    setFormFecha(null); setMsg('');
    fechas.recargar();
  }

  async function crearContrato(e: React.FormEvent) {
    e.preventDefault();
    if (!formContrato) return;
    const err = await guardarLuz('contratos', 'POST', {
      cliente_id: clienteId,
      comercializadora_final: formContrato.comercializadora_final || null,
      estado_contrato: formContrato.estado_contrato,
      fecha_activacion_prevista: formContrato.fecha_activacion_prevista || null,
      responsable: cliente?.responsable || null,
    });
    if (err) { setMsg(err); return; }
    setFormContrato(null); setMsg('');
    contratos.recargar();
  }

  async function crearComision(e: React.FormEvent) {
    e.preventDefault();
    if (!formCom) return;
    const err = await guardarLuz('comisiones', 'POST', {
      cliente_id: clienteId,
      comercializadora: formCom.comercializadora || null,
      tipo_comision: formCom.tipo_comision,
      importe_previsto: parseFloat(formCom.importe_previsto) || 0,
      fecha_prevista_cobro: formCom.fecha_prevista_cobro || null,
      estado_comision: 'prevista',
    });
    if (err) { setMsg(err); return; }
    setFormCom(null); setMsg('');
    comisiones.recargar();
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
              <p className="md:col-span-2">📍 Ubicación: <b className="text-foreground">{cliente.direccion_fiscal || '—'}</b>
                {!cliente.direccion_fiscal && <span className="text-[11px] text-amber-400 ml-2">(sin dirección no sale en las Rutas de visitas)</span>}
              </p>
            </div>
            {cliente.potencial_comercial && (
              <p className="text-sm text-secondary bg-secondary/10 border border-secondary/25 rounded-lg p-2.5">💡 {cliente.potencial_comercial}</p>
            )}
          </div>
        ) : (
          <form onSubmit={guardarCliente} className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              {([['nombre', 'Nombre *'], ['nif', 'CIF/NIF'], ['persona_contacto', 'Contacto'], ['telefono', 'Teléfono'],
                ['email', 'Email'], ['direccion_fiscal', '📍 Ubicación (dirección o enlace de Google Maps)'], ['origen_cliente', 'Origen'],
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

      {/* ── Próxima acción (dato único, sincronizado con el Pipeline) ── */}
      <ProximaAccion
        cliente={cliente}
        oportunidades={pipeline.datos}
        onGuardado={() => { clientes.recargar(); pipeline.recargar(); }}
      />

      {/* ── Visitas y fotovoltaica (conectado con el mapa de rutas) ── */}
      <VisitasYFV
        cliente={cliente}
        oportunidades={pipeline.datos}
        onRecargar={() => { clientes.recargar(); pipeline.recargar(); }}
      />

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
              <div key={c.id} className="p-3 rounded-lg bg-card/60">
                <div className="flex items-center justify-between gap-3 flex-wrap">
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
                    <button
                      onClick={() => (editCupsId === c.id ? setEditCupsId(null) : empezarEdicionCups(c))}
                      className="p-1.5 rounded-lg border border-border/40 text-muted hover:text-foreground hover:border-accent/50 transition"
                      title="Editar suministro"
                    >
                      {editCupsId === c.id ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {editCupsId === c.id && (
                  <form onSubmit={guardarEdicionCups} className="mt-3 pt-3 border-t border-border/30 space-y-3">
                    <div className="grid md:grid-cols-4 gap-3">
                      <div><label className={labelCls}>Alias</label><input className={inputCls} value={formEditCups.alias_suministro} onChange={(e) => setFormEditCups({ ...formEditCups, alias_suministro: e.target.value })} /></div>
                      <div>
                        <label className={labelCls}>Tarifa</label>
                        <select className={inputCls} value={formEditCups.tarifa_acceso} onChange={(e) => setFormEditCups({ ...formEditCups, tarifa_acceso: e.target.value })}>
                          {TARIFAS_ACCESO.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div><label className={labelCls}>Comercializadora</label><input className={inputCls} value={formEditCups.comercializadora_actual} onChange={(e) => setFormEditCups({ ...formEditCups, comercializadora_actual: e.target.value })} /></div>
                      <div><label className={labelCls}>Distribuidora</label><input className={inputCls} value={formEditCups.distribuidora} onChange={(e) => setFormEditCups({ ...formEditCups, distribuidora: e.target.value })} /></div>
                      <div className="md:col-span-2"><label className={labelCls}>Dirección suministro</label><input className={inputCls} value={formEditCups.direccion_suministro} onChange={(e) => setFormEditCups({ ...formEditCups, direccion_suministro: e.target.value })} /></div>
                      <div><label className={labelCls}>Consumo anual (kWh)</label><input className={inputCls} type="number" value={formEditCups.consumo_anual_kwh} onChange={(e) => setFormEditCups({ ...formEditCups, consumo_anual_kwh: e.target.value })} /></div>
                      <div><label className={labelCls}>Coste anual (€)</label><input className={inputCls} type="number" step="0.01" value={formEditCups.coste_anual_estimado} onChange={(e) => setFormEditCups({ ...formEditCups, coste_anual_estimado: e.target.value })} /></div>
                      <div><label className={labelCls}>Fin contrato</label><input className={inputCls} type="date" value={formEditCups.fecha_fin_contrato} onChange={(e) => setFormEditCups({ ...formEditCups, fecha_fin_contrato: e.target.value })} /></div>
                      <div><label className={labelCls}>Fin permanencia</label><input className={inputCls} type="date" value={formEditCups.fecha_fin_permanencia} onChange={(e) => setFormEditCups({ ...formEditCups, fecha_fin_permanencia: e.target.value })} /></div>
                      <div><label className={labelCls}>Días preaviso</label><input className={inputCls} type="number" value={formEditCups.dias_preaviso} onChange={(e) => setFormEditCups({ ...formEditCups, dias_preaviso: e.target.value })} /></div>
                      <div>
                        <label className={labelCls}>Responsable</label>
                        <SelectorResponsable valor={formEditCups.responsable} onCambio={(v) => setFormEditCups((f) => ({ ...f, responsable: v || '' }))} className={inputCls} />
                      </div>
                      <div className="md:col-span-2"><label className={labelCls}>Penalización</label><input className={inputCls} value={formEditCups.penalizacion} onChange={(e) => setFormEditCups({ ...formEditCups, penalizacion: e.target.value })} /></div>
                      <div className="md:col-span-2"><label className={labelCls}>Observaciones</label><input className={inputCls} value={formEditCups.observaciones} onChange={(e) => setFormEditCups({ ...formEditCups, observaciones: e.target.value })} /></div>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className={btnPrimario}>Guardar suministro</button>
                      <button type="button" onClick={() => setEditCupsId(null)} className={btnSecundario}>Cancelar</button>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Tareas: gestión completa con historial */}
        <TareasCliente clienteId={clienteId} tareas={tareas.datos} recargar={tareas.recargar} clienteResponsable={cliente.responsable} setMsg={setMsg} />

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
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-foreground">Fechas críticas</h3>
            <button onClick={() => setFormFecha(formFecha ? null : { tipo_fecha: 'fin_contrato', fecha: '', descripcion: '', cups_id: '' })} className={btnSecundario}>
              {formFecha ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Fecha
            </button>
          </div>
          {formFecha && (
            <form onSubmit={crearFecha} className="mb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select className={inputCls} value={formFecha.tipo_fecha} onChange={(e) => setFormFecha({ ...formFecha, tipo_fecha: e.target.value })}>
                  {TIPOS_FECHA.map((t) => <option key={t} value={t}>{TIPO_FECHA_LABEL[t]}</option>)}
                </select>
                <input className={inputCls} type="date" value={formFecha.fecha} onChange={(e) => setFormFecha({ ...formFecha, fecha: e.target.value })} />
              </div>
              <select className={inputCls} value={formFecha.cups_id} onChange={(e) => setFormFecha({ ...formFecha, cups_id: e.target.value })}>
                <option value="">— Todo el cliente (sin CUPS concreto) —</option>
                {cups.datos.map((c) => <option key={c.id} value={c.id}>{c.alias_suministro || c.cups}</option>)}
              </select>
              <input className={inputCls} value={formFecha.descripcion} onChange={(e) => setFormFecha({ ...formFecha, descripcion: e.target.value })} placeholder="Descripción opcional" />
              <button type="submit" className={btnPrimario}>Crear</button>
            </form>
          )}
          {fechas.datos.length === 0 ? <p className="text-sm text-muted text-center py-3">Sin fechas críticas pendientes.</p> : (
            <div className="space-y-1.5">
              {fechas.datos.map((f) => {
                const cupsF = f.cups_id ? cups.datos.find((c) => c.id === f.cups_id) : null;
                return (
                  <div key={f.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-card/60">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{f.titulo}</p>
                      {cupsF && <p className="text-[10px] text-muted truncate">🔌 {cupsF.alias_suministro || cupsF.cups}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <BadgeVencimiento fecha={f.fecha} />
                      <button
                        onClick={async () => { if (confirm(`¿Eliminar "${f.titulo}"?`)) { await guardarLuz('fechas', 'DELETE', { id: f.id }); fechas.recargar(); } }}
                        className="text-muted hover:text-red-400 text-xs" title="Eliminar"
                      >✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Contratos y comisiones */}
        <Card>
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h3 className="font-bold text-foreground">Contratos y comisiones</h3>
            <div className="flex gap-1.5">
              <button onClick={() => { setFormCom(null); setFormContrato(formContrato ? null : { comercializadora_final: '', estado_contrato: 'pendiente_preparar', fecha_activacion_prevista: '' }); }} className={btnSecundario}>
                {formContrato ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Contrato
              </button>
              <button onClick={() => { setFormContrato(null); setFormCom(formCom ? null : { comercializadora: '', tipo_comision: 'desconocida', importe_previsto: '', fecha_prevista_cobro: '' }); }} className={btnSecundario}>
                {formCom ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Comisión
              </button>
            </div>
          </div>

          {formContrato && (
            <form onSubmit={crearContrato} className="mb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} value={formContrato.comercializadora_final} onChange={(e) => setFormContrato({ ...formContrato, comercializadora_final: e.target.value })} placeholder="Comercializadora" />
                <select className={inputCls} value={formContrato.estado_contrato} onChange={(e) => setFormContrato({ ...formContrato, estado_contrato: e.target.value })}>
                  {ESTADOS_CONTRATO.map((es) => <option key={es} value={es}>{ESTADO_CONTRATO_LABEL[es]}</option>)}
                </select>
              </div>
              <input className={inputCls} type="date" value={formContrato.fecha_activacion_prevista} onChange={(e) => setFormContrato({ ...formContrato, fecha_activacion_prevista: e.target.value })} />
              <button type="submit" className={btnPrimario}>Crear contrato</button>
            </form>
          )}

          {formCom && (
            <form onSubmit={crearComision} className="mb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} value={formCom.comercializadora} onChange={(e) => setFormCom({ ...formCom, comercializadora: e.target.value })} placeholder="Comercializadora" />
                <select className={inputCls} value={formCom.tipo_comision} onChange={(e) => setFormCom({ ...formCom, tipo_comision: e.target.value })}>
                  {TIPOS_COMISION.map((t) => <option key={t} value={t}>{TIPO_COMISION_LABEL[t]}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} type="number" step="0.01" value={formCom.importe_previsto} onChange={(e) => setFormCom({ ...formCom, importe_previsto: e.target.value })} placeholder="Importe previsto €" />
                <input className={inputCls} type="date" value={formCom.fecha_prevista_cobro} onChange={(e) => setFormCom({ ...formCom, fecha_prevista_cobro: e.target.value })} />
              </div>
              <button type="submit" className={btnPrimario}>Crear comisión</button>
            </form>
          )}

          <div className="space-y-1.5 text-xs">
            {contratos.datos.map((c) => (
              <div key={c.id} className="flex justify-between gap-2 p-2 rounded-lg bg-card/60 items-center">
                <span className="flex items-center gap-1.5 min-w-0">
                  <select
                    value={c.estado_contrato}
                    onChange={async (e) => { await guardarLuz('contratos', 'PUT', { id: c.id, estado_contrato: e.target.value }); contratos.recargar(); }}
                    className="rounded-md border border-border/40 bg-background/60 px-1.5 py-0.5 text-[10px] font-semibold"
                  >
                    {ESTADOS_CONTRATO.map((es) => <option key={es} value={es}>{ESTADO_CONTRATO_LABEL[es]}</option>)}
                  </select>
                  <span className="truncate">{c.comercializadora_final || '—'}</span>
                </span>
                <span className="text-muted shrink-0">{fmtFecha(c.fecha_activacion_real || c.fecha_activacion_prevista)}</span>
              </div>
            ))}
            {comisiones.datos.map((c) => (
              <div key={c.id} className="flex justify-between gap-2 p-2 rounded-lg bg-card/60 items-center">
                <span className="flex items-center gap-1.5 min-w-0">
                  <select
                    value={c.estado_comision}
                    onChange={async (e) => { await guardarLuz('comisiones', 'PUT', { id: c.id, estado_comision: e.target.value }); comisiones.recargar(); }}
                    className="rounded-md border border-border/40 bg-background/60 px-1.5 py-0.5 text-[10px] font-semibold"
                  >
                    {ESTADOS_COMISION.map((es) => <option key={es} value={es}>{ESTADO_COMISION_LABEL[es]}</option>)}
                  </select>
                  <span className="truncate">{fmtEur(Number(c.importe_previsto))} previsto · {fmtEur(Number(c.importe_cobrado))} cobrado</span>
                </span>
                <span className="text-muted shrink-0">{fmtFecha(c.fecha_prevista_cobro)}</span>
              </div>
            ))}
            {contratos.datos.length + comisiones.datos.length === 0 && !formContrato && !formCom && <p className="text-sm text-muted text-center py-3">Sin contratos ni comisiones.</p>}
          </div>
        </Card>

        {/* Historial de modificaciones (auditoría) */}
        <HistorialCliente clienteId={clienteId} />
      </div>
    </div>
  );
}
