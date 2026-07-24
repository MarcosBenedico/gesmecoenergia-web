'use client';

import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, ExternalLink, AlertTriangle, Newspaper } from 'lucide-react';
import { GuardiaAdmin } from '@/components/guardia-modulo';
import { Card, btnSecundario } from '../ui';
import { GraficoPrecio, HoraMercado } from './grafico-precio';

/**
 * PRECIO DE LA LUZ Y CONTEXTO DE MERCADO — solo dirección.
 *
 * Dos cosas, en una pantalla:
 *  · Qué está pasando con el precio mayorista (OMIE) y el PVPC, hoy y mañana.
 *  · Qué se está publicando que suele mover ese precio (gas, geopolítica,
 *    regulación, nuclear...), ordenado por lo que más peso tiene.
 *
 * Sirve para tener criterio al recomendar fijo o indexado, y para saber cuándo
 * merece la pena mover a un cliente. No predice: enseña el dato y el contexto.
 */
export default function MercadoPage() {
  return (
    <GuardiaAdmin nombre="Precio de la luz">
      <Mercado />
    </GuardiaAdmin>
  );
}

interface Resumen { media: number | null; min: number | null; minHora: number | null; max: number | null; maxHora: number | null }
interface DatosMercado {
  fecha: string;
  horas: HoraMercado[];
  hoy: Resumen; ayer: Resumen; manana: Resumen;
  manana_disponible: boolean;
  variacion_pct: number | null;
  fuentes: { omie: boolean; pvpc: boolean };
  actualizado: string;
}
interface Noticia {
  titulo: string; enlace: string; fuente: string; fecha: string | null;
  temas: string[]; iconos: string[]; relevancia: number;
  probabilidad?: number;
  direccion?: 'sube' | 'baja' | 'neutro';
  plazo?: 'inmediato' | 'corto' | 'medio' | 'largo';
  motivo?: string;
}

/** Efecto sobre el precio: mismo lenguaje visual que el gráfico (cian barato / rosa caro). */
const DIRECCION_UI = {
  sube: { texto: 'Empuja el precio ARRIBA', color: '#fb7185', fondo: 'bg-rose-500/10 border-rose-500/30', flecha: '▲' },
  baja: { texto: 'Empuja el precio ABAJO', color: '#22d3ee', fondo: 'bg-cyan-500/10 border-cyan-500/30', flecha: '▼' },
  neutro: { texto: 'Sin efecto claro', color: '#94a3b8', fondo: 'bg-slate-500/10 border-slate-500/25', flecha: '■' },
} as const;

const PLAZO_LABEL = { inmediato: 'días', corto: 'semanas', medio: 'meses', largo: 'años' } as const;

/** Tres tramos de probabilidad: lo que hay que leer, lo que conviene, y el ruido. */
function tramoProb(p: number) {
  if (p >= 60) return { etiqueta: 'Probable', clase: 'text-foreground', barra: 'bg-foreground/80' };
  if (p >= 30) return { etiqueta: 'Posible', clase: 'text-muted', barra: 'bg-muted/60' };
  return { etiqueta: 'Poco probable', clase: 'text-muted/60', barra: 'bg-muted/30' };
}

const eur = (n: number | null) => (n == null ? '—' : `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €`);
const hh = (h: number | null) => (h == null ? '' : `${String(h).padStart(2, '0')}:00`);

