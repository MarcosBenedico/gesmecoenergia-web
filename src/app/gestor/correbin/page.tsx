'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  VctPoliza, VctVencimiento, VctTarea, VctOportunidad, VctProduccion, VctAnulacion,
  VctCambioMediador, VctCliente,
  diasHasta, fmtEur0, fmtFecha, ESTADOS_CARTERA_VIVA, PRODUCCION_REAL, ANULACION_RESTA_CARTERA,
  PIPELINE_CERRADO, TAREAS_ABIERTAS, VCT_CERRADOS, ETAPA_LABEL, enVentanaAlerta,
} from '@/lib/correbin';
import { Card, Kpi, Badge, BadgePrioridad, BadgeVencimiento, EstadoCarga, useLista, guardar } from './ui';

interface Config { clave: string; valor: string }

export default function DashboardCorrebin() {
  const anio = new Date().getFullYear();
  const polizas = useLista<VctPoliza>('polizas');
  const vencimientos = useLista<VctVencimiento>('vencimientos');
  const tareas = useLista<VctTarea>('tareas');
  const oportunidades = useLista<VctOportunidad>('oportunidades');
  const produccion = useLista<VctProduccion>('produccion', { desde: `${anio}-01-01` });
  const anulaciones = useLista<VctAnulacion>('anulaciones', { desde: `${anio}-01-01` });
  const mediador = useLista<VctCambioMediador>('cambios_mediador');
  const clientes = useLista<VctCliente>('clientes');
  const config = useLista<Config>('config');

  const [editandoObjetivo, setEditandoObjetivo] = useState(false);
  const [objetivoTmp, setObjetivoTmp] = useState('');

  const cargando = polizas.cargando || vencimientos.cargando;
  const faltaMigracion = polizas.faltaMigracion || vencimientos.faltaMigracion;

  const m = useMemo(() => {
    const vivas = polizas.datos.filter((p) => ESTADOS_CARTERA_VIVA.includes(p.estado));
    const carteraTotal = vivas.reduce((s, p) => s + (Number(p.prima_anual) || 0), 0);

    const prodReal = produccion.datos.filter((p) => PRODUCCION_REAL.includes(p.tipo_produccion));
    const prodTecnica = produccion.datos.filter((p) => !PRODUCCION_REAL.includes(p.tipo_produccion));
    const primaProdReal = prodReal.reduce((s, p) => s + (Number(p.prima) || 0), 0);

    const anulReales = anulaciones.datos.filter((a) => ANULACION_RESTA_CARTERA.includes(a.tipo_anulacion));
    const anulTecnicas = anulaciones.datos.filter((a) => !ANULACION_RESTA_CARTERA.includes(a.tipo_anulacion));
    const primaAnulReal = anulReales.reduce((s, a) => s + (Number(a.prima) || 0), 0);

    const cmIncorporado = mediador.datos.filter((c) => c.estado === 'incorporado');
    const cmPendiente = mediador.datos.filter((c) => !['incorporado', 'rechazado'].includes(c.estado));
    const primaCmIn = cmIncorporado.reduce((s, c) => s + (Number(c.prima) || 0), 0);
    const primaCmPend = cmPendiente.reduce((s, c) => s + (Number(c.prima) || 0), 0);

    const pipeAbierto = oportunidades.datos.filter((o) => !PIPELINE_CERRADO.includes(o.etapa));
    const primaPipe = pipeAbierto.reduce((s, o) => s + (Number(o.prima_estimada) || 0), 0);
    const primaPipePonderada = pipeAbierto.reduce((s, o) => s + (Number(o.prima_estimada) || 0) * ((o.probabilidad ?? 50) / 100), 0);

    const vctAbiertos = vencimientos.datos.filter((v) => !VCT_CERRADOS.includes(v.estado_vencimiento));
    const vctEn = (d: number) => vctAbiertos.filter((v) => { const x = diasHasta(v.fecha_vct); return x != null && x >= 0 && x <= d; }).length;

    // ── Alertas ──
    const alertas: { texto: string; href: string; tono: 'rojo' | 'ambar' }[] = [];

    const vctCriticos = vctAbiertos.filter((v) => {
      const d = diasHasta(v.fecha_vct);
      return v.estado_vencimiento === 'pendiente_revisar' && enVentanaAlerta(v.segmento, d);
    });
    if (vctCriticos.length) alertas.push({ texto: `${vctCriticos.length} vencimiento(s) en ventana de alerta sin revisar`, href: '/gestor/correbin/calendario', tono: 'rojo' });

    const vctVencidos = vctAbiertos.filter((v) => (diasHasta(v.fecha_vct) ?? 1) < 0);
    if (vctVencidos.length) alertas.push({ texto: `${vctVencidos.length} vencimiento(s) ya pasados sin cerrar`, href: '/gestor/correbin/calendario', tono: 'rojo' });

    const tareasAbiertas = tareas.datos.filter((t) => TAREAS_ABIERTAS.includes(t.estado) || t.estado === 'pendiente');
    const clientesConTarea = new Set(tareasAbiertas.map((t) => t.cliente_id));
    const clientesConAccion = new Set(vctAbiertos.filter((v) => v.proxima_accion).map((v) => v.cliente_id));
    const cuentasASinAccion = clientes.datos.filter((c) => c.prioridad === 'A' && !clientesConTarea.has(c.id) && !clientesConAccion.has(c.id));
    if (cuentasASinAccion.length) alertas.push({ texto: `${cuentasASinAccion.length} cuenta(s) A sin ninguna acción abierta`, href: '/gestor/correbin/clientes?prioridad=A', tono: 'rojo' });

    const pipeSinAccion = pipeAbierto.filter((o) => !o.proxima_accion);
    if (pipeSinAccion.length) alertas.push({ texto: `${pipeSinAccion.length} oportunidad(es) sin próxima acción`, href: '/gestor/correbin/pipeline', tono: 'ambar' });

    const sinPrima = vivas.filter((p) => !Number(p.prima_anual));
    if (sinPrima.length) alertas.push({ texto: `${sinPrima.length} póliza(s) sin prima`, href: '/gestor/correbin/cartera?incompletas=prima', tono: 'ambar' });

    const sinVcto = vivas.filter((p) => !p.fecha_vencimiento);
    if (sinVcto.length) alertas.push({ texto: `${sinVcto.length} póliza(s) sin vencimiento`, href: '/gestor/correbin/cartera?incompletas=vencimiento', tono: 'ambar' });

    const anulSinMotivo = anulaciones.datos.filter((a) => !a.motivo);
    if (anulSinMotivo.length) alertas.push({ texto: `${anulSinMotivo.length} anulación(es) sin motivo`, href: '/gestor/correbin/anulaciones', tono: 'ambar' });

    const cmParado = cmPendiente.filter((c) => c.estado === 'detectado');
    if (cmParado.length) alertas.push({ texto: `${cmParado.length} cambio(s) de mediador sin avanzar (solo detectado)`, href: '/gestor/correbin/mediador', tono: 'ambar' });

    const clientesSinResp = clientes.datos.filter((c) => !c.responsable);
    if (clientesSinResp.length) alertas.push({ texto: `${clientesSinResp.length} cliente(s) sin responsable`, href: '/gestor/correbin/clientes', tono: 'ambar' });

    const vctSinTarea = vctAbiertos.filter((v) => {
      const d = diasHasta(v.fecha_vct);
      return d != null && d >= 0 && d <= 30 && !tareasAbiertas.some((t) => t.vencimiento_id === v.id || t.cliente_id === v.cliente_id);
    });
    if (vctSinTarea.length) alertas.push({ texto: `${vctSinTarea.length} vencimiento(s) a ≤30 días sin tarea asociada`, href: '/gestor/correbin/tareas', tono: 'ambar' });

    return {
      vivas, carteraTotal, prodReal, prodTecnica, primaProdReal,
      anulReales, anulTecnicas, primaAnulReal, primaCmIn, primaCmPend,
      pipeAbierto, primaPipe, primaPipePonderada, vctAbiertos, vctEn,
      alertas, cuentasASinAccion, pipeSinAccion, tareasAbiertas,
    };
  }, [polizas.datos, vencimientos.datos, tareas.datos, oportunidades.datos, produccion.datos, anulaciones.datos, mediador.datos, clientes.datos]);

  const objetivo = parseFloat(config.datos.find((c) => c.clave === 'objetivo_anual_produccion')?.valor || '0') || 0;
  const pctObjetivo = objetivo > 0 ? Math.min(100, (m.primaProdReal / objetivo) * 100) : 0;

  async function guardarObjetivo() {
    const v = parseFloat(objetivoTmp.replace(',', '.')) || 0;
    await guardar('config', 'PUT', { clave: 'objetivo_anual_produccion', valor: String(v) });
    setEditandoObjetivo(false);
    config.recargar();
  }

  const proximos = m.vctAbiertos
    ? [...m.vctAbiertos].filter((v) => (diasHasta(v.fecha_vct) ?? -999) >= -30).slice(0, 8)
    : [];

  return (
    <div className="space-y-5">
      <EstadoCarga cargando={cargando} error={polizas.error} faltaMigracion={faltaMigracion} vacio={false} textoVacio="" />

      {!cargando && !faltaMigracion && !polizas.error && (
        <>
          {/* Fila 1: cartera y producción */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi valor={fmtEur0(m.carteraTotal)} etiqueta={`Cartera viva (${m.vivas.length} pólizas)`} color="text-emerald-400" />
            <Kpi valor={fmtEur0(m.primaProdReal)} etiqueta={`Producción real ${anio} (${m.prodReal.length})`} color="text-secondary" />
            <Kpi valor={`${m.prodTecnica.length}`} etiqueta="Movimientos técnicos (no suman)" />
            <Kpi valor={fmtEur0(m.primaAnulReal)} etiqueta={`Anulación real ${anio} (${m.anulReales.length}) · técnicas: ${m.anulTecnicas.length}`} color={m.primaAnulReal > 0 ? 'text-red-400' : 'text-foreground'} />
          </div>

          {/* Fila 2: mediador, pipeline, VCT */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi valor={fmtEur0(m.primaCmIn)} etiqueta="Mediador: prima incorporada" color="text-emerald-400" />
            <Kpi valor={fmtEur0(m.primaCmPend)} etiqueta="Mediador: pendiente de entrar" color="text-amber-400" />
            <Kpi valor={`${fmtEur0(m.primaPipe)}`} etiqueta={`Pipeline abierto (${m.pipeAbierto.length}) · ponderado ${fmtEur0(m.primaPipePonderada)}`} color="text-secondary" />
            <Kpi valor={`${m.vctEn(30)} / ${m.vctEn(60)} / ${m.vctEn(90)} / ${m.vctEn(120)}`} etiqueta="VCT en 30 / 60 / 90 / 120 días" color="text-amber-400" />
          </div>

          {/* Objetivo anual */}
          <Card className="!p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
              <h3 className="font-bold text-sm">Objetivo anual de producción nueva · {anio}</h3>
              {!editandoObjetivo ? (
                <button
                  onClick={() => { setObjetivoTmp(String(objetivo)); setEditandoObjetivo(true); }}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  Configurar objetivo ({fmtEur0(objetivo)})
                </button>
              ) : (
                <span className="flex gap-2 items-center">
                  <input
                    className="w-32 rounded-lg border border-border/40 bg-background/60 px-2 py-1 text-sm tabular-nums"
                    value={objetivoTmp}
                    onChange={(e) => setObjetivoTmp(e.target.value)}
                    inputMode="decimal"
                  />
                  <button onClick={guardarObjetivo} className="text-xs font-bold text-emerald-400">Guardar</button>
                </span>
              )}
            </div>
            <div className="h-3 rounded-full bg-card/80 overflow-hidden border border-border/30">
              <div className="h-full bg-gradient-to-r from-accent to-emerald-500 transition-all" style={{ width: `${pctObjetivo}%` }} />
            </div>
            <p className="text-xs text-muted mt-1.5">
              {fmtEur0(m.primaProdReal)} de {fmtEur0(objetivo)} ({pctObjetivo.toFixed(0)} %) ·
              faltan <b className="text-foreground">{fmtEur0(Math.max(0, objetivo - m.primaProdReal))}</b> para el objetivo
            </p>
          </Card>

          {/* Alertas */}
          <Card>
            <h3 className="font-bold text-sm mb-3">🚨 Alertas ({m.alertas.length})</h3>
            {m.alertas.length === 0 ? (
              <p className="text-sm text-emerald-400">Todo en orden: sin alertas activas. 👌</p>
            ) : (
              <div className="space-y-1.5">
                {m.alertas.map((a, i) => (
                  <Link
                    key={i}
                    href={a.href}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg text-sm font-semibold transition hover:translate-x-0.5 ${
                      a.tono === 'rojo'
                        ? 'bg-red-500/10 text-red-400 border border-red-500/25'
                        : 'bg-amber-500/10 text-amber-300 border border-amber-500/25'
                    }`}
                  >
                    {a.tono === 'rojo' ? '🔴' : '🟠'} {a.texto} →
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <div className="grid lg:grid-cols-2 gap-5">
            {/* Próximos vencimientos */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm">Próximos vencimientos</h3>
                <Link href="/gestor/correbin/calendario" className="text-xs font-semibold text-accent hover:underline">Calendario →</Link>
              </div>
              {proximos.length === 0 ? (
                <p className="text-sm text-muted py-4 text-center">Sin vencimientos. Importa la cartera o crea datos de prueba en Exportaciones.</p>
              ) : (
                <div className="space-y-1.5">
                  {proximos.map((v) => (
                    <Link key={v.id} href={`/gestor/correbin/clientes/${v.cliente_id}`} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-card/60 hover:bg-card transition">
                      <div className="min-w-0 flex items-center gap-2">
                        <BadgePrioridad prioridad={v.vct_clientes?.prioridad} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{v.titulo_evento}</p>
                          <p className="text-[10px] text-muted">{fmtFecha(v.fecha_vct)} · {v.responsable || 'Sin asignar'}</p>
                        </div>
                      </div>
                      <BadgeVencimiento fecha={v.fecha_vct} />
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            {/* Pipeline + producción */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm">Pipeline por estado</h3>
                <Link href="/gestor/correbin/pipeline" className="text-xs font-semibold text-accent hover:underline">Pipeline →</Link>
              </div>
              {m.pipeAbierto.length === 0 ? (
                <p className="text-sm text-muted py-4 text-center">Sin oportunidades abiertas.</p>
              ) : (
                <div className="space-y-1.5">
                  {Object.entries(
                    m.pipeAbierto.reduce<Record<string, { n: number; prima: number }>>((acc, o) => {
                      acc[o.etapa] = { n: (acc[o.etapa]?.n || 0) + 1, prima: (acc[o.etapa]?.prima || 0) + (Number(o.prima_estimada) || 0) };
                      return acc;
                    }, {})
                  ).map(([etapa, v]) => (
                    <div key={etapa} className="flex items-center justify-between p-2.5 rounded-lg bg-card/60 text-sm">
                      <span className="font-semibold">{ETAPA_LABEL[etapa] || etapa}</span>
                      <span className="text-muted text-xs">{v.n} · <b className="text-secondary">{fmtEur0(v.prima)}</b></span>
                    </div>
                  ))}
                  {m.pipeSinAccion.length > 0 && (
                    <p className="text-[11px] text-amber-400 pt-1">⚠️ {m.pipeSinAccion.length} sin próxima acción</p>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* Accesos rápidos */}
          <div className="flex gap-2 flex-wrap">
            {[
              ['Cartera viva', '/gestor/correbin/cartera'],
              ['VCT ≤30 días', '/gestor/correbin/cartera?dias=30'],
              ['Pólizas incompletas', '/gestor/correbin/cartera?incompletas=prima'],
              ['Cuentas A', '/gestor/correbin/clientes?prioridad=A'],
              ['Tareas', '/gestor/correbin/tareas'],
              ['Importar Excel', '/gestor/correbin/importar'],
            ].map(([nombre, href]) => (
              <Link key={href} href={href} className="px-3 py-1.5 rounded-lg bg-card/80 border border-border/50 text-xs font-semibold text-muted hover:text-foreground hover:border-accent/40 transition">
                {nombre} →
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
