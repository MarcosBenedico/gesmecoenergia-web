'use client';

import Link from 'next/link';
import { BookOpen, CheckCircle2, Zap, Sparkles } from 'lucide-react';
import { Card } from '../ui';

/**
 * Guía rápida del método de trabajo: quién hace qué, cómo es un día normal y
 * las reglas para que nada se pierda ni se duplique.
 * Se actualiza cada vez que cambia la forma de trabajar del panel.
 */

const QUIEN_HACE_QUE = [
  {
    icono: '🚗',
    quien: 'David · Calle',
    bloque: 'Bloque CALLE del menú',
    hace: 'Visita, capta y empuja las ventas.',
    suyo: ['Mi Día', 'Rutas de visitas', 'Pipeline'],
    regla: 'No da de alta clientes ni tramita papeleo: eso frena la calle. Lo que capta se lo pasa a Nicola.',
    color: 'border-accent/40 bg-accent/5',
    href: '/gestor/luz/mi-dia',
  },
  {
    icono: '🗂️',
    quien: 'Nicola · Oficina',
    bloque: 'Bloque OFICINA del menú',
    hace: 'Mete los datos, tramita y sostiene la cartera.',
    suyo: ['Alta guiada', 'Clientes', 'CUPS', 'Contratos', 'Tarifas', 'Importación'],
    regla: 'Es quien da de alta a todo el mundo. Si el dato está bien metido aquí, el resto del panel funciona solo.',
    color: 'border-secondary/40 bg-secondary/5',
    href: '/gestor/luz/alta',
  },
  {
    icono: '📊',
    quien: 'Marcos · Dirección',
    bloque: 'Bloque DIRECCIÓN del menú',
    hace: 'Mira el negocio y decide.',
    suyo: ['Dashboard', 'Precio de la luz', 'Comisiones', 'Equipo', 'Control General', 'Papelera'],
    regla: 'Ve todo lo de los demás, pero no hace falta que nadie le informe: el panel ya se lo cuenta.',
    color: 'border-amber-500/40 bg-amber-500/5',
    href: '/gestor/luz',
  },
];

const HERRAMIENTAS = [
  {
    icono: '📋',
    nombre: 'Mi Día',
    donde: 'Mi Día',
    es: 'TODO lo que hay que hacer, en una sola pantalla con tres vistas.',
    ejemplos: ['Llamar a Casa Guardia el jueves', 'Visitar la granja de Alcampell', 'Vence el contrato de Talleres Cinca'],
    regla: 'HOY es qué hago ahora. POR ZONA agrupa por pueblo para salir a la calle y montar la ruta. CALENDARIO es qué me espera. Las tres enseñan lo mismo: tus tareas y los vencimientos, juntos.',
    color: 'border-amber-500/40 bg-amber-500/5',
    href: '/gestor/luz/mi-dia',
  },
  {
    icono: '⚙️',
    nombre: 'Avisos automáticos',
    donde: 'Salen solos en Mi Día',
    es: 'Fin de contrato, fin de permanencia y límite de preaviso.',
    ejemplos: ['Vence el contrato · Casa Guardia', 'Acaba la permanencia · Granja Perlag'],
    regla: 'NO se crean a mano: el panel los lee del suministro. Si cambia la fecha del contrato, el aviso se corrige solo. Vienen marcados como «automático».',
    color: 'border-red-500/40 bg-red-500/5',
    href: '/gestor/luz/cups',
  },
  {
    icono: '🎯',
    nombre: 'Oportunidad (Pipeline)',
    donde: 'Pipeline Energético',
    es: 'En qué punto está LA VENTA con ese cliente.',
    ejemplos: ['Prospecto → Factura recibida → Oferta enviada → GANADO', 'Comisión potencial: 500 €'],
    regla: 'Su color se ve también en Mi Día: naranja es «pendiente de firma», o sea a punto de caer.',
    color: 'border-secondary/40 bg-secondary/5',
    href: '/gestor/luz/pipeline',
  },
  {
    icono: '→',
    nombre: 'Próxima acción',
    donde: 'Ficha del cliente · Pipeline',
    es: 'EL siguiente paso único con ese cliente.',
    ejemplos: ['→ Enviar comparativa', '→ Esperar respuesta a la oferta'],
    regla: 'Solo hay UNA por cliente y se sincroniza entre ficha y pipeline. No la dupliques como tarea salvo que tenga día concreto.',
    color: 'border-emerald-500/40 bg-emerald-500/5',
    href: '/gestor/luz/clientes',
  },
];

