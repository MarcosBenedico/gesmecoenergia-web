'use client';

/**
 * REGISTRAR UNA VISITA DESDE CUALQUIER SITIO.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * EL PROBLEMA QUE RESUELVE, MEDIDO
 *
 * La auditoría encontró CERO visitas registradas en 30 días. No porque David
 * no salga —sale tres días por semana— sino porque registrarla costaba esto:
 *
 *   abrir la app > Mi Día > cambiar a la vista «Por zona» > desplegar la zona
 *   > encontrar al cliente en la lista > pulsar «resolver visita» > resultado
 *
 * Seis pasos. Y uno de ellos era imposible la mitad de las veces: EL CLIENTE
 * TENÍA QUE ESTAR YA EN LA RUTA DE HOY. Si David pasaba por una granja que no
 * estaba planificada —que es media calle— no había forma de apuntarlo sin
 * crearla antes.
 *
 * Así que la hoja de resolver la visita estaba muy bien hecha (cuatro botones
 * enormes, sin escribir nada) y enterrada detrás de una planificación que no
 * se hacía. La herramienta buena, en el sitio malo.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AHORA: DOS TOQUES DESDE DONDE SEA
 *
 * Botón «+ Capturar» > «Registrar visita» > se busca el cliente > los cuatro
 * botones de siempre. Sin planificación previa y sin salir de lo que estabas
 * mirando.
 *
 * Y SI EL CLIENTE NO EXISTE, se ofrece darlo de alta ahí mismo en vez de
 * dejar a David en un callejón sin salida: en la calle, «no está en el
 * sistema» significa que se pierde la visita entera.
 *
 * NO REPITE LA LÓGICA de `resolver-visita.tsx`: cuando hay cliente elegido, le
 * pasa el control. Duplicar los cuatro botones aquí acabaría con dos hojas que
 * hacen cosas distintas al pulsar «no le interesa».
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, X, UserPlus, MapPin } from 'lucide-react';
import { LuzCliente, LuzOportunidad, PIPELINE_CERRADO } from '@/lib/luz';
import { ResolverVisita } from './resolver-visita';
import { useListaLuz, inputCls, btnSecundario } from './ui';

interface Props {
  responsable?: string | null;
  onCerrar: () => void;
}

/** Cuántos se enseñan sin buscar: la lista entera son 306 y no se lee de pie. */
const TOPE = 8;

export function VisitaRapida({ responsable, onCerrar }: Props) {
  const clientes = useListaLuz<LuzCliente>('clientes');
  const pipeline = useListaLuz<LuzOportunidad>('pipeline');

  const [busca, setBusca] = useState('');
  const [elegido, setElegido] = useState<LuzCliente | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  // El foco va al buscador al abrir: en el móvil eso levanta el teclado y
  // ahorra un toque, y en el escritorio se puede teclear directamente.
  useEffect(() => { campo.current?.focus(); }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onCerrar]);

  /**
   * A quién se ofrece antes de buscar.
   *
   * NO es la lista alfabética: son los que tienen una oportunidad abierta, que
   * son a quienes se visita. Ordenados por el último movimiento, porque el que
   * lleva más tiempo parado es justo el que se acaba de visitar para
   * desatascarlo.
   */
  const sugeridos = useMemo(() => {
    const abiertos = new Set(
      pipeline.datos
        .filter((o) => !PIPELINE_CERRADO.includes(o.estado) && o.cliente_id)
        .map((o) => o.cliente_id as string));
    return clientes.datos
      .filter((c) => abiertos.has(c.id))
      .sort((a, b) => String(a.actualizado_en || '').localeCompare(String(b.actualizado_en || '')))
      .slice(0, TOPE);
  }, [clientes.datos, pipeline.datos]);

  const resultados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return sugeridos;
    return clientes.datos
      .filter((c) => `${c.nombre} ${c.nif || ''} ${c.direccion_fiscal || ''}`.toLowerCase().includes(q))
      .slice(0, TOPE);
  }, [busca, clientes.datos, sugeridos]);

  /** La oportunidad abierta del cliente, para que la visita mueva el embudo. */
  const oportunidadDe = (clienteId: string) =>
    pipeline.datos.find((o) => o.cliente_id === clienteId && !PIPELINE_CERRADO.includes(o.estado))?.id || null;

  // Con cliente elegido manda la hoja de siempre: aquí no se decide nada más.
  if (elegido) {
    return (
      <ResolverVisita
        clienteId={elegido.id}
        clienteNombre={elegido.nombre}
        responsable={responsable}
        pipelineId={oportunidadDe(elegido.id)}
        onHecho={onCerrar}
        onCerrar={() => setElegido(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
      <button
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Registrar una visita"
        className="relative w-full sm:max-w-md bg-background border-t sm:border border-border sm:rounded-2xl shadow-2xl max-h-[88vh] flex flex-col"
      >
        <div className="flex items-center gap-3 p-4 border-b border-border/50">
          <MapPin className="w-5 h-5 text-accent shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-base font-black leading-tight">Registrar visita</span>
            <span className="block text-[11px] text-muted">¿A quién has visitado?</span>
          </span>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="h-11 w-11 shrink-0 flex items-center justify-center rounded-full border border-border bg-card"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 pb-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              ref={campo}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nombre, NIF o dirección…"
              // 48 px de alto: se teclea de pie y con una mano.
              className={`${inputCls} !pl-9 !h-12 !text-base`}
            />
          </div>
          {!busca && sugeridos.length > 0 && (
            <p className="text-[11px] text-muted mt-2">
              Con oportunidad abierta, empezando por los más parados.
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {clientes.cargando ? (
            <p className="text-sm text-muted py-6 text-center">Cargando la cartera…</p>
          ) : resultados.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted mb-3">
                {busca ? 'Ningún cliente con ese nombre.' : 'No hay oportunidades abiertas.'}
              </p>
              {/* Sin salida no se registra la visita: se pierde entera. */}
              <Link href="/gestor/luz/alta" onClick={onCerrar} className={btnSecundario}>
                <UserPlus className="w-4 h-4" /> Darlo de alta primero
              </Link>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {resultados.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setElegido(c)}
                    // 56 px: el objetivo de toque de toda la pantalla de calle.
                    className="w-full min-h-14 flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/50 bg-card/70 text-left hover:border-accent/50 active:scale-[0.99] transition"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-foreground truncate">{c.nombre}</span>
                      <span className="block text-[11px] text-muted truncate">
                        {c.direccion_fiscal || c.nif || 'Sin dirección'}
                      </span>
                    </span>
                    {oportunidadDe(c.id) && (
                      <span className="text-[10px] font-bold text-accent shrink-0 px-1.5 py-0.5 rounded-md border border-accent/30">
                        ABIERTA
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
