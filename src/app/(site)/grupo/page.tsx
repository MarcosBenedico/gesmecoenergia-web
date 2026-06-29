import { Container } from "@/components/container";
import { SolutionsSelector } from "@/components/solutions-selector";
import { ScrollReveal } from "@/components/scroll-reveal";

export const metadata = {
  title: "Grupo Gesmeco | Soluciones Integrales",
  description:
    "Energía, Asesoría Fiscal y Laboral, Seguros: soluciones integrales para tu negocio en Binéfar.",
};

export default function GroupPage() {
  return (
    <div className="pb-20">
      {/* ── HEADER ── */}
      <section className="relative overflow-hidden py-16 md:py-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-red-500/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl" />
        </div>

        <Container>
          <ScrollReveal>
            <div className="space-y-6 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-4 py-2 backdrop-blur-sm mx-auto">
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                <span className="text-sm font-bold uppercase tracking-widest text-accent">
                  Grupo Empresarial
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-foreground leading-tight">
                Soluciones integrales <br />
                para tu negocio
              </h1>

              <p className="max-w-2xl mx-auto text-base md:text-lg text-muted leading-relaxed">
                Energía inteligente, asesoría fiscal y laboral, gestión de seguros. Un ecosistema completo de
                servicios profesionales en Binéfar.
              </p>
            </div>
          </ScrollReveal>
        </Container>
      </section>

      {/* ── SOLUTIONS SELECTOR ── */}
      <section>
        <SolutionsSelector />
      </section>

      {/* ── VALUES ── */}
      <section className="py-20 border-t border-border/30">
        <Container>
          <ScrollReveal>
            <div className="space-y-6 text-center mb-12">
              <h2 className="text-3xl font-black text-foreground md:text-4xl">
                Nuestros valores
              </h2>
              <p className="max-w-2xl mx-auto text-base text-muted">
                Trabajamos con rigor, transparencia y disponibilidad. Nuestro objetivo es ayudarte a tener todas tus
                obligaciones, riesgos y gestiones correctamente organizadas.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: "✓",
                title: "Honestidad técnica",
                desc: "No vendemos lo que no necesitas. Cada recomendación está justificada.",
              },
              {
                icon: "✓",
                title: "Disponibilidad local",
                desc: "Estamos en Binéfar. Llamadas, visitas, atención personalizada.",
              },
              {
                icon: "✓",
                title: "Transparencia total",
                desc: "Sin sorpresas. Presupuestos claros, costes explícitos, condiciones conocidas.",
              },
            ].map((val, i) => (
              <ScrollReveal key={val.title} delay={i * 100}>
                <div className="rounded-2xl border border-border/40 bg-surface/60 p-6 backdrop-blur-sm">
                  <div className="text-3xl font-black text-accent mb-3">{val.icon}</div>
                  <h3 className="text-lg font-bold text-foreground mb-2">{val.title}</h3>
                  <p className="text-sm text-muted">{val.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 px-4">
        <ScrollReveal>
          <Container>
            <div className="cta-bg relative overflow-hidden rounded-3xl px-8 py-14 text-white shadow-[0_0_80px_rgba(255,51,51,0.2)]">
              <div className="absolute left-0 top-0 h-px w-48 bg-gradient-to-r from-accent to-transparent" />
              <div className="absolute left-0 top-0 h-48 w-px bg-gradient-to-b from-accent to-transparent" />

              <div className="relative space-y-4 text-center max-w-2xl mx-auto">
                <h3 className="text-3xl font-black">
                  ¿Necesitas asesoramiento integral?
                </h3>
                <p className="text-base text-gray-200">
                  Sea en energía, fiscal-laboral o seguros, nuestro equipo está disponible para ayudarte. Sin
                  compromisos, sin presión.
                </p>
                <div className="pt-4 flex flex-wrap gap-3 justify-center">
                  <a
                    href="/contacto"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-4 text-base font-black text-[#0f0f1e] shadow-lg transition-all hover:scale-[1.04] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                  >
                    📞 Contactar
                  </a>
                </div>
              </div>
            </div>
          </Container>
        </ScrollReveal>
      </section>
    </div>
  );
}
