import Link from 'next/link';
import { Ficha } from '@/lib/correbin-catalogo';
import { CORREBIN_EMPRESA, CORREBIN_CTA, CORREBIN_COLORES as C } from '@/lib/correbin-marca';
import { Seccion, Encabezado, Lista, Tarjeta, Boton, SiguientePaso, Antetitulo } from './ui';

/**
 * Plantilla común de sectores y soluciones (Volumen VII: «usa una plantilla
 * común, pero conserva contenido específico»). La estructura se repite; el
 * contenido de cada ficha es propio y sale de correbin-catalogo.ts.
 *
 * Incluye migas de pan y datos estructurados, como pide el Volumen VIII.
 */

/** Migas de pan visibles + su equivalente en datos estructurados. */
function Migas({ ruta }: { ruta: { href: string; texto: string }[] }) {
  return (
    <>
      <nav aria-label="Migas de pan" className="text-xs font-semibold mb-5">
        {ruta.map((r, i) => (
          <span key={r.href}>
            {i > 0 && <span className="mx-1.5" style={{ color: C.textoSuave }} aria-hidden>/</span>}
            {i === ruta.length - 1 ? (
              <span style={{ color: C.textoSuave }}>{r.texto}</span>
            ) : (
              <Link href={r.href} className="hover:underline" style={{ color: C.azul }}>
                {r.texto}
              </Link>
            )}
          </span>
        ))}
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: ruta.map((r, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: r.texto,
              item: `https://gesmecoenergia.com${r.href}`,
            })),
          }),
        }}
      />
    </>
  );
}

export function PaginaFicha({
  ficha, tipo,
}: {
  ficha: Ficha;
  tipo: 'sector' | 'solucion';
}) {
  const esSector = tipo === 'sector';
  const indice = esSector
    ? { href: '/seguros/sectores', texto: 'Sectores' }
    : { href: '/seguros/soluciones', texto: 'Soluciones' };
  // El formulario hereda el sector (criterio de aceptación del Volumen VI)
  const hrefRevision = `${CORREBIN_CTA.revision.href}?sector=${encodeURIComponent(ficha.nombre)}`;

  return (
    <>
      {/* Servicio, en datos estructurados. Solo datos confirmados: ni valoraciones
          ni cobertura geográfica que no se pueda demostrar (Volumen VIII). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: ficha.nombre,
            description: ficha.metaDescripcion,
            serviceType: esSector ? 'Correduría de seguros por sector' : 'Solución aseguradora',
            provider: {
              '@type': 'InsuranceAgency',
              name: CORREBIN_EMPRESA.nombreComercial,
              legalName: CORREBIN_EMPRESA.razonSocial,
              telephone: CORREBIN_EMPRESA.telefonoTel,
              taxID: CORREBIN_EMPRESA.cif,
            },
          }),
        }}
      />

      <section className="border-b" style={{ borderColor: C.borde }}>
        <div className="mx-auto max-w-6xl px-5 py-12 md:py-16">
          <Migas
            ruta={[
              { href: '/seguros', texto: 'Seguros' },
              indice,
              { href: `${indice.href}/${ficha.slug}`, texto: ficha.nombre },
            ]}
          />
          <Antetitulo>{esSector ? 'Sector' : 'Solución'}</Antetitulo>
          <h1 className="text-4xl md:text-5xl font-black leading-[1.1] tracking-tight max-w-4xl" style={{ color: C.azul }}>
            {ficha.titular}
          </h1>
          <p className="mt-6 text-lg leading-relaxed max-w-3xl" style={{ color: C.textoSuave }}>
            {ficha.entradilla}
          </p>

          {/* El criterio técnico, destacado */}
          <p
            className="mt-8 max-w-3xl text-lg font-bold leading-snug border-l-4 pl-5 py-1"
            style={{ borderColor: C.rojo, color: C.azul }}
          >
            {ficha.mensaje}
          </p>

          <div className="mt-8">
            <Boton href={hrefRevision}>{ficha.cta}</Boton>
          </div>
        </div>
      </section>

      {/* Bloques de contenido propios de esta ficha */}
      {ficha.bloques.map((b, i) => (
        <Seccion key={b.titulo} alt={i % 2 === 1}>
          <div className="grid lg:grid-cols-[1fr_1.3fr] gap-10 items-start">
            <Encabezado ante={`0${i + 1}`} titulo={b.titulo} texto={b.subtitulo} />
            <Tarjeta>
              <ul className="grid sm:grid-cols-2 gap-x-6">
                {b.puntos.map((p) => (
                  <li
                    key={p}
                    className="flex gap-2.5 text-sm leading-snug py-2.5 border-b last:border-0"
                    style={{ color: C.texto, borderColor: C.borde }}
                  >
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C.rojo }} />
                    {p}
                  </li>
                ))}
              </ul>
            </Tarjeta>
          </div>
        </Seccion>
      ))}

      {/* Qué datos hay que reunir: se piden datos antes de proponer (Volumen VII) */}
      {ficha.datos && ficha.datos.length > 0 && (
        <Seccion>
          <div className="grid lg:grid-cols-[1fr_1fr] gap-10 items-start">
            <Encabezado
              ante="Para poder trabajar"
              titulo="Qué necesitamos para estudiarlo"
              texto="Sin estos datos cualquier número sería inventado. Con ellos se puede preparar el riesgo y presentarlo al mercado."
            />
            <Tarjeta>
              <Lista puntos={ficha.datos} tono="azul" />
            </Tarjeta>
          </div>
        </Seccion>
      )}

      {/* Enlace bidireccional sectores ↔ soluciones (criterio del Volumen VI) */}
      {ficha.relacionadas && ficha.relacionadas.length > 0 && (
        <Seccion alt>
          <Encabezado ante="Relacionado" titulo="Otras piezas del mismo programa" />
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ficha.relacionadas.map((r) => (
              <Link key={r.href} href={r.href}>
                <Tarjeta className="!p-5 h-full transition hover:-translate-y-0.5">
                  <p className="text-base font-black leading-snug" style={{ color: C.azul }}>
                    {r.texto}
                  </p>
                  <span className="text-sm font-bold mt-2 inline-block" style={{ color: C.rojo }}>
                    Ver →
                  </span>
                </Tarjeta>
              </Link>
            ))}
          </div>
        </Seccion>
      )}

      <SiguientePaso
        titulo={ficha.cta}
        texto="Se empieza reuniendo la documentación. A partir de ahí se puede decir algo con fundamento."
        principal={{ href: hrefRevision, texto: 'Solicitar diagnóstico inicial' }}
        secundario={{ href: CORREBIN_CTA.corredor.href, texto: 'Hablar con un corredor' }}
      />
    </>
  );
}
