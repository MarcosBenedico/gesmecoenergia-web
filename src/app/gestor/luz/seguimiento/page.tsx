import { redirect } from 'next/navigation';

/**
 * Seguimiento vive ahora dentro de Pipeline, en la pestaña «Parados».
 *
 * Esta redirección se queda: la pantalla estuvo publicada y Marcos pudo
 * guardarse el enlace en el móvil. Romper un enlace que alguien ya tiene en
 * la pantalla de inicio es la forma más rápida de que deje de usar algo.
 */
export default function SeguimientoRedirige() {
  redirect('/gestor/luz/pipeline?vista=parados');
}
