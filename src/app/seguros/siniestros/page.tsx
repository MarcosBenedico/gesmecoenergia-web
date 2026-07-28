import type { Metadata } from 'next';
import {
  CORREBIN_SINIESTROS, CORREBIN_TIPOS_SINIESTRO, CORREBIN_EMPRESA, CORREBIN_COLORES as C,
} from '@/lib/correbin-marca';
import { Seccion, Encabezado, Lista, Tarjeta, Aviso, Antetitulo } from '../ui';
import { Suspense } from 'react';
import { FormularioSeguros, CampoForm } from '../formulario';

export const metadata: Metadata = {
  title: 'Comunicar un siniestro · Correbin Asociados',
  description:
    'Apertura y seguimiento de siniestros: identificación de póliza, comunicación a la aseguradora, coordinación pericial, plazos y defensa de tu posición.',
};

/** Campos del Volumen III, pensados para rellenarse desde el móvil. */
const CAMPOS: CampoForm[] = [
  { campo: 'nombre', etiqueta: 'Asegurado (nombre o empresa)', tipo: 'text', requerido: true },
  { campo: 'nif', etiqueta: 'NIF / CIF', tipo: 'text' },
  { campo: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', requerido: true },
  { campo: 'email', etiqueta: 'Correo electrónico', tipo: 'email' },
  { campo: 'poliza', etiqueta: 'Nº de póliza', tipo: 'text', ayuda: 'Si no lo tienes a mano, déjalo en blanco' },
  { campo: 'fecha_siniestro', etiqueta: 'Fecha del siniestro', tipo: 'date' },
  { campo: 'lugar', etiqueta: 'Lugar', tipo: 'text' },
  { campo: 'tipo_siniestro', etiqueta: 'Tipo de siniestro', tipo: 'select', opciones: CORREBIN_TIPOS_SINIESTRO },
  { campo: 'mensaje', etiqueta: 'Qué ha pasado', tipo: 'textarea', requerido: true },
  { campo: 'autoridades', etiqueta: 'Autoridades que intervinieron', tipo: 'text', ayuda: 'Policía, Guardia Civil, bomberos…', ancho: true },
  { campo: 'danos_personales', etiqueta: 'Hay daños personales', tipo: 'checkbox' },
  { campo: 'terceros', etiqueta: 'Hay terceros implicados', tipo: 'checkbox' },
  { campo: 'urgente', etiqueta: 'Es urgente', tipo: 'checkbox', ancho: true },
];

export default function Siniestros() {
  return (
    <>
      <section className="border-b" style={{ borderColor: C.borde }}>
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <Antetitulo>Siniestros</Antetitulo>
          <h1 className="text-4xl md:text-5xl font-black leading-[1.1] tracking-tight max-w-4xl" style={{ color: C.azul }}>
            {CORREBIN_SINIESTROS.h1}
          </h1>

          {/* Lo primero de todo: emergencias antes que papeleo */}
          <div className="mt-8 max-w-3xl">
            <Aviso tipo="urgente">
              <strong>{CORREBIN_SINIESTROS.aviso}</strong>
            </Aviso>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={`tel:${CORREBIN_EMPRESA.telefonoTel}`}
              className="inline-flex items-center px-6 py-3.5 rounded-lg text-base font-bold text-white transition hover:opacity-90"
              style={{ background: C.rojo }}
            >
              Llamar al {CORREBIN_EMPRESA.telefono}
            </a>
            <a
              href={CORREBIN_EMPRESA.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3.5 rounded-lg text-base font-bold border transition hover:opacity-75"
              style={{ borderColor: C.azul, color: C.azul }}
            >
              WhatsApp {CORREBIN_EMPRESA.whatsapp}
            </a>
          </div>
        </div>
      </section>

      <Seccion alt>
        <div className="grid lg:grid-cols-[1fr_1fr] gap-12 items-start">
          <div>
            <Encabezado
              ante="Qué hacemos"
              titulo="Desde la apertura hasta el cierre"
              texto="Un parte no se resuelve enviando un correo. Hay plazos, documentación, peritos y una cobertura que hay que leer bien."
            />
            <div className="mt-6">
              <Aviso>{CORREBIN_SINIESTROS.limite}</Aviso>
            </div>
          </div>
          <Tarjeta>
            <Lista puntos={CORREBIN_SINIESTROS.servicio} />
          </Tarjeta>
        </div>
      </Seccion>

      <Seccion id="formulario">
        <div className="max-w-3xl">
          <Encabezado
            ante="Comunicar"
            titulo="Cuéntanos qué ha pasado"
            texto="Rellena lo que sepas ahora mismo. Lo que falte lo completamos nosotros contigo; no esperes a tenerlo todo."
          />
        </div>
        <div className="mt-8 max-w-3xl">
          <Suspense fallback={<div className="rounded-2xl border p-8" style={{ borderColor: C.borde }} />}>
            <FormularioSeguros
              tipo="siniestro"
              campos={CAMPOS}
              textoBoton="Comunicar el siniestro"
              avisoSalud
            />
          </Suspense>
        </div>
      </Seccion>
    </>
  );
}
