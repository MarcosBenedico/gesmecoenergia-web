import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validarVistas } from '@/lib/vistas-listado';

/**
 * VISTAS GUARDADAS DE LOS LISTADOS.
 *
 * GET  /api/luz/vistas               → { vistas: Vista[] }
 * PUT  /api/luz/vistas  { vistas }   → guarda la lista entera
 *
 * Viven en `luz_config`, que ya existe y admite cualquier clave — igual que
 * los favoritos del panel de seguimiento y el historial de barridos del mapa.
 * Así esto no cuesta ni una tabla ni una migración que alguien tenga que
 * acordarse de ejecutar.
 *
 * POR QUÉ NO EN EL NAVEGADOR, que era más fácil: una vista guardada es media
 * decisión de cómo se trabaja, y hay dos motivos para que viaje. Uno, que
 * Marcos monta la vista en el ordenador y la mira en el móvil. Dos, que las
 * compartidas no existirían: en localStorage cada uno tendría las suyas y
 * «mira la vista de parados» no significaría nada.
 *
 * Lo que se lee se valida siempre (`validarVistas`): el valor es texto libre
 * en una fila que alguien puede tocar a mano, y una vista rota no puede tumbar
 * el listado de clientes.
 */

const CLAVE = 'vistas_listados';

function supa(req: NextRequest) {
  const auth = req.headers.get('authorization');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    auth ? { global: { headers: { Authorization: auth } } } : undefined
  );
}

function leer(valor: string | null | undefined) {
  if (!valor) return [];
  try {
    return validarVistas(JSON.parse(valor));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { data, error } = await supa(req)
    .from('luz_config').select('valor').eq('clave', CLAVE).maybeSingle();

  // Que no haya fila todavía no es un error: es que nadie ha guardado ninguna.
  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ vistas: leer(data?.valor) });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const vistas = validarVistas(body?.vistas);
  if (!Array.isArray(body?.vistas)) {
    return NextResponse.json({ error: 'vistas debe ser una lista' }, { status: 400 });
  }
  // Tope de cordura: si alguien se lía en un bucle, que no llene la fila.
  if (vistas.length > 60) {
    return NextResponse.json({ error: 'Demasiadas vistas guardadas.' }, { status: 400 });
  }

  const { error } = await supa(req).from('luz_config')
    .upsert({ clave: CLAVE, valor: JSON.stringify(vistas) }, { onConflict: 'clave' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, vistas });
}
