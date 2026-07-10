/**
 * Setup del sistema de documentos de cliente.
 * GET /api/setup-documentos
 *
 * Verifica que la tabla documentos_cliente y el bucket documentos_clientes existen.
 * Si falta el bucket y hay SUPABASE_SERVICE_ROLE_KEY configurada, lo crea automáticamente.
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const BUCKET = 'documentos_clientes';

export async function GET() {
  const resultados: { paso: string; ok: boolean; detalle?: string }[] = [];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabaseAnon = createClient(url, anonKey);
  const supabaseAdmin = serviceKey ? createClient(url, serviceKey) : null;

  // 1. Verificar tabla documentos_cliente
  const { error: errTabla } = await supabaseAnon
    .from('documentos_cliente')
    .select('id')
    .limit(1);

  resultados.push({
    paso: 'Tabla documentos_cliente',
    ok: !errTabla,
    detalle: errTabla
      ? `${errTabla.message} → ejecuta supabase_documentos.sql en el SQL Editor de Supabase.`
      : 'Existe.',
  });

  // 2. Verificar bucket (con la clave más potente disponible)
  const storageClient = supabaseAdmin || supabaseAnon;
  const { data: bucketInfo, error: errBucket } = await storageClient.storage.getBucket(BUCKET);

  let bucketOk = !errBucket && !!bucketInfo;
  let detalleBucket = bucketOk ? 'Existe.' : errBucket?.message;

  // 3. Si falta el bucket, intentar crearlo (solo posible con service role key)
  if (!bucketOk) {
    if (supabaseAdmin) {
      const { error: errCrear } = await supabaseAdmin.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: 50 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      });
      if (!errCrear) {
        bucketOk = true;
        detalleBucket = 'Creado automáticamente (privado, 50 MB máx, JPEG/PNG/WebP/PDF).';
      } else {
        detalleBucket = `No se pudo crear: ${errCrear.message}`;
      }
    } else {
      detalleBucket =
        'No existe y falta SUPABASE_SERVICE_ROLE_KEY para crearlo automáticamente. ' +
        'Opción A: añade la clave en .env.local / Vercel y vuelve a llamar a este endpoint. ' +
        `Opción B: créalo a mano en Supabase → Storage → New bucket → "${BUCKET}" (privado).`;
    }
  }

  resultados.push({ paso: `Bucket ${BUCKET}`, ok: bucketOk, detalle: detalleBucket });

  const todoOk = resultados.every((r) => r.ok);

  return NextResponse.json({
    ok: todoOk,
    resultados,
    instruccion: todoOk
      ? 'Sistema de documentos listo. Los clientes ya pueden subir archivos.'
      : 'Revisa los pasos marcados con ok:false.',
  });
}
