'use client';

/**
 * CONTROL DE CARTERA — la vista de excepciones de Dirección.
 *
 * El análisis operativo la pide así, y la palabra importante es EXCEPCIONES:
 * «debe ser una vista de excepciones, no de actividad total». Aquí no se ve lo
 * que va bien. Solo lo que está mal, con nombre, con responsable y con lista
 * abierta — «permitir abrir cada bloque con un clic y ver lista exacta, no
 * solo número de KPI».
 *
 * QUÉ CONTESTA, Y POR QUÉ ESTÁ SEPARADA DEL DASHBOARD
 *
 * El Dashboard contesta «qué decido HOY»: cinco cosas, ordenadas por lo que se
 * pierde para siempre. Esto contesta otra pregunta distinta: «¿dónde se está
 * escapando el control?». Son listas largas por naturaleza —lo que está sin
 * responsable puede ser cuarenta cosas— y meterlas en la portada la volvería
 * otra vez un muro. Se miran en momentos distintos y por eso son pantallas
 * distintas.
 *
 * TODO SE CALCULA CON REGLAS, SIN IA NI SERVICIOS DE PAGO.
 * El criterio vive entero en `src/lib/reglas-cartera.ts`.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronDown, ShieldCheck, Users } from 'lucide-react';
import {
  TAREAS_ABIERTAS,
  type LuzCliente, type LuzCups, type LuzOportunidad, type LuzContrato, type LuzTarea,
} from '@/lib/luz';
import {
  controlDireccion, porResponsable, type Expediente,
} from '@/lib/reglas-cartera';
import { Card, EstadoCarga, useListaLuz } from '../ui';

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function ControlCartera() {
  const clientes = useListaLuz<LuzCliente>('clientes');
  const cups = useListaLuz<LuzCups>('cups');
  const pipeline = useListaLuz<LuzOportunidad>('pipeline');
  const contratos = useListaLuz<LuzContrato>('contratos');
  const tareas = useListaLuz<LuzTarea>('tareas');

  const [abierto, setAbierto] = useState<string | null>(null);
  const hoy = hoyISO();

  /**
   * Los cuatro objetos que pueden quedarse sin control, cada uno con SUS
   * tareas. El documento insiste en que son entidades distintas y en que no
   * hay que meterlo todo en «cliente»: una oportunidad parada y un contrato
   * parado son problemas diferentes, de personas diferentes.
   */
  const expedientes = useMemo<Expediente[]>(() => {
    const abiertas = tareas.datos.filter((t) => TAREAS_ABIERTAS.includes(t.estado));
    const nombreDe = (id: string | null | undefined) =>
      clientes.datos.find((c) => c.id === id)?.nombre || 'Cliente';

    const deOportunidades: Expediente[] = pipeline.datos.map((o) => ({
      id: o.id,
      nombre: `${nombreDe(o.cliente_id)} · ${o.nombre_oportunidad || 'Oportunidad'}`,
      tipo: 'oportunidad',
      estado: o.estado,
      responsable: o.responsable,
      accionManual: o.proxima_accion,
      fechaAccionManual: o.fecha_proxima_accion,
      tareas: abiertas.filter((t) => t.pipeline_id === o.id),
      ultimaActividad: o.actualizado_en,
      fechaReactivacion: o.fecha_revision,
      motivo: o.motivo_perdida,
    }));

    const deSuministros: Expediente[] = cups.datos.map((c) => ({
      id: c.id,
      nombre: `${nombreDe(c.cliente_id)} · ${c.alias_suministro || c.cups}`,
      tipo: 'suministro',
      estado: c.estado_cups,
      responsable: c.responsable,
      tareas: abiertas.filter((t) => t.cups_id === c.id),
      ultimaActividad: c.actualizado_en,
    }));

    const deContratos: Expediente[] = contratos.datos.map((k) => ({
      id: k.id,
      nombre: `${nombreDe(k.cliente_id)} · ${k.comercializadora_final || 'Contrato'}`,
      tipo: 'contrato',
      estado: k.estado_contrato,
      responsable: k.responsable,
      tareas: abiertas.filter((t) => t.contrato_id === k.id),
      ultimaActividad: k.actualizado_en,
    }));

    // Los clientes solo entran por su ficha: sus tareas generales son las que
    // no cuelgan de ningún suministro ni oportunidad.
    const deClientes: Expediente[] = clientes.datos
      .filter((c) => c.clasificacion === 'precliente' || c.clasificacion === 'cliente')
      .map((c) => ({
        id: c.id,
        nombre: c.nombre,
        tipo: 'cliente' as const,
        estado: c.estado_comercial,
        responsable: c.responsable,
        accionManual: c.proxima_accion,
        fechaAccionManual: c.fecha_proxima_accion,
        tareas: abiertas.filter((t) => t.cliente_id === c.id && !t.cups_id && !t.pipeline_id),
        ultimaActividad: c.fecha_ultimo_contacto,
      }));

    return [...deOportunidades, ...deSuministros, ...deContratos, ...deClientes];
  }, [clientes.datos, cups.datos, pipeline.datos, contratos.datos, tareas.datos]);

  const bloques = useMemo(() => controlDireccion(expedientes, hoy), [expedientes, hoy]);
  const reparto = useMemo(() => porResponsable(expedientes, hoy), [expedientes, hoy]);

  const cargando = clientes.cargando || cups.cargando || tareas.cargando;
  const totalCriticas = bloques.reduce(
    (s, b) => s + b.incidencias.filter((i) => i.critica).length, 0);

  /** A dónde lleva cada incidencia según de qué objeto sea. */
  const destino = (tipo: Expediente['tipo'], id: string) => {
    if (tipo === 'cliente') return `/gestor/luz/clientes/${id}`;
    if (tipo === 'suministro') return '/gestor/luz/cups';
    if (tipo === 'contrato') return '/gestor/luz/contratos';
    return '/gestor/luz/pipeline';
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-accent" /> Control de cartera
        </h1>
        <p className="text-xs text-muted mt-0.5">
          Solo lo que se está escapando. Lo que va bien no sale aquí.
        </p>
      </div>

      <EstadoCarga
        cargando={cargando}
        error={clientes.error}
        faltaMigracion={clientes.faltaMigracion}
        vacio={false}
        textoVacio=""
        sqlFile="supabase_luz.sql"
      />

      {!cargando && !clientes.error && (
        <>
          {bloques.length === 0 ? (
            <Card>
              <p className="text-sm text-emerald-400 font-semibold py-4 text-center">
                Ningún expediente abierto sin responsable, sin acción o parado. La cartera está bajo control.
              </p>
            </Card>
          ) : (
            <>
              <Card className="!p-4">
                <p className="text-sm font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="tabular-nums text-red-400">{totalCriticas}</span>
                  <span className="text-muted font-semibold text-xs">
                    {totalCriticas === 1 ? 'cosa crítica' : 'cosas críticas'} sobre {expedientes.length} expedientes
                  </span>
                </p>
              </Card>

              {/* Cada bloque abre a su lista exacta: un número sin lista
                  detrás no se puede accionar. */}
              <div className="space-y-2">
                {bloques.map((b) => {
                  const criticas = b.incidencias.filter((i) => i.critica).length;
                  const desplegado = abierto === b.tipo;
                  return (
                    <Card key={b.tipo} className="!p-0 overflow-hidden">
                      <button
                        onClick={() => setAbierto(desplegado ? null : b.tipo)}
                        aria-expanded={desplegado}
                        className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-card/50 transition"
                      >
                        <span className={`text-lg font-black tabular-nums w-10 text-center shrink-0 ${criticas ? 'text-red-400' : 'text-amber-300'}`}>
                          {b.incidencias.length}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-foreground">{b.titulo}</span>
                          <span className="block text-[11px] text-muted">{b.pregunta}</span>
                        </span>
                        <ChevronDown className={`w-4 h-4 text-muted shrink-0 transition ${desplegado ? 'rotate-180' : ''}`} />
                      </button>

                      {desplegado && (
                        <ul className="border-t border-border/40 divide-y divide-border/25">
                          {b.incidencias.map((i, n) => (
                            <li key={`${i.expedienteId}-${n}`}>
                              <Link
                                href={destino(i.tipoExpediente, i.expedienteId)}
                                className="flex items-start gap-3 px-3.5 py-2.5 hover:bg-card/50 transition"
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block text-xs font-bold text-foreground truncate">{i.nombre}</span>
                                  <span className={`block text-[11px] ${i.critica ? 'text-red-300' : 'text-muted'}`}>
                                    {i.texto}
                                  </span>
                                  <span className="block text-[10px] text-muted mt-0.5">{i.arreglo}</span>
                                </span>
                                <span className="text-[10px] font-bold text-muted shrink-0 px-2 py-0.5 rounded-md bg-card/70 border border-border/40">
                                  {i.responsable || 'Sin asignar'}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>
                  );
                })}
              </div>

              {/* Por responsable: no para comparar personas, para repartir. */}
              {reparto.length > 0 && (
                <Card>
                  <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-accent" /> Cómo está repartido
                  </h2>
                  <div className="space-y-1.5">
                    {reparto.map((r) => (
                      <div key={r.responsable} className="flex items-center gap-3 px-2.5 py-2 rounded-lg bg-card/60">
                        <span className="text-xs font-bold text-foreground flex-1 min-w-0 truncate">
                          {r.responsable}
                        </span>
                        {r.criticas > 0 && (
                          <span className="text-[11px] font-black text-red-400 tabular-nums">
                            {r.criticas} crítica{r.criticas === 1 ? '' : 's'}
                          </span>
                        )}
                        <span className="text-[11px] text-muted tabular-nums w-16 text-right">
                          {r.total} en total
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted mt-3">
                    Esto no sirve para comparar a David con Nicola: hacen trabajos distintos y las
                    unidades no son las mismas. Sirve para ver si a alguien se le ha acumulado.
                  </p>
                </Card>
              )}
            </>
          )}

          <p className="text-[11px] text-muted">
            Todo lo de esta pantalla sale de reglas sobre fechas, estados y relaciones: no hay
            ninguna llamada a servicios de pago ni nada que dependa de saldo. Y ninguna regla
            cambia un dato por su cuenta — detectan y avisan; corregir lo decide una persona.
          </p>
        </>
      )}
    </div>
  );
}
