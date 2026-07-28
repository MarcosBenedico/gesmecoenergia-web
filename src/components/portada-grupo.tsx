'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { LogoEmpresa, MARCAS } from '@/components/logo-empresa';

/**
 * PORTADA DEL GRUPO — las tres marcas, en grande.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA IDEA
 *
 * Lo que hace distinto a este grupo no es «tres empresas»: es que en un pueblo
 * de nueve mil habitantes, la luz, los impuestos y los seguros los llevan las
 * mismas personas y se entra por la misma puerta. Un empresario de La Litera
 * normalmente persigue eso en tres sitios distintos.
 *
 * Así que la página no vende servicios: presenta a las tres casas y te manda a
 * la que necesitas. Por eso el protagonista son los LOGOTIPOS y no un titular.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ SE VE ASÍ
 *
 * · Escenario oscuro, marcas claras. Los tres logos están hechos para papel y
 *   llevan el texto en negro. Sobre el fondo oscuro de la web, montados en
 *   placas blancas, no es un apaño: es lo que hace que brillen y lo único que
 *   pone color en la pantalla. El escenario calla para que hablen ellas.
 *
 * · Una banda por empresa, no tres tarjetas en fila. Tres tarjetas iguales
 *   dicen «tres opciones»; tres bandas anchas dicen «tres casas», que es la
 *   verdad. Y le dan al logo el tamaño que se pidió.
 *
 * · Titulares en serif. Los tres wordmarks están compuestos en una serif de
 *   alto contraste; los titulares usan la misma familia para que el texto y
 *   las marcas hablen el mismo idioma.
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

  /** Entrada compartida: corta, y solo una vez. */
  const entra = (retardo = 0) =>
    quieto
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: '-70px' },
          transition: { duration: 0.42, delay: retardo, ease: SALIDA },
        };

  return (
    <>
      {/* ══════════ Las tres marcas, lo primero que se ve ══════════ */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-5 pb-14 pt-16 md:pt-24">
          <motion.p
            {...(quieto ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.5, ease: SALIDA } })}
            className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.22em] text-muted"
          >
            <span className="inline-block h-px w-7 bg-accent" />
            Grupo Gesmeco · Binéfar, La Litera
          </motion.p>

          <motion.h1
            {...(quieto ? {} : { initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay: 0.06, ease: SALIDA } })}
            className="mt-5 max-w-4xl text-[2.6rem] leading-[1.05] tracking-tight text-foreground md:text-6xl"
            style={{ fontFamily: 'var(--font-titular), Georgia, serif', fontWeight: 500 }}
          >
            Tres casas,{' '}
            <em className="not-italic" style={{ color: 'var(--color-accent)' }}>
              una sola puerta
            </em>
            .
          </motion.h1>

          <motion.p
            {...(quieto ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay: 0.14, ease: SALIDA } })}
            className="mt-6 max-w-2xl text-lg leading-relaxed text-muted"
          >
            La luz, los impuestos y los seguros de tu negocio, llevados por las mismas personas y en el
            mismo sitio. Tres empresas especializadas, un solo teléfono y una oficina en Binéfar a la que
            puedes entrar por la puerta.
          </motion.p>

          {/* Los tres logotipos, a lo grande. Es lo que se recuerda. */}
          <motion.div
            {...(quieto
              ? {}
              : {
                  initial: 'oculto',
                  animate: 'visible',
                  variants: { oculto: {}, visible: { transition: { staggerChildren: 0.11, delayChildren: 0.22 } } },
                })}
            className="mt-12 flex flex-wrap items-center gap-4 md:gap-6"
          >
            {CASAS.map((c) => (
              <motion.div
                key={c.area}
                variants={
                  quieto
                    ? undefined
                    : {
                        oculto: { opacity: 0, y: 20, scale: 0.97 },
                        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: SALIDA } },
                      }
                }
              >
                <Link href={c.href} aria-label={c.cta} className="block">
                  <motion.span
                    whileHover={quieto ? undefined : { y: -4 }}
                    transition={{ duration: 0.25, ease: SALIDA }}
                    className="block"
                  >
                    <LogoEmpresa marca={c.marca} alto={44} prioritario className="shadow-[0_14px_40px_rgba(0,0,0,.45)]" />
                  </motion.span>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ══════════ Una banda por casa ══════════ */}
      <section aria-label="Las tres empresas del grupo" className="mx-auto max-w-6xl space-y-5 px-5 pb-8">
        {CASAS.map((c, i) => (
          <motion.article
            key={c.area}
            {...entra(i * 0.06)}
            className="group relative overflow-hidden rounded-3xl border border-border/40 bg-surface/40 transition-colors duration-300 hover:border-border"
          >
            {/* Filete de la casa: se enciende entero al acercarse */}
            <span
              aria-hidden
              className="absolute left-0 top-0 h-full w-[3px] origin-top scale-y-100 transition-opacity duration-500 md:opacity-60 md:group-hover:opacity-100"
              style={{ background: c.color }}
            />

            <div className="grid items-center gap-8 p-7 md:grid-cols-[auto_1fr_auto] md:p-9">
              <div className="flex flex-col items-start gap-3">
                <LogoEmpresa marca={c.marca} alto={40} />
                <span
                  className="rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.18em]"
                  style={{ borderColor: `${c.color}55`, color: c.color, background: `${c.color}12` }}
                >
                  {c.area}
                </span>
              </div>

              <div className="min-w-0">
                <p
                  className="text-xl leading-snug text-foreground md:text-2xl"
                  style={{ fontFamily: 'var(--font-titular), Georgia, serif', fontWeight: 500 }}
                >
                  {c.claim}
                </p>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{c.texto}</p>
                <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5">
                  {c.puntos.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-[13px] font-semibold text-muted">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href={c.href}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-3.5 text-sm font-black text-white transition-transform duration-300 hover:-translate-y-0.5"
                style={{ background: c.color }}
              >
                {c.cta}
                <span aria-hidden>→</span>
              </Link>
            </div>
          </motion.article>
        ))}
      </section>
    </>
  );
}
