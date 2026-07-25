'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import {
  ProspectoGuardado, EstadoProspecto, ESTADO_PROSPECTO_COLOR, ESTADO_PROSPECTO_LABEL,
  TIPO_PROSPECTO_LABEL, TipoProspecto, categoriaDeNaves,
} from '@/lib/prospeccion';
import { urlOrtofoto } from '../rutas/foto-aerea';

/**
 * EL MAPA DE OPORTUNIDADES.
 *
 * Todo lo detectado, sobre el territorio, para poder trabajarlo con la vista.
 * Un listado no sirve aquí: lo que se quiere ver es dónde se concentran las
 * granjas, qué zonas están sin tocar y qué queda cerca de qué.
 *
 * Cada pin dice tres cosas a la vez, y las tres importan:
 *   · el EMOJI, qué tipo de sitio es;
 *   · el NÚMERO dentro, cuántas naves tiene —que en ganadería es la medida que
 *     todo el mundo usa y la que mejor predice la factura—;
 *   · el COLOR del borde, en qué punto del trabajo comercial está.
 */

const EMOJI: Record<TipoProspecto, string> = {
  granja_intensiva: '🐖', granja: '🚜', invernadero: '🌱', industria: '🏭',
  nave: '📦', riego: '💧', comercio: '🏪', sin_clasificar: '❓',
};

interface Props {
  prospectos: ProspectoGuardado[];
  seleccionado: string | null;
  onSeleccionar: (p: ProspectoGuardado | null) => void;
  onCambiarEstado: (p: ProspectoGuardado, estado: EstadoProspecto) => Promise<void>;
  /** Centro elegido para el próximo barrido. Se dibuja con su círculo. */
  centroBarrido?: { lat: number; lon: number } | null;
  radioBarridoKm?: number;
  /** Con esto activo, pulsar en el mapa coloca el centro. */
  eligiendoCentro?: boolean;
  onElegirCentro?: (punto: { lat: number; lon: number }) => void;
}

