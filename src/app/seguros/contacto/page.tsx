import type { Metadata } from 'next';
import { CORREBIN_EMPRESA, CORREBIN_CTA, CORREBIN_COLORES as C } from '@/lib/correbin-marca';
import { Seccion, Encabezado, Tarjeta, Boton, Antetitulo } from '../ui';
import { FormularioSeguros, CampoForm } from '../formulario';

export const metadata: Metadata = {
  title: 'Contacto · Correbin Asociados',
  description: 'Habla con un corredor. Teléfono, WhatsApp y formulario de consulta.',
};

const CAMPOS: CampoForm[] = [
  { campo: 'nombre', etiqueta: 'Nombre y apellidos', tipo: 'text', requerido: true },
  { campo: 'empresa', etiqueta: 'Empresa (si aplica)', tipo: 'text' },
  { campo: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', requerido: true },
  { campo: 'email', etiqueta: 'Correo electrónico', tipo: 'email' },
  { campo: 'motivo', etiqueta: 'Motivo de la consulta', tipo: 'text', ancho: true },
  { campo: 'mensaje', etiqueta: 'Cuéntanos', tipo: 'textarea', requerido: true },
];

export default function Contacto() {
  return (
    <>
      <section className="border-b" style={{ borderColor: C.borde }}>
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <Antetitulo>Contacto</Antetitulo>
          <h1 className="text-4xl md:text-5xl font-black leading-[1.1] tracking-tight max-w-4xl" style={{ color: C.azul }}>
            Hablar con un corredor
          </h1>
          <p className="mt-6 text-lg leading-relaxed max-w-3xl" style={{ color: C.textoSuave }}>
            Para una consulta general. Si lo que quieres es que revisemos tus pólizas o comunicar un
            siniestro, hay una vía específica para cada cosa.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Boton href={CORREBIN_CTA.revision.href} variante="secundario">
              Solicitar revisión de pólizas
            </Boton>
            <Boton href={CORREBIN_CTA.siniestro.href} variante="secundario">
              Comunicar un siniestro
            </Boton>
          </div>
        </div>
      </section>

      <Seccion>
        <div className="grid lg:grid-cols-[1fr_1.3fr] gap-12 items-start">
          <div>
            <Encabezado ante="Directo" titulo="Por teléfono suele ser lo más rápido" />
            <div className="mt-6 space-y-3">
              <a
                href={`tel:${CORREBIN_EMPRESA.telefonoTel}`}
                className="flex items-center justify-between gap-4 p-4 rounded-xl border transition hover:opacity-80"
                style={{ borderColor: C.borde, background: '#fff' }}
              >
                <span>
                  <span className="block text-xs font-bold uppercase tracking-widest" style={{ color: C.textoSuave }}>Teléfono</span>
                  <span className="block text-lg font-black" style={{ color: C.azul }}>{CORREBIN_EMPRESA.telefono}</span>
                </span>
                <span className="text-2xl" aria-hidden>→</span>
              </a>
              <a
                href={CORREBIN_EMPRESA.whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-4 p-4 rounded-xl border transition hover:opacity-80"
                style={{ borderColor: C.borde, background: '#fff' }}
              >
                <span>
                  <span className="block text-xs font-bold uppercase tracking-widest" style={{ color: C.textoSuave }}>WhatsApp</span>
                  <span className="block text-lg font-black" style={{ color: C.azul }}>{CORREBIN_EMPRESA.whatsapp}</span>
                </span>
                <span className="text-2xl" aria-hidden>→</span>
              </a>
            </div>

            <Tarjeta className="mt-6 !p-5">
              <p className="text-xs leading-relaxed" style={{ color: C.textoSuave }}>
                {CORREBIN_EMPRESA.razonSocial}
                <br />
                CIF {CORREBIN_EMPRESA.cif}
              </p>
            </Tarjeta>
          </div>

          <div>
            <Encabezado ante="Por escrito" titulo="Escríbenos y te llamamos" />
            <div className="mt-6">
              <FormularioSeguros tipo="contacto" campos={CAMPOS} textoBoton="Enviar consulta" />
            </div>
          </div>
        </div>
      </Seccion>
    </>
  );
}
