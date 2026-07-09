import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

/**
 * Lectura robusta de Excel para las importaciones.
 * Intenta ExcelJS y, si el fichero viene de otra herramienta (CRM, Python,
 * LibreOffice...) con estructura XML que ExcelJS no entiende, cae a SheetJS.
 * Devuelve siempre celdas como texto, con fechas normalizadas a YYYY-MM-DD.
 */

export interface ExcelLeido {
  cabeceras: string[];
  filas: string[][];
}

const MAX_FILAS = 5000;

function celdaTextoExcelJS(v: ExcelJS.CellValue): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('text' in (v as object)) return String((v as { text: string }).text).trim();
    if ('result' in (v as object)) return celdaTextoExcelJS((v as { result: ExcelJS.CellValue }).result);
  }
  return String(v).trim();
}

function celdaTextoSheetJS(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

export async function leerExcel(archivo_base64: string): Promise<ExcelLeido> {
  const buffer = Buffer.from(archivo_base64, 'base64');

  // ── 1º intento: ExcelJS ──
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new Error('sin hojas');

    const cabeceras: string[] = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => { cabeceras[col - 1] = celdaTextoExcelJS(cell.value); });

    const filas: string[][] = [];
    for (let i = 2; i <= Math.min(ws.rowCount, MAX_FILAS + 1); i++) {
      const fila: string[] = [];
      ws.getRow(i).eachCell({ includeEmpty: true }, (cell, col) => { fila[col - 1] = celdaTextoExcelJS(cell.value); });
      if (fila.some((c) => c && c.trim())) filas.push(fila);
    }
    if (cabeceras.some((c) => c)) return { cabeceras, filas };
    throw new Error('sin cabeceras');
  } catch {
    // sigue con SheetJS
  }

  // ── 2º intento: SheetJS (tolera namespaces XML y CSV) ──
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const hoja = wb.SheetNames[0];
  if (!hoja) throw new Error('El fichero no tiene hojas.');
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[hoja], {
    header: 1,
    defval: '',
    raw: true,
  });
  if (!matriz.length) throw new Error('El fichero está vacío.');

  const cabeceras = (matriz[0] || []).map(celdaTextoSheetJS);
  const filas = matriz
    .slice(1, MAX_FILAS + 1)
    .map((f) => (f || []).map(celdaTextoSheetJS))
    .filter((f) => f.some((c) => c && c.trim()));

  return { cabeceras, filas };
}
