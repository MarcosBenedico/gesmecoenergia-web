import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import {
  ESTADOS_CARTERA_VIVA, TIPO_ANULACION_LABEL, TIPO_PRODUCCION_LABEL, ESTADO_CM_LABEL,
  ETAPA_LABEL, ESTADO_VCT_LABEL, SEGMENTO_LABEL, TIPO_TAREA_LABEL, diasHasta, enVentanaAlerta,
} from '@/lib/correbin';

function clienteSupabase(req: NextRequest) {
  const auth = req.headers.get('authorization');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    auth ? { global: { headers: { Authorization: auth } } } : undefined
  );
}

/**
 * Exportaciones Excel. Respetan los filtros pasados como query params.
 * GET /api/correbin/exportar?tipo=X&ramo=&responsable=&estado=&prioridad=&segmento=&dias=&compania=&buscar=
 * Tipos: cartera | vencimientos | produccion | anulaciones | mediador | pipeline |
 *        tareas | clientes | cuentas_a_sin_accion | incompletas
 */

const cab = (ws: ExcelJS.Worksheet, anchos: number[]) => {
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
  ws.columns.forEach((c, i) => { c.width = anchos[i] || 15; });
};

export async function GET(req: NextRequest) {
  const supabase = clienteSupabase(req);
  const p = req.nextUrl.searchParams;
  const tipo = p.get('tipo') || 'cartera';
  const wb = new ExcelJS.Workbook();

  const f = (clave: string) => p.get(clave) || '';

  try {
    if (tipo === 'cartera' || tipo === 'incompletas') {
      let q = supabase.from('vct_polizas').select('*, vct_clientes(nombre, nif, prioridad, segmento)').order('fecha_vencimiento', { ascending: true, nullsFirst: false });
      if (tipo === 'cartera') q = q.in('estado', ESTADOS_CARTERA_VIVA);
      if (f('ramo')) q = q.eq('ramo', f('ramo'));
      if (f('responsable')) q = q.eq('responsable', f('responsable'));
      if (f('estado')) q = q.eq('estado', f('estado'));
      if (f('compania')) q = q.ilike('compania', `%${f('compania')}%`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);

      let filas = (data || []) as any[];
      if (tipo === 'incompletas') filas = filas.filter((x) => !Number(x.prima_anual) || !x.fecha_vencimiento);
      if (f('dias')) {
        const max = parseInt(f('dias'));
        filas = filas.filter((x) => { const d = diasHasta(x.fecha_vencimiento); return d != null && d >= 0 && d <= max; });
      }
      if (f('prioridad')) filas = filas.filter((x) => (x.prioridad || x.vct_clientes?.prioridad) === f('prioridad'));
      if (f('segmento')) filas = filas.filter((x) => (x.segmento || x.vct_clientes?.segmento) === f('segmento'));
      if (f('buscar')) {
        const b = f('buscar').toLowerCase();
        filas = filas.filter((x) => `${x.vct_clientes?.nombre || ''} ${x.compania} ${x.numero_poliza || ''}`.toLowerCase().includes(b));
      }

      const ws = wb.addWorksheet(tipo === 'incompletas' ? 'Pólizas incompletas' : 'Cartera viva');
      ws.addRow(['Cliente', 'CIF/NIF', 'Nº póliza', 'Compañía', 'Ramo', 'Prima', 'Comisión', 'Vencimiento', 'Estado', 'Responsable', 'Prioridad', 'Segmento', 'Alertas']);
      cab(ws, [30, 12, 15, 16, 12, 12, 12, 13, 14, 14, 10, 20, 30]);
      filas.forEach((x) => ws.addRow([
        x.vct_clientes?.nombre || '', x.vct_clientes?.nif || '', x.numero_poliza || '', x.compania,
        x.ramo, Number(x.prima_anual) || 0, Number(x.comision) || 0, x.fecha_vencimiento || 'SIN VENCIMIENTO',
        x.estado, x.responsable || 'Sin asignar', x.prioridad || x.vct_clientes?.prioridad || '',
        SEGMENTO_LABEL[x.segmento || x.vct_clientes?.segmento || ''] || '',
        [!Number(x.prima_anual) && 'sin prima', !x.fecha_vencimiento && 'sin vencimiento'].filter(Boolean).join(' · '),
      ]));
    }

    else if (tipo === 'vencimientos') {
      let q = supabase.from('vct_vencimientos').select('*, vct_clientes(nombre, telefono, prioridad)').order('fecha_vct', { ascending: true });
      if (f('responsable')) q = q.eq('responsable', f('responsable'));
      if (f('segmento')) q = q.eq('segmento', f('segmento'));
      if (f('estado')) q = q.eq('estado_vencimiento', f('estado'));
      if (f('desde')) q = q.gte('fecha_vct', f('desde'));
      if (f('hasta')) q = q.lte('fecha_vct', f('hasta'));
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      let filas = (data || []) as any[];
      if (f('dias')) {
        const max = parseInt(f('dias'));
        filas = filas.filter((x) => { const d = diasHasta(x.fecha_vct); return d != null && d >= 0 && d <= max; });
      }
      if (f('prioridad')) filas = filas.filter((x) => x.vct_clientes?.prioridad === f('prioridad'));

      const ws = wb.addWorksheet('Vencimientos');
      ws.addRow(['Fecha VCT', 'Evento', 'Cliente', 'Teléfono', 'Segmento', 'Estado', 'Responsable', 'Último contacto', 'Próxima acción', 'Fecha próx. acción']);
      cab(ws, [12, 50, 28, 13, 20, 20, 14, 13, 30, 13]);
      filas.forEach((x) => ws.addRow([
        x.fecha_vct, x.titulo_evento, x.vct_clientes?.nombre || '', x.vct_clientes?.telefono || '',
        SEGMENTO_LABEL[x.segmento] || x.segmento, ESTADO_VCT_LABEL[x.estado_vencimiento] || x.estado_vencimiento,
        x.responsable || 'Sin asignar', x.fecha_ultimo_contacto || '', x.proxima_accion || '', x.fecha_proxima_accion || '',
      ]));
    }

    else if (tipo === 'produccion') {
      let q = supabase.from('vct_produccion').select('*, vct_clientes(nombre)').order('fecha_emision', { ascending: false });
      if (f('tipo_produccion')) q = q.eq('tipo_produccion', f('tipo_produccion'));
      if (f('responsable')) q = q.eq('responsable', f('responsable'));
      if (f('desde')) q = q.gte('fecha_emision', f('desde'));
      if (f('hasta')) q = q.lte('fecha_emision', f('hasta'));
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const ws = wb.addWorksheet('Producción');
      ws.addRow(['Fecha emisión', 'Efecto', 'Cliente', 'Ramo', 'Compañía', 'Prima', 'Comisión', 'Tipo', '¿Cartera nueva real?', 'Responsable', 'Observaciones']);
      cab(ws, [13, 13, 30, 12, 16, 12, 12, 22, 18, 14, 30]);
      (data || []).forEach((x: any) => ws.addRow([
        x.fecha_emision, x.fecha_efecto || '', x.vct_clientes?.nombre || '', x.ramo, x.compania || '',
        Number(x.prima) || 0, Number(x.comision) || 0, TIPO_PRODUCCION_LABEL[x.tipo_produccion] || x.tipo_produccion,
        ['nueva', 'ampliacion'].includes(x.tipo_produccion) ? 'SÍ' : 'No (técnico)', x.responsable || '', x.observaciones || '',
      ]));
    }

    else if (tipo === 'anulaciones') {
      let q = supabase.from('vct_anulaciones').select('*, vct_clientes(nombre)').order('fecha_anulacion', { ascending: false });
      if (f('tipo_anulacion')) q = q.eq('tipo_anulacion', f('tipo_anulacion'));
      if (f('desde')) q = q.gte('fecha_anulacion', f('desde'));
      if (f('hasta')) q = q.lte('fecha_anulacion', f('hasta'));
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const ws = wb.addWorksheet('Anulaciones');
      ws.addRow(['Fecha', 'Cliente', 'Prima', 'Tipo', '¿Resta cartera?', 'Motivo', 'Responsable', 'Observaciones']);
      cab(ws, [12, 30, 12, 22, 14, 35, 14, 30]);
      (data || []).forEach((x: any) => ws.addRow([
        x.fecha_anulacion, x.vct_clientes?.nombre || '', Number(x.prima) || 0,
        TIPO_ANULACION_LABEL[x.tipo_anulacion] || x.tipo_anulacion,
        x.afecta_cartera ? 'SÍ' : 'No', x.motivo || 'SIN MOTIVO', x.responsable || '', x.observaciones || '',
      ]));
    }

    else if (tipo === 'mediador') {
      let q = supabase.from('vct_cambios_mediador').select('*, vct_clientes(nombre)').order('creado_en', { ascending: false });
      if (f('estado')) q = q.eq('estado', f('estado'));
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const ws = wb.addWorksheet('Cambios de mediador');
      ws.addRow(['Cliente', 'Prima', 'Compañía', 'Ramo', 'Carta firmada', 'Estado', 'Estado compañía', 'F. solicitud', 'F. envío', 'F. entrada', 'Responsable']);
      cab(ws, [30, 12, 16, 12, 13, 20, 16, 12, 12, 12, 14]);
      (data || []).forEach((x: any) => ws.addRow([
        x.vct_clientes?.nombre || '', Number(x.prima) || 0, x.compania || '', x.ramo || '',
        x.carta_firmada ? 'SÍ' : 'No', ESTADO_CM_LABEL[x.estado] || x.estado, x.estado_compania || '',
        x.fecha_solicitud || '', x.fecha_envio_compania || '', x.fecha_entrada || '', x.responsable || '',
      ]));
    }

    else if (tipo === 'pipeline') {
      let q = supabase.from('vct_oportunidades').select('*, vct_clientes(nombre)').order('creado_en', { ascending: false });
      if (f('etapa')) q = q.eq('etapa', f('etapa'));
      if (f('responsable')) q = q.eq('responsable', f('responsable'));
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const ws = wb.addWorksheet('Pipeline');
      ws.addRow(['Contacto/Cliente', 'Ramo', 'Prima estimada', 'Probabilidad %', 'Estado', 'Compañía actual', 'Doc. recibida', 'Próxima acción', 'Fecha próx. acción', 'Responsable']);
      cab(ws, [30, 12, 14, 13, 20, 18, 12, 30, 14, 14]);
      (data || []).forEach((x: any) => ws.addRow([
        x.vct_clientes?.nombre || x.nombre_contacto, x.ramo, Number(x.prima_estimada) || 0,
        x.probabilidad ?? '', ETAPA_LABEL[x.etapa] || x.etapa, x.compania_actual || '',
        x.documentacion_recibida ? 'SÍ' : 'No', x.proxima_accion || 'SIN PRÓXIMA ACCIÓN',
        x.fecha_proxima_accion || '', x.responsable || '',
      ]));
    }

    else if (tipo === 'tareas') {
      let q = supabase.from('vct_tareas').select('*, vct_clientes(nombre)').in('estado', ['pendiente', 'en_curso', 'bloqueada']).order('fecha_limite', { ascending: true, nullsFirst: false });
      if (f('responsable')) q = q.eq('responsable', f('responsable'));
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const ws = wb.addWorksheet('Tareas abiertas');
      ws.addRow(['Fecha límite', 'Tarea', 'Tipo', 'Cliente', 'Prioridad', 'Estado', 'Responsable']);
      cab(ws, [13, 40, 22, 28, 10, 12, 14]);
      (data || []).forEach((x: any) => ws.addRow([
        x.fecha_limite || '', x.titulo, TIPO_TAREA_LABEL[x.tipo_tarea] || x.tipo_tarea || '',
        x.vct_clientes?.nombre || '', x.prioridad, x.estado, x.responsable || 'Sin asignar',
      ]));
    }

    else if (tipo === 'clientes' || tipo === 'cuentas_a_sin_accion') {
      let q = supabase.from('vct_clientes').select('*').order('prioridad').order('nombre');
      if (f('prioridad')) q = q.eq('prioridad', f('prioridad'));
      if (tipo === 'cuentas_a_sin_accion') q = q.eq('prioridad', 'A');
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      let filas = (data || []) as any[];

      if (tipo === 'cuentas_a_sin_accion') {
        const ids = filas.map((c) => c.id);
        const { data: tareas } = await supabase.from('vct_tareas').select('cliente_id').in('estado', ['pendiente', 'en_curso']).in('cliente_id', ids.length ? ids : ['-']);
        const conTarea = new Set((tareas || []).map((t) => t.cliente_id));
        const { data: vctos } = await supabase.from('vct_vencimientos').select('cliente_id, proxima_accion').in('cliente_id', ids.length ? ids : ['-']);
        const conAccion = new Set((vctos || []).filter((v) => v.proxima_accion).map((v) => v.cliente_id));
        filas = filas.filter((c) => !conTarea.has(c.id) && !conAccion.has(c.id));
      }

      const ws = wb.addWorksheet(tipo === 'cuentas_a_sin_accion' ? 'Cuentas A sin acción' : 'Clientes');
      ws.addRow(['Prioridad', 'Cliente', 'CIF/NIF', 'Teléfono', 'Email', 'Contacto principal', 'Segmento', 'Prima total', 'Comisión total', 'Responsable', 'Potencial comercial']);
      cab(ws, [10, 30, 12, 13, 24, 20, 20, 13, 13, 14, 40]);
      filas.forEach((c) => ws.addRow([
        c.prioridad || 'C', c.nombre, c.nif || '', c.telefono || '', c.email || '', c.contacto_principal || '',
        SEGMENTO_LABEL[c.segmento] || c.segmento || '', Number(c.prima_total) || 0, Number(c.comision_total) || 0,
        c.responsable || 'Sin asignar', c.potencial_comercial || '',
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
        'Content-Disposition': `attachment; filename="correbin_${tipo}_${fecha}.xlsx"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error generando el Excel.';
    return NextResponse.json({
      error: /does not exist|Could not find/i.test(msg)
        ? 'Faltan tablas v2. Ejecuta supabase_correbin_v2.sql en Supabase.'
        : msg,
    }, { status: 500 });
  }
}
