import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Separar un cliente en dos fichas (lo contrario de fusionar).
 *
 * POST { cliente_id, nombre_nuevo, nif_nuevo?, cups_ids[], mover_pipeline_ids[] }
 *
 * Crea una ficha nueva heredando los datos de contacto del original y le pasa
 * los CUPS elegidos con todo lo que cuelga de ellos (fechas críticas,
 * contratos, comisiones y tareas ligadas a ese suministro), más las
 * oportunidades que se indiquen.
 *
 * Hace falta cuando dos empresas distintas acabaron en la misma ficha: por una
 * importación que las juntó o por una fusión hecha por error.
 */

function clienteSupabase(req: NextRequest) {
  const auth = req.headers.get('authorization');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    auth ? { global: { headers: { Authorization: auth } } } : undefined
  );
}

/** Datos de contacto que se copian a la ficha nueva. */
const HEREDA = [
  'tipo_cliente', 'responsable', 'prioridad', 'estado_comercial',
  'origen_cliente', 'via_entrada', 'zona',
];

export async function POST(req: NextRequest) {
  const supabase = clienteSupabase(req);
  try {
    const { cliente_id, nombre_nuevo, nif_nuevo, cups_ids, mover_pipeline_ids } = await req.json();

    if (!cliente_id || !nombre_nuevo?.trim()) {
      return NextResponse.json({ error: 'Falta el cliente de origen o el nombre de la ficha nueva.' }, { status: 400 });
    }
    const cupsAMover: string[] = Array.isArray(cups_ids) ? cups_ids : [];
    const pipeAMover: string[] = Array.isArray(mover_pipeline_ids) ? mover_pipeline_ids : [];
    if (cupsAMover.length === 0 && pipeAMover.length === 0) {
      return NextResponse.json({ error: 'Elige al menos un suministro o una oportunidad para la ficha nueva.' }, { status: 400 });
    }

    const { data: original, error: eOrig } = await supabase
      .from('luz_clientes').select('*').eq('id', cliente_id).single();
    if (eOrig || !original) return NextResponse.json({ error: 'No se encontró el cliente de origen.' }, { status: 404 });

    // 1) Ficha nueva, heredando lo que tiene sentido heredar
    const nuevo: Record<string, unknown> = { nombre: String(nombre_nuevo).trim() };
    for (const campo of HEREDA) {
      const v = (original as Record<string, unknown>)[campo];
      if (v != null && v !== '') nuevo[campo] = v;
    }
    if (nif_nuevo?.trim()) nuevo.nif = String(nif_nuevo).trim();
    nuevo.observaciones =
      `[Separación ${new Date().toLocaleDateString('es-ES')}] Ficha creada al separar de "${original.nombre}", `
      + 'con la que estaba unida por error.';

    const { data: creado, error: eNuevo } = await supabase
      .from('luz_clientes').insert([nuevo]).select('id, nombre').single();
    if (eNuevo || !creado) {
      return NextResponse.json({ error: `No se pudo crear la ficha nueva: ${eNuevo?.message}` }, { status: 500 });
    }

    const movidos: Record<string, number> = {};
    const anotar = (tabla: string, n?: number | null) => { if (n) movidos[tabla] = (movidos[tabla] || 0) + n; };

    // 2) Los CUPS elegidos, con todo lo que cuelga de ellos
    if (cupsAMover.length) {
      const { data, error } = await supabase.from('luz_cups')
        .update({ cliente_id: creado.id }).in('id', cupsAMover).eq('cliente_id', cliente_id).select('id');
      if (error) return NextResponse.json({ error: `Error moviendo los suministros: ${error.message}` }, { status: 500 });
      anotar('suministros', data?.length);

      // Lo que va atado a esos CUPS se va con ellos
      for (const tabla of ['luz_fechas_criticas', 'luz_contratos', 'luz_comisiones', 'luz_tareas']) {
        const { data: hijos } = await supabase.from(tabla)
          .update({ cliente_id: creado.id }).in('cups_id', cupsAMover).select('id');
        anotar(tabla.replace('luz_', ''), hijos?.length);
      }
    }

    // 3) Las oportunidades elegidas
    if (pipeAMover.length) {
      const { data, error } = await supabase.from('luz_pipeline')
        .update({ cliente_id: creado.id }).in('id', pipeAMover).eq('cliente_id', cliente_id).select('id');
      if (error) return NextResponse.json({ error: `Error moviendo las oportunidades: ${error.message}` }, { status: 500 });
      anotar('oportunidades', data?.length);
    }

    // 4) Dejar constancia también en la ficha original
    const nota = `[Separación ${new Date().toLocaleDateString('es-ES')}] Se separó "${creado.nombre}" a su propia ficha.`;
    await supabase.from('luz_clientes').update({
      observaciones: original.observaciones?.trim() ? `${nota}\n${original.observaciones}` : nota,
      actualizado_en: new Date().toISOString(),
    }).eq('id', cliente_id);

    return NextResponse.json({ ok: true, cliente_nuevo: creado, movidos }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }
}
