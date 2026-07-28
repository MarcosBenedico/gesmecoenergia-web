import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Entrada de los formularios públicos de la microsede de seguros.
 * POST { tipo: 'revision' | 'siniestro' | 'contacto', ...campos }
 *
 * El Volumen III pide guardado seguro y confirmación, sin depender de
 * WhatsApp. Aquí se valida, se guarda y se devuelve una referencia para que
 * el cliente pueda citarla al llamar.
 *
 * No mezcla nada con los formularios de energía: tabla propia y ruta propia.
 */

const TIPOS = ['revision', 'siniestro', 'contacto'];

/** Campos que se aceptan del formulario. Cualquier otro se descarta. */
const CAMPOS = [
  'nombre', 'empresa', 'nif', 'telefono', 'email', 'localidad', 'sector', 'motivo', 'mensaje',
  'proximo_vencimiento', 'empleados', 'facturacion', 'centros', 'vehiculos', 'siniestralidad',
  'poliza', 'fecha_siniestro', 'lugar', 'tipo_siniestro', 'danos_personales', 'terceros',
  'autoridades', 'urgente',
];
const NUMERICOS = ['empleados', 'facturacion', 'centros', 'vehiculos'];
const FECHAS = ['proximo_vencimiento', 'fecha_siniestro'];
const BOOLEANOS = ['danos_personales', 'terceros', 'urgente'];

/** Referencia legible para el cliente: CB-AAMMDD-XXXX */
function nuevaReferencia(tipo: string): string {
  const d = new Date();
  const fecha = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const azar = Math.random().toString(36).slice(2, 6).toUpperCase();
  const letra = tipo === 'siniestro' ? 'S' : tipo === 'revision' ? 'R' : 'C';
  return `CB-${letra}${fecha}-${azar}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tipo = String(body.tipo || '');
    if (!TIPOS.includes(tipo)) {
      return NextResponse.json({ error: 'Tipo de solicitud no válido.' }, { status: 400 });
    }
    if (!body.consentimiento) {
      return NextResponse.json({ error: 'Hay que aceptar la política de privacidad para enviar la solicitud.' }, { status: 400 });
    }

    const nombre = String(body.nombre || '').trim();
    const telefono = String(body.telefono || '').trim();
    if (!nombre) return NextResponse.json({ error: 'Falta el nombre.' }, { status: 400 });
    if (!telefono) return NextResponse.json({ error: 'Falta el teléfono de contacto.' }, { status: 400 });

    const fila: Record<string, unknown> = { tipo, referencia: nuevaReferencia(tipo) };
    for (const campo of CAMPOS) {
      const v = body[campo];
      if (v === undefined || v === null || v === '') continue;
      if (NUMERICOS.includes(campo)) {
        const n = Number(String(v).replace(',', '.'));
        if (!Number.isNaN(n)) fila[campo] = n;
      } else if (BOOLEANOS.includes(campo)) {
        fila[campo] = Boolean(v);
      } else if (FECHAS.includes(campo)) {
        fila[campo] = String(v).slice(0, 10);
      } else {
        fila[campo] = String(v).slice(0, 4000);
      }
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error } = await supabase.from('correbin_solicitudes').insert([fila]);

    if (error) {
      // Sin la tabla creada todavía: se avisa con claridad en vez de fallar en silencio
      if (/does not exist|Could not find the table/i.test(error.message)) {
        return NextResponse.json({
          error: 'El buzón de solicitudes aún no está activado. Llámanos o escríbenos por WhatsApp y lo vemos al momento.',
          falta_migracion: true,
        }, { status: 503 });
      }
      return NextResponse.json({ error: 'No se pudo registrar la solicitud. Inténtalo de nuevo o llámanos.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, referencia: fila.referencia }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }
}
