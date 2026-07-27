'use client';

import { useState } from 'react';
import { Maximize2, ExternalLink, X } from 'lucide-react';

/**
 * FOTO AÉREA DEL SITIO — la que decide si merece la pena parar.
 *
 * La fuente es el PNOA del Instituto Geográfico Nacional: la ortofoto oficial
 * de España, gratuita, sin clave y con más resolución que los mapas comerciales
 * en zona rural. Se pide por WMS, así que basta con una etiqueta de imagen.
 *
 * Por qué importa tanto: los datos dicen que hay naves largas y una balsa, pero
 * no dicen si son cerdos, pollos o vacas —las naves se parecen demasiado—, ni
 * si ya tienen placas puestas, que el mapa casi nunca registra. Eso lo resuelve
 * el ojo en dos segundos: silos de pienso, color de la balsa, y si la cubierta
 * está limpia o llena de paneles.
 */

const WMS_PNOA = 'https://www.ign.es/wms-inspire/pnoa-ma';

/**
 * URL de la ortofoto centrada en un punto.
 * `metros` es el lado del recuadro: 300 m encuadra bien una explotación entera.
 */
export function urlOrtofoto(lat: number, lon: number, metros = 320, ancho = 480, alto = 360): string {
  const dLat = metros / 2 / 111132;
  const dLon = metros / 2 / (111320 * Math.cos((lat * Math.PI) / 180));
  // El alto real del recuadro se ajusta a la proporción de la imagen
  const dLatCaja = dLat * (alto / ancho);
  const bbox = [lat - dLatCaja, lon - dLon, lat + dLatCaja, lon + dLon].join(',');
  const p = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetMap',
    LAYERS: 'OI.OrthoimageCoverage', CRS: 'EPSG:4326', BBOX: bbox,
    WIDTH: String(ancho), HEIGHT: String(alto), FORMAT: 'image/jpeg', STYLES: '',
  });
  return `${WMS_PNOA}?${p}`;
}

export function FotoAerea({ lat, lon, etiqueta }: { lat: number; lon: number; etiqueta?: string }) {
  const [ampliada, setAmpliada] = useState(false);
  const [falla, setFalla] = useState(false);

  if (falla) {
    return (
      <div className="rounded-lg border border-border/40 bg-card/60 p-3 text-[10px] text-muted text-center">
        No hay ortofoto disponible aquí.{' '}
        <a href={`https://www.google.com/maps/@${lat},${lon},300m/data=!3m1!1e3`}
          target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          Ver en Google Maps
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="relative rounded-lg overflow-hidden border border-border/40 bg-card/60 group">
        {/* eslint-disable-next-line @next/next/no-img-element -- servicio WMS externo: no pasa por el optimizador */}
        <img
          src={urlOrtofoto(lat, lon)}
          alt={etiqueta || 'Vista aérea del sitio'}
          className="w-full h-40 object-cover"
          loading="lazy"
          onError={() => setFalla(true)}
        />
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAmpliada(true); }}
          title="Ver más grande"
          className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-black/55 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <span className="absolute bottom-1 left-1.5 text-[8px] text-white/75 drop-shadow">PNOA · IGN</span>
      </div>

      {ampliada && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setAmpliada(false)}
        >
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element -- servicio WMS externo */}
            <img
              src={urlOrtofoto(lat, lon, 500, 1100, 800)}
              alt={etiqueta || 'Vista aérea'}
              className="w-full rounded-xl"
            />
            <div className="flex items-center justify-between mt-2">
              <a
                href={`https://www.google.com/maps/@${lat},${lon},300m/data=!3m1!1e3`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-white/90 hover:text-white"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Abrir en Google Maps (satélite)
              </a>
              <button onClick={() => setAmpliada(false)}
                className="inline-flex items-center gap-1 text-xs font-bold text-white/90 hover:text-white">
                <X className="w-3.5 h-3.5" /> Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
