import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** Lista todos los clientes de la app (sin hash de contraseña). */
export async function GET() {
  const { data, error } = await supabase
    .from('clientes_app')
    .select('id, usuario, nombre, telefono, tarifa, precios_energia, precios_potencia, potencias_kw, activo, creado_en')
    .order('creado_en', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, clientes: data || [] });
}

/** Crea un cliente nuevo con usuario y contraseña. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { usuario, password, nombre, telefono, tarifa, precios_energia, precios_potencia, potencias_kw } = body;

    if (!usuario || !password || !nombre) {
      return NextResponse.json({ error: 'Faltan usuario, contraseña o nombre.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const token = randomBytes(32).toString('hex');

    const { data, error } = await supabase
      .from('clientes_app')
      .insert([
        {
          usuario: usuario.trim().toLowerCase(),
          password_hash,
          token,
          nombre,
          telefono: telefono || null,
          tarifa: tarifa || '2.0',
          precios_energia: precios_energia || [],
          precios_potencia: precios_potencia || [],
          potencias_kw: potencias_kw || [],
        },
      ])
      .select('id, usuario, nombre')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ese nombre de usuario ya existe.' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, cliente: data });
  } catch (e) {
    console.error('Error creando cliente:', e);
    return NextResponse.json({ error: 'Error creando el cliente.' }, { status: 500 });
  }
}

/** Actualiza datos de contrato (precios, potencias, tarifa) o resetea contraseña. */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, password, ...campos } = body;
    if (!id) {
      return NextResponse.json({ error: 'Falta el id del cliente.' }, { status: 400 });
    }

    const permitidos = ['nombre', 'telefono', 'tarifa', 'precios_energia', 'precios_potencia', 'potencias_kw', 'activo'];
    const update: Record<string, unknown> = {};
    for (const k of permitidos) {
      if (k in campos) update[k] = campos[k];
    }
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 });
      }
      update.password_hash = await bcrypt.hash(password, 10);
    }

    const { error } = await supabase.from('clientes_app').update(update).eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Error actualizando cliente:', e);
    return NextResponse.json({ error: 'Error actualizando el cliente.' }, { status: 500 });
  }
}

/** Elimina un cliente y todos sus consumos. */
export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'Falta el id del cliente.' }, { status: 400 });
  }
  const { error } = await supabase.from('clientes_app').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
