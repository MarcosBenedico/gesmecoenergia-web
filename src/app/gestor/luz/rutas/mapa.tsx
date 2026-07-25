'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import { RefreshCw, Layers, MapPinned, Info, ChevronDown, Eye, EyeOff } from 'lucide-react';
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
  /** Última visita registrada y en qué quedó. */
  visita?: { fecha: string; resultado?: string | null };
}

/**
 * Cómo se pinta una parada según su última visita.
 *
 * Lo importante no es "visitado sí o no", sino EN QUÉ QUEDÓ: a uno que dijo que
 * no no se vuelve, a uno que no estaba hay que volver esta semana, y a uno que
 * dio la factura le toca oferta, no otra visita. Si el mapa no distingue eso,
 * David repite puertas y se salta las que tocan.
 */
const PINTA_VISITA: Record<string, { color: string; icono: string; texto: string }> = {
  factura: { color: '#10b981', icono: '🧾', texto: 'Dio la factura' },
  volver: { color: '#f59e0b', icono: '🕐', texto: 'Hay que volver' },
  no_estaba: { color: '#64748b', icono: '🚪', texto: 'No estaba' },
  no_interesa: { color: '#7f1d1d', icono: '✕', texto: 'Dijo que no' },
};

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
 * LOS PINES, A PROPÓSITO SIMPLES.
 *
 * La primera versión ponía en cada pin un círculo, un emoji, el número de naves
 * y una estrella. Con 149 objetivos en pantalla eso era una pared indistinguible
 * en la que no se leía nada. La lección: a esta densidad, cada adorno resta.
 *
 * Ahora un pin dice UNA cosa con el color y como mucho un número dentro:
 *
 *   · MORADO  → objetivo marcado. Dentro, cuántas naves tiene.
 *   · COLOR   → cliente por visitar. El color es su prioridad.
 *   · APAGADO → cliente ya visitado. Un punto pequeño dice en qué quedó.
 *   · AZUL    → está en la ruta de hoy, con su número de orden.
 *
 * Todo lo demás —sector, metros, consumo, foto— vive en el globo al pulsarlo,
 * que es donde no compite con nada.
 */

/** Objetivo marcado: morado, con las naves dentro. Nada más. */
function iconoObjetivo(p: ProspectoGuardado, yaEsta: boolean, lejos: boolean) {
  const L = (window as unknown as { L: typeof import('leaflet') }).L;

  // Muy alejado el mapa: un punto. Si no, no se ve el terreno por los pines.
  if (lejos) {
    return L.divIcon({
      html: `<div style="width:9px;height:9px;border-radius:9999px;background:#8b5cf6;
              border:1.5px solid rgba(255,255,255,.9);opacity:${yaEsta ? 0.4 : 0.85}"></div>`,
      className: '', iconSize: [9, 9], iconAnchor: [4.5, 4.5], popupAnchor: [0, -5],
    });
  }

  const px = 26;
  const html = `
    <div style="width:${px}px;height:${px}px;border-radius:9999px;
                background:${yaEsta ? '#10b981' : '#8b5cf6'};
                border:2.5px solid white;display:flex;align-items:center;justify-content:center;
                color:white;font-weight:900;font-size:12px;font-family:sans-serif;
                box-shadow:0 2px 5px rgba(0,0,0,.45);opacity:${yaEsta ? 0.75 : 1}">
      ${yaEsta ? '✓' : p.n_edificios}
    </div>`;
  return L.divIcon({ html, className: '', iconSize: [px, px], iconAnchor: [px / 2, px / 2], popupAnchor: [0, -px / 2] });
}

/**
 * Cliente. Círculo liso del color de su prioridad; el anillo, su zona.
 * Si está en la ruta lleva su número de orden y se agranda.
 */
