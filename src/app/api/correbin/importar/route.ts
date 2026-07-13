import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import { normalizarNombre, tituloVencimiento, SEGMENTO_COLOR } from '@/lib/correbin';
import { leerExcel } from '@/lib/excel-lectura';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Importación Excel del módulo Vencimientos y Cartera (manual, sin integración Avant/iSegur).
 *
 * GET  ?tipo=cartera|emisiones|anulaciones|vencimientos|mediador → plantilla .xlsx
 * POST { accion: 'analizar', archivo_base64, tipo }             → columnas + filas + mapeo sugerido
 * POST { accion: 'validar', tipo, mapeo, filas }                → filas anotadas (ok/incompleta/duplicada/error)
 * POST { accion: 'importar', tipo, mapeo, filas }               → importa sin borrar nada y devuelve resumen
 */

interface CampoDef { clave: string; nombre: string; obligatorio?: boolean; alias: string[] }

const TIPOS: Record<string, { nombre: string; campos: CampoDef[] }> = {
  cartera: {
    nombre: 'Cartera viva',
    campos: [
      { clave: 'cliente', nombre: 'Cliente', obligatorio: true, alias: ['cliente', 'nombre', 'tomador', 'asegurado', 'razon social'] },
      { clave: 'nif', nombre: 'CIF/NIF', alias: ['nif', 'cif', 'cif/nif', 'dni', 'documento'] },
      { clave: 'poliza', nombre: 'Póliza', alias: ['poliza', 'nº poliza', 'num poliza', 'numero poliza', 'n poliza', 'contrato'] },
      { clave: 'compania', nombre: 'Compañía', obligatorio: true, alias: ['compania', 'compañia', 'aseguradora', 'cia'] },
      { clave: 'ramo', nombre: 'Ramo', alias: ['ramo', 'producto', 'riesgo'] },
      { clave: 'prima', nombre: 'Prima', alias: ['prima', 'prima anual', 'prima neta', 'prima total', 'importe'] },
      { clave: 'vencimiento', nombre: 'Vencimiento', alias: ['vencimiento', 'fecha vencimiento', 'vto', 'fecha vto', 'vcto', 'fecha efecto renovacion'] },
      { clave: 'estado', nombre: 'Estado', alias: ['estado', 'situacion'] },
      { clave: 'responsable', nombre: 'Responsable', alias: ['responsable', 'gestor', 'comercial', 'tramitador'] },
    ],
  },
  emisiones: {
    nombre: 'Emisiones año',
    campos: [
      { clave: 'cliente', nombre: 'Cliente', obligatorio: true, alias: ['cliente', 'nombre', 'tomador', 'asegurado'] },
      { clave: 'fecha_emision', nombre: 'Fecha emisión', obligatorio: true, alias: ['fecha emision', 'emision', 'fecha alta', 'f emision'] },
      { clave: 'fecha_efecto', nombre: 'Efecto', alias: ['efecto', 'fecha efecto', 'f efecto'] },
      { clave: 'ramo', nombre: 'Ramo', alias: ['ramo', 'producto', 'riesgo'] },
      { clave: 'compania', nombre: 'Compañía', alias: ['compania', 'compañia', 'aseguradora', 'cia'] },
      { clave: 'prima', nombre: 'Prima', alias: ['prima', 'prima anual', 'prima neta', 'importe'] },
      { clave: 'comision', nombre: 'Comisión', alias: ['comision', 'comisión', 'com'] },
      { clave: 'tipo_produccion', nombre: 'Tipo producción', alias: ['tipo produccion', 'tipo', 'clase'] },
    ],
  },
  anulaciones: {
    nombre: 'Anulaciones año',
    campos: [
      { clave: 'cliente', nombre: 'Cliente', obligatorio: true, alias: ['cliente', 'nombre', 'tomador', 'asegurado'] },
      { clave: 'poliza', nombre: 'Póliza', alias: ['poliza', 'nº poliza', 'num poliza', 'numero poliza'] },
      { clave: 'fecha_anulacion', nombre: 'Fecha anulación', obligatorio: true, alias: ['fecha anulacion', 'anulacion', 'fecha baja', 'baja'] },
      { clave: 'prima', nombre: 'Prima', alias: ['prima', 'prima anual', 'importe'] },
      { clave: 'motivo', nombre: 'Motivo', alias: ['motivo', 'causa', 'razon'] },
      { clave: 'poliza_sustituta', nombre: 'Póliza sustituta', alias: ['poliza sustituta', 'sustituta', 'nueva poliza'] },
    ],
  },
  vencimientos: {
    nombre: 'Vencimientos',
    campos: [
      { clave: 'cliente', nombre: 'Cliente', obligatorio: true, alias: ['cliente', 'nombre', 'tomador', 'asegurado'] },
      { clave: 'ramo', nombre: 'Ramo', alias: ['ramo', 'producto', 'riesgo'] },
      { clave: 'compania', nombre: 'Compañía', alias: ['compania', 'compañia', 'aseguradora', 'cia'] },
      { clave: 'prima', nombre: 'Prima', alias: ['prima', 'prima anual', 'importe'] },
      { clave: 'fecha_vct', nombre: 'Fecha VCT', obligatorio: true, alias: ['fecha vct', 'vct', 'vencimiento', 'fecha vencimiento', 'vto'] },
      { clave: 'contacto', nombre: 'Contacto', alias: ['contacto', 'telefono', 'tel'] },
      { clave: 'responsable', nombre: 'Responsable', alias: ['responsable', 'gestor', 'comercial'] },
    ],
  },
  mediador: {
    nombre: 'Cambios de mediador',
    campos: [
      { clave: 'cliente', nombre: 'Cliente', obligatorio: true, alias: ['cliente', 'nombre', 'tomador'] },
      { clave: 'prima', nombre: 'Prima', alias: ['prima', 'prima anual', 'importe'] },
      { clave: 'carta_firmada', nombre: 'Carta firmada', alias: ['carta firmada', 'carta', 'firmada'] },
      { clave: 'estado_compania', nombre: 'Estado compañía', alias: ['estado compania', 'estado compañia', 'estado cia', 'estado'] },
      { clave: 'fecha_entrada', nombre: 'Fecha entrada', alias: ['fecha entrada', 'entrada', 'fecha incorporacion'] },
    ],
  },
  // Una sola plantilla mensual: emisiones + anulaciones + suplementos + cambios de mediador.
  // La clase de cada fila se deduce del texto del motivo.
  movimientos: {
    nombre: 'Movimientos del mes',
    campos: [
      { clave: 'compania', nombre: 'Compañía', obligatorio: true, alias: ['compania', 'compañia', 'aseguradora', 'cia'] },
      { clave: 'poliza', nombre: 'Nº de póliza', alias: ['poliza', 'nº poliza', 'nº de poliza', 'num poliza', 'numero poliza', 'n poliza', 'contrato'] },
      { clave: 'cliente', nombre: 'Tomador', obligatorio: true, alias: ['tomador', 'cliente', 'nombre', 'asegurado', 'razon social'] },
      { clave: 'riesgo', nombre: 'Riesgo', alias: ['riesgo', 'ramo', 'producto', 'descripcion riesgo'] },
      { clave: 'fecha_efecto', nombre: 'Fecha efecto', obligatorio: true, alias: ['fecha efecto', 'efecto', 'f efecto', 'fecha', 'f. efecto'] },
      { clave: 'importe', nombre: 'Importe', alias: ['importe', 'prima', 'prima anual', 'prima neta', 'prima total'] },
      { clave: 'motivo', nombre: 'Motivo', alias: ['motivo', 'causa', 'razon', 'tipo', 'observaciones', 'concepto'] },
      { clave: 'poliza_relacionada', nombre: 'Póliza relacionada', alias: ['poliza relacionada', 'otra poliza', 'suplemento de', 'poliza origen', 'poliza sustituta', 'sustituta', 'poliza anterior'] },
    ],
  },
};

