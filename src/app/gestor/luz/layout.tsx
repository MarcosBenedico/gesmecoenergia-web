'use client';

import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Plug, Target, FileSignature,
  Euro, ArrowDownUp, Settings, ChevronLeft, ChevronDown, Zap, UserCog, ShieldCheck, Route, History, Sun, Radar, Inbox, BookOpen, Calculator, FileText, TrendingUp, Trash2, ClipboardList, Wand2, Sparkles, Leaf, Menu, X,
} from 'lucide-react';
import { GuardiaModulo } from '@/components/guardia-modulo';
import { useUsuario } from '@/lib/usuario';
import { BotonCapturar } from './boton-capturar';

/**
 * EL MENÚ, ORGANIZADO POR MOMENTO DEL DÍA Y POR PERSONA.
 *
 *  · Inicio       — qué decido hoy, y con qué lo desatasco.
 *  · La calle     — a dónde voy (David).
 *  · Oficina      — meter lo que falta y desatascar (Nicola).
 *  · Comercial    — vender y seguir.
 *  · Operación    — firma, envío y activación.
 *  · Control · Herramientas · Ajustes — nacen plegados.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA LIMPIEZA DE SEPTIEMBRE DE 2026, Y POR QUÉ
 *
 * La auditoría del CRM midió el uso real contra la base de producción y
 * encontró lo contrario de lo que se buscaba: no sobraban funciones, faltaba
 * ALIMENTACIÓN. Tres semanas sin datos nuevos, 90 oportunidades abiertas y
 * las 90 paradas, 223 de 306 clientes sin teléfono. De ahí salen los cambios:
 *
 *  · FUERA DEL MENÚ (las rutas siguen vivas): Proyectos de ahorro y Precio de
 *    la luz, que no deciden nada; y Consumo real, que no puede funcionar hasta
 *    que un titular autorice el NIF en datadis.es.
 *  · BAJA a Control: Control de cartera, que contestaba una pregunta del mismo
 *    momento y de la misma persona que el Dashboard.
 *  · SUBEN a la vista: Rellenar en tanda —la herramienta que arregla justo el
 *    problema del mes y estaba enterrada— y el Mapa de oportunidades, que es
 *    la otra mitad de Rutas y vivía en otro bloque plegado.
 *  · Automatizaciones pasa a Inicio: con 90 oportunidades paradas, es la
 *    palanca de reactivación, no una herramienta de consultar.
 *
 * De 27 entradas a 24, y sobre todo con las diez visibles ordenadas por el
 * momento en que se abren.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA REGLA AL AÑADIR ALGO
 *
 * Si no se abre casi todos los días, va a un bloque plegado. Y si no puede
 * funcionar hasta que pase algo fuera del sistema, no va al menú hasta que
 * pase. Una entrada que nadie usa no cuesta servidor: cuesta atención, y la
 * paga cada día quien sí tiene trabajo.
 *
 * «Captura rápida», «Alta guiada» y «Registrar visita» NO están en el menú a
 * propósito: viven en el botón global «+ Capturar», porque meter un dato es
 * algo que se hace EN MEDIO de otra cosa.
 *
 * Cada uno pliega los bloques que no son suyos y su elección se recuerda.
 */
interface Seccion { href: string; icono: typeof LayoutDashboard; nombre: string; soloAdmin?: boolean }
interface Bloque { id: string; titulo: string; pista: string; secciones: Seccion[]; plegadoPorDefecto?: boolean }

