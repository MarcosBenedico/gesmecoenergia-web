import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  calcularFV, validarEntradaFV, margenPorDefecto, INGENIERIA_DEFECTO,
  ESTADOS_FV, ESTADOS_FV_PROTEGIDOS, ConceptoFV, PartidaFV, importePartida, r2,
} from '@/lib/fv';

/**
 * Calculadora FV — presupuestos fotovoltaicos (solo administrador; RLS lo garantiza).
 * El SERVIDOR recalcula siempre los importes con la misma librería que el frontend:
 * lo que guarda la base de datos nunca depende de lo que envíe el navegador.
 */

function clienteSupabase(req: NextRequest) {
  const auth = req.headers.get('authorization');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    auth ? { global: { headers: { Authorization: auth } } } : undefined
  );
}

/** Email del usuario autenticado (para creado_por / modificado_por). */
async function emailUsuario(req: NextRequest): Promise<string | null> {
  try {
    const supabase = clienteSupabase(req);
    const { data } = await supabase.auth.getUser();
    return data.user?.email || null;
  } catch {
    return null;
  }
}

interface CuerpoFV {
  id?: string;
  cliente_id?: string | null;
  nombre_proyecto?: string;
  potencia_kw?: number;
  presupuesto_instalador?: number;
  coste_ingenieria?: number;
  margen_pct?: number;
  motivo_margen?: string | null;
  iva_pct?: number;
  estado?: string;
  responsable?: string | null;
  observaciones?: string | null;
  documentos?: unknown[];
  archivado?: boolean;
  conceptos?: ConceptoFV[];
  modo?: 'simple' | 'partidas';
  dimensionado?: Record<string, unknown>;
}

/** Valida y calcula en servidor. Devuelve { error } o los campos listos para guardar. */
function prepararCampos(b: CuerpoFV, clienteNombre: string | null) {
  const potencia = Number(b.potencia_kw);
  const instalador = Number(b.presupuesto_instalador);
  const ingenieria = b.coste_ingenieria == null ? INGENIERIA_DEFECTO : Number(b.coste_ingenieria);
  const margen = b.margen_pct == null ? margenPorDefecto(potencia) : Number(b.margen_pct);
  const iva = b.iva_pct == null ? 21 : Number(b.iva_pct);

  const modo = b.modo === 'partidas' ? 'partidas' : 'simple';

  // Partidas: cálculo con ajustes (precio_base × (1+pct) + fijo); sin negativos
  const conceptos = (b.conceptos || []).filter((c) => c.concepto?.trim()) as PartidaFV[];
  for (const c of conceptos) {
    if (Number(c.cantidad) < 0 || Number(c.precio_unitario) < 0 || Number(c.ajuste_fijo || 0) < -Number(c.precio_unitario)) {
      return { error: 'Los conceptos no admiten cantidades ni precios negativos.' };
    }
  }
  const otros = r2(conceptos.filter((c) => c.incluido).reduce((s, c) => s + importePartida(c), 0));

  // Evitar ingeniería duplicada: si ya hay una partida de ingeniería incluida, la regla no la suma otra vez
  const ingenieriaEnPartidas = conceptos.some((c) => c.incluido && (c.codigo_catalogo === 'ING-EXT' || /ingenier/i.test(c.concepto)));
  const ingenieriaEfectiva = ingenieriaEnPartidas ? 0 : ingenieria;

  const entrada = { potencia_kw: potencia, presupuesto_instalador: modo === 'partidas' ? 0 : instalador, coste_ingenieria: ingenieriaEfectiva, margen_pct: margen, iva_pct: iva, otros_costes: otros };
  const errores = validarEntradaFV(entrada).filter((e) =>
    // En modo partidas el coste base sale de las partidas, no del importe único de Óscar
    !(modo === 'partidas' && e.includes('presupuesto del instalador')));
  if (modo === 'partidas' && otros <= 0) errores.push('Añade al menos una partida incluida en el coste base.');
  if (!b.nombre_proyecto?.trim()) errores.push('El nombre del proyecto es obligatorio.');
  if (!b.cliente_id) errores.push('Selecciona el cliente.');

  const margenDefecto = margenPorDefecto(potencia);
  const margenModificado = margen !== margenDefecto;
  if (margenModificado && !b.motivo_margen?.trim()) {
    errores.push(`El margen difiere del predeterminado (${margenDefecto} %): indica el motivo.`);
  }
  if (errores.length) return { error: errores.join(' · ') };

  const r = calcularFV(entrada);
  return {
    campos: {
      cliente_id: b.cliente_id,
      cliente_nombre: clienteNombre,
      nombre_proyecto: b.nombre_proyecto!.trim(),
      modo,
      dimensionado: b.dimensionado || {},
      potencia_kw: potencia,
      presupuesto_instalador: modo === 'partidas' ? 0 : r2(instalador),
      coste_ingenieria: r2(ingenieriaEfectiva),
      ingenieria_modificada: ingenieria !== INGENIERIA_DEFECTO,
      otros_costes: r.otros_costes,
      coste_base: r.coste_base,
      margen_pct: margen,
      margen_modificado: margenModificado,
      motivo_margen: margenModificado ? b.motivo_margen!.trim() : null,
      margen_importe: r.margen_importe,
      precio_sin_iva: r.precio_sin_iva,
      iva_pct: iva,
      iva_importe: r.iva_importe,
      precio_con_iva: r.precio_con_iva,
      responsable: b.responsable || null,
      observaciones: b.observaciones || null,
      documentos: Array.isArray(b.documentos) ? b.documentos : [],
    },
    conceptos,
  };
}

