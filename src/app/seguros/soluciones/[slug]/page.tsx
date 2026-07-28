import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SOLUCIONES, buscarSolucion } from '@/lib/correbin-catalogo';
import { PaginaFicha } from '../../ficha';

/** Una página por solución, organizada por riesgo y no por catálogo (Vol. VII). */

export function generateStaticParams() {
  return SOLUCIONES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const ficha = buscarSolucion(slug);
  if (!ficha) return {};
  return {
    title: ficha.metaTitulo,
    description: ficha.metaDescripcion,
    alternates: { canonical: `/seguros/soluciones/${ficha.slug}` },
    openGraph: {
      title: ficha.metaTitulo,
      description: ficha.metaDescripcion,
      url: `/seguros/soluciones/${ficha.slug}`,
      type: 'website',
    },
  };
}

export default async function SolucionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ficha = buscarSolucion(slug);
  if (!ficha) notFound();
  return <PaginaFicha ficha={ficha} tipo="solucion" />;
}
