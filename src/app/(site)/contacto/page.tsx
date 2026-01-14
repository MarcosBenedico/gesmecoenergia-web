import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { SectionHeading } from "@/components/section-heading";
import { contactChannels } from "@/lib/data";
import { siteConfig } from "@/lib/site";

export const metadata = {
  title: "Contacto | Gesmeco Energía",
  description:
    "Agenda una sesión con Gesmeco Energía para revisar tu estrategia, contratos y planes de descarbonización.",
};

export default function ContactPage() {
  return (
    <div className="pb-20">
      <section className="pt-14">
        <Container className="grid gap-10 md:grid-cols-[1.05fr_0.95fr] md:items-start">
          <div className="space-y-6">
            <SectionHeading kicker="Contacto" title="Hablemos de tu estrategia energética.">
              Cuéntanos tu situación actual y tus prioridades. Preparamos un diagnóstico inicial en
              5 días con oportunidades rápidas y una hoja de ruta clara.
            </SectionHeading>
            <div className="grid gap-4 md:grid-cols-2">
              {contactChannels.map((channel) => (
                <div key={channel.title} className="card rounded-2xl p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    {channel.title}
                  </div>
                  <p className="mt-2 text-sm text-muted">{channel.detail}</p>
                  <div className="mt-3 text-sm font-semibold text-accent">{channel.action}</div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 text-sm text-foreground">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">
                Datos directos
              </div>
              <p className="mt-1">{siteConfig.contact.email}</p>
              <p>{siteConfig.contact.phone}</p>
              <p>{siteConfig.contact.address}</p>
            </div>
          </div>

          <div className="card rounded-3xl p-8 shadow-soft">
            <form className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-foreground">Nombre y apellidos</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:shadow-soft"
                    name="name"
                    placeholder="Nombre"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Empresa</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:shadow-soft"
                    name="company"
                    placeholder="Empresa"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-foreground">Email</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:shadow-soft"
                    type="email"
                    name="email"
                    placeholder="email@empresa.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Teléfono</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:shadow-soft"
                    name="phone"
                    placeholder="+34 600 000 000"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground">Prioridad principal</label>
                <select
                  className="mt-2 w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:shadow-soft"
                  name="priority"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Selecciona una opción
                  </option>
                  <option value="costes">Reducir coste total</option>
                  <option value="ppa">Estructurar PPA</option>
                  <option value="autoconsumo">Proyecto de autoconsumo</option>
                  <option value="eficiencia">Plan de eficiencia y CO₂</option>
                  <option value="otro">Otra necesidad</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground">Contexto</label>
                <textarea
                  className="mt-2 h-28 w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:shadow-soft"
                  name="message"
                  placeholder="Cuéntanos consumo anual, contratos vigentes, retos y objetivos."
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
                <span>Respuesta en 24h. Sin spam, sin cesión de datos a terceros.</span>
                <Button type="button" size="lg">
                  Enviar solicitud
                </Button>
              </div>
            </form>
          </div>
        </Container>
      </section>
    </div>
  );
}
