'use client';

/**
 * LA PRIMERA PANTALLA DE LA FICHA DE CLIENTE.
 *
 * El documento de rediseño fija el listón: al abrir un cliente hay que
 * entender en menos de diez segundos quién es, qué hay que hacer ahora,
 * cuántos suministros tiene y cuál reclama atención — sin desplazarse.
 *
 * LO QUE HABÍA Y POR QUÉ NO LLEGABA
 *
 * La cabecera metía en la misma caja el nombre, tres etiquetas, el NIF, el
 * selector de clasificación, CUATRO indicadores, la foto del sitio, ocho
 * campos de contacto y los botones. Y los SUMINISTROS —que son la unidad real
 * de trabajo— salían en quinto lugar, detrás de Próxima acción, Zona, Visitas
 * y Seguimiento. Para saber si un cliente necesitaba algo había que bajar.
 *
 * LAS TRES REGLAS QUE ORDENAN ESTE ARCHIVO
 *
 * 1. UNA INFORMACIÓN, UN SITIO. El consumo, el CUPS, la tarifa y la
 *    comercializadora son del SUMINISTRO y ya no salen agregados arriba. Un
 *    «consumo total del cliente» de 300.000 kWh es una cifra bonita que no
 *    cambia lo que se hace hoy.
 * 2. LA ACCIÓN MANDA SOBRE EL DATO. La banda de «Siguiente acción» va antes
 *    que cualquier tabla, y dice UNA cosa con su contexto y su fecha.
 * 3. EL COLOR REFUERZA, NO SUSTITUYE. Cada estado lleva su texto. Rojo solo
 *    para bloqueo, vencimiento o riesgo real.
 *
 * Todo el criterio de qué es urgente vive en `src/lib/ficha-suministro.ts`,
 * no aquí: esta es la capa que pinta.
 */

