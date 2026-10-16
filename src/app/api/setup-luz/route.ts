/**
 * Verificación del módulo Gestión Luz.
 * GET /api/setup-luz — comprueba que las tablas luz_* existen.
 */

import { supabaseAnon } from '@/lib/supabase-servidor';
import { NextResponse } from 'next/server';


const TABLAS = ['luz_clientes', 'luz_cups', 'luz_fechas_criticas', 'luz_pipeline', 'luz_contratos', 'luz_comisiones', 'luz_tareas', 'luz_config'];

export async function GET() {
  const resultados: { paso: string; ok: boolean; detalle?: string }[] = [];
  for (const tabla of TABLAS) {
    const { error } = await supabaseAnon().from(tabla).select('*').limit(1);
    resultados.push({ paso: `Tabla ${tabla}`, ok: !error, detalle: error ? error.message : 'Existe.' });
  }
  const todoOk = resultados.every((r) => r.ok);
  return NextResponse.json({
    ok: todoOk,
    resultados,
    instruccion: todoOk
      ? 'Módulo Gestión Luz listo.'
      : 'Ejecuta supabase_luz.sql en el SQL Editor de Supabase.',
  });
}