const BLOQUES: Bloque[] = [
  {
    id: 'inicio',
    titulo: 'Inicio',
    pista: 'Qué hay que decidir hoy',
    secciones: [
      { href: '/gestor/luz', icono: LayoutDashboard, nombre: 'Dashboard' },
      /*
       * CONTROL DE CARTERA SALE DEL MENÚ y se enlaza desde el Dashboard.
       *
       * Contestan preguntas distintas del MISMO momento y son de la MISMA
       * persona: «qué decido hoy» y «dónde se escapa el control». Dos entradas
       * de menú para eso obligan a elegir cuál abrir antes del café, y esa
       * elección se resuelve siempre igual — no abriendo ninguna.
       *
       * En su hueco entran las Automatizaciones, que con 90 oportunidades
       * paradas y 89 tareas vencidas son la palanca para reactivar la cartera.
       * Estaban enterradas en Herramientas, que es donde no se miran.
       */
      { href: '/gestor/luz/automatismos', icono: Sparkles, nombre: 'Automatizaciones', soloAdmin: true },
    ],
  },
  {
    id: 'trabajo',
    titulo: 'La calle',
    pista: 'A dónde voy y qué me llevo hecho',
    secciones: [
      // Mi Día se comió la Agenda: eran la misma lista con otro recorte, y
      // tener las dos en el menú era lo que hacía que se mezclaran.
      { href: '/gestor/luz/mi-dia', icono: Sun, nombre: 'Mi Día' },
      { href: '/gestor/luz/rutas', icono: Route, nombre: 'Rutas de visitas' },
      /*
       * EL MAPA SUBE AQUÍ, desde el bloque Control donde estaba plegado.
       *
       * Rutas y el Mapa son las dos mitades de la misma decisión —a dónde voy
       * y a quién más aprovecho— y estaban en bloques distintos, uno visible y
       * otro escondido. Con 719 prospectos sin trabajar y 259 ya marcados
       * «para visitar», tenerlo detrás de un plegable era garantizar que no se
       * usara.
       */
      { href: '/gestor/luz/oportunidades', icono: Radar, nombre: 'Mapa de oportunidades', soloAdmin: true },
    ],
  },
  {
    id: 'cartera',
    titulo: 'Oficina',
    pista: 'Meter lo que falta y desatascar',
    secciones: [
      { href: '/gestor/luz/bandeja', icono: Inbox, nombre: 'Bandeja' },
      { href: '/gestor/luz/clientes', icono: Users, nombre: 'Clientes' },
      { href: '/gestor/luz/cups', icono: Plug, nombre: 'Suministros' },
      /*
       * RELLENAR EN TANDA SUBE A LA VISTA.
       *
       * Es la pantalla más infravalorada del sistema: con 223 clientes sin
       * teléfono y 89 suministros sin fecha de fin de contrato, es exactamente
       * la herramienta que hace falta, y estaba en un bloque plegado junto a
       * la calculadora fotovoltaica. Una herramienta que resuelve el problema
       * del mes no puede estar donde se guarda lo que se usa dos veces al año.
       */
      { href: '/gestor/luz/rellenar', icono: Wand2, nombre: 'Rellenar en tanda' },
    ],
  },
  {
    id: 'comercial',
    titulo: 'Comercial',
    pista: 'Vender y hacer seguimiento',
    secciones: [
      // Seguimiento vive dentro, en la pestaña «Parados»: es la misma cartera
      // mirada por tiempo parado en vez de por etapa.
      { href: '/gestor/luz/pipeline', icono: Target, nombre: 'Pipeline' },
      // Va aquí y no en Herramientas porque no es una calculadora que se abre
      // de vez en cuando: es el paso que hay entre tener la factura y tener
      // una oferta, y ese paso se da casi todos los días.
      { href: '/gestor/luz/estudios', icono: FileText, nombre: 'Estudios y propuestas' },
    ],
  },
  {
    id: 'operacion',
    titulo: 'Operación',
    pista: 'Firma, envío, validación y activación',
    secciones: [
      { href: '/gestor/luz/contratos', icono: FileSignature, nombre: 'Contratos y activaciones' },
    ],
  },
  {
    // Riesgo, cobro, rendimiento y trazabilidad. Nace plegado: Marcos lo mira
    // cuando decide, no mientras trabaja, y a David y Nicola no les toca.
    id: 'control',
    titulo: 'Control',
    pista: 'Cobro, rendimiento y trazabilidad',
    plegadoPorDefecto: true,
    secciones: [
      { href: '/gestor/luz/comisiones', icono: Euro, nombre: 'Comisiones' },
      { href: '/gestor/luz/control-cartera', icono: ShieldCheck, nombre: 'Control de cartera', soloAdmin: true },
      { href: '/gestor/luz/parte', icono: ClipboardList, nombre: 'Parte del día', soloAdmin: true },
      { href: '/gestor/luz/equipo', icono: UserCog, nombre: 'Equipo y logros' },
      { href: '/gestor/luz/importar', icono: ArrowDownUp, nombre: 'Importación / Exportación' },
      /*
       * CONSUMO REAL (Datadis) SALE DEL MENÚ.
       *
       * Cero consultas y cero filas guardadas desde que existe, y no es un
       * fallo de la pantalla: Datadis exige que CADA TITULAR autorice el NIF
       * de Gesmeco en datadis.es, y esa autorización no se ha pedido nunca.
       * Una entrada que no puede funcionar hasta que pase algo fuera del
       * sistema no debe ocupar sitio: la ruta sigue viva en
       * /gestor/luz/consumo y vuelve al menú el día que haya un cliente
       * autorizado — que entonces vale mucho.
       */
    ],
  },
  {
    id: 'herramientas',
    titulo: 'Herramientas',
    pista: 'De usar cuando toca',
    plegadoPorDefecto: true,
    secciones: [
      { href: '/gestor/luz/fv', icono: Calculator, nombre: 'Calculadora FV', soloAdmin: true },
      { href: '/gestor/luz/tarifas', icono: TrendingUp, nombre: 'Tarifas y comparador', soloAdmin: true },
      { href: '/gestor/luz/guia', icono: BookOpen, nombre: 'Guía rápida' },
      /*
       * FUERA DEL MENÚ, y las dos por el mismo motivo: no deciden nada.
       *
       * · PROYECTOS DE AHORRO: cero registros desde que existe. Era una tabla
       *   genérica (título + JSON libre) sin estados ni conexiones. Lo que
       *   pretendía hacer lo hacen ahora Estudios (la comparativa) y
       *   Actuaciones (las mejoras técnicas), las dos con estructura de verdad.
       * · PRECIO DE LA LUZ: información pública que no lee ni escribe ningún
       *   dato del CRM. Se consulta mejor en su fuente.
       *
       * Las rutas siguen vivas; lo que se retira es el sitio en el menú.
       */
    ],
  },
  {
    id: 'ajustes',
    titulo: 'Ajustes',
    pista: 'Se tocan una vez y se olvidan',
    plegadoPorDefecto: true,
    secciones: [
      { href: '/gestor/luz/control', icono: History, nombre: 'Control general', soloAdmin: true },
      { href: '/gestor/luz/usuarios', icono: ShieldCheck, nombre: 'Usuarios y permisos', soloAdmin: true },
      { href: '/gestor/luz/configuracion', icono: Settings, nombre: 'Configuración', soloAdmin: true },
      { href: '/gestor/luz/papelera', icono: Trash2, nombre: 'Papelera', soloAdmin: true },
    ],
  },
];

