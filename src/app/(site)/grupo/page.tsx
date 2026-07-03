import Link from "next/link";
import { Container } from "@/components/container";
import { SolutionsSelector } from "@/components/solutions-selector";
import { ScrollReveal } from "@/components/scroll-reveal";

export const metadata = {
  title: "Grupo Gesmeco | Energía, Asesoría y Seguros en Binéfar",
  description:
    "Un grupo, tres áreas de servicio: Gesmeco Energía, Asesoría Gesmeco y Correbin Asociados. Energía, gestión fiscal-laboral y seguros desde Binéfar.",
};

const EMPRESAS = [
  {
    icono: "⚡",
    area: "Energía",
    nombre: "Gesmeco Energía",
    claim: "Que tu factura de luz deje de ser un misterio.",
    descripcion:
      "Analizamos tu factura línea a línea, auditamos tu instalación y diseñamos solar fotovoltaica a tu medida. Para hogares, granjas, comercios e industria.",
    servicios: [
      "Análisis y comparativa de factura de luz y gas",
      "Auditorías energéticas en tu instalación",
      "Solar fotovoltaica llave en mano",
      "Asesoramiento energético continuo",
    ],
    href: "/servicios",
    cta: "Ver servicios de energía",
    color: "accent",
    borderClass: "border-accent/25 hover:border-accent/60",
    glowClass: "hover:shadow-[0_20px_60px_rgba(255,51,51,0.18)]",
    chipClass: "bg-accent/15 text-accent border-accent/30",
    iconClass: "bg-accent/15",
    lineClass: "from-accent",
    dotClass: "bg-accent",
    linkClass: "text-accent hover:text-accent-light",
  },
  {
    icono: "📋",
    area: "Asesoría",
    nombre: "Asesoría Gesmeco",
    claim: "Tus impuestos, nóminas y papeles, en orden.",
    descripcion:
      "Despacho de confianza para autónomos, empresas y particulares. Gestión fiscal, contable, laboral y administrativa con trato directo, sin llamadas a un 902.",
    servicios: [
      "Fiscal: IVA, IRPF, sociedades y renta",
      "Contable: balances, cuentas anuales y libros",
      "Laboral: contratos, nóminas y Seguridad Social",
      "Administrativa: trámites y expedientes",
    ],
    href: "/grupo",
    cta: "Ver servicios de asesoría",
    color: "tertiary",
    borderClass: "border-tertiary/25 hover:border-tertiary/60",
    glowClass: "hover:shadow-[0_20px_60px_rgba(255,149,0,0.18)]",
    chipClass: "bg-tertiary/15 text-tertiary border-tertiary/30",
    iconClass: "bg-tertiary/15",
    lineClass: "from-tertiary",
    dotClass: "bg-tertiary",
    linkClass: "text-tertiary hover:text-amber-400",
  },
  {
    icono: "🛡️",
    area: "Seguros",
    nombre: "Correbin Asociados",
    claim: "Bien cubierto, sin pagar de más.",
    descripcion:
      "Correduría de seguros para tu casa, tu coche, tu negocio y tu explotación. Revisamos tus pólizas, detectamos duplicidades y te acompañamos si hay siniestro.",
    servicios: [
      "Particulares: hogar, auto, vida y salud",
      "Empresas: RC, comercio, naves y flotas",
      "Agrarios y ganaderos: explotaciones y maquinaria",
      "Revisión y optimización de pólizas en vigor",
    ],
    href: "/grupo",
    cta: "Ver servicios de seguros",
    color: "secondary",
    borderClass: "border-secondary/25 hover:border-secondary/60",
    glowClass: "hover:shadow-[0_20px_60px_rgba(0,212,255,0.18)]",
    chipClass: "bg-secondary/15 text-secondary border-secondary/30",
    iconClass: "bg-secondary/15",
    lineClass: "from-secondary",
    dotClass: "bg-secondary",
    linkClass: "text-secondary hover:text-cyan-300",
  },
];

const CIFRAS_GRUPO = [
  { valor: "3", etiqueta: "Áreas de servicio", detalle: "Energía · Asesoría · Seguros" },
  { valor: "1", etiqueta: "Único interlocutor", detalle: "Un equipo, una llamada" },
  { valor: "4.5 GW", etiqueta: "Cartera energética", detalle: "Gas y luz gestionados" },
  { valor: "Binéfar", etiqueta: "Nuestra casa", detalle: "Avenida de Aragón, 50" },
];

