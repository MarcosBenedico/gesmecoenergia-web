import { BulletList } from "@/components/bullet-list";
import { Container } from "@/components/container";
import { PhotoBanner } from "@/components/photo-banner";
import { FeatureCard } from "@/components/feature-card";
import { SectionHeading } from "@/components/section-heading";
import { StatCard } from "@/components/stat-card";
import { services } from "@/lib/data";
import Link from "next/link";

export const metadata = {
  title: "Servicios | Gesmeco Energía",
  description:
    "Análisis de facturas de luz y gas, auditorías energéticas, solar fotovoltaica y asesoramiento continuo en Binéfar y comarca.",
};

export default function ServicesPage() {
  return (
    <div className="pb-20">
      <section className="pt-10">
        <Container>
          <PhotoBanner
            src="/images/asesoria.webp"
            alt="Asesor revisando una factura de luz con un cliente en la oficina"
            kicker="Servicios"
            title="Nos sentamos contigo y repasamos tu factura línea a línea."
            size="md"
            priority
          />
        </Container>
      </section>

      <section className="pt-14">
        <Container>
          <SectionHeading
            kicker="Servicios"
            title="Reduce tu factura de luz. Aquí está el cómo."
          >
            Análisis de factura, auditorías, solar fotovoltaica y seguimiento continuo.
            Soluciones adaptadas a tu situación, sin sorpresas.
          </SectionHeading>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {services.map((service, index) => (
              <FeatureCard
                key={service.title}
                title={service.title}
                description={service.summary}
                badge={`Paso ${index + 1}`}
              >
                <BulletList items={service.items} />
              </FeatureCard>
            ))}
          </div>
        </Container>
      </section>

      <section className="mt-16">
        <Container className="card rounded-3xl p-10 shadow-soft">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                Proceso transparente
              </div>
              <h3 className="text-2xl font-semibold text-foreground">
                Desde análisis hasta instalación, sin letra pequeña.
              </h3>
              <p className="text-sm text-muted">
                Analizamos tu caso, diseñamos la solución perfecta, coordinamos la obra y
                acompañamos el mantenimiento.
              </p>
            </div>
            <div className="space-y-3 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/10 border border-accent/30 p-5 text-sm text-foreground">
              <div className="font-semibold uppercase tracking-[0.14em] text-accent">
                ✨ Ahorro comprobado
              </div>
              <p className="text-foreground">
                Ahorros reales del 15-40% en factura. ROI en 2-3 años con solar.
                Presupuestos detallados sin compromiso.
              </p>
              <p className="font-semibold text-accent-light">Factura · Auditoría · Solar · Seguimiento</p>
            </div>
            <div className="space-y-3 rounded-2xl border border-border bg-surface/50 p-5 text-sm text-foreground">
              <div className="font-semibold uppercase tracking-widest text-secondary">🚀 Empieza ahora</div>
              <p className="text-foreground">
                Analiza tu factura en 2 minutos. Descubre tu potencial de ahorro sin
                compromiso. Respuesta en 48h.
              </p>
              <Link href="/analizador" className="font-semibold text-secondary hover:text-secondary/80 transition">
                Herramienta gratuita →
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
