import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/** Cliente por petición: reenvía el token del usuario para que RLS aplique sus permisos. */
function clienteSupabase(req: NextRequest) {
  const auth = req.headers.get('authorization');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    auth ? { global: { headers: { Authorization: auth } } } : undefined
  );
}

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
    columnas: ['nombre', 'nif', 'telefono', 'email', 'direccion', 'poblacion', 'contacto_principal', 'tipo', 'origen', 'responsable', 'prioridad', 'segmento', 'potencial_comercial', 'prima_total', 'comision_total', 'notas', 'activo'],
    filtros: ['tipo', 'responsable', 'activo', 'prioridad', 'segmento'],
    buscarEn: 'nombre',
    orden: { col: 'nombre', asc: true },
    conActualizado: true,
  },
  polizas: {
    tabla: 'vct_polizas',
    select: '*, vct_clientes(nombre, nif, prioridad, segmento)',
    columnas: ['cliente_id', 'numero_poliza', 'ramo', 'compania', 'prima_anual', 'comision', 'fecha_efecto', 'fecha_vencimiento', 'forma_pago', 'estado', 'mediador', 'responsable', 'prioridad', 'segmento', 'origen_importacion', 'notas'],
    filtros: ['cliente_id', 'ramo', 'estado', 'compania', 'responsable', 'mediador', 'prioridad', 'segmento'],
    buscarEn: 'numero_poliza',
    orden: { col: 'fecha_vencimiento', asc: true },
    conActualizado: true,
  },
  vencimientos: {
    tabla: 'vct_vencimientos',
    select: '*, vct_clientes(nombre, prioridad, tipo), vct_polizas(numero_poliza, compania)',
    columnas: ['cliente_id', 'poliza_id', 'fecha_vct', 'titulo_evento', 'segmento', 'color', 'estado_vencimiento', 'responsable', 'fecha_ultimo_contacto', 'proxima_accion', 'fecha_proxima_accion', 'observaciones', 'numero_poliza', 'compania'],
    filtros: ['cliente_id', 'poliza_id', 'segmento', 'estado_vencimiento', 'responsable'],
    orden: { col: 'fecha_vct', asc: true },
    conActualizado: true,
  },
  produccion: {
    tabla: 'vct_produccion',
    select: '*, vct_clientes(nombre)',
    columnas: ['cliente_id', 'poliza_id', 'fecha_emision', 'fecha_efecto', 'ramo', 'compania', 'prima', 'comision', 'tipo_produccion', 'responsable', 'observaciones'],
    filtros: ['cliente_id', 'tipo_produccion', 'ramo', 'responsable', 'compania'],
    orden: { col: 'fecha_emision', asc: false },
    conActualizado: true,
  },
  anulaciones: {
    tabla: 'vct_anulaciones',
    select: '*, vct_clientes(nombre)',
    columnas: ['cliente_id', 'poliza_id', 'fecha_anulacion', 'prima', 'motivo', 'tipo_anulacion', 'poliza_sustituta_id', 'afecta_cartera', 'responsable', 'observaciones'],
    filtros: ['cliente_id', 'tipo_anulacion', 'responsable'],
    orden: { col: 'fecha_anulacion', asc: false },
    conActualizado: true,
  },
  cambios_mediador: {
    tabla: 'vct_cambios_mediador',
    select: '*, vct_clientes(nombre)',
    columnas: ['cliente_id', 'prima', 'compania', 'ramo', 'carta_firmada', 'estado_compania', 'fecha_solicitud', 'fecha_envio_compania', 'fecha_entrada', 'estado', 'responsable', 'observaciones'],
    filtros: ['cliente_id', 'estado', 'responsable'],
    orden: { col: 'creado_en', asc: false },
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
    columnas: ['cliente_id', 'nombre_contacto', 'telefono', 'ramo', 'compania_actual', 'etapa', 'prima_estimada', 'probabilidad', 'documentacion_recibida', 'proxima_accion', 'fecha_proxima_accion', 'resultado', 'fecha_prevista', 'responsable', 'notas'],
    filtros: ['etapa', 'ramo', 'responsable', 'cliente_id'],
    buscarEn: 'nombre_contacto',
    orden: { col: 'creado_en', asc: false },
    conActualizado: true,
  },
  tareas: {
    tabla: 'vct_tareas',
    select: '*, vct_clientes(nombre)',
    columnas: ['cliente_id', 'poliza_id', 'vencimiento_id', 'pipeline_id', 'tipo_tarea', 'titulo', 'descripcion', 'fecha_limite', 'prioridad', 'estado', 'responsable', 'hecho_en'],
    filtros: ['estado', 'prioridad', 'cliente_id', 'responsable', 'tipo_tarea', 'vencimiento_id', 'pipeline_id'],
    orden: { col: 'fecha_limite', asc: true },
  },
  responsables: {
    tabla: 'vct_responsables',
    select: '*',
    columnas: ['nombre', 'rol', 'activo'],
    filtros: ['rol', 'activo'],
    orden: { col: 'nombre', asc: true },
  },
  config: {
    tabla: 'vct_config',
    select: '*',
    columnas: ['clave', 'valor'],
    filtros: ['clave'],
    orden: { col: 'clave', asc: true },
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
  const supabase = clienteSupabase(req);
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

  // Rango de fechas para vencimientos / calendario / históricos
  const desde = params.get('desde');
  const hasta = params.get('hasta');
  const COLS_FECHA: Record<string, string> = {
    polizas: 'fecha_vencimiento', movimientos: 'fecha', tareas: 'fecha_limite',
    vencimientos: 'fecha_vct', produccion: 'fecha_emision', anulaciones: 'fecha_anulacion',
  };
  const colFecha = COLS_FECHA[tabla] || null;
  if (colFecha) {
    if (desde) query = query.gte(colFecha, desde);
    if (hasta) query = query.lte(colFecha, hasta);
  }

  const { data, error } = await query;
  if (error) return respuestaError(error.message);
  return NextResponse.json({ ok: true, datos: data || [] });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ tabla: string }> }) {
  const supabase = clienteSupabase(req);
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
  const supabase = clienteSupabase(req);
  const { tabla } = await ctx.params;
  const def = TABLAS[tabla];
  if (!def) return errorTabla();

  try {
    const { id, ...body } = await req.json();

    // config: upsert por clave (su PK no es id)
    if (tabla === 'config') {
      if (!body.clave) return NextResponse.json({ error: 'Falta la clave.' }, { status: 400 });
      const { error } = await supabase.from(def.tabla).upsert(
        { clave: body.clave, valor: String(body.valor ?? ''), actualizado_en: new Date().toISOString() },
        { onConflict: 'clave' }
      );
      if (error) return respuestaError(error.message);
      return NextResponse.json({ ok: true });
    }

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
  const supabase = clienteSupabase(req);
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
