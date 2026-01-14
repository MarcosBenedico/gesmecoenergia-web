import { Container } from "@/components/container";
import { FeatureCard } from "@/components/feature-card";
import { SectionHeading } from "@/components/section-heading";
import { sectors } from "@/lib/data";

export const metadata = {
  title: "Sectores | Gesmeco Energía",
  description: "Especialistas en sectores con consumo crítico y necesidad de fiabilidad.",
};

const sectorDetails = [
  {
    title: "Industria",
    bullets: [
      "Coberturas a medida para producción 24/7.",
      "Optimización de base load y gestión de picos.",
      "Planes de eficiencia por línea y activo.",
    ],
  },
  {
    title: "Logística y frío",
    bullets: [
      "Reducción de consumo específico en refrigeración.",
      "Autoconsumo con almacenamiento para cargas críticas.",
      "Monitorización centralizada de múltiples centros.",
    ],
  },
  {
    title: "Agroalimentario",
    bullets: [
      "Autosuficiencia parcial con PPAs o autoconsumo.",
      "Mejora de factor de potencia y reactiva.",
      "Planes de descarbonización alineados a ESG.",
    ],
  },
  {
    title: "Retail y terciario",
    bullets: [
      "Unificación de contratos multi-sede.",
      "Cuadros de mando centralizados.",
      "Detección temprana de desvíos y fugas.",
    ],
  },
];

export default function SectorsPage() {
  return (
    <div className="pb-20">
      <section className="pt-14">
        <Container>
          <SectionHeading kicker="Sectores" title="Expertise especializado por industria.">
            Construimos soluciones adaptadas a cada curva de consumo, nivel de criticidad y
            objetivos de coste y carbono.
          </SectionHeading>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {sectors.map((sector) => (
              <div
                key={sector.name}
                className="card rounded-2xl p-5 transition duration-200 hover:-translate-y-1 hover:shadow-soft"
              >
                <div className="text-sm uppercase tracking-[0.14em] text-emerald-700">
                  {sector.name}
                </div>
                <p className="mt-2 text-sm text-muted">{sector.description}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="mt-14">
        <Container>
          <SectionHeading
            kicker="Soluciones"
            title="Lo que cambia por sector"
          >
            Ajustamos contratos, tecnología y operación según la criticidad y perfil de
            riesgo de cada negocio.
          </SectionHeading>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {sectorDetails.map((item) => (
              <FeatureCard key={item.title} title={item.title}>
                <ul className="space-y-2 text-sm text-muted">
                  {item.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-accent" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </FeatureCard>
            ))}
          </div>
        </Container>
      </section>
    </div>
  );
}
