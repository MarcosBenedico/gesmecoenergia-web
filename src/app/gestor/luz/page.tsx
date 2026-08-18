'use client';

/**
 * DASHBOARD DE DIRECCIÓN (GL-03).
 *
 * LO QUE HABÍA: ocho tarjetas de KPI con el mismo peso, hasta doce alertas
 * rojas seguidas y una lista de accesos rápidos que repetía el menú. Todo
 * cierto y nada accionable — el plan lo llama «inventario» y manda quitarlo,
 * con un criterio de aceptación claro: identificar en menos de diez segundos
 * las cinco decisiones prioritarias del día.
 *
 * LO QUE HAY AHORA, EN ORDEN DE ARRIBA ABAJO:
 *
 *   1. Tres cifras, no ocho: qué requiere decisión, qué hay propuesto y qué
 *      está por cerrar.
 *   2. LAS CINCO DECISIONES DEL DÍA, cada una con su porqué y su cliente. Es
 *      la pantalla; lo demás es contexto.
 *   3. El embudo con su valor: dónde está la cartera y cuánto vale cada tramo.
 *   4. Vencimientos a 30/60/90 días — lo único que tiene fecha de caducidad.
 *   5. Como mucho TRES avisos de calidad, y solo de datos que bloquean trabajo.
 *
 * TODO EL CRITERIO VIVE EN `src/lib/dashboard.ts`, que a su vez se apoya en
 * `etapas.ts` (dónde está cada uno) y `seguimiento.ts` (cuánto lleva ahí). Esta
 * pantalla no decide nada por su cuenta: si el dashboard tuviera su propia idea
 * de qué es urgente, diría una cosa y el Pipeline otra.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, ArrowRight, CalendarClock, ChevronRight, Euro, Target,
} from 'lucide-react';
import {
  LuzCliente, LuzCups, LuzOportunidad, LuzContrato, LuzComision,
  fmtEur,
} from '@/lib/luz';
import { ETAPAS_EN_JUEGO } from '@/lib/etapas';
import {
  prioridadesDeHoy, cabecera, embudo, vencimientos, alertasCalidad,
  TITULO_PRIORIDAD, type EntradaCliente, type TipoPrioridad,
} from '@/lib/dashboard';
import { Card, EstadoCarga, guardarLuz, useListaLuz } from './ui';

interface Config { clave: string; valor: string }

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** El color dice de qué tipo es el problema sin tener que leerlo entero. */
const TONO_PRIORIDAD: Record<TipoPrioridad, string> = {
  preaviso: 'border-red-500/40 bg-red-500/10 text-red-300',
  activacion: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  propuesta: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  estudio: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
  factura: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
};

const TRAMOS = [30, 60, 90] as const;

