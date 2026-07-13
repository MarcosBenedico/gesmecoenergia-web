import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase por petición: si llega el token del usuario, se reenvía
 * para que las políticas RLS se apliquen por usuario (cuando estén activas).
 */
function clienteSupabase(req: NextRequest) {
  const auth = req.headers.get('authorization');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    auth ? { global: { headers: { Authorization: auth } } } : undefined
  );
}

/**
 * CRUD genérico del módulo Gestión Luz. Solo tablas luz_* whitelisteadas.
 *
 * GET    /api/luz/{recurso}?campo=valor&buscar=&desde=&hasta=&limite=
 * POST   /api/luz/{recurso}   body: { ...campos }
 * PUT    /api/luz/{recurso}   body: { id, ...campos }  (reglas de negocio incluidas)
 * DELETE /api/luz/{recurso}   body: { id }
 */

interface DefTabla {
  tabla: string;
  select: string;
  columnas: string[];
  filtros: string[];
  buscarEn?: string;
  orden: { col: string; asc: boolean };
  colFecha?: string;
}

const TABLAS: Record<string, DefTabla> = {
  clientes: {
    tabla: 'luz_clientes',
    select: '*',
    columnas: ['nombre', 'nif', 'tipo_cliente', 'persona_contacto', 'telefono', 'email', 'direccion_fiscal', 'responsable', 'prioridad', 'estado_comercial', 'potencial_comercial', 'origen_cliente', 'observaciones', 'fecha_ultimo_contacto', 'fecha_proxima_accion', 'proxima_accion'],
    filtros: ['tipo_cliente', 'responsable', 'prioridad', 'estado_comercial'],
    buscarEn: 'nombre',
    orden: { col: 'nombre', asc: true },
  },
  cups: {
    tabla: 'luz_cups',
    select: '*, luz_clientes(nombre, nif, prioridad)',
    columnas: ['cliente_id', 'cups', 'alias_suministro', 'direccion_suministro', 'tarifa_acceso', 'comercializadora_actual', 'distribuidora', 'potencias_kw', 'consumo_anual_kwh', 'coste_anual_estimado', 'tipo_contrato', 'fecha_inicio_contrato', 'fecha_fin_contrato', 'tiene_permanencia', 'fecha_fin_permanencia', 'dias_preaviso', 'fecha_limite_preaviso', 'penalizacion', 'estado_cups', 'responsable', 'prioridad', 'observaciones'],
    filtros: ['cliente_id', 'tarifa_acceso', 'comercializadora_actual', 'responsable', 'estado_cups', 'prioridad'],
    buscarEn: 'cups',
    orden: { col: 'fecha_fin_contrato', asc: true },
    colFecha: 'fecha_fin_contrato',
  },
  fechas: {
    tabla: 'luz_fechas_criticas',
    select: '*, luz_clientes(nombre, prioridad)',
    columnas: ['cliente_id', 'cups_id', 'tipo_fecha', 'fecha', 'titulo', 'descripcion', 'prioridad', 'estado', 'responsable'],
    filtros: ['cliente_id', 'cups_id', 'tipo_fecha', 'prioridad', 'estado', 'responsable'],
    orden: { col: 'fecha', asc: true },
    colFecha: 'fecha',
  },
  pipeline: {
    tabla: 'luz_pipeline',
    select: '*, luz_clientes(nombre, prioridad)',
    columnas: ['cliente_id', 'cups_id', 'nombre_oportunidad', 'tipo_oportunidad', 'tarifa', 'comercializadora_actual', 'consumo_anual_kwh', 'importe_anual_estimado', 'ahorro_potencial', 'comision_potencial', 'estado', 'probabilidad', 'responsable', 'proxima_accion', 'fecha_proxima_accion', 'fecha_revision', 'motivo_perdida', 'observaciones'],
    filtros: ['cliente_id', 'cups_id', 'estado', 'responsable', 'tipo_oportunidad'],
    buscarEn: 'nombre_oportunidad',
    orden: { col: 'creado_en', asc: false },
  },
  contratos: {
    tabla: 'luz_contratos',
    select: '*, luz_clientes(nombre), luz_cups(cups)',
    columnas: ['cliente_id', 'cups_id', 'pipeline_id', 'comercializadora_final', 'tarifa_acceso', 'tipo_contrato', 'fecha_envio_contrato', 'fecha_firma', 'fecha_envio_comercializadora', 'fecha_activacion_prevista', 'fecha_activacion_real', 'estado_contrato', 'documentacion_completa', 'incidencia', 'responsable', 'observaciones'],
    filtros: ['cliente_id', 'cups_id', 'estado_contrato', 'responsable'],
    orden: { col: 'creado_en', asc: false },
  },
  comisiones: {
    tabla: 'luz_comisiones',
    select: '*, luz_clientes(nombre), luz_cups(cups)',
    columnas: ['cliente_id', 'cups_id', 'contrato_id', 'comercializadora', 'tipo_comision', 'importe_previsto', 'importe_cobrado', 'fecha_prevista_cobro', 'fecha_cobro', 'estado_comision', 'factura_referencia', 'observaciones'],
    filtros: ['cliente_id', 'cups_id', 'contrato_id', 'estado_comision', 'comercializadora'],
    orden: { col: 'fecha_prevista_cobro', asc: true },
    colFecha: 'fecha_prevista_cobro',
  },
  tareas: {
    tabla: 'luz_tareas',
    select: '*, luz_clientes(nombre)',
    columnas: ['cliente_id', 'cups_id', 'pipeline_id', 'contrato_id', 'comision_id', 'tipo_tarea', 'descripcion', 'notas', 'responsable', 'fecha_limite', 'estado', 'prioridad'],
    filtros: ['cliente_id', 'cups_id', 'estado', 'responsable', 'tipo_tarea', 'prioridad'],
    orden: { col: 'fecha_limite', asc: true },
    colFecha: 'fecha_limite',
  },
  config: {
    tabla: 'luz_config',
    select: '*',
    columnas: ['clave', 'valor'],
    filtros: ['clave'],
    orden: { col: 'clave', asc: true },
  },
  // Responsables compartidos con el módulo Correbin (roles ya preparados)
  responsables: {
    tabla: 'vct_responsables',
    select: '*',
    columnas: ['nombre', 'rol', 'activo'],
    filtros: ['rol', 'activo'],
    orden: { col: 'nombre', asc: true },
  },
};

