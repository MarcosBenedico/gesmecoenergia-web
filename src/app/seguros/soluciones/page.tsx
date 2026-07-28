import type { Metadata } from 'next';
import { CORREBIN_EMPRESAS, CORREBIN_PARTICULARES, CORREBIN_CTA, CORREBIN_COLORES as C } from '@/lib/correbin-marca';
import { Seccion, Encabezado, Tarjeta, SiguientePaso, Antetitulo } from '../ui';

export const metadata: Metadata = {
  title: 'Soluciones · Correbin Asociados',
  description:
    'Los frentes que cubre un programa asegurador de empresa y los seguros personales, explicados por necesidad y no por nombre técnico de póliza.',
};

/**
 * Soluciones, ordenadas por necesidad y no por el nombre técnico de la póliza
 * (criterio del Volumen III). El detalle producto a producto llegará con el
 * Volumen VII y esta página crecerá con él.
 */

/** Qué protege cada frente, en lenguaje de empresa. */
const QUE_PROTEGE: Record<string, string> = {
  'Patrimonio y continuidad':
    'Las instalaciones, la maquinaria, las existencias y lo que se deja de ingresar si hay que parar.',
  'Responsabilidad':
    'Los daños que la actividad, los productos o las instalaciones puedan causar a terceros.',
  'Personas':
    'Los trabajadores y lo que exige el convenio, además de vida, salud y accidentes.',
  'Movilidad y transporte':
    'Vehículos, flotas y la mercancía mientras viaja, propia o de clientes.',
  'Riesgos financieros':
    'Impagos, crédito y garantías frente a incumplimientos.',
  'Ciber y tecnología':
    'Parones informáticos, pérdida de datos y responsabilidad derivada de un incidente.',
  'Administradores y dirección':
    'La responsabilidad personal de quien administra o dirige la sociedad.',
  'Defensa jurídica':
    'La asistencia y los gastos cuando hay que reclamar o defenderse.',
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
            Basta con saber qué hay que proteger. El nombre técnico del contrato y su encaje dentro del
            programa es trabajo nuestro.
          </p>
        </div>
      </section>

      <Seccion>
        <Encabezado ante="Empresa" titulo="Los ocho frentes de un programa asegurador" />
        <div className="mt-10 grid md:grid-cols-2 gap-5">
          {CORREBIN_EMPRESAS.bloques.map((b) => (
            <Tarjeta key={b}>
              <h2 className="text-lg font-black leading-snug mb-2" style={{ color: C.azul }}>{b}</h2>
              <p className="text-sm leading-relaxed" style={{ color: C.textoSuave }}>{QUE_PROTEGE[b]}</p>
            </Tarjeta>
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
        titulo="¿Cuál de estos frentes tienes sin cubrir?"
        texto="Con las pólizas actuales delante se ve enseguida dónde hay lagunas y dónde duplicidades."
        principal={{ href: CORREBIN_CTA.revision.href, texto: 'Solicitar diagnóstico inicial' }}
        secundario={{ href: '/seguros/gerencia-de-riesgos', texto: 'Ver el método' }}
      />
    </>
  );
}
