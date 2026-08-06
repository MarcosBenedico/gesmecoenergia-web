import { redirect } from 'next/navigation';

/**
 * La Agenda vive ahora dentro de Mi Día, en las vistas «Por zona» y
 * «Calendario». Eran la misma lista (`construirAgenda`) con otro recorte, y
 * tenerlas separadas era justo lo que hacía que se mezclaran.
 *
 * Esta ruta se queda para no romper los enlaces que alguien tenga guardados
 * en el móvil.
 */
export default function AgendaRedirige() {
  redirect('/gestor/luz/mi-dia');
}
