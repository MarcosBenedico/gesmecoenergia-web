import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { construirParte, ENTIDADES, type FilaAuditoria } from '@/lib/parte-diario';

/**
 * PARTE DIARIO DEL SISTEMA — qué pasó en la cartera un día concreto.
 *
 * GET /api/luz/parte?fecha=YYYY-MM-DD
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SOLO ADMIN, Y PROTEGIDO EN DOS SITIOS
 *
 * Este parte enseña la actividad de todo el equipo persona por persona, así que
 * el acceso está cerrado dos veces y a propósito:
 *
 *   1. AQUÍ, comprobando el rol contra `app_usuarios` antes de leer nada.
 *      Sirve para dar un mensaje claro («esto es solo para dirección») en vez de
 *      devolver una lista vacía que parecería un día sin trabajo.
 *
 *   2. EN LA BASE DE DATOS, porque `app_auditoria` ya tiene la política
 *      `p_auditoria_ver ... USING (es_admin())` de supabase_rls_v2.sql.
 *
 * Y por eso todo se lee con la SESIÓN DEL USUARIO y no con la clave de
 * servicio: usar la de servicio saltaría precisamente la política que protege
 * esta tabla, y dejaría la seguridad dependiendo solo del punto 1. Además, el
 * resto del proyecto trata `SUPABASE_SERVICE_ROLE_KEY` como opcional, y esta
 * ruta no debe ser la única que se caiga sin ella.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const maxDuration = 60;

/** Cliente con la sesión de quien llama: las políticas RLS hacen su trabajo. */
function clienteUsuario(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

/** Un día natural en hora española, en instantes UTC. */
function limitesDelDia(fecha: string): { desde: string; hasta: string } {
  // El servidor corre en UTC; el día que quiere ver Marcos es el de Binéfar.
  // Se mira el desfase real de Europe/Madrid ese día (CET o CEST, según el mes).
  let desfase = '+00:00';
  try {
    const mediodia = new Date(`${fecha}T12:00:00Z`);
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Madrid', timeZoneName: 'longOffset',
    }).formatToParts(mediodia);
    const nombre = partes.find((p) => p.type === 'timeZoneName')?.value || '';
    const limpio = nombre.replace('GMT', '').trim();
    if (/^[+-]\d{2}:\d{2}$/.test(limpio)) desfase = limpio;
  } catch { /* sin Intl utilizable nos quedamos en UTC */ }

  return {
    desde: `${fecha}T00:00:00.000${desfase}`,
    hasta: `${fecha}T23:59:59.999${desfase}`,
  };
}

/** Cuántas fichas completas se adjuntan como mucho. Un día normal no llega. */
const MAX_FICHAS = 40;

export interface FichaCliente {
  id: string;
  /** Alta de hoy, o cliente de antes que hoy ha movido algo. */
  captado_hoy: boolean;
  cliente: Record<string, unknown>;
  cups: Record<string, unknown>[];
  pipeline: Record<string, unknown>[];
  tareas: Record<string, unknown>[];
  contratos: Record<string, unknown>[];
  visitas: Record<string, unknown>[];
}

/**
 * La ficha entera de cada cliente que se ha captado o se ha movido hoy.
 *
 * La auditoría cuenta QUÉ CAMBIÓ, pero para un informe que se enseña o se
 * archiva hace falta también el ESTADO EN QUE HA QUEDADO: los datos del
 * cliente, qué suministros tiene, qué se le ha creado y —lo que más importa—
 * qué acción queda pendiente, de quién y para cuándo.
 *
 * Se lee el estado actual, no una foto del día: si algo se tocó después, lo que
 * vale es lo último. Un informe con datos caducados es peor que no tenerlo.
 */
