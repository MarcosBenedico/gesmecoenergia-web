import { BulletList } from "@/components/bullet-list";
import { Container } from "@/components/container";
import { FeatureCard } from "@/components/feature-card";
import { SectionHeading } from "@/components/section-heading";
import { StatCard } from "@/components/stat-card";
import { services } from "@/lib/data";
import Link from "next/link";

export const metadata = {
  title: "Servicios | Gesmeco Energía",
  description:
    "Asesoramiento energético, auditorías, análisis de facturas, solar fotovoltaica, CAES y soluciones de ahorro energético.",
};

export default function ServicesPage() {
  return (
    <div className="pb-20">
      <section className="pt-14">
        <Container>
          <SectionHeading
            kicker="Servicios"
            title="Reduce tu factura de luz. Aquí está el cómo."
          >
            Asesoramiento, auditorías, análisis de consumos, solar y almacenamiento.
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
            <div className="space-y-3 rounded-2xl bg-rose-50 p-5 text-sm text-foreground">
              <div className="font-semibold uppercase tracking-[0.14em] text-rose-800">
                Ahorro comprobado
              </div>
              <p>
                Reducción típica de 10-30% en factura. ROI en 1-3 años con solar.
                Presupuestos detallados sin compromisos.
              </p>
              <p className="font-semibold text-accent">Auditoría · Solar · Almacenamiento · Eficiencia</p>
            </div>
            <div className="space-y-3 rounded-2xl border border-rose-100 p-5 text-sm text-muted">
              <div className="font-semibold text-foreground">Empieza ahora</div>
              <p>
                Analiza tu factura en 5 minutos. Descubre tu potencial de ahorro sin
                compromiso. Respuesta en 48h.
              </p>
              <Link href="/analizador" className="font-semibold text-accent hover:underline">
                Herramienta gratuita →
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
