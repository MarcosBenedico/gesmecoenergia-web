'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, Loader, Save, Wand2, Zap,
} from 'lucide-react';
import { LuzCliente, LuzCups } from '@/lib/luz';
import {
  detectarHuecos, resumenHuecos, normalizarValor, type Hueco,
} from '@/lib/huecos';
import { Card, EstadoCarga, btnPrimario, btnSecundario, inputCls, useListaLuz, guardarLuz } from '../ui';

/**
 * RELLENAR EN TANDA — la pantalla para que Nicola deje de dar vueltas.
 *
 * De cada tres cosas que hace en el sistema, dos son rellenar un campo vacío. Y
 * hasta ahora lo hacía de una en una: abrir la ficha, escribir la palabra,
 * guardar, cerrar, siguiente. Cuatro vueltas para escribir «e-distribución».
 *
 * Aquí se le da la vuelta: se elige UN campo y se rellenan de golpe todos los
 * registros que lo tienen vacío, en una rejilla, sin salir de la pantalla.
 *
 * Tres detalles pensados para teclear rápido, que es de lo que va esto:
 *  · Enter salta a la fila siguiente, sin tocar el ratón.
 *  · «Poner lo mismo en todas» resuelve el caso más común de todos, que es que
 *    veinte suministros compartan distribuidora o comercializadora.
 *  · Se guarda solo lo que se haya escrito, y se dice cuántos han entrado.
 */

const TONO_PESO = (p: number) =>
  p >= 90 ? { texto: 'text-red-400', fondo: 'bg-red-500/10', borde: '!border-red-500/40' }
  : p >= 60 ? { texto: 'text-amber-400', fondo: 'bg-amber-500/10', borde: '!border-amber-500/30' }
  : { texto: 'text-muted', fondo: 'bg-card/60', borde: '' };

