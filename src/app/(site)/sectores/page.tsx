import { Container } from "@/components/container";
import { FeatureCard } from "@/components/feature-card";
import { SectionHeading } from "@/components/section-heading";
import { sectors } from "@/lib/data";

export const metadata = {
  title: "Sectores | Gesmeco Energía",
  description:
    "Viviendas, ganadería, agricultura, comercios y empresas de Binéfar y comarca. Soluciones energéticas a medida de cada sector.",
};

const sectorDetails = [
  {
    title: "Hogares y comunidades",
    bullets: [
      "Revisión de tarifa y potencia contratada: la mayoría paga de más.",
      "Solar en tejado con amortización clara antes de firmar nada.",
      "Solar compartida en comunidades: todos los vecinos pagan menos luz.",
    ],
  },
  {
    title: "Ganadería y agricultura",
    bullets: [
      "Solar para bombeo, refrigeración y consumo de granja.",
      "Riego sin depender de horarios caros de red.",
      "Instalaciones pensadas para el campo: robustas y sin complicaciones.",
    ],
  },
  {
    title: "Comercios y hostelería",
    bullets: [
      "Ajuste de potencia contratada al consumo real del negocio.",
      "Solar en tejado para bares, tiendas y peluquerías.",
      "Factura clara: sabes qué pagas y por qué, cada mes.",
    ],
  },
  {
    title: "Naves y empresas",
    bullets: [
      "Análisis de picos de carga y penalizaciones evitables.",
      "Solar industrial en cubierta, desde 20 kW hasta varios MW.",
      "Seguimiento continuo: la instalación rinde o te decimos por qué no.",
    ],
  },
];

export default function SectorsPage() {
  return (
    <div className="pb-20">
      <section className="pt-14">
        <Container>
          <SectionHeading kicker="Sectores" title="Conocemos cada sector de Binéfar y comarca.">
            Viviendas, granjas, comercios y naves no consumen igual. Por eso cada solución
            empieza por entender cómo trabajas tú.
          </SectionHeading>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {sectors.map((sector) => (
              <div
                key={sector.name}
                className="card rounded-2xl p-5 transition duration-200 hover:-translate-y-1 hover:shadow-soft"
              >
                <div className="text-sm uppercase tracking-[0.14em] text-rose-700">
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
            title="Lo que cambia según tu caso"
          >
            Mismo rigor, distinta receta: lo que le funciona a una granja no es lo que
            necesita un comercio. Esto es lo que solemos hacer en cada sector.
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
