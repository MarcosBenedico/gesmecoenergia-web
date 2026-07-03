import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DIAS_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Calcula el coste del mes con los precios fijos del contrato del cliente. */
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

/**
 * Guarda consumos mensuales de uno o varios clientes.
 * Body: { filas: [{ cliente_id?, usuario?, anio, mes, consumos_kwh: number[], notas? }] }
 * Acepta cliente_id o nombre de usuario (para importación desde Excel).
 */
export async function POST(req: NextRequest) {
  try {
    const { filas } = await req.json();
    if (!Array.isArray(filas) || filas.length === 0) {
      return NextResponse.json({ error: 'No hay filas que guardar.' }, { status: 400 });
    }

    // Cargar todos los clientes para resolver usuario → id y calcular costes
    const { data: clientes, error: errCli } = await supabase
      .from('clientes_app')
      .select('id, usuario, precios_energia, precios_potencia, potencias_kw');
    if (errCli) {
      return NextResponse.json({ error: errCli.message }, { status: 500 });
    }

    const porId = new Map((clientes || []).map((c) => [c.id, c]));
    const porUsuario = new Map((clientes || []).map((c) => [c.usuario, c]));

    const errores: string[] = [];
    let guardadas = 0;

    for (const fila of filas) {
      const cliente = fila.cliente_id
        ? porId.get(fila.cliente_id)
        : porUsuario.get(String(fila.usuario || '').trim().toLowerCase());

      if (!cliente) {
        errores.push(`Fila ${fila.usuario || fila.cliente_id || '?'}: cliente no encontrado`);
        continue;
      }

      const anio = parseInt(fila.anio);
      const mes = parseInt(fila.mes);
      if (!anio || !mes || mes < 1 || mes > 12) {
        errores.push(`${cliente.usuario} ${fila.anio}/${fila.mes}: año o mes no válido`);
        continue;
      }

      const aLista = (v: unknown): number[] =>
        Array.isArray(v) ? v.map((n) => Number(n) || 0) : isNaN(Number(v)) ? [] : [Number(v)];

      const consumos: number[] = (fila.consumos_kwh || []).map((n: unknown) => Number(n) || 0);
      const coste = calcularCosteMes(
        consumos,
        aLista(cliente.precios_energia),
        aLista(cliente.precios_potencia),
        aLista(cliente.potencias_kw),
        mes
      );

      const { error } = await supabase.from('consumos_clientes').upsert(
        {
          cliente_id: cliente.id,
          anio,
          mes,
          consumos_kwh: consumos,
          coste_energia: coste.energia,
          coste_potencia: coste.potencia,
          coste_total: coste.total,
          notas: fila.notas || null,
          actualizado_en: new Date().toISOString(),
        },
        { onConflict: 'cliente_id,anio,mes' }
      );

      if (error) {
        errores.push(`${cliente.usuario} ${anio}/${mes}: ${error.message}`);
      } else {
        guardadas++;
      }
    }

    return NextResponse.json({ ok: true, guardadas, errores });
  } catch (e) {
    console.error('Error guardando consumos:', e);
    return NextResponse.json({ error: 'Error guardando los consumos.' }, { status: 500 });
  }
}

/** Consumos de un cliente concreto (vista del gestor). */
export async function GET(req: NextRequest) {
  const clienteId = req.nextUrl.searchParams.get('cliente_id');
  if (!clienteId) {
    return NextResponse.json({ error: 'Falta cliente_id.' }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('consumos_clientes')
    .select('id, anio, mes, consumos_kwh, coste_energia, coste_potencia, coste_total, notas')
    .eq('cliente_id', clienteId)
    .order('anio', { ascending: false })
    .order('mes', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, consumos: data || [] });
}

/** Borra el consumo de un mes. */
export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
  }
  const { error } = await supabase.from('consumos_clientes').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