import Link from 'next/link';
import {
  AlertTriangle, ArrowRight, Check, ChevronRight, Copy, FileText, Mail,
  MapPin, Phone, Plug, Plus, Zap,
} from 'lucide-react';
import { useState } from 'react';
import { TIPO_CLIENTE_LABEL, type LuzCliente, type LuzCups } from '@/lib/luz';
import {
  estadoDeSuministro, siguienteAccion, resumenOperativo, ordenarSuministros,
  comoSeLee, PRIORIDAD,
  type EntradaSuministro, type EstadoSuministro,
} from '@/lib/ficha-suministro';
import { Card, btnPrimario, btnSecundario } from '../../ui';

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Una fecha en formato humano: hoy, ayer, hace 3 días. */
export function haceCuanto(iso: string | null | undefined): string {
  if (!iso) return 'sin actividad';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 'sin actividad';
  const dias = Math.round((Date.now() - d.getTime()) / 86400000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;
  if (dias < 365) return `hace ${Math.round(dias / 30)} meses`;
  return `hace ${Math.round(dias / 365)} años`;
}

// ── Cabecera ────────────────────────────────────────────────────────────────

/**
 * Solo lo que identifica o permite contactar.
 *
 * El documento lo prohíbe expresamente: aquí no van CUPS, tarifa,
 * comercializadora, potencia, consumo ni vencimiento. Son datos de suministro
 * y repetirlos arriba es lo que hacía que hubiera que leerlo todo para saber
 * de qué se estaba hablando.
 */
export function CabeceraCliente({
  cliente, onNuevaTarea, onAnadirSuministro, acciones,
}: {
  cliente: LuzCliente;
  onNuevaTarea: () => void;
  onAnadirSuministro: () => void;
  /** Editar, eliminar y demás: van detrás, no compiten con lo primario. */
  acciones?: React.ReactNode;
}) {
  const tel = (cliente.telefono || '').replace(/\s/g, '');

  return (
    <div className="space-y-3">
      <nav className="text-[11px] text-muted flex items-center gap-1.5" aria-label="Migas de pan">
        <Link href="/gestor/luz/clientes" className="hover:text-foreground transition">Clientes</Link>
        <span aria-hidden="true">/</span>
        <span className="text-foreground font-semibold truncate">{cliente.nombre}</span>
      </nav>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h1 className="text-2xl sm:text-3xl font-black text-foreground leading-tight min-w-0">
          {cliente.nombre}
        </h1>
        <div className="flex items-center gap-2 shrink-0">
          {acciones}
          <button onClick={onNuevaTarea} className={btnSecundario}>
            <Plus className="w-4 h-4" /> Nueva tarea
          </button>
          <button onClick={onAnadirSuministro} className={btnPrimario}>
            <Plus className="w-4 h-4" /> Añadir suministro
          </button>
        </div>
      </div>

      {/* Identidad y contacto en una sola línea de fichas, no en ocho filas */}
      <div className="flex items-center gap-x-4 gap-y-2 flex-wrap text-xs">
        <span className="px-2 py-1 rounded-lg bg-card/70 border border-border/40 font-bold text-[11px]">
          {TIPO_CLIENTE_LABEL[cliente.tipo_cliente] || cliente.tipo_cliente}
        </span>
        <span className="text-muted">NIF <b className="text-foreground font-semibold">{cliente.nif || '—'}</b></span>

        {tel ? (
          <a href={`tel:${tel}`} className="flex items-center gap-1.5 text-muted hover:text-accent transition">
            <Phone className="w-3.5 h-3.5" /> <span className="font-semibold text-foreground">{cliente.telefono}</span>
          </a>
        ) : (
          <span className="flex items-center gap-1.5 text-amber-300">
            <Phone className="w-3.5 h-3.5" /> Sin teléfono
          </span>
        )}

        {cliente.email ? (
          <a href={`mailto:${cliente.email}`} className="flex items-center gap-1.5 text-muted hover:text-accent transition">
            <Mail className="w-3.5 h-3.5" /> <span className="font-semibold text-foreground">{cliente.email}</span>
          </a>
        ) : null}

        <span className="text-muted flex items-center gap-1.5">
          Responsable
          <span className="px-2 py-0.5 rounded-md bg-card/70 border border-border/40 font-bold text-foreground text-[11px]">
            {cliente.responsable || 'Sin asignar'}
          </span>
        </span>

        <span className="text-muted" title={cliente.fecha_ultimo_contacto || undefined}>
          Última actividad <b className="text-foreground font-semibold">{haceCuanto(cliente.fecha_ultimo_contacto)}</b>
        </span>
      </div>
    </div>
  );
}

// ── Banda «Siguiente acción» ────────────────────────────────────────────────

/**
 * Lo primero que se lee, y a propósito ocupa una banda entera.
 *
 * Enseña UNA acción con su contexto, su fecha y su botón. Si hay más, lo dice
 * con un contador en vez de convertir la primera pantalla en una lista de
 * alarmas — que es exactamente lo que el documento manda evitar.
 */
export function BandaSiguienteAccion({
  suministros, tareasGenerales, responsable, onCrearTarea, onVerTodas, totalTareas,
}: {
  suministros: EntradaSuministro[];
  tareasGenerales: { descripcion?: string | null; fecha_limite?: string | null; estado?: string }[];
  responsable?: string | null;
  onCrearTarea: () => void;
  onVerTodas: () => void;
  totalTareas: number;
}) {
  const hoy = hoyISO();
  const a = siguienteAccion({ suministros, tareasGenerales }, hoy);

  // Estado vacío ÚTIL: no un hueco, sino una salida.
  if (!a) {
    return (
      <Card className="!p-4 border-emerald-500/30 bg-emerald-500/[0.04]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-bold text-emerald-400 flex items-center gap-2">
            <Check className="w-4 h-4" /> No hay acciones pendientes con este cliente.
          </p>
          <button onClick={onCrearTarea} className={btnSecundario}>
            <Plus className="w-4 h-4" /> Crear tarea
          </button>
        </div>
      </Card>
    );
  }

  const tono = a.critica
    ? 'border-red-500/40 bg-red-500/[0.06]'
    : 'border-accent/30 bg-accent/[0.05]';

  return (
    <Card className={`!p-4 ${tono}`}>
      <div className="flex items-center gap-4 flex-wrap">
        <span
          className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
            a.critica ? 'bg-red-500/15 text-red-400' : 'bg-accent/15 text-accent'
          }`}
          aria-hidden="true"
        >
          {a.critica ? <AlertTriangle className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[11px] uppercase tracking-wide font-bold text-muted">
            Siguiente acción
          </span>
          <span className="block text-base font-black text-foreground leading-tight">{a.texto}</span>
        </span>

        <span className="text-xs text-muted shrink-0">
          {a.suministroId ? 'Suministro' : 'Cliente'} · <b className="text-foreground">{a.contexto}</b>
        </span>

        {a.cuando && (
          <span className={`text-xs font-bold shrink-0 ${a.critica ? 'text-red-400' : 'text-foreground'}`}>
            {a.cuando}
          </span>
        )}

        {responsable && (
          <span className="text-xs text-muted shrink-0">
            Responsable <b className="text-foreground">{responsable}</b>
          </span>
        )}

        <button onClick={onVerTodas} className={`${btnSecundario} shrink-0`}>
          Ver todas las tareas ({totalTareas})
        </button>
      </div>

      {a.otras > 0 && (
        <p className="text-[11px] text-muted mt-2">
          Hay {a.otras} {a.otras === 1 ? 'cosa más esperando' : 'cosas más esperando'}.
        </p>
      )}
    </Card>
  );
}

// ── Resumen operativo ───────────────────────────────────────────────────────

/**
 * Cuatro indicadores, y ninguno decorativo.
 *
 * El documento lo dice sin ambigüedad: nada de importes, ahorro o consumo
 * agregados «si no están completos o no sirven para decidir una acción». Por
 * eso el consumo anual total del cliente, que estaba aquí, ya no está: es una
 * cifra que se mira, no una que se usa.
 */
export function ResumenOperativo({
  suministros, docsPendientes,
}: {
  suministros: EntradaSuministro[];
  docsPendientes: number;
}) {
  const hoy = hoyISO();
  const r = resumenOperativo({ suministros }, hoy);

  const items: { icono: React.ReactNode; texto: string; tono: string }[] = [
    {
      icono: <Plug className="w-4 h-4" />,
      texto: `${r.suministros} ${r.suministros === 1 ? 'suministro' : 'suministros'}`
        + (r.conAlerta ? ` · ${r.conAlerta} con alerta` : ''),
      tono: r.conAlerta ? 'text-red-300' : 'text-foreground',
    },
    {
      icono: <FileText className="w-4 h-4" />,
      texto: `${r.enGestion} en gestión`,
      tono: 'text-foreground',
    },
    {
      icono: <AlertTriangle className="w-4 h-4" />,
      texto: docsPendientes || r.bloqueados
        ? `${docsPendientes + r.bloqueados} dato(s) pendiente(s)`
        : 'Sin datos pendientes',
      tono: docsPendientes + r.bloqueados > 0 ? 'text-amber-300' : 'text-muted',
    },
    {
      icono: <MapPin className="w-4 h-4" />,
      texto: r.proximoVencimiento
        ? `Preaviso: ${comoSeLee(r.proximoVencimiento, hoy)}`
        : 'Sin vencimientos próximos',
      tono: r.diasProximoVencimiento != null && r.diasProximoVencimiento <= 30
        ? 'text-red-300' : 'text-muted',
    },
  ];

  return (
    <Card className="!p-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2.5 px-2 py-1.5">
            <span className="w-8 h-8 rounded-lg bg-card/70 border border-border/40 flex items-center justify-center text-muted shrink-0">
              {it.icono}
            </span>
            <span className={`text-sm font-semibold ${it.tono}`}>{it.texto}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Suministros ─────────────────────────────────────────────────────────────

function CupsCorto({ cups }: { cups: string }) {
  const [copiado, setCopiado] = useState(false);
  if (!cups) return <span className="text-[10px] text-amber-300">Sin CUPS</span>;

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(cups);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1500);
        } catch { /* sin portapapeles: el CUPS sigue visible en el title */ }
      }}
      title={`Copiar ${cups}`}
      aria-label={`Copiar CUPS ${cups}`}
      className="text-[10px] font-mono text-muted hover:text-accent transition flex items-center gap-1"
    >
      {cups}
      {copiado ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

/** El estado en texto + color, nunca solo color. */
function BadgeEstado({ e }: { e: EstadoSuministro }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-black uppercase ${PRIORIDAD[e.prioridad].tono}`}
      title={e.etiquetaPrioridad}
    >
      {e.fase}
    </span>
  );
}

