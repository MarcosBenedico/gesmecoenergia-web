'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Sun, AlertTriangle, Check, Target, ArrowRight, Flame } from 'lucide-react';
import {
  LuzCliente, LuzCups, LuzFechaCritica, LuzOportunidad, LuzTarea,
  PIPELINE_CERRADO, diasHasta,
} from '@/lib/luz';
import { construirAgenda, esDe, ItemAgenda } from '@/lib/agenda';
import { fmtEur0 } from '@/lib/correbin';
import { useUsuario } from '@/lib/usuario';
import { Card, EstadoCarga, useListaLuz, guardarLuz, SelectorResponsable } from '../ui';
import { ClientesEnMarcha } from './clientes-en-marcha';
import { AccionesContacto } from '../acciones-contacto';
import { FotoSitio } from '../foto-sitio';

/**
 * MI DÍA — la pantalla de David.
 *
 * Una sola pregunta: ¿qué hago hoy, y qué me espera mañana?
 * Nada más. Lo que va más allá de mañana vive en la Agenda.
 *
 * Bebe de la misma fuente que la Agenda (`construirAgenda`), así que nunca
 * puede decir una cosa distinta. Lo atrasado NO va en su propia sección:
 * se mezcla arriba del todo con lo de hoy, porque para quien está en la calle
 * atrasado y de hoy son lo mismo — hay que hacerlo YA.
 *
 * Los clientes A mandan: salen primero y con la banda roja.
 */

/** Peso de cada prioridad: A primero. Lo urgente de un cliente A vale más. */
const PESO: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

/** Banda de color lateral según la prioridad del cliente: se reconoce sin leer. */
const BANDA: Record<string, string> = {
  A: 'border-l-4 border-l-red-500',
  B: 'border-l-4 border-l-amber-400',
  C: 'border-l-4 border-l-border/40',
  D: 'border-l-4 border-l-border/20',
};

const saludo = () => {
  const h = new Date().getHours();
  return h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
};

