'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Plug, CalendarClock, Target, FileSignature,
  Euro, ArrowDownUp, Settings, ChevronLeft, ChevronDown, Zap, UserCog, ShieldCheck, Route, History, Sun, UserPlus, Radar, Inbox, BookOpen, Calculator, FileText, TrendingUp, Trash2, Activity,
} from 'lucide-react';
import { GuardiaModulo } from '@/components/guardia-modulo';
import { useUsuario } from '@/lib/usuario';

/**
 * Menú por FORMA DE TRABAJAR, no por tipo de dato.
 *
 *  · Calle    — lo que usa David: capta, visita y mueve oportunidades.
 *  · Oficina  — lo que usa Nicola: mete los datos y tramita el papeleo.
 *  · Dirección— lo de Marcos: dinero, equipo, herramientas y control.
 *
 * Todos ven los tres bloques (nadie se queda sin poder consultar algo), pero
 * cada uno puede plegar los que no son suyos y se recuerda su elección.
 */
interface Seccion { href: string; icono: typeof LayoutDashboard; nombre: string; soloAdmin?: boolean }
interface Bloque { id: string; titulo: string; pista: string; secciones: Seccion[] }

const BLOQUES: Bloque[] = [
  {
    id: 'calle',
    titulo: 'Calle',
    pista: 'Visitar, mover y cerrar',
    secciones: [
      { href: '/gestor/luz/mi-dia', icono: Sun, nombre: 'Mi Día' },
      { href: '/gestor/luz/agenda', icono: CalendarClock, nombre: 'Agenda' },
      { href: '/gestor/luz/rutas', icono: Route, nombre: 'Rutas de visitas' },
      { href: '/gestor/luz/pipeline', icono: Target, nombre: 'Pipeline Energético' },
    ],
  },
  {
    id: 'oficina',
    titulo: 'Oficina',
    pista: 'Dar de alta, tramitar y ordenar',
    secciones: [
      { href: '/gestor/luz/bandeja', icono: Inbox, nombre: 'Bandeja' },
      { href: '/gestor/luz/captura', icono: Zap, nombre: 'Captura rápida' },
      { href: '/gestor/luz/guia', icono: BookOpen, nombre: 'Guía rápida' },
      { href: '/gestor/luz/alta', icono: UserPlus, nombre: 'Alta guiada de cliente' },
      { href: '/gestor/luz/clientes', icono: Users, nombre: 'Clientes Energía' },
      { href: '/gestor/luz/cups', icono: Plug, nombre: 'CUPS / Suministros' },
      { href: '/gestor/luz/contratos', icono: FileSignature, nombre: 'Contratos y Activaciones' },
      { href: '/gestor/luz/tarifas', icono: TrendingUp, nombre: 'Tarifas y Comparador' },
      { href: '/gestor/luz/proyectos', icono: FileText, nombre: 'Proyectos de ahorro' },
      { href: '/gestor/luz/importar', icono: ArrowDownUp, nombre: 'Importación / Exportación' },
    ],
  },
  {
    id: 'direccion',
    titulo: 'Dirección',
    pista: 'Negocio, equipo y control',
    secciones: [
      { href: '/gestor/luz', icono: LayoutDashboard, nombre: 'Dashboard Luz' },
      { href: '/gestor/luz/oportunidades', icono: Radar, nombre: 'Mapa de oportunidades', soloAdmin: true },
      { href: '/gestor/luz/mercado', icono: TrendingUp, nombre: 'Precio de la luz', soloAdmin: true },
      { href: '/gestor/luz/consumo', icono: Activity, nombre: 'Consumo real', soloAdmin: true },
      { href: '/gestor/luz/comisiones', icono: Euro, nombre: 'Comisiones' },
      { href: '/gestor/luz/equipo', icono: UserCog, nombre: 'Equipo y Logros' },
      { href: '/gestor/luz/fv', icono: Calculator, nombre: 'Calculadora FV', soloAdmin: true },
      { href: '/gestor/luz/control', icono: History, nombre: 'Control General', soloAdmin: true },
      { href: '/gestor/luz/papelera', icono: Trash2, nombre: 'Papelera', soloAdmin: true },
      { href: '/gestor/luz/usuarios', icono: ShieldCheck, nombre: 'Usuarios y Permisos', soloAdmin: true },
      { href: '/gestor/luz/configuracion', icono: Settings, nombre: 'Configuración', soloAdmin: true },
    ],
  },
];

const CLAVE_PLEGADOS = 'gesmeco:luz:bloques-plegados';

export default function LuzLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { esAdmin, cargando } = useUsuario();
  // Mientras se comprueba el perfil, las secciones de admin NO se muestran (nunca deben verse por error)
  const veAdmin = !cargando && esAdmin;
  const activa = (href: string) =>
    href === '/gestor/luz' ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  // Cada persona pliega los bloques que no usa; su elección se recuerda en este navegador.
  // Se lee en un efecto y no en el estado inicial a propósito: localStorage no existe en
  // el servidor, y leerlo al inicializar haría que el HTML del servidor y el del navegador
  // no coincidieran. El aviso del linter es correcto en general, pero aquí el efecto es la
  // forma segura de hacerlo.
  const [plegados, setPlegados] = useState<string[]>([]);
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE_PLEGADOS);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (guardado) setPlegados(JSON.parse(guardado));
    } catch { /* sin preferencia guardada: todos abiertos */ }
  }, []);
  const alternar = (id: string) => {
    setPlegados((prev) => {
      const siguiente = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem(CLAVE_PLEGADOS, JSON.stringify(siguiente)); } catch { /* modo privado */ }
      return siguiente;
    });
  };

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
            {BLOQUES.map((bloque) => {
              const secciones = bloque.secciones.filter((s) => !s.soloAdmin || veAdmin);
              if (secciones.length === 0) return null;
              // Si estás dentro de una sección del bloque, se abre aunque lo tuvieras plegado
              const tieneActiva = secciones.some((s) => activa(s.href));
              const plegado = plegados.includes(bloque.id) && !tieneActiva;
              return (
                <div key={bloque.id} className="contents">
                  <button
                    type="button"
                    onClick={() => alternar(bloque.id)}
                    className="hidden lg:flex w-full items-center justify-between gap-2 px-3.5 pt-4 pb-1.5 text-left group first:pt-0"
                    title={plegado ? 'Mostrar este bloque' : 'Ocultar este bloque'}
                  >
                    <span className="min-w-0">
                      <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-muted/70 group-hover:text-foreground transition">
                        {bloque.titulo}
                      </span>
                      <span className="block text-[10px] text-muted/50 truncate">{bloque.pista}</span>
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-muted/50 transition-transform ${plegado ? '-rotate-90' : ''}`} />
                  </button>
                  {(!plegado ? secciones : []).map(({ href, icono: Icono, nombre }) => (
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
              );
            })}
          </div>
        </nav>
        <main className="flex-1 min-w-0">
          <GuardiaModulo modulo="luz" nombre="Gestión Luz · Cartera Energética">{children}</GuardiaModulo>
        </main>
      </div>
    </div>
  );
}
