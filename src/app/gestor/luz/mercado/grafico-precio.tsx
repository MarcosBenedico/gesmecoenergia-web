'use client';

import { useState } from 'react';

/**
 * PRECIO HORA A HORA — gráfico del día.
 *
 * Forma: columnas. El eje X es tiempo (24 horas discretas) y la altura es la
 * magnitud, que es lo que se compara de un vistazo.
 *
 * Color: escala DIVERGENTE alrededor de la media del día — barato (cian) ↔
 * caro (rosa), con gris neutro en la media. No es un semáforo verde-ámbar-rojo:
 * eso son tres tonos y se lee como arcoíris. Los 7 pasos están comprobados
 * contra el fondo del panel (#1a1a2e): todos superan 3:1 de contraste, y la
 * luminosidad baja hacia el neutro y sube hacia cada extremo.
 *
 * El color no es la única señal: se dibuja la línea de la media, así que la
 * polaridad se lee igual sin distinguir colores.
 */

export interface HoraMercado { hora: number; omie: number | null; pvpc: number | null }

/** Escala divergente: 3 pasos fríos (barato), neutro, 3 cálidos (caro). */
const ESCALA = {
  muyBarato: '#67e8f9',
  barato: '#22d3ee',
  algoBarato: '#0891b2',
  media: '#64748b',
  algoCaro: '#e11d48',
  caro: '#f43f5e',
  muyCaro: '#fb7185',
};

/** Paso de la escala según lo lejos que esté ese precio de la media del día. */
function tono(valor: number | null, media: number | null): string {
  if (valor == null || media == null || media === 0) return ESCALA.media;
  const desvio = (valor - media) / media;
  if (desvio <= -0.20) return ESCALA.muyBarato;
  if (desvio <= -0.10) return ESCALA.barato;
  if (desvio <= -0.03) return ESCALA.algoBarato;
  if (desvio < 0.03) return ESCALA.media;
  if (desvio < 0.10) return ESCALA.algoCaro;
  if (desvio < 0.20) return ESCALA.caro;
  return ESCALA.muyCaro;
}

const eur = (n: number | null, dec = 0) =>
  n == null ? '—' : n.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

// Lienzo: márgenes justos para que las etiquetas del eje y del máximo respiren
const W = 860, H = 300, ML = 52, MR = 12, MT = 34, MB = 34;
const plotW = W - ML - MR;
const plotH = H - MT - MB;

