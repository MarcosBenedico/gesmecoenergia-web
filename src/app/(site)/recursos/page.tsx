import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { SectionHeading } from "@/components/section-heading";

export const metadata = {
  title: "Recursos | Gesmeco Energía",
  description: "Guías, casos y plantillas para gobernanza energética y descarbonización.",
};

const resources = [
  {
    title: "Checklist de contratos energéticos",
    description: "10 puntos para auditar riesgos, cláusulas y coberturas.",
  },
  {
    title: "Plantilla de KPIs ejecutivos",
    description: "Coste total, CO₂ evitado, disponibilidad y ROI en un solo panel.",
  },
  {
    title: "Guía rápida de PPAs",
    description: "Estructuras, riesgos y métricas para decidir con seguridad.",
  },
];

export default function ResourcesPage() {
  return (
    <div className="pb-20">
      <section className="pt-14">
        <Container className="space-y-10">
          <SectionHeading
            kicker="Recursos"
            title="Material ejecutivo para decisiones rápidas."
          >
            Selección de guías y plantillas orientadas a dirección financiera, operaciones y ESG.
            Solicita acceso y te enviamos la versión actualizada.
          </SectionHeading>

          <div className="grid gap-4 md:grid-cols-3">
            {resources.map((res) => (
              <div
                key={res.title}
                className="card flex flex-col gap-3 rounded-2xl p-5 transition hover:-translate-y-1 hover:shadow-soft"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  Recurso
                </div>
                <div className="text-lg font-semibold text-foreground">{res.title}</div>
                <p className="text-sm text-muted">{res.description}</p>
              </div>
            ))}
          </div>

          <div className="rounded-3xl bg-neutral-900 px-6 py-8 text-white shadow-soft">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
                  Acceso prioritario
                </div>
                <h3 className="text-2xl font-semibold">Pide las guías y un breve diagnóstico.</h3>
                <p className="text-sm text-gray-200">
                  Enviamos los materiales y un resumen con oportunidades rápidas para tu caso.
                </p>
              </div>
              <div className="flex gap-3">
                <Button href="/contacto" size="lg" className="bg-white text-neutral-900 hover:bg-emerald-50">
                  Solicitar recursos
                </Button>
                <Button
                  href="/servicios"
                  variant="ghost"
                  size="lg"
                  className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                >
                  Ver servicios
                </Button>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
