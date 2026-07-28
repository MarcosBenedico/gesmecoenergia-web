import Link from "next/link";
import Image from "next/image";
import { BulletList } from "@/components/bullet-list";
import { Container } from "@/components/container";
import { SectionHeading } from "@/components/section-heading";
import { HeroSection } from "@/components/hero-section";
import { PhotoBanner } from "@/components/photo-banner";
import { ScrollReveal } from "@/components/scroll-reveal";
import { methodology, services } from "@/lib/data";
import { LogoEmpresa, MARCAS } from '@/components/logo-empresa';

/* ── Grupo Gesmeco: las tres áreas, protagonistas en la home ── */
const GRUPO = [
  {
    nombre: "Gesmeco Energía",
    marca: MARCAS.energia,
    area: "Energía",
    icono: "⚡",
    destacada: true,
    resumen:
      "El corazón del grupo. Analizamos tu factura de luz y gas línea a línea, negociamos con las comercializadoras y diseñamos tu instalación solar. Ahorros reales del 15–40%.",
    puntos: ["Análisis de factura gratuito", "Solar fotovoltaica llave en mano", "Seguimiento continuo de tu contrato"],
    href: "/servicios",
    borde: "border-accent/40",
    fondo: "bg-accent/[0.06]",
    chip: "bg-accent/15 text-accent",
  },
  {
    nombre: "Asesoría Gesmeco",
    marca: MARCAS.asesoria,
    area: "Asesoría",
    icono: "📋",
    destacada: false,
    resumen:
      "Fiscal, laboral, contable y administrativa. Impuestos, nóminas y trámites resueltos para autónomos y empresas de la comarca.",
    puntos: ["Fiscal y contable", "Laboral y nóminas", "Trámites y subvenciones"],
    href: "/grupo",
    borde: "border-tertiary/30",
    fondo: "bg-tertiary/[0.05]",
    chip: "bg-tertiary/15 text-tertiary",
  },
  {
    nombre: "Correbin Asociados",
    marca: MARCAS.seguros,
    area: "Seguros",
    icono: "🛡️",
    destacada: false,
    resumen:
      "Correduría de seguros: hogar, vehículos, empresa y sector agrario-ganadero. Revisamos tus pólizas sin coste y buscamos mejores condiciones.",
    puntos: ["Hogar y vehículos", "Empresa y explotación", "Revisión gratuita de pólizas"],
    href: "/grupo",
    borde: "border-secondary/30",
    fondo: "bg-secondary/[0.05]",
    chip: "bg-secondary/15 text-secondary",
  },
];

