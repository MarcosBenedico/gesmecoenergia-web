'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Sun, CheckCircle2, AlertTriangle, CalendarClock, Target, FileSignature, Phone } from 'lucide-react';
import {
  LuzCliente, LuzCups, LuzFechaCritica, LuzOportunidad, LuzContrato, LuzTarea,
  PIPELINE_CERRADO, TAREAS_ABIERTAS, TIPO_FECHA_LABEL, ESTADO_PIPELINE_LABEL,
  diasHasta, fmtFecha,
} from '@/lib/luz';
import { fmtEur0 } from '@/lib/correbin';
import { useUsuario } from '@/lib/usuario';
import { Card, Kpi, BadgePrioridad, BadgeVencimiento, EstadoCarga, useListaLuz, guardarLuz, SelectorResponsable } from '../ui';

/**
 * Mi Día: la cola de trabajo personal de cada comercial.
 * - Usuario con responsable vinculado → ve SU trabajo directamente.
 * - Admin → selector para ver el día de cualquier miembro del equipo.
 * Prioriza: fuera de plazo → hoy → esta semana → sin próxima acción.
 */

/** ¿El texto de responsable incluye a esta persona? (soporta combos "A / B") */
function esDe(responsable: string | null | undefined, nombre: string): boolean {
  if (!responsable || !nombre) return false;
  const n = nombre.trim().toLowerCase();
  return responsable.toLowerCase().split('/').map((s) => s.trim()).includes(n)
    || responsable.trim().toLowerCase() === n;
}