export function MapaOportunidades({
  prospectos, seleccionado, onSeleccionar, onCambiarEstado,
  centroBarrido, radioBarridoKm = 3, eligiendoCentro, onElegirCentro,
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<import('leaflet').Map | null>(null);
  const capa = useRef<import('leaflet').LayerGroup | null>(null);
  /** El círculo del área a barrer, aparte de los pines para no repintarlo todo. */
  const capaBarrido = useRef<import('leaflet').LayerGroup | null>(null);
  /** El manejador de clic se recrea al cambiar el modo: se guarda para quitarlo. */
  const alPulsar = useRef<((e: { latlng: { lat: number; lng: number } }) => void) | null>(null);
  const [listo, setListo] = useState(false);
  const [primeraVez, setPrimeraVez] = useState(true);

  // Crear el mapa una sola vez
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const L = await import('leaflet');
      (window as unknown as { L: typeof L }).L = L;
      if (cancelado || !contenedor.current || mapa.current) return;
      const m = L.map(contenedor.current, { zoomControl: true }).setView([41.85, 0.29], 11);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap · CARTO', subdomains: 'abcd', maxZoom: 20,
      }).addTo(m);
      capa.current = L.layerGroup().addTo(m);
      capaBarrido.current = L.layerGroup().addTo(m);
      mapa.current = m;
      requestAnimationFrame(() => m.invalidateSize());
      setListo(true);
    })();
    return () => { cancelado = true; mapa.current?.remove(); mapa.current = null; };
  }, []);

  // Si el panel cambia de tamaño, Leaflet se entera
  useEffect(() => {
    if (!listo || !contenedor.current) return;
    const obs = new ResizeObserver(() => mapa.current?.invalidateSize());
    obs.observe(contenedor.current);
    return () => obs.disconnect();
  }, [listo]);

  /**
   * Elegir el centro del barrido pulsando en el mapa.
   *
   * Las zonas de actuación son un atajo cómodo, pero no cubren todo: para ir a
   * por un polígono concreto o una vaguada donde se sabe que hay granjas, lo
   * natural es señalarlo con el dedo.
   */
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    if (alPulsar.current) { m.off('click', alPulsar.current); alPulsar.current = null; }
    const contenedorDiv = contenedor.current;
    if (contenedorDiv) contenedorDiv.style.cursor = eligiendoCentro ? 'crosshair' : '';
    if (!eligiendoCentro || !onElegirCentro) return;
    const manejador = (e: { latlng: { lat: number; lng: number } }) =>
      onElegirCentro({ lat: e.latlng.lat, lon: e.latlng.lng });
    alPulsar.current = manejador;
    m.on('click', manejador);
    return () => { m.off('click', manejador); };
  }, [listo, eligiendoCentro, onElegirCentro]);

  /** El área que se va a barrer, dibujada para no barrer a ciegas. */
  useEffect(() => {
    const m = mapa.current;
    const L = (window as unknown as { L?: typeof import('leaflet') }).L;
    if (!m || !L || !capaBarrido.current) return;
    capaBarrido.current.clearLayers();
    if (!centroBarrido) return;

    L.circle([centroBarrido.lat, centroBarrido.lon], {
      radius: radioBarridoKm * 1000,
      color: '#8b5cf6', weight: 2, fillColor: '#8b5cf6', fillOpacity: 0.08, dashArray: '6 5',
    }).addTo(capaBarrido.current);

    L.marker([centroBarrido.lat, centroBarrido.lon], {
      icon: L.divIcon({
        html: `<div style="width:22px;height:22px;border-radius:9999px;background:#8b5cf6;
                 border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
        className: '', iconSize: [22, 22], iconAnchor: [11, 11],
      }),
      zIndexOffset: 900,
    }).addTo(capaBarrido.current);
  }, [centroBarrido, radioBarridoKm, listo]);

  // Repintar
  useEffect(() => {
    const m = mapa.current;
    const L = (window as unknown as { L?: typeof import('leaflet') }).L;
    if (!m || !L || !capa.current) return;
    capa.current.clearLayers();

    const limites: [number, number][] = [];

    for (const p of prospectos) {
      const cat = categoriaDeNaves(p.n_edificios);
      const color = ESTADO_PROSPECTO_COLOR[p.estado] || '#64748b';
      const activo = seleccionado === p.id;
      // Los descartados se ven, pero apagados: dejan constancia de que ya se
      // miraron sin robarle atención a lo que queda por hacer.
      const apagado = p.estado === 'descartado';
      const px = activo ? 44 : p.n_edificios >= 5 ? 38 : p.n_edificios >= 3 ? 32 : 27;

      const html = `
        <div style="position:relative;width:${px}px;height:${px}px;opacity:${apagado ? 0.4 : 1}">
          <div style="width:${px}px;height:${px}px;border-radius:9999px;background:#fffbeb;
                      border:3px solid ${color};display:flex;align-items:center;justify-content:center;
                      font-size:${Math.round(px * 0.46)}px;
                      box-shadow:0 2px ${activo ? 10 : 5}px rgba(0,0,0,${activo ? 0.55 : 0.3})">
            ${EMOJI[p.tipo] || '❓'}
          </div>
          <div style="position:absolute;bottom:-3px;right:-3px;background:${cat.color};color:white;
                      min-width:15px;height:15px;border-radius:9999px;border:1.5px solid white;
                      font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;
                      padding:0 2px">${p.n_edificios}</div>
          ${p.ya_tiene_placas ? `<div style="position:absolute;top:-4px;right:-4px;width:14px;height:14px;
                      border-radius:9999px;background:#fbbf24;border:1.5px solid white;font-size:8px;
                      display:flex;align-items:center;justify-content:center">☀️</div>` : ''}
        </div>`;

      const marcador = L.marker([p.lat, p.lon], {
        icon: L.divIcon({ html, className: '', iconSize: [px, px], iconAnchor: [px / 2, px / 2], popupAnchor: [0, -px / 2] }),
        zIndexOffset: activo ? 1000 : apagado ? -500 : 0,
      }).addTo(capa.current!);
      limites.push([p.lat, p.lon]);

      const div = document.createElement('div');
      div.style.width = '225px';
      div.innerHTML = `
        <img src="${urlOrtofoto(p.lat, p.lon, 320, 450, 250)}" alt=""
             style="width:100%;height:125px;object-fit:cover;border-radius:8px;margin-bottom:6px;background:#e5e7eb" />
        <p style="font-weight:800;font-size:13px;margin-bottom:1px">${p.nombre || TIPO_PROSPECTO_LABEL[p.tipo]}</p>
        <p style="font-size:11px;color:#666;margin-bottom:3px">
          ${TIPO_PROSPECTO_LABEL[p.tipo]}${p.municipio ? ` · ${p.municipio}` : ''}
        </p>
        <p style="font-size:11px;font-weight:700;color:${cat.color};margin-bottom:3px">
          ${cat.etiqueta} · ${p.m2_construidos.toLocaleString('es-ES')} m²
          ${p.nave_largo ? ` · mayor ${p.nave_largo}×${p.nave_ancho} m` : ''}
        </p>
        ${p.consumo_estimado_kwh ? `<p style="font-size:11px;color:#047857;font-weight:700;margin-bottom:3px">
          ⚡ ~${p.consumo_estimado_kwh.toLocaleString('es-ES')} kWh/año estimados</p>` : ''}
        ${p.tiene_balsa ? '<p style="font-size:11px;color:#0891b2;margin-bottom:3px">💧 Balsa al lado</p>' : ''}
        ${p.ya_tiene_placas ? '<p style="font-size:11px;color:#b45309;font-weight:700;margin-bottom:3px">☀️ Ya figura con placas</p>' : ''}
        <p style="font-size:11px;font-weight:700;color:${color};margin-bottom:5px">
          ${ESTADO_PROSPECTO_LABEL[p.estado]}
        </p>
      `;

      // Los tres botones que mueven el trabajo, en el orden natural de la
      // decisión: me interesa · que vaya David · no vale
      const acciones: [EstadoProspecto, string, string, string][] = [
        ['interesante', '★ Me interesa', '#fef3c7', '#92400e'],
        ['para_visitar', '🚚 Que vaya David', '#d1fae5', '#065f46'],
        ['descartado', '✕ Descartar', '#fee2e2', '#b91c1c'],
      ];
      for (const [estado, texto, fondo, letra] of acciones) {
        if (p.estado === estado) continue;
        const b = document.createElement('button');
        b.textContent = texto;
        b.style.cssText = `width:100%;margin-bottom:3px;padding:6px 8px;border-radius:8px;border:none;
          font-weight:700;font-size:11px;cursor:pointer;background:${fondo};color:${letra}`;
        b.onclick = async () => { b.disabled = true; b.textContent = 'Guardando…'; await onCambiarEstado(p, estado); };
        div.appendChild(b);
      }

      const enlace = document.createElement('a');
      enlace.href = `https://www.google.com/maps/@${p.lat},${p.lon},300m/data=!3m1!1e3`;
      enlace.target = '_blank';
      enlace.rel = 'noopener noreferrer';
      enlace.textContent = 'Ver en Google Maps (satélite) →';
      enlace.style.cssText = 'display:block;text-align:center;font-size:10px;color:#e11d48;font-weight:700;text-decoration:none;margin-top:2px';
      div.appendChild(enlace);

      marcador.bindPopup(div, { maxWidth: 245 });
      marcador.on('click', () => onSeleccionar(p));
    }

    // Encuadrar solo la primera vez: después, cambiar un filtro no debe mover
    // el mapa de sitio si el usuario ya lo ha colocado donde quería.
    if (limites.length && primeraVez) {
      m.invalidateSize();
      try { m.fitBounds(limites, { padding: [40, 40], maxZoom: 13 }); setPrimeraVez(false); } catch { /* rango insuficiente */ }
    }
  }, [prospectos, seleccionado, listo]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={contenedor} className="w-full h-[34rem] rounded-2xl border border-border/40 overflow-hidden" />;
}
