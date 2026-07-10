/**
 * Migración segura: añade columnas/tablas que faltan sin destruir datos existentes.
 * GET /api/migrate-database
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const resultados: { paso: string; ok: boolean; detalle?: string }[] = [];

  // 1. Verificar que proyectos_fotovoltaicos existe
  const { error: errTabla } = await supabase
    .from('proyectos_fotovoltaicos')
    .select('id')
    .limit(1);

  resultados.push({
    paso: 'Tabla proyectos_fotovoltaicos',
    ok: !errTabla,
    detalle: errTabla?.message,
  });

  // 2. Verificar que datos_extras existe insertando un test sin datos reales
  const testPayload = {
    cliente_nombre: '__TEST_MIGRATE__',
    cliente_ubicacion: '__TEST__',
    datos_extras: { _test: true },
  };

  const { data: testData, error: errExtras } = await supabase
    .from('proyectos_fotovoltaicos')
    .insert([testPayload])
    .select('id');

  const tieneExtras = !errExtras;

  resultados.push({
    paso: 'Columna datos_extras en proyectos_fotovoltaicos',
    ok: tieneExtras,
    detalle: errExtras?.message,
  });

  // Limpiar test si se insertó
  if (testData?.[0]) {
    await supabase.from('proyectos_fotovoltaicos').delete().eq('id', testData[0].id);
  }

  // 3. Verificar que campos_fotovoltaica existe
  const { error: errCampos } = await supabase
    .from('campos_fotovoltaica')
    .select('id')
    .limit(1);

  resultados.push({
    paso: 'Tabla campos_fotovoltaica',
    ok: !errCampos,
    detalle: errCampos?.message,
  });

  const todosOk = resultados.every((r) => r.ok);
  const necesitaSQL = !tieneExtras || errCampos;

  return NextResponse.json({
    ok: todosOk,
    necesita_migracion: necesitaSQL,
    resultados,
    instruccion: necesitaSQL
      ? 'Ejecuta supabase_campos_dinamicos.sql en el SQL Editor de Supabase para activar el sistema dinámico.'
      : 'Todo está correctamente configurado.',
  });
}
