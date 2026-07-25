'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Map as MapIcon, Navigation, Loader, ExternalLink, X, Pencil, Check, MousePointerClick, MapPinned } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LuzCliente, LuzCups, LuzOportunidad, LuzVisita } from '@/lib/luz';
import { Card, Badge, BadgePrioridad, EstadoCarga, useListaLuz, guardarLuz, inputCls, labelCls, btnPrimario, btnSecundario } from '../ui';
import { leerRutaDia, guardarRutaDia } from './ruta-dia';
import { Prospectos } from './prospectos';
import { ResolverVisita } from '../resolver-visita';
import { ProspectoGuardado, TIPO_PROSPECTO_LABEL } from '@/lib/prospeccion';

// El mapa usa Leaflet (necesita `window`): se carga solo en el navegador, nunca en el servidor.
const MapaRutas = dynamic(() => import('./mapa').then((m) => m.MapaRutas), {
  ssr: false,
  loading: () => <div className="rounded-2xl border border-border/40 bg-surface/40 p-6 text-center text-xs text-muted">Cargando mapa…</div>,
});

/**
 * Planificador de rutas de visitas: elige clientes y CUPS con dirección,
 * calcula el orden más eficiente y genera el enlace de Google Maps.
 */

interface Parada { id: string; nombre: string; direccion: string; cliente_id: string; tarea_id?: string; tarea_desc?: string }
interface Resultado {
  orden: { id: string; nombre: string; direccion: string; ubicada: boolean; lat: number | null; lon: number | null }[];
  origen_geo: { lat: number; lon: number } | null;
  km_estimados: number;
  sin_ubicar: string[];
  url_maps: string;
  aviso: string | null;
}

const ORIGEN_DEFECTO = 'Avenida de Aragón 50, Binéfar, Huesca';

