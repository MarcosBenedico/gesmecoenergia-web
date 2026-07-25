'use client';

import { useState } from 'react';
import { Radar, Loader, ExternalLink, Plus, Check, Info, ChevronDown, Eye, FileText } from 'lucide-react';
import { Prospecto, TIPO_PROSPECTO_LABEL, nivelInteres } from '@/lib/prospeccion';
import { estimarConsumo, textoRango } from '@/lib/consumo-estimado';
import type { FichaCatastro } from '@/app/api/luz/catastro/route';
import { Card, guardarLuz, btnSecundario } from '../ui';
import { FotoAerea } from './foto-aerea';

/**
 * APROVECHAR EL VIAJE — qué hay alrededor de la ruta que merezca una parada.
 *
 * La pantalla está montada alrededor de una idea: los datos estrechan y el ojo
 * decide. El mapa dice que hay naves largas y una balsa; la foto aérea dice si
 * son cerdos o vacas y si ya tienen placas puestas. Por eso la foto va arriba
 * del todo en cada ficha, y no escondida detrás de un enlace.
 */

/** Punto de partida del tipo de cliente. Nicola lo afina al confirmar los datos. */
const TIPO_CLIENTE_SEGUN_PROSPECTO: Record<Prospecto['tipo'], string> = {
  granja_intensiva: 'pyme',
  granja: 'pyme',
  invernadero: 'pyme',
  industria: 'industria',
  nave: 'industria',
  riego: 'pyme',
  comercio: 'pyme',
  sin_clasificar: 'pyme',
};

