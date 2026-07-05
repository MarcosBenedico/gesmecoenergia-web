'use client';

import Link from 'next/link';
import { useRef, useEffect, useState } from 'react';
import { ScrollReveal } from '@/components/scroll-reveal';

/* ═══════════════════════════════════════════════════════════════
   Keyframes globales del showcase (prefijo g3d- para no chocar)
   ═══════════════════════════════════════════════════════════════ */
const KEYFRAMES = `
@keyframes g3d-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes g3d-orbit-rev { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
@keyframes g3d-float { 0%,100% { transform: translateY(0) rotateX(8deg); } 50% { transform: translateY(-14px) rotateX(8deg); } }
@keyframes g3d-ring { 0% { transform: scale(0.5); opacity: 0.9; } 100% { transform: scale(2.4); opacity: 0; } }
@keyframes g3d-pulse { 0%,100% { transform: scale(1); filter: brightness(1); } 50% { transform: scale(1.12); filter: brightness(1.5); } }
@keyframes g3d-sweep { 0% { transform: translateX(-120%); } 60%,100% { transform: translateX(220%); } }
@keyframes g3d-bar { 0%,100% { transform: scaleX(0.55); opacity: .5; } 50% { transform: scaleX(1); opacity: 1; } }
@keyframes g3d-spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes g3d-blink { 0%,100% { opacity: .25; } 50% { opacity: 1; } }
`;

/* ═══════════════════════════════════════════════════════════════
   TiltCard: rotación 3D + brillo que sigue al ratón
   ═══════════════════════════════════════════════════════════════ */
