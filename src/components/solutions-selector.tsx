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

const SOLUTIONS: SolutionTab[] = [
  {
    id: 'energia',
    label: 'Energía',
    icon: '⚡',
    color: 'from-accent to-accent-light',
    colorBg: 'bg-accent/10',
    company: 'Gesmeco Energía',
    description: 'Asesoría energética, auditorías, solar fotovoltaica',
  },
  {
    id: 'asesoria',
    label: 'Asesoría',
    icon: '📋',
    color: 'from-tertiary to-amber-400',
    colorBg: 'bg-tertiary/10',
    company: 'Asesoría Gesmeco',
    description: 'Fiscal, laboral, contable y administrativa',
  },
  {
    id: 'seguros',
    label: 'Seguros',
    icon: '🛡️',
    color: 'from-secondary to-cyan-500',
    colorBg: 'bg-secondary/10',
    company: 'Correbin Asociados',
    description: 'Particulares, empresariales y agrarios',
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
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-4 py-2 backdrop-blur-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
              <span className="text-sm font-bold uppercase tracking-widest text-accent">
                Soluciones Integrales
              </span>
            </div>
            <h2 className="text-3xl font-black text-foreground md:text-4xl">
              Elige tu área de interés
            </h2>
            <p className="text-base text-muted">
              Explora los servicios que Gesmeco y Correbin ofrecen para tu negocio
            </p>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {SOLUTIONS.map((solution) => {
              const isActive = selected === solution.id;
              return (
                <button
                  key={solution.id}
                  onClick={() => setSelected(solution.id)}
                  className={`group relative overflow-hidden rounded-xl border-2 px-4 py-5 md:px-6 md:py-6 transition-all duration-300 ${
                    isActive
                      ? `border-accent/60 ${solution.colorBg} shadow-[0_0_30px_rgba(255,51,51,0.2)]`
                      : 'border-border/40 bg-card/50 hover:border-accent/30 hover:bg-card/70'
                  }`}
                >
                  {/* Active indicator line */}
                  {isActive && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent via-secondary to-accent" />
                  )}

                  <div className="relative space-y-2 text-center">
                    <div className="text-2xl md:text-3xl">{solution.icon}</div>
                    <div>
                      <h3 className={`font-bold transition-colors ${
                        isActive ? 'text-accent' : 'text-foreground group-hover:text-accent'
                      }`}>
                        {solution.label}
                      </h3>
                      <p className="text-[10px] text-muted/70 font-semibold uppercase tracking-wider">
                        {solution.company}
                      </p>
                    </div>
                    <p className="text-xs text-muted opacity-75 group-hover:opacity-100 transition-opacity">
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
