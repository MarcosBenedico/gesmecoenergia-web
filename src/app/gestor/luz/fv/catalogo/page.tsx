'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Plus, RefreshCw, X } from 'lucide-react';
import { GuardiaAdmin } from '@/components/guardia-modulo';
import { CONFIANZA_LABEL, fmtEur2 } from '@/lib/fv';
import { Card, inputCls, labelCls, btnPrimario, btnSecundario } from '../../ui';
import { tokenSesion } from '@/lib/usuario';
import { PedirMotivo } from '../../motivo';

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

const CATEGORIA_LABEL: Record<string, string> = {
  paneles: '☀️ Paneles', estructuras: '🔩 Estructuras', inversores: '⚡ Inversores', baterias: '🔋 Baterías',
  monitorizacion: '📡 Monitorización', instalacion: '🔧 Instalación', tramites: '📋 Trámites', ingenieria: '📐 Ingeniería',
  linea: '🔌 Línea adicional', otros: '📦 Otros',
};

const NUEVO = { codigo: '', categoria: 'otros', descripcion: '', marca: '', unidad: 'ud', precio_base: '', confianza: 'media', alcance: '', advertencia: '' };

export default function CatalogoPage() {
  return <GuardiaAdmin nombre="Catálogo FV"><Catalogo /></GuardiaAdmin>;
}

function Catalogo() {
  const [refs, setRefs] = useState<RefCatalogo[]>([]);
  const [oscar, setOscar] = useState<OscarPres[]>([]);
  const [items, setItems] = useState<OscarItem[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nuevo, setNuevo] = useState(NUEVO);
  const [cambioPrecio, setCambioPrecio] = useState<{ ref: RefCatalogo; precio: number } | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const [c, o] = await Promise.all([api('GET'), api('GET', undefined, '?recurso=oscar')]);
    if (!c.ok) { setError(c.json.error || 'Error.'); setCargando(false); return; }
    setRefs(c.json.datos); setOscar(o.json.datos || []); setItems(o.json.items || []);
    setError(''); setCargando(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function guardarCampo(r: RefCatalogo, campos: Record<string, unknown>, motivo?: string) {
    const { ok, json } = await api('PUT', { id: r.id, ...campos, ...(motivo ? { motivo } : {}) });
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

  const categorias = Array.from(new Set(refs.map((r) => r.categoria)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Link href="/gestor/luz/fv" className={btnSecundario}><ChevronLeft className="w-4 h-4" /> Calculadora FV</Link>
          <div>
            <h2 className="text-lg font-black text-foreground">Catálogo de precios FV</h2>
            <p className="text-xs text-muted">Precios reales de los presupuestos de Óscar (sin IVA). Los cambios de precio piden motivo y guardan histórico; nada se borra, se desactiva.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} className={btnSecundario}><RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} /></button>
          <button onClick={() => setMostrarForm((v) => !v)} className={btnPrimario}>{mostrarForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Referencia</button>
        </div>
      </div>

      {msg && <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5">{msg}</p>}
      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">{error}</p>}

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

      {categorias.map((cat) => (
        <Card key={cat} className="!p-0 overflow-x-auto">
          <p className="px-4 pt-3 pb-1 text-xs font-black uppercase tracking-wide text-muted">{CATEGORIA_LABEL[cat] || cat}</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase text-muted border-b border-border/40">
                <th className="px-4 py-2">Código</th><th className="px-4 py-2">Descripción</th><th className="px-4 py-2">Unidad</th>
                <th className="px-4 py-2 text-right">Precio base</th><th className="px-4 py-2 text-right">Mín–Máx</th>
                <th className="px-4 py-2 text-center">Refs.</th><th className="px-4 py-2">Confianza</th><th className="px-4 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {refs.filter((r) => r.categoria === cat).map((r) => (
                <tr key={r.id} className={`border-b border-border/20 ${!r.activo ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-2 font-mono font-bold">{r.codigo}</td>
                  <td className="px-4 py-2 max-w-72">
                    {r.descripcion}
                    {r.advertencia && <span className="block text-[10px] text-amber-300 mt-0.5">⚠️ {r.advertencia}</span>}
                  </td>
                  <td className="px-4 py-2 text-muted">{r.unidad === 'por_panel' ? 'por panel' : r.unidad}</td>
                  <td className="px-4 py-2 text-right">
                    <input
                      className="w-24 rounded-md border border-border/40 bg-background/60 px-1.5 py-1 text-right tabular-nums font-bold"
                      type="number" min="0" step="0.01" defaultValue={r.precio_base}
                      onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v !== Number(r.precio_base)) setCambioPrecio({ ref: r, precio: v }); else e.target.value = String(r.precio_base); }}
                    />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted">{r.precio_min != null ? `${fmtEur2(Number(r.precio_min))}–${fmtEur2(Number(r.precio_max))}` : '—'}</td>
                  <td className="px-4 py-2 text-center tabular-nums">{r.num_referencias}</td>
                  <td className="px-4 py-2">
                    <select value={r.confianza} onChange={(e) => guardarCampo(r, { confianza: e.target.value })}
                      className="rounded-md border border-border/40 bg-background/60 px-1.5 py-0.5 text-[10px] font-semibold">
                      {Object.entries(CONFIANZA_LABEL).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <button onClick={() => guardarCampo(r, { activo: !r.activo })}
                      className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${r.activo ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 'bg-card/80 text-muted border-border/50'}`}>
                      {r.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}

      {/* Presupuestos históricos de Óscar */}
      {oscar.length > 0 && (
        <Card className="!p-0">
          <p className="px-4 pt-3 pb-1 text-xs font-black uppercase tracking-wide text-muted">📜 Presupuestos históricos de Óscar (origen de los precios)</p>
          <div className="divide-y divide-border/20">
            {oscar.map((o) => (
              <div key={o.id} className="px-4 py-2.5">
                <button onClick={() => setAbierto(abierto === o.id ? null : o.id)} className="w-full flex items-center justify-between gap-2 text-left">
                  <span className="text-xs font-bold">{abierto === o.id ? '▾' : '▸'} Nº {o.numero} · {o.cliente} · {o.num_paneles} paneles</span>
                  <span className="text-xs tabular-nums">
                    <b>{fmtEur2(Number(o.subtotal))}</b> sin IVA · <span className="text-emerald-400 font-bold">{fmtEur2(Number(o.total))}</span>
                  </span>
                </button>
                {o.observaciones && <p className="text-[10px] text-amber-300 mt-0.5">⚠️ {o.observaciones}</p>}
                {abierto === o.id && (
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
          subtitulo={`${fmtEur2(Number(cambioPrecio.ref.precio_base))} → ${fmtEur2(cambioPrecio.precio)} · el precio anterior queda en el histórico.`}
          sugerencias={['Nuevo presupuesto de Óscar', 'Subida de proveedor', 'Corrección de error', 'Oferta puntual']}
          onGuardar={async (motivo) => { await guardarCampo(cambioPrecio.ref, { precio_base: cambioPrecio.precio }, motivo); setCambioPrecio(null); }}
          onCancelar={() => { setCambioPrecio(null); cargar(); }}
        />
      )}
    </div>
  );
}
