'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trash2, RotateCcw, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { fmtFecha } from '@/lib/luz';
import { tokenSesion } from '@/lib/usuario';
import { GuardiaAdmin } from '@/components/guardia-modulo';
import { Card, btnSecundario } from '../ui';

/**
 * PAPELERA — la red de seguridad de Gestión Luz.
 *
 * Antes "Eliminar" borraba de verdad y, como los suministros y las fechas
 * cuelgan del cliente con borrado en cascada, cargarse un cliente por error
 * se llevaba por delante todo su historial sin vuelta atrás.
 *
 * Ahora nada se borra: se marca y se esconde. Aquí se ve lo eliminado y se
 * devuelve a su sitio, con todo lo que se fue con ello.
 * Solo administrador: restaurar y borrar para siempre no son cosas del día a día.
 */

/** Lee un campo como texto, sea cual sea el recurso. */
const txt = (r: Registro, campo: string): string => {
  const v = r[campo];
  return typeof v === 'string' ? v : '';
};

/** Recursos con papelera y cómo se llaman para una persona. */
const RECURSOS: { clave: string; nombre: string; titulo: (r: Registro) => string }[] = [
  { clave: 'clientes', nombre: 'Clientes', titulo: (r) => txt(r, 'nombre') || 'Cliente sin nombre' },
  { clave: 'cups', nombre: 'CUPS / Suministros', titulo: (r) => txt(r, 'cups') || txt(r, 'alias_suministro') || 'Suministro' },
  { clave: 'pipeline', nombre: 'Oportunidades', titulo: (r) => txt(r, 'nombre_oportunidad') || 'Oportunidad' },
  { clave: 'contratos', nombre: 'Contratos', titulo: (r) => txt(r, 'comercializadora_final') || 'Contrato' },
  { clave: 'comisiones', nombre: 'Comisiones', titulo: (r) => txt(r, 'comercializadora') || 'Comisión' },
  { clave: 'tareas', nombre: 'Tareas', titulo: (r) => txt(r, 'descripcion') || 'Tarea' },
  { clave: 'fechas', nombre: 'Fechas críticas', titulo: (r) => txt(r, 'titulo') || 'Fecha crítica' },
  { clave: 'visitas', nombre: 'Visitas', titulo: (r) => `Visita ${fmtFecha(txt(r, 'fecha'))}` },
  { clave: 'proyectos', nombre: 'Proyectos de ahorro', titulo: (r) => txt(r, 'titulo') || 'Proyecto' },
];

interface Registro {
  id: string;
  borrado_en?: string | null;
  borrado_por?: string | null;
  motivo_borrado?: string | null;
  borrado_con?: string | null;
  luz_clientes?: { nombre?: string } | null;
  /** El resto de campos varía según el recurso; se leen como texto opcional. */
  [k: string]: string | null | undefined | { nombre?: string };
}

export default function PapeleraPage() {
  return (
    <GuardiaAdmin nombre="Papelera">
      <Papelera />
    </GuardiaAdmin>
  );
}

