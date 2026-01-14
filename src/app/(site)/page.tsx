import Link from "next/link";
import { Button } from "@/components/button";
import { BulletList } from "@/components/bullet-list";
import { Container } from "@/components/container";
import { FeatureCard } from "@/components/feature-card";
import { SectionHeading } from "@/components/section-heading";
import { StatCard } from "@/components/stat-card";
import {
  differentiators,
  heroStats,
  methodology,
  sectors,
  services,
  valuePillars,
} from "@/lib/data";
import { siteConfig } from "@/lib/site";

export default function HomePage() {
  return (
    <div className="space-y-20 pb-20">
      <section className="pt-14">
        <Container className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-7">
            <span className="pill inline-flex w-fit items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white gradient-hero shadow-soft">
              Gesmeco Energía
            </span>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
                Energía estratégica para empresas que no dejan nada al azar.
              </h1>
              <p className="text-lg text-muted md:text-xl">
                Integramos compras, PPAs, autoconsumo y eficiencia con reporting ejecutivo.
                Un equipo senior que responde con datos, gobernanza y ejecución impecable.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button href="/contacto" size="lg">
                {siteConfig.actions.primaryCta}
              </Button>
              <Button href="/servicios" variant="ghost" size="lg">
                Ver servicios
              </Button>
              <span className="text-sm font-semibold text-muted">
                Respuesta en <span className="text-foreground">24h</span>
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {heroStats.map((stat) => (
                <StatCard
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  detail={stat.detail}
                />
              ))}
            </div>
          </div>

          <div className="card glass relative overflow-hidden rounded-3xl p-8">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-white/40" />
            <div className="relative space-y-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  Panel de control
                </div>
                <h3 className="text-2xl font-semibold text-foreground">
                  Coste total, riesgo y sostenibilidad en una sola vista.
                </h3>
              </div>
              <BulletList items={differentiators} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-accent">
                  <div className="text-xs uppercase tracking-[0.18em] text-emerald-800">
                    Indicadores vivos
                  </div>
                  Coste/MWh · CO₂ evitado · ROI real
                </div>
                <div className="rounded-2xl border border-emerald-100 px-4 py-3 text-sm text-muted">
                  Alertas tempranas de desvío de potencia, consumo y calidad de energía.
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-neutral-900 px-4 py-3 text-sm text-white">
                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-emerald-100">
                    SLA
                  </div>
                  Respuesta operativa en <strong>&lt; 5 min</strong> ante alarmas críticas
                </div>
                <div className="rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                  24/7
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section>
        <Container>
          <SectionHeading
            kicker="Valor diferencial"
            title="Gobernanza, tecnología y ejecución con un solo interlocutor."
          >
            Un modelo pensado para dirección financiera, operaciones y ESG. Datos claros,
            contratos sólidos y proyectos que cumplen plazos y ROI.
          </SectionHeading>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {valuePillars.map((pillar) => (
              <FeatureCard key={pillar.title} title={pillar.title}>
                <p className="text-sm text-muted">{pillar.description}</p>
              </FeatureCard>
            ))}
          </div>
        </Container>
      </section>

      <section>
        <Container>
          <SectionHeading
            kicker="Servicios principales"
            title="Planificamos, ejecutamos y operamos todo tu ciclo energético."
          >
            Diseñamos estrategias para reducir riesgo, estabilizar costes y acelerar la
            descarbonización sin perder fiabilidad operativa.
          </SectionHeading>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {services.slice(0, 4).map((service) => (
              <FeatureCard key={service.title} title={service.title} description={service.summary}>
                <BulletList items={service.items} />
              </FeatureCard>
            ))}
          </div>
          <div className="mt-6 text-right text-sm">
            <Link href="/servicios" className="font-semibold text-accent hover:underline">
              Ver detalle de servicios →
            </Link>
          </div>
        </Container>
      </section>

      <section>
        <Container>
          <SectionHeading kicker="Sectores" title="Expertise probado en sectores críticos.">
            Adaptamos la estrategia a tu curva de carga, perfil de riesgo y objetivos de
            descarbonización.
          </SectionHeading>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {sectors.map((sector) => (
              <div
                key={sector.name}
                className="card rounded-2xl p-5 transition duration-200 hover:-translate-y-1 hover:shadow-soft"
              >
                <div className="text-sm uppercase tracking-[0.16em] text-emerald-700">
                  {sector.name}
                </div>
                <p className="mt-2 text-sm text-muted">{sector.description}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section>
        <Container>
          <SectionHeading
            kicker="Metodología"
            title="De la estrategia a la operación continua."
          >
            Roadmap claro, hitos medibles y reporting ejecutivo para cada fase.
          </SectionHeading>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {methodology.map((step, index) => (
              <div
                key={step.title}
                className="card relative flex flex-col gap-3 rounded-2xl p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-accent">
                    {index + 1}
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">
                    Fase {index + 1}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm text-muted">{step.detail}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section>
        <Container className="relative overflow-hidden rounded-3xl bg-neutral-900 px-8 py-12 text-white shadow-soft">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/50 via-neutral-900 to-neutral-900" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
                Próximo paso
              </div>
              <h3 className="text-3xl font-semibold">
                Recibe un diagnóstico ejecutivo en 5 días.
              </h3>
              <p className="text-base text-gray-200">
                Compartimos las tres palancas de ahorro prioritarias, riesgos y plan de
                descarbonización realista.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button href="/contacto" size="lg" className="bg-white text-neutral-900 hover:bg-emerald-50">
                Agenda con un consultor
              </Button>
              <Button href="/sobre-nosotros" variant="ghost" size="lg" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                Conocer al equipo
              </Button>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
