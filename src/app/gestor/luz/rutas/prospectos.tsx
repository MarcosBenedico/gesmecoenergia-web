'use client';

import { useState } from 'react';
import { Radar, Loader, Info, MapPin } from 'lucide-react';
import { Prospecto, TIPO_PROSPECTO_LABEL } from '@/lib/prospeccion';
import { Card, btnSecundario } from '../ui';

/**
 * APROVECHAR EL VIAJE — buscador de candidatos.
 *
 * Los resultados NO se listan aquí: se pintan en el mapa de arriba, cada uno
 * con el emoji de su actividad y del tamaño que le toca por consumo. En una
 * lista no se ve lo único que importa de verdad para decidir —si pilla de
 * camino o hay que cruzar la comarca—, y el mapa lo dice sin leer nada.
 *
 * Este panel se queda con lo que la lista no puede dar: los mandos, el
 * recuento y la leyenda.
 */

interface Props {
  ruta: { lat: number; lon: number }[];
  yaClientes: { lat: number; lon: number }[];
  /** Los resultados suben a la página, que se los pasa al mapa. */
  onResultados: (p: Prospecto[]) => void;
  prospectos: Prospecto[];
}

/** Orden de la leyenda: de más a menos interesante para el negocio. */
const LEYENDA: Prospecto['tipo'][] = [
  'granja_intensiva', 'industria', 'granja', 'invernadero', 'nave', 'riego', 'comercio', 'sin_clasificar',
];

export function Prospectos({ ruta, yaClientes, onResultados, prospectos }: Props) {
  const [radio, setRadio] = useState(2);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  const [buscado, setBuscado] = useState(false);

  async function buscar() {
    setBuscando(true); setError(''); onResultados([]);
    try {
      const res = await fetch('/api/luz/prospectar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruta, radio_km: radio, excluir: yaClientes }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'No se pudo buscar.'); return; }
      onResultados(json.prospectos || []);
      setBuscado(true);
    } catch {
      setError('No se pudo conectar con el buscador.');
    } finally {
      setBuscando(false);
    }
  }

  const hayRuta = ruta.length > 0;
  const porTipo = LEYENDA.map((t) => ({ tipo: t, n: prospectos.filter((p) => p.tipo === t).length })).filter((x) => x.n > 0);
  const grandes = prospectos.filter((p) => (p.consumo?.centro || 0) >= 100000).length;

  return (
    <Card className="!border-secondary/40">
      <div className="flex items-start gap-2 mb-1">
        <Radar className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-sm">Aprovechar el viaje</h3>
          <p className="text-[11px] text-muted">
            Granjas, naves y negocios de camino que aún no son clientes. Salen <b className="text-foreground">en el mapa de arriba</b>.
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

          {buscado && prospectos.length === 0 && !buscando && (
            <p className="text-[11px] text-muted mt-3 bg-card/60 rounded-lg p-2.5">
              No sale nada por aquí. Puede que no haya, o que el mapa esté poco detallado en esta zona — prueba a ampliar el desvío.
            </p>
          )}

          {prospectos.length > 0 && (
            <>
              <div className="mt-3 rounded-lg bg-secondary/10 border border-secondary/25 p-2.5">
                <p className="text-sm font-black text-secondary">
                  {prospectos.length} sitios de camino
                  {grandes > 0 && <span className="text-foreground font-bold"> · {grandes} de consumo alto</span>}
                </p>
                <p className="text-[10px] text-muted mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Púlsalos en el mapa para ver la foto aérea y añadirlos a la ruta.
                </p>
              </div>

              {/* Leyenda: qué significa cada pin */}
              <div className="mt-2.5 space-y-1.5">
                <p className="text-[10px] font-black text-muted">QUÉ HAY</p>
                <div className="flex flex-wrap gap-1.5">
                  {porTipo.map(({ tipo, n }) => (
                    <span key={tipo}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-border/40 bg-card/70 text-[10px] font-bold">
                      {TIPO_PROSPECTO_LABEL[tipo]} <span className="text-muted">{n}</span>
                    </span>
                  ))}
                </div>

                <p className="text-[10px] font-black text-muted pt-1">CÓMO LEER EL MAPA</p>
                <div className="text-[10px] text-muted space-y-1">
                  <p className="flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center rounded-full bg-amber-50 border-2 border-emerald-500 w-6 h-6 text-[11px]">🐖</span>
                    <span className="inline-flex items-center justify-center rounded-full bg-amber-50 border-2 border-emerald-500 w-4 h-4 text-[8px]">🐖</span>
                    <b className="text-foreground">El tamaño del pin es el consumo</b> estimado: cuanto más gordo, más factura.
                  </p>
                  <p>
                    <b className="text-foreground">El borde es el interés</b>: verde merece la pena, ámbar si cuadra, gris solo si sobra tiempo.
                  </p>
                  <p>Los que llevan <b className="text-foreground">☀️</b> ya figuran con placas puestas.</p>
                </div>
              </div>

              <div className="flex items-start gap-1.5 text-[10px] text-muted mt-2.5 bg-card/60 rounded-lg p-2">
                <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
                <p>
                  <b className="text-foreground">El consumo es una estimación, no un dato.</b> El real no es público: se
                  calcula por tipo de sitio y metros construidos, solo para ordenar a quién visitar.
                  <b className="text-foreground"> La foto manda</b> — mira los silos, la balsa y si ya tienen placas.
                </p>
              </div>

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
