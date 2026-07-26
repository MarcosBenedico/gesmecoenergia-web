import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  ErrorDatadis, contrato, curvaMes, cupsComparable, maximetros,
  reactiva, suministros, ultimosMeses,
} from '@/lib/datadis';
import {
  PRECIOS_POTENCIA_REFERENCIA, diagnosticarReactiva, optimizarPotencias,
  perfilDeCurva, precioPotenciaDia,
  type LecturaMaximo,
} from '@/lib/potencia';
import type { TarifaAcceso } from '@/lib/tarifas';

/**
 * CONSUMO REAL · DATADIS
 *
 * GET  /api/luz/datadis                → estado de toda la cartera
 * GET  /api/luz/datadis?cups=ES00...   → ficha de un CUPS, ya analizada
 * POST /api/luz/datadis  { accion: 'comprobar', cliente_id }
 * POST /api/luz/datadis  { accion: 'sincronizar', cups_id, meses? }
 * POST /api/luz/datadis  { accion: 'guardar_analisis', cups_id }
 *
 * Tres decisiones de diseño que conviene no deshacer sin pensarlo:
 *
 *  · LA CURVA NO SALE DE AQUÍ EN CRUDO. Dos años de un CUPS son ~17.500 filas;
 *    mandarlas al navegador para pintar una media por hora es tirar el ancho de
 *    banda del móvil de David. El perfil se calcula en el servidor y viaja ya
 *    resumido.
 *
 *  · ANTES DE PEDIR, SE MIRA EL DIARIO. Datadis raciona a una consulta por CUPS
 *    y mes cada 24 h. Si el mes ya está pedido, se salta. Sin esto, un clic de
 *    más gasta el turno del día y encima parece que algo está roto.
 *
 *  · UN CUPS QUE FALLA NO TUMBA LA SINCRONIZACIÓN. Se recoge el fallo, se
 *    apunta con su causa y se sigue. La respuesta cuenta qué entró y qué no.
 */

// Datadis tarda de verdad: 30-60 s por llamada es normal y una sincronización
// son varias. Este techo tiene que ir por encima del DATADIS_TIMEOUT_MS.
export const maxDuration = 300;

function clienteSupabase(req: NextRequest) {
  const auth = req.headers.get('authorization');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    auth ? { global: { headers: { Authorization: auth } } } : undefined
  );
}
type Supa = ReturnType<typeof clienteSupabase>;

/** Clave de `luz_config` donde se pueden revisar los precios sin tocar código. */
const CLAVE_PRECIOS = 'precios_potencia_kw_anio';

/**
 * Una relación anidada de Supabase, normalizada.
 *
 * Según cómo se escriba el `select`, el cliente tipa `luz_clientes(...)` como
 * objeto o como array de un elemento. Aquí solo interesa la fila, así que se
 * aplana en un sitio en vez de repartir castings por todo el archivo.
 */
function relacion(v: unknown): Record<string, unknown> {
  if (Array.isArray(v)) return (v[0] as Record<string, unknown>) || {};
  return (v as Record<string, unknown>) || {};
}

/** '3.0TD' → '3.0'. Lo que hay en luz_cups no es lo que espera tarifas.ts. */
function aTarifa(valor: string | null | undefined): TarifaAcceso {
  const s = String(valor || '').replace(/TD/i, '').trim();
  if (s.startsWith('6')) return '6.1';
  if (s.startsWith('3')) return '3.0';
  return '2.0';
}

/** Faltan las tablas: mensaje con el arreglo concreto, no un 500 mudo. */
function faltaTabla(mensaje: string) {
  return /relation .*luz_datadis.*does not exist|Could not find the table|column .*datadis_/i.test(mensaje);
}

function respuestaFaltaTabla() {
  return NextResponse.json(
    {
      error: 'Falta la parte de Datadis en la base de datos: ejecuta supabase_datadis.sql en el SQL Editor de Supabase.',
      falta_migracion: true,
    },
    { status: 400 }
  );
}

