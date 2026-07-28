'use client';

import Link from 'next/link';
import { CORREBIN_EMPRESA, CORREBIN_CTA, CORREBIN_COLORES as C } from '@/lib/correbin-marca';
import { medir, EVENTOS } from '@/lib/correbin-medicion';

/**
 * Barra fija de móvil: llamar, WhatsApp y siniestro (Volumen III).
 * Va en su propio componente de cliente para poder medir los clics —los dos
 * eventos más valiosos del embudo— sin convertir todo el layout en cliente.
 */
export function BarraContactoMovil() {
  return (
    <div
      className="md:hidden fixed bottom-0 inset-x-0 z-50 grid grid-cols-3 border-t"
      style={{ background: '#fff', borderColor: C.borde }}
    >
      <a
        href={`tel:${CORREBIN_EMPRESA.telefonoTel}`}
        onClick={() => medir(EVENTOS.clicTelefono, { sitio: 'barra-movil' })}
        className="flex flex-col items-center justify-center py-2.5 text-[11px] font-bold"
        style={{ color: C.azul }}
      >
        <span className="text-lg leading-none mb-0.5" aria-hidden>☎</span>
        Llamar
      </a>
      <a
        href={CORREBIN_EMPRESA.whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => medir(EVENTOS.clicWhatsapp, { sitio: 'barra-movil' })}
        className="flex flex-col items-center justify-center py-2.5 text-[11px] font-bold border-x"
        style={{ color: C.azul, borderColor: C.borde }}
      >
        <span className="text-lg leading-none mb-0.5" aria-hidden>✆</span>
        WhatsApp
      </a>
      <Link
        href={CORREBIN_CTA.siniestro.href}
        onClick={() => medir(EVENTOS.inicioSiniestro, { sitio: 'barra-movil' })}
        className="flex flex-col items-center justify-center py-2.5 text-[11px] font-bold text-white"
        style={{ background: C.rojo }}
      >
        <span className="text-lg leading-none mb-0.5" aria-hidden>!</span>
        Siniestro
      </Link>
    </div>
  );
}
