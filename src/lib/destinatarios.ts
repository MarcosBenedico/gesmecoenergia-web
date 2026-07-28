/**
 * QUIÉN RECIBE CADA SOLICITUD DE LA WEB.
 *
 * El grupo son tres áreas y no las lleva la misma persona: Fernando se encarga
 * de todo lo de Asesoría y de Correbin (seguros), y la parte de energía la
 * lleva Marcos. Hasta ahora todo caía en el mismo buzón y había que reenviarlo
 * a mano, que es donde se pierden las cosas.
 *
 * Está en una tabla y en un solo archivo a propósito: cambiar a quién le llega
 * algo tiene que ser cambiar una línea, no buscar el correo por seis pantallas.
 */

export const CORREO_ENERGIA = 'marcos.benedico@correbin.es';
export const CORREO_ASESORIA_SEGUROS = 'fernando.adan@correbin.es';

/** Las áreas que se pueden pedir desde la web. */
export type AreaSolicitud = 'factura' | 'solar' | 'auditoria' | 'asesoria' | 'seguros' | 'otro';

interface DestinoArea {
  correo: string;
  /** Quién la atiende, para poder decírselo al cliente. */
  quien: string;
  /** Cómo se llama esto de cara al asunto del correo. */
  etiqueta: string;
}

export const DESTINOS: Record<AreaSolicitud, DestinoArea> = {
  factura:   { correo: CORREO_ENERGIA,           quien: 'Marcos',   etiqueta: 'Análisis de factura' },
  solar:     { correo: CORREO_ENERGIA,           quien: 'Marcos',   etiqueta: 'Placas solares' },
  auditoria: { correo: CORREO_ENERGIA,           quien: 'Marcos',   etiqueta: 'Auditoría energética' },
  asesoria:  { correo: CORREO_ASESORIA_SEGUROS,  quien: 'Fernando', etiqueta: 'Asesoría' },
  seguros:   { correo: CORREO_ASESORIA_SEGUROS,  quien: 'Fernando', etiqueta: 'Seguros · Correbin' },
  // Un diagnóstico sin área concreta lo atiende Fernando, que es quien reparte
  // lo que no es puramente de luz.
  otro:      { correo: CORREO_ASESORIA_SEGUROS,  quien: 'Fernando', etiqueta: 'Diagnóstico' },
};

/** A quién le toca esta solicitud. Sin área elegida, va al reparto general. */
export function destinoDe(area?: string | null): DestinoArea {
  return DESTINOS[(area || 'otro') as AreaSolicitud] || DESTINOS.otro;
}