async function fichasDelDia(
  supa: ReturnType<typeof clienteUsuario>,
  auditoria: FilaAuditoria[]
): Promise<FichaCliente[]> {
  const nuevos = new Set<string>();
  const tocados = new Set<string>();

  for (const f of auditoria) {
    const fila = f.despues || f.antes;
    if (!fila) continue;
    if (f.tabla === 'luz_clientes') {
      const id = String(fila.id || '');
      if (!id) continue;
      tocados.add(id);
      if (f.accion === 'INSERT') nuevos.add(id);
    } else if (fila.cliente_id) {
      tocados.add(String(fila.cliente_id));
    }
  }

  // Los captados hoy primero: son los que de verdad interesan en el informe
  const ids = [...nuevos, ...[...tocados].filter((x) => !nuevos.has(x))].slice(0, MAX_FICHAS);
  if (!ids.length) return [];

  const traer = async (tabla: string, cols: string, col = 'cliente_id') => {
    const { data } = await supa.from(tabla).select(cols).in(col, ids);
    return (data || []) as unknown as Record<string, unknown>[];
  };

  const [clientes, cups, pipeline, tareas, contratos, visitas] = await Promise.all([
    (async () => {
      const { data } = await supa.from('luz_clientes')
        .select('id, nombre, nif, tipo_cliente, persona_contacto, telefono, email, direccion_fiscal, responsable, prioridad, estado_comercial, potencial_comercial, origen_cliente, via_entrada, observaciones, proxima_accion, fecha_proxima_accion, fecha_ultimo_contacto, creado_en')
        .in('id', ids);
      return (data || []) as unknown as Record<string, unknown>[];
    })(),
    traer('luz_cups', 'id, cliente_id, cups, alias_suministro, direccion_suministro, tarifa_acceso, comercializadora_actual, distribuidora, potencias_kw, consumo_anual_kwh, coste_anual_estimado, estado_cups, fecha_fin_contrato, fecha_limite_preaviso, responsable, observaciones'),
    traer('luz_pipeline', 'id, cliente_id, nombre_oportunidad, tipo_oportunidad, estado, probabilidad, ahorro_potencial, comision_potencial, importe_anual_estimado, responsable, proxima_accion, fecha_proxima_accion, observaciones'),
    traer('luz_tareas', 'id, cliente_id, tipo_tarea, descripcion, notas, responsable, fecha_limite, estado, prioridad'),
    traer('luz_contratos', 'id, cliente_id, comercializadora_final, estado_contrato, fecha_firma, fecha_activacion_prevista, fecha_activacion_real, documentacion_completa, incidencia, responsable'),
    traer('luz_visitas', 'id, cliente_id, fecha, resultado, notas, responsable, proxima_visita'),
  ]);

  const porCliente = (lista: Record<string, unknown>[], id: string) =>
    lista.filter((x) => String(x.cliente_id) === id);

  return ids
    .map((id) => {
      const c = clientes.find((x) => String(x.id) === id);
      if (!c) return null;
      return {
        id,
        captado_hoy: nuevos.has(id),
        cliente: c,
        cups: porCliente(cups, id),
        pipeline: porCliente(pipeline, id),
        // Solo lo que sigue pendiente: una tarea cerrada no es una acción a tener en cuenta
        tareas: porCliente(tareas, id).filter((t) => !/hecha|completad|cerrad|anulad/i.test(String(t.estado || ''))),
        contratos: porCliente(contratos, id),
        visitas: porCliente(visitas, id),
      } as FichaCliente;
    })
    .filter((x): x is FichaCliente => x !== null);
}

export async function GET(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return NextResponse.json({ error: 'Hace falta iniciar sesión.' }, { status: 401 });
  }

  const supa = clienteUsuario(token);

  // ── Quién llama ──
  const { data: sesion, error: errSesion } = await supa.auth.getUser(token);
  if (errSesion || !sesion?.user) {
    return NextResponse.json({ error: 'La sesión ha caducado. Vuelve a entrar en el panel.' }, { status: 401 });
  }

  // ── Y si puede ver esto ──
  // La política de app_usuarios deja leer la fila propia, así que esta consulta
  // funciona con la sesión del usuario sin necesitar permisos especiales.
  const { data: perfil, error: errPerfil } = await supa
    .from('app_usuarios')
    .select('rol, activo, nombre')
    .eq('id', sesion.user.id)
    .maybeSingle();

  if (errPerfil) {
    return NextResponse.json(
      { error: `No se ha podido comprobar tu perfil: ${errPerfil.message}` },
      { status: 500 }
    );
  }
  if (!perfil?.activo || perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'El parte del día es solo para dirección.' }, { status: 403 });
  }

  const fecha = (req.nextUrl.searchParams.get('fecha') || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: 'Indica la fecha como AAAA-MM-DD.' }, { status: 400 });
  }

  const { desde, hasta } = limitesDelDia(fecha);

  try {
    const { data: filas, error } = await supa
      .from('app_auditoria')
      .select('id, usuario, accion, tabla, registro_id, antes, despues, creado_en')
      .gte('creado_en', desde)
      .lte('creado_en', hasta)
      .in('tabla', Object.keys(ENTIDADES))
      .order('creado_en', { ascending: true })
      .limit(3000);

    if (error) {
      const falta = /relation .*app_auditoria.* does not exist|Could not find the table/i.test(error.message);
      return NextResponse.json(
        {
          error: falta
            ? 'Falta la tabla de auditoría: ejecuta supabase_equipo_usuarios.sql en Supabase.'
            : `No se pudo leer la auditoría: ${error.message}`,
          falta_migracion: falta,
        },
        { status: falta ? 400 : 500 }
      );
    }

    const auditoria = (filas || []) as unknown as FilaAuditoria[];

    // Nombres, para que el parte hable de personas y de clientes y no de ids.
    // Que fallen no puede tumbar el parte: se sale del email y del propio dato.
    const [usuarios, clientes] = await Promise.all([
      supa.from('app_usuarios').select('email, nombre'),
      supa.from('luz_clientes').select('id, nombre'),
    ]);

    const nombresUsuario: Record<string, string> = {};
    for (const u of usuarios.data || []) {
      if (u.email) nombresUsuario[u.email as string] = (u.nombre as string) || (u.email as string);
    }
    const mapaClientes: Record<string, string> = {};
    for (const c of clientes.data || []) mapaClientes[c.id as string] = c.nombre as string;

    const parte = construirParte({ fecha, auditoria, nombresUsuario, clientes: mapaClientes });
    const fichas = await fichasDelDia(supa, auditoria);

    return NextResponse.json({
      ...parte,
      fichas,
      // Para que la pantalla pueda avisar si se ha llegado al tope
      truncado: auditoria.length >= 3000,
    });
  } catch {
    return NextResponse.json({ error: 'No se ha podido montar el parte.' }, { status: 500 });
  }
}
