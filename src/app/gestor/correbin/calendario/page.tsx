'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import {
  VctVencimiento, SEGMENTOS, SEGMENTO_LABEL, SEGMENTO_COLOR, SEGMENTOS_FUERA_CALENDARIO,
  ESTADOS_VENCIMIENTO, ESTADO_VCT_LABEL, PRIORIDADES, VCT_CERRADOS, fmtEur0, fmtFecha, diasHasta,
} from '@/lib/correbin';
import { Card, EstadoCarga, useLista, guardar, btnSecundario, inputCls, SelectorResponsable, BadgeVencimiento, BadgePrioridad } from '../ui';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function CalendarioVct() {
  const hoy = new Date();
  const [vista, setVista] = useState<'mes' | 'semana' | 'lista'>('mes');
  const [ancla, setAncla] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));

  // Filtros
  const [fResp, setFResp] = useState('');
  const [fSeg, setFSeg] = useState('');
  const [fEst, setFEst] = useState('');
  const [fPri, setFPri] = useState('');
  const [verOrdinarios, setVerOrdinarios] = useState(false);

  // Rango según vista
  const { desde, hasta } = useMemo(() => {
    if (vista === 'semana') {
      const lunes = new Date(ancla);
      lunes.setDate(ancla.getDate() - ((ancla.getDay() + 6) % 7));
      const domingo = new Date(lunes);
      domingo.setDate(lunes.getDate() + 6);
      return { desde: iso(lunes), hasta: iso(domingo) };
    }
    if (vista === 'lista') {
      const fin = new Date(ancla);
      fin.setDate(ancla.getDate() + 120);
      return { desde: iso(new Date(ancla.getFullYear(), ancla.getMonth(), ancla.getDate() - 30)), hasta: iso(fin) };
    }
    const primero = new Date(ancla.getFullYear(), ancla.getMonth(), 1);
    const ultimo = new Date(ancla.getFullYear(), ancla.getMonth() + 1, 0);
    return { desde: iso(primero), hasta: iso(ultimo) };
  }, [vista, ancla]);

  const { datos, cargando, error, faltaMigracion, recargar } = useLista<VctVencimiento>('vencimientos', { desde, hasta });

  const responsables = useMemo(
    () => Array.from(new Set(datos.map((v) => v.responsable).filter(Boolean))) as string[],
    [datos]
  );

  const eventos = useMemo(() => datos.filter((v) => {
    // Regla clave: los particulares ordinarios no saturan el calendario (sí salen en lista)
    if (vista !== 'lista' && !verOrdinarios && SEGMENTOS_FUERA_CALENDARIO.includes(v.segmento)) return false;
    if (fResp && v.responsable !== fResp) return false;
    if (fSeg && v.segmento !== fSeg) return false;
    if (fEst && v.estado_vencimiento !== fEst) return false;
    if (fPri && (v.vct_clientes?.prioridad || 'C') !== fPri) return false;
    return true;
  }), [datos, vista, verOrdinarios, fResp, fSeg, fEst, fPri]);

  const [abierto, setAbierto] = useState<VctVencimiento | null>(null);
  const [tituloTarea, setTituloTarea] = useState('');

  function mover(delta: number) {
    const f = new Date(ancla);
    if (vista === 'semana') f.setDate(f.getDate() + delta * 7);
    else f.setMonth(f.getMonth() + delta);
    setAncla(f);
  }

  async function cambiarVcto(v: VctVencimiento, campos: Record<string, unknown>) {
    const err = await guardar('vencimientos', 'PUT', { id: v.id, ...campos });
    if (!err) { recargar(); if (abierto?.id === v.id) setAbierto({ ...abierto, ...campos } as VctVencimiento); }
  }

  async function crearTareaDesdeEvento() {
    if (!abierto || !tituloTarea.trim()) return;
    await guardar('tareas', 'POST', {
      cliente_id: abierto.cliente_id,
      vencimiento_id: abierto.id,
      titulo: tituloTarea,
      tipo_tarea: 'seguimiento',
      responsable: abierto.responsable,
      fecha_limite: abierto.fecha_vct,
    });
    setTituloTarea('');
    setAbierto(null);
  }

  const selCls = 'rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 text-xs font-semibold';

  // Celdas del mes
  const celdasMes = useMemo(() => {
    const primero = new Date(ancla.getFullYear(), ancla.getMonth(), 1);
    const ultimoDia = new Date(ancla.getFullYear(), ancla.getMonth() + 1, 0).getDate();
    const offset = (primero.getDay() + 6) % 7;
    return [...Array.from({ length: offset }, () => null as number | null), ...Array.from({ length: ultimoDia }, (_, i) => i + 1)];
  }, [ancla]);

  const porDia = useMemo(() => {
    const m = new Map<string, VctVencimiento[]>();
    for (const v of eventos) m.set(v.fecha_vct, [...(m.get(v.fecha_vct) || []), v]);
    return m;
  }, [eventos]);

  const diasSemana = useMemo(() => {
    const lunes = new Date(desde);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(lunes); d.setDate(lunes.getDate() + i); return d; });
  }, [desde]);

  const Evento = ({ v }: { v: VctVencimiento }) => {
    const c = SEGMENTO_COLOR[v.segmento];
    const cerrado = VCT_CERRADOS.includes(v.estado_vencimiento);
    return (
      <button
        onClick={() => setAbierto(v)}
        className={`block w-full text-left text-[10px] leading-tight px-1.5 py-1 rounded border transition truncate ${c?.evento || 'bg-card/60 text-muted border-border/30'} ${cerrado ? 'opacity-40 line-through' : 'hover:brightness-125'}`}
        title={v.titulo_evento}
      >
        {v.titulo_evento.replace(/^VTO - /, '')}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Calendario VCT</h2>
          <p className="text-xs text-muted mt-0.5">{eventos.length} vencimiento(s) en el periodo</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['mes', 'semana', 'lista'] as const).map((vv) => (
            <button
              key={vv}
              onClick={() => setVista(vv)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition ${vista === vv ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}
            >
              {vv}
            </button>
          ))}
          {vista !== 'lista' && (
            <>
              <button onClick={() => mover(-1)} className={btnSecundario}><ChevronLeft className="w-4 h-4" /></button>
              <span className="font-bold text-sm min-w-32 text-center">
                {vista === 'mes' ? `${MESES[ancla.getMonth()]} ${ancla.getFullYear()}` : `Semana del ${fmtFecha(desde)}`}
              </span>
              <button onClick={() => mover(1)} className={btnSecundario}><ChevronRight className="w-4 h-4" /></button>
            </>
          )}
        </div>
      </div>

      {/* Filtros */}
      <Card className="!p-3">
        <div className="flex gap-2 flex-wrap items-center">
          <select className={selCls} value={fResp} onChange={(e) => setFResp(e.target.value)}>
            <option value="">Responsable: todos</option>
            {responsables.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className={selCls} value={fSeg} onChange={(e) => setFSeg(e.target.value)}>
            <option value="">Segmento: todos</option>
            {SEGMENTOS.map((s) => <option key={s} value={s}>{SEGMENTO_LABEL[s]}</option>)}
          </select>
          <select className={selCls} value={fEst} onChange={(e) => setFEst(e.target.value)}>
            <option value="">Estado: todos</option>
            {ESTADOS_VENCIMIENTO.map((s) => <option key={s} value={s}>{ESTADO_VCT_LABEL[s]}</option>)}
          </select>
          <select className={selCls} value={fPri} onChange={(e) => setFPri(e.target.value)}>
            <option value="">Prioridad: todas</option>
            {PRIORIDADES.map((p) => <option key={p} value={p}>Prioridad {p}</option>)}
          </select>
          {vista !== 'lista' && (
            <label className="flex items-center gap-1.5 text-xs text-muted font-semibold cursor-pointer ml-auto">
              <input type="checkbox" checked={verOrdinarios} onChange={(e) => setVerOrdinarios(e.target.checked)} />
              Mostrar particulares ordinarios
            </label>
          )}
        </div>
        {/* Leyenda de colores */}
        <div className="flex gap-1.5 flex-wrap mt-2.5">
          {SEGMENTOS.map((s) => (
            <span key={s} className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${SEGMENTO_COLOR[s]?.badge}`}>
              {SEGMENTO_LABEL[s]}
            </span>
          ))}
        </div>
      </Card>

      <EstadoCarga cargando={cargando} error={error} faltaMigracion={faltaMigracion} vacio={false} textoVacio="" />

      {/* Panel de edición rápida del evento */}
      {abierto && (
        <Card className="border-accent/40 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-sm">{abierto.titulo_evento}</p>
              <p className="text-xs text-muted mt-0.5">
                {fmtFecha(abierto.fecha_vct)} · <BadgeVencimiento fecha={abierto.fecha_vct} />
              </p>
            </div>
            <button onClick={() => setAbierto(null)} className="text-muted hover:text-foreground text-sm">✕</button>
          </div>
          <div className="grid md:grid-cols-3 gap-2.5">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted mb-1">Estado</p>
              <select
                className={`${selCls} w-full`}
                value={abierto.estado_vencimiento}
                onChange={(e) => cambiarVcto(abierto, { estado_vencimiento: e.target.value })}
              >
                {ESTADOS_VENCIMIENTO.map((s) => <option key={s} value={s}>{ESTADO_VCT_LABEL[s]}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted mb-1">Responsable</p>
              <SelectorResponsable valor={abierto.responsable} onCambio={(v) => cambiarVcto(abierto, { responsable: v })} className={`${selCls} w-full`} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted mb-1">Próxima acción</p>
              <input
                className={`${inputCls} !py-1.5 !text-xs`}
                defaultValue={abierto.proxima_accion || ''}
                onBlur={(e) => e.target.value !== (abierto.proxima_accion || '') && cambiarVcto(abierto, { proxima_accion: e.target.value || null })}
                placeholder="Ej: pedir propuesta a Zurich"
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Link href={`/gestor/correbin/clientes/${abierto.cliente_id}`} className={btnSecundario}>
              Ver ficha cliente →
            </Link>
            <input
              className={`${inputCls} flex-1 min-w-40 !py-1.5 !text-xs`}
              value={tituloTarea}
              onChange={(e) => setTituloTarea(e.target.value)}
              placeholder="Crear tarea desde este evento..."
            />
            <button onClick={crearTareaDesdeEvento} disabled={!tituloTarea.trim()} className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-bold disabled:opacity-40">
              <Plus className="w-3.5 h-3.5 inline" /> Tarea
            </button>
          </div>
        </Card>
      )}

      {/* VISTA MES */}
      {!cargando && vista === 'mes' && (
        <Card className="!p-3">
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {DIAS_SEMANA.map((d) => <div key={d} className="text-center text-[11px] font-bold text-muted py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {celdasMes.map((dia, i) => {
              if (dia === null) return <div key={`v-${i}`} />;
              const fecha = `${ancla.getFullYear()}-${String(ancla.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
              const lista = porDia.get(fecha) || [];
              const esHoy = fecha === iso(hoy);
              return (
                <div key={dia} className={`min-h-24 rounded-lg border p-1.5 ${esHoy ? 'border-accent bg-accent/10' : lista.length ? 'border-border/40 bg-card/40' : 'border-border/20 bg-card/20'}`}>
                  <p className={`text-[11px] font-bold ${esHoy ? 'text-accent' : 'text-muted'}`}>{dia}</p>
                  <div className="space-y-1 mt-1">
                    {lista.slice(0, 3).map((v) => <Evento key={v.id} v={v} />)}
                    {lista.length > 3 && <p className="text-[10px] text-muted px-1">+{lista.length - 3} más</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* VISTA SEMANA */}
      {!cargando && vista === 'semana' && (
        <div className="grid md:grid-cols-7 gap-2">
          {diasSemana.map((d) => {
            const fecha = iso(d);
            const lista = porDia.get(fecha) || [];
            const esHoy = fecha === iso(hoy);
            return (
              <Card key={fecha} className={`!p-2.5 ${esHoy ? 'border-accent/60' : ''}`}>
                <p className={`text-[11px] font-bold mb-2 ${esHoy ? 'text-accent' : 'text-muted'}`}>
                  {DIAS_SEMANA[(d.getDay() + 6) % 7]} {d.getDate()}
                </p>
                <div className="space-y-1.5">
                  {lista.map((v) => <Evento key={v.id} v={v} />)}
                  {lista.length === 0 && <p className="text-[10px] text-muted/40 text-center py-2">—</p>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* VISTA LISTA (incluye particulares ordinarios) */}
      {!cargando && vista === 'lista' && (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
                <th className="px-3 py-3">Fecha</th>
                <th className="px-3 py-3">Pr.</th>
                <th className="px-3 py-3">Evento</th>
                <th className="px-3 py-3">Segmento</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Responsable</th>
                <th className="px-3 py-3">Próxima acción</th>
              </tr>
            </thead>
            <tbody>
              {[...eventos].sort((a, b) => a.fecha_vct.localeCompare(b.fecha_vct)).map((v) => (
                <tr key={v.id} className="border-b border-border/20 hover:bg-card/50 transition cursor-pointer" onClick={() => setAbierto(v)}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <BadgeVencimiento fecha={v.fecha_vct} />
                    <span className="block text-[10px] text-muted mt-0.5">{fmtFecha(v.fecha_vct)}</span>
                  </td>
                  <td className="px-3 py-2"><BadgePrioridad prioridad={v.vct_clientes?.prioridad} /></td>
                  <td className="px-3 py-2 font-semibold text-xs max-w-72 truncate">{v.titulo_evento}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${SEGMENTO_COLOR[v.segmento]?.badge}`}>{SEGMENTO_LABEL[v.segmento]}</span></td>
                  <td className="px-3 py-2 text-xs">{ESTADO_VCT_LABEL[v.estado_vencimiento]}</td>
                  <td className="px-3 py-2 text-xs text-muted">{v.responsable || 'Sin asignar'}</td>
                  <td className="px-3 py-2 text-xs text-muted max-w-48 truncate">{v.proxima_accion || <span className="text-amber-400">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {eventos.length === 0 && <p className="text-sm text-muted text-center py-8">Sin vencimientos en el periodo.</p>}
        </Card>
      )}
    </div>
  );
}
