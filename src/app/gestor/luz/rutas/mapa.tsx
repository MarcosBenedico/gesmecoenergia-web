'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import { RefreshCw, Layers, MapPinned, Info, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { guardarLuz, btnSecundario, btnPrimario } from '../ui';
import { ZONAS, zonaDeParada } from '@/lib/zonas';
import { ProspectoGuardado, TipoProspecto, TIPO_PROSPECTO_LABEL, categoriaDeNaves } from '@/lib/prospeccion';
import { urlOrtofoto } from './foto-aerea';
import {
  CAPAS, ClaveCapa, TESELAS_CALLES, TESELAS_ROTULOS, WMS_PNOA, WMS_IGN_BASE,
  capaGuardada, esOscura, CLAVE_CAPA_GUARDADA,
} from './capas';

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

/** Emoji por tipo de sitio: se reconoce de un vistazo sin leer nada. */
const EMOJI_PROSPECTO: Record<TipoProspecto, string> = {
  granja_intensiva: '🐖',
  granja: '🚜',
  invernadero: '🌱',
  industria: '🏭',
  nave: '📦',
  riego: '💧',
  comercio: '🏪',
  sin_clasificar: '❓',
};

/**
 * Pin de una oportunidad aprobada. Dice tres cosas de golpe: el emoji es el
 * tipo de sitio, el número de la esquina son las NAVES —la medida que usa el
 * sector y la que mejor predice la factura— y el tamaño acompaña, para que las
 * explotaciones grandes salten a la vista sin leer nada.
 */
