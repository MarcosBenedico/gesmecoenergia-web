/**
 * CORREBIN · Medición y atribución (Volúmenes VIII, X y XI).
 *
 * Dos cosas distintas:
 *  · ATRIBUCIÓN: de dónde viene el contacto (utm, campaña, página de entrada).
 *    Viaja con la solicitud para que en el CRM se sepa qué funciona.
 *  · EVENTOS: nombres estables para medir oportunidades reales, no visitas.
 *
 * Regla innegociable de los volúmenes: **nunca se envían datos personales a
 * analítica**. Ni nombre, ni teléfono, ni correo, ni NIF. Solo el tipo de
 * acción, el sector y la página.
 *
 * Los eventos solo se emiten si existe una herramienta de analítica cargada y
 * consentida; mientras no la haya, esto no hace nada y no rompe nada.
 */

/** Nombres de evento fijos: cambiarlos rompe el histórico, así que están aquí. */
export const EVENTOS = {
  clicTelefono: 'correbin_clic_telefono',
  clicWhatsapp: 'correbin_clic_whatsapp',
  inicioRevision: 'correbin_inicio_revision',
  envioRevision: 'correbin_envio_revision',
  inicioSiniestro: 'correbin_inicio_siniestro',
  envioSiniestro: 'correbin_envio_siniestro',
  envioContacto: 'correbin_envio_contacto',
  seleccionSector: 'correbin_seleccion_sector',
  clicDesdeGrupo: 'correbin_clic_desde_grupo',
} as const;

type Propiedades = Record<string, string | number | boolean | undefined>;

/**
 * Emite un evento si hay analítica disponible. Sin PII: si alguien intenta
 * pasar un campo con pinta de dato personal, se descarta antes de enviarlo.
 */
const PROHIBIDOS = ['nombre', 'telefono', 'email', 'correo', 'nif', 'cif', 'direccion', 'poliza'];

export function medir(evento: string, props: Propiedades = {}) {
  if (typeof window === 'undefined') return;
  const limpias: Propiedades = {};
  for (const [k, v] of Object.entries(props)) {
    if (PROHIBIDOS.some((p) => k.toLowerCase().includes(p))) continue;
    if (v !== undefined) limpias[k] = v;
  }
  try {
    const w = window as unknown as {
      dataLayer?: unknown[];
      gtag?: (...args: unknown[]) => void;
    };
    if (typeof w.gtag === 'function') w.gtag('event', evento, limpias);
    else if (Array.isArray(w.dataLayer)) w.dataLayer.push({ event: evento, ...limpias });
  } catch {
    // La medición nunca puede tumbar la página
  }
}

/** Datos de atribución que acompañan a una solicitud (Volumen XI · CRM). */
export function atribucion(): { origen: string; campana: string } {
  if (typeof window === 'undefined') return { origen: '', campana: '' };
  try {
    const p = new URLSearchParams(window.location.search);
    const utmFuente = p.get('utm_source');
    const utmCampana = p.get('utm_campaign') || p.get('utm_medium') || '';
    // Sin UTM, sirve de dónde llegó: buscador, enlace de otra web o directo
    const referente = document.referrer;
    let origen = utmFuente || '';
    if (!origen) {
      if (!referente) origen = 'directo';
      else {
        const host = new URL(referente).hostname.replace('www.', '');
        origen = host === window.location.hostname ? 'web-del-grupo' : host;
      }
    }
    return { origen: origen.slice(0, 120), campana: utmCampana.slice(0, 120) };
  } catch {
    return { origen: '', campana: '' };
  }
}