export function GraficoPrecio({ horas, media, horaActual }: {
  horas: HoraMercado[];
  media: number | null;
  horaActual: number | null;
}) {
  const [activa, setActiva] = useState<number | null>(null);

  const valores = horas.map((h) => h.omie).filter((v): v is number => v != null);
  if (valores.length === 0) {
    return <p className="text-xs text-muted text-center py-8">Sin precios publicados para este día.</p>;
  }

  const maxV = Math.max(...valores);
  const minV = Math.min(...valores);
  const iMax = horas.findIndex((h) => h.omie === maxV);
  const iMin = horas.findIndex((h) => h.omie === minV);

  // La escala arranca en 0: en precios, cortar el eje exagera las diferencias
  const techo = Math.ceil((maxV * 1.12) / 25) * 25 || 25;
  const y = (v: number) => MT + plotH - (v / techo) * plotH;
  const paso = plotW / 24;
  const ancho = Math.max(paso - 3, 6);   // 3px de hueco: separa las columnas sin adelgazarlas

  const lineas = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(techo * f));
  const item = activa != null ? horas[activa] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: '100%', height: 'auto' }}
        onMouseLeave={() => setActiva(null)} role="img"
        aria-label={`Precio de la luz hora a hora. Media ${eur(media)} euros por megavatio hora, mínimo ${eur(minV)} a las ${hh(iMin)}, máximo ${eur(maxV)} a las ${hh(iMax)}.`}>

        {/* Rejilla: recesiva, solo para dar referencia de altura */}
        {lineas.map((v) => (
          <g key={v}>
            <line x1={ML} y1={y(v)} x2={W - MR} y2={y(v)} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
            <text x={ML - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="rgba(255,255,255,0.4)" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {v}
            </text>
          </g>
        ))}
        <text x={ML - 8} y={MT - 14} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.35)">€/MWh</text>

        {/* Columnas */}
        {horas.map((h, i) => {
          if (h.omie == null) return null;
          const x = ML + i * paso + (paso - ancho) / 2;
          const alto = Math.max(MT + plotH - y(h.omie), 2);
          const esActiva = activa === i;
          const destacada = i === iMax || i === iMin;
          return (
            <g key={h.hora} onMouseEnter={() => setActiva(i)}>
              {/* Zona de contacto más ancha que la columna: más fácil de apuntar */}
              <rect x={ML + i * paso} y={MT} width={paso} height={plotH} fill="transparent" />
              <rect
                x={x} y={y(h.omie)} width={ancho} height={alto} rx="4"
                fill={tono(h.omie, media)}
                opacity={activa == null || esActiva || destacada ? 1 : 0.45}
                style={{ transition: 'opacity .15s' }}
              />
            </g>
          );
        })}

        {/* Media del día: hace legible la polaridad sin depender del color */}
        {media != null && (
          <g>
            <line x1={ML} y1={y(media)} x2={W - MR} y2={y(media)}
              stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" strokeDasharray="5 4" />
            <rect x={W - MR - 92} y={y(media) - 20} width="92" height="17" rx="4" fill="#1a1a2e" opacity="0.9" />
            <text x={W - MR - 4} y={y(media) - 7} textAnchor="end" fontSize="11" fontWeight="700" fill="rgba(255,255,255,0.75)">
              media {eur(media)} €
            </text>
          </g>
        )}

        {/* Etiquetas directas SOLO en el mínimo y el máximo — nunca en cada barra */}
        {[{ i: iMin, v: minV, c: ESCALA.muyBarato, t: 'más barata' },
          { i: iMax, v: maxV, c: ESCALA.muyCaro, t: 'más cara' }].map(({ i, v, c, t }) => {
          const cx = ML + i * paso + paso / 2;
          const anclaX = Math.min(Math.max(cx, ML + 46), W - MR - 46);
          return (
            <g key={t}>
              <text x={anclaX} y={y(v) - 16} textAnchor="middle" fontSize="15" fontWeight="900" fill={c} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {eur(v)} €
              </text>
              <text x={anclaX} y={y(v) - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.5)">
                {hh(i)} · {t}
              </text>
            </g>
          );
        })}

        {/* Hora actual */}
        {horaActual != null && horas[horaActual]?.omie != null && (
          <g>
            <line x1={ML + horaActual * paso + paso / 2} y1={MT} x2={ML + horaActual * paso + paso / 2} y2={MT + plotH}
              stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
            <circle cx={ML + horaActual * paso + paso / 2} cy={y(horas[horaActual].omie!)} r="4.5"
              fill="#1a1a2e" stroke="#ffffff" strokeWidth="2" />
          </g>
        )}

        {/* Eje de horas: cada 3 para que no se amontonen */}
        {horas.filter((_, i) => i % 3 === 0).map((h) => (
          <text key={h.hora} x={ML + h.hora * paso + paso / 2} y={H - 12} textAnchor="middle"
            fontSize="11" fill="rgba(255,255,255,0.45)" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {String(h.hora).padStart(2, '0')}
          </text>
        ))}
      </svg>

      {/* Detalle de la hora señalada */}
      <div className="h-14 mt-1">
        {item && item.omie != null ? (
          <div className="fv-fade-in rounded-xl border border-border/40 bg-card/90 px-3 py-2 inline-flex items-center gap-4">
            <div>
              <p className="text-[10px] uppercase font-bold text-muted">Hora</p>
              <p className="text-base font-black tabular-nums text-foreground">{hh(item.hora)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted">Mayorista</p>
              <p className="text-base font-black tabular-nums" style={{ color: tono(item.omie, media) }}>
                {eur(item.omie, 2)} €/MWh
              </p>
            </div>
            {item.pvpc != null && (
              <div>
                <p className="text-[10px] uppercase font-bold text-muted">PVPC</p>
                <p className="text-base font-black tabular-nums text-foreground/80">{eur(item.pvpc, 2)} €/MWh</p>
              </div>
            )}
            {media != null && (
              <div>
                <p className="text-[10px] uppercase font-bold text-muted">Sobre la media</p>
                <p className="text-base font-black tabular-nums" style={{ color: tono(item.omie, media) }}>
                  {item.omie >= media ? '+' : ''}{Math.round(((item.omie - media) / media) * 100)} %
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-muted pt-2">Pasa el ratón por una hora para ver su precio exacto.</p>
        )}
      </div>

      {/* Leyenda de la escala divergente */}
      <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted">
        <span className="font-bold uppercase">Frente a la media del día:</span>
        {[[ESCALA.muyBarato, '−20 %'], [ESCALA.barato, '−10 %'], [ESCALA.algoBarato, '−3 %'],
          [ESCALA.media, 'media'], [ESCALA.algoCaro, '+3 %'], [ESCALA.caro, '+10 %'], [ESCALA.muyCaro, '+20 %']]
          .map(([c, t]) => (
            <span key={t} className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm" style={{ background: c }} />{t}
            </span>
          ))}
      </div>
    </div>
  );
}
