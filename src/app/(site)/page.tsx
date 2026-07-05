import Link from "next/link";
import { Button } from "@/components/button";
import { BulletList } from "@/components/bullet-list";
import { Container } from "@/components/container";
import { FeatureCard } from "@/components/feature-card";
import { SectionHeading } from "@/components/section-heading";
import { HeroSection } from "@/components/hero-section";
import { ScrollReveal } from "@/components/scroll-reveal";
import { Background3D } from "@/components/background-3d";
import { Card3D } from "@/components/card-3d";
import {
  methodology,
  sectors,
  services,
  valuePillars,
} from "@/lib/data";

export default function HomePage() {
  return (
    <div className="pb-20 relative">
      <Background3D />

      {/* ── HERO ── */}
      <div className="relative z-10">
        <HeroSection />
      </div>

      {/* ── LO QUE NOS DIFERENCIA ── */}
      <section className="py-20 relative z-10">
        <Container>
          <ScrollReveal>
            <SectionHeading
              kicker="Lo que nos diferencia"
              title="Un asesor que entiende tu realidad. No solo números."
            >
              Conocemos Binéfar, el sector ganadero, agrícola y comercial. Analizamos tu factura línea
              a línea, visitamos tu instalación y recomendamos solo lo que vale la pena.
            </SectionHeading>
          </ScrollReveal>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {valuePillars.map((pillar, i) => (
              <ScrollReveal key={pillar.title} delay={i * 120}>
                <Card3D glowColor={['#6366f1', '#06b6d4', '#8b5cf6'][i % 3]} className="!p-6">
                  <h3 className="text-lg font-bold text-foreground mb-2">{pillar.title}</h3>
                  <p className="text-sm text-muted">{pillar.description}</p>
                </Card3D>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </section>

      {/* ── QUÉ HACEMOS ── */}
      <section className="py-4 relative z-10">
        <Container>
          <ScrollReveal>
            <SectionHeading
              kicker="Qué hacemos"
              title="Análisis honesto, asesor disponible, soluciones que funcionan."
            >
              Desde revisar tu factura hasta instalar placas solares en tu tejado o en tu granja.
              Te acompañamos en cada paso, sin presión, sin sorpresas.
            </SectionHeading>
          </ScrollReveal>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {services.slice(0, 4).map((service, i) => (
              <ScrollReveal key={service.title} delay={i * 100}>
                <Card3D glowColor={['#06b6d4', '#8b5cf6', '#6366f1', '#ec4899'][i % 4]} className="!p-6">
                  <h3 className="text-lg font-bold text-foreground mb-3">{service.title}</h3>
                  <p className="text-sm text-muted mb-3">{service.summary}</p>
                  <BulletList items={service.items} />
                </Card3D>
              </ScrollReveal>
            ))}
          </div>
          <div className="mt-6 text-right text-sm relative z-10">
            <Link href="/servicios" className="font-semibold text-accent hover:text-accent/80 transition">
              Ver detalle de servicios →
            </Link>
          </div>
        </Container>
      </section>

      {/* ── SECTORES ── */}
      <section className="py-20 relative z-10">
        <Container>
          <ScrollReveal>
            <SectionHeading kicker="Sectores" title="Trabajamos en todos los sectores de Binéfar.">
              Viviendas, ganadería, agricultura, comercios, empresas. Cada caso es diferente.
              Por eso no hay soluciones estándar, sino soluciones a medida.
            </SectionHeading>
          </ScrollReveal>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {sectors.map((sector, i) => (
              <ScrollReveal key={sector.name} delay={i * 80}>
                <Card3D glowColor={['#06b6d4', '#8b5cf6', '#6366f1'][i % 3]} className="!p-5">
                  <div className="text-sm font-bold uppercase tracking-[0.16em] text-accent">
                    {sector.name}
                  </div>
                  <p className="mt-2 text-sm text-muted">{sector.description}</p>
                </Card3D>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </section>

      {/* ── CÓMO TRABAJAMOS ── */}
      <section className="py-4 relative z-10">
        <Container>
          <ScrollReveal>
            <SectionHeading kicker="Cómo trabajamos" title="Pasos claros, sin complicaciones.">
              Desde la primera llamada hasta el seguimiento después de instalar solar.
              Transparencia total en cada fase.
            </SectionHeading>
          </ScrollReveal>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {methodology.map((step, index) => (
              <ScrollReveal key={step.title} delay={index * 100}>
                <Card3D glowColor={['#06b6d4', '#8b5cf6', '#ec4899', '#6366f1'][index % 4]} className="!p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-sm font-black text-accent border border-accent/30">
                      {index + 1}
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                      Fase {index + 1}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted mt-2">{step.detail}</p>
                </Card3D>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </section>

      {/* ── CTA ── */}
      <section className="mt-16 px-4 relative z-10">
        <ScrollReveal>
          <Container>
            <div className="cta-bg relative overflow-hidden rounded-3xl px-8 py-14 text-white shadow-[0_0_80px_rgba(255,51,51,0.2)]">
              {/* Corner decorations */}
              <div className="absolute left-0 top-0 h-px w-48 bg-gradient-to-r from-accent to-transparent" />
              <div className="absolute left-0 top-0 h-48 w-px bg-gradient-to-b from-accent to-transparent" />
              <div className="absolute bottom-0 right-0 h-px w-48 bg-gradient-to-l from-secondary to-transparent" />
              <div className="absolute bottom-0 right-0 h-48 w-px bg-gradient-to-t from-secondary to-transparent" />

              <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
                <div className="space-y-3 max-w-xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                    <span className="text-xs font-bold uppercase tracking-widest text-accent">Empieza ahora</span>
                  </div>
                  <h3 className="text-3xl font-black leading-tight">
                    Descubre tu potencial de ahorro sin compromiso.
                  </h3>
                  <p className="text-base text-gray-300">
                    Análisis completo de tu factura, consumos y opciones de solar.
                    Diagnóstico personalizado, honesto y gratuito.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 shrink-0">
                  <Link
                    href="/analizador"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-4 text-base font-black text-[#0f0f1e] shadow-lg transition-all hover:scale-[1.04] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                  >
                    📊 Analizar ahora
                  </Link>
                  <Link
                    href="/contacto"
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-white/40 bg-white/10 px-7 py-4 text-base font-bold text-white backdrop-blur-sm transition-all hover:border-white/70 hover:bg-white/20"
                  >
                    📞 Hablar con asesor
                  </Link>
                </div>
              </div>
            </div>
          </Container>
        </ScrollReveal>
      </section>
    </div>
  );
}
