'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Download, Plus, RefreshCw, X } from 'lucide-react';
import {
  LuzFechaCritica, LuzCliente, LuzCups, TIPOS_FECHA, TIPO_FECHA_LABEL, TIPO_FECHA_TONO, PRIORIDADES,
  diasHasta, fmtFecha, tituloFechaCritica,
} from '@/lib/luz';
import { BotonDescarga, Card, BadgePrioridad, BadgeVencimiento, EstadoCarga, useListaLuz, guardarLuz, inputCls, labelCls, btnPrimario, btnSecundario, SelectorResponsable } from '../ui';
import { Consejo } from '../consejo';
import { PedirMotivo } from '../motivo';
import { MOTIVOS_ELIMINACION } from '@/lib/luz';

const FECHA_VACIA = { cliente_id: '', cups_id: '', tipo_fecha: 'fin_contrato', fecha: '', descripcion: '', responsable: '', titulo_personalizado: '' };

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const iso = (d: Date) => d.toISOString().slice(0, 10);

function FechasContenido() {
  const sp = useSearchParams();
  const hoy = new Date();
  const [vista, setVista] = useState<'calendario' | 'listado'>('calendario');
  const [ancla, setAncla] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const [fResp, setFResp] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [fPrioridad, setFPrioridad] = useState('');
  const [fEstado, setFEstado] = useState('pendiente');
  const [fDias, setFDias] = useState(sp.get('dias') || '');
  const [verD, setVerD] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [msgGen, setMsgGen] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FECHA_VACIA);
  const [errorForm, setErrorForm] = useState('');
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [diaActivo, setDiaActivo] = useState<string | null>(null);
  const [diasExpandidos, setDiasExpandidos] = useState<Set<string>>(new Set());
  const [detalle, setDetalle] = useState<LuzFechaCritica | null>(null);
  const clientes = useListaLuz<LuzCliente>('clientes');
  const cups = useListaLuz<LuzCups>('cups');

  /** CUPS de un cliente concreto (para asociar la fecha a un suministro). */
  const cupsDe = useMemo(() => {
    const m = new Map<string, LuzCups[]>();
    for (const c of cups.datos) m.set(c.cliente_id, [...(m.get(c.cliente_id) || []), c]);
    return m;
  }, [cups.datos]);
  const etiquetaCups = (c: LuzCups) => c.alias_suministro || `${c.cups.slice(0, 10)}…`;

  const rango = useMemo(() => {
    if (vista === 'listado') {
      return { desde: iso(new Date(Date.now() - 30 * 86400000)), hasta: iso(new Date(Date.now() + 180 * 86400000)) };
    }
    const ultimo = new Date(ancla.getFullYear(), ancla.getMonth() + 1, 0);
    return { desde: iso(new Date(ancla.getFullYear(), ancla.getMonth(), 1)), hasta: iso(ultimo) };
  }, [vista, ancla]);

  const { datos, cargando, error, faltaMigracion, recargar } = useListaLuz<LuzFechaCritica>('fechas', rango);
  const responsables = useMemo(() => Array.from(new Set(datos.map((f) => f.responsable).filter(Boolean))) as string[], [datos]);

  const eventos = useMemo(() => datos.filter((f) => {
    const prio = f.prioridad || f.luz_clientes?.prioridad || 'C';
    // Regla: los clientes D no saturan el calendario (sí salen en listado)
    if (vista === 'calendario' && !verD && prio === 'D') return false;
    if (fResp && f.responsable !== fResp) return false;
    if (fTipo && f.tipo_fecha !== fTipo) return false;
    if (fPrioridad && prio !== fPrioridad) return false;
    if (fEstado && f.estado !== fEstado) return false;
    if (fDias) {
      const d = diasHasta(f.fecha);
      if (d == null || d < 0 || d > parseInt(fDias)) return false;
    }
    return true;
  }), [datos, vista, verD, fResp, fTipo, fPrioridad, fEstado, fDias]);

  const porDia = useMemo(() => {
    const m = new Map<string, LuzFechaCritica[]>();
    for (const f of eventos) m.set(f.fecha, [...(m.get(f.fecha) || []), f]);
    return m;
  }, [eventos]);

  const celdas = useMemo(() => {
    const ultimo = new Date(ancla.getFullYear(), ancla.getMonth() + 1, 0).getDate();
    const offset = (new Date(ancla.getFullYear(), ancla.getMonth(), 1).getDay() + 6) % 7;
    return [...Array.from({ length: offset }, () => null as number | null), ...Array.from({ length: ultimo }, (_, i) => i + 1)];
  }, [ancla]);

  /** Crea las fechas críticas que falten a partir de las fechas guardadas en los CUPS. */
  async function generarDesdeCups() {
    setGenerando(true);
    setMsgGen('');
    try {
      const [cupsRes, fechasRes] = await Promise.all([fetch('/api/luz/cups'), fetch('/api/luz/fechas')]);
      const cupsList: LuzCups[] = (await cupsRes.json()).datos || [];
      const fechasList: LuzFechaCritica[] = (await fechasRes.json()).datos || [];
      const existe = (cupsId: string, tipo: string) => fechasList.some((f) => f.cups_id === cupsId && f.tipo_fecha === tipo);
      let creadas = 0;
      for (const c of cupsList) {
        if (['perdido', 'no_viable'].includes(c.estado_cups)) continue;
        const pares: [string, string | null][] = [
          ['fin_contrato', c.fecha_fin_contrato],
          ['fin_permanencia', c.fecha_fin_permanencia],
          ['limite_preaviso', c.fecha_limite_preaviso],
        ];
        for (const [tipo, fecha] of pares) {
          if (!fecha || existe(c.id, tipo)) continue;
          const err = await guardarLuz('fechas', 'POST', {
            cliente_id: c.cliente_id, cups_id: c.id, tipo_fecha: tipo, fecha,
            titulo: tituloFechaCritica(c.luz_clientes?.nombre || 'Cliente', c.cups, tipo, c.comercializadora_actual),
            prioridad: c.prioridad || c.luz_clientes?.prioridad || 'C',
            responsable: c.responsable,
          });
          if (!err) creadas++;
        }
      }
      setMsgGen(creadas > 0 ? `✓ ${creadas} fecha(s) crítica(s) creadas desde los CUPS.` : 'Todo al día: los CUPS con fechas ya tienen su fecha crítica.');
      recargar();
    } catch {
      setMsgGen('Error generando fechas.');
    } finally {
      setGenerando(false);
    }
  }

  async function crearFecha(e: React.FormEvent) {
    e.preventDefault();
    const cliente = clientes.datos.find((c) => c.id === form.cliente_id);
    if (!cliente) { setErrorForm('Selecciona el cliente.'); return; }
    if (!form.fecha) { setErrorForm('Indica la fecha.'); return; }
    if (form.tipo_fecha === 'personalizada' && !form.titulo_personalizado.trim()) {
      setErrorForm('Escribe el nombre de la fecha personalizada.'); return;
    }
    setErrorForm('');
    const cupsSel = cups.datos.find((c) => c.id === form.cups_id);
    const err = await guardarLuz('fechas', 'POST', {
      cliente_id: cliente.id,
      cups_id: form.cups_id || null,
      tipo_fecha: form.tipo_fecha,
      fecha: form.fecha,
      titulo: form.tipo_fecha === 'personalizada'
        ? `LUZ - ${cliente.nombre} - ${form.titulo_personalizado.trim()}`
        : tituloFechaCritica(cliente.nombre, cupsSel?.cups || '', form.tipo_fecha, cupsSel?.comercializadora_actual),
      descripcion: form.descripcion || null,
      prioridad: cliente.prioridad || 'C',
      responsable: form.responsable || cliente.responsable || null,
    });
    if (err) { setErrorForm(err); return; }
    setForm(FECHA_VACIA); setMostrarForm(false);
    recargar();
  }

  async function cambiarFecha(f: LuzFechaCritica, campos: Record<string, unknown>) {
    const err = await guardarLuz('fechas', 'PUT', { id: f.id, ...campos });
    if (err) { setMsgGen(err); return; }
    recargar();
  }

  // Eliminar con motivo: la justificación queda en la auditoría (Control General)
  const [borrando, setBorrando] = useState<LuzFechaCritica | null>(null);
  async function confirmarBorrado(motivo: string) {
    if (!borrando) return;
    const f = borrando;
    const nota = `[Eliminada ${new Date().toLocaleDateString('es-ES')}] Motivo: ${motivo}`;
    await guardarLuz('fechas', 'PUT', { id: f.id, descripcion: f.descripcion ? `${f.descripcion}\n${nota}` : nota });
    const err = await guardarLuz('fechas', 'DELETE', { id: f.id });
    if (err) setMsgGen(`No se pudo eliminar: ${err}`);
    setBorrando(null);
    setDetalle(null);
    recargar();
  }
  function borrarFecha(f: LuzFechaCritica) {
    setBorrando(f);
  }

  /** Soltar una fecha crítica en otro día del calendario → se guarda al momento. */
  function soltarEnDia(fecha: string, e: React.DragEvent) {
    e.preventDefault();
    setDiaActivo(null);
    const id = e.dataTransfer.getData('text/plain') || arrastrando;
    setArrastrando(null);
    if (!id) return;
    const f = datos.find((x) => x.id === id);
    if (f && f.fecha !== fecha) cambiarFecha(f, { fecha });
  }

  const selCls = 'rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 text-xs font-semibold';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Fechas Críticas</h2>
          <p className="text-xs text-muted mt-0.5">{eventos.length} evento(s) · fin contrato, permanencias, preavisos, firmas, activaciones y comisiones</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setMostrarForm((v) => !v)} className={btnPrimario}>
            {mostrarForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {mostrarForm ? 'Cancelar' : 'Nueva fecha'}
          </button>
          <button onClick={generarDesdeCups} disabled={generando} className={btnSecundario} title="Crear fechas críticas desde las fechas de los CUPS">
            <RefreshCw className={`w-4 h-4 ${generando ? 'animate-spin' : ''}`} /> Generar desde CUPS
          </button>
          <BotonDescarga href={`/api/luz/exportar?tipo=fechas${fTipo ? `&tipo_fecha=${fTipo}` : ''}${fResp ? `&responsable=${encodeURIComponent(fResp)}` : ''}`} className={btnSecundario}></BotonDescarga>
          {(['calendario', 'listado'] as const).map((v) => (
            <button key={v} onClick={() => setVista(v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${vista === v ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}>{v}</button>
          ))}
          {vista === 'calendario' && (
            <>
              <button onClick={() => setAncla(new Date(ancla.getFullYear(), ancla.getMonth() - 1, 1))} className={btnSecundario}><ChevronLeft className="w-4 h-4" /></button>
              <span className="font-bold text-sm min-w-32 text-center">{MESES[ancla.getMonth()]} {ancla.getFullYear()}</span>
              <button onClick={() => setAncla(new Date(ancla.getFullYear(), ancla.getMonth() + 1, 1))} className={btnSecundario}><ChevronRight className="w-4 h-4" /></button>
            </>
          )}
        </div>
      </div>

      <Consejo clave="fechas">Una fecha crítica es algo que ocurre solo (fin de contrato, permanencia, presentar proyecto). El trabajo que genera se apunta como tarea. Asóciala a su CUPS si el cliente tiene varios.</Consejo>

      {msgGen && <p className="text-xs text-secondary bg-secondary/10 border border-secondary/25 rounded-lg p-2.5">{msgGen}</p>}

      {mostrarForm && (
        <Card>
          <form onSubmit={crearFecha} className="space-y-3">
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Cliente *</label>
                <select className={inputCls} value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value, cups_id: '' })}>
                  <option value="">— Selecciona —</option>
                  {clientes.datos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>CUPS / Suministro (opcional)</label>
                <select className={inputCls} value={form.cups_id} onChange={(e) => setForm({ ...form, cups_id: e.target.value })} disabled={!form.cliente_id}>
                  <option value="">— Todo el cliente —</option>
                  {(cupsDe.get(form.cliente_id) || []).map((c) => <option key={c.id} value={c.id}>{etiquetaCups(c)}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Tipo de fecha</label>
                <select className={inputCls} value={form.tipo_fecha} onChange={(e) => setForm({ ...form, tipo_fecha: e.target.value })}>
                  {TIPOS_FECHA.map((t) => <option key={t} value={t}>{TIPO_FECHA_LABEL[t]}</option>)}
                  <option value="personalizada">✏️ Otro (nombre personalizado)…</option>
                </select>
              </div>
              {form.tipo_fecha === 'personalizada' && (
                <div className="md:col-span-2">
                  <label className={labelCls}>Nombre personalizado *</label>
                  <input className={inputCls} value={form.titulo_personalizado} autoFocus
                    onChange={(e) => setForm({ ...form, titulo_personalizado: e.target.value })}
                    placeholder="P. ej. Cita con el instalador, Entrega de documentación..." />
                </div>
              )}
              <div><label className={labelCls}>Fecha *</label><input className={inputCls} type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
              <div>
                <label className={labelCls}>Responsable</label>
                <SelectorResponsable valor={form.responsable} onCambio={(v) => setForm((f) => ({ ...f, responsable: v || '' }))} className={inputCls} />
              </div>
              <div className="md:col-span-4"><label className={labelCls}>Descripción</label><input className={inputCls} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Detalle opcional..." /></div>
            </div>
            {errorForm && <p className="text-xs text-red-400">{errorForm}</p>}
            <button type="submit" className={btnPrimario}>Crear fecha crítica</button>
          </form>
        </Card>
      )}

      <Card className="!p-3">
        <div className="flex gap-2 flex-wrap items-center">
          <select className={selCls} value={fResp} onChange={(e) => setFResp(e.target.value)}>
            <option value="">Responsable: todos</option>
            {responsables.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className={selCls} value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
            <option value="">Tipo: todos</option>
            {TIPOS_FECHA.map((t) => <option key={t} value={t}>{TIPO_FECHA_LABEL[t]}</option>)}
          </select>
          <select className={selCls} value={fPrioridad} onChange={(e) => setFPrioridad(e.target.value)}>
            <option value="">Prioridad: todas</option>
            {PRIORIDADES.map((p) => <option key={p} value={p}>Prioridad {p}</option>)}
          </select>
          <select className={selCls} value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
            <option value="pendiente">Pendientes</option>
            <option value="gestionada">Gestionadas</option>
            <option value="">Todas</option>
          </select>
          <select className={selCls} value={fDias} onChange={(e) => setFDias(e.target.value)}>
            <option value="">Horizonte: todo</option>
            {[15, 30, 60, 90, 120].map((d) => <option key={d} value={d}>Próximos {d} días</option>)}
          </select>
          {vista === 'calendario' && (
            <label className="flex items-center gap-1.5 text-xs text-muted font-semibold cursor-pointer ml-auto">
              <input type="checkbox" checked={verD} onChange={(e) => setVerD(e.target.checked)} />
              Mostrar clientes D
            </label>
          )}
        </div>
      </Card>

      <EstadoCarga cargando={cargando} error={error} faltaMigracion={faltaMigracion} vacio={false} textoVacio="" sqlFile="supabase_luz.sql" />

      {!cargando && vista === 'calendario' && (
        <Card className="!p-3">
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {DIAS_SEMANA.map((d) => <div key={d} className="text-center text-[11px] font-bold text-muted py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {celdas.map((dia, i) => {
              if (dia === null) return <div key={`v-${i}`} />;
              const fecha = `${ancla.getFullYear()}-${String(ancla.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
              const lista = porDia.get(fecha) || [];
              const esHoy = fecha === iso(hoy);
              const expandido = diasExpandidos.has(fecha);
              const visibles = expandido ? lista : lista.slice(0, 3);
              const activo = diaActivo === fecha;
              return (
                <div
                  key={dia}
                  onDragOver={(e) => { e.preventDefault(); setDiaActivo(fecha); }}
                  onDragLeave={() => setDiaActivo((d) => (d === fecha ? null : d))}
                  onDrop={(e) => soltarEnDia(fecha, e)}
                  className={`min-h-24 rounded-lg border p-1.5 transition ${
                    activo ? 'border-accent bg-accent/15 ring-2 ring-accent/40'
                    : esHoy ? 'border-accent bg-accent/10'
                    : lista.length ? 'border-border/40 bg-card/40' : 'border-border/20 bg-card/20'
                  }`}
                >
                  <p className={`text-[11px] font-bold ${esHoy ? 'text-accent' : 'text-muted'}`}>{dia}</p>
                  <div className="space-y-1 mt-1">
                    {visibles.map((f) => (
                      <button key={f.id} type="button"
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData('text/plain', f.id); e.dataTransfer.effectAllowed = 'move'; setArrastrando(f.id); }}
                        onDragEnd={() => { setArrastrando(null); setDiaActivo(null); }}
                        onClick={() => setDetalle(f)}
                        className={`block w-full text-left text-[10px] leading-tight px-1.5 py-1 rounded border truncate hover:brightness-125 transition cursor-grab active:cursor-grabbing ${
                          TIPO_FECHA_TONO[f.tipo_fecha] || 'bg-card/60 text-muted border-border/30'
                        } ${arrastrando === f.id ? 'opacity-40' : ''}`}
                        title={`${f.titulo} — clic para ver el detalle · arrastra a otro día para cambiar la fecha`}>
                        {f.titulo.replace(/^LUZ - /, '')}
                      </button>
                    ))}
                    {lista.length > 3 && (
                      <button
                        onClick={() => setDiasExpandidos((prev) => {
                          const s = new Set(prev);
                          if (s.has(fecha)) s.delete(fecha); else s.add(fecha);
                          return s;
                        })}
                        className="w-full text-left text-[10px] font-bold text-accent hover:underline px-1"
                      >
                        {expandido ? '− ver menos' : `+${lista.length - 3} más`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-1.5 flex-wrap mt-3 items-center">
            {TIPOS_FECHA.map((t) => (
              <span key={t} className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${TIPO_FECHA_TONO[t]}`}>{TIPO_FECHA_LABEL[t]}</span>
            ))}
            <span className="text-[10px] text-muted/70 italic ml-auto">💡 Clic en un evento para ver su detalle · arrastra a otro día para cambiar su fecha</span>
          </div>
        </Card>
      )}

      {/* ── Detalle de una fecha crítica (clic en el calendario) ── */}
      {detalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4" onClick={() => setDetalle(null)}>
          <div className="w-full max-w-md rounded-2xl p-5 bg-surface border border-accent/30 shadow-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-semibold mb-1.5 ${TIPO_FECHA_TONO[detalle.tipo_fecha] || 'bg-card/60 text-muted border-border/30'}`}>
                  {TIPO_FECHA_LABEL[detalle.tipo_fecha] || 'Personalizada'}
                </span>
                <h3 className="font-bold text-sm leading-snug">{detalle.titulo.replace(/^LUZ - /, '')}</h3>
              </div>
              <button onClick={() => setDetalle(null)} className="text-muted hover:text-foreground shrink-0"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-xs space-y-1.5">
              <p><span className="text-muted">📅 Fecha:</span> <b>{fmtFecha(detalle.fecha)}</b> {(() => { const d = diasHasta(detalle.fecha); return d != null ? <span className={d < 0 ? 'text-red-400' : d <= 7 ? 'text-amber-300' : 'text-muted'}>({d < 0 ? `hace ${-d} días` : d === 0 ? 'hoy' : `en ${d} días`})</span> : null; })()}</p>
              {detalle.descripcion && <p className="whitespace-pre-wrap"><span className="text-muted">📝 Descripción:</span> {detalle.descripcion}</p>}
              {detalle.responsable && <p><span className="text-muted">👤 Responsable:</span> {detalle.responsable}</p>}
              {detalle.prioridad && <p><span className="text-muted">Prioridad:</span> {detalle.prioridad}</p>}
            </div>
            <div className="flex gap-2">
              <Link href={`/gestor/luz/clientes/${detalle.cliente_id}`} className={`${btnPrimario} flex-1 justify-center`}>
                Ver ficha del cliente →
              </Link>
              <button onClick={() => setDetalle(null)} className={btnSecundario}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {borrando && (
        <PedirMotivo
          titulo="¿Por qué se elimina esta fecha crítica?"
          subtitulo={`"${borrando.titulo}" — el motivo queda registrado en el Control General.`}
          sugerencias={MOTIVOS_ELIMINACION}
          onGuardar={confirmarBorrado}
          onCancelar={() => setBorrando(null)}
        />
      )}

      {!cargando && vista === 'listado' && (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
                <th className="px-3 py-3">Fecha</th><th className="px-3 py-3">Pr.</th><th className="px-3 py-3">Evento</th>
                <th className="px-3 py-3">CUPS</th><th className="px-3 py-3">Tipo</th>
                <th className="px-3 py-3">Responsable</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {[...eventos].sort((a, b) => a.fecha.localeCompare(b.fecha)).map((f) => (
                <tr key={f.id} className="border-b border-border/20 hover:bg-card/50 transition">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input type="date" className={`${selCls} w-32`} value={f.fecha}
                      onChange={(e) => e.target.value && cambiarFecha(f, { fecha: e.target.value })} />
                    <span className="block mt-1"><BadgeVencimiento fecha={f.fecha} /></span>
                  </td>
                  <td className="px-3 py-2">
                    <select value={f.prioridad || f.luz_clientes?.prioridad || 'C'}
                      onChange={(e) => cambiarFecha(f, { prioridad: e.target.value })}
                      className={`${selCls} !px-1.5`}>
                      {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 min-w-64">
                    <input
                      className="w-full bg-transparent text-xs font-semibold outline-none rounded px-1.5 py-1 hover:bg-background/50 focus:bg-background/70 focus:ring-1 focus:ring-accent/40"
                      defaultValue={f.titulo}
                      onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== f.titulo) cambiarFecha(f, { titulo: v }); }}
                    />
                    <Link href={`/gestor/luz/clientes/${f.cliente_id}`} className="block text-[10px] text-accent hover:underline px-1.5">
                      {f.luz_clientes?.nombre || 'ver cliente'} →
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <select value={f.cups_id || ''}
                      onChange={(e) => cambiarFecha(f, { cups_id: e.target.value || null })}
                      className={`${selCls} max-w-36`}>
                      <option value="">— Todo el cliente —</option>
                      {(cupsDe.get(f.cliente_id) || []).map((c) => <option key={c.id} value={c.id}>{etiquetaCups(c)}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select value={f.tipo_fecha}
                      onChange={(e) => cambiarFecha(f, { tipo_fecha: e.target.value })}
                      className={`${selCls} max-w-36`}>
                      {TIPOS_FECHA.map((t) => <option key={t} value={t}>{TIPO_FECHA_LABEL[t]}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <SelectorResponsable valor={f.responsable} onCambio={(v) => cambiarFecha(f, { responsable: v })} />
                  </td>
                  <td className="px-3 py-2">
                    <select value={f.estado}
                      onChange={(e) => cambiarFecha(f, { estado: e.target.value })}
                      className={selCls}>
                      <option value="pendiente">Pendiente</option>
                      <option value="gestionada">Gestionada</option>
                      <option value="descartada">Descartada</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => borrarFecha(f)} className="text-muted hover:text-red-400 text-xs" title="Eliminar fecha">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {eventos.length === 0 && <p className="text-sm text-muted text-center py-8">Sin fechas críticas con este filtro.</p>}
        </Card>
      )}
    </div>
  );
}

export default function FechasPage() {
  return (
    <Suspense fallback={<div className="text-muted text-sm py-8 text-center">Cargando...</div>}>
      <FechasContenido />
    </Suspense>
  );
}