function iconoProspecto(p: ProspectoGuardado, yaEsta: boolean) {
  const L = (window as unknown as { L: typeof import('leaflet') }).L;
  const cat = categoriaDeNaves(p.n_edificios);
  const px = p.n_edificios >= 5 ? 38 : p.n_edificios >= 3 ? 32 : 27;

  const html = `
    <div style="position:relative;width:${px}px;height:${px}px;opacity:${yaEsta ? 0.55 : 1}">
      <div style="width:${px}px;height:${px}px;border-radius:9999px;background:#fffbeb;
                  border:3px solid ${yaEsta ? '#10b981' : cat.color};display:flex;align-items:center;
                  justify-content:center;font-size:${Math.round(px * 0.46)}px;
                  box-shadow:0 2px 5px rgba(0,0,0,.3)">
        ${EMOJI_PROSPECTO[p.tipo] || '❓'}
      </div>
      <div style="position:absolute;bottom:-3px;right:-3px;background:${cat.color};color:white;
                  min-width:15px;height:15px;border-radius:9999px;border:1.5px solid white;
                  font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;
                  padding:0 2px">${p.n_edificios}</div>
      ${p.ya_tiene_placas ? `<div style="position:absolute;top:-4px;right:-4px;width:14px;height:14px;
                  border-radius:9999px;background:#fbbf24;border:1.5px solid white;font-size:8px;
                  display:flex;align-items:center;justify-content:center">☀️</div>` : ''}
    </div>`;
  return L.divIcon({ html, className: '', iconSize: [px, px], iconAnchor: [px / 2, px / 2], popupAnchor: [0, -px / 2] });
}

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
  /** Oportunidades ya aprobadas para visitar: se pintan con su emoji sobre la ruta. */
  prospectos?: ProspectoGuardado[];
  /** Crea la ficha del candidato y lo mete como parada. Devuelve el error, si lo hay. */
  onProspectoARuta?: (p: ProspectoGuardado) => Promise<string | null>;
  /** Las que ya se han pasado a la ruta, por id. */
  prospectosAnadidos?: Record<string, boolean>;
  /** Abre la hoja de "¿qué tal ha ido?" para ese cliente. */
  onResolverVisita?: (clienteId: string, nombre: string) => void;
}

export function MapaRutas({ paradas, seleccion, onAlternar, orden, origenGeo, origenTexto, onRecargarClientes, modoManual, onMarcarFV, onUbicaciones, prospectos, onProspectoARuta, prospectosAnadidos, onResolverVisita }: Props) {
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
  /** Capa de fondo elegida. Se recuerda: cada uno trabaja mejor con una. */
  const [capa, setCapa] = useState<ClaveCapa>('hibrido');
  const capasFondo = useRef<import('leaflet').Layer[]>([]);
  const [verLeyenda, setVerLeyenda] = useState(true);

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
      setCapa(capaGuardada());

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

  /**
   * Monta la capa de fondo elegida.
   *
   * En zona rural el satélite no es un capricho: un cliente no es una calle con
   * número, es "la nave larga pasada la balsa". El híbrido —ortofoto del IGN
   * con los nombres encima— es el que mejor funciona para preparar una ruta,
   * y por eso es el que sale por defecto.
   */
  useEffect(() => {
    const mapa = mapaObj.current;
    const L = (window as unknown as { L?: typeof import('leaflet') }).L;
    if (!mapa || !L) return;

    for (const c of capasFondo.current) mapa.removeLayer(c);
    capasFondo.current = [];
    const añadir = (c: import('leaflet').Layer) => { c.addTo(mapa); capasFondo.current.push(c); };

    if (capa === 'calles') {
      añadir(L.tileLayer(TESELAS_CALLES.url, TESELAS_CALLES.opciones));
    } else if (capa === 'relieve') {
      añadir(L.tileLayer.wms(WMS_IGN_BASE.url, WMS_IGN_BASE.opciones));
    } else {
      añadir(L.tileLayer.wms(WMS_PNOA.url, WMS_PNOA.opciones));
      // El híbrido lleva los rótulos encima; el satélite se deja limpio para
      // poder mirar cubiertas y balsas sin nada que estorbe.
      if (capa === 'hibrido') añadir(L.tileLayer(TESELAS_ROTULOS.url, TESELAS_ROTULOS.opciones));
    }

    // Las capas de fondo van debajo de todo lo demás
    for (const c of capasFondo.current) (c as import('leaflet').TileLayer).bringToBack();
    try { localStorage.setItem(CLAVE_CAPA_GUARDADA, capa); } catch { /* sin espacio */ }
  }, [capa, cargado, pintar]);

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
      btnVisita.textContent = onResolverVisita ? '✅ Ya he ido — ¿qué tal?' : '✓ Marcar visitado hoy';
      btnVisita.style.cssText = `width:100%;margin-bottom:4px;padding:6px 8px;border-radius:8px;border:none;font-weight:700;font-size:11px;cursor:pointer;background:#d1fae5;color:#065f46`;
      // Registrar solo la fecha no dice nada: lo que mueve el sistema es el
      // resultado. Si hay dónde resolverla, se abre; si no, se apunta a secas.
      btnVisita.onclick = () =>
        onResolverVisita ? onResolverVisita(p.cliente_id, p.nombre) : marcarVisitado(p.cliente_id);
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

    // ── Oportunidades aprobadas para visitar ──
    // Vienen ya filtradas del Mapa de oportunidades: aquí no se busca nada.
    // El número del pin son las naves; al pulsarlo sale la foto aérea.
    for (const pr of prospectos || []) {
      const yaEsta = !!prospectosAnadidos?.[pr.id];
      const cat = categoriaDeNaves(pr.n_edificios);
      const marker = L.marker([pr.lat, pr.lon], {
        icon: iconoProspecto(pr, yaEsta),
        // Por debajo de las paradas: los clientes mandan sobre los candidatos
        zIndexOffset: -200,
      }).addTo(capaMarcadores.current!);
      bounds.push([pr.lat, pr.lon]);

      const div = document.createElement('div');
      div.style.width = '230px';
      div.style.fontFamily = 'inherit';
      div.innerHTML = `
        <img src="${urlOrtofoto(pr.lat, pr.lon, 320, 460, 260)}" alt=""
             style="width:100%;height:130px;object-fit:cover;border-radius:8px;margin-bottom:6px;background:#e5e7eb" />
        <p style="font-weight:800;font-size:13px;margin-bottom:1px">${pr.nombre || TIPO_PROSPECTO_LABEL[pr.tipo]}</p>
        <p style="font-size:11px;color:#666;margin-bottom:4px">
          ${TIPO_PROSPECTO_LABEL[pr.tipo]}${pr.municipio ? ` · ${pr.municipio}` : ''}
        </p>
        <p style="font-size:11px;font-weight:700;color:${cat.color};margin-bottom:4px">
          ${cat.etiqueta} · ${pr.m2_construidos.toLocaleString('es-ES')} m²
          ${pr.nave_largo ? ` · mayor ${pr.nave_largo}×${pr.nave_ancho} m` : ''}
        </p>
        ${pr.consumo_estimado_kwh ? `<p style="font-size:11px;font-weight:700;color:#047857;margin-bottom:4px">
            ⚡ ~${pr.consumo_estimado_kwh.toLocaleString('es-ES')} kWh/año
            <span style="font-weight:400;color:#666">estimados</span></p>` : ''}
        ${pr.tiene_balsa ? '<p style="font-size:11px;color:#0891b2;margin-bottom:4px">💧 Balsa al lado</p>' : ''}
        ${pr.ya_tiene_placas ? '<p style="font-size:11px;color:#b45309;font-weight:700;margin-bottom:4px">☀️ Ya figura con placas</p>' : ''}
        ${pr.catastro_anio ? `<p style="font-size:10px;color:#666;margin-bottom:6px">Catastro: ${pr.catastro_uso || ''} · de ${pr.catastro_anio}</p>` : ''}
      `;

      if (onProspectoARuta) {
        const btn = document.createElement('button');
        const pintarBoton = () => {
          btn.textContent = yaEsta ? '✓ Ya está en la ruta' : '+ Crear ficha y añadir a la ruta';
          btn.style.cssText =
            `width:100%;margin-bottom:4px;padding:7px 8px;border-radius:8px;border:none;font-weight:700;` +
            `font-size:11px;cursor:${yaEsta ? 'default' : 'pointer'};` +
            `background:${yaEsta ? '#d1fae5' : '#ede9fe'};color:${yaEsta ? '#065f46' : '#5b21b6'}`;
        };
        pintarBoton();
        btn.disabled = yaEsta;
        btn.onclick = async () => {
          btn.disabled = true;
          btn.textContent = 'Creando ficha…';
          const err = await onProspectoARuta(pr);
          if (err) { btn.textContent = err; btn.disabled = false; }
          else { btn.textContent = '✓ Añadido'; }
        };
        div.appendChild(btn);
      }

      const verFoto = document.createElement('a');
      verFoto.href = `https://www.google.com/maps/@${pr.lat},${pr.lon},300m/data=!3m1!1e3`;
      verFoto.target = '_blank';
      verFoto.rel = 'noopener noreferrer';
      verFoto.textContent = 'Ver en Google Maps (satélite) →';
      verFoto.style.cssText = 'display:block;text-align:center;font-size:10px;color:#e11d48;font-weight:700;text-decoration:none';
      div.appendChild(verFoto);

      marker.bindPopup(div, { maxWidth: 250 });
    }

    // Línea de la ruta calculada (origen → paradas en orden)
    if (orden && orden.length > 0 && origenGeo) {
      const linea: [number, number][] = [[origenGeo.lat, origenGeo.lon]];
      for (const o of orden) if (o.lat != null && o.lon != null) linea.push([o.lat, o.lon]);
      if (linea.length > 1) {
        // Sobre la ortofoto un trazo fino se pierde entre los campos: se pinta
        // más grueso y con un halo blanco debajo para que destaque siempre.
        const oscura = esOscura(capa);
        if (oscura) {
          capaRuta.current = L.polyline(linea, { color: '#ffffff', weight: 7, opacity: 0.55 }).addTo(mapa);
          L.polyline(linea, { color: '#f43f5e', weight: 3.5, opacity: 1, dashArray: '8 6' }).addTo(mapa);
        } else {
          capaRuta.current = L.polyline(linea, { color: '#e11d48', weight: 3, opacity: 0.75, dashArray: '6 6' }).addTo(mapa);
        }
      }
    }

    if (bounds.length > 0) {
      mapa.invalidateSize(); // por si el contenedor acaba de hacerse visible
      try { mapa.fitBounds(bounds as [number, number][], { padding: [30, 30], maxZoom: 14 }); } catch { /* rango insuficiente */ }
    }
  }, [puntos, seleccion, orden, origenGeo, paradas, modoManual, origenTexto, pintar, prospectos, prospectosAnadidos, capa]); // eslint-disable-line react-hooks/exhaustive-deps

  const visitadasHoy = paradas.filter((p) => puntos[p.id] && p.fecha_ultimo_contacto === HOY()).length;
  const ubicadas = Object.values(puntos).filter(Boolean).length;

  const oscura = esOscura(capa);

  return (
    <div className="rounded-2xl border border-border/40 bg-surface/40 overflow-hidden">
      {/* Cabecera: los números del mapa en grande, que es lo que se mira */}
      <div className="flex items-center justify-between gap-2 p-3 border-b border-border/30 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 font-black text-sm">
            <Layers className="w-4 h-4 text-accent shrink-0" /> Mapa
          </span>
          {cargado && (
            <div className="flex items-center gap-3">
              {[
                { n: ubicadas, de: paradas.length, t: 'ubicadas', c: 'text-foreground' },
                { n: seleccion.size, de: null, t: 'en la ruta', c: 'text-blue-400' },
                { n: visitadasHoy, de: null, t: 'visitadas hoy', c: 'text-emerald-400' },
                { n: paradas.filter((p) => p.interesFV).length, de: null, t: 'interesados FV', c: 'text-amber-400' },
              ].map(({ n, de, t, c }) => (
                <span key={t} className="flex items-baseline gap-1">
                  <motion.b
                    key={`${t}-${n}`}
                    initial={{ scale: 1.35, opacity: 0.4 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    className={`text-base font-black tabular-nums ${c}`}
                  >
                    {n}{de != null ? `/${de}` : ''}
                  </motion.b>
                  <span className="text-[10px] uppercase font-bold text-muted">{t}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <button onClick={cargarUbicaciones} disabled={cargando} className={btnSecundario}>
          <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
          {cargando ? 'Ubicando…' : cargado ? 'Actualizar' : 'Cargar mapa'}
        </button>
      </div>

      {error && <p className="text-[11px] text-red-400 px-3 py-1.5">{error}</p>}

      {!cargado && !cargando && (
        <div className="p-8 text-center">
          <MapPinned className="w-10 h-10 mx-auto text-muted/40 mb-2" />
          <p className="text-sm font-bold">Sitúa las visitas sobre el terreno</p>
          <p className="text-xs text-muted mt-1">
            {paradas.length} ubicaciones con el filtro actual.
          </p>
          <button onClick={cargarUbicaciones} className={`${btnPrimario} mt-3 mx-auto`}>
            <MapPinned className="w-4 h-4" /> Cargar mapa
          </button>
        </div>
      )}

      {/* Sin transiciones ni altura 0: una transición CSS de height dejaba el
          contenedor a 0 px mientras Leaflet medía, y el mapa salía vacío. */}
      {cargado && (
        <div className="relative">
          <div
            ref={mapaRef}
            className="w-full"
            style={{ height: '34rem', position: 'relative', zIndex: 0, isolation: 'isolate', background: '#e8e4dc', transition: 'none' }}
          />

          {/* Selector de capas, flotando sobre el mapa como en cualquier mapa
              serio. En zona rural cambiar a satélite es la diferencia entre ver
              carreteras y reconocer la nave a la que se va. */}
          <div className="absolute top-3 right-3 z-[500]">
            <div className="flex flex-col gap-1 p-1 rounded-xl bg-background/85 backdrop-blur border border-border/50 shadow-lg">
              {CAPAS.map((c) => {
                const activa = capa === c.clave;
                return (
                  <button
                    key={c.clave}
                    onClick={() => setCapa(c.clave)}
                    title={c.pista}
                    className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition"
                  >
                    {activa && (
                      <motion.span
                        layoutId="capa-activa"
                        className="absolute inset-0 rounded-lg bg-accent"
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    <span className={`relative z-10 ${activa ? 'text-white' : 'text-muted'}`}>{c.emoji}</span>
                    <span className={`relative z-10 ${activa ? 'text-white' : 'text-muted'}`}>{c.nombre}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Aviso del modo manual, encima del mapa donde se está mirando */}
          <AnimatePresence>
            {modoManual && (
              <motion.div
                initial={{ y: -12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -12, opacity: 0 }}
                className="absolute top-3 left-3 z-[500] px-3 py-2 rounded-xl bg-accent text-white text-[11px] font-black shadow-lg"
              >
                Toca un pin para meterlo o sacarlo de la ruta
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Leyenda plegable: hace falta al principio y estorba en cuanto se
          conocen los colores. */}
      {cargado && (
        <div className="border-t border-border/30">
          <button
            onClick={() => setVerLeyenda((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[11px] font-bold text-muted hover:text-foreground transition"
          >
            <span className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" /> Qué significa cada pin
              {oscura && <span className="text-[10px] font-normal">· vista aérea del IGN</span>}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${verLeyenda ? '' : '-rotate-90'}`} />
          </button>

          <AnimatePresence initial={false}>
            {verLeyenda && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3 space-y-2">
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-muted">
                    {([
                      ['#ef4444', 'Prioridad A'],
                      ['#f59e0b', 'Prioridad B'],
                      ['#6b7280', 'Sin prioridad alta'],
                      ['#eab308', 'Interesado en fotovoltaica'],
                      ['#3b82f6', 'En la ruta'],
                      ['#10b981', 'Visitado hoy'],
                    ] as const).map(([color, texto]) => (
                      <span key={texto} className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} /> {texto}
                      </span>
                    ))}
                    <span className="flex items-center gap-1">🏠 Punto de salida</span>
                  </div>

                  {(prospectos?.length ?? 0) > 0 && (
                    <p className="text-[10px] text-muted">
                      <b className="text-foreground">Oportunidades:</b> el emoji es el sector y el número de la esquina
                      son las naves. Vienen aprobadas del Mapa de oportunidades.
                    </p>
                  )}

                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted items-center">
                    <span className="font-bold">Zonas (anillo del pin):</span>
                    {ZONAS.map((z) => (
                      <span key={z.id} className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full inline-block border-2" style={{ borderColor: z.color }} />
                        {z.nombre}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
