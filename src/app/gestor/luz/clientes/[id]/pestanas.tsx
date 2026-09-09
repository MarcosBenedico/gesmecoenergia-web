'use client';

/**
 * LA FICHA DE CLIENTE EN CUATRO PESTAÑAS — capa de pantalla.
 *
 * Aquí SOLO se pinta. Qué es un centro, qué trabajos hay abiertos, cuál va
 * primero y cómo se lee el historial lo decide `src/lib/ficha-cliente.ts`, y la
 * fase y el bloqueo salen de `etapas.ts` y `ficha-suministro.ts`. Si esta
 * pantalla calculara algo por su cuenta acabaría diciendo del mismo cliente una
 * cosa distinta que el Pipeline, y no habría forma de saber cuál creer.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUÉ ESTE ASPECTO Y NO OTRO
 *
 * Tablas con cabecera fina, filas altas y líneas de un pelo en vez de tarjetas
 * con borde grueso. La ficha se lee de arriba abajo buscando una cosa concreta,
 * y en ese barrido una rejilla de cajas obliga a fijar la vista en cada una;
 * una tabla se recorre por columnas. El color solo marca el estado, y SIEMPRE
 * con su texto al lado: un punto de color no se ve con sol en la pantalla del
 * móvil, y quien no distingue rojo de ámbar tiene que poder trabajar igual.
 */

import Link from 'next/link';

import {
  AlertTriangle, ArrowRight, Building2, Calendar, ChevronDown, ChevronRight,
  Eye, FileText, Home, MessageSquare, Paperclip, Phone, Plug, Plus, Send,
} from 'lucide-react';
import { fmtKwh, fmtFecha } from '@/lib/luz';
import {
  PESTANAS_CLIENTE, TONO_TRABAJO, CENTRO_SIN_DIRECCION,
  type CentroDerivado, type TrabajoAbierto, type DiaHistorial, type TipoApunte,
} from '@/lib/ficha-cliente';
import { estadoDeSuministro, PRIORIDAD, type EntradaSuministro } from '@/lib/ficha-suministro';
import { Card, btnPrimario, btnSecundario } from '../../ui';

// ── Piezas comunes ──────────────────────────────────────────────────────────

/** Cabecera de tabla: fina, en mayúsculas pequeñas y sin peso visual. */
const th = 'text-left text-[10px] font-bold uppercase tracking-wider text-muted/80 px-3 py-2';
const td = 'px-3 py-3 text-sm align-middle';

/**
 * Un vacío que DICE de qué vacío se trata.
 *
 * «No hay documentos» y «no ha cargado» se parecen en pantalla y significan lo
 * contrario: el primero se cierra tranquilo y el segundo hay que mirarlo.
 */
function Vacio({ texto, pista }: { texto: string; pista?: string }) {
  return (
    <div className="text-center py-10 px-4">
      <p className="text-sm text-muted">{texto}</p>
      {pista && <p className="text-xs text-muted/70 mt-1">{pista}</p>}
    </div>
  );
}

// ── Barra de pestañas ───────────────────────────────────────────────────────

