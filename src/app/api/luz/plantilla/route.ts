import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { leerLibro, hojaCon } from '@/lib/excel-hojas';
import {
  CAMPOS_SUMINISTRO, MESES, columnasDeConsumo, interpretarPlantilla,
  DIAS_MINIMOS_FIABLES,
} from '@/lib/plantilla-consumos';
import { TARIFA_INFO, type TarifaAcceso } from '@/lib/tarifas-base';

/**
 * LA PLANTILLA DE CONSUMOS: generarla (GET) y leerla (POST).
 *
 * GET  /api/luz/plantilla?tarifa=3.0  → descarga el .xlsx ya montado
 * POST /api/luz/plantilla { archivo }  → devuelve los datos interpretados
 *
 * POR QUÉ LA PLANTILLA SE GENERA Y NO ES UN ARCHIVO FIJO
 *
 * Porque las columnas dependen de la tarifa: la 2.0TD tiene 3 periodos de
 * energía y 2 de potencia, y la 3.0TD y la 6.1TD tienen 6 y 6. Una plantilla
 * única con seis columnas para todos deja al de 2.0TD tres columnas que no
 * sabe qué son —las rellena o las deja, y las dos cosas salen mal— y al de
 * 3.0TD le permite rellenar solo tres, que es EL error caro: con tres periodos
 * de seis, el coste actual sale a la mitad y el ahorro al doble, y no hay nada
 * en pantalla que lo delate.
 *
 * Generándola por tarifa, ese error no se puede cometer: las casillas que hay
 * son exactamente las que hay que rellenar.
 */

export const maxDuration = 60;

// ── Estilo ──────────────────────────────────────────────────────────────────
// Los colores de la marca. Una plantilla que se le manda a un cliente es la
// primera cosa nuestra que ve: si parece una hoja de cálculo improvisada, la
// oferta que venga detrás arranca cuesta arriba.
const AZUL = 'FF0B2545';
const AZUL_CLARO = 'FF1B4B7A';
const AMBAR = 'FFE8A33D';
const GRIS = 'FFF3F5F8';
const BORDE: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFD5DBE3' } },
  left: { style: 'thin', color: { argb: 'FFD5DBE3' } },
  bottom: { style: 'thin', color: { argb: 'FFD5DBE3' } },
  right: { style: 'thin', color: { argb: 'FFD5DBE3' } },
};

const relleno = (argb: string): ExcelJS.Fill =>
  ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

/** Celda a rellenar: fondo claro y borde, para que se vea dónde escribir. */
function marcarEditable(celda: ExcelJS.Cell) {
  celda.fill = relleno('FFFFFDF5');
  celda.border = {
    ...BORDE,
    bottom: { style: 'thin', color: { argb: AMBAR } },
  };
}

function titulo(ws: ExcelJS.Worksheet, fila: number, texto: string, ancho: number) {
  ws.mergeCells(fila, 1, fila, ancho);
  const c = ws.getCell(fila, 1);
  c.value = texto;
  c.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  c.fill = relleno(AZUL);
  c.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(fila).height = 26;
}

function nota(ws: ExcelJS.Worksheet, fila: number, texto: string, ancho: number) {
  ws.mergeCells(fila, 1, fila, ancho);
  const c = ws.getCell(fila, 1);
  c.value = texto;
  c.font = { size: 10, color: { argb: 'FF5A6472' }, italic: true };
  c.alignment = { vertical: 'middle', indent: 1, wrapText: true };
}

