'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  LuzCliente, LuzOportunidad, diasHasta,
  ESTADO_PIPELINE_LABEL, ESTADO_PIPELINE_TONO, PIPELINE_ABIERTO_SIN_REVISAR,
} from '@/lib/luz';
import {
  progresoCliente, SIGUIENTE_PASO, A_PUNTO_DE_CERRAR, CLIENTE_CERRADO,
} from '@/lib/estados-luz';
/**
 * LOS CLIENTES DE DAVID, EN MARCHA.
 *
 * El objetivo real es que lo que abre lo cierre. Pero decírselo no sirve de
 * nada: lo que funciona es enseñarle la barra casi llena y lo que le falta
 * para rematar. Por eso aquí no hay ni una sola queja — solo dos listas:
 *
 *  · Los que están a un paso de entrar (donde más rinde insistir hoy).
 *  · Los que llevan semanas sin moverse, presentados como lo que son: una
 *    oportunidad barata, no un reproche. Ya estaban trabajados.
 *
 * El nombre del cliente manda en el diseño: se reconoce de un vistazo.
 */

/** Días sin tocar un cliente a partir de los cuales conviene volver a llamar. */
const DIAS_FRIO = 21;

function Fila({ c, tono, estadoPipe }: { c: LuzCliente; tono: 'cerca' | 'frio'; estadoPipe?: string | null }) {
  const pct = progresoCliente(c.estado_comercial);
  const paso = SIGUIENTE_PASO[c.estado_comercial] || 'Retomar el contacto';
  const dias = diasHasta(c.fecha_ultimo_contacto);
  const sinTocar = dias == null ? null : Math.abs(dias);

  return (
    <Link
      href={`/gestor/luz/clientes/${c.id}`}
      className={`fv-fade-in block rounded-xl bg-card/60 border p-3 transition hover:bg-card ${
        tono === 'cerca' ? 'border-emerald-500/30 hover:border-emerald-500/60' : 'border-border/30 hover:border-accent/40'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {/* El nombre, lo primero y lo más grande: es como identifica al cliente */}
          <p className="text-[15px] font-black text-foreground truncate leading-tight">{c.nombre}</p>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <p className={`text-xs font-semibold ${tono === 'cerca' ? 'text-emerald-400' : 'text-accent'}`}>
              {paso}
            </p>
            {/* Mismo estado y color que en el Pipeline */}
            {estadoPipe && (
              <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-black uppercase ${ESTADO_PIPELINE_TONO[estadoPipe] || ''}`}>
                {ESTADO_PIPELINE_LABEL[estadoPipe] || estadoPipe}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-lg font-black tabular-nums leading-none ${tono === 'cerca' ? 'text-emerald-400' : 'text-muted'}`}>
            {pct}%
          </p>
          {sinTocar != null && sinTocar > 0 && (
            <p className="text-[9px] text-muted/70 uppercase font-bold">hace {sinTocar} d</p>
          )}
        </div>
        <ArrowRight className="w-4 h-4 text-muted/50 shrink-0" />
      </div>
      {/* Barra de avance: ver lo poco que falta es lo que empuja a rematar */}
      <div className="h-1.5 w-full rounded-full bg-background/60 overflow-hidden mt-2">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            tono === 'cerca' ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-accent to-secondary'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </Link>
  );
}

/**
 * Cuántos clientes saldrían en el bloque. Lo usa el pie plegable de Mi Día
 * para poner el número delante sin tener que montar la lista entera. Vive
 * aquí para que el contador y la lista no puedan decir cosas distintas.
 */
export function contarEnMarcha(clientes: LuzCliente[]): number {
  const vivos = clientes.filter((c) => !CLIENTE_CERRADO.includes(c.estado_comercial));
  const cerca = vivos.filter((c) => A_PUNTO_DE_CERRAR.includes(c.estado_comercial)).slice(0, 5);
  const clavesCerca = new Set(cerca.map((c) => c.id));
  const frios = vivos.filter((c) => {
    if (clavesCerca.has(c.id)) return false;
    const d = diasHasta(c.fecha_ultimo_contacto);
    return d == null || Math.abs(d) >= DIAS_FRIO;
  }).slice(0, 4);
  return cerca.length + frios.length;
}

export function ClientesEnMarcha({ clientes, pipeline = [] }: { clientes: LuzCliente[]; pipeline?: LuzOportunidad[] }) {
  const vivos = clientes.filter((c) => !CLIENTE_CERRADO.includes(c.estado_comercial));

  // Estado del embudo de cada cliente: manda la oportunidad abierta si la tiene
  const estadoPipeDe = new Map<string, string>();
  for (const o of pipeline) {
    if (!o.cliente_id) continue;
    const previo = estadoPipeDe.get(o.cliente_id);
    const esAbierta = !PIPELINE_ABIERTO_SIN_REVISAR.includes(o.estado);
    if (!previo || esAbierta) estadoPipeDe.set(o.cliente_id, o.estado);
  }

  const cerca = vivos
    .filter((c) => A_PUNTO_DE_CERRAR.includes(c.estado_comercial))
    .sort((a, b) => progresoCliente(b.estado_comercial) - progresoCliente(a.estado_comercial))
    .slice(0, 5);

  const clavesCerca = new Set(cerca.map((c) => c.id));
  const frios = vivos
    .filter((c) => {
      if (clavesCerca.has(c.id)) return false;
      const d = diasHasta(c.fecha_ultimo_contacto);
      return d == null || Math.abs(d) >= DIAS_FRIO;
    })
    .sort((a, b) => progresoCliente(b.estado_comercial) - progresoCliente(a.estado_comercial))
    .slice(0, 4);

  if (cerca.length === 0 && frios.length === 0) return null;

  return (
    <div className="space-y-4">
      {cerca.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-emerald-400">🎯 A un paso de entrar</p>
            <span className="text-[10px] text-muted">un empujón y son tuyos</span>
          </div>
          <div className="space-y-2">
            {cerca.map((c) => <Fila key={c.id} c={c} tono="cerca" estadoPipe={estadoPipeDe.get(c.id)} />)}
          </div>
        </div>
      )}

      {frios.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-muted">💡 Fáciles de recuperar</p>
            <span className="text-[10px] text-muted/70">ya los trabajaste, solo falta un toque</span>
          </div>
          <div className="space-y-2">
            {frios.map((c) => <Fila key={c.id} c={c} tono="frio" estadoPipe={estadoPipeDe.get(c.id)} />)}
          </div>
        </div>
      )}
    </div>
  );
}
