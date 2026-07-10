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
    <footer className="mt-20 border-t border-border bg-surface/80">
      <Container className="grid gap-10 py-12 md:grid-cols-4">
        <div className="space-y-4">
          <Logo />
          <p className="text-sm text-foreground/70">{siteConfig.description}</p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground">Grupo Gesmeco</h3>
          <div className="space-y-2 text-sm text-foreground/70">
            <Link className="block hover:text-accent transition" href="/">
              ⚡ Gesmeco Energía
            </Link>
            <Link className="block hover:text-tertiary transition" href="/grupo">
              📋 Asesoría Gesmeco
            </Link>
            <Link className="block hover:text-secondary transition" href="/grupo">
              🛡️ Correbin Asociados
            </Link>
            <Link className="block font-semibold text-accent hover:text-accent-light transition" href="/grupo">
              Conocer el grupo →
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground">Energía</h3>
          <div className="space-y-2 text-sm text-foreground/70">
            {servicesMega.map((service) => (
              <Link key={service.title} className="block hover:text-foreground transition" href={service.href}>
                {service.title}
              </Link>
            ))}
            <Link className="block hover:text-foreground transition" href="/sectores">
              Sectores
            </Link>
            <Link className="block hover:text-foreground transition" href="/recursos">
              Recursos
            </Link>
            <Link className="block hover:text-foreground transition" href="/sobre-nosotros">
              Sobre nosotros
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground">Legal & Contacto</h3>
          <div className="space-y-2 text-sm text-foreground/70">
            {legalLinks.map((item) => (
              <Link key={item.label} className="block hover:text-foreground transition" href={item.href}>
                {item.label}
              </Link>
            ))}
            <div className="pt-2 space-y-1 text-foreground/70">
              <div>{siteConfig.contact.email}</div>
              <div>{siteConfig.contact.address}</div>
              <Link className="mt-2 block font-semibold text-accent hover:text-accent-light transition" href="/contacto">
                Solicitar estudio →
              </Link>
            </div>
          </div>
        </div>
      </Container>
      <div className="border-t border-border bg-surface/90">
        <Container className="flex flex-col items-center justify-between gap-3 py-4 text-xs text-foreground/60 md:flex-row">
          <span>© {new Date().getFullYear()} Grupo Gesmeco · Binéfar. Todos los derechos reservados.</span>
          <div className="flex gap-3">
            <Link href="/contacto" className="hover:text-foreground transition">
              Contacto
            </Link>
            <Link href="/sobre-nosotros" className="hover:text-foreground transition">
              Empresa
            </Link>
            <Link href="/gestor/login" className="text-foreground/50 hover:text-accent transition">
              Gestor
            </Link>
          </div>
        </Container>
      </div>
    </footer>
  );
};
