'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { LogoEmpresa, MARCAS } from '@/components/logo-empresa';

/**
 * PORTADA DEL GRUPO — LAS TRES PLACAS DE LA PUERTA.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA IDEA
 *
 * Lo que hace distinto a este grupo no es «tres empresas»: es que en un pueblo
 * de nueve mil habitantes, la luz, los impuestos y los seguros los llevan las
 * mismas personas y se entra por la misma puerta, la de la Avenida de Aragón.
 *
 * Así que la portada no es un catálogo: es esa puerta. Los tres logotipos van
 * montados en PLACAS —chapas, como las de un despacho— con la luz cayéndoles
 * desde arriba y una línea de su color debajo. Cada placa es el enlace a su
 * empresa. Es lo único llamativo de la página, y a propósito: en un sitio que
 * quiere transmitir seriedad, la fuerza sale de que todo lo demás calle.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DECISIONES QUE PARECEN DE GUSTO Y NO LO SON
 *
 * · Los logos salen UNA sola vez. Antes se repetían abajo, en cada banda, y
 *   una marca que se enseña dos veces en la misma pantalla deja de ser una
 *   marca y pasa a ser un icono de lista. Abajo manda la tipografía.
 *
 * · Las bandas son filas separadas por un filete, no tarjetas redondeadas.
 *   Tres tarjetas iguales dicen «elige una de tres»; tres filas dicen «esto
 *   es un índice», que es la verdad: no se elige empresa, se va a la que toca.
 *
 * · Un solo momento con movimiento: la entrada. El titular sube desde una
 *   máscara y las tres placas aparecen escalonadas. Nada más se mueve solo.
 *
 * · El color de cada marca solo ocupa superficie en un filete de 2 px y en su
 *   botón. Tres rojos y un azul repartidos por la página serían un folleto.
 *
 * Los tamaños de titular viven en `globals.css` (bloque «PORTADA DEL GRUPO»):
 * en la web pública las clases `text-*` de Tailwind no pintan, porque
 * `.web-publica h1` va sin capa y les gana siempre.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const SALIDA = [0.16, 1, 0.3, 1] as const;

const CASAS = [
  {
    marca: MARCAS.energia,
    area: 'Energía',
    color: '#ff3333',
    claim: 'Que tu factura de la luz deje de ser un misterio.',
    texto:
      'Analizamos la factura línea a línea, auditamos la instalación y diseñamos solar fotovoltaica a medida. Para casas, granjas, comercios e industria.',
    puntos: ['Análisis de factura de luz y gas', 'Auditoría energética', 'Solar llave en mano'],
    href: '/energia',
    cta: 'Entrar en Gesmeco Energía',
  },
  {
    marca: MARCAS.asesoria,
    area: 'Asesoría',
    color: '#c1272d',
    claim: 'Tus impuestos, tus nóminas y tus papeles, en orden.',
    texto:
      'Despacho de confianza para autónomos, empresas y particulares. Gestión fiscal, contable, laboral y administrativa, con trato directo.',
    puntos: ['Fiscal y contable', 'Laboral y nóminas', 'Trámites y expedientes'],
    href: '/grupo',
    // Todavía no tiene sede propia (`/asesoria` está pendiente): «Ver» y no
    // «Entrar en», que es lo que de verdad pasa al pulsar.
    cta: 'Ver Asesoría Gesmeco',
  },
  {
    marca: MARCAS.seguros,
    area: 'Seguros',
    color: '#364193',
    claim: 'Más que pólizas: análisis, negociación y defensa.',
    texto:
      'Correduría que trabaja como gerente externo de riesgos: audita el programa, prepara el riesgo, negocia con el mercado y defiende tu posición si hay siniestro.',
    puntos: ['Empresas y gerencia de riesgos', 'Transporte, flotas y agro', 'Hogar, auto, vida y salud'],
    href: '/seguros',
    cta: 'Entrar en Correbin Asociados',
  },
];

export function PortadaGrupo() {
  const quieto = useReducedMotion();

  /**
   * Una línea del titular que sube desde su propia máscara.
   * El relleno de abajo compensa el recorte de las colas de la serif —sin él,
   * `overflow: hidden` le corta la «p» de «puerta»— y el margen negativo lo
   * devuelve, para que las dos líneas sigan juntas.
   */
  const Linea = ({ children, retardo }: { children: ReactNode; retardo: number }) => (
    <span className="-mb-[0.14em] block overflow-hidden pb-[0.14em]">
      <motion.span
        data-revelar
        className="block"
        initial={quieto ? false : { y: '112%' }}
        animate={{ y: '0%' }}
        transition={{ duration: 0.9, delay: retardo, ease: SALIDA }}
      >
        {children}
      </motion.span>
    </span>
  );

  /** Entrada al entrar en pantalla: corta, discreta y una sola vez. */
  const entra = (retardo = 0) =>
    quieto
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: '-80px' },
          transition: { duration: 0.5, delay: retardo, ease: SALIDA },
        };

  return (
    <>
      {/* ══════════ La puerta ══════════ */}
      <section className="relative overflow-hidden">
        <span aria-hidden className="portada-luz" />

        {/* El aire de arriba está medido, no elegido: con `pt-24` y `mt-24`
            las placas quedaban cortadas por la mitad en una pantalla de 900,
            y una chapa cortada no invita a bajar, parece un fallo. Así entran
            enteras con su etiqueta debajo. */}
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-14 md:pb-24 md:pt-20">
          <motion.p
            data-revelar
            initial={quieto ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, ease: SALIDA }}
            className="flex items-center gap-3.5 text-[11px] font-bold uppercase tracking-[0.3em] text-muted"
          >
            <span aria-hidden className="inline-block h-px w-10 bg-foreground/30" />
            Grupo Gesmeco · Binéfar, La Litera
          </motion.p>

          <h1 className="portada-titular mt-8 text-foreground md:mt-10">
            <Linea retardo={0.06}>
              <span className="text-foreground/40">Tres casas.</span>
            </Linea>
            <Linea retardo={0.17}>Una sola puerta.</Linea>
          </h1>

          <motion.p
            data-revelar
            initial={quieto ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.42, ease: SALIDA }}
            className="mt-8 max-w-2xl text-lg leading-relaxed text-muted md:mt-10 md:text-xl"
          >
            La luz, los impuestos y los seguros de tu negocio, llevados por las mismas personas y en
            la misma oficina de Binéfar. Sin un 902 de por medio y sin contar tu caso tres veces.
          </motion.p>

          {/* ── Las tres placas. Es lo que se recuerda de esta página. ── */}
          <motion.div
            initial={quieto ? undefined : 'oculto'}
            animate={quieto ? undefined : 'visible'}
            variants={{
              oculto: {},
              visible: { transition: { staggerChildren: 0.13, delayChildren: 0.5 } },
            }}
            className="mt-14 grid gap-7 sm:grid-cols-3 md:mt-16 md:gap-8"
          >
            {CASAS.map((c) => (
              <motion.div
                key={c.area}
                data-revelar
                variants={
                  quieto
                    ? undefined
                    : {
                        oculto: { opacity: 0, y: 26 },
                        visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: SALIDA } },
                      }
                }
              >
                <Link href={c.href} aria-label={c.cta} className="placa-enlace group block">
                  <span className="placa min-h-[9.25rem] px-6 py-8 md:min-h-[10.5rem] md:px-8 md:py-10">
                    <LogoEmpresa marca={c.marca} alto={74} placa={false} ajusta prioritario />
                  </span>

                  <span className="mt-5 block">
                    <span className="placa-hilo" style={{ background: c.color }} />
                    <span className="mt-3 flex items-baseline justify-between gap-3">
                      <span className="text-[11px] font-black uppercase tracking-[0.26em] text-foreground/85">
                        {c.area}
                      </span>
                      <span className="text-[11px] font-semibold text-muted transition-colors duration-300 group-hover:text-foreground">
                        Entrar →
                      </span>
                    </span>
                  </span>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ══════════ Una fila por casa. Aquí ya no hay logos: manda el texto. ══════════ */}
      <section aria-label="Las tres empresas del grupo" className="mx-auto max-w-6xl px-5">
        {CASAS.map((c, i) => (
          <motion.article
            key={c.area}
            data-revelar
            {...entra(i * 0.05)}
            className="fila-casa group"
            style={{ '--casa': c.color } as CSSProperties}
          >
            <div className="grid gap-8 py-12 md:grid-cols-[minmax(0,18rem)_1fr] md:gap-14 md:py-16">
              <div>
                <span aria-hidden className="block h-[3px] w-9 rounded-sm" style={{ background: c.color }} />
                <p
                  className="mt-4 text-[11px] font-black uppercase tracking-[0.26em]"
                  style={{ color: c.color }}
                >
                  {c.area}
                </p>
                <h2 className="portada-casa mt-3 text-foreground">{c.marca.nombre}</h2>
              </div>

              <div className="min-w-0">
                <p className="portada-frase max-w-2xl text-foreground">{c.claim}</p>
                <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted md:text-base">
                  {c.texto}
                </p>

                <ul className="mt-7 flex flex-wrap gap-x-7 gap-y-2.5">
                  {c.puntos.map((p) => (
                    <li key={p} className="flex items-center gap-2.5 text-sm font-semibold text-muted">
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
                      {p}
                    </li>
                  ))}
                </ul>

                <Link
                  href={c.href}
                  className="cta-casa mt-9 inline-flex items-center gap-2.5 rounded-full px-6 py-3.5 text-sm font-bold"
                >
                  {c.cta}
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
          </motion.article>
        ))}
      </section>
    </>
  );
}
