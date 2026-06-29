'use client';

import { asesoriaServices, segurosServices } from '@/lib/data';
import { ScrollReveal } from './scroll-reveal';
import { SectionHeading } from './section-heading';

interface ServiceCardProps {
  title: string;
  icon: string;
  color: string;
  colorBg: string;
  colorBorder: string;
  summary: string;
  items: string[];
  delay: number;
}

function ServiceCard({
  title,
  icon,
  color,
  colorBg,
  colorBorder,
  summary,
  items,
  delay,
}: ServiceCardProps) {
  return (
    <ScrollReveal delay={delay}>
      <div
        className={`group relative overflow-hidden rounded-2xl border ${colorBorder} ${colorBg} p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-lg`}
      >
        {/* Animated top accent */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${color} scale-x-0 transition-transform group-hover:scale-x-100`} />

        {/* Icon + Title */}
        <div className="mb-4">
          <div className="text-3xl mb-2">{icon}</div>
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted">{summary}</p>
        </div>

        {/* Items list */}
        <ul className="space-y-2 text-sm">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-muted group/item">
              <span className={`mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0 bg-gradient-to-br ${color}`} />
              <span className="group-hover/item:text-foreground transition-colors">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </ScrollReveal>
  );
}

export function BusinessUnits() {
  return (
    <div className="space-y-24 py-20">
      {/* ════════════════════════════════════
          GESMECO ASESORÍA
      ════════════════════════════════════ */}
      <section>
        <div className="mx-auto max-w-7xl px-6">
          <ScrollReveal>
            <div className="mb-12 space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-purple-400">GESMECO ASESORÍA</span>
              </div>
              <h2 className="text-3xl font-black text-foreground md:text-4xl">
                Asesoría Fiscal, Laboral y Contable
              </h2>
              <p className="max-w-2xl text-lg text-muted">
                Gestión integral de obligaciones fiscales, contables, laborales y administrativas para autónomos,
                empresas y particulares. Nos encargamos para que tú puedas enfocarte en tu negocio.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid gap-5 md:grid-cols-2">
            {asesoriaServices.map((service, i) => (
              <ServiceCard
                key={service.title}
                {...service}
                delay={i * 120}
              />
            ))}
          </div>

          <ScrollReveal delay={400} className="mt-8">
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-6 backdrop-blur-sm">
              <p className="text-sm text-muted">
                <span className="font-bold text-purple-400">Gesmeco Asesoría</span> es tu despacho de apoyo para la
                gestión diaria. Desde declaraciones fiscales hasta trámites laborales, te acompañamos con rigor y
                transparencia.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ════════════════════════════════════
          CORREBIN SEGUROS
      ════════════════════════════════════ */}
      <section>
        <div className="mx-auto max-w-7xl px-6">
          <ScrollReveal>
            <div className="mb-12 space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">CORREBIN SEGUROS</span>
              </div>
              <h2 className="text-3xl font-black text-foreground md:text-4xl">
                Seguros y Gestión de Riesgos
              </h2>
              <p className="max-w-2xl text-lg text-muted">
                Asesoramiento experto en seguros para particulares, negocios, autónomos y sector agrario. Revisamos
                tus coberturas, detectamos riesgos descubiertos y optimizamos tus pólizas.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid gap-5 md:grid-cols-2">
            {segurosServices.map((service, i) => (
              <ServiceCard
                key={service.title}
                {...service}
                delay={i * 120}
              />
            ))}
          </div>

          <ScrollReveal delay={400} className="mt-8">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 backdrop-blur-sm">
              <p className="text-sm text-muted">
                <span className="font-bold text-emerald-400">Correbin Asociados</span> analiza tus necesidades reales
                de cobertura y te recomienda las pólizas más competitivas. Tu tranquilidad es nuestra prioridad.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ════════════════════════════════════
          RESUMEN DEL GRUPO
      ════════════════════════════════════ */}
      <section className="relative overflow-hidden rounded-3xl border border-border/30 bg-gradient-to-br from-surface to-card/50 p-8 md:p-12">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 h-px w-64 bg-gradient-to-r from-accent to-transparent" />
          <div className="absolute bottom-0 right-0 h-px w-64 bg-gradient-to-l from-secondary to-transparent" />
        </div>

        <div className="relative space-y-6">
          <ScrollReveal>
            <h3 className="text-2xl font-black text-foreground md:text-3xl">
              Gesmeco & Correbin: Soluciones integrales
            </h3>
          </ScrollReveal>

          <ScrollReveal delay={100} className="space-y-4">
            <p className="text-base text-muted leading-relaxed max-w-2xl">
              Somos un grupo empresarial enfocado en ofrecer soluciones completas para particulares, autónomos y
              empresas de la zona de Binéfar.
            </p>

            <div className="grid gap-6 md:grid-cols-3 mt-6">
              {[
                {
                  label: "Energía Inteligente",
                  desc: "Asesoría energética, auditorías, solar FV",
                  icon: "⚡",
                },
                {
                  label: "Asesoría Integral",
                  desc: "Fiscal, laboral, contable, administrativa",
                  icon: "📋",
                },
                {
                  label: "Gestión de Riesgos",
                  desc: "Seguros personales, empresariales, agrarios",
                  icon: "🛡️",
                },
              ].map((item, i) => (
                <ScrollReveal key={item.label} delay={200 + i * 100}>
                  <div className="rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur-sm">
                    <div className="text-2xl mb-2">{item.icon}</div>
                    <h4 className="font-bold text-foreground text-sm mb-1">{item.label}</h4>
                    <p className="text-xs text-muted">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={500} className="pt-4">
            <p className="text-sm text-muted italic">
              Somos un despacho de apoyo que acompaña a nuestros clientes en la gestión diaria: obligaciones,
              documentación, riesgos y asesoramiento técnico. Transparencia, rigor y disponibilidad son nuestros
              compromisos.
            </p>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