export default function MiDiaPage() {
  const { perfil, cargando: cargandoPerfil, esAdmin } = useUsuario();
  const [verComo, setVerComo] = useState<string | null>(null);

  const clientes = useListaLuz<LuzCliente>('clientes');
  const cups = useListaLuz<LuzCups>('cups');
  const fechas = useListaLuz<LuzFechaCritica>('fechas', { estado: 'pendiente' });
  const pipeline = useListaLuz<LuzOportunidad>('pipeline');
  const contratos = useListaLuz<LuzContrato>('contratos');
  const tareas = useListaLuz<LuzTarea>('tareas');

  // Persona cuyo día se muestra: la vinculada al perfil, o la elegida por el admin
  const persona = verComo ?? perfil?.responsable ?? null;

  const cargando = cargandoPerfil || tareas.cargando || fechas.cargando;

  const dia = useMemo(() => {
    if (!persona) return null;
    const mias = <T extends { responsable?: string | null }>(lista: T[]) => lista.filter((x) => esDe(x.responsable, persona));

    const misTareas = mias(tareas.datos).filter((t) => TAREAS_ABIERTAS.includes(t.estado));
    const tVencidas = misTareas.filter((t) => (diasHasta(t.fecha_limite) ?? 1) < 0);
    const tHoy = misTareas.filter((t) => diasHasta(t.fecha_limite) === 0);
    const tSemana = misTareas.filter((t) => { const d = diasHasta(t.fecha_limite); return d != null && d > 0 && d <= 7; });
    const tSinFecha = misTareas.filter((t) => !t.fecha_limite);

    const misFechas = mias(fechas.datos)
      .filter((f) => { const d = diasHasta(f.fecha); return d != null && d >= -15 && d <= 30; })
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));

    const miPipe = mias(pipeline.datos).filter((o) => !PIPELINE_CERRADO.includes(o.estado) && o.estado !== 'revisar_adelante');
    const pipeSinAccion = miPipe.filter((o) => !o.proxima_accion);
    const pipeAccionVencida = miPipe.filter((o) => o.proxima_accion && (diasHasta(o.fecha_proxima_accion) ?? 1) < 0);

    const misContratos = mias(contratos.datos).filter((c) => ['enviado_cliente', 'pendiente_firma', 'firmado', 'enviado_comercializadora', 'pendiente_validacion', 'pendiente_activacion'].includes(c.estado_contrato));

    const misClientesA = clientes.datos.filter((c) => esDe(c.responsable, persona) && c.prioridad === 'A' && !c.proxima_accion);

    const comisionEnJuego = miPipe.reduce((s, o) => s + (Number(o.comision_potencial) || 0), 0);

    return { tVencidas, tHoy, tSemana, tSinFecha, misFechas, miPipe, pipeSinAccion, pipeAccionVencida, misContratos, misClientesA, comisionEnJuego };
  }, [persona, tareas.datos, fechas.datos, pipeline.datos, contratos.datos, clientes.datos]);

  async function completarTarea(t: LuzTarea) {
    await guardarLuz('tareas', 'PUT', { id: t.id, estado: 'completada', hecho_en: new Date().toISOString() });
    tareas.recargar();
  }

  const nombreCliente = (id: string | null | undefined) =>
    clientes.datos.find((c) => c.id === id)?.nombre || '';

  const FilaTarea = ({ t }: { t: LuzTarea }) => (
    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-card/50 border border-border/20">
      <input type="checkbox" onChange={() => completarTarea(t)} className="accent-[#22c55e] w-4 h-4 shrink-0" title="Marcar como completada" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold truncate">{t.descripcion || t.tipo_tarea}</p>
        {t.cliente_id && (
          <Link href={`/gestor/luz/clientes/${t.cliente_id}`} className="text-[11px] text-muted hover:text-accent truncate block">
            {nombreCliente(t.cliente_id) || 'Ver cliente'}
          </Link>
        )}
      </div>
      <BadgeVencimiento fecha={t.fecha_limite} />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <Sun className="w-5 h-5 text-amber-400" /> Mi Día
          </h2>
          <p className="text-xs text-muted mt-0.5">
            {persona ? `Trabajo de ${persona} · ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}` : 'Tu cola de trabajo personal'}
          </p>
        </div>
        {esAdmin && !cargandoPerfil && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase text-muted">Ver el día de:</span>
            <SelectorResponsable
              valor={persona}
              onCambio={(v) => setVerComo(v)}
              className="rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 text-xs font-semibold"
            />
          </div>
        )}
      </div>

      <EstadoCarga cargando={cargando} error={tareas.error} faltaMigracion={tareas.faltaMigracion} vacio={false} textoVacio="" sqlFile="supabase_luz.sql" />

      {!cargando && !persona && (
        <Card className="text-center py-10 space-y-2">
          <AlertTriangle className="w-8 h-8 mx-auto text-amber-400" />
          <p className="text-sm font-bold">Tu usuario no tiene un responsable comercial vinculado.</p>
          <p className="text-xs text-muted">
            Un administrador debe asignarte en Usuarios y Permisos → tu usuario → &quot;Responsable comercial vinculado&quot;.
          </p>
        </Card>
      )}

      {!cargando && persona && dia && (
        <>
          {/* Resumen del día */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Kpi valor={dia.tVencidas.length} etiqueta="Fuera de plazo" color={dia.tVencidas.length ? 'text-red-400' : 'text-emerald-400'} />
            <Kpi valor={dia.tHoy.length} etiqueta="Para hoy" color={dia.tHoy.length ? 'text-amber-300' : 'text-foreground'} />
            <Kpi valor={dia.misFechas.length} etiqueta="Fechas críticas 30d" />
            <Kpi valor={dia.miPipe.length} etiqueta="Oportunidades abiertas" />
            <Kpi valor={fmtEur0(dia.comisionEnJuego)} etiqueta="Comisión en juego" color="text-secondary" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Columna 1: tareas por urgencia */}
            <Card className="space-y-3">
              <h3 className="font-bold text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-accent" /> Tareas</h3>
              {dia.tVencidas.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase text-red-400">Fuera de plazo — primero esto</p>
                  {dia.tVencidas.map((t) => <FilaTarea key={t.id} t={t} />)}
                </div>
              )}
              {dia.tHoy.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase text-amber-300">Para hoy</p>
                  {dia.tHoy.map((t) => <FilaTarea key={t.id} t={t} />)}
                </div>
              )}
              {dia.tSemana.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase text-muted">Esta semana</p>
                  {dia.tSemana.map((t) => <FilaTarea key={t.id} t={t} />)}
                </div>
              )}
              {dia.tSinFecha.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase text-muted/70">Sin fecha límite</p>
                  {dia.tSinFecha.slice(0, 5).map((t) => <FilaTarea key={t.id} t={t} />)}
                </div>
              )}
              {dia.tVencidas.length + dia.tHoy.length + dia.tSemana.length + dia.tSinFecha.length === 0 && (
                <p className="text-sm text-muted text-center py-4">Sin tareas abiertas. 🎉</p>
              )}
              <Link href="/gestor/luz/tareas" className="block text-right text-xs font-semibold text-accent hover:text-accent-light">
                Todas las tareas →
              </Link>
            </Card>

            {/* Columna 2: fechas críticas + pipeline + contratos */}
            <div className="space-y-4">
              <Card className="space-y-2">
                <h3 className="font-bold text-sm flex items-center gap-2"><CalendarClock className="w-4 h-4 text-secondary" /> Fechas críticas (próximos 30 días)</h3>
                {dia.misFechas.length === 0 && <p className="text-xs text-muted text-center py-2">Ninguna en ventana. 👌</p>}
                {dia.misFechas.slice(0, 8).map((f) => (
                  <Link key={f.id} href={f.cliente_id ? `/gestor/luz/clientes/${f.cliente_id}` : '/gestor/luz/fechas'}
                    className="flex items-center gap-2.5 p-2 rounded-lg bg-card/50 border border-border/20 hover:border-secondary/40 transition">
                    <BadgePrioridad prioridad={f.prioridad || f.luz_clientes?.prioridad} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{f.titulo || TIPO_FECHA_LABEL[f.tipo_fecha] || f.tipo_fecha}</p>
                      <p className="text-[11px] text-muted truncate">{f.luz_clientes?.nombre || nombreCliente(f.cliente_id)}</p>
                    </div>
                    <BadgeVencimiento fecha={f.fecha} />
                  </Link>
                ))}
              </Card>

              <Card className="space-y-2">
                <h3 className="font-bold text-sm flex items-center gap-2"><Target className="w-4 h-4 text-accent" /> Pipeline que necesita acción</h3>
                {dia.pipeSinAccion.length + dia.pipeAccionVencida.length === 0 && (
                  <p className="text-xs text-muted text-center py-2">Todas tus oportunidades tienen próxima acción. 💪</p>
                )}
                {[...dia.pipeAccionVencida, ...dia.pipeSinAccion].slice(0, 6).map((o) => (
                  <Link key={o.id} href="/gestor/luz/pipeline"
                    className="flex items-center gap-2.5 p-2 rounded-lg bg-card/50 border border-border/20 hover:border-accent/40 transition">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{o.nombre_oportunidad || o.luz_clientes?.nombre}</p>
                      <p className="text-[11px] text-muted truncate">
                        {ESTADO_PIPELINE_LABEL[o.estado] || o.estado} · {fmtEur0(Number(o.comision_potencial) || 0)} comisión
                      </p>
                    </div>
                    {o.proxima_accion
                      ? <BadgeVencimiento fecha={o.fecha_proxima_accion} />
                      : <span className="text-[10px] font-bold text-red-400 whitespace-nowrap">SIN ACCIÓN</span>}
                  </Link>
                ))}
              </Card>

              {dia.misContratos.length > 0 && (
                <Card className="space-y-2">
                  <h3 className="font-bold text-sm flex items-center gap-2"><FileSignature className="w-4 h-4 text-emerald-400" /> Contratos en curso</h3>
                  {dia.misContratos.slice(0, 5).map((c) => (
                    <Link key={c.id} href="/gestor/luz/contratos"
                      className="flex items-center gap-2.5 p-2 rounded-lg bg-card/50 border border-border/20 hover:border-emerald-400/40 transition">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">{c.luz_clientes?.nombre || nombreCliente(c.cliente_id)} · {c.comercializadora_final}</p>
                        <p className="text-[11px] text-muted">{c.estado_contrato.replace(/_/g, ' ')}</p>
                      </div>
                      {c.fecha_activacion_prevista && <BadgeVencimiento fecha={c.fecha_activacion_prevista} />}
                    </Link>
                  ))}
                </Card>
              )}

              {dia.misClientesA.length > 0 && (
                <Card className="border-red-500/30 space-y-2">
                  <h3 className="font-bold text-sm flex items-center gap-2 text-red-400"><Phone className="w-4 h-4" /> Clientes A sin próxima acción</h3>
                  {dia.misClientesA.slice(0, 5).map((c) => (
                    <Link key={c.id} href={`/gestor/luz/clientes/${c.id}`}
                      className="flex items-center gap-2.5 p-2 rounded-lg bg-card/50 border border-border/20 hover:border-red-400/40 transition">
                      <BadgePrioridad prioridad="A" />
                      <p className="text-xs font-semibold truncate flex-1">{c.nombre}</p>
                      <span className="text-[10px] text-muted">decidir acción →</span>
                    </Link>
                  ))}
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