function construirPlantilla(tarifa: TarifaAcceso): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gesmeco Energía';
  wb.created = new Date();

  const info = TARIFA_INFO[tarifa];
  const cols = columnasDeConsumo(tarifa);
  const nE = info.periodosEnergia.length;
  const nP = info.periodosPotencia.length;

  // ── 0. Instrucciones ──────────────────────────────────────────────────────
  const ins = wb.addWorksheet('Instrucciones', {
    properties: { tabColor: { argb: AZUL } },
    views: [{ showGridLines: false }],
  });
  ins.getColumn(1).width = 4;
  ins.getColumn(2).width = 100;

  ins.mergeCells('A1:B2');
  const cab = ins.getCell('A1');
  cab.value = `GESMECO ENERGÍA · Plantilla de consumos ${info.nombre}`;
  cab.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  cab.fill = relleno(AZUL);
  cab.alignment = { vertical: 'middle', indent: 2 };

  const lineas: [string, string][] = [
    ['', ''],
    ['1', 'Rellena la hoja «1. Suministro» con los datos de cabecera de la factura. Lo único imprescindible es la TARIFA DE ACCESO.'],
    ['2', 'En «2. Consumos y potencias» pon UNA FILA POR FACTURA. Cuantos más meses, mejor: con doce, el consumo anual no se estima, se suma.'],
    ['3', 'La columna «Días facturados» es importante: es lo que permite calcular el año exacto aunque falten meses o las facturas sean bimestrales.'],
    ['4', 'En «3. Precios actuales» pon lo que paga HOY. Sin esto se puede preparar la oferta, pero no se puede decir cuánto ahorra.'],
    ['', ''],
    ['⚠', `Esta plantilla es de ${info.nombre}: ${nE} periodos de energía y ${nP} de potencia. Si el suministro es de otra tarifa, descarga la plantilla que le corresponda — rellenar tres periodos de los seis que hay deja el ahorro calculado al doble de lo real.`],
    ['⚠', 'Los decimales pueden ir con coma o con punto, da igual. Lo que NO hay que hacer es escribir el punto de los miles en los kWh: «53.558» se entiende, pero «3.42» es ambiguo y saldrá marcado para revisar.'],
    ['⚠', 'Los precios de potencia van en €/kW y DÍA. Si en la factura vienen en €/kW y año, divídelos entre 365.'],
    ['', ''],
    ['', 'Las casillas con fondo crema y línea naranja son las que hay que rellenar. El resto no se toca.'],
    ['', 'No hace falta rellenarlo todo: lo que falte se avisa al subirlo, y se dice si algo impide calcular o solo conviene revisarlo.'],
  ];
  lineas.forEach(([marca, texto], i) => {
    const fila = 4 + i;
    const a = ins.getCell(fila, 1);
    const b = ins.getCell(fila, 2);
    a.value = marca;
    a.font = { bold: true, size: 11, color: { argb: marca === '⚠' ? AMBAR : AZUL_CLARO } };
    a.alignment = { vertical: 'top', horizontal: 'center' };
    b.value = texto;
    b.font = { size: 11, color: { argb: 'FF2A3441' } };
    b.alignment = { wrapText: true, vertical: 'top' };
    ins.getRow(fila).height = texto.length > 110 ? 42 : texto.length > 60 ? 30 : 18;
  });

  // ── 1. Suministro ─────────────────────────────────────────────────────────
  const sum = wb.addWorksheet('1. Suministro', { views: [{ showGridLines: false }] });
  sum.getColumn(1).width = 30;
  sum.getColumn(2).width = 34;
  sum.getColumn(3).width = 52;

  titulo(sum, 1, 'DATOS DEL SUMINISTRO', 3);
  nota(sum, 2, 'La columna de en medio es la que se rellena. La tarifa es obligatoria.', 3);

  CAMPOS_SUMINISTRO.forEach((campo, i) => {
    const fila = 4 + i;
    const et = sum.getCell(fila, 1);
    et.value = campo.etiqueta;
    et.font = { bold: campo.obligatorio, size: 11, color: { argb: AZUL } };
    et.fill = relleno(GRIS);
    et.border = BORDE;
    et.alignment = { vertical: 'middle', indent: 1 };

    const val = sum.getCell(fila, 2);
    if (campo.clave === 'tarifa') val.value = info.nombre;
    marcarEditable(val);
    val.alignment = { vertical: 'middle', indent: 1 };

    const ay = sum.getCell(fila, 3);
    ay.value = campo.ayuda + (campo.obligatorio ? ' · OBLIGATORIO' : '');
    ay.font = { size: 10, color: { argb: campo.obligatorio ? AMBAR : 'FF7A828E' }, italic: true };
    ay.alignment = { vertical: 'middle', indent: 1 };
    sum.getRow(fila).height = 20;
  });

  // ── 2. Consumos y potencias ───────────────────────────────────────────────
  const con = wb.addWorksheet('2. Consumos y potencias', { views: [{ showGridLines: false, state: 'frozen', ySplit: 5 }] });
  const total = cols.length;

  titulo(con, 1, `CONSUMOS Y POTENCIAS POR MES · ${info.nombre}`, total);
  nota(con, 2, 'Una fila por factura. Deja en blanco los meses que no tengas: se contarán solo los rellenados y se avisará de que el año está estimado.', total);

  // Cabecera de dos pisos: grupo arriba, periodo abajo. Sin el piso de arriba
  // hay dieciocho columnas llamadas P1..P6 tres veces y no se sabe cuál es cuál.
  const grupos: [string, number][] = [
    ['', 2],
    ['ENERGÍA CONSUMIDA (kWh)', nE],
    ['POTENCIA CONTRATADA (kW)', nP],
    ['MAXÍMETRO (kW)', nP],
  ];
  let c = 1;
  for (const [nombre, ancho] of grupos) {
    if (nombre) {
      con.mergeCells(4, c, 4, c + ancho - 1);
      const celda = con.getCell(4, c);
      celda.value = nombre;
      celda.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      celda.fill = relleno(AZUL_CLARO);
      celda.alignment = { horizontal: 'center', vertical: 'middle' };
      celda.border = BORDE;
    }
    c += ancho;
  }
  con.getRow(4).height = 20;

  cols.forEach((col, i) => {
    con.getColumn(i + 1).width = col.ancho;
    const celda = con.getCell(5, i + 1);
    celda.value = col.titulo;
    celda.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    celda.fill = relleno(AZUL);
    celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    celda.border = BORDE;
  });
  con.getRow(5).height = 24;

  MESES.forEach((mes, i) => {
    const fila = 6 + i;
    const m = con.getCell(fila, 1);
    m.value = mes;
    m.font = { bold: true, size: 11, color: { argb: AZUL } };
    m.fill = relleno(GRIS);
    m.border = BORDE;
    m.alignment = { vertical: 'middle', indent: 1 };

    for (let j = 2; j <= total; j++) {
      const celda = con.getCell(fila, j);
      marcarEditable(celda);
      celda.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
      // Formato español: coma decimal y punto de miles, para que lo que se
      // teclee se vea como en la factura.
      celda.numFmt = j === 2 ? '0' : '#,##0.###';
    }
    con.getRow(fila).height = 19;
  });

  // Fila de totales: se ve al momento si falta un mes o sobra un cero.
  const filaTotal = 6 + MESES.length;
  const t = con.getCell(filaTotal, 1);
  t.value = 'TOTAL';
  t.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  t.fill = relleno(AZUL_CLARO);
  t.alignment = { vertical: 'middle', indent: 1 };
  for (let j = 2; j <= 2 + nE; j++) {
    const celda = con.getCell(filaTotal, j);
    const col = celda.address.replace(/\d+/g, '');
    celda.value = { formula: `SUM(${col}6:${col}${filaTotal - 1})` };
    celda.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    celda.fill = relleno(AZUL_CLARO);
    celda.numFmt = j === 2 ? '0' : '#,##0';
    celda.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
  }
  con.getRow(filaTotal).height = 22;

  nota(con, filaTotal + 2,
    `Con menos de ${DIAS_MINIMOS_FIABLES} días facturados en total, el consumo anual se calcula extrapolando y la propuesta lo dirá.`,
    total);

  // ── 3. Precios actuales ───────────────────────────────────────────────────
  const pre = wb.addWorksheet('3. Precios actuales', { views: [{ showGridLines: false }] });
  pre.getColumn(1).width = 20;
  pre.getColumn(2).width = 20;
  pre.getColumn(3).width = 20;
  pre.getColumn(4).width = 50;

  titulo(pre, 1, 'LO QUE PAGA HOY', 4);
  nota(pre, 2, 'Precios sin impuestos, tal y como vienen en el desglose de la factura.', 4);

  ['Periodo', 'Energía (€/kWh)', 'Potencia (€/kW·día)', ''].forEach((h, i) => {
    const celda = pre.getCell(4, i + 1);
    celda.value = h;
    celda.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    celda.fill = relleno(AZUL);
    celda.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle', indent: 1 };
    celda.border = BORDE;
  });
  pre.getRow(4).height = 22;

  const filas = Math.max(nE, nP);
  for (let i = 0; i < filas; i++) {
    const fila = 5 + i;
    const p = pre.getCell(fila, 1);
    p.value = info.periodosEnergia[i] || info.periodosPotencia[i] || `P${i + 1}`;
    p.font = { bold: true, size: 11, color: { argb: AZUL } };
    p.fill = relleno(GRIS);
    p.border = BORDE;
    p.alignment = { vertical: 'middle', indent: 1 };

    const e = pre.getCell(fila, 2);
    if (i < nE) { marcarEditable(e); e.numFmt = '0.0000'; }
    e.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };

    const pot = pre.getCell(fila, 3);
    if (i < nP) { marcarEditable(pot); pot.numFmt = '0.0000'; }
    pot.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };

    pre.getRow(fila).height = 20;
  }

  nota(pre, 5 + filas + 1,
    'Si la factura da la potencia en €/kW y AÑO, divide entre 365 antes de ponerlo aquí. Es el error más habitual y multiplica el término de potencia por 365.',
    4);

  return wb;
}

