'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  LuzCliente, LuzCups, LuzFechaCritica, LuzOportunidad, LuzContrato, LuzComision, LuzTarea,
  PIPELINE_CERRADO, COMISION_PENDIENTE, CONTRATO_EN_CURSO, TAREAS_ABIERTAS,
  diasHasta, enVentanaAlertaLuz, fmtEur, fmtFecha,
} from '@/lib/luz';
import { Card, Kpi, BadgePrioridad, BadgeVencimiento, EstadoCarga, guardarLuz, useListaLuz } from './ui';
import { useState } from 'react';

interface Config { clave: string; valor: string }

export default function DashboardLuz() {
  const clientes = useListaLuz<LuzCliente>('clientes');
  const cups = useListaLuz<LuzCups>('cups');
  const fechas = useListaLuz<LuzFechaCritica>('fechas', { estado: 'pendiente' });
  const pipeline = useListaLuz<LuzOportunidad>('pipeline');
  const contratos = useListaLuz<LuzContrato>('contratos');
  const comisiones = useListaLuz<LuzComision>('comisiones');
  const tareas = useListaLuz<LuzTarea>('tareas');
  const config = useListaLuz<Config>('config');

  const [editObjetivo, setEditObjetivo] = useState(false);
  const [objetivoTmp, setObjetivoTmp] = useState('');

  const cargando = clientes.cargando || cups.cargando;
  const faltaMigracion = clientes.faltaMigracion;

  const m = useMemo(() => {
    const mesActual = new Date().toISOString().slice(0, 7);

    const cupsActivos = cups.datos.filter((c) => c.estado_cups === 'activado');
    const cupsPendientes = cups.datos.filter((c) => !['activado', 'perdido', 'no_viable'].includes(c.estado_cups));

    const pipeAbierto = pipeline.datos.filter((o) => !PIPELINE_CERRADO.includes(o.estado) && o.estado !== 'revisar_adelante');
    const ganadasMes = pipeline.datos.filter((o) => o.estado === 'ganado');
    const perdidasMes = pipeline.datos.filter((o) => o.estado === 'perdido');
    const comisionPipeline = pipeAbierto.reduce((s, o) => s + (Number(o.comision_potencial) || 0), 0);

    const conPendFirma = contratos.datos.filter((c) => ['enviado_cliente', 'pendiente_firma'].includes(c.estado_contrato));
    const conPendActivacion = contratos.datos.filter((c) => ['firmado', 'enviado_comercializadora', 'pendiente_validacion', 'pendiente_activacion'].includes(c.estado_contrato));
    const activadosMes = contratos.datos.filter((c) => c.fecha_activacion_real?.startsWith(mesActual));

    const comPendientes = comisiones.datos.filter((c) => COMISION_PENDIENTE.includes(c.estado_comision));
    const comCobrada = comisiones.datos.reduce((s, c) => s + (Number(c.importe_cobrado) || 0), 0);
    const comPendiente = comPendientes.reduce((s, c) => s + (Number(c.importe_previsto) || 0) - (Number(c.importe_cobrado) || 0), 0);
    const comPrevista = contratos.datos.length
      ? comisiones.datos.filter((c) => c.contrato_id).reduce((s, c) => s + (Number(c.importe_previsto) || 0), 0)
      : 0;

    const fcEn = (d: number) => fechas.datos.filter((f) => { const x = diasHasta(f.fecha); return x != null && x >= 0 && x <= d; }).length;

    const tareasVencidas = tareas.datos.filter((t) => TAREAS_ABIERTAS.includes(t.estado) && (diasHasta(t.fecha_limite) ?? 1) < 0);

    // ── Alertas (enlazadas al registro que las genera) ──
    const alertas: { texto: string; href: string; tono: 'rojo' | 'ambar' }[] = [];

    const clientesConTarea = new Set(tareas.datos.filter((t) => TAREAS_ABIERTAS.includes(t.estado)).map((t) => t.cliente_id));
    const cuentasASinAccion = clientes.datos.filter((c) => c.prioridad === 'A' && !c.proxima_accion && !clientesConTarea.has(c.id));
    if (cuentasASinAccion.length) alertas.push({ texto: `${cuentasASinAccion.length} cliente(s) A sin acción`, href: '/gestor/luz/clientes?prioridad=A', tono: 'rojo' });

    const fcCriticas = fechas.datos.filter((f) => enVentanaAlertaLuz(f.prioridad || f.luz_clientes?.prioridad || 'C', diasHasta(f.fecha)));
    if (fcCriticas.length) alertas.push({ texto: `${fcCriticas.length} fecha(s) crítica(s) en ventana de alerta`, href: '/gestor/luz/fechas', tono: 'rojo' });

    const pipeSinAccion = pipeAbierto.filter((o) => !o.proxima_accion);
    if (pipeSinAccion.length) alertas.push({ texto: `${pipeSinAccion.length} oportunidad(es) sin próxima acción`, href: '/gestor/luz/pipeline?alerta=sin_accion', tono: 'rojo' });

    const accionVencida = pipeAbierto.filter((o) => (diasHasta(o.fecha_proxima_accion) ?? 1) < 0);
    if (accionVencida.length) alertas.push({ texto: `${accionVencida.length} próxima(s) acción(es) vencida(s) en pipeline`, href: '/gestor/luz/pipeline?alerta=vencida', tono: 'ambar' });

    const diasSinFirma = parseInt(config.datos.find((c) => c.clave === 'dias_contrato_sin_firma')?.valor || '7');
    const sinFirma = conPendFirma.filter((c) => c.fecha_envio_contrato && (diasHasta(c.fecha_envio_contrato) ?? 0) <= -diasSinFirma);
    if (sinFirma.length) alertas.push({ texto: `${sinFirma.length} contrato(s) enviados sin firma hace más de ${diasSinFirma} días`, href: '/gestor/luz/contratos?estado_contrato=pendiente_firma', tono: 'rojo' });

    const activacionVencida = conPendActivacion.filter((c) => (diasHasta(c.fecha_activacion_prevista) ?? 1) < 0);
    if (activacionVencida.length) alertas.push({ texto: `${activacionVencida.length} activación(es) prevista(s) vencida(s)`, href: '/gestor/luz/contratos?estado_contrato=pendiente_activacion', tono: 'rojo' });

    const comVencidas = comPendientes.filter((c) => (diasHasta(c.fecha_prevista_cobro) ?? 1) < 0);
    if (comVencidas.length) alertas.push({ texto: `${comVencidas.length} comisión(es) pendientes con cobro vencido`, href: '/gestor/luz/comisiones?estado_comision=pendiente_cobro', tono: 'rojo' });

    const comParciales = comisiones.datos.filter((c) => c.estado_comision === 'cobrada_parcial');
    if (comParciales.length) alertas.push({ texto: `${comParciales.length} comisión(es) cobradas parcialmente (diferencia pendiente)`, href: '/gestor/luz/comisiones?estado_comision=cobrada_parcial', tono: 'ambar' });

    const cupsSinResp = cups.datos.filter((c) => !c.responsable);
    if (cupsSinResp.length) alertas.push({ texto: `${cupsSinResp.length} CUPS sin responsable`, href: '/gestor/luz/cups?incompletos=responsable', tono: 'ambar' });

    const cupsSinFin = cups.datos.filter((c) => !c.fecha_fin_contrato && !['perdido', 'no_viable'].includes(c.estado_cups));
    if (cupsSinFin.length) alertas.push({ texto: `${cupsSinFin.length} CUPS sin fecha fin de contrato`, href: '/gestor/luz/cups?incompletos=fin_contrato', tono: 'ambar' });

    if (tareasVencidas.length) alertas.push({ texto: `${tareasVencidas.length} tarea(s) fuera de plazo`, href: '/gestor/luz/tareas', tono: 'ambar' });

    const altoConsumoSinRevisar = cups.datos.filter((c) => Number(c.consumo_anual_kwh) > 100000 && ['sin_factura', 'factura_recibida', 'datos_incompletos'].includes(c.estado_cups));
    if (altoConsumoSinRevisar.length) alertas.push({ texto: `${altoConsumoSinRevisar.length} CUPS de alto consumo sin revisión`, href: '/gestor/luz/cups', tono: 'ambar' });

    return {
      cupsActivos, cupsPendientes, pipeAbierto, ganadasMes, perdidasMes, comisionPipeline,
      conPendFirma, conPendActivacion, activadosMes, comCobrada, comPendiente, comPrevista,
      fcEn, tareasVencidas, alertas, cuentasASinAccion,
    };
  }, [clientes.datos, cups.datos, fechas.datos, pipeline.datos, contratos.datos, comisiones.datos, tareas.datos, config.datos]);

  const objetivoComision = parseFloat(config.datos.find((c) => c.clave === 'objetivo_mensual_comision')?.valor || '0') || 0;
  const objetivoContratos = parseInt(config.datos.find((c) => c.clave === 'objetivo_mensual_contratos')?.valor || '0') || 0;

  async function guardarObjetivo() {
    await guardarLuz('config', 'PUT', { clave: 'objetivo_mensual_comision', valor: objetivoTmp });
    setEditObjetivo(false);
    config.recargar();
  }

  const proximasFechas = fechas.datos.filter((f) => (diasHasta(f.fecha) ?? -999) >= -15).slice(0, 8);

  return (
    <div className="space-y-5">
      <EstadoCarga cargando={cargando} error={clientes.error} faltaMigracion={faltaMigracion} vacio={false} textoVacio="" sqlFile="supabase_luz.sql" />

      {!cargando && !faltaMigracion && !clientes.error && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi valor={clientes.datos.length} etiqueta="Clientes energía" />
            <Kpi valor={`${cups.datos.length} · ${m.cupsActivos.length} activos`} etiqueta="CUPS totales · activos" color="text-emerald-400" />
            <Kpi valor={m.cupsPendientes.length} etiqueta="CUPS en gestión" color="text-secondary" />
            <Kpi valor={`${m.fcEn(30)} / ${m.fcEn(60)} / ${m.fcEn(90)} / ${m.fcEn(120)}`} etiqueta="Fechas críticas 30/60/90/120 d" color="text-amber-400" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi valor={`${m.pipeAbierto.length} · ${fmtEur(m.comisionPipeline)}`} etiqueta="Pipeline abierto · comisión potencial" color="text-secondary" />
            <Kpi valor={`${m.ganadasMes.length} / ${m.perdidasMes.length}`} etiqueta="Ganadas / perdidas" />
            <Kpi valor={`${m.conPendFirma.length} · ${m.conPendActivacion.length}`} etiqueta="Ctos. pte. firma · pte. activación" color={m.conPendFirma.length + m.conPendActivacion.length > 0 ? 'text-amber-400' : 'text-foreground'} />
            <Kpi valor={`${fmtEur(m.comCobrada)} · ${fmtEur(m.comPendiente)}`} etiqueta="Comisión cobrada · pendiente" color="text-emerald-400" />
          </div>

          {/* Objetivos */}
          <Card className="!p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
              <h3 className="font-bold text-sm">Objetivos del mes</h3>
              {!editObjetivo ? (
                <button onClick={() => { setObjetivoTmp(String(objetivoComision)); setEditObjetivo(true); }} className="text-xs font-semibold text-accent hover:underline">
                  Configurar
                </button>
              ) : (
                <span className="flex gap-2 items-center">
                  <input className="w-28 rounded-lg border border-border/40 bg-background/60 px-2 py-1 text-sm tabular-nums" value={objetivoTmp} onChange={(e) => setObjetivoTmp(e.target.value)} inputMode="decimal" />
                  <button onClick={guardarObjetivo} className="text-xs font-bold text-emerald-400">Guardar</button>
                </span>
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-4 text-xs text-muted">
              <p>Contratos activados este mes: <b className="text-foreground">{m.activadosMes.length}</b> de {objetivoContratos} objetivo</p>
              <p>Comisión cobrada vs objetivo mensual: <b className="text-foreground">{fmtEur(m.comCobrada)}</b> / {fmtEur(objetivoComision)}</p>
            </div>
          </Card>

          {/* Alertas — ¿dónde se está quedando parado el negocio? */}
          <Card>
            <h3 className="font-bold text-sm mb-3">🚨 Dónde se está parando el negocio ({m.alertas.length})</h3>
            {m.alertas.length === 0 ? (
              <p className="text-sm text-emerald-400">Sin alertas activas. 👌</p>
            ) : (
              <div className="space-y-1.5">
                {m.alertas.map((a, i) => (
                  <Link key={i} href={a.href} className={`flex items-center gap-2.5 p-2.5 rounded-lg text-sm font-semibold transition hover:translate-x-0.5 ${
                    a.tono === 'rojo' ? 'bg-red-500/10 text-red-400 border border-red-500/25' : 'bg-amber-500/10 text-amber-300 border border-amber-500/25'
                  }`}>
                    {a.tono === 'rojo' ? '🔴' : '🟠'} {a.texto} →
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <div className="grid lg:grid-cols-2 gap-5">
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm">Próximas fechas críticas</h3>
                <Link href="/gestor/luz/fechas" className="text-xs font-semibold text-accent hover:underline">Ver todas →</Link>
              </div>
              {proximasFechas.length === 0 ? (
                <p className="text-sm text-muted py-4 text-center">Sin fechas críticas. Importa CUPS o crea datos de prueba.</p>
              ) : (
                <div className="space-y-1.5">
                  {proximasFechas.map((f) => (
                    <Link key={f.id} href={`/gestor/luz/clientes/${f.cliente_id}`} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-card/60 hover:bg-card transition">
                      <div className="flex items-center gap-2 min-w-0">
                        <BadgePrioridad prioridad={f.prioridad || f.luz_clientes?.prioridad} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{f.titulo}</p>
                          <p className="text-[10px] text-muted">{fmtFecha(f.fecha)} · {f.responsable || 'Sin asignar'}</p>
                        </div>
                      </div>
                      <BadgeVencimiento fecha={f.fecha} />
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h3 className="font-bold text-sm mb-3">Accesos rápidos</h3>
              <div className="grid grid-cols-1 gap-1.5">
                {[
                  ['Oportunidades sin próxima acción', '/gestor/luz/pipeline?alerta=sin_accion'],
                  ['Contratos pendientes de firma', '/gestor/luz/contratos?estado_contrato=pendiente_firma'],
                  ['Contratos pendientes de activación', '/gestor/luz/contratos?estado_contrato=pendiente_activacion'],
                  ['Comisiones pendientes', '/gestor/luz/comisiones?pendientes=1'],
                  ['Fechas críticas ≤30 días', '/gestor/luz/fechas?dias=30'],
                  ['Clientes A/B', '/gestor/luz/clientes?prioridad=A'],
                  ['CUPS incompletos', '/gestor/luz/cups?incompletos=fin_contrato'],
                ].map(([n, href]) => (
                  <Link key={href} href={href} className="px-3 py-2 rounded-lg bg-card/70 border border-border/40 text-xs font-semibold text-muted hover:text-foreground hover:border-accent/40 transition">
                    {n} →
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