export default function RutasPage() {
  const clientes = useListaLuz<LuzCliente>('clientes');
  const cups = useListaLuz<LuzCups>('cups');
  const pipeline = useListaLuz<LuzOportunidad>('pipeline');
  const visitas = useListaLuz<LuzVisita>('visitas');
  const [buscar, setBuscar] = useState('');
  const [fResp, setFResp] = useState('David');
  const [fVista, setFVista] = useState<'todos' | 'fv' | 'prioridadA' | 'olvidados' | 'visitadosHoy' | 'captacion' | 'facturas'>('todos');
  const [fFechaVisita, setFFechaVisita] = useState('');
  const [seleccion, setSeleccion] = useState<Map<string, Parada>>(new Map());

  // ── Ruta del día compartida con Tareas: se carga al entrar y se guarda con cada cambio ──
  const rutaCargada = useRef(false);
  useEffect(() => {
    const guardadas = leerRutaDia();
    if (guardadas.length) setSeleccion(new Map(guardadas.map((p) => [p.id, p])));
    rutaCargada.current = true;
  }, []);
  useEffect(() => {
    if (rutaCargada.current) guardarRutaDia(Array.from(seleccion.values()));
  }, [seleccion]);

  /** Marcar como hecha la tarea asociada a una parada (fin del día). */
  async function tareaHecha(p: Parada) {
    if (!p.tarea_id) return;
    const err = await guardarLuz('tareas', 'PUT', { id: p.tarea_id, estado: 'completada' });
    if (err) { setError(err); return; }
    setError('');
    setSeleccion((prev) => {
      const m = new Map(prev);
      const actual = m.get(p.id);
      if (actual) m.set(p.id, { ...actual, tarea_id: undefined, tarea_desc: undefined });
      return m;
    });
  }
  const [origen, setOrigen] = useState(ORIGEN_DEFECTO);
  const [calculando, setCalculando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState('');

  // ── Oportunidades ya aprobadas en el Mapa de oportunidades ──
  // Aquí no se busca nada: solo llega lo que Marcos ha marcado "que vaya
  // David", para que él no tenga que elegir entre trescientos puntos.
  const prospectosAprobados = useListaLuz<ProspectoGuardado>('prospectos', { estado: 'para_visitar' });
  const [prospectosAnadidos, setProspectosAnadidos] = useState<Record<string, boolean>>({});
  /** Visita que se está resolviendo desde el mapa. */
  const [visitando, setVisitando] = useState<{ id: string; nombre: string } | null>(null);

  /**
   * Pasa un candidato del mapa a la ruta. Le crea la ficha en el CRM y lo mete
   * como parada de una sola vez: si se va a visitar, tiene que estar en la
   * cartera, y obligar a darlo de alta aparte es justo el rodeo que hace que
   * la visita acabe sin registrar.
   *
   * El nombre se pone solo. Se puede cambiar luego en la ficha, y David lo
   * confirma al pasar por allí; parar aquí a preguntarlo rompería el ritmo de
   * ir marcando sitios en el mapa.
   */
  async function prospectoARuta(p: ProspectoGuardado): Promise<string | null> {
    const nombre =
      p.nombre ||
      `${TIPO_PROSPECTO_LABEL[p.tipo].replace(/^\S+\s/, '')} sin identificar${p.municipio ? ` · ${p.municipio}` : ''}`;
    const direccion = `${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`;

    const observaciones = [
      'Del mapa de oportunidades. Sin verificar sobre el terreno.',
      `${p.n_edificios} ${p.n_edificios === 1 ? 'nave' : 'naves'}, ${p.m2_construidos.toLocaleString('es-ES')} m² construidos.`,
      ...(p.catastro_anio ? [`Catastro: ${p.catastro_uso || 'sin uso declarado'}, de ${p.catastro_anio}.`] : []),
      ...(p.motivos ? [p.motivos] : []),
    ].join('\n· ');
    const creado = await guardarLuz('clientes', 'POST', {
      nombre,
      tipo_cliente: p.tipo === 'industria' || p.tipo === 'nave' ? 'industria' : 'pyme',
      direccion_fiscal: direccion,
      via_entrada: 'captacion',
      estado_comercial: 'detectado',
      prioridad: p.puntuacion >= 65 ? 'B' : 'C',
      responsable: 'David',
      potencial_comercial: p.consumo_estimado_kwh
        ? `Consumo estimado del orden de ${p.consumo_estimado_kwh.toLocaleString('es-ES')} kWh/año (por tipo y tamaño, sin factura).`
        : '',
      observaciones: `· ${observaciones}`,
    });
    if (creado) return creado;

    // La parada se identifica por el sitio de OSM, no por el cliente: aún no
    // sabemos su id y volver a pedir la lista solo para esto sería lentísimo.
    setSeleccion((prev) => {
      const m = new Map(prev);
      m.set(`p-${p.id}`, { id: `p-${p.id}`, nombre, direccion, cliente_id: '' });
      return m;
    });
    setProspectosAnadidos((a) => ({ ...a, [p.id]: true }));
    // La oportunidad pasa a "ya es cliente": deja de proponerse y queda el
    // rastro de que esta visita salió del mapa de oportunidades.
    await guardarLuz('prospectos', 'PUT', { id: p.id, estado: 'convertido' });
    clientes.recargar();
    prospectosAprobados.recargar();
    return null;
  }

  /** Por dónde pasa la ruta ya calculada: origen + paradas ubicadas, en orden. */
  const puntosRuta = useMemo(() => {
    if (!resultado) return [];
    const pts = resultado.origen_geo ? [resultado.origen_geo] : [];
    for (const p of resultado.orden) {
      if (p.lat != null && p.lon != null) pts.push({ lat: p.lat, lon: p.lon });
    }
    return pts;
  }, [resultado]);

  const responsables = useMemo(() => {
    const s = new Set<string>();
    clientes.datos.forEach((c) => c.responsable?.split('/').forEach((p) => { const n = p.trim(); if (n) s.add(n); }));
    return Array.from(s).sort();
  }, [clientes.datos]);

  /** Clientes con oportunidad de fotovoltaica en el pipeline (no perdida). */
  const interesadosFV = useMemo(() => {
    const s = new Set<string>();
    for (const o of pipeline.datos) {
      if (o.tipo_oportunidad === 'derivacion_fotovoltaica' && o.estado !== 'perdido' && o.cliente_id) s.add(o.cliente_id);
    }
    return s;
  }, [pipeline.datos]);

  /** Fechas de visita por cliente (historial completo de luz_visitas). */
  const visitasPorCliente = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const v of visitas.datos) {
      if (!m.has(v.cliente_id)) m.set(v.cliente_id, new Set());
      m.get(v.cliente_id)!.add(v.fecha);
    }
    return m;
  }, [visitas.datos]);

  /**
   * La ÚLTIMA visita de cada cliente, con lo que pasó en ella.
   *
   * "Visitado" a secas no dice nada: uno al que se pasó ayer y dijo que no
   * tiene poco que ver con otro al que se pasó ayer y dio la factura. En el
   * mapa esa diferencia tiene que verse sin abrir nada.
   */
  const ultimaVisita = useMemo(() => {
    const m = new Map<string, { fecha: string; resultado?: string | null }>();
    for (const v of visitas.datos) {
      const previa = m.get(v.cliente_id);
      if (!previa || v.fecha > previa.fecha) {
        m.set(v.cliente_id, { fecha: v.fecha, resultado: (v as { resultado?: string | null }).resultado ?? null });
      }
    }
    return m;
  }, [visitas.datos]);

  /** Posibles paradas: clientes con dirección + CUPS con dirección de suministro. */
  const paradasDisponibles = useMemo(() => {
    const HOY = new Date().toISOString().slice(0, 10);
    const q = buscar.trim().toLowerCase();
    const deResp = (r: string | null) => !fResp || (r || '').toLowerCase().includes(fResp.toLowerCase());
    const lista: (Parada & { tipo: 'cliente' | 'cups'; prioridad?: string; fecha_ultimo_contacto?: string | null; interesFV?: boolean; via_entrada?: string | null; visita?: { fecha: string; resultado?: string | null } })[] = [];

    for (const c of clientes.datos) {
      if (!c.direccion_fiscal?.trim()) continue;
      if (!deResp(c.responsable)) continue;
      if (q && !c.nombre.toLowerCase().includes(q)) continue;
      lista.push({ id: `c-${c.id}`, cliente_id: c.id, nombre: c.nombre, direccion: c.direccion_fiscal, tipo: 'cliente', prioridad: c.prioridad, fecha_ultimo_contacto: c.fecha_ultimo_contacto, interesFV: interesadosFV.has(c.id), via_entrada: c.via_entrada, visita: ultimaVisita.get(c.id) });
    }
    for (const s of cups.datos) {
      if (!s.direccion_suministro?.trim()) continue;
      if (!deResp(s.responsable || null) && !deResp(null)) continue;
      const nombre = `${s.luz_clientes?.nombre || 'Cliente'} · ${s.alias_suministro || s.cups.slice(0, 10) + '…'}`;
      if (q && !nombre.toLowerCase().includes(q)) continue;
      const clientePadre = clientes.datos.find((c) => c.id === s.cliente_id);
      lista.push({ id: `s-${s.id}`, cliente_id: s.cliente_id, nombre, direccion: s.direccion_suministro, tipo: 'cups', prioridad: s.prioridad || s.luz_clientes?.prioridad, fecha_ultimo_contacto: clientePadre?.fecha_ultimo_contacto, interesFV: interesadosFV.has(s.cliente_id), via_entrada: clientePadre?.via_entrada });
    }

    // Filtro de vista rápida (afecta al mapa y a la lista a la vez)
    const filtrada = lista.filter((p) => {
      // Filtro por día de visita: usa el historial guardado en luz_visitas
      if (fFechaVisita && !visitasPorCliente.get(p.cliente_id)?.has(fFechaVisita)) return false;
      if (fVista === 'captacion') return (p.via_entrada || 'captacion') === 'captacion';
      if (fVista === 'facturas') return p.via_entrada === 'facturas';
      if (fVista === 'fv') return p.interesFV;
      if (fVista === 'prioridadA') return p.prioridad === 'A';
      if (fVista === 'visitadosHoy') return p.fecha_ultimo_contacto === HOY || visitasPorCliente.get(p.cliente_id)?.has(HOY);
      if (fVista === 'olvidados') {
        if (!p.fecha_ultimo_contacto) return true;
        return (Date.now() - new Date(p.fecha_ultimo_contacto).getTime()) / 86400000 > 30;
      }
      return true;
    });
    return filtrada.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [clientes.datos, cups.datos, buscar, fResp, fVista, interesadosFV, fFechaVisita, visitasPorCliente, ultimaVisita]);

  /** Crea la oportunidad de fotovoltaica en el pipeline desde el mapa. */
  async function marcarInteresFV(clienteId: string, nombre: string) {
    const nombreCliente = nombre.split(' · ')[0];
    const err = await guardarLuz('pipeline', 'POST', {
      cliente_id: clienteId,
      nombre_oportunidad: `${nombreCliente} · Derivación fotovoltaica`,
      tipo_oportunidad: 'derivacion_fotovoltaica',
      estado: 'prospecto',
      responsable: fResp || null,
      observaciones: 'Interés detectado en visita (marcado desde el mapa de rutas)',
    });
    if (err) { setError(err); return; }
    pipeline.recargar();
  }

  // Edición de ubicación en línea: dirección escrita a mano o enlace de Google Maps pegado
  const [editando, setEditando] = useState<{ id: string; valor: string } | null>(null);
  const [verSinUbicacion, setVerSinUbicacion] = useState(false);
  const [modoManual, setModoManual] = useState(false);

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
          <p className="text-sm text-muted mt-1">
            Elige a quién visitar, calcula el orden más eficiente y abre la ruta en Google Maps.
            Solo aparecen clientes y CUPS con dirección (se edita en la ficha del cliente).
          </p>
        </div>
      </div>

      <EstadoCarga cargando={cargando} error={clientes.error} faltaMigracion={clientes.faltaMigracion} vacio={false} textoVacio="" sqlFile="supabase_luz.sql" />

      {/* ── Mapa interactivo: complemento visual del planificador ── */}
      {!cargando && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {([
                ['todos', 'Todos'],
                ['captacion', '🧲 Captación'],
                ['facturas', '📄 Estudio pendiente'],
                ['fv', '☀️ Interés fotovoltaica'],
                ['prioridadA', '🔴 Prioridad A'],
                ['olvidados', '🕐 +30 días sin visitar'],
                ['visitadosHoy', '✓ Visitados hoy'],
              ] as const).map(([clave, texto]) => (
                <button
                  key={clave}
                  onClick={() => { setFVista(clave); setResultado(null); }}
                  className={`px-3.5 py-2 rounded-full text-sm font-bold border transition ${
                    fVista === clave ? 'bg-accent text-white border-accent' : 'bg-card/70 text-muted border-border/50 hover:text-foreground'
                  }`}
                >
                  {texto}
                </button>
              ))}
              <span className="flex items-center gap-1 ml-1">
                <label className="text-sm text-muted font-bold">📅 Visitados el:</label>
                <input
                  type="date"
                  value={fFechaVisita}
                  onChange={(e) => { setFFechaVisita(e.target.value); setResultado(null); }}
                  className="rounded-lg border border-border/50 bg-card/70 px-3 py-2 text-sm"
                />
                {fFechaVisita && (
                  <button onClick={() => setFFechaVisita('')} className="text-muted hover:text-red-400" title="Quitar filtro de fecha">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            </div>
            <button
              onClick={() => setModoManual((v) => !v)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition ${
                modoManual ? 'bg-accent text-white border-accent' : 'bg-card/80 text-muted border-border/50 hover:text-foreground'
              }`}
              title="Al activarlo, un clic en cualquier pin del mapa lo añade o lo quita de la ruta"
            >
              <MousePointerClick className="w-4 h-4" /> Modo manual: tocar un pin lo mete o lo saca de la ruta
            </button>
          </div>
          <MapaRutas
            paradas={paradasDisponibles}
            seleccion={seleccion}
            onAlternar={alternar}
            orden={resultado?.orden || null}
            origenGeo={resultado?.origen_geo || null}
            origenTexto={origen}
            onRecargarClientes={() => { clientes.recargar(); cups.recargar(); visitas.recargar(); }}
            modoManual={modoManual}
            onMarcarFV={marcarInteresFV}
            prospectos={prospectosAprobados.datos}
            onProspectoARuta={prospectoARuta}
            prospectosAnadidos={prospectosAnadidos}
            onResolverVisita={(id, nombre) => setVisitando({ id, nombre })}
          />
        </div>
      )}

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
                        <p className="text-sm font-bold truncate">{p.nombre}</p>
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
              {/* El número de paradas, en grande: es el estado de la ruta */}
              <div className="flex items-baseline gap-2 mb-3">
                <motion.span
                  key={seleccion.size}
                  initial={{ scale: 1.4, opacity: 0.3 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                  className="text-3xl font-black tabular-nums text-accent leading-none"
                >
                  {seleccion.size}
                </motion.span>
                <span className="text-sm font-bold text-muted">
                  {seleccion.size === 1 ? 'parada en la ruta' : 'paradas en la ruta'}
                </span>
              </div>

              <div className="mb-3">
                <label className={labelCls}>Punto de salida</label>
                <input className={inputCls} value={origen} onChange={(e) => { setOrigen(e.target.value); setResultado(null); }} />
              </div>

              {seleccion.size === 0 ? (
                <div className="text-center py-6 rounded-xl border border-dashed border-border/40">
                  <MapPinned className="w-8 h-8 mx-auto text-muted/40 mb-2" />
                  <p className="text-sm font-black">La ruta está vacía</p>
                  <p className="text-xs text-muted mt-1 px-4">
                    Marca clientes en la lista, o toca sus pines en el mapa.
                  </p>
                </div>
              ) : (
                <ul className="space-y-1.5 mb-3">
                  <AnimatePresence initial={false}>
                    {Array.from(seleccion.values()).map((p, idx) => (
                      <motion.li
                        key={p.id}
                        layout
                        initial={{ opacity: 0, x: -14 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 14, height: 0, marginBottom: 0 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="p-2.5 rounded-lg bg-card/60 border border-border/30 text-sm overflow-hidden"
                      >
                        <div className="flex items-center gap-2">
                          {/* El número de orden: se lee la secuencia sin contar */}
                          <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent border border-accent/30 flex items-center justify-center font-black text-xs">
                            {idx + 1}
                          </span>
                          <span className="truncate font-semibold flex-1">{p.nombre}</span>
                          <button onClick={() => alternar(p)} title="Quitar de la ruta"
                            className="text-muted hover:text-red-400 shrink-0 p-1 -m-1">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {p.tarea_id && (
                          <div className="flex items-center justify-between gap-2 mt-1.5 pl-7">
                            <span className="text-[10px] text-muted truncate">📋 {p.tarea_desc || 'Tarea pendiente'}</span>
                            <button
                              onClick={() => tareaHecha(p)}
                              className="shrink-0 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold hover:bg-emerald-500/25 transition"
                              title="Marcar la tarea como completada"
                            >
                              ✓ Hecha
                            </button>
                          </div>
                        )}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
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
                <p className="text-xs text-muted mb-3">Orden optimizado por cercanía desde el punto de salida.</p>
                <ol className="space-y-1.5 mb-3">
                  {resultado.orden.map((p, i) => (
                    <li key={p.id} className="flex items-start gap-2.5 text-sm">
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

            {/* Con la ruta ya trazada, qué más hay de camino que no sea cliente todavía.
                Los resultados se pintan en el mapa de arriba, no aquí. */}
            <Prospectos
              ruta={puntosRuta}
              aprobadas={prospectosAprobados.datos}
              anadidas={prospectosAnadidos}
              cargando={prospectosAprobados.cargando}
            />

            <p className="text-[11px] text-muted">
              💡 ¿Falta alguien en la lista? Entra en su <Link href="/gestor/luz/clientes" className="text-accent hover:underline">ficha de cliente</Link> y
              rellena la «📍 Ubicación» (o la dirección del suministro en su CUPS).
            </p>
          </div>
        </div>
      )}

      {visitando && (
        <ResolverVisita
          clienteId={visitando.id}
          clienteNombre={visitando.nombre}
          pipelineId={pipeline.datos.find((o) => o.cliente_id === visitando.id && o.estado !== 'ganado' && o.estado !== 'perdido')?.id || null}
          onCerrar={() => setVisitando(null)}
          onHecho={() => {
            setVisitando(null);
            clientes.recargar(); visitas.recargar(); pipeline.recargar();
          }}
        />
      )}
    </div>
  );
}
