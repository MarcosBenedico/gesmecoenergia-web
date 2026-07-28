import type { Metadata } from 'next';
import Link from 'next/link';
import { SECTORES } from '@/lib/correbin-catalogo';
import { CORREBIN_PUBLICOS, CORREBIN_CTA, CORREBIN_COLORES as C } from '@/lib/correbin-marca';
import { Seccion, Encabezado, Tarjeta, SiguientePaso, Antetitulo } from '../ui';

export const metadata: Metadata = {
  title: 'Sectores · Correbin Asociados',
  description:
    'Transporte y logística, industria agroalimentaria, explotaciones agrícolas y ganaderas, industria, comercio y servicios, y administraciones y entidades.',
  alternates: { canonical: '/seguros/sectores' },
};

export default function Sectores() {
  return (
    <>
      <section className="border-b" style={{ borderColor: C.borde }}>
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <Antetitulo>Sectores</Antetitulo>
          <h1 className="text-4xl md:text-5xl font-black leading-[1.1] tracking-tight max-w-4xl" style={{ color: C.azul }}>
            Cada actividad tiene sus propios puntos débiles
          </h1>
          <p className="mt-6 text-lg leading-relaxed max-w-3xl" style={{ color: C.textoSuave }}>
            No es lo mismo asegurar una nave con cámara frigorífica que una flota de camiones o una
            explotación con los bienes repartidos. El análisis empieza por entender cómo funciona el
            negocio, no por elegir una póliza.
          </p>
        </div>
      </section>

      <Seccion>
        <div className="grid md:grid-cols-2 gap-5">
          {SECTORES.map((s) => (
            <Link key={s.slug} href={`/seguros/sectores/${s.slug}`}>
              <Tarjeta className="h-full transition hover:-translate-y-0.5">
                <h2 className="text-xl font-black leading-snug mb-2" style={{ color: C.azul }}>{s.nombre}</h2>
                <p className="text-sm leading-relaxed" style={{ color: C.textoSuave }}>{s.entradilla}</p>
                <span className="text-sm font-bold mt-4 inline-block" style={{ color: C.rojo }}>
                  Ver el sector →
                </span>
              </Tarjeta>
            </Link>
          ))}
        </div>
      </Seccion>

      <Seccion alt>
        <Encabezado
          ante="Particulares"
          titulo="Y también los seguros de casa"
          texto="Hogar, auto, vida, salud y comunidades, con el mismo criterio de revisión."
        />
        <div className="mt-6 flex flex-wrap gap-2.5">
          {CORREBIN_PUBLICOS.particulares.map((p) => (
            <Link
              key={p}
              href="/seguros/particulares"
              className="inline-flex items-center px-4 py-2.5 rounded-lg border text-sm font-semibold transition hover:opacity-75"
              style={{ borderColor: C.borde, color: C.azul, background: '#fff' }}
            >
              {p}
            </Link>
          ))}
        </div>
      </Seccion>

      <SiguientePaso
        titulo="¿Trabajas en alguno de estos sectores?"
        texto="Cuéntanos qué tienes contratado y lo revisamos con la actividad real delante."
        principal={{ href: CORREBIN_CTA.revision.href, texto: 'Solicitar diagnóstico inicial' }}
        secundario={{ href: '/seguros/soluciones', texto: 'Ver soluciones por riesgo' }}
      />
    </>
  );
}
