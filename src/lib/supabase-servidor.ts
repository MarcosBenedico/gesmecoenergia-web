/**
 * CLIENTES DE SUPABASE DEL LADO SERVIDOR, CREADOS AL USARLOS.
 *
 * Varias rutas de API los creaban en el cuerpo del módulo:
 *
 *   const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, ...)
 *
 * Con la aplicación arrancada eso da igual. En el BUILD no: Next recorre todas
 * las rutas para recoger los datos de página, y recorrerlas **ejecuta el cuerpo
 * del módulo**. Si en ese entorno faltan las variables, `createClient` revienta
 * con «supabaseUrl is required» antes de que nadie haya llamado a la ruta, y el
 * despliegue entero se cae por una ruta que a lo mejor no usa nadie — que es
 * exactamente lo que tumbó el build del 16 de octubre de 2026.
 *
 * El `!` del final de cada variable engañaba a TypeScript y no a Node: decía
 * «esto no es nulo» sin comprobar nada.
 *
 * Creándolos aquí, **al primer uso y guardados**, el build no depende de que
 * estén las claves y cada petición sigue reutilizando el mismo cliente.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Dice QUÉ falta y DÓNDE mirarlo. «supabaseUrl is required» no sirve de nada. */
function exigir(nombre: string): string {
  const v = process.env[nombre];
  if (!v) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Se configura en Vercel (Settings → Environment Variables) y en .env.local.`
    );
  }
  return v;
}

let anon: SupabaseClient | null = null;
let admin: SupabaseClient | null = null;

/** Cliente con la clave pública: respeta RLS. Es el de casi todas las rutas. */
export function supabaseAnon(): SupabaseClient {
  if (!anon) anon = createClient(exigir('NEXT_PUBLIC_SUPABASE_URL'), exigir('NEXT_PUBLIC_SUPABASE_ANON_KEY'));
  return anon;
}

/**
 * Cliente con la service role: se salta RLS, así que solo para lo que de verdad
 * lo necesita (Storage y escrituras de servicio). Si no hay service role cae a
 * la anónima, que es lo que ya hacían las rutas que la usan.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!admin) {
    admin = createClient(
      exigir('NEXT_PUBLIC_SUPABASE_URL'),
      process.env.SUPABASE_SERVICE_ROLE_KEY || exigir('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    );
  }
  return admin;
}
