import Link from "next/link";
import { Container } from "@/components/container";
import { FeatureCard } from "@/components/feature-card";
import { ScrollReveal } from "@/components/scroll-reveal";
import { SectionHeading } from "@/components/section-heading";
import { StatCard } from "@/components/stat-card";
import { highlights, teamValues } from "@/lib/data";
import { siteConfig } from "@/lib/site";

export const metadata = {
  title: "Sobre nosotros | Gesmeco Energía",
  description:
    "Somos el equipo del Grupo Gesmeco en Binéfar: asesoría energética honesta, gestión fiscal-laboral y seguros. Conócenos.",
};

export default function AboutPage() {
  return (
    <div className="pb-20">
      <section className="pt-14">
        <Container className="grid items-center gap-10 md:grid-cols-[1.05fr_0.95fr]">
          {/* Esta primera pantalla ya se ve al abrir, así que entra con la
              animación de CSS (`.entra`) y no con el observador de scroll:
              revelar lo que ya está en pantalla deja la página en blanco medio
              segundo. Las clases de tamaño del h1 se han quitado porque no
              pintaban nada: en la web pública el tamaño lo fija
              `.web-publica h1` en globals.css. */}
          <div className="space-y-4">
            <span className="entra pill inline-flex w-fit items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              Sobre Gesmeco Energía
            </span>
            <h1 className="entra text-foreground" style={{ '--d': '80ms' } as React.CSSProperties}>
              De Binéfar, para Binéfar y comarca.
            </h1>
            <p className="entra text-lg text-muted" style={{ '--d': '180ms' } as React.CSSProperties}>
              Somos tu asesor energético de confianza: analizamos facturas, auditamos
              instalaciones y montamos solar que se amortiza de verdad. Y como parte del
              Grupo Gesmeco, también te resolvemos los papeles y los seguros.
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {[
                { value: '4.5 GW', label: 'Cartera energética' },
                { value: '15+', label: 'Proyectos solares activos' },
                { value: '3', label: 'Áreas del grupo' },
              ].map((s, i) => (
                <div key={s.label} className="entra" style={{ '--d': `${260 + i * 90}ms` } as React.CSSProperties}>
                  <StatCard className="h-full" value={s.value} label={s.label} />
                </div>
              ))}
            </div>
          </div>
          <div className="card foco entra-dcha rounded-3xl p-8 shadow-soft" style={{ '--d': '220ms' } as React.CSSProperties}>
            <h3 className="text-xl font-semibold text-foreground">Cómo trabajamos</h3>
            <p className="mt-2 text-sm text-muted">
              Un asesor lleva tu caso de principio a fin. Nos llamas y te atiende una
              persona que conoce tu factura, tu instalación y tu nombre.
            </p>
            <div className="mt-4 space-y-3 text-sm text-muted">
              <div className="flex gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-accent" />
                <span>Análisis de tu factura línea a línea, sin coste.</span>
              </div>
              <div className="flex gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-accent" />
                <span>Visita a tu casa, granja o negocio antes de proponerte nada.</span>
              </div>
              <div className="flex gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-accent" />
                <span>Seguimiento después de instalar: no desaparecemos al cobrar.</span>
              </div>
            </div>
            {/* Era un recuadro `bg-rose-50` (rosa palo, tema claro) suelto
                dentro de una tarjeta oscura: la única isla de otro diseño en
                toda la web. Ahora es del sitio, y es la frase que mejor resume
                la casa, así que se le da el sitio que merece. */}
            <div className="relative mt-6 overflow-hidden rounded-2xl border border-accent/25 bg-accent/[0.07] p-5">
              <div className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-accent to-secondary" />
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                Propósito
              </div>
              <p className="mt-1.5 text-base font-semibold text-foreground">
                Que en Binéfar nadie pague de más por la luz, los papeles o los seguros.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* ── EL GRUPO ── */}
      <section className="mt-16">
        <Container>
          <ScrollReveal>
            <SectionHeading kicker="El grupo" title="Gesmeco Energía es parte de algo más grande.">
              El Grupo Gesmeco reúne tres áreas de servicio con un mismo equipo y una misma
              forma de trabajar: energía, asesoría fiscal-laboral y seguros.
            </SectionHeading>
          </ScrollReveal>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                icono: "⚡",
                nombre: "Gesmeco Energía",
                texto: "Factura, auditorías y solar. Es donde estás ahora.",
                clase: "border-accent/30 bg-accent/5",
              },
              {
                icono: "📋",
                nombre: "Asesoría Gesmeco",
                texto: "Fiscal, laboral, contable y trámites administrativos.",
                clase: "border-tertiary/30 bg-tertiary/5",
              },
              {
                icono: "🛡️",
                nombre: "Correbin Asociados",
                texto: "Correduría de seguros: hogar, empresa y sector agrario.",
                clase: "border-secondary/30 bg-secondary/5",
              },
            ].map((e, i) => (
              <ScrollReveal key={e.nombre} delay={i * 90} direction="blur">
                <div className={`foco group h-full rounded-2xl border p-5 transition-transform duration-300 hover:-translate-y-1 ${e.clase}`}>
                  <div className="relative text-2xl transition-transform duration-500 group-hover:scale-110">{e.icono}</div>
                  <div className="relative mt-2 font-bold text-foreground">{e.nombre}</div>
                  <p className="relative mt-1 text-sm text-muted">{e.texto}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
          <div className="mt-6 text-right text-sm">
            <Link href="/grupo" className="enlace-vivo font-semibold text-accent">
              Conocer el Grupo Gesmeco →
            </Link>
          </div>
        </Container>
      </section>

      <section className="mt-16">
        <Container>
          <ScrollReveal>
            <SectionHeading kicker="Valores" title="Lo que nos define." />
          </ScrollReveal>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {teamValues.map((value, i) => (
              <ScrollReveal key={value.title} delay={i * 90}>
                <FeatureCard className="h-full" title={value.title}>
                  <p className="text-sm text-muted">{value.detail}</p>
                </FeatureCard>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="mt-14">
        <Container>
          <ScrollReveal>
            <SectionHeading kicker="Resultados" title="Casos reales, números reales." />
          </ScrollReveal>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {highlights.map((block, i) => (
              <ScrollReveal key={block.title} delay={(i % 2) * 90} direction={i % 2 === 0 ? "left" : "right"}>
                <FeatureCard className="h-full" title={block.title}>
                  <ul className="space-y-2 text-sm text-muted">
                    {block.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </FeatureCard>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="mt-14">
        <Container className="rounded-3xl bg-neutral-900 px-8 py-10 text-white shadow-soft">
          <ScrollReveal direction="scale">
          <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-light">
                Compromiso
              </div>
              <h3 className="mt-2 text-3xl font-semibold">
                Te decimos la verdad, aunque no nos convenga.
              </h3>
              <p className="mt-3 text-sm text-gray-200">
                Si tu tarifa está bien, te lo decimos. Si la instalación no sale a cuenta,
                no la vendemos. Así llevamos años y así seguiremos.
              </p>
            </div>
            <div className="foco rounded-2xl border border-white/20 bg-white/5 p-5 text-sm text-gray-200">
              <div className="relative text-xs font-semibold uppercase tracking-[0.14em] text-accent-light">
                Contacto directo
              </div>
              <p className="relative mt-2 text-white">
                <a href={`mailto:${siteConfig.contact.email}`} className="enlace-vivo">
                  {siteConfig.contact.email}
                </a>
              </p>
              <p className="relative mt-1 text-gray-300">{siteConfig.contact.address}</p>
              <Link
                href="/contacto"
                className="enlace-vivo relative mt-3 inline-block font-semibold text-white"
              >
                Hablar con un asesor →
              </Link>
            </div>
          </div>
          </ScrollReveal>
        </Container>
      </section>
    </div>
  );
}
