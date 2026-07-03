import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET: Lista documentos de un cliente específico (para el asesor)
 * PUT: Actualiza notas de análisis del documento
 */

export async function GET(req: NextRequest) {
  try {
    const clienteId = req.nextUrl.searchParams.get('cliente_id');

    if (!clienteId) {
      return NextResponse.json({ error: 'Falta cliente_id.' }, { status: 400 });
    }

    // Listar documentos del cliente con sus metadatos
    const { data: docs, error: errDocs } = await supabase
      .from('documentos_cliente')
      .select('id, nombre_original, tipo_documento, descripcion, tamano_bytes, mime_type, creado_en, analizado, notas_analisis, archivo_path')
      .eq('cliente_id', clienteId)
      .order('creado_en', { ascending: false });

    if (errDocs) {
      return NextResponse.json({ error: errDocs.message }, { status: 500 });
    }

    // Generar URLs firmadas para preview/descarga (válidas 24 horas)
    const docs_con_url = await Promise.all(
      (docs || []).map(async (doc) => {
        const { data } = await supabase.storage
          .from('documentos_clientes')
          .createSignedUrl(doc.archivo_path, 86400); // 24h
        return {
          ...doc,
          url_descarga: data?.signedUrl || null,
          tamaño_kb: Math.round(doc.tamano_bytes / 1024),
        };
      })
    );

    return NextResponse.json({
      ok: true,
      documentos: docs_con_url,
      total: docs_con_url.length,
      pendientes_analizar: docs_con_url.filter((d) => !d.analizado).length,
    });
  } catch (e) {
    console.error('Error listando documentos:', e);
    return NextResponse.json({ error: 'Error cargando documentos.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, analizado, notas_analisis } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Falta el id del documento.' }, { status: 400 });
    }

    const update: Record<string, unknown> = {
      actualizado_en: new Date().toISOString(),
    };

    if (analizado !== undefined) update.analizado = analizado;
    if (notas_analisis !== undefined) update.notas_analisis = notas_analisis || null;

    const { error } = await supabase
      .from('documentos_cliente')
      .update(update)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Error actualizando documento:', e);
    return NextResponse.json({ error: 'Error actualizando el documento.' }, { status: 500 });
  }
}
