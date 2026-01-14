import { BulletList } from "@/components/bullet-list";
import { Container } from "@/components/container";
import { FeatureCard } from "@/components/feature-card";
import { SectionHeading } from "@/components/section-heading";
import { StatCard } from "@/components/stat-card";
import { services } from "@/lib/data";
import { siteConfig } from "@/lib/site";

export const metadata = {
  title: "Servicios | Gesmeco Energía",
  description:
    "Servicios premium de gestión energética, PPAs, autoconsumo y eficiencia con reporting ejecutivo.",
};

export default function ServicesPage() {
  return (
    <div className="pb-20">
      <section className="pt-14">
        <Container>
          <SectionHeading
            kicker="Servicios"
            title="Todo el ciclo energético bajo control."
          >
            Estrategia, contratos, obra y operación continua. Un solo interlocutor que
            responde ante dirección financiera, operaciones y ESG.
          </SectionHeading>
          <div className="mt-10 grid gap-6 md:grid-cols-[1fr_1fr_0.8fr]">
            {services.slice(0, 3).map((service, index) => (
              <FeatureCard
                key={service.title}
                title={service.title}
                description={service.summary}
                badge={`Servicio ${index + 1}`}
              >
                <BulletList items={service.items} />
              </FeatureCard>
            ))}
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-[1.3fr_0.9fr]">
            <FeatureCard
              title={services[3].title}
              description={services[3].summary}
              badge="Descarbonización"
            >
              <BulletList items={services[3].items} />
            </FeatureCard>
            <div className="card flex flex-col gap-4 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-foreground">Control y gobierno</h3>
              <p className="text-sm text-muted">
                Marco de gobernanza, reporting ejecutivo y KPIs vinculados a objetivos de
                negocio.
              </p>
              <BulletList
                items={[
                  "Cuadro de mando con coste total, riesgo y CO₂ evitado.",
                  "SLA y responsables claros por fase y proveedor.",
                  "Auditorías de contrato y cumplimiento regulatorio.",
                ]}
              />
              <div className="grid grid-cols-2 gap-3">
                <StatCard value="90-120 días" label="Puesta en marcha media" />
                <StatCard value="<5 min" label="Respuesta a alarmas críticas" />
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="mt-16">
        <Container className="card rounded-3xl p-10 shadow-soft">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                Ejecución llave en mano
              </div>
              <h3 className="text-2xl font-semibold text-foreground">
                Contratos, obra y operación sin sorpresas.
              </h3>
              <p className="text-sm text-muted">
                Diseñamos contratos, coordinamos EPC y establecemos KPIs claros para cada
                fase del proyecto.
              </p>
            </div>
            <div className="space-y-3 rounded-2xl bg-emerald-50 p-5 text-sm text-foreground">
              <div className="font-semibold uppercase tracking-[0.14em] text-emerald-800">
                Cobertura y riesgo
              </div>
              <p>
                Modelos de cobertura adaptados a tu curva y apetito de riesgo. Escenarios y
                alertas tempranas para decisiones rápidas.
              </p>
              <p className="font-semibold text-accent">Base load · Peak · Perfilados · PPAs</p>
            </div>
            <div className="space-y-3 rounded-2xl border border-emerald-100 p-5 text-sm text-muted">
              <div className="font-semibold text-foreground">Reporte ejecutivo</div>
              <p>
                Coste/MWh, desvíos, CO₂ evitado, plazos de obra y compromisos de ROI
                actualizados mensualmente.
              </p>
              <p className="font-semibold text-foreground">
                {siteConfig.actions.primaryCta}: respuesta en 24h.
              </p>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
