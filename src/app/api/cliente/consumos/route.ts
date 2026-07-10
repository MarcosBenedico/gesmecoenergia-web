import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Consumos mensuales gestionados por el propio cliente (autenticado por token).
 * POST: guarda o modifica el consumo de un mes de un suministro propio.
 *       Body: { token, suministro_id, anio, mes, consumos_kwh[], precios_energia?[], precios_potencia?[], notas? }
 *       El coste se recalcula igual que en el panel del gestor.
 * DELETE: borra el consumo de un mes propio. Body: { token, id }
 */

const DIAS_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const aNumeros = (v: unknown): number[] =>
  Array.isArray(v) ? v.map((n) => Number(n) || 0) : [];

function calcularCosteMes(
  consumos: number[],
  preciosEnergia: number[],
  preciosPotencia: number[],
  potencias: number[],
  mes: number
) {
  const energia = consumos.reduce((s, c, i) => s + (c || 0) * (preciosEnergia[i] || 0), 0);
  const dias = DIAS_MES[mes - 1] || 30;
  const potencia = potencias.reduce((s, kw, i) => s + (kw || 0) * (preciosPotencia[i] || 0) * dias, 0);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return { energia: r2(energia), potencia: r2(potencia), total: r2(energia + potencia) };
}

async function clientePorToken(token: string | null | undefined) {
  if (!token) return null;
  const { data } = await supabase
    .from('clientes_app')
    .select('id')
    .eq('token', token)
    .single();
  return data || null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cliente = await clientePorToken(body.token);
    if (!cliente) {
      return NextResponse.json({ error: 'Sesión caducada.' }, { status: 401 });
    }

    const { suministro_id } = body;
    const anio = parseInt(body.anio);
    const mes = parseInt(body.mes);

    if (!suministro_id) {
      return NextResponse.json({ error: 'Falta el suministro.' }, { status: 400 });
    }
    if (!anio || anio < 2000 || anio > 2100 || !mes || mes < 1 || mes > 12) {
      return NextResponse.json({ error: 'Año o mes no válido.' }, { status: 400 });
    }

    // Verificar que el suministro es del cliente
    const { data: sum } = await supabase
      .from('suministros')
      .select('id, cliente_id, precios_energia, precios_potencia, potencias_kw')
      .eq('id', suministro_id)
      .single();

    if (!sum || sum.cliente_id !== cliente.id) {
      return NextResponse.json({ error: 'Suministro no encontrado.' }, { status: 404 });
    }

    const consumos = aNumeros(body.consumos_kwh);
    if (consumos.every((c) => c === 0)) {
      return NextResponse.json({ error: 'Introduce al menos un consumo.' }, { status: 400 });
    }

    // Precios: los enviados por el cliente, o los del contrato del suministro
    const preciosEnergia = aNumeros(body.precios_energia).some((p) => p > 0)
      ? aNumeros(body.precios_energia)
      : aNumeros(sum.precios_energia);
    const preciosPotencia = aNumeros(body.precios_potencia).some((p) => p > 0)
      ? aNumeros(body.precios_potencia)
      : aNumeros(sum.precios_potencia);

    const coste = calcularCosteMes(consumos, preciosEnergia, preciosPotencia, aNumeros(sum.potencias_kw), mes);

    const { error } = await supabase.from('consumos_clientes').upsert(
      {
        cliente_id: cliente.id,
        suministro_id: sum.id,
        anio,
        mes,
        consumos_kwh: consumos,
        precios_energia: preciosEnergia,
        precios_potencia: preciosPotencia,
        coste_energia: coste.energia,
        coste_potencia: coste.potencia,
        coste_total: coste.total,
        notas: body.notas?.trim() || null,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: 'suministro_id,anio,mes' }
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, coste });
  } catch (e) {
    console.error('Error guardando consumo (cliente):', e);
    return NextResponse.json({ error: 'Error guardando el consumo.' }, { status: 500 });
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

    // Verificar propiedad
    const { data: cons } = await supabase
      .from('consumos_clientes')
      .select('id, cliente_id')
      .eq('id', id)
      .single();
    if (!cons || cons.cliente_id !== cliente.id) {
      return NextResponse.json({ error: 'Consumo no encontrado.' }, { status: 404 });
    }

    const { error } = await supabase.from('consumos_clientes').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Error borrando el consumo.' }, { status: 500 });
  }
}
