import Link from "next/link";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { SectionHeading } from "@/components/section-heading";

export const metadata = {
  title: "Recursos | Gesmeco Energía",
  description:
    "Herramientas gratuitas para entender tu factura de luz y decidir con cabeza: analizador online, plantilla Excel y guías prácticas.",
};

const resources = [
  {
    title: "Analizador de factura online",
    description:
      "Introduce los datos de tu factura y descubre tu horquilla de ahorro en 2 minutos. Gratis y sin compromiso.",
    href: "/analizador",
    action: "Usar el analizador →",
  },
  {
    title: "Plantilla Excel de análisis",
    description:
      "¿Prefieres rellenarlo con calma o tienes varios suministros? Descarga la plantilla desde el analizador y súbela cuando la tengas.",
    href: "/analizador",
    action: "Descargar plantilla →",
  },
  {
    title: "Estudio personalizado con asesor",
    description:
      "Mándanos tu factura y un asesor la revisa a mano: tarifa, potencia, solar y todo lo que se pueda mejorar.",
    href: "/contacto",
    action: "Pedir estudio →",
  },
];

const guias = [
  {
    title: "¿Qué es la potencia contratada?",
    texto:
      "Es lo que pagas por poder consumir, uses o no la luz. La mayoría de hogares y negocios tienen más de la que necesitan: revisarla es el ahorro más rápido que existe.",
  },
  {
    title: "¿Qué son los periodos P1, P2, P3?",
    texto:
      "La luz no cuesta lo mismo a todas horas. P1 (punta) es la más cara, P3 (valle) la más barata. Mover consumos de hora puede recortar la factura sin cambiar de tarifa.",
  },
  {
    title: "¿Cuándo sale a cuenta la solar?",
    texto:
      "Depende de tu consumo diurno y tu tejado. En Binéfar, con buena orientación, una instalación bien dimensionada se amortiza en 2-4 años. Si no es tu caso, te lo diremos.",
  },
];

export default function ResourcesPage() {
  return (
    <div className="pb-20">
      <section className="pt-14">
        <Container className="space-y-12">
          <SectionHeading
            kicker="Recursos"
            title="Herramientas gratuitas para decidir con cabeza."
          >
            Todo lo que necesitas para entender tu factura y saber si puedes pagar menos.
            Sin registros, sin letra pequeña.
          </SectionHeading>

          <div className="grid gap-4 md:grid-cols-3">
            {resources.map((res) => (
              <Link
                key={res.title}
                href={res.href}
                className="card group flex flex-col gap-3 rounded-2xl p-5 transition hover:-translate-y-1 hover:shadow-soft"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-700">
                  Gratis
                </div>
                <div className="text-lg font-semibold text-foreground">{res.title}</div>
                <p className="text-sm text-muted">{res.description}</p>
                <span className="mt-auto text-sm font-semibold text-accent transition group-hover:text-accent-light">
                  {res.action}
                </span>
              </Link>
            ))}
          </div>

          <div>
            <SectionHeading kicker="Guía rápida" title="Tu factura, explicada en cristiano.">
              Tres conceptos que aparecen en todas las facturas y casi nadie explica.
            </SectionHeading>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {guias.map((g) => (
                <div key={g.title} className="card rounded-2xl border border-border p-5">
                  <div className="text-base font-bold text-foreground">{g.title}</div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{g.texto}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-neutral-900 px-6 py-8 text-white shadow-soft">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-100">
                  ¿Dudas con tu factura?
                </div>
                <h3 className="text-2xl font-semibold">Te la explicamos por teléfono, sin compromiso.</h3>
                <p className="text-sm text-gray-200">
                  Quince minutos con un asesor y sabrás exactamente qué estás pagando y por qué.
                </p>
              </div>
              <div className="flex gap-3">
                <Button href="/contacto" size="lg" className="bg-white text-neutral-900 hover:bg-rose-50">
                  Hablar con asesor
                </Button>
                <Button
                  href="/analizador"
                  size="lg"
                  className="border border-white/30 bg-white/10 text-white hover:bg-white/20"
                >
                  Analizar mi factura
                </Button>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