/** Traduce un ErrorDatadis a la respuesta HTTP que le corresponde. */
function respuestaDatadis(e: unknown) {
  if (e instanceof ErrorDatadis) {
    const estado = e.fallo.tipo === 'sin_credenciales' || e.fallo.tipo === 'login' ? 400
      : e.fallo.tipo === 'racionado' ? 429
      : e.fallo.tipo === 'lento' ? 504
      : 502;
    return NextResponse.json({ error: e.fallo.mensaje, causa: e.fallo.tipo }, { status: estado });
  }
  return NextResponse.json({ error: 'No se ha podido hablar con Datadis.' }, { status: 502 });
}

/** Precios de potencia a usar: los revisados de `luz_config` o los de referencia. */
async function preciosPotencia(supa: Supa, tarifa: TarifaAcceso) {
  try {
    const { data } = await supa.from('luz_config').select('valor').eq('clave', CLAVE_PRECIOS).maybeSingle();
    const guardado = data?.valor ? JSON.parse(data.valor as string) : null;
    const anuales = guardado?.[tarifa];
    if (Array.isArray(anuales) && anuales.length) {
      return { dia: precioPotenciaDia(tarifa, anuales), revisados: true, anuales };
    }
  } catch { /* sin configurar: se usan los de referencia */ }
  return {
    dia: precioPotenciaDia(tarifa),
    revisados: false,
    anuales: PRECIOS_POTENCIA_REFERENCIA[tarifa],
  };
}

/** Apunta en el diario. Que falle el apunte no puede tumbar la sincronización. */
async function apuntar(
  supa: Supa,
  fila: { cups: string; tipo: string; mes?: string | null; estado: string; filas?: number; mensaje?: string }
) {
  try {
    await supa.from('luz_datadis_sync').insert([{ ...fila, mes: fila.mes ?? null, filas: fila.filas ?? 0 }]);
  } catch { /* el diario es un extra */ }
}

/**
 * ¿Se puede pedir ya este mes, o Datadis nos va a decir que esperemos?
 * Devuelve el motivo por el que se salta, o null si hay vía libre.
 */
async function yaPedidoHoy(supa: Supa, cups: string, tipo: string, mes: string | null): Promise<string | null> {
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let q = supa
    .from('luz_datadis_sync')
    .select('estado, pedido_en')
    .eq('cups', cups)
    .eq('tipo', tipo)
    .gte('pedido_en', hace24h)
    .order('pedido_en', { ascending: false })
    .limit(1);
  q = mes === null ? q.is('mes', null) : q.eq('mes', mes);

  const { data } = await q;
  const previo = data?.[0];
  if (!previo) return null;
  if (previo.estado === 'ok' || previo.estado === 'vacio') return 'ya estaba pedido en las últimas 24 h';
  if (previo.estado === 'racionado') return 'Datadis lo racionó hace menos de 24 h';
  return null; // un error de verdad sí se puede reintentar
}

/** Guarda en trozos: una sola sentencia con 17.000 filas la tumba Supabase. */
async function guardarEnTrozos(
  supa: Supa,
  tabla: string,
  filas: Record<string, unknown>[],
  onConflict: string
): Promise<{ guardadas: number; error: string | null }> {
  let guardadas = 0;
  for (let i = 0; i < filas.length; i += 500) {
    const trozo = filas.slice(i, i + 500);
    const { error } = await supa.from(tabla).upsert(trozo, { onConflict, ignoreDuplicates: false });
    if (error) return { guardadas, error: error.message };
    guardadas += trozo.length;
  }
  return { guardadas, error: null };
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const supa = clienteSupabase(req);
  const cups = req.nextUrl.searchParams.get('cups');

  try {
    return cups ? await fichaDeCups(supa, cups) : await estadoCartera(supa);
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : '';
    if (faltaTabla(mensaje)) return respuestaFaltaTabla();
    return NextResponse.json({ error: 'No se ha podido leer el consumo guardado.' }, { status: 500 });
  }
}

