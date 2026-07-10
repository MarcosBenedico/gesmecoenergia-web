'use client';

import { useState } from 'react';
import Link from 'next/link';
import { GripVertical } from 'lucide-react';
import { LuzTarea, TIPO_TAREA_LABEL, diasHasta, fmtFecha } from '@/lib/luz';
import { Badge, BadgeVencimiento } from '../ui';

/** Bucket temporal de una tarea: en qué columna del tablero cae. */
export type BucketTarea = 'atrasado' | 'hoy' | 'semana' | 'futuro' | 'sin_fecha' | 'hecho';

/** A qué bucket correspondería la tarea si estuviera abierta, según su fecha límite. */
function bucketPorFecha(fechaLimite: string | null): BucketTarea {
  const dias = diasHasta(fechaLimite);
  if (dias == null) return 'sin_fecha';
  if (dias < 0) return 'atrasado';
  if (dias === 0) return 'hoy';
  if (dias <= 7) return 'semana';
  return 'futuro';
}

/** Bucket real de la tarea: las completadas hoy van a "hecho"; el resto de completadas/canceladas no se muestran. */
export function bucketDeTarea(t: LuzTarea): BucketTarea | null {
  if (t.estado === 'cancelada') return null;
  if (t.estado === 'completada') {
    const hoy = new Date().toISOString().slice(0, 10);
    const dia = t.actualizado_en ? t.actualizado_en.slice(0, 10) : null;
    return dia === hoy ? 'hecho' : null;
  }
  return bucketPorFecha(t.fecha_limite);
}

const COLUMNAS: { clave: BucketTarea; titulo: string; permiteSoltar: boolean; nota?: string }[] = [
  { clave: 'atrasado', titulo: '🔴 Atrasado', permiteSoltar: false, nota: 'Se mueven solas al cambiar la fecha' },
  { clave: 'hoy', titulo: '🟡 Para hoy', permiteSoltar: true },
  { clave: 'semana', titulo: '🔵 Esta semana', permiteSoltar: true },
  { clave: 'futuro', titulo: '⚪ Más adelante', permiteSoltar: true },
  { clave: 'sin_fecha', titulo: '— Sin fecha', permiteSoltar: true },
  { clave: 'hecho', titulo: '✅ Hecho hoy', permiteSoltar: true },
];

function tonoColumna(clave: BucketTarea): string {
  if (clave === 'atrasado') return 'border-red-500/40 bg-red-500/5';
  if (clave === 'hoy') return 'border-amber-500/40 bg-amber-500/5';
  if (clave === 'hecho') return 'border-emerald-500/40 bg-emerald-500/5';
  return 'border-border/40 bg-surface/40';
}

interface TableroProps {
  tareas: LuzTarea[];
  onMover: (t: LuzTarea, bucket: BucketTarea) => Promise<void> | void;
  onBorrar: (t: LuzTarea) => Promise<void> | void;
}

export function TableroTareas({ tareas, onMover, onBorrar }: TableroProps) {
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [columnaActiva, setColumnaActiva] = useState<BucketTarea | null>(null);

  function soltarEn(clave: BucketTarea, e: React.DragEvent) {
    e.preventDefault();
    setColumnaActiva(null);
    const id = e.dataTransfer.getData('text/plain') || arrastrando;
    setArrastrando(null);
    if (!id) return;
    const t = tareas.find((x) => x.id === id);
    if (t && bucketDeTarea(t) !== clave) onMover(t, clave);
  }

  return (
    <div className="overflow-x-auto pb-3 -mx-1 px-1">
      <div className="flex gap-3 min-w-max">
        {COLUMNAS.map(({ clave, titulo, permiteSoltar, nota }) => {
          const items = tareas.filter((t) => bucketDeTarea(t) === clave);
          const activa = columnaActiva === clave;
          return (
            <div
              key={clave}
              onDragOver={(e) => { if (permiteSoltar) { e.preventDefault(); setColumnaActiva(clave); } }}
              onDragLeave={() => setColumnaActiva((c) => (c === clave ? null : c))}
              onDrop={(e) => permiteSoltar && soltarEn(clave, e)}
              className={`w-64 shrink-0 rounded-2xl border p-2.5 transition ${tonoColumna(clave)} ${
                activa ? 'ring-2 ring-accent/60 bg-accent/5' : ''
              }`}
            >
              {/* Cabecera de columna */}
              <div className="flex items-center justify-between px-1.5 pb-2 mb-1 border-b border-border/30">
                <span className="text-xs font-black uppercase tracking-wide text-foreground truncate">{titulo}</span>
                <span className="text-[11px] font-bold text-muted tabular-nums shrink-0 ml-2">{items.length}</span>
              </div>
              {nota && <p className="px-1.5 pb-2 text-[10px] text-muted/60 italic">{nota}</p>}

              {/* Tarjetas */}
              <div className="space-y-2 min-h-12">
                {items.map((t) => {
                  const hecha = t.estado === 'completada';
                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; setArrastrando(t.id); }}
                      onDragEnd={() => { setArrastrando(null); setColumnaActiva(null); }}
                      className={`group rounded-xl border border-border/50 bg-card/80 p-2.5 cursor-grab active:cursor-grabbing hover:border-accent/50 hover:bg-card transition ${
                        arrastrando === t.id ? 'opacity-40' : ''
                      } ${hecha ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <label className="flex items-start gap-1.5 min-w-0 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={hecha}
                            onChange={() => onMover(t, hecha ? bucketPorFecha(t.fecha_limite) : 'hecho')}
                            className="accent-[#22c55e] w-3.5 h-3.5 mt-0.5 shrink-0"
                          />
                          <span className={`text-xs font-bold text-foreground leading-tight ${hecha ? 'line-through' : ''}`}>
                            {TIPO_TAREA_LABEL[t.tipo_tarea]?.split(' ')[0] || '📌'} {t.descripcion}
                          </span>
                        </label>
                        <button
                          onClick={(e) => { e.stopPropagation(); onBorrar(t); }}
                          className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 text-xs shrink-0 transition"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-2 pl-5">
                        <span className="text-[10px] text-muted truncate min-w-0">
                          {t.cliente_id ? (
                            <Link href={`/gestor/luz/clientes/${t.cliente_id}`} className="hover:text-accent" onClick={(e) => e.stopPropagation()}>
                              {t.luz_clientes?.nombre || 'Cliente'}
                            </Link>
                          ) : 'Sin cliente'}
                        </span>
                        <GripVertical className="w-3.5 h-3.5 text-muted/40 shrink-0 group-hover:text-muted" />
                      </div>

                      <div className="flex items-center gap-1.5 mt-1.5 pl-5 flex-wrap">
                        {!hecha && t.prioridad === 'alta' && <Badge tono="rojo">alta</Badge>}
                        {t.responsable && <Badge>{t.responsable}</Badge>}
                        {!hecha && clave !== 'sin_fecha' && t.fecha_limite && <BadgeVencimiento fecha={t.fecha_limite} />}
                        {hecha && <span className="text-[10px] text-muted">{fmtFecha(t.actualizado_en)}</span>}
                      </div>
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
