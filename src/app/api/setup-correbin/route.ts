/**
 * Verificación del módulo Vencimientos y Cartera (Correbin).
 * GET /api/setup-correbin — comprueba que las tablas vct_* existen.
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TABLAS = ['vct_clientes', 'vct_polizas', 'vct_movimientos', 'vct_oportunidades', 'vct_tareas'];

export async function GET() {
  const resultados: { paso: string; ok: boolean; detalle?: string }[] = [];

  for (const tabla of TABLAS) {
    const { error } = await supabase.from(tabla).select('id').limit(1);
    resultados.push({
      paso: `Tabla ${tabla}`,
      ok: !error,
      detalle: error ? error.message : 'Existe.',
    });
  }

  const todoOk = resultados.every((r) => r.ok);
  return NextResponse.json({
    ok: todoOk,
    resultados,
    instruccion: todoOk
      ? 'Módulo Vencimientos y Cartera listo.'
      : 'Ejecuta supabase_correbin.sql en el SQL Editor de Supabase para crear las tablas.',
  });
}