/**
 * La lista de suministros: el centro real de la ficha.
 *
 * Va en formato tabla porque es lo que permite comparar de un vistazo cuál
 * necesita algo — que es la pregunta. Una cascada de tarjetas grandes obliga a
 * bajar para saberlo, y a partir de cinco suministros se hace inmanejable.
 */
export function ListaSuministros({
  suministros, cupsCrudos, onAbrir, onAnadir,
}: {
  suministros: EntradaSuministro[];
  cupsCrudos: LuzCups[];
  onAbrir: (id: string) => void;
  onAnadir: () => void;
}) {
  const hoy = hoyISO();
  const ordenados = ordenarSuministros(suministros, hoy);

  if (!suministros.length) {
    return (
      <Card>
        <h2 className="font-bold text-sm mb-3">Suministros (0)</h2>
        <div className="text-center py-6">
          <p className="text-sm text-muted mb-3">
            Este cliente todavía no tiene suministros registrados.
          </p>
          <button onClick={onAnadir} className={btnPrimario}>
            <Plus className="w-4 h-4" /> Añadir suministro
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-bold text-sm">Suministros ({suministros.length})</h2>
        <button onClick={onAnadir} className={btnSecundario}>
          <Plus className="w-4 h-4" /> Añadir
        </button>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr className="text-[10px] uppercase font-black text-muted border-b border-border/40">
              <th scope="col" className="py-2 pr-3">Suministro</th>
              <th scope="col" className="py-2 pr-3">Tarifa</th>
              <th scope="col" className="py-2 pr-3">Comercializadora</th>
              <th scope="col" className="py-2 pr-3">Estado</th>
              <th scope="col" className="py-2">Siguiente acción</th>
            </tr>
          </thead>
          <tbody>
            {ordenados.map((s, i) => {
              const e = estadoDeSuministro(s, hoy);
              const crudo = cupsCrudos.find((c) => c.id === s.id);
              return (
                <tr
                  key={s.id}
                  className="border-b border-border/25 last:border-0 hover:bg-card/50 transition cursor-pointer"
                  onClick={() => onAbrir(s.id)}
                >
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-7 h-7 rounded-full border flex items-center justify-center text-[11px] font-black shrink-0 ${PRIORIDAD[e.prioridad].tono}`}
                        aria-hidden="true"
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-foreground truncate">
                          {s.alias || s.direccion || 'Suministro'}
                        </span>
                        {s.direccion && s.alias && (
                          <span className="block text-[11px] text-muted truncate">{s.direccion}</span>
                        )}
                        <span onClick={(ev) => ev.stopPropagation()}>
                          <CupsCorto cups={s.cups} />
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-xs font-semibold whitespace-nowrap">
                    {crudo?.tarifa_acceso ? `${crudo.tarifa_acceso}TD` : <span className="text-amber-300">Sin dato</span>}
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-muted truncate max-w-[9rem]">
                    {s.comercializadora || <span className="text-amber-300">Sin dato</span>}
                  </td>
                  <td className="py-2.5 pr-3"><BadgeEstado e={e} /></td>
                  <td className="py-2.5">
                    {/* Bloqueo primero: dice QUÉ falta, no «pendiente». */}
                    {e.bloqueo ? (
                      <span className="text-xs font-semibold text-amber-300">{e.bloqueo}</span>
                    ) : e.proximaAccion ? (
                      <span className="text-xs">
                        <span className="font-semibold text-foreground">{e.proximaAccion.texto}</span>
                        <span className={`ml-1.5 ${e.proximaAccion.dias != null && e.proximaAccion.dias < 0 ? 'text-red-400 font-bold' : 'text-muted'}`}>
                          · {e.proximaAccion.cuando}
                        </span>
                      </span>
                    ) : e.alerta ? (
                      <span className={`text-xs font-semibold ${e.alerta.critica ? 'text-red-400' : 'text-muted'}`}>
                        {e.alerta.texto}
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-400">Sin acciones pendientes</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Actividad reciente ──────────────────────────────────────────────────────

export interface LineaActividad {
  icono: 'llamada' | 'documento' | 'email' | 'cambio';
  titulo: string;
  detalle: string;
  cuando: string;
  autor?: string | null;
}

const ICONO_ACTIVIDAD = {
  llamada: Phone,
  documento: FileText,
  email: Mail,
  cambio: ArrowRight,
};

export function ActividadReciente({
  lineas, onVerTodo,
}: {
  lineas: LineaActividad[];
  onVerTodo?: () => void;
}) {
  return (
    <Card>
      <h2 className="font-bold text-sm mb-3">Actividad reciente</h2>

      {lineas.length === 0 ? (
        <p className="text-sm text-muted py-3">
          Todavía no hay actividad registrada con este cliente.
        </p>
      ) : (
        <ol className="space-y-3">
          {lineas.map((l, i) => {
            const Icono = ICONO_ACTIVIDAD[l.icono];
            return (
              <li key={i} className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-lg bg-card/70 border border-border/40 flex items-center justify-center text-accent shrink-0">
                  <Icono className="w-3.5 h-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-foreground">{l.titulo}</span>
                  <span className="block text-[11px] text-muted leading-snug">{l.detalle}</span>
                  <span className="block text-[10px] text-muted mt-0.5">
                    {l.cuando}{l.autor ? ` · ${l.autor}` : ''}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {onVerTodo && lineas.length > 0 && (
        <button
          onClick={onVerTodo}
          className="mt-3 text-xs font-semibold text-accent hover:underline flex items-center gap-1"
        >
          Ver toda la actividad <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </Card>
  );
}
