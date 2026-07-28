import type { Metadata } from 'next';
import Link from 'next/link';
import { SOLUCIONES } from '@/lib/correbin-catalogo';
import { CORREBIN_PARTICULARES, CORREBIN_CTA, CORREBIN_COLORES as C } from '@/lib/correbin-marca';
import { Seccion, Encabezado, Tarjeta, SiguientePaso, Antetitulo } from '../ui';

export const metadata: Metadata = {
  title: 'Soluciones por riesgo · Correbin Asociados',
  description:
    'Multirriesgo empresarial, responsabilidad civil, flotas, transporte de mercancías, personas y convenio, y D&O, ciber, crédito y caución.',
  alternates: { canonical: '/seguros/soluciones' },
};

export default function Soluciones() {
  return (
    <>
      <section className="border-b" style={{ borderColor: C.borde }}>
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <Antetitulo>Soluciones</Antetitulo>
          <h1 className="text-4xl md:text-5xl font-black leading-[1.1] tracking-tight max-w-4xl" style={{ color: C.azul }}>
            No hace falta saber cómo se llama la póliza
          </h1>
          <p className="mt-6 text-lg leading-relaxed max-w-3xl" style={{ color: C.textoSuave }}>
            Basta con saber qué hay que proteger. Cada solución empieza por el riesgo, sigue por los datos
            que hacen falta para estudiarlo y termina en los límites que conviene revisar.
          </p>
        </div>
      </section>

      <Seccion>
        <div className="grid md:grid-cols-2 gap-5">
          {SOLUCIONES.map((s) => (
            <Link key={s.slug} href={`/seguros/soluciones/${s.slug}`}>
              <Tarjeta className="h-full transition hover:-translate-y-0.5">
                <h2 className="text-xl font-black leading-snug mb-2" style={{ color: C.azul }}>{s.nombre}</h2>
                <p className="text-sm leading-relaxed" style={{ color: C.textoSuave }}>{s.entradilla}</p>
                <span className="text-sm font-bold mt-4 inline-block" style={{ color: C.rojo }}>
                  Ver la solución →
                </span>
              </Tarjeta>
            </Link>
          ))}
        </div>
      </Seccion>

      <Seccion alt>
        <Encabezado
          ante="Personal"
          titulo="Seguros de particulares"
          texto="Los mismos criterios aplicados a la casa, el coche y la familia."
        />
        <div className="mt-6 flex flex-wrap gap-2.5">
          {CORREBIN_PARTICULARES.productos.map((p) => (
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
        titulo="¿Cuál de estos frentes tienes sin cubrir?"
        texto="Con las pólizas actuales delante se ve enseguida dónde hay lagunas y dónde duplicidades."
        principal={{ href: CORREBIN_CTA.revision.href, texto: 'Solicitar diagnóstico inicial' }}
        secundario={{ href: '/seguros/sectores', texto: 'Ver por sector' }}
      />
    </>
  );
}
