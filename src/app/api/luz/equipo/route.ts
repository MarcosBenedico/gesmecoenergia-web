import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Gestión del equipo (responsables) del grupo.
 *
 * GET  /api/luz/equipo            → responsables + nº de registros vinculados por nombre
 * POST /api/luz/equipo            → { accion: 'fusionar'|'renombrar'|'eliminar', ... }
 *
 * Los responsables se guardan como TEXTO en las tablas de datos, así que
 * fusionar/renombrar = reemplazar ese texto en todas las tablas (incluidos
 * los combos "Marcos Benedico / David").
 */

/** Todas las tablas que guardan un responsable como texto. */
const TABLAS_CON_RESPONSABLE = [
  'luz_clientes', 'luz_cups', 'luz_pipeline', 'luz_contratos', 'luz_comisiones',
  'luz_tareas', 'luz_fechas_criticas',
  'vct_clientes', 'vct_polizas', 'vct_vencimientos', 'vct_produccion',
  'vct_anulaciones', 'vct_oportunidades', 'vct_tareas',
];

/** ¿El texto de responsable contiene este nombre? Coincidencia exacta primero
 *  (nombres con barra como "Auto / Particulares") y después como parte de un
 *  combo "A / B". */
function contiene(responsable: string, nombre: string): boolean {
  const r = responsable.trim().toLowerCase();
  const n = nombre.trim().toLowerCase();
  if (r === n) return true;
  if (n.includes('/')) return false; // nombre con barra: solo coincidencia exacta
  return responsable.split('/').map((s) => s.trim().toLowerCase()).includes(n);
}

/** Reemplaza el nombre dentro del texto (respetando combos) y normaliza. */
function reemplazar(responsable: string, origen: string, destino: string): string {
  if (responsable.trim().toLowerCase() === origen.trim().toLowerCase()) return destino;
  const partes = responsable.split('/').map((s) => s.trim());
  const nuevas = partes.map((p) => (p.toLowerCase() === origen.trim().toLowerCase() ? destino : p));
  // Sin duplicados si origen y destino ya estaban en el combo
  return Array.from(new Set(nuevas.filter(Boolean))).join(' / ');
}

/** Cuenta y actualiza referencias de un nombre en todas las tablas. */
async function procesarNombre(origen: string, destino: string | null): Promise<Record<string, number>> {
  const resultado: Record<string, number> = {};
  for (const tabla of TABLAS_CON_RESPONSABLE) {
    const { data, error } = await supabase.from(tabla).select('id, responsable').ilike('responsable', `%${origen}%`).limit(10000);
    if (error) continue; // tabla inexistente en este proyecto → ignorar
    const afectadas = (data || []).filter((r) => r.responsable && contiene(r.responsable, origen));
    resultado[tabla] = afectadas.length;
    if (destino !== null) {
      for (const r of afectadas) {
        await supabase.from(tabla).update({ responsable: reemplazar(r.responsable, origen, destino) || null }).eq('id', r.id);
      }
    }
  }
  return resultado;
}

export async function GET() {
  const { data: responsables, error } = await supabase.from('vct_responsables').select('*').order('nombre');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Nombres reales usados en los datos (pueden no existir en vct_responsables)
  const nombresAlta = new Set((responsables || []).map((r) => r.nombre.trim().toLowerCase()));
  const usoPorNombre: Record<string, Record<string, number>> = {};
  const nombresEnDatos = new Set<string>();
  for (const tabla of TABLAS_CON_RESPONSABLE) {
    const { data } = await supabase.from(tabla).select('responsable').not('responsable', 'is', null).limit(10000);
    (data || []).forEach((r: { responsable: string }) => {
      const completo = r.responsable.trim();
      if (!completo) return;
      // Nombres con barra dados de alta (p. ej. "Auto / Particulares") no se parten
      if (nombresAlta.has(completo.toLowerCase())) { nombresEnDatos.add(completo); return; }
      completo.split('/').forEach((p) => { const n = p.trim(); if (n) nombresEnDatos.add(n); });
    });
  }
  for (const nombre of nombresEnDatos) {
    usoPorNombre[nombre] = await procesarNombre(nombre, null);
  }

  return NextResponse.json({ ok: true, responsables: responsables || [], uso: usoPorNombre });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accion } = body;

    if (accion === 'fusionar' || accion === 'renombrar' || accion === 'reasignar') {
      // fusionar: origen desaparece, sus registros pasan a destino (y se borra de vct_responsables)
      // renombrar: mismo reemplazo pero mantiene el registro del responsable con nuevo nombre
      // reasignar: solo mueve los registros, no toca vct_responsables
      const { origen, destino } = body;
      if (!origen?.trim() || !destino?.trim()) return NextResponse.json({ error: 'Faltan origen y destino.' }, { status: 400 });
      if (origen.trim().toLowerCase() === destino.trim().toLowerCase() && accion !== 'renombrar') {
        return NextResponse.json({ error: 'Origen y destino son el mismo.' }, { status: 400 });
      }

      const cambios = await procesarNombre(origen, destino);
      const total = Object.values(cambios).reduce((s, n) => s + n, 0);

      if (accion === 'fusionar') {
        // Asegurar que el destino existe como responsable y borrar el origen duplicado
        const { data: destinoExiste } = await supabase.from('vct_responsables').select('id').ilike('nombre', destino.trim()).limit(1);
        if (!destinoExiste?.length) {
          const { data: origenReg } = await supabase.from('vct_responsables').select('rol').ilike('nombre', origen.trim()).limit(1);
          await supabase.from('vct_responsables').insert([{ nombre: destino.trim(), rol: origenReg?.[0]?.rol || 'comercial', activo: true }]);
        }
        await supabase.from('vct_responsables').delete().ilike('nombre', origen.trim());
      }
      if (accion === 'renombrar') {
        await supabase.from('vct_responsables').update({ nombre: destino.trim() }).ilike('nombre', origen.trim());
      }

      return NextResponse.json({ ok: true, registros_actualizados: total, detalle: cambios });
    }

    if (accion === 'eliminar') {
      const { id, nombre } = body;
      if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });
      // Bloquear si tiene registros vinculados
      if (nombre) {
        const uso = await procesarNombre(nombre, null);
        const total = Object.values(uso).reduce((s, n) => s + n, 0);
        if (total > 0) {
          return NextResponse.json({
            error: `"${nombre}" tiene ${total} registro(s) vinculados. Reasigna o fusiona antes de eliminar.`,
            vinculados: total, detalle: uso,
          }, { status: 409 });
        }
      }
      const { error } = await supabase.from('vct_responsables').delete().eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }
}
