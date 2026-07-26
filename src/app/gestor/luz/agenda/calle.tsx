'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown, MapPin, Navigation, Phone, MessageCircle, Map, Clock,
  CheckCircle2, AlertTriangle, Route, Sun,
} from 'lucide-react';
import { LuzCliente, LuzCups } from '@/lib/luz';
import { ItemAgenda, URGENCIA_TONO, URGENCIA_LABEL } from '@/lib/agenda';
import {
  enriquecerParaCalle, agruparPorZona, enlaceRuta, enlaceMapa, enlaceWhatsApp,
  telefonoMarcable, SIN_ZONA, MAX_PARADAS_RUTA, type ItemCalle,
} from '@/lib/agenda-calle';
import { CLASIFICACIONES, defDe, type Clasificacion } from '@/lib/clasificacion';
import { Card, btnPrimario, btnSecundario } from '../ui';

/**
 * LA AGENDA VISTA DESDE LA FURGONETA.
 *
 * Agrupada por ZONA, no por fecha, porque nadie conduce a una fecha: se conduce
 * a Tamarite y allí se hace todo lo de Tamarite. Los días que David llevaba ruta
 * preparada hizo 9 visitas de media; los que salía con una lista, 0,7.
 *
 * Todo lo que se puede hacer sin salir de aquí: marcar paradas y sacar la ruta
 * en Google Maps, llamar, escribir por WhatsApp, abrir el mapa de un sitio,
 * resolver la visita y aplazar. Pensada para el móvil y con los botones grandes:
 * esto se mira en la calle y con prisa.
 *
 * Y cada línea dice QUÉ LE FALTA a ese cliente. El peor resultado de una visita
 * no es un no: es plantarse allí y no poder ofertar porque el consumo no estaba.
 */

/** Objetivo de puertas en un día de calle. Sale de su propio ritmo demostrado. */
const OBJETIVO_PUERTAS = 9;

interface Props {
  items: ItemAgenda[];
  clientes: LuzCliente[];
  cups: LuzCups[];
  /** Cuántas visitas se han registrado hoy, para el marcador. */
  visitasHoy: number;
  onResolverVisita: (clienteId: string, nombre: string) => void;
  onAplazar: (item: ItemAgenda) => void;
  onCompletar: (item: ItemAgenda) => void;
  ocupado: string;
}

