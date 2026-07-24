'use client';

import { useState } from 'react';
import { CalendarClock, X } from 'lucide-react';
import { MOTIVOS_APLAZAMIENTO, fmtFecha } from '@/lib/luz';
import { ItemAgenda } from '@/lib/agenda';
import { inputCls } from '../ui';

/**
 * Aplazar una cosa SIEMPRE exige decir por qué.
 *
 * Completar no pide nada —hacer el trabajo no hay que justificarlo—, pero
 * mover algo de día sí: es la única forma de saber después por qué una gestión
 * lleva tres semanas dando vueltas, y si el problema es el cliente, la
 * comercializadora o nosotros.
 */
export function PanelAplazar({ item, onCancelar, onConfirmar, ocupado }: {
  item: ItemAgenda;
  onCancelar: () => void;
  onConfirmar: (fechaNueva: string, motivo: string) => void;
  ocupado: boolean;
}) {
  const hoy = new Date();
  const porDefecto = new Date(hoy.getTime() + 86400000).toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(porDefecto);
  const [motivo, setMotivo] = useState('');
  const [libre, setLibre] = useState('');

  const motivoFinal = (motivo === '__otro' ? libre : motivo).trim();
  const valido = !!fecha && motivoFinal.length >= 3;

  /** Atajos: los aplazamientos reales casi siempre son a mañana, en unos días o la semana que viene. */
  const atajos: [string, number][] = [['Mañana', 1], ['En 3 días', 3], ['En 1 semana', 7], ['En 2 semanas', 14]];

  return (
    <div className="fv-fade-in mt-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black text-amber-300 flex items-center gap-1.5">
          <CalendarClock className="w-3.5 h-3.5" /> Mover de día
        </p>
        <button onClick={onCancelar} className="text-muted hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {atajos.map(([texto, dias]) => {
          const f = new Date(hoy.getTime() + dias * 86400000).toISOString().slice(0, 10);
          return (
            <button key={texto} type="button" onClick={() => setFecha(f)}
              className={`px-2 py-1 rounded-lg border text-[10px] font-bold transition ${
                fecha === f ? 'bg-amber-400/20 text-amber-300 border-amber-400/50' : 'bg-card/60 text-muted border-border/40 hover:text-foreground'
              }`}>
              {texto}
            </button>
          );
        })}
        <input type="date" value={fecha} min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setFecha(e.target.value)}
          className="rounded-lg border border-border/40 bg-background/60 px-2 py-1 text-[11px] font-semibold" />
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-1">
          ¿Por qué se mueve? <span className="text-amber-300">(obligatorio)</span>
        </p>
        <div className="flex gap-1.5 flex-wrap">
          {MOTIVOS_APLAZAMIENTO.map((m) => (
            <button key={m} type="button" onClick={() => setMotivo(m)}
              className={`px-2 py-1 rounded-lg border text-[10px] font-semibold transition ${
                motivo === m ? 'bg-amber-400/20 text-amber-300 border-amber-400/50' : 'bg-card/60 text-muted border-border/40 hover:text-foreground'
              }`}>
              {m}
            </button>
          ))}
          <button type="button" onClick={() => setMotivo('__otro')}
            className={`px-2 py-1 rounded-lg border text-[10px] font-semibold transition ${
              motivo === '__otro' ? 'bg-amber-400/20 text-amber-300 border-amber-400/50' : 'bg-card/60 text-muted border-border/40 hover:text-foreground'
            }`}>
            Otro…
          </button>
        </div>
        {motivo === '__otro' && (
          <input autoFocus value={libre} onChange={(e) => setLibre(e.target.value)}
            placeholder="Explica brevemente por qué se mueve"
            className={`${inputCls} mt-1.5 !py-1.5 !text-xs`} />
        )}
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[10px] text-muted">
          {item.fecha ? <>Estaba para el <b>{fmtFecha(item.fecha)}</b> → pasa al <b className="text-amber-300">{fmtFecha(fecha)}</b></> : <>Se le pone fecha: <b className="text-amber-300">{fmtFecha(fecha)}</b></>}
        </p>
        <button
          type="button"
          disabled={!valido || ocupado}
          onClick={() => onConfirmar(fecha, motivoFinal)}
          className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[11px] font-bold hover:bg-amber-500/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          title={valido ? 'Mover y dejar constancia' : 'Hace falta una fecha y un motivo'}
        >
          {ocupado ? 'Moviendo…' : 'Mover y justificar'}
        </button>
      </div>
    </div>
  );
}
