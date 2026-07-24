'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import { RefreshCw, Layers } from 'lucide-react';
import { guardarLuz, btnSecundario } from '../ui';
import { ZONAS, zonaDeParada } from '@/lib/zonas';

/**
 * Mapa interactivo de Rutas de visitas (Leaflet + OpenStreetMap, sin coste).
 * Complemento visual del planificador: marca paradas directamente en el mapa,
 * distingue visitadas / pendientes / en ruta, y dibuja la ruta calculada.
 */

export interface ParadaMapa {
  id: string; nombre: string; direccion: string; cliente_id: string;
  prioridad?: string; tipo: 'cliente' | 'cups'; fecha_ultimo_contacto?: string | null;
  interesFV?: boolean;
}

const HOY = () => new Date().toISOString().slice(0, 10);

/** Días transcurridos desde una fecha (o null si no hay fecha). */
function diasDesde(fecha?: string | null): number | null {
  if (!fecha) return null;
  const ms = Date.now() - new Date(fecha).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

const COLOR_PRIORIDAD: Record<string, string> = {
  A: '#ef4444', B: '#f59e0b', C: '#6b7280', D: '#6b7280',
};

function iconoPunto(color: string, numero?: number, anillo?: string, sol?: boolean) {
  // Divicon con SVG inline: evita el problema de rutas de los iconos por defecto de Leaflet con bundlers
  const L = (window as unknown as { L: typeof import('leaflet') }).L;
  const html = `
    <div style="position:relative;width:30px;height:30px;">
      ${anillo ? `<div style="position:absolute;inset:-4px;border-radius:9999px;border:2.5px solid ${anillo};"></div>` : ''}
      <svg width="30" height="30" viewBox="0 0 30 30">
        <circle cx="15" cy="15" r="11" fill="${color}" stroke="white" stroke-width="2.5"/>
        ${numero != null ? `<text x="15" y="19.5" text-anchor="middle" font-size="12" font-weight="900" fill="white" font-family="sans-serif">${numero}</text>` : ''}
      </svg>
      ${sol ? `<div style="position:absolute;top:-7px;right:-7px;width:16px;height:16px;border-radius:9999px;background:#fbbf24;border:1.5px solid white;display:flex;align-items:center;justify-content:center;font-size:9px;box-shadow:0 1px 3px rgba(0,0,0,.35)">☀️</div>` : ''}
    </div>`;
  return L.divIcon({ html, className: '', iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14] });
}

interface Props {
  paradas: ParadaMapa[];
  seleccion: Map<string, { id: string; nombre: string; direccion: string; cliente_id: string }>;
  onAlternar: (p: { id: string; nombre: string; direccion: string; cliente_id: string }) => void;
  orden: { id: string; nombre: string; lat: number | null; lon: number | null }[] | null;
  origenGeo: { lat: number; lon: number } | null;
  origenTexto: string;
  onRecargarClientes: () => void;
  modoManual: boolean;
  onMarcarFV?: (clienteId: string, nombre: string) => Promise<void>;
  onUbicaciones?: (puntos: Record<string, { lat: number; lon: number } | null>) => void;
}

