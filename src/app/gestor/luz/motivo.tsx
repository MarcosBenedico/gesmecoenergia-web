'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { inputCls, btnPrimario, btnSecundario } from './ui';

/**
 * Diálogo amable para apuntar el porqué de un movimiento (bloqueo, pérdida...).
 * Tono cercano: motivos de un toque + campo libre. El movimiento se aplica al
 * guardar el motivo — así el historial del cliente siempre cuenta la historia completa.
 */
export function PedirMotivo({ titulo, subtitulo, sugerencias, onGuardar, onCancelar }: {
  titulo: string;
  subtitulo?: string;
  sugerencias: string[];
  onGuardar: (motivo: string) => void;
  onCancelar: () => void;
}) {
  const [texto, setTexto] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  function guardar(e?: React.FormEvent) {
    e?.preventDefault();
    if (texto.trim()) onGuardar(texto.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4" onClick={onCancelar}>
      <div
        className="card w-full max-w-md space-y-3 rounded-2xl p-5 bg-surface border border-accent/30 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm">{titulo}</h3>
            <p className="text-[11px] text-muted mt-0.5">{subtitulo || 'Un toque y seguimos — queda en el historial del cliente.'}</p>
          </div>
          <button onClick={onCancelar} className="text-muted hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        {/* Motivos de un toque */}
        <div className="flex gap-1.5 flex-wrap">
          {sugerencias.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onGuardar(s)}
              className="px-2.5 py-1.5 rounded-lg border border-border/40 bg-card/60 text-[11px] font-semibold text-muted hover:border-accent/50 hover:text-foreground transition"
            >
              {s}
            </button>
          ))}
        </div>

        <form onSubmit={guardar} className="flex gap-2">
          <input
            ref={ref}
            className={`${inputCls} flex-1 !text-xs`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="...o cuéntalo con tus palabras"
          />
          <button type="submit" disabled={!texto.trim()} className={btnPrimario}>Guardar</button>
        </form>
        <button onClick={onCancelar} className={`${btnSecundario} w-full justify-center !text-xs`}>
          Mejor no lo cambio todavía
        </button>
      </div>
    </div>
  );
}
