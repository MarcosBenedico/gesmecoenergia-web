import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import {
  TIPO_CLIENTE_LABEL, ESTADO_CLIENTE_LABEL, ESTADO_CUPS_LABEL, TIPO_FECHA_LABEL,
  ESTADO_PIPELINE_LABEL, TIPO_OPORTUNIDAD_LABEL, ESTADO_CONTRATO_LABEL,
  TIPO_COMISION_LABEL, ESTADO_COMISION_LABEL, TIPO_TAREA_LABEL,
  COMISION_PENDIENTE, CONTRATO_EN_CURSO, TAREAS_ABIERTAS, diasHasta,
} from '@/lib/luz';

function clienteSupabase(req: NextRequest) {
  const auth = req.headers.get('authorization');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    auth ? { global: { headers: { Authorization: auth } } } : undefined
  );
}

/**
 * Exportaciones Excel del módulo Luz. Respetan filtros por query params.
 * tipos: clientes | cups | fechas | pipeline | contratos | comisiones | tareas |
 *        clientes_ab | cups_incompletos | contratos_pendientes | comisiones_pendientes
 */

const cab = (ws: ExcelJS.Worksheet, anchos: number[]) => {
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
  ws.columns.forEach((c, i) => { c.width = anchos[i] || 15; });
};

