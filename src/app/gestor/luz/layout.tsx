'use client';

import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Plug, Target, FileSignature,
  Euro, ArrowDownUp, Settings, ChevronLeft, ChevronDown, Zap, UserCog, ShieldCheck, Route, History, Sun, UserPlus, Radar, Inbox, BookOpen, Calculator, FileText, TrendingUp, Trash2, Activity, ClipboardList, Wand2, Menu, X,
} from 'lucide-react';
import { GuardiaModulo } from '@/components/guardia-modulo';
import { useUsuario } from '@/lib/usuario';

/**
 * Menú por FORMA DE TRABAJAR, no por tipo de dato.
 *
 *  · Calle       — lo que usa David: capta, visita y mueve oportunidades.
 *  · Oficina     — lo que usa Nicola: mete el dato, lo completa y tramita.
 *  · Dirección   — lo que Marcos mira cada día. Poco, para que se mire.
 *  · Herramientas— de usar cuando toca, no a diario. Nace plegado.
 *  · Ajustes     — se tocan una vez y se olvidan. Nace plegado.
 *
 * POR QUÉ HAY CINCO BLOQUES Y NO TRES: con tres, Dirección acumulaba doce
 * entradas y Oficina diez, y en la auditoría se veía el resultado — de todo el
 * trabajo real, el 73 % cae en clientes y tareas, y había pantallas con cero
 * uso ocupando sitio en el menú de quien más prisa tiene.
 *
 * La regla al añadir algo aquí: si no se abre casi todos los días, va a
 * Herramientas. Una entrada de menú que nadie usa no cuesta servidor, cuesta
 * atención, y la paga cada día quien sí tiene trabajo.
 *
 * Todos ven todos los bloques (nadie se queda sin poder consultar algo), y cada
 * uno pliega los que no son suyos: su elección se recuerda en su navegador.
 */
interface Seccion { href: string; icono: typeof LayoutDashboard; nombre: string; soloAdmin?: boolean }
interface Bloque { id: string; titulo: string; pista: string; secciones: Seccion[] }

