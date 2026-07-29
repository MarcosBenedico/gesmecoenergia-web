import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/container';
import { PortadaGrupo } from '@/components/portada-grupo';
import { PanelesNovedades } from '@/components/paneles-novedades';

/**
 * PORTADA DEL GRUPO GESMECO.
 *
 * Antes aquí estaba la home de Gesmeco Energía, que ahora vive en `/energia`
 * tal cual estaba, sin tocarle una coma. El cambio no es cosmético: entrando
 * por una de las tres empresas, las otras dos quedaban escondidas en un menú y
 * la mayor parte de lo que hace el grupo no se veía nunca.
 *
 * Esta página tiene un solo trabajo: presentar a las tres casas y mandarte a la
 * que necesitas. No vende servicios — eso lo hace cada una en la suya.
 */

export const metadata: Metadata = {
  title: 'Grupo Gesmeco | Energía, asesoría y seguros en Binéfar',
  description:
    'Tres empresas en Binéfar y una sola puerta: Gesmeco Energía (luz, gas y solar), Asesoría Gesmeco (fiscal, laboral y contable) y Correbin Asociados (seguros).',
  alternates: { canonical: '/' },
};

/**
 * Datos estructurados del grupo y sus tres empresas.
 * Solo lo confirmado: ni valoraciones, ni cifras, ni cobertura que no podamos
 * demostrar — el mismo criterio que ya sigue la microsede de Correbin.
 */
const SCHEMA_GRUPO = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Grupo Gesmeco',
  url: 'https://gesmecoenergia.com',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Avenida de Aragón, 50',
    addressLocality: 'Binéfar',
    postalCode: '22500',
    addressRegion: 'Huesca',
    addressCountry: 'ES',
  },
  subOrganization: [
    { '@type': 'Organization', name: 'Gesmeco Energía', url: 'https://gesmecoenergia.com/energia' },
    { '@type': 'Organization', name: 'Asesoría Gesmeco', url: 'https://gesmecoenergia.com/grupo' },
    { '@type': 'InsuranceAgency', name: 'Correbin Asociados', url: 'https://gesmecoenergia.com/seguros' },
  ],
};

/** El mismo número del botón flotante y del formulario de contacto. */
const WHATSAPP = '34638434970';

export default function PortadaGrupoPage() {
  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA_GRUPO) }}
      />

      <PortadaGrupo />

      {/* ══════════ Novedades: una columna por casa y una de la comarca ══════════
          Va sobre una banda propia y separada por un filete: hasta aquí se ha
          presentado quién es cada uno, y a partir de aquí se cuenta qué está
          pasando. Sin ese corte las novedades parecen una cuarta empresa. */}
      <section className="border-t border-border bg-white/[0.015] py-16 md:py-24">
        <Container>
          <div className="mb-10 flex flex-wrap items-end justify-between gap-6 md:mb-14">
            <div>
              <p className="flex items-center gap-3.5 text-[11px] font-bold uppercase tracking-[0.3em] text-muted">
                <span aria-hidden className="inline-block h-px w-10 bg-foreground/30" />
                Novedades
              </p>
              <h2 className="portada-casa mt-5 max-w-2xl text-foreground">
                Lo que se mueve en el grupo, y en la comarca.
              </h2>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-muted">
              Cada empresa cuenta lo suyo. La última columna es lo que hacemos en La Litera, que es
              donde estamos.
            </p>
          </div>

          <PanelesNovedades />
        </Container>
      </section>

      {/* ══════════ El cierre: la puerta, con su dirección ══════════
          Después de tanto hablar de «una sola puerta», lo que cierra la página
          es la calle y el número. Es el dato más barato de poner y el que más
          dice: una web sin dirección puede ser de cualquiera y de ningún sitio. */}
      <section className="border-t border-border py-16 md:py-24">
        <Container>
          <div className="grid gap-10 md:grid-cols-[1fr_auto] md:items-end md:gap-16">
            <div className="max-w-xl">
              <h2 className="portada-casa text-foreground">¿No sabes cuál de las tres te toca?</h2>
              <p className="mt-5 text-base leading-relaxed text-muted md:text-lg">
                Cuéntanoslo y te pasamos con quien lo lleva. Si es cosa de varias, mejor: para eso
                estamos las tres en el mismo sitio.
              </p>

              <p className="mt-9 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <span className="text-[11px] font-bold uppercase tracking-[0.26em] text-foreground/60">
                  La puerta
                </span>
                <span aria-hidden className="hidden h-px w-6 bg-border sm:inline-block" />
                <span className="font-semibold text-foreground">Avenida de Aragón, 50</span>
                <span aria-hidden className="text-border">·</span>
                <span>22500 Binéfar, Huesca</span>
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-3">
              <Link
                href="/contacto"
                className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-4 text-sm font-bold text-white transition-transform duration-300 hover:-translate-y-0.5"
              >
                Hablar con el grupo
                <span aria-hidden>→</span>
              </Link>
              <a
                href={`https://wa.me/${WHATSAPP}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-foreground/20 px-7 py-4 text-sm font-bold text-foreground transition-colors duration-300 hover:border-accent/60 hover:text-accent"
              >
                Escribir por WhatsApp
              </a>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
