import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CORREBIN_EMPRESA, CORREBIN_MENU, CORREBIN_CTA, CORREBIN_COLORES as C,
} from '@/lib/correbin-marca';
import { BarraContactoMovil } from './contacto-rapido';
import { LogoEmpresa, MARCAS } from '@/components/logo-empresa';
import { HiloDeLectura } from './movimiento';

/**
 * Microsede de seguros de Correbin Asociados.
 *
 * Identidad, navegación y conversión propias dentro del dominio del grupo
 * (Volumen III). Tiene layout propio porque el Volumen II exige fondos claros
 * y azul estructural, mientras que la web de energía es de tema oscuro.
 */

/** Metadatos base de la microsede (Volumen VIII). Cada página añade los suyos. */
export const metadata: Metadata = {
  metadataBase: new URL('https://gesmecoenergia.com'),
  title: {
    default: 'Correbin Asociados | Seguros de empresa y gerencia de riesgos',
    template: '%s',
  },
  description:
    'Correduría especializada en empresas, flotas, transporte, agroindustria y gerencia de riesgos. Revisión técnica, negociación y gestión de siniestros.',
  alternates: { canonical: '/seguros' },
  openGraph: {
    siteName: 'Correbin Asociados',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
};

/**
 * Datos estructurados de la correduría. Solo lo confirmado: ni valoraciones,
 * ni reseñas, ni premios, ni cobertura geográfica no demostrada, que es
 * justo lo que prohíbe el Volumen VIII.
 */
const SCHEMA_ORGANIZACION = {
  '@context': 'https://schema.org',
  '@type': 'InsuranceAgency',
  name: CORREBIN_EMPRESA.nombreComercial,
  legalName: CORREBIN_EMPRESA.razonSocial,
  taxID: CORREBIN_EMPRESA.cif,
  telephone: CORREBIN_EMPRESA.telefonoTel,
  url: 'https://gesmecoenergia.com/seguros',
  parentOrganization: { '@type': 'Organization', name: 'Grupo Gesmeco' },
};

export default function SegurosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: C.fondo, color: C.texto }} className="min-h-screen flex flex-col">
      {/* Plan B sin JavaScript: Motion deja `opacity: 0` en el HTML del
          servidor, así que sin él la microsede se vería en blanco. Esto la
          devuelve a visible. */}
      <noscript>
        <style>{`[data-revelar]{opacity:1!important;transform:none!important}`}</style>
      </noscript>

      <HiloDeLectura />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA_ORGANIZACION) }}
      />

      {/* ══ Cabecera propia ══ */}
      <header className="border-b sticky top-0 z-50" style={{ background: C.fondo, borderColor: C.borde }}>
        <div className="mx-auto max-w-6xl px-5 h-20 flex items-center justify-between gap-5">
          {/* El logo, sin placa: aquí el fondo ya es blanco cálido y el texto
              negro de la marca se lee perfecto. */}
          <Link href="/seguros" className="flex flex-col gap-1 shrink-0 group">
            <LogoEmpresa
              marca={MARCAS.seguros}
              alto={34}
              placa={false}
              prioritario
              className="transition-transform duration-500 group-hover:-translate-y-0.5"
            />
            <span className="text-[9px] font-semibold tracking-[0.2em] uppercase" style={{ color: C.textoSuave }}>
              Parte de Grupo Gesmeco
            </span>
          </Link>

          <nav className="hidden xl:flex items-center gap-6 text-sm font-semibold">
            {CORREBIN_MENU.map((e) => (
              <Link key={e.href} href={e.href} className="hover:opacity-70 transition" style={{ color: C.azul }}>
                {e.texto}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`tel:${CORREBIN_EMPRESA.telefonoTel}`}
              className="hidden lg:inline-flex items-center px-3.5 py-2.5 rounded-lg text-sm font-bold border transition hover:opacity-75"
              style={{ borderColor: C.azul, color: C.azul }}
            >
              {CORREBIN_EMPRESA.telefono}
            </a>
            <Link
              href={CORREBIN_CTA.siniestro.href}
              className="hidden sm:inline-flex items-center px-3.5 py-2.5 rounded-lg text-sm font-bold border transition hover:opacity-75"
              style={{ borderColor: C.rojo, color: C.rojo }}
            >
              {CORREBIN_CTA.siniestro.texto}
            </Link>
            <Link
              href={CORREBIN_CTA.revision.href}
              className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: C.rojo }}
            >
              {CORREBIN_CTA.revision.texto}
            </Link>
          </div>
        </div>

        {/* Menú en pantallas medias y pequeñas: una sola fila desplazable, sin ocultar secciones */}
        <nav
          className="xl:hidden flex gap-5 overflow-x-auto px-5 py-2.5 text-sm font-semibold border-t"
          style={{ borderColor: C.borde }}
        >
          {CORREBIN_MENU.map((e) => (
            <Link key={e.href} href={e.href} className="whitespace-nowrap hover:opacity-70 transition" style={{ color: C.azul }}>
              {e.texto}
            </Link>
          ))}
        </nav>
      </header>

      {/* Espacio inferior en móvil para que la barra fija no tape el contenido */}
      <main className="flex-1 pb-20 md:pb-0">{children}</main>

      {/* ══ Pie propio: no repite el pie de energía ══ */}
      <footer className="border-t" style={{ background: C.azul, borderColor: C.azul }}>
        <div className="mx-auto max-w-6xl px-5 py-12 grid gap-8 md:grid-cols-4 text-white">
          <div className="md:col-span-2">
            {/* Aquí SÍ lleva placa: el pie es azul y el texto negro del logo
                desaparecería sobre él. */}
            <LogoEmpresa marca={MARCAS.seguros} alto={36} />
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white/60 mt-3">
              Correduría de seguros
            </p>
            <p className="text-sm text-white/70 mt-4 leading-relaxed">
              {CORREBIN_EMPRESA.razonSocial}
              <br />
              CIF {CORREBIN_EMPRESA.cif}
            </p>
            <div className="flex flex-wrap gap-4 mt-4">
              <a href={`tel:${CORREBIN_EMPRESA.telefonoTel}`} className="text-sm font-bold text-white hover:opacity-75 transition">
                {CORREBIN_EMPRESA.telefono}
              </a>
              <a
                href={CORREBIN_EMPRESA.whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-bold text-white hover:opacity-75 transition"
              >
                WhatsApp {CORREBIN_EMPRESA.whatsapp}
              </a>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-3">Seguros</p>
            {CORREBIN_MENU.map((e) => (
              <Link key={e.href} href={e.href} className="block text-sm text-white/80 hover:text-white transition mb-1.5">
                {e.texto}
              </Link>
            ))}
            <Link href={CORREBIN_CTA.revision.href} className="block text-sm text-white/80 hover:text-white transition mb-1.5">
              Revisión de pólizas
            </Link>
            <Link href="/seguros/particulares" className="block text-sm text-white/80 hover:text-white transition">
              Particulares
            </Link>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-3">Grupo Gesmeco</p>
            <Link href="/" className="block text-sm text-white/80 hover:text-white transition mb-1.5">
              Gesmeco Energía
            </Link>
            <Link href="/grupo" className="block text-sm text-white/80 hover:text-white transition mb-1.5">
              Asesoría Gesmeco
            </Link>
            <Link href="/grupo" className="block text-sm text-white/80 hover:text-white transition">
              Conocer el grupo
            </Link>
            <p className="text-xs font-bold uppercase tracking-widest text-white/50 mt-6 mb-3">Legal</p>
            <Link href="/seguros/informacion-legal" className="block text-sm text-white/60 hover:text-white transition mb-1.5">
              Información legal
            </Link>
            <Link href="/privacidad" className="block text-sm text-white/60 hover:text-white transition">
              Privacidad
            </Link>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-white/50">
            © {new Date().getFullYear()} {CORREBIN_EMPRESA.razonSocial} · CIF {CORREBIN_EMPRESA.cif}
          </p>
        </div>
      </footer>

      {/* ══ Barra fija en móvil: llamar, WhatsApp y siniestro (Volumen III) ══ */}
      <BarraContactoMovil />
    </div>
  );
}
