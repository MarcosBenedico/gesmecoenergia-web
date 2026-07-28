import type { Metadata } from 'next';
import { CORREBIN_NOSOTROS, CORREBIN_EMPRESA, CORREBIN_CTA, CORREBIN_COLORES as C } from '@/lib/correbin-marca';
import { Seccion, Encabezado, Tarjeta, SiguientePaso, Antetitulo } from '../ui';

export const metadata: Metadata = {
  title: 'Quiénes somos · Correbin Asociados',
  description:
    'Correduría de seguros parte de Grupo Gesmeco, junto con Asesoría Gesmeco y Gesmeco Energía. Independencia, rigor técnico y continuidad.',
};

export default function Nosotros() {
  return (
    <>
      <section className="border-b" style={{ borderColor: C.borde }}>
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <Antetitulo>Quiénes somos</Antetitulo>
          <h1 className="text-4xl md:text-5xl font-black leading-[1.1] tracking-tight max-w-4xl" style={{ color: C.azul }}>
            Una correduría dentro de un grupo que conoce tu empresa por dentro
          </h1>
          <div className="mt-8 max-w-3xl space-y-4">
            {CORREBIN_NOSOTROS.copy.map((p) => (
              <p key={p} className="text-lg leading-relaxed" style={{ color: C.textoSuave }}>
                {p}
              </p>
            ))}
          </div>
        </div>
      </section>

      <Seccion>
        <Encabezado
          ante="Cómo trabajamos"
          titulo="Seis maneras de entender este oficio"
        />
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CORREBIN_NOSOTROS.valores.map((v) => (
            <Tarjeta key={v} className="!p-5">
              <p className="text-base font-black" style={{ color: C.azul }}>{v}</p>
            </Tarjeta>
          ))}
        </div>
      </Seccion>

      <Seccion alt>
        <div className="grid lg:grid-cols-[1fr_1fr] gap-12 items-start">
          <Encabezado
            ante="El grupo"
            titulo="Tres áreas, una misma casa"
            texto="Energía, asesoría y seguros trabajan coordinados, cada una con su especialización profesional. Eso permite entender la actividad, los trabajadores, el patrimonio, las instalaciones y los costes de una empresa sin tener que explicarlo tres veces."
          />
          <Tarjeta>
            <p className="text-sm font-black mb-4" style={{ color: C.azul }}>Datos de la correduría</p>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide" style={{ color: C.textoSuave }}>Razón social</dt>
                <dd style={{ color: C.texto }}>{CORREBIN_EMPRESA.razonSocial}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide" style={{ color: C.textoSuave }}>CIF</dt>
                <dd style={{ color: C.texto }}>{CORREBIN_EMPRESA.cif}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide" style={{ color: C.textoSuave }}>Teléfono</dt>
                <dd>
                  <a href={`tel:${CORREBIN_EMPRESA.telefonoTel}`} className="font-bold" style={{ color: C.azul }}>
                    {CORREBIN_EMPRESA.telefono}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide" style={{ color: C.textoSuave }}>WhatsApp</dt>
                <dd>
                  <a
                    href={CORREBIN_EMPRESA.whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold"
                    style={{ color: C.azul }}
                  >
                    {CORREBIN_EMPRESA.whatsapp}
                  </a>
                </dd>
              </div>
            </dl>
          </Tarjeta>
        </div>
      </Seccion>

      <SiguientePaso
        titulo="¿Hablamos de tu programa de seguros?"
        principal={{ href: CORREBIN_CTA.revision.href, texto: 'Solicitar revisión' }}
        secundario={{ href: CORREBIN_CTA.corredor.href, texto: 'Hablar con un corredor' }}
      />
    </>
  );
}
