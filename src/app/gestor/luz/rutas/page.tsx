'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Map as MapIcon, Navigation, Loader, ExternalLink, X, Pencil, Check } from 'lucide-react';
import { LuzCliente, LuzCups } from '@/lib/luz';
import { Card, Badge, BadgePrioridad, EstadoCarga, useListaLuz, guardarLuz, inputCls, labelCls, btnPrimario } from '../ui';

/**
 * Planificador de rutas de visitas: elige clientes y CUPS con dirección,
 * calcula el orden más eficiente y genera el enlace de Google Maps.
 */

interface Parada { id: string; nombre: string; direccion: string; cliente_id: string }
interface Resultado {
  orden: { id: string; nombre: string; direccion: string; ubicada: boolean }[];
  km_estimados: number;
  sin_ubicar: string[];
  url_maps: string;
  aviso: string | null;
}

const ORIGEN_DEFECTO = 'Avenida de Aragón 50, Binéfar, Huesca';

export default function RutasPage() {
  const clientes = useListaLuz<LuzCliente>('clientes');
  const cups = useListaLuz<LuzCups>('cups');
  const [buscar, setBuscar] = useState('');
  const [fResp, setFResp] = useState('David');
  const [seleccion, setSeleccion] = useState<Map<string, Parada>>(new Map());
  const [origen, setOrigen] = useState(ORIGEN_DEFECTO);
  const [calculando, setCalculando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState('');

  const responsables = useMemo(() => {
    const s = new Set<string>();
    clientes.datos.forEach((c) => c.responsable?.split('/').forEach((p) => { const n = p.trim(); if (n) s.add(n); }));
    return Array.from(s).sort();
  }, [clientes.datos]);

  /** Posibles paradas: clientes con dirección + CUPS con dirección de suministro. */
  const paradasDisponibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    const deResp = (r: string | null) => !fResp || (r || '').toLowerCase().includes(fResp.toLowerCase());
    const lista: (Parada & { tipo: 'cliente' | 'cups'; prioridad?: string })[] = [];

    for (const c of clientes.datos) {
      if (!c.direccion_fiscal?.trim()) continue;
      if (!deResp(c.responsable)) continue;
      if (q && !c.nombre.toLowerCase().includes(q)) continue;
      lista.push({ id: `c-${c.id}`, cliente_id: c.id, nombre: c.nombre, direccion: c.direccion_fiscal, tipo: 'cliente', prioridad: c.prioridad });
    }
    for (const s of cups.datos) {
      if (!s.direccion_suministro?.trim()) continue;
      if (!deResp(s.responsable || null) && !deResp(null)) continue;
      const nombre = `${s.luz_clientes?.nombre || 'Cliente'} · ${s.alias_suministro || s.cups.slice(0, 10) + '…'}`;
      if (q && !nombre.toLowerCase().includes(q)) continue;
      lista.push({ id: `s-${s.id}`, cliente_id: s.cliente_id, nombre, direccion: s.direccion_suministro, tipo: 'cups', prioridad: s.prioridad || s.luz_clientes?.prioridad });
    }
    return lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [clientes.datos, cups.datos, buscar, fResp]);

  // Edición de ubicación en línea: dirección escrita a mano o enlace de Google Maps pegado
  const [editando, setEditando] = useState<{ id: string; valor: string } | null>(null);
  const [verSinUbicacion, setVerSinUbicacion] = useState(false);

  /** Clientes del filtro actual que aún no tienen ubicación. */
  const sinUbicacion = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return clientes.datos.filter((c) =>
      !c.direccion_fiscal?.trim() &&
      (!fResp || (c.responsable || '').toLowerCase().includes(fResp.toLowerCase())) &&
      (!q || c.nombre.toLowerCase().includes(q))
    );
  }, [clientes.datos, buscar, fResp]);

  async function guardarUbicacion(p: { id: string; cliente_id: string }, valor: string) {
    const v = valor.trim();
    if (!v) return;
    const err = p.id.startsWith('s-')
      ? await guardarLuz('cups', 'PUT', { id: p.id.slice(2), direccion_suministro: v })
      : await guardarLuz('clientes', 'PUT', { id: p.cliente_id, direccion_fiscal: v });
    if (err) { setError(err); return; }
    setError('');
    setEditando(null);
    setResultado(null);
    clientes.recargar();
    cups.recargar();
  }

  function alternar(p: Parada) {
    setResultado(null);
    setSeleccion((prev) => {
      const m = new Map(prev);
      if (m.has(p.id)) m.delete(p.id);
      else m.set(p.id, p);
      return m;
    });
  }

  async function generarRuta() {
    if (seleccion.size === 0) { setError('Selecciona al menos una parada.'); return; }
    setCalculando(true); setError(''); setResultado(null);
    try {
      const res = await fetch('/api/luz/rutas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origen, paradas: Array.from(seleccion.values()) }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Error calculando la ruta.'); return; }
      setResultado(json);
    } catch {
      setError('Error de conexión.');
    } finally {
      setCalculando(false);
    }
  }

  const cargando = clientes.cargando || cups.cargando;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2"><MapIcon className="w-5 h-5 text-accent" /> Rutas de visitas</h2>
          <p className="text-xs text-muted mt-0.5">
            Elige a quién visitar, calcula el orden más eficiente y abre la ruta en Google Maps.
            Solo aparecen clientes y CUPS con dirección (se edita en la ficha del cliente).
          </p>
        </div>
      </div>

      <EstadoCarga cargando={cargando} error={clientes.error} faltaMigracion={clientes.faltaMigracion} vacio={false} textoVacio="" sqlFile="supabase_luz.sql" />

      {!cargando && (
        <div className="grid lg:grid-cols-[1fr_400px] gap-4 items-start">
          {/* ── Izquierda: elegir paradas ── */}
          <Card>
            <div className="flex gap-2 flex-wrap mb-3">
              <input className={`${inputCls} flex-1 min-w-40`} value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="🔍 Buscar cliente o suministro..." />
              <select className={inputCls + ' !w-auto'} value={fResp} onChange={(e) => setFResp(e.target.value)}>
                <option value="">Responsable: todos</option>
                {responsables.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {paradasDisponibles.length === 0 ? (
              <p className="text-sm text-muted text-center py-6">
                Sin direcciones con este filtro. Añade la ubicación en la ficha del cliente
                (campo «Dirección fiscal») o en su CUPS («Dirección suministro»).
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[32rem] overflow-y-auto pr-1">
                {paradasDisponibles.map((p) => {
                  const marcada = seleccion.has(p.id);
                  return (
                    <label key={p.id} className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition ${
                      marcada ? 'border-accent/50 bg-accent/10' : 'border-border/30 bg-card/50 hover:border-border/60'
                    }`}>
                      <input type="checkbox" checked={marcada} onChange={() => alternar(p)} className="accent-[#e11d48] w-4 h-4 shrink-0" />
                      <BadgePrioridad prioridad={p.prioridad} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate">{p.nombre}</p>
                        {editando?.id === p.id ? (
                          <span className="flex items-center gap-1 mt-0.5" onClick={(e) => e.preventDefault()}>
                            <input
                              className="flex-1 rounded-md border border-accent/40 bg-background/80 px-1.5 py-1 text-[10px]"
                              value={editando.valor}
                              onChange={(e) => setEditando({ id: p.id, valor: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardarUbicacion(p, editando.valor); } }}
                              placeholder="Dirección o enlace de Google Maps"
                              autoFocus
                            />
                            <button type="button" onClick={() => guardarUbicacion(p, editando.valor)} className="text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => setEditando(null)} className="text-muted hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                          </span>
                        ) : (
                          <p className="text-[10px] text-muted truncate">
                            📍 {p.direccion}
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); setEditando({ id: p.id, valor: p.direccion }); }}
                              className="ml-1.5 text-muted/60 hover:text-accent align-middle" title="Cambiar ubicación (dirección o enlace de Google Maps)"
                            >
                              <Pencil className="w-3 h-3 inline" />
                            </button>
                          </p>
                        )}
                      </div>
                      <Badge tono={p.tipo === 'cups' ? 'accent' : 'muted'}>{p.tipo === 'cups' ? 'CUPS' : 'Cliente'}</Badge>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Clientes sin ubicación: se les puede poner aquí mismo (dirección o enlace de Maps) */}
            {sinUbicacion.length > 0 && (
              <div className="mt-3 pt-2 border-t border-border/30">
                <button onClick={() => setVerSinUbicacion((v) => !v)} className="text-xs font-bold text-amber-300 hover:underline">
                  {verSinUbicacion ? '▾' : '▸'} Sin ubicación ({sinUbicacion.length}) — añádela aquí
                </button>
                {verSinUbicacion && (
                  <div className="space-y-1.5 mt-2 max-h-64 overflow-y-auto pr-1">
                    {sinUbicacion.slice(0, 50).map((c) => (
                      <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-card/40 border border-border/20">
                        <p className="text-xs font-semibold truncate flex-1 min-w-0">{c.nombre}</p>
                        {editando?.id === `c-${c.id}` ? (
                          <span className="flex items-center gap-1 flex-1">
                            <input
                              className="flex-1 rounded-md border border-accent/40 bg-background/80 px-1.5 py-1 text-[10px]"
                              value={editando.valor}
                              onChange={(e) => setEditando({ id: `c-${c.id}`, valor: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') guardarUbicacion({ id: `c-${c.id}`, cliente_id: c.id }, editando.valor); }}
                              placeholder="Dirección o enlace de Google Maps"
                              autoFocus
                            />
                            <button onClick={() => guardarUbicacion({ id: `c-${c.id}`, cliente_id: c.id }, editando.valor)} className="text-emerald-400"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditando(null)} className="text-muted"><X className="w-3.5 h-3.5" /></button>
                          </span>
                        ) : (
                          <button onClick={() => setEditando({ id: `c-${c.id}`, valor: '' })} className="text-[10px] font-bold text-accent hover:underline shrink-0">
                            + ubicación
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* ── Derecha: la ruta ── */}
          <div className="space-y-4 lg:sticky lg:top-20">
            <Card>
              <h3 className="font-bold text-sm mb-2">🚐 Ruta ({seleccion.size} parada{seleccion.size === 1 ? '' : 's'})</h3>
              <div className="mb-3">
                <label className={labelCls}>Punto de salida</label>
                <input className={inputCls} value={origen} onChange={(e) => { setOrigen(e.target.value); setResultado(null); }} />
              </div>

              {seleccion.size === 0 ? (
                <p className="text-xs text-muted text-center py-4">Marca clientes o CUPS de la lista para añadirlos a la ruta.</p>
              ) : (
                <div className="space-y-1 mb-3">
                  {Array.from(seleccion.values()).map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-card/60 text-xs">
                      <span className="truncate font-semibold">{p.nombre}</span>
                      <button onClick={() => alternar(p)} className="text-muted hover:text-red-400 shrink-0"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={generarRuta} disabled={calculando || seleccion.size === 0} className={`${btnPrimario} w-full justify-center`}>
                {calculando ? <Loader className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                {calculando ? 'Calculando orden eficiente...' : 'Generar ruta eficiente'}
              </button>
              {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
            </Card>

            {resultado && (
              <Card className="!border-emerald-500/40">
                <h3 className="font-bold text-sm mb-1">✅ Ruta lista{resultado.km_estimados ? ` · ~${resultado.km_estimados} km` : ''}</h3>
                <p className="text-[11px] text-muted mb-3">Orden optimizado por cercanía desde el punto de salida.</p>
                <ol className="space-y-1.5 mb-3">
                  {resultado.orden.map((p, i) => (
                    <li key={p.id} className="flex items-start gap-2 text-xs">
                      <span className="w-5 h-5 rounded-full bg-accent/15 text-accent border border-accent/30 flex items-center justify-center font-black text-[10px] shrink-0">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{p.nombre} {!p.ubicada && <span className="text-amber-400">⚠️</span>}</p>
                        <p className="text-[10px] text-muted truncate">{p.direccion}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                {resultado.sin_ubicar.length > 0 && (
                  <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 mb-3">
                    ⚠️ No se pudo ubicar en el mapa: {resultado.sin_ubicar.join(', ')}. Revisa que la dirección incluya calle y población.
                  </p>
                )}
                {resultado.aviso && <p className="text-[11px] text-amber-300 mb-3">{resultado.aviso}</p>}
                <a href={resultado.url_maps} target="_blank" rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-500 transition">
                  <ExternalLink className="w-4 h-4" /> Abrir en Google Maps
                </a>
                <p className="text-[10px] text-muted mt-2 text-center">
                  Envía el enlace a David por WhatsApp y le abre la ruta con todas las paradas.
                </p>
              </Card>
            )}

            <p className="text-[11px] text-muted">
              💡 ¿Falta alguien en la lista? Entra en su <Link href="/gestor/luz/clientes" className="text-accent hover:underline">ficha de cliente</Link> y
              rellena la «📍 Ubicación» (o la dirección del suministro en su CUPS).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
