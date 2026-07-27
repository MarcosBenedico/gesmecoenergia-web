'use client';

import { useCallback, useRef, useState } from 'react';
import { Camera, Check, Loader, X } from 'lucide-react';
import {
  RESULTADOS_VISITA, ResultadoVisita, DEF_RESULTADOS,
  consumoAnualDesdeFactura, fechaEnDias, notaDeVisita, resumenConsecuencia,
} from '@/lib/visitas';
import { guardarLuz } from './ui';

/**
 * RESOLVER LA VISITA — la pantalla del minuto después de llamar a la puerta.
 *
 * Está pensada para el móvil y para hacerse de pie, con una mano, con la
 * furgoneta abierta. Por eso los botones son enormes, hay cuatro y ninguno
 * obliga a escribir nada: si David tiene que rellenar un formulario, no lo
 * rellena, y entonces no sabemos qué pasó en la visita — que es justo el dato
 * que lo mueve todo.
 *
 * "Me dio la factura" abre la cámara y la lee al momento. Ese es el atajo que
 * más vale de todos: hasta ahora la factura viajaba por WhatsApp hasta Nicola
 * y tardaba días en entrar; así el cliente queda listo para estudiar antes de
 * que él arranque.
 */

interface FacturaLeida {
  encontrada: boolean;
  tarifa?: string;
  consumos_kwh_mes?: number[];
  potencias_kw?: number[];
  nombre_titular?: string;
  observaciones?: string;
}

interface Props {
  clienteId: string;
  clienteNombre: string;
  responsable?: string | null;
  /** Oportunidad del pipeline, si la tiene: se mueve según el resultado. */
  pipelineId?: string | null;
  /** Ficha del mapa de oportunidades, si vino de ahí: se descarta si dice que no. */
  prospectoId?: string | null;
  onHecho: () => void;
  onCerrar: () => void;
}