export default function DashboardLuz() {
  const clientes = useListaLuz<LuzCliente>('clientes');
  const cups = useListaLuz<LuzCups>('cups');
  const pipeline = useListaLuz<LuzOportunidad>('pipeline');
  const contratos = useListaLuz<LuzContrato>('contratos');
  const comisiones = useListaLuz<LuzComision>('comisiones');
  const config = useListaLuz<Config>('config');

  const [editObjetivo, setEditObjetivo] = useState(false);
  const [objetivoTmp, setObjetivoTmp] = useState('');

  const hoy = hoyISO();
  const cargando = clientes.cargando || cups.cargando;

  /**
   * La cartera en la forma que espera `dashboard.ts`: un cliente con sus cosas
   * colgando. Se arma una vez y no en cada cálculo.
   */
  const cartera = useMemo<EntradaCliente[]>(() => {
    const vacio = () => ({ cups: [] as LuzCups[], pipeline: [] as LuzOportunidad[], contratos: [] as LuzContrato[] });
    const m = new Map<string, ReturnType<typeof vacio>>();
    const dame = (id: string) => { if (!m.has(id)) m.set(id, vacio()); return m.get(id)!; };
    for (const c of cups.datos) if (c.cliente_id) dame(c.cliente_id).cups.push(c);
    for (const o of pipeline.datos) if (o.cliente_id) dame(o.cliente_id).pipeline.push(o);
    for (const k of contratos.datos) if (k.cliente_id) dame(k.cliente_id).contratos.push(k);

    return clientes.datos.map((c) => {
      const e = m.get(c.id) || vacio();
      return {
        id: c.id,
        nombre: c.nombre,
        estadoComercial: c.estado_comercial,
        telefono: c.telefono || null,
        cups: e.cups,
        pipeline: e.pipeline,
        contratos: e.contratos,
        ultimoContacto: c.fecha_ultimo_contacto,
      };
    });
  }, [clientes.datos, cups.datos, pipeline.datos, contratos.datos]);

  const prioridades = useMemo(() => prioridadesDeHoy(cartera, hoy), [cartera, hoy]);
  const cifras = useMemo(() => cabecera(cartera, hoy), [cartera, hoy]);
  const tramos = useMemo(() => embudo(cartera, ETAPAS_EN_JUEGO), [cartera]);
  const caducan = useMemo(() => vencimientos(cartera, hoy), [cartera, hoy]);
  const avisos = useMemo(() => alertasCalidad(cartera), [cartera]);

  const objetivoComision = parseFloat(config.datos.find((c) => c.clave === 'objetivo_mensual_comision')?.valor || '0') || 0;
  const mesActual = hoy.slice(0, 7);
  const cobradoMes = comisiones.datos
    .filter((c) => c.fecha_cobro?.startsWith(mesActual))
    .reduce((s, c) => s + (Number(c.importe_cobrado) || 0), 0);

  async function guardarObjetivo() {
    await guardarLuz('config', 'PUT', { clave: 'objetivo_mensual_comision', valor: objetivoTmp });
    setEditObjetivo(false);
    config.recargar();
  }

  // El valor total del embudo se enseña una vez, no una tarjeta por etapa.
  const valorEmbudo = tramos.reduce((s, t) => s + t.importe, 0);
  const maxEmbudo = Math.max(1, ...tramos.map((t) => t.clientes));

  return (
    <div className="space-y-5">
      <EstadoCarga cargando={cargando} error={clientes.error} faltaMigracion={clientes.faltaMigracion} vacio={false} textoVacio="" sqlFile="supabase_luz.sql" />

      {!cargando && !clientes.faltaMigracion && !clientes.error && (
        <>
          {/* ── 1. Tres cifras ────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="!p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted font-bold">Requieren decisión hoy</p>
              <p className={`text-3xl font-black tabular-nums mt-1 ${cifras.requierenDecision ? 'text-red-400' : 'text-emerald-400'}`}>
                {cifras.requierenDecision}
              </p>
              <p className="text-[11px] text-muted mt-1">
                {cifras.requierenDecision ? 'Clientes fuera de plazo o con el preaviso encima' : 'Nada fuera de plazo'}
              </p>
            </Card>
            <Card className="!p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted font-bold">Propuesto y sin respuesta</p>
              <p className="text-3xl font-black tabular-nums mt-1 text-sky-400">{fmtEur(cifras.ahorroPropuesto)}</p>
              <p className="text-[11px] text-muted mt-1">Comisión de lo que está encima de la mesa</p>
            </Card>
            <Card className="!p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted font-bold">Por cerrar</p>
              <p className="text-3xl font-black tabular-nums mt-1 text-emerald-400">{cifras.contratosPorCerrar}</p>
              <p className="text-[11px] text-muted mt-1">
                Ya dijeron que sí · {fmtEur(cifras.importePorCerrar)}
              </p>
            </Card>
          </div>

          {/* ── 2. Las decisiones del día ─────────────────────────────────── */}
          <Card>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-accent" /> Lo que hay que decidir hoy
              </h2>
              <Link href="/gestor/luz/pipeline?vista=parados" className="text-xs font-semibold text-accent hover:underline shrink-0">
                Ver todo lo parado →
              </Link>
            </div>

            {prioridades.length === 0 ? (
              <p className="text-sm text-emerald-400 py-3">
                Nada fuera de plazo ni con el preaviso encima. La cartera está al día. 👌
              </p>
            ) : (
              <ol className="space-y-2">
                {prioridades.map((p, i) => (
                  <li key={`${p.clienteId}-${p.tipo}`}>
                    <Link
                      href={`/gestor/luz/clientes/${p.clienteId}`}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition hover:translate-x-0.5 ${TONO_PRIORIDAD[p.tipo]}`}
                    >
                      <span className="w-6 h-6 rounded-full bg-background/40 flex items-center justify-center text-xs font-black shrink-0 tabular-nums">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-foreground truncate">{p.cliente}</span>
                        <span className="block text-xs font-semibold">{TITULO_PRIORIDAD[p.tipo]}</span>
                        <span className="block text-[11px] text-muted">{p.detalle}</span>
                      </span>
                      {p.importe > 0 && (
                        <span className="text-xs font-bold tabular-nums shrink-0 hidden sm:block">{fmtEur(p.importe)}</span>
                      )}
                      <ChevronRight className="w-4 h-4 shrink-0 opacity-60" />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <div className="grid lg:grid-cols-2 gap-5">
            {/* ── 3. El embudo con su valor ───────────────────────────────── */}
            <Card>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="font-bold text-sm">Dónde está la cartera</h2>
                <span className="text-xs font-bold text-secondary tabular-nums">{fmtEur(valorEmbudo)} en juego</span>
              </div>
              <div className="space-y-1">
                {tramos.map((t) => (
                  <Link
                    key={t.etapa}
                    href={`/gestor/luz/pipeline?vista=parados&etapa=${t.etapa}`}
                    className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-card/70 transition"
                  >
                    <span className="text-xs font-semibold text-muted w-40 shrink-0 truncate">{t.titulo}</span>
                    <span className="flex-1 h-2 rounded-full bg-border/30 overflow-hidden">
                      <span
                        className="block h-full rounded-full bg-accent/70"
                        style={{ width: `${Math.round((t.clientes / maxEmbudo) * 100)}%` }}
                      />
                    </span>
                    <span className="text-xs font-black tabular-nums w-8 text-right">{t.clientes}</span>
                    <span className="text-[11px] text-muted tabular-nums w-20 text-right hidden sm:block">
                      {t.importe ? fmtEur(t.importe) : '—'}
                    </span>
                  </Link>
                ))}
              </div>
            </Card>

            {/* ── 4. Vencimientos ─────────────────────────────────────────── */}
            <Card>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="font-bold text-sm flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-amber-400" /> Se cierra la ventana de preaviso
                </h2>
                <Link href="/gestor/luz/cups" className="text-xs font-semibold text-accent hover:underline shrink-0">
                  Suministros →
                </Link>
              </div>

              {caducan.length === 0 ? (
                <p className="text-sm text-muted py-3">Ningún preaviso se cierra en los próximos 90 días.</p>
              ) : (
                <div className="space-y-3">
                  {TRAMOS.map((tramo) => {
                    const suyos = caducan.filter((v) => v.tramo === tramo);
                    if (!suyos.length) return null;
                    return (
                      <div key={tramo}>
                        <p className="text-[11px] uppercase tracking-wide font-bold text-muted mb-1">
                          {tramo === 30 ? 'Este mes' : tramo === 60 ? 'En 1-2 meses' : 'En 2-3 meses'} · {suyos.length}
                        </p>
                        <div className="space-y-1">
                          {suyos.slice(0, 6).map((v) => (
                            <Link
                              key={v.clienteId}
                              href={`/gestor/luz/clientes/${v.clienteId}`}
                              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition hover:translate-x-0.5 ${
                                tramo === 30 ? 'bg-red-500/10 text-red-300' : 'bg-card/60 text-muted hover:text-foreground'
                              }`}
                            >
                              <span className="font-semibold truncate">{v.cliente}</span>
                              <span className="tabular-nums font-bold shrink-0">{v.dias} d</span>
                            </Link>
                          ))}
                          {suyos.length > 6 && (
                            <p className="text-[11px] text-muted px-2.5">y {suyos.length - 6} más</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* ── Objetivo del mes ───────────────────────────────────────────── */}
          <Card className="!p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm font-bold flex items-center gap-2">
                <Euro className="w-4 h-4 text-emerald-400" /> Comisión cobrada este mes
                <span className="tabular-nums">{fmtEur(cobradoMes)}</span>
                {objetivoComision > 0 && <span className="text-xs text-muted font-semibold">de {fmtEur(objetivoComision)}</span>}
              </p>
              {!editObjetivo ? (
                <button onClick={() => { setObjetivoTmp(String(objetivoComision)); setEditObjetivo(true); }} className="text-xs font-semibold text-accent hover:underline">
                  Cambiar objetivo
                </button>
              ) : (
                <span className="flex gap-2 items-center">
                  <input className="w-28 rounded-lg border border-border/40 bg-background/60 px-2 py-1 text-sm tabular-nums" value={objetivoTmp} onChange={(e) => setObjetivoTmp(e.target.value)} inputMode="decimal" aria-label="Objetivo mensual de comisión en euros" />
                  <button onClick={guardarObjetivo} className="text-xs font-bold text-emerald-400">Guardar</button>
                </span>
              )}
            </div>
            {objetivoComision > 0 && (
              <span className="mt-2 block h-2 rounded-full bg-border/30 overflow-hidden">
                <span
                  className="block h-full rounded-full bg-emerald-500/70"
                  style={{ width: `${Math.min(100, Math.round((cobradoMes / objetivoComision) * 100))}%` }}
                />
              </span>
            )}
          </Card>

          {/* ── 5. Como mucho tres avisos de calidad ───────────────────────── */}
          {avisos.length > 0 && (
            <Card className="!p-4">
              <h2 className="font-bold text-sm mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Datos que faltan y frenan el trabajo
              </h2>
              <div className="space-y-1.5">
                {avisos.map((a) => (
                  <Link key={a.href} href={a.href} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-card/60 text-xs font-semibold text-muted hover:text-foreground transition">
                    <span className="tabular-nums font-black text-amber-400">{a.cuantos}</span>
                    <span className="flex-1 min-w-0">{a.texto}</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
