import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

/**
 * LEER UN LIBRO DE EXCEL ENTERO, HOJA A HOJA, SIN PERDER LOS NÚMEROS.
 *
 * DOS COSAS QUE PARECEN DETALLE Y NO LO SON:
 *
 * 1. HAY QUE INTENTARLO CON DOS MOTORES.
 *
 *    ExcelJS falla con «Cannot read properties of undefined (reading
 *    "sheets")» en archivos perfectamente válidos, cuando el zip viene
 *    ordenado de otra manera — que es justo lo que hace Excel al guardar un
 *    archivo que hemos generado nosotros. O sea: descargas la plantilla, la
 *    rellenas, la guardas, y ya no se puede abrir. SheetJS los lee sin
 *    pestañear. `excel-lectura.ts` ya aprendió esto para las importaciones;
 *    aquí estaba sin aprender y costó una plantilla rechazada.
 *
 * 2. UN NÚMERO SE DEVUELVE COMO NÚMERO, NUNCA COMO TEXTO.
 *
 *    Este es el caro. En el archivo, un consumo de 473,21 kWh está guardado
 *    como el número 473.21. Si se lee la versión FORMATEADA de la celda sale
 *    la cadena «473.210» —el formato de la plantilla pinta tres decimales— y
 *    al volver a interpretarla, ese punto parece un separador de miles: 473210
 *    kWh. Mil veces más, sin ningún error por ninguna parte, dentro de una
 *    oferta.
 *
 *    El archivo YA SABE que es 473,21. Convertirlo a texto para volver a
 *    adivinarlo es inventarse un problema que no existía. Las heurísticas de
 *    `leerNumero` son para lo que de verdad viene escrito a mano.
 */

/** Una celda: número si en el archivo era número, texto si era texto. */
export type Celda = string | number;

export interface LibroLeido {
  /** Hojas por nombre, en el orden del archivo. */
  hojas: { nombre: string; filas: Celda[][] }[];
  /** Con qué motor se ha podido leer. Útil cuando algo sale raro. */
  motor: 'exceljs' | 'sheetjs';
}

const MAX_FILAS = 2000;

/** Una celda de ExcelJS al valor que de verdad lleva dentro. */
function celdaExcelJS(v: ExcelJS.CellValue): Celda {
  if (v == null) return '';
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    const o = v as { result?: ExcelJS.CellValue; text?: string; richText?: { text: string }[] };
    // Fórmula: interesa el resultado, no la fórmula.
    if (o.result != null) return celdaExcelJS(o.result);
    if (o.richText) return o.richText.map((r) => r.text).join('');
    if (o.text != null) return String(o.text);
    return '';
  }
  return String(v).trim();
}

function conSheetJS(buffer: Buffer): LibroLeido {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  return {
    motor: 'sheetjs',
    hojas: wb.SheetNames.map((nombre) => {
      // raw: true → los números salen como números. Es todo el asunto.
      const filas = XLSX.utils.sheet_to_json<Celda[]>(wb.Sheets[nombre], {
        header: 1, raw: true, defval: '', blankrows: true,
      }) as Celda[][];
      return {
        nombre,
        filas: filas.slice(0, MAX_FILAS).map((f) =>
          (f || []).map((c: unknown) =>
            (c instanceof Date ? c.toISOString().slice(0, 10) : ((c ?? '') as Celda)))),
      };
    }),
  };
}

/**
 * Abre un .xlsx y devuelve todas sus hojas.
 *
 * Prueba ExcelJS y, si no puede, SheetJS. El orden es ese porque ExcelJS
 * conserva mejor algunos tipos, pero el que nunca falla es el segundo.
 */
export async function leerLibro(base64: string): Promise<LibroLeido> {
  const buffer = Buffer.from(base64, 'base64');

  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    if (!wb.worksheets?.length) throw new Error('sin hojas');

    return {
      motor: 'exceljs',
      hojas: wb.worksheets.map((ws) => {
        const filas: Celda[][] = [];
        ws.eachRow({ includeEmpty: true }, (row, n) => {
          if (n > MAX_FILAS) return;
          const fila: Celda[] = [];
          row.eachCell({ includeEmpty: true }, (cell, col) => {
            fila[col - 1] = celdaExcelJS(cell.value);
          });
          filas.push(fila);
        });
        return { nombre: ws.name, filas };
      }),
    };
  } catch {
    // Archivo guardado por Excel, Numbers, LibreOffice o Google Sheets con el
    // zip en otro orden. Es lo normal, no una rareza.
    return conSheetJS(buffer);
  }
}

/** Busca una hoja por lo que lleve en el nombre, no por su posición. */
export function hojaCon(libro: LibroLeido, clave: string): Celda[][] {
  const h = libro.hojas.find((x) => x.nombre.toLowerCase().includes(clave));
  return h ? h.filas : [];
}
