import { Container } from "@/components/container";
import { FeatureCard } from "@/components/feature-card";
import { PhotoBanner } from "@/components/photo-banner";
import { ScrollReveal } from "@/components/scroll-reveal";
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
      <section className="pt-10">
        <Container>
          <PhotoBanner
            src="/images/granja-solar.webp"
            alt="Nave agrícola con placas solares entre campos de cereal en Aragón"
            kicker="Sectores"
            title="Del tejado de tu casa a la cubierta de tu nave."
            size="md"
            priority
          />
        </Container>
      </section>

      <section className="pt-14">
        <Container>
          <ScrollReveal>
            <SectionHeading kicker="Sectores" title="Conocemos cada sector de Binéfar y comarca.">
              Viviendas, granjas, comercios y naves no consumen igual. Por eso cada solución
              empieza por entender cómo trabajas tú.
            </SectionHeading>
          </ScrollReveal>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {sectors.map((sector, i) => (
              <ScrollReveal key={sector.name} delay={i * 70} direction="blur">
                <div className="card foco h-full rounded-2xl p-5">
                  {/* El nombre del sector iba en `text-rose-700`: 2,4:1 sobre la
                      tarjeta oscura, o sea el rótulo más importante de la
                      tarjeta era el menos legible. */}
                  <div className="relative text-sm font-semibold uppercase tracking-[0.14em] text-accent-light">
                    {sector.name}
                  </div>
                  <p className="relative mt-2 text-sm text-muted">{sector.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="mt-14">
        <Container>
          <ScrollReveal>
            <SectionHeading
              kicker="Soluciones"
              title="Lo que cambia según tu caso"
            >
              Mismo rigor, distinta receta: lo que le funciona a una granja no es lo que
              necesita un comercio. Esto es lo que solemos hacer en cada sector.
            </SectionHeading>
          </ScrollReveal>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {sectorDetails.map((item, i) => (
              <ScrollReveal
                key={item.title}
                delay={(i % 2) * 90}
                direction={i % 2 === 0 ? "left" : "right"}
              >
                <FeatureCard className="h-full" title={item.title}>
                  <ul className="space-y-2 text-sm text-muted">
                    {item.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-2">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </FeatureCard>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </section>
    </div>
  );
}
