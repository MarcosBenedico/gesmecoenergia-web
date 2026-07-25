'use client';

import { useState } from 'react';
import { Radar, Loader, ExternalLink, Plus, Check, Info, ChevronDown } from 'lucide-react';
import { Prospecto, TIPO_PROSPECTO_LABEL, nivelInteres } from '@/lib/prospeccion';
import { Card, guardarLuz, btnSecundario } from '../ui';

/**
 * APROVECHAR EL VIAJE — qué hay alrededor de la ruta que merezca una parada.
 *
 * Sale de OpenStreetMap, que es un mapa hecho por voluntarios: enseña señales
 * físicas (que sea una granja, cuánto tejado tiene), nunca el consumo, que no
 * está en ningún sitio público. Eso se dice en la propia pantalla, porque si
 * David se cree que el número es una factura, la visita empieza torcida.
 */

/** Punto de partida del tipo de cliente. Nicola lo afina cuando confirme los datos. */
const TIPO_CLIENTE_SEGUN_PROSPECTO: Record<Prospecto['tipo'], string> = {
  granja: 'pyme',
  nave: 'industria',
  industrial: 'industria',
  invernadero: 'pyme',
  riego: 'pyme',
  silo: 'pyme',
  comercio: 'pyme',
  edificio_grande: 'pyme',
};

