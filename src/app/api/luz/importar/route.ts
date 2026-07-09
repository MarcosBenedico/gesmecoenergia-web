import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import { normalizarNombre, normCups, tituloFechaCritica } from '@/lib/luz';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Importación Excel del módulo Gestión Luz (manual, sin integración con comercializadoras).
 * GET  ?tipo=clientes|cups|pipeline|contratos|comisiones → plantilla .xlsx
 * POST { accion: analizar | validar | importar, tipo, ... } → asistente completo
 */

interface CampoDef { clave: string; nombre: string; obligatorio?: boolean; alias: string[] }

const TIPOS: Record<string, { nombre: string; campos: CampoDef[] }> = {
  clientes: {
    nombre: 'Clientes energía',
    campos: [
      { clave: 'cliente', nombre: 'Cliente', obligatorio: true, alias: ['cliente', 'nombre', 'titular', 'razon social'] },
      { clave: 'nif', nombre: 'CIF/NIF', alias: ['nif', 'cif', 'cif/nif', 'dni'] },
      { clave: 'contacto', nombre: 'Contacto', alias: ['contacto', 'persona contacto', 'persona'] },
      { clave: 'telefono', nombre: 'Teléfono', alias: ['telefono', 'tel', 'movil'] },
      { clave: 'email', nombre: 'Email', alias: ['email', 'correo', 'mail'] },
      { clave: 'tipo_cliente', nombre: 'Tipo cliente', alias: ['tipo cliente', 'tipo', 'segmento'] },
      { clave: 'responsable', nombre: 'Responsable', alias: ['responsable', 'gestor', 'comercial'] },
      { clave: 'prioridad', nombre: 'Prioridad', alias: ['prioridad', 'prio'] },
      { clave: 'observaciones', nombre: 'Observaciones', alias: ['observaciones', 'notas', 'comentarios'] },
    ],
  },
  cups: {
    nombre: 'CUPS / suministros',
    campos: [
      { clave: 'cliente', nombre: 'Cliente', obligatorio: true, alias: ['cliente', 'nombre', 'titular'] },
      { clave: 'nif', nombre: 'CIF/NIF', alias: ['nif', 'cif', 'cif/nif'] },
      { clave: 'cups', nombre: 'CUPS', obligatorio: true, alias: ['cups', 'codigo cups', 'punto suministro'] },
      { clave: 'direccion', nombre: 'Dirección suministro', alias: ['direccion', 'direccion suministro', 'domicilio'] },
      { clave: 'tarifa', nombre: 'Tarifa', alias: ['tarifa', 'tarifa acceso', 'atr', 'peaje'] },
      { clave: 'comercializadora', nombre: 'Comercializadora actual', alias: ['comercializadora', 'comercializadora actual', 'compania'] },
      { clave: 'distribuidora', nombre: 'Distribuidora', alias: ['distribuidora'] },
      { clave: 'potencia', nombre: 'Potencia', alias: ['potencia', 'potencia contratada', 'kw'] },
      { clave: 'consumo', nombre: 'Consumo anual estimado', alias: ['consumo', 'consumo anual', 'kwh', 'consumo kwh'] },
      { clave: 'fecha_inicio', nombre: 'Fecha inicio contrato', alias: ['fecha inicio', 'inicio contrato', 'alta'] },
      { clave: 'fecha_fin', nombre: 'Fecha fin contrato', alias: ['fecha fin', 'fin contrato', 'vencimiento'] },
      { clave: 'permanencia', nombre: 'Permanencia', alias: ['permanencia', 'tiene permanencia'] },
      { clave: 'fin_permanencia', nombre: 'Fecha fin permanencia', alias: ['fin permanencia', 'fecha fin permanencia'] },
      { clave: 'dias_preaviso', nombre: 'Días preaviso', alias: ['dias preaviso', 'preaviso'] },
      { clave: 'penalizacion', nombre: 'Penalización', alias: ['penalizacion', 'penalización'] },
      { clave: 'estado', nombre: 'Estado', alias: ['estado', 'situacion'] },
      { clave: 'responsable', nombre: 'Responsable', alias: ['responsable', 'gestor'] },
    ],
  },
  pipeline: {
    nombre: 'Pipeline energético',
    campos: [
      { clave: 'cliente', nombre: 'Cliente', obligatorio: true, alias: ['cliente', 'nombre'] },
      { clave: 'cups', nombre: 'CUPS', alias: ['cups'] },
      { clave: 'tipo_oportunidad', nombre: 'Tipo oportunidad', alias: ['tipo oportunidad', 'tipo'] },
      { clave: 'consumo', nombre: 'Consumo anual estimado', alias: ['consumo', 'consumo anual', 'kwh'] },
      { clave: 'comision', nombre: 'Comisión potencial', alias: ['comision', 'comision potencial'] },
      { clave: 'estado', nombre: 'Estado', alias: ['estado'] },
      { clave: 'probabilidad', nombre: 'Probabilidad', alias: ['probabilidad', 'prob'] },
      { clave: 'responsable', nombre: 'Responsable', alias: ['responsable', 'gestor'] },
      { clave: 'proxima_accion', nombre: 'Próxima acción', alias: ['proxima accion', 'accion'] },
      { clave: 'fecha_accion', nombre: 'Fecha próxima acción', alias: ['fecha proxima accion', 'fecha accion'] },
    ],
  },
  contratos: {
    nombre: 'Contratos',
    campos: [
      { clave: 'cliente', nombre: 'Cliente', obligatorio: true, alias: ['cliente', 'nombre'] },
      { clave: 'cups', nombre: 'CUPS', alias: ['cups'] },
      { clave: 'comercializadora', nombre: 'Comercializadora final', obligatorio: true, alias: ['comercializadora', 'comercializadora final'] },
      { clave: 'tipo_contrato', nombre: 'Tipo contrato', alias: ['tipo contrato', 'tipo'] },
      { clave: 'fecha_envio', nombre: 'Fecha envío contrato', alias: ['fecha envio', 'envio'] },
      { clave: 'fecha_firma', nombre: 'Fecha firma', alias: ['fecha firma', 'firma'] },
      { clave: 'fecha_prevista', nombre: 'Fecha activación prevista', alias: ['activacion prevista', 'fecha prevista'] },
      { clave: 'fecha_real', nombre: 'Fecha activación real', alias: ['activacion real', 'fecha real', 'activacion'] },
      { clave: 'estado', nombre: 'Estado contrato', alias: ['estado', 'estado contrato'] },
      { clave: 'responsable', nombre: 'Responsable', alias: ['responsable', 'gestor'] },
    ],
  },
  comisiones: {
    nombre: 'Comisiones',
    campos: [
      { clave: 'cliente', nombre: 'Cliente', obligatorio: true, alias: ['cliente', 'nombre'] },
      { clave: 'cups', nombre: 'CUPS', alias: ['cups'] },
      { clave: 'comercializadora', nombre: 'Comercializadora', alias: ['comercializadora', 'compania'] },
      { clave: 'tipo_comision', nombre: 'Tipo comisión', alias: ['tipo comision', 'tipo'] },
      { clave: 'importe_previsto', nombre: 'Importe previsto', obligatorio: true, alias: ['importe previsto', 'previsto', 'importe'] },
      { clave: 'importe_cobrado', nombre: 'Importe cobrado', alias: ['importe cobrado', 'cobrado'] },
      { clave: 'fecha_prevista', nombre: 'Fecha prevista cobro', alias: ['fecha prevista', 'fecha prevista cobro'] },
      { clave: 'fecha_cobro', nombre: 'Fecha cobro', alias: ['fecha cobro', 'cobro'] },
      { clave: 'estado', nombre: 'Estado comisión', alias: ['estado', 'estado comision'] },
    ],
  },
};

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
  const limpio = t.replace(/[€\s]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.');
  const n = parseFloat(limpio);
  return isNaN(n) ? 0 : n;
}

