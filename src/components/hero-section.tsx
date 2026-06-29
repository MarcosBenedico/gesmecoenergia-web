'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { heroStats, differentiators } from '@/lib/data';

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

/* ── Animated progress bar ── */
function EnergyBar({ label, value, colorClass, delay }: { label: string; value: number; colorClass: string; delay: number }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums font-bold text-foreground">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border/40">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${colorClass}`}
          style={{ width: `${w}%` }}
        />
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

const BARS = [
  { label: 'Potencia contratada optimizable', value: 35, colorClass: 'bg-secondary shadow-[0_0_8px_rgba(0,212,255,0.6)]' },
  { label: 'Ahorro en tarifa actual', value: 22, colorClass: 'bg-accent shadow-[0_0_8px_rgba(255,51,51,0.6)]' },
  { label: 'Cambio a mejor comercializadora', value: 18, colorClass: 'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.6)]' },
];

const METRICS = [
  { label: 'Facturas analizadas', value: '2.400+', icon: '⚡', border: 'border-secondary/30', bg: 'bg-secondary/5', text: 'text-secondary' },
  { label: 'Ahorro medio detectado', value: '€2.500', icon: '💰', border: 'border-accent/30', bg: 'bg-accent/5', text: 'text-accent' },
  { label: 'Clientes satisfechos', value: '120+', icon: '✓', border: 'border-amber-400/30', bg: 'bg-amber-400/5', text: 'text-amber-400' },
  { label: 'Instalaciones realizadas', value: '15+', icon: '☀️', border: 'border-purple-400/30', bg: 'bg-purple-400/5', text: 'text-purple-400' },
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
                Asesoría Energética · Bienfar
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
                <span className="text-secondary">Bienfar</span>
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
              <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-accent">
                    ⚡ Monitor Energético
                  </p>
                  <p className="mt-0.5 text-base font-black text-foreground">Panel en tiempo real</p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-secondary">ACTIVO</span>
                </div>
              </div>

              <div className="space-y-4 p-5">
                {/* Progress bars */}
                <div className="space-y-3">
                  {BARS.map((bar, i) => (
                    <EnergyBar
                      key={bar.label}
                      label={bar.label}
                      value={bar.value}
                      colorClass={bar.colorClass}
                      delay={600 + i * 200}
                    />
                  ))}
                </div>

                <div className="h-px bg-border/30" />

                {/* Live metric grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  {METRICS.map((m) => (
                    <div
                      key={m.label}
                      className={`group cursor-default rounded-xl border ${m.border} ${m.bg} p-3 transition-all duration-200 hover:scale-[1.04]`}
                    >
                      <div className="text-base">{m.icon}</div>
                      <div className={`mt-0.5 text-lg font-black ${m.text}`}>{m.value}</div>
                      <div className="mt-0.5 text-[10px] font-medium leading-tight text-muted">{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* SLA */}
                <div className="flex items-center justify-between rounded-xl border border-accent/25 bg-gradient-to-r from-accent/10 to-secondary/10 p-4">
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-accent">
                      ⏱ SLA garantizado
                    </p>
                    <p className="text-sm font-semibold text-foreground">Respuesta en &lt; 24h</p>
                  </div>
                  <div className="rounded-full bg-gradient-to-r from-accent to-secondary px-3 py-1.5 text-xs font-black text-white shadow-md">
                    24/7
                  </div>
                </div>

                {/* Differentiators */}
                <div className="space-y-1.5">
                  {differentiators.slice(0, 3).map((d, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-muted">
                      <span className="mt-0.5 shrink-0 font-bold text-accent">✓</span>
                      <span>{d.split('.')[0]}.</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
