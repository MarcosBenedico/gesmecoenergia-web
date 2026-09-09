'use client';

/**
 * GUÍA RÁPIDA — cómo se trabaja la cartera con este panel.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * QUÉ ES Y QUÉ NO ES
 *
 * NO es un manual de pantallas: para eso está el menú, que ya dice lo que hay.
 * Es la respuesta a las tres preguntas que se hacen de verdad:
 *
 *   · ¿Esto lo hago yo o lo hace otro?
 *   · ¿Dónde va este dato, que lo he visto en dos sitios?
 *   · ¿Qué hace el panel solo y qué tengo que hacer yo?
 *
 * La segunda es la que más cuesta cuando se equivoca: un vencimiento apuntado
 * en dos sitios acaba con dos avisos que se contradicen, y ahí se deja de
 * creer la pantalla. Por eso hay un bloque entero para eso.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUÉ VA POR FUNCIÓN Y NO POR NOMBRE
 *
 * Antes esta guía decía «David · Calle» y «Nicola · Oficina» escritos a mano.
 * Un documento con nombres dentro envejece el día que alguien cambia de
 * puesto, y entonces enseña un reparto que ya no existe — que es peor que no
 * tener guía. Ahora las columnas son las FUNCIONES (calle, oficina,
 * dirección) y quién las hace hoy se lee de Usuarios, igual que el resto del
 * panel. Ver `src/lib/equipo.ts`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ADEMÁS ES LA PUERTA DE LAS PANTALLAS QUE NO ESTÁN EN EL MENÚ
 *
 * Al limpiar el menú, «Precio de la luz» y «Fechas críticas» se quedaron sin
 * un solo enlace: existían y solo se llegaba tecleando la URL. Una pantalla a
 * la que no se llega es una pantalla que no está hecha, así que el último
 * bloque las enlaza y dice por qué no ocupan sitio en el menú.
 *
 * SE ACTUALIZA CADA VEZ QUE CAMBIA LA FORMA DE TRABAJAR. Si esta guía miente,
 * hace más daño que si no existiera.
 */

import Link from 'next/link';
import {
  BookOpen, CheckCircle2, Zap, Sparkles, ArrowRight, Bot, Hand, EyeOff,
} from 'lucide-react';
import { useEquipo, FUNCION_LABEL, type FuncionEquipo } from '@/lib/equipo';
import { Card } from '../ui';

// ── Quién hace qué, por FUNCIÓN ─────────────────────────────────────────────

interface Puesto {
  funcion: FuncionEquipo;
  icono: string;
  pregunta: string;
  hace: string;
  suyo: string[];
  regla: string;
  color: string;
  href: string;
}

const PUESTOS: Puesto[] = [
  {
    funcion: 'calle',
    icono: '🚗',
    pregunta: '¿A dónde voy hoy y qué me llevo hecho?',
    hace: 'Visita, capta y trae la factura.',
    suyo: ['Mi Día (Hoy · Por zona · Calendario)', 'Rutas de visitas', 'Registrar visita desde cualquier sitio'],
    regla: 'Su trabajo NO es meter datos: es traer los que faltan. Lo que capta entra en el sistema en la puerta con «+ Capturar».',
    color: 'border-accent/40 bg-accent/5',
    href: '/gestor/luz/mi-dia',
  },
  {
    funcion: 'oficina',
    icono: '🗂️',
    pregunta: '¿Qué está atascado esperándome?',
    hace: 'Mete lo que falta, desatasca y tramita.',
    suyo: ['Bandeja', 'Rellenar en tanda', 'Clientes y Suministros', 'Contratos y activaciones'],
    regla: 'La Bandeja no ordena por fecha: ordena por A QUIÉN BLOQUEA. Lo primero de la lista es lo que impide que la calle salga bien.',
    color: 'border-secondary/40 bg-secondary/5',
    href: '/gestor/luz/bandeja',
  },
  {
    funcion: 'direccion',
    icono: '📊',
    pregunta: '¿Qué decido hoy y dónde se me escapa el control?',
    hace: 'Decide, estudia y cobra.',
    suyo: ['Dashboard', 'Estudios y propuestas', 'Control de cartera', 'Comisiones', 'Parte del día'],
    regla: 'El Dashboard son CINCO decisiones, no un inventario. Las listas largas de excepciones viven en Control de cartera, que es otra pregunta.',
    color: 'border-amber-500/40 bg-amber-500/5',
    href: '/gestor/luz',
  },
];

