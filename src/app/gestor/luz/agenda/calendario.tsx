'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ItemAgenda } from '@/lib/agenda';

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Vista de mes de la agenda: de un vistazo se ve dónde se acumula el trabajo
 * y qué semanas están cargadas — algo que una lista no deja ver.
 * Al pulsar un día, se muestran sus líneas debajo.
 */
export function CalendarioAgenda({ items, ancla, setAncla, diaSel, setDiaSel }: {
  items: ItemAgenda[];
  ancla: Date;
  setAncla: (d: Date) => void;
  diaSel: string | null;
  setDiaSel: (d: string | null) => void;
}) {
  const hoy = iso(new Date());

  /** Líneas agrupadas por día, solo del mes que se está viendo. */
  const porDia = useMemo(() => {
    const mapa: Record<string, ItemAgenda[]> = {};
    for (const i of items) {
      if (!i.fecha) continue;
      const clave = i.fecha.slice(0, 10);
      (mapa[clave] ||= []).push(i);
    }
    return mapa;
  }, [items]);

  const sinFecha = items.filter((i) => !i.fecha);

  const celdas = useMemo(() => {
    const y = ancla.getFullYear(), m = ancla.getMonth();
    const ultimo = new Date(y, m + 1, 0).getDate();
    const offset = (new Date(y, m, 1).getDay() + 6) % 7;  // lunes primero
    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: ultimo }, (_, i) => iso(new Date(y, m, i + 1))),
    ];
  }, [ancla]);

  const mover = (n: number) => setAncla(new Date(ancla.getFullYear(), ancla.getMonth() + n, 1));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => mover(-1)} className="p-1.5 rounded-lg hover:bg-card/80 text-muted hover:text-foreground transition">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <p className="text-sm font-black text-foreground">{MESES[ancla.getMonth()]} {ancla.getFullYear()}</p>
          <button onClick={() => { setAncla(new Date()); setDiaSel(null); }} className="text-[10px] text-accent hover:underline">Ir a hoy</button>
        </div>
        <button onClick={() => mover(1)} className="p-1.5 rounded-lg hover:bg-card/80 text-muted hover:text-foreground transition">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DIAS_SEMANA.map((d) => (
          <p key={d} className="text-center text-[10px] font-black uppercase text-muted/60 py-1">{d}</p>
        ))}
        {celdas.map((fecha, idx) => {
          if (!fecha) return <div key={`v${idx}`} />;
          const delDia = porDia[fecha] || [];
          const vencidos = delDia.filter((i) => i.urgencia === 'vencido').length;
          const esHoy = fecha === hoy;
          const sel = fecha === diaSel;
          const dia = parseInt(fecha.slice(8, 10), 10);
          return (
            <button
              key={fecha}
              onClick={() => setDiaSel(sel ? null : fecha)}
              disabled={delDia.length === 0}
              className={`aspect-square rounded-lg border p-1 flex flex-col items-center justify-start gap-0.5 transition text-[10px] ${
                sel ? 'border-accent bg-accent/15 ring-1 ring-accent/40'
                : esHoy ? 'border-amber-400/50 bg-amber-500/10'
                : delDia.length > 0 ? 'border-border/40 bg-card/60 hover:border-accent/40 hover:bg-card'
                : 'border-border/15 bg-transparent cursor-default'
              }`}
            >
              <span className={`font-bold ${esHoy ? 'text-amber-300' : delDia.length > 0 ? 'text-foreground' : 'text-muted/40'}`}>{dia}</span>
              {delDia.length > 0 && (
                <span className={`px-1 rounded-full font-black tabular-nums text-[9px] ${
                  vencidos > 0 ? 'bg-red-500/20 text-red-300' : 'bg-secondary/20 text-secondary'
                }`}>
                  {delDia.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-3 text-[9px] text-muted">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500/40" /> con retrasos</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-secondary/40" /> al día</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400/50" /> hoy</span>
        {sinFecha.length > 0 && (
          <button onClick={() => setDiaSel(diaSel === 'sin_fecha' ? null : 'sin_fecha')}
            className={`px-2 py-0.5 rounded-full border font-bold transition ${
              diaSel === 'sin_fecha' ? 'bg-accent/15 text-accent border-accent/40' : 'border-border/40 text-muted hover:text-foreground'
            }`}>
            {sinFecha.length} sin fecha
          </button>
        )}
      </div>
    </div>
  );
}