/** Clase de un movimiento según su motivo (tolerante a variaciones de texto). */
function clasificarMovimiento(motivo: string): 'emision' | 'anulacion' | 'suplemento' | 'mediador' {
  const m = norm(motivo);
  if (!m) return 'emision';
  if (/mediador/.test(m)) return 'mediador';
  if (/suplement/.test(m)) return 'suplemento';
  if (/sustitu|venta|jubilac|hipotec|no lo necesit|no necesit|fallec|impago|anulac|\bbaja\b|cancel|siniestr/.test(m)) return 'anulacion';
  return 'emision';
}

const CLASE_MOV_LABEL: Record<string, string> = {
  emision: 'Emisión', anulacion: 'Anulación', suplemento: 'Suplemento', mediador: 'Cambio de mediador',
};

/** Busca un nº de póliza citado dentro del texto del motivo ("suplemento de la póliza HG-112233"). */
function polizaEnMotivo(motivo: string): string {
  const m = motivo.match(/p[oó]liza\s*(?:n?[ºo°.]?\s*)?([A-Za-z0-9][A-Za-z0-9\-\/.]{3,})/i);
  return m ? m[1].toUpperCase() : '';
}

// ── utilidades de celda ──
const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\/ ]/g, ' ').replace(/\s+/g, ' ').trim();