const DIA_DAVID: [string, string, string][] = [
  ['1', 'Abre Mi Día', 'El número grande es lo que tienes hoy. Lo atrasado sale arriba mezclado con lo de hoy: en la calle es lo mismo, hay que hacerlo ya.'],
  ['2', 'Mira el nombre y la banda de color', 'El cliente va en grande. Banda roja = cliente A, van primero. El distintivo de color dice en qué punto está la venta.'],
  ['3', 'Cada cosa: ✓ o mover', 'Hecho no pide explicaciones. Mover de día sí pide motivo, y queda escrito: así se sabe después si el freno es el cliente o nosotros.'],
  ['4', 'Remata los que están a punto', 'La lista «A un paso de entrar» son los que ya tienen la oferta encima. Un empujón ahí vale más que diez clientes nuevos.'],
  ['5', 'Cliente nuevo → pásaselo a Nicola', 'Tú captas; ella lo da de alta con el asistente para que no falte ningún dato.'],
];

const DIA_NICOLA: [string, string, string][] = [
  ['1', 'Alta guiada para todo cliente nuevo', 'Nunca a mano: el asistente crea cliente, suministro, oportunidad y primera tarea sin olvidar nada.'],
  ['2', 'Mete las fechas del contrato en el CUPS', 'Fin de contrato, permanencia y preaviso. Con eso, los avisos de Mi Día salen solos y siempre correctos.'],
  ['3', 'Tramita lo que esté firmado', 'Contratos y activaciones. Al cambiar el estado del contrato, el suministro y el cliente se actualizan solos.'],
  ['4', 'Revisa Mi Día', 'Lo administrativo se te asigna automáticamente según el tipo de tarea: papeleo, cobros y activaciones.'],
];

const REGLAS_ORO: [string, string][] = [
  ['Ningún cliente vivo sin próxima acción', 'Es la alerta roja del Dashboard. Si no sabes el siguiente paso, ponle "Revisar más adelante" con fecha.'],
  ['Los vencimientos no se apuntan: van en el CUPS', 'Fin de contrato, permanencia y preaviso se meten en el suministro. Mi Día los saca de ahí solo. Si los apuntas aparte tendrás dos avisos, y uno se quedará viejo.'],
  ['Mover de día, siempre con motivo', 'El panel te lo pide y lo guarda. No es control: es para saber por qué una gestión lleva tres semanas dando vueltas.'],
  ['Los estados se actualizan solos', 'Al mover el pipeline o cambiar un contrato, el suministro y el cliente se ponen al día automáticamente. No hay que tocarlo en tres pantallas.'],
  ['Nada se borra del todo', 'Lo eliminado va a la Papelera y se recupera con todo lo que colgaba de ello. Aun así, mejor posponer o cerrar con motivo que borrar.'],
  ['Las visitas, con ubicación', 'Cliente sin dirección no entra en las Rutas. Pega el enlace de Google Maps en su ficha y listo.'],
];

const NOVEDADES = [
  'La Agenda sustituye a «Tareas» y «Fechas Críticas»: una sola lista, con vista de calendario.',
  'Los vencimientos de contrato ya no se generan a mano: se leen del suministro y nunca se quedan desfasados.',
  'El menú está ordenado por forma de trabajar — Calle, Oficina y Dirección — y puedes plegar los bloques que no uses.',
  'El estado del cliente se calcula solo a partir de sus suministros.',
  'Hay Papelera: eliminar dejó de ser irreversible.',
];