const COMPROMISOS = [
  {
    numero: "01",
    titulo: "Honestidad técnica",
    texto:
      "Si no te conviene, te lo decimos. No vendemos productos: resolvemos situaciones. Cada recomendación va justificada con números.",
  },
  {
    numero: "02",
    titulo: "Cercanía real",
    texto:
      "Estamos en Binéfar y conocemos la zona: la granja, la nave, el comercio y la casa. Nos llamas y te atiende una persona, no una centralita.",
  },
  {
    numero: "03",
    titulo: "Visión de conjunto",
    texto:
      "Tu factura de luz, tus impuestos y tus seguros están conectados. Verlos juntos nos permite encontrar ahorros que por separado no se ven.",
  },
];

export default function GroupPage() {
  return (
    <div className="pb-24">
      {/* ═══════════ HERO DEL GRUPO ═══════════ */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-secondary/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-tertiary/8 blur-3xl" />
          {/* Líneas de esquina */}
          <div className="absolute left-0 top-0 h-px w-72 bg-gradient-to-r from-accent/60 to-transparent" />
          <div className="absolute left-0 top-0 h-72 w-px bg-gradient-to-b from-accent/60 to-transparent" />
          <div className="absolute bottom-0 right-0 h-px w-72 bg-gradient-to-l from-secondary/60 to-transparent" />
          <div className="absolute bottom-0 right-0 h-72 w-px bg-gradient-to-t from-secondary/60 to-transparent" />
        </div>

        <Container>
          <ScrollReveal>
            <div className="mx-auto max-w-3xl space-y-7 text-center">
              <div className="inline-flex items-center gap-3 rounded-full border border-accent/25 bg-accent/10 px-5 py-2 backdrop-blur-sm">
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                <span className="text-xs font-bold uppercase tracking-[0.3em] text-accent">
                  Grupo Gesmeco · Binéfar
                </span>
              </div>

              <h1 className="text-4xl font-black leading-[1.08] text-foreground md:text-6xl">
                Un grupo. Tres formas
                <br />
                de cuidar <span className="gradient-text-animated">lo tuyo</span>.
              </h1>

              <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted">
                Tu energía, tus papeles y tus seguros, gestionados por el mismo equipo de
                confianza. Sin centralitas, sin intermediarios: un despacho de Binéfar que
                conoce tu nombre y tu negocio.
              </p>

              <div className="flex flex-wrap justify-center gap-3 pt-2">
                {EMPRESAS.map((e) => (
                  <a
                    key={e.nombre}
                    href={`#${e.area.toLowerCase()}`}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-all hover:-translate-y-0.5 ${e.chipClass}`}
                  >
                    <span>{e.icono}</span> {e.nombre}
                  </a>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* Cifras del grupo */}
          <ScrollReveal delay={200}>
            <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/40 bg-border/30 md:grid-cols-4">
              {CIFRAS_GRUPO.map((c) => (
                <div key={c.etiqueta} className="bg-card/80 p-6 text-center backdrop-blur-sm">
                  <div className="text-2xl font-black text-foreground md:text-3xl">{c.valor}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                    {c.etiqueta}
                  </div>
                  <div className="mt-1 text-xs text-muted">{c.detalle}</div>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </Container>
      </section>

      {/* ═══════════ LAS TRES EMPRESAS ═══════════ */}
      <section className="py-12">
        <Container>
          <ScrollReveal>
            <div className="mb-14 flex items-end justify-between gap-6 flex-wrap">
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent">
                  Las empresas del grupo
                </p>
                <h2 className="max-w-xl text-3xl font-black leading-tight text-foreground md:text-4xl">
                  Tres especialistas, una sola manera de trabajar.
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-muted">
                Cada empresa domina su terreno. Todas comparten lo importante: rigor,
                transparencia y un trato que ya casi no se encuentra.
              </p>
            </div>
          </ScrollReveal>

          <div className="space-y-8">
            {EMPRESAS.map((empresa, i) => (
              <ScrollReveal key={empresa.nombre} delay={i * 120}>
                <div
                  id={empresa.area.toLowerCase()}
                  className={`group relative overflow-hidden rounded-3xl border bg-card/70 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 ${empresa.borderClass} ${empresa.glowClass}`}
                >
                  {/* Línea superior de área */}
                  <div
                    className={`absolute left-0 top-0 h-1 w-full bg-gradient-to-r ${empresa.lineClass} to-transparent opacity-60 transition-opacity group-hover:opacity-100`}
                  />

                  <div className="grid gap-8 p-8 md:p-10 lg:grid-cols-[1.1fr_1fr]">
                    {/* Columna identidad */}
                    <div className="space-y-5">
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl ${empresa.iconClass}`}
                        >
                          {empresa.icono}
                        </div>
                        <div>
                          <div
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] ${empresa.chipClass}`}
                          >
                            {empresa.area}
                          </div>
                          <h3 className="mt-1 text-2xl font-black text-foreground md:text-3xl">
                            {empresa.nombre}
                          </h3>
                        </div>
                      </div>

                      <p className="text-lg font-bold leading-snug text-foreground/90">
                        “{empresa.claim}”
                      </p>

                      <p className="text-sm leading-relaxed text-muted">{empresa.descripcion}</p>

                      <Link
                        href={empresa.href}
                        className={`inline-flex items-center gap-2 text-sm font-bold transition ${empresa.linkClass}`}
                      >
                        {empresa.cta}
                        <span className="transition-transform group-hover:translate-x-1">→</span>
                      </Link>
                    </div>

                    {/* Columna servicios */}
                    <div className="flex flex-col justify-center rounded-2xl border border-border/30 bg-background/40 p-6">
                      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.25em] text-muted">
                        Qué hacemos por ti
                      </p>
                      <ul className="space-y-3">
                        {empresa.servicios.map((servicio) => (
                          <li key={servicio} className="flex items-start gap-3 text-sm text-muted">
                            <span
                              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${empresa.dotClass}`}
                            />
                            <span className="transition-colors group-hover:text-foreground/90">
                              {servicio}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </section>

      {/* ═══════════ POR QUÉ UN GRUPO ═══════════ */}
      <section className="py-20">
        <Container>
          <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-surface/80 to-card/60 p-8 md:p-14">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute right-0 top-0 h-px w-64 bg-gradient-to-l from-accent/50 to-transparent" />
              <div className="absolute right-0 top-0 h-64 w-px bg-gradient-to-b from-accent/50 to-transparent" />
            </div>

            <ScrollReveal>
              <div className="mb-12 max-w-2xl space-y-3">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent">
                  Por qué somos un grupo
                </p>
                <h2 className="text-3xl font-black leading-tight text-foreground md:text-4xl">
                  Porque tu vida no viene por departamentos.
                </h2>
                <p className="text-base leading-relaxed text-muted">
                  El que tiene una granja también tiene nóminas, seguros y una factura de luz que
                  duele. Llevamos años viéndolo cada día, así que decidimos juntarlo todo bajo un
                  mismo techo.
                </p>
              </div>
            </ScrollReveal>

            <div className="grid gap-6 md:grid-cols-3">
              {COMPROMISOS.map((c, i) => (
                <ScrollReveal key={c.numero} delay={i * 120}>
                  <div className="group h-full rounded-2xl border border-border/40 bg-card/60 p-7 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/40">
                    <div className="text-4xl font-black text-accent/25 transition-colors group-hover:text-accent/50">
                      {c.numero}
                    </div>
                    <h3 className="mt-3 text-lg font-black text-foreground">{c.titulo}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{c.texto}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ═══════════ SERVICIOS EN DETALLE (selector) ═══════════ */}
      <section className="border-t border-border/30">
        <SolutionsSelector />
      </section>

      {/* ═══════════ CTA FINAL ═══════════ */}
      <section className="px-4 pt-8">
        <ScrollReveal>
          <Container>
            <div className="cta-bg relative overflow-hidden rounded-3xl px-8 py-16 text-white shadow-[0_0_80px_rgba(255,51,51,0.2)]">
              <div className="absolute left-0 top-0 h-px w-48 bg-gradient-to-r from-accent to-transparent" />
              <div className="absolute left-0 top-0 h-48 w-px bg-gradient-to-b from-accent to-transparent" />
              <div className="absolute bottom-0 right-0 h-px w-48 bg-gradient-to-l from-secondary to-transparent" />
              <div className="absolute bottom-0 right-0 h-48 w-px bg-gradient-to-t from-secondary to-transparent" />

              <div className="relative mx-auto max-w-2xl space-y-5 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent">
                  Grupo Gesmeco
                </p>
                <h3 className="text-3xl font-black leading-tight md:text-4xl">
                  Cuéntanos qué necesitas.
                  <br />
                  Del resto nos encargamos nosotros.
                </h3>
                <p className="text-base text-gray-300">
                  Energía, asesoría o seguros: empieza por donde quieras. La primera conversación
                  siempre es gratis y sin compromiso.
                </p>
                <div className="flex flex-wrap justify-center gap-3 pt-3">
                  <Link
                    href="/contacto"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-black text-[#0f0f1e] shadow-lg transition-all hover:scale-[1.04] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                  >
                    Hablar con el equipo
                  </Link>
                  <Link
                    href="/analizador"
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-white/40 bg-white/10 px-8 py-4 text-base font-bold text-white backdrop-blur-sm transition-all hover:border-white/70 hover:bg-white/20"
                  >
                    Analizar mi factura
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
