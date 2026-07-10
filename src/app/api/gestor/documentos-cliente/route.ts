import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { servirDocumento } from '@/lib/documentos-storage';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Sin archivo_path en el listado: puede contener el archivo entero (respaldo en BD)
const CAMPOS_LISTA =
  'id, nombre_original, tipo_documento, descripcion, tamano_bytes, mime_type, creado_en, analizado, notas_analisis';

/**
 * GET: Lista documentos de un cliente (para el asesor).
 *      Con ?descargar={id} devuelve el archivo en sí.
 * PUT: Actualiza notas de análisis del documento.
 */

export async function GET(req: NextRequest) {
  try {
    const clienteId = req.nextUrl.searchParams.get('cliente_id');
    const descargar = req.nextUrl.searchParams.get('descargar');

    // ── Modo descarga ──
    if (descargar) {
      const { data: doc } = await supabase
        .from('documentos_cliente')
        .select('archivo_path, mime_type, nombre_original')
        .eq('id', descargar)
        .single();
      if (!doc) {
        return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 });
      }
      return servirDocumento(doc.archivo_path, doc.mime_type, doc.nombre_original);
    }

    if (!clienteId) {
      return NextResponse.json({ error: 'Falta cliente_id.' }, { status: 400 });
    }

    const { data: docs, error: errDocs } = await supabase
      .from('documentos_cliente')
      .select(CAMPOS_LISTA)
      .eq('cliente_id', clienteId)
      .order('creado_en', { ascending: false });

    if (errDocs) {
      return NextResponse.json({ error: errDocs.message }, { status: 500 });
    }

    const docs_con_url = (docs || []).map((doc) => ({
      ...doc,
      url_descarga: `/api/gestor/documentos-cliente?descargar=${doc.id}`,
      tamano_kb: Math.round((doc.tamano_bytes || 0) / 1024),
    }));

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
