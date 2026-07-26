'use client';

import { useState } from 'react';
import { ScrollReveal } from './scroll-reveal';
import { BusinessUnits } from './business-units';

type SolutionType = 'energia' | 'asesoria' | 'seguros';

interface SolutionTab {
  id: SolutionType;
  label: string;
  icon: string;
  color: string;
  colorBg: string;
  company: string;
  description: string;
}

/* Cada área con su color completo: el borde y el rótulo activos ya no son
   siempre rojos, así que la pestaña, su texto y las tarjetas de abajo van del
   mismo color. Antes las tres pestañas se marcaban en rojo (`border-accent/60`
   y `text-accent` fijos) aunque la de al lado fuese naranja o cian. */
const SOLUTIONS: (SolutionTab & { activo: string; texto: string; textoHover: string; halo: string })[] = [
  {
    id: 'energia',
    label: 'Energía',
    icon: '⚡',
    color: 'from-accent to-accent-light',
    colorBg: 'bg-accent/10',
    company: 'Gesmeco Energía',
    description: 'Asesoría energética, auditorías, solar fotovoltaica',
    activo: 'border-accent/60',
    texto: 'text-accent',
    textoHover: 'group-hover:text-accent',
    halo: 'shadow-[0_0_30px_rgba(255,51,51,0.20)]',
  },
  {
    id: 'asesoria',
    label: 'Asesoría',
    icon: '📋',
    color: 'from-tertiary to-amber-400',
    colorBg: 'bg-tertiary/10',
    company: 'Asesoría Gesmeco',
    description: 'Fiscal, laboral, contable y administrativa',
    activo: 'border-tertiary/60',
    texto: 'text-tertiary',
    textoHover: 'group-hover:text-tertiary',
    halo: 'shadow-[0_0_30px_rgba(255,149,0,0.20)]',
  },
  {
    id: 'seguros',
    label: 'Seguros',
    icon: '🛡️',
    color: 'from-secondary to-cyan-500',
    colorBg: 'bg-secondary/10',
    company: 'Correbin Asociados',
    description: 'Particulares, empresariales y agrarios',
    activo: 'border-secondary/60',
    texto: 'text-secondary',
    textoHover: 'group-hover:text-secondary',
    halo: 'shadow-[0_0_30px_rgba(0,212,255,0.20)]',
  },
];

export function SolutionsSelector() {
  const [selected, setSelected] = useState<SolutionType>('energia');

  return (
    <div className="space-y-12 py-20">
      {/* ── SELECTOR TABS ── */}
      <ScrollReveal>
        <div className="mx-auto max-w-4xl px-6">
          {/* Header */}
          <div className="mb-8 text-center space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent">
              Servicios en detalle
            </p>
            <h2 className="text-3xl font-black text-foreground md:text-4xl">
              Explora cada área del grupo
            </h2>
            <p className="text-base text-muted">
              Selecciona una empresa para ver todo lo que puede hacer por ti
            </p>
          </div>

          {/* Pestañas */}
          <div className="grid grid-cols-3 gap-3 md:gap-4" role="tablist">
            {SOLUTIONS.map((solution) => {
              const isActive = selected === solution.id;
              return (
                <button
                  key={solution.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setSelected(solution.id)}
                  className={`foco group relative overflow-hidden rounded-xl border-2 px-4 py-5 transition-all duration-300 md:px-6 md:py-6 ${
                    isActive
                      ? `${solution.activo} ${solution.colorBg} ${solution.halo}`
                      : 'border-border/40 bg-card/50 hover:border-foreground/25 hover:bg-card/70'
                  }`}
                >
                  {/* La línea de arriba se dibuja siempre y crece cuando la
                      pestaña está activa: así el cambio se ve como un
                      movimiento y no como un parpadeo. */}
                  <div
                    className={`absolute inset-x-0 top-0 h-1 origin-left bg-gradient-to-r ${solution.color} transition-transform duration-500 ${
                      isActive ? 'scale-x-100' : 'scale-x-0'
                    }`}
                  />

                  <div className="relative space-y-2 text-center">
                    <div className={`text-2xl transition-transform duration-500 md:text-3xl ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                      {solution.icon}
                    </div>
                    <h3 className={`text-lg font-black transition-colors md:text-xl ${
                      isActive ? solution.texto : `text-foreground ${solution.textoHover}`
                    }`}>
                      {solution.company}
                    </h3>
                    <p className="text-xs text-muted opacity-75 transition-opacity group-hover:opacity-100">
                      {solution.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </ScrollReveal>

      {/* ── CONTENT ── */}
      <div className="mx-auto max-w-7xl px-6">
        {selected === 'energia' && (
          <ScrollReveal>
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                <span className="text-xs font-bold uppercase tracking-widest text-accent">Gesmeco Energía</span>
              </div>
              <h3 className="text-2xl font-black text-foreground">
                Asesoría Energética Integral
              </h3>
              <p className="max-w-2xl text-base text-muted">
                Análisis de facturas, auditorías energéticas, instalaciones solares fotovoltaicas y soluciones de
                almacenamiento. Te acompañamos en cada paso hacia la autosuficiencia energética y el ahorro real.
              </p>
            </div>
          </ScrollReveal>
        )}

        {selected === 'asesoria' && (
          <ScrollReveal>
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-tertiary/30 bg-tertiary/10 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-tertiary" />
                <span className="text-xs font-bold uppercase tracking-widest text-tertiary">Gesmeco Asesoría</span>
              </div>
              <h3 className="text-2xl font-black text-foreground">
                Asesoría Fiscal, Laboral y Contable
              </h3>
              <p className="max-w-2xl text-base text-muted">
                Gestión integral de obligaciones fiscales, contables, laborales y administrativas para autónomos,
                empresas y particulares. Nos encargamos para que tú puedas enfocarte en tu negocio.
              </p>
            </div>
          </ScrollReveal>
        )}

        {selected === 'seguros' && (
          <ScrollReveal>
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
                <span className="text-xs font-bold uppercase tracking-widest text-secondary">Correbin Seguros</span>
              </div>
              <h3 className="text-2xl font-black text-foreground">
                Seguros y Gestión de Riesgos
              </h3>
              <p className="max-w-2xl text-base text-muted">
                Asesoramiento experto en seguros para particulares, negocios, autónomos y sector agrario. Revisamos
                tus coberturas y optimizamos tus pólizas para máxima protección.
              </p>
            </div>
          </ScrollReveal>
        )}
      </div>

      {/* ── SERVICES GRID ── */}
      <BusinessUnits selectedTab={selected} />
    </div>
  );
}