/**
 * Estado de toda la cartera: una fila por CUPS con lo justo para decidir a quién
 * mirar. Se apoya en el último análisis guardado y en las marcas de
 * sincronización, no en contar millones de filas de curva.
 */
async function estadoCartera(supa: Supa) {
  const { data: cupsFilas, error } = await supa
    .from('luz_cups')
    .select('id, cups, alias_suministro, tarifa_acceso, potencias_kw, cliente_id, datadis_distribuidora_codigo, datadis_point_type, datadis_ultima_sync, luz_clientes(nombre, nif, datadis_autorizado, datadis_comprobado_en)')
    .order('cups', { ascending: true });

  if (error) {
    if (faltaTabla(error.message)) return respuestaFaltaTabla();
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Último análisis de cada CUPS: se pide ordenado y se queda el primero.
  const { data: analisis } = await supa
    .from('luz_datadis_analisis')
    .select('cups, ahorro_anual, confianza, creado_en, pct_horas_solares, penalizacion_estimada')
    .order('creado_en', { ascending: false });

  const ultimoPorCups = new Map<string, Record<string, unknown>>();
  for (const a of analisis || []) {
    const clave = cupsComparable(a.cups as string);
    if (!ultimoPorCups.has(clave)) ultimoPorCups.set(clave, a);
  }

  const filas = (cupsFilas || []).map((c) => {
    const cliente = relacion(c.luz_clientes);
    const ultimo = ultimoPorCups.get(cupsComparable(c.cups as string));
    return {
      cups_id: c.id,
      cups: c.cups,
      alias: c.alias_suministro,
      tarifa: c.tarifa_acceso,
      cliente_id: c.cliente_id,
      cliente: cliente.nombre ?? null,
      nif: cliente.nif ?? null,
      autorizado: !!cliente.datadis_autorizado,
      autorizacion_comprobada_en: cliente.datadis_comprobado_en ?? null,
      // Sin código de distribuidora no se puede pedir nada: es el primer paso
      listo_para_sincronizar: !!c.datadis_distribuidora_codigo,
      ultima_sync: c.datadis_ultima_sync,
      ahorro_anual: ultimo?.ahorro_anual ?? null,
      penalizacion_estimada: ultimo?.penalizacion_estimada ?? null,
      confianza: ultimo?.confianza ?? null,
      pct_horas_solares: ultimo?.pct_horas_solares ?? null,
      analizado_en: ultimo?.creado_en ?? null,
    };
  });

  const conAhorro = filas.filter((f) => typeof f.ahorro_anual === 'number' && f.ahorro_anual > 0);
  return NextResponse.json({
    datos: filas,
    resumen: {
      cups_total: filas.length,
      autorizados: filas.filter((f) => f.autorizado).length,
      listos: filas.filter((f) => f.listo_para_sincronizar).length,
      analizados: filas.filter((f) => f.analizado_en).length,
      con_ahorro: conAhorro.length,
      ahorro_detectado: Math.round(conAhorro.reduce((s, f) => s + (f.ahorro_anual as number), 0)),
    },
  });
}

/**
 * Ficha de un CUPS: maxímetros, perfil de la curva y la optimización, calculada
 * en vivo sobre lo que haya guardado. No guarda nada: guardar es un acto
 * explícito (`guardar_analisis`), porque lo guardado es lo que se ha enseñado.
 */
async function fichaDeCups(supa: Supa, cupsBuscado: string) {
  const { data: ficha, error } = await supa
    .from('luz_cups')
    .select('id, cups, alias_suministro, tarifa_acceso, potencias_kw, fecha_inicio_contrato, datadis_distribuidora_codigo, datadis_point_type, datadis_ultima_sync, luz_clientes(nombre, nif, datadis_autorizado)')
    .eq('cups', cupsBuscado)
    .maybeSingle();

  if (error && faltaTabla(error.message)) return respuestaFaltaTabla();
  if (!ficha) return NextResponse.json({ error: 'Ese CUPS no está en la cartera.' }, { status: 404 });

  const tarifa = aTarifa(ficha.tarifa_acceso as string);

  const [{ data: maxFilas }, { data: curvaFilas }, { data: reactivaFilas }, { data: diario }] = await Promise.all([
    supa.from('luz_datadis_maximetro').select('fecha, hora, potencia_kw, periodo')
      .eq('cups', ficha.cups).order('fecha', { ascending: true }),
    supa.from('luz_datadis_curva').select('fecha, hora, consumo_kwh, excedente_kwh, metodo')
      .eq('cups', ficha.cups).order('fecha', { ascending: true }).limit(40000),
    supa.from('luz_datadis_reactiva').select('fecha, reactiva_por_periodo').eq('cups', ficha.cups),
    supa.from('luz_datadis_sync').select('tipo, mes, estado, filas, mensaje, pedido_en')
      .eq('cups', ficha.cups).order('pedido_en', { ascending: false }).limit(40),
  ]);

  const lecturas: LecturaMaximo[] = (maxFilas || []).map((m) => ({
    periodo: Number(m.periodo),
    potencia_kw: Number(m.potencia_kw),
    fecha: m.fecha as string,
  }));

  const horas = (curvaFilas || []).map((h) => ({
    fecha: h.fecha as string,
    hora: h.hora as string,
    consumo_kwh: Number(h.consumo_kwh),
    excedente_kwh: h.excedente_kwh === null ? null : Number(h.excedente_kwh),
    metodo: h.metodo as string,
  }));

  const perfil = horas.length ? perfilDeCurva(horas, tarifa) : null;
  const precios = await preciosPotencia(supa, tarifa);

  // Días que respaldan el análisis: los del maxímetro si los hay, que es lo que
  // manda; si no, los días con curva.
  const fechasMax = (maxFilas || []).map((m) => m.fecha as string).sort();
  const diasRango = fechasMax.length >= 2
    ? Math.max(1, Math.round((Date.parse(fechasMax[fechasMax.length - 1]) - Date.parse(fechasMax[0])) / 86400000) + 1)
    : perfil?.dias_con_dato || 0;

  const optimizacion = lecturas.length
    ? optimizarPotencias({
        tarifa,
        potencias_contratadas: (ficha.potencias_kw as number[]) || [],
        precios_potencia: precios.dia,
        lecturas,
        fuente: 'maximetro',
        dias_analizados: diasRango || 365,
        fecha_inicio_contrato: ficha.fecha_inicio_contrato as string | null,
      })
    : null;

  // Reactiva: se suma todo el rango y se compara con la activa del mismo rango
  const reactivaTotal = (reactivaFilas || []).reduce(
    (s, r) => s + ((r.reactiva_por_periodo as number[]) || []).reduce((a, b) => a + (Number(b) || 0), 0),
    0
  );
  const diagReactiva = reactivaFilas?.length && perfil
    ? diagnosticarReactiva(reactivaTotal, perfil.total_kwh)
    : null;

  return NextResponse.json({
    cups: {
      id: ficha.id,
      cups: ficha.cups,
      alias: ficha.alias_suministro,
      tarifa: ficha.tarifa_acceso,
      potencias_kw: ficha.potencias_kw,
      cliente: relacion(ficha.luz_clientes).nombre ?? null,
      nif: relacion(ficha.luz_clientes).nif ?? null,
      autorizado: !!relacion(ficha.luz_clientes).datadis_autorizado,
      distribuidora_codigo: ficha.datadis_distribuidora_codigo,
      point_type: ficha.datadis_point_type,
      ultima_sync: ficha.datadis_ultima_sync,
    },
    // Los maxímetros sí van en crudo: son pocos y se enseñan uno a uno
    maximetros: maxFilas || [],
    perfil,
    optimizacion,
    reactiva: diagReactiva,
    precios: { anuales: precios.anuales, revisados: precios.revisados },
    dias_analizados: diasRango,
    diario: diario || [],
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const supa = clienteSupabase(req);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Petición sin cuerpo.' }, { status: 400 });
  }

  const accion = String(body.accion || '');
  try {
    if (accion === 'comprobar') return await comprobarAutorizacion(supa, String(body.cliente_id || ''));
    if (accion === 'sincronizar') {
      return await sincronizar(supa, String(body.cups_id || ''), Number(body.meses) || 12);
    }
    if (accion === 'guardar_analisis') return await guardarAnalisis(supa, String(body.cups_id || ''), body.creado_por as string);
    return NextResponse.json({ error: `Acción desconocida: ${accion}` }, { status: 400 });
  } catch (e) {
    if (e instanceof ErrorDatadis) return respuestaDatadis(e);
    const mensaje = e instanceof Error ? e.message : '';
    if (faltaTabla(mensaje)) return respuestaFaltaTabla();
    return NextResponse.json({ error: 'No se ha podido completar la operación.' }, { status: 500 });
  }
}

/**
 * Comprueba si un cliente nos ha autorizado en Datadis, y de paso engancha sus
 * suministros con los CUPS que ya tenemos en la cartera.
 *
 * Es el primer paso obligado: sin el `distributorCode` que sale de aquí no se
 * puede pedir ni una curva. Y una lista vacía es la respuesta más informativa
 * que existe en este módulo, porque significa «este cliente todavía no ha
 * autorizado», que es el 90 % de los «no funciona».
 */
async function comprobarAutorizacion(supa: Supa, clienteId: string) {
  if (!clienteId) return NextResponse.json({ error: 'Falta el cliente.' }, { status: 400 });

  const { data: cliente } = await supa
    .from('luz_clientes').select('id, nombre, nif').eq('id', clienteId).maybeSingle();
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 404 });
  if (!cliente.nif) {
    return NextResponse.json(
      { error: `${cliente.nombre} no tiene NIF en la ficha, y Datadis lo necesita para comprobar la autorización.` },
      { status: 400 }
    );
  }

  const { suministros: lista, avisos } = await suministros(String(cliente.nif));
  await apuntar(supa, {
    cups: String(cliente.nif), tipo: 'suministros',
    estado: lista.length ? 'ok' : 'sin_autorizacion', filas: lista.length,
    mensaje: lista.length ? avisos.join(' · ') || undefined : 'Datadis no devuelve suministros para este NIF.',
  });

  const autorizado = lista.length > 0;
  await supa.from('luz_clientes')
    .update({ datadis_autorizado: autorizado, datadis_comprobado_en: new Date().toISOString() })
    .eq('id', clienteId);

  // Enganchar cada suministro de Datadis con su CUPS en la cartera
  const { data: nuestros } = await supa
    .from('luz_cups').select('id, cups').eq('cliente_id', clienteId);

  let enganchados = 0;
  const sinCartera: string[] = [];
  for (const s of lista) {
    const igual = (nuestros || []).find((n) => cupsComparable(n.cups as string) === cupsComparable(s.cups));
    if (!igual) { sinCartera.push(s.cups); continue; }
    const { error } = await supa.from('luz_cups')
      .update({ datadis_distribuidora_codigo: s.distributorCode, datadis_point_type: s.pointType })
      .eq('id', igual.id);
    if (!error) enganchados++;
  }

  return NextResponse.json({
    ok: true,
    autorizado,
    suministros: lista.length,
    enganchados,
    // Lo que la propia distribuidora tenga que decir: distingue «no tiene» de
    // «su sistema no contestó», que si no se ven exactamente igual.
    avisos,
    // Suministros que el cliente tiene y nosotros no: son altas que faltan
    sin_cartera: sinCartera,
    mensaje: (autorizado
      ? `${cliente.nombre} nos tiene autorizados: ${lista.length} suministro(s), ${enganchados} enganchado(s) con la cartera.`
      : `${cliente.nombre} todavía no ha autorizado nuestro NIF en datadis.es. Sin ese permiso Datadis no deja leer nada suyo, y lo tiene que dar él desde su cuenta.`)
      + (avisos.length ? ` La distribuidora dice: ${avisos.join(' · ')}` : ''),
  });
}