export async function GET(req: NextRequest) {
  const pedida = req.nextUrl.searchParams.get('tarifa') || '3.0';
  const tarifa = (['2.0', '3.0', '6.1'].includes(pedida) ? pedida : '3.0') as TarifaAcceso;

  const wb = construirPlantilla(tarifa);
  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Gesmeco-consumos-${TARIFA_INFO[tarifa].nombre}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { archivo } = await req.json();
    if (!archivo) return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 });

    // Dos motores: Excel reordena el zip al guardar y ExcelJS no lo abre.
    // Ver src/lib/excel-hojas.ts — la plantilla que rechazábamos era válida.
    const libro = await leerLibro(String(archivo));

    const suministro = hojaCon(libro, 'suministro');
    const consumos = hojaCon(libro, 'consumo');
    const precios = hojaCon(libro, 'precio');

    if (!suministro.length || !consumos.length) {
      return NextResponse.json({
        error: `Ese Excel no es la plantilla de Gesmeco: le faltan las hojas «1. Suministro» y «2. Consumos y potencias». Trae ${libro.hojas.map((h) => h.nombre).join(', ') || 'ninguna hoja'}. Descárgala con el botón de arriba y rellénala.`,
      }, { status: 422 });
    }

    const lectura = interpretarPlantilla({ suministro, consumos, precios });

    return NextResponse.json({ ok: true, lectura, motor: libro.motor });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('plantilla: no se ha podido leer el Excel:', msg);
    return NextResponse.json(
      { error: `No se ha podido abrir el archivo: ${msg}. Comprueba que es el .xlsx de la plantilla y no un PDF o un CSV.` },
      { status: 422 }
    );
  }
}
