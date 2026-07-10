/**
 * Plantilla Excel para el analizador de facturas
 * - generarPlantillaAnalisis(): descarga una plantilla profesional para rellenar
 * - leerPlantillaAnalisis(file): lee la plantilla rellenada y devuelve los datos
 *
 * La plantilla usa celdas fijas para que la lectura sea 100% fiable:
 *   Hoja "Datos" → B4 nombre, B5 teléfono, B6 tarifa
 *   Tabla de periodos desde fila 10: A=periodo, B=consumo kWh/mes,
 *   C=potencia kW, D=precio energía €/kWh, E=precio potencia €/kW·día
 */

import ExcelJS from 'exceljs';
import { TARIFA_INFO, TarifaAcceso, DatosSuministro } from './tarifas';

const FILA_TABLA = 10; // primera fila de datos de periodos
const MAX_PERIODOS = 6;

const AZUL = 'FF16213E';
const ROJO = 'FFCC0000';
const GRIS_CLARO = 'FFF2F2F2';
const BORDE: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFBBBBBB' } },
  bottom: { style: 'thin', color: { argb: 'FFBBBBBB' } },
  left: { style: 'thin', color: { argb: 'FFBBBBBB' } },
  right: { style: 'thin', color: { argb: 'FFBBBBBB' } },
};

export async function generarPlantillaAnalisis() {
  const wb = new ExcelJS.Workbook();

  // ── HOJA 1: INSTRUCCIONES ──
  const info = wb.addWorksheet('Instrucciones');
  info.columns = [{ width: 90 }];

  const titulo = info.getCell('A1');
  titulo.value = 'GESMECO ENERGÍA · Plantilla de análisis de factura';
  titulo.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
  titulo.alignment = { vertical: 'middle', horizontal: 'center' };
  info.getRow(1).height = 32;

  const lineas = [
    '',
    'Cómo rellenar esta plantilla (2 minutos):',
    '',
    '1. Ve a la hoja "Datos" (pestaña inferior).',
    '2. Escribe tu nombre y teléfono para que podamos enviarte el estudio completo.',
    '3. Indica tu tarifa de acceso: 2.0 · 3.0 · 6.1 (aparece en tu factura como 2.0TD, 3.0TD o 6.1TD).',
    '4. Rellena la tabla de periodos con los datos de tu factura:',
    '     · Consumo (kWh/mes): la energía consumida en cada periodo en un mes normal.',
    '     · Potencia contratada (kW): aparece en el apartado "Potencia" de tu factura.',
    '     · Precio energía (€/kWh): el precio que pagas por kWh en cada periodo.',
    '     · Precio potencia (€/kW·día): el precio diario por kW contratado.',
    '',
    'Si tienes tarifa 2.0, solo debes rellenar 3 periodos de energía (P1 Punta, P2 Llano, P3 Valle)',
    'y 2 de potencia (P1 y P2). Con tarifa 3.0 o 6.1, rellena los 6 periodos.',
    '',
    '¿Dónde encuentro estos datos? Todos aparecen en el detalle de tu factura de luz,',
    'normalmente en la sección "Detalle de la factura" o "Datos de consumo".',
    '',
    '¿Dudas? Llámanos o escríbenos desde gesmecoenergia.com/contacto y te ayudamos a rellenarla.',
    '',
    'Cuando termines, guarda el archivo y súbelo en gesmecoenergia.com/analizador.',
  ];

  lineas.forEach((texto, i) => {
    const cell = info.getCell(`A${i + 2}`);
    cell.value = texto;
    cell.font =
      texto.startsWith('Cómo') || texto.startsWith('Cuando')
        ? { bold: true, size: 12 }
        : { size: 11 };
    cell.alignment = { wrapText: true, vertical: 'middle' };
  });

  // ── HOJA 2: DATOS ──
  const ws = wb.addWorksheet('Datos');
  ws.columns = [{ width: 22 }, { width: 24 }, { width: 24 }, { width: 26 }, { width: 28 }];

  const header = ws.getCell('A1');
  header.value = 'DATOS DE TU FACTURA';
  header.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
  header.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.mergeCells('A1:E1');
  ws.getRow(1).height = 28;

  // Bloque contacto + tarifa (etiqueta en A, valor en B)
  const campos: Array<[string, string, string]> = [
    ['A4', 'Nombre', 'Tu nombre y apellidos'],
    ['A5', 'Teléfono', 'Para enviarte el estudio (opcional)'],
    ['A6', 'Tarifa de acceso', 'Escribe: 2.0, 3.0 o 6.1'],
  ];
  campos.forEach(([celda, label, ayuda]) => {
    const c = ws.getCell(celda);
    c.value = label;
    c.font = { bold: true, size: 11 };
    const fila = Number(celda.slice(1));
    const valor = ws.getCell(`B${fila}`);
    valor.border = BORDE;
    valor.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_CLARO } };
    const nota = ws.getCell(`C${fila}`);
    nota.value = ayuda;
    nota.font = { italic: true, size: 9, color: { argb: 'FF888888' } };
  });

  // Validación de tarifa
  ws.getCell('B6').dataValidation = {
    type: 'list',
    allowBlank: false,
    formulae: ['"2.0,3.0,6.1"'],
    showErrorMessage: true,
    errorTitle: 'Tarifa no válida',
    error: 'Escribe 2.0, 3.0 o 6.1',
  };

  // Cabecera de la tabla de periodos
  const filaCab = FILA_TABLA - 1;
  const cabeceras = [
    'Periodo',
    'Consumo (kWh/mes)',
    'Potencia contratada (kW)',
    'Precio energía (€/kWh)',
    'Precio potencia (€/kW·día)',
  ];
  cabeceras.forEach((texto, i) => {
    const c = ws.getCell(filaCab, i + 1);
    c.value = texto;
    c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROJO } };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = BORDE;
  });
  ws.getRow(filaCab).height = 30;

  // Filas P1..P6
  for (let i = 0; i < MAX_PERIODOS; i++) {
    const fila = FILA_TABLA + i;
    const celPeriodo = ws.getCell(fila, 1);
    celPeriodo.value = `P${i + 1}`;
    celPeriodo.font = { bold: true, size: 11 };
    celPeriodo.alignment = { horizontal: 'center', vertical: 'middle' };
    celPeriodo.border = BORDE;

    for (let col = 2; col <= 5; col++) {
      const c = ws.getCell(fila, col);
      c.border = BORDE;
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_CLARO } };
      c.numFmt = col <= 3 ? '0.00' : '0.000000';
      c.alignment = { horizontal: 'center' };
    }
    ws.getRow(fila).height = 20;
  }

  // Nota final
  const nota = ws.getCell(`A${FILA_TABLA + MAX_PERIODOS + 2}`);
  nota.value =
    'Tarifa 2.0: rellena P1-P3 de energía y P1-P2 de potencia · Tarifas 3.0 y 6.1: rellena P1-P6';
  nota.font = { italic: true, size: 9, color: { argb: 'FF888888' } };
  ws.mergeCells(
    `A${FILA_TABLA + MAX_PERIODOS + 2}:E${FILA_TABLA + MAX_PERIODOS + 2}`
  );

  // Descargar
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Plantilla_Analisis_Gesmeco.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export interface DatosPlantilla {
  nombre: string;
  telefono: string;
  suministro: DatosSuministro;
}