export default function RellenarPage() {
  const clientes = useListaLuz<LuzCliente>('clientes');
  const cups = useListaLuz<LuzCups>('cups');

  const [abierto, setAbierto] = useState<string | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [recado, setRecado] = useState<{ txt: string; mal: boolean } | null>(null);
  const [progreso, setProgreso] = useState(0);
  const refs = useRef<(HTMLInputElement | HTMLSelectElement | null)[]>([]);

  const nombresCliente = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of clientes.datos) m[c.id] = c.nombre;
    return m;
  }, [clientes.datos]);

  const huecos = useMemo(
    () => detectarHuecos({
      clientes: clientes.datos as never[],
      cups: cups.datos as never[],
      nombresCliente,
    }),
    [clientes.datos, cups.datos, nombresCliente]
  );

  const resumen = useMemo(() => resumenHuecos(huecos), [huecos]);
  const hueco: Hueco | undefined = huecos.find((h) => h.clave === abierto);

  // Al cambiar de campo se empieza en limpio y el cursor ya está puesto
  useEffect(() => {
    setValores({});
    setRecado(null);
    if (abierto) setTimeout(() => refs.current[0]?.focus(), 60);
  }, [abierto]);

  const escribir = (id: string, v: string) => setValores((p) => ({ ...p, [id]: v }));

  const mismoEnTodas = () => {
    if (!hueco) return;
    const primero = valores[hueco.filas[0].id];
    if (!primero?.trim()) return;
    const todas: Record<string, string> = {};
    for (const f of hueco.filas) todas[f.id] = primero;
    setValores(todas);
  };

  const siguiente = (i: number) => refs.current[i + 1]?.focus();

  const guardar = useCallback(async () => {
    if (!hueco) return;
    const pendientes = hueco.filas
      .map((f) => ({ f, bruto: valores[f.id] || '' }))
      .filter((x) => x.bruto.trim());

    if (!pendientes.length) {
      setRecado({ txt: 'No has escrito nada todavía.', mal: true });
      return;
    }

    setGuardando(true);
    setProgreso(0);
    let bien = 0;
    const malos: string[] = [];

    // Se guarda fila a fila y no en bloque a propósito: el PUT de /api/luz
    // lleva dentro la sincronización de estados entre CUPS, pipeline y
    // contrato. Saltárselo por ir más rápido dejaría los estados descuadrados.
    for (let i = 0; i < pendientes.length; i++) {
      const { f, bruto } = pendientes[i];
      const valor = normalizarValor(hueco.tipo, bruto);
      if (valor === null) { malos.push(`${f.titulo}: «${bruto}» no vale`); continue; }
      const err = await guardarLuz(hueco.entidad, 'PUT', { id: f.id, [hueco.campo]: valor });
      if (err) malos.push(`${f.titulo}: ${err}`); else bien++;
      setProgreso(Math.round(((i + 1) / pendientes.length) * 100));
    }

    setGuardando(false);
    setRecado({
      txt: malos.length
        ? `Guardados ${bien}. No entraron ${malos.length}: ${malos.slice(0, 3).join(' · ')}`
        : `Guardados ${bien}. Ese hueco está cerrado.`,
      mal: malos.length > 0,
    });
    await Promise.all([clientes.recargar(), cups.recargar()]);
    setValores({});
  }, [hueco, valores, clientes, cups]);

  const cargando = clientes.cargando || cups.cargando;
  /** Ni un cliente ni un suministro: no es que esté limpia, es que no ha cargado. */
  const sinCartera = clientes.datos.length === 0 && cups.datos.length === 0;
  const escritos = hueco ? hueco.filas.filter((f) => (valores[f.id] || '').trim()).length : 0;

  // ── Un campo abierto: la rejilla ──
  if (hueco) {
    const tono = TONO_PESO(hueco.peso);
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setAbierto(null)} className="text-xs text-muted hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" /> Todos los huecos
        </button>

        <div>
          <h1 className="text-3xl font-black">{hueco.etiqueta}</h1>
          <p className="text-sm text-muted mt-1">{hueco.porque}</p>
        </div>

        <Card className={tono.borde}>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`text-2xl font-black tabular-nums ${tono.texto}`}>{hueco.cuantos}</span>
            <span className="text-sm text-muted">
              {hueco.entidad === 'cups' ? 'suministros' : 'clientes'} sin rellenar
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {hueco.tipo !== 'fecha' && hueco.tipo !== 'numero' && (
                <button type="button" onClick={mismoEnTodas} className={`${btnSecundario} !py-1.5 !text-xs`}
                  title="Escribe el primero y esto lo copia a todos los demás">
                  <Wand2 className="w-3.5 h-3.5" /> Poner lo mismo en todas
                </button>
              )}
              <button type="button" onClick={guardar} disabled={guardando || !escritos} className={btnPrimario}>
                {guardando ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar {escritos > 0 ? `los ${escritos}` : ''}
              </button>
            </div>
          </div>
          {guardando && (
            <div className="mt-3 h-1.5 rounded-full bg-card overflow-hidden">
              <div className="h-full bg-accent transition-all" style={{ width: `${progreso}%` }} />
            </div>
          )}
        </Card>

        {recado && (
          <Card className={recado.mal ? '!border-amber-500/40' : '!border-emerald-500/40'}>
            <div className="flex items-start gap-2.5">
              {recado.mal ? <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          : <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
              <p className="text-sm text-foreground">{recado.txt}</p>
            </div>
          </Card>
        )}

        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-card/40">
                  <th className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-wider text-muted w-8">#</th>
                  <th className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-wider text-muted">
                    {hueco.entidad === 'cups' ? 'Suministro' : 'Cliente'}
                  </th>
                  <th className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-wider text-muted">{hueco.etiqueta}</th>
                </tr>
              </thead>
              <tbody>
                {hueco.filas.map((f, i) => (
                  <tr key={f.id} className="border-b border-border/20">
                    <td className="px-3 py-1.5 text-[11px] text-muted tabular-nums">{i + 1}</td>
                    <td className="px-3 py-1.5 min-w-0">
                      <span className={`block font-semibold text-foreground ${hueco.entidad === 'cups' ? 'font-mono text-[12px]' : ''}`}>
                        {f.titulo}
                      </span>
                      {f.contexto && <span className="block text-[11px] text-muted truncate">{f.contexto}</span>}
                    </td>
                    <td className="px-3 py-1.5 w-[38%]">
                      {hueco.tipo === 'lista' ? (
                        <select
                          ref={(el) => { refs.current[i] = el; }}
                          value={valores[f.id] || ''}
                          onChange={(e) => { escribir(f.id, e.target.value); siguiente(i); }}
                          className={inputCls}
                        >
                          <option value="">—</option>
                          {(hueco.opciones || []).map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input
                          ref={(el) => { refs.current[i] = el; }}
                          value={valores[f.id] || ''}
                          onChange={(e) => escribir(f.id, e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); siguiente(i); } }}
                          placeholder={
                            hueco.tipo === 'fecha' ? 'dd/mm/aaaa'
                            : hueco.tipo === 'numero' ? '145000'
                            : hueco.tipo === 'telefono' ? '974 000 000' : ''
                          }
                          inputMode={hueco.tipo === 'numero' || hueco.tipo === 'telefono' ? 'numeric' : 'text'}
                          className={inputCls}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <p className="text-[11px] text-muted">
          Con <strong className="text-foreground">Enter</strong> saltas a la fila siguiente sin tocar el ratón.
          Lo que dejes en blanco no se toca. Las fechas admiten 30/04/2027, y los consumos, 145.000.
        </p>
      </div>
    );
  }

  // ── La lista de huecos ──
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-black flex items-center gap-2.5">
          <Zap className="w-7 h-7 text-accent" /> Rellenar en tanda
        </h1>
        <p className="text-sm text-muted mt-1">
          Lo que le falta a la cartera para poder trabajarla, campo a campo. Eliges uno y los
          rellenas todos de una sentada, sin abrir una ficha por cada uno.
        </p>
      </div>

      <EstadoCarga
        cargando={cargando}
        error={clientes.error || cups.error}
        faltaMigracion={clientes.faltaMigracion || cups.faltaMigracion}
        vacio={false}
        textoVacio=""
        sqlFile="supabase_luz.sql"
      />

      {/*
        El vacío se distingue a mano y no con EstadoCarga porque hay DOS vacíos
        que se parecen y significan lo contrario: que no falte ningún dato es
        una buena noticia; que no haya cargado la cartera es un problema. Decir
        «cartera limpia» cuando en realidad no se ha leído nada haría que Nicola
        cerrara la pantalla pensando que no tiene trabajo.
      */}
      {!cargando && !clientes.error && !cups.error && sinCartera && (
        <Card className="!border-amber-500/40">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-foreground">No se ha podido leer la cartera</p>
              <p className="text-sm text-muted mt-1">
                No han llegado ni clientes ni suministros. Suele ser que la sesión ha caducado:
                vuelve a entrar en el panel. Esto <strong className="text-foreground">no</strong> significa
                que no haya nada que rellenar.
              </p>
            </div>
          </div>
        </Card>
      )}

      {!cargando && !sinCartera && huecos.length === 0 && (
        <Card className="!border-emerald-500/40">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-foreground">Cartera limpia</p>
              <p className="text-sm text-muted mt-1">
                No falta ni uno de los datos que bloquean el trabajo, sobre {clientes.datos.length} clientes
                y {cups.datos.length} suministros. Buen trabajo.
              </p>
            </div>
          </div>
        </Card>
      )}

      {!cargando && huecos.length > 0 && (
        <>
          <Card>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-2xl font-black tabular-nums text-foreground">{resumen.celdas}</span>
              <span className="text-sm text-muted">datos por rellenar en {resumen.campos} campos</span>
              {resumen.masUrgente && (
                <span className="text-[11px] text-muted ml-auto">
                  Por lo que más desbloquea: <strong className="text-foreground">{resumen.masUrgente.etiqueta}</strong>
                </span>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {huecos.map((h) => {
              const tono = TONO_PESO(h.peso);
              return (
                <button
                  key={h.clave}
                  type="button"
                  onClick={() => setAbierto(h.clave)}
                  className={`text-left card rounded-2xl p-4 bg-surface/50 border border-border/40 hover:border-accent/50 transition group ${tono.borde}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`text-2xl font-black tabular-nums shrink-0 ${tono.texto}`}>{h.cuantos}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-foreground flex items-center gap-1.5">
                        {h.etiqueta}
                        <ChevronRight className="w-4 h-4 text-muted group-hover:text-accent transition" />
                      </p>
                      <p className="text-[11px] text-muted">
                        {h.entidad === 'cups' ? 'suministros' : 'clientes'} · el {h.pct}% de los que están vivos
                      </p>
                      <p className="text-xs text-muted mt-1.5 leading-relaxed">{h.porque}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <Card>
            <p className="text-[11px] text-muted leading-relaxed">
              <strong className="text-foreground">El orden no es por cuántos faltan, es por qué bloquea.</strong>{' '}
              Cuarenta clientes sin email no paran nada; cinco suministros sin fecha de fin de contrato paran
              la Agenda entera, porque el preaviso se calcula desde ahí. Lo que está en rojo es lo que
              impide trabajar hoy.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
