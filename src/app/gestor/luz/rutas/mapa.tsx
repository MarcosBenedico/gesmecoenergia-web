'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import { RefreshCw, Layers, MapPinned, Info, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { guardarLuz, btnSecundario, btnPrimario } from '../ui';
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
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL LENGUAJE DE LOS PINES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El mapa quería decir OCHO cosas en un círculo de 22 px: si es cliente o
 * candidato, su prioridad, si ya se visitó, en qué quedó, si está en la ruta,
 * su zona, si le interesa la fotovoltaica y cuántas naves tiene. Ocho no caben,
 * y el resultado era que ninguna se leía.
 *
 * Así que se reparte por canales, y cada canal dice UNA cosa:
 *
 *   FORMA    → qué es.        Círculo = cliente. Cuadrado = objetivo (no cliente).
 *   RELLENO  → si queda algo.  Macizo = pendiente. Hueco = ya resuelto.
 *   COLOR    → cuánto corre.   En pendientes, la prioridad. En visitados, en qué
 *                              quedó. Un solo eje de color a la vez, nunca dos.
 *   TAMAÑO   → si es de hoy.   Lo que está en la ruta manda y se agranda.
 *   NÚMERO   → una sola cifra: el orden de la ruta, o las naves del objetivo.
 *
 * Y lo que se ha SACADO del pin, a conciencia:
 *
 *   · La zona. Un anillo de siete colores era lo que más ruido metía —competía
 *     con el relleno y no ganaba ninguno—, y para planificar no hacía falta.
 *   · El interés en fotovoltaica. Es un filtro de arriba: se marca y salen
 *     ellos solos, que es justo para lo que sirve un filtro.
 *   · Sector, metros, consumo y foto viven en el globo, donde no compiten.
 *
 * Macizo contra hueco es la distinción más rápida que existe de un vistazo, y
 * es la que responde a la única pregunta que importa mirando el mapa: ¿dónde
 * me queda trabajo?
 */

/** Colores de prioridad. Un cliente pendiente se pinta con el suyo. */
const COLOR_PRIORIDAD: Record<string, string> = {
  A: '#ef4444', B: '#f59e0b', C: '#94a3b8', D: '#94a3b8',
};

/** Azul de la ruta de hoy: manda sobre cualquier otro color. */
const AZUL_RUTA = '#2563eb';
/** Morado de los objetivos: no es cliente todavía. */
const MORADO_OBJETIVO = '#8b5cf6';

/**
 * CLIENTE. Círculo.
 *  · pendiente → macizo, color de su prioridad
 *  · visitado  → hueco, color de en qué quedó
 *  · en ruta   → macizo azul, más grande, con su número de orden
 */
function iconoCliente(opciones: {
  prioridad?: string;
  ordenRuta?: number;
  /** Color del resultado de la última visita. null si no se ha visitado. */
  colorVisita?: string | null;
}) {
  const L = (window as unknown as { L: typeof import('leaflet') }).L;
  const { prioridad, ordenRuta, colorVisita } = opciones;

  const enRuta = ordenRuta != null;
  const visitado = !!colorVisita && !enRuta;
  const px = enRuta ? 32 : 22;
  const color = enRuta ? AZUL_RUTA : visitado ? colorVisita! : COLOR_PRIORIDAD[prioridad || 'C'];

  // Hueco = ya resuelto. Macizo = queda por hacer.
  const fondo = visitado ? 'transparent' : color;
  const borde = visitado ? `3px solid ${color}` : '2.5px solid rgba(255,255,255,.95)';

  const html = `
    <div style="width:${px}px;height:${px}px;border-radius:9999px;background:${fondo};border:${borde};
                display:flex;align-items:center;justify-content:center;color:white;font-weight:900;
                font-size:13px;font-family:sans-serif;
                box-shadow:${visitado ? '0 0 0 2px rgba(0,0,0,.35)' : '0 2px 6px rgba(0,0,0,.5)'}">
      ${enRuta ? ordenRuta : ''}
    </div>`;
  return L.divIcon({ html, className: '', iconSize: [px, px], iconAnchor: [px / 2, px / 2], popupAnchor: [0, -px / 2] });
}

/**
 * OBJETIVO. Cuadrado redondeado: forma distinta porque es una cosa distinta —
 * todavía no es cliente. Dentro, las naves, que es su medida.
 */
