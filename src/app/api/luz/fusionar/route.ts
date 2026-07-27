import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Fusión de clientes duplicados (módulo Luz).
 * POST { principal_id, duplicado_id }
 *  1. Todo lo del duplicado (CUPS, pipeline, contratos, comisiones, tareas,
 *     fechas críticas, visitas, proyectos) pasa al cliente principal.
 *  2. Los datos de contacto del principal se completan con los del duplicado
 *     (solo los huecos: nunca se pisa un dato ya relleno).
 *  3. Las observaciones del duplicado se conservan añadidas a las del principal.
 *  4. El duplicado se elimina (queda registrado en la auditoría).
 */

function clienteSupabase(req: NextRequest) {
  const auth = req.headers.get('authorization');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    auth ? { global: { headers: { Authorization: auth } } } : undefined
  );
}

// Tablas hijas con columna cliente_id que hay que reasignar
const TABLAS_HIJAS = [
  'luz_cups', 'luz_pipeline', 'luz_contratos', 'luz_comisiones',
  'luz_tareas', 'luz_fechas_criticas', 'luz_visitas', 'luz_proyectos',
];

// Campos del cliente que se completan si el principal los tiene vacíos
const CAMPOS_COMPLETAR = [
  'nif', 'persona_contacto', 'telefono', 'email', 'direccion_fiscal',
  'potencial_comercial', 'origen_cliente', 'via_entrada', 'proxima_accion', 'fecha_proxima_accion',
];

export async function POST(req: NextRequest) {
  const supabase = clienteSupabase(req);
  try {
    const { principal_id, duplicado_id } = await req.json();
    if (!principal_id || !duplicado_id || principal_id === duplicado_id) {
      return NextResponse.json({ error: 'Indica el cliente principal y el duplicado (distintos).' }, { status: 400 });
    }

    const { data: principal, error: e1 } = await supabase.from('luz_clientes').select('*').eq('id', principal_id).single();
    const { data: duplicado, error: e2 } = await supabase.from('luz_clientes').select('*').eq('id', duplicado_id).single();
    if (e1 || !principal) return NextResponse.json({ error: 'No se encontró el cliente principal.' }, { status: 404 });
    if (e2 || !duplicado) return NextResponse.json({ error: 'No se encontró el cliente duplicado.' }, { status: 404 });

    // 1) Reasignar todo lo colgado del duplicado al principal
    const movidos: Record<string, number> = {};
    for (const tabla of TABLAS_HIJAS) {
      const { data, error } = await supabase
        .from(tabla)
        .update({ cliente_id: principal_id })
        .eq('cliente_id', duplicado_id)
        .select('id');
      // Tabla inexistente en este proyecto (p. ej. visitas sin migrar) → se salta
      if (error && !/does not exist|Could not find the table/i.test(error.message)) {
        return NextResponse.json({ error: `Error moviendo ${tabla}: ${error.message}` }, { status: 500 });
      }
      if (data?.length) movidos[tabla] = data.length;
    }

    // 2) Completar huecos del principal + conservar observaciones del duplicado
    const cambios: Record<string, unknown> = {};
    for (const campo of CAMPOS_COMPLETAR) {
      const vP = (principal as Record<string, unknown>)[campo];
      const vD = (duplicado as Record<string, unknown>)[campo];
      if ((vP == null || vP === '') && vD != null && vD !== '') cambios[campo] = vD;
    }
    if (duplicado.observaciones?.trim()) {
      const nota = `[Fusión ${new Date().toLocaleDateString('es-ES')}] Notas de la ficha duplicada "${duplicado.nombre}":\n${duplicado.observaciones}`;
      cambios.observaciones = principal.observaciones?.trim() ? `${principal.observaciones}\n${nota}` : nota;
    }
    // La fecha de último contacto más reciente gana
    if (duplicado.fecha_ultimo_contacto && (!principal.fecha_ultimo_contacto || duplicado.fecha_ultimo_contacto > principal.fecha_ultimo_contacto)) {
      cambios.fecha_ultimo_contacto = duplicado.fecha_ultimo_contacto;
    }
    if (Object.keys(cambios).length > 0) {
      cambios.actualizado_en = new Date().toISOString();
      const { error } = await supabase.from('luz_clientes').update(cambios).eq('id', principal_id);
      if (error) return NextResponse.json({ error: `Error completando la ficha principal: ${error.message}` }, { status: 500 });
    }

    // 3) El duplicado se va a la papelera, no se borra.
    // Sus datos ya están movidos al principal, así que no debería quedar nada
    // colgando; pero si alguna reasignación hubiera fallado en silencio, un
    // borrado real habría disparado el ON DELETE CASCADE y se habría llevado
    // esos registros para siempre. Así siempre se puede deshacer.
    const { data: usuario } = await supabase.auth.getUser();
    const { error: eDel } = await supabase.from('luz_clientes').update({
      borrado_en: new Date().toISOString(),
      borrado_por: usuario.user?.email || null,
      motivo_borrado: `Fusionada en "${principal.nombre}"`,
    }).eq('id', duplicado_id);
    if (eDel) {
      // Sin las columnas de papelera todavía: se borra como antes, pero avisando
      if (/borrado_en/i.test(eDel.message)) {
        const { error: eFisico } = await supabase.from('luz_clientes').delete().eq('id', duplicado_id);
        if (eFisico) {
          return NextResponse.json({ error: `Los datos ya se movieron, pero no se pudo eliminar la ficha duplicada: ${eFisico.message}` }, { status: 500 });
        }
        return NextResponse.json({
          ok: true, movidos, sin_papelera: true,
          completados: Object.keys(cambios).filter((k) => k !== 'actualizado_en'),
        });
      }
      return NextResponse.json({ error: `Los datos ya se movieron, pero no se pudo eliminar la ficha duplicada: ${eDel.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, movidos, completados: Object.keys(cambios).filter((k) => k !== 'actualizado_en') });
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }
}
