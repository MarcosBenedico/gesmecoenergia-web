'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileSignature, GripVertical } from 'lucide-react';
import {
  LuzOportunidad, ESTADOS_PIPELINE, ESTADO_PIPELINE_LABEL, TIPO_OPORTUNIDAD_LABEL,
  PIPELINE_CERRADO, diasHasta, fmtEur, fmtFecha,
} from '@/lib/luz';
import { BadgePrioridad } from '../ui';

/** Columnas ordenadas del embudo. Cada columna = un estado exacto del pipeline. */
const COLUMNAS = ESTADOS_PIPELINE;

/** Tono de la cabecera de columna según sea abierto / ganado / perdido / a revisar. */
function tonoColumna(estado: string): string {
  if (estado === 'ganado') return 'border-emerald-500/40 bg-emerald-500/5';
  if (estado === 'perdido') return 'border-red-500/40 bg-red-500/5';
  if (estado === 'revisar_adelante') return 'border-border/40 bg-card/30';
  return 'border-border/40 bg-surface/40';
}

interface TableroProps {
  oportunidades: LuzOportunidad[];
  onCambiarEstado: (o: LuzOportunidad, estado: string) => Promise<void> | void;
  onConvertir: (o: LuzOportunidad) => Promise<void> | void;
}

export function TableroPipeline({ oportunidades, onCambiarEstado, onConvertir }: TableroProps) {
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [columnaActiva, setColumnaActiva] = useState<string | null>(null);

  function soltarEn(estado: string, e: React.DragEvent) {
    e.preventDefault();
    setColumnaActiva(null);
    const id = e.dataTransfer.getData('text/plain') || arrastrando;
    setArrastrando(null);
    if (!id) return;
    const o = oportunidades.find((x) => x.id === id);
    if (o && o.estado !== estado) onCambiarEstado(o, estado);
  }

  return (
    <div className="overflow-x-auto pb-3 -mx-1 px-1">
      <div className="flex gap-3 min-w-max">
        {COLUMNAS.map((estado) => {
          const items = oportunidades.filter((o) => o.estado === estado);
          const comision = items.reduce((s, o) => s + (Number(o.comision_potencial) || 0), 0);
          const activa = columnaActiva === estado;
          return (
            <div
              key={estado}
              onDragOver={(e) => { e.preventDefault(); setColumnaActiva(estado); }}
              onDragLeave={() => setColumnaActiva((c) => (c === estado ? null : c))}
              onDrop={(e) => soltarEn(estado, e)}
              className={`w-64 shrink-0 rounded-2xl border p-2.5 transition ${tonoColumna(estado)} ${
                activa ? 'ring-2 ring-accent/60 bg-accent/5' : ''
              }`}
            >
              {/* Cabecera de columna */}
              <div className="flex items-center justify-between px-1.5 pb-2 mb-1 border-b border-border/30">
                <span className="text-xs font-black uppercase tracking-wide text-foreground truncate">
                  {ESTADO_PIPELINE_LABEL[estado]}
                </span>
                <span className="text-[11px] font-bold text-muted tabular-nums shrink-0 ml-2">
                  {items.length}
                </span>
              </div>
              {comision > 0 && (
                <p className="px-1.5 pb-2 text-[11px] font-bold text-amber-400 tabular-nums">
                  {fmtEur(comision)}
                </p>
              )}

              {/* Tarjetas */}
              <div className="space-y-2 min-h-12">
                {items.map((o) => {
                  const abierta = !PIPELINE_CERRADO.includes(o.estado) && o.estado !== 'revisar_adelante';
                  const accionVencida = abierta && (diasHasta(o.fecha_proxima_accion) ?? 1) < 0;
                  return (
                    <div
                      key={o.id}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', o.id); e.dataTransfer.effectAllowed = 'move'; setArrastrando(o.id); }}
                      onDragEnd={() => { setArrastrando(null); setColumnaActiva(null); }}
                      className={`group rounded-xl border border-border/50 bg-card/80 p-2.5 cursor-grab active:cursor-grabbing hover:border-accent/50 hover:bg-card transition ${
                        arrastrando === o.id ? 'opacity-40' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <BadgePrioridad prioridad={o.luz_clientes?.prioridad} />
                          <span className="text-xs font-bold text-foreground leading-tight truncate">
                            {o.cliente_id ? (
                              <Link href={`/gestor/luz/clientes/${o.cliente_id}`} className="hover:text-accent" onClick={(e) => e.stopPropagation()}>
                                {o.luz_clientes?.nombre || o.nombre_oportunidad}
                              </Link>
                            ) : (
                              o.luz_clientes?.nombre || o.nombre_oportunidad
                            )}
                          </span>
                        </div>
                        <GripVertical className="w-3.5 h-3.5 text-muted/40 shrink-0 group-hover:text-muted" />
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-2">
                        <span className="text-[10px] text-muted truncate">{TIPO_OPORTUNIDAD_LABEL[o.tipo_oportunidad]}</span>
                        <span className="text-xs font-black text-amber-400 tabular-nums shrink-0">{fmtEur(Number(o.comision_potencial))}</span>
                      </div>

                      {/* Pie: próxima acción / motivo / revisión */}
                      {abierta && !o.proxima_accion && (
                        <p className="mt-1.5 text-[10px] font-bold text-red-400">⚠️ sin próxima acción</p>
                      )}
                      {abierta && o.proxima_accion && (
                        <p className={`mt-1.5 text-[10px] truncate ${accionVencida ? 'text-red-400 font-bold' : 'text-muted'}`}>
                          → {o.proxima_accion}{o.fecha_proxima_accion ? ` · ${fmtFecha(o.fecha_proxima_accion)}` : ''}
                        </p>
                      )}
                      {o.estado === 'perdido' && o.motivo_perdida && (
                        <p className="mt-1.5 text-[10px] text-red-400 truncate">✕ {o.motivo_perdida}</p>
                      )}
                      {o.estado === 'revisar_adelante' && o.fecha_revision && (
                        <p className="mt-1.5 text-[10px] text-muted">revisar {fmtFecha(o.fecha_revision)}</p>
                      )}

                      {/* Ganado → crear contrato */}
                      {o.estado === 'ganado' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onConvertir(o); }}
                          className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-500 transition"
                        >
                          <FileSignature className="w-3 h-3" /> Crear contrato
                        </button>
                      )}
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <p className="text-center text-[10px] text-muted/40 py-3 select-none">— vacío —</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
