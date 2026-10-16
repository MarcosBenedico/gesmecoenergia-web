'use client';

import { useState } from 'react';
import { PauseCircle, PlayCircle, Pin, X } from 'lucide-react';
import {
  MOTIVOS_PAUSA, PLAZOS_PAUSA, pausaDe, estaFijadoPara,
  cambioPausa, cambioReactivar, cambioFijar, type ClienteFoco, type CamposFoco,
} from '@/lib/foco-dia';
import { fmtFecha } from '@/lib/luz';
import { inputCls, btnPrimario, btnSecundario, guardarLuz } from './ui';

/**
 * Los controles del foco del día, en un solo sitio para que el listado, la
 * ficha y Mi Día no tengan cada uno su versión: dos copias de esto acabarían
 * guardando campos distintos y la pausa funcionaría según desde dónde se haga.
 *
 * La lógica (qué es estar apartado, qué se guarda) vive en `foco-dia.ts`.
 * Aquí solo está la pantalla.
 */

/** Pedir el porqué y el hasta cuándo. Las dos cosas, y las dos obligatorias. */
export function PanelPausar({ nombre, onGuardar, onCancelar, ocupado }: {
  nombre: string;
  onGuardar: (motivo: string, dias: number | null) => void;
  onCancelar: () => void;
  ocupado?: boolean;
}) {
  const [motivo, setMotivo] = useState('');
  // 3 meses por defecto: es el plazo que más se usa y el que evita que la
  // pausa se convierta en un olvido. Sin fecha existe, pero hay que elegirlo.
  const [dias, setDias] = useState<number | null>(90);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4" onClick={onCancelar}>
      <div
        className="card w-full max-w-md space-y-3 rounded-2xl p-5 bg-surface border border-amber-500/30 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm">Apartar a {nombre} del seguimiento</h3>
            <p className="text-[11px] text-muted mt-0.5">
              No se borra nada: deja de salir en Mi Día y en la agenda, y vuelve solo cuando se cumpla el plazo.
            </p>
          </div>
          <button onClick={onCancelar} className="text-muted hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-muted/70 mb-1.5">¿Hasta cuándo?</p>
          <div className="flex gap-1.5 flex-wrap">
            {PLAZOS_PAUSA.map((p) => (
              <button
                key={p.titulo}
                type="button"
                onClick={() => setDias(p.dias)}
                className={`min-h-[36px] px-2.5 rounded-lg border text-[11px] font-bold transition ${
                  p.dias === dias
                    ? 'bg-accent/20 border-accent/50 text-foreground'
                    : 'bg-card/60 border-border/50 text-muted hover:text-foreground'
                }`}
              >
                {p.titulo}
              </button>
            ))}
          </div>
          {dias == null && (
            <p className="text-[10px] text-amber-300 mt-1.5">
              Sin fecha hay que acordarse de reactivarlo a mano. Con plazo vuelve solo.
            </p>
          )}
        </div>

        {/* El motivo es obligatorio por lo mismo que al aplazar una acción:
            sin él, la lista de apartados no significa nada al cabo de un mes. */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-muted/70 mb-1.5">¿Por qué?</p>
          <div className="flex gap-1.5 flex-wrap mb-2">
            {MOTIVOS_PAUSA.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMotivo(m)}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition ${
                  motivo === m ? 'border-accent/50 bg-accent/15 text-foreground'
                    : 'border-border/40 bg-card/60 text-muted hover:text-foreground'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <input
            className={`${inputCls} w-full !text-xs`}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="...o cuéntalo con tus palabras"
          />
        </div>

        <button
          onClick={() => motivo.trim() && onGuardar(motivo.trim(), dias)}
          disabled={!motivo.trim() || ocupado}
          className={`${btnPrimario} w-full justify-center disabled:opacity-40`}
        >
          Apartarlo{dias != null ? ` ${PLAZOS_PAUSA.find((p) => p.dias === dias)?.titulo.toLowerCase()}` : ''}
        </button>
        <button onClick={onCancelar} className={`${btnSecundario} w-full justify-center !text-xs`}>
          Mejor lo dejo como está
        </button>
      </div>
    </div>
  );
}

/** La etiqueta de «está apartado», con su motivo y su plazo a la vista. */
export function EtiquetaPausa({ cliente }: { cliente: ClienteFoco }) {
  const p = pausaDe(cliente);
  if (!p.pausado) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[10px] font-black uppercase whitespace-nowrap"
      title={[p.motivo, p.hasta ? `Vuelve el ${fmtFecha(p.hasta)}` : 'Sin fecha de vuelta'].filter(Boolean).join(' · ')}
    >
      <PauseCircle className="w-3 h-3" />
      {p.hasta ? `hasta ${fmtFecha(p.hasta)}` : 'en pausa'}
    </span>
  );
}

