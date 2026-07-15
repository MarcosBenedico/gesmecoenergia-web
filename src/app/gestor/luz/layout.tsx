'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Plug, CalendarClock, Target, FileSignature,
  Euro, BellRing, ArrowDownUp, Settings, ChevronLeft, Zap, UserCog, ShieldCheck, Route, History, Sun,
} from 'lucide-react';
import { GuardiaModulo } from '@/components/guardia-modulo';
import { useUsuario } from '@/lib/usuario';

const SECCIONES = [
  { href: '/gestor/luz', icono: LayoutDashboard, nombre: 'Dashboard Luz' },
  { href: '/gestor/luz/mi-dia', icono: Sun, nombre: 'Mi Día' },
  { href: '/gestor/luz/clientes', icono: Users, nombre: 'Clientes Energía' },
  { href: '/gestor/luz/cups', icono: Plug, nombre: 'CUPS / Suministros' },
  { href: '/gestor/luz/fechas', icono: CalendarClock, nombre: 'Fechas Críticas' },
  { href: '/gestor/luz/pipeline', icono: Target, nombre: 'Pipeline Energético' },
  { href: '/gestor/luz/contratos', icono: FileSignature, nombre: 'Contratos y Activaciones' },
  { href: '/gestor/luz/comisiones', icono: Euro, nombre: 'Comisiones' },
  { href: '/gestor/luz/tareas', icono: BellRing, nombre: 'Tareas y Alertas' },
  { href: '/gestor/luz/rutas', icono: Route, nombre: 'Rutas de visitas' },
  { href: '/gestor/luz/equipo', icono: UserCog, nombre: 'Equipo y Responsables' },
  { href: '/gestor/luz/usuarios', icono: ShieldCheck, nombre: 'Usuarios y Permisos', soloAdmin: true },
  { href: '/gestor/luz/control', icono: History, nombre: 'Control General', soloAdmin: true },
  { href: '/gestor/luz/importar', icono: ArrowDownUp, nombre: 'Importación / Exportación' },
  { href: '/gestor/luz/configuracion', icono: Settings, nombre: 'Configuración', soloAdmin: true },
];

export default function LuzLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { esAdmin, cargando } = useUsuario();
  // Mientras se comprueba el perfil, las secciones de admin NO se muestran (nunca deben verse por error)
  const veAdmin = !cargando && esAdmin;
  const activa = (href: string) =>
    href === '/gestor/luz' ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto w-full max-w-[1920px] 2xl:max-w-none px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/gestor"
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/80 border border-border/50 text-sm font-semibold text-foreground hover:bg-card transition"
            >
              <ChevronLeft className="w-4 h-4" />
              Panel
            </Link>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm md:text-base font-black text-foreground leading-tight truncate">
                  ⚡ Gestión Luz · Cartera Energética
                </h1>
                <p className="text-[11px] text-muted leading-tight truncate">
                  Cada CUPS: responsable, estado, fecha clave, próxima acción, contrato, activación y comisión
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1920px] 2xl:max-w-none px-4 md:px-6 py-5 flex flex-col lg:flex-row gap-5">
        <nav className="lg:w-64 shrink-0">
          <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 -mx-1 px-1">
            {SECCIONES.filter((s) => !s.soloAdmin || veAdmin).map(({ href, icono: Icono, nombre }) => (
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
        <main className="flex-1 min-w-0">
          <GuardiaModulo modulo="luz" nombre="Gestión Luz · Cartera Energética">{children}</GuardiaModulo>
        </main>
      </div>
    </div>
  );
}