function TiltCard({
  children,
  glow,
  className = '',
}: {
  children: React.ReactNode;
  glow: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const sheen = sheenRef.current;
    if (!el || !sheen) return;

    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const rx = ((y - r.height / 2) / r.height) * -7;
      const ry = ((x - r.width / 2) / r.width) * 7;
      el.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(6px)`;
      el.style.boxShadow = `0 24px 70px rgba(0,0,0,.45), 0 0 80px ${glow}33`;
      sheen.style.opacity = '1';
      sheen.style.background = `radial-gradient(480px circle at ${x}px ${y}px, ${glow}1f, transparent 65%)`;
    };
    const leave = () => {
      el.style.transform = 'perspective(1200px) rotateX(0) rotateY(0) translateZ(0)';
      el.style.boxShadow = `0 14px 40px rgba(0,0,0,.35)`;
      sheen.style.opacity = '0';
    };

    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', leave);
    return () => {
      el.removeEventListener('mousemove', move);
      el.removeEventListener('mouseleave', leave);
    };
  }, [glow]);

  return (
    <div
      ref={ref}
      className={`relative transition-transform duration-200 will-change-transform ${className}`}
      style={{ transformStyle: 'preserve-3d', boxShadow: '0 14px 40px rgba(0,0,0,.35)' }}
    >
      <div
        ref={sheenRef}
        className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] opacity-0 transition-opacity duration-300"
      />
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VISUAL 1 · ENERGÍA: núcleo pulsante con electrones en órbita
   ═══════════════════════════════════════════════════════════════ */
function EnergiaVisual() {
  return (
    <div className="relative flex h-64 items-center justify-center md:h-full" style={{ perspective: '800px' }}>
      {/* Anillos de energía que se expanden */}
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute h-28 w-28 rounded-full border-2 border-[#ff3333]/50"
          style={{ animation: `g3d-ring 3s ease-out ${i * 1}s infinite` }}
        />
      ))}
      {/* Órbitas inclinadas (efecto átomo 3D) */}
      {[
        { rx: 65, dur: '6s', anim: 'g3d-orbit', delay: '0s' },
        { rx: -55, dur: '9s', anim: 'g3d-orbit-rev', delay: '-2s' },
        { rx: 20, dur: '12s', anim: 'g3d-orbit', delay: '-5s' },
      ].map((o, i) => (
        <div
          key={i}
          className="absolute h-48 w-48"
          style={{ transform: `rotateX(${o.rx}deg)`, transformStyle: 'preserve-3d' }}
        >
          <div
            className="absolute inset-0 rounded-full border border-[#ff3333]/25"
            style={{ animation: `${o.anim} ${o.dur} linear ${o.delay} infinite` }}
          >
            <span
              className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-[#ff5555]"
              style={{ boxShadow: '0 0 12px 3px rgba(255,51,51,.8)' }}
            />
          </div>
        </div>
      ))}
      {/* Núcleo */}
      <div
        className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full border border-[#ff3333]/40 bg-gradient-to-br from-[#2a0a0a] to-[#1a0505] text-5xl"
        style={{ animation: 'g3d-pulse 2.4s ease-in-out infinite', boxShadow: '0 0 50px rgba(255,51,51,.45), inset 0 0 25px rgba(255,51,51,.25)' }}
      >
        ⚡
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VISUAL 2 · ASESORÍA: documentos 3D flotando con líneas activas
   ═══════════════════════════════════════════════════════════════ */
function AsesoriaVisual() {
  const docs = [
    { z: 0, x: '-14%', delay: '0s', op: 0.45 },
    { z: 30, x: '0%', delay: '-1.3s', op: 0.75 },
    { z: 60, x: '14%', delay: '-2.6s', op: 1 },
  ];
  return (
    <div className="relative flex h-64 items-center justify-center md:h-full" style={{ perspective: '900px' }}>
      <div className="relative h-44 w-36" style={{ transformStyle: 'preserve-3d' }}>
        {docs.map((d, i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-xl border border-[#ff9500]/40 bg-gradient-to-br from-[#241703] to-[#160e02] p-4"
            style={{
              transform: `translateZ(${d.z}px) translateX(${d.x})`,
              opacity: d.op,
              animation: `g3d-float 4.5s ease-in-out ${d.delay} infinite`,
              boxShadow: '0 18px 40px rgba(0,0,0,.5), 0 0 30px rgba(255,149,0,.18)',
            }}
          >
            {/* Cabecera del documento */}
            <div className="mb-3 flex items-center gap-2">
              <span className="h-5 w-5 rounded-md bg-[#ff9500]/30 text-center text-[10px] leading-5">📋</span>
              <span className="h-2 w-14 origin-left rounded-full bg-[#ff9500]/50" style={{ animation: `g3d-bar 3s ease-in-out ${i * 0.4}s infinite` }} />
            </div>
            {/* Líneas de texto animadas */}
            {[0.9, 0.7, 0.95, 0.6, 0.8].map((w, j) => (
              <span
                key={j}
                className="mb-2 block h-1.5 origin-left rounded-full bg-[#ffb347]/35"
                style={{ width: `${w * 100}%`, animation: `g3d-bar 2.8s ease-in-out ${j * 0.35 + i * 0.2}s infinite` }}
              />
            ))}
            {/* Sello de validado */}
            {i === 2 && (
              <span
                className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full border-2 border-emerald-400/60 text-sm text-emerald-400"
                style={{ animation: 'g3d-blink 2.2s ease-in-out infinite' }}
              >
                ✓
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VISUAL 3 · SEGUROS: escudo con radar de protección
   ═══════════════════════════════════════════════════════════════ */
function SegurosVisual() {
  return (
    <div className="relative flex h-64 items-center justify-center md:h-full">
      {/* Ondas de radar */}
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="absolute h-24 w-24 rounded-full border border-[#00d4ff]/45"
          style={{ animation: `g3d-ring 4s ease-out ${i * 1}s infinite` }}
        />
      ))}
      {/* Anillo giratorio discontinuo */}
      <div
        className="absolute h-44 w-44 rounded-full border-2 border-dashed border-[#00d4ff]/30"
        style={{ animation: 'g3d-spin-slow 14s linear infinite' }}
      />
      {/* Puntos protegidos alrededor */}
      <div className="absolute h-56 w-56" style={{ animation: 'g3d-orbit-rev 20s linear infinite' }}>
        {['🏠', '🚗', '🏭', '🐄'].map((e, i) => (
          <span
            key={i}
            className="absolute flex h-9 w-9 items-center justify-center rounded-full border border-[#00d4ff]/40 bg-[#03202b] text-base"
            style={{
              top: `${50 + 46 * Math.sin((i * Math.PI) / 2)}%`,
              left: `${50 + 46 * Math.cos((i * Math.PI) / 2)}%`,
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 14px rgba(0,212,255,.35)',
            }}
          >
            {e}
          </span>
        ))}
      </div>
      {/* Escudo central */}
      <div
        className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full border border-[#00d4ff]/45 bg-gradient-to-br from-[#03202b] to-[#021018] text-5xl"
        style={{ animation: 'g3d-pulse 3s ease-in-out infinite', boxShadow: '0 0 50px rgba(0,212,255,.4), inset 0 0 25px rgba(0,212,255,.2)' }}
      >
        🛡️
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Datos de las empresas
   ═══════════════════════════════════════════════════════════════ */
const EMPRESAS = [
  {
    id: 'energía',
    nombre: 'Gesmeco Energía',
    area: 'Energía',
    claim: 'Que tu factura de luz deje de ser un misterio.',
    descripcion:
      'Analizamos tu factura línea a línea, auditamos tu instalación y diseñamos solar fotovoltaica a tu medida. Para hogares, granjas, comercios e industria.',
    servicios: [
      'Análisis y comparativa de factura de luz y gas',
      'Auditorías energéticas en tu instalación',
      'Solar fotovoltaica llave en mano',
      'Asesoramiento energético continuo',
    ],
    href: '/servicios',
    cta: 'Ver servicios de energía',
    glow: '#ff3333',
    text: 'text-[#ff5555]',
    chip: 'border-[#ff3333]/35 bg-[#ff3333]/12 text-[#ff5555]',
    dot: 'bg-[#ff3333]',
    grad: 'from-[#1c0808]/90 via-card/80 to-card/70',
    border: 'border-[#ff3333]/25',
    Visual: EnergiaVisual,
  },
  {
    id: 'asesoría',
    nombre: 'Asesoría Gesmeco',
    area: 'Asesoría',
    claim: 'Tus impuestos, nóminas y papeles, en orden.',
    descripcion:
      'Despacho de confianza para autónomos, empresas y particulares. Gestión fiscal, contable, laboral y administrativa con trato directo, sin llamadas a un 902.',
    servicios: [
      'Fiscal: IVA, IRPF, sociedades y renta',
      'Contable: balances, cuentas anuales y libros',
      'Laboral: contratos, nóminas y Seguridad Social',
      'Administrativa: trámites y expedientes',
    ],
    href: '/grupo',
    cta: 'Ver servicios de asesoría',
    glow: '#ff9500',
    text: 'text-[#ffb347]',
    chip: 'border-[#ff9500]/35 bg-[#ff9500]/12 text-[#ffb347]',
    dot: 'bg-[#ff9500]',
    grad: 'from-[#1c1204]/90 via-card/80 to-card/70',
    border: 'border-[#ff9500]/25',
    Visual: AsesoriaVisual,
  },
  {
    id: 'seguros',
    nombre: 'Correbin Asociados',
    area: 'Seguros',
    claim: 'Bien cubierto, sin pagar de más.',
    descripcion:
      'Correduría de seguros para tu casa, tu coche, tu negocio y tu explotación. Revisamos tus pólizas, detectamos duplicidades y te acompañamos si hay siniestro.',
    servicios: [
      'Particulares: hogar, auto, vida y salud',
      'Empresas: RC, comercio, naves y flotas',
      'Agrarios y ganaderos: explotaciones y maquinaria',
      'Revisión y optimización de pólizas en vigor',
    ],
    href: '/grupo',
    cta: 'Ver servicios de seguros',
    glow: '#00d4ff',
    text: 'text-[#4de3ff]',
    chip: 'border-[#00d4ff]/35 bg-[#00d4ff]/12 text-[#4de3ff]',
    dot: 'bg-[#00d4ff]',
    grad: 'from-[#03161c]/90 via-card/80 to-card/70',
    border: 'border-[#00d4ff]/25',
    Visual: SegurosVisual,
  },
];

/* ═══════════════════════════════════════════════════════════════
   Cifras del grupo con contador animado
   ═══════════════════════════════════════════════════════════════ */
const CIFRAS = [
  { num: 3, sufijo: '', etiqueta: 'Áreas de servicio', detalle: 'Energía · Asesoría · Seguros' },
  { num: 1, sufijo: '', etiqueta: 'Único interlocutor', detalle: 'Un equipo, una llamada' },
  { num: 4.5, sufijo: ' GW', etiqueta: 'Cartera energética', detalle: 'Gas y luz gestionados' },
  { num: null, texto: 'Binéfar', etiqueta: 'Nuestra casa', detalle: 'Avenida de Aragón, 50' },
];

function Contador({ num, sufijo, texto }: { num: number | null; sufijo?: string; texto?: string }) {
  const [val, setVal] = useState(0);
  const [visto, setVisto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisto(true); obs.disconnect(); } },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visto || num === null) return;
    const t0 = Date.now();
    const id = setInterval(() => {
      const p = Math.min((Date.now() - t0) / 1400, 1);
      setVal(parseFloat((num * (1 - Math.pow(1 - p, 3))).toFixed(1)));
      if (p >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [visto, num]);

  return (
    <div ref={ref} className="tabular-nums text-2xl font-black text-foreground md:text-3xl">
      {num === null ? texto : `${Number.isInteger(num) ? Math.round(val) : val}${sufijo}`}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Showcase principal
   ═══════════════════════════════════════════════════════════════ */
export function GrupoEmpresas3D() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* Cifras animadas */}
      <ScrollReveal delay={150}>
        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/40 bg-border/30 md:grid-cols-4">
          {CIFRAS.map((c) => (
            <div key={c.etiqueta} className="bg-card/80 p-6 text-center backdrop-blur-sm">
              <Contador num={c.num} sufijo={c.sufijo} texto={c.texto} />
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                {c.etiqueta}
              </div>
              <div className="mt-1 text-xs text-muted">{c.detalle}</div>
            </div>
          ))}
        </div>
      </ScrollReveal>

      {/* Empresas: cada una con su escena 3D propia */}
      <div className="mt-20 space-y-12">
        {EMPRESAS.map((e, i) => {
          const invertido = i % 2 === 1;
          return (
            <ScrollReveal key={e.nombre} delay={i * 100}>
              <TiltCard glow={e.glow} className="rounded-3xl">
                <div
                  id={e.id}
                  className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br backdrop-blur-sm ${e.border} ${e.grad}`}
                >
                  {/* Barrido de luz superior */}
                  <div className="absolute left-0 top-0 h-1 w-full overflow-hidden">
                    <div
                      className="h-full w-1/3"
                      style={{
                        background: `linear-gradient(90deg, transparent, ${e.glow}, transparent)`,
                        animation: `g3d-sweep 3.6s ease-in-out ${i * 0.8}s infinite`,
                      }}
                    />
                  </div>

                  <div className={`grid gap-6 p-8 md:p-10 lg:grid-cols-[1.15fr_1fr] ${invertido ? 'lg:[direction:rtl]' : ''}`}>
                    {/* Texto (siempre LTR aunque la grid esté invertida) */}
                    <div className="space-y-5 [direction:ltr]">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] ${e.chip}`}>
                          {e.area}
                        </span>
                        <span className="h-px flex-1 bg-gradient-to-r from-border/60 to-transparent" />
                      </div>

                      <h3 className="text-3xl font-black leading-tight text-foreground md:text-4xl">
                        {e.nombre}
                      </h3>

                      <p className={`text-lg font-bold leading-snug ${e.text}`}>“{e.claim}”</p>

                      <p className="text-sm leading-relaxed text-muted">{e.descripcion}</p>

                      <ul className="grid gap-2.5 pt-1 sm:grid-cols-2">
                        {e.servicios.map((s, j) => (
                          <li key={s} className="flex items-start gap-2.5 text-sm text-muted">
                            <span
                              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${e.dot}`}
                              style={{ animation: `g3d-blink 2.4s ease-in-out ${j * 0.3}s infinite` }}
                            />
                            {s}
                          </li>
                        ))}
                      </ul>

                      <Link
                        href={e.href}
                        className={`group/link inline-flex items-center gap-2 pt-1 text-sm font-bold ${e.text}`}
                      >
                        {e.cta}
                        <span className="transition-transform group-hover/link:translate-x-1.5">→</span>
                      </Link>
                    </div>

                    {/* Escena 3D característica */}
                    <div className="[direction:ltr]">
                      <e.Visual />
                    </div>
                  </div>
                </div>
              </TiltCard>
            </ScrollReveal>
          );
        })}
      </div>
    </>
  );
}
