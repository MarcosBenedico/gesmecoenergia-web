import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

/** Genera y descarga la plantilla Excel para importar consumos mensuales. */
export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet('Consumos');

  hoja.columns = [
    { header: 'cups', key: 'cups', width: 26 },
    { header: 'año', key: 'anio', width: 8 },
    { header: 'mes', key: 'mes', width: 6 },
    { header: 'P1', key: 'p1', width: 10 },
    { header: 'P2', key: 'p2', width: 10 },
    { header: 'P3', key: 'p3', width: 10 },
    { header: 'P4', key: 'p4', width: 10 },
    { header: 'P5', key: 'p5', width: 10 },
    { header: 'P6', key: 'p6', width: 10 },
  ];

  // Cabecera con estilo
  const cabecera = hoja.getRow(1);
  cabecera.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cabecera.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  cabecera.alignment = { horizontal: 'center' };

  // Filas de ejemplo (el gestor las sustituye por las reales)
  hoja.addRow({ cups: 'ES0021000000000001AB', anio: 2026, mes: 1, p1: 120, p2: 95, p3: 160 });
  hoja.addRow({ cups: 'ES0021000000000001AB', anio: 2026, mes: 2, p1: 110, p2: 90, p3: 150 });
  hoja.addRow({ cups: 'ES0031000000000002CD', anio: 2026, mes: 1, p1: 800, p2: 650, p3: 900, p4: 400, p5: 350, p6: 700 });

  // Hoja de instrucciones
  const ayuda = workbook.addWorksheet('Instrucciones');
  ayuda.columns = [{ width: 90 }];
  const lineas = [
    'CÓMO RELLENAR LA PLANTILLA DE CONSUMOS',
    '',
    '1. cups → el código CUPS del suministro (lo ves en la ficha del cliente, en el gestor).',
    '2. año → año del consumo, ej: 2026.',
    '3. mes → número del mes, de 1 (enero) a 12 (diciembre).',
    '4. P1 a P6 → consumo del mes en kWh por periodo.',
    '   · Tarifa 2.0TD: rellena solo P1, P2 y P3.',
    '   · Tarifa 3.0TD y 6.1TD: rellena P1 a P6.',
    '',
    'IMPORTANTE:',
    '· Una fila por suministro y mes. Puedes mezclar varios suministros en el mismo Excel.',
    '· Si repites un mes ya guardado, se sobrescribe (sirve para corregir).',
    '· El coste se calcula automáticamente con los precios del suministro.',
    '· También se admite el usuario en la columna cups SOLO si el cliente tiene un único suministro.',
    '· Borra las filas de ejemplo antes de importar.',
  ];
  lineas.forEach((t, i) => {
    const row = ayuda.addRow([t]);
    if (i === 0) row.font = { bold: true, size: 14 };
    if (t === 'IMPORTANTE:') row.font = { bold: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla_consumos_gesmeco.xlsx"',
    },
  });
}