/**
 * Trae maxímetros, curva y reactiva de un CUPS. El maxímetro va primero y de
 * una sola llamada para todo el rango, porque es el dato que produce el euro:
 * si luego la curva falla o la raciona Datadis, la optimización ya se puede
 * hacer igual.
 */
async function sincronizar(supa: Supa, cupsId: string, nMeses: number) {
  if (!cupsId) return NextResponse.json({ error: 'Falta el CUPS.' }, { status: 400 });

  const { data: ficha } = await supa
    .from('luz_cups')
    .select('id, cups, tarifa_acceso, datadis_distribuidora_codigo, datadis_point_type, cliente_id, luz_clientes(nif, nombre)')
    .eq('id', cupsId).maybeSingle();
  if (!ficha) return NextResponse.json({ error: 'CUPS no encontrado.' }, { status: 404 });

  const cups = String(ficha.cups);
  const nif = relacion(ficha.luz_clientes).nif as string | undefined;
  let codigo = ficha.datadis_distribuidora_codigo as string | null;
  let pointType = ficha.datadis_point_type as number | null;

  // Sin código de distribuidora no se puede seguir: se busca una vez y se guarda
  if (!codigo) {
    const { suministros: lista } = await suministros(nif);
    const suyo = lista.find((s) => cupsComparable(s.cups) === cupsComparable(cups));
    if (!suyo) {
      return NextResponse.json(
        {
          error: nif
            ? `Datadis no devuelve este CUPS para el NIF ${nif}. Lo normal es que falte la autorización del titular en datadis.es, o que el CUPS de la ficha tenga una errata.`
            : 'Este CUPS no aparece en nuestra cuenta de Datadis y el cliente no tiene NIF en la ficha para consultarlo como autorizado.',
        },
        { status: 400 }
      );
    }
    codigo = suyo.distributorCode;
    pointType = suyo.pointType;
    await supa.from('luz_cups')
      .update({ datadis_distribuidora_codigo: codigo, datadis_point_type: pointType })
      .eq('id', cupsId);
  }

  const meses = ultimosMeses(Math.min(24, Math.max(1, nMeses)));
  const resultado = {
    maximetros: 0, horas: 0, reactiva: 0,
    meses_pedidos: [] as string[], meses_saltados: [] as { mes: string; porque: string }[],
    fallos: [] as { que: string; porque: string }[],
    // Lo que dicen las distribuidoras cuando la API lo cuenta (respuestas v2)
    avisos: [] as string[],
  };
  const anotarAvisos = (lista: string[]) => {
    for (const a of lista) if (!resultado.avisos.includes(a)) resultado.avisos.push(a);
  };

  // ── Maxímetro: una llamada para todo el rango ──
  const rangoMax = `${meses[0]}..${meses[meses.length - 1]}`;
  const saltarMax = await yaPedidoHoy(supa, cups, 'maximetro', rangoMax);
  if (saltarMax) {
    resultado.fallos.push({ que: 'maxímetro', porque: saltarMax });
  } else {
    try {
      const { maximetros: lista, avisos } = await maximetros(cups, codigo!, meses[0], meses[meses.length - 1], nif);
      anotarAvisos(avisos);
      if (lista.length) {
        const { guardadas, error } = await guardarEnTrozos(
          supa, 'luz_datadis_maximetro',
          lista.map((m) => ({ cups, fecha: m.fecha, hora: m.hora, potencia_kw: m.potencia_kw, periodo: m.periodo })),
          'cups,fecha,periodo'
        );
        resultado.maximetros = guardadas;
        if (error) resultado.fallos.push({ que: 'guardar maxímetro', porque: error });
      }
      await apuntar(supa, {
        cups, tipo: 'maximetro', mes: rangoMax,
        estado: lista.length ? 'ok' : 'vacio', filas: lista.length,
      });
    } catch (e) {
      const fallo = e instanceof ErrorDatadis ? e.fallo : null;
      resultado.fallos.push({ que: 'maxímetro', porque: fallo?.mensaje || 'error desconocido' });
      await apuntar(supa, {
        cups, tipo: 'maximetro', mes: rangoMax,
        estado: fallo?.tipo === 'racionado' ? 'racionado' : 'error', mensaje: fallo?.mensaje,
      });
      // Credenciales mal puestas: no tiene sentido seguir con 12 meses de curva
      if (fallo?.tipo === 'sin_credenciales' || fallo?.tipo === 'login') throw e;
    }
  }

  // ── Curva: mes a mes, y lo que entre queda ──
  const cuartohorario = (pointType ?? 5) <= 2;
  for (const mes of meses) {
    const saltar = await yaPedidoHoy(supa, cups, 'curva', mes);
    if (saltar) { resultado.meses_saltados.push({ mes, porque: saltar }); continue; }

    try {
      const { horas, avisos } = await curvaMes(cups, codigo!, mes, {
        pointType: pointType ?? undefined, nifAutorizado: nif, cuartohorario,
      });
      anotarAvisos(avisos);
      if (horas.length) {
        const { guardadas, error } = await guardarEnTrozos(
          supa, 'luz_datadis_curva',
          horas.map((h) => ({
            cups, fecha: h.fecha, hora: h.hora,
            consumo_kwh: h.consumo_kwh, excedente_kwh: h.excedente_kwh, metodo: h.metodo,
          })),
          'cups,fecha,hora'
        );
        resultado.horas += guardadas;
        if (error) resultado.fallos.push({ que: `guardar curva ${mes}`, porque: error });
      }
      resultado.meses_pedidos.push(mes);
      await apuntar(supa, { cups, tipo: 'curva', mes, estado: horas.length ? 'ok' : 'vacio', filas: horas.length });
    } catch (e) {
      const fallo = e instanceof ErrorDatadis ? e.fallo : null;
      resultado.fallos.push({ que: `curva ${mes}`, porque: fallo?.mensaje || 'error desconocido' });
      await apuntar(supa, {
        cups, tipo: 'curva', mes,
        estado: fallo?.tipo === 'racionado' ? 'racionado' : 'error', mensaje: fallo?.mensaje,
      });
      // Si nos han racionado, los meses que quedan van a fallar igual: se corta
      if (fallo?.tipo === 'racionado' || fallo?.tipo === 'login' || fallo?.tipo === 'sin_credenciales') break;
    }
  }

  // ── Reactiva: si no la mide el punto, no es un fallo ──
  if (!(await yaPedidoHoy(supa, cups, 'reactiva', rangoMax))) {
    try {
      const { reactiva: lista, avisos } = await reactiva(cups, codigo!, meses[0], meses[meses.length - 1], nif);
      anotarAvisos(avisos);
      if (lista.length) {
        const { guardadas } = await guardarEnTrozos(
          supa, 'luz_datadis_reactiva',
          lista.map((r) => ({ cups, fecha: r.fecha, reactiva_por_periodo: r.reactiva_por_periodo })),
          'cups,fecha'
        );
        resultado.reactiva = guardadas;
      }
      await apuntar(supa, { cups, tipo: 'reactiva', mes: rangoMax, estado: lista.length ? 'ok' : 'vacio', filas: lista.length });
    } catch { /* la reactiva es opcional: no se le da importancia */ }
  }

  // Se marca aunque haya habido fallos parciales: hemos hablado con Datadis y
  // dejar la marca vieja haría pensar que no se ha intentado.
  const traidoAlgo = resultado.maximetros + resultado.horas > 0;
  if (traidoAlgo) {
    await supa.from('luz_cups').update({ datadis_ultima_sync: new Date().toISOString() }).eq('id', cupsId);
  }

  // También el contrato: son las potencias contratadas de verdad, no las de la
  // factura que alguien teclee. No se pisan solas: se devuelven para que la
  // pantalla las enseñe y sea una persona la que decida.
  let potenciasDatadis: number[] | null = null;
  try {
    if (!(await yaPedidoHoy(supa, cups, 'contrato', null))) {
      const { contrato: det, avisos } = await contrato(cups, codigo!, nif);
      anotarAvisos(avisos);
      potenciasDatadis = det?.contractedPowerkW?.length ? det.contractedPowerkW : null;
      await apuntar(supa, { cups, tipo: 'contrato', mes: null, estado: det ? 'ok' : 'vacio', filas: det ? 1 : 0 });
    }
  } catch { /* el contrato es un extra sobre lo importante */ }

  return NextResponse.json({
    ok: traidoAlgo,
    ...resultado,
    potencias_en_datadis: potenciasDatadis,
    potencias_en_ficha: (ficha as Record<string, unknown>).potencias_kw ?? null,
    mensaje: (traidoAlgo
      ? `Entraron ${resultado.maximetros} maxímetros y ${resultado.horas} horas de curva.`
      : 'No ha entrado ningún dato nuevo. Mira los fallos: lo normal es que Datadis ya nos diera esto hoy, o que falte la autorización del titular.')
      + (resultado.avisos.length ? ` La distribuidora dice: ${resultado.avisos.join(' · ')}` : ''),
  });
}

