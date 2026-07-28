import type { Metadata } from 'next';
import { CORREBIN_PARTICULARES, CORREBIN_CTA, CORREBIN_COLORES as C } from '@/lib/correbin-marca';
import { Seccion, Encabezado, Lista, Tarjeta, Boton, SiguientePaso, Antetitulo } from '../ui';

export const metadata: Metadata = {
  title: 'Seguros para particulares · Correbin Asociados',
  description:
    'Hogar, auto, vida, salud, comunidades y ahorro con el mismo criterio técnico: revisar límites, franquicias, capitales, beneficiarios y duplicidades.',
};

export default function Particulares() {
  return (
    <>
      <section className="border-b" style={{ borderColor: C.borde }}>
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <Antetitulo>Particulares</Antetitulo>
          <h1 className="text-4xl md:text-5xl font-black leading-[1.1] tracking-tight max-w-4xl" style={{ color: C.azul }}>
            El mismo criterio técnico, aplicado a lo personal
          </h1>
          <p className="mt-6 text-lg leading-relaxed max-w-3xl" style={{ color: C.textoSuave }}>
            Un seguro de hogar o de vida también se puede revisar: los capitales quedan cortos con los
            años, las franquicias no siempre son las que uno cree y los beneficiarios se olvidan de
            actualizar. Con el mismo interlocutor el día que hay un parte.
          </p>
          <div className="mt-8">
            <Boton href={CORREBIN_CTA.revision.href}>{CORREBIN_PARTICULARES.cta}</Boton>
          </div>
        </div>
      </section>

      <Seccion>
        <Encabezado ante="Qué cubrimos" titulo="Los seguros de una familia" />
        <div className="mt-8 flex flex-wrap gap-2.5">
          {CORREBIN_PARTICULARES.productos.map((p) => (
            <span
              key={p}
              className="inline-flex items-center px-4 py-2.5 rounded-lg border text-sm font-semibold"
              style={{ borderColor: C.borde, color: C.azul, background: '#fff' }}
            >
              {p}
            </span>
          ))}
        </div>
      </Seccion>

      <Seccion alt>
        <div className="grid lg:grid-cols-[1fr_1fr] gap-12 items-start">
          <Encabezado
            ante="Qué revisamos"
            titulo="Dónde suele estar el problema"
            texto="Casi nunca está en el precio. Está en un capital que se quedó corto o en una exclusión que nadie leyó."
          />
          <Tarjeta>
            <Lista puntos={CORREBIN_PARTICULARES.metodo} />
          </Tarjeta>
        </div>
      </Seccion>

      <SiguientePaso
        titulo="¿Revisamos tus seguros personales?"
        texto="Sin compromiso y sin cambiar nada hasta que la propuesta tenga sentido."
        principal={{ href: CORREBIN_CTA.revision.href, texto: CORREBIN_PARTICULARES.cta }}
        secundario={{ href: CORREBIN_CTA.corredor.href, texto: 'Hablar con un corredor' }}
      />
    </>
  );
}