export function ResolverVisita({
  clienteId, clienteNombre, responsable, pipelineId, prospectoId, onHecho, onCerrar,
}: Props) {
  const [resultado, setResultado] = useState<ResultadoVisita | null>(null);
  const [nota, setNota] = useState('');
  const [fechaVolver, setFechaVolver] = useState(fechaEnDias(15));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // ── Factura ──
  const camara = useRef<HTMLInputElement>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [factura, setFactura] = useState<FacturaLeida | null>(null);

  const leerFactura = useCallback(async (archivo: File) => {
    setLeyendo(true); setError(''); setFactura(null);
    try {
      const bytes = new Uint8Array(await archivo.arrayBuffer());
      let binario = '';
      for (let i = 0; i < bytes.length; i += 8192) binario += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const res = await fetch('/api/leer-factura', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: btoa(binario), mediaType: archivo.type }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'No se pudo leer la factura.'); return; }
      const d = json.datos as FacturaLeida;
      if (!d.encontrada) {
        setError('No se ve una factura de luz legible. Prueba con más luz o más cerca.');
        return;
      }
      setFactura(d);
    } catch {
      setError('No se pudo procesar la foto.');
    } finally {
      setLeyendo(false);
    }
  }, []);

  /** Guarda la visita y todo lo que arrastra. */
  async function confirmar() {
    if (!resultado) return;
    const def = DEF_RESULTADOS[resultado];
    setGuardando(true); setError('');

    const hoy = new Date().toISOString().slice(0, 10);
    const cuandoVolver =
      resultado === 'volver' ? fechaVolver
      : def.diasParaVolver ? fechaEnDias(def.diasParaVolver)
      : null;

    // ── 1. La visita, que es lo que nunca puede perderse ──
    const errVisita = await guardarLuz('visitas', 'POST', {
      cliente_id: clienteId,
      fecha: hoy,
      notas: notaDeVisita(resultado, nota),
      responsable: responsable || 'David',
      resultado,
      proxima_visita: cuandoVolver,
    });
    if (errVisita) {
      // Sin las columnas nuevas se guarda igual, pero sin el resultado: mejor
      // perder el detalle que perder la visita entera.
      const faltaSql = /resultado|proxima_visita|column/i.test(errVisita);
      const err2 = faltaSql
        ? await guardarLuz('visitas', 'POST', {
            cliente_id: clienteId, fecha: hoy,
            notas: `[${def.etiqueta}] ${notaDeVisita(resultado, nota)}`,
            responsable: responsable || 'David',
          })
        : errVisita;
      if (err2) { setError(err2); setGuardando(false); return; }
      if (faltaSql) setError('Visita guardada, pero falta ejecutar supabase_visita_resultado.sql para que cuente en las estadísticas.');
    }

    // ── 2. La siguiente pasada, para que no se olvide ──
    if (cuandoVolver) {
      await guardarLuz('tareas', 'POST', {
        cliente_id: clienteId,
        tipo_tarea: resultado === 'no_estaba' ? 'llamar_cliente' : 'seguimiento',
        descripcion: resultado === 'no_estaba'
          ? `Volver a pasar por ${clienteNombre} (no estaba)`
          : `Volver a ${clienteNombre}`,
        notas: notaDeVisita(resultado, nota),
        responsable: responsable || 'David',
        fecha_limite: cuandoVolver,
        estado: 'pendiente',
        prioridad: 'B',
      });
    }

    // ── 3. El pipeline, para que el embudo diga la verdad ──
    if (pipelineId && def.estadoPipeline) {
      await guardarLuz('pipeline', 'PUT', { id: pipelineId, estado: def.estadoPipeline });
    }

    // ── 4. Que no vuelva a proponerse lo que ya se ha descartado ──
    if (prospectoId && def.descartarProspecto) {
      await guardarLuz('prospectos', 'PUT', {
        id: prospectoId, estado: 'descartado',
        motivo_descarte: notaDeVisita(resultado, nota),
      });
    }

    // ── 5. La factura: de prospecto a ofertable sin pasar por la oficina ──
    if (factura?.encontrada) {
      const consumo = consumoAnualDesdeFactura(factura.consumos_kwh_mes);
      await guardarLuz('cups', 'POST', {
        cliente_id: clienteId,
        // El CUPS no se ve en todas las facturas: lo completa Nicola
        cups: `PENDIENTE-${Date.now().toString().slice(-8)}`,
        alias_suministro: clienteNombre,
        tarifa_acceso: factura.tarifa || null,
        consumo_anual_kwh: consumo,
        potencias_kw: factura.potencias_kw || null,
        estado_cups: 'estudio',
        responsable: responsable || 'David',
        observaciones: [
          'Factura leída en la puerta desde el móvil.',
          consumo ? `Consumo anual estimado desde una sola factura: ${consumo.toLocaleString('es-ES')} kWh.` : '',
          'Falta el CUPS y confirmar el consumo con más facturas.',
          factura.observaciones || '',
        ].filter(Boolean).join('\n· '),
      });
    }

    // ── 6. El cliente avanza ──
    await guardarLuz('clientes', 'PUT', {
      id: clienteId,
      fecha_ultimo_contacto: hoy,
      ...(cuandoVolver ? { fecha_proxima_accion: cuandoVolver, proxima_accion: `Volver a ${clienteNombre}` } : {}),
    });

    setGuardando(false);
    onHecho();
  }

  const def = resultado ? DEF_RESULTADOS[resultado] : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center"
      onClick={onCerrar}>
      <div
        className="w-full sm:max-w-md bg-surface border-t sm:border border-border/50 sm:rounded-2xl rounded-t-2xl p-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black text-muted uppercase">¿Qué tal ha ido?</p>
            <h2 className="text-lg font-black truncate">{clienteNombre}</h2>
          </div>
          <button onClick={onCerrar} className="p-2 -m-1 text-muted hover:text-foreground shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Los cuatro botones: grandes, para pulsarlos de pie y con una mano */}
        <div className="grid grid-cols-2 gap-2">
          {RESULTADOS_VISITA.map((r) => {
            const d = DEF_RESULTADOS[r];
            const elegido = resultado === r;
            return (
              <button
                key={r}
                onClick={() => { setResultado(r); setError(''); }}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-4 font-black text-sm transition ${d.clases} ${
                  elegido ? 'ring-2 ring-offset-2 ring-offset-surface ring-current' : 'opacity-70 hover:opacity-100'
                }`}
              >
                <span className="text-2xl leading-none">{d.emoji}</span>
                {d.etiqueta}
              </button>
            );
          })}
        </div>

        {def && (
          <div className="mt-3 space-y-3">
            <p className="text-[11px] text-muted bg-card/60 rounded-lg p-2">{resumenConsecuencia(resultado!, fechaVolver)}</p>

            {resultado === 'volver' && (
              <label className="block">
                <span className="text-[10px] font-black text-muted uppercase">¿Cuándo vuelvo?</span>
                <input type="date" value={fechaVolver} onChange={(e) => setFechaVolver(e.target.value)}
                  className="w-full mt-1 rounded-lg border border-border/40 bg-background/60 px-3 py-2.5 text-base" />
                <div className="flex gap-1.5 mt-1.5">
                  {[7, 15, 30, 90].map((d) => (
                    <button key={d} onClick={() => setFechaVolver(fechaEnDias(d))}
                      className="flex-1 px-2 py-1.5 rounded-lg border border-border/50 bg-card/80 text-[11px] font-bold text-muted hover:text-foreground transition">
                      {d < 30 ? `${d} días` : `${Math.round(d / 30)} ${d < 60 ? 'mes' : 'meses'}`}
                    </button>
                  ))}
                </div>
              </label>
            )}

            {/* La factura: el atajo que más vale */}
            {def.pideFactura && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                <input ref={camara} type="file" accept="image/*,application/pdf" capture="environment"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) leerFactura(f); }} />

                {!factura ? (
                  <>
                    <button onClick={() => camara.current?.click()} disabled={leyendo}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-500 transition disabled:opacity-60">
                      {leyendo
                        ? <><Loader className="w-5 h-5 animate-spin" /> Leyendo la factura…</>
                        : <><Camera className="w-5 h-5" /> Hacer foto de la factura</>}
                    </button>
                    <p className="text-[10px] text-muted mt-2 text-center">
                      Se lee sola. Que se vean los consumos y las potencias.
                    </p>
                  </>
                ) : (
                  <div className="text-xs space-y-1">
                    <p className="font-black text-emerald-400 flex items-center gap-1">
                      <Check className="w-4 h-4" /> Factura leída
                    </p>
                    {factura.tarifa && <p className="text-muted">Tarifa <b className="text-foreground">{factura.tarifa}TD</b></p>}
                    {(() => {
                      const c = consumoAnualDesdeFactura(factura.consumos_kwh_mes);
                      return c ? (
                        <p className="text-muted">
                          Consumo anual estimado <b className="text-foreground">{c.toLocaleString('es-ES')} kWh</b>
                        </p>
                      ) : null;
                    })()}
                    {factura.nombre_titular && <p className="text-muted">Titular: <b className="text-foreground">{factura.nombre_titular}</b></p>}
                    {factura.observaciones && <p className="text-amber-300 text-[10px]">⚠️ {factura.observaciones}</p>}
                    <p className="text-[10px] text-muted pt-1">
                      Sale de una sola factura, así que el anual es orientativo. Nicola lo afina en la oficina.
                    </p>
                    <button onClick={() => { setFactura(null); camara.current?.click(); }}
                      className="text-[11px] font-bold text-accent hover:underline">Repetir la foto</button>
                  </div>
                )}
              </div>
            )}

            <label className="block">
              <span className="text-[10px] font-black text-muted uppercase">Algo que contar (opcional)</span>
              <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2}
                placeholder={def.notaPorDefecto}
                className="w-full mt-1 rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-base" />
            </label>

            {error && <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg p-2">⚠️ {error}</p>}

            <button onClick={confirmar} disabled={guardando}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-4 rounded-xl bg-accent text-white text-base font-black hover:opacity-90 transition disabled:opacity-60">
              {guardando ? <><Loader className="w-5 h-5 animate-spin" /> Guardando…</> : <><Check className="w-5 h-5" /> Listo</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