export default function HomePage() {
  return (
    <div className="relative pb-20">

      {/* ── HERO: energía como protagonista ── */}
      <div className="relative z-10">
        <HeroSection />
      </div>

      {/* ── GRUPO GESMECO: un solo equipo, tres áreas ── */}
      <section className="relative z-10 py-20">
        <Container>
          {/* Separador con un pulso de luz que lo recorre: cierra el hero y
              abre el contenido. Es la única metáfora literal que se permite el
              sitio, y viene del negocio: energía pasando por un cable. */}
          <div className="corriente mb-16" aria-hidden />
          <ScrollReveal>
            <SectionHeading
              kicker="Grupo Gesmeco"
              title="Energía, asesoría y seguros. Un solo equipo, un solo teléfono."
            >
              Todo lo que tu casa, tu granja o tu empresa necesita, gestionado desde la misma
              oficina de Binéfar. Empezamos por la energía y te acompañamos en todo lo demás.
            </SectionHeading>
          </ScrollReveal>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {GRUPO.map((e, i) => (
              <ScrollReveal key={e.nombre} delay={i * 110} direction="blur">
                <Link
                  href={e.href}
                  className={`foco borde-vivo group flex h-full flex-col rounded-2xl border ${e.borde} ${e.fondo} p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg ${
                    e.destacada ? "ring-1 ring-accent/30 shadow-[0_10px_40px_rgba(255,51,51,0.10)]" : ""
                  }`}
                >
                  <div className="relative mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {/* La marca manda. El nombre sigue en el h3 oculto para
                          buscadores y lectores de pantalla. */}
                      <h3 className="sr-only">{e.nombre}</h3>
                      <LogoEmpresa
                        marca={e.marca}
                        alto={30}
                        className="transition-transform duration-500 group-hover:-translate-y-0.5"
                      />
                      <span className={`mt-2.5 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${e.chip}`}>
                        {e.area}
                      </span>
                    </div>
                    {e.destacada && (
                      <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                        Principal
                      </span>
                    )}
                  </div>
                  <p className="relative text-sm leading-relaxed text-muted">{e.resumen}</p>
                  <ul className="relative mt-4 space-y-1.5 text-sm text-muted">
                    {e.puntos.map((p) => (
                      <li key={p} className="flex items-start gap-2 transition-colors group-hover:text-foreground/80">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <span className="relative mt-auto flex items-center gap-1.5 pt-4 text-sm font-bold text-foreground/70 transition group-hover:text-foreground">
                    Saber más
                    <span className="transition-transform duration-300 group-hover:translate-x-1.5" aria-hidden>→</span>
                  </span>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </section>

      {/* ── QUÉ HACEMOS EN ENERGÍA ── */}
      <section className="relative z-10 py-4">
        <Container>
          <ScrollReveal>
            <SectionHeading
              kicker="Qué hacemos en energía"
              title="Análisis honesto, asesor disponible, soluciones que funcionan."
            >
              Viviendas, ganadería, agricultura, comercios y empresas de Binéfar y comarca.
              Desde revisar tu factura hasta instalar placas solares. Sin presión, sin sorpresas.
            </SectionHeading>
          </ScrollReveal>
          {/* Entran alternando lado: en una rejilla de dos columnas, que las
              cuatro suban igual se lee como una sola cosa; alternando se lee
              como cuatro servicios distintos. */}
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {services.slice(0, 4).map((service, i) => (
              <ScrollReveal key={service.title} delay={i * 90} direction={i % 2 === 0 ? "left" : "right"}>
                {/* `sector-card` es el hover que ya estaba escrito en globals.css
                    (elevación, halo rojo y un velo en diagonal) y que no se
                    había llegado a poner en ninguna tarjeta del sitio. */}
                <div className="sector-card foco h-full rounded-2xl border border-border/50 bg-surface/60 p-6 backdrop-blur-sm">
                  <h3 className="relative mb-3 text-lg font-bold text-foreground">{service.title}</h3>
                  <p className="relative mb-3 text-sm text-muted">{service.summary}</p>
                  <div className="relative">
                    <BulletList items={service.items} />
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
          <div className="relative z-10 mt-6 text-right text-sm">
            <Link href="/servicios" className="enlace-vivo font-semibold text-accent transition hover:text-accent/80">
              Ver detalle de servicios →
            </Link>
          </div>
        </Container>
      </section>

      {/* ── BANDA VISUAL: CAMPO Y GANADERÍA ── */}
      <section className="relative z-10 py-16">
        <Container>
          <ScrollReveal direction="scale">
            <PhotoBanner
              src="/images/granja-solar.webp"
              alt="Nave agrícola con placas solares en el campo de Aragón"
              kicker="Energía para el campo"
              title="Solar pensada para granjas, riegos y naves de la comarca."
              description="Instalaciones robustas, dimensionadas al consumo real de tu explotación. Sin humo, con números."
              ctaHref="/sectores"
              ctaLabel="Ver soluciones por sector"
              size="lg"
            />
          </ScrollReveal>
        </Container>
      </section>

      {/* ── CÓMO TRABAJAMOS ── */}
      <section className="relative z-10 py-20">
        <Container>
          <ScrollReveal>
            <SectionHeading kicker="Cómo trabajamos" title="Pasos claros, sin complicaciones.">
              Desde la primera llamada hasta el seguimiento después de instalar solar.
              Transparencia total en cada fase.
            </SectionHeading>
          </ScrollReveal>
          {/* Aquí numerar no es decoración: es una secuencia de verdad y el
              orden es información que el cliente necesita. */}
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {methodology.map((step, index) => (
              <ScrollReveal key={step.title} delay={index * 90}>
                {/* `step-card` (el filete que se pinta de izquierda a derecha al
                    pasar por encima) también estaba escrito y sin usar. */}
                <div className="step-card foco group h-full rounded-2xl border border-border/50 bg-surface/60 p-5 backdrop-blur-sm">
                  <div className="relative mb-3 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/30 bg-accent/15 text-sm font-black text-accent transition-transform duration-300 group-hover:scale-110">
                      {index + 1}
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                      Fase {index + 1}
                    </span>
                  </div>
                  <h3 className="relative text-base font-bold text-foreground">{step.title}</h3>
                  <p className="relative mt-2 text-sm text-muted">{step.detail}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 mt-8 px-4">
        <ScrollReveal direction="scale">
          <Container>
            <div className="cta-bg relative overflow-hidden rounded-3xl px-8 py-14 text-white shadow-[0_0_80px_rgba(255,51,51,0.2)]">
              {/* Fotografía de fondo */}
              <Image
                src="/images/asesoria.webp"
                alt=""
                fill
                sizes="(max-width: 1280px) 100vw, 1280px"
                className="object-cover object-center opacity-25"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-background/40" />

              {/* Escuadras */}
              <div className="absolute left-0 top-0 h-px w-48 bg-gradient-to-r from-accent to-transparent" />
              <div className="absolute left-0 top-0 h-48 w-px bg-gradient-to-b from-accent to-transparent" />
              <div className="absolute bottom-0 right-0 h-px w-48 bg-gradient-to-l from-secondary to-transparent" />
              <div className="absolute bottom-0 right-0 h-48 w-px bg-gradient-to-t from-secondary to-transparent" />

              <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
                <div className="max-w-xl space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                    <span className="text-xs font-bold uppercase tracking-widest text-accent">Empieza ahora</span>
                  </div>
                  <h3 className="text-3xl font-black leading-tight">
                    Descubre tu potencial de ahorro sin compromiso.
                  </h3>
                  <p className="text-base text-gray-300">
                    Análisis completo de tu factura, consumos y opciones de solar.
                    Diagnóstico personalizado, honesto y gratuito.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-3">
                  <Link
                    href="/analizador"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-4 text-base font-black text-[#0f0f1e] shadow-lg transition-all hover:scale-[1.04] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                  >
                    📊 Analizar ahora
                  </Link>
                  <Link
                    href="/contacto"
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-white/40 bg-white/10 px-7 py-4 text-base font-bold text-white backdrop-blur-sm transition-all hover:border-white/70 hover:bg-white/20"
                  >
                    📞 Hablar con asesor
                  </Link>
                </div>
              </div>
            </div>
          </Container>
        </ScrollReveal>
      </section>
    </div>
  );
}
