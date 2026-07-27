'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Inbox, ArrowRight, CheckCircle2, Search, X } from 'lucide-react';
import {
  LuzCliente, LuzComision, LuzContrato, LuzCups, LuzOportunidad, LuzTarea,
} from '@/lib/luz';
import {
  construirBandeja, resumenBandeja, porTipoTrabajo, GRUPOS, TIPOS_TRABAJO,
  GrupoBandeja, TipoTrabajo, ItemBandeja,
} from '@/lib/bandeja';
import { useUsuario } from '@/lib/usuario';
import { Card, EstadoCarga, useListaLuz } from '../ui';

/**
 * LA BANDEJA — la pantalla de Nicola.
 *
 * Una sola pregunta: ¿qué hago ahora?
 *
 * Antes tenía nueve pantallas y ninguna se la respondía: para saber qué le
 * quedaba pendiente había que abrirlas una a una y deducirlo. Y por ella pasa
 * todo, así que si va atascada se para el resto.
 *
 * No ordena por fecha —eso pone arriba lo viejo, no lo importante— sino por a
 * quién está bloqueando cada cosa.
 */

export default function BandejaPage() {
  const { perfil } = useUsuario();
  const [verComo, setVerComo] = useState<string | null>(null);

  const clientes = useListaLuz<LuzCliente>('clientes');
  const cups = useListaLuz<LuzCups>('cups');
  const pipeline = useListaLuz<LuzOportunidad>('pipeline');
  const contratos = useListaLuz<LuzContrato>('contratos');
  const comisiones = useListaLuz<LuzComision>('comisiones');
  const tareas = useListaLuz<LuzTarea>('tareas');

  const persona = verComo ?? perfil?.responsable ?? null;
  const cargando = clientes.cargando || cups.cargando || contratos.cargando;

  const items = useMemo(
    () => construirBandeja({
      clientes: clientes.datos, cups: cups.datos, pipeline: pipeline.datos,
      contratos: contratos.datos, comisiones: comisiones.datos, tareas: tareas.datos,
      persona,
    }),
    [clientes.datos, cups.datos, pipeline.datos, contratos.datos, comisiones.datos, tareas.datos, persona]
  );

  const resumen = useMemo(() => resumenBandeja(items), [items]);
  const conteoTipo = useMemo(() => porTipoTrabajo(items), [items]);

  const [grupoAbierto, setGrupoAbierto] = useState<GrupoBandeja | null>(null);
  /** Filtro por clase de trabajo: es lo que permite ir por tandas. */
  const [tipoAbierto, setTipoAbierto] = useState<TipoTrabajo | null>(null);
  const [buscar, setBuscar] = useState('');

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return items.filter((i) => {
      if (grupoAbierto && i.grupo !== grupoAbierto) return false;
      if (tipoAbierto && i.tipo !== tipoAbierto) return false;
      if (q && !i.cliente.toLowerCase().includes(q) && !i.accion.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, grupoAbierto, tipoAbierto, buscar]);

  const hayFiltro = !!grupoAbierto || !!tipoAbierto || !!buscar.trim();
  const limpiarFiltros = () => { setGrupoAbierto(null); setTipoAbierto(null); setBuscar(''); };

  /** Cuántas se enseñan de golpe: una lista infinita agobia igual que ninguna. */
  const [tope, setTope] = useState(25);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-black flex items-center gap-2.5">
          <Inbox className="w-7 h-7 text-accent" /> Bandeja
        </h1>
        <p className="text-sm text-muted mt-1">
          Lo que está esperando a que alguien lo meta o lo mueva, ordenado por a quién bloquea. No por fecha:
          lo viejo no siempre es lo importante.
        </p>
      </div>

      <EstadoCarga
        cargando={cargando}
        error={clientes.error || cups.error || contratos.error}
        vacio={false}
        textoVacio=""
      />

      {!cargando && (
        <>
          {/* Los cuatro montones, en grande. Se pulsa para quedarse con uno. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {GRUPOS.map((g) => {
              const n = resumen[g.clave];
              const activo = grupoAbierto === g.clave;
              return (
                <button
                  key={g.clave}
                  onClick={() => { setGrupoAbierto(activo ? null : g.clave); setTope(25); }}
                  className={`rounded-2xl border p-4 text-left transition ${g.tono} ${
                    activo ? 'ring-2 ring-current' : n === 0 ? 'opacity-45' : 'hover:brightness-125'
                  }`}
                >
                  <p className="text-4xl font-black tabular-nums leading-none">{n}</p>
                  <p className="text-sm font-black mt-1.5">{g.emoji} {g.titulo}</p>
                  <p className="text-xs opacity-80 leading-snug mt-0.5">{g.porque}</p>
                </button>
              );
            })}
          </div>

          {/* Por tandas: ocho consumos seguidos se teclean en la mitad de tiempo
              que ir saltando de meter datos a llamar por teléfono y volver. */}
          {items.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap gap-2">
                {TIPOS_TRABAJO.filter((t) => conteoTipo[t.clave] > 0).map((t) => {
                  const activo = tipoAbierto === t.clave;
                  return (
                    <button
                      key={t.clave}
                      onClick={() => { setTipoAbierto(activo ? null : t.clave); setTope(25); }}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold border transition ${
                        activo ? 'bg-accent text-white border-accent' : 'bg-card/70 text-muted border-border/50 hover:text-foreground'
                      }`}
                    >
                      {t.emoji} {t.texto}
                      <span className={`tabular-nums ${activo ? 'text-white/80' : 'text-foreground/70'}`}>
                        {conteoTipo[t.clave]}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[14rem]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={buscar}
                    onChange={(e) => { setBuscar(e.target.value); setTope(25); }}
                    placeholder="Buscar por cliente o por lo que hay que hacer…"
                    className="w-full rounded-xl border border-border/40 bg-background/60 pl-9 pr-3 py-2.5 text-sm"
                  />
                </div>
                {hayFiltro && (
                  <button onClick={limpiarFiltros}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border/50 bg-card/70 text-sm font-bold text-muted hover:text-foreground transition">
                    <X className="w-4 h-4" /> Quitar filtros
                  </button>
                )}
                <span className="text-sm font-bold text-muted">
                  {visibles.length} de {items.length}
                </span>
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <Card>
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
                <p className="text-lg font-black">Todo al día</p>
                <p className="text-sm text-muted mt-1">
                  No hay nada esperando. Buen momento para adelantar renovaciones o repasar la cartera.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              {visibles.length === 0 ? (
                <Card>
                  <p className="text-sm text-muted">
                    Nada con estos filtros.{' '}
                    <button onClick={limpiarFiltros} className="text-accent font-bold hover:underline">Quitarlos</button>.
                  </p>
                </Card>
              ) : (
                <>
                  {visibles.slice(0, tope).map((i) => <Fila key={i.clave} i={i} />)}
                  {visibles.length > tope && (
                    <button
                      onClick={() => setTope((t) => t + 50)}
                      className="w-full py-3 rounded-xl border border-border/40 bg-card/50 text-sm font-bold text-muted hover:text-foreground transition"
                    >
                      Ver {Math.min(50, visibles.length - tope)} más · quedan {visibles.length - tope}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {perfil && (
            <p className="text-xs text-muted">
              Viendo la bandeja de <b className="text-foreground">{persona || '—'}</b>.
              {perfil.rol === 'admin' && (
                <>
                  {' '}Cambiar a{' '}
                  {['Nicola', 'David', 'Marcos'].filter((n) => n !== persona).map((n) => (
                    <button key={n} onClick={() => setVerComo(n)} className="text-accent hover:underline mx-1">{n}</button>
                  ))}
                </>
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** Una cosa por hacer. El cliente manda, la acción va debajo en imperativo. */
function Fila({ i }: { i: ItemBandeja }) {
  const g = GRUPOS.find((x) => x.clave === i.grupo)!;
  return (
    <Link href={i.href} className="block">
      <div className={`rounded-xl border p-3.5 flex items-center gap-3 transition hover:brightness-125 ${g.tono}`}>
        <span className="text-xl shrink-0">{g.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-black text-foreground truncate">{i.cliente}</p>
          <p className="text-sm font-bold">{i.accion}</p>
          {i.detalle && <p className="text-xs text-muted leading-snug mt-0.5">{i.detalle}</p>}
        </div>
        {i.dias != null && i.dias > 0 && (
          <span className="shrink-0 text-center">
            <span className="block text-lg font-black tabular-nums leading-none">{i.dias}</span>
            <span className="block text-[10px] uppercase font-bold opacity-70">
              {i.dias === 1 ? 'día' : 'días'}
            </span>
          </span>
        )}
        <ArrowRight className="w-4 h-4 shrink-0 opacity-50" />
      </div>
    </Link>
  );
}
