import Link from 'next/link';
import { CORREBIN_EMPRESA, CORREBIN_CTA, CORREBIN_COLORES as C } from '@/lib/correbin-marca';
import { Boton } from './ui';

/**
 * 404 propio de la microsede (Volumen X: «404 y estados de error»).
 * Nunca un callejón sin salida: siempre se ofrece hacia dónde seguir.
 */
export default function NoEncontrado() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-24 text-center">
      <p className="text-sm font-bold uppercase tracking-[0.2em]" style={{ color: C.rojo }}>
        Error 404
      </p>
      <h1 className="mt-3 text-4xl font-black tracking-tight" style={{ color: C.azul }}>
        Esta página no existe
      </h1>
      <p className="mt-4 text-base leading-relaxed" style={{ color: C.textoSuave }}>
        Puede que el enlace esté mal escrito o que la página haya cambiado de sitio. Estas son las vías
        más rápidas:
      </p>

      <div className="mt-8 flex flex-wrap gap-3 justify-center">
        <Boton href="/seguros">Ir al inicio de seguros</Boton>
        <Boton href={CORREBIN_CTA.revision.href} variante="secundario">
          Solicitar revisión de pólizas
        </Boton>
        <Boton href={CORREBIN_CTA.siniestro.href} variante="secundario">
          Comunicar un siniestro
        </Boton>
      </div>

      <div className="mt-10 flex flex-wrap gap-6 justify-center text-sm font-bold">
        <a href={`tel:${CORREBIN_EMPRESA.telefonoTel}`} style={{ color: C.azul }}>
          Llamar al {CORREBIN_EMPRESA.telefono}
        </a>
        <a
          href={CORREBIN_EMPRESA.whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: C.azul }}
        >
          WhatsApp {CORREBIN_EMPRESA.whatsapp}
        </a>
        <Link href="/" style={{ color: C.textoSuave }}>
          Volver a Gesmeco Energía
        </Link>
      </div>
    </div>
  );
}