/**
 * Los dos botones juntos: apartar/reanudar y fijar/soltar.
 *
 * Van juntos porque son la misma decisión mirada por los dos lados —a quién
 * quito de en medio y a quién subo arriba— y separarlos obligaría a buscar
 * cada uno en un sitio distinto de la pantalla.
 */
export function BotonesFoco({ cliente, persona, onHecho, compacto = false }: {
  cliente: ClienteFoco;
  /** Quién fija. Sin persona no se puede fijar: el día es de alguien. */
  persona: string | null;
  onHecho: () => void;
  compacto?: boolean;
}) {
  const [pidiendo, setPidiendo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const p = pausaDe(cliente);
  const fijado = estaFijadoPara(cliente, persona);

  async function guardar(campos: CamposFoco & { pausado_por?: string | null; pausado_en?: string | null }) {
    setOcupado(true);
    await guardarLuz('clientes', 'PUT', { id: cliente.id, ...campos });
    setOcupado(false);
    setPidiendo(false);
    onHecho();
  }

  const base = `inline-flex items-center gap-1 rounded-lg border text-[11px] font-bold transition disabled:opacity-40 ${
    compacto ? 'px-1.5 py-1' : 'px-2.5 py-1.5 min-h-[36px]'
  }`;

  return (
    <>
      {persona && (
        <button
          onClick={() => guardar(cambioFijar(fijado ? null : persona))}
          disabled={ocupado}
          className={`${base} ${fijado
            ? 'border-accent/50 bg-accent/20 text-accent'
            : 'border-border/50 bg-card/60 text-muted hover:text-foreground'}`}
          title={fijado
            ? 'Quitarlo de los fijados de tu día'
            : 'Fijarlo arriba en tu día, tenga fecha o no'}
        >
          <Pin className={`w-3.5 h-3.5 ${fijado ? 'fill-current' : ''}`} />
          {!compacto && (fijado ? 'Fijado' : 'Fijar en mi día')}
        </button>
      )}

      {p.pausado ? (
        <button
          onClick={() => guardar(cambioReactivar())}
          disabled={ocupado}
          className={`${base} border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20`}
          title={[p.motivo, p.hasta ? `Volvería solo el ${fmtFecha(p.hasta)}` : null].filter(Boolean).join(' · ')}
        >
          <PlayCircle className="w-3.5 h-3.5" />
          {!compacto && 'Volver a seguirlo'}
        </button>
      ) : (
        <button
          onClick={() => setPidiendo(true)}
          disabled={ocupado}
          className={`${base} border-border/50 bg-card/60 text-muted hover:text-amber-300 hover:border-amber-500/40`}
          title="Apartarlo del seguimiento por un tiempo. No se borra nada."
        >
          <PauseCircle className="w-3.5 h-3.5" />
          {!compacto && 'Apartar'}
        </button>
      )}

      {pidiendo && (
        <PanelPausar
          nombre={cliente.nombre}
          ocupado={ocupado}
          onCancelar={() => setPidiendo(false)}
          onGuardar={(motivo, dias) => guardar({
            ...cambioPausa(motivo, dias),
            pausado_por: persona || null,
            pausado_en: new Date().toISOString(),
          })}
        />
      )}
    </>
  );
}
