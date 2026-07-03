import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { usuario, password } = await req.json();
    if (!usuario || !password) {
      return NextResponse.json({ error: 'Introduce usuario y contraseña.' }, { status: 400 });
    }

    const { data: cliente, error } = await supabase
      .from('clientes_app')
      .select('id, usuario, password_hash, token, nombre, tarifa, activo')
      .eq('usuario', usuario.trim().toLowerCase())
      .single();

    if (error || !cliente || !cliente.activo) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos.' }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, cliente.password_hash);
    if (!ok) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos.' }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      token: cliente.token,
      nombre: cliente.nombre,
      usuario: cliente.usuario,
    });
  } catch (e) {
    console.error('Error en login cliente:', e);
    return NextResponse.json({ error: 'Error al iniciar sesión.' }, { status: 500 });
  }
}