// La clave lleva versión: al reagrupar el menú (GL-02) los identificadores de
// bloque cambiaron, así que la preferencia guardada apuntaba a bloques que ya
// no existen y habría dejado a todo el mundo con Control desplegado. Subir la
// versión da los valores nuevos una vez y a partir de ahí manda cada uno.
const CLAVE_PLEGADOS = 'gesmeco:luz:bloques-plegados:v2';

/**
 * Lo que nace plegado. Sale de los propios bloques para que no haya dos sitios
 * que decidan lo mismo: si un bloque se marca como plegado arriba, aquí se
 * respeta solo.
 */
const PLEGADOS_POR_DEFECTO = BLOQUES.filter((b) => b.plegadoPorDefecto).map((b) => b.id);

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
          {/* El puente al otro módulo, también en el móvil. Cuando se montó
              Gestión energética solo se llegaba tecleando la URL, y en el
              teléfono eso es no llegar. */}
          <Link
            href="/gestor/energia"
            className="mb-5 flex min-h-[44px] items-center gap-2 rounded-xl border border-lime-500/30 bg-lime-500/10 px-3 text-sm font-bold text-lime-300"
          >
            <Leaf className="w-4 h-4 shrink-0" /> Gestión energética
          </Link>
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

          {/* EL PUENTE AL OTRO MÓDULO.
              Un cliente es uno solo: quien está mirando su contrato tiene que
              poder saltar a su expediente energético sin volver por el panel.
              Cuando se montó Gestión energética, esta pantalla no la enlazaba
              desde ningún sitio y solo se llegaba tecleando la URL. */}
          <Link
            href="/gestor/energia"
            title="Gestión energética · expedientes, medidas e ISO"
            className="hidden lg:flex shrink-0 items-center gap-1.5 rounded-lg border border-lime-500/30 bg-lime-500/10 px-3 py-2 text-xs font-bold text-lime-300 transition hover:bg-lime-500/20"
          >
            <Leaf className="w-3.5 h-3.5" /> Gestión energética
          </Link>

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
      {/* Meter algo nuevo se hace EN MEDIO de otra cosa: por eso va flotante y
          no en el menú, que es lo que el plan quiere despejar. */}
      <BotonCapturar />
    </div>
  );
}
