import type { Metadata } from 'next';
import { CORREBIN_PUBLICOS, CORREBIN_CTA, CORREBIN_COLORES as C } from '@/lib/correbin-marca';
import { Seccion, Encabezado, Tarjeta, SiguientePaso, Antetitulo } from '../ui';

export const metadata: Metadata = {
  title: 'Sectores · Correbin Asociados',
  description:
    'Industria y agroalimentario, transporte y flotas, explotaciones agrícolas y ganaderas, comercio y pymes, y entidades públicas.',
};

/**
 * Sectores. De momento con los públicos prioritarios aprobados en el Volumen I:
 * el detalle por sector llegará con el Volumen VI, y esta página crecerá con él.
 */

/** Qué cambia el riesgo en cada sector. Descripciones derivadas del método
 *  (Volúmenes IV y V), sin atribuir experiencia ni casos no confirmados. */
const DETALLE: Record<string, string> = {
  'Empresas industriales y agroalimentarias':
    'Maquinaria, existencias, cadena de frío y paradas de actividad. El capital de continente y contenido se queda corto en cuanto la planta crece.',
  'Transportistas, operadores logísticos y flotas':
    'Vehículos, mercancía transportada, talleres y responsabilidad frente a cargadores. Vencimientos dispersos que conviene ordenar.',
  'Ganaderos, agricultores y explotaciones':
    'Naves, animales, cosecha, maquinaria y responsabilidad por la actividad. Bienes repartidos en varias direcciones de riesgo.',
  'Comercios, autónomos y pymes':
    'Local, contenido, responsabilidad civil y continuidad del negocio si hay que cerrar unos días.',
  'Ayuntamientos, asociaciones y entidades':
    'Responsabilidad patrimonial, instalaciones de uso público, actividades y voluntariado.',
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
            explotación con bienes repartidos. El análisis empieza por entender cómo funciona el negocio.
          </p>
        </div>
      </section>

      <Seccion>
        <div className="grid md:grid-cols-2 gap-5">
          {CORREBIN_PUBLICOS.empresa.map((sector) => (
            <Tarjeta key={sector}>
              <h2 className="text-lg font-black leading-snug mb-2" style={{ color: C.azul }}>{sector}</h2>
              <p className="text-sm leading-relaxed" style={{ color: C.textoSuave }}>{DETALLE[sector]}</p>
            </Tarjeta>
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

      <SiguientePaso
        titulo="¿Trabajas en alguno de estos sectores?"
        texto="Cuéntanos qué tienes contratado y lo revisamos con la actividad real delante."
        principal={{ href: CORREBIN_CTA.revision.href, texto: 'Solicitar diagnóstico inicial' }}
        secundario={{ href: '/seguros/empresas', texto: 'Ver seguros de empresa' }}
      />
    </>
  );
}
