'use client';

import Link from 'next/link';
import { BookOpen, CheckCircle2, Zap } from 'lucide-react';
import { Card } from '../ui';

/**
 * Guía rápida del método de trabajo: qué va en cada sitio y cómo es un día normal.
 * Una sola página, visual, para que David y Nicola nunca dupliquen ni olviden nada.
 */

const HERRAMIENTAS = [
  {
    icono: '✅',
    nombre: 'Tarea',
    donde: 'Tareas y Alertas · Mi Día',
    es: 'Algo que hace UNA PERSONA un día concreto.',
    ejemplos: ['Llamar a Casa Guardia el jueves', 'Pedir factura a Talleres Cinca', 'Visitar la granja de Alcampell'],
    regla: 'Si lo tiene que hacer alguien del equipo, es una tarea. Siempre con fecha y responsable.',
    color: 'border-amber-500/40 bg-amber-500/5',
    href: '/gestor/luz/tareas',
  },
  {
    icono: '📅',
    nombre: 'Fecha crítica',
    donde: 'Fechas Críticas',
    es: 'Algo que OCURRE SOLO, del contrato del cliente.',
    ejemplos: ['Fin de contrato el 30/10', 'Fin de permanencia el 3/9', 'Presentar proyecto (máx. 1 semana)'],
    regla: 'No es trabajo tuyo: es un evento que llega sí o sí. Cuando se acerque, generará tareas.',
    color: 'border-red-500/40 bg-red-500/5',
    href: '/gestor/luz/fechas',
  },
  {
    icono: '🎯',
    nombre: 'Oportunidad (Pipeline)',
    donde: 'Pipeline Energético',
    es: 'En qué punto está LA VENTA con ese cliente.',
    ejemplos: ['Prospecto → Factura recibida → Oferta enviada → GANADO', 'Comisión potencial: 500 €'],
    regla: 'Una por cliente vivo. Se mueve de columna cuando avanza la venta, no se toca a diario.',
    color: 'border-secondary/40 bg-secondary/5',
    href: '/gestor/luz/pipeline',
  },
  {
    icono: '→',
    nombre: 'Próxima acción',
    donde: 'Ficha del cliente · Pipeline',
    es: 'EL siguiente paso único con ese cliente.',
    ejemplos: ['→ Enviar comparativa', '→ Esperar respuesta a la oferta'],
    regla: 'Solo hay UNA por cliente y está sincronizada entre ficha y pipeline. No la dupliques como tarea salvo que tenga día y hora concretos.',
    color: 'border-accent/40 bg-accent/5',
    href: '/gestor/luz/clientes',
  },
];

const DIA_NORMAL = [
  ['1', 'Abre Mi Día', 'Ahí está tu cola: tareas de hoy, atrasadas y avisos. No hace falta ir pantalla por pantalla.'],
  ['2', 'Trabaja las tareas', 'Cada llamada o visita: márcala hecha ✓, o pospónla (+1 día / +1 semana) si no ha podido ser. Nunca la dejes vencida sin más.'],
  ['3', 'Al terminar con un cliente, deja el siguiente paso', 'Actualiza su próxima acción (o crea la tarea con fecha). La regla de oro: ningún cliente vivo sin próxima acción.'],
  ['4', 'Cliente nuevo → Alta guiada', 'Nunca a mano: el asistente crea cliente, suministro, oportunidad, primera tarea y las dos fechas clave sin olvidar nada.'],
  ['5', 'Si la venta avanza, mueve el pipeline', 'Arrastra la tarjeta a su columna. Si está GANADA, el botón "Crear contrato" avisa solo a administración.'],
];

const REGLAS_ORO = [
  ['Ningún cliente vivo sin próxima acción', 'Es la alerta roja del Dashboard. Si no sabes el siguiente paso, ponle "Revisar más adelante" con fecha.'],
  ['Una cosa, un sitio', 'La cita del jueves es UNA tarea; no la apuntes también como fecha crítica. El fin de contrato es UNA fecha crítica; no lo dupliques como tarea (ya avisará).'],
  ['Eliminar siempre con motivo', 'Al borrar una tarea el sistema pide el porqué. Queda registrado — mejor posponer o cancelar con motivo que borrar.'],
  ['Las fechas críticas se asocian al CUPS', 'Si el cliente tiene varios suministros, elige a cuál pertenece la fecha para saber qué contrato vence.'],
  ['El proyecto se presenta en 1 semana', 'Desde que captas al cliente. El alta guiada no deja poner más; si vas justo, avisa a Marcos antes de que venza.'],
  ['Las visitas, con ubicación', 'Cliente sin dirección no entra en las Rutas. Pega el enlace de Google Maps en su ficha y listo.'],
];

export default function GuiaPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-black text-foreground flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-accent" /> Guía rápida · Cómo trabajamos la cartera
        </h2>
        <p className="text-xs text-muted mt-0.5">
          Dos minutos de lectura. Qué va en cada sitio, cómo es un día normal y las reglas para que nada se pierda ni se duplique.
        </p>
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

      {/* ── Un día normal ── */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted mb-3">Un día normal, en 5 pasos</p>
        <Card className="!p-0 divide-y divide-border/20">
          {DIA_NORMAL.map(([n, titulo, detalle]) => (
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
          <b className="text-foreground">¿Duda de dónde apuntar algo?</b> Pregúntate: ¿lo hace una persona un día concreto (tarea),
          ocurre solo (fecha crítica), o es cómo va la venta (pipeline)? Y si es el siguiente paso del cliente, a su próxima acción.
        </p>
      </Card>
    </div>
  );
}
