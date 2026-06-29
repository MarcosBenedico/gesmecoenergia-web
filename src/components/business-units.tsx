'use client';

import { asesoriaServices, segurosServices, services } from '@/lib/data';
import { ScrollReveal } from './scroll-reveal';

interface ServiceCardProps {
  title: string;
  icon: string;
  color: string;
  colorBg: string;
  colorBorder: string;
  summary: string;
  items: string[];
  delay: number;
}

function ServiceCard({
  title,
  icon,
  color,
  colorBg,
  colorBorder,
  summary,
  items,
  delay,
}: ServiceCardProps) {
  return (
    <ScrollReveal delay={delay}>
      <div
        className={`group relative overflow-hidden rounded-2xl border ${colorBorder} ${colorBg} p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-lg`}
      >
        {/* Animated top accent */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${color} scale-x-0 transition-transform group-hover:scale-x-100`} />

        {/* Icon + Title */}
        <div className="mb-4">
          <div className="text-3xl mb-2">{icon}</div>
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted">{summary}</p>
        </div>

        {/* Items list */}
        <ul className="space-y-2 text-sm">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-muted group/item">
              <span className={`mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0 bg-gradient-to-br ${color}`} />
              <span className="group-hover/item:text-foreground transition-colors">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </ScrollReveal>
  );
}

interface BusinessUnitsProps {
  selectedTab?: 'energia' | 'asesoria' | 'seguros';
}

export function BusinessUnits({ selectedTab = 'energia' }: BusinessUnitsProps) {
  if (selectedTab === 'energia') {
    return (
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-5 md:grid-cols-2">
          {services.slice(0, 4).map((service, i) => (
            <ServiceCard
              key={service.title}
              title={service.title}
              icon="⚡"
              color="from-accent to-accent-light"
              colorBg="bg-accent/10"
              colorBorder="border-accent/30"
              summary={service.summary}
              items={service.items}
              delay={i * 120}
            />
          ))}
        </div>
      </div>
    );
  }

  if (selectedTab === 'asesoria') {
    return (
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-5 md:grid-cols-2">
          {asesoriaServices.map((service, i) => (
            <ServiceCard
              key={service.title}
              {...service}
              delay={i * 120}
            />
          ))}
        </div>
      </div>
    );
  }

  if (selectedTab === 'seguros') {
    return (
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-5 md:grid-cols-2">
          {segurosServices.map((service, i) => (
            <ServiceCard
              key={service.title}
              {...service}
              delay={i * 120}
            />
          ))}
        </div>
      </div>
    );
  }

  return null;
}