function celdaTexto(v: ExcelJS.CellValue): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('text' in (v as object)) return String((v as { text: string }).text).trim();
    if ('result' in (v as object)) return celdaTexto((v as { result: ExcelJS.CellValue }).result);
  }
  return String(v).trim();
}

function aFechaISO(t: string): string | null {
  if (!t) return null;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    const anio = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${anio}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

function aNumero(t: string): number {
  if (!t) return 0;
  // formato español: 1.234,56 → 1234.56
  const limpio = t.replace(/[€\s]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.');
  const n = parseFloat(limpio);
  return isNaN(n) ? 0 : n;
}

const esSi = (t: string) => /^(si|sí|s|yes|true|1|x|firmada)$/i.test(t.trim());

const RAMOS_MAP: [RegExp, string][] = [
  [/flota|camion|transporte/i, 'flota'], [/auto|coche|vehic/i, 'auto'], [/hogar|vivienda/i, 'hogar'],
  [/vida/i, 'vida'], [/salud|medic/i, 'salud'], [/\brc\b|responsabilidad/i, 'rc'],
  [/comercio|tienda|negocio/i, 'comercio'], [/agrar|ganad|explotacion/i, 'agrario'],
  [/deceso/i, 'decesos'], [/multirriesgo|industria|nave|pyme/i, 'multirriesgo'],
];
const mapRamo = (t: string) => (RAMOS_MAP.find(([re]) => re.test(t))?.[1]) || 'otros';

const TIPO_PROD_MAP: [RegExp, string][] = [
  [/nueva|nuevo/i, 'nueva'], [/ampli/i, 'ampliacion'], [/sustitu/i, 'sustitucion'],
  [/cambio.*comp|comp.*cambio/i, 'cambio_compania'], [/regular/i, 'regularizacion'],
];
const mapTipoProd = (t: string) => (TIPO_PROD_MAP.find(([re]) => re.test(t))?.[1]) || 'nueva';

const TIPO_ANUL_MAP: [RegExp, string][] = [
  [/sustitu/i, 'sustitucion_tecnica'], [/impago/i, 'impago'], [/venta/i, 'venta_riesgo'],
  [/error/i, 'error_admin'], [/cambio.*comp/i, 'cambio_compania'],
];
const mapTipoAnul = (t: string) => (TIPO_ANUL_MAP.find(([re]) => re.test(t))?.[1]) || 'real';

// ── GET: plantillas ──
export async function GET(req: NextRequest) {
  const tipo = req.nextUrl.searchParams.get('tipo') || 'cartera';
  const def = TIPOS[tipo];
  if (!def) return NextResponse.json({ error: 'Tipo no válido.' }, { status: 400 });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(def.nombre);
  ws.addRow(def.campos.map((c) => c.obligatorio ? `${c.nombre} *` : c.nombre));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
  ws.columns.forEach((c) => { c.width = 20; });

  const EJEMPLOS: Record<string, (string | number)[]> = {
    cartera: ['IBS Trans SL', 'B22001122', 'FL-778899', 'Allianz', 'Flota', 60000, '01/06/2026', 'Activa', 'Dirección'],
    emisiones: ['Talleres Cinca SL', '15/02/2026', '01/03/2026', 'Multirriesgo', 'Mapfre', 4200, 630, 'Nueva'],
    anulaciones: ['Pérez García, Juan', 'HG-112233', '10/01/2026', 320, 'Cambio a banco', ''],
    vencimientos: ['Ayuntamiento de Binéfar', 'RC', 'Zurich', 18000, '01/09/2026', '974428100', 'Dirección'],
    mediador: ['Ganadería Litera SL', 8500, 'Sí', 'En trámite', ''],
  };
  if (tipo === 'movimientos') {
    // Un ejemplo de cada clase para que se vea cómo clasifica el motivo
    ws.addRow(['Mapfre', 'AU-445566', 'Pérez García, Juan', 'Auto', '01/07/2026', 420, 'Nueva producción', '']);
    ws.addRow(['Allianz', 'HG-112233', 'López Sanz, María', 'Hogar', '05/07/2026', 310, 'Venta de vivienda', '']);
    ws.addRow(['Zurich', 'AU-999888', 'Talleres Cinca SL', 'Auto', '10/07/2026', 780, 'Sustitución', 'AU-445566']);
    ws.addRow(['Catalana', 'MR-777111', 'Ganadería Litera SL', 'Multirriesgo', '12/07/2026', 5400, 'Suplemento de la póliza MR-777000', '']);
    ws.addRow(['Mapfre', 'VD-222333', 'Casas Aler, Pilar', 'Vida', '15/07/2026', 260, 'Cambio de mediador', '']);
  } else {
    ws.addRow(EJEMPLOS[tipo]);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="plantilla_${tipo}_correbin.xlsx"`,
    },
  });
}

// ── ayudantes de importación ──

type Fila = string[];
interface Mapeo { [clave: string]: number } // clave de campo → índice de columna (-1 = sin mapear)

const val = (fila: Fila, mapeo: Mapeo, clave: string) =>
  mapeo[clave] != null && mapeo[clave] >= 0 ? (fila[mapeo[clave]] || '').trim() : '';

interface FilaAnotada {
  estado: 'ok' | 'incompleta' | 'duplicada' | 'error';
  motivo: string;
  alertas: string[];
}

async function cargarCaches() {
  const { data: clientes, error } = await supabase
    .from('vct_clientes').select('id, nombre, nif, segmento, prioridad, responsable');
  if (error) throw new Error(error.message);
  const { data: polizas } = await supabase
    .from('vct_polizas').select('id, cliente_id, numero_poliza, compania, ramo, fecha_vencimiento');

  const porNif = new Map<string, string>();
  const porNombre = new Map<string, string>();
  const infoCliente = new Map<string, { segmento: string; prioridad: string }>();
  for (const c of clientes || []) {
    if (c.nif) porNif.set(String(c.nif).toUpperCase().replace(/[\s-]/g, ''), c.id);
    porNombre.set(normalizarNombre(c.nombre), c.id);
    infoCliente.set(c.id, { segmento: c.segmento || 'particular_ordinario', prioridad: c.prioridad || 'C' });
  }
  const clavesPoliza = new Set(
    (polizas || [])
      .filter((p) => p.numero_poliza)
      .map((p) => `${p.cliente_id}|${String(p.numero_poliza).trim().toUpperCase()}|${normalizarNombre(p.compania || '')}`)
  );
  const polizasPorClienteNum = new Map(
    (polizas || []).filter((p) => p.numero_poliza).map((p) => [`${p.cliente_id}|${String(p.numero_poliza).trim().toUpperCase()}`, p.id])
  );
  return { porNif, porNombre, infoCliente, clavesPoliza, polizasPorClienteNum };
}

function validarFila(tipo: string, fila: Fila, mapeo: Mapeo, caches: Awaited<ReturnType<typeof cargarCaches>>, vistasEnExcel: Set<string>): FilaAnotada {
  const def = TIPOS[tipo];
  const alertas: string[] = [];

  const cliente = val(fila, mapeo, 'cliente');
  if (!cliente) return { estado: 'error', motivo: 'Falta el cliente', alertas };

  for (const campo of def.campos) {
    if (campo.obligatorio && campo.clave !== 'cliente' && !val(fila, mapeo, campo.clave)) {
      return { estado: 'incompleta', motivo: `Falta ${campo.nombre}`, alertas };
    }
  }

  // Fechas válidas
  for (const claveFecha of ['vencimiento', 'fecha_emision', 'fecha_anulacion', 'fecha_vct', 'fecha_entrada', 'fecha_efecto']) {
    const t = val(fila, mapeo, claveFecha);
    if (t && !aFechaISO(t)) {
      return { estado: 'error', motivo: `Fecha no válida en ${claveFecha}: "${t}"`, alertas };
    }
  }

  if (tipo === 'cartera') {
    if (!aNumero(val(fila, mapeo, 'prima'))) alertas.push('póliza sin prima');
    if (!aFechaISO(val(fila, mapeo, 'vencimiento'))) alertas.push('póliza sin vencimiento');

    const num = val(fila, mapeo, 'poliza').toUpperCase();
    const cia = normalizarNombre(val(fila, mapeo, 'compania'));
    if (num) {
      const nif = val(fila, mapeo, 'nif').toUpperCase().replace(/[\s-]/g, '');
      const clienteId = (nif && caches.porNif.get(nif)) || caches.porNombre.get(normalizarNombre(cliente));
      const claveBD = clienteId ? `${clienteId}|${num}|${cia}` : null;
      const claveExcel = `${normalizarNombre(cliente)}|${num}|${cia}`;
      if ((claveBD && caches.clavesPoliza.has(claveBD)) || vistasEnExcel.has(claveExcel)) {
        return { estado: 'duplicada', motivo: `Póliza ${num} de ${cliente} ya existe (${val(fila, mapeo, 'compania')})`, alertas };
      }
      vistasEnExcel.add(claveExcel);
    }
  }
  if (tipo === 'anulaciones' && !val(fila, mapeo, 'motivo')) alertas.push('anulación sin motivo');
  if (tipo === 'movimientos') {
    const motivo = val(fila, mapeo, 'motivo');
    alertas.push(`→ ${CLASE_MOV_LABEL[clasificarMovimiento(motivo)]}`);
    if (!motivo) alertas.push('sin motivo: se registrará como emisión');
    if (!aNumero(val(fila, mapeo, 'importe'))) alertas.push('sin importe');
  }
  if ((tipo === 'cartera' || tipo === 'vencimientos') && !val(fila, mapeo, 'responsable')) alertas.push('sin responsable (queda "sin asignar")');

  return {
    estado: alertas.some((a) => a.startsWith('póliza sin')) ? 'incompleta' : 'ok',
    motivo: alertas.join(' · '),
    alertas,
  };
}

async function resolverOCrearCliente(
  nombre: string, nif: string, telefono: string, responsable: string,
  caches: Awaited<ReturnType<typeof cargarCaches>>
): Promise<{ id: string; creado: boolean }> {
  const nifNorm = nif.toUpperCase().replace(/[\s-]/g, '');
  const nombreNorm = normalizarNombre(nombre);
  const existente = (nifNorm && caches.porNif.get(nifNorm)) || caches.porNombre.get(nombreNorm);
  if (existente) return { id: existente, creado: false };

  const { data, error } = await supabase
    .from('vct_clientes')
    .insert([{
      nombre: nombre.trim(),
      nif: nifNorm || null,
      telefono: telefono || null,
      responsable: responsable || null,
      prioridad: 'C',
      segmento: 'particular_ordinario',
    }])
    .select('id')
    .single();
  if (error || !data) throw new Error(`No se pudo crear el cliente ${nombre}: ${error?.message}`);
  if (nifNorm) caches.porNif.set(nifNorm, data.id);
  caches.porNombre.set(nombreNorm, data.id);
  caches.infoCliente.set(data.id, { segmento: 'particular_ordinario', prioridad: 'C' });
  return { id: data.id, creado: true };
}

async function crearVencimiento(params: {
  cliente_id: string; poliza_id: string | null; fecha: string; clienteNombre: string;
  ramo: string; prima: number; compania: string; responsable: string | null;
  caches: Awaited<ReturnType<typeof cargarCaches>>;
}) {
  const info = params.caches.infoCliente.get(params.cliente_id);
  const segmento = info?.segmento || 'particular_ordinario';
  await supabase.from('vct_vencimientos').upsert(
    {
      cliente_id: params.cliente_id,
      poliza_id: params.poliza_id,
      fecha_vct: params.fecha,
      titulo_evento: tituloVencimiento(params.clienteNombre, params.ramo, params.prima, params.compania),
      segmento,
      color: SEGMENTO_COLOR[segmento]?.nombre || 'gris',
      responsable: params.responsable,
    },
    params.poliza_id ? { onConflict: 'poliza_id,fecha_vct', ignoreDuplicates: true } : { ignoreDuplicates: true }
  );
}

// ── POST: analizar / validar / importar ──
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accion, tipo } = body;
    const def = TIPOS[tipo];
    if (!def) return NextResponse.json({ error: 'Tipo de importación no válido.' }, { status: 400 });

    // ── ANALIZAR: leer el Excel y sugerir mapeo ──
    if (accion === 'analizar') {
      // Lectura robusta: ExcelJS con respaldo SheetJS (ficheros de CRM, Python, LibreOffice...)
      let cabeceras: string[];
      let filas: Fila[];
      try {
        const leido = await leerExcel(body.archivo_base64);
        cabeceras = leido.cabeceras;
        filas = leido.filas;
      } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo leer el fichero.' }, { status: 400 });
      }

      // Mapeo sugerido por coincidencia de alias
      const mapeo: Mapeo = {};
      for (const campo of def.campos) {
        mapeo[campo.clave] = cabeceras.findIndex((h) => {
          const hn = norm(h || '').replace(/ \*$/, '');
          return campo.alias.some((a) => hn === norm(a)) || campo.alias.some((a) => hn.includes(norm(a)));
        });
      }

      return NextResponse.json({
        ok: true,
        cabeceras,
        filas,
        total: filas.length,
        campos: def.campos.map((c) => ({ clave: c.clave, nombre: c.nombre, obligatorio: !!c.obligatorio })),
        mapeo_sugerido: mapeo,
      });
    }

    // ── VALIDAR / IMPORTAR ──
    const { mapeo, filas } = body as { mapeo: Mapeo; filas: Fila[] };
    if (!mapeo || !Array.isArray(filas)) {
      return NextResponse.json({ error: 'Faltan mapeo o filas.' }, { status: 400 });
    }
    for (const campo of def.campos) {
      if (campo.obligatorio && (mapeo[campo.clave] == null || mapeo[campo.clave] < 0)) {
        return NextResponse.json({ error: `Falta mapear la columna obligatoria "${campo.nombre}".` }, { status: 400 });
      }
    }

    const caches = await cargarCaches();
    const vistasEnExcel = new Set<string>();
    const anotadas = filas.map((f) => validarFila(tipo, f, mapeo, caches, vistasEnExcel));

    const resumen = {
      total: filas.length,
      ok: anotadas.filter((a) => a.estado === 'ok').length,
      incompletas: anotadas.filter((a) => a.estado === 'incompleta').length,
      duplicadas: anotadas.filter((a) => a.estado === 'duplicada').length,
      errores: anotadas.filter((a) => a.estado === 'error').length,
    };

    if (accion === 'validar') {
      return NextResponse.json({ ok: true, filas_anotadas: anotadas, resumen });
    }

    if (accion !== 'importar') {
      return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });
    }

    // ── IMPORTAR (solo filas ok e incompletas; nunca borra ni sobreescribe) ──
    let importadas = 0;
    let clientesCreados = 0;
    const alertasGeneradas: string[] = [];
    const erroresImport: string[] = [];
    const clientesTocados = new Set<string>();

    for (let i = 0; i < filas.length; i++) {
      const anot = anotadas[i];
      if (anot.estado === 'duplicada' || anot.estado === 'error') continue;
      const fila = filas[i];
      const g = (k: string) => val(fila, mapeo, k);

      try {
        const { id: clienteId, creado } = await resolverOCrearCliente(
          g('cliente'), g('nif'), g('contacto'), g('responsable'), caches
        );
        if (creado) clientesCreados++;
        clientesTocados.add(clienteId);
        const responsable = g('responsable') || null;

        if (tipo === 'cartera') {
          const prima = aNumero(g('prima'));
          const venc = aFechaISO(g('vencimiento'));
          const ramo = mapRamo(g('ramo'));
          const { data: pol, error: errPol } = await supabase.from('vct_polizas').insert([{
            cliente_id: clienteId,
            numero_poliza: g('poliza') || null,
            compania: g('compania'),
            ramo,
            prima_anual: prima,
            fecha_vencimiento: venc,
            estado: !prima || !venc ? 'sin_datos' : (norm(g('estado')).includes('anulad') ? 'anulada' : 'activa'),
            responsable,
            origen_importacion: `excel_cartera_${new Date().toISOString().slice(0, 10)}`,
          }]).select('id').single();
          if (errPol) {
            if (errPol.code === '23505') { continue; } // duplicado por índice único → saltar
            throw new Error(errPol.message);
          }
          if (venc) {
            await crearVencimiento({
              cliente_id: clienteId, poliza_id: pol!.id, fecha: venc, clienteNombre: g('cliente'),
              ramo, prima, compania: g('compania'), responsable, caches,
            });
          }
          anot.alertas.forEach((a) => alertasGeneradas.push(`${g('cliente')}: ${a}`));
        }

        if (tipo === 'emisiones') {
          const { error } = await supabase.from('vct_produccion').insert([{
            cliente_id: clienteId,
            fecha_emision: aFechaISO(g('fecha_emision')),
            fecha_efecto: aFechaISO(g('fecha_efecto')),
            ramo: mapRamo(g('ramo')),
            compania: g('compania') || null,
            prima: aNumero(g('prima')),
            comision: aNumero(g('comision')),
            tipo_produccion: mapTipoProd(g('tipo_produccion')),
            responsable,
          }]);
          if (error) throw new Error(error.message);
        }

        if (tipo === 'anulaciones') {
          const num = g('poliza').toUpperCase();
          const polizaId = num ? caches.polizasPorClienteNum.get(`${clienteId}|${num}`) || null : null;
          const numSust = g('poliza_sustituta').toUpperCase();
          const sustId = numSust ? caches.polizasPorClienteNum.get(`${clienteId}|${numSust}`) || null : null;
          const tipoAnul = sustId ? 'sustitucion_tecnica' : mapTipoAnul(g('motivo'));
          const { error } = await supabase.from('vct_anulaciones').insert([{
            cliente_id: clienteId,
            poliza_id: polizaId,
            fecha_anulacion: aFechaISO(g('fecha_anulacion')),
            prima: aNumero(g('prima')),
            motivo: g('motivo') || null,
            tipo_anulacion: tipoAnul,
            poliza_sustituta_id: sustId,
            afecta_cartera: ['real', 'impago', 'venta_riesgo'].includes(tipoAnul),
          }]);
          if (error) throw new Error(error.message);
          if (polizaId) {
            await supabase.from('vct_polizas')
              .update({ estado: tipoAnul === 'sustitucion_tecnica' ? 'sustituida' : 'anulada' })
              .eq('id', polizaId);
          }
          if (!g('motivo')) alertasGeneradas.push(`${g('cliente')}: anulación sin motivo`);
        }

        if (tipo === 'vencimientos') {
          await crearVencimiento({
            cliente_id: clienteId, poliza_id: null, fecha: aFechaISO(g('fecha_vct'))!,
            clienteNombre: g('cliente'), ramo: mapRamo(g('ramo')), prima: aNumero(g('prima')),
            compania: g('compania'), responsable, caches,
          });
        }

        if (tipo === 'movimientos') {
          const motivo = g('motivo');
          const clase = clasificarMovimiento(motivo);
          const fecha = aFechaISO(g('fecha_efecto'));
          const importe = aNumero(g('importe'));
          const ramo = mapRamo(g('riesgo'));
          const compania = g('compania') || null;
          const num = g('poliza').toUpperCase();
          const polizaId = num ? caches.polizasPorClienteNum.get(`${clienteId}|${num}`) || null : null;
          const rel = (g('poliza_relacionada') || polizaEnMotivo(motivo)).toUpperCase();
          const relId = rel ? caches.polizasPorClienteNum.get(`${clienteId}|${rel}`) || null : null;

          if (clase === 'mediador') {
            const { error } = await supabase.from('vct_cambios_mediador').insert([{
              cliente_id: clienteId, prima: importe, compania, ramo,
              fecha_solicitud: fecha, estado: 'detectado',
              observaciones: [num ? `Póliza ${num}` : '', motivo].filter(Boolean).join(' · ') || null,
            }]);
            if (error) throw new Error(error.message);
          } else if (clase === 'anulacion') {
            const tipoAnul = relId || /sustitu/i.test(motivo) ? 'sustitucion_tecnica' : mapTipoAnul(motivo);
            const { error } = await supabase.from('vct_anulaciones').insert([{
              cliente_id: clienteId, poliza_id: polizaId,
              fecha_anulacion: fecha, prima: importe,
              motivo: motivo || null, tipo_anulacion: tipoAnul,
              poliza_sustituta_id: relId,
              afecta_cartera: ['real', 'impago', 'venta_riesgo'].includes(tipoAnul),
            }]);
            if (error) throw new Error(error.message);
            if (polizaId) {
              await supabase.from('vct_polizas')
                .update({ estado: tipoAnul === 'sustitucion_tecnica' ? 'sustituida' : 'anulada' })
                .eq('id', polizaId);
            }
          } else {
            // Emisión o suplemento → producción
            const { error } = await supabase.from('vct_produccion').insert([{
              cliente_id: clienteId, poliza_id: polizaId,
              fecha_emision: fecha, fecha_efecto: fecha,
              ramo, compania, prima: importe,
              tipo_produccion: clase === 'suplemento' ? 'ampliacion' : 'nueva',
              observaciones: clase === 'suplemento'
                ? ['Suplemento', rel ? `de póliza ${rel}` : '', motivo].filter(Boolean).join(' ')
                : motivo || null,
            }]);
            if (error) throw new Error(error.message);
          }
        }

        if (tipo === 'mediador') {
          const firmada = esSi(g('carta_firmada'));
          const entrada = aFechaISO(g('fecha_entrada'));
          const { error } = await supabase.from('vct_cambios_mediador').insert([{
            cliente_id: clienteId,
            prima: aNumero(g('prima')),
            carta_firmada: firmada,
            estado_compania: g('estado_compania') || null,
            fecha_entrada: entrada,
            estado: entrada ? 'incorporado' : firmada ? 'carta_firmada' : 'detectado',
          }]);
          if (error) throw new Error(error.message);
        }

        importadas++;
      } catch (e) {
        erroresImport.push(`Fila ${i + 2} (${g('cliente')}): ${e instanceof Error ? e.message : 'error'}`);
      }
    }

    // Recalcular prima/comisión total de los clientes tocados
    if (tipo === 'cartera' && clientesTocados.size > 0) {
      const { data: pols } = await supabase
        .from('vct_polizas')
        .select('cliente_id, prima_anual, comision, estado')
        .in('cliente_id', [...clientesTocados]);
      for (const cid of clientesTocados) {
        const vivas = (pols || []).filter((p) => p.cliente_id === cid && ['activa', 'viva', 'pendiente_revision', 'sin_datos'].includes(p.estado));
        await supabase.from('vct_clientes').update({
          prima_total: vivas.reduce((s, p) => s + (Number(p.prima_anual) || 0), 0),
          comision_total: vivas.reduce((s, p) => s + (Number(p.comision) || 0), 0),
        }).eq('id', cid);
      }
    }

    return NextResponse.json({
      ok: true,
      resumen: {
        ...resumen,
        importadas,
        clientes_creados: clientesCreados,
        saltadas_duplicadas: resumen.duplicadas,
        saltadas_error: resumen.errores,
      },
      alertas: alertasGeneradas.slice(0, 50),
      errores_importacion: erroresImport.slice(0, 50),
    });
  } catch (e) {
    console.error('Error en importación:', e);
    const msg = e instanceof Error ? e.message : 'Error procesando la importación.';
    return NextResponse.json({
      error: /does not exist|Could not find/i.test(msg)
        ? 'Faltan tablas v2. Ejecuta supabase_correbin_v2.sql en Supabase.'
        : msg,
    }, { status: 500 });
  }
}
