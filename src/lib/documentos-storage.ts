import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Almacenamiento de documentos de cliente con doble vía:
 * - Supabase Storage (bucket `documentos_clientes`) cuando está disponible.
 * - Respaldo en la propia BD: archivo_path = `db:{timestamp}:{base64}`.
 * Así la subida funciona aunque el bucket no exista todavía.
 */

export const BUCKET_DOCUMENTOS = 'documentos_clientes';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const esDocumentoEnBD = (archivo_path: string) => archivo_path.startsWith('db:');

/** Devuelve el archivo: stream directo si está en BD, redirect a URL firmada si está en Storage. */
export async function servirDocumento(archivo_path: string, mime_type: string, nombre: string) {
  if (esDocumentoEnBD(archivo_path)) {
    const base64 = archivo_path.slice(archivo_path.indexOf(':', 3) + 1);
    const buffer = Buffer.from(base64, 'base64');
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': mime_type || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${encodeURIComponent(nombre)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  }
  const { data } = await supabaseAdmin.storage
    .from(BUCKET_DOCUMENTOS)
    .createSignedUrl(archivo_path, 3600);
  if (data?.signedUrl) {
    return NextResponse.redirect(data.signedUrl);
  }
  return NextResponse.json({ error: 'No se pudo recuperar el archivo.' }, { status: 500 });
}
