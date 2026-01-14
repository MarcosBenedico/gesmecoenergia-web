import { Container } from "@/components/container";
import { FeatureCard } from "@/components/feature-card";
import { SectionHeading } from "@/components/section-heading";
import { StatCard } from "@/components/stat-card";
import { highlights, teamValues } from "@/lib/data";
import { siteConfig } from "@/lib/site";

export const metadata = {
  title: "Sobre nosotros | Gesmeco Energía",
  description:
    "Equipo senior de estrategia, compras energéticas e ingeniería que acompaña a dirección financiera y operaciones.",
};

export default function AboutPage() {
  return (
    <div className="pb-20">
      <section className="pt-14">
        <Container className="grid items-center gap-10 md:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <span className="pill inline-flex w-fit items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              Sobre Gesmeco Energía
            </span>
            <h1 className="text-4xl font-semibold text-foreground md:text-5xl">
              Equipo senior, mirada financiera y rigor técnico.
            </h1>
            <p className="text-lg text-muted">
              Provenimos de compras energéticas, ingeniería y consultoría estratégica. Hablamos el
              lenguaje de dirección financiera y operaciones, con KPIs claros y trazables.
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <StatCard value="+15 años" label="Experiencia media" />
              <StatCard value="+200 GWh" label="Energía gestionada" />
              <StatCard value=">98%" label="Fidelidad de clientes" />
            </div>
          </div>
          <div className="card rounded-3xl p-8 shadow-soft">
            <h3 className="text-xl font-semibold text-foreground">Cómo trabajamos</h3>
            <p className="mt-2 text-sm text-muted">
              Un responsable único lidera tu cuenta y coordina compras, ingeniería y regulación.
              Transparencia y decisiones justificadas con datos.
            </p>
            <div className="mt-4 space-y-3 text-sm text-muted">
              <div className="flex gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-accent" />
                <span>Workshops de riesgo y estrategia con dirección.</span>
              </div>
              <div className="flex gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-accent" />
                <span>Informes ejecutivos mensuales y alertas en tiempo real.</span>
              </div>
              <div className="flex gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-accent" />
                <span>KPI compartidos: coste total, disponibilidad y CO₂ evitado.</span>
              </div>
            </div>
            <div className="mt-6 rounded-2xl bg-emerald-50 p-5 text-sm text-foreground">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">
                Propósito
              </div>
              Energía más competitiva, fiable y sostenible para nuestros clientes.
            </div>
          </div>
        </Container>
      </section>

      <section className="mt-16">
        <Container>
          <SectionHeading kicker="Valores" title="Lo que nos define." />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {teamValues.map((value) => (
              <FeatureCard key={value.title} title={value.title}>
                <p className="text-sm text-muted">{value.detail}</p>
              </FeatureCard>
            ))}
          </div>
        </Container>
      </section>

        <section className="mt-14">
          <Container>
            <SectionHeading kicker="Resultados" title="Indicadores y casos recientes." />
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {highlights.map((block) => (
                <FeatureCard key={block.title} title={block.title}>
                  <ul className="space-y-2 text-sm text-muted">
                    {block.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1 h-2 w-2 rounded-full bg-accent" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </FeatureCard>
              ))}
            </div>
          </Container>
        </section>

      <section className="mt-14">
        <Container className="rounded-3xl bg-neutral-900 px-8 py-10 text-white shadow-soft">
          <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
                Compromiso
              </div>
              <h3 className="mt-2 text-3xl font-semibold">
                Transparencia, rigor y entrega a tiempo.
              </h3>
              <p className="mt-3 text-sm text-gray-200">
                Cada proyecto tiene KPIs, responsables y calendarios de entrega. Reportamos avances
                y desviaciones en tiempo real.
              </p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/5 p-5 text-sm text-gray-200">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100">
                Contacto directo
              </div>
              <p className="mt-2">
                {siteConfig.contact.email} · {siteConfig.contact.phone}
              </p>
              <p className="mt-2">
                Agenda una sesión con un consultor senior para revisar tu situación actual y
                prioridades.
              </p>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