export function VistaCalle({
  items, clientes, cups, visitasHoy, onResolverVisita, onAplazar, onCompletar, ocupado,
}: Props) {
  const [zonasAbiertas, setZonasAbiertas] = useState<string[]>([]);
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [soloTipo, setSoloTipo] = useState<Clasificacion | ''>('');
  const [soloListos, setSoloListos] = useState(false);

  const ricos = useMemo(
    () => enriquecerParaCalle({ items, clientes, cups }),
    [items, clientes, cups]
  );

  const filtrados = useMemo(() => ricos.filter((i) => {
    if (soloTipo && i.clasificacion !== soloTipo) return false;
    if (soloListos && i.falta.length > 0) return false;
    return true;
  }), [ricos, soloTipo, soloListos]);

  const zonas = useMemo(() => agruparPorZona(filtrados), [filtrados]);

  // La zona con más cosas urgentes se abre sola: es a la que hay que ir hoy
  const primeraZona = zonas[0]?.municipio;
  const abierta = (z: string) => zonasAbiertas.includes(z) || (zonasAbiertas.length === 0 && z === primeraZona);
  const alternarZona = (z: string) =>
    setZonasAbiertas((p) => (p.includes(z) ? p.filter((x) => x !== z) : [...p, z]));

  const seleccionadas = useMemo(
    () => filtrados.filter((i) => elegidas.includes(i.clave)),
    [filtrados, elegidas]
  );
  const rutaUrl = useMemo(() => enlaceRuta(seleccionadas.filter((i) => i.ubicable)), [seleccionadas]);

  const alternar = (clave: string) =>
    setElegidas((p) => (p.includes(clave) ? p.filter((x) => x !== clave) : [...p, clave]));

  const elegirZona = (z: ZonaLike) => {
    const claves = z.items.filter((i) => i.ubicable).slice(0, MAX_PARADAS_RUTA).map((i) => i.clave);
    setElegidas((p) => {
      const todas = claves.every((c) => p.includes(c));
      return todas ? p.filter((c) => !claves.includes(c)) : [...new Set([...p, ...claves])];
    });
  };

  const conteo = useMemo(() => {
    const r: Record<string, number> = { objetivo: 0, precliente: 0, cliente: 0 };
    for (const i of ricos) r[i.clasificacion]++;
    return r;
  }, [ricos]);

  return (
    <div className="space-y-3">
      {/* ── Marcador del día y la ruta ── */}
      <Card className="!p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Sun className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-xl font-black tabular-nums text-foreground leading-none">
                {visitasHoy}<span className="text-sm text-muted font-bold"> / {OBJETIVO_PUERTAS}</span>
              </p>
              <p className="text-[10px] text-muted uppercase tracking-wide font-bold">puertas hoy</p>
            </div>
          </div>

          <div className="h-8 w-px bg-border/50 hidden sm:block" />

          <div className="flex-1 min-w-0">
            <div className="h-2 rounded-full bg-card overflow-hidden">
              <div
                className={`h-full transition-all ${visitasHoy >= OBJETIVO_PUERTAS ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(100, (visitasHoy / OBJETIVO_PUERTAS) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted mt-1">
              {visitasHoy >= OBJETIVO_PUERTAS
                ? '¡Objetivo hecho! Lo de más ya es propina.'
                : `Faltan ${OBJETIVO_PUERTAS - visitasHoy} para el día completo.`}
            </p>
          </div>

          {seleccionadas.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground tabular-nums">
                {seleccionadas.length} parada{seleccionadas.length === 1 ? '' : 's'}
              </span>
              <button type="button" onClick={() => setElegidas([])} className={`${btnSecundario} !py-1.5 !text-xs`}>
                Quitar
              </button>
              {rutaUrl ? (
                <a href={rutaUrl} target="_blank" rel="noopener noreferrer" className={btnPrimario}>
                  <Navigation className="w-4 h-4" /> Sacar la ruta
                </a>
              ) : (
                <span className="text-[11px] text-amber-400">Ninguna tiene dirección</span>
              )}
            </div>
          )}
        </div>
        {seleccionadas.length > MAX_PARADAS_RUTA && (
          <p className="text-[11px] text-amber-400 mt-2">
            Google admite {MAX_PARADAS_RUTA} paradas por ruta: se cogerán las {MAX_PARADAS_RUTA} primeras.
          </p>
        )}
      </Card>

      {/* ── Filtros rápidos ── */}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setSoloTipo('')}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
            soloTipo === '' ? 'bg-accent text-white border-accent' : 'bg-card/60 text-muted border-border/40 hover:text-foreground'
          }`}>
          Todos <span className="opacity-70 tabular-nums">({ricos.length})</span>
        </button>
        {CLASIFICACIONES.map((c) => (
          <button key={c.clave} type="button" onClick={() => setSoloTipo(soloTipo === c.clave ? '' : c.clave)}
            title={c.quees}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
              soloTipo === c.clave ? c.tono : 'bg-card/60 text-muted border-border/40 hover:text-foreground'
            }`}>
            {c.emoji} {c.titulo} <span className="opacity-70 tabular-nums">({conteo[c.clave]})</span>
          </button>
        ))}
        <button type="button" onClick={() => setSoloListos((v) => !v)}
          title="Solo los que no les falta ningún dato: se puede ir a cerrar"
          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
            soloListos ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-card/60 text-muted border-border/40 hover:text-foreground'
          }`}>
          <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" /> Listos para cerrar
        </button>
      </div>

      {zonas.length === 0 && (
        <Card><p className="text-sm text-muted text-center py-6">Nada con este filtro.</p></Card>
      )}

      {/* ── Las zonas ── */}
      {zonas.map((z) => {
        const abr = abierta(z.municipio);
        const sinSitio = z.municipio === SIN_ZONA;
        return (
          <Card key={z.municipio} className="!p-0 overflow-hidden">
            <button
              type="button"
              onClick={() => alternarZona(z.municipio)}
              className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-card/40 transition"
            >
              <MapPin className={`w-4 h-4 shrink-0 ${sinSitio ? 'text-muted/50' : 'text-accent'}`} />
              <div className="min-w-0 flex-1">
                <p className="font-black text-foreground">{z.municipio}</p>
                <p className="text-[11px] text-muted">
                  {z.total} cosa{z.total === 1 ? '' : 's'}
                  {z.urge > 0 && <span className="text-red-400 font-bold"> · {z.urge} urge{z.urge === 1 ? '' : 'n'}</span>}
                  {z.listos > 0 && <span className="text-emerald-400"> · {z.listos} listo{z.listos === 1 ? '' : 's'}</span>}
                  {sinSitio && ' · no se puede meter en ruta'}
                </p>
              </div>
              {!sinSitio && z.ubicables > 0 && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); elegirZona(z); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); elegirZona(z); } }}
                  className={`${btnSecundario} !py-1 !px-2 !text-[11px] shrink-0`}
                  title={`Marcar las ${Math.min(z.ubicables, MAX_PARADAS_RUTA)} de esta zona para la ruta`}
                >
                  <Route className="w-3.5 h-3.5" /> Toda la zona
                </span>
              )}
              <ChevronDown className={`w-4 h-4 shrink-0 text-muted transition-transform ${abr ? '' : '-rotate-90'}`} />
            </button>

            {abr && (
              <div className="divide-y divide-border/20 border-t border-border/40">
                {z.items.map((i) => (
                  <Linea
                    key={i.clave}
                    item={i}
                    elegida={elegidas.includes(i.clave)}
                    onElegir={() => alternar(i.clave)}
                    onResolverVisita={onResolverVisita}
                    onAplazar={onAplazar}
                    onCompletar={onCompletar}
                    ocupado={ocupado}
                  />
                ))}
              </div>
            )}
          </Card>
        );
      })}

      <Card>
        <p className="text-[11px] text-muted leading-relaxed">
          <strong className="text-foreground">Por qué va por zonas y no por fechas.</strong> Nadie conduce a una
          fecha: se conduce a Tamarite, y una vez allí se hace todo lo de Tamarite, lo que vence mañana y lo que
          vence en tres semanas — porque volver cuesta cuarenta kilómetros. Marca las paradas, dale a
          <strong className="text-foreground"> Sacar la ruta</strong> y sal con el móvil puesto.
        </p>
      </Card>
    </div>
  );
}