// ── Los bloques del menú: qué pregunta contesta cada uno ────────────────────

const BLOQUES: [string, string, string][] = [
  ['Inicio', 'Qué hay que decidir hoy', 'Dashboard (cinco decisiones) y Automatizaciones (el trabajo que debería existir y no existe).'],
  ['La calle', 'A dónde voy y qué me llevo hecho', 'Mi Día, Rutas y el Mapa de oportunidades.'],
  ['Oficina', 'Meter lo que falta y desatascar', 'Bandeja, Clientes, Suministros y Rellenar en tanda.'],
  ['Comercial', 'Vender y hacer seguimiento', 'Pipeline y Estudios y propuestas.'],
  ['Operación', 'Firma, envío, validación y activación', 'Contratos y activaciones.'],
  ['Control', 'Cobro, rendimiento y trazabilidad', 'Comisiones, Control de cartera, Parte del día, Equipo e Importación.'],
  ['Herramientas', 'De usar cuando toca', 'Calculadora FV, Tarifas y esta guía. Nace plegado.'],
  ['Ajustes', 'Se tocan una vez y se olvidan', 'Control general, Usuarios, Configuración y Papelera. Nace plegado.'],
];

// ── Un dato, un sitio: las confusiones que cuestan dinero ───────────────────

interface UnSitio {
  dato: string;
  donde: string;
  href: string;
  porque: string;
  noEn: string;
}

const UN_SITIO: UnSitio[] = [
  {
    dato: 'Fin de contrato, permanencia y preaviso',
    donde: 'En la ficha del SUMINISTRO',
    href: '/gestor/luz/cups',
    porque: 'Los avisos de Mi Día se calculan en vivo desde ahí, así que corregir la fecha corrige el aviso al momento.',
    noEn: 'Nunca como fecha crítica aparte. Llegó a haber 86 duplicadas, y la copia se quedaba vieja en cuanto alguien corregía el suministro.',
  },
  {
    dato: 'El siguiente paso con un cliente',
    donde: 'Una TAREA, con responsable y fecha',
    href: '/gestor/luz/mi-dia',
    porque: 'Manda la tarea. El campo «próxima acción» de la ficha se conserva como nota, y si se contradicen, Control de cartera lo enseña.',
    noEn: 'No lo escribas solo en la ficha: la ficha pone «llamar mañana» y la tarea real venció hace ocho días. Nadie miente y el cliente se cae igual.',
  },
  {
    dato: 'El consumo anual',
    donde: 'En el SUMINISTRO, y se escribe con el punto de los miles',
    href: '/gestor/luz/cups',
    porque: 'Debajo del campo sale siempre cómo se ha entendido («Se guardará 53.558 kWh al año»). Léelo: es lo que evita el error.',
    noEn: 'Llegaron a entrar 57 CUPS mil veces menores — un club de pádel con 19 kWh al año. No se ve al guardar, se ve semanas después dentro de una oferta.',
  },
  {
    dato: 'Lo que se le ha dicho a un cliente',
    donde: 'Un ESTUDIO, que congela los precios de ese día',
    href: '/gestor/luz/estudios',
    porque: 'Cuando llame en dos meses preguntando por «los 1.400 € que me dijisteis», está ahí con la fecha y los precios que se usaron.',
    noEn: 'No vale rehacer el cálculo: al día siguiente de subir precios diría otra cosa que el papel que tiene el cliente en la mano.',
  },
  {
    dato: 'Qué pasó en una visita',
    donde: 'El botón «+ Capturar» → Registrar visita',
    href: '/gestor/luz/mi-dia',
    porque: 'Cuatro botones y sin escribir nada. Mueve el embudo, programa la siguiente pasada y, si dan la factura, arranca el estudio.',
    noEn: 'No hace falta que el cliente esté en la ruta del día: se busca y ya. Antes eso hacía imposible apuntar media calle.',
  },
  {
    dato: 'Una comisión',
    donde: 'Con IMPORTE y FECHA prevista, o no cuenta',
    href: '/gestor/luz/comisiones',
    porque: 'Sin eso no se puede reclamar: sale en «sin datos para reclamar» con el motivo, y el panel no genera aviso de cobro.',
    noEn: 'No se reclama un apunte que nadie ha confirmado. Hay 29 así, que suman 217 € entre todas.',
  },
];