const TONO = {
  alto: { chip: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40', barra: '#10b981' },
  medio: { chip: 'bg-amber-500/15 text-amber-300 border-amber-500/40', barra: '#f59e0b' },
  bajo: { chip: 'bg-slate-500/15 text-slate-400 border-slate-500/40', barra: '#64748b' },
};

interface Props {
  /** Puntos ya geocodificados de la ruta calculada. */
  ruta: { lat: number; lon: number }[];
  /** Clientes ya en cartera con coordenadas, para no proponer lo que ya es nuestro. */
  yaClientes: { lat: number; lon: number }[];
  onClienteCreado: () => void;
}

export function Prospectos({ ruta, yaClientes, onClienteCreado }: Props) {
  const [radio, setRadio] = useState(2);
  const [buscando, setBuscando] = useState(false);
  const [lista, setLista] = useState<Prospecto[] | null>(null);
  const [error, setError] = useState('');
  const [creados, setCreados] = useState<Record<string, string>>({}); // id OSM → id de cliente
  const [abierto, setAbierto] = useState<string | null>(null);

  async function buscar() {
    setBuscando(true); setError(''); setLista(null);
    try {
      const res = await fetch('/api/luz/prospectar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruta, radio_km: radio, excluir: yaClientes }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'No se pudo buscar.'); return; }
      setLista(json.prospectos || []);
    } catch {
      setError('No se pudo conectar con el buscador.');
    } finally {
      setBuscando(false);
    }
  }

  /** Crea la ficha del cliente con lo que sabemos, para no perder el hallazgo. */
  async function crearFicha(p: Prospecto) {
    const sugerido = p.nombre || `${TIPO_PROSPECTO_LABEL[p.tipo].replace(/^\S+\s/, '')} sin identificar${p.municipio ? ` · ${p.municipio}` : ''}`;
    const nombre = window.prompt(
      'Nombre para la ficha (se puede cambiar luego, y David lo confirma al pasar por allí):',
      sugerido
    );
    if (!nombre?.trim()) return;

    const observaciones = [
      'Detectado al preparar una ruta (OpenStreetMap). Sin verificar sobre el terreno.',
      ...p.motivos,
    ].join('\n· ');

    const err = await guardarLuz('clientes', 'POST', {
      nombre: nombre.trim(),
      tipo_cliente: TIPO_CLIENTE_SEGUN_PROSPECTO[p.tipo],
      // Las coordenadas valen como ubicación: el planificador y Maps las entienden
      direccion_fiscal: `${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`,
      via_entrada: 'captacion',
      estado_comercial: 'detectado',
      prioridad: p.puntuacion >= 65 ? 'B' : 'C',
      responsable: 'David',
      potencial_comercial: !p.kwp_estimado
        ? ''
        : p.kwp_fiable
          ? `Tejado para ~${p.kwp_estimado} kWp orientativos (medido sobre el mapa, sin comprobar).`
          : `Recinto de ~${p.area_m2.toLocaleString('es-ES')} m². Tejado por medir en la visita.`,
      observaciones: `· ${observaciones}`,
    });
    if (err) { setError(err); return; }
    setCreados((c) => ({ ...c, [p.id]: '1' }));
    onClienteCreado();
  }

  const hayRuta = ruta.length > 0;

  return (
    <Card className="!border-secondary/40">
      <div className="flex items-start gap-2 mb-1">
        <Radar className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-sm">Aprovechar el viaje</h3>
          <p className="text-[11px] text-muted">
            Granjas, naves y negocios que quedan de camino y todavía no están en la cartera.
          </p>
        </div>
      </div>

      {!hayRuta ? (
        <p className="text-[11px] text-muted bg-card/60 rounded-lg p-2.5 mt-2">
          Calcula primero la ruta: hace falta saber por dónde se pasa.
        </p>
      ) : (
        <>
          <div className="flex items-end gap-2 mt-3">
            <label className="text-[11px] font-bold text-muted">
              Cuánto me desvío
              <select
                value={radio}
                onChange={(e) => setRadio(Number(e.target.value))}
                className="block mt-1 rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 text-xs font-semibold"
              >
                <option value={1}>Hasta 1 km</option>
                <option value={2}>Hasta 2 km</option>
                <option value={3}>Hasta 3 km</option>
                <option value={5}>Hasta 5 km</option>
              </select>
            </label>
            <button onClick={buscar} disabled={buscando} className={`${btnSecundario} flex-1 justify-center`}>
              {buscando ? <><Loader className="w-4 h-4 animate-spin" /> Mirando la zona…</> : <><Radar className="w-4 h-4" /> Buscar por la zona</>}
            </button>
          </div>

          {buscando && (
            <p className="text-[10px] text-muted mt-2">Puede tardar unos segundos: se consulta el mapa público.</p>
          )}
          {error && <p className="text-[11px] text-red-400 mt-2 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{error}</p>}

          {lista && lista.length === 0 && (
            <p className="text-[11px] text-muted mt-3 bg-card/60 rounded-lg p-2.5">
              No sale nada por aquí. Puede ser que no haya, o que en esta zona el mapa esté poco detallado —
              prueba a ampliar el desvío.
            </p>
          )}

          {lista && lista.length > 0 && (
            <>
              <div className="flex items-start gap-1.5 text-[10px] text-muted mt-3 mb-2 bg-card/60 rounded-lg p-2">
                <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
                <p>
                  <b className="text-foreground">Esto no es el consumo de nadie.</b> El consumo no es público.
                  Lo que se ve son pistas del mapa: qué tipo de sitio es y cuánto tejado tiene.
                  Sirve para decidir a quién parar a ver, no para ofertar.
                </p>
              </div>

              <p className="text-[11px] font-bold text-muted mb-2">{lista.length} sitios de camino</p>

              <ul className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
                {lista.map((p) => {
                  const nivel = nivelInteres(p.puntuacion);
                  const t = TONO[nivel.tono];
                  const yaCreado = !!creados[p.id];
                  const desplegado = abierto === p.id;
                  return (
                    <li key={p.id} className="rounded-xl border border-border/40 bg-card/50 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-xs truncate">
                            {p.nombre || <span className="text-muted italic">Sin nombre en el mapa</span>}
                          </p>
                          <p className="text-[10px] text-muted">
                            {TIPO_PROSPECTO_LABEL[p.tipo]}
                            {p.municipio && ` · ${p.municipio}`}
                            {` · a ${p.km_desvio < 0.1 ? 'pie de ruta' : `${p.km_desvio.toFixed(1)} km`}`}
                          </p>
                        </div>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded-full border text-[9px] font-black whitespace-nowrap ${t.chip}`}>
                          {nivel.texto}
                        </span>
                      </div>

                      {/* Barra: se compara de un vistazo sin leer el número */}
                      <div className="h-1 rounded-full bg-border/40 mt-2 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${p.puntuacion}%`, background: t.barra }} />
                      </div>

                      {/* El kWp solo se da cuando sale de tejados dibujados en el mapa.
                          Si es una parcela, se dice el tamaño y que hay que ir a verlo. */}
                      {p.kwp_estimado > 0 && (
                        p.kwp_fiable ? (
                          <p className="text-[10px] text-amber-300 mt-1.5">
                            ☀️ Tejado para ~<b>{p.kwp_estimado} kWp</b> <span className="text-muted">(orientativo, desde el mapa)</span>
                          </p>
                        ) : (
                          <p className="text-[10px] text-amber-300/80 mt-1.5">
                            ☀️ Recinto de ~<b>{p.area_m2.toLocaleString('es-ES')} m²</b>{' '}
                            <span className="text-muted">· los tejados no están dibujados: hay que verlo allí</span>
                          </p>
                        )
                      )}

                      <button
                        onClick={() => setAbierto(desplegado ? null : p.id)}
                        className="flex items-center gap-1 text-[10px] font-bold text-muted hover:text-foreground mt-1.5 transition"
                      >
                        <ChevronDown className={`w-3 h-3 transition-transform ${desplegado ? 'rotate-180' : ''}`} />
                        Por qué sale aquí
                      </button>
                      {desplegado && (
                        <ul className="text-[10px] text-muted mt-1 space-y-0.5 pl-3 list-disc marker:text-secondary">
                          {p.motivos.map((m, i) => <li key={i}>{m}</li>)}
                        </ul>
                      )}

                      <div className="flex gap-1.5 mt-2">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-border/50 bg-card/80 text-[10px] font-bold text-muted hover:text-foreground transition"
                        >
                          <ExternalLink className="w-3 h-3" /> Ver dónde está
                        </a>
                        {yaCreado ? (
                          <span className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                            <Check className="w-3 h-3" /> Ficha creada
                          </span>
                        ) : (
                          <button
                            onClick={() => crearFicha(p)}
                            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-secondary/50 bg-secondary/15 text-secondary text-[10px] font-bold hover:bg-secondary/25 transition"
                          >
                            <Plus className="w-3 h-3" /> Crear ficha
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <p className="text-[10px] text-muted mt-2">
                Que algo no salga no quiere decir que no exista: el mapa lo hacen voluntarios y hay zonas con poco detalle.
              </p>
            </>
          )}
        </>
      )}
    </Card>
  );
}
