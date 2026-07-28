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
    <div className="pb-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA_GRUPO) }}
      />

      <PortadaGrupo />

      {/* ══════════ Novedades: una columna por casa y una de la comarca ══════════ */}
      <section className="py-16 md:py-20">
        <Container>
          <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.22em] text-muted">
                <span className="inline-block h-px w-7 bg-accent" />
                Novedades
              </p>
              <h2
                className="mt-3 max-w-2xl text-3xl leading-tight tracking-tight text-foreground md:text-4xl"
                style={{ fontFamily: 'var(--font-titular), Georgia, serif', fontWeight: 500 }}
              >
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

      {/* ══════════ Una sola puerta: el cierre ══════════ */}
      <section className="pb-16">
        <Container>
          <div className="relative overflow-hidden rounded-3xl border border-accent/25 bg-gradient-to-br from-accent/[0.09] to-transparent p-8 md:p-12">
            <div className="flex flex-col items-start justify-between gap-7 md:flex-row md:items-center">
              <div className="max-w-xl">
                <h2
                  className="text-2xl leading-tight text-foreground md:text-3xl"
                  style={{ fontFamily: 'var(--font-titular), Georgia, serif', fontWeight: 500 }}
                >
                  ¿No sabes cuál de las tres te toca?
                </h2>
                <p className="mt-3 text-base leading-relaxed text-muted">
                  Cuéntanoslo y te pasamos con quien lo lleva. Si es cosa de varias, mejor: para eso
                  estamos las tres en el mismo sitio.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-3">
                <Link
                  href="/contacto"
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-7 py-4 text-base font-black text-white transition-transform duration-300 hover:-translate-y-0.5"
                >
                  Hablar con el grupo
                </Link>
                <a
                  href={`https://wa.me/${WHATSAPP}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-foreground/20 bg-foreground/5 px-7 py-4 text-base font-bold text-foreground transition-colors duration-300 hover:border-accent/50 hover:text-accent"
                >
                  Escribir por WhatsApp
                </a>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
