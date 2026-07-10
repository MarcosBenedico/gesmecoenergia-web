import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Suministros gestionados por el propio cliente (autenticado por token).
 * POST: crea un suministro (CUPS obligatorio; precios y potencias opcionales).
 * PUT: modifica un suministro propio (alias, tarifa, precios, potencias...).
 * DELETE: desactiva un suministro propio (no borra datos, activo=false).
 */

async function clientePorToken(token: string | null | undefined) {
  if (!token) return null;
  const { data } = await supabase
    .from('clientes_app')
    .select('id, nombre, usuario')
    .eq('token', token)
    .single();
  return data || null;
}

const normCups = (c: unknown) => String(c || '').trim().toUpperCase().replace(/\s+/g, '');

const aNumeros = (v: unknown): number[] =>
  Array.isArray(v) ? v.map((n) => Number(n) || 0) : [];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cliente = await clientePorToken(body.token);
    if (!cliente) {
      return NextResponse.json({ error: 'Sesión caducada.' }, { status: 401 });
    }

    const cups = normCups(body.cups);
    if (cups.length < 6) {
      return NextResponse.json({ error: 'Introduce un código CUPS válido (lo tienes en tu factura).' }, { status: 400 });
    }

    const tarifa = ['2.0', '3.0', '6.1'].includes(body.tarifa) ? body.tarifa : '2.0';

    const { data, error } = await supabase
      .from('suministros')
      .insert([
        {
          cliente_id: cliente.id,
          cups,
          alias: body.alias?.trim() || null,
          direccion: body.direccion?.trim() || null,
          tarifa,
          precios_energia: aNumeros(body.precios_energia),
          precios_potencia: aNumeros(body.precios_potencia),
          potencias_kw: aNumeros(body.potencias_kw),
        },
      ])
      .select('id, cups, alias, direccion, tarifa, precios_energia, precios_potencia, potencias_kw')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ese CUPS ya está registrado.' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, suministro: data }, { status: 201 });
  } catch (e) {
    console.error('Error creando suministro (cliente):', e);
    return NextResponse.json({ error: 'Error creando el suministro.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { token, id, ...campos } = await req.json();
    const cliente = await clientePorToken(token);
    if (!cliente) {
      return NextResponse.json({ error: 'Sesión caducada.' }, { status: 401 });
    }
    if (!id) return NextResponse.json({ error: 'Falta el id del suministro.' }, { status: 400 });

    // Verificar propiedad
    const { data: sum } = await supabase
      .from('suministros')
      .select('id, cliente_id')
      .eq('id', id)
      .single();
    if (!sum || sum.cliente_id !== cliente.id) {
      return NextResponse.json({ error: 'Suministro no encontrado.' }, { status: 404 });
    }

    const update: Record<string, unknown> = {};
    if ('alias' in campos) update.alias = campos.alias?.trim() || null;
    if ('direccion' in campos) update.direccion = campos.direccion?.trim() || null;
    if ('cups' in campos) {
      const cups = normCups(campos.cups);
      if (cups.length < 6) {
        return NextResponse.json({ error: 'CUPS no válido.' }, { status: 400 });
      }
      update.cups = cups;
    }
    if ('tarifa' in campos && ['2.0', '3.0', '6.1'].includes(campos.tarifa)) update.tarifa = campos.tarifa;
    if ('precios_energia' in campos) update.precios_energia = aNumeros(campos.precios_energia);
    if ('precios_potencia' in campos) update.precios_potencia = aNumeros(campos.precios_potencia);
    if ('potencias_kw' in campos) update.potencias_kw = aNumeros(campos.potencias_kw);

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No hay cambios que guardar.' }, { status: 400 });
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
    console.error('Error actualizando suministro (cliente):', e);
    return NextResponse.json({ error: 'Error actualizando el suministro.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { token, id } = await req.json();
    const cliente = await clientePorToken(token);
    if (!cliente) {
      return NextResponse.json({ error: 'Sesión caducada.' }, { status: 401 });
    }
    if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });

    // Verificar propiedad y desactivar (no borramos: los consumos históricos se conservan)
    const { data: sum } = await supabase
      .from('suministros')
      .select('id, cliente_id')
      .eq('id', id)
      .single();
    if (!sum || sum.cliente_id !== cliente.id) {
      return NextResponse.json({ error: 'Suministro no encontrado.' }, { status: 404 });
    }

    const { error } = await supabase.from('suministros').update({ activo: false }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Error eliminando el suministro.' }, { status: 500 });
  }
}
