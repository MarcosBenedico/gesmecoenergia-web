'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Target, Rocket, Loader, ChevronDown } from 'lucide-react';
import {
  ProspectoGuardado, TIPO_PROSPECTO_LABEL, categoriaDeNaves,
} from '@/lib/prospeccion';
import { zonaDeParada } from '@/lib/zonas';
import { urlOrtofoto } from '../rutas/foto-aerea';
import { Card } from '../ui';
import { promoverACliente, nombreSugerido } from './promover';

/**
 * LISTA DE OBJETIVOS — dónde quiero que vaya David.
 *
 * Es la otra cara del mapa. El mapa sirve para descubrir y decidir; esta lista
 * sirve para trabajar lo ya decidido, y por eso va agrupada POR ZONA: las
 * visitas se organizan por salidas, y lo que interesa saber es "en Tamarite
 * tengo seis" para montar una mañana entera por allí.
 *
 * Dentro de cada zona van ordenados por tamaño, que es lo que manda cuando hay
 * que elegir por dónde empezar.
 */

interface Props {
  objetivos: ProspectoGuardado[];
  onCambio: () => void;
}

export function Objetivos({ objetivos, onCambio }: Props) {
  const [promoviendo, setPromoviendo] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [zonasCerradas, setZonasCerradas] = useState<Record<string, boolean>>({});

  /** Agrupados por zona de actuación, que es como se planifican las salidas. */
  const porZona = useMemo(() => {
    const grupos = new Map<string, { nombre: string; color: string; lista: ProspectoGuardado[] }>();
    for (const p of objetivos) {
      const z = zonaDeParada(null, { lat: p.lat, lon: p.lon });
      const clave = z?.id || 'sin-zona';
      if (!grupos.has(clave)) {
        grupos.set(clave, {
          nombre: z?.nombre || 'Fuera de las zonas habituales',
          color: z?.color || '#64748b',
          lista: [],
        });
      }
      grupos.get(clave)!.lista.push(p);
    }
    // Cada zona por tamaño; las zonas, por cuántos objetivos tienen
    for (const g of grupos.values()) {
      g.lista.sort((a, b) => b.n_edificios - a.n_edificios || (b.consumo_estimado_kwh || 0) - (a.consumo_estimado_kwh || 0));
    }
    return Array.from(grupos.entries())
      .map(([id, g]) => ({ id, ...g }))
      .sort((a, b) => b.lista.length - a.lista.length);
  }, [objetivos]);

  const porTipo = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of objetivos) m.set(p.tipo, (m.get(p.tipo) || 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [objetivos]);

  async function pasar(p: ProspectoGuardado) {
    setPromoviendo(p.id); setError('');
    const r = await promoverACliente(p, { responsable: p.responsable || 'David' });
    setPromoviendo(null);
    if (r.error) setError(r.error);
    if (r.cliente) onCambio();
  }

  if (objetivos.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">
          Todavía no has marcado ningún objetivo. En el mapa, pulsa una oportunidad y dale a{' '}
          <b className="text-foreground">«Que vaya David»</b>.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Resumen por tipo: de un vistazo, de qué van los objetivos */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-emerald-400 shrink-0" />
          <h2 className="font-bold text-sm">{objetivos.length} objetivos marcados</h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {porTipo.map(([tipo, n]) => (
            <span key={tipo} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border/40 bg-card/70 text-[11px] font-bold">
              {TIPO_PROSPECTO_LABEL[tipo as keyof typeof TIPO_PROSPECTO_LABEL]} <span className="text-muted">{n}</span>
            </span>
          ))}
        </div>
        <p className="text-[10px] text-muted mt-2">
          Van agrupados por zona: una salida se organiza por comarca, no por lista alfabética.
        </p>
      </Card>

      {error && <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg p-2.5">⚠️ {error}</p>}

      {porZona.map((zona) => {
        const cerrada = zonasCerradas[zona.id];
        return (
          <Card key={zona.id}>
            <button
              onClick={() => setZonasCerradas((z) => ({ ...z, [zona.id]: !cerrada }))}
              className="w-full flex items-center justify-between gap-2 text-left"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: zona.color }} />
                <span className="font-bold text-sm truncate" style={{ color: zona.color }}>{zona.nombre}</span>
                <span className="text-[11px] font-black text-muted shrink-0">{zona.lista.length}</span>
              </span>
              <ChevronDown className={`w-4 h-4 text-muted shrink-0 transition-transform ${cerrada ? '-rotate-90' : ''}`} />
            </button>

            {!cerrada && (
              <ul className="grid sm:grid-cols-2 gap-2 mt-3">
                {zona.lista.map((p) => {
                  const cat = categoriaDeNaves(p.n_edificios);
                  return (
                    <li key={p.id} className="rounded-xl border border-border/40 bg-card/50 overflow-hidden">
                      <Link href={`/gestor/luz/oportunidades/${p.id}`} className="block group">
                        {/* eslint-disable-next-line @next/next/no-img-element -- servicio WMS externo */}
                        <img src={urlOrtofoto(p.lat, p.lon, 300, 400, 200)} alt=""
                          className="w-full h-24 object-cover bg-card" loading="lazy" />
                        <div className="p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-bold text-xs truncate group-hover:text-accent transition">
                              {p.nombre || nombreSugerido(p)}
                            </p>
                            <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-black text-white"
                              style={{ background: cat.color }}>
                              {p.n_edificios} {p.n_edificios === 1 ? 'nave' : 'naves'}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted mt-0.5">
                            {TIPO_PROSPECTO_LABEL[p.tipo]}
                            {p.municipio && ` · ${p.municipio}`}
                          </p>
                          <p className="text-[10px] text-muted">
                            {p.m2_construidos.toLocaleString('es-ES')} m²
                            {p.consumo_estimado_kwh ? <span className="text-emerald-400 font-bold"> · ~{Math.round(p.consumo_estimado_kwh / 1000)} MWh/año</span> : null}
                          </p>
                          {p.ya_tiene_placas && <p className="text-[10px] text-amber-400">☀️ Ya tiene placas</p>}
                        </div>
                      </Link>
                      <div className="px-2.5 pb-2.5">
                        <button
                          onClick={() => pasar(p)}
                          disabled={promoviendo === p.id}
                          title="Le crea la ficha, la oportunidad en el pipeline y la visita en la agenda"
                          className="w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-emerald-500/45 bg-emerald-500/15 text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/25 transition disabled:opacity-50"
                        >
                          {promoviendo === p.id
                            ? <><Loader className="w-3 h-3 animate-spin" /> Creando…</>
                            : <><Rocket className="w-3 h-3" /> Pasar al sistema</>}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        );
      })}

      <p className="text-[10px] text-muted">
        «Pasar al sistema» crea la ficha del cliente, abre la oportunidad en el Pipeline y le pone a David la visita en
        la Agenda. Las tres cosas: sin la tarea, la ficha se queda ahí y no va nadie.
      </p>
    </div>
  );
}