const BLOQUES: Bloque[] = [
  {
    id: 'calle',
    titulo: 'Calle',
    pista: 'Visitar, mover y cerrar',
    secciones: [
      // Mi Día se comió la Agenda: eran la misma lista con otro recorte, y
      // tener las dos en el menú era lo que hacía que se mezclaran.
      { href: '/gestor/luz/mi-dia', icono: Sun, nombre: 'Mi Día' },
      { href: '/gestor/luz/rutas', icono: Route, nombre: 'Rutas de visitas' },
      { href: '/gestor/luz/pipeline', icono: Target, nombre: 'Pipeline Energético' },
    ],
  },
  {
    // El bloque de Nicola solo lleva lo que usa para su trabajo: meter el dato,
    // completarlo y tramitarlo. Las herramientas de precio y los generadores de
    // documentos se fueron a Herramientas, que son de Marcos y las abre de
    // Pascuas a Ramos. Cada entrada que sobra aquí es atención que se le quita
    // a lo que sí hace todos los días.
    id: 'oficina',
    titulo: 'Oficina',
    pista: 'Meter el dato, completarlo y tramitar',
    secciones: [
      { href: '/gestor/luz/bandeja', icono: Inbox, nombre: 'Bandeja' },
      { href: '/gestor/luz/rellenar', icono: Wand2, nombre: 'Rellenar en tanda' },
      { href: '/gestor/luz/captura', icono: Zap, nombre: 'Captura rápida' },
      { href: '/gestor/luz/alta', icono: UserPlus, nombre: 'Alta guiada de cliente' },
      { href: '/gestor/luz/clientes', icono: Users, nombre: 'Clientes Energía' },
      { href: '/gestor/luz/cups', icono: Plug, nombre: 'CUPS / Suministros' },
      { href: '/gestor/luz/contratos', icono: FileSignature, nombre: 'Contratos y Activaciones' },
      { href: '/gestor/luz/importar', icono: ArrowDownUp, nombre: 'Importación / Exportación' },
      { href: '/gestor/luz/guia', icono: BookOpen, nombre: 'Guía rápida' },
    ],
  },
  {
    // Lo que Marcos mira a diario. Nada más: si aquí caben doce cosas, no se
    // mira ninguna.
    id: 'direccion',
    titulo: 'Dirección',
    pista: 'Lo que hay que mirar cada día',
    secciones: [
      { href: '/gestor/luz', icono: LayoutDashboard, nombre: 'Dashboard Luz' },
      { href: '/gestor/luz/parte', icono: ClipboardList, nombre: 'Parte del día', soloAdmin: true },
      { href: '/gestor/luz/consumo', icono: Activity, nombre: 'Consumo real', soloAdmin: true },
      { href: '/gestor/luz/comisiones', icono: Euro, nombre: 'Comisiones' },
      { href: '/gestor/luz/equipo', icono: UserCog, nombre: 'Equipo y Logros' },
    ],
  },
  {
    // De usar cuando toca, no cada día. Plegado por defecto.
    id: 'herramientas',
    titulo: 'Herramientas',
    pista: 'De usar cuando toca',
    secciones: [
      { href: '/gestor/luz/oportunidades', icono: Radar, nombre: 'Mapa de oportunidades', soloAdmin: true },
      { href: '/gestor/luz/fv', icono: Calculator, nombre: 'Calculadora FV', soloAdmin: true },
      { href: '/gestor/luz/tarifas', icono: TrendingUp, nombre: 'Tarifas y Comparador', soloAdmin: true },
      { href: '/gestor/luz/proyectos', icono: FileText, nombre: 'Proyectos de ahorro', soloAdmin: true },
      { href: '/gestor/luz/mercado', icono: TrendingUp, nombre: 'Precio de la luz', soloAdmin: true },
    ],
  },
  {
    id: 'ajustes',
    titulo: 'Ajustes',
    pista: 'Se tocan una vez y se olvidan',
    secciones: [
      { href: '/gestor/luz/control', icono: History, nombre: 'Control General', soloAdmin: true },
      { href: '/gestor/luz/usuarios', icono: ShieldCheck, nombre: 'Usuarios y Permisos', soloAdmin: true },
      { href: '/gestor/luz/configuracion', icono: Settings, nombre: 'Configuración', soloAdmin: true },
      { href: '/gestor/luz/papelera', icono: Trash2, nombre: 'Papelera', soloAdmin: true },
    ],
  },
];

const CLAVE_PLEGADOS = 'gesmeco:luz:bloques-plegados';

/**
 * Lo que se abre la primera vez. Herramientas y Ajustes nacen plegados: no son
 * trabajo diario de nadie, y un menú que se lee de un vistazo vale más que uno
 * que lo enseña todo.
 */
