import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Exportaciones Excel del módulo Vencimientos y Cartera.
 * GET /api/correbin/exportar?tipo=cartera        → cartera viva completa
 * GET /api/correbin/exportar?tipo=vencimientos   → pólizas que vencen en los próximos 90 días
 * GET /api/correbin/exportar?tipo=clientes       → listado de clientes
 */

const estilizarCabecera = (ws: ExcelJS.Worksheet) => {
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
};

export async function GET(req: NextRequest) {
  const tipo = req.nextUrl.searchParams.get('tipo') || 'cartera';
  const wb = new ExcelJS.Workbook();

  try {
    if (tipo === 'clientes') {
      const { data, error } = await supabase.from('vct_clientes').select('*').order('nombre');
      if (error) throw new Error(error.message);
      const ws = wb.addWorksheet('Clientes');
      ws.addRow(['Nombre', 'NIF', 'Teléfono', 'Email', 'Población', 'Tipo', 'Responsable', 'Origen', 'Notas']);
      estilizarCabecera(ws);
      ws.columns.forEach((c, i) => { c.width = [30, 12, 14, 26, 16, 12, 14, 14, 40][i] || 15; });
      (data || []).forEach((c) =>
        ws.addRow([c.nombre, c.nif, c.telefono, c.email, c.poblacion, c.tipo, c.responsable, c.origen, c.notas])
      );
    } else {
      let query = supabase
        .from('vct_polizas')
        .select('*, vct_clientes(nombre, telefono)')
        .eq('estado', 'viva')
        .order('fecha_vencimiento', { ascending: true });

      if (tipo === 'vencimientos') {
        const hoy = new Date().toISOString().slice(0, 10);
        const en90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
        query = query.gte('fecha_vencimiento', hoy).lte('fecha_vencimiento', en90);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const ws = wb.addWorksheet(tipo === 'vencimientos' ? 'Vencimientos 90 días' : 'Cartera viva');
      ws.addRow(['Vencimiento', 'Cliente', 'Teléfono', 'Ramo', 'Compañía', 'Nº Póliza', 'Prima anual (€)', 'Forma pago', 'Mediador', 'Responsable', 'Notas']);
      estilizarCabecera(ws);
      ws.columns.forEach((c, i) => { c.width = [14, 30, 14, 12, 18, 16, 15, 12, 14, 14, 40][i] || 15; });
      (data || []).forEach((p: any) =>
        ws.addRow([
          p.fecha_vencimiento, p.vct_clientes?.nombre || '', p.vct_clientes?.telefono || '',
          p.ramo, p.compania, p.numero_poliza, Number(p.prima_anual) || 0,
          p.forma_pago, p.mediador, p.responsable, p.notas,
        ])
      );
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
        ? 'Las tablas del módulo no existen. Ejecuta supabase_correbin.sql en Supabase.'
        : msg,
    }, { status: 500 });
  }
}