function iconoObjetivo(p: ProspectoGuardado, yaEnRuta: boolean, lejos: boolean) {
  const L = (window as unknown as { L: typeof import('leaflet') }).L;

  // Con el mapa alejado, un punto: si no, no se ve el terreno por los pines
  if (lejos) {
    return L.divIcon({
      html: `<div style="width:9px;height:9px;border-radius:2px;background:${MORADO_OBJETIVO};
              border:1.5px solid rgba(255,255,255,.9);opacity:${yaEnRuta ? 0.4 : 0.9}"></div>`,
      className: '', iconSize: [9, 9], iconAnchor: [4.5, 4.5], popupAnchor: [0, -5],
    });
  }

  const px = 24;
  // Ya pasado a la ruta: hueco, igual que un cliente resuelto
  const html = `
    <div style="width:${px}px;height:${px}px;border-radius:6px;
                background:${yaEnRuta ? 'transparent' : MORADO_OBJETIVO};
                border:${yaEnRuta ? `3px solid ${MORADO_OBJETIVO}` : '2.5px solid rgba(255,255,255,.95)'};
                display:flex;align-items:center;justify-content:center;
                color:${yaEnRuta ? MORADO_OBJETIVO : 'white'};font-weight:900;font-size:12px;
                font-family:sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.5)">
      ${p.n_edificios}
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
  /** Oportunidades ya aprobadas para visitar: se pintan con su emoji sobre la ruta. */
  prospectos?: ProspectoGuardado[];
  /** Crea la ficha del candidato y lo mete como parada. Devuelve el error, si lo hay. */
  onProspectoARuta?: (p: ProspectoGuardado) => Promise<string | null>;
  /** Las que ya se han pasado a la ruta, por id. */
  prospectosAnadidos?: Record<string, boolean>;
  /** Abre la hoja de "¿qué tal ha ido?" para ese cliente. */
  onResolverVisita?: (clienteId: string, nombre: string) => void;
}

export function MapaRutas({ paradas, seleccion, onAlternar, orden, origenGeo, origenTexto, onRecargarClientes, modoManual, onMarcarFV, prospectos, onProspectoARuta, prospectosAnadidos, onResolverVisita }: Props) {
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
      // En qué quedó la última visita. Es lo que da color a un pin ya resuelto.
      const sello = p.visita?.resultado ? PINTA_VISITA[p.visita.resultado] : null;
      const yaVisitado = !!p.visita;
      // Ocultar lo ya resuelto deja el mapa con lo que queda por hacer, que es
      // como se planifica una mañana. Los de la ruta nunca se esconden.
      if (ocultarVisitados && yaVisitado && !enRuta && !marcada) continue;

      const marker = L.marker([geo.lat, geo.lon], {
        icon: iconoCliente({
          prioridad: p.prioridad,
          // Marcado a mano cuenta como "de hoy" aunque no se haya calculado el orden
          ordenRuta: enRuta ?? (marcada ? 0 : undefined),
          colorVisita: sello?.color || (yaVisitado ? (visitadoHoy ? '#10b981' : '#94a3b8') : null),
        }),
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
          <span className="flex items-center gap-2 font-black text-base">
            <Layers className="w-5 h-5 text-accent shrink-0" /> Mapa
          </span>
          {cargado && (
            <div className="flex items-center gap-5 flex-wrap">
              {[
                { n: ubicadas, de: paradas.length, t: 'ubicadas', c: 'text-foreground' },
                { n: seleccion.size, de: null, t: 'en la ruta', c: 'text-blue-400' },
                { n: yaVisitados, de: null, t: 'ya visitados', c: 'text-emerald-400' },
                { n: objetivos, de: null, t: 'objetivos', c: 'text-violet-400' },
                ...(visitadasHoy > 0 ? [{ n: visitadasHoy, de: null, t: 'hoy', c: 'text-emerald-300' }] : []),
              ].map(({ n, de, t, c }) => (
                <span key={t} className="flex items-baseline gap-1.5">
                  <motion.b
                    key={`${t}-${n}`}
                    initial={{ scale: 1.35, opacity: 0.4 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    className={`text-2xl font-black tabular-nums leading-none ${c}`}
                  >
                    {n}{de != null ? `/${de}` : ''}
                  </motion.b>
                  <span className="text-xs font-bold text-muted">{t}</span>
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
                    className="relative flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-bold transition"
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
              className={`inline-flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-black shadow-lg border transition ${
                verClientes ? 'bg-background/90 backdrop-blur text-foreground border-border/50'
                            : 'bg-background/60 backdrop-blur text-muted/60 border-border/30'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shrink-0" />
              Clientes
              <span className="tabular-nums opacity-70">{ubicadas}</span>
              {verClientes ? <Eye className="w-4 h-4 opacity-60" /> : <EyeOff className="w-4 h-4 opacity-60" />}
            </button>

            {(prospectos?.length ?? 0) > 0 && (
              <button
                onClick={() => setVerObjetivos((v) => !v)}
                className={`inline-flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-black shadow-lg border transition ${
                  verObjetivos ? 'bg-violet-600 text-white border-violet-400'
                               : 'bg-background/60 backdrop-blur text-muted/60 border-border/30'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-violet-500 border-2 border-white shrink-0" />
                Objetivos
                <span className="tabular-nums opacity-70">{prospectos?.length}</span>
                {verObjetivos ? <Eye className="w-4 h-4 opacity-60" /> : <EyeOff className="w-4 h-4 opacity-60" />}
              </button>
            )}

            {verObjetivos && zoom < 12 && (
              <p className="max-w-[13rem] px-3 py-2 rounded-lg bg-violet-600/90 text-white text-xs font-bold shadow-lg">
                Acércate para verlos con su número de naves.
              </p>
            )}
          </div>

          {/* Esconder lo ya resuelto: la forma más rápida de dejar en el mapa
              solo lo que queda por hacer. */}
          {yaVisitados > 0 && (
            <button
              onClick={() => setOcultarVisitados((v) => !v)}
              className={`absolute bottom-3 right-3 z-[500] inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold shadow-lg border transition ${
                ocultarVisitados
                  ? 'bg-accent text-white border-accent'
                  : 'bg-background/85 backdrop-blur text-muted border-border/50 hover:text-foreground'
              }`}
            >
              {ocultarVisitados ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                className="absolute bottom-3 left-3 z-[500] px-4 py-3 rounded-xl bg-accent text-white text-sm font-black shadow-lg"
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
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-bold text-muted hover:text-foreground transition"
          >
            <span className="flex items-center gap-1.5">
              <Info className="w-4 h-4" /> Qué significa cada pin
              {oscura && <span className="text-xs font-normal">· vista aérea del IGN</span>}
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
                <div className="px-4 pb-4 space-y-4">
                  {/* La leyenda cuenta el sistema, no una lista de colores:
                      forma = qué es, relleno = si queda algo por hacer. */}
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border/40 bg-card/40 p-3">
                      <p className="text-xs font-black uppercase tracking-wide text-muted mb-2.5">
                        La forma dice qué es
                      </p>
                      <div className="flex items-center gap-5">
                        <span className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-full bg-red-500 border-[2.5px] border-white shrink-0"
                            style={{ boxShadow: '0 2px 6px rgba(0,0,0,.5)' }} />
                          <span className="text-sm font-bold">Cliente</span>
                        </span>
                        <span className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-md bg-violet-500 border-[2.5px] border-white shrink-0 flex items-center justify-center text-xs font-black text-white"
                            style={{ boxShadow: '0 2px 6px rgba(0,0,0,.5)' }}>4</span>
                          <span className="text-sm font-bold">Objetivo <span className="font-normal text-muted">· aún no cliente</span></span>
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/40 bg-card/40 p-3">
                      <p className="text-xs font-black uppercase tracking-wide text-muted mb-2.5">
                        El relleno dice si queda trabajo
                      </p>
                      <div className="flex items-center gap-5">
                        <span className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-full bg-amber-500 border-[2.5px] border-white shrink-0"
                            style={{ boxShadow: '0 2px 6px rgba(0,0,0,.5)' }} />
                          <span className="text-sm font-bold">Macizo <span className="font-normal text-muted">· por hacer</span></span>
                        </span>
                        <span className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-full border-[3px] border-slate-400 shrink-0" />
                          <span className="text-sm font-bold">Hueco <span className="font-normal text-muted">· ya visitado</span></span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border/40 bg-card/40 p-3">
                      <p className="text-xs font-black uppercase tracking-wide text-muted mb-2.5">
                        El color de un pendiente es su prioridad
                      </p>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        {([['#ef4444', 'Prioridad A'], ['#f59e0b', 'Prioridad B'], ['#94a3b8', 'Resto']] as const).map(([c, t]) => (
                          <span key={t} className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full border-2 border-white shrink-0" style={{ background: c }} />
                            <span className="text-sm">{t}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/40 bg-card/40 p-3">
                      <p className="text-xs font-black uppercase tracking-wide text-muted mb-2.5">
                        El color de un visitado es en qué quedó
                      </p>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        {Object.entries(PINTA_VISITA).map(([k, v]) => (
                          <span key={k} className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full border-[3px] shrink-0" style={{ borderColor: v.color }} />
                            <span className="text-sm">{v.texto}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-500/35 bg-blue-500/10 p-3 flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-[#2563eb] border-[2.5px] border-white shrink-0 flex items-center justify-center text-sm font-black text-white"
                      style={{ boxShadow: '0 2px 6px rgba(0,0,0,.5)' }}>3</span>
                    <p className="text-sm">
                      <b className="font-black">Azul y más grande: va en la ruta de hoy</b>
                      <span className="text-muted"> · el número es su orden de parada. Manda sobre cualquier otro color.</span>
                    </p>
                  </div>

                  <p className="text-xs text-muted border-t border-border/25 pt-3">
                    <b className="text-foreground">Lo que ya no va en el pin, a propósito:</b> la zona y el interés en
                    fotovoltaica son filtros de arriba —se marcan y salen ellos solos—, y el sector, los metros, el
                    consumo y la foto salen al pulsarlo. Un pin que intenta decir ocho cosas no dice ninguna.
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
