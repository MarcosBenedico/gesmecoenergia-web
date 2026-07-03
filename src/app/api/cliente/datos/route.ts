import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** Devuelve los datos del cliente + todos sus consumos mensuales, autenticado por token. */
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 });
    }

    const { data: cliente, error } = await supabase
      .from('clientes_app')
      .select('id, usuario, nombre, telefono, tarifa, precios_energia, precios_potencia, potencias_kw, activo')
      .eq('token', token)
      .single();

    if (error || !cliente || !cliente.activo) {
      return NextResponse.json({ error: 'Sesión caducada. Vuelve a entrar.' }, { status: 401 });
    }

    const { data: consumos } = await supabase
      .from('consumos_clientes')
      .select('anio, mes, consumos_kwh, coste_energia, coste_potencia, coste_total, notas')
      .eq('cliente_id', cliente.id)
      .order('anio', { ascending: false })
      .order('mes', { ascending: false });

    const { id, ...clienteSinId } = cliente;
    return NextResponse.json({ ok: true, cliente: clienteSinId, consumos: consumos || [] });
  } catch (e) {
    console.error('Error cargando datos cliente:', e);
    return NextResponse.json({ error: 'Error cargando tus datos.' }, { status: 500 });
  }
}
