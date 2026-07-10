'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Download, Plus } from 'lucide-react';
import {
  LuzCups, TARIFAS_ACCESO, ESTADOS_CUPS, ESTADO_CUPS_LABEL, PRIORIDADES,
  diasHasta, fmtFecha, fmtKwh,
} from '@/lib/luz';
import {
  Card, Badge, BadgePrioridad, BadgeVencimiento, EstadoCarga, useListaLuz, guardarLuz,
  inputCls, btnPrimario, btnSecundario, SelectorResponsable,
} from '../ui';

function CupsContenido() {
  const sp = useSearchParams();
  const { datos, cargando, error, faltaMigracion, recargar } = useListaLuz<LuzCups>('cups');

  const [buscar, setBuscar] = useState('');
  const [fTarifa, setFTarifa] = useState('');
  const [fCia, setFCia] = useState('');
  const [fEstado, setFEstado] = useState(sp.get('estado_cups') || '');
  const [fResp, setFResp] = useState('');
  const [fPrioridad, setFPrioridad] = useState('');
  const [fEspecial, setFEspecial] = useState(sp.get('incompletos') || '');
  const [tareaPara, setTareaPara] = useState<LuzCups | null>(null);
  const [tituloTarea, setTituloTarea] = useState('');

  const responsables = useMemo(() => Array.from(new Set(datos.map((c) => c.responsable).filter(Boolean))) as string[], [datos]);

  const filtrados = useMemo(() => datos.filter((c) => {
    if (fTarifa && c.tarifa_acceso !== fTarifa) return false;
    if (fCia && !c.comercializadora_actual?.toLowerCase().includes(fCia.toLowerCase())) return false;
    if (fEstado && c.estado_cups !== fEstado) return false;
    if (fResp && c.responsable !== fResp) return false;
    if (fPrioridad && (c.prioridad || c.luz_clientes?.prioridad || 'C') !== fPrioridad) return false;
    if (fEspecial === 'sin_factura' && c.estado_cups !== 'sin_factura') return false;
    if (fEspecial === 'fin_contrato' && c.fecha_fin_contrato) return false;
    if (fEspecial === 'responsable' && c.responsable) return false;
    if (fEspecial === 'permanencia_proxima') {
      const d = diasHasta(c.fecha_fin_permanencia);
      if (d == null || d < 0 || d > 60) return false;
    }
    if (fEspecial === 'preaviso_proximo') {
      const d = diasHasta(c.fecha_limite_preaviso);
      if (d == null || d < 0 || d > 30) return false;
    }
    if (fEspecial === 'pendiente_firma' && c.estado_cups !== 'pendiente_firma') return false;
    if (fEspecial === 'pendiente_activacion' && c.estado_cups !== 'pendiente_activacion') return false;
    if (buscar) {
      const q = buscar.toLowerCase();
      if (!`${c.luz_clientes?.nombre || ''} ${c.cups} ${c.alias_suministro || ''}`.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [datos, fTarifa, fCia, fEstado, fResp, fPrioridad, fEspecial, buscar]);

  const consumoTotal = filtrados.reduce((s, c) => s + (Number(c.consumo_anual_kwh) || 0), 0);

  const urlExport = useMemo(() => {
    const q = new URLSearchParams({ tipo: fEspecial && fEspecial !== 'sin_factura' ? 'cups_incompletos' : 'cups' });
    if (fTarifa) q.set('tarifa_acceso', fTarifa);
    if (fCia) q.set('comercializadora_actual', fCia);
    if (fEstado) q.set('estado_cups', fEstado);
    if (fResp) q.set('responsable', fResp);
    if (fPrioridad) q.set('prioridad', fPrioridad);
    return `/api/luz/exportar?${q.toString()}`;
  }, [fTarifa, fCia, fEstado, fResp, fPrioridad, fEspecial]);

  async function crearTarea() {
    if (!tareaPara || !tituloTarea.trim()) return;
    await guardarLuz('tareas', 'POST', {
      cliente_id: tareaPara.cliente_id, cups_id: tareaPara.id, tipo_tarea: 'seguimiento',
      descripcion: tituloTarea, responsable: tareaPara.responsable || null,
      fecha_limite: tareaPara.fecha_limite_preaviso || tareaPara.fecha_fin_contrato || null,
    });
    setTareaPara(null); setTituloTarea('');
  }

  const selCls = 'rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 text-xs font-semibold';

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">CUPS / Suministros</h2>
          <p className="text-xs text-muted mt-0.5">{filtrados.length} CUPS · {fmtKwh(consumoTotal)}/año · los CUPS se añaden desde la ficha del cliente o por importación</p>
        </div>
        <a href={urlExport} className={btnSecundario} download><Download className="w-4 h-4" /> Exportar (con filtros)</a>
      </div>

      <Card className="!p-3 space-y-2.5">
        <div className="flex gap-2 flex-wrap">
          <input className={`${inputCls} flex-1 min-w-44`} value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="🔍 Cliente, CUPS, alias..." />
          <select className={selCls} value={fTarifa} onChange={(e) => setFTarifa(e.target.value)}>
            <option value="">Tarifa: todas</option>
            {TARIFAS_ACCESO.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className={`${inputCls} !w-40`} value={fCia} onChange={(e) => setFCia(e.target.value)} placeholder="Comercializadora..." />
          <select className={selCls} value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
            <option value="">Estado: todos</option>
            {ESTADOS_CUPS.map((es) => <option key={es} value={es}>{ESTADO_CUPS_LABEL[es]}</option>)}
          </select>
          <select className={selCls} value={fResp} onChange={(e) => setFResp(e.target.value)}>
            <option value="">Responsable: todos</option>
            {responsables.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className={selCls} value={fPrioridad} onChange={(e) => setFPrioridad(e.target.value)}>
            <option value="">Prioridad: todas</option>
            {PRIORIDADES.map((p) => <option key={p} value={p}>Prioridad {p}</option>)}
          </select>
        </div>
        <div className="flex gap-1.5 flex-wrap text-xs">
          {[['', 'Todos'], ['sin_factura', 'Sin factura'], ['fin_contrato', '⚠️ Sin fin contrato'], ['responsable', '⚠️ Sin responsable'],
            ['permanencia_proxima', '🔒 Permanencia ≤60d'], ['preaviso_proximo', '⏰ Preaviso ≤30d'],
            ['pendiente_firma', '✒️ Pte. firma'], ['pendiente_activacion', '⚡ Pte. activación']].map(([v, n]) => (
            <button key={v} onClick={() => setFEspecial(v)} className={`px-2.5 py-1.5 rounded-lg font-semibold ${fEspecial === v ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}>{n}</button>
          ))}
        </div>
      </Card>

      {tareaPara && (
        <Card className="!p-4 border-accent/40">
          <p className="text-xs font-bold mb-2">Nueva tarea · {tareaPara.luz_clientes?.nombre} · {tareaPara.cups}</p>
          <div className="flex gap-2 flex-wrap">
            <input className={`${inputCls} flex-1 min-w-48`} value={tituloTarea} onChange={(e) => setTituloTarea(e.target.value)} placeholder="Qué hay que hacer..." autoFocus />
            <button onClick={crearTarea} className={btnPrimario}><Plus className="w-4 h-4" /> Crear</button>
            <button onClick={() => setTareaPara(null)} className={btnSecundario}>Cancelar</button>
          </div>
        </Card>
      )}

      <EstadoCarga cargando={cargando} error={error} faltaMigracion={faltaMigracion}
        vacio={!cargando && !error && filtrados.length === 0}
        textoVacio="Sin CUPS con este filtro." sqlFile="supabase_luz.sql" />

      {filtrados.length > 0 && (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
                <th className="px-3 py-3">Pr.</th>
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3">CUPS</th>
                <th className="px-3 py-3">Tarifa</th>
                <th className="px-3 py-3">Comercializadora</th>
                <th className="px-3 py-3 text-right">Consumo/año</th>
                <th className="px-3 py-3">Fin contrato</th>
                <th className="px-3 py-3">Permanencia</th>
                <th className="px-3 py-3">Preaviso</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Responsable</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id} className="border-b border-border/20 hover:bg-card/50 transition">
                  <td className="px-3 py-2"><BadgePrioridad prioridad={c.prioridad || c.luz_clientes?.prioridad} /></td>
                  <td className="px-3 py-2 font-semibold">
                    <Link href={`/gestor/luz/clientes/${c.cliente_id}`} className="hover:text-accent transition">{c.luz_clientes?.nombre || '—'}</Link>
                    {c.alias_suministro && <span className="block text-[10px] text-muted">{c.alias_suministro}</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted">{c.cups}</td>
                  <td className="px-3 py-2"><Badge>{c.tarifa_acceso}</Badge></td>
                  <td className="px-3 py-2 text-xs">{c.comercializadora_actual || '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">{fmtKwh(Number(c.consumo_anual_kwh))}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {c.fecha_fin_contrato
                      ? <><BadgeVencimiento fecha={c.fecha_fin_contrato} /><span className="block text-[10px] text-muted mt-0.5">{fmtFecha(c.fecha_fin_contrato)}</span></>
                      : <span className="text-amber-400 text-xs font-bold">SIN FECHA</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted whitespace-nowrap">
                    {c.tiene_permanencia ? (c.fecha_fin_permanencia ? fmtFecha(c.fecha_fin_permanencia) : 'sí') : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted whitespace-nowrap">{c.fecha_limite_preaviso ? fmtFecha(c.fecha_limite_preaviso) : '—'}</td>
                  <td className="px-3 py-2">
                    <select
                      value={c.estado_cups}
                      onChange={async (e) => { await guardarLuz('cups', 'PUT', { id: c.id, estado_cups: e.target.value }); recargar(); }}
                      className="rounded-md border border-border/40 bg-background/60 px-1.5 py-0.5 text-[11px] font-semibold max-w-32"
                    >
                      {ESTADOS_CUPS.map((es) => <option key={es} value={es}>{ESTADO_CUPS_LABEL[es]}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <SelectorResponsable valor={c.responsable} onCambio={async (v) => { await guardarLuz('cups', 'PUT', { id: c.id, responsable: v }); recargar(); }} />
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => setTareaPara(c)} className="text-xs text-muted hover:text-accent font-semibold whitespace-nowrap">
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

export default function CupsPage() {
  return (
    <Suspense fallback={<div className="text-muted text-sm py-8 text-center">Cargando...</div>}>
      <CupsContenido />
    </Suspense>
  );
}
