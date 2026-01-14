'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { Logo } from "@/components/logo";
import { navigation, servicesMega, sectorsMega } from "@/lib/site";
import { cn } from "@/lib/utils";

type OpenMenu = "Servicios" | "Sectores" | null;

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

  const renderMega = (menu: OpenMenu) => {
    const items = menu === "Servicios" ? servicesMega : sectorsMega;
    return (
      <div
        className="absolute left-1/2 top-full z-40 w-[min(1100px,calc(100vw-32px))] -translate-x-1/2 pt-3"
        onMouseLeave={() => setOpenMenu(null)}
      >
        <div className="card rounded-3xl border border-white/70 bg-white/95 p-6 shadow-2xl backdrop-blur">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group flex gap-3 rounded-2xl p-3 transition hover:-translate-y-1 hover:bg-emerald-50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-accent">
                  {icons[item.icon as keyof typeof icons]}
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-foreground">{item.title}</div>
                  <p className="text-xs text-muted">{item.description}</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-foreground">
            <span className="font-semibold">
              {menu === "Servicios"
                ? "Explora el detalle de todos nuestros servicios."
                : "Casos y soluciones por sector con KPIs clave."}
            </span>
            <Link href={menu === "Servicios" ? "/servicios" : "/sectores"} className="text-accent hover:underline">
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
                  active && "bg-emerald-50 text-accent-strong"
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
              active && "bg-emerald-50 text-accent-strong"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const mobileMenu = (
    <div
      className={cn(
        "md:hidden",
        mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      <div className="mt-3 rounded-2xl border border-emerald-100 bg-white/95 p-4 shadow-xl backdrop-blur transition">
        <div className="space-y-3">
          {navigation.map((item) => {
            if (item.type === "mega") {
              const list = item.label === "Servicios" ? servicesMega : sectorsMega;
              return (
                <div key={item.label} className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                    {item.label}
                  </div>
                  <div className="space-y-2">
                    {list.map((link) => (
                      <Link
                        key={link.title}
                        href={link.href}
                        className="flex items-start gap-2 rounded-xl bg-emerald-50/60 px-3 py-2 text-sm text-foreground transition hover:bg-emerald-50"
                        onClick={() => setMobileOpen(false)}
                      >
                        <div className="mt-0.5">{icons[link.icon as keyof typeof icons]}</div>
                        <div>
                          <div className="font-semibold">{link.title}</div>
                          <p className="text-xs text-muted">{link.description}</p>
                        </div>
                      </Link>
                    ))}
                    <Link
                      href={item.href}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-accent"
                      onClick={() => setMobileOpen(false)}
                    >
                      Ver todos →
                    </Link>
                  </div>
                </div>
              );
            }
            return (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-emerald-50"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
                <span className="text-xs text-muted">↗</span>
              </Link>
            );
          })}
          <div className="flex flex-col gap-2 pt-2">
            <Button href="/contacto" size="md">
              Contacto
            </Button>
            <Button href="/contacto" variant="primary" size="md">
              Solicitar estudio
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-white/60 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70 transition-shadow",
        scrolled && "shadow-md"
      )}
    >
      <Container className="flex items-center justify-between py-4">
        <Logo />

        {desktopNav}

        <div className="hidden items-center gap-2 md:flex">
          <Button href="/contacto" variant="ghost" size="md" className="border border-emerald-100">
            Contacto
          </Button>
          <Button href="/contacto" variant="primary" size="md">
            Solicitar estudio
          </Button>
        </div>

        <button
          className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-100 bg-white text-foreground transition hover:border-accent md:hidden"
          aria-label="Abrir menú"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span className="text-xl">{mobileOpen ? "✕" : "☰"}</span>
        </button>
      </Container>
      <Container>{mobileMenu}</Container>
    </header>
  );
};
