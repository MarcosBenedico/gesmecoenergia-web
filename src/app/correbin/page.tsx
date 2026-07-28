import { redirect } from 'next/navigation';

/**
 * La microsede vive en /seguros (Volumen III). Esta ruta existía antes y se
 * mantiene redirigiendo para no dejar enlaces rotos a quien ya la tuviera.
 */
export default function CorrebinRedirige() {
  redirect('/seguros');
}
