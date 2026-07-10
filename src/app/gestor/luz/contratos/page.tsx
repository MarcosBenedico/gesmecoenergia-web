'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';
import {
  LuzContrato, ESTADOS_CONTRATO, ESTADO_CONTRATO_LABEL, CONTRATO_EN_CURSO,
  diasHasta, fmtFecha,
} from '@/lib/luz';
import { Card, Kpi, Badge, EstadoCarga, useListaLuz, guardarLuz, inputCls, btnSecundario, SelectorResponsable } from '../ui';

function ContratosContenido() {
  const sp = useSearchParams();
  const { datos, cargando, error, faltaMigracion, recargar } = useListaLuz<LuzContrato>('contratos');
  const [fEstado, setFEstado] = useState(sp.get('estado_contrato') || '');
  const [fEspecial, setFEspecial] = useState('');
  const [msg, setMsg] = useState('');

  const mesActual = new Date().toISOString().slice(0, 7);

  const filtrados = useMemo(() => datos.filter((c) => {
    if (fEstado && c.estado_contrato !== fEstado) return false;
    if (fEspecial === 'firmado_sin_enviar' && !(c.estado_contrato === 'firmado' && !c.fecha_envio_comercializadora)) return false;
    if (fEspecial === 'enviado_sin_validar' && !['enviado_comercializadora', 'pendiente_validacion'].includes(c.estado_contrato)) return false;
    if (fEspecial === 'retrasadas' && !(CONTRATO_EN_CURSO.includes(c.estado_contrato) && (diasHasta(c.fecha_activacion_prevista) ?? 1) < 0)) return false;
    if (fEspecial === 'incidencia' && c.estado_contrato !== 'incidencia' && !c.incidencia) return false;
    if (fEspecial === 'activados_mes' && !c.fecha_activacion_real?.startsWith(mesActual)) return false;
    if (fEspecial === 'rechazados' && c.estado_contrato !== 'rechazado') return false;
    return true;
  }), [datos, fEstado, fEspecial, mesActual]);

  const pendFirma = datos.filter((c) => ['enviado_cliente', 'pendiente_firma'].includes(c.estado_contrato));
  const pendActivacion = datos.filter((c) => ['firmado', 'enviado_comercializadora', 'pendiente_validacion', 'pendiente_activacion'].includes(c.estado_contrato));
  const activadosMes = datos.filter((c) => c.fecha_activacion_real?.startsWith(mesActual));

  async function cambiar(c: LuzContrato, campos: Record<string, unknown>) {
    // Rechazo exige motivo/incidencia
    if (campos.estado_contrato === 'rechazado' && !c.incidencia) {
      const motivo = prompt('Motivo del rechazo / incidencia (obligatorio):');
      if (!motivo?.trim()) return;
      campos.incidencia = motivo.trim();
    }
    const err = await guardarLuz('contratos', 'PUT', { id: c.id, ...campos });
    if (err) { setMsg(err); return; }
    setMsg(campos.estado_contrato === 'activado' ? '✓ Contrato activado — el CUPS pasa a "activado".' : '');
    recargar();
  }

  const selCls = 'rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 text-xs font-semibold';
  const FechaEditable = ({ c, campo }: { c: LuzContrato; campo: keyof LuzContrato }) => (
    <input
      type="date"
      className="rounded-md border border-border/40 bg-background/60 px-1 py-0.5 text-[10px] w-28"
      defaultValue={(c[campo] as string) || ''}
      onBlur={(e) => e.target.value !== ((c[campo] as string) || '') && cambiar(c, { [campo]: e.target.value || null })}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Contratos y Activaciones</h2>
          <p className="text-xs text-muted mt-0.5">Que ninguna venta se pierda después del sí: firma → envío → validación → activación.</p>
        </div>
        <a href={`/api/luz/exportar?tipo=contratos${fEstado ? `&estado_contrato=${fEstado}` : ''}`} className={btnSecundario} download>
          <Download className="w-4 h-4" /> Exportar
        </a>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi valor={pendFirma.length} etiqueta="Pendientes de firma" color={pendFirma.length ? 'text-amber-400' : 'text-foreground'} />
        <Kpi valor={pendActivacion.length} etiqueta="Pendientes de activación" color={pendActivacion.length ? 'text-amber-400' : 'text-foreground'} />
        <Kpi valor={activadosMes.length} etiqueta="Activados este mes" color="text-emerald-400" />
      </div>

      {msg && <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5">{msg}</p>}

      <Card className="!p-3 space-y-2.5">
        <div className="flex gap-2 flex-wrap">
          <select className={selCls} value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
            <option value="">Estado: todos</option>
            {ESTADOS_CONTRATO.map((es) => <option key={es} value={es}>{ESTADO_CONTRATO_LABEL[es]}</option>)}
          </select>
        </div>
        <div className="flex gap-1.5 flex-wrap text-xs">
          {[['', 'Todos'], ['firmado_sin_enviar', 'Firmado sin enviar'], ['enviado_sin_validar', 'Enviado sin validar'],
            ['retrasadas', '🔴 Activaciones retrasadas'], ['incidencia', '⚠️ Con incidencia'],
            ['activados_mes', '✓ Activados este mes'], ['rechazados', 'Rechazados']].map(([v, n]) => (
            <button key={v} onClick={() => setFEspecial(v)} className={`px-2.5 py-1.5 rounded-lg font-semibold ${fEspecial === v ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}>{n}</button>
          ))}
        </div>
      </Card>

      <EstadoCarga cargando={cargando} error={error} faltaMigracion={faltaMigracion}
        vacio={!cargando && !error && filtrados.length === 0}
        textoVacio="Sin contratos con este filtro. Se crean desde el Pipeline (ganado → contrato)." sqlFile="supabase_luz.sql" />

      {filtrados.length > 0 && (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
                <th className="px-3 py-3">Cliente</th><th className="px-3 py-3">CUPS</th>
                <th className="px-3 py-3">Comercializadora</th><th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">F. envío</th><th className="px-3 py-3">F. firma</th>
                <th className="px-3 py-3">Activación prevista</th><th className="px-3 py-3">Activación real</th>
                <th className="px-3 py-3">Responsable</th><th className="px-3 py-3">Incidencia</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const retrasada = CONTRATO_EN_CURSO.includes(c.estado_contrato) && (diasHasta(c.fecha_activacion_prevista) ?? 1) < 0;
                return (
                  <tr key={c.id} className={`border-b border-border/20 hover:bg-card/50 transition ${retrasada ? 'bg-red-500/5' : ''}`}>
                    <td className="px-3 py-2 font-semibold text-xs">
                      {c.cliente_id
                        ? <Link href={`/gestor/luz/clientes/${c.cliente_id}`} className="hover:text-accent">{c.luz_clientes?.nombre || '—'}</Link>
                        : (c.luz_clientes?.nombre || '—')}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted">{c.luz_cups?.cups || '—'}</td>
                    <td className="px-3 py-2 text-xs">{c.comercializadora_final || '—'}</td>
                    <td className="px-3 py-2">
                      <select value={c.estado_contrato} onChange={(e) => cambiar(c, { estado_contrato: e.target.value })}
                        className="rounded-md border border-border/40 bg-background/60 px-1.5 py-0.5 text-[11px] font-semibold max-w-36">
                        {ESTADOS_CONTRATO.map((es) => <option key={es} value={es}>{ESTADO_CONTRATO_LABEL[es]}</option>)}
                      </select>
                      {retrasada && <span className="block text-[10px] text-red-400 font-bold mt-0.5">⏰ retrasada</span>}
                    </td>
                    <td className="px-3 py-2"><FechaEditable c={c} campo="fecha_envio_contrato" /></td>
                    <td className="px-3 py-2"><FechaEditable c={c} campo="fecha_firma" /></td>
                    <td className="px-3 py-2"><FechaEditable c={c} campo="fecha_activacion_prevista" /></td>
                    <td className="px-3 py-2">
                      {c.fecha_activacion_real
                        ? <Badge tono="verde">{fmtFecha(c.fecha_activacion_real)}</Badge>
                        : <FechaEditable c={c} campo="fecha_activacion_real" />}
                    </td>
                    <td className="px-3 py-2">
                      <SelectorResponsable valor={c.responsable} onCambio={(v) => cambiar(c, { responsable: v })} />
                    </td>
                    <td className="px-3 py-2 text-xs text-red-400 max-w-40 truncate">{c.incidencia || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

export default function ContratosPage() {
  return (
    <Suspense fallback={<div className="text-muted text-sm py-8 text-center">Cargando...</div>}>
      <ContratosContenido />
    </Suspense>
  );
}
