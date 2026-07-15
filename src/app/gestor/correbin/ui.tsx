'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader, Download } from 'lucide-react';
import { tokenSesion } from '@/lib/usuario';
import {
  diasHasta, urgenciaVencimiento, PRIORIDAD_TONO, SEGMENTO_COLOR, SEGMENTO_LABEL,
  VctResponsable, Prioridad,
} from '@/lib/correbin';

/** Kit UI compartido del módulo Vencimientos y Cartera (estilo del panel actual). */

export const inputCls =
  'w-full rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-sm text-foreground placeholder-muted/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30';

export const labelCls = 'text-[11px] font-semibold uppercase tracking-wide text-muted mb-1 block';

export const btnPrimario =
  'inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition disabled:opacity-50';

export const btnSecundario =
  'inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-card/80 text-foreground border border-border/50 text-sm font-semibold hover:bg-card transition disabled:opacity-50';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`card rounded-2xl p-5 bg-surface/50 border border-border/40 ${className}`}>
      {children}
    </div>
  );
}

export function Kpi({ valor, etiqueta, color = 'text-foreground' }: { valor: string | number; etiqueta: string; color?: string }) {
  return (
    <Card className="!p-4 text-center">
      <p className={`text-2xl font-black tabular-nums ${color}`}>{valor}</p>
      <p className="text-[11px] text-muted mt-1 uppercase tracking-wide font-semibold">{etiqueta}</p>
    </Card>
  );
}

const URGENCIA_ESTILO: Record<string, string> = {
  vencida: 'bg-red-500/15 text-red-400 border-red-500/30',
  critica: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  proxima: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/25',
  normal: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
};

export function BadgeVencimiento({ fecha }: { fecha: string | null | undefined }) {
  const dias = diasHasta(fecha);
  const urgencia = urgenciaVencimiento(dias);
  const texto =
    dias == null ? 'sin fecha'
    : dias < 0 ? `vencida hace ${-dias} d`
    : dias === 0 ? 'vence HOY'
    : `${dias} días`;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-bold tabular-nums whitespace-nowrap ${URGENCIA_ESTILO[urgencia]}`}>
      {texto}
    </span>
  );
}

export function Badge({ children, tono = 'muted' }: { children: React.ReactNode; tono?: 'muted' | 'accent' | 'verde' | 'rojo' | 'ambar' }) {
  const tonos = {
    muted: 'bg-card/80 text-muted border-border/50',
    accent: 'bg-accent/15 text-accent border-accent/30',
    verde: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    rojo: 'bg-red-500/15 text-red-400 border-red-500/30',
    ambar: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${tonos[tono]}`}>
      {children}
    </span>
  );
}

export function EstadoCarga({ cargando, error, faltaMigracion, vacio, textoVacio, sqlFile = 'supabase_correbin_v2.sql' }: {
  cargando: boolean;
  error: string;
  faltaMigracion?: boolean;
  vacio: boolean;
  textoVacio: string;
  sqlFile?: string;
}) {
  if (cargando) {
    return (
      <div className="text-center py-10 text-muted text-sm">
        <Loader className="w-5 h-5 mx-auto mb-2 animate-spin" />
        Cargando...
      </div>
    );
  }
  if (faltaMigracion) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">El módulo aún no está activado en la base de datos.</p>
          <p className="mt-1 text-amber-300/80">
            Ejecuta el fichero <code className="font-mono bg-black/20 px-1.5 py-0.5 rounded">{sqlFile}</code> en
            Supabase → SQL Editor (una sola vez). Después recarga esta página.
          </p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <p>{error}</p>
      </div>
    );
  }
  if (vacio) {
    return <div className="text-center py-10 text-muted text-sm rounded-xl bg-secondary/20 border border-border/20">{textoVacio}</div>;
  }
  return null;
}

/** Hook de carga de un recurso del módulo (con detección de migración pendiente). */
export function useLista<T>(recurso: string, params: Record<string, string> = {}) {
  const [datos, setDatos] = useState<T[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [faltaMigracion, setFaltaMigracion] = useState(false);
  const claveParams = JSON.stringify(params);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const qs = new URLSearchParams(JSON.parse(claveParams)).toString();
      const token = await tokenSesion();
      const res = await fetch(`/api/correbin/${recurso}${qs ? `?${qs}` : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) {
        setFaltaMigracion(!!json.falta_migracion);
        setError(json.error || 'Error cargando datos.');
        setDatos([]);
        return;
      }
      setFaltaMigracion(false);
      setDatos(json.datos || []);
    } catch {
      setError('Error de conexión.');
    } finally {
      setCargando(false);
    }
  }, [recurso, claveParams]);

  useEffect(() => { recargar(); }, [recargar]);

  return { datos, cargando, error, faltaMigracion, recargar };
}

/** Botón de descarga de Excel autenticada (los <a href> no pueden enviar el token de sesión). */
export function BotonDescarga({ href, children, className }: {
  href: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const [bajando, setBajando] = useState(false);
  async function descargar() {
    setBajando(true);
    try {
      const token = await tokenSesion();
      const res = await fetch(href, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) { alert('No se pudo generar el Excel. ¿Has iniciado sesión?'); return; }
      const blob = await res.blob();
      const nombre = res.headers.get('content-disposition')?.match(/filename="?([^";]+)/)?.[1] || 'exportacion.xlsx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nombre; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBajando(false);
    }
  }
  return (
    <button onClick={descargar} disabled={bajando} className={className || btnSecundario}>
      {bajando ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {children}
    </button>
  );
}

/** Badge de prioridad A/B/C/D del cliente. */
export function BadgePrioridad({ prioridad }: { prioridad: string | null | undefined }) {
  const p = (prioridad || 'C') as Prioridad;
  const tono = PRIORIDAD_TONO[p] || PRIORIDAD_TONO.C;
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md border text-[11px] font-black ${tono}`}>
      {p}
    </span>
  );
}

/** Badge de segmento con su color. */
export function BadgeSegmento({ segmento }: { segmento: string | null | undefined }) {
  if (!segmento) return <span className="text-muted text-xs">—</span>;
  const color = SEGMENTO_COLOR[segmento];
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${color?.badge || 'bg-card/80 text-muted border-border/50'}`}>
      {SEGMENTO_LABEL[segmento] || segmento}
    </span>
  );
}

/** Selector de responsable alimentado por vct_responsables (con opción "Sin asignar"). */
export function SelectorResponsable({ valor, onCambio, className }: {
  valor: string | null | undefined;
  onCambio: (v: string | null) => void;
  className?: string;
}) {
  const { datos } = useLista<VctResponsable>('responsables', { activo: 'true' });
  const nombres = datos.map((r) => r.nombre);
  const actual = valor || '';
  return (
    <select
      value={actual}
      onChange={(e) => onCambio(e.target.value || null)}
      className={className || 'rounded-lg border border-border/40 bg-background/60 px-2 py-1 text-xs font-semibold'}
    >
      <option value="">Sin asignar</option>
      {actual && !nombres.includes(actual) && <option value={actual}>{actual}</option>}
      {nombres.map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  );
}

/** Guardado genérico contra la API del módulo. Devuelve mensaje de error o null si fue bien. */
export async function guardar(recurso: string, metodo: 'POST' | 'PUT' | 'DELETE', body: Record<string, unknown>) {
  try {
    const token = await tokenSesion();
    const res = await fetch(`/api/correbin/${recurso}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return res.ok ? null : (json.error as string) || 'No se pudo guardar.';
  } catch {
    return 'Error de conexión.';
  }
}
