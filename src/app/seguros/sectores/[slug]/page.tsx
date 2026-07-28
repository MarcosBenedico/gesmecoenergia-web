import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SECTORES, buscarSector } from '@/lib/correbin-catalogo';
import { PaginaFicha } from '../../ficha';

/** Una página por sector, cada una con su contenido y sus metadatos (Vol. VI y VIII). */

export function generateStaticParams() {
  return SECTORES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const ficha = buscarSector(slug);
  if (!ficha) return {};
  return {
    title: ficha.metaTitulo,
    description: ficha.metaDescripcion,
    alternates: { canonical: `/seguros/sectores/${ficha.slug}` },
    openGraph: {
      title: ficha.metaTitulo,
      description: ficha.metaDescripcion,
      url: `/seguros/sectores/${ficha.slug}`,
      type: 'website',
    },
  };
}

export default async function SectorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ficha = buscarSector(slug);
  if (!ficha) notFound();
  return <PaginaFicha ficha={ficha} tipo="sector" />;
}