export async function GET(req: NextRequest) {
  const supabase = clienteSupabase(req);
  const id = req.nextUrl.searchParams.get('id');
  if (id) {
    const { data, error } = await supabase.from('fv_presupuestos').select('*').eq('id', id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { data: conceptos } = await supabase.from('fv_conceptos').select('*').eq('presupuesto_id', id).order('creado_en');
    return NextResponse.json({ ok: true, dato: data, conceptos: conceptos || [] });
  }
  const { data, error } = await supabase.from('fv_presupuestos')
    .select('*').eq('archivado', false).order('creado_en', { ascending: false }).limit(500);
  if (error) {
    return NextResponse.json({
      error: /does not exist|Could not find/i.test(error.message)
        ? 'Faltan las tablas de la Calculadora FV: ejecuta supabase_fv_presupuestos.sql en Supabase.'
        : error.message,
      falta_migracion: /does not exist|Could not find/i.test(error.message),
    }, { status: 500 });
  }
  return NextResponse.json({ ok: true, datos: data || [] });
}

export async function POST(req: NextRequest) {
  try {
    const supabase = clienteSupabase(req);
    const body = (await req.json()) as CuerpoFV;
    const email = await emailUsuario(req);

    const { data: cli } = body.cliente_id
      ? await supabase.from('luz_clientes').select('nombre').eq('id', body.cliente_id).single()
      : { data: null };
    const prep = prepararCampos(body, cli?.nombre || null);
    if ('error' in prep) return NextResponse.json({ error: prep.error }, { status: 400 });

    const { data, error } = await supabase.from('fv_presupuestos').insert([{
      ...prep.campos, estado: 'borrador', creado_por: email, modificado_por: email,
    }]).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (prep.conceptos.length) {
      await supabase.from('fv_conceptos').insert(prep.conceptos.map((c) => ({ ...c, presupuesto_id: data.id })));
    }
    return NextResponse.json({ ok: true, dato: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = clienteSupabase(req);
    const body = (await req.json()) as CuerpoFV;
    if (!body.id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
    const email = await emailUsuario(req);

    const { data: actual, error: e0 } = await supabase.from('fv_presupuestos').select('*').eq('id', body.id).single();
    if (e0 || !actual) return NextResponse.json({ error: 'Presupuesto no encontrado.' }, { status: 404 });

    // ── Cambio de estado (con reglas) ──
    if (body.estado && body.estado !== actual.estado) {
      if (!ESTADOS_FV.includes(body.estado as typeof ESTADOS_FV[number])) {
        return NextResponse.json({ error: 'Estado no válido.' }, { status: 400 });
      }
      const extra: Record<string, unknown> = {};
      if (body.estado === 'enviado' && actual.estado !== 'aprobado' && !['aceptado', 'rechazado'].includes(actual.estado)) {
        return NextResponse.json({ error: 'No se puede marcar como enviado sin aprobarlo antes.' }, { status: 400 });
      }
      if (body.estado === 'aprobado') { extra.aprobado_por = email; extra.aprobado_en = new Date().toISOString(); }
      const { error } = await supabase.from('fv_presupuestos').update({
        estado: body.estado, modificado_por: email, actualizado_en: new Date().toISOString(), ...extra,
      }).eq('id', body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // ── Solo actualizar la lista de documentos (subidas/borrados del almacén) ──
    if ((body as Record<string, unknown>).solo_documentos) {
      const { error } = await supabase.from('fv_presupuestos').update({
        documentos: Array.isArray(body.documentos) ? body.documentos : [],
        modificado_por: email, actualizado_en: new Date().toISOString(),
      }).eq('id', body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // ── Archivado lógico ──
    if (body.archivado != null && Object.keys(body).length <= 2) {
      const { error } = await supabase.from('fv_presupuestos').update({
        archivado: !!body.archivado, modificado_por: email, actualizado_en: new Date().toISOString(),
      }).eq('id', body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // ── Edición completa: recálculo en servidor; los aprobados quedan constancia en auditoría ──
    const { data: cli } = body.cliente_id
      ? await supabase.from('luz_clientes').select('nombre').eq('id', body.cliente_id).single()
      : { data: null };
    const prep = prepararCampos(body, cli?.nombre || actual.cliente_nombre);
    if ('error' in prep) return NextResponse.json({ error: prep.error }, { status: 400 });

    // Si estaba aprobado/enviado, editar lo devuelve a revisión (nueva revisión con constancia)
    const vuelveARevision = ESTADOS_FV_PROTEGIDOS.includes(actual.estado);
    const { error } = await supabase.from('fv_presupuestos').update({
      ...prep.campos,
      ...(vuelveARevision ? { estado: 'pendiente_revision', aprobado_por: null, aprobado_en: null } : {}),
      modificado_por: email, actualizado_en: new Date().toISOString(),
    }).eq('id', body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Conceptos: se reemplazan por los enviados (queda todo en auditoría)
    if (body.conceptos) {
      await supabase.from('fv_conceptos').delete().eq('presupuesto_id', body.id);
      if (prep.conceptos.length) {
        await supabase.from('fv_conceptos').insert(prep.conceptos.map((c) => ({ ...c, presupuesto_id: body.id })));
      }
    }
    return NextResponse.json({ ok: true, aviso: vuelveARevision ? 'El presupuesto estaba aprobado: vuelve a "Pendiente de revisión".' : null });
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = clienteSupabase(req);
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
    const { data: actual } = await supabase.from('fv_presupuestos').select('estado').eq('id', id).single();
    if (actual && ESTADOS_FV_PROTEGIDOS.includes(actual.estado)) {
      return NextResponse.json({ error: 'Los presupuestos aprobados o enviados no se eliminan: cancélalo o archívalo.' }, { status: 400 });
    }
    const { error } = await supabase.from('fv_presupuestos').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }
}
