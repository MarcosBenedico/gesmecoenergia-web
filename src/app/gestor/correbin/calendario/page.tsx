'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus, Maximize2, Minimize2, X } from 'lucide-react';
import {
  VctVencimiento, SEGMENTOS, SEGMENTO_LABEL, SEGMENTO_COLOR, SEGMENTOS_FUERA_CALENDARIO,
  ESTADOS_VENCIMIENTO, ESTADO_VCT_LABEL, PRIORIDADES, VCT_CERRADOS, fmtFecha, infoVencimiento,
} from '@/lib/correbin';
import { Card, EstadoCarga, useLista, guardar, btnSecundario, inputCls, SelectorResponsable, BadgeVencimiento, BadgePrioridad } from '../ui';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const iso = (d: Date) => d.toISOString().slice(0, 10);

type Vista = 'mes' | '6m' | '12m' | 'semana' | 'lista';
const VISTAS: { clave: Vista; nombre: string }[] = [
  { clave: 'mes', nombre: '1 mes' },
  { clave: '6m', nombre: '6 meses' },
  { clave: '12m', nombre: '12 meses' },
  { clave: 'semana', nombre: 'Semana' },
  { clave: 'lista', nombre: 'Lista' },
];

export default function CalendarioVct() {
  const hoy = new Date();
  const [vista, setVista] = useState<Vista>('mes');
  // Si venimos de la vista 6/12 meses ampliando un mes, guardamos a cuál volver
  const [vistaOrigen, setVistaOrigen] = useState<'6m' | '12m' | null>(null);
  const [ancla, setAncla] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
  const [pantallaCompleta, setPantallaCompleta] = useState(false);

  // Filtros
  const [fResp, setFResp] = useState('');
  const [fSegs, setFSegs] = useState<string[]>([]); // selección múltiple de segmentos
  const [fEst, setFEst] = useState('');
  const [fPri, setFPri] = useState('');
  const [verOrdinarios, setVerOrdinarios] = useState(false);

  function cambiarVista(v: Vista) {
    setVista(v);
    setVistaOrigen(null);
  }

  function toggleSegmento(s: string) {
    setFSegs((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  // Cantidad de meses que abarca la vista actual
  const numMeses = vista === '6m' ? 6 : vista === '12m' ? 12 : 1;

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
    const ultimo = new Date(ancla.getFullYear(), ancla.getMonth() + numMeses, 0);
    return { desde: iso(primero), hasta: iso(ultimo) };
  }, [vista, ancla, numMeses]);

  const { datos, cargando, error, faltaMigracion, recargar } = useLista<VctVencimiento>('vencimientos', { desde, hasta });

  const responsables = useMemo(
    () => Array.from(new Set(datos.map((v) => v.responsable).filter(Boolean))) as string[],
    [datos]
  );

  const eventos = useMemo(() => datos.filter((v) => {
    // Regla clave: los particulares ordinarios no saturan el calendario (sí salen en lista)
    if (vista !== 'lista' && !verOrdinarios && SEGMENTOS_FUERA_CALENDARIO.includes(v.segmento)) return false;
    if (fResp && v.responsable !== fResp) return false;
    if (fSegs.length > 0 && !fSegs.includes(v.segmento)) return false;
    if (fEst && v.estado_vencimiento !== fEst) return false;
    if (fPri && (v.vct_clientes?.prioridad || 'C') !== fPri) return false;
    return true;
  }), [datos, vista, verOrdinarios, fResp, fSegs, fEst, fPri]);

  const [abierto, setAbierto] = useState<VctVencimiento | null>(null);
  const [tituloTarea, setTituloTarea] = useState('');

  function mover(delta: number) {
    const f = new Date(ancla);
    if (vista === 'semana') f.setDate(f.getDate() + delta * 7);
    else f.setMonth(f.getMonth() + delta * numMeses);
    setAncla(f);
  }

  /** Ampliar un mes desde la vista de 6/12 meses (conserva filtros). */
  function ampliarMes(anio: number, mes: number) {
    setVistaOrigen(vista === '6m' || vista === '12m' ? vista : null);
    setAncla(new Date(anio, mes, 1));
    setVista('mes');
  }

  function volverAVistaOrigen() {
    if (vistaOrigen) { setVista(vistaOrigen); setVistaOrigen(null); }
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

  // Celdas del mes de la vista mensual
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

  // Meses de la vista 6/12 (con sus eventos)
  const mesesGrid = useMemo(() => {
    if (vista !== '6m' && vista !== '12m') return [];
    return Array.from({ length: numMeses }, (_, i) => {
      const d = new Date(ancla.getFullYear(), ancla.getMonth() + i, 1);
      const pref = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const evs = eventos.filter((v) => v.fecha_vct.startsWith(pref)).sort((a, b) => a.fecha_vct.localeCompare(b.fecha_vct));
      return { anio: d.getFullYear(), mes: d.getMonth(), eventos: evs };
    });
  }, [vista, numMeses, ancla, eventos]);

  /** Evento en la vista mensual: tomador + nº póliza + compañía siempre visibles. */
  const Evento = ({ v }: { v: VctVencimiento }) => {
    const c = SEGMENTO_COLOR[v.segmento];
    const cerrado = VCT_CERRADOS.includes(v.estado_vencimiento);
    const info = infoVencimiento(v);
    return (
      <button
        onClick={() => setAbierto(v)}
        className={`block w-full text-left text-[10px] leading-tight px-1.5 py-1 rounded border transition ${c?.evento || 'bg-card/60 text-muted border-border/30'} ${cerrado ? 'opacity-40 line-through' : 'hover:brightness-125'}`}
        title={`${info.tomador} · Póliza ${info.poliza} · ${info.compania} · ${fmtFecha(v.fecha_vct)}`}
      >
        <span className="block font-bold truncate">{info.tomador}</span>
        <span className="block truncate opacity-90">{info.poliza} · {info.compania}</span>
      </button>
    );
  };

  /** Evento compacto (vistas 6/12 meses): datos resumidos, clic para ver todo. */
  const EventoCompacto = ({ v }: { v: VctVencimiento }) => {
    const c = SEGMENTO_COLOR[v.segmento];
    const cerrado = VCT_CERRADOS.includes(v.estado_vencimiento);
    const info = infoVencimiento(v);
    return (
      <button
        onClick={() => setAbierto(v)}
        className={`flex w-full items-baseline gap-1.5 text-left text-[10px] leading-tight px-1.5 py-0.5 rounded border transition ${c?.evento || 'bg-card/60 text-muted border-border/30'} ${cerrado ? 'opacity-40 line-through' : 'hover:brightness-125'}`}
        title={`${info.tomador} · Póliza ${info.poliza} · ${info.compania} · ${fmtFecha(v.fecha_vct)}`}
      >
        <span className="shrink-0 font-black tabular-nums">{parseInt(v.fecha_vct.slice(8, 10))}</span>
        <span className="truncate font-semibold">{info.tomador}</span>
        <span className="truncate opacity-80 hidden sm:inline">{info.poliza} · {info.compania}</span>
      </button>
    );
  };

  /** Mini calendario de un mes (vistas 6/12): rejilla de días + lista de vencimientos. */
  const MiniMes = ({ anio, mes, evs }: { anio: number; mes: number; evs: VctVencimiento[] }) => {
    const primero = new Date(anio, mes, 1);
    const ultimoDia = new Date(anio, mes + 1, 0).getDate();
    const offset = (primero.getDay() + 6) % 7;
    const celdas = [...Array.from({ length: offset }, () => null as number | null), ...Array.from({ length: ultimoDia }, (_, i) => i + 1)];
    const esMesActual = anio === hoy.getFullYear() && mes === hoy.getMonth();
    return (
      <Card className={`!p-3 flex flex-col ${esMesActual ? 'border-accent/50' : ''}`}>
        <button
          onClick={() => ampliarMes(anio, mes)}
          className="flex items-center justify-between gap-2 mb-2 group"
          title="Ampliar este mes"
        >
          <span className={`text-sm font-black ${esMesActual ? 'text-accent' : 'text-foreground'} group-hover:text-accent transition`}>
            {MESES[mes]} {anio}
          </span>
          <span className="text-[10px] font-bold text-muted group-hover:text-accent transition">
            {evs.length} vcto(s) · ampliar <Maximize2 className="w-3 h-3 inline" />
          </span>
        </button>
        {/* Rejilla de días con densidad de vencimientos */}
        <div className="grid grid-cols-7 gap-0.5 mb-2">
          {DIAS_SEMANA.map((d) => <div key={d} className="text-center text-[8px] font-bold text-muted/60">{d[0]}</div>)}
          {celdas.map((dia, i) => {
            if (dia === null) return <div key={`v-${i}`} />;
            const fecha = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
            const n = (porDia.get(fecha) || []).length;
            const esHoy = fecha === iso(hoy);
            return (
              <button
                key={dia}
                onClick={() => ampliarMes(anio, mes)}
                title={n ? `${fmtFecha(fecha)}: ${n} vencimiento(s)` : fmtFecha(fecha)}
                className={`aspect-square rounded-[3px] text-[8px] font-bold tabular-nums flex items-center justify-center transition
                  ${esHoy ? 'ring-1 ring-accent text-accent' : ''}
                  ${n === 0 ? 'bg-card/30 text-muted/40' : n === 1 ? 'bg-accent/25 text-foreground' : n === 2 ? 'bg-accent/45 text-white' : 'bg-accent/70 text-white'}`}
              >
                {dia}
              </button>
            );
          })}
        </div>
        {/* Lista resumida de vencimientos del mes (tomador · póliza · compañía) */}
        <div className={`space-y-0.5 overflow-y-auto pr-0.5 ${vista === '12m' ? 'max-h-28' : 'max-h-48'}`}>
          {evs.length === 0 && <p className="text-[10px] text-muted/40 text-center py-1">Sin vencimientos</p>}
          {evs.map((v) => <EventoCompacto key={v.id} v={v} />)}
        </div>
      </Card>
    );
  };

  const infoAbierto = abierto ? infoVencimiento(abierto) : null;

  const contenido = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Calendario VCT</h2>
          <p className="text-xs text-muted mt-0.5">{eventos.length} vencimiento(s) en el periodo</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {vistaOrigen && (
            <button onClick={volverAVistaOrigen} className={btnSecundario}>
              <ChevronLeft className="w-4 h-4" /> Volver a {vistaOrigen === '6m' ? '6 meses' : '12 meses'}
            </button>
          )}
          {VISTAS.map(({ clave, nombre }) => (
            <button
              key={clave}
              onClick={() => cambiarVista(clave)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition ${vista === clave ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}
            >
              {nombre}
            </button>
          ))}
          {vista !== 'lista' && (
            <>
              <button onClick={() => mover(-1)} className={btnSecundario}><ChevronLeft className="w-4 h-4" /></button>
              <span className="font-bold text-sm min-w-32 text-center">
                {vista === 'mes' && `${MESES[ancla.getMonth()]} ${ancla.getFullYear()}`}
                {vista === 'semana' && `Semana del ${fmtFecha(desde)}`}
                {(vista === '6m' || vista === '12m') && `${MESES[ancla.getMonth()]} ${ancla.getFullYear()} → ${MESES[(ancla.getMonth() + numMeses - 1) % 12]} ${new Date(ancla.getFullYear(), ancla.getMonth() + numMeses - 1, 1).getFullYear()}`}
              </span>
              <button onClick={() => mover(1)} className={btnSecundario}><ChevronRight className="w-4 h-4" /></button>
            </>
          )}
          <button
            onClick={() => setPantallaCompleta((v) => !v)}
            className={btnSecundario}
            title={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {pantallaCompleta ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="!p-3">
        <div className="flex gap-2 flex-wrap items-center">
          <select className={selCls} value={fResp} onChange={(e) => setFResp(e.target.value)}>
            <option value="">Responsable: todos</option>
            {responsables.map((r) => <option key={r} value={r}>{r}</option>)}
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
        {/* Segmentos: selección múltiple (clic para marcar/desmarcar) */}
        <div className="flex gap-1.5 flex-wrap mt-2.5 items-center">
          <span className="text-[10px] font-bold uppercase text-muted mr-1">
            Segmentos{fSegs.length > 0 ? ` (${fSegs.length} seleccionados)` : ' (todos)'}:
          </span>
          {SEGMENTOS.map((s) => {
            const activo = fSegs.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggleSegmento(s)}
                className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold transition ${SEGMENTO_COLOR[s]?.badge} ${activo ? 'ring-2 ring-accent ring-offset-1 ring-offset-background' : 'opacity-60 hover:opacity-100'}`}
                title={activo ? 'Quitar del filtro' : 'Añadir al filtro'}
              >
                {activo ? '✓ ' : ''}{SEGMENTO_LABEL[s]}
              </button>
            );
          })}
          {fSegs.length > 0 && (
            <button onClick={() => setFSegs([])} className="text-[10px] font-bold text-accent hover:text-accent-light ml-1">
              ✕ Limpiar segmentos
            </button>
          )}
        </div>
      </Card>

      <EstadoCarga cargando={cargando} error={error} faltaMigracion={faltaMigracion} vacio={false} textoVacio="" />

      {/* Panel de edición rápida del evento */}
      {abierto && infoAbierto && (
        <Card className="border-accent/40 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-sm">{abierto.titulo_evento}</p>
              <p className="text-xs text-muted mt-0.5">
                {fmtFecha(abierto.fecha_vct)} · <BadgeVencimiento fecha={abierto.fecha_vct} />
              </p>
              <div className="flex gap-x-4 gap-y-1 flex-wrap mt-2 text-xs">
                <span><span className="font-bold uppercase text-[10px] text-muted">Tomador:</span> <span className="font-semibold">{infoAbierto.tomador}</span></span>
                <span><span className="font-bold uppercase text-[10px] text-muted">Nº póliza:</span> <span className="font-semibold tabular-nums">{infoAbierto.poliza}</span></span>
                <span><span className="font-bold uppercase text-[10px] text-muted">Compañía:</span> <span className="font-semibold">{infoAbierto.compania}</span></span>
                {abierto.vct_clientes?.tipo && <span><span className="font-bold uppercase text-[10px] text-muted">Tipo empresa:</span> <span className="font-semibold">{abierto.vct_clientes.tipo}</span></span>}
              </div>
            </div>
            <button onClick={() => setAbierto(null)} className="text-muted hover:text-foreground text-sm"><X className="w-4 h-4" /></button>
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
              const maxVisibles = pantallaCompleta ? 5 : 3;
              return (
                <div key={dia} className={`${pantallaCompleta ? 'min-h-32' : 'min-h-24'} rounded-lg border p-1.5 ${esHoy ? 'border-accent bg-accent/10' : lista.length ? 'border-border/40 bg-card/40' : 'border-border/20 bg-card/20'}`}>
                  <p className={`text-[11px] font-bold ${esHoy ? 'text-accent' : 'text-muted'}`}>{dia}</p>
                  <div className="space-y-1 mt-1">
                    {lista.slice(0, maxVisibles).map((v) => <Evento key={v.id} v={v} />)}
                    {lista.length > maxVisibles && <p className="text-[10px] text-muted px-1">+{lista.length - maxVisibles} más</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* VISTAS 6 / 12 MESES */}
      {!cargando && (vista === '6m' || vista === '12m') && (
        <div className={`grid gap-3 ${vista === '6m'
          ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
          {mesesGrid.map((m) => <MiniMes key={`${m.anio}-${m.mes}`} anio={m.anio} mes={m.mes} evs={m.eventos} />)}
        </div>
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
                <th className="px-3 py-3">Tomador</th>
                <th className="px-3 py-3">Nº póliza</th>
                <th className="px-3 py-3">Compañía</th>
                <th className="px-3 py-3">Segmento</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Responsable</th>
                <th className="px-3 py-3">Próxima acción</th>
              </tr>
            </thead>
            <tbody>
              {[...eventos].sort((a, b) => a.fecha_vct.localeCompare(b.fecha_vct)).map((v) => {
                const info = infoVencimiento(v);
                return (
                  <tr key={v.id} className="border-b border-border/20 hover:bg-card/50 transition cursor-pointer" onClick={() => setAbierto(v)}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <BadgeVencimiento fecha={v.fecha_vct} />
                      <span className="block text-[10px] text-muted mt-0.5">{fmtFecha(v.fecha_vct)}</span>
                    </td>
                    <td className="px-3 py-2"><BadgePrioridad prioridad={v.vct_clientes?.prioridad} /></td>
                    <td className="px-3 py-2 font-semibold text-xs max-w-56 truncate" title={v.titulo_evento}>{info.tomador}</td>
                    <td className="px-3 py-2 text-xs tabular-nums">{info.poliza}</td>
                    <td className="px-3 py-2 text-xs">{info.compania}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${SEGMENTO_COLOR[v.segmento]?.badge}`}>{SEGMENTO_LABEL[v.segmento]}</span></td>
                    <td className="px-3 py-2 text-xs">{ESTADO_VCT_LABEL[v.estado_vencimiento]}</td>
                    <td className="px-3 py-2 text-xs text-muted">{v.responsable || 'Sin asignar'}</td>
                    <td className="px-3 py-2 text-xs text-muted max-w-48 truncate">{v.proxima_accion || <span className="text-amber-400">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {eventos.length === 0 && <p className="text-sm text-muted text-center py-8">Sin vencimientos en el periodo.</p>}
        </Card>
      )}
    </div>
  );

  // Pantalla completa: el calendario ocupa toda la ventana (filtros y controles siguen visibles)
  if (pantallaCompleta) {
    return (
      <div className="fixed inset-0 z-50 bg-background overflow-y-auto p-4 md:p-6">
        {contenido}
      </div>
    );
  }
  return contenido;
}