const esSi = (t: string) => /^(si|sí|s|yes|true|1|x)$/i.test(t.trim());

const mapTarifa = (t: string) => {
  const n = t.toUpperCase().replace(/\s/g, '');
  if (n.includes('2.0') || n.includes('20TD')) return '2.0TD';
  if (n.includes('3.0') || n.includes('30TD')) return '3.0TD';
  if (n.includes('6.1')) return '6.1TD';
  if (n.includes('6.2')) return '6.2TD';
  return n ? 'otra' : '2.0TD';
};

const mapTipoCliente = (t: string) => {
  const n = norm(t);
  if (/industri/.test(n)) return 'industria';
  if (/autonom/.test(n)) return 'autonomo';
  if (/pyme|empresa|negocio/.test(n)) return 'pyme';
  if (/comunidad/.test(n)) return 'comunidad';
  if (/ayunta|municip/.test(n)) return 'ayuntamiento';
  if (/gran/.test(n)) return 'gran_cuenta';
  return 'particular';
};

// ── GET: plantillas ──
export async function GET(req: NextRequest) {
  const tipo = req.nextUrl.searchParams.get('tipo') || 'cups';
  const def = TIPOS[tipo];
  if (!def) return NextResponse.json({ error: 'Tipo no válido.' }, { status: 400 });

  const wb = new ExcelJS.Workbook();
  // Excel prohíbe * ? : \ / [ ] en nombres de hoja
  const ws = wb.addWorksheet(def.nombre.replace(/[*?:\\/[\]]/g, '-'));
  ws.addRow(def.campos.map((c) => (c.obligatorio ? `${c.nombre} *` : c.nombre)));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
  ws.columns.forEach((c) => { c.width = 20; });

  const EJEMPLOS: Record<string, (string | number)[]> = {
    clientes: ['Carnes Binéfar SA', 'A22334455', 'José Pérez', '974430001', 'admin@carnesbinefar.es', 'Industria', 'Energía', 'A', 'Alto consumo, 3 naves'],
    cups: ['Carnes Binéfar SA', 'A22334455', 'ES0021000012345678AB', 'Pol. Ind. El Sosal 1', '6.1TD', 'Endesa', 'e-distribución', 250, 850000, '01/03/2025', '01/03/2026', 'Sí', '01/03/2026', 30, '2000€', 'Pendiente ofertar', 'Energía'],
    pipeline: ['Talleres Urgeles SL', 'ES0021000098765432ZX', 'Cambio comercializadora', 45000, 900, 'Oferta enviada', 60, 'Energía', 'Llamar para cerrar', '15/07/2026'],
    contratos: ['Comunidad Plaza Mayor', 'ES0021000011112222CD', 'Nufri', 'Fijo', '01/07/2026', '', '01/08/2026', '', 'Pendiente firma', 'Energía'],
    comisiones: ['Talleres Urgeles SL', 'ES0021000098765432ZX', 'Nufri', 'Por kWh', 900, 0, '01/09/2026', '', 'Prevista'],
  };
  ws.addRow(EJEMPLOS[tipo]);

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="plantilla_luz_${tipo}.xlsx"`,
    },
  });
}

// ── ayudantes ──
type Fila = string[];
interface Mapeo { [clave: string]: number }
const val = (fila: Fila, mapeo: Mapeo, clave: string) =>
  mapeo[clave] != null && mapeo[clave] >= 0 ? (fila[mapeo[clave]] || '').trim() : '';

async function cargarCaches() {
  const { data: clientes, error } = await supabase.from('luz_clientes').select('id, nombre, nif, prioridad, responsable');
  if (error) throw new Error(error.message);
  const { data: cupsList } = await supabase.from('luz_cups').select('id, cups, cliente_id');

  const porNif = new Map<string, string>();
  const porNombre = new Map<string, string>();
  const prioridadCliente = new Map<string, string>();
  for (const c of clientes || []) {
    if (c.nif) porNif.set(String(c.nif).toUpperCase().replace(/[\s-]/g, ''), c.id);
    porNombre.set(normalizarNombre(c.nombre), c.id);
    prioridadCliente.set(c.id, c.prioridad || 'C');
  }
  const cupsExistentes = new Map((cupsList || []).map((c) => [normCups(c.cups), { id: c.id, cliente_id: c.cliente_id }]));
  return { porNif, porNombre, prioridadCliente, cupsExistentes };
}

interface FilaAnotada { estado: 'ok' | 'incompleta' | 'duplicada' | 'error'; motivo: string; alertas: string[] }

function validarFila(tipo: string, fila: Fila, mapeo: Mapeo, caches: Awaited<ReturnType<typeof cargarCaches>>, vistas: Set<string>): FilaAnotada {
  const def = TIPOS[tipo];
  const alertas: string[] = [];
  const cliente = val(fila, mapeo, 'cliente');
  if (!cliente) return { estado: 'error', motivo: 'Falta el cliente', alertas };

  for (const campo of def.campos) {
    if (campo.obligatorio && campo.clave !== 'cliente' && !val(fila, mapeo, campo.clave)) {
      return { estado: 'incompleta', motivo: `Falta ${campo.nombre}`, alertas };
    }
  }
  for (const cf of ['fecha_inicio', 'fecha_fin', 'fin_permanencia', 'fecha_envio', 'fecha_firma', 'fecha_prevista', 'fecha_real', 'fecha_accion', 'fecha_cobro']) {
    const t = val(fila, mapeo, cf);
    if (t && !aFechaISO(t)) return { estado: 'error', motivo: `Fecha no válida en ${cf}: "${t}"`, alertas };
  }

  if (tipo === 'cups') {
    const cups = normCups(val(fila, mapeo, 'cups'));
    if (cups.length < 10) return { estado: 'error', motivo: `CUPS no válido: "${cups}"`, alertas };
    if (caches.cupsExistentes.has(cups) || vistas.has(cups)) {
      return { estado: 'duplicada', motivo: `El CUPS ${cups} ya existe`, alertas };
    }
    vistas.add(cups);
    if (!val(fila, mapeo, 'fecha_fin')) alertas.push('CUPS sin fecha fin contrato');
    if (!val(fila, mapeo, 'consumo')) alertas.push('CUPS sin consumo estimado');
    if (!val(fila, mapeo, 'responsable')) alertas.push('sin responsable (queda "sin asignar")');
  }

  return { estado: alertas.some((a) => a.startsWith('CUPS sin')) ? 'incompleta' : 'ok', motivo: alertas.join(' · '), alertas };
}

async function resolverOCrearCliente(
  nombre: string, nif: string, extras: Record<string, unknown>,
  caches: Awaited<ReturnType<typeof cargarCaches>>
): Promise<{ id: string; creado: boolean }> {
  const nifNorm = nif.toUpperCase().replace(/[\s-]/g, '');
  const nombreNorm = normalizarNombre(nombre);
  const existente = (nifNorm && caches.porNif.get(nifNorm)) || caches.porNombre.get(nombreNorm);
  if (existente) return { id: existente, creado: false };

  const { data, error } = await supabase.from('luz_clientes')
    .insert([{ nombre: nombre.trim(), nif: nifNorm || null, ...extras }])
    .select('id, prioridad').single();
  if (error || !data) throw new Error(`No se pudo crear el cliente ${nombre}: ${error?.message}`);
  if (nifNorm) caches.porNif.set(nifNorm, data.id);
  caches.porNombre.set(nombreNorm, data.id);
  caches.prioridadCliente.set(data.id, (extras.prioridad as string) || 'C');
  return { id: data.id, creado: true };
}

async function crearFechaCritica(params: {
  cliente_id: string; cups_id: string | null; tipo: string; fecha: string;
  clienteNombre: string; cups: string; comercializadora: string | null;
  prioridad: string; responsable: string | null;
}) {
  await supabase.from('luz_fechas_criticas').upsert({
    cliente_id: params.cliente_id,
    cups_id: params.cups_id,
    tipo_fecha: params.tipo,
    fecha: params.fecha,
    titulo: tituloFechaCritica(params.clienteNombre, params.cups, params.tipo, params.comercializadora),
    prioridad: params.prioridad,
    responsable: params.responsable,
  }, params.cups_id ? { onConflict: 'cups_id,tipo_fecha,fecha', ignoreDuplicates: true } : { ignoreDuplicates: true });
}

// ── POST ──
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accion, tipo } = body;
    const def = TIPOS[tipo];
    if (!def) return NextResponse.json({ error: 'Tipo de importación no válido.' }, { status: 400 });

    if (accion === 'analizar') {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(Buffer.from(body.archivo_base64, 'base64') as unknown as ExcelJS.Buffer);
      const ws = wb.worksheets[0];
      if (!ws) return NextResponse.json({ error: 'El Excel no tiene hojas.' }, { status: 400 });

      const cabeceras: string[] = [];
      ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => { cabeceras[col - 1] = celdaTexto(cell.value); });
      const filas: Fila[] = [];
      for (let i = 2; i <= Math.min(ws.rowCount, 5001); i++) {
        const fila: Fila = [];
        ws.getRow(i).eachCell({ includeEmpty: true }, (cell, col) => { fila[col - 1] = celdaTexto(cell.value); });
        if (fila.some((c) => c && c.trim())) filas.push(fila);
      }

      const mapeo: Mapeo = {};
      for (const campo of def.campos) {
        mapeo[campo.clave] = cabeceras.findIndex((h) => {
          const hn = norm(h || '').replace(/ \*$/, '');
          return campo.alias.some((a) => hn === norm(a)) || campo.alias.some((a) => hn.includes(norm(a)));
        });
      }

      return NextResponse.json({
        ok: true, cabeceras, filas, total: filas.length,
        campos: def.campos.map((c) => ({ clave: c.clave, nombre: c.nombre, obligatorio: !!c.obligatorio })),
        mapeo_sugerido: mapeo,
      });
    }

    const { mapeo, filas } = body as { mapeo: Mapeo; filas: Fila[] };
    if (!mapeo || !Array.isArray(filas)) return NextResponse.json({ error: 'Faltan mapeo o filas.' }, { status: 400 });
    for (const campo of def.campos) {
      if (campo.obligatorio && (mapeo[campo.clave] == null || mapeo[campo.clave] < 0)) {
        return NextResponse.json({ error: `Falta mapear la columna obligatoria "${campo.nombre}".` }, { status: 400 });
      }
    }

    const caches = await cargarCaches();
    const vistas = new Set<string>();
    const anotadas = filas.map((f) => validarFila(tipo, f, mapeo, caches, vistas));
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
    if (accion !== 'importar') return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });

    let importadas = 0;
    let clientesCreados = 0;
    const alertasGeneradas: string[] = [];
    const erroresImport: string[] = [];

    for (let i = 0; i < filas.length; i++) {
      const anot = anotadas[i];
      if (anot.estado === 'duplicada' || anot.estado === 'error') continue;
      const fila = filas[i];
      const g = (k: string) => val(fila, mapeo, k);

      try {
        const responsable = g('responsable') || null;

        if (tipo === 'clientes') {
          const { creado } = await resolverOCrearCliente(g('cliente'), g('nif'), {
            persona_contacto: g('contacto') || null,
            telefono: g('telefono') || null,
            email: g('email') || null,
            tipo_cliente: mapTipoCliente(g('tipo_cliente')),
            responsable,
            prioridad: ['A', 'B', 'C', 'D'].includes(g('prioridad').toUpperCase()) ? g('prioridad').toUpperCase() : 'C',
            observaciones: g('observaciones') || null,
          }, caches);
          if (creado) clientesCreados++;
          importadas++;
          continue;
        }

        const { id: clienteId, creado } = await resolverOCrearCliente(g('cliente'), g('nif'), { responsable }, caches);
        if (creado) clientesCreados++;
        const prioridad = caches.prioridadCliente.get(clienteId) || 'C';

        if (tipo === 'cups') {
          const cups = normCups(g('cups'));
          const finContrato = aFechaISO(g('fecha_fin'));
          const finPermanencia = aFechaISO(g('fin_permanencia'));
          const diasPreaviso = parseInt(g('dias_preaviso')) || null;
          const fechaLimitePreaviso = finContrato && diasPreaviso
            ? new Date(new Date(finContrato).getTime() - diasPreaviso * 86400000).toISOString().slice(0, 10)
            : null;
          const consumo = aNumero(g('consumo'));

          const { data: nuevo, error: errCups } = await supabase.from('luz_cups').insert([{
            cliente_id: clienteId,
            cups,
            direccion_suministro: g('direccion') || null,
            tarifa_acceso: mapTarifa(g('tarifa')),
            comercializadora_actual: g('comercializadora') || null,
            distribuidora: g('distribuidora') || null,
            potencias_kw: aNumero(g('potencia')) ? [aNumero(g('potencia'))] : [],
            consumo_anual_kwh: consumo,
            fecha_inicio_contrato: aFechaISO(g('fecha_inicio')),
            fecha_fin_contrato: finContrato,
            tiene_permanencia: esSi(g('permanencia')) || !!finPermanencia,
            fecha_fin_permanencia: finPermanencia,
            dias_preaviso: diasPreaviso,
            fecha_limite_preaviso: fechaLimitePreaviso,
            penalizacion: g('penalizacion') || null,
            estado_cups: !finContrato || !consumo ? 'datos_incompletos' : 'factura_recibida',
            responsable,
            prioridad,
            observaciones: null,
          }]).select('id').single();
          if (errCups) {
            if (errCups.code === '23505') continue;
            throw new Error(errCups.message);
          }

          // Fechas críticas automáticas
          const base = {
            cliente_id: clienteId, cups_id: nuevo!.id, clienteNombre: g('cliente'), cups,
            comercializadora: g('comercializadora') || null, prioridad, responsable,
          };
          if (finContrato) await crearFechaCritica({ ...base, tipo: 'fin_contrato', fecha: finContrato });
          if (finPermanencia) await crearFechaCritica({ ...base, tipo: 'fin_permanencia', fecha: finPermanencia });
          if (fechaLimitePreaviso) await crearFechaCritica({ ...base, tipo: 'limite_preaviso', fecha: fechaLimitePreaviso });
          anot.alertas.forEach((a) => alertasGeneradas.push(`${g('cliente')} (${cups}): ${a}`));
        }

        if (tipo === 'pipeline') {
          const cupsRef = g('cups') ? caches.cupsExistentes.get(normCups(g('cups'))) : null;
          const proximaAccion = g('proxima_accion') || null;
          const { data: op, error } = await supabase.from('luz_pipeline').insert([{
            cliente_id: clienteId,
            cups_id: cupsRef?.id || null,
            nombre_oportunidad: `${g('cliente')} · ${g('tipo_oportunidad') || 'oportunidad'}`,
            tipo_oportunidad: 'cambio_comercializadora',
            consumo_anual_kwh: aNumero(g('consumo')),
            comision_potencial: aNumero(g('comision')),
            estado: 'prospecto',
            probabilidad: parseInt(g('probabilidad')) || 50,
            responsable,
            proxima_accion: proximaAccion,
            fecha_proxima_accion: aFechaISO(g('fecha_accion')),
          }]).select('id').single();
          if (error) throw new Error(error.message);
          // Tarea automática si hay próxima acción
          if (proximaAccion && op) {
            await supabase.from('luz_tareas').insert([{
              cliente_id: clienteId, pipeline_id: op.id, tipo_tarea: 'seguimiento',
              descripcion: proximaAccion, responsable, fecha_limite: aFechaISO(g('fecha_accion')),
            }]);
          }
          if (!proximaAccion) alertasGeneradas.push(`${g('cliente')}: oportunidad sin próxima acción`);
        }

        if (tipo === 'contratos') {
          const cupsRef = g('cups') ? caches.cupsExistentes.get(normCups(g('cups'))) : null;
          const { error } = await supabase.from('luz_contratos').insert([{
            cliente_id: clienteId,
            cups_id: cupsRef?.id || null,
            comercializadora_final: g('comercializadora'),
            tipo_contrato: g('tipo_contrato').toLowerCase() || 'fijo',
            fecha_envio_contrato: aFechaISO(g('fecha_envio')),
            fecha_firma: aFechaISO(g('fecha_firma')),
            fecha_activacion_prevista: aFechaISO(g('fecha_prevista')),
            fecha_activacion_real: aFechaISO(g('fecha_real')),
            estado_contrato: aFechaISO(g('fecha_real')) ? 'activado' : aFechaISO(g('fecha_firma')) ? 'firmado' : 'pendiente_firma',
            responsable,
          }]);
          if (error) throw new Error(error.message);
        }

        if (tipo === 'comisiones') {
          const cupsRef = g('cups') ? caches.cupsExistentes.get(normCups(g('cups'))) : null;
          const previsto = aNumero(g('importe_previsto'));
          const cobrado = aNumero(g('importe_cobrado'));
          const { error } = await supabase.from('luz_comisiones').insert([{
            cliente_id: clienteId,
            cups_id: cupsRef?.id || null,
            comercializadora: g('comercializadora') || null,
            tipo_comision: 'desconocida',
            importe_previsto: previsto,
            importe_cobrado: cobrado,
            fecha_prevista_cobro: aFechaISO(g('fecha_prevista')),
            fecha_cobro: aFechaISO(g('fecha_cobro')),
            estado_comision: cobrado >= previsto && previsto > 0 ? 'cobrada' : cobrado > 0 ? 'cobrada_parcial' : 'prevista',
          }]);
          if (error) throw new Error(error.message);
        }

        importadas++;
      } catch (e) {
        erroresImport.push(`Fila ${i + 2} (${g('cliente')}): ${e instanceof Error ? e.message : 'error'}`);
      }
    }

    return NextResponse.json({
      ok: true,
      resumen: { ...resumen, importadas, clientes_creados: clientesCreados },
      alertas: alertasGeneradas.slice(0, 50),
      errores_importacion: erroresImport.slice(0, 50),
    });
  } catch (e) {
    console.error('Error en importación luz:', e);
    const msg = e instanceof Error ? e.message : 'Error procesando la importación.';
    return NextResponse.json({
      error: /does not exist|Could not find/i.test(msg)
        ? 'Faltan las tablas del módulo. Ejecuta supabase_luz.sql en Supabase.'
        : msg,
    }, { status: 500 });
  }
}