export async function GET(req: NextRequest) {
  const supabase = clienteSupabase(req);
  const p = req.nextUrl.searchParams;
  const tipo = p.get('tipo') || 'cups';
  const f = (k: string) => p.get(k) || '';
  const wb = new ExcelJS.Workbook();

  try {
    if (tipo === 'clientes' || tipo === 'clientes_ab') {
      let q = supabase.from('luz_clientes').select('*').order('prioridad').order('nombre');
      if (f('prioridad')) q = q.eq('prioridad', f('prioridad'));
      if (f('estado_comercial')) q = q.eq('estado_comercial', f('estado_comercial'));
      if (f('responsable')) q = q.eq('responsable', f('responsable'));
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      let filas = (data || []) as any[];
      if (tipo === 'clientes_ab') filas = filas.filter((c) => ['A', 'B'].includes(c.prioridad));

      const ws = wb.addWorksheet('Clientes energía');
      ws.addRow(['Prioridad', 'Cliente', 'CIF/NIF', 'Tipo', 'Contacto', 'Teléfono', 'Email', 'Estado', 'Responsable', 'Próxima acción', 'Fecha próx. acción', 'Potencial']);
      cab(ws, [10, 30, 12, 14, 18, 13, 24, 20, 14, 30, 14, 40]);
      filas.forEach((c) => ws.addRow([
        c.prioridad, c.nombre, c.nif || '', TIPO_CLIENTE_LABEL[c.tipo_cliente] || c.tipo_cliente,
        c.persona_contacto || '', c.telefono || '', c.email || '',
        ESTADO_CLIENTE_LABEL[c.estado_comercial] || c.estado_comercial, c.responsable || 'Sin asignar',
        c.proxima_accion || 'SIN PRÓXIMA ACCIÓN', c.fecha_proxima_accion || '', c.potencial_comercial || '',
      ]));
    }

    else if (tipo === 'cups' || tipo === 'cups_incompletos') {
      let q = supabase.from('luz_cups').select('*, luz_clientes(nombre, nif, prioridad)').order('fecha_fin_contrato', { ascending: true, nullsFirst: false });
      if (f('tarifa_acceso')) q = q.eq('tarifa_acceso', f('tarifa_acceso'));
      if (f('comercializadora_actual')) q = q.ilike('comercializadora_actual', `%${f('comercializadora_actual')}%`);
      if (f('estado_cups')) q = q.eq('estado_cups', f('estado_cups'));
      if (f('responsable')) q = q.eq('responsable', f('responsable'));
      if (f('prioridad')) q = q.eq('prioridad', f('prioridad'));
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      let filas = (data || []) as any[];
      if (tipo === 'cups_incompletos') {
        filas = filas.filter((x) => !x.fecha_fin_contrato || !Number(x.consumo_anual_kwh) || !x.responsable);
      }
      if (f('dias')) {
        const max = parseInt(f('dias'));
        filas = filas.filter((x) => {
          const d = diasHasta(x.fecha_fin_contrato) ?? diasHasta(x.fecha_fin_permanencia);
          return d != null && d >= 0 && d <= max;
        });
      }

      const ws = wb.addWorksheet(tipo === 'cups_incompletos' ? 'CUPS incompletos' : 'CUPS');
      ws.addRow(['Cliente', 'CUPS', 'Tarifa', 'Comercializadora', 'Consumo kWh/año', 'Fin contrato', 'Fin permanencia', 'Límite preaviso', 'Estado', 'Responsable', 'Prioridad', 'Faltan datos']);
      cab(ws, [28, 24, 10, 16, 14, 13, 14, 14, 20, 14, 10, 30]);
      filas.forEach((x) => ws.addRow([
        x.luz_clientes?.nombre || '', x.cups, x.tarifa_acceso, x.comercializadora_actual || '',
        Number(x.consumo_anual_kwh) || 0, x.fecha_fin_contrato || 'SIN FECHA', x.fecha_fin_permanencia || '',
        x.fecha_limite_preaviso || '', ESTADO_CUPS_LABEL[x.estado_cups] || x.estado_cups,
        x.responsable || 'SIN ASIGNAR', x.prioridad || x.luz_clientes?.prioridad || 'C',
        [!x.fecha_fin_contrato && 'fin contrato', !Number(x.consumo_anual_kwh) && 'consumo', !x.responsable && 'responsable'].filter(Boolean).join(' · '),
      ]));
    }

    else if (tipo === 'fechas') {
      let q = supabase.from('luz_fechas_criticas').select('*, luz_clientes(nombre, telefono, prioridad)').order('fecha');
      if (f('tipo_fecha')) q = q.eq('tipo_fecha', f('tipo_fecha'));
      if (f('responsable')) q = q.eq('responsable', f('responsable'));
      if (f('estado')) q = q.eq('estado', f('estado'));
      if (f('desde')) q = q.gte('fecha', f('desde'));
      if (f('hasta')) q = q.lte('fecha', f('hasta'));
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const ws = wb.addWorksheet('Fechas críticas');
      ws.addRow(['Fecha', 'Evento', 'Cliente', 'Teléfono', 'Tipo', 'Prioridad', 'Estado', 'Responsable']);
      cab(ws, [12, 55, 28, 13, 20, 10, 12, 14]);
      ((data || []) as any[]).forEach((x) => ws.addRow([
        x.fecha, x.titulo, x.luz_clientes?.nombre || '', x.luz_clientes?.telefono || '',
        TIPO_FECHA_LABEL[x.tipo_fecha] || x.tipo_fecha, x.prioridad, x.estado, x.responsable || 'Sin asignar',
      ]));
    }

    else if (tipo === 'pipeline') {
      let q = supabase.from('luz_pipeline').select('*, luz_clientes(nombre, prioridad)').order('creado_en', { ascending: false });
      if (f('estado')) q = q.eq('estado', f('estado'));
      if (f('responsable')) q = q.eq('responsable', f('responsable'));
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const ws = wb.addWorksheet('Pipeline energético');
      ws.addRow(['Cliente', 'Oportunidad', 'Tipo', 'Consumo kWh/año', 'Comisión potencial', 'Estado', 'Probabilidad %', 'Responsable', 'Próxima acción', 'Fecha próx. acción', 'Motivo pérdida']);
      cab(ws, [28, 32, 22, 14, 15, 16, 12, 14, 30, 14, 30]);
      ((data || []) as any[]).forEach((x) => ws.addRow([
        x.luz_clientes?.nombre || '', x.nombre_oportunidad, TIPO_OPORTUNIDAD_LABEL[x.tipo_oportunidad] || x.tipo_oportunidad,
        Number(x.consumo_anual_kwh) || 0, Number(x.comision_potencial) || 0,
        ESTADO_PIPELINE_LABEL[x.estado] || x.estado, x.probabilidad ?? '', x.responsable || 'Sin asignar',
        x.proxima_accion || 'SIN PRÓXIMA ACCIÓN', x.fecha_proxima_accion || '', x.motivo_perdida || '',
      ]));
    }

    else if (tipo === 'contratos' || tipo === 'contratos_pendientes') {
      let q = supabase.from('luz_contratos').select('*, luz_clientes(nombre), luz_cups(cups)').order('creado_en', { ascending: false });
      if (f('estado_contrato')) q = q.eq('estado_contrato', f('estado_contrato'));
      if (f('responsable')) q = q.eq('responsable', f('responsable'));
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      let filas = (data || []) as any[];
      if (tipo === 'contratos_pendientes') filas = filas.filter((x) => CONTRATO_EN_CURSO.includes(x.estado_contrato));

      const ws = wb.addWorksheet(tipo === 'contratos_pendientes' ? 'Contratos pendientes' : 'Contratos');
      ws.addRow(['Cliente', 'CUPS', 'Comercializadora', 'Estado', 'F. envío', 'F. firma', 'F. activación prevista', 'F. activación real', 'Doc. completa', 'Incidencia', 'Responsable']);
      cab(ws, [28, 24, 16, 22, 12, 12, 14, 14, 12, 30, 14]);
      filas.forEach((x) => ws.addRow([
        x.luz_clientes?.nombre || '', x.luz_cups?.cups || '', x.comercializadora_final || '',
        ESTADO_CONTRATO_LABEL[x.estado_contrato] || x.estado_contrato,
        x.fecha_envio_contrato || '', x.fecha_firma || '', x.fecha_activacion_prevista || '',
        x.fecha_activacion_real || '', x.documentacion_completa ? 'SÍ' : 'No', x.incidencia || '', x.responsable || '',
      ]));
    }

    else if (tipo === 'comisiones' || tipo === 'comisiones_pendientes') {
      let q = supabase.from('luz_comisiones').select('*, luz_clientes(nombre), luz_cups(cups)').order('fecha_prevista_cobro', { ascending: true, nullsFirst: false });
      if (f('estado_comision')) q = q.eq('estado_comision', f('estado_comision'));
      if (f('comercializadora')) q = q.ilike('comercializadora', `%${f('comercializadora')}%`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      let filas = (data || []) as any[];
      if (tipo === 'comisiones_pendientes') filas = filas.filter((x) => COMISION_PENDIENTE.includes(x.estado_comision));

      const ws = wb.addWorksheet(tipo === 'comisiones_pendientes' ? 'Comisiones pendientes' : 'Comisiones');
      ws.addRow(['Cliente', 'CUPS', 'Comercializadora', 'Tipo', 'Previsto (€)', 'Cobrado (€)', 'Diferencia (€)', 'Estado', 'F. prevista cobro', 'F. cobro', 'Ref. factura']);
      cab(ws, [28, 24, 16, 18, 12, 12, 12, 16, 14, 12, 16]);
      filas.forEach((x) => {
        const prev = Number(x.importe_previsto) || 0;
        const cob = Number(x.importe_cobrado) || 0;
        ws.addRow([
          x.luz_clientes?.nombre || '', x.luz_cups?.cups || '', x.comercializadora || '',
          TIPO_COMISION_LABEL[x.tipo_comision] || x.tipo_comision, prev, cob, prev - cob,
          ESTADO_COMISION_LABEL[x.estado_comision] || x.estado_comision,
          x.fecha_prevista_cobro || '', x.fecha_cobro || '', x.factura_referencia || '',
        ]);
      });
    }

    else if (tipo === 'tareas') {
      let q = supabase.from('luz_tareas').select('*, luz_clientes(nombre)').in('estado', TAREAS_ABIERTAS).order('fecha_limite', { ascending: true, nullsFirst: false });
      if (f('responsable')) q = q.eq('responsable', f('responsable'));
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const ws = wb.addWorksheet('Tareas abiertas');
      ws.addRow(['Fecha límite', 'Tipo', 'Descripción', 'Cliente', 'Prioridad', 'Estado', 'Responsable']);
      cab(ws, [13, 22, 40, 28, 10, 12, 14]);
      ((data || []) as any[]).forEach((x) => ws.addRow([
        x.fecha_limite || '', TIPO_TAREA_LABEL[x.tipo_tarea] || x.tipo_tarea || '', x.descripcion,
        x.luz_clientes?.nombre || '', x.prioridad, x.estado, x.responsable || 'Sin asignar',
      ]));
    }

    else {
      return NextResponse.json({ error: 'Tipo de exportación no válido.' }, { status: 400 });
    }

    const buffer = await wb.xlsx.writeBuffer();
    const fecha = new Date().toISOString().slice(0, 10);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="luz_${tipo}_${fecha}.xlsx"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error generando el Excel.';
    return NextResponse.json({
      error: /does not exist|Could not find/i.test(msg)
        ? 'Faltan las tablas del módulo. Ejecuta supabase_luz.sql en Supabase.'
        : msg,
    }, { status: 500 });
  }
}
