'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Download, Plus } from 'lucide-react';
import {
  VctPoliza, RAMOS, RAMO_LABEL, PRIORIDADES, SEGMENTOS, SEGMENTO_LABEL,
  ESTADOS_POLIZA, ESTADO_POLIZA_LABEL, ESTADOS_CARTERA_VIVA,
  diasHasta, fmtEur0, fmtFecha,
} from '@/lib/correbin';
import {
  Card, BadgeVencimiento, Badge, BadgePrioridad, BadgeSegmento, EstadoCarga,
  useLista, guardar, inputCls, labelCls, btnSecundario, SelectorResponsable,
} from '../ui';

function CarteraContenido() {
  const sp = useSearchParams();
  const { datos, cargando, error, faltaMigracion, recargar } = useLista<VctPoliza>('polizas');

  const [buscar, setBuscar] = useState('');
  const [ramo, setRamo] = useState('');
  const [compania, setCompania] = useState('');
  const [responsable, setResponsable] = useState('');
  const [estado, setEstado] = useState('');
  const [prioridad, setPrioridad] = useState(sp.get('prioridad') || '');
  const [segmento, setSegmento] = useState('');
  const [dias, setDias] = useState(sp.get('dias') || '');
  const [incompletas, setIncompletas] = useState(sp.get('incompletas') || '');
  const [tareaPara, setTareaPara] = useState<VctPoliza | null>(null);
  const [tituloTarea, setTituloTarea] = useState('');

  const responsables = useMemo(
    () => Array.from(new Set(datos.map((p) => p.responsable).filter(Boolean))) as string[],
    [datos]
  );

  const filtradas = useMemo(() => {
    return datos.filter((p) => {
      if (!estado && !ESTADOS_CARTERA_VIVA.includes(p.estado)) return false;
      if (estado && p.estado !== estado) return false;
      if (ramo && p.ramo !== ramo) return false;
      if (compania && !p.compania?.toLowerCase().includes(compania.toLowerCase())) return false;
      if (responsable && p.responsable !== responsable) return false;
      if (prioridad && (p.prioridad || p.vct_clientes?.prioridad || 'C') !== prioridad) return false;
      if (segmento && (p.segmento || p.vct_clientes?.segmento) !== segmento) return false;
      if (dias) {
        const d = diasHasta(p.fecha_vencimiento);
        if (d == null || d < 0 || d > parseInt(dias)) return false;
      }
      if (incompletas === 'prima' && Number(p.prima_anual)) return false;
      if (incompletas === 'vencimiento' && p.fecha_vencimiento) return false;
      if (buscar) {
        const q = buscar.toLowerCase();
        if (!`${p.vct_clientes?.nombre || ''} ${p.vct_clientes?.nif || ''} ${p.compania} ${p.numero_poliza || ''}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [datos, estado, ramo, compania, responsable, prioridad, segmento, dias, incompletas, buscar]);

  const primaFiltrada = filtradas.reduce((s, p) => s + (Number(p.prima_anual) || 0), 0);

  const urlExport = useMemo(() => {
    const q = new URLSearchParams({ tipo: incompletas ? 'incompletas' : 'cartera' });
    if (ramo) q.set('ramo', ramo);
    if (compania) q.set('compania', compania);
    if (responsable) q.set('responsable', responsable);
    if (estado) q.set('estado', estado);
    if (prioridad) q.set('prioridad', prioridad);
    if (segmento) q.set('segmento', segmento);
    if (dias) q.set('dias', dias);
    if (buscar) q.set('buscar', buscar);
    return `/api/correbin/exportar?${q.toString()}`;
  }, [ramo, compania, responsable, estado, prioridad, segmento, dias, buscar, incompletas]);

  async function cambiar(p: VctPoliza, campos: Record<string, unknown>) {
    const err = await guardar('polizas', 'PUT', { id: p.id, ...campos });
    if (!err) recargar();
  }

  async function crearTarea() {
    if (!tareaPara || !tituloTarea.trim()) return;
    await guardar('tareas', 'POST', {
      cliente_id: tareaPara.cliente_id,
      poliza_id: tareaPara.id,
      titulo: tituloTarea,
      tipo_tarea: 'seguimiento',
      responsable: tareaPara.responsable || null,
      fecha_limite: tareaPara.fecha_vencimiento,
    });
    setTareaPara(null);
    setTituloTarea('');
  }

  const selCls = 'rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 text-xs font-semibold';

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Cartera viva</h2>
          <p className="text-xs text-muted mt-0.5">
            {filtradas.length} póliza(s) · prima {fmtEur0(primaFiltrada)}
          </p>
        </div>
        <a href={urlExport} className={btnSecundario} download>
          <Download className="w-4 h-4" /> Exportar (con filtros)
        </a>
      </div>

      {/* Filtros */}
      <Card className="!p-4 space-y-3">
        <div className="grid md:grid-cols-4 gap-2.5">
          <input className={inputCls} value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="🔍 Cliente, NIF, compañía, nº póliza..." />
          <select className={selCls} value={ramo} onChange={(e) => setRamo(e.target.value)}>
            <option value="">Ramo: todos</option>
            {RAMOS.map((r) => <option key={r} value={r}>{RAMO_LABEL[r]}</option>)}
          </select>
          <input className={inputCls} value={compania} onChange={(e) => setCompania(e.target.value)} placeholder="Compañía..." />
          <select className={selCls} value={responsable} onChange={(e) => setResponsable(e.target.value)}>
            <option value="">Responsable: todos</option>
            {responsables.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className={selCls} value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Estado: cartera viva</option>
            {ESTADOS_POLIZA.filter((e, i, a) => a.indexOf(e) === i && e !== 'viva').map((es) => (
              <option key={es} value={es}>{ESTADO_POLIZA_LABEL[es]}</option>
            ))}
          </select>
          <select className={selCls} value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
            <option value="">Prioridad: todas</option>
            {PRIORIDADES.map((p) => <option key={p} value={p}>Prioridad {p}</option>)}
          </select>
          <select className={selCls} value={segmento} onChange={(e) => setSegmento(e.target.value)}>
            <option value="">Segmento: todos</option>
            {SEGMENTOS.map((s) => <option key={s} value={s}>{SEGMENTO_LABEL[s]}</option>)}
          </select>
          <select className={selCls} value={dias} onChange={(e) => setDias(e.target.value)}>
            <option value="">Vencimiento: cualquiera</option>
            <option value="30">Próximos 30 días</option>
            <option value="60">Próximos 60 días</option>
            <option value="90">Próximos 90 días</option>
            <option value="120">Próximos 120 días</option>
          </select>
        </div>
        <div className="flex gap-2 flex-wrap text-xs">
          {[['', 'Todas'], ['prima', '⚠️ Sin prima'], ['vencimiento', '⚠️ Sin vencimiento']].map(([v, n]) => (
            <button
              key={v}
              onClick={() => setIncompletas(v)}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition ${incompletas === v ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}
            >
              {n}
            </button>
          ))}
        </div>
      </Card>

      {/* Mini-form crear tarea */}
      {tareaPara && (
        <Card className="!p-4 border-accent/40">
          <p className="text-xs font-bold mb-2">Nueva tarea para {tareaPara.vct_clientes?.nombre} · {tareaPara.compania}</p>
          <div className="flex gap-2 flex-wrap">
            <input className={`${inputCls} flex-1 min-w-48`} value={tituloTarea} onChange={(e) => setTituloTarea(e.target.value)} placeholder="Ej: llamar antes del vencimiento" autoFocus />
            <button onClick={crearTarea} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold">Crear</button>
            <button onClick={() => setTareaPara(null)} className={btnSecundario}>Cancelar</button>
          </div>
        </Card>
      )}

      <EstadoCarga
        cargando={cargando}
        error={error}
        faltaMigracion={faltaMigracion}
        vacio={!cargando && !error && filtradas.length === 0}
        textoVacio="No hay pólizas con este filtro. Importa la cartera desde Excel."
      />

      {filtradas.length > 0 && (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
                <th className="px-3 py-3">Pr.</th>
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3">Nº póliza</th>
                <th className="px-3 py-3">Compañía</th>
                <th className="px-3 py-3">Ramo</th>
                <th className="px-3 py-3 text-right">Prima</th>
                <th className="px-3 py-3">Vencimiento</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Responsable</th>
                <th className="px-3 py-3">Segmento</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((p) => (
                <tr key={p.id} className="border-b border-border/20 hover:bg-card/50 transition">
                  <td className="px-3 py-2">
                    <select
                      value={p.prioridad || p.vct_clientes?.prioridad || 'C'}
                      onChange={(e) => cambiar(p, { prioridad: e.target.value })}
                      className="rounded-md border border-border/40 bg-background/60 px-1 py-0.5 text-xs font-black"
                    >
                      {PRIORIDADES.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 font-semibold">
                    <Link href={`/gestor/correbin/clientes/${p.cliente_id}`} className="hover:text-accent transition">
                      {p.vct_clientes?.nombre || '—'}
                    </Link>
                    {p.vct_clientes?.nif && <span className="block text-[10px] font-mono text-muted">{p.vct_clientes.nif}</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted">{p.numero_poliza || '—'}</td>
                  <td className="px-3 py-2">{p.compania}</td>
                  <td className="px-3 py-2"><Badge>{RAMO_LABEL[p.ramo] || p.ramo}</Badge></td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">
                    {Number(p.prima_anual) ? fmtEur0(Number(p.prima_anual)) : <span className="text-amber-400 text-xs font-bold">SIN PRIMA</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {p.fecha_vencimiento ? (
                      <>
                        <BadgeVencimiento fecha={p.fecha_vencimiento} />
                        <span className="block text-[10px] text-muted mt-0.5">{fmtFecha(p.fecha_vencimiento)}</span>
                      </>
                    ) : <span className="text-amber-400 text-xs font-bold">SIN VCTO</span>}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={p.estado}
                      onChange={(e) => cambiar(p, { estado: e.target.value })}
                      className="rounded-md border border-border/40 bg-background/60 px-1.5 py-0.5 text-[11px] font-semibold max-w-28"
                    >
                      {['activa', 'pendiente_revision', 'sustituida', 'anulada', 'vencida', 'bloqueada', 'sin_datos'].map((es) => (
                        <option key={es} value={es}>{ESTADO_POLIZA_LABEL[es]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <SelectorResponsable valor={p.responsable} onCambio={(v) => cambiar(p, { responsable: v })} />
                  </td>
                  <td className="px-3 py-2"><BadgeSegmento segmento={p.segmento || p.vct_clientes?.segmento} /></td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => setTareaPara(p)}
                      className="text-xs text-muted hover:text-accent font-semibold whitespace-nowrap"
                      title="Crear tarea"
                    >
                      <Plus className="w-3.5 h-3.5 inline" /> tarea
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

export default function CarteraPage() {
  return (
    <Suspense fallback={<div className="text-muted text-sm py-8 text-center">Cargando...</div>}>
      <CarteraContenido />
    </Suspense>
  );
}