const PIPELINE_CERRADO_API = ['ganado', 'perdido', 'revisar_adelante'];

const errorTabla = () => NextResponse.json({ error: 'Recurso no válido.' }, { status: 404 });
const esFaltaTabla = (msg: string) => /relation .* does not exist|Could not find the table/i.test(msg);
const respuestaError = (msg: string) =>
  NextResponse.json({
    error: esFaltaTabla(msg)
      ? 'Las tablas del módulo Luz no existen todavía. Ejecuta supabase_luz.sql en el SQL Editor de Supabase.'
      : msg,
    falta_migracion: esFaltaTabla(msg),
  }, { status: 500 });

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
    .order(def.orden.col, { ascending: def.orden.asc, nullsFirst: false })
    .limit(Math.min(parseInt(params.get('limite') || '2000'), 5000));

  for (const f of def.filtros) {
    const v = params.get(f);
    if (v !== null && v !== '') query = query.eq(f, v);
  }
  const buscar = params.get('buscar');
  if (buscar && def.buscarEn) query = query.ilike(def.buscarEn, `%${buscar}%`);
  if (def.colFecha) {
    const desde = params.get('desde');
    const hasta = params.get('hasta');
    if (desde) query = query.gte(def.colFecha, desde);
    if (hasta) query = query.lte(def.colFecha, hasta);
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
    if (tabla === 'cups' && campos.cups) {
      campos.cups = String(campos.cups).trim().toUpperCase().replace(/\s+/g, '');
    }
    const { data, error } = await supabase.from(def.tabla).insert([campos]).select(def.select).single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: tabla === 'cups' ? 'Ese CUPS ya está registrado.' : 'Registro duplicado.' }, { status: 409 });
      }
      return respuestaError(error.message);
    }
    // Nueva oportunidad con próxima acción → se refleja en la ficha del cliente
    if (tabla === 'pipeline' && campos.cliente_id && (campos.proxima_accion || campos.fecha_proxima_accion)) {
      await supabase.from('luz_clientes').update({
        proxima_accion: campos.proxima_accion ?? null,
        fecha_proxima_accion: campos.fecha_proxima_accion ?? null,
        actualizado_en: new Date().toISOString(),
      }).eq('id', campos.cliente_id);
    }
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

    // ── Reglas de negocio ──
    if (tabla === 'contratos' && campos.estado_contrato === 'activado') {
      // No se puede activar sin fecha de activación real
      if (!campos.fecha_activacion_real) {
        const { data: actual } = await supabase.from('luz_contratos').select('fecha_activacion_real, cups_id').eq('id', id).single();
        if (!actual?.fecha_activacion_real) {
          campos.fecha_activacion_real = new Date().toISOString().slice(0, 10);
        }
      }
    }
    if (tabla === 'pipeline' && campos.estado === 'perdido' && !campos.motivo_perdida) {
      const { data: actual } = await supabase.from('luz_pipeline').select('motivo_perdida').eq('id', id).single();
      if (!actual?.motivo_perdida) {
        return NextResponse.json({ error: 'Para marcar como perdida hay que indicar el motivo de pérdida.' }, { status: 400 });
      }
    }
    if (tabla === 'pipeline' && campos.estado === 'revisar_adelante' && !campos.fecha_revision) {
      const { data: actual } = await supabase.from('luz_pipeline').select('fecha_revision').eq('id', id).single();
      if (!actual?.fecha_revision) {
        return NextResponse.json({ error: 'Para "revisar más adelante" hay que indicar la fecha de revisión futura.' }, { status: 400 });
      }
    }
    if (tabla === 'comisiones' && (campos.estado_comision === 'cobrada' || campos.estado_comision === 'cobrada_parcial')) {
      if (!campos.fecha_cobro) campos.fecha_cobro = new Date().toISOString().slice(0, 10);
      // Cobrada sin importe indicado → se asume cobrado el importe previsto
      if (campos.estado_comision === 'cobrada' && !campos.importe_cobrado) {
        const { data: actual } = await supabase.from('luz_comisiones').select('importe_previsto, importe_cobrado').eq('id', id).single();
        if (!Number(actual?.importe_cobrado)) campos.importe_cobrado = actual?.importe_previsto ?? 0;
      }
    }

    campos.actualizado_en = new Date().toISOString();
    const { error } = await supabase.from(def.tabla).update(campos).eq('id', id);
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Ese CUPS ya está registrado.' }, { status: 409 });
      return respuestaError(error.message);
    }

    // ── Sincronización "próxima acción": un solo dato, visible en cliente y pipeline ──
    // Pipeline → cliente: la próxima acción de una oportunidad abierta se refleja en la ficha.
    if (tabla === 'pipeline' && ('proxima_accion' in campos || 'fecha_proxima_accion' in campos)) {
      const { data: op } = await supabase.from('luz_pipeline').select('cliente_id, proxima_accion, fecha_proxima_accion, estado').eq('id', id).single();
      if (op?.cliente_id && !PIPELINE_CERRADO_API.includes(op.estado)) {
        await supabase.from('luz_clientes').update({
          proxima_accion: op.proxima_accion,
          fecha_proxima_accion: op.fecha_proxima_accion,
          actualizado_en: new Date().toISOString(),
        }).eq('id', op.cliente_id);
      }
    }
    // Cliente → pipeline: si el cliente tiene una oportunidad abierta, se actualiza la misma.
    if (tabla === 'clientes' && ('proxima_accion' in campos || 'fecha_proxima_accion' in campos)) {
      const { data: ops } = await supabase.from('luz_pipeline')
        .select('id, estado').eq('cliente_id', id)
        .not('estado', 'in', '(ganado,perdido,revisar_adelante)')
        .order('creado_en', { ascending: false }).limit(1);
      if (ops && ops[0]) {
        await supabase.from('luz_pipeline').update({
          ...('proxima_accion' in campos ? { proxima_accion: campos.proxima_accion } : {}),
          ...('fecha_proxima_accion' in campos ? { fecha_proxima_accion: campos.fecha_proxima_accion } : {}),
          actualizado_en: new Date().toISOString(),
        }).eq('id', ops[0].id);
      }
    }

    // Efecto: contrato activado → CUPS activado
    if (tabla === 'contratos' && campos.estado_contrato === 'activado') {
      const { data: con } = await supabase.from('luz_contratos').select('cups_id, comercializadora_final').eq('id', id).single();
      if (con?.cups_id) {
        await supabase.from('luz_cups').update({
          estado_cups: 'activado',
          ...(con.comercializadora_final ? { comercializadora_actual: con.comercializadora_final } : {}),
          actualizado_en: new Date().toISOString(),
        }).eq('id', con.cups_id);
      }
    }

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
