import { NextRequest, NextResponse } from 'next/server';
import { supabaseAnon } from '@/lib/supabase-servidor';
import bcrypt from 'bcryptjs';


export async function POST(req: NextRequest) {
  try {
    const { usuario, password } = await req.json();
    if (!usuario || !password) {
      return NextResponse.json({ error: 'Introduce usuario y contraseña.' }, { status: 400 });
    }

    const { data: cliente, error } = await supabaseAnon()
      .from('clientes_app')
      .select('id, usuario, password_hash, token, nombre, tarifa, activo')
      .eq('usuario', usuario.trim().toLowerCase())
      .single();

    if (error || !cliente || !cliente.activo) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos.' }, { status: 401 });
    }

    // Contraseña encriptada (bcrypt) o escrita a mano en Supabase (texto plano)
    const esBcrypt = cliente.password_hash?.startsWith('$2');
    const ok = esBcrypt
      ? await bcrypt.compare(password, cliente.password_hash)
      : password === cliente.password_hash;
    if (!ok) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos.' }, { status: 401 });
    }

    // Si el token está vacío o es débil (metido a mano), generar uno seguro
    let token = cliente.token;
    if (!token || token.length < 32) {
      token = (await import('crypto')).randomBytes(32).toString('hex');
      await supabaseAnon().from('clientes_app').update({ token }).eq('id', cliente.id);
    }

    return NextResponse.json({
      ok: true,
      token,
      nombre: cliente.nombre,
      usuario: cliente.usuario,
    });
  } catch (e) {
    console.error('Error en login cliente:', e);
    return NextResponse.json({ error: 'Error al iniciar sesión.' }, { status: 500 });
  }
}