/**
 * Congela el análisis. Lo que se guarda es lo que se le ha enseñado al cliente,
 * y por eso lleva pegados el rango, la confianza y los precios usados: dentro de
 * tres meses hará falta poder explicar de dónde salió la cifra.
 */
async function guardarAnalisis(supa: Supa, cupsId: string, creadoPor?: string) {
  if (!cupsId) return NextResponse.json({ error: 'Falta el CUPS.' }, { status: 400 });

  const { data: ficha } = await supa.from('luz_cups').select('cups').eq('id', cupsId).maybeSingle();
  if (!ficha) return NextResponse.json({ error: 'CUPS no encontrado.' }, { status: 404 });

  // Se reutiliza el mismo cálculo que enseña la ficha: una sola fuente de verdad
  const respuesta = await fichaDeCups(supa, String(ficha.cups));
  const calculo = await respuesta.json();
  if (!calculo?.optimizacion) {
    return NextResponse.json(
      { error: 'Todavía no hay maxímetros guardados de este CUPS: sin eso no hay nada que congelar.' },
      { status: 400 }
    );
  }

  const fechas = (calculo.maximetros || []).map((m: { fecha: string }) => m.fecha).sort();
  const fila = {
    cups_id: cupsId,
    cups: calculo.cups.cups,
    tarifa: calculo.cups.tarifa,
    desde: fechas[0] || null,
    hasta: fechas[fechas.length - 1] || null,
    dias_analizados: calculo.dias_analizados || null,
    ahorro_anual: calculo.optimizacion.ahorro_anual,
    coste_actual_anual: calculo.optimizacion.coste_actual_anual,
    coste_optimo_anual: calculo.optimizacion.coste_optimo_anual,
    penalizacion_estimada: calculo.optimizacion.penalizacion_estimada,
    confianza: calculo.optimizacion.confianza,
    potencias_actuales: calculo.optimizacion.periodos.map((p: { contratada_kw: number }) => p.contratada_kw),
    potencias_recomendadas: calculo.optimizacion.periodos.map((p: { recomendada_kw: number }) => p.recomendada_kw),
    pct_horas_solares: calculo.perfil?.pct_horas_solares ?? null,
    datos: {
      periodos: calculo.optimizacion.periodos,
      avisos: calculo.optimizacion.avisos,
      cambio_tarifa: calculo.optimizacion.cambio_tarifa,
      perfil: calculo.perfil,
      reactiva: calculo.reactiva,
      precios_usados: calculo.precios,
    },
    creado_por: creadoPor || null,
  };

  const { error } = await supa.from('luz_datadis_analisis').insert([fila]);
  if (error) {
    if (faltaTabla(error.message)) return respuestaFaltaTabla();
    return NextResponse.json({ error: `No se pudo guardar el análisis: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ahorro_anual: fila.ahorro_anual, confianza: fila.confianza });
}
