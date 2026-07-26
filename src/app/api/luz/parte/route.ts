import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { construirParte, ENTIDADES, type FilaAuditoria } from '@/lib/parte-diario';

/**
 * PARTE DIARIO DEL SISTEMA — qué pasó en la cartera un día concreto.
 *
 * GET /api/luz/parte?fecha=YYYY-MM-DD
 *
 * SOLO ADMIN, y comprobado aquí en el servidor.
 * Esconder la entrada del menú no protege nada: cualquiera que sepa la URL
 * llamaría igual. Aquí se mira el rol contra `app_usuarios` antes de devolver
 * un solo dato, porque este parte enseña la actividad de todo el equipo
 * persona por persona, y eso no lo puede ver cualquiera.
 *
 * De dónde salen los datos: de `app_auditoria`, que llenan los triggers de la
 * base de datos con la fila entera antes y después de cada cambio. No hay que
 * instrumentar nada en la aplicación: si se guarda, queda registrado.
 */

export const maxDuration = 60;

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

/**
 * Comprueba que quien llama es admin. Devuelve el error listo para responder,
 * o null si puede pasar.
 */
async function soloAdmin(req: NextRequest): Promise<NextResponse | null> {
  const cabecera = req.headers.get('authorization') || '';
  const token = cabecera.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return NextResponse.json({ error: 'Hace falta iniciar sesión.' }, { status: 401 });
  }

  const publico = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: sesion, error } = await publico.auth.getUser(token);
  if (error || !sesion?.user) {
    return NextResponse.json({ error: 'La sesión no es válida. Vuelve a entrar.' }, { status: 401 });
  }

  const servicio = clienteServicio();
  if (!servicio) {
    return NextResponse.json(
      { error: 'Falta SUPABASE_SERVICE_ROLE_KEY en el entorno: sin eso no se puede comprobar el rol ni leer la auditoría.' },
      { status: 500 }
    );
  }

  const { data: perfil } = await servicio
    .from('app_usuarios')
    .select('rol, activo')
    .eq('id', sesion.user.id)
    .maybeSingle();

  if (!perfil?.activo || perfil.rol !== 'admin') {
    return NextResponse.json(
      { error: 'El parte del día es solo para dirección.' },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Cliente con clave de servicio. Hace falta porque la auditoría guarda quién
 * hizo qué de todo el equipo: leerla con la sesión del usuario dependería de
 * unas políticas que no existen para esa tabla. El acceso ya se ha cerrado
 * arriba comprobando que es admin.
 */
function clienteServicio() {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clave) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(req: NextRequest) {
  const veto = await soloAdmin(req);
  if (veto) return veto;

  const fecha = (req.nextUrl.searchParams.get('fecha') || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: 'Indica la fecha como AAAA-MM-DD.' }, { status: 400 });
  }

  const supa = clienteServicio()!;
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

    // Nombres para que el parte hable de personas y de clientes, no de ids.
    const [{ data: usuarios }, { data: clientes }] = await Promise.all([
      supa.from('app_usuarios').select('email, nombre'),
      supa.from('luz_clientes').select('id, nombre'),
    ]);

    const nombresUsuario: Record<string, string> = {};
    for (const u of usuarios || []) {
      if (u.email) nombresUsuario[u.email as string] = (u.nombre as string) || (u.email as string);
    }
    const mapaClientes: Record<string, string> = {};
    for (const c of clientes || []) mapaClientes[c.id as string] = c.nombre as string;

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
