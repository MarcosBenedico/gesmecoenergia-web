'use client';

import { useMemo, useState } from 'react';
import {
  Navigation, MapPin, Clock, Route as RouteIcon, Plus, Sparkles, AlertTriangle, Check,
} from 'lucide-react';
import { LuzCliente, LuzCups } from '@/lib/luz';
import { ProspectoGuardado, TIPO_PROSPECTO_LABEL } from '@/lib/prospeccion';
import { ZONAS, zonaDeParada } from '@/lib/zonas';
import { planDelDia, esDiaDeCalle, letraCiclo } from '@/lib/plan-rutas';
import {
  ordenarPorCercania, cabeEnLaManana, oportunidadesDePaso, enlaceRutaOptima,
  MAX_PARADAS, type Parada,
} from '@/lib/ruta-optima';
import { municipioDe, coordsDe } from '@/lib/agenda-calle';
import { Card, btnPrimario, btnSecundario } from '../ui';

/**
 * MONTAR LA RUTA DE HOY, DESDE MI DÍA.
 *
 * David marca los clientes que quiere gestionar y esto hace dos cosas: los ordena
 * por cercanía y **le añade lo que cae de paso** del mapa de oportunidades. Si va
 * a Tamarite y a trescientos metros de la carretera hay una granja de cuatro
 * naves sin tocar, eso es una puerta que sale gratis: el desplazamiento ya está
 * pagado.
 *
 * Arriba, la zona que toca hoy según el plan de tres semanas. Quita la decisión
 * de en medio, que es lo que se comía las mañanas: los días con ruta preparada
 * fueron 9 visitas de media; los días de decidir sobre la marcha, 0,7.
 */

/** Lo que queda de mañana útil en minutos, de 8:15 a 14:00. */
const MINUTOS_MANANA = 345;

interface Props {
  clientes: LuzCliente[];
  cups: LuzCups[];
  prospectos: ProspectoGuardado[];
}