function iconoPunto(
  color: string,
  numero?: number,
  anillo?: string,
  sol?: boolean,
  visitado?: { icono: string; color: string } | null
) {
  const L = (window as unknown as { L: typeof import('leaflet') }).L;
  const enRuta = numero != null;
  const px = enRuta ? 30 : 22;
  // Lo visitado se apaga: deja de competir con lo que queda por hacer
  const opacidad = visitado && !enRuta ? 0.45 : 1;

  const html = `
    <div style="position:relative;width:${px}px;height:${px}px;opacity:${opacidad}">
      ${anillo && !enRuta ? `<div style="position:absolute;inset:-3px;border-radius:9999px;border:2px solid ${anillo}"></div>` : ''}
      <div style="width:${px}px;height:${px}px;border-radius:9999px;background:${enRuta ? '#2563eb' : color};
                  border:2.5px solid white;display:flex;align-items:center;justify-content:center;
                  color:white;font-weight:900;font-size:12px;font-family:sans-serif;
                  box-shadow:0 2px 5px rgba(0,0,0,.45)">
        ${enRuta ? numero : ''}
      </div>
      ${visitado && !enRuta ? `<div style="position:absolute;bottom:-2px;right:-2px;width:11px;height:11px;
            border-radius:9999px;background:${visitado.color};border:2px solid white"></div>` : ''}
      ${sol && !visitado ? `<div style="position:absolute;top:-3px;right:-3px;width:9px;height:9px;
            border-radius:9999px;background:#fbbf24;border:1.5px solid white"></div>` : ''}
    </div>`;
  return L.divIcon({ html, className: '', iconSize: [px, px], iconAnchor: [px / 2, px / 2], popupAnchor: [0, -px / 2] });
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
  /** Esconde lo ya resuelto para dejar en el mapa lo que queda por hacer. */
  const [ocultarVisitados, setOcultarVisitados] = useState(false);
  /**
   * Qué familia se enseña. Los objetivos empiezan APAGADOS cuando hay muchos:
   * con 149 encima el mapa era una pared de pines en la que no se leía nada, y
   * lo primero que uno quiere ver son sus clientes.
   */
  const [verClientes, setVerClientes] = useState(true);
  const [verObjetivos, setVerObjetivos] = useState(false);
  const [zoom, setZoom] = useState(10);

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
      // Con el mapa muy alejado los objetivos se pintan como puntos: si no, no
      // se ve el terreno por encima de los pines.
      mapa.on('zoomend', () => setZoom(mapa.getZoom()));
      setZoom(mapa.getZoom());
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
      // Los de la ruta se ven siempre, aunque se apague la capa
      if (!verClientes && !seleccion.has(p.id) && !ordenMap.has(p.id)) continue;
      const enRuta = ordenMap.get(p.id);
      const marcada = seleccion.has(p.id);
      const visitadoHoy = p.fecha_ultimo_contacto === HOY();
      // El sello de la última visita: qué pasó, no solo que se estuvo
      const sello = p.visita?.resultado ? PINTA_VISITA[p.visita.resultado] : null;
      const yaVisitado = !!p.visita;
      // Con coordenadas la zona está garantizada: pueblo reconocido o la más cercana
      const zona = zonaDeParada(p.direccion, geo);
      const color = visitadoHoy ? '#10b981' : marcada ? '#3b82f6' : p.interesFV ? '#eab308' : COLOR_PRIORIDAD[p.prioridad || 'C'];
      // Anillo: negro si está en la ruta calculada; si no, el color de su zona de actuación
      const anillo = enRuta ? '#111827' : zona?.color;
      // Ocultar lo ya resuelto deja el mapa con lo que queda por hacer, que es
      // como se planifica una mañana. Los de la ruta nunca se esconden.
      if (ocultarVisitados && yaVisitado && !enRuta && !marcada) continue;

      const marker = L.marker([geo.lat, geo.lon], {
        icon: iconoPunto(color, enRuta, anillo, p.interesFV, sello ? { icono: sello.icono, color: sello.color } : yaVisitado ? { icono: '✓', color: '#10b981' } : null),
      }).addTo(capaMarcadores.current!);
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
        ${sello ? `<p style="font-size:11px;font-weight:700;color:${sello.color};margin-bottom:6px">
            ${sello.icono} Última visita: ${sello.texto}</p>` : ''}
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
    for (const pr of verObjetivos ? prospectos || [] : []) {
      const yaEsta = !!prospectosAnadidos?.[pr.id];
      const cat = categoriaDeNaves(pr.n_edificios);
      const marker = L.marker([pr.lat, pr.lon], {
        icon: iconoObjetivo(pr, yaEsta, zoom < 12),
        // Por debajo de las paradas: los clientes mandan sobre los candidatos
        zIndexOffset: -200,
      }).addTo(capaMarcadores.current!);
      // Los objetivos NO entran en el encuadre: son muchos y desperdigados, y
      // encuadrarlos alejaría el mapa hasta perder de vista a los clientes.

      const div = document.createElement('div');
      div.style.width = '230px';
      div.style.fontFamily = 'inherit';
      div.innerHTML = `
        <img src="${urlOrtofoto(pr.lat, pr.lon, 320, 460, 260)}" alt=""
             style="width:100%;height:130px;object-fit:cover;border-radius:8px;margin-bottom:6px;background:#e5e7eb" />
        <p style="display:inline-block;background:#8b5cf6;color:white;font-size:9px;font-weight:900;
                  padding:2px 6px;border-radius:9999px;margin-bottom:4px">★ OBJETIVO · AÚN NO ES CLIENTE</p>
        <p style="font-weight:800;font-size:13px;margin-bottom:1px">
          ${EMOJI_PROSPECTO[pr.tipo] || ''} ${pr.nombre || TIPO_PROSPECTO_LABEL[pr.tipo]}</p>
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
  }, [puntos, seleccion, orden, origenGeo, paradas, modoManual, origenTexto, pintar, prospectos, prospectosAnadidos, capa, ocultarVisitados, verClientes, verObjetivos, zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  const visitadasHoy = paradas.filter((p) => puntos[p.id] && p.fecha_ultimo_contacto === HOY()).length;
  const ubicadas = Object.values(puntos).filter(Boolean).length;
  /** Ya visitados alguna vez: lo que NO hay que volver a llamar a ciegas. */
  const yaVisitados = paradas.filter((p) => puntos[p.id] && p.visita).length;
  /** Objetivos marcados a mano para aprovechar el viaje. */
  const objetivos = prospectos?.length ?? 0;

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
                { n: yaVisitados, de: null, t: 'ya visitados', c: 'text-emerald-400' },
                { n: objetivos, de: null, t: 'objetivos', c: 'text-violet-400' },
                ...(visitadasHoy > 0 ? [{ n: visitadasHoy, de: null, t: 'hoy', c: 'text-emerald-300' }] : []),
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

          {/* QUÉ SE VE. Es el mando más importante del mapa: encender los 149
              objetivos a la vez lo hace ilegible, así que se elige. */}
          <div className="absolute top-3 left-3 z-[500] flex flex-col gap-1.5">
            <button
              onClick={() => setVerClientes((v) => !v)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-black shadow-lg border transition ${
                verClientes ? 'bg-background/90 backdrop-blur text-foreground border-border/50'
                            : 'bg-background/60 backdrop-blur text-muted/60 border-border/30'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shrink-0" />
              Clientes
              <span className="tabular-nums opacity-70">{ubicadas}</span>
              {verClientes ? <Eye className="w-3.5 h-3.5 opacity-60" /> : <EyeOff className="w-3.5 h-3.5 opacity-60" />}
            </button>

            {(prospectos?.length ?? 0) > 0 && (
              <button
                onClick={() => setVerObjetivos((v) => !v)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-black shadow-lg border transition ${
                  verObjetivos ? 'bg-violet-600 text-white border-violet-400'
                               : 'bg-background/60 backdrop-blur text-muted/60 border-border/30'
                }`}
              >
                <span className="w-3 h-3 rounded-full bg-violet-500 border-2 border-white shrink-0" />
                Objetivos
                <span className="tabular-nums opacity-70">{prospectos?.length}</span>
                {verObjetivos ? <Eye className="w-3.5 h-3.5 opacity-60" /> : <EyeOff className="w-3.5 h-3.5 opacity-60" />}
              </button>
            )}

            {verObjetivos && zoom < 12 && (
              <p className="max-w-[11rem] px-2.5 py-1.5 rounded-lg bg-violet-600/90 text-white text-[10px] font-bold shadow-lg">
                Acércate para verlos con su número de naves.
              </p>
            )}
          </div>

          {/* Esconder lo ya resuelto: la forma más rápida de dejar en el mapa
              solo lo que queda por hacer. */}
          {yaVisitados > 0 && (
            <button
              onClick={() => setOcultarVisitados((v) => !v)}
              className={`absolute bottom-3 right-3 z-[500] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold shadow-lg border transition ${
                ocultarVisitados
                  ? 'bg-accent text-white border-accent'
                  : 'bg-background/85 backdrop-blur text-muted border-border/50 hover:text-foreground'
              }`}
            >
              {ocultarVisitados ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {ocultarVisitados ? `${yaVisitados} visitados ocultos` : 'Ocultar ya visitados'}
            </button>
          )}

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
                <div className="px-3 pb-3">
                  {/* Un pin = un color. Cuatro casos y se acabó. */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {([
                      { c: '#ef4444', d: '', t: 'Cliente por visitar', s: 'El color es su prioridad' },
                      { c: '#2563eb', d: '3', t: 'En la ruta de hoy', s: 'Con su número de orden' },
                      { c: '#94a3b8', d: '', t: 'Ya visitado', s: 'Apagado, con punto de resultado' },
                      { c: '#8b5cf6', d: '4', t: 'Objetivo marcado', s: 'Aún no es cliente · nº de naves' },
                    ] as const).map((x) => (
                      <div key={x.t} className="flex items-start gap-2">
                        <span
                          className="shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black text-white"
                          style={{ background: x.c, boxShadow: '0 1px 3px rgba(0,0,0,.4)' }}
                        >
                          {x.d}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold leading-tight">{x.t}</p>
                          <p className="text-[10px] text-muted leading-tight">{x.s}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* El punto pequeño del visitado: en qué quedó */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 pt-2.5 border-t border-border/25 text-[10px] text-muted">
                    <span className="font-bold text-foreground">El punto del visitado:</span>
                    {Object.entries(PINTA_VISITA).map(([k, v]) => (
                      <span key={k} className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full inline-block border border-white/60" style={{ background: v.color }} />
                        {v.texto}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-muted items-center">
                    <span className="font-bold text-foreground">El anillo del pin es la zona:</span>
                    {ZONAS.map((z) => (
                      <span key={z.id} className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full inline-block border-2" style={{ borderColor: z.color }} />
                        {z.nombre}
                      </span>
                    ))}
                  </div>

                  <p className="text-[10px] text-muted mt-2 pt-2 border-t border-border/25">
                    El punto amarillo pequeño marca interés en fotovoltaica. Todo lo demás —sector, metros, consumo y
                    foto— sale al pulsar el pin.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
