import { Container } from "@/components/container";
import { ScrollReveal } from "@/components/scroll-reveal";
import { SectionHeading } from "@/components/section-heading";
import { contactChannels } from "@/lib/data";
import { siteConfig } from "@/lib/site";
import { FormularioContacto } from "./formulario";

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
            <ScrollReveal>
              <SectionHeading kicker="Contacto" title="Cuéntanos qué necesitas.">
                Energía, asesoría o seguros: te responde una persona del equipo en menos de 24h.
                Si nos mandas tu factura, en 48h tienes el análisis hecho.
              </SectionHeading>
            </ScrollReveal>
            <div className="grid gap-4 md:grid-cols-2">
              {contactChannels.map((channel, i) => (
                <ScrollReveal key={channel.title} delay={i * 90}>
                  <div className="card foco h-full rounded-2xl p-5">
                    <div className="relative text-xs font-semibold uppercase tracking-[0.14em] text-accent-light">
                      {channel.title}
                    </div>
                    <p className="relative mt-2 text-sm text-muted">{channel.detail}</p>
                    <div className="relative mt-3 text-sm font-semibold text-accent">{channel.action}</div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
            <ScrollReveal delay={120}>
              {/* Este cuadro iba con `bg-rose-50/70` y `text-foreground`: fondo
                  rosa clarito con letra blanca. El correo y la dirección de la
                  oficina, en la página de contacto, quedaban a 1,05:1 de
                  contraste, o sea invisibles. Y era además el único trozo de
                  tema claro suelto en una web oscura. */}
              <div className="rounded-2xl border border-secondary/25 bg-secondary/[0.07] p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
                  Datos directos
                </div>
                <p className="mt-2.5 text-base font-semibold text-foreground">
                  <a href={`mailto:${siteConfig.contact.email}`} className="enlace-vivo">
                    {siteConfig.contact.email}
                  </a>
                </p>
                <p className="mt-1 text-sm text-muted">{siteConfig.contact.address}</p>
              </div>
            </ScrollReveal>
          </div>

          <ScrollReveal direction="right" delay={100}>
            <FormularioContacto correo={siteConfig.contact.email} />
          </ScrollReveal>
        </Container>
      </section>
    </div>
  );
}
