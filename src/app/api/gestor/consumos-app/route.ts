import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DIAS_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const aLista = (v: unknown): number[] =>
  Array.isArray(v) ? v.map((n) => Number(n) || 0) : isNaN(Number(v)) || v == null ? [] : [Number(v)];

/** Calcula el coste del mes con los precios del suministro. */
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
 * Guarda consumos mensuales.
 * Body: { filas: [{ suministro_id? | cups? | usuario?, anio, mes, consumos_kwh, precios_energia?, precios_potencia?, notas? }] }
 * Resolución del suministro: por suministro_id, por CUPS, o por usuario (si el cliente
 * tiene un único suministro). El coste se calcula con los precios del mes o los del suministro.
 */
export async function POST(req: NextRequest) {
  try {
    const { filas } = await req.json();
    if (!Array.isArray(filas) || filas.length === 0) {
      return NextResponse.json({ error: 'No hay filas que guardar.' }, { status: 400 });
    }

    const { data: suministros, error: errSum } = await supabase
      .from('suministros')
      .select('id, cliente_id, cups, tarifa, precios_energia, precios_potencia, potencias_kw, clientes_app(usuario)');
    if (errSum) {
      return NextResponse.json({ error: errSum.message }, { status: 500 });
    }

    const lista = (suministros || []).map((s: any) => ({
      ...s,
      usuario: s.clientes_app?.usuario || '',
    }));
    const porId = new Map(lista.map((s) => [s.id, s]));
    const porCups = new Map(lista.map((s) => [s.cups, s]));

    const errores: string[] = [];
    let guardadas = 0;

    for (const fila of filas) {
      let sum: any = null;
      if (fila.suministro_id) {
        sum = porId.get(fila.suministro_id);
      } else if (fila.cups) {
        sum = porCups.get(String(fila.cups).trim().toUpperCase().replace(/\s+/g, ''));
      } else if (fila.usuario) {
        const usuario = String(fila.usuario).trim().toLowerCase();
        const delUsuario = lista.filter((s) => s.usuario === usuario);
        if (delUsuario.length === 1) {
          sum = delUsuario[0];
        } else if (delUsuario.length > 1) {
          errores.push(`${usuario} ${fila.anio}/${fila.mes}: tiene ${delUsuario.length} suministros, indica el CUPS`);
          continue;
        }
      }

      if (!sum) {
        errores.push(`Fila ${fila.cups || fila.usuario || fila.suministro_id || '?'}: suministro no encontrado`);
        continue;
      }

      const anio = parseInt(fila.anio);
      const mes = parseInt(fila.mes);
      if (!anio || !mes || mes < 1 || mes > 12) {
        errores.push(`${sum.cups} ${fila.anio}/${fila.mes}: año o mes no válido`);
        continue;
      }

      const consumos: number[] = (fila.consumos_kwh || []).map((n: unknown) => Number(n) || 0);

      // Precio del mes: el enviado en la fila, o el del suministro
      const preciosEnergiaMes = fila.precios_energia?.length
        ? aLista(fila.precios_energia)
        : aLista(sum.precios_energia);
      const preciosPotenciaMes = fila.precios_potencia?.length
        ? aLista(fila.precios_potencia)
        : aLista(sum.precios_potencia);

      const coste = calcularCosteMes(consumos, preciosEnergiaMes, preciosPotenciaMes, aLista(sum.potencias_kw), mes);

      const { error } = await supabase.from('consumos_clientes').upsert(
        {
          cliente_id: sum.cliente_id,
          suministro_id: sum.id,
          anio,
          mes,
          consumos_kwh: consumos,
          precios_energia: preciosEnergiaMes,
          precios_potencia: preciosPotenciaMes,
          coste_energia: coste.energia,
          coste_potencia: coste.potencia,
          coste_total: coste.total,
          notas: fila.notas || null,
          actualizado_en: new Date().toISOString(),
        },
        { onConflict: 'suministro_id,anio,mes' }
      );

      if (error) {
        errores.push(`${sum.cups} ${anio}/${mes}: ${error.message}`);
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

/** Consumos de un suministro (o de todo un cliente). */
export async function GET(req: NextRequest) {
  const suministroId = req.nextUrl.searchParams.get('suministro_id');
  const clienteId = req.nextUrl.searchParams.get('cliente_id');
  if (!suministroId && !clienteId) {
    return NextResponse.json({ error: 'Falta suministro_id o cliente_id.' }, { status: 400 });
  }

  let query = supabase
    .from('consumos_clientes')
    .select('id, suministro_id, anio, mes, consumos_kwh, precios_energia, precios_potencia, coste_energia, coste_potencia, coste_total, notas')
    .order('anio', { ascending: false })
    .order('mes', { ascending: false });

  query = suministroId ? query.eq('suministro_id', suministroId) : query.eq('cliente_id', clienteId!);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, consumos: data || [] });
}

/** Borra el consumo de un mes. */
export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
  const { error } = await supabase.from('consumos_clientes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