// ── El día de cada puesto ───────────────────────────────────────────────────

const DIAS: Record<FuncionEquipo, { icono: string; pasos: [string, string][] }> = {
  calle: {
    icono: '🚗',
    pasos: [
      ['Abre Mi Día · HOY', 'El número grande es lo de hoy, ya. Lo muy atrasado se aparca solo en un plegable para que el número siga siendo real: 74 cosas no se priorizan, se ignoran.'],
      ['Los días de calle, vista POR ZONA', 'Se conduce a un pueblo, no a una fecha. Ahí se monta la ruta y salen las oportunidades que pillan de paso, sin un kilómetro más.'],
      ['Mira qué le falta a cada uno', 'Cada línea lo dice. El peor resultado de una visita no es un no: es plantarse allí y no poder ofertar porque faltaba el consumo.'],
      ['Registra la visita en la puerta', 'Cuatro botones. Si se cae la cobertura no se pierde: se guarda y al reintentar sigue donde se quedó, sin duplicar.'],
      ['Si te dan la factura, foto', '«Me dio la factura» la lee ahí mismo y crea el suministro. Es el dato que más cosas desbloquea.'],
    ],
  },
  oficina: {
    icono: '🗂️',
    pasos: [
      ['Abre la Bandeja y elige una tanda', 'Ocho tandas con nombre. Teclear ocho consumos seguidos cuesta la mitad que saltar de meter datos a llamar y volver.'],
      ['Lo que tiene visita esta semana, primero', 'Sube 50 puntos y lo dice: sin ese dato, el jueves se va con las manos vacías.'],
      ['Rellenar en tanda para los huecos', 'Se elige UN campo y se rellenan todos los que lo tienen vacío, en una rejilla. Enter salta de fila.'],
      ['Mete las fechas del contrato en el suministro', 'Es lo que enciende el preaviso. Sin ellas el panel lo dice —«no se puede calcular»— pero no puede avisar.'],
      ['Tramita lo firmado', 'Al cambiar el estado del contrato, el suministro y el cliente se actualizan solos.'],
    ],
  },
  direccion: {
    icono: '📊',
    pasos: [
      ['Dashboard: las cinco decisiones', 'Ordenadas por lo que se pierde para siempre, no por importe. El dinero ordena dentro de cada escalón y nunca salta al de arriba.'],
      ['Automatizaciones: revisar y aplicar', 'Propone el trabajo que falta y NO lo crea solo. Un clic al día mantiene la lista creíble.'],
      ['Estudios: convertir facturas en propuestas', 'La vía buena es la plantilla de Excel con los doce meses. Con un mes, el año se estima, y una granja de agosto no se parece a la de febrero.'],
      ['Control de cartera: dónde se escapa', 'Aquí solo sale lo que está mal, con nombre y responsable. Es otra pregunta que el Dashboard.'],
      ['Comisiones: qué se puede reclamar HOY', 'Separado de lo previsto y de lo que espera a la comercializadora. Un montón de «pendientes» no se puede accionar.'],
    ],
  },
};

// ── Qué hace el panel solo y qué no hará nunca ──────────────────────────────

const SOLO: string[] = [
  'Calcula los vencimientos de contrato, permanencia y preaviso desde el suministro. Nunca se quedan desfasados.',
  'Sincroniza los estados: al mover el pipeline o un contrato, el suministro y el cliente se ponen al día.',
  'Reparte las tareas nuevas según la función de cada uno, no según un nombre escrito en el código.',
  'Guarda la fila entera antes y después de cada cambio, y de ahí sale el Parte del día.',
  'Manda a la Papelera lo eliminado, con todo lo que colgaba. Eliminar dejó de ser irreversible.',
];

const NUNCA: string[] = [
  'No cambia una etapa porque haya pasado el tiempo: eso sería inventarse un resultado.',
  'No crea tareas por su cuenta. Las propone y las aplica una persona — un sistema que crea trabajo en silencio llena la lista de cosas que nadie pidió, y entonces se deja de mirar la lista.',
  'No corrige un dato dudoso. Lo marca con el motivo escrito y lo deja tal cual: un dato que falta se ve, uno inventado no.',
  'No manda nada al cliente. Ni un correo ni un WhatsApp automático.',
  'No inventa una fecha que no consta. Si falta el fin de contrato dice «no se puede calcular» en vez de suponerlo.',
];

