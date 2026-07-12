'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Download, FileSignature, LayoutGrid, Plus, Table2, X } from 'lucide-react';
import {
  LuzOportunidad, LuzCliente, ESTADOS_PIPELINE, ESTADO_PIPELINE_LABEL, TIPOS_OPORTUNIDAD, TIPO_OPORTUNIDAD_LABEL,
  PIPELINE_CERRADO, PRIORIDADES, diasHasta, fmtEur, fmtFecha, fmtKwh,
} from '@/lib/luz';
import { Card, Kpi, Badge, BadgePrioridad, EstadoCarga, useListaLuz, guardarLuz, inputCls, labelCls, btnPrimario, btnSecundario, SelectorResponsable } from '../ui';
import { TableroPipeline } from './tablero';

const OP_VACIA = { cliente_id: '', tipo_oportunidad: 'cambio_comercializadora', comision_potencial: '', proxima_accion: '', fecha_proxima_accion: '', responsable: '' };

function PipelineContenido() {
  const sp = useSearchParams();
  const { datos, cargando, error, faltaMigracion, recargar } = useListaLuz<LuzOportunidad>('pipeline');
  const [fEstado, setFEstado] = useState('');
  const [fResp, setFResp] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [fEspecial, setFEspecial] = useState(sp.get('alerta') || '');
  const [msg, setMsg] = useState('');
  const [vista, setVista] = useState<'tablero' | 'tabla'>('tablero');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [formOp, setFormOp] = useState(OP_VACIA);
  const [errorForm, setErrorForm] = useState('');
  const clientes = useListaLuz<LuzCliente>('clientes');

  const responsables = useMemo(() => Array.from(new Set(datos.map((o) => o.responsable).filter(Boolean))) as string[], [datos]);

  const filtradas = useMemo(() => datos.filter((o) => {
    if (fEstado && o.estado !== fEstado) return false;
    if (fResp && o.responsable !== fResp) return false;
    if (fTipo && o.tipo_oportunidad !== fTipo) return false;
    const abierta = !PIPELINE_CERRADO.includes(o.estado) && o.estado !== 'revisar_adelante';
    if (fEspecial === 'sin_accion' && !(abierta && !o.proxima_accion)) return false;
    if (fEspecial === 'vencida' && !(abierta && (diasHasta(o.fecha_proxima_accion) ?? 1) < 0)) return false;
    if (fEspecial === 'comision_alta' && (Number(o.comision_potencial) || 0) < 1000) return false;
    if (fEspecial === 'ab' && !['A', 'B'].includes(o.luz_clientes?.prioridad || '')) return false;
    return true;
  }), [datos, fEstado, fResp, fTipo, fEspecial]);

  const abiertas = datos.filter((o) => !PIPELINE_CERRADO.includes(o.estado) && o.estado !== 'revisar_adelante');
  const comisionPotencial = abiertas.reduce((s, o) => s + (Number(o.comision_potencial) || 0), 0);
  const sinAccion = abiertas.filter((o) => !o.proxima_accion);

  async function cambiarEstado(o: LuzOportunidad, estado: string) {
    let extra: Record<string, unknown> = {};
    if (estado === 'perdido' && !o.motivo_perdida) {
      const motivo = prompt('Motivo de pérdida (obligatorio):');
      if (!motivo?.trim()) return;
      extra = { motivo_perdida: motivo.trim() };
    }
    if (estado === 'revisar_adelante' && !o.fecha_revision) {
      const fecha = prompt('Fecha de revisión futura (AAAA-MM-DD):', new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10));
      if (!fecha) return;
      extra = { fecha_revision: fecha };
    }
    const err = await guardarLuz('pipeline', 'PUT', { id: o.id, estado, ...extra });
    if (err) { setMsg(err); return; }
    setMsg('');
    recargar();
  }

  /** Ganado → crear contrato */
  async function convertirEnContrato(o: LuzOportunidad) {
    if (!confirm(`¿Crear contrato para "${o.nombre_oportunidad}"?`)) return;
    const err = await guardarLuz('contratos', 'POST', {
      cliente_id: o.cliente_id, cups_id: o.cups_id, pipeline_id: o.id,
      tarifa_acceso: o.tarifa, estado_contrato: 'pendiente_preparar',
      responsable: o.responsable,
      observaciones: `Creado desde pipeline: ${o.nombre_oportunidad}`,
    });
    if (err) { setMsg(err); return; }
    await guardarLuz('pipeline', 'PUT', { id: o.id, estado: 'ganado' });
    setMsg('✓ Contrato creado. Gestión en "Contratos y Activaciones".');
    recargar();
  }

  async function crearOportunidad(e: React.FormEvent) {
    e.preventDefault();
    const cliente = clientes.datos.find((c) => c.id === formOp.cliente_id);
    if (!cliente) { setErrorForm('Selecciona el cliente.'); return; }
    setErrorForm('');
    const err = await guardarLuz('pipeline', 'POST', {
      cliente_id: cliente.id,
      nombre_oportunidad: `${cliente.nombre} · ${TIPO_OPORTUNIDAD_LABEL[formOp.tipo_oportunidad]}`,
      tipo_oportunidad: formOp.tipo_oportunidad,
      estado: 'prospecto',
      comision_potencial: parseFloat(formOp.comision_potencial) || 0,
      proxima_accion: formOp.proxima_accion || null,
      fecha_proxima_accion: formOp.fecha_proxima_accion || null,
      responsable: formOp.responsable || cliente.responsable || null,
    });
    if (err) { setErrorForm(err); return; }
    setFormOp(OP_VACIA); setMostrarForm(false);
    recargar();
  }

  const selCls = 'rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 text-xs font-semibold';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Pipeline Energético</h2>
          <p className="text-xs text-muted mt-0.5">Oportunidades vivas — créalas aquí o desde la ficha del cliente.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Interruptor de vista Tablero / Tabla */}
          <div className="inline-flex rounded-lg border border-border/50 bg-card/60 p-0.5">
            <button
              onClick={() => setVista('tablero')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${vista === 'tablero' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Tablero
            </button>
            <button
              onClick={() => setVista('tabla')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${vista === 'tabla' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'}`}
            >
              <Table2 className="w-3.5 h-3.5" /> Tabla
            </button>
          </div>
          <a href={`/api/luz/exportar?tipo=pipeline${fEstado ? `&estado=${fEstado}` : ''}${fResp ? `&responsable=${encodeURIComponent(fResp)}` : ''}`} className={btnSecundario} download>
            <Download className="w-4 h-4" /> Exportar
          </a>
          <button onClick={() => setMostrarForm((v) => !v)} className={btnPrimario}>
            {mostrarForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {mostrarForm ? 'Cancelar' : 'Nueva oportunidad'}
          </button>
        </div>
      </div>

      {mostrarForm && (
        <Card>
          <form onSubmit={crearOportunidad} className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Cliente *</label>
                <select className={inputCls} value={formOp.cliente_id} onChange={(e) => setFormOp({ ...formOp, cliente_id: e.target.value })}>
                  <option value="">— Selecciona cliente —</option>
                  {clientes.datos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Tipo de oportunidad</label>
                <select className={inputCls} value={formOp.tipo_oportunidad} onChange={(e) => setFormOp({ ...formOp, tipo_oportunidad: e.target.value })}>
                  {TIPOS_OPORTUNIDAD.map((t) => <option key={t} value={t}>{TIPO_OPORTUNIDAD_LABEL[t]}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Comisión potencial (€)</label>
                <input className={inputCls} type="number" step="0.01" value={formOp.comision_potencial} onChange={(e) => setFormOp({ ...formOp, comision_potencial: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Próxima acción</label>
                <input className={inputCls} value={formOp.proxima_accion} onChange={(e) => setFormOp({ ...formOp, proxima_accion: e.target.value })} placeholder="Pedir factura, llamar..." />
              </div>
              <div>
                <label className={labelCls}>Fecha próxima acción</label>
                <input className={inputCls} type="date" value={formOp.fecha_proxima_accion} onChange={(e) => setFormOp({ ...formOp, fecha_proxima_accion: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Responsable</label>
                <SelectorResponsable valor={formOp.responsable} onCambio={(v) => setFormOp((f) => ({ ...f, responsable: v || '' }))} className={inputCls} />
              </div>
            </div>
            {errorForm && <p className="text-xs text-red-400">{errorForm}</p>}
            <button type="submit" className={btnPrimario}>Crear oportunidad</button>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Kpi valor={abiertas.length} etiqueta="Abiertas" color="text-secondary" />
        <Kpi valor={fmtEur(comisionPotencial)} etiqueta="Comisión potencial" color="text-amber-400" />
        <Kpi valor={sinAccion.length} etiqueta="⚠️ Sin próxima acción" color={sinAccion.length ? 'text-red-400' : 'text-emerald-400'} />
      </div>

      {msg && <p className="text-xs text-secondary bg-secondary/10 border border-secondary/25 rounded-lg p-2.5">{msg}</p>}

      <Card className="!p-3 space-y-2.5">
        <div className="flex gap-2 flex-wrap">
          <select className={selCls} value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
            <option value="">Estado: todos</option>
            {ESTADOS_PIPELINE.map((es) => <option key={es} value={es}>{ESTADO_PIPELINE_LABEL[es]}</option>)}
          </select>
          <select className={selCls} value={fResp} onChange={(e) => setFResp(e.target.value)}>
            <option value="">Responsable: todos</option>
            {responsables.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className={selCls} value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
            <option value="">Tipo: todos</option>
            {TIPOS_OPORTUNIDAD.map((t) => <option key={t} value={t}>{TIPO_OPORTUNIDAD_LABEL[t]}</option>)}
          </select>
        </div>
        <div className="flex gap-1.5 flex-wrap text-xs">
          {[['', 'Todas'], ['sin_accion', '🔴 Sin próxima acción'], ['vencida', '⏰ Acción vencida'], ['comision_alta', '💶 Comisión ≥1.000€'], ['ab', 'Clientes A/B']].map(([v, n]) => (
            <button key={v} onClick={() => setFEspecial(v)} className={`px-2.5 py-1.5 rounded-lg font-semibold ${fEspecial === v ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}>{n}</button>
          ))}
        </div>
      </Card>

      <EstadoCarga cargando={cargando} error={error} faltaMigracion={faltaMigracion}
        vacio={!cargando && !error && vista === 'tabla' && filtradas.length === 0}
        textoVacio="Sin oportunidades con este filtro." sqlFile="supabase_luz.sql" />

      {vista === 'tablero' && !cargando && !error && !faltaMigracion && (
        <TableroPipeline
          oportunidades={filtradas}
          onCambiarEstado={cambiarEstado}
          onConvertir={convertirEnContrato}
        />
      )}

      {vista === 'tabla' && filtradas.length > 0 && (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
                <th className="px-3 py-3">Pr.</th><th className="px-3 py-3">Cliente / Oportunidad</th>
                <th className="px-3 py-3">Tipo</th><th className="px-3 py-3 text-right">Consumo</th>
                <th className="px-3 py-3 text-right">Comisión pot.</th><th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3 text-center">Prob.</th><th className="px-3 py-3">Responsable</th>
                <th className="px-3 py-3">Próxima acción</th><th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((o) => {
                const abierta = !PIPELINE_CERRADO.includes(o.estado) && o.estado !== 'revisar_adelante';
                return (
                  <tr key={o.id} className="border-b border-border/20 hover:bg-card/50 transition">
                    <td className="px-3 py-2"><BadgePrioridad prioridad={o.luz_clientes?.prioridad} /></td>
                    <td className="px-3 py-2 font-semibold text-xs max-w-52">
                      {o.cliente_id
                        ? <Link href={`/gestor/luz/clientes/${o.cliente_id}`} className="hover:text-accent">{o.luz_clientes?.nombre || o.nombre_oportunidad}</Link>
                        : o.nombre_oportunidad}
                      {o.motivo_perdida && <span className="block text-[10px] text-red-400">✕ {o.motivo_perdida}</span>}
                      {o.fecha_revision && o.estado === 'revisar_adelante' && <span className="block text-[10px] text-muted">revisar {fmtFecha(o.fecha_revision)}</span>}
                    </td>
                    <td className="px-3 py-2 text-xs"><Badge>{TIPO_OPORTUNIDAD_LABEL[o.tipo_oportunidad]}</Badge></td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">{fmtKwh(Number(o.consumo_anual_kwh))}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{fmtEur(Number(o.comision_potencial))}</td>
                    <td className="px-3 py-2">
                      <select value={o.estado} onChange={(e) => cambiarEstado(o, e.target.value)}
                        className="rounded-md border border-border/40 bg-background/60 px-1.5 py-0.5 text-[11px] font-semibold max-w-32">
                        {ESTADOS_PIPELINE.map((es) => <option key={es} value={es}>{ESTADO_PIPELINE_LABEL[es]}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums text-xs">{o.probabilidad ?? 50}%</td>
                    <td className="px-3 py-2">
                      <SelectorResponsable valor={o.responsable} onCambio={async (v) => { await guardarLuz('pipeline', 'PUT', { id: o.id, responsable: v }); recargar(); }} />
                    </td>
                    <td className="px-3 py-2 text-xs max-w-44">
                      {abierta ? (
                        <input
                          className="w-full rounded-md border border-border/40 bg-background/60 px-1.5 py-1 text-[11px]"
                          defaultValue={o.proxima_accion || ''}
                          placeholder="⚠️ sin próxima acción"
                          onBlur={async (e) => { if (e.target.value !== (o.proxima_accion || '')) { await guardarLuz('pipeline', 'PUT', { id: o.id, proxima_accion: e.target.value || null }); recargar(); } }}
                        />
                      ) : <span className="text-muted">—</span>}
                      {o.fecha_proxima_accion && abierta && (
                        <span className={`block text-[10px] mt-0.5 ${(diasHasta(o.fecha_proxima_accion) ?? 0) < 0 ? 'text-red-400 font-bold' : 'text-muted'}`}>
                          {fmtFecha(o.fecha_proxima_accion)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {o.estado === 'ganado' ? (
                        <button onClick={() => convertirEnContrato(o)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-500 transition whitespace-nowrap">
                          <FileSignature className="w-3 h-3" /> Contrato
                        </button>
                      ) : abierta && o.estado === 'pendiente_firma' ? (
                        <button onClick={() => convertirEnContrato(o)} className="text-[10px] font-bold text-emerald-400 hover:underline whitespace-nowrap">→ contrato</button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

export default function PipelinePage() {
  return (
    <Suspense fallback={<div className="text-muted text-sm py-8 text-center">Cargando...</div>}>
      <PipelineContenido />
    </Suspense>
  );
}
