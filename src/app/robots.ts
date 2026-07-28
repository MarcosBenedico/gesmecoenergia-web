import type { MetadataRoute } from 'next';

/**
 * El panel de gestión y las APIs no se indexan. La web pública, sí.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/gestor', '/gestor/', '/api/', '/cliente', '/setup'],
      },
    ],
    sitemap: 'https://gesmecoenergia.com/sitemap.xml',
  };
}