export default function MiDiaPage() {
  const { perfil, cargando: cargandoPerfil, esAdmin } = useUsuario();
  const [verComo, setVerComo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState('');

  const clientes = useListaLuz<LuzCliente>('clientes');
  const cups = useListaLuz<LuzCups>('cups');
  const fechas = useListaLuz<LuzFechaCritica>('fechas', { estado: 'pendiente' });
  const pipeline = useListaLuz<LuzOportunidad>('pipeline');
  const tareas = useListaLuz<LuzTarea>('tareas');

  const persona = verComo ?? perfil?.responsable ?? null;
  const cargando = cargandoPerfil || tareas.cargando || cups.cargando || fechas.cargando;

  const dia = useMemo(() => {
    if (!persona) return null;

    // Misma fuente que la Agenda: tareas + vencimientos calculados del CUPS + fechas manuales
    const todo = construirAgenda({
      tareas: tareas.datos, cups: cups.datos, fechas: fechas.datos, pipeline: pipeline.datos,
    }).filter((i) => esDe(i.responsable, persona));

    const ordenar = (a: ItemAgenda, b: ItemAgenda) =>
      (PESO[a.prioridad] ?? 2) - (PESO[b.prioridad] ?? 2) || (a.dias ?? 99) - (b.dias ?? 99);

    // Atrasado y de hoy van juntos: para quien está en la calle es lo mismo.
    const hoy = todo.filter((i) => i.dias != null && i.dias <= 0).sort(ordenar);
    const manana = todo.filter((i) => i.dias === 1).sort(ordenar);
    const despues = todo.filter((i) => i.dias != null && i.dias > 1);
    const sinFecha = todo.filter((i) => i.dias == null);

    // Cuántas ha cerrado ya hoy (aproximado: tareas completadas con fecha de hoy)
    const hechasHoy = tareas.datos.filter(
      (t) => esDe(t.responsable, persona) && t.estado === 'completada' && diasHasta(t.fecha_limite) === 0
    ).length;

    // Oportunidades suyas que están paradas: sin próxima acción o con la acción pasada
    const miPipe = pipeline.datos.filter(
      (o) => esDe(o.responsable, persona) && !PIPELINE_CERRADO.includes(o.estado) && o.estado !== 'revisar_adelante'
    );
    const paradas = miPipe.filter((o) => !o.proxima_accion || (diasHasta(o.fecha_proxima_accion) ?? 1) < 0);

    return {
      hoy, manana, despues, sinFecha, hechasHoy,
      atrasadas: hoy.filter((i) => (i.dias ?? 0) < 0).length,
      clientesA: hoy.filter((i) => i.prioridad === 'A').length,
      paradas,
      misClientes: clientes.datos.filter((c) => esDe(c.responsable, persona)),
      comisionEnJuego: miPipe.reduce((s, o) => s + (Number(o.comision_potencial) || 0), 0),
    };
  }, [persona, tareas.datos, cups.datos, fechas.datos, pipeline.datos, clientes.datos]);

  // Teléfono, dirección y foto de cada cliente: la agenda no los lleva, y son
  // justo lo que hace falta para llamar o arrancar la navegación desde aquí
  const fichaCliente = useMemo(
    () => new Map(clientes.datos.map((c) => [c.id, c])),
    [clientes.datos]
  );

  async function completar(i: ItemAgenda) {
    if (!i.id) return;
    setOcupado(i.clave);
    const err = i.origen === 'tarea'
      ? await guardarLuz('tareas', 'PUT', { id: i.id, estado: 'completada' })
      : await guardarLuz('fechas', 'PUT', { id: i.id, estado: 'completada' });
    setOcupado('');
    if (err) return;
    if (i.origen === 'tarea') tareas.recargar(); else fechas.recargar();
  }

  /**
   * Una acción. El NOMBRE DEL CLIENTE es el titular —así se identifica de un
   * vistazo desde el coche—; lo que hay que hacer va justo debajo.
   * Botón grande, pensado para el dedo.
   */
  const Accion = ({ i, apagado = false }: { i: ItemAgenda; apagado?: boolean }) => {
    const atrasada = (i.dias ?? 0) < 0;
    const conNombre = !!i.clienteNombre;
    const ficha = i.clienteId ? fichaCliente.get(i.clienteId) : null;
    const Contenido = (
      <>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {i.prioridad === 'A' && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30 text-[9px] font-black uppercase">
                <Flame className="w-2.5 h-2.5" /> Cliente A
              </span>
            )}
            {atrasada && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[9px] font-black uppercase">
                {Math.abs(i.dias!)} {Math.abs(i.dias!) === 1 ? 'día' : 'días'} de retraso
              </span>
            )}
          </div>
          {/* Titular: quién. Lo que más rápido tiene que reconocer. */}
          <p className="text-[17px] font-black text-foreground leading-tight truncate">
            {conNombre ? i.clienteNombre : i.titulo}
          </p>
          {/* Debajo: qué hay que hacer con él, y en qué punto del embudo está */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-[13px] font-semibold text-accent leading-snug">
              {conNombre ? i.titulo : i.tipoLabel}
            </p>
            {i.estadoPipelineLabel && (
              <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-black uppercase ${i.estadoPipelineTono}`}>
                {i.estadoPipelineLabel}
              </span>
            )}
          </div>
        </div>
      </>
    );

    return (
      <div className={`fv-fade-in rounded-xl bg-card/60 ${BANDA[i.prioridad] || BANDA.C} ${apagado ? 'opacity-70' : ''} p-3`}>
        <div className="flex items-center gap-3">
        {/* La foto del sitio: reconocer la nave antes de llegar vale media visita */}
        <FotoSitio path={ficha?.foto_path} alt={i.clienteNombre || ''} className="h-14 w-14" />
        {i.clienteId ? (
          <Link href={`/gestor/luz/clientes/${i.clienteId}`} className="min-w-0 flex-1 flex group">
            {Contenido}
          </Link>
        ) : (
          <div className="min-w-0 flex-1 flex">{Contenido}</div>
        )}
        {i.editable ? (
          <button
            onClick={() => completar(i)}
            disabled={ocupado === i.clave}
            className="shrink-0 h-12 w-12 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/25 active:scale-95 transition disabled:opacity-40"
            title="Hecho"
            aria-label="Marcar como hecho"
          >
            <Check className="w-6 h-6" />
          </button>
        ) : (
          <span className="shrink-0 text-[9px] font-bold text-muted/50 uppercase text-center w-12 leading-tight">Aviso<br />auto</span>
        )}
        </div>
        {/* Llamar, WhatsApp y navegación: lo que de verdad se pulsa desde la furgoneta */}
        {ficha && (ficha.telefono || ficha.direccion_fiscal) && (
          <div className="mt-2 pt-2 border-t border-border/25">
            <AccionesContacto
              telefono={ficha.telefono}
              ubicacion={ficha.direccion_fiscal}
              nombre={ficha.nombre}
            />
          </div>
        )}
      </div>
    );
  };

  const nada = dia && dia.hoy.length === 0;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Sun className="w-6 h-6 text-amber-400" />
            {persona ? `${saludo()}, ${persona.split(' ')[0]}` : 'Mi Día'}
          </h2>
          <p className="text-xs text-muted mt-0.5 capitalize">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        {esAdmin && !cargandoPerfil && (
          <SelectorResponsable
            valor={persona}
            onCambio={(v) => setVerComo(v)}
            className="rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 text-xs font-semibold"
          />
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
          {/* El número del día: lo primero y lo único que importa al abrir */}
          <Card className="!p-5 relative overflow-hidden text-center">
            <div className={`absolute inset-0 pointer-events-none bg-gradient-to-br ${
              nada ? 'from-emerald-500/10 to-transparent' : dia.atrasadas > 0 ? 'from-red-500/10 to-transparent' : 'from-accent/10 to-transparent'
            }`} />
            <div className="relative">
              {nada ? (
                <>
                  <p className="text-5xl">🎉</p>
                  <p className="text-lg font-black text-emerald-400 mt-1">Día limpio</p>
                  <p className="text-xs text-muted">No tienes nada pendiente para hoy.</p>
                </>
              ) : (
                <>
                  <p className={`text-6xl font-black tabular-nums leading-none ${dia.atrasadas > 0 ? 'text-red-400' : 'text-foreground'}`}>
                    {dia.hoy.length}
                  </p>
                  <p className="text-sm font-bold text-foreground mt-1">
                    {dia.hoy.length === 1 ? 'cosa para hoy' : 'cosas para hoy'}
                  </p>
                  <div className="flex items-center justify-center gap-2 flex-wrap mt-2">
                    {dia.atrasadas > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30 text-[10px] font-black uppercase">
                        {dia.atrasadas} de días anteriores
                      </span>
                    )}
                    {dia.clientesA > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/25 text-[10px] font-black uppercase">
                        🔥 {dia.clientesA} de cliente A
                      </span>
                    )}
                    {dia.hechasHoy > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase">
                        ✓ {dia.hechasHoy} ya hechas
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* HOY */}
          {dia.hoy.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-foreground">Hoy</p>
              <div className="space-y-2">{dia.hoy.map((i) => <Accion key={i.clave} i={i} />)}</div>
            </div>
          )}

          {/* MAÑANA — para llegar preparado, no para trabajarlo ahora */}
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-muted">
              Mañana {dia.manana.length > 0 && <span className="text-muted/60">· {dia.manana.length}</span>}
            </p>
            {dia.manana.length === 0 ? (
              <p className="text-xs text-muted/70 px-1">Mañana no tienes nada apuntado todavía.</p>
            ) : (
              <div className="space-y-2">{dia.manana.map((i) => <Accion key={i.clave} i={i} apagado />)}</div>
            )}
          </div>

          {/* Sus clientes en marcha: los que están a punto y los fáciles de recuperar */}
          <ClientesEnMarcha clientes={dia.misClientes} pipeline={pipeline.datos} />

          {/* Oportunidades paradas: dinero suyo que no se está moviendo */}
          {dia.paradas.length > 0 && (
            <Link href="/gestor/luz/pipeline" className="block">
              <Card className="!p-3 border-amber-500/30 hover:border-amber-500/50 transition flex items-center gap-3">
                <Target className="w-5 h-5 text-amber-300 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">
                    {dia.paradas.length} {dia.paradas.length === 1 ? 'oportunidad parada' : 'oportunidades paradas'}
                  </p>
                  <p className="text-[11px] text-muted">
                    Sin próxima acción o con la fecha pasada · {fmtEur0(dia.comisionEnJuego)} en juego
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted shrink-0" />
              </Card>
            </Link>
          )}

          {/* Lo que va más allá de mañana no se enseña aquí: vive en la Agenda */}
          <Link href="/gestor/luz/agenda" className="block">
            <Card className="!p-3 hover:border-accent/40 transition flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">Ver toda la agenda</p>
                <p className="text-[11px] text-muted">
                  {dia.despues.length} más adelante
                  {dia.sinFecha.length > 0 && ` · ${dia.sinFecha.length} sin fecha`}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted shrink-0" />
            </Card>
          </Link>
        </>
      )}
    </div>
  );
}