export function MapaRutas({ paradas, seleccion, onAlternar, orden, origenGeo, origenTexto, onRecargarClientes, modoManual, onMarcarFV, onUbicaciones }: Props) {
  const mapaRef = useRef<HTMLDivElement>(null);
  const mapaObj = useRef<import('leaflet').Map | null>(null);
  const capaMarcadores = useRef<import('leaflet').LayerGroup | null>(null);
  const capaRuta = useRef<import('leaflet').Polyline | null>(null);
  const capaOrigen = useRef<import('leaflet').Marker | null>(null);

  const [puntos, setPuntos] = useState<Record<string, { lat: number; lon: number } | null>>({});
  const [cargando, setCargando] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState('');
  const [pintar, setPintar] = useState(0); // señal para repintar marcadores cuando el mapa termina de crearse

  /** Geocodifica (una vez) las paradas visibles con el filtro actual. */
  const cargarUbicaciones = useCallback(async () => {
    if (paradas.length === 0) { setError('No hay paradas con este filtro.'); return; }
    setCargando(true); setError('');
    try {
      const res = await fetch('/api/luz/rutas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'geocodificar', origen: origenTexto, paradas: paradas.slice(0, 60) }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Error ubicando en el mapa.'); return; }
      const m: Record<string, { lat: number; lon: number } | null> = {};
      for (const p of json.puntos) m[p.id] = p.lat != null ? { lat: p.lat, lon: p.lon } : null;
      setPuntos(m);
      onUbicaciones?.(m); // la página usa las coordenadas para asignar zona a todos
      setCargado(true);
    } catch {
      setError('Error de conexión al geocodificar.');
    } finally {
      setCargando(false);
    }
  }, [paradas, origenTexto]);

  // Crear el mapa una sola vez
  // El mapa se crea SOLO cuando el contenedor ya es visible: si Leaflet arranca
  // con el div a 0 px de alto, calcula una vista de 0×0 y nunca pide las baldosas
  // (los pines sí se pintan porque van por coordenadas — ese era el mapa "negro").
  useEffect(() => {
    if (!cargado) return;
    let cancelado = false;
    (async () => {
      const L = await import('leaflet');
      (window as unknown as { L: typeof L }).L = L;
      if (cancelado || !mapaRef.current || mapaObj.current) return;
      const mapa = L.map(mapaRef.current, { zoomControl: true }).setView([41.85, 0.29], 10); // Binéfar

      // Una sola vista, estilo Google Maps: calles, carreteras y pueblos bien legibles.
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap · CARTO',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(mapa);

      capaMarcadores.current = L.layerGroup().addTo(mapa);
      mapaObj.current = mapa;
      // Recalcular tamaño en cuanto el navegador pinte el contenedor con su altura real
      requestAnimationFrame(() => mapa.invalidateSize());
      setPintar((n) => n + 1); // fuerza el pintado de marcadores ahora que el mapa existe
    })();
    return () => {
      cancelado = true;
      mapaObj.current?.remove();
      mapaObj.current = null;
    };
  }, [cargado]);

  // Si el panel cambia de tamaño (redimensionar ventana, plegar menú), Leaflet se entera
  useEffect(() => {
    if (!cargado || !mapaRef.current) return;
    const obs = new ResizeObserver(() => mapaObj.current?.invalidateSize());
    obs.observe(mapaRef.current);
    return () => obs.disconnect();
  }, [cargado]);

  /** Marcar hoy como visitado: guarda la visita en el historial
   *  (y el servidor avanza el "último contacto" del cliente). */
  async function marcarVisitado(clienteId: string) {
    const err = await guardarLuz('visitas', 'POST', { cliente_id: clienteId, fecha: HOY(), notas: 'Marcada desde el mapa de rutas' });
    // Si la tabla de visitas aún no existe, al menos se apunta el último contacto
    if (err) await guardarLuz('clientes', 'PUT', { id: clienteId, fecha_ultimo_contacto: HOY() });
    onRecargarClientes();
  }

  // Repintar marcadores cuando cambian los puntos, la selección o el orden calculado
  useEffect(() => {
    const mapa = mapaObj.current;
    const L = (window as unknown as { L?: typeof import('leaflet') }).L;
    if (!mapa || !L || !capaMarcadores.current) return;
    capaMarcadores.current.clearLayers();
    capaRuta.current?.remove();
    capaOrigen.current?.remove();

    const ordenMap = new Map((orden || []).map((o, i) => [o.id, i + 1]));
    const bounds: [number, number][] = [];

    // Origen (oficina / punto de salida)
    if (origenGeo) {
      capaOrigen.current = L.marker([origenGeo.lat, origenGeo.lon], {
        icon: L.divIcon({
          html: `<div style="width:26px;height:26px;border-radius:6px;background:#111827;border:2.5px solid white;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 1px 4px rgba(0,0,0,.4)">🏠</div>`,
          className: '', iconSize: [26, 26], iconAnchor: [13, 13],
        }),
      }).bindPopup(`<b>Punto de salida</b><br>${origenTexto}`).addTo(mapa);
      bounds.push([origenGeo.lat, origenGeo.lon]);
    }

    for (const p of paradas) {
      const geo = puntos[p.id];
      if (!geo) continue;
      const enRuta = ordenMap.get(p.id);
      const marcada = seleccion.has(p.id);
      const visitadoHoy = p.fecha_ultimo_contacto === HOY();
      // Con coordenadas la zona está garantizada: pueblo reconocido o la más cercana
      const zona = zonaDeParada(p.direccion, geo);
      const color = visitadoHoy ? '#10b981' : marcada ? '#3b82f6' : p.interesFV ? '#eab308' : COLOR_PRIORIDAD[p.prioridad || 'C'];
      // Anillo: negro si está en la ruta calculada; si no, el color de su zona de actuación
      const anillo = enRuta ? '#111827' : zona?.color;
      const marker = L.marker([geo.lat, geo.lon], { icon: iconoPunto(color, enRuta, anillo, p.interesFV) }).addTo(capaMarcadores.current!);
      bounds.push([geo.lat, geo.lon]);

      const dias = diasDesde(p.fecha_ultimo_contacto);
      const textoContacto =
        dias == null ? '⚠️ Sin contacto registrado'
        : dias === 0 ? '✓ Contactado hoy'
        : `🕐 Último contacto hace ${dias} día${dias === 1 ? '' : 's'}`;
      const div = document.createElement('div');
      div.style.minWidth = '190px';
      div.style.fontFamily = 'inherit';
      div.innerHTML = `
        <p style="font-weight:800;font-size:13px;margin-bottom:2px">${p.nombre}</p>
        <p style="font-size:11px;color:#666;margin-bottom:4px">📍 ${p.direccion}</p>
        ${zona ? `<p style="font-size:11px;font-weight:700;margin-bottom:4px;color:${zona.color}">🗂️ Zona: ${zona.nombre}</p>` : ''}
        <p style="font-size:11px;color:${dias != null && dias > 30 ? '#d97706' : '#666'};margin-bottom:6px">${textoContacto}</p>
        ${p.interesFV ? '<p style="font-size:11px;color:#a16207;font-weight:700;margin-bottom:6px">☀️ Interesado en fotovoltaica</p>' : ''}
        ${visitadoHoy ? '<p style="font-size:11px;color:#10b981;font-weight:700;margin-bottom:6px">✓ Visitado hoy</p>' : ''}
        ${enRuta ? `<p style="font-size:11px;color:#111827;font-weight:700;margin-bottom:6px">🔢 Parada nº ${enRuta} de la ruta</p>` : ''}
      `;
      const btnRuta = document.createElement('button');
      btnRuta.textContent = marcada ? '✕ Quitar de la ruta' : '+ Añadir a la ruta';
      btnRuta.style.cssText = `width:100%;margin-bottom:4px;padding:6px 8px;border-radius:8px;border:none;font-weight:700;font-size:11px;cursor:pointer;background:${marcada ? '#fee2e2' : '#dbeafe'};color:${marcada ? '#b91c1c' : '#1e40af'}`;
      btnRuta.onclick = () => onAlternar({ id: p.id, nombre: p.nombre, direccion: p.direccion, cliente_id: p.cliente_id });
      div.appendChild(btnRuta);

      const btnVisita = document.createElement('button');
      btnVisita.textContent = '✓ Marcar visitado hoy';
      btnVisita.style.cssText = `width:100%;margin-bottom:4px;padding:6px 8px;border-radius:8px;border:none;font-weight:700;font-size:11px;cursor:pointer;background:#d1fae5;color:#065f46`;
      btnVisita.onclick = () => marcarVisitado(p.cliente_id);
      div.appendChild(btnVisita);

      // Marcar interés en fotovoltaica: crea la oportunidad real en el pipeline
      if (!p.interesFV && onMarcarFV) {
        const btnFV = document.createElement('button');
        btnFV.textContent = '☀️ Interesado en fotovoltaica';
        btnFV.style.cssText = `width:100%;margin-bottom:4px;padding:6px 8px;border-radius:8px;border:none;font-weight:700;font-size:11px;cursor:pointer;background:#fef3c7;color:#92400e`;
        btnFV.onclick = async () => {
          btnFV.disabled = true;
          btnFV.textContent = 'Guardando…';
          await onMarcarFV(p.cliente_id, p.nombre);
        };
        div.appendChild(btnFV);
      }

      const linkFicha = document.createElement('a');
      linkFicha.href = `/gestor/luz/clientes/${p.cliente_id}`;
      linkFicha.textContent = 'Ver ficha del cliente →';
      linkFicha.style.cssText = 'display:block;text-align:center;font-size:10px;color:#e11d48;font-weight:700;text-decoration:none;margin-top:2px';
      div.appendChild(linkFicha);

      marker.bindPopup(div);
      if (modoManual) marker.on('click', () => onAlternar({ id: p.id, nombre: p.nombre, direccion: p.direccion, cliente_id: p.cliente_id }));
    }

    // Línea de la ruta calculada (origen → paradas en orden)
    if (orden && orden.length > 0 && origenGeo) {
      const linea: [number, number][] = [[origenGeo.lat, origenGeo.lon]];
      for (const o of orden) if (o.lat != null && o.lon != null) linea.push([o.lat, o.lon]);
      if (linea.length > 1) {
        capaRuta.current = L.polyline(linea, { color: '#e11d48', weight: 3, opacity: 0.75, dashArray: '6 6' }).addTo(mapa);
      }
    }

    if (bounds.length > 0) {
      mapa.invalidateSize(); // por si el contenedor acaba de hacerse visible
      try { mapa.fitBounds(bounds as [number, number][], { padding: [30, 30], maxZoom: 14 }); } catch { /* rango insuficiente */ }
    }
  }, [puntos, seleccion, orden, origenGeo, paradas, modoManual, origenTexto, pintar]); // eslint-disable-line react-hooks/exhaustive-deps

  const visitadasHoy = paradas.filter((p) => puntos[p.id] && p.fecha_ultimo_contacto === HOY()).length;
  const ubicadas = Object.values(puntos).filter(Boolean).length;

  return (
    <div className="rounded-2xl border border-border/40 bg-surface/40 overflow-hidden">
      <div className="flex items-center justify-between gap-2 p-2.5 border-b border-border/30 flex-wrap">
        <div className="flex items-center gap-2 text-xs">
          <Layers className="w-4 h-4 text-accent shrink-0" />
          <span className="font-bold">Mapa interactivo</span>
          {cargado && <span className="text-muted">· {ubicadas}/{paradas.length} ubicadas · {visitadasHoy} visitadas hoy · ☀️ {paradas.filter((p) => p.interesFV).length} interesados FV</span>}
        </div>
        <button onClick={cargarUbicaciones} disabled={cargando} className={btnSecundario}>
          <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
          {cargando ? 'Ubicando…' : cargado ? 'Actualizar mapa' : 'Cargar mapa'}
        </button>
      </div>

      {error && <p className="text-[11px] text-red-400 px-2.5 py-1.5">{error}</p>}

      {!cargado && !cargando && (
        <div className="p-6 text-center text-xs text-muted">
          📍 Pulsa <b>«Cargar mapa»</b> para situar en el plano las {paradas.length} ubicación(es) del filtro actual.
        </div>
      )}

      {/* Sin transiciones ni altura 0: una transición CSS de height dejaba el
          contenedor a 0 px mientras Leaflet medía, y el mapa salía vacío. */}
      {cargado && (
        <div
          ref={mapaRef}
          className="w-full"
          style={{ height: '28rem', position: 'relative', zIndex: 0, isolation: 'isolate', background: '#e8e4dc', transition: 'none' }}
        />
      )}

      {cargado && (
        <div className="flex flex-wrap gap-3 px-3 py-2 border-t border-border/30 text-[10px] text-muted">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] inline-block" /> Prioridad A</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] inline-block" /> Prioridad B</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#6b7280] inline-block" /> Sin prioridad alta</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#eab308] inline-block" /> ☀️ Interesado en fotovoltaica</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] inline-block" /> En la ruta</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#10b981] inline-block" /> Visitado hoy</span>
          <span className="flex items-center gap-1">🏠 Punto de salida</span>
          {modoManual && <span className="text-accent font-bold">🖱️ Modo manual: clic en un pin = añadir/quitar de la ruta</span>}
        </div>
      )}

      {cargado && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 pb-2 text-[10px] text-muted items-center">
          <span className="font-bold">🗂️ Zonas (anillo del pin):</span>
          {ZONAS.map((z) => (
            <span key={z.id} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full inline-block border-2" style={{ borderColor: z.color }} />
              {z.nombre}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
