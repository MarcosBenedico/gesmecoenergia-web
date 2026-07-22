'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronDown, ChevronRight, Plus, RefreshCw, Search, X, History } from 'lucide-react';
import { GuardiaAdmin } from '@/components/guardia-modulo';
import { CONFIANZA_LABEL, fmtEur2, r2, BATERIAS_MERCADO, INVERSORES_MERCADO, RefMercado } from '@/lib/fv';
import { Card, Kpi, inputCls, labelCls, btnPrimario, btnSecundario } from '../../ui';
import { tokenSesion } from '@/lib/usuario';
import { PedirMotivo } from '../../motivo';

/**
 * Catálogo de precios FV — panel interactivo:
 *  - Buscador + filtros por categoría y confianza, KPIs de salud del catálogo.
 *  - Cada referencia se despliega para editarlo TODO en línea (precio con motivo,
 *    descripción, marca, alcance, advertencia, confianza de un clic).
 *  - Histórico de precios por referencia y dónde se usó en presupuestos de Óscar.
 */

async function api(metodo: string, body?: Record<string, unknown>, qs = '') {
  const token = await tokenSesion();
  const res = await fetch(`/api/fv/catalogo${qs}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { ok: res.ok, json: await res.json().catch(() => ({})) };
}

interface RefCatalogo {
  id: string; codigo: string; categoria: string; descripcion: string; marca: string | null;
  unidad: string; precio_base: number; precio_min: number | null; precio_max: number | null;
  num_referencias: number; confianza: string; alcance: string | null; advertencia: string | null; activo: boolean;
}
interface OscarPres { id: string; numero: string; cliente: string; num_paneles: number; inversor: string; bateria: string; subtotal: number; total: number; observaciones: string | null }
interface OscarItem { id: string; oscar_id: string; codigo_catalogo: string | null; descripcion: string; cantidad: number; precio_unitario: number; importe: number; opcional: boolean }
interface Historial { id: string; codigo: string; precio_anterior: number; precio_nuevo: number; motivo: string | null; usuario: string | null; creado_en: string }

const CATEGORIA_LABEL: Record<string, string> = {
  paneles: '☀️ Paneles', estructuras: '🔩 Estructuras', inversores: '⚡ Inversores', baterias: '🔋 Baterías',
  monitorizacion: '📡 Monitorización', instalacion: '🔧 Instalación', tramites: '📋 Trámites', ingenieria: '📐 Ingeniería',
  linea: '🔌 Línea adicional', otros: '📦 Otros',
};
const CONFIANZA_ORDEN = ['alta', 'media', 'baja', 'pendiente'];
const CONFIANZA_TONO: Record<string, string> = {
  alta: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  media: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  baja: 'bg-red-500/15 text-red-400 border-red-500/30',
  pendiente: 'bg-card/80 text-muted border-border/50',
};

const NUEVO = { codigo: '', categoria: 'otros', descripcion: '', marca: '', unidad: 'ud', precio_base: '', confianza: 'media', alcance: '', advertencia: '' };

export default function CatalogoPage() {
  return <GuardiaAdmin nombre="Catálogo FV"><Catalogo /></GuardiaAdmin>;
}

function Catalogo() {
  const [refs, setRefs] = useState<RefCatalogo[]>([]);
  const [oscar, setOscar] = useState<OscarPres[]>([]);
  const [items, setItems] = useState<OscarItem[]>([]);
  const [historial, setHistorial] = useState<Historial[]>([]);
  const [abiertoOscar, setAbiertoOscar] = useState<string | null>(null);
  const [refAbierta, setRefAbierta] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nuevo, setNuevo] = useState(NUEVO);
  const [cambioPrecio, setCambioPrecio] = useState<{ ref: RefCatalogo; precio: number } | null>(null);

  // Filtros
  const [buscar, setBuscar] = useState('');
  const [fCat, setFCat] = useState('');
  const [fConf, setFConf] = useState('');
  const [verInactivas, setVerInactivas] = useState(false);
  const [verMercado, setVerMercado] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const [c, o, h] = await Promise.all([api('GET'), api('GET', undefined, '?recurso=oscar'), api('GET', undefined, '?recurso=historial')]);
    if (!c.ok) { setError(c.json.error || 'Error.'); setCargando(false); return; }
    setRefs(c.json.datos); setOscar(o.json.datos || []); setItems(o.json.items || []); setHistorial(h.json.datos || []);
    setError(''); setCargando(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function guardarCampo(ref: RefCatalogo, campos: Record<string, unknown>, motivo?: string) {
    const { ok, json } = await api('PUT', { id: ref.id, ...campos, ...(motivo ? { motivo } : {}) });
    if (!ok) { setError(json.error || 'Error.'); return; }
    setError(''); setMsg('✓ Guardado.');
    cargar();
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    const { ok, json } = await api('POST', { ...nuevo, precio_base: parseFloat(nuevo.precio_base) || 0 });
    if (!ok) { setError(json.error || 'Error.'); return; }
    setNuevo(NUEVO); setMostrarForm(false); setMsg('✓ Referencia creada.');
    cargar();
  }

  /** Añade una referencia de mercado al catálogo con precio de mercado (elegible en presupuestos). */
  async function anadirDesdeMercado(r: RefMercado, categoria: 'baterias' | 'inversores') {
    const codigo = `${categoria === 'baterias' ? 'BAT' : 'INV'}-MERC-${r.marca.slice(0, 3).toUpperCase()}-${Math.round(r.medida * 10)}`;
    const descripcion = `${r.marca} ${r.modelo} · ${r.medida} ${categoria === 'baterias' ? 'kWh' : 'kW'} · ${r.detalle}`;
    const { ok, json } = await api('POST', {
      codigo, categoria, descripcion, marca: r.marca, unidad: 'ud',
      precio_base: r.precio, confianza: 'alta', alcance: 'Precio de mercado (material sin IVA)',
      advertencia: 'Precio orientativo de mercado: confírmalo con el distribuidor.',
    });
    if (!ok) { setError(json.error || 'No se pudo añadir.'); return; }
    setError(''); setMsg(`✓ ${r.marca} ${r.modelo} añadido al catálogo con precio de mercado.`);
    cargar();
  }

  /** Confianza de un clic: alta → media → baja → pendiente → alta. */
  function rotarConfianza(ref: RefCatalogo) {
    const siguiente = CONFIANZA_ORDEN[(CONFIANZA_ORDEN.indexOf(ref.confianza) + 1) % CONFIANZA_ORDEN.length];
    guardarCampo(ref, { confianza: siguiente });
  }

  // ── Filtros aplicados ──
  const filtradas = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return refs.filter((ref) =>
      (verInactivas || ref.activo) &&
      (!fCat || ref.categoria === fCat) &&
      (!fConf || ref.confianza === fConf) &&
      (!q || `${ref.codigo} ${ref.descripcion} ${ref.marca || ''} ${ref.alcance || ''}`.toLowerCase().includes(q))
    );
  }, [refs, buscar, fCat, fConf, verInactivas]);

  const categorias = useMemo(() => Array.from(new Set(refs.map((ref) => ref.categoria))), [refs]);
  const kpis = useMemo(() => ({
    total: refs.filter((ref) => ref.activo).length,
    baja: refs.filter((ref) => ref.activo && (ref.confianza === 'baja' || ref.confianza === 'pendiente')).length,
    conAviso: refs.filter((ref) => ref.activo && ref.advertencia).length,
    cambios30: historial.filter((h) => Date.now() - new Date(h.creado_en).getTime() < 30 * 86400000).length,
  }), [refs, historial]);

  /** Usos de una referencia en los presupuestos históricos de Óscar. */
  const usosDe = (codigo: string) => items.filter((i) => i.codigo_catalogo === codigo);
  const historialDe = (codigo: string) => historial.filter((h) => h.codigo === codigo);

  /** Posición del precio base dentro del rango mín–máx (para la barra visual). */
  const posEnRango = (ref: RefCatalogo): number | null => {
    if (ref.precio_min == null || ref.precio_max == null || Number(ref.precio_max) <= Number(ref.precio_min)) return null;
    return Math.min(Math.max((Number(ref.precio_base) - Number(ref.precio_min)) / (Number(ref.precio_max) - Number(ref.precio_min)), 0), 1) * 100;
  };

  /** Campo de texto editable en línea (guarda al salir). */
  const CampoTexto = ({ refCat, campo, valor, placeholder, ancho = '' }: { refCat: RefCatalogo; campo: string; valor: string | null; placeholder: string; ancho?: string }) => (
    <input
      className={`${inputCls} !py-1.5 !text-xs ${ancho}`}
      defaultValue={valor || ''}
      placeholder={placeholder}
      onBlur={(e) => { const v = e.target.value.trim(); if (v !== (valor || '')) guardarCampo(refCat, { [campo]: v || null }); }}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Link href="/gestor/luz/fv" className={btnSecundario}><ChevronLeft className="w-4 h-4" /> Calculadora FV</Link>
          <div>
            <h2 className="text-lg font-black text-foreground">📚 Catálogo de precios FV</h2>
            <p className="text-xs text-muted">Precios reales de Óscar (sin IVA). Clic en una referencia para editarlo todo; los cambios de precio piden motivo y guardan histórico.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} className={btnSecundario}><RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} /></button>
          <button onClick={() => setMostrarForm((v) => !v)} className={btnPrimario}>{mostrarForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Referencia</button>
        </div>
      </div>

      {/* Salud del catálogo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi valor={kpis.total} etiqueta="Referencias activas" />
        <Kpi valor={kpis.baja} etiqueta="Confianza baja / pendiente" color={kpis.baja ? 'text-red-400' : 'text-emerald-400'} />
        <Kpi valor={kpis.conAviso} etiqueta="Con advertencia" color={kpis.conAviso ? 'text-amber-300' : 'text-foreground'} />
        <Kpi valor={kpis.cambios30} etiqueta="Cambios de precio (30 días)" />
      </div>

      {msg && <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5">{msg}</p>}
      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">{error}</p>}

      {/* Buscador y filtros */}
      <Card className="!p-3 space-y-2">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-52">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input className={`${inputCls} !pl-8 !py-2`} value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por código, descripción, marca o alcance..." />
          </div>
          <select className={`${inputCls} !w-auto !py-2 !text-xs`} value={fConf} onChange={(e) => setFConf(e.target.value)}>
            <option value="">Confianza: todas</option>
            {CONFIANZA_ORDEN.map((c) => <option key={c} value={c}>{CONFIANZA_LABEL[c]}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-muted font-semibold cursor-pointer">
            <input type="checkbox" checked={verInactivas} onChange={(e) => setVerInactivas(e.target.checked)} />
            Ver inactivas
          </label>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setFCat('')} className={`px-2.5 py-1 rounded-full border text-[11px] font-bold transition ${!fCat ? 'bg-accent text-white border-accent' : 'bg-card/60 text-muted border-border/40 hover:border-accent/50'}`}>
            Todas ({refs.filter((ref) => verInactivas || ref.activo).length})
          </button>
          {categorias.map((cat) => (
            <button key={cat} onClick={() => setFCat(fCat === cat ? '' : cat)}
              className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold transition ${fCat === cat ? 'bg-accent text-white border-accent' : 'bg-card/60 text-muted border-border/40 hover:border-accent/50'}`}>
              {CATEGORIA_LABEL[cat] || cat} ({refs.filter((ref) => ref.categoria === cat && (verInactivas || ref.activo)).length})
            </button>
          ))}
        </div>
      </Card>

      {/* Alta de referencia */}
      {mostrarForm && (
        <Card>
          <form onSubmit={crear} className="grid md:grid-cols-4 gap-3">
            <div><label className={labelCls}>Código *</label><input className={inputCls} value={nuevo.codigo} onChange={(e) => setNuevo({ ...nuevo, codigo: e.target.value.toUpperCase() })} placeholder="BAT-XXX-10" /></div>
            <div>
              <label className={labelCls}>Categoría</label>
              <select className={inputCls} value={nuevo.categoria} onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })}>
                {Object.entries(CATEGORIA_LABEL).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </div>
            <div className="md:col-span-2"><label className={labelCls}>Descripción *</label><input className={inputCls} value={nuevo.descripcion} onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })} /></div>
            <div><label className={labelCls}>Marca</label><input className={inputCls} value={nuevo.marca} onChange={(e) => setNuevo({ ...nuevo, marca: e.target.value })} /></div>
            <div>
              <label className={labelCls}>Unidad</label>
              <select className={inputCls} value={nuevo.unidad} onChange={(e) => setNuevo({ ...nuevo, unidad: e.target.value })}>
                <option value="ud">Unidad</option><option value="por_panel">Por panel</option><option value="conjunto">Conjunto</option>
              </select>
            </div>
            <div><label className={labelCls}>Precio base (€ sin IVA) *</label><input className={inputCls} type="number" min="0" step="0.01" value={nuevo.precio_base} onChange={(e) => setNuevo({ ...nuevo, precio_base: e.target.value })} /></div>
            <div>
              <label className={labelCls}>Confianza</label>
              <select className={inputCls} value={nuevo.confianza} onChange={(e) => setNuevo({ ...nuevo, confianza: e.target.value })}>
                {Object.entries(CONFIANZA_LABEL).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </div>
            <div className="md:col-span-2"><label className={labelCls}>Alcance (qué incluye)</label><input className={inputCls} value={nuevo.alcance} onChange={(e) => setNuevo({ ...nuevo, alcance: e.target.value })} /></div>
            <div className="md:col-span-2"><label className={labelCls}>Advertencia al usarlo</label><input className={inputCls} value={nuevo.advertencia} onChange={(e) => setNuevo({ ...nuevo, advertencia: e.target.value })} /></div>
            <div className="md:col-span-4"><button type="submit" className={btnPrimario}>Crear referencia</button></div>
          </form>
        </Card>
      )}

      {/* Referencias filtradas, agrupadas por categoría */}
      {!cargando && filtradas.length === 0 && (
        <Card><p className="text-sm text-muted text-center py-6">Nada que coincida con la búsqueda o los filtros. 🔍</p></Card>
      )}
      {categorias.filter((cat) => filtradas.some((ref) => ref.categoria === cat)).map((cat) => (
        <Card key={cat} className="!p-0 overflow-hidden">
          <p className="px-4 pt-3 pb-2 text-xs font-black uppercase tracking-wide text-muted border-b border-border/20">
            {CATEGORIA_LABEL[cat] || cat} <span className="font-semibold normal-case">· {filtradas.filter((ref) => ref.categoria === cat).length} referencia(s)</span>
          </p>
          <div className="divide-y divide-border/15">
            {filtradas.filter((ref) => ref.categoria === cat).map((ref) => {
              const abierta = refAbierta === ref.id;
              const pos = posEnRango(ref);
              const hist = historialDe(ref.codigo);
              const usos = usosDe(ref.codigo);
              return (
                <div key={ref.id} className={!ref.activo ? 'opacity-50' : ''}>
                  {/* Fila resumen: clic para desplegar */}
                  <button onClick={() => setRefAbierta(abierta ? null : ref.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-card/40 transition">
                    {abierta ? <ChevronDown className="w-3.5 h-3.5 text-accent shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted shrink-0" />}
                    <span className="font-mono font-bold text-xs w-28 shrink-0">{ref.codigo}</span>
                    <span className="text-xs flex-1 min-w-0 truncate">
                      {ref.descripcion}
                      {ref.marca && <span className="text-muted"> · {ref.marca}</span>}
                      {ref.advertencia && <span className="text-amber-300"> ⚠️</span>}
                    </span>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-bold ${CONFIANZA_TONO[ref.confianza]}`}>{CONFIANZA_LABEL[ref.confianza]}</span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-black tabular-nums">{fmtEur2(Number(ref.precio_base))}</span>
                      <span className="block text-[9px] text-muted uppercase">{ref.unidad === 'por_panel' ? 'por panel' : ref.unidad} · {ref.num_referencias} ref(s)</span>
                    </span>
                  </button>

                  {/* Panel de edición completo */}
                  {abierta && (
                    <div className="px-4 pb-4 pt-1 bg-background/30 space-y-3">
                      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Precio con contexto de rango */}
                        <div className="lg:col-span-2 rounded-xl border border-border/30 bg-card/40 p-3 space-y-1.5">
                          <p className="text-[10px] font-bold uppercase text-muted">💶 Precio base (sin IVA) — el cambio pide motivo</p>
                          <div className="flex items-center gap-3">
                            <input
                              key={`precio-${ref.id}-${ref.precio_base}`}
                              className="w-32 rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 text-right tabular-nums font-black text-base"
                              type="number" min="0" step="0.01" defaultValue={ref.precio_base}
                              onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v !== Number(ref.precio_base)) setCambioPrecio({ ref, precio: v }); else e.target.value = String(ref.precio_base); }}
                            />
                            {ref.precio_min != null && ref.precio_max != null && (
                              <div className="flex-1">
                                <div className="relative h-1.5 rounded-full bg-border/40">
                                  <div className="absolute inset-y-0 left-0 rounded-full bg-secondary/40" style={{ width: '100%' }} />
                                  {pos != null && <div className="absolute -top-0.5 h-2.5 w-2.5 rounded-full bg-accent border border-white/40" style={{ left: `calc(${pos}% - 5px)` }} />}
                                </div>
                                <p className="text-[9px] text-muted mt-1 flex justify-between"><span>{fmtEur2(Number(ref.precio_min))}</span><span>visto en Óscar</span><span>{fmtEur2(Number(ref.precio_max))}</span></p>
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Confianza + estado */}
                        <div className="rounded-xl border border-border/30 bg-card/40 p-3 space-y-2">
                          <p className="text-[10px] font-bold uppercase text-muted">Confianza (clic para cambiar)</p>
                          <button onClick={() => rotarConfianza(ref)} className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition hover:brightness-125 ${CONFIANZA_TONO[ref.confianza]}`}>
                            {CONFIANZA_LABEL[ref.confianza]} →
                          </button>
                          <button onClick={() => guardarCampo(ref, { activo: !ref.activo })}
                            className={`block px-3 py-1 rounded-full border text-[10px] font-bold ${ref.activo ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 'bg-card/80 text-muted border-border/50'}`}>
                            {ref.activo ? '● Activa — clic para desactivar' : '○ Inactiva — clic para reactivar'}
                          </button>
                        </div>
                        {/* Unidad */}
                        <div className="rounded-xl border border-border/30 bg-card/40 p-3 space-y-1.5">
                          <p className="text-[10px] font-bold uppercase text-muted">Unidad</p>
                          <select className={`${inputCls} !py-1.5 !text-xs`} value={ref.unidad} onChange={(e) => guardarCampo(ref, { unidad: e.target.value })}>
                            <option value="ud">Unidad</option><option value="por_panel">Por panel</option><option value="conjunto">Conjunto</option>
                          </select>
                        </div>
                      </div>

                      {/* Textos editables */}
                      <div className="grid md:grid-cols-2 gap-2.5">
                        <div><p className="text-[10px] font-bold uppercase text-muted mb-1">Descripción</p><CampoTexto refCat={ref} campo="descripcion" valor={ref.descripcion} placeholder="Descripción de la referencia" /></div>
                        <div><p className="text-[10px] font-bold uppercase text-muted mb-1">Marca</p><CampoTexto refCat={ref} campo="marca" valor={ref.marca} placeholder="Jinko, Victron..." /></div>
                        <div><p className="text-[10px] font-bold uppercase text-muted mb-1">Alcance (qué incluye)</p><CampoTexto refCat={ref} campo="alcance" valor={ref.alcance} placeholder="Ej: incluye cableado DC y protecciones" /></div>
                        <div><p className="text-[10px] font-bold uppercase text-muted mb-1">⚠️ Advertencia al usarlo</p><CampoTexto refCat={ref} campo="advertencia" valor={ref.advertencia} placeholder="Ej: precio de 2024, confirmar con Óscar" /></div>
                      </div>

                      {/* Histórico de precios + dónde se ha usado */}
                      <div className="grid md:grid-cols-2 gap-2.5">
                        <div className="rounded-xl border border-border/30 bg-card/40 p-3">
                          <p className="text-[10px] font-bold uppercase text-muted mb-1.5 flex items-center gap-1"><History className="w-3 h-3" /> Histórico de precios</p>
                          {hist.length === 0 && <p className="text-[11px] text-muted">Sin cambios registrados: precio original.</p>}
                          {hist.slice(0, 5).map((h) => (
                            <p key={h.id} className="text-[11px] flex justify-between gap-2 py-0.5 border-b border-border/15 last:border-0">
                              <span className="text-muted">{h.creado_en.slice(0, 10)}</span>
                              <span className="tabular-nums">{fmtEur2(Number(h.precio_anterior))} → <b>{fmtEur2(Number(h.precio_nuevo))}</b></span>
                              <span className="text-muted truncate max-w-40" title={h.motivo || ''}>{h.motivo || '—'}</span>
                            </p>
                          ))}
                        </div>
                        <div className="rounded-xl border border-border/30 bg-card/40 p-3">
                          <p className="text-[10px] font-bold uppercase text-muted mb-1.5">📜 Visto en presupuestos de Óscar</p>
                          {usos.length === 0 && <p className="text-[11px] text-muted">Añadida a mano (sin referencia en presupuestos históricos).</p>}
                          {usos.slice(0, 5).map((u) => {
                            const o = oscar.find((x) => x.id === u.oscar_id);
                            return (
                              <p key={u.id} className="text-[11px] flex justify-between gap-2 py-0.5 border-b border-border/15 last:border-0">
                                <span className="text-muted truncate">Nº {o?.numero || '—'} · {o?.cliente || ''}</span>
                                <span className="tabular-nums shrink-0">{Number(u.cantidad)} × {fmtEur2(Number(u.precio_unitario))}</span>
                              </p>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {/* Comparador de mercado: baterías e inversores reales vs Óscar */}
      <Card className="!p-0 overflow-hidden">
        <button onClick={() => setVerMercado((v) => !v)} className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-card/40 transition text-left">
          <span className="text-xs font-black uppercase tracking-wide text-muted">📊 Comparador de mercado · baterías e inversores reales</span>
          {verMercado ? <ChevronDown className="w-4 h-4 text-accent" /> : <ChevronRight className="w-4 h-4 text-muted" />}
        </button>
        {verMercado && (
          <div className="px-4 pb-4 space-y-4">
            <p className="text-[11px] text-muted">Precios orientativos de material (sin IVA, sin instalación) de marcas fiables en el mercado español. Compara con lo que te cobra Óscar y, si te interesa, añade cualquiera al catálogo con un clic para poder usarlo en los presupuestos. Los precios de equipos fluctúan: confírmalos con el distribuidor.</p>

            {([['🔋 Baterías (LiFePO4)', BATERIAS_MERCADO, 'baterias', 'kWh'], ['⚡ Inversores', INVERSORES_MERCADO, 'inversores', 'kW']] as const).map(([titulo, lista, cat, unidad]) => {
              const enCatalogo = refs.filter((r) => r.categoria === cat && r.activo);
              const precioOscar = enCatalogo.length ? Math.min(...enCatalogo.map((r) => Number(r.precio_base))) : null;
              return (
                <div key={cat}>
                  <p className="text-xs font-bold mb-1.5">{titulo}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] uppercase text-muted border-b border-border/40">
                          <th className="px-2 py-2">Marca y modelo</th>
                          <th className="px-2 py-2 text-right">{unidad === 'kWh' ? 'Capacidad' : 'Potencia'}</th>
                          <th className="px-2 py-2 text-right">Precio mercado</th>
                          <th className="px-2 py-2 text-right">€/{unidad}</th>
                          <th className="px-2 py-2">Detalle</th>
                          <th className="px-2 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {lista.map((r) => {
                          const ratio = r2(r.precio / r.medida);
                          const yaEsta = refs.some((x) => x.descripcion?.includes(r.modelo));
                          return (
                            <tr key={r.modelo} className="border-b border-border/15">
                              <td className="px-2 py-1.5 font-semibold">{r.marca} {r.modelo}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums font-bold">{r.medida} {unidad}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{fmtEur2(r.precio)}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums text-muted">{fmtEur2(ratio)}</td>
                              <td className="px-2 py-1.5 text-[10px] text-muted max-w-56">{r.detalle}</td>
                              <td className="px-2 py-1.5 text-right">
                                {yaEsta
                                  ? <span className="text-[10px] text-emerald-400 font-bold">✓ en catálogo</span>
                                  : <button onClick={() => anadirDesdeMercado(r, cat)} className="px-2 py-1 rounded-lg bg-secondary/15 text-secondary border border-secondary/30 text-[10px] font-bold hover:bg-secondary/25 transition whitespace-nowrap">+ Añadir</button>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {precioOscar != null && (
                    <p className="text-[10px] text-amber-300 mt-1">💡 En tu catálogo (Óscar) el {cat === 'baterias' ? 'precio de batería' : 'inversor'} más barato es {fmtEur2(precioOscar)}. Compáralo con estas referencias para negociar o elegir.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Presupuestos históricos de Óscar */}
      {oscar.length > 0 && (
        <Card className="!p-0">
          <p className="px-4 pt-3 pb-1 text-xs font-black uppercase tracking-wide text-muted">📜 Presupuestos históricos de Óscar (origen de los precios)</p>
          <div className="divide-y divide-border/20">
            {oscar.map((o) => (
              <div key={o.id} className="px-4 py-2.5">
                <button onClick={() => setAbiertoOscar(abiertoOscar === o.id ? null : o.id)} className="w-full flex items-center justify-between gap-2 text-left">
                  <span className="text-xs font-bold">{abiertoOscar === o.id ? '▾' : '▸'} Nº {o.numero} · {o.cliente} · {o.num_paneles} paneles</span>
                  <span className="text-xs tabular-nums">
                    <b>{fmtEur2(Number(o.subtotal))}</b> sin IVA · <span className="text-emerald-400 font-bold">{fmtEur2(Number(o.total))}</span>
                  </span>
                </button>
                {o.observaciones && <p className="text-[10px] text-amber-300 mt-0.5">⚠️ {o.observaciones}</p>}
                {abiertoOscar === o.id && (
                  <table className="w-full text-[11px] mt-2">
                    <tbody>
                      {items.filter((i) => i.oscar_id === o.id).map((i) => (
                        <tr key={i.id} className="border-t border-border/15">
                          <td className="py-1 pr-2 font-mono text-muted">{i.codigo_catalogo || '—'}</td>
                          <td className="py-1 pr-2">{i.descripcion}{i.opcional && <span className="text-amber-300 font-bold"> (opcional)</span>}</td>
                          <td className="py-1 pr-2 text-right tabular-nums">{Number(i.cantidad)} × {fmtEur2(Number(i.precio_unitario))}</td>
                          <td className="py-1 text-right tabular-nums font-bold">{fmtEur2(Number(i.importe))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {cambioPrecio && (
        <PedirMotivo
          titulo={`Cambiar el precio de ${cambioPrecio.ref.codigo}`}
          subtitulo={`${fmtEur2(Number(cambioPrecio.ref.precio_base))} → ${fmtEur2(cambioPrecio.precio)} (${cambioPrecio.precio > Number(cambioPrecio.ref.precio_base) ? '+' : ''}${r2(((cambioPrecio.precio - Number(cambioPrecio.ref.precio_base)) / Number(cambioPrecio.ref.precio_base)) * 100)} %) · el precio anterior queda en el histórico.`}
          sugerencias={['Nuevo presupuesto de Óscar', 'Subida de proveedor', 'Corrección de error', 'Oferta puntual']}
          onGuardar={async (motivo) => { await guardarCampo(cambioPrecio.ref, { precio_base: cambioPrecio.precio }, motivo); setCambioPrecio(null); }}
          onCancelar={() => { setCambioPrecio(null); cargar(); }}
        />
      )}
    </div>
  );
}
