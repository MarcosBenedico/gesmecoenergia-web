'use client';

/**
 * AUTOMATIZACIONES DE FASE — la pantalla de revisar y aplicar.
 *
 * Las reglas viven en `src/lib/automatismos.ts` y no escriben nada. Esta
 * pantalla es el único sitio desde donde se convierten en tareas reales, y se
 * hace con una persona delante. El documento operativo lo pide con estas
 * palabras: «no activar automatizaciones con datos reales sin mostrar antes el
 * mapeo, los casos de prueba y la estrategia de reversión».
 *
 *   · EL MAPEO se ve aquí: cada propuesta dice de qué regla sale, por qué, a
 *     quién afecta y con qué fecha.
 *   · LOS CASOS DE PRUEBA son `npm run test:automatismos`.
 *   · LA REVERSIÓN es que lo aplicado es UNA TAREA NORMAL. Se borra desde
 *     Tareas como cualquier otra y va a la papelera. No hay nada que deshacer
 *     en cascada porque las reglas no tocan estados, ni precios, ni contratos.
 *
 * POR QUÉ NO SE APLICA SOLO, QUE SERÍA MÁS CÓMODO
 *
 * Porque un sistema que crea trabajo en silencio acaba llenando las listas de
 * tareas que nadie pidió, y en cuanto la lista tiene cosas que nadie pidió se
 * deja de mirar — que es el único sitio donde vive el control. Aplicarlo a
 * mano cuesta un clic al día y mantiene la lista creíble.
 *
 * Es de DIRECCIÓN: crea trabajo para otras personas.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle, Check, ChevronDown, Wand2, ShieldCheck,
} from 'lucide-react';
import {
  TIPO_TAREA_LABEL,
  type LuzCliente, type LuzCups, type LuzOportunidad, type LuzContrato,
  type LuzTarea, type LuzComision,
} from '@/lib/luz';
import {
  proponerTareas, agruparPorRegla, PLAZOS, type Propuesta,
} from '@/lib/automatismos';
import { useUsuario } from '@/lib/usuario';
import { Card, EstadoCarga, useListaLuz, guardarLuz, btnPrimario, btnSecundario } from '../ui';

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fechaCorta = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a.slice(2)}`;
};

export default function Automatismos() {
  const { esAdmin, cargando: cargandoPerfil } = useUsuario();

  const clientes = useListaLuz<LuzCliente>('clientes');
  const cups = useListaLuz<LuzCups>('cups');
  const pipeline = useListaLuz<LuzOportunidad>('pipeline');
  const contratos = useListaLuz<LuzContrato>('contratos');
  const comisiones = useListaLuz<LuzComision>('comisiones');
  const tareas = useListaLuz<LuzTarea>('tareas');

  const [abierta, setAbierta] = useState<string | null>(null);
  const [aplicadas, setAplicadas] = useState<Record<string, 'ok' | 'error'>>({});
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState('');

  const hoy = hoyISO();

  const propuestas = useMemo<Propuesta[]>(() => proponerTareas({
    clientes: clientes.datos.map((c) => ({ id: c.id, nombre: c.nombre, responsable: c.responsable })),
    cups: cups.datos.map((c) => ({
      id: c.id, cliente_id: c.cliente_id, cups: c.cups, alias_suministro: c.alias_suministro,
      estado_cups: c.estado_cups, responsable: c.responsable,
      fecha_limite_preaviso: c.fecha_limite_preaviso,
    })),
    // Sin cliente detrás no hay a quién reclamarle nada ni a quién asignárselo:
    // un huérfano es un problema de datos, no una tarea que crear.
    pipeline: pipeline.datos
      .filter((o): o is LuzOportunidad & { cliente_id: string } => !!o.cliente_id)
      .map((o) => ({
        id: o.id, cliente_id: o.cliente_id, estado: o.estado,
        nombre_oportunidad: o.nombre_oportunidad, responsable: o.responsable, cups_id: o.cups_id,
      })),
    contratos: contratos.datos
      .filter((k): k is LuzContrato & { cliente_id: string } => !!k.cliente_id)
      .map((k) => ({
        id: k.id, cliente_id: k.cliente_id, cups_id: k.cups_id, estado_contrato: k.estado_contrato,
        responsable: k.responsable, comercializadora_final: k.comercializadora_final,
        fecha_firma: k.fecha_firma, fecha_activacion_real: k.fecha_activacion_real,
      })),
    // Una comisión sin cliente no se puede reclamar a nadie, así que no entra.
    // Y no lleva responsable propio: lo hereda del cliente.
    comisiones: comisiones.datos
      .filter((m): m is LuzComision & { cliente_id: string } => !!m.cliente_id)
      .map((m) => ({
        id: m.id, cliente_id: m.cliente_id, estado_comision: m.estado_comision,
        fecha_prevista_cobro: m.fecha_prevista_cobro, responsable: null,
      })),
    tareas: tareas.datos,
  }, hoy, PLAZOS), [clientes.datos, cups.datos, pipeline.datos, contratos.datos, comisiones.datos, tareas.datos, hoy]);

  /** Lo que queda por decidir: lo ya aplicado en esta sesión desaparece de la lista. */
  const pendientes = useMemo(
    () => propuestas.filter((p) => aplicadas[p.clave] !== 'ok'),
    [propuestas, aplicadas]);

  const grupos = useMemo(() => agruparPorRegla(pendientes), [pendientes]);

  const aplicar = useCallback(async (p: Propuesta) => {
    setTrabajando(p.clave);
    setError('');
    const cuerpo: Record<string, unknown> = { ...p.tarea, estado: 'pendiente' };
    // Un vínculo vacío se manda como null, nunca como cadena vacía: eso es lo
    // que rompía contratos en el importador (ver `VINCULOS_PROTEGIDOS`).
    for (const k of Object.keys(cuerpo)) if (cuerpo[k] === undefined || cuerpo[k] === '') cuerpo[k] = null;

    const err = p.accion === 'actualizar' && p.tareaId
      ? await guardarLuz('tareas', 'PUT', { id: p.tareaId, fecha_limite: p.tarea.fecha_limite })
      : await guardarLuz('tareas', 'POST', cuerpo);

    setTrabajando(null);
    if (err) {
      setError(err);
      setAplicadas((a) => ({ ...a, [p.clave]: 'error' }));
      return false;
    }
    setAplicadas((a) => ({ ...a, [p.clave]: 'ok' }));
    return true;
  }, []);

  /** Aplicar un grupo entero: de una en una, para que un fallo no arrastre al resto. */
  const aplicarGrupo = useCallback(async (ps: Propuesta[]) => {
    for (const p of ps) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await aplicar(p);
      if (!ok) break;
    }
    await tareas.recargar();
  }, [aplicar, tareas]);

  const cargando = clientes.cargando || cups.cargando || tareas.cargando;

  if (!cargandoPerfil && !esAdmin) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-foreground">Las automatizaciones son de dirección</p>
            <p className="text-sm text-muted mt-1">
              Crean trabajo para otras personas, así que las revisa y las aplica quien reparte.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-accent" /> Automatizaciones de fase
        </h1>
        <p className="text-xs text-muted mt-0.5">
          El trabajo que debería existir por la fase en la que está cada expediente y todavía no existe.
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

      {error && (
        <Card className="!p-3 border-red-500/40">
          <p className="text-xs text-red-300">{error}</p>
        </Card>
      )}

      {!cargando && !clientes.error && (
        <>
          {pendientes.length === 0 ? (
            <Card>
              <p className="text-sm text-emerald-400 font-semibold py-4 text-center">
                Cada expediente tiene ya la tarea que le toca por su fase. No hay nada que crear.
              </p>
            </Card>
          ) : (
            <>
              <Card className="!p-4">
                <p className="text-sm font-bold flex items-center gap-2">
                  <span className="tabular-nums text-accent text-lg">{pendientes.length}</span>
                  <span className="text-muted font-semibold text-xs">
                    {pendientes.length === 1 ? 'tarea propuesta' : 'tareas propuestas'} · nada se ha creado todavía
                  </span>
                </p>
              </Card>

              <div className="space-y-2">
                {grupos.map((g) => {
                  const desplegado = abierta === g.regla;
                  return (
                    <Card key={g.regla} className="!p-0 overflow-hidden">
                      <div className="flex items-center gap-2 p-3.5">
                        <button
                          onClick={() => setAbierta(desplegado ? null : g.regla)}
                          aria-expanded={desplegado}
                          className="flex items-center gap-3 text-left min-w-0 flex-1"
                        >
                          <span className="text-lg font-black tabular-nums text-accent w-8 text-center shrink-0">
                            {g.propuestas.length}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-foreground">{g.regla}</span>
                            <span className="block text-[11px] text-muted line-clamp-2">
                              {g.propuestas[0].porque}
                            </span>
                          </span>
                          <ChevronDown className={`w-4 h-4 text-muted shrink-0 transition ${desplegado ? 'rotate-180' : ''}`} />
                        </button>
                        <button
                          onClick={() => aplicarGrupo(g.propuestas)}
                          disabled={!!trabajando}
                          className={`${btnSecundario} shrink-0 text-[11px]`}
                        >
                          Aplicar las {g.propuestas.length}
                        </button>
                      </div>

                      {desplegado && (
                        <ul className="border-t border-border/40 divide-y divide-border/25">
                          {g.propuestas.map((p) => (
                            <li key={p.clave} className="flex items-start gap-3 px-3.5 py-2.5">
                              <span className="min-w-0 flex-1">
                                <span className="block text-xs font-bold text-foreground truncate">{p.contexto}</span>
                                <span className="block text-[11px] text-muted">
                                  {TIPO_TAREA_LABEL[p.tarea.tipo_tarea] || p.tarea.tipo_tarea}
                                  {' · para el '}{fechaCorta(p.tarea.fecha_limite)}
                                  {' · '}{p.tarea.responsable || 'sin asignar'}
                                </span>
                                {p.accion === 'actualizar' && (
                                  <span className="block text-[10px] text-amber-300 mt-0.5">
                                    Mueve la tarea que ya existe. No crea una segunda.
                                  </span>
                                )}
                                {aplicadas[p.clave] === 'error' && (
                                  <span className="block text-[10px] text-red-300 mt-0.5">No se pudo crear.</span>
                                )}
                              </span>
                              <button
                                onClick={async () => { await aplicar(p); await tareas.recargar(); }}
                                disabled={trabajando === p.clave}
                                className={`${btnPrimario} shrink-0 text-[11px] py-1.5`}
                              >
                                {trabajando === p.clave
                                  ? '…'
                                  : <span className="flex items-center gap-1"><Check className="w-3 h-3" /> Aplicar</span>}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>
                  );
                })}
              </div>
            </>
          )}

          <Card className="!p-4">
            <h2 className="text-xs font-bold flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Qué NO hacen estas reglas
            </h2>
            <ul className="text-[11px] text-muted space-y-1 list-disc pl-4">
              <li>No cambian una etapa comercial porque haya pasado el tiempo: avisan, nunca inventan un resultado.</li>
              <li>No cierran tareas solas ni tocan precios, ofertas, contratos, titularidad ni comercializadora.</li>
              <li>No crean una tarea por cada día de retraso: mientras la tarea siga abierta, no se propone otra.</li>
              <li>No mandan nada al cliente. Ni un correo, ni un WhatsApp.</li>
              <li>Aplicar dos veces da el mismo resultado que aplicar una: lo aplicado desaparece de esta lista.</li>
            </ul>
            <p className="text-[11px] text-muted mt-2">
              Lo que se aplica es una tarea normal y corriente: si sobra, se borra desde Tareas y va a la papelera.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
