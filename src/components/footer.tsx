import Link from "next/link";
import { Container } from "@/components/container";
import { Logo } from "@/components/logo";
import { servicesMega, siteConfig } from "@/lib/site";

const legalLinks = [
  { label: "Aviso legal", href: "/aviso-legal" },
  { label: "Privacidad", href: "/privacidad" },
  { label: "Cookies", href: "/privacidad#cookies" },
];

export const Footer = () => {
  return (
    <footer className="mt-20 border-t border-white/70 bg-white/85 backdrop-blur-sm">
      <Container className="grid gap-10 py-12 md:grid-cols-4">
        <div className="space-y-4">
          <Logo />
          <p className="text-sm text-muted">{siteConfig.description}</p>
          <Link
            href="https://www.linkedin.com/company/gesmecoenergia"
            className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
            aria-label="LinkedIn Gesmeco Energía"
          >
            <span className="h-2 w-2 rounded-full bg-accent" />
            LinkedIn (placeholder)
          </Link>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Empresa</h3>
          <div className="space-y-2 text-sm text-muted">
            <Link className="block hover:text-foreground" href="/sobre-nosotros">
              Sobre nosotros
            </Link>
            <Link className="block hover:text-foreground" href="/sectores">
              Sectores
            </Link>
            <Link className="block hover:text-foreground" href="/recursos">
              Recursos
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Servicios</h3>
          <div className="space-y-2 text-sm text-muted">
            {servicesMega.map((service) => (
              <Link key={service.title} className="block hover:text-foreground" href={service.href}>
                {service.title}
              </Link>
            ))}
            <Link className="block font-semibold text-accent hover:underline" href="/servicios">
              Ver todos →
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Legal & Contacto</h3>
          <div className="space-y-2 text-sm text-muted">
            {legalLinks.map((item) => (
              <Link key={item.label} className="block hover:text-foreground" href={item.href}>
                {item.label}
              </Link>
            ))}
            <div className="pt-2">
              <div>{siteConfig.contact.email}</div>
              <div>{siteConfig.contact.phone}</div>
              <div>{siteConfig.contact.address}</div>
              <Link className="mt-2 block font-semibold text-accent hover:underline" href="/contacto">
                Solicitar estudio →
              </Link>
            </div>
          </div>
        </div>
      </Container>
      <div className="border-t border-white/70 bg-white/75">
        <Container className="flex flex-col items-center justify-between gap-3 py-4 text-xs text-muted md:flex-row">
          <span>© {new Date().getFullYear()} Gesmeco Energía. Todos los derechos reservados.</span>
          <div className="flex gap-3">
            <Link href="/contacto" className="hover:text-foreground">
              Contacto
            </Link>
            <Link href="/sobre-nosotros" className="hover:text-foreground">
              Empresa
            </Link>
          </div>
        </Container>
      </div>
    </footer>
  );
};
