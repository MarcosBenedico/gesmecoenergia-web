'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, X, Download, LayoutGrid, List, CalendarDays } from 'lucide-react';
import {
  LuzTarea, LuzCliente, TIPOS_TAREA, TIPO_TAREA_LABEL, ESTADOS_TAREA, ESTADO_TAREA_LABEL,
  TAREAS_ABIERTAS, TAREAS_ADMINISTRATIVAS, ResponsableEquipo, responsableSugerido,
  MOTIVOS_BLOQUEO, MOTIVOS_ELIMINACION, diasHasta,
} from '@/lib/luz';
import { BotonDescarga, Card, Kpi, Badge, BadgeVencimiento, EstadoCarga, useListaLuz, guardarLuz, inputCls, labelCls, btnPrimario, btnSecundario, SelectorResponsable } from '../ui';
import { PedirMotivo } from '../motivo';
import { TableroTareas, bucketDeTarea, BucketTarea } from './tablero';
import { CalendarioTareas } from './calendario';

const FORM_VACIO = { descripcion: '', cliente_id: '', tipo_tarea: 'llamar_cliente', fecha_limite: '', prioridad: 'media', responsable: '' };

/** ¿La tarea pertenece al panel del responsable? Las compartidas ("A / B") cuentan para ambos. */
function esDelPanel(t: LuzTarea, panel: string): boolean {
  if (!panel) return true;
  if (!t.responsable) return panel === '__sin__';
  return t.responsable.split('/').map((s) => s.trim().toLowerCase()).some((n) => n.startsWith(panel.toLowerCase()));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function TareasLuzPage() {
  const { datos, cargando, error, faltaMigracion, recargar } = useListaLuz<LuzTarea>('tareas');
  const clientes = useListaLuz<LuzCliente>('clientes');
  const equipo = useListaLuz<ResponsableEquipo>('responsables', { activo: 'true' });
  // Motivo pendiente al bloquear/cancelar una tarea (movimiento con historia)
  const [pidiendoMotivo, setPidiendoMotivo] = useState<{ tarea: LuzTarea; estado: string } | null>(null);
  // ¿El usuario tocó el responsable a mano? Entonces no lo pisamos con la sugerencia
  const [respManual, setRespManual] = useState(false);
  const [panel, setPanel] = useState('');           // '' = todos · 'marcos' · 'david' · '__sin__'
  const [vista, setVista] = useState<'tablero' | 'calendario' | 'lista'>('tablero');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [errorForm, setErrorForm] = useState('');
  const [msg, setMsg] = useState('');
  const [verCompletadas, setVerCompletadas] = useState(false);

  // Recordar el panel elegido entre sesiones
  useEffect(() => {
    const p = localStorage.getItem('luz_tareas_panel');
    if (p !== null) setPanel(p);
  }, []);
  function cambiarPanel(p: string) {
    setPanel(p);
    localStorage.setItem('luz_tareas_panel', p);
  }

  /** Paneles disponibles: nombres simples extraídos de los responsables reales de las tareas. */
  const paneles = useMemo(() => {
    const nombres = new Set<string>();
    datos.forEach((t) => t.responsable?.split('/').forEach((s) => {
      const n = s.trim().split(' ')[0];
      if (n) nombres.add(n);
    }));
    return Array.from(nombres).sort();
  }, [datos]);

  const delPanel = useMemo(() => datos.filter((t) => esDelPanel(t, panel)), [datos, panel]);
  const abiertas = delPanel.filter((t) => TAREAS_ABIERTAS.includes(t.estado));
  const vencidas = abiertas.filter((t) => (diasHasta(t.fecha_limite) ?? 1) < 0);
  const paraHoy = abiertas.filter((t) => diasHasta(t.fecha_limite) === 0);

  const paraTablero = useMemo(() => delPanel.filter((t) => bucketDeTarea(t) !== null), [delPanel]);

  /** Cambio de tipo en el alta: sugiere el responsable según el reparto del equipo. */
  function cambiarTipoNuevo(tipo: string) {
    const sugerido = respManual ? null : responsableSugerido(tipo, equipo.datos);
    setForm((f) => ({ ...f, tipo_tarea: tipo, ...(sugerido ? { responsable: sugerido.nombre } : {}) }));
  }
  const sugerenciaActual = !respManual ? responsableSugerido(form.tipo_tarea, equipo.datos) : null;

  /** Cambiar estado: bloquear/cancelar piden el porqué (queda en las notas de la tarea). */
  function cambiarEstadoTarea(t: LuzTarea, estado: string) {
    if ((estado === 'bloqueada' || estado === 'cancelada') && t.estado !== estado) {
      setPidiendoMotivo({ tarea: t, estado });
      return;
    }
    guardarCambios(t.id, { estado, ...(estado === 'completada' ? { hecho_en: new Date().toISOString() } : {}) });
  }

  async function guardarMotivoEstado(motivo: string) {
    if (!pidiendoMotivo) return;
    const { tarea, estado } = pidiendoMotivo;
    const etiqueta = estado === 'bloqueada' ? 'Bloqueada' : 'Cancelada';
    const nota = `[${etiqueta} ${new Date().toLocaleDateString('es-ES')}] ${motivo}`;
    await guardarCambios(tarea.id, { estado, notas: tarea.notas ? `${tarea.notas}\n${nota}` : nota });
    setPidiendoMotivo(null);
  }

  // ── Acciones (todas persisten en base de datos) ──
  async function guardarCambios(id: string, cambios: Record<string, unknown>) {
    const err = await guardarLuz('tareas', 'PUT', { id, ...cambios });
    if (err) { setMsg(err); return; }
    setMsg('');
    recargar();
  }

  async function moverABucket(t: LuzTarea, bucket: BucketTarea) {
    if (bucket === 'atrasado') return;
    const hoy = new Date();
    const cambios: Record<string, unknown> = {};
    if (bucket === 'hecho') {
      cambios.estado = 'completada';
    } else {
      if (t.estado === 'completada') cambios.estado = 'pendiente';
      if (bucket === 'hoy') cambios.fecha_limite = iso(hoy);
      else if (bucket === 'semana') cambios.fecha_limite = iso(new Date(hoy.getTime() + 3 * 86400000));
      else if (bucket === 'futuro') cambios.fecha_limite = iso(new Date(hoy.getTime() + 14 * 86400000));
      else if (bucket === 'sin_fecha') cambios.fecha_limite = null;
    }
    await guardarCambios(t.id, cambios);
  }

  // Eliminar siempre con motivo: queda grabado en el Control General (quién, cuándo y por qué)
  const [pidiendoBorrado, setPidiendoBorrado] = useState<LuzTarea | null>(null);

  function borrarTarea(t: LuzTarea) {
    setPidiendoBorrado(t);
  }

  async function confirmarBorrado(motivo: string) {
    if (!pidiendoBorrado) return;
    const t = pidiendoBorrado;
    const nota = `[Eliminada ${new Date().toLocaleDateString('es-ES')}] Motivo: ${motivo}`;
    // Primero se apunta el motivo (queda en la auditoría) y después se elimina
    await guardarLuz('tareas', 'PUT', { id: t.id, notas: t.notas ? `${t.notas}\n${nota}` : nota });
    const err = await guardarLuz('tareas', 'DELETE', { id: t.id });
    if (err) setMsg(err);
    setPidiendoBorrado(null);
    recargar();
  }

  async function posponer(t: LuzTarea, dias: number) {
    const base = t.fecha_limite && (diasHasta(t.fecha_limite) ?? 0) >= 0 ? new Date(t.fecha_limite) : new Date();
    await guardarCambios(t.id, { fecha_limite: iso(new Date(base.getTime() + dias * 86400000)) });
  }

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

  // ── Lista profesional: agrupada por estado ──
  const GRUPOS: { estado: string; titulo: string; tono: string }[] = [
    { estado: 'pendiente', titulo: 'Pendientes', tono: 'text-amber-300' },
    { estado: 'en_curso', titulo: 'En curso', tono: 'text-secondary' },
    { estado: 'bloqueada', titulo: 'Bloqueadas', tono: 'text-red-400' },
  ];

  function FilaTarea({ t }: { t: LuzTarea }) {
    const abierta = TAREAS_ABIERTAS.includes(t.estado);
    return (
      <tr className={`border-b border-border/20 hover:bg-card/50 transition ${!abierta ? 'opacity-50' : ''}`}>
        <td className="px-3 py-2 w-8">
          <input type="checkbox" checked={t.estado === 'completada'}
            onChange={() => guardarCambios(t.id, { estado: t.estado === 'completada' ? 'pendiente' : 'completada' })}
            className="accent-[#22c55e] w-4 h-4" />
        </td>
        <td className="px-3 py-2 min-w-64">
          <input
            className="w-full bg-transparent text-xs font-semibold outline-none rounded px-1 py-0.5 hover:bg-background/50 focus:bg-background/70 focus:ring-1 focus:ring-accent/40"
            defaultValue={t.descripcion}
            onBlur={(e) => { if (e.target.value.trim() && e.target.value !== t.descripcion) guardarCambios(t.id, { descripcion: e.target.value.trim() }); }}
          />
        </td>
        <td className="px-3 py-2">
          <select className={`${selCls} max-w-40`} value={t.tipo_tarea}
            onChange={(e) => guardarCambios(t.id, { tipo_tarea: e.target.value })}>
            {TIPOS_TAREA.map((x) => <option key={x} value={x}>{TIPO_TAREA_LABEL[x]}</option>)}
          </select>
        </td>
        <td className="px-3 py-2 max-w-44">
          <select className={`${selCls} w-full`} value={t.cliente_id || ''}
            onChange={(e) => guardarCambios(t.id, { cliente_id: e.target.value || null })}>
            <option value="">— Sin cliente —</option>
            {clientes.datos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          {t.cliente_id && (
            <Link href={`/gestor/luz/clientes/${t.cliente_id}`} className="block text-[10px] text-accent hover:underline mt-0.5">ver ficha →</Link>
          )}
        </td>
        <td className="px-3 py-2">
          <SelectorResponsable valor={t.responsable} onCambio={(v) => guardarCambios(t.id, { responsable: v })} />
        </td>
        <td className="px-3 py-2">
          <input className={selCls} type="date" value={t.fecha_limite || ''}
            onChange={(e) => guardarCambios(t.id, { fecha_limite: e.target.value || null })} />
          {abierta && t.fecha_limite && <span className="block mt-0.5"><BadgeVencimiento fecha={t.fecha_limite} /></span>}
        </td>
        <td className="px-3 py-2">
          <select className={selCls} value={t.prioridad}
            onChange={(e) => guardarCambios(t.id, { prioridad: e.target.value })}>
            <option value="alta">🔴 Alta</option><option value="media">🟡 Media</option><option value="baja">⚪ Baja</option>
          </select>
        </td>
        <td className="px-3 py-2">
          <select className={selCls} value={t.estado}
            onChange={(e) => cambiarEstadoTarea(t, e.target.value)}>
            {ESTADOS_TAREA.map((es) => <option key={es} value={es}>{ESTADO_TAREA_LABEL[es]}</option>)}
          </select>
          {t.notas && <span className="block text-[10px] text-muted mt-0.5 max-w-40 truncate" title={t.notas}>💬 {t.notas.split('\n').pop()}</span>}
        </td>
        <td className="px-3 py-2 w-8">
          <button onClick={() => borrarTarea(t)} className="text-muted hover:text-red-400 text-xs">✕</button>
        </td>
      </tr>
    );
  }

  const cabecera = (
    <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
      <th className="px-3 py-2.5">✓</th><th className="px-3 py-2.5">Tarea</th><th className="px-3 py-2.5">Tipo</th>
      <th className="px-3 py-2.5">Cliente</th><th className="px-3 py-2.5">Responsable</th><th className="px-3 py-2.5">Fecha límite</th>
      <th className="px-3 py-2.5">Prioridad</th><th className="px-3 py-2.5">Estado</th><th className="px-3 py-2.5"></th>
    </tr>
  );

  const completadas = delPanel.filter((t) => t.estado === 'completada');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Tareas y Alertas</h2>
          <p className="text-xs text-muted mt-0.5">Qué hay que hacer y quién lo tiene que hacer. Todo cambio se guarda al momento.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Vistas */}
          <div className="inline-flex rounded-lg border border-border/50 bg-card/60 p-0.5">
            {([['tablero', 'Tablero', LayoutGrid], ['calendario', 'Calendario', CalendarDays], ['lista', 'Lista', List]] as const).map(([v, n, Icono]) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${vista === v ? 'bg-accent text-white' : 'text-muted hover:text-foreground'}`}
              >
                <Icono className="w-3.5 h-3.5" /> {n}
              </button>
            ))}
          </div>
          <BotonDescarga href="/api/luz/exportar?tipo=tareas" className={btnSecundario}>
            </BotonDescarga>
          <button
            onClick={() => {
              if (!mostrarForm) {
                setRespManual(false);
                const sug = responsableSugerido(FORM_VACIO.tipo_tarea, equipo.datos);
                setForm({ ...FORM_VACIO, ...(sug ? { responsable: sug.nombre } : {}) });
              }
              setMostrarForm((v) => !v);
            }}
            className={btnPrimario}
          >
            {mostrarForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {mostrarForm ? 'Cancelar' : 'Nueva tarea'}
          </button>
        </div>
      </div>

      {/* ── Panel por responsable ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Panel:</span>
        <div className="inline-flex rounded-xl border border-border/50 bg-card/60 p-0.5 flex-wrap">
          <button onClick={() => cambiarPanel('')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${panel === '' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'}`}>
            👥 Todos
          </button>
          {paneles.map((p) => (
            <button key={p} onClick={() => cambiarPanel(p)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${panel === p ? 'bg-accent text-white' : 'text-muted hover:text-foreground'}`}>
              {p}
            </button>
          ))}
          <button onClick={() => cambiarPanel('__sin__')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${panel === '__sin__' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'}`}>
            Sin asignar
          </button>
        </div>
      </div>

      {msg && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">{msg}</p>}

      <div className="grid grid-cols-3 gap-3">
        <Kpi valor={abiertas.length} etiqueta="Abiertas" />
        <Kpi valor={vencidas.length} etiqueta="Fuera de plazo" color={vencidas.length ? 'text-red-400' : 'text-emerald-400'} />
        <Kpi valor={paraHoy.length} etiqueta="Para hoy" color="text-amber-400" />
      </div>

      {mostrarForm && (
        <Card>
          <form onSubmit={crear} className="space-y-3">
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Tipo</label>
                <select className={inputCls} value={form.tipo_tarea} onChange={(e) => cambiarTipoNuevo(e.target.value)}>
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
                <SelectorResponsable
                  valor={form.responsable}
                  onCambio={(v) => { setRespManual(true); setForm((f) => ({ ...f, responsable: v || '' })); }}
                  className={inputCls}
                />
                {sugerenciaActual && form.responsable === sugerenciaActual.nombre && (
                  <p className="text-[10px] text-secondary mt-1">
                    ✨ Asignada a {sugerenciaActual.nombre} ({TAREAS_ADMINISTRATIVAS.includes(form.tipo_tarea) ? 'administración' : 'comercial'}) — cámbialo si lo lleva otra persona
                  </p>
                )}
              </div>
            </div>
            {errorForm && <p className="text-xs text-red-400">{errorForm}</p>}
            <button type="submit" className={btnPrimario}>Crear tarea</button>
          </form>
        </Card>
      )}

      <EstadoCarga cargando={cargando} error={error} faltaMigracion={faltaMigracion}
        vacio={!cargando && !error && delPanel.length === 0} textoVacio="Sin tareas en este panel. 👌" sqlFile="supabase_luz.sql" />

      {!cargando && !error && !faltaMigracion && (
        <>
          {vista === 'tablero' && (
            <TableroTareas tareas={paraTablero} clientes={clientes.datos} onMover={moverABucket} onBorrar={borrarTarea} onGuardar={guardarCambios} />
          )}

          {vista === 'calendario' && (
            <CalendarioTareas
              tareas={delPanel}
              onMoverADia={(t, fecha) => guardarCambios(t.id, { fecha_limite: fecha, ...(t.estado === 'completada' ? { estado: 'pendiente' } : {}) })}
              onCompletar={(t) => guardarCambios(t.id, { estado: 'completada' })}
              onPosponer={posponer}
            />
          )}

          {vista === 'lista' && (
            <div className="space-y-4">
              {GRUPOS.map(({ estado, titulo, tono }) => {
                const grupo = delPanel
                  .filter((t) => t.estado === estado)
                  .sort((a, b) => (a.fecha_limite || '9999').localeCompare(b.fecha_limite || '9999'));
                if (grupo.length === 0) return null;
                return (
                  <Card key={estado} className="!p-0 overflow-x-auto">
                    <p className={`px-4 pt-3 pb-1 text-xs font-black uppercase tracking-wide ${tono}`}>
                      {titulo} <span className="text-muted font-bold">({grupo.length})</span>
                    </p>
                    <table className="w-full text-sm">
                      <thead>{cabecera}</thead>
                      <tbody>{grupo.map((t) => <FilaTarea key={t.id} t={t} />)}</tbody>
                    </table>
                  </Card>
                );
              })}

              {/* Completadas, plegadas por defecto */}
              {completadas.length > 0 && (
                <Card className="!p-0 overflow-x-auto">
                  <button onClick={() => setVerCompletadas((v) => !v)} className="w-full text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-emerald-400 hover:bg-card/40 transition">
                    {verCompletadas ? '▾' : '▸'} Completadas <span className="text-muted font-bold">({completadas.length})</span>
                  </button>
                  {verCompletadas && (
                    <table className="w-full text-sm">
                      <thead>{cabecera}</thead>
                      <tbody>
                        {completadas
                          .sort((a, b) => (b.actualizado_en || '').localeCompare(a.actualizado_en || ''))
                          .slice(0, 100)
                          .map((t) => <FilaTarea key={t.id} t={t} />)}
                      </tbody>
                    </table>
                  )}
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {/* Motivo amable al bloquear/cancelar (queda en las notas y en el historial) */}
      {pidiendoMotivo && (
        <PedirMotivo
          titulo={pidiendoMotivo.estado === 'bloqueada' ? '¿Qué la tiene parada? 🙂' : '¿Por qué la cancelamos?'}
          subtitulo={`"${pidiendoMotivo.tarea.descripcion}" — un toque y seguimos; así el historial cuenta la historia completa.`}
          sugerencias={MOTIVOS_BLOQUEO}
          onGuardar={guardarMotivoEstado}
          onCancelar={() => setPidiendoMotivo(null)}
        />
      )}

      {/* Motivo obligatorio al eliminar: queda registrado en el Control General */}
      {pidiendoBorrado && (
        <PedirMotivo
          titulo="¿Por qué se elimina esta tarea?"
          subtitulo={`"${pidiendoBorrado.descripcion}" — el motivo queda registrado en el Control General.`}
          sugerencias={MOTIVOS_ELIMINACION}
          onGuardar={confirmarBorrado}
          onCancelar={() => setPidiendoBorrado(null)}
        />
      )}
    </div>
  );
}
