'use client';

import Link from 'next/link';
import { VctPoliza, VctTarea, VctOportunidad, VctMovimiento, diasHasta, fmtEur, fmtFecha, RAMO_LABEL } from '@/lib/correbin';
import { Card, Kpi, BadgeVencimiento, Badge, EstadoCarga, useLista } from './ui';

export default function DashboardCorrebin() {
  const polizas = useLista<VctPoliza>('polizas', { estado: 'viva' });
  const tareas = useLista<VctTarea>('tareas', { estado: 'pendiente' });
  const oportunidades = useLista<VctOportunidad>('oportunidades');
  const movimientos = useLista<VctMovimiento>('movimientos');

  const cargando = polizas.cargando || tareas.cargando;
  const faltaMigracion = polizas.faltaMigracion;

  // KPIs
  const primaTotal = polizas.datos.reduce((s, p) => s + (Number(p.prima_anual) || 0), 0);
  const vencen30 = polizas.datos.filter((p) => { const d = diasHasta(p.fecha_vencimiento); return d != null && d >= 0 && d <= 30; });
  const vencen60 = polizas.datos.filter((p) => { const d = diasHasta(p.fecha_vencimiento); return d != null && d >= 0 && d <= 60; });
  const vencidasSinGestionar = polizas.datos.filter((p) => { const d = diasHasta(p.fecha_vencimiento); return d != null && d < 0; });
  const tareasVencidas = tareas.datos.filter((t) => { const d = diasHasta(t.fecha_limite); return d != null && d < 0; });
  const pipelineAbierto = oportunidades.datos.filter((o) => !['ganada', 'perdida'].includes(o.etapa));

  const inicioMes = new Date();
  inicioMes.setDate(1);
  const produccionMes = movimientos.datos.filter(
    (m) => m.tipo === 'produccion' && new Date(m.fecha) >= inicioMes
  );
  const primaProduccionMes = produccionMes.reduce((s, m) => s + (Number(m.prima) || 0), 0);
  const anulacionesMes = movimientos.datos.filter(
    (m) => m.tipo === 'anulacion' && new Date(m.fecha) >= inicioMes
  );

  const proximosVencimientos = [...polizas.datos]
    .filter((p) => { const d = diasHasta(p.fecha_vencimiento); return d != null && d >= -30; })
    .slice(0, 10);

  const tareasUrgentes = [...tareas.datos]
    .sort((a, b) => (a.fecha_limite || '9999').localeCompare(b.fecha_limite || '9999'))
    .slice(0, 8);

  return (
    <div className="space-y-5">
      <EstadoCarga
        cargando={cargando}
        error={polizas.error}
        faltaMigracion={faltaMigracion}
        vacio={false}
        textoVacio=""
      />

      {!cargando && !faltaMigracion && !polizas.error && (
        <>
          {/* KPIs principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi valor={polizas.datos.length} etiqueta="Pólizas vivas" />
            <Kpi valor={fmtEur(primaTotal)} etiqueta="Prima anual cartera" color="text-emerald-400" />
            <Kpi valor={vencen30.length} etiqueta="Vencen en 30 días" color={vencen30.length > 0 ? 'text-amber-400' : 'text-foreground'} />
            <Kpi valor={vencen60.length} etiqueta="Vencen en 60 días" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi valor={vencidasSinGestionar.length} etiqueta="Vencidas sin gestionar" color={vencidasSinGestionar.length > 0 ? 'text-red-400' : 'text-emerald-400'} />
            <Kpi valor={tareas.datos.length} etiqueta="Tareas pendientes" color={tareasVencidas.length > 0 ? 'text-red-400' : 'text-foreground'} />
            <Kpi valor={pipelineAbierto.length} etiqueta="Oportunidades abiertas" color="text-secondary" />
            <Kpi valor={`${produccionMes.length} · ${fmtEur(primaProduccionMes)}`} etiqueta="Producción este mes" color="text-emerald-400" />
          </div>

          {anulacionesMes.length > 0 && (
            <Card className="!p-4 border-red-500/30">
              <p className="text-sm text-red-400 font-semibold">
                ⚠️ {anulacionesMes.length} anulación(es) real(es) este mes — revisa los motivos en{' '}
                <Link href="/gestor/correbin/anulaciones" className="underline">Anulaciones</Link>.
              </p>
            </Card>
          )}

          <div className="grid lg:grid-cols-2 gap-5">
            {/* Próximos vencimientos */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-foreground">Próximos vencimientos</h2>
                <Link href="/gestor/correbin/cartera" className="text-xs font-semibold text-accent hover:underline">
                  Ver cartera →
                </Link>
              </div>
              {proximosVencimientos.length === 0 ? (
                <p className="text-sm text-muted py-4 text-center">Sin vencimientos próximos. Importa tu cartera para empezar.</p>
              ) : (
                <div className="space-y-2">
                  {proximosVencimientos.map((p) => (
                    <Link
                      key={p.id}
                      href={`/gestor/correbin/clientes/${p.cliente_id}`}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-card/60 hover:bg-card transition"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{p.vct_clientes?.nombre || '—'}</p>
                        <p className="text-[11px] text-muted truncate">
                          {RAMO_LABEL[p.ramo] || p.ramo} · {p.compania} · {fmtEur(Number(p.prima_anual))}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <BadgeVencimiento fecha={p.fecha_vencimiento} />
                        <p className="text-[10px] text-muted mt-1">{fmtFecha(p.fecha_vencimiento)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            {/* Tareas urgentes */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-foreground">Tareas pendientes</h2>
                <Link href="/gestor/correbin/tareas" className="text-xs font-semibold text-accent hover:underline">
                  Ver todas →
                </Link>
              </div>
              {tareasUrgentes.length === 0 ? (
                <p className="text-sm text-muted py-4 text-center">Sin tareas pendientes. 👌</p>
              ) : (
                <div className="space-y-2">
                  {tareasUrgentes.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-card/60">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{t.titulo}</p>
                        <p className="text-[11px] text-muted truncate">
                          {t.vct_clientes?.nombre || 'Sin cliente'}{t.responsable ? ` · ${t.responsable}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {t.prioridad === 'alta' && <Badge tono="rojo">alta</Badge>}
                        <BadgeVencimiento fecha={t.fecha_limite} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
