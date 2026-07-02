'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { heroStats } from '@/lib/data';

/* ── Count-up hook ── */
function useCountUp(end: number, duration = 1800, started = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!started || end === 0) return;
    const startTime = Date.now();
    const id = setInterval(() => {
      const p = Math.min((Date.now() - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(parseFloat((eased * end).toFixed(1)));
      if (p >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [end, duration, started]);
  return val;
}

/* ── Parse "4.5 GW", "15-40%", "15+" ── */
function parseStat(raw: string) {
  if (raw.includes('-') && raw.includes('%')) return { num: 40, prefix: '15–', suffix: '%' };
  const prefix = raw.startsWith('+') ? '+' : '';
  const clean = raw.replace(/[+<>]/g, '');
  const m = clean.match(/^(\d+\.?\d*)(.*)/);
  return { num: m ? parseFloat(m[1]) : 0, prefix, suffix: m ? m[2] : '' };
}

function AnimatedStat({ stat, started, delay }: { stat: typeof heroStats[0]; started: boolean; delay: number }) {
  const { num, prefix, suffix } = parseStat(stat.value);
  const count = useCountUp(num, 1800, started);
  const display = `${prefix}${count}${suffix}`;

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-border/50 bg-surface/60 p-4 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:border-accent/40 hover:bg-surface/80"
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-secondary/5 opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative">
        <div className="tabular-nums text-2xl font-black text-foreground">
          {started ? display : '—'}
        </div>
        <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-accent">
          {stat.label}
        </div>
        <div className="mt-1 text-xs leading-snug text-muted">{stat.detail}</div>
      </div>
    </div>
  );
}

/* ── Floating particle ── */
function Particle({ style }: { style: React.CSSProperties }) {
  return (
    <div
      className="absolute h-1 w-1 rounded-full bg-accent/40"
      style={style}
    />
  );
}

/* ── Empresas del Grupo Gesmeco (panel derecho del hero) ── */
const GRUPO_EMPRESAS = [
  {
    nombre: 'Gesmeco Energía',
    area: 'Energía',
    icono: '⚡',
    resumen:
      'Análisis de tu factura de luz y gas, auditorías energéticas y solar fotovoltaica para hogares, granjas y empresas.',
    href: '/servicios',
    border: 'border-accent/25',
    bg: 'bg-accent/5',
    iconBg: 'bg-accent/15',
    chip: 'bg-accent/15 text-accent',
    arrow: 'text-accent',
    hoverShadow: 'hover:border-accent/50 hover:shadow-[0_8px_30px_rgba(255,51,51,0.15)]',
  },
  {
    nombre: 'Asesoría Gesmeco',
    area: 'Asesoría',
    icono: '📋',
    resumen:
      'Fiscal, laboral, contable y administrativa. Impuestos, nóminas y trámites resueltos para autónomos y empresas.',
    href: '/grupo',
    border: 'border-tertiary/25',
    bg: 'bg-tertiary/5',
    iconBg: 'bg-tertiary/15',
    chip: 'bg-tertiary/15 text-tertiary',
    arrow: 'text-tertiary',
    hoverShadow: 'hover:border-tertiary/50 hover:shadow-[0_8px_30px_rgba(255,149,0,0.15)]',
  },
  {
    nombre: 'Correbin Asociados',
    area: 'Seguros',
    icono: '🛡️',
    resumen:
      'Correduría de seguros: hogar, vehículos, empresa y sector agrario-ganadero. Revisamos tus pólizas sin coste.',
    href: '/grupo',
    border: 'border-secondary/25',
    bg: 'bg-secondary/5',
    iconBg: 'bg-secondary/15',
    chip: 'bg-secondary/15 text-secondary',
    arrow: 'text-secondary',
    hoverShadow: 'hover:border-secondary/50 hover:shadow-[0_8px_30px_rgba(0,212,255,0.15)]',
  },
];

const PARTICLES = [
  { top: '15%', left: '5%', animationDelay: '0s', animationDuration: '6s' },
  { top: '70%', left: '8%', animationDelay: '1s', animationDuration: '8s' },
  { top: '40%', left: '92%', animationDelay: '2s', animationDuration: '7s' },
  { top: '85%', left: '85%', animationDelay: '0.5s', animationDuration: '9s' },
  { top: '25%', left: '75%', animationDelay: '3s', animationDuration: '5s' },
  { top: '60%', left: '50%', animationDelay: '1.5s', animationDuration: '10s' },
  { top: '10%', left: '60%', animationDelay: '4s', animationDuration: '7s' },
  { top: '90%', left: '30%', animationDelay: '2.5s', animationDuration: '6s' },
];

export function HeroSection() {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="relative flex min-h-screen items-center overflow-hidden pb-16 pt-20">
      {/* ── BACKGROUND ── */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {/* Animated grid */}
        <div className="hero-grid absolute inset-0" />

        {/* Glowing orbs */}
        <div className="hero-orb-red absolute" />
        <div className="hero-orb-cyan absolute" />
        <div className="hero-orb-accent absolute" />

        {/* Scan line */}
        <div className="hero-scan absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />

        {/* Floating particles */}
        {PARTICLES.map((p, i) => (
          <Particle
            key={i}
            style={{
              top: p.top,
              left: p.left,
              animation: `particle-float ${p.animationDuration} ease-in-out ${p.animationDelay} infinite`,
            }}
          />
        ))}

        {/* Corner accent lines */}
        <div className="absolute left-0 top-0 h-px w-64 bg-gradient-to-r from-accent/60 to-transparent" />
        <div className="absolute left-0 top-0 h-64 w-px bg-gradient-to-b from-accent/60 to-transparent" />
        <div className="absolute bottom-0 right-0 h-px w-64 bg-gradient-to-l from-secondary/60 to-transparent" />
        <div className="absolute bottom-0 right-0 h-64 w-px bg-gradient-to-t from-secondary/60 to-transparent" />
      </div>

      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="grid items-center gap-12 xl:grid-cols-[1.15fr_0.85fr]">
          {/* ── LEFT COLUMN ── */}
          <div
            className="space-y-8"
            style={{
              opacity: started ? 1 : 0,
              transform: started ? 'translateY(0)' : 'translateY(24px)',
              transition: 'opacity 0.9s ease, transform 0.9s ease',
            }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-3 rounded-full border border-accent/25 bg-accent/10 px-4 py-2 backdrop-blur-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
              <span className="text-sm font-bold uppercase tracking-widest text-accent">
                Asesoría Energética · Binéfar
              </span>
            </div>

            {/* Headline */}
            <div className="space-y-1">
              <h1 className="font-black leading-[1.05] text-5xl md:text-6xl lg:text-7xl">
                <span className="gradient-text-animated">Tu asesor</span>
                <br />
                <span className="text-foreground">energético</span>
                <br />
                <span className="text-foreground">en </span>
                <span className="text-secondary">Binéfar</span>
                <span className="text-foreground">.</span>
              </h1>
            </div>

            <p className="max-w-xl text-lg leading-relaxed text-muted">
              Analizamos tu factura de luz y gas.{' '}
              <span className="font-semibold text-foreground">Ahorros reales del 15–40%</span>{' '}
              en empresas, ganaderos y hogares de la zona.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/analizador"
                className="btn-hero-primary inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-light px-8 py-4 text-base font-bold text-white shadow-lg transition-all duration-300 hover:scale-[1.04] hover:shadow-[0_0_40px_rgba(255,51,51,0.5)]"
              >
                🚀 Analizar mi factura
              </Link>
              <Link
                href="/servicios"
                className="inline-flex items-center gap-2 rounded-xl border border-foreground/20 bg-foreground/5 px-7 py-4 text-base font-bold text-foreground backdrop-blur-sm transition-all duration-300 hover:border-accent/50 hover:text-accent hover:bg-accent/10"
              >
                Ver servicios →
              </Link>
              <p className="text-sm">
                <span className="font-bold text-secondary">✓ 100% gratis</span>
                <span className="text-muted"> · Sin compromiso</span>
              </p>
            </div>

            {/* Animated stats */}
            <div className="grid gap-3 sm:grid-cols-3">
              {heroStats.map((stat, i) => (
                <AnimatedStat key={stat.label} stat={stat} started={started} delay={i * 150} />
              ))}
            </div>
          </div>

          {/* ── RIGHT COLUMN – Dashboard ── */}
          <div
            className="relative"
            style={{
              opacity: started ? 1 : 0,
              transform: started ? 'translateY(0)' : 'translateY(32px)',
              transition: 'opacity 0.9s ease 0.25s, transform 0.9s ease 0.25s',
            }}
          >
            {/* Halo glow */}
            <div className="absolute -inset-6 rounded-3xl bg-gradient-to-r from-accent/20 to-secondary/20 blur-3xl" />

            <div className="dashboard-card relative overflow-hidden rounded-3xl border border-accent/20 bg-card/85 shadow-[0_0_60px_rgba(255,51,51,0.12)] backdrop-blur-xl">
              {/* Animated top stripe */}
              <div className="h-[2px] w-full" style={{
                background: 'linear-gradient(90deg, #ff3333, #00d4ff, #ff9500, #ff3333)',
                backgroundSize: '300% 100%',
                animation: 'stripe-flow 4s linear infinite',
              }} />

              {/* Header */}
              <div className="border-b border-border/40 px-6 py-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-accent">
                  Grupo Gesmeco
                </p>
                <p className="mt-1 text-lg font-black text-foreground leading-tight">
                  Un solo equipo para tu empresa, tu granja y tu casa
                </p>
                <p className="mt-1 text-xs text-muted">
                  Tres áreas de servicio desde Binéfar, con el mismo trato de siempre.
                </p>
              </div>

              <div className="p-4 space-y-3">
                {GRUPO_EMPRESAS.map((empresa) => (
                  <Link
                    key={empresa.nombre}
                    href={empresa.href}
                    className={`group block rounded-2xl border ${empresa.border} ${empresa.bg} p-4 transition-all duration-300 hover:-translate-y-0.5 ${empresa.hoverShadow}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${empresa.iconBg} text-lg`}>
                          {empresa.icono}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-foreground">
                              {empresa.nombre}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${empresa.chip}`}>
                              {empresa.area}
                            </span>
                          </div>
                          <p className="text-xs leading-relaxed text-muted">{empresa.resumen}</p>
                        </div>
                      </div>
                      <span
                        className={`mt-1 shrink-0 text-base transition-transform duration-300 group-hover:translate-x-1 ${empresa.arrow}`}
                        aria-hidden
                      >
                        →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Footer */}
              <div className="border-t border-border/40 px-6 py-4 flex items-center justify-between gap-3">
                <p className="text-xs text-muted">
                  Avenida de Aragón, 50 · Binéfar
                </p>
                <Link
                  href="/grupo"
                  className="text-xs font-bold text-accent transition hover:text-accent-light whitespace-nowrap"
                >
                  Conocer el grupo →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
