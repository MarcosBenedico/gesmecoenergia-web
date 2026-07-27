'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { heroStats } from '@/lib/data';

/* ══════════════════════════════════════════════════════════════════════════
   CIFRAS QUE CUENTAN

   Antes el contador iba con `setInterval(…, 16)` y `Date.now()`. Dos
   problemas: 16 ms no está sincronizado con el repintado (unos fotogramas se
   comen dos pasos y otros ninguno, y se ve a tirones), y el intervalo sigue
   corriendo con la pestaña de fondo. `requestAnimationFrame` va al ritmo de la
   pantalla y el navegador lo frena solo cuando nadie mira.
══════════════════════════════════════════════════════════════════════════ */

/**
 * Parte "4.5 GW", "15-40%" o "15+" en número, prefijo, sufijo y decimales.
 *
 * Ojo con el "+": la versión anterior lo borraba con
 * `raw.replace(/[+<>]/g, '')` y luego no lo devolvía, así que el dato decía
 * "15+ proyectos" y en pantalla se leía "15". Un dato distinto del que puso
 * quien escribió el contenido.
 */
function partirCifra(bruto: string) {
  // Una horquilla NO se anima. Contando, "15-40%" pasa por "15–0%", "15–12%",
  // "15–23%"... y cada uno de esos fotogramas es una promesa de ahorro
  // distinta y falsa. En una casa que vende números honestos, el número que
  // se lee en pantalla tiene que ser verdad en todo momento.
  if (bruto.includes('-') && bruto.includes('%')) {
    const [desde, hasta] = bruto.replace('%', '').split('-');
    return { num: 0, fijo: `${desde}–${hasta}%`, prefijo: '', sufijo: '', decimales: 0 };
  }
  const prefijo = bruto.startsWith('+') ? '+' : '';
  const m = bruto.replace(/^[+<>]/, '').match(/^(\d+(?:\.\d+)?)(.*)$/);
  if (!m) return { num: 0, fijo: bruto, prefijo: '', sufijo: '', decimales: 0 };
  return {
    num: parseFloat(m[1]),
    fijo: null as string | null,
    prefijo,
    sufijo: m[2],
    // Se cuenta con los mismos decimales que tiene el destino: si el dato es
    // "15", contar "6.9 · 11.2 · 15" queda descuidado.
    decimales: m[1].includes('.') ? m[1].split('.')[1].length : 0,
  };
}