// ── Reglas de oro ───────────────────────────────────────────────────────────

const REGLAS_ORO: [string, string][] = [
  ['Ningún expediente abierto sin siguiente acción', 'Con responsable, acción concreta y fecha. Es la regla madre y de ella cuelga todo Control de cartera. Si no sabes el paso, pon «revisar más adelante» con fecha.'],
  ['Lo dudoso se marca, nunca se corrige', 'Un CUPS mal formado o un precio raro se señalan y se dejan. Solo se bloquea lo que hace mentir a un cálculo — como rellenar tres periodos de los seis de una 3.0TD, que saca el ahorro al doble sin que nada lo delate.'],
  ['Aplazar, siempre con motivo', 'El panel lo pide y lo guarda. No es control: sin el motivo, al mes una lista de aplazados deja de significar nada.'],
  ['Un dato incompleto se guarda igual', 'Un suministro apuntado en la puerta de una granja tiene tres datos. Negarse a guardarlo hasta tenerlos todos es perder la visita entera. Lo único obligatorio es el CUPS.'],
  ['Si dos pantallas dicen cosas distintas, es un fallo', 'Toda la aplicación pregunta a un solo sitio: las etapas a `etapas.ts`, los plazos a `seguimiento.ts`. Ninguna pantalla tiene criterio propio de urgencia. Si ves una contradicción, dilo.'],
  ['Las visitas necesitan ubicación', 'Un cliente sin dirección no entra en las rutas ni se agrupa por zona. Con el código postal basta para colocarlo.'],
];

// ── Lo nuevo ────────────────────────────────────────────────────────────────

const NOVEDADES: string[] = [
  'Registrar una visita ya no exige que el cliente esté en la ruta del día: se hace desde «+ Capturar» en cualquier pantalla, y si se cae la cobertura no se pierde ni se duplica al reintentar.',
  'Cuando falta el fin de contrato, el suministro lo DICE («no se puede calcular el preaviso») en vez de callar. Eran 89 de 162 suministros sin vigilancia y sin ninguna señal.',
  'Comisiones separa lo que se puede reclamar hoy, lo que espera a la comercializadora, lo previsto y lo que no tiene datos para reclamar.',
  'El suministro tiene ficha propia con cinco pestañas, y la primera no es «Datos» sino «Qué pasa».',
  'Si dos personas editan la misma ficha, el panel avisa en vez de pisar el cambio del otro.',
  'Estudios y propuestas: la factura, el ahorro y el PDF quedan guardados con los precios de ese día, congelados.',
  'El menú va por forma de trabajar y cada uno pliega los bloques que no usa.',
];

// ── Pantallas que existen y no ocupan sitio en el menú ──────────────────────

const NO_EN_MENU: [string, string, string][] = [
  ['/gestor/luz/mercado', 'Precio de la luz', 'El precio del mercado diario. Es información pública y no se decide nada con ella a diario, así que no gasta una entrada de menú — pero está aquí y no se ha borrado.'],
  ['/gestor/luz/fechas', 'Fechas críticas', 'Los vencimientos ya se calculan solos desde el suministro y salen en Mi Día. Esta pantalla queda para crear o corregir alguno a mano en un caso raro.'],
  ['/gestor/luz/tareas', 'Tareas (lista completa)', 'Mi Día enseña lo tuyo y lo de hoy. Aquí está la lista entera, para crear o editar en detalle.'],
  ['/gestor/luz/consumo', 'Consumo real (Datadis)', 'La curva y el maxímetro que da la distribuidora. Requiere que el titular autorice nuestro NIF en datadis.es: sin eso devuelve lista vacía, y es la causa del 90 % de los «no funciona».'],
  ['/gestor/luz/proyectos', 'Proyectos de ahorro', 'Anterior al módulo de Gestión energética, que es donde vive esto ahora.'],
  ['/gestor/energia', 'Gestión energética', 'El otro negocio: no «¿a quién vendo?» sino «¿cómo usa la energía este cliente y qué le mejoramos?». En construcción, y con enlace propio en la cabecera.'],
];