export default function GuiaPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-black text-foreground flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-accent" /> Guía rápida · Cómo trabajamos la cartera
        </h2>
        <p className="text-xs text-muted mt-0.5">
          Dos minutos de lectura. Quién hace qué, cómo es un día normal y las reglas para que nada se pierda ni se duplique.
        </p>
      </div>

      {/* Lo que ha cambiado: quien ya conocía el panel necesita saber qué es distinto */}
      <Card className="!p-4 border-accent/30 bg-accent/5">
        <p className="text-sm font-black text-foreground flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-accent" /> Lo que ha cambiado
        </p>
        <ul className="space-y-1">
          {NOVEDADES.map((n) => (
            <li key={n} className="text-xs text-muted leading-relaxed">· {n}</li>
          ))}
        </ul>
      </Card>

      {/* ── Quién hace qué ── */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted mb-3">Quién hace qué</p>
        <div className="grid md:grid-cols-3 gap-3">
          {QUIEN_HACE_QUE.map((p) => (
            <Link key={p.quien} href={p.href} className={`block rounded-2xl border p-4 transition hover:-translate-y-0.5 ${p.color}`}>
              <p className="text-xl">{p.icono}</p>
              <p className="font-black text-foreground text-sm leading-tight mt-1">{p.quien}</p>
              <p className="text-[10px] text-muted uppercase tracking-wide font-bold">{p.bloque}</p>
              <p className="text-xs font-semibold text-foreground mt-2">{p.hace}</p>
              <ul className="mt-1.5 space-y-0.5">
                {p.suyo.map((s) => <li key={s} className="text-[11px] text-muted">· {s}</li>)}
              </ul>
              <p className="text-[11px] text-foreground/80 mt-2 pt-2 border-t border-border/30 leading-snug">💡 {p.regla}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Qué va en cada sitio ── */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted mb-3">Qué va en cada sitio</p>
        <div className="grid md:grid-cols-2 gap-3">
          {HERRAMIENTAS.map((h) => (
            <Link key={h.nombre} href={h.href} className={`block rounded-2xl border p-4 transition hover:-translate-y-0.5 ${h.color}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{h.icono}</span>
                <div>
                  <p className="font-black text-foreground text-sm leading-tight">{h.nombre}</p>
                  <p className="text-[10px] text-muted uppercase tracking-wide font-bold">{h.donde}</p>
                </div>
              </div>
              <p className="text-xs font-semibold text-foreground mt-2">{h.es}</p>
              <ul className="mt-1.5 space-y-0.5">
                {h.ejemplos.map((e) => <li key={e} className="text-[11px] text-muted">· {e}</li>)}
              </ul>
              <p className="text-[11px] text-foreground/80 mt-2 pt-2 border-t border-border/30 leading-snug">💡 {h.regla}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Un día normal, por puesto ── */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted mb-3">🚗 El día de David</p>
          <Card className="!p-0 divide-y divide-border/20">
            {DIA_DAVID.map(([n, titulo, detalle]) => (
              <div key={n} className="flex items-start gap-3 p-3.5">
                <span className="w-7 h-7 rounded-full bg-accent/15 text-accent border border-accent/30 flex items-center justify-center font-black text-xs shrink-0">{n}</span>
                <div>
                  <p className="text-sm font-bold text-foreground">{titulo}</p>
                  <p className="text-xs text-muted mt-0.5 leading-relaxed">{detalle}</p>
                </div>
              </div>
            ))}
          </Card>
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted mb-3">🗂️ El día de Nicola</p>
          <Card className="!p-0 divide-y divide-border/20">
            {DIA_NICOLA.map(([n, titulo, detalle]) => (
              <div key={n} className="flex items-start gap-3 p-3.5">
                <span className="w-7 h-7 rounded-full bg-secondary/15 text-secondary border border-secondary/30 flex items-center justify-center font-black text-xs shrink-0">{n}</span>
                <div>
                  <p className="text-sm font-bold text-foreground">{titulo}</p>
                  <p className="text-xs text-muted mt-0.5 leading-relaxed">{detalle}</p>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>

      {/* ── Reglas de oro ── */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted mb-3">Las 6 reglas de oro</p>
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

      <Card className="!border-accent/30 flex items-center gap-3">
        <Zap className="w-5 h-5 text-accent shrink-0" />
        <p className="text-xs text-muted">
          <b className="text-foreground">¿Duda de dónde apuntar algo?</b> Si lo hace una persona un día concreto, es una tarea
          (sale en Mi Día). Si es una fecha del contrato, va en el CUPS y el aviso sale solo. Si es cómo va la venta, es el
          pipeline. Y si es el siguiente paso con el cliente, su próxima acción.
        </p>
      </Card>
    </div>
  );
}
