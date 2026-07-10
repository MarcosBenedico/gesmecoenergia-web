'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import {
  LuzFechaCritica, TIPOS_FECHA, TIPO_FECHA_LABEL, TIPO_FECHA_TONO, PRIORIDADES,
  diasHasta, fmtFecha,
} from '@/lib/luz';
import { Card, BadgePrioridad, BadgeVencimiento, EstadoCarga, useListaLuz, guardarLuz, btnSecundario, SelectorResponsable } from '../ui';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const iso = (d: Date) => d.toISOString().slice(0, 10);

function FechasContenido() {
  const sp = useSearchParams();
  const hoy = new Date();
  const [vista, setVista] = useState<'calendario' | 'listado'>('calendario');
  const [ancla, setAncla] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const [fResp, setFResp] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [fPrioridad, setFPrioridad] = useState('');
  const [fEstado, setFEstado] = useState('pendiente');
  const [fDias, setFDias] = useState(sp.get('dias') || '');
  const [verD, setVerD] = useState(false);

  const rango = useMemo(() => {
    if (vista === 'listado') {
      return { desde: iso(new Date(Date.now() - 30 * 86400000)), hasta: iso(new Date(Date.now() + 180 * 86400000)) };
    }
    const ultimo = new Date(ancla.getFullYear(), ancla.getMonth() + 1, 0);
    return { desde: iso(new Date(ancla.getFullYear(), ancla.getMonth(), 1)), hasta: iso(ultimo) };
  }, [vista, ancla]);

  const { datos, cargando, error, faltaMigracion, recargar } = useListaLuz<LuzFechaCritica>('fechas', rango);
  const responsables = useMemo(() => Array.from(new Set(datos.map((f) => f.responsable).filter(Boolean))) as string[], [datos]);

  const eventos = useMemo(() => datos.filter((f) => {
    const prio = f.prioridad || f.luz_clientes?.prioridad || 'C';
    // Regla: los clientes D no saturan el calendario (sí salen en listado)
    if (vista === 'calendario' && !verD && prio === 'D') return false;
    if (fResp && f.responsable !== fResp) return false;
    if (fTipo && f.tipo_fecha !== fTipo) return false;
    if (fPrioridad && prio !== fPrioridad) return false;
    if (fEstado && f.estado !== fEstado) return false;
    if (fDias) {
      const d = diasHasta(f.fecha);
      if (d == null || d < 0 || d > parseInt(fDias)) return false;
    }
    return true;
  }), [datos, vista, verD, fResp, fTipo, fPrioridad, fEstado, fDias]);

  const porDia = useMemo(() => {
    const m = new Map<string, LuzFechaCritica[]>();
    for (const f of eventos) m.set(f.fecha, [...(m.get(f.fecha) || []), f]);
    return m;
  }, [eventos]);

  const celdas = useMemo(() => {
    const ultimo = new Date(ancla.getFullYear(), ancla.getMonth() + 1, 0).getDate();
    const offset = (new Date(ancla.getFullYear(), ancla.getMonth(), 1).getDay() + 6) % 7;
    return [...Array.from({ length: offset }, () => null as number | null), ...Array.from({ length: ultimo }, (_, i) => i + 1)];
  }, [ancla]);

  const selCls = 'rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 text-xs font-semibold';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Fechas Críticas</h2>
          <p className="text-xs text-muted mt-0.5">{eventos.length} evento(s) · fin contrato, permanencias, preavisos, firmas, activaciones y comisiones</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a href={`/api/luz/exportar?tipo=fechas${fTipo ? `&tipo_fecha=${fTipo}` : ''}${fResp ? `&responsable=${encodeURIComponent(fResp)}` : ''}`} className={btnSecundario} download>
            <Download className="w-4 h-4" />
          </a>
          {(['calendario', 'listado'] as const).map((v) => (
            <button key={v} onClick={() => setVista(v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${vista === v ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}>{v}</button>
          ))}
          {vista === 'calendario' && (
            <>
              <button onClick={() => setAncla(new Date(ancla.getFullYear(), ancla.getMonth() - 1, 1))} className={btnSecundario}><ChevronLeft className="w-4 h-4" /></button>
              <span className="font-bold text-sm min-w-32 text-center">{MESES[ancla.getMonth()]} {ancla.getFullYear()}</span>
              <button onClick={() => setAncla(new Date(ancla.getFullYear(), ancla.getMonth() + 1, 1))} className={btnSecundario}><ChevronRight className="w-4 h-4" /></button>
            </>
          )}
        </div>
      </div>

      <Card className="!p-3">
        <div className="flex gap-2 flex-wrap items-center">
          <select className={selCls} value={fResp} onChange={(e) => setFResp(e.target.value)}>
            <option value="">Responsable: todos</option>
            {responsables.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className={selCls} value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
            <option value="">Tipo: todos</option>
            {TIPOS_FECHA.map((t) => <option key={t} value={t}>{TIPO_FECHA_LABEL[t]}</option>)}
          </select>
          <select className={selCls} value={fPrioridad} onChange={(e) => setFPrioridad(e.target.value)}>
            <option value="">Prioridad: todas</option>
            {PRIORIDADES.map((p) => <option key={p} value={p}>Prioridad {p}</option>)}
          </select>
          <select className={selCls} value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
            <option value="pendiente">Pendientes</option>
            <option value="gestionada">Gestionadas</option>
            <option value="">Todas</option>
          </select>
          <select className={selCls} value={fDias} onChange={(e) => setFDias(e.target.value)}>
            <option value="">Horizonte: todo</option>
            {[15, 30, 60, 90, 120].map((d) => <option key={d} value={d}>Próximos {d} días</option>)}
          </select>
          {vista === 'calendario' && (
            <label className="flex items-center gap-1.5 text-xs text-muted font-semibold cursor-pointer ml-auto">
              <input type="checkbox" checked={verD} onChange={(e) => setVerD(e.target.checked)} />
              Mostrar clientes D
            </label>
          )}
        </div>
      </Card>

      <EstadoCarga cargando={cargando} error={error} faltaMigracion={faltaMigracion} vacio={false} textoVacio="" sqlFile="supabase_luz.sql" />

      {!cargando && vista === 'calendario' && (
        <Card className="!p-3">
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {DIAS_SEMANA.map((d) => <div key={d} className="text-center text-[11px] font-bold text-muted py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {celdas.map((dia, i) => {
              if (dia === null) return <div key={`v-${i}`} />;
              const fecha = `${ancla.getFullYear()}-${String(ancla.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
              const lista = porDia.get(fecha) || [];
              const esHoy = fecha === iso(hoy);
              return (
                <div key={dia} className={`min-h-24 rounded-lg border p-1.5 ${esHoy ? 'border-accent bg-accent/10' : lista.length ? 'border-border/40 bg-card/40' : 'border-border/20 bg-card/20'}`}>
                  <p className={`text-[11px] font-bold ${esHoy ? 'text-accent' : 'text-muted'}`}>{dia}</p>
                  <div className="space-y-1 mt-1">
                    {lista.slice(0, 3).map((f) => (
                      <Link key={f.id} href={`/gestor/luz/clientes/${f.cliente_id}`}
                        className={`block text-[10px] leading-tight px-1.5 py-1 rounded border truncate hover:brightness-125 transition ${TIPO_FECHA_TONO[f.tipo_fecha] || 'bg-card/60 text-muted border-border/30'}`}
                        title={f.titulo}>
                        {f.titulo.replace(/^LUZ - /, '')}
                      </Link>
                    ))}
                    {lista.length > 3 && <p className="text-[10px] text-muted px-1">+{lista.length - 3}</p>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-1.5 flex-wrap mt-3">
            {TIPOS_FECHA.map((t) => (
              <span key={t} className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${TIPO_FECHA_TONO[t]}`}>{TIPO_FECHA_LABEL[t]}</span>
            ))}
          </div>
        </Card>
      )}

      {!cargando && vista === 'listado' && (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
                <th className="px-3 py-3">Fecha</th><th className="px-3 py-3">Pr.</th><th className="px-3 py-3">Evento</th>
                <th className="px-3 py-3">Tipo</th><th className="px-3 py-3">Responsable</th><th className="px-3 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {[...eventos].sort((a, b) => a.fecha.localeCompare(b.fecha)).map((f) => (
                <tr key={f.id} className="border-b border-border/20 hover:bg-card/50 transition">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <BadgeVencimiento fecha={f.fecha} />
                    <span className="block text-[10px] text-muted mt-0.5">{fmtFecha(f.fecha)}</span>
                  </td>
                  <td className="px-3 py-2"><BadgePrioridad prioridad={f.prioridad || f.luz_clientes?.prioridad} /></td>
                  <td className="px-3 py-2 font-semibold text-xs max-w-72 truncate">
                    <Link href={`/gestor/luz/clientes/${f.cliente_id}`} className="hover:text-accent">{f.titulo}</Link>
                  </td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${TIPO_FECHA_TONO[f.tipo_fecha]}`}>{TIPO_FECHA_LABEL[f.tipo_fecha]}</span></td>
                  <td className="px-3 py-2">
                    <SelectorResponsable valor={f.responsable} onCambio={async (v) => { await guardarLuz('fechas', 'PUT', { id: f.id, responsable: v }); recargar(); }} />
                  </td>
                  <td className="px-3 py-2">
                    <select value={f.estado}
                      onChange={async (e) => { await guardarLuz('fechas', 'PUT', { id: f.id, estado: e.target.value }); recargar(); }}
                      className={selCls}>
                      <option value="pendiente">Pendiente</option>
                      <option value="gestionada">Gestionada</option>
                      <option value="descartada">Descartada</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {eventos.length === 0 && <p className="text-sm text-muted text-center py-8">Sin fechas críticas con este filtro.</p>}
        </Card>
      )}
    </div>
  );
}

export default function FechasPage() {
  return (
    <Suspense fallback={<div className="text-muted text-sm py-8 text-center">Cargando...</div>}>
      <FechasContenido />
    </Suspense>
  );
}
