import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

/**
 * Lee un Excel de consumos y devuelve las filas listas para guardar.
 * Formato esperado (fila 1 = cabeceras):
 *   usuario | año | mes | P1 | P2 | P3 | P4 | P5 | P6
 * Body: { data: base64 del .xlsx }
 */
export async function POST(req: NextRequest) {
  try {
    const { data } = await req.json();
    if (!data) {
      return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 });
    }

    const buffer = Buffer.from(data, 'base64');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);

    const hoja = workbook.worksheets[0];
    if (!hoja) {
      return NextResponse.json({ error: 'El Excel no tiene hojas.' }, { status: 400 });
    }

    const filas: {
      cups?: string;
      usuario?: string;
      anio: number;
      mes: number;
      consumos_kwh: number[];
    }[] = [];

    hoja.eachRow((row, num) => {
      if (num === 1) return; // cabecera
      const v = (i: number) => row.getCell(i).value;
      const clave = String(v(1) ?? '').trim();
      const anio = Number(v(2));
      const mes = Number(v(3));
      if (!clave || !anio || !mes) return;

      const consumos: number[] = [];
      for (let c = 4; c <= 9; c++) {
        const val = Number(v(c));
        if (!isNaN(val) && v(c) !== null && v(c) !== undefined && v(c) !== '') {
          consumos.push(val);
        }
      }
      // Si la clave parece un CUPS (empieza por ES y es larga) va como cups, si no como usuario
      const esCups = /^ES\d{16,20}[A-Z0-9]{0,4}$/i.test(clave.replace(/\s+/g, ''));
      filas.push(
        esCups
          ? { cups: clave, anio, mes, consumos_kwh: consumos }
          : { usuario: clave.toLowerCase(), anio, mes, consumos_kwh: consumos }
      );
    });

    if (filas.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron filas válidas. Formato: cups | año | mes | P1 | P2 | P3...' },
        { status: 422 }
      );
    }

    return NextResponse.json({ ok: true, filas });
  } catch (e) {
    console.error('Error leyendo Excel:', e);
    return NextResponse.json({ error: 'No se pudo leer el Excel. ¿Es un .xlsx válido?' }, { status: 500 });
  }
}