function leerNumero(valor: ExcelJS.CellValue): number {
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string') {
    const n = parseFloat(valor.replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }
  if (valor && typeof valor === 'object' && 'result' in valor) {
    return leerNumero((valor as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
  }
  return 0;
}

function leerTexto(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'object' && 'richText' in valor) {
    return (valor as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join('');
  }
  return String(valor).trim();
}

export async function leerPlantillaAnalisis(file: File): Promise<DatosPlantilla> {
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.getWorksheet('Datos');
  if (!ws) {
    throw new Error(
      'El archivo no tiene la hoja "Datos". Descarga la plantilla oficial y rellénala.'
    );
  }

  const nombre = leerTexto(ws.getCell('B4').value);
  const telefono = leerTexto(ws.getCell('B5').value);
  const tarifaRaw = leerTexto(ws.getCell('B6').value).replace('TD', '').trim();

  if (!['2.0', '3.0', '6.1'].includes(tarifaRaw)) {
    throw new Error(
      `Tarifa "${tarifaRaw || '(vacía)'}" no válida. En la celda B6 escribe 2.0, 3.0 o 6.1.`
    );
  }
  const tarifa = tarifaRaw as TarifaAcceso;
  const nE = TARIFA_INFO[tarifa].periodosEnergia.length;
  const nP = TARIFA_INFO[tarifa].periodosPotencia.length;

  const consumosMes: number[] = [];
  const potencias: number[] = [];
  const preciosEnergia: number[] = [];
  const preciosPotencia: number[] = [];

  for (let i = 0; i < Math.max(nE, nP); i++) {
    const fila = FILA_TABLA + i;
    if (i < nE) {
      consumosMes.push(leerNumero(ws.getCell(fila, 2).value));
      preciosEnergia.push(leerNumero(ws.getCell(fila, 4).value));
    }
    if (i < nP) {
      potencias.push(leerNumero(ws.getCell(fila, 3).value));
      preciosPotencia.push(leerNumero(ws.getCell(fila, 5).value));
    }
  }

  if (consumosMes.every((c) => c === 0)) {
    throw new Error('No se ha encontrado ningún consumo. Rellena la columna "Consumo (kWh/mes)".');
  }
  if (preciosEnergia.every((p) => p === 0)) {
    throw new Error(
      'No se ha encontrado ningún precio de energía. Rellena la columna "Precio energía (€/kWh)".'
    );
  }

  return {
    nombre,
    telefono,
    suministro: { tarifa, consumosMes, potencias, preciosEnergia, preciosPotencia },
  };
}
