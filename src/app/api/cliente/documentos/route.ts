import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usar anon key para lectura (con RLS) y service role para escritura (sin RLS)
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MAX_TAMAÑO = 50 * 1024 * 1024; // 50 MB
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/**
 * GET: Lista documentos del cliente
 * POST: Sube un documento (base64)
 * DELETE: Elimina un documento
 */

export async function GET(req: NextRequest) {
  try {
    const { token } = Object.fromEntries(req.nextUrl.searchParams);
    if (!token) {
      return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 });
    }

    // Obtener cliente
    const { data: cliente, error: errCliente } = await supabaseAnon
      .from('clientes_app')
      .select('id')
      .eq('token', token)
      .single();

    if (errCliente || !cliente) {
      return NextResponse.json({ error: 'Sesión caducada.' }, { status: 401 });
    }

    // Listar documentos del cliente (usar admin para no tener RLS)
    const { data: docs, error: errDocs } = await supabaseAdmin
      .from('documentos_cliente')
      .select('id, nombre_original, tipo_documento, descripcion, tamano_bytes, mime_type, creado_en, analizado, notas_analisis, archivo_path')
      .eq('cliente_id', cliente.id)
      .order('creado_en', { ascending: false });

    if (errDocs) {
      return NextResponse.json({ error: errDocs.message }, { status: 500 });
    }

    // Generar URLs firmadas para descargar (válidas 1 hora)
    const docs_con_url = await Promise.all(
      (docs || []).map(async (doc) => {
        const { data } = await supabaseAdmin.storage
          .from('documentos_clientes')
          .createSignedUrl(doc.archivo_path, 3600);
        return {
          ...doc,
          url_descarga: data?.signedUrl || null,
        };
      })
    );

    return NextResponse.json({ ok: true, documentos: docs_con_url });
  } catch (e) {
    console.error('Error listando documentos:', e);
    return NextResponse.json({ error: 'Error cargando documentos.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token, nombre, tipo_documento, descripcion, archivo_base64, mime_type } = await req.json();

    if (!token || !nombre || !archivo_base64 || !mime_type) {
      return NextResponse.json(
        { error: 'Faltan datos: token, nombre, archivo_base64, mime_type.' },
        { status: 400 }
      );
    }

    // Validar tipo
    if (!TIPOS_PERMITIDOS.includes(mime_type)) {
      return NextResponse.json(
        { error: `Tipo no permitido. Acepta: ${TIPOS_PERMITIDOS.join(', ')}` },
        { status: 400 }
      );
    }

    // Obtener cliente (verificar sesión válida)
    const { data: cliente, error: errCliente } = await supabaseAnon
      .from('clientes_app')
      .select('id')
      .eq('token', token)
      .single();

    if (errCliente || !cliente) {
      return NextResponse.json({ error: 'Sesión caducada.' }, { status: 401 });
    }

    // Decodificar base64
    const buffer = Buffer.from(archivo_base64, 'base64');
    if (buffer.length > MAX_TAMAÑO) {
      return NextResponse.json(
        { error: `Archivo muy grande. Máximo ${MAX_TAMAÑO / 1024 / 1024} MB.` },
        { status: 413 }
      );
    }

    // Generar path único en storage
    const timestamp = Date.now();
    const nombreLimpio = nombre
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 100);
    const archivo_path = `documentos_clientes/cliente_${cliente.id}/${timestamp}_${nombreLimpio}`;

    // Subir a Storage (usar admin para permisos de escritura)
    const { error: errStorage } = await supabaseAdmin.storage
      .from('documentos_clientes')
      .upload(archivo_path, buffer, {
        contentType: mime_type,
        upsert: false,
      });

    if (errStorage) {
      console.error('Error en storage:', errStorage);
      return NextResponse.json({ error: 'No se pudo guardar el archivo.' }, { status: 500 });
    }

    // Guardar metadatos en BD (usar admin para no depender de RLS)
    const { data: doc, error: errDoc } = await supabaseAdmin
      .from('documentos_cliente')
      .insert([
        {
          cliente_id: cliente.id,
          archivo_path,
          nombre_original: nombre,
          tipo_documento: tipo_documento || 'otro',
          descripcion: descripcion || null,
          tamano_bytes: buffer.length,
          mime_type,
        },
      ])
      .select('id, nombre_original, tipo_documento, creado_en')
      .single();

    if (errDoc) {
      // Intentar limpiar el archivo subido
      await supabaseAdmin.storage
        .from('documentos_clientes')
        .remove([archivo_path]);
      return NextResponse.json({ error: errDoc.message }, { status: 500 });
    }

    return NextResponse.json(
      { ok: true, documento: doc },
      { status: 201 }
    );
  } catch (e) {
    console.error('Error subiendo documento:', e);
    return NextResponse.json({ error: 'Error subiendo el documento.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { token, id } = await req.json();

    if (!token || !id) {
      return NextResponse.json({ error: 'Faltan token o id.' }, { status: 400 });
    }

    // Verificar que el cliente es propietario (verificar sesión válida)
    const { data: cliente, error: errCliente } = await supabaseAnon
      .from('clientes_app')
      .select('id')
      .eq('token', token)
      .single();

    if (errCliente || !cliente) {
      return NextResponse.json({ error: 'Sesión caducada.' }, { status: 401 });
    }

    // Obtener el documento (usar admin para lecturas sin RLS)
    const { data: doc, error: errDoc } = await supabaseAdmin
      .from('documentos_cliente')
      .select('id, archivo_path, cliente_id')
      .eq('id', id)
      .single();

    if (errDoc || !doc || doc.cliente_id !== cliente.id) {
      return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 });
    }

    // Eliminar de storage (usar admin)
    await supabaseAdmin.storage
      .from('documentos_clientes')
      .remove([doc.archivo_path]);

    // Eliminar de BD (usar admin para no depender de RLS)
    const { error: errDelete } = await supabaseAdmin
      .from('documentos_cliente')
      .delete()
      .eq('id', id);

    if (errDelete) {
      return NextResponse.json({ error: errDelete.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Error eliminando documento:', e);
    return NextResponse.json({ error: 'Error eliminando el documento.' }, { status: 500 });
  }
}
