import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { servirDocumento, esDocumentoEnBD, BUCKET_DOCUMENTOS } from '@/lib/documentos-storage';

// Anon key para verificar sesión; service role (si existe) para Storage/BD sin RLS
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BUCKET = BUCKET_DOCUMENTOS;
// Vercel limita el body a ~4,5 MB, así que el límite real de subida es ese.
const MAX_TAMANO = 4.5 * 1024 * 1024;
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const EMAIL_AVISOS = 'marcos.benedico@correbin.es';

// Campos de listado: NUNCA incluir archivo_path (puede contener el archivo entero en base64)
const CAMPOS_LISTA =
  'id, nombre_original, tipo_documento, descripcion, tamano_bytes, mime_type, creado_en, analizado, notas_analisis';

/** Aviso por email al gestor (FormSubmit). No bloquea la respuesta. */
async function avisarNuevoDocumento(datos: {
  nombre_cliente: string;
  usuario: string;
  nombre_doc: string;
  tipo: string;
  tamano: number;
  descripcion: string | null;
}) {
  try {
    const mb = (datos.tamano / (1024 * 1024)).toFixed(2);
    await fetch(`https://formsubmit.co/ajax/${EMAIL_AVISOS}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: 'https://gesmecoenergia-web.vercel.app',
        Referer: 'https://gesmecoenergia-web.vercel.app/cliente',
      },
      body: JSON.stringify({
        _subject: `📄 ${datos.nombre_cliente} ha subido un documento: ${datos.nombre_doc}`,
        _template: 'box',
        mensaje: [
          `NUEVO DOCUMENTO DE CLIENTE · ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}`,
          ``,
          `Cliente: ${datos.nombre_cliente} (${datos.usuario})`,
          `Documento: ${datos.nombre_doc}`,
          `Tipo: ${datos.tipo}`,
          `Tamaño: ${mb} MB`,
          datos.descripcion ? `Notas del cliente: ${datos.descripcion}` : `Sin notas.`,
          ``,
          `Revísalo en el panel de gestión → Clientes App → documentos.`,
        ].join('\n'),
      }),
    });
  } catch (e) {
    console.error('Error avisando nuevo documento:', e);
  }
}

async function clientePorToken(token: string | null | undefined) {
  if (!token) return null;
  const { data } = await supabaseAnon
    .from('clientes_app')
    .select('id, nombre, usuario')
    .eq('token', token)
    .single();
  return data || null;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    const descargar = req.nextUrl.searchParams.get('descargar');

    const cliente = await clientePorToken(token);
    if (!cliente) {
      return NextResponse.json({ error: 'Sesión caducada.' }, { status: 401 });
    }

    // ── Modo descarga: devuelve el archivo en sí ──
    if (descargar) {
      const { data: doc } = await supabaseAdmin
        .from('documentos_cliente')
        .select('archivo_path, mime_type, nombre_original, cliente_id')
        .eq('id', descargar)
        .single();
      if (!doc || doc.cliente_id !== cliente.id) {
        return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 });
      }
      return servirDocumento(doc.archivo_path, doc.mime_type, doc.nombre_original);
    }

    // ── Modo listado ──
    const { data: docs, error: errDocs } = await supabaseAdmin
      .from('documentos_cliente')
      .select(CAMPOS_LISTA)
      .eq('cliente_id', cliente.id)
      .order('creado_en', { ascending: false });

    if (errDocs) {
      return NextResponse.json({ error: errDocs.message }, { status: 500 });
    }

    const docs_con_url = (docs || []).map((doc) => ({
      ...doc,
      url_descarga: `/api/cliente/documentos?token=${encodeURIComponent(token!)}&descargar=${doc.id}`,
    }));

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

    if (!TIPOS_PERMITIDOS.includes(mime_type)) {
      return NextResponse.json(
        { error: 'Tipo no permitido. Acepta: JPG, PNG, WebP y PDF.' },
        { status: 400 }
      );
    }

    const cliente = await clientePorToken(token);
    if (!cliente) {
      return NextResponse.json({ error: 'Sesión caducada.' }, { status: 401 });
    }

    const buffer = Buffer.from(archivo_base64, 'base64');
    if (buffer.length > MAX_TAMANO) {
      return NextResponse.json(
        { error: 'Archivo muy grande. Máximo 4 MB (las fotos se comprimen solas; los PDF no).' },
        { status: 413 }
      );
    }
    if (buffer.length === 0) {
      return NextResponse.json({ error: 'El archivo está vacío.' }, { status: 400 });
    }

    const timestamp = Date.now();
    const nombreLimpio = nombre.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
    const pathStorage = `cliente_${cliente.id}/${timestamp}_${nombreLimpio}`;

    // ── 1º intento: Supabase Storage ──
    let archivo_path = pathStorage;
    let guardadoEn: 'storage' | 'db' = 'storage';
    const { error: errStorage } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(pathStorage, buffer, { contentType: mime_type, upsert: false });

    if (errStorage) {
      // ── Respaldo: guardar el contenido en la propia base de datos ──
      console.warn('Storage no disponible, usando respaldo en BD:', errStorage.message);
      archivo_path = `db:${timestamp}:${archivo_base64}`;
      guardadoEn = 'db';
    }

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
      if (guardadoEn === 'storage') {
        await supabaseAdmin.storage.from(BUCKET).remove([pathStorage]);
      }
      return NextResponse.json({ error: errDoc.message }, { status: 500 });
    }

    // Aviso al gestor en segundo plano
    avisarNuevoDocumento({
      nombre_cliente: cliente.nombre || cliente.usuario,
      usuario: cliente.usuario,
      nombre_doc: nombre,
      tipo: tipo_documento || 'otro',
      tamano: buffer.length,
      descripcion: descripcion || null,
    });

    return NextResponse.json({ ok: true, documento: doc, guardado_en: guardadoEn }, { status: 201 });
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

    const cliente = await clientePorToken(token);
    if (!cliente) {
      return NextResponse.json({ error: 'Sesión caducada.' }, { status: 401 });
    }

    const { data: doc, error: errDoc } = await supabaseAdmin
      .from('documentos_cliente')
      .select('id, archivo_path, cliente_id')
      .eq('id', id)
      .single();

    if (errDoc || !doc || doc.cliente_id !== cliente.id) {
      return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 });
    }

    // Si está en Storage, borrar también el archivo
    if (!esDocumentoEnBD(doc.archivo_path)) {
      await supabaseAdmin.storage.from(BUCKET).remove([doc.archivo_path]);
    }

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
