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

    return NextResponse.json({
      ...parte,
      // Para que la pantalla pueda avisar si se ha llegado al tope
      truncado: auditoria.length >= 3000,
    });
  } catch {
    return NextResponse.json({ error: 'No se ha podido montar el parte.' }, { status: 500 });
  }
}