function Mercado() {
  const [datos, setDatos] = useState<DatosMercado | null>(null);
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const [m, n] = await Promise.allSettled([
        fetch('/api/mercado').then((r) => r.json()),
        fetch('/api/mercado/noticias').then((r) => r.json()),
      ]);
      if (m.status === 'fulfilled' && m.value?.ok) setDatos(m.value);
      else setError('No se pudieron cargar los precios de mercado.');
      if (n.status === 'fulfilled' && n.value?.ok) setNoticias(n.value.noticias || []);
    } catch {
      setError('Error de conexión.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);


  const sube = (datos?.variacion_pct ?? 0) > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent" /> Precio de la luz y mercado
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Mercado mayorista (OMIE) y tarifa regulada (PVPC), con lo que se publica que puede moverlos. Solo dirección.
          </p>
        </div>
        <button onClick={cargar} className={btnSecundario} disabled={cargando}>
          <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">{error}</p>}
      {cargando && !datos && <p className="text-sm text-muted text-center py-10">Consultando OMIE y REE…</p>}

      {datos && (
        <>
          {/* Cifras del día */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="!p-4 text-center">
              <p className="text-2xl font-black tabular-nums text-foreground">{eur(datos.hoy.media)}</p>
              <p className="text-[10px] uppercase font-bold text-muted">Media hoy · €/MWh</p>
              {datos.variacion_pct != null && (
                <p className={`text-[11px] font-black mt-1 inline-flex items-center gap-0.5 ${sube ? 'text-red-400' : 'text-emerald-400'}`}>
                  {sube ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {sube ? '+' : ''}{datos.variacion_pct} % vs ayer
                </p>
              )}
            </Card>
            <Card className="!p-4 text-center">
              <p className="text-2xl font-black tabular-nums text-emerald-400">{eur(datos.hoy.min)}</p>
              <p className="text-[10px] uppercase font-bold text-muted">Hora más barata</p>
              <p className="text-[11px] font-bold text-muted mt-1">{hh(datos.hoy.minHora)}</p>
            </Card>
            <Card className="!p-4 text-center">
              <p className="text-2xl font-black tabular-nums text-red-400">{eur(datos.hoy.max)}</p>
              <p className="text-[10px] uppercase font-bold text-muted">Hora más cara</p>
              <p className="text-[11px] font-bold text-muted mt-1">{hh(datos.hoy.maxHora)}</p>
            </Card>
            <Card className="!p-4 text-center">
              {datos.manana_disponible ? (
                <>
                  <p className="text-2xl font-black tabular-nums text-secondary">{eur(datos.manana.media)}</p>
                  <p className="text-[10px] uppercase font-bold text-muted">Media mañana</p>
                  <p className="text-[11px] font-bold text-muted mt-1">ya subastada</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-black text-muted/40">—</p>
                  <p className="text-[10px] uppercase font-bold text-muted">Media mañana</p>
                  <p className="text-[10px] text-muted/70 mt-1 leading-tight">Se publica sobre las 14 h</p>
                </>
              )}
            </Card>
          </div>

          {/* Curva horaria */}
          <Card className="space-y-2">
            <h3 className="font-bold text-sm">
              Precio hora a hora · {new Date(datos.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
            <GraficoPrecio
              horas={datos.horas}
              media={datos.hoy.media}
              horaActual={datos.fecha === new Date().toISOString().slice(0, 10) ? new Date().getHours() : null}
            />
            <p className="text-[10px] text-muted">
              Precio mayorista de OMIE, que es lo que compran las comercializadoras. Al cliente hay que sumarle peajes,
              cargos, margen e impuestos: no es lo que ve en su factura, pero es lo que marca hacia dónde van los precios.
            </p>
            {(!datos.fuentes.omie || !datos.fuentes.pvpc) && (
              <p className="text-[11px] text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                {!datos.fuentes.omie ? 'OMIE no respondió: puede que aún no haya publicado el día.' : 'REE no respondió: falta el PVPC.'}
              </p>
            )}
          </Card>

          {/* Contexto: qué se está publicando */}
          <Card className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-secondary" /> Lo que puede mover el precio
              </h3>
              <p className="text-[10px] text-muted">ordenado por peso sobre el mercado</p>
            </div>
            {noticias.length === 0 && (
              <p className="text-xs text-muted text-center py-4">No se han podido cargar las noticias ahora mismo.</p>
            )}
            <div className="space-y-2">
              {noticias.map((n) => {
                const dir = n.direccion ? DIRECCION_UI[n.direccion] : null;
                const prob = n.probabilidad ?? null;
                const tramo = prob != null ? tramoProb(prob) : null;
                return (
                  <a
                    key={n.enlace}
                    href={n.enlace}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`fv-fade-in block rounded-xl border p-3 transition hover:bg-card ${
                      dir ? dir.fondo : 'border-border/25 bg-card/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Probabilidad: el dato que ordena la lista, en grande */}
                      {prob != null ? (
                        <div className="shrink-0 w-14 text-center">
                          <p className="text-xl font-black tabular-nums leading-none" style={{ color: dir?.color }}>
                            {prob}<span className="text-[11px]">%</span>
                          </p>
                          <div className="h-1 w-full rounded-full bg-background/60 overflow-hidden mt-1">
                            <div className={`h-full rounded-full ${tramo!.barra}`} style={{ width: `${prob}%` }} />
                          </div>
                          <p className={`text-[8px] uppercase font-bold mt-0.5 ${tramo!.clase}`}>{tramo!.etiqueta}</p>
                        </div>
                      ) : (
                        <span className="text-base leading-none shrink-0">{n.iconos[0] || '📰'}</span>
                      )}

                      <div className="min-w-0 flex-1">
                        {dir && (
                          <p className="text-[11px] font-black uppercase tracking-wide mb-0.5" style={{ color: dir.color }}>
                            {dir.flecha} {dir.texto}
                            {n.plazo && <span className="text-muted font-bold"> · en {PLAZO_LABEL[n.plazo]}</span>}
                          </p>
                        )}
                        <p className="text-[13px] font-semibold text-foreground leading-snug">{n.titulo}</p>
                        {n.motivo && (
                          <p className="text-[11px] text-muted leading-snug mt-1">{n.motivo}</p>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                          {n.temas.map((t) => (
                            <span key={t} className="px-1.5 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/25 text-[9px] font-bold uppercase">
                              {t}
                            </span>
                          ))}
                          <span className="text-[10px] text-muted/70">
                            {n.fuente}
                            {n.fecha && ` · ${new Date(n.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`}
                          </span>
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-muted/40 shrink-0 mt-0.5" />
                    </div>
                  </a>
                );
              })}
            </div>
          </Card>

          <Card className="!p-3 border-border/30">
            <p className="text-[11px] text-muted leading-relaxed">
              <b className="text-foreground">Sobre los futuros (OMIP).</b> No están aquí porque OMIP no publica sus curvas
              de forma gratuita: son producto de suscripción. Prefiero no enseñarte una estimación inventada en una pantalla
              que usas para decidir. Si te interesa de verdad tener la curva de futuros, hay que contratar el dato — dímelo
              y lo conectamos.
            </p>
            <p className="text-[10px] text-muted/60 mt-2">
              Fuentes: OMIE (mercado diario) y Red Eléctrica (PVPC), ambas públicas. Se refrescan cada media hora.
              Última consulta: {new Date(datos.actualizado).toLocaleTimeString('es-ES')}.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