export function BarraPestanas({
  activa, onCambiar, contadores,
}: {
  activa: string;
  onCambiar: (id: string) => void;
  /** Cuántas cosas hay detrás de cada pestaña. Cero no se pinta. */
  contadores?: Record<string, number>;
}) {
  return (
    <div className="border-b border-border/40 -mx-1 px-1 overflow-x-auto">
      <div className="flex gap-1 min-w-max" role="tablist">
        {PESTANAS_CLIENTE.map((p) => {
          const sel = p.id === activa;
          const n = contadores?.[p.id];
          return (
            <button
              key={p.id}
              role="tab"
              aria-selected={sel}
              title={p.pregunta}
              onClick={() => onCambiar(p.id)}
              // 44 px de alto: esto también se toca en el móvil.
              className={`relative min-h-11 px-3.5 text-sm font-bold transition whitespace-nowrap ${
                sel ? 'text-accent' : 'text-muted hover:text-foreground'
              }`}
            >
              {p.titulo}
              {n ? <span className="ml-1.5 text-[11px] font-semibold text-muted/80">{n}</span> : null}
              {sel && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-accent" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Cabecera de la ficha ────────────────────────────────────────────────────

export function CabeceraFicha({
  nombre, responsable, contacto, acciones,
}: {
  nombre: string;
  responsable: string | null;
  contacto: string | null;
  acciones: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <nav className="flex items-center gap-1.5 text-[11px] text-muted mb-1">
          <Link href="/gestor/luz/clientes" className="hover:text-accent">Clientes</Link>
          <span className="text-muted/50">/</span>
          <span className="text-foreground/80 truncate max-w-[18rem]">{nombre}</span>
        </nav>
        <h1 className="text-3xl font-black text-foreground leading-tight break-words">{nombre}</h1>
        {/*
          Dos datos y no ocho: quién lo lleva y a quién se llama. Lo demás
          (NIF, dirección fiscal, vía de entrada) está en Datos del cliente —
          se consulta de tarde en tarde y arriba solo hacía ruido.
        */}
        <p className="text-sm text-muted mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span>
            Responsable:{' '}
            <b className={responsable ? 'text-foreground' : 'text-amber-300'}>
              {responsable || 'sin asignar'}
            </b>
          </span>
          {contacto && (
            <>
              {/* El punto solo separa si las dos cosas caben en la misma línea.
                  En el móvil envolvían y el separador se quedaba colgando al
                  final de la primera, como si faltara algo detrás. */}
              <span className="text-muted/40 hidden sm:inline">·</span>
              <span className="block sm:inline">Contacto: <b className="text-foreground">{contacto}</b></span>
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">{acciones}</div>
    </div>
  );
}

// ── Banda de próxima acción ─────────────────────────────────────────────────

export function BandaProximaAccion({
  texto, contexto, cuando, critica, onVer, onCrear,
}: {
  texto: string | null;
  contexto: string | null;
  cuando: string;
  critica: boolean;
  onVer: () => void;
  onCrear: () => void;
}) {
  /*
   * SIN SIGUIENTE ACCIÓN NO SE CALLA.
   *
   * Es la regla madre del control de cartera: un cliente vivo sin nadie detrás
   * es por donde se cae. Dejar la banda en blanco lo haría parecer resuelto.
   */
  if (!texto) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/[0.06] p-4 flex items-center gap-3 flex-wrap">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-300">Sin próxima acción</p>
          <p className="text-sm font-bold text-foreground">Este cliente no tiene nada programado</p>
        </div>
        <button onClick={onCrear} className={btnPrimario}>
          <Plus className="w-4 h-4" /> Poner una acción
        </button>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-4 flex items-center gap-3 flex-wrap ${
      critica ? 'border-red-500/40 bg-red-500/[0.06]' : 'border-emerald-500/30 bg-emerald-500/[0.05]'
    }`}>
      <Calendar className={`w-5 h-5 shrink-0 ${critica ? 'text-red-400' : 'text-emerald-400'}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-[11px] font-bold uppercase tracking-wide ${critica ? 'text-red-300' : 'text-emerald-300'}`}>
          Próxima acción
        </p>
        <p className="text-base font-bold text-foreground leading-snug">{texto}</p>
        <p className="text-xs text-muted mt-0.5">
          {[contexto, cuando].filter(Boolean).join(' · ')}
        </p>
      </div>
      <button onClick={onVer} className={`${btnSecundario} !bg-transparent`}>
        Ver tarea <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Trabajos abiertos ───────────────────────────────────────────────────────

export function TablaTrabajos({
  trabajos, onAbrir, onNuevo,
}: {
  trabajos: TrabajoAbierto[];
  onAbrir: (t: TrabajoAbierto) => void;
  onNuevo: () => void;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="text-lg font-black text-foreground">Trabajos abiertos</h2>
        <button onClick={onNuevo} className="text-sm font-bold text-accent hover:underline inline-flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Nuevo trabajo
        </button>
      </div>

      <Card className="!p-0 overflow-hidden">
        {trabajos.length === 0 ? (
          <Vacio
            texto="No hay ningún trabajo abierto con este cliente."
            pista="Ni oportunidades en curso ni expedientes energéticos."
          />
        ) : (
          <>
          {/*
            EN MÓVIL NO HAY TABLA, HAY BLOQUES.
            Medido en la vista previa: con 390 px, «Situación» y «Próximo paso»
            se quedaban fuera de la pantalla — justo las dos columnas por las
            que se abre esto. Un scroll horizontal dentro de una tarjeta no se
            ve y no se busca, así que la fila se leía a medias y en silencio.
          */}
          <ul className="md:hidden divide-y divide-border/20">
            {trabajos.map((t) => {
              const tono = TONO_TRABAJO[t.tono];
              return (
                <li key={`m-${t.origen}-${t.id}`}>
                  <button
                    onClick={() => onAbrir(t)}
                    className="w-full text-left px-4 py-3.5 active:bg-card/60 transition"
                  >
                    <span className="flex items-start gap-2.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${tono.punto}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-foreground">{t.trabajo}</span>
                        <span className="block text-xs text-muted mt-0.5">
                          {[t.centro, t.situacion].filter(Boolean).join(' · ')}
                        </span>
                        {t.bloqueo && (
                          <span className="block text-[11px] text-amber-300/90 mt-1">{t.bloqueo}</span>
                        )}
                        <span className="block text-xs mt-1.5">
                          {t.proximoPaso ? (
                            <span className="text-muted">
                              {[t.proximoPaso.responsable || 'sin asignar', t.proximoPaso.cuando].filter(Boolean).join(' · ')}
                            </span>
                          ) : t.tono === 'pausado' ? (
                            <span className="text-muted">Aparcado, sin fecha de vuelta</span>
                          ) : (
                            <span className="text-red-300 font-semibold">Nadie, sin fecha</span>
                          )}
                        </span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-1" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[46rem]">
              <thead>
                <tr className="border-b border-border/40">
                  <th className={th}>Trabajo</th>
                  <th className={th}>Centro</th>
                  <th className={th}>Situación</th>
                  <th className={th}>Próximo paso</th>
                  <th className={`${th} w-10`} />
                </tr>
              </thead>
              <tbody>
                {trabajos.map((t) => {
                  const tono = TONO_TRABAJO[t.tono];
                  return (
                    <tr key={`${t.origen}-${t.id}`} className="border-b border-border/20 last:border-0 hover:bg-card/50 transition">
                      <td className={`${td} font-bold text-foreground`}>
                        {t.trabajo}
                        {/*
                          El bloqueo dice QUÉ falta, nunca «pendiente»: lo
                          primero se resuelve, lo segundo hay que investigarlo.
                        */}
                        {t.bloqueo && (
                          <span className="block text-[11px] font-normal text-amber-300/90 mt-0.5">{t.bloqueo}</span>
                        )}
                      </td>
                      <td className={`${td} text-muted`}>{t.centro || '—'}</td>
                      <td className={td}>
                        <span className="inline-flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${tono.punto}`} />
                          <span className="text-foreground/90">{t.situacion}</span>
                        </span>
                        {/* El color acompaña; el texto es el que informa. */}
                        <span className={`block text-[11px] mt-0.5 ${tono.fila}`}>{tono.texto}</span>
                      </td>
                      <td className={td}>
                        {t.proximoPaso ? (
                          <span className="text-muted">
                            {[t.proximoPaso.responsable || 'sin asignar', t.proximoPaso.cuando]
                              .filter(Boolean).join(' · ')}
                          </span>
                        ) : t.tono === 'pausado' ? (
                          // Aparcado a propósito NO es un descolgado: pintarlo
                          // en rojo desmiente el «parado a propósito» de al
                          // lado, y una fila que se contradice deja de leerse.
                          <span className="text-muted">Aparcado, sin fecha de vuelta</span>
                        ) : (
                          <span className="text-red-300 font-semibold">Nadie, sin fecha</span>
                        )}
                      </td>
                      <td className={`${td} text-right`}>
                        <button
                          onClick={() => onAbrir(t)}
                          aria-label={`Abrir ${t.trabajo}`}
                          className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>
    </section>
  );
}

// ── Centros: resumen compacto ───────────────────────────────────────────────

const IconoCentro = ({ n }: { n: number }) =>
  n > 1
    ? <Building2 className="w-4 h-4 text-muted" />
    : <Home className="w-4 h-4 text-muted" />;

export function TablaCentrosResumen({
  centros, onVerTodos, onAbrirCentro,
}: {
  centros: CentroDerivado[];
  onVerTodos: () => void;
  onAbrirCentro: (c: CentroDerivado) => void;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="text-lg font-black text-foreground">Centros y suministros</h2>
        <button onClick={onVerTodos} className="text-sm font-bold text-accent hover:underline inline-flex items-center gap-1.5">
          Ver todos los centros <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <Card className="!p-0 overflow-hidden">
        {centros.length === 0 ? (
          <Vacio
            texto="Este cliente todavía no tiene suministros."
            pista="Sin CUPS no se puede tramitar un cambio ni contar el preaviso."
          />
        ) : (
          <>
          {/* Mismo motivo que en Trabajos: con 390 px la columna del número de
              suministros se salía y la dirección quedaba cortada a la mitad. */}
          <ul className="md:hidden divide-y divide-border/20">
            {centros.map((c) => (
              <li key={`m-${c.clave}`}>
                <button
                  onClick={() => onAbrirCentro(c)}
                  className="w-full text-left px-4 py-3.5 flex items-start gap-2.5 active:bg-card/60 transition"
                >
                  <IconoCentro n={c.suministros.length} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-foreground">{c.nombre}</span>
                    <span className="block text-xs text-muted">
                      {c.clave === CENTRO_SIN_DIRECCION
                        ? 'Falta la dirección: no entra en las rutas'
                        : [String(c.direccion || '').split(/[,\n]/)[0], c.municipio].filter(Boolean).join(' · ')}
                    </span>
                    <span className="block text-xs text-muted mt-1">
                      {c.suministros.length === 1 ? '1 suministro' : `${c.suministros.length} suministros`}
                      {c.conAlerta > 0 && (
                        <span className="text-amber-300">
                          {' · '}{c.conAlerta === 1 ? '1 reclama algo' : `${c.conAlerta} reclaman algo`}
                        </span>
                      )}
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                </button>
              </li>
            ))}
          </ul>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[40rem]">
              <thead>
                <tr className="border-b border-border/40">
                  <th className={th}>Centro</th>
                  <th className={th}>Dirección</th>
                  <th className={`${th} text-right`}>N.º suministros</th>
                  <th className={`${th} w-10`} />
                </tr>
              </thead>
              <tbody>
                {centros.map((c) => (
                  <tr key={c.clave} className="border-b border-border/20 last:border-0 hover:bg-card/50 transition">
                    <td className={td}>
                      <span className="inline-flex items-center gap-2.5">
                        <IconoCentro n={c.suministros.length} />
                        <span className="font-bold text-foreground">{c.nombre}</span>
                      </span>
                      {c.conAlerta > 0 && (
                        <span className="block text-[11px] text-amber-300 mt-0.5 pl-6">
                          {c.conAlerta === 1 ? '1 suministro reclama algo' : `${c.conAlerta} suministros reclaman algo`}
                        </span>
                      )}
                    </td>
                    <td className={`${td} text-muted`}>
                      {c.clave === CENTRO_SIN_DIRECCION ? (
                        // Sin dirección no entra en las rutas ni se agrupa por
                        // zona: es un hueco que rellenar, no un detalle.
                        <span className="text-amber-300">Falta la dirección: no entra en las rutas</span>
                      ) : (
                        <>
                          <span className="block">{String(c.direccion || '').split(/[,\n]/)[0]}</span>
                          {c.municipio && <span className="block text-[11px] text-muted/70">{c.municipio}</span>}
                        </>
                      )}
                    </td>
                    <td className={`${td} text-right tabular-nums font-semibold text-foreground`}>
                      {c.suministros.length}
                    </td>
                    <td className={`${td} text-right`}>
                      <button
                        onClick={() => onAbrirCentro(c)}
                        aria-label={`Abrir ${c.nombre}`}
                        className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>
    </section>
  );
}

// ── Centros: pestaña completa ───────────────────────────────────────────────

export function PanelCentros({
  centros, hoy, abierto, onAlternar, onAbrirSuministro, onAnadirSuministro,
}: {
  centros: CentroDerivado[];
  hoy: string;
  abierto: string | null;
  onAlternar: (clave: string) => void;
  onAbrirSuministro: (s: EntradaSuministro) => void;
  onAnadirSuministro: (c: CentroDerivado) => void;
}) {
  const totalSum = centros.reduce((s, c) => s + c.suministros.length, 0);

  if (!centros.length) {
    return (
      <Card>
        <Vacio
          texto="Este cliente todavía no tiene suministros."
          pista="Un estudio sin CUPS es un cálculo suelto: no se puede tramitar el cambio ni cuenta el preaviso."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        {centros.length === 1 ? '1 centro' : `${centros.length} centros`} ·{' '}
        {totalSum === 1 ? '1 suministro' : `${totalSum} suministros`}.
        {' '}Los centros salen de la dirección de cada suministro: no hay que crearlos.
      </p>

      {centros.map((c) => {
        const abierta = abierto === c.clave;
        return (
          <Card key={c.clave} className="!p-0 overflow-hidden">
            <button
              onClick={() => onAlternar(c.clave)}
              aria-expanded={abierta}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-card/60 transition"
            >
              <IconoCentro n={c.suministros.length} />
              <span className="min-w-0 flex-1">
                <span className="block font-black text-foreground">{c.nombre}</span>
                <span className="block text-xs text-muted truncate">
                  {c.clave === CENTRO_SIN_DIRECCION
                    ? 'Sin dirección: no entra en las rutas ni se agrupa por zona'
                    : [String(c.direccion || '').split(/[,\n]/)[0], c.municipio].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="text-xs text-muted shrink-0 hidden sm:block">
                {c.suministros.length === 1 ? '1 suministro' : `${c.suministros.length} suministros`}
              </span>
              {abierta ? <ChevronDown className="w-4 h-4 text-muted shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted shrink-0" />}
            </button>

            {abierta && (
              <div className="border-t border-border/30">
                {/* Cinco columnas no caben en un móvil: apiladas, cada
                    suministro cabe entero y se toca con el pulgar. */}
                <ul className="md:hidden divide-y divide-border/20">
                  {c.suministros.map((s) => {
                    const e = estadoDeSuministro(s, hoy);
                    return (
                      <li key={`m-${s.id}`}>
                        <button
                          onClick={() => onAbrirSuministro(s)}
                          className="w-full text-left px-4 py-3.5 flex items-start gap-2.5 active:bg-card/60 transition"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block font-bold text-foreground">
                              {s.alias || `CUPS …${String(s.cups).slice(-6)}`}
                            </span>
                            <span className="block text-[11px] text-muted font-mono">
                              {s.tarifa || 'sin tarifa'} · CUPS …{String(s.cups).slice(-6)}
                            </span>
                            <span className="block text-xs text-muted mt-1">
                              {s.consumoAnual ? fmtKwh(s.consumoAnual) : <span className="text-amber-300">Falta el consumo</span>}
                              {' · '}{e.fase}
                            </span>
                            {e.preaviso.situacion === 'no_calculable' && (
                              <span className="block text-[11px] text-amber-300 mt-0.5">Falta verificar la fecha de fin</span>
                            )}
                          </span>
                          <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-[44rem]">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className={th}>Suministro</th>
                        <th className={th}>Tarifa</th>
                        <th className={`${th} text-right`}>Consumo anual</th>
                        <th className={th}>Estado</th>
                        <th className={th}>Próxima revisión</th>
                        <th className={`${th} w-10`} />
                      </tr>
                    </thead>
                    <tbody>
                      {c.suministros.map((s) => {
                        const e = estadoDeSuministro(s, hoy);
                        return (
                          <tr key={s.id} className="border-b border-border/20 last:border-0 hover:bg-card/40 transition">
                            <td className={td}>
                              <span className="block font-bold text-foreground">
                                {s.alias || `CUPS …${String(s.cups).slice(-6)}`}
                              </span>
                              <span className="block text-[11px] text-muted font-mono">
                                Luz · CUPS …{String(s.cups).slice(-6)}
                              </span>
                            </td>
                            <td className={`${td} text-muted`}>{s.tarifa || '—'}</td>
                            <td className={`${td} text-right tabular-nums text-foreground`}>
                              {s.consumoAnual ? fmtKwh(s.consumoAnual) : <span className="text-amber-300">Falta</span>}
                            </td>
                            <td className={td}>
                              <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-bold ${PRIORIDAD[e.prioridad].tono}`}>
                                {e.fase}
                              </span>
                            </td>
                            <td className={td}>
                              {/*
                                El preaviso viene ya resuelto de
                                `ficha-suministro.ts`, incluido el caso de que
                                NO se pueda calcular — que en más de media
                                cartera es lo que pasa y antes no se decía.
                              */}
                              {e.preaviso.situacion === 'no_calculable' ? (
                                <span className="text-amber-300">Falta verificar la fecha</span>
                              ) : e.preaviso.situacion === 'no_aplica' ? (
                                <span className="text-muted/70">—</span>
                              ) : (
                                <span className={e.preaviso.situacion === 'lejano' ? 'text-muted' : 'text-amber-300'}>
                                  {fmtFecha(s.fechaLimitePreaviso)}
                                </span>
                              )}
                            </td>
                            <td className={`${td} text-right`}>
                              <button
                                onClick={() => onAbrirSuministro(s)}
                                aria-label={`Abrir ${s.alias || s.cups}`}
                                className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="px-4 py-2.5 border-t border-border/20">
                  <button
                    onClick={() => onAnadirSuministro(c)}
                    className="text-sm font-bold text-accent hover:underline inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Añadir suministro a {c.nombre}
                  </button>
                </div>

                {/* Lo que falta se dice AQUÍ, junto a la fila que lo tiene mal,
                    y no en un aviso general: un aviso al pie hay que traducirlo
                    a qué suministro se refiere, y eso no se hace. */}
                {c.suministros
                  .map((s) => ({ s, e: estadoDeSuministro(s, hoy) }))
                  .filter(({ e }) => e.bloqueo || e.preaviso.situacion === 'no_calculable')
                  .map(({ s, e }) => (
                    <div key={`aviso-${s.id}`} className="flex items-start gap-2.5 px-4 py-2.5 border-t border-amber-500/20 bg-amber-500/[0.05]">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-200/90 min-w-0 flex-1">
                        <b className="text-foreground">{s.alias || `…${String(s.cups).slice(-6)}`}:</b>{' '}
                        {e.bloqueo || e.preaviso.queFalta || e.preaviso.texto}
                      </p>
                      <button onClick={() => onAbrirSuministro(s)} className="text-xs font-bold text-accent hover:underline shrink-0">
                        Completar
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ── Documentos ──────────────────────────────────────────────────────────────

export interface FilaDocumento {
  id: string;
  titulo: string;
  tipo: string | null;
  subidoPor: string | null;
  contexto: string | null;
  periodo: string | null;
  estado: string | null;
}

const REVISION: Record<string, { texto: string; punto: string; color: string }> = {
  por_revisar: { texto: 'Por revisar', punto: 'bg-amber-400', color: 'text-amber-300' },
  verificado: { texto: 'Verificado', punto: 'bg-emerald-400', color: 'text-emerald-400' },
  archivado: { texto: 'Archivado', punto: 'bg-slate-500', color: 'text-muted' },
};

export function PanelDocumentos({
  documentos, cargando, soloPendientes, onAlternarPendientes, onSubir, onVer,
}: {
  documentos: FilaDocumento[];
  cargando: boolean;
  soloPendientes: boolean;
  onAlternarPendientes: () => void;
  onSubir: () => void;
  onVer: (d: FilaDocumento) => void;
}) {
  const pendientes = documentos.filter((d) => d.estado === 'por_revisar').length;
  const lista = soloPendientes ? documentos.filter((d) => d.estado === 'por_revisar') : documentos;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted">
          {documentos.length === 1 ? '1 archivo' : `${documentos.length} archivos`}
          {pendientes > 0 && <> · <b className="text-amber-300">{pendientes} pendientes de revisar</b></>}
        </p>
        {pendientes > 0 && (
          <button
            onClick={onAlternarPendientes}
            className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border transition ${
              soloPendientes ? 'bg-accent text-white border-accent' : 'bg-card/80 text-muted border-border/50 hover:text-foreground'
            }`}
          >
            Pendientes de revisar ({pendientes})
          </button>
        )}
      </div>

      <button
        onClick={onSubir}
        className="w-full rounded-2xl border border-dashed border-accent/40 bg-accent/[0.04] px-4 py-6 text-center transition hover:bg-accent/[0.08]"
      >
        <Paperclip className="w-5 h-5 text-accent mx-auto mb-1.5" />
        <span className="block text-sm font-bold text-foreground">Añadir un documento</span>
        <span className="block text-xs text-muted mt-0.5">Factura, contrato, propuesta o justificante</span>
      </button>

      <Card className="!p-0 overflow-hidden">
        {cargando ? (
          <Vacio texto="Cargando los documentos…" />
        ) : lista.length === 0 ? (
          <Vacio
            texto={soloPendientes ? 'No queda ningún documento por revisar.' : 'Todavía no hay documentos de este cliente.'}
            pista={soloPendientes ? undefined : 'La factura es el papel que desbloquea el estudio y la oferta.'}
          />
        ) : (
          <>
          <ul className="md:hidden divide-y divide-border/20">
            {lista.map((d) => {
              const r = REVISION[d.estado || ''] || REVISION.por_revisar;
              return (
                <li key={`m-${d.id}`}>
                  <button onClick={() => onVer(d)} className="w-full text-left px-4 py-3.5 flex items-start gap-2.5 active:bg-card/60 transition">
                    <FileText className="w-4 h-4 text-red-400/80 shrink-0 mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-foreground break-all">{d.titulo}</span>
                      <span className="block text-[11px] text-muted">
                        {[d.tipo?.replace(/_/g, ' '), d.contexto, d.periodo].filter(Boolean).join(' · ')}
                      </span>
                      <span className={`block text-[11px] mt-1 ${r.color}`}>{r.texto}</span>
                    </span>
                    <Eye className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[44rem]">
              <thead>
                <tr className="border-b border-border/40">
                  <th className={th}>Documento</th>
                  <th className={th}>Contexto</th>
                  <th className={th}>Periodo o versión</th>
                  <th className={th}>Revisión</th>
                  <th className={`${th} w-10`} />
                </tr>
              </thead>
              <tbody>
                {lista.map((d) => {
                  const r = REVISION[d.estado || ''] || REVISION.por_revisar;
                  return (
                    <tr key={d.id} className="border-b border-border/20 last:border-0 hover:bg-card/50 transition">
                      <td className={td}>
                        <span className="inline-flex items-start gap-2.5">
                          <FileText className="w-4 h-4 text-red-400/80 shrink-0 mt-0.5" />
                          <span className="min-w-0">
                            <span className="block font-bold text-foreground break-all">{d.titulo}</span>
                            <span className="block text-[11px] text-muted">
                              {[d.tipo?.replace(/_/g, ' '), d.subidoPor ? `Subido por ${d.subidoPor}` : null]
                                .filter(Boolean).join(' · ')}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className={`${td} text-muted`}>{d.contexto || '—'}</td>
                      <td className={`${td} text-muted`}>{d.periodo || '—'}</td>
                      <td className={td}>
                        <span className="inline-flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${r.punto}`} />
                          <span className={r.color}>{r.texto}</span>
                        </span>
                      </td>
                      <td className={`${td} text-right`}>
                        <button
                          onClick={() => onVer(d)}
                          aria-label={`Ver ${d.titulo}`}
                          className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>
    </div>
  );
}

// ── Historial ───────────────────────────────────────────────────────────────

const ICONO_APUNTE: Record<TipoApunte, typeof FileText> = {
  visita: Plug,
  llamada: Phone,
  documento: FileText,
  propuesta: Send,
  contrato: FileText,
  tarea: MessageSquare,
  cambio: MessageSquare,
};

export function PanelHistorial({
  dias, verSistema, onAlternarSistema, busca, onBuscar, total,
}: {
  dias: DiaHistorial[];
  verSistema: boolean;
  onAlternarSistema: () => void;
  busca: string;
  onBuscar: (v: string) => void;
  total: number;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-foreground">Historial</h2>
        <p className="text-xs text-muted mt-0.5">Gestiones, documentos y acuerdos del cliente.</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={busca}
          onChange={(e) => onBuscar(e.target.value)}
          placeholder="Buscar en el historial…"
          className="flex-1 min-w-48 rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-sm"
        />
        {/*
          Los cambios del sistema vienen APAGADOS. Un «se modificó el campo
          observaciones» junto a «el cliente dijo que se lo piensa» hace que el
          segundo no se lea: misma tipografía y solo uno importa. Pero no se
          borran, porque el día que hay que reconstruir qué pasó son lo único
          que queda.
        */}
        <label className="inline-flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
          <input type="checkbox" checked={verSistema} onChange={onAlternarSistema} className="w-4 h-4" />
          Mostrar cambios del sistema
        </label>
      </div>

      {dias.length === 0 ? (
        <Card>
          <Vacio
            texto={total === 0 ? 'Todavía no hay nada apuntado de este cliente.' : 'Nada coincide con lo que buscas.'}
            pista={total === 0 ? 'Registrar una visita o subir una factura empieza el historial.' : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {dias.map((d) => (
            <div key={d.fecha}>
              <p className="text-sm font-black text-foreground mb-2">
                {d.etiqueta}
                {d.etiqueta === 'Hoy' || d.etiqueta === 'Ayer' ? (
                  <span className="font-normal text-muted"> · {fmtFecha(d.fecha)}</span>
                ) : null}
              </p>
              <Card className="!p-0 overflow-hidden">
                {d.apuntes.map((a, i) => {
                  const Icono = ICONO_APUNTE[a.tipo];
                  return (
                    <div
                      key={a.id}
                      className={`flex items-start gap-3 px-4 py-3.5 ${i ? 'border-t border-border/20' : ''} ${
                        a.delSistema ? 'opacity-70' : ''
                      }`}
                    >
                      <span className="shrink-0 text-right w-14">
                        <span className="block text-[11px] tabular-nums text-muted">{a.hora || '—'}</span>
                        <span className="block text-[11px] text-muted/70 truncate">{a.autor || ''}</span>
                      </span>
                      <span className="w-8 h-8 shrink-0 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
                        <Icono className="w-4 h-4 text-accent" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-foreground">{a.titulo}</span>
                        {a.contexto && <span className="block text-[11px] text-muted">{a.contexto}</span>}
                        {a.detalle && <span className="block text-xs text-muted mt-0.5 leading-relaxed">{a.detalle}</span>}
                        {a.adjunto && (
                          <span className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-lg bg-accent/10 border border-accent/20 text-[11px] font-semibold text-accent">
                            <Paperclip className="w-3 h-3" /> {a.adjunto.nombre}
                          </span>
                        )}
                        {a.siguientePaso && (
                          <span className="block text-[11px] text-muted/80 mt-1.5">
                            Siguiente paso: {a.siguientePaso}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
