import type { MetadataRoute } from 'next';
import { SECTORES, SOLUCIONES } from '@/lib/correbin-catalogo';

/**
 * Mapa del sitio. Solo rutas públicas e indexables: el panel de gestión y las
 * páginas privadas quedan fuera (criterio del Volumen VIII).
 */

const BASE = 'https://gesmecoenergia.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const ahora = new Date();

  const web = [
    '', '/servicios', '/sectores', '/grupo', '/sobre-nosotros',
    '/contacto', '/recursos', '/analizador', '/aviso-legal', '/privacidad',
  ];

  const seguros = [
    '/seguros',
    '/seguros/empresas',
    '/seguros/gerencia-de-riesgos',
    '/seguros/sectores',
    '/seguros/soluciones',
    '/seguros/revision-de-polizas',
    '/seguros/siniestros',
    '/seguros/particulares',
    '/seguros/nosotros',
    '/seguros/contacto',
    '/seguros/informacion-legal',
    ...SECTORES.map((s) => `/seguros/sectores/${s.slug}`),
    ...SOLUCIONES.map((s) => `/seguros/soluciones/${s.slug}`),
  ];

  return [
    ...web.map((ruta) => ({
      url: `${BASE}${ruta}`,
      lastModified: ahora,
      changeFrequency: 'monthly' as const,
      priority: ruta === '' ? 1 : 0.7,
    })),
    ...seguros.map((ruta) => ({
      url: `${BASE}${ruta}`,
      lastModified: ahora,
      changeFrequency: 'monthly' as const,
      priority: ruta === '/seguros' ? 0.9 : 0.7,
    })),
  ];
}
