import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Catálogo de precios FV + presupuestos históricos de Óscar (solo admin, RLS).
 * GET  ?recurso=catalogo|oscar|historial[&oscar_id=...]
 * POST { recurso:'catalogo', ...campos }           → alta de referencia
 * PUT  { recurso:'catalogo', id, ...campos, motivo } → edición (el cambio de precio exige motivo y queda en histórico)
 */

function clienteSupabase(req: NextRequest) {
  const auth = req.headers.get('authorization');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    auth ? { global: { headers: { Authorization: auth } } } : undefined
  );
}

const faltaMigracion = (msg: string) => /does not exist|Could not find/i.test(msg);
const err500 = (msg: string) => NextResponse.json({
  error: faltaMigracion(msg) ? 'Faltan las tablas del Presupuestador: ejecuta supabase_fv_presupuestador.sql en Supabase.' : msg,
  falta_migracion: faltaMigracion(msg),
}, { status: 500 });

const CAMPOS_CATALOGO = ['codigo', 'categoria', 'descripcion', 'marca', 'modelo', 'potencia_w', 'capacidad_kwh', 'unidad', 'precio_base', 'precio_min', 'precio_max', 'proveedor', 'fecha_precio', 'num_referencias', 'confianza', 'alcance', 'advertencia', 'observaciones', 'activo'];

export async function GET(req: NextRequest) {
  const supabase = clienteSupabase(req);
  const recurso = req.nextUrl.searchParams.get('recurso') || 'catalogo';

  if (recurso === 'oscar') {
    const { data, error } = await supabase.from('fv_oscar_presupuestos').select('*').order('numero');
    if (error) return err500(error.message);
    const { data: items } = await supabase.from('fv_oscar_items').select('*');
    return NextResponse.json({ ok: true, datos: data || [], items: items || [] });
  }
  if (recurso === 'historial') {
    const { data, error } = await supabase.from('fv_catalogo_historial').select('*').order('creado_en', { ascending: false }).limit(200);
    if (error) return err500(error.message);
    return NextResponse.json({ ok: true, datos: data || [] });
  }
  const { data, error } = await supabase.from('fv_catalogo').select('*').order('categoria').order('codigo');
  if (error) return err500(error.message);
  return NextResponse.json({ ok: true, datos: data || [] });
}

export async function POST(req: NextRequest) {
  try {
    const supabase = clienteSupabase(req);
    const body = await req.json();
    const campos: Record<string, unknown> = {};
    for (const k of CAMPOS_CATALOGO) if (k in body) campos[k] = body[k] === '' ? null : body[k];
    if (!campos.codigo || !campos.descripcion || !campos.categoria || Number(campos.precio_base) < 0) {
      return NextResponse.json({ error: 'Código, categoría, descripción y precio (≥0) son obligatorios.' }, { status: 400 });
    }
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('fv_catalogo')
      .insert([{ ...campos, creado_por: u.user?.email || null }]).select('*').single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Ese código ya existe en el catálogo.' }, { status: 409 });
      return err500(error.message);
    }
    return NextResponse.json({ ok: true, dato: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = clienteSupabase(req);
    const { id, motivo, ...body } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });

    const { data: actual } = await supabase.from('fv_catalogo').select('precio_base, codigo').eq('id', id).single();
    if (!actual) return NextResponse.json({ error: 'Referencia no encontrada.' }, { status: 404 });

    const campos: Record<string, unknown> = {};
    for (const k of CAMPOS_CATALOGO) if (k in body && k !== 'codigo') campos[k] = body[k] === '' ? null : body[k];

    // Cambio de precio → motivo obligatorio (el trigger guarda el histórico; aquí añadimos el motivo)
    const cambiaPrecio = 'precio_base' in campos && Number(campos.precio_base) !== Number(actual.precio_base);
    if (cambiaPrecio && !motivo?.trim()) {
      return NextResponse.json({ error: `El precio de ${actual.codigo} cambia: indica el motivo.` }, { status: 400 });
    }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('fv_catalogo').update({
      ...campos, modificado_por: u.user?.email || null, actualizado_en: new Date().toISOString(),
    }).eq('id', id);
    if (error) return err500(error.message);
    if (cambiaPrecio && motivo?.trim()) {
      // Completar el motivo en el registro de histórico recién creado por el trigger
      const { data: h } = await supabase.from('fv_catalogo_historial').select('id')
        .eq('catalogo_id', id).is('motivo', null).order('creado_en', { ascending: false }).limit(1);
      if (h?.[0]) await supabase.from('fv_catalogo_historial').update({ motivo: motivo.trim() }).eq('id', h[0].id);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }
}