export default function GuiaPage() {
  const { equipo } = useEquipo();

  /** Quién hace hoy esa función. Sale de Usuarios, no de un nombre escrito aquí. */
  const quien = (f: FuncionEquipo) => {
    const gente = equipo.filter((m) => m.activo && m.funcion === f).map((m) => m.responsable);
    return gente.length ? gente.join(' · ') : null;
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-black text-foreground flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-accent" /> Guía rápida · Cómo trabajamos la cartera
        </h2>
        <p className="text-xs text-muted mt-0.5">
          Tres minutos. Quién hace qué, dónde va cada dato, cómo es un día normal y qué hace el panel solo.
        </p>
      </div>

      {/* Quien ya conocía el panel necesita saber qué es distinto, no releerlo entero. */}
      <Card className="!p-4 border-accent/30 bg-accent/5">
        <p className="text-sm font-black text-foreground flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-accent" /> Lo que ha cambiado últimamente
        </p>
        <ul className="space-y-1">
          {NOVEDADES.map((n) => (
            <li key={n} className="text-xs text-muted leading-relaxed">· {n}</li>
          ))}
        </ul>
      </Card>

      {/* ── Quién hace qué ── */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted mb-1">Quién hace qué</p>
        <p className="text-[11px] text-muted mb-3">
          Va por función y no por nombre: quién la hace hoy sale de{' '}
          <Link href="/gestor/luz/usuarios" className="text-accent hover:underline">Usuarios</Link>,
          así esta guía no envejece cuando alguien cambia de puesto.
        </p>
        <div className="grid md:grid-cols-3 gap-3">
          {PUESTOS.map((p) => {
            const gente = quien(p.funcion);
            return (
              <Link key={p.funcion} href={p.href} className={`block rounded-2xl border p-4 transition hover:-translate-y-0.5 ${p.color}`}>
                <p className="text-xl">{p.icono}</p>
                <p className="font-black text-foreground text-sm leading-tight mt-1">{FUNCION_LABEL[p.funcion]}</p>
                {/* Si nadie tiene esa función asignada NO se inventa un nombre: se
                    dice que falta, que es una cosa que arreglar en Usuarios. */}
                <p className="text-[10px] text-muted uppercase tracking-wide font-bold">
                  {gente || 'Sin nadie asignado'}
                </p>
                <p className="text-xs font-semibold text-foreground mt-2 italic">«{p.pregunta}»</p>
                <p className="text-xs text-muted mt-1">{p.hace}</p>
                <ul className="mt-1.5 space-y-0.5">
                  {p.suyo.map((s) => <li key={s} className="text-[11px] text-muted">· {s}</li>)}
                </ul>
                <p className="text-[11px] text-foreground/80 mt-2 pt-2 border-t border-border/30 leading-snug">💡 {p.regla}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── El mapa del menú ── */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted mb-1">El mapa del menú</p>
        <p className="text-[11px] text-muted mb-3">
          Ocho bloques, y cada uno contesta una pregunta distinta. Están ordenados por forma de trabajar, no por tipo de dato.
        </p>
        <Card className="!p-0 divide-y divide-border/20">
          {BLOQUES.map(([nombre, pista, que]) => (
            <div key={nombre} className="p-3.5">
              <p className="text-sm font-bold text-foreground">
                {nombre} <span className="font-normal text-muted">· {pista}</span>
              </p>
              <p className="text-xs text-muted mt-0.5 leading-relaxed">{que}</p>
            </div>
          ))}
        </Card>
      </div>

      {/* ── Un dato, un sitio ── */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted mb-1">Un dato, un sitio</p>
        <p className="text-[11px] text-muted mb-3">
          El bloque más importante de la guía. Un dato apuntado en dos sitios acaba diciendo dos cosas
          distintas, y ahí se deja de creer la pantalla — que es lo único que no se recupera.
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          {UN_SITIO.map((u) => (
            <Link key={u.dato} href={u.href} className="block rounded-2xl border border-border/40 bg-card/40 p-4 transition hover:-translate-y-0.5 hover:border-accent/40">
              <p className="text-sm font-black text-foreground leading-tight">{u.dato}</p>
              <p className="text-xs font-bold text-accent mt-1.5 flex items-start gap-1.5">
                <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {u.donde}
              </p>
              <p className="text-[11px] text-muted mt-1.5 leading-relaxed">{u.porque}</p>
              <p className="text-[11px] text-amber-300/90 mt-1.5 pt-1.5 border-t border-border/30 leading-relaxed">⚠️ {u.noEn}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Un día normal, por función ── */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted mb-3">Un día normal</p>
        <div className="grid md:grid-cols-3 gap-3">
          {PUESTOS.map((p) => (
            <div key={p.funcion}>
              <p className="text-[11px] font-black uppercase tracking-wide text-muted mb-2">
                {DIAS[p.funcion].icono} {FUNCION_LABEL[p.funcion].split(' (')[0]}
              </p>
              <Card className="!p-0 divide-y divide-border/20">
                {DIAS[p.funcion].pasos.map(([titulo, detalle], i) => (
                  <div key={titulo} className="flex items-start gap-2.5 p-3">
                    <span className="w-6 h-6 rounded-full bg-accent/15 text-accent border border-accent/30 flex items-center justify-center font-black text-[11px] shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground leading-tight">{titulo}</p>
                      <p className="text-[11px] text-muted mt-0.5 leading-relaxed">{detalle}</p>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      </div>

      {/* ── Lo que hace solo y lo que no hará nunca ── */}
      <div className="grid md:grid-cols-2 gap-3">
        <Card className="!p-4 border-emerald-500/30">
          <p className="text-sm font-black text-foreground flex items-center gap-2 mb-2">
            <Bot className="w-4 h-4 text-emerald-400" /> Lo que hace el panel solo
          </p>
          <ul className="space-y-1.5">
            {SOLO.map((s) => <li key={s} className="text-[11px] text-muted leading-relaxed">· {s}</li>)}
          </ul>
        </Card>
        <Card className="!p-4 border-amber-500/30">
          <p className="text-sm font-black text-foreground flex items-center gap-2 mb-2">
            <Hand className="w-4 h-4 text-amber-400" /> Lo que NO hará nunca solo
          </p>
          <ul className="space-y-1.5">
            {NUNCA.map((s) => <li key={s} className="text-[11px] text-muted leading-relaxed">· {s}</li>)}
          </ul>
        </Card>
      </div>

      {/* ── Reglas de oro ── */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted mb-3">Las seis reglas de oro</p>
        <div className="grid md:grid-cols-2 gap-3">
          {REGLAS_ORO.map(([regla, detalle]) => (
            <Card key={regla} className="!p-3.5">
              <p className="text-sm font-bold text-foreground flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> {regla}
              </p>
              <p className="text-xs text-muted mt-1 leading-relaxed pl-6">{detalle}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Las que no salen en el menú ── */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted mb-1">Existen y no salen en el menú</p>
        <p className="text-[11px] text-muted mb-3">
          Una entrada de menú no cuesta servidor, cuesta atención — y la paga cada día quien tiene prisa. Estas
          se usan de vez en cuando, así que viven aquí. <b className="text-foreground">No se ha borrado ninguna.</b>
        </p>
        <Card className="!p-0 divide-y divide-border/20">
          {NO_EN_MENU.map(([href, nombre, que]) => (
            <Link key={href} href={href} className="flex items-start gap-3 p-3.5 transition hover:bg-card/60">
              <EyeOff className="w-4 h-4 text-muted shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">{nombre}</p>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">{que}</p>
              </div>
            </Link>
          ))}
        </Card>
      </div>

      <Card className="!border-accent/30 flex items-start gap-3">
        <Zap className="w-5 h-5 text-accent shrink-0 mt-0.5" />
        <p className="text-xs text-muted leading-relaxed">
          <b className="text-foreground">¿Duda de dónde apuntar algo?</b> Si lo hace una persona un día concreto, es
          una <b className="text-foreground">tarea</b> y sale en Mi Día. Si es una fecha del contrato, va en el{' '}
          <b className="text-foreground">suministro</b> y el aviso sale solo. Si es cómo va la venta, es el{' '}
          <b className="text-foreground">pipeline</b>. Si es lo que se le ha dicho al cliente, es un{' '}
          <b className="text-foreground">estudio</b>. Y si no encaja en ninguno, escríbelo en las observaciones del
          cliente antes que perderlo: un dato mal colocado se mueve, uno que no se apuntó no vuelve.
        </p>
      </Card>
    </div>
  );
}