const PLEGADOS_POR_DEFECTO = ['herramientas', 'ajustes'];

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
      setPlegados(guardado ? JSON.parse(guardado) : PLEGADOS_POR_DEFECTO);
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlegados(PLEGADOS_POR_DEFECTO);
    }
  }, []);
  const alternar = (id: string) => {
    setPlegados((prev) => {
      const siguiente = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem(CLAVE_PLEGADOS, JSON.stringify(siguiente)); } catch { /* modo privado */ }
      return siguiente;
    });
  };

  /* ── Menú del móvil ──────────────────────────────────────────────────────
     Antes el menú del móvil era la misma tira horizontal del escritorio, y la
     cabecera de cada bloque —lo único que pliega y despliega— iba con
     `hidden lg:flex`. Como Herramientas y Ajustes NACEN plegados, en el móvil
     quedaban cerrados y sin ningún botón para abrirlos: nueve pantallas
     (oportunidades, FV, tarifas, proyectos, mercado, control, usuarios,
     configuración y papelera) eran literalmente inalcanzables desde el
     teléfono. Y las que sí salían obligaban a barrer una tira de trece
     entradas sin ver a qué bloque pertenecía cada una.

     Ahora el móvil tiene su propio panel, con los cinco bloques enteros. */
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Cerrar el panel al navegar. El linter avisa de los setState dentro de un
  // efecto y en general tiene razón, pero aquí el cambio de ruta es justo el
  // suceso externo al que hay que reaccionar: sin esto, tocas una sección y el
  // panel se queda encima de la pantalla a la que acabas de entrar.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMenuAbierto(false); }, [pathname]);

  useEffect(() => {
    if (!menuAbierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const alPulsarEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuAbierto(false); };
    window.addEventListener('keydown', alPulsarEsc);
    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener('keydown', alPulsarEsc);
    };
  }, [menuAbierto]);

  // Para que el botón del móvil diga dónde estás, no solo «Menú».
  const seccionActual = BLOQUES.flatMap((b) => b.secciones).find((s) => activa(s.href));

  /** Las secciones de un bloque, tal y como se pintan en el panel del móvil. */
  const enlacesMovil = (secciones: Seccion[]) =>
    secciones.map(({ href, icono: Icono, nombre }) => (
      <Link
        key={href}
        href={href}
        onClick={() => setMenuAbierto(false)}
        className={`flex min-h-[48px] items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition ${
          activa(href)
            ? 'bg-accent text-white'
            : 'text-foreground/90 hover:bg-card active:bg-card'
        }`}
      >
        <Icono className="w-[18px] h-[18px] shrink-0" />
        {nombre}
      </Link>
    ));

  const panelMovil = menuAbierto ? (
    <div className="fixed inset-0 z-[100] lg:hidden" role="dialog" aria-modal="true" aria-label="Secciones de Gestión Luz">
      <button
        type="button"
        aria-label="Cerrar menú"
        onClick={() => setMenuAbierto(false)}
        className="absolute inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-sm"
      />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-[380px] flex-col border-l border-border bg-background shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-sm font-black text-foreground truncate">Gestión Luz</span>
          </div>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMenuAbierto(false)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:border-accent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Aquí NO se pliega nada. En el escritorio plegar sirve para que la
            barra lateral se lea de un vistazo; en el móvil el panel ya se
            desplaza, y esconder bloques es justo lo que dejaba media
            aplicación inalcanzable. Salen los cinco, enteros. */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <div className="space-y-6">
            {BLOQUES.map((bloque) => {
              const secciones = bloque.secciones.filter((s) => !s.soloAdmin || veAdmin);
              if (secciones.length === 0) return null;
              return (
                <div key={bloque.id}>
                  <div className="mb-2 border-b border-border/60 pb-2">
                    <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                      {bloque.titulo}
                    </span>
                    <span className="block text-[11px] text-muted/60">{bloque.pista}</span>
                  </div>
                  <div className="space-y-1">{enlacesMovil(secciones)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-surface px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
          <Link
            href="/gestor"
            onClick={() => setMenuAbierto(false)}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-card border border-border/50 text-sm font-semibold text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
            Volver al Panel
          </Link>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-background">
      {typeof document !== 'undefined' && panelMovil
        ? createPortal(panelMovil, document.body)
        : null}
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

          {/* Solo en móvil. Dice en qué sección estás, no un «Menú» a secas:
              con veintidós pantallas, saber dónde estabas es la mitad del
              trabajo de volver. */}
          <button
            type="button"
            onClick={() => setMenuAbierto(true)}
            aria-label="Abrir el menú de secciones"
            aria-haspopup="dialog"
            aria-expanded={menuAbierto}
            className="lg:hidden shrink-0 flex min-h-[44px] items-center gap-2 rounded-lg border border-border/50 bg-card/80 px-3 text-sm font-semibold text-foreground transition hover:bg-card"
          >
            <Menu className="w-4 h-4 shrink-0" />
            <span className="max-w-[120px] truncate">{seccionActual?.nombre ?? 'Secciones'}</span>
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1920px] 2xl:max-w-none px-4 md:px-6 py-5 flex flex-col lg:flex-row gap-5">
        {/* La barra lateral es solo de escritorio. En el móvil manda el panel
            de arriba: la tira horizontal que había aquí no cabía, escondía a
            qué bloque pertenecía cada entrada y, con los bloques plegados,
            dejaba fuera nueve pantallas. */}
        <nav className="hidden lg:block lg:w-64 shrink-0">
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