interface ZonaLike { items: ItemCalle[] }

/** Una parada: qué toca, qué le falta y todo lo que se puede hacer sin salir. */
function Linea({
  item, elegida, onElegir, onResolverVisita, onAplazar, onCompletar, ocupado,
}: {
  item: ItemCalle;
  elegida: boolean;
  onElegir: () => void;
  onResolverVisita: (clienteId: string, nombre: string) => void;
  onAplazar: (item: ItemAgenda) => void;
  onCompletar: (item: ItemAgenda) => void;
  ocupado: string;
}) {
  const tel = telefonoMarcable(item.telefono);
  const wa = enlaceWhatsApp(item.telefono, `Hola${item.clienteNombre ? `, ${item.clienteNombre}` : ''}, soy David de Gesmeco Energía.`);
  const mapa = enlaceMapa(item);
  const d = defDe(item.clasificacion);
  const trabajando = ocupado === item.clave;

  return (
    <div className={`px-3 py-2.5 flex gap-3 ${elegida ? 'bg-accent/5' : ''}`}>
      {item.ubicable ? (
        <button
          type="button"
          onClick={onElegir}
          title="Marcar para la ruta"
          className={`mt-0.5 w-6 h-6 rounded-md border-2 shrink-0 flex items-center justify-center transition ${
            elegida ? 'bg-accent border-accent text-white' : 'border-border/60 hover:border-accent'
          }`}
        >
          {elegida && <CheckCircle2 className="w-4 h-4" />}
        </button>
      ) : (
        <span className="mt-0.5 w-6 h-6 shrink-0" title="Sin dirección: no se puede meter en ruta" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {item.clienteId ? (
            <Link href={`/gestor/luz/clientes/${item.clienteId}`} className="font-bold text-foreground hover:text-accent transition">
              {item.clienteNombre || item.titulo}
            </Link>
          ) : (
            <span className="font-bold text-foreground">{item.titulo}</span>
          )}
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${d.tono}`}>{d.emoji} {d.titulo}</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${URGENCIA_TONO[item.urgencia]}`}>
            {item.dias != null && item.dias < 0 ? `${-item.dias} d de retraso` : URGENCIA_LABEL[item.urgencia]}
          </span>
        </div>

        <p className="text-xs text-muted mt-0.5">
          <span className="font-semibold text-foreground/80">{item.tipoLabel}</span>
          {item.detalle && ` · ${item.detalle}`}
        </p>

        {item.falta.length > 0 && (
          <p className="text-[11px] text-amber-400 mt-1 flex items-start gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
            <span>Antes de ir: {item.falta.join(', ')}</span>
          </p>
        )}

        {/* Todo lo que se puede hacer desde aquí, con el pulgar */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {tel && (
            <a href={`tel:${tel}`} className={`${btnSecundario} !py-1 !px-2 !text-[11px]`} title={item.telefono || ''}>
              <Phone className="w-3.5 h-3.5" /> Llamar
            </a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className={`${btnSecundario} !py-1 !px-2 !text-[11px]`}>
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </a>
          )}
          {mapa && (
            <a href={mapa} target="_blank" rel="noopener noreferrer" className={`${btnSecundario} !py-1 !px-2 !text-[11px]`}>
              <Map className="w-3.5 h-3.5" /> Ir
            </a>
          )}
          {item.clienteId && (
            <button
              type="button"
              onClick={() => onResolverVisita(item.clienteId!, item.clienteNombre || item.titulo)}
              className={`${btnPrimario} !py-1 !px-2 !text-[11px]`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Ya he ido
            </button>
          )}
          {item.editable && (
            <>
              <button type="button" disabled={trabajando} onClick={() => onAplazar(item)}
                className={`${btnSecundario} !py-1 !px-2 !text-[11px]`}>
                <Clock className="w-3.5 h-3.5" /> Otro día
              </button>
              <button type="button" disabled={trabajando} onClick={() => onCompletar(item)}
                className={`${btnSecundario} !py-1 !px-2 !text-[11px]`}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Hecho
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
