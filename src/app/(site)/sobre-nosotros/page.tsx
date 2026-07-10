import Link from "next/link";
import { Container } from "@/components/container";
import { FeatureCard } from "@/components/feature-card";
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
          <div className="space-y-4">
            <span className="pill inline-flex w-fit items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              Sobre Gesmeco Energía
            </span>
            <h1 className="text-4xl font-semibold text-foreground md:text-5xl">
              De Binéfar, para Binéfar y comarca.
            </h1>
            <p className="text-lg text-muted">
              Somos tu asesor energético de confianza: analizamos facturas, auditamos
              instalaciones y montamos solar que se amortiza de verdad. Y como parte del
              Grupo Gesmeco, también te resolvemos los papeles y los seguros.
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <StatCard value="4.5 GW" label="Cartera energética" />
              <StatCard value="15+" label="Proyectos solares activos" />
              <StatCard value="3" label="Áreas del grupo" />
            </div>
          </div>
          <div className="card rounded-3xl p-8 shadow-soft">
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
            <div className="mt-6 rounded-2xl bg-rose-50 p-5 text-sm text-[#0f0f1e]">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-800">
                Propósito
              </div>
              Que en Binéfar nadie pague de más por la luz, los papeles o los seguros.
            </div>
          </div>
        </Container>
      </section>

      {/* ── EL GRUPO ── */}
      <section className="mt-16">
        <Container>
          <SectionHeading kicker="El grupo" title="Gesmeco Energía es parte de algo más grande.">
            El Grupo Gesmeco reúne tres áreas de servicio con un mismo equipo y una misma
            forma de trabajar: energía, asesoría fiscal-laboral y seguros.
          </SectionHeading>
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
            ].map((e) => (
              <div key={e.nombre} className={`rounded-2xl border p-5 ${e.clase}`}>
                <div className="text-2xl">{e.icono}</div>
                <div className="mt-2 font-bold text-foreground">{e.nombre}</div>
                <p className="mt-1 text-sm text-muted">{e.texto}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 text-right text-sm">
            <Link href="/grupo" className="font-semibold text-accent hover:underline">
              Conocer el Grupo Gesmeco →
            </Link>
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
          <SectionHeading kicker="Resultados" title="Casos reales, números reales." />
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
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-100">
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
            <div className="rounded-2xl border border-white/20 bg-white/5 p-5 text-sm text-gray-200">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-100">
                Contacto directo
              </div>
              <p className="mt-2">{siteConfig.contact.email}</p>
              <p className="mt-1">{siteConfig.contact.address}</p>
              <Link
                href="/contacto"
                className="mt-3 inline-block font-semibold text-white underline-offset-4 hover:underline"
              >
                Hablar con un asesor →
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