function Papelera() {
  const [recurso, setRecurso] = useState('clientes');
  const [datos, setDatos] = useState<Registro[]>([]);
  const [conteos, setConteos] = useState<Record<string, number>>({});
  const [cargando, setCargando] = useState(true);
  const [faltaSql, setFaltaSql] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState('');

  const pedir = useCallback(async (clave: string) => {
    const token = await tokenSesion();
    const res = await fetch(`/api/luz/${clave}?papelera=1`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return res.json();
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const json = await pedir(recurso);
      if (json.falta_papelera) setFaltaSql(true);
      setDatos(json.datos || []);
    } catch {
      setError('Error de conexión.');
    } finally {
      setCargando(false);
    }
  }, [recurso, pedir]);

  useEffect(() => { cargar(); }, [cargar]);

  // Contador por pestaña, para saber dónde hay algo sin ir mirando una a una
  useEffect(() => {
    (async () => {
      const out: Record<string, number> = {};
      for (const r of RECURSOS) {
        try {
          const json = await pedir(r.clave);
          out[r.clave] = (json.datos || []).length;
        } catch { out[r.clave] = 0; }
      }
      setConteos(out);
    })();
  }, [pedir, msg]);

  async function restaurar(r: Registro) {
    setOcupado(r.id); setMsg(''); setError('');
    try {
      const token = await tokenSesion();
      const res = await fetch(`/api/luz/${recurso}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ id: r.id }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'No se pudo restaurar.'); return; }
      setMsg(json.restaurados > 0
        ? `✓ Restaurado, junto con ${json.restaurados} registro(s) que se habían ido con él.`
        : '✓ Restaurado.');
      cargar();
    } finally {
      setOcupado('');
    }
  }

  async function borrarDefinitivo(r: Registro, titulo: string) {
    if (!confirm(
      `¿Borrar "${titulo}" PARA SIEMPRE?\n\n`
      + 'Esto sí es irreversible: desaparece de la base de datos junto con todo lo que dependa de él. '
      + 'No lo podré recuperar de ninguna manera.'
    )) return;
    setOcupado(r.id); setMsg(''); setError('');
    try {
      const token = await tokenSesion();
      const res = await fetch(`/api/luz/${recurso}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ id: r.id, definitivo: true }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'No se pudo borrar.'); return; }
      setMsg('Borrado definitivamente.');
      cargar();
    } finally {
      setOcupado('');
    }
  }

  const def = RECURSOS.find((r) => r.clave === recurso)!;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-accent" /> Papelera
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Lo eliminado no se pierde: se guarda aquí y se puede devolver a su sitio. Solo administrador.
          </p>
        </div>
        <button onClick={cargar} className={btnSecundario} disabled={cargando}>
          <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {faltaSql && (
        <Card className="!p-4 border-amber-500/40 bg-amber-500/5 space-y-1">
          <p className="text-sm font-bold text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Falta activar la papelera
          </p>
          <p className="text-xs text-muted">
            Ejecuta <code className="text-amber-300">supabase_papelera.sql</code> en el SQL Editor de Supabase.
            Hasta entonces, eliminar seguirá sin ser recuperable.
          </p>
        </Card>
      )}

      {msg && <p className="fv-fade-in text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5">{msg}</p>}
      {error && <p className="fv-fade-in text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">{error}</p>}

      {/* Pestañas con el recuento de cada cosa */}
      <div className="flex gap-1.5 flex-wrap">
        {RECURSOS.map((r) => (
          <button
            key={r.clave}
            onClick={() => setRecurso(r.clave)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition ${
              recurso === r.clave
                ? 'bg-accent text-white border-accent'
                : conteos[r.clave] > 0
                  ? 'bg-card/80 text-foreground border-border/50 hover:border-accent/40'
                  : 'bg-card/40 text-muted/60 border-border/25 hover:text-foreground'
            }`}
          >
            {r.nombre}
            {conteos[r.clave] > 0 && (
              <span className={`ml-1.5 tabular-nums ${recurso === r.clave ? 'text-white/80' : 'text-accent'}`}>
                {conteos[r.clave]}
              </span>
            )}
          </button>
        ))}
      </div>

      {cargando && <p className="text-sm text-muted text-center py-8">Cargando…</p>}

      {!cargando && datos.length === 0 && (
        <Card className="text-center py-10 space-y-2">
          <ShieldCheck className="w-8 h-8 mx-auto text-emerald-400" />
          <p className="text-sm font-bold text-foreground">No hay {def.nombre.toLowerCase()} en la papelera.</p>
          <p className="text-xs text-muted">Nada que recuperar por aquí.</p>
        </Card>
      )}

      <div className="space-y-2">
        {datos.map((r) => {
          const titulo = def.titulo(r);
          const arrastrado = !!r.borrado_con;
          return (
            <Card key={r.id} className="!p-3 fv-fade-in flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-bold text-foreground truncate">{titulo}</p>
                <p className="text-[11px] text-muted">
                  Eliminado el <b>{fmtFecha(r.borrado_en)}</b>
                  {r.borrado_por && <> por <b>{r.borrado_por}</b></>}
                  {r.luz_clientes?.nombre && <> · cliente: {r.luz_clientes.nombre}</>}
                </p>
                {r.motivo_borrado && <p className="text-[11px] text-amber-300/90">Motivo: {r.motivo_borrado}</p>}
                {arrastrado && (
                  <p className="text-[10px] text-muted/70">
                    Se fue al eliminar otro registro. Si restauras aquel, este vuelve solo.
                  </p>
                )}
              </div>
              <div className="shrink-0 flex flex-col gap-1">
                <button
                  onClick={() => restaurar(r)}
                  disabled={ocupado === r.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold hover:bg-emerald-500/20 transition disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restaurar
                </button>
                <button
                  onClick={() => borrarDefinitivo(r, titulo)}
                  disabled={ocupado === r.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-card/80 text-muted border border-border/50 text-[11px] font-bold hover:text-red-400 hover:border-red-500/40 transition disabled:opacity-50"
                  title="Borrar de la base de datos para siempre"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Para siempre
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {datos.length > 0 && (
        <p className="text-[10px] text-muted text-center">
          Restaurar devuelve también lo que se fue en cascada con ese registro (suministros, fechas, tareas…).
          &quot;Para siempre&quot; sí es irreversible.
        </p>
      )}
    </div>
  );
}
