'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { PANELES, ordenadas, fechaLarga } from '@/lib/novedades';

/**
 * PANELES DE NOVEDADES DEL GRUPO.
 *
 * Cuatro columnas: una por empresa y una de la comarca. Esa cuarta es la que
 * más dice — demuestra que esto no es una web de una empresa de fuera con una
 * dirección local puesta en el pie.
 *
 * Cada panel lleva el color de SU marca, no el de la web. Que los cuatro se
 * distingan de un vistazo es justo lo que se quiere contar: son tres empresas
 * distintas, no tres departamentos.
 *
 * El contenido vive en `src/lib/novedades.ts` y lo cura Marcos. Aquí no hay
 * ni un texto escrito a mano.
 */

const SALIDA = [0.16, 1, 0.3, 1] as const;

export function PanelesNovedades() {
  const quieto = useReducedMotion();

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {PANELES.map((panel, i) => {
        const novedades = ordenadas(panel);

        return (
          <motion.section
            key={panel.area}
            aria-labelledby={`novedades-${panel.area}`}
            /* Sin JS, Motion deja esto en `opacity: 0`. El <noscript> del
               layout de la web pública lo devuelve a visible. */
            data-revelar
            initial={quieto ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.42, delay: i * 0.07, ease: SALIDA }}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-surface/50 p-6 transition-colors duration-300 hover:border-border"
          >
            {/* Filete del color de la marca: es lo que separa un panel de otro */}
            <span
              aria-hidden
              className="absolute left-0 right-0 top-0 h-[3px] origin-left transition-transform duration-500 ease-out group-hover:scale-x-100"
              style={{ background: panel.color, transform: 'scaleX(1)' }}
            />

            <header className="mb-5">
              <h3
                id={`novedades-${panel.area}`}
                className="text-lg font-black leading-tight"
                style={{ color: panel.color }}
              >
                {panel.titulo}
              </h3>
              <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-muted">
                {panel.pie}
              </p>
            </header>

            <ul className="flex-1 space-y-5">
              {novedades.map((n) => {
                const Contenido = (
                  <>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                        style={{ background: `${panel.color}1f`, color: panel.color }}
                      >
                        {n.tipo}
                      </span>
                      <time dateTime={n.fecha} className="text-[11px] font-semibold text-muted">
                        {fechaLarga(n.fecha)}
                      </time>
                    </div>
                    <p className="mt-2 text-sm font-bold leading-snug text-foreground">{n.titulo}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">{n.texto}</p>
                  </>
                );

                return (
                  <li key={n.titulo} className="border-b border-border/25 pb-5 last:border-0 last:pb-0">
                    {n.href ? (
                      <Link
                        href={n.href}
                        className="block rounded-lg transition-opacity hover:opacity-80"
                      >
                        {Contenido}
                      </Link>
                    ) : (
                      Contenido
                    )}
                  </li>
                );
              })}

              {novedades.length === 0 && (
                <li className="text-sm text-muted">Todavía no hay novedades publicadas en esta área.</li>
              )}
            </ul>

            <Link
              href={panel.href}
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-black transition-transform duration-300 hover:translate-x-0.5"
              style={{ color: panel.color }}
            >
              Ver {panel.titulo}
              <span aria-hidden>→</span>
            </Link>
          </motion.section>
        );
      })}
    </div>
  );
}
