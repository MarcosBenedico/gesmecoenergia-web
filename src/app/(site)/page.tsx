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
      <section className="relative pt-20 overflow-hidden">
        {/* Glow effects */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-red-500/10 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -z-10" />

        <Container className="grid items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-8 animate-slideDown">
            <div className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              <span className="text-sm font-bold uppercase tracking-widest text-accent">
                Energía inteligente
              </span>
            </div>

            <div className="space-y-5">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-black leading-tight">
                <span className="bg-gradient-to-r from-accent via-accent-light to-secondary bg-clip-text text-transparent">
                  Tu asesor energético
                </span>
                <br />
                <span className="text-foreground">en Bienfar.</span>
              </h1>
              <p className="text-lg md:text-xl text-muted leading-relaxed max-w-lg">
                Analizamos tu factura de luz y gas. Te recomendamos solar si sale a cuenta. Ahorros reales de 15-40% en empresas y hogares.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-wrap">
              <Button href="/analizador" size="lg" className="bg-gradient-to-r from-accent to-accent-light text-white font-bold text-base px-8 py-4 rounded-xl shadow-glow hover:shadow-glow">
                🚀 Analizar mi factura
              </Button>
              <Button href="/servicios" variant="ghost" size="lg" className="border-2 border-muted text-foreground hover:border-accent hover:text-accent">
                Ver servicios →
              </Button>
              <div className="text-sm font-semibold text-muted">
                <span className="text-accent">✓ 100% gratis</span> · Sin compromiso
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 pt-6">
              {heroStats.map((stat, idx) => (
                <div key={stat.label} className="group" style={{animationDelay: `${idx * 0.1}s`}}>
                  <StatCard
                    label={stat.label}
                    value={stat.value}
                    detail={stat.detail}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="relative animate-float">
            {/* Glow background */}
            <div className="absolute inset-0 bg-gradient-to-r from-accent/20 to-secondary/20 rounded-3xl blur-2xl" />

            <div className="card glass relative overflow-hidden rounded-3xl p-8 md:p-10 border-accent/30">
              {/* Animated gradient border */}
              <div className="absolute inset-0 rounded-3xl p-[1px] bg-gradient-to-r from-accent via-secondary to-accent opacity-30" />

              <div className="relative space-y-8">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-accent mb-2">
                    ⚡ Panel de control
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black text-foreground">
                    Coste total, riesgo y sostenibilidad en una sola vista.
                  </h3>
                </div>

                <BulletList items={differentiators} />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-gradient-to-br from-accent/20 to-accent/10 border border-accent/30 px-4 py-4 text-sm font-bold text-accent hover:border-accent/60 group cursor-pointer">
                    <div className="text-xs uppercase tracking-widest text-accent/70 mb-1">
                      📊 Indicadores vivos
                    </div>
                    Coste/MWh · CO₂ evitado · ROI real
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-secondary/20 to-secondary/10 border border-secondary/30 px-4 py-4 text-sm text-muted hover:border-secondary/60 group cursor-pointer">
                    <div className="text-xs uppercase tracking-widest text-secondary/70 mb-1">
                      🚨 Alertas inteligentes
                    </div>
                    Desvío de potencia y consumo en tiempo real
                  </div>
                </div>

                <div className="rounded-xl bg-gradient-to-r from-accent/10 to-secondary/10 border border-accent/30 px-6 py-4 flex items-center justify-between hover:border-accent/60 group">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-accent font-bold mb-1">
                      ⏱️ SLA garantizado
                    </div>
                    <span className="text-foreground font-semibold">Respuesta en &lt; 5 min ante alarmas críticas</span>
                  </div>
                  <div className="rounded-full bg-gradient-to-r from-accent to-accent-light px-3 py-2 text-xs font-bold uppercase text-white whitespace-nowrap ml-4">
                    24/7
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section>
        <Container>
          <SectionHeading
            kicker="Lo que nos diferencia"
            title="Un asesor que entiende tu realidad. No solo números."
          >
            Conocemos Bienfar, el sector ganadero, agrícola y comercial. Analizamos tu factura línea
            a línea, visitamos tu instalación y recomendamos solo lo que vale la pena.
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
            kicker="Qué hacemos"
            title="Análisis honesto, asesor disponible, soluciones que funcionan."
          >
            Desde revisar tu factura hasta instalar placas solares en tu tejado o en tu granja.
            Te acompañamos en cada paso, sin presión, sin sorpresas.
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
          <SectionHeading kicker="Sectores" title="Trabajamos en todos los sectores de Bienfar.">
            Viviendas, ganadería, agricultura, comercios, empresas. Cada caso es diferente.
            Por eso no hay soluciones estándar, sino soluciones a medida.
          </SectionHeading>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {sectors.map((sector) => (
              <div
                key={sector.name}
                className="card rounded-2xl p-5 transition duration-200 hover:-translate-y-1 hover:shadow-soft"
              >
                <div className="text-sm uppercase tracking-[0.16em] text-rose-700">
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
            kicker="Cómo trabajamos"
            title="Pasos claros, sin complicaciones."
          >
            Desde la primera llamada hasta el seguimiento después de instalar solar.
            Transparencia total en cada fase.
          </SectionHeading>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {methodology.map((step, index) => (
              <div
                key={step.title}
                className="card relative flex flex-col gap-3 rounded-2xl p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-sm font-semibold text-accent">
                    {index + 1}
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-800">
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
          <div className="absolute inset-0 bg-gradient-to-br from-rose-600/50 via-neutral-900 to-neutral-900" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-100">
                Empieza ahora
              </div>
              <h3 className="text-3xl font-semibold">
                Descubre tu potencial de ahorro sin compromiso.
              </h3>
              <p className="text-base text-gray-200">
                Análisis completo de tu factura, consumos y opciones de solar.
                En 5 minutos tienes un diagnóstico personalizado.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button href="/analizador" size="lg" className="bg-white text-neutral-900 hover:bg-rose-50">
                Analizar ahora
              </Button>
              <Button href="/contacto" variant="ghost" size="lg" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                Hablar con asesor
              </Button>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
