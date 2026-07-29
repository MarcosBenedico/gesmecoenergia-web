import { ReactNode } from "react";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { Background3D } from "@/components/background-3d";
import { FocoPuntero } from "@/components/foco-puntero";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    // `web-publica` fija la escala de titulares en CSS (ver globals.css): en el
    // escaparate interesa que todos midan lo mismo sin depender del JSX. El
    // gestor no lleva esta clase y usa las utilidades de Tailwind.
    <div className="web-publica bg-background text-foreground">
      {/* Plan B sin JavaScript: Motion escribe `opacity: 0` en el HTML que sale
          del servidor, así que la portada del grupo y los paneles de novedades
          se verían en blanco si no llega a ejecutarse. Esto los devuelve a
          visible; dentro de <noscript> no afecta a nadie más. */}
      <noscript>
        <style>{`[data-revelar]{opacity:1!important;transform:none!important}`}</style>
      </noscript>

      <Background3D />
      {/* Un solo escuchador de puntero para todas las tarjetas `.foco`. */}
      <FocoPuntero />
      <div className="relative z-10">
        {/* Primer elemento tabulable de la página: sin esto hay que pasar por
            toda la cabecera —logo, las tres empresas y el menú— para llegar
            al contenido. Solo se ve al tabular. */}
        <a href="#contenido" className="salta-al-contenido">
          Saltar al contenido
        </a>
        <Navbar />
        <main id="contenido">{children}</main>
        <Footer />
        <WhatsAppButton />
      </div>
    </div>
  );
}
