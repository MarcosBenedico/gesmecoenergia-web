import { NextRequest, NextResponse } from 'next/server';

/**
 * Envía un aviso por correo a Gesmeco cada vez que alguien completa
 * un análisis en la web. Usa FormSubmit (gratuito, sin clave de API).
 *
 * IMPORTANTE: la primera vez que se use, FormSubmit enviará un correo
 * de activación a EMAIL_AVISOS — hay que pulsar el enlace de
 * confirmación una única vez para que empiecen a llegar los avisos.
 */

const EMAIL_AVISOS = 'marcos.benedico@correbin.es';

export async function POST(req: NextRequest) {
  try {
    const datos = await req.json();

    const eur = (n: unknown) =>
      typeof n === 'number' ? n.toLocaleString('es-ES', { minimumFractionDigits: 2 }) : '—';

    const lineas = [
      `NUEVO ANÁLISIS EN LA WEB · ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}`,
      ``,
      `Cliente: ${datos.nombre || '(sin nombre)'}`,
      `Teléfono: ${datos.telefono || '(no facilitado)'}`,
      `Origen: ${datos.origen || 'calculadora'}`,
      ``,
      `Tarifa: ${datos.tarifa || '—'}`,
      `Coste actual: ${eur(datos.costeActual)} €/año`,
      `Consumo anual: ${datos.consumoAnual ?? '—'} kWh`,
      ``,
      `AHORRO MOSTRADO AL CLIENTE: ${eur(datos.ahorroMin)} — ${eur(datos.ahorroMax)} €/año`,
      `COMISIÓN ESTIMADA GESMECO: ${eur(datos.comisionMin)} — ${eur(datos.comisionMax)} €/año`,
      ``,
      `Detalle completo en Supabase (tabla analisis).`,
    ];

    const res = await fetch(`https://formsubmit.co/ajax/${EMAIL_AVISOS}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // FormSubmit rechaza peticiones sin origen web
        Origin: 'https://gesmecoenergia-web.vercel.app',
        Referer: 'https://gesmecoenergia-web.vercel.app/analizador',
      },
      body: JSON.stringify({
        _subject: `⚡ Nuevo análisis: ${datos.nombre || 'sin nombre'} · ahorro ${eur(datos.ahorroMax)} €`,
        _template: 'box',
        mensaje: lineas.join('\n'),
      }),
    });

    if (!res.ok) {
      console.error('FormSubmit error:', res.status, await res.text());
      return NextResponse.json({ ok: false }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Error notificando análisis:', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
