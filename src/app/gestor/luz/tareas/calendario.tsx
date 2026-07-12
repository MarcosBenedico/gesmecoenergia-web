'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { LuzTarea, TIPO_TAREA_LABEL, TAREAS_ABIERTAS } from '@/lib/luz';
import { btnSecundario } from '../ui';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Color del chip según responsable, para distinguir de un vistazo el panel de cada uno. */
function tonoResponsable(r: string | null): string {
  if (!r) return 'bg-card/70 text-muted border-border/40';
  if (r.includes('/')) return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
  const n = r.toLowerCase();
  if (n.startsWith('marcos')) return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  if (n.startsWith('david')) return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
  if (n.startsWith('fernando')) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  return 'bg-card/70 text-muted border-border/40';
}

interface CalendarioProps {
  tareas: LuzTarea[];
  onMoverADia: (t: LuzTarea, fechaISO: string) => Promise<void> | void;
  onCompletar: (t: LuzTarea) => Promise<void> | void;
  onPosponer: (t: LuzTarea, dias: number) => Promise<void> | void;
}

export function CalendarioTareas({ tareas, onMoverADia, onCompletar, onPosponer }: CalendarioProps) {
  const hoy = new Date();
  const [ancla, setAncla] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [diaActivo, setDiaActivo] = useState<string | null>(null);

  const abiertas = useMemo(() => tareas.filter((t) => TAREAS_ABIERTAS.includes(t.estado)), [tareas]);
  const sinFecha = abiertas.filter((t) => !t.fecha_limite);

  const porDia = useMemo(() => {
    const m = new Map<string, LuzTarea[]>();
    for (const t of abiertas) {
      if (!t.fecha_limite) continue;
      m.set(t.fecha_limite, [...(m.get(t.fecha_limite) || []), t]);
    }
    return m;
  }, [abiertas]);

  const celdas = useMemo(() => {
    const ultimo = new Date(ancla.getFullYear(), ancla.getMonth() + 1, 0).getDate();
    const offset = (new Date(ancla.getFullYear(), ancla.getMonth(), 1).getDay() + 6) % 7;
    return [...Array.from({ length: offset }, () => null as number | null), ...Array.from({ length: ultimo }, (_, i) => i + 1)];
  }, [ancla]);

  function soltarEnDia(fecha: string, e: React.DragEvent) {
    e.preventDefault();
    setDiaActivo(null);
    const id = e.dataTransfer.getData('text/plain') || arrastrando;
    setArrastrando(null);
    if (!id) return;
    const t = tareas.find((x) => x.id === id);
    if (t && t.fecha_limite !== fecha) onMoverADia(t, fecha);
  }

  function ChipTarea({ t }: { t: LuzTarea }) {
    const abierta = seleccionada === t.id;
    return (
      <div>
        <div
          draggable
          onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.id); setArrastrando(t.id); }}
          onDragEnd={() => { setArrastrando(null); setDiaActivo(null); }}
          onClick={() => setSeleccionada(abierta ? null : t.id)}
          className={`cursor-pointer select-none rounded border px-1.5 py-1 text-[10px] leading-tight truncate transition hover:brightness-125 ${tonoResponsable(t.responsable)} ${
            arrastrando === t.id ? 'opacity-40' : ''
          }`}
          title={`${t.descripcion}${t.responsable ? ` · ${t.responsable}` : ''}`}
        >
          {TIPO_TAREA_LABEL[t.tipo_tarea]?.split(' ')[0] || '📌'} {t.descripcion}
        </div>
        {abierta && (
          <div className="mt-1 rounded-lg border border-border/50 bg-background/95 p-1.5 space-y-1 text-[10px]">
            <p className="font-bold text-foreground leading-snug">{t.descripcion}</p>
            {t.cliente_id && (
              <Link href={`/gestor/luz/clientes/${t.cliente_id}`} className="block text-accent hover:underline truncate">
                {t.luz_clientes?.nombre || 'Ver cliente'} →
              </Link>
            )}
            <p className="text-muted">{t.responsable || 'Sin asignar'}</p>
            <div className="flex gap-1 flex-wrap pt-0.5">
              <button onClick={() => { onCompletar(t); setSeleccionada(null); }} className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold hover:bg-emerald-500">✓ Hecha</button>
              <button onClick={() => { onPosponer(t, 1); setSeleccionada(null); }} className="px-1.5 py-0.5 rounded bg-card border border-border/50 font-semibold hover:border-accent/50">+1 día</button>
              <button onClick={() => { onPosponer(t, 7); setSeleccionada(null); }} className="px-1.5 py-0.5 rounded bg-card border border-border/50 font-semibold hover:border-accent/50">+1 semana</button>
            </div>
            <p className="text-muted/60 italic">…o arrástrala a otro día</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={() => setAncla(new Date(ancla.getFullYear(), ancla.getMonth() - 1, 1))} className={btnSecundario}><ChevronLeft className="w-4 h-4" /></button>
          <span className="font-bold text-sm min-w-36 text-center">{MESES[ancla.getMonth()]} {ancla.getFullYear()}</span>
          <button onClick={() => setAncla(new Date(ancla.getFullYear(), ancla.getMonth() + 1, 1))} className={btnSecundario}><ChevronRight className="w-4 h-4" /></button>
          <button onClick={() => setAncla(new Date(hoy.getFullYear(), hoy.getMonth(), 1))} className="text-xs font-semibold text-accent hover:underline ml-1">Hoy</button>
        </div>
        <div className="flex gap-1.5 flex-wrap text-[10px]">
          <span className={`px-2 py-0.5 rounded-full border font-semibold ${tonoResponsable('Marcos Benedico')}`}>Marcos</span>
          <span className={`px-2 py-0.5 rounded-full border font-semibold ${tonoResponsable('David')}`}>David</span>
          <span className={`px-2 py-0.5 rounded-full border font-semibold ${tonoResponsable('Fernando')}`}>Fernando</span>
          <span className={`px-2 py-0.5 rounded-full border font-semibold ${tonoResponsable('a / b')}`}>Compartida</span>
          <span className={`px-2 py-0.5 rounded-full border font-semibold ${tonoResponsable(null)}`}>Sin asignar</span>
        </div>
      </div>

      {/* Tareas sin fecha: arrástralas a un día para agendarlas */}
      {sinFecha.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-surface/40 p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-1.5">
            Sin fecha ({sinFecha.length}) — arrastra a un día del calendario para agendar
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {sinFecha.slice(0, 20).map((t) => (
              <div
                key={t.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.id); setArrastrando(t.id); }}
                onDragEnd={() => { setArrastrando(null); setDiaActivo(null); }}
                className={`cursor-grab rounded border px-2 py-1 text-[10px] max-w-56 truncate ${tonoResponsable(t.responsable)} ${arrastrando === t.id ? 'opacity-40' : ''}`}
                title={t.descripcion}
              >
                {t.descripcion}
              </div>
            ))}
            {sinFecha.length > 20 && <span className="text-[10px] text-muted self-center">+{sinFecha.length - 20} más</span>}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border/40 bg-surface/40 p-3">
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {DIAS_SEMANA.map((d) => <div key={d} className="text-center text-[11px] font-bold text-muted py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {celdas.map((dia, i) => {
            if (dia === null) return <div key={`v-${i}`} />;
            const fecha = `${ancla.getFullYear()}-${String(ancla.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
            const lista = porDia.get(fecha) || [];
            const esHoy = fecha === iso(hoy);
            const activo = diaActivo === fecha;
            return (
              <div
                key={dia}
                onDragOver={(e) => { e.preventDefault(); setDiaActivo(fecha); }}
                onDragLeave={() => setDiaActivo((d) => (d === fecha ? null : d))}
                onDrop={(e) => soltarEnDia(fecha, e)}
                className={`min-h-24 rounded-lg border p-1.5 transition ${
                  activo ? 'border-accent bg-accent/10 ring-2 ring-accent/40'
                  : esHoy ? 'border-accent bg-accent/10'
                  : lista.length ? 'border-border/40 bg-card/40' : 'border-border/20 bg-card/20'
                }`}
              >
                <p className={`text-[11px] font-bold ${esHoy ? 'text-accent' : 'text-muted'}`}>{dia}</p>
                <div className="space-y-1 mt-1">
                  {lista.map((t) => <ChipTarea key={t.id} t={t} />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
