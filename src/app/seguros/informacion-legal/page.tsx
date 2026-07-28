import type { Metadata } from 'next';
import Link from 'next/link';
import { CORREBIN_EMPRESA, CORREBIN_COLORES as C } from '@/lib/correbin-marca';
import { Seccion, Tarjeta, Antetitulo } from '../ui';

export const metadata: Metadata = {
  title: 'Información legal · Correbin Asociados',
  description: 'Datos identificativos de la correduría y condiciones de uso de la microsede de seguros.',
};

export default function InformacionLegal() {
  return (
    <>
      <section className="border-b" style={{ borderColor: C.borde }}>
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Antetitulo>Legal</Antetitulo>
          <h1 className="text-4xl font-black leading-tight tracking-tight" style={{ color: C.azul }}>
            Información legal
          </h1>
        </div>
      </section>

      <Seccion>
        <div className="max-w-3xl space-y-8">
          <Tarjeta>
            <h2 className="text-lg font-black mb-4" style={{ color: C.azul }}>Datos identificativos</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide" style={{ color: C.textoSuave }}>Razón social</dt>
                <dd style={{ color: C.texto }}>{CORREBIN_EMPRESA.razonSocial}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide" style={{ color: C.textoSuave }}>Nombre comercial</dt>
                <dd style={{ color: C.texto }}>{CORREBIN_EMPRESA.nombreComercial}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide" style={{ color: C.textoSuave }}>CIF</dt>
                <dd style={{ color: C.texto }}>{CORREBIN_EMPRESA.cif}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide" style={{ color: C.textoSuave }}>Teléfono</dt>
                <dd style={{ color: C.texto }}>{CORREBIN_EMPRESA.telefono}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide" style={{ color: C.textoSuave }}>WhatsApp</dt>
                <dd style={{ color: C.texto }}>{CORREBIN_EMPRESA.whatsapp}</dd>
              </div>
            </dl>
          </Tarjeta>

          <div>
            <h2 className="text-lg font-black mb-3" style={{ color: C.azul }}>Naturaleza de la información publicada</h2>
            <p className="text-sm leading-relaxed" style={{ color: C.textoSuave }}>
              Los contenidos de esta sección describen la forma de trabajar de la correduría y tienen
              carácter informativo. No constituyen una oferta contractual ni un asesoramiento
              personalizado: el alcance de cualquier cobertura lo determinan las condiciones
              particulares, especiales y generales de cada póliza.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black mb-3" style={{ color: C.azul }}>Tratamiento de datos</h2>
            <p className="text-sm leading-relaxed" style={{ color: C.textoSuave }}>
              Los datos que se envían a través de los formularios se utilizan únicamente para atender la
              solicitud correspondiente. Puedes consultar el detalle en la{' '}
              <Link href="/privacidad" className="underline font-semibold" style={{ color: C.azul }}>
                política de privacidad
              </Link>{' '}
              y ejercer tus derechos de acceso, rectificación y supresión dirigiéndote a la correduría por
              los medios de contacto publicados.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black mb-3" style={{ color: C.azul }}>Registro administrativo</h2>
            <p className="text-sm leading-relaxed" style={{ color: C.textoSuave }}>
              Correduría de seguros inscrita en el registro administrativo especial de mediadores de
              seguros. Los datos completos de inscripción, así como el correo, la dirección postal y el
              horario de atención, se publicarán en cuanto estén confirmados.
            </p>
          </div>
        </div>
      </Seccion>
    </>
  );
}
