import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CAMPOS = 'id, cliente_id, cups, alias, direccion, tarifa, precios_energia, precios_potencia, potencias_kw, activo, creado_en';

/** Lista los suministros de un cliente. */
export async function GET(req: NextRequest) {
  const clienteId = req.nextUrl.searchParams.get('cliente_id');
  if (!clienteId) {
    return NextResponse.json({ error: 'Falta cliente_id.' }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('suministros')
    .select(CAMPOS)
    .eq('cliente_id', clienteId)
    .order('creado_en', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, suministros: data || [] });
}

/** Crea un suministro nuevo para un cliente. El CUPS es obligatorio. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cliente_id, cups, alias, direccion, tarifa, precios_energia, precios_potencia, potencias_kw } = body;

    if (!cliente_id || !cups?.trim()) {
      return NextResponse.json({ error: 'Faltan el cliente o el código CUPS.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('suministros')
      .insert([
        {
          cliente_id,
          cups: cups.trim().toUpperCase().replace(/\s+/g, ''),
          alias: alias?.trim() || null,
          direccion: direccion?.trim() || null,
          tarifa: tarifa || '2.0',
          precios_energia: precios_energia || [],
          precios_potencia: precios_potencia || [],
          potencias_kw: potencias_kw || [],
        },
      ])
      .select(CAMPOS)
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ese CUPS ya está registrado en otro suministro.' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, suministro: data });
  } catch (e) {
    console.error('Error creando suministro:', e);
    return NextResponse.json({ error: 'Error creando el suministro.' }, { status: 500 });
  }
}

/** Actualiza un suministro (CUPS, alias, tarifa, precios, potencias). */
export async function PUT(req: NextRequest) {
  try {
    const { id, ...campos } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });

    const permitidos = ['cups', 'alias', 'direccion', 'tarifa', 'precios_energia', 'precios_potencia', 'potencias_kw', 'activo'];
    const update: Record<string, unknown> = {};
    for (const k of permitidos) {
      if (k in campos) update[k] = k === 'cups' ? String(campos[k]).trim().toUpperCase().replace(/\s+/g, '') : campos[k];
    }

    const { error } = await supabase.from('suministros').update(update).eq('id', id);
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ese CUPS ya está registrado en otro suministro.' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Error actualizando el suministro.' }, { status: 500 });
  }
}

/** Elimina un suministro y sus consumos. */
export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
  const { error } = await supabase.from('suministros').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