const TONO = {
  alto: { chip: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40', barra: '#10b981' },
  medio: { chip: 'bg-amber-500/15 text-amber-300 border-amber-500/40', barra: '#f59e0b' },
  bajo: { chip: 'bg-slate-500/15 text-slate-400 border-slate-500/40', barra: '#64748b' },
};

interface Props {
  ruta: { lat: number; lon: number }[];
  yaClientes: { lat: number; lon: number }[];
  onClienteCreado: () => void;
}

export function Prospectos({ ruta, yaClientes, onClienteCreado }: Props) {
  const [radio, setRadio] = useState(2);
  const [buscando, setBuscando] = useState(false);
  const [lista, setLista] = useState<Prospecto[] | null>(null);
  const [error, setError] = useState('');
  const [creados, setCreados] = useState<Record<string, boolean>>({});
  const [abierto, setAbierto] = useState<string | null>(null);
  /** Ficha del Catastro por prospecto. Se pide solo al abrir, no de golpe. */
  const [catastro, setCatastro] = useState<Record<string, FichaCatastro | 'cargando' | 'sin_datos'>>({});

  async function buscar() {
    setBuscando(true); setError(''); setLista(null);
    try {
      const res = await fetch('/api/luz/prospectar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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

  /**
   * Pide la ficha oficial del Catastro. Solo al desplegar: son dos llamadas
   * por sitio y hacerlo para los 60 de golpe sería abusar de un servicio
   * público (y tardaría una eternidad).
   */
  async function pedirCatastro(p: Prospecto) {
    if (catastro[p.id]) return;
    setCatastro((c) => ({ ...c, [p.id]: 'cargando' }));
    try {
      const res = await fetch('/api/luz/catastro', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: p.lat, lon: p.lon }),
      });
      const json = await res.json();
      setCatastro((c) => ({ ...c, [p.id]: json.ficha?.referencia ? json.ficha : 'sin_datos' }));
    } catch {
      setCatastro((c) => ({ ...c, [p.id]: 'sin_datos' }));
    }
  }

  function alternar(p: Prospecto) {
    const abriendo = abierto !== p.id;
    setAbierto(abriendo ? p.id : null);
    if (abriendo) pedirCatastro(p);
  }

  /** Crea la ficha del cliente con todo lo que sabemos, para no perder el hallazgo. */
  async function crearFicha(p: Prospecto) {
    const ficha = catastro[p.id];
    const oficial = ficha && ficha !== 'cargando' && ficha !== 'sin_datos' ? ficha : null;

    const sugerido =
      p.nombre ||
      oficial?.direccion ||
      `${TIPO_PROSPECTO_LABEL[p.tipo].replace(/^\S+\s/, '')} sin identificar${p.municipio ? ` · ${p.municipio}` : ''}`;
    const nombre = window.prompt('Nombre para la ficha (David lo confirma al pasar por allí):', sugerido);
    if (!nombre?.trim()) return;

    const m2 = oficial?.m2_construidos || p.m2_construidos;
    const consumo = estimarConsumo(
      p.tipo === 'granja_intensiva' ? 'granja_intensiva' : p.tipo === 'industria' ? 'industria' : 'nave_almacen',
      m2
    );

    const observaciones = [
      'Detectado al preparar una ruta. Sin verificar sobre el terreno.',
      ...p.motivos,
      ...(oficial
        ? [
            `Catastro: ${oficial.uso || 'uso sin declarar'}, ${oficial.m2_construidos?.toLocaleString('es-ES') || '?'} m² construidos` +
              (oficial.anio ? `, de ${oficial.anio}` : '') +
              (oficial.n_construcciones ? `, ${oficial.n_construcciones} construcciones` : '') + '.',
            `Referencia catastral: ${oficial.referencia}.`,
          ]
        : []),
    ].join('\n· ');

    const err = await guardarLuz('clientes', 'POST', {
      nombre: nombre.trim(),
      tipo_cliente: TIPO_CLIENTE_SEGUN_PROSPECTO[p.tipo],
      direccion_fiscal: `${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`,
      via_entrada: 'captacion',
      estado_comercial: 'detectado',
      prioridad: p.puntuacion >= 65 ? 'B' : 'C',
      responsable: 'David',
      potencial_comercial: consumo
        ? `Consumo estimado ${textoRango(consumo)} (orden de magnitud por tipo y tamaño, sin factura).`
        : '',
      observaciones: `· ${observaciones}`,
    });
    if (err) { setError(err); return; }
    setCreados((c) => ({ ...c, [p.id]: true }));
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
            Granjas, naves y negocios de camino que todavía no están en la cartera, con foto aérea para decidir de un vistazo.
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
              <select value={radio} onChange={(e) => setRadio(Number(e.target.value))}
                className="block mt-1 rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 text-xs font-semibold">
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

          {buscando && <p className="text-[10px] text-muted mt-2">Puede tardar unos segundos: se consulta el mapa público.</p>}
          {error && <p className="text-[11px] text-red-400 mt-2 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{error}</p>}

          {lista && lista.length === 0 && (
            <p className="text-[11px] text-muted mt-3 bg-card/60 rounded-lg p-2.5">
              No sale nada por aquí. Puede que no haya, o que el mapa esté poco detallado en esta zona — prueba a ampliar el desvío.
            </p>
          )}

          {lista && lista.length > 0 && (
            <>
              <div className="flex items-start gap-1.5 text-[10px] text-muted mt-3 mb-2 bg-card/60 rounded-lg p-2">
                <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
                <p>
                  <b className="text-foreground">El consumo es una estimación, no un dato.</b> El consumo real no es
                  público: se calcula por tipo de sitio y metros construidos, para ordenar a quién visitar.
                  <b className="text-foreground"> La foto manda</b>: mira los silos, la balsa y si ya tienen placas.
                </p>
              </div>

              <p className="text-[11px] font-bold text-muted mb-2">{lista.length} sitios de camino</p>

              <ul className="space-y-2.5 max-h-[42rem] overflow-y-auto pr-1">
                {lista.map((p) => {
                  const nivel = nivelInteres(p.puntuacion);
                  const t = TONO[nivel.tono];
                  const desplegado = abierto === p.id;
                  const ficha = catastro[p.id];
                  const oficial = ficha && ficha !== 'cargando' && ficha !== 'sin_datos' ? ficha : null;

                  return (
                    <li key={p.id} className="rounded-xl border border-border/40 bg-card/50 overflow-hidden">
                      {/* La foto primero: es lo que decide si merece parar */}
                      <FotoAerea lat={p.lat} lon={p.lon} etiqueta={p.nombre || TIPO_PROSPECTO_LABEL[p.tipo]} />

                      <div className="p-2.5">
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

                        <div className="h-1 rounded-full bg-border/40 mt-2 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${p.puntuacion}%`, background: t.barra }} />
                        </div>

                        {/* Lo que hace grande o pequeño a este cliente */}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-[10px] text-muted">
                          <span>🏗️ <b className="text-foreground">{p.m2_construidos.toLocaleString('es-ES')} m²</b> en {p.n_edificios} {p.n_edificios === 1 ? 'nave' : 'naves'}</span>
                          {p.nave_mayor && <span>📏 mayor {p.nave_mayor.largo}×{p.nave_mayor.ancho} m</span>}
                          {p.tiene_balsa && <span className="text-secondary">💧 balsa al lado</span>}
                          {p.ya_tiene_placas && <span className="text-amber-400">☀️ ya tiene placas</span>}
                        </div>

                        {p.consumo && (
                          <p className="text-[11px] mt-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1.5">
                            ⚡ <b className="text-emerald-400">{textoRango(p.consumo)}</b>{' '}
                            <span className="text-muted">estimados · {p.consumo.perfil.etiqueta}</span>
                          </p>
                        )}

                        <button onClick={() => alternar(p)}
                          className="flex items-center gap-1 text-[10px] font-bold text-muted hover:text-foreground mt-2 transition">
                          <ChevronDown className={`w-3 h-3 transition-transform ${desplegado ? 'rotate-180' : ''}`} />
                          {desplegado ? 'Ocultar detalle' : 'Ver detalle y ficha oficial'}
                        </button>

                        {desplegado && (
                          <div className="mt-2 space-y-2.5">
                            {/* Qué buscar en la foto: el mapa no distingue cerdos de vacas */}
                            {p.que_mirar.length > 0 && (
                              <div className="rounded-lg bg-background/40 border border-border/30 p-2">
                                <p className="flex items-center gap-1 text-[10px] font-black text-secondary mb-1">
                                  <Eye className="w-3 h-3" /> QUÉ MIRAR EN LA FOTO
                                </p>
                                <ul className="text-[10px] text-muted space-y-0.5 pl-3 list-disc marker:text-secondary">
                                  {p.que_mirar.map((m, i) => <li key={i}>{m}</li>)}
                                </ul>
                              </div>
                            )}

                            {/* Catastro: metros oficiales, uso y año */}
                            <div className="rounded-lg bg-background/40 border border-border/30 p-2">
                              <p className="flex items-center gap-1 text-[10px] font-black text-accent mb-1">
                                <FileText className="w-3 h-3" /> CATASTRO (oficial)
                              </p>
                              {ficha === 'cargando' && <p className="text-[10px] text-muted">Consultando…</p>}
                              {ficha === 'sin_datos' && <p className="text-[10px] text-muted">Aquí no hay parcela catastral con datos.</p>}
                              {oficial && (
                                <div className="text-[10px] text-muted space-y-0.5">
                                  {oficial.direccion && <p className="text-foreground font-semibold">{oficial.direccion}</p>}
                                  <p>
                                    {oficial.uso && <>Uso <b className="text-foreground">{oficial.uso}</b>. </>}
                                    {oficial.m2_construidos && <><b className="text-foreground">{oficial.m2_construidos.toLocaleString('es-ES')} m²</b> construidos. </>}
                                    {oficial.m2_parcela && <>Parcela de {oficial.m2_parcela.toLocaleString('es-ES')} m². </>}
                                  </p>
                                  <p>
                                    {oficial.anio && <>Construido en <b className="text-foreground">{oficial.anio}</b>. </>}
                                    {oficial.n_construcciones && <>{oficial.n_construcciones} construcciones. </>}
                                  </p>
                                  {oficial.anio && oficial.anio < 2008 && (
                                    <p className="text-amber-300">
                                      💬 Nave de {oficial.anio}: instalación eléctrica de la época y posible cubierta de
                                      fibrocemento. Es buena excusa para entrar a hablar, y condiciona el montaje.
                                    </p>
                                  )}
                                  {/* El dato oficial suele superar al del mapa: OSM se deja naves */}
                                  {oficial.m2_construidos && oficial.m2_construidos > p.m2_construidos * 1.3 && (
                                    <p className="text-emerald-400">
                                      El Catastro da {Math.round(oficial.m2_construidos / p.m2_construidos * 10) / 10}× más metros que el mapa: es más grande de lo que parecía.
                                    </p>
                                  )}
                                  {oficial.url_cartografia && (
                                    <a href={oficial.url_cartografia} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-accent hover:underline">
                                      <ExternalLink className="w-3 h-3" /> Cartografía catastral
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>

                            <div>
                              <p className="text-[10px] font-black text-muted mb-1">POR QUÉ SALE AQUÍ</p>
                              <ul className="text-[10px] text-muted space-y-0.5 pl-3 list-disc marker:text-muted/60">
                                {p.motivos.map((m, i) => <li key={i}>{m}</li>)}
                              </ul>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-1.5 mt-2">
                          <a href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-border/50 bg-card/80 text-[10px] font-bold text-muted hover:text-foreground transition">
                            <ExternalLink className="w-3 h-3" /> Cómo llegar
                          </a>
                          {creados[p.id] ? (
                            <span className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                              <Check className="w-3 h-3" /> Ficha creada
                            </span>
                          ) : (
                            <button onClick={() => crearFicha(p)}
                              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-secondary/50 bg-secondary/15 text-secondary text-[10px] font-bold hover:bg-secondary/25 transition">
                              <Plus className="w-3 h-3" /> Crear ficha
                            </button>
                          )}
                        </div>
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
