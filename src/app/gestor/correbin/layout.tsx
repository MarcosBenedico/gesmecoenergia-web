'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FolderOpen, CalendarDays, Users, TrendingUp, FileX,
  ArrowLeftRight, Target, BellRing, Upload, Download, ChevronLeft, Shield,
} from 'lucide-react';

const SECCIONES = [
  { href: '/gestor/correbin', icono: LayoutDashboard, nombre: 'Dashboard' },
  { href: '/gestor/correbin/cartera', icono: FolderOpen, nombre: 'Cartera viva' },
  { href: '/gestor/correbin/calendario', icono: CalendarDays, nombre: 'Calendario VCT' },
  { href: '/gestor/correbin/clientes', icono: Users, nombre: 'Clientes' },
  { href: '/gestor/correbin/produccion', icono: TrendingUp, nombre: 'Producción' },
  { href: '/gestor/correbin/anulaciones', icono: FileX, nombre: 'Anulaciones' },
  { href: '/gestor/correbin/mediador', icono: ArrowLeftRight, nombre: 'Cambios de mediador' },
  { href: '/gestor/correbin/pipeline', icono: Target, nombre: 'Pipeline comercial' },
  { href: '/gestor/correbin/tareas', icono: BellRing, nombre: 'Tareas y alertas' },
  { href: '/gestor/correbin/importar', icono: Upload, nombre: 'Importación Excel' },
  { href: '/gestor/correbin/exportar', icono: Download, nombre: 'Exportaciones' },
];

export default function CorrebinLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const activa = (href: string) =>
    href === '/gestor/correbin'
      ? pathname === href
      : pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="min-h-screen bg-background">
      {/* Cabecera del módulo */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto max-w-[1500px] px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/gestor"
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/80 border border-border/50 text-sm font-semibold text-foreground hover:bg-card transition"
            >
              <ChevronLeft className="w-4 h-4" />
              Panel
            </Link>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-secondary/15 border border-secondary/30 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-secondary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm md:text-base font-black text-foreground leading-tight truncate">
                  Vencimientos y Cartera
                </h1>
                <p className="text-[11px] text-muted leading-tight truncate">
                  Correbin Asociados · control comercial interno (Avant/iSegur sigue siendo la operativa)
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 md:px-6 py-5 flex flex-col lg:flex-row gap-5">
        {/* Menú lateral (horizontal en móvil) */}
        <nav className="lg:w-60 shrink-0">
          <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 -mx-1 px-1">
            {SECCIONES.map(({ href, icono: Icono, nombre }) => (
              <Link
                key={href}
                href={href}
                className={`shrink-0 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition whitespace-nowrap ${
                  activa(href)
                    ? 'bg-accent text-white'
                    : 'text-muted hover:text-foreground hover:bg-card/80 border border-transparent lg:border-border/20'
                }`}
              >
                <Icono className="w-4 h-4 shrink-0" />
                {nombre}
              </Link>
            ))}
          </div>
        </nav>

        {/* Contenido */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
