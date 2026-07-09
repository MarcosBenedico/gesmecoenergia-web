import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * CRUD genérico del módulo Vencimientos y Cartera (Correbin).
 * Solo opera sobre tablas vct_* whitelisteadas y columnas permitidas.
 *
 * GET    /api/correbin/{recurso}?campo=valor&buscar=texto&limite=500
 * POST   /api/correbin/{recurso}   body: { ...campos }
 * PUT    /api/correbin/{recurso}   body: { id, ...campos }
 * DELETE /api/correbin/{recurso}   body: { id }
 */

interface DefTabla {
  tabla: string;
  select: string;
  columnas: string[];       // columnas escribibles
  filtros: string[];        // columnas filtrables por query param
  buscarEn?: string;        // columna para búsqueda ilike
  orden: { col: string; asc: boolean };
  conActualizado?: boolean; // tiene columna actualizado_en
}

const TABLAS: Record<string, DefTabla> = {
  clientes: {
    tabla: 'vct_clientes',
    select: '*',
    columnas: ['nombre', 'nif', 'telefono', 'email', 'direccion', 'poblacion', 'tipo', 'origen', 'responsable', 'notas', 'activo'],
    filtros: ['tipo', 'responsable', 'activo'],
    buscarEn: 'nombre',
    orden: { col: 'nombre', asc: true },
    conActualizado: true,
  },
  polizas: {
    tabla: 'vct_polizas',
    select: '*, vct_clientes(nombre)',
    columnas: ['cliente_id', 'numero_poliza', 'ramo', 'compania', 'prima_anual', 'fecha_efecto', 'fecha_vencimiento', 'forma_pago', 'estado', 'mediador', 'responsable', 'notas'],
    filtros: ['cliente_id', 'ramo', 'estado', 'compania', 'responsable', 'mediador'],
    buscarEn: 'numero_poliza',
    orden: { col: 'fecha_vencimiento', asc: true },
    conActualizado: true,
  },
  movimientos: {
    tabla: 'vct_movimientos',
    select: '*, vct_clientes(nombre)',
    columnas: ['cliente_id', 'poliza_id', 'tipo', 'fecha', 'motivo', 'compania_origen', 'compania_destino', 'mediador_origen', 'mediador_destino', 'prima', 'responsable', 'notas'],
    filtros: ['tipo', 'cliente_id', 'responsable'],
    orden: { col: 'fecha', asc: false },
  },
  oportunidades: {
    tabla: 'vct_oportunidades',
    select: '*, vct_clientes(nombre)',
    columnas: ['cliente_id', 'nombre_contacto', 'telefono', 'ramo', 'compania_actual', 'etapa', 'prima_estimada', 'fecha_prevista', 'responsable', 'notas'],
    filtros: ['etapa', 'ramo', 'responsable'],
    buscarEn: 'nombre_contacto',
    orden: { col: 'creado_en', asc: false },
    conActualizado: true,
  },
  tareas: {
    tabla: 'vct_tareas',
    select: '*, vct_clientes(nombre)',
    columnas: ['cliente_id', 'poliza_id', 'titulo', 'descripcion', 'fecha_limite', 'prioridad', 'estado', 'responsable', 'hecho_en'],
    filtros: ['estado', 'prioridad', 'cliente_id', 'responsable'],
    orden: { col: 'fecha_limite', asc: true },
  },
};

const errorTabla = () =>
  NextResponse.json({ error: 'Recurso no válido.' }, { status: 404 });

const esFaltaTabla = (msg: string) =>
  /relation .* does not exist|Could not find the table/i.test(msg);

const respuestaError = (msg: string) =>
  NextResponse.json(
    {
      error: esFaltaTabla(msg)
        ? 'Las tablas del módulo no existen todavía. Ejecuta supabase_correbin.sql en el SQL Editor de Supabase.'
        : msg,
      falta_migracion: esFaltaTabla(msg),
    },
    { status: 500 }
  );

function filtrarCampos(def: DefTabla, body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const col of def.columnas) {
    if (col in body) out[col] = body[col] === '' ? null : body[col];
  }
  return out;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ tabla: string }> }) {
  const { tabla } = await ctx.params;
  const def = TABLAS[tabla];
  if (!def) return errorTabla();

  const params = req.nextUrl.searchParams;
  let query = supabase
    .from(def.tabla)
    .select(def.select)
    .order(def.orden.col, { ascending: def.orden.asc })
    .limit(Math.min(parseInt(params.get('limite') || '1000'), 5000));

  for (const f of def.filtros) {
    const v = params.get(f);
    if (v !== null && v !== '') query = query.eq(f, v);
  }
  const buscar = params.get('buscar');
  if (buscar && def.buscarEn) query = query.ilike(def.buscarEn, `%${buscar}%`);

  // Rango de fechas para vencimientos / calendario
  const desde = params.get('desde');
  const hasta = params.get('hasta');
  const colFecha = tabla === 'polizas' ? 'fecha_vencimiento' : tabla === 'movimientos' ? 'fecha' : tabla === 'tareas' ? 'fecha_limite' : null;
  if (colFecha) {
    if (desde) query = query.gte(colFecha, desde);
    if (hasta) query = query.lte(colFecha, hasta);
  }

  const { data, error } = await query;
  if (error) return respuestaError(error.message);
  return NextResponse.json({ ok: true, datos: data || [] });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ tabla: string }> }) {
  const { tabla } = await ctx.params;
  const def = TABLAS[tabla];
  if (!def) return errorTabla();

  try {
    const body = await req.json();
    const campos = filtrarCampos(def, body);
    if (Object.keys(campos).length === 0) {
      return NextResponse.json({ error: 'No hay datos que guardar.' }, { status: 400 });
    }
    const { data, error } = await supabase.from(def.tabla).insert([campos]).select(def.select).single();
    if (error) return respuestaError(error.message);
    return NextResponse.json({ ok: true, dato: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ tabla: string }> }) {
  const { tabla } = await ctx.params;
  const def = TABLAS[tabla];
  if (!def) return errorTabla();

  try {
    const { id, ...body } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
    const campos = filtrarCampos(def, body);
    if (def.conActualizado) campos.actualizado_en = new Date().toISOString();
    const { error } = await supabase.from(def.tabla).update(campos).eq('id', id);
    if (error) return respuestaError(error.message);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ tabla: string }> }) {
  const { tabla } = await ctx.params;
  const def = TABLAS[tabla];
  if (!def) return errorTabla();

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
    const { error } = await supabase.from(def.tabla).delete().eq('id', id);
    if (error) return respuestaError(error.message);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }
}
