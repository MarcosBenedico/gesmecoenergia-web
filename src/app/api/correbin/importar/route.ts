import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Importación Excel de cartera (clientes + pólizas).
 * GET  → descarga la plantilla .xlsx
 * POST → body { archivo_base64 } con el Excel relleno; crea/actualiza clientes
 *        (emparejados por NIF, o por nombre si no hay NIF) y crea sus pólizas.
 */

const CABECERAS = [
  'Cliente *', 'NIF', 'Teléfono', 'Email', 'Población', 'Tipo (particular/empresa/agrario)',
  'Ramo *', 'Compañía *', 'Nº Póliza', 'Prima anual (€)', 'Fecha efecto (DD/MM/AAAA)',
  'Fecha vencimiento * (DD/MM/AAAA)', 'Forma pago', 'Responsable', 'Notas',
];

export async function GET() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Cartera');

  ws.addRow(CABECERAS);
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
  ws.columns.forEach((c, i) => { c.width = [28, 12, 13, 24, 16, 24, 12, 18, 16, 14, 20, 24, 12, 14, 30][i] || 15; });

  ws.addRow(['Ganadería Ejemplo SL', 'B22334455', '974000000', 'info@ejemplo.es', 'Binéfar', 'empresa',
    'agrario', 'Mapfre', 'POL-123456', 1850, '01/03/2025', '01/03/2026', 'anual', 'Marcos', 'Nave y maquinaria']);
  ws.addRow(['María García', '12345678Z', '600111222', '', 'Binéfar', 'particular',
    'hogar', 'Allianz', 'HG-99887', 320, '15/06/2025', '15/06/2026', 'anual', 'Marcos', '']);

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla_cartera_correbin.xlsx"',
    },
  });
}

const RAMOS_VALIDOS = ['hogar', 'auto', 'vida', 'salud', 'rc', 'comercio', 'agrario', 'decesos', 'otros'];

function celdaTexto(v: ExcelJS.CellValue): string {
  if (v == null) return '';
  if (typeof v === 'object' && 'text' in (v as object)) return String((v as { text: string }).text).trim();
  if (v instanceof Date) return v.toLocaleDateString('es-ES');
  return String(v).trim();
}

/** Acepta Date de Excel o texto DD/MM/AAAA → ISO (YYYY-MM-DD). */
function celdaFecha(v: ExcelJS.CellValue): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const t = celdaTexto(v);
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const anio = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${anio}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

export async function POST(req: NextRequest) {
  try {
    const { archivo_base64 } = await req.json();
    if (!archivo_base64) {
      return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 });
    }

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(archivo_base64, 'base64') as unknown as ExcelJS.Buffer);
    const ws = wb.worksheets[0];
    if (!ws) return NextResponse.json({ error: 'El Excel no tiene hojas.' }, { status: 400 });

    // Cache de clientes existentes para emparejar por NIF o nombre
    const { data: existentes, error: errCli } = await supabase
      .from('vct_clientes')
      .select('id, nombre, nif');
    if (errCli) {
      return NextResponse.json({
        error: /does not exist|Could not find/i.test(errCli.message)
          ? 'Las tablas del módulo no existen. Ejecuta supabase_correbin.sql en Supabase.'
          : errCli.message,
      }, { status: 500 });
    }

    const porNif = new Map((existentes || []).filter((c) => c.nif).map((c) => [String(c.nif).toUpperCase(), c.id]));
    const porNombre = new Map((existentes || []).map((c) => [c.nombre.toLowerCase().trim(), c.id]));

    let clientesCreados = 0;
    let polizasCreadas = 0;
    const errores: string[] = [];

    for (let i = 2; i <= ws.rowCount; i++) {
      const fila = ws.getRow(i);
      const nombre = celdaTexto(fila.getCell(1).value);
      if (!nombre) continue;

      const nif = celdaTexto(fila.getCell(2).value).toUpperCase();
      const ramoRaw = celdaTexto(fila.getCell(7).value).toLowerCase();
      const compania = celdaTexto(fila.getCell(8).value);
      const vencimiento = celdaFecha(fila.getCell(12).value);

      if (!compania || !vencimiento) {
        errores.push(`Fila ${i} (${nombre}): faltan compañía o fecha de vencimiento`);
        continue;
      }
      const ramo = RAMOS_VALIDOS.includes(ramoRaw) ? ramoRaw : 'otros';

      // Resolver o crear cliente
      let clienteId = (nif && porNif.get(nif)) || porNombre.get(nombre.toLowerCase());
      if (!clienteId) {
        const tipoRaw = celdaTexto(fila.getCell(6).value).toLowerCase();
        const { data: nuevo, error: errNuevo } = await supabase
          .from('vct_clientes')
          .insert([{
            nombre,
            nif: nif || null,
            telefono: celdaTexto(fila.getCell(3).value) || null,
            email: celdaTexto(fila.getCell(4).value) || null,
            poblacion: celdaTexto(fila.getCell(5).value) || null,
            tipo: ['particular', 'empresa', 'agrario'].includes(tipoRaw) ? tipoRaw : 'particular',
            responsable: celdaTexto(fila.getCell(14).value) || null,
          }])
          .select('id')
          .single();
        if (errNuevo || !nuevo) {
          errores.push(`Fila ${i} (${nombre}): ${errNuevo?.message || 'no se pudo crear el cliente'}`);
          continue;
        }
        clienteId = nuevo.id;
        clientesCreados++;
        if (nif) porNif.set(nif, clienteId);
        porNombre.set(nombre.toLowerCase(), clienteId);
      }

      const { error: errPol } = await supabase.from('vct_polizas').insert([{
        cliente_id: clienteId,
        numero_poliza: celdaTexto(fila.getCell(9).value) || null,
        ramo,
        compania,
        prima_anual: parseFloat(celdaTexto(fila.getCell(10).value).replace(',', '.')) || 0,
        fecha_efecto: celdaFecha(fila.getCell(11).value),
        fecha_vencimiento: vencimiento,
        forma_pago: celdaTexto(fila.getCell(13).value).toLowerCase() || 'anual',
        responsable: celdaTexto(fila.getCell(14).value) || null,
        notas: celdaTexto(fila.getCell(15).value) || null,
      }]);

      if (errPol) errores.push(`Fila ${i} (${nombre}): ${errPol.message}`);
      else polizasCreadas++;
    }

    return NextResponse.json({ ok: true, clientes_creados: clientesCreados, polizas_creadas: polizasCreadas, errores });
  } catch (e) {
    console.error('Error importando cartera:', e);
    return NextResponse.json({ error: 'Error procesando el Excel.' }, { status: 500 });
  }
}
