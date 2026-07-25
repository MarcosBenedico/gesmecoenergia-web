'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Truck, Info, MapPin, ExternalLink } from 'lucide-react';
import {
  ProspectoGuardado, TIPO_PROSPECTO_LABEL, categoriaDeNaves, kmALaRuta,
} from '@/lib/prospeccion';
import { Card } from '../ui';

/**
 * OPORTUNIDADES APROBADAS QUE PILLAN DE CAMINO.
 *
 * Ya no se busca nada aquí. Las oportunidades se barren y se filtran en el
 * Mapa de oportunidades, y a esta pantalla solo llegan las que Marcos ha
 * marcado como "que vaya David". Así David no tiene que elegir entre
 * trescientos puntos: recibe la lista ya decidida.
 *
 * De esas, se destacan las que quedan cerca del recorrido de hoy, que son las
 * que puede encajar sin perder la mañana.
 */

interface Props {
  /** Por dónde pasa la ruta calculada. Vacío si aún no se ha calculado. */
  ruta: { lat: number; lon: number }[];
  /** Todas las aprobadas para visitar. */
  aprobadas: ProspectoGuardado[];
  /** Cuáles ya se han metido en la ruta, por id. */
  anadidas: Record<string, boolean>;
  cargando?: boolean;
}

/** Hasta dónde se considera que algo "pilla de camino". */
const KM_DE_CAMINO = 4;

export function Prospectos({ ruta, aprobadas, anadidas, cargando }: Props) {
  const { deCamino, lejos } = useMemo(() => {
    if (!ruta.length) return { deCamino: [], lejos: aprobadas };
    const conDistancia = aprobadas.map((p) => ({ p, km: kmALaRuta({ lat: p.lat, lon: p.lon }, ruta) }));
    return {
      deCamino: conDistancia.filter((x) => x.km <= KM_DE_CAMINO).sort((a, b) => a.km - b.km),
      lejos: conDistancia.filter((x) => x.km > KM_DE_CAMINO).map((x) => x.p),
    };
  }, [ruta, aprobadas]);

  const pendientes = aprobadas.filter((p) => !anadidas[p.id]).length;

  return (
    <Card className="!border-secondary/40">
      <div className="flex items-start gap-2 mb-1">
        <Truck className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-sm">Oportunidades para visitar</h3>
          <p className="text-[11px] text-muted">
            Las que están aprobadas en el <Link href="/gestor/luz/oportunidades" className="text-accent hover:underline">Mapa de oportunidades</Link>.
            Salen en el mapa de arriba con su emoji.
          </p>
        </div>
      </div>

      {cargando ? (
        <p className="text-[11px] text-muted mt-2">Cargando…</p>
      ) : aprobadas.length === 0 ? (
        <div className="mt-2 rounded-lg bg-card/60 p-2.5">
          <p className="text-[11px] text-muted">
            Todavía no hay ninguna aprobada. En el{' '}
            <Link href="/gestor/luz/oportunidades" className="text-accent hover:underline font-bold">Mapa de oportunidades</Link>{' '}
            se barre una zona y se marcan las que merezcan una visita con <b className="text-foreground">«Que vaya David»</b>.
          </p>
          <Link href="/gestor/luz/oportunidades"
            className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold text-secondary hover:underline">
            <ExternalLink className="w-3 h-3" /> Ir al mapa de oportunidades
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-3 rounded-lg bg-secondary/10 border border-secondary/25 p-2.5">
            <p className="text-sm font-black text-secondary">
              {aprobadas.length} aprobadas
              {pendientes > 0 && <span className="text-foreground font-bold"> · {pendientes} sin meter en la ruta</span>}
            </p>
            <p className="text-[10px] text-muted mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Púlsalas en el mapa para ver la foto aérea y añadirlas.
            </p>
          </div>

          {!ruta.length ? (
            <p className="text-[11px] text-muted mt-2">
              Calcula la ruta y te digo cuáles pillan de camino.
            </p>
          ) : (
            <>
              {deCamino.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-black text-emerald-400 mb-1.5">
                    DE CAMINO ({deCamino.length})
                  </p>
                  <ul className="space-y-1">
                    {deCamino.map(({ p, km }) => {
                      const cat = categoriaDeNaves(p.n_edificios);
                      return (
                        <li key={p.id}
                          className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
                            anadidas[p.id] ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-border/40 bg-card/60'
                          }`}>
                          <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px]"
                            style={{ background: `${cat.color}22`, border: `1.5px solid ${cat.color}` }}>
                            {p.n_edificios}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold truncate">
                              {p.nombre || TIPO_PROSPECTO_LABEL[p.tipo]}
                            </p>
                            <p className="text-[10px] text-muted">
                              {cat.etiqueta}
                              {p.municipio && ` · ${p.municipio}`}
                              {` · a ${km < 0.2 ? 'pie de ruta' : `${km.toFixed(1)} km`}`}
                            </p>
                          </div>
                          {anadidas[p.id] && <span className="text-[10px] font-bold text-emerald-400 shrink-0">✓ en ruta</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {deCamino.length === 0 && (
                <p className="text-[11px] text-muted mt-2 bg-card/60 rounded-lg p-2.5">
                  Ninguna de las aprobadas pilla cerca de esta ruta. Salen todas en el mapa de todas formas, por si
                  compensa dar un rodeo.
                </p>
              )}

              {lejos.length > 0 && (
                <p className="text-[10px] text-muted mt-2">
                  Otras {lejos.length} aprobadas quedan a más de {KM_DE_CAMINO} km de esta ruta.
                </p>
              )}
            </>
          )}

          <div className="flex items-start gap-1.5 text-[10px] text-muted mt-2.5 bg-card/60 rounded-lg p-2">
            <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
            <p>
              El número del pin son las <b className="text-foreground">naves</b>. Al añadir una se le crea la ficha de
              cliente, para que la visita quede registrada y no se pierda.
            </p>
          </div>
        </>
      )}
    </Card>
  );
}
