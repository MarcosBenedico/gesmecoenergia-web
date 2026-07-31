'use client';

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { Logo } from "@/components/logo";
import { LogoEmpresa, MARCAS } from "@/components/logo-empresa";
import { navigation, servicesMega, sectorsMega } from "@/lib/site";
import { cn } from "@/lib/utils";

type OpenMenu = "Servicios" | "Sectores" | null;

/** Las tres casas del grupo y su página, en el orden en que se presentan. */
const EMPRESAS_GRUPO = [
  { marca: MARCAS.energia, href: "/energia" },
  { marca: MARCAS.asesoria, href: "/grupo" },
  { marca: MARCAS.seguros, href: "/seguros" },
];

const icons = {
  spark: (
    <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2 9 10l-7 2 7 2 2 7 2-7 7-2-7-2-2-8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  ),
  contract: (
    <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 8h8M8 12h5M8 16h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  solar: (
    <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 3v2.5M12 18.5V21M4.2 4.2l1.8 1.8M18 18l1.8 1.8M3 12h2.5M18.5 12H21M4.2 19.8 6 18M18 6l1.8-1.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  leaf: (
    <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none">
      <path
        d="M19.5 4.5S14 3 9.5 6.5 4 16 4 16s6.5 2.5 11-1S19.5 4.5 19.5 4.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M9 15.5 15 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  factory: (
    <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 21V9l5 3V9l5 3V6l6 3v12H4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M7 21v-3M11 21v-3M15 21v-3M19 21v-3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  snow: (
    <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none">
      <path d="m12 3 .01 18M8 5l8 4M8 19l8-4M5 8l4 4-4 4M19 8l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  building: (
    <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="3" width="10" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M15 7h4v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8.5 7h3M8.5 11h3M8.5 15h3M18 11h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

export const Navbar = () => {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Se separa de `mobileOpen` para que el panel se monte fuera de pantalla y
  // entre deslizándose. Si se animara con el mismo estado, el navegador pinta
  // el estado final directamente y no hay transición que valga.
  const [entrada, setEntrada] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Cerrar menús al cambiar de página
  useEffect(() => {
    setMobileOpen(false);
    setOpenMenu(null);
  }, [pathname]);

  // Con el panel abierto, la página de detrás no debe moverse: en móvil, si el
  // fondo hace scroll bajo el dedo, se pierde el sitio donde se estaba.
  useEffect(() => {
    if (!mobileOpen) return;

    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Dos fotogramas, no uno. Con uno solo el callback corre ANTES del primer
    // pintado, así que el navegador nunca llega a dibujar el panel fuera de
    // pantalla: no hay estado inicial del que partir y aparece de golpe en su
    // sitio. El segundo garantiza que el arranque ya se ha pintado.
    let t = 0;
    const primero = requestAnimationFrame(() => {
      t = requestAnimationFrame(() => setEntrada(true));
    });

    // El rearme de `entrada` va aquí y no arriba: si se hiciera en el cuerpo
    // del efecto sería un setState en cada render con el menú cerrado. Al
    // cerrar hay que dejarlo en `false`, o la próxima apertura aparecería de
    // golpe en su sitio en vez de entrar deslizándose.
    return () => {
      cancelAnimationFrame(primero);
      cancelAnimationFrame(t);
      setEntrada(false);
      document.body.style.overflow = overflowPrevio;
    };
  }, [mobileOpen]);

  const renderMega = (menu: OpenMenu) => {
    const items = menu === "Servicios" ? servicesMega : sectorsMega;
    return (
      <div
        className="absolute left-1/2 top-full z-40 w-[min(1100px,calc(100vw-32px))] -translate-x-1/2 pt-3"
        onMouseLeave={() => setOpenMenu(null)}
      >
        <div className="card rounded-3xl border border-border bg-card/95 p-6 shadow-2xl">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group flex gap-3 rounded-2xl p-3 transition hover:-translate-y-1 hover:bg-card"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  {icons[item.icon as keyof typeof icons]}
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-foreground">{item.title}</div>
                  <p className="text-xs text-foreground/60">{item.description}</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-accent/10 px-4 py-3 text-sm text-foreground">
            <span className="font-semibold">
              {menu === "Servicios"
                ? "Explora el detalle de todos nuestros servicios."
                : "Casos y soluciones por sector con KPIs clave."}
            </span>
            <Link href={menu === "Servicios" ? "/servicios" : "/sectores"} className="text-accent hover:text-accent-light transition">
              Ver todos →
            </Link>
          </div>
        </div>
      </div>
    );
  };

  const desktopNav = (
    <nav className="relative hidden items-center gap-2 text-sm font-semibold md:flex">
      {navigation.map((item) => {
        const active =
          pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

        if (item.type === "mega") {
          const isOpen = openMenu === item.label;
          return (
            <div key={item.label} className="relative">
              <button
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-2 transition hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  active && "bg-accent/10 text-accent-strong"
                )}
                aria-haspopup="true"
                aria-expanded={isOpen}
                onMouseEnter={() => setOpenMenu(item.label as OpenMenu)}
                onFocus={() => setOpenMenu(item.label as OpenMenu)}
              >
                {item.label}
                <span
                  className={cn(
                    "text-xs transition",
                    isOpen ? "rotate-180 text-accent" : "rotate-0 text-muted"
                  )}
                  aria-hidden
                >
                  ▾
                </span>
              </button>
              {isOpen && renderMega(item.label as OpenMenu)}
            </div>
          );
        }

        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "rounded-full px-3 py-2 transition hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              active && "bg-accent/10 text-accent-strong"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  /* ── Menú móvil ─────────────────────────────────────────────────────────
     Antes era un desplegable colgado de la cabecera (`absolute top-full`,
     `max-h-[75vh]`). Eso significaba que por detrás y por los lados seguía
     viéndose el hero a medio tapar, que la barra de los tres logos del grupo
     asomaba por arriba, que el fondo seguía haciendo scroll bajo el dedo y
     que el botón de WhatsApp —que es `fixed`— se plantaba encima del menú.
     Parecía que la página se hubiera roto al abrirlo.

     Ahora es un panel lateral de verdad: ocupa la pantalla entera por encima
     de todo, con velo detrás, la navegación se lee de una vez y las llamadas
     a la acción quedan ancladas abajo donde llega el pulgar.

     Va en un portal a <body> y no dentro del <header>. El header es
     `sticky z-50`, o sea que abre su PROPIO contexto de apilamiento: metido
     ahí dentro, el z-100 del panel solo compite contra sus hermanos del
     header y pierde contra cualquier `fixed` de fuera. Eso es lo que hacía
     que el botón de WhatsApp (fixed, z-50) saliera flotando encima del menú.
     Fuera del header, el z-100 vale de verdad. */
  const mobileMenu = mobileOpen ? (
    <div
      className="fixed inset-0 z-[100] md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Menú de navegación"
    >
      {/* Velo. Es un botón y no un div para que cerrar tocando fuera también
          funcione con teclado y con lector de pantalla. */}
      <button
        type="button"
        aria-label="Cerrar menú"
        onClick={() => setMobileOpen(false)}
        className={cn(
          "absolute inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-sm transition-opacity duration-200",
          entrada ? "opacity-100" : "opacity-0"
        )}
      />

      {/* El deslizamiento va en `style` y no con `translate-x-*` a propósito.
          En globals.css hay un `* { transition-property: ... }` SIN capa que
          gana a la utilidad `transition-transform`, y las utilidades de
          desplazamiento de Tailwind v4 escriben la propiedad `translate`, que
          no está en esa lista: el panel aparecía de golpe en su sitio. Con
          `transform` en línea sí entra. El bloque de movimiento reducido lleva
          `!important`, así que sigue ganando a esto y ahí no se mueve nada. */}
      <div
        className="absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col border-l border-border bg-background shadow-2xl"
        style={{
          transform: entrada ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Cabecera del panel: la marca a la izquierda y el cierre a la
            derecha, con el hueco de la barra de estado del móvil respetado. */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
          <Logo />
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMobileOpen(false)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Cuerpo. `overscroll-contain` evita que al llegar al final el scroll
            se lo trague la página de detrás. */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6">
          <div className="space-y-8">
            {navigation.map((item) => {
              if (item.type !== "mega") return null;
              const list = item.label === "Servicios" ? servicesMega : sectorsMega;
              return (
                <div key={item.label}>
                  <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-border/60 pb-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
                      {item.label}
                    </span>
                    <Link
                      href={item.href}
                      className="shrink-0 text-[13px] font-semibold text-accent transition hover:text-accent-light"
                      onClick={() => setMobileOpen(false)}
                    >
                      Ver todos →
                    </Link>
                  </div>
                  <div className="-mx-2">
                    {list.map((link) => (
                      <Link
                        key={link.title}
                        href={link.href}
                        className="flex items-start gap-3 rounded-xl px-2 py-3 transition hover:bg-card active:bg-card"
                        onClick={() => setMobileOpen(false)}
                      >
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                          {icons[link.icon as keyof typeof icons]}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[15px] font-semibold leading-tight text-foreground">
                            {link.title}
                          </span>
                          <span className="mt-1 block text-[13px] leading-snug text-muted">
                            {link.description}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}

            <div>
              <div className="mb-1 border-b border-border/60 pb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
                La empresa
              </div>
              <div className="-mx-2">
                {navigation
                  .filter((item) => item.type !== "mega")
                  .map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="flex items-center justify-between gap-3 rounded-xl px-2 py-3.5 text-[15px] font-semibold text-foreground transition hover:bg-card active:bg-card"
                      onClick={() => setMobileOpen(false)}
                    >
                      {item.label}
                      <span className="text-muted" aria-hidden>
                        →
                      </span>
                    </Link>
                  ))}
              </div>
            </div>

            {/* Los tres logos del grupo. Arriba viven en una barra propia que
                este panel tapa entera, así que si no estuvieran aquí, con el
                menú abierto no habría forma de llegar a Asesoría ni a
                Correbin. */}
            <div>
              <div className="mb-3 border-b border-border/60 pb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
                Grupo Gesmeco
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {EMPRESAS_GRUPO.map((e) => (
                  <Link
                    key={e.href}
                    href={e.href}
                    title={e.marca.nombre}
                    className="rounded-md opacity-90 transition hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    onClick={() => setMobileOpen(false)}
                  >
                    <LogoEmpresa marca={e.marca} alto={20} placa="compacta" ajusta />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Pie anclado. El `onClick` va en el contenedor porque `Button` con
            `href` no acepta manejadores: si alguien pulsa «Contacto» estando
            ya en /contacto, la ruta no cambia y sin esto el panel se quedaría
            abierto para siempre. */}
        <div
          className="shrink-0 space-y-2.5 border-t border-border bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4"
          onClick={() => setMobileOpen(false)}
        >
          <Button href="/contacto" variant="primary" size="md" className="w-full justify-center">
            Solicitar estudio
          </Button>
          <div className="grid grid-cols-2 gap-2.5">
            <Button href="/contacto" variant="ghost" size="md" className="w-full justify-center">
              Contacto
            </Button>
            <Button href="/cliente" variant="ghost" size="md" className="w-full justify-center">
              Mi cuenta
            </Button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  // El portal solo se monta tras una pulsación, así que `document` existe
  // siempre que se llega aquí; en el render del servidor `mobileMenu` es null.
  const mobileMenuPortal =
    mobileMenu && typeof document !== "undefined"
      ? createPortal(mobileMenu, document.body)
      : null;

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-border bg-surface/95 transition-shadow",
        "relative",
        scrolled && "shadow-lg shadow-black/10"
      )}
    >
      {/* ── Barra superior · Grupo Gesmeco ──────────────────────────────────
          Aquí había tres enlaces de texto con un emoji delante (⚡ 📋 🛡️).
          Un emoji genérico delante del nombre de una empresa no la representa:
          la representa su logotipo, que además es lo que la gente reconoce de
          la furgoneta y del papel. Ahora van los tres logos de verdad y cada
          uno lleva a SU página —Correbin apuntaba a /grupo, que no es la
          suya— sobre la misma placa clara que en el resto del sitio, porque
          los tres tienen el texto en negro y sobre el fondo oscuro
          desaparecería medio logo. */}
      <div className="border-b border-border/60 bg-background/80">
        <Container className="flex items-center justify-between gap-4 py-2">
          <span className="hidden text-[11px] font-bold uppercase tracking-[0.2em] text-muted sm:block">
            Grupo Gesmeco
          </span>
          <nav aria-label="Empresas del grupo" className="flex items-center gap-3 overflow-x-auto sm:gap-4">
            {EMPRESAS_GRUPO.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                title={e.marca.nombre}
                className="shrink-0 rounded-md opacity-80 transition hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {/* Sin `prioritario` entran como `lazy`, y son tres imágenes
                    de 2 KB que están arriba del todo en TODAS las páginas:
                    diferirlas solo consigue que la cabecera se dibuje a
                    trozos. */}
                <LogoEmpresa marca={e.marca} alto={17} placa="compacta" ajusta prioritario />
              </Link>
            ))}
          </nav>
        </Container>
      </div>

      <Container className="flex items-center justify-between py-4">
        <Logo />

        {desktopNav}

        <div className="hidden items-center gap-3 md:flex">
          <Button href="/cliente" variant="ghost" size="md">
            Mi cuenta
          </Button>
          <Button href="/contacto" variant="ghost" size="md">
            Contacto
          </Button>
          <Button href="/contacto" variant="accent" size="md">
            Solicitar estudio
          </Button>
        </div>

        {/* El disco blanco con un glifo ✕/☰ dentro cantaba mucho sobre la
            cabecera oscura y el tamaño del símbolo dependía de la fuente del
            móvil. Ahora es un icono dibujado, del color del resto de la
            cabecera. El aspa la pone el propio panel, así que aquí solo hace
            falta abrir. */}
        <button
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-foreground transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:hidden"
          aria-label="Abrir menú"
          aria-expanded={mobileOpen}
          aria-haspopup="dialog"
          onClick={() => setMobileOpen(true)}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </Container>
      {mobileMenuPortal}
    </header>
  );
};
