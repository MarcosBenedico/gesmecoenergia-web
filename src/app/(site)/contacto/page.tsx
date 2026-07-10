import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { SectionHeading } from "@/components/section-heading";
import { contactChannels } from "@/lib/data";
import { siteConfig } from "@/lib/site";

export const metadata = {
  title: "Contacto | Gesmeco Energía",
  description:
    "Habla con un asesor del Grupo Gesmeco en Binéfar: energía, asesoría fiscal-laboral y seguros. Respuesta en menos de 24h.",
};

export default function ContactPage() {
  return (
    <div className="pb-20">
      <section className="pt-14">
        <Container className="grid gap-10 md:grid-cols-[1.05fr_0.95fr] md:items-start">
          <div className="space-y-6">
            <SectionHeading kicker="Contacto" title="Cuéntanos qué necesitas.">
              Energía, asesoría o seguros: te responde una persona del equipo en menos de 24h.
              Si nos mandas tu factura, en 48h tienes el análisis hecho.
            </SectionHeading>
            <div className="grid gap-4 md:grid-cols-2">
              {contactChannels.map((channel) => (
                <div key={channel.title} className="card rounded-2xl p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-700">
                    {channel.title}
                  </div>
                  <p className="mt-2 text-sm text-muted">{channel.detail}</p>
                  <div className="mt-3 text-sm font-semibold text-accent">{channel.action}</div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-5 text-sm text-foreground">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-800">
                Datos directos
              </div>
              <p className="mt-1">{siteConfig.contact.email}</p>
              <p>{siteConfig.contact.address}</p>
            </div>
          </div>

          <div className="card rounded-3xl p-8 shadow-soft">
            <form className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-foreground">Nombre y apellidos</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:shadow-soft"
                    name="name"
                    placeholder="Nombre"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Empresa</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:shadow-soft"
                    name="company"
                    placeholder="Empresa"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-foreground">Email</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:shadow-soft"
                    type="email"
                    name="email"
                    placeholder="email@empresa.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Teléfono</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:shadow-soft"
                    name="phone"
                    placeholder="+34 600 000 000"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground">Prioridad principal</label>
                <select
                  className="mt-2 w-full rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:shadow-soft"
                  name="priority"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Selecciona una opción
                  </option>
                  <option value="factura">Analizar mi factura de luz o gas</option>
                  <option value="solar">Placas solares para mi casa o negocio</option>
                  <option value="auditoria">Auditoría energética</option>
                  <option value="asesoria">Asesoría fiscal, laboral o contable</option>
                  <option value="seguros">Seguros (Correbin Asociados)</option>
                  <option value="otro">Otra necesidad</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground">Contexto</label>
                <textarea
                  className="mt-2 h-28 w-full rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:shadow-soft"
                  name="message"
                  placeholder="Cuéntanos tu caso: qué pagas de luz, si tienes negocio o granja, qué te preocupa..."
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
                <span>Respuesta en 24h. Sin spam, sin cesión de datos a terceros.</span>
                <Button type="button" size="lg" className="bg-gradient-to-r from-accent to-accent-light text-white font-bold shadow-lg hover:shadow-xl">
                  ✉️ Enviar solicitud
                </Button>
              </div>
            </form>
          </div>
        </Container>
      </section>
    </div>
  );
}
