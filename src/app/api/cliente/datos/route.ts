import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const aLista = (v: unknown): number[] => {
  if (Array.isArray(v)) return v.map((n) => Number(n) || 0);
  const n = Number(v);
  return isNaN(n) || v === null || v === undefined || v === '' ? [] : [n];
};

/** Devuelve el cliente + sus suministros (con CUPS) + consumos por suministro. */
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 });
    }

    const { data: cliente, error } = await supabase
      .from('clientes_app')
      .select('id, usuario, nombre, telefono, activo')
      .eq('token', token)
      .single();

    if (error || !cliente || !cliente.activo) {
      return NextResponse.json({ error: 'Sesión caducada. Vuelve a entrar.' }, { status: 401 });
    }

    const { data: suministros } = await supabase
      .from('suministros')
      .select('id, cups, alias, direccion, tarifa, precios_energia, precios_potencia, potencias_kw, activo')
      .eq('cliente_id', cliente.id)
      .eq('activo', true)
      .order('creado_en', { ascending: true });

    const { data: consumos } = await supabase
      .from('consumos_clientes')
      .select('suministro_id, anio, mes, consumos_kwh, precios_energia, precios_potencia, coste_energia, coste_potencia, coste_total, notas')
      .eq('cliente_id', cliente.id)
      .order('anio', { ascending: false })
      .order('mes', { ascending: false });

    const suministrosNorm = (suministros || []).map((s) => ({
      ...s,
      precios_energia: aLista(s.precios_energia),
      precios_potencia: aLista(s.precios_potencia),
      potencias_kw: aLista(s.potencias_kw),
      consumos: (consumos || [])
        .filter((c) => c.suministro_id === s.id)
        .map((c) => ({
          ...c,
          consumos_kwh: aLista(c.consumos_kwh),
          precios_energia: c.precios_energia ? aLista(c.precios_energia) : null,
          precios_potencia: c.precios_potencia ? aLista(c.precios_potencia) : null,
        })),
    }));

    return NextResponse.json({
      ok: true,
      cliente: { usuario: cliente.usuario, nombre: cliente.nombre, telefono: cliente.telefono },
      suministros: suministrosNorm,
    });
  } catch (e) {
    console.error('Error cargando datos cliente:', e);
    return NextResponse.json({ error: 'Error cargando tus datos.' }, { status: 500 });
  }
}
