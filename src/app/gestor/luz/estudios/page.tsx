'use client';

/**
 * ESTUDIOS Y PROPUESTAS (GL-04) — la pantalla que faltaba.
 *
 * El plan lo dice sin rodeos: «el CRM dice "hacer el estudio" o "falta el
 * estudio", pero no ofrece un flujo visible para analizar la factura y
 * convertirla en propuesta». Eso es exactamente lo que pasaba: la factura se
 * leía, se calculaba un ahorro, se hacía un PDF y todo eso se perdía. Lo único
 * que quedaba en el sistema era un número suelto en la oportunidad.
 *
 * El coste de no tenerlo no es el trabajo repetido, es no poder contestar.
 * Cuando el cliente llama dos meses después preguntando por «los 1.400 € que
 * me dijisteis», hay que reconstruir el cálculo de memoria y con los precios
 * de hoy — que ya no son los de entonces.
 *
 * LOS SIETE PASOS DEL PLAN, EN UNA SOLA PANTALLA:
 *
 *   Factura → Extracción → Validación → Análisis → Comparativa → Propuesta
 *   → Seguimiento
 *
 * Aquí vive la LISTA y la entrada al flujo. El flujo en sí está en `flujo.tsx`,
 * porque son dos cosas con vidas distintas: la lista se mira, el flujo se
 * trabaja.
 */

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FileText, Plus, Lock, Search, TrendingUp } from 'lucide-react';
import { fmtEur, fmtFecha, type LuzCliente } from '@/lib/luz';
import { Card, EstadoCarga, btnPrimario, inputCls, useListaLuz } from '../ui';
import { FlujoEstudio, ESTADO_ESTUDIO_LABEL, type Estudio } from './flujo';

export default function EstudiosPage() {
  // useSearchParams obliga a un límite de Suspense en el App Router; sin él la
  // página entera se vuelve dinámica y el build lo dice.
  return (
    <Suspense fallback={null}>
      <Estudios />
    </Suspense>
  );
}

function Estudios() {
  const sp = useSearchParams();
  // Se entra aquí desde «Preparar el estudio» de una tarjeta parada, con el
  // cliente ya decidido: volver a elegirlo sería preguntar algo que ya se sabe.
  const clienteUrl = sp.get('cliente');
  const estudios = useListaLuz<Estudio>('estudios');
  const clientes = useListaLuz<LuzCliente>('clientes');

  const [busca, setBusca] = useState('');
  const [abierto, setAbierto] = useState<Estudio | null>(null);
  const [nuevo, setNuevo] = useState(!!clienteUrl);

  const visibles = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return estudios.datos;
    return estudios.datos.filter((e) =>
      `${e.titulo || ''} ${e.luz_clientes?.nombre || ''}`.toLowerCase().includes(t));
  }, [estudios.datos, busca]);

  // Lo que hay encima de la mesa ahora mismo: solo lo enviado y sin respuesta.
  // El total de todos los estudios incluiría los perdidos y los de hace un año,
  // y sería una cifra grande que no significa nada.
  const enJuego = estudios.datos
    .filter((e) => e.estado === 'propuesta' || e.estado === 'seguimiento')
    .reduce((s, e) => s + (Number(e.ahorro_anual) || 0), 0);

  if (nuevo || abierto) {
    return (
      <FlujoEstudio
        estudio={abierto}
        clientePorDefecto={clienteUrl}
        clientes={clientes.datos}
        alSalir={() => { setNuevo(false); setAbierto(null); estudios.recargar(); }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" /> Estudios y propuestas
          </h1>
          <p className="text-xs text-muted mt-0.5">
            De la factura a la oferta, sin perder por el camino con qué precios se calculó.
          </p>
        </div>
        <button onClick={() => setNuevo(true)} className={btnPrimario}>
          <Plus className="w-4 h-4" /> Preparar estudio
        </button>
      </div>

      <EstadoCarga
        cargando={estudios.cargando}
        error={estudios.error}
        faltaMigracion={estudios.faltaMigracion}
        vacio={false}
        textoVacio=""
        sqlFile="supabase_estudios.sql"
      />

      {!estudios.cargando && !estudios.faltaMigracion && !estudios.error && (
        <>
          {enJuego > 0 && (
            <Card className="!p-4">
              <p className="text-sm font-bold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-sky-400" />
                <span className="tabular-nums">{fmtEur(enJuego)}</span>
                <span className="text-muted font-semibold text-xs">
                  de ahorro propuesto y pendiente de respuesta
                </span>
              </p>
            </Card>
          )}

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className={`${inputCls} pl-9`}
              placeholder="Buscar por cliente o título"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar estudios"
            />
          </div>

          {visibles.length === 0 ? (
            <Card>
              <p className="text-sm text-muted py-4 text-center">
                {estudios.datos.length === 0
                  ? 'Todavía no hay ningún estudio. Empieza por una factura.'
                  : 'Ningún estudio coincide con la búsqueda.'}
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {visibles.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setAbierto(e)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card/60 hover:border-accent/40 transition"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold truncate">
                        {e.luz_clientes?.nombre || e.titulo || 'Sin cliente'}
                      </span>
                      <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full border border-border/50 text-muted">
                        {ESTADO_ESTUDIO_LABEL[e.estado] || e.estado}
                      </span>
                      {(e.version || 1) > 1 && (
                        <span className="text-[10px] font-bold text-muted">v{e.version}</span>
                      )}
                      {e.bloqueado && (
                        <span
                          className="text-[10px] font-bold text-amber-300 flex items-center gap-1"
                          title="Precios congelados: esta propuesta no se recalcula sola"
                        >
                          <Lock className="w-3 h-3" /> precios fijados
                        </span>
                      )}
                    </span>
                    <span className="block text-[11px] text-muted mt-0.5">
                      {fmtFecha(e.creado_en)}
                      {e.luz_cups?.cups ? ` · ${e.luz_cups.alias_suministro || e.luz_cups.cups}` : ''}
                      {e.responsable ? ` · ${e.responsable}` : ''}
                    </span>
                  </span>
                  {Number(e.ahorro_anual) > 0 && (
                    <span className="text-right shrink-0">
                      <span className="block text-sm font-black tabular-nums text-emerald-400">
                        {fmtEur(Number(e.ahorro_anual))}
                      </span>
                      <span className="block text-[10px] text-muted">
                        {Number(e.ahorro_pct || 0).toFixed(1)} % al año
                      </span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <p className="text-[11px] text-muted">
            Cada estudio guarda una copia de los precios con los que se calculó. Por eso una
            propuesta enviada hace dos meses sigue diciendo lo mismo que el día que se envió,
            aunque las tarifas hayan cambiado desde entonces.{' '}
            <Link href="/gestor/luz/tarifas" className="text-accent hover:underline">
              Ver tarifas vigentes →
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