function useCuenta(destino: number, decimales: number, arranca: boolean, duracion = 1600) {
  const [valor, setValor] = useState(0);

  useEffect(() => {
    if (!arranca || destino === 0) return;

    // Con «reducir movimiento» se salta al valor final en el primer fotograma.
    // Se hace dentro del rAF y no aquí mismo: un setState suelto en el cuerpo
    // del efecto provoca renders en cascada, y además el servidor pinta 0 y
    // el cliente pintaría el total, que es un desajuste de hidratación.
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let id = 0;
    let inicio = 0;
    const paso = (ahora: number) => {
      if (!inicio) inicio = ahora;
      const p = quieto ? 1 : Math.min((ahora - inicio) / duracion, 1);
      const suave = 1 - Math.pow(1 - p, 3);
      setValor(parseFloat((suave * destino).toFixed(decimales)));
      if (p < 1) id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [destino, decimales, arranca, duracion]);

  return valor;
}

function CifraHero({ stat, arranca, retardo }: { stat: typeof heroStats[0]; arranca: boolean; retardo: number }) {
  const { num, fijo, prefijo, sufijo, decimales } = partirCifra(stat.value);
  const cuenta = useCuenta(num, decimales, arranca);

  return (
    <div
      className="foco entra group relative overflow-hidden rounded-2xl border border-border/50 bg-surface/60 p-4 backdrop-blur-sm transition-colors duration-300 hover:border-accent/40"
      style={{ '--d': `${520 + retardo}ms` } as React.CSSProperties}
    >
      <div className="relative">
        {/* Se muestra el cero desde el principio y no un guion: el guion
            parecía «no hay dato» durante el medio segundo de la entrada. */}
        <div className="cifra text-2xl font-black leading-none text-foreground">
          {fijo ?? `${prefijo}${cuenta.toFixed(decimales)}${sufijo}`}
        </div>
        <div className="mt-1.5 text-[10px] font-bold uppercase tracking-widest text-accent">
          {stat.label}
        </div>
        <div className="mt-1 text-xs leading-snug text-muted">{stat.detail}</div>
      </div>
      {/* Barrita de progreso: cierra visualmente la cuenta cuando termina. */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-accent to-secondary transition-transform duration-[1.6s] ease-out"
        style={{ transform: arranca ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left' }}
      />
    </div>
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

export function HeroSection() {
  const [arranca, setArranca] = useState(false);

  useEffect(() => {
    // La entrada de la maqueta la hace el CSS (clase `.entra`), así que aquí
    // solo queda decidir cuándo empiezan a contar las cifras: cuando la
    // animación de entrada ya ha colocado las tarjetas.
    const t = setTimeout(() => setArranca(true), 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="relative flex min-h-svh items-center overflow-hidden pb-24 pt-20">
      {/* ── FONDO ── */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <Image
          src="/images/hero-solar.webp"
          alt="Instalación solar fotovoltaica al atardecer en el campo de Aragón"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Capas de legibilidad */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/35" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-transparent to-background" />

        {/* Rejilla y órbitas */}
        <div className="hero-grid absolute inset-0 opacity-50" />
        <div className="hero-orb-red absolute" />
        <div className="hero-orb-cyan absolute" />
        <div className="hero-orb-accent absolute" />

        {/* Barrido: una línea que recorre el hero de arriba abajo. La animación
            ya estaba escrita en globals.css y no se había llegado a usar. */}
        <div className="hero-scan absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-secondary/50 to-transparent" />

        {/* Escuadras de las esquinas */}
        <div className="absolute left-0 top-0 h-px w-64 bg-gradient-to-r from-accent/60 to-transparent" />
        <div className="absolute left-0 top-0 h-64 w-px bg-gradient-to-b from-accent/60 to-transparent" />
        <div className="absolute bottom-0 right-0 h-px w-64 bg-gradient-to-l from-secondary/60 to-transparent" />
        <div className="absolute bottom-0 right-0 h-64 w-px bg-gradient-to-t from-secondary/60 to-transparent" />
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-6">
        <div className="grid items-center gap-12 xl:grid-cols-[1.15fr_0.85fr]">
          {/* ── COLUMNA IZQUIERDA ── */}
          <div className="space-y-8">
            {/* Chapa */}
            <div className="entra inline-flex items-center gap-3 rounded-full border border-accent/25 bg-accent/10 px-4 py-2 backdrop-blur-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
              <span className="text-sm font-bold uppercase tracking-widest text-accent">
                Asesoría Energética · Binéfar
              </span>
            </div>

            {/* Titular: cada línea sube desde su propia máscara, en cascada.
                El tamaño lo fija `.titular-hero` en globals.css con clamp().

                El degradado animado va en un span de DENTRO, no en el que se
                mueve: los dos usan la propiedad `animation` y, al competir en
                el mismo elemento, la de la máscara ganaba por especificidad y
                el degradado se quedaba quieto. */}
            <h1 className="titular-hero font-black">
              <span className="linea-titular">
                <span style={{ '--d': '120ms' } as React.CSSProperties}>
                  <span className="gradient-text-animated">Tu asesor</span>
                </span>
              </span>
              <span className="linea-titular">
                <span className="text-foreground" style={{ '--d': '220ms' } as React.CSSProperties}>
                  energético
                </span>
              </span>
              <span className="linea-titular">
                <span style={{ '--d': '320ms' } as React.CSSProperties}>
                  <span className="text-foreground">en </span>
                  <span className="text-secondary">Binéfar</span>
                  <span className="text-foreground">.</span>
                </span>
              </span>
            </h1>

            <p
              className="entra max-w-xl text-lg leading-relaxed text-muted"
              style={{ '--d': '420ms' } as React.CSSProperties}
            >
              Analizamos tu factura de luz y gas.{' '}
              <span className="font-semibold text-foreground">Ahorros reales del 15–40%</span>{' '}
              en empresas, ganaderos y hogares de la zona.
            </p>

            {/* Llamadas a la acción */}
            <div
              className="entra flex flex-wrap items-center gap-4"
              style={{ '--d': '480ms' } as React.CSSProperties}
            >
              <Link
                href="/analizador"
                className="btn-hero-primary inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-light px-8 py-4 text-base font-bold text-white shadow-lg transition-all duration-300 hover:scale-[1.04] hover:shadow-[0_0_40px_rgba(255,51,51,0.5)]"
              >
                🚀 Analizar mi factura
              </Link>
              <Link
                href="/servicios"
                className="inline-flex items-center gap-2 rounded-xl border border-foreground/20 bg-foreground/5 px-7 py-4 text-base font-bold text-foreground backdrop-blur-sm transition-all duration-300 hover:border-accent/50 hover:bg-accent/10 hover:text-accent"
              >
                Ver servicios →
              </Link>
              <p className="text-sm">
                <span className="font-bold text-secondary">✓ 100% gratis</span>
                <span className="text-muted"> · Sin compromiso</span>
              </p>
            </div>

            {/* Cifras */}
            <div className="grid gap-3 sm:grid-cols-3">
              {heroStats.map((stat, i) => (
                <CifraHero key={stat.label} stat={stat} arranca={arranca} retardo={i * 110} />
              ))}
            </div>
          </div>

          {/* ── COLUMNA DERECHA · panel del grupo ── */}
          <div
            className="entra-dcha relative"
            style={{ '--d': '340ms' } as React.CSSProperties}
          >
            {/* Halo */}
            <div className="absolute -inset-6 rounded-3xl bg-gradient-to-r from-accent/20 to-secondary/20 blur-3xl" />

            <div className="dashboard-card relative overflow-hidden rounded-3xl border border-accent/20 bg-card/85 shadow-[0_0_60px_rgba(255,51,51,0.12)] backdrop-blur-xl">
              {/* Franja superior animada */}
              <div
                className="h-[2px] w-full"
                style={{
                  background: 'linear-gradient(90deg, #ff3333, #00d4ff, #ff9500, #ff3333)',
                  backgroundSize: '300% 100%',
                  animation: 'stripe-flow 4s linear infinite',
                }}
              />

              {/* Cabecera */}
              <div className="border-b border-border/40 px-6 py-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-accent">
                  Grupo Gesmeco
                </p>
                <p className="mt-1 text-lg font-black leading-tight text-foreground">
                  Un solo equipo para tu empresa, tu granja y tu casa
                </p>
                <p className="mt-1 text-xs text-muted">
                  Tres áreas de servicio desde Binéfar, con el mismo trato de siempre.
                </p>
              </div>

              <div className="space-y-3 p-4">
                {GRUPO_EMPRESAS.map((empresa) => (
                  <Link
                    key={empresa.nombre}
                    href={empresa.href}
                    className={`foco group block rounded-2xl border ${empresa.border} ${empresa.bg} p-4 transition-all duration-300 hover:-translate-y-0.5 ${empresa.hoverShadow}`}
                  >
                    <div className="relative flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${empresa.iconBg} text-lg transition-transform duration-300 group-hover:scale-110`}>
                          {empresa.icono}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
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

              {/* Pie */}
              <div className="flex items-center justify-between gap-3 border-t border-border/40 px-6 py-4">
                <p className="text-xs text-muted">Avenida de Aragón, 50 · Binéfar</p>
                <Link
                  href="/grupo"
                  className="enlace-vivo whitespace-nowrap text-xs font-bold text-accent transition hover:text-accent-light"
                >
                  Conocer el grupo →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── AVISO DE QUE HAY MÁS ABAJO ──
          Una pantalla completa sin ninguna señal de que sigue es la forma más
          barata de perder a alguien en el primer segundo. */}
      <div
        className="baja-la-vista entra pointer-events-none absolute inset-x-0 bottom-6 hidden justify-center md:flex"
        style={{ '--d': '1200ms' } as React.CSSProperties}
        aria-hidden
      >
        <span className="flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-[0.3em] text-muted">
          Sigue
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </section>
  );
}