export function MontarRuta({ clientes, cups, prospectos }: Props) {
  const hoy = useMemo(() => new Date(), []);
  const plan = useMemo(() => planDelDia(hoy), [hoy]);
  const zonaHoy = ZONAS.find((z) => z.id === plan.zonaId) || null;

  const [elegidos, setElegidos] = useState<string[]>([]);
  const [extras, setExtras] = useState<string[]>([]);
  const [abierto, setAbierto] = useState(false);

  /** Cada cliente con su sitio y su zona, listo para ordenar. */
  const candidatos = useMemo(() => {
    const dirDe = new Map<string, string | null>();
    for (const s of cups) {
      if (s.direccion_suministro && !dirDe.has(s.cliente_id)) dirDe.set(s.cliente_id, s.direccion_suministro);
    }
    return clientes
      .map((c) => {
        const dirSum = dirDe.get(c.id) || null;
        const coords = coordsDe(c.direccion_fiscal, dirSum);
        const dir = c.direccion_fiscal || dirSum;
        return {
          clave: `cli:${c.id}`,
          id: c.id,
          nombre: c.nombre,
          coords,
          direccion: dir,
          municipio: municipioDe(c.direccion_fiscal, dirSum),
          zona: zonaDeParada(dir, coords),
        };
      })
      .filter((c) => c.coords || c.direccion);
  }, [clientes, cups]);

  /** Los de la zona de hoy primero: es lo que el plan dice que toca. */
  const ordenados = useMemo(() => {
    const deHoy = (z: { id: string } | null) => !!plan.zonaId && z?.id === plan.zonaId;
    return [...candidatos].sort((a, b) => {
      const da = deHoy(a.zona) ? 0 : 1;
      const db = deHoy(b.zona) ? 0 : 1;
      return da - db || (a.municipio || 'zz').localeCompare(b.municipio || 'zz');
    });
  }, [candidatos, plan.zonaId]);

  const paradasCliente: Parada[] = useMemo(
    () => ordenados.filter((c) => elegidos.includes(c.clave))
      .map((c) => ({ clave: c.clave, nombre: c.nombre, coords: c.coords, direccion: c.direccion })),
    [ordenados, elegidos]
  );

  /** Oportunidades que caen sobre el recorrido de lo ya elegido. */
  const dePaso = useMemo(
    () => (paradasCliente.length
      ? oportunidadesDePaso(paradasCliente, prospectos.filter((p) => Number.isFinite(p.lat)))
      : []),
    [paradasCliente, prospectos]
  );

  const paradasExtra: Parada[] = useMemo(
    () => dePaso.filter((o) => extras.includes(o.prospecto.id)).map((o) => ({
      clave: `pro:${o.prospecto.id}`,
      nombre: o.prospecto.nombre || 'Sitio del mapa',
      coords: { lat: o.prospecto.lat, lon: o.prospecto.lon },
    })),
    [dePaso, extras]
  );

  const todas = useMemo(
    () => ordenarPorCercania([...paradasCliente, ...paradasExtra]),
    [paradasCliente, paradasExtra]
  );

  const encaje = useMemo(() => cabeEnLaManana(todas, MINUTOS_MANANA), [todas]);
  const url = useMemo(() => enlaceRutaOptima(todas), [todas]);

  const alternar = (clave: string) =>
    setElegidos((p) => (p.includes(clave) ? p.filter((x) => x !== clave) : [...p, clave]));

  const marcarZonaDeHoy = () => {
    const claves = ordenados
      .filter((c) => plan.zonaId && c.zona?.id === plan.zonaId)
      .slice(0, MAX_PARADAS)
      .map((c) => c.clave);
    setElegidos((p) => (claves.every((c) => p.includes(c)) ? p.filter((c) => !claves.includes(c)) : [...new Set([...p, ...claves])]));
  };

  const deLaZonaDeHoy = ordenados.filter((c) => plan.zonaId && c.zona?.id === plan.zonaId).length;

  return (
    <Card className="!p-0 overflow-hidden">
      {/* ── Lo que toca hoy según el plan ── */}
      <div className="px-4 py-3 border-b border-border/40" style={zonaHoy ? { borderLeft: `3px solid ${zonaHoy.color}` } : undefined}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <RouteIcon className="w-4 h-4 text-accent shrink-0" />
          <p className="font-black text-foreground">{plan.que}</p>
          <span className="text-[11px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-card/80 text-muted border border-border/40">
            {plan.nombre} · semana {letraCiclo(hoy)}
          </span>
          {esDiaDeCalle(hoy) && (
            <span className="text-[11px] text-muted ml-auto tabular-nums">
              {plan.franja} · objetivo {plan.objetivos.puertas} puertas
            </span>
          )}
        </div>
        <p className="text-xs text-muted mt-1">{plan.porque}</p>
        {esDiaDeCalle(hoy) && plan.objetivos.cubiertas > 0 && (
          <p className="text-[11px] text-amber-400 mt-1">
            Hoy además: {plan.objetivos.facturas} facturas y {plan.objetivos.cubiertas} cubiertas para Óscar.
          </p>
        )}
      </div>

      {/* ── Cabecera del montador ── */}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full px-4 py-2.5 flex items-center gap-2.5 text-left hover:bg-card/40 transition"
      >
        <Navigation className="w-4 h-4 text-accent shrink-0" />
        <span className="font-bold text-foreground text-sm">Montar la ruta</span>
        <span className="text-[11px] text-muted">
          elige clientes y se le añade lo que caiga de paso
        </span>
        <span className="ml-auto text-xs font-black tabular-nums text-foreground">
          {todas.length > 0 ? `${todas.length} paradas` : abierto ? '' : 'abrir'}
        </span>
      </button>

      {abierto && (
        <div className="border-t border-border/40">
          {/* Resumen de la ruta en marcha */}
          {todas.length > 0 && (
            <div className={`px-4 py-3 space-y-2 ${encaje.cabe ? 'bg-emerald-500/5' : 'bg-amber-500/5'}`}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="flex items-center gap-1.5 text-foreground font-bold">
                  <MapPin className="w-3.5 h-3.5 text-accent" /> {todas.length} paradas
                </span>
                <span className="flex items-center gap-1.5 text-muted tabular-nums">
                  <RouteIcon className="w-3.5 h-3.5" /> ~{encaje.km} km
                </span>
                <span className="flex items-center gap-1.5 text-muted tabular-nums">
                  <Clock className="w-3.5 h-3.5" /> ~{Math.floor(encaje.minutos / 60)} h {encaje.minutos % 60} min
                </span>
                {url && (
                  <a href={url} target="_blank" rel="noopener noreferrer" className={`${btnPrimario} ml-auto`}>
                    <Navigation className="w-4 h-4" /> Abrir en Maps
                  </a>
                )}
              </div>
              <p className={`text-[11px] ${encaje.cabe ? 'text-emerald-400' : 'text-amber-400'}`}>
                {encaje.cabe
                  ? `Cabe en la mañana y sobran unos ${encaje.sobran} min de margen.`
                  : `Se pasa unos ${-encaje.sobran} min de la mañana. Quita una parada o déjala para el próximo día de esta zona.`}
              </p>
              <p className="text-[11px] text-muted">
                El orden de la lista es por cercanía; en Maps va con <b>optimizar</b> puesto, que conoce las carreteras
                mejor que nosotros. Vuelve a la oficina al final.
              </p>
              <ol className="text-[11px] text-muted space-y-0.5 pt-1">
                {todas.map((p, n) => (
                  <li key={p.clave} className="flex gap-2">
                    <span className="tabular-nums text-foreground/60 w-4">{n + 1}.</span>
                    <span className={p.clave.startsWith('pro:') ? 'text-amber-400' : ''}>
                      {p.nombre}{p.clave.startsWith('pro:') && ' · del mapa'}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Oportunidades de paso */}
          {dePaso.length > 0 && (
            <div className="px-4 py-3 border-t border-border/40 bg-amber-500/5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-sm font-bold text-foreground">De paso, sin desviarte</p>
                <span className="text-[11px] text-muted">{dePaso.length} del mapa cerca de esta ruta</span>
              </div>
              <div className="space-y-1">
                {dePaso.map(({ prospecto: p, km_desvio }) => {
                  const puesto = extras.includes(p.id);
                  return (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <span className="shrink-0">{(TIPO_PROSPECTO_LABEL[p.tipo] || '📍').split(' ')[0]}</span>
                      <span className="font-semibold text-foreground truncate">
                        {p.nombre || 'Sitio sin nombre'}
                      </span>
                      <span className="text-muted shrink-0 tabular-nums">
                        {p.n_edificios} naves · {km_desvio < 0.4 ? 'de paso' : `+${km_desvio} km`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setExtras((e) => (puesto ? e.filter((x) => x !== p.id) : [...e, p.id]))}
                        className={`${puesto ? btnPrimario : btnSecundario} !py-0.5 !px-1.5 !text-[11px] ml-auto shrink-0`}
                      >
                        {puesto ? <><Check className="w-3 h-3" /> puesta</> : <><Plus className="w-3 h-3" /> añadir</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Elegir clientes */}
          <div className="px-4 py-2.5 border-t border-border/40 flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-muted">Clientes</p>
            {deLaZonaDeHoy > 0 && (
              <button type="button" onClick={marcarZonaDeHoy} className={`${btnSecundario} !py-1 !px-2 !text-[11px]`}>
                <MapPin className="w-3.5 h-3.5" /> Los {Math.min(deLaZonaDeHoy, MAX_PARADAS)} de {zonaHoy?.nombre}
              </button>
            )}
            {elegidos.length > 0 && (
              <button type="button" onClick={() => { setElegidos([]); setExtras([]); }}
                className={`${btnSecundario} !py-1 !px-2 !text-[11px]`}>
                Empezar de cero
              </button>
            )}
            {candidatos.length === 0 && (
              <span className="text-[11px] text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Ningún cliente tiene dirección: sin eso no hay ruta posible.
              </span>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-border/20">
            {ordenados.map((c) => {
              const esDeHoy = !!plan.zonaId && c.zona?.id === plan.zonaId;
              const marcado = elegidos.includes(c.clave);
              return (
                <button
                  key={c.clave}
                  type="button"
                  onClick={() => alternar(c.clave)}
                  className={`w-full px-4 py-2 flex items-center gap-3 text-left transition ${marcado ? 'bg-accent/10' : 'hover:bg-card/40'}`}
                >
                  <span className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center ${
                    marcado ? 'bg-accent border-accent text-white' : 'border-border/60'
                  }`}>
                    {marcado && <Check className="w-3.5 h-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground truncate">{c.nombre}</span>
                    <span className="block text-[11px] text-muted truncate">
                      {c.municipio || 'sin municipio'}
                      {!c.coords && ' · solo dirección'}
                    </span>
                  </span>
                  {esDeHoy && (
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: `${zonaHoy?.color}22`, color: zonaHoy?.color }}>
                      hoy toca
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
