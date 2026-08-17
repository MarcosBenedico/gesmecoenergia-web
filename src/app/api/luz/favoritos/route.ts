import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * FAVORITOS DEL PANEL DE SEGUIMIENTO.
 *
 * GET  /api/luz/favoritos            → { favoritos: string[] }
 * PUT  /api/luz/favoritos  { ids }   → guarda la lista entera
 *
 * Se guardan en `luz_config`, que ya existe y admite cualquier clave (el mapa
 * de oportunidades hace lo mismo con su historial de barridos). Así no hace
 * falta ni una tabla ni una migración más.
 *
 * POR QUÉ NO EN EL NAVEGADOR: guardarlos en localStorage habría sido más
 * rápido de hacer, pero los favoritos son la lista de «a estos los llevo yo
 * personalmente», y esa lista tiene que estar igual en el ordenador de la
 * oficina y en el móvil. Si al mirar desde el coche aparece vacía, se deja de
 * usar el mismo día.
 */

const CLAVE = 'favoritos_seguimiento';

function supa(req: NextRequest) {
  const auth = req.headers.get('authorization');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    auth ? { global: { headers: { Authorization: auth } } } : undefined
  );
}

/** Lo guardado puede ser basura si alguien tocó la fila a mano: se valida. */
function leerLista(valor: string | null | undefined): string[] {
  if (!valor) return [];
  try {
    const v = JSON.parse(valor);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { data, error } = await supa(req)
    .from('luz_config').select('valor').eq('clave', CLAVE).maybeSingle();

  // Que no haya fila todavía no es un error: es que aún no se ha marcado nada.
  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ favoritos: leerLista(data?.valor) });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ids: unknown = body?.ids;
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== 'string')) {
    return NextResponse.json({ error: 'ids debe ser una lista de textos' }, { status: 400 });
  }
  // Se escribe la lista entera y no un «añadir/quitar»: es una lista corta y
  // así dos pestañas abiertas no pueden dejarla a medias.
  const { error } = await supa(req).from('luz_config')
    .upsert({ clave: CLAVE, valor: JSON.stringify([...new Set(ids as string[])]) }, { onConflict: 'clave' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
