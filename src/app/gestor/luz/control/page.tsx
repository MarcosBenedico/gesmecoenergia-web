'use client';

import { useMemo, useState } from 'react';
import { Lock, History, ChevronLeft, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';
import { Card, Kpi, EstadoCarga, useListaLuz, inputCls, btnPrimario, btnSecundario } from '../ui';

/**
 * Control General: registro diario de toda la actividad del panel.
 * Lee app_auditoria (triggers de supabase_equipo_usuarios.sql), que graba
 * cada creación, cambio de estado o borrado con su antes/después, usuario y hora.
 * Acceso protegido por PIN numérico (solo interfaz).
 */

const PIN_ACCESO = '20082006';
const CLAVE_SESION = 'control_general_ok';

const NOMBRE_TABLA: Record<string, string> = {
  luz_clientes: 'Cliente',
  luz_cups: 'CUPS / Suministro',
  luz_pipeline: 'Pipeline',
  luz_contratos: 'Contrato',
  luz_comisiones: 'Comisión',
  luz_tareas: 'Tarea',
  luz_fechas_criticas: 'Fecha crítica',
  vct_responsables: 'Responsable',
  app_usuarios: 'Usuario del panel',
};

const ACCION_UI: Record<string, { nombre: string; tono: string; Icono: typeof Plus }> = {
  INSERT: { nombre: 'Creado', tono: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', Icono: Plus },
  UPDATE: { nombre: 'Cambio', tono: 'bg-amber-500/15 text-amber-300 border-amber-500/30', Icono: Pencil },
  DELETE: { nombre: 'Eliminado', tono: 'bg-red-500/15 text-red-400 border-red-500/30', Icono: Trash2 },
};

// Campos técnicos que no aportan nada al leer un cambio
const CAMPOS_IGNORADOS = new Set(['actualizado_en', 'creado_en', 'ultimo_acceso', 'id']);

interface RegistroAuditoria {
  id: string;
  usuario: string | null;
  accion: 'INSERT' | 'UPDATE' | 'DELETE';
  tabla: string;
  registro_id: string | null;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  creado_en: string;
}

const fmtValor = (v: unknown): string => {
  if (v == null || v === '') return 'vacío';
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 40);
  return String(v).slice(0, 60);
};

/** Nombre humano del registro afectado (cliente, título, CUPS...). */
function nombreRegistro(r: RegistroAuditoria): string {
  const d = (r.despues || r.antes || {}) as Record<string, unknown>;
  return String(d.nombre || d.titulo || d.descripcion || d.cups || d.nombre_oportunidad || d.titulo_evento || d.email || '').slice(0, 60);
}

/** Resumen sutil del cambio: "campo: antes → después" (máx. 4). */
function resumenCambio(r: RegistroAuditoria): string[] {
  if (r.accion !== 'UPDATE' || !r.antes || !r.despues) return [];
  const cambios: string[] = [];
  for (const k of Object.keys(r.despues)) {
    if (CAMPOS_IGNORADOS.has(k)) continue;
    const a = JSON.stringify(r.antes[k] ?? null);
    const b = JSON.stringify(r.despues[k] ?? null);
    if (a !== b) cambios.push(`${k.replace(/_/g, ' ')}: ${fmtValor(r.antes[k])} → ${fmtValor(r.despues[k])}`);
  }
  return cambios;
}

const hoyISO = () => new Date().toISOString().slice(0, 10);

export default function ControlGeneralPage() {
  // ── Puerta con PIN ──
  const [desbloqueado, setDesbloqueado] = useState(
    typeof window !== 'undefined' && sessionStorage.getItem(CLAVE_SESION) === '1'
  );
  const [pin, setPin] = useState('');
  const [errorPin, setErrorPin] = useState('');

  // ── Día seleccionado ──
  const [dia, setDia] = useState(hoyISO());

  // Límites del día en hora local convertidos a UTC (la BD guarda en UTC)
  const { desdeUTC, hastaUTC } = useMemo(() => {
    const ini = new Date(`${dia}T00:00:00`);
    const fin = new Date(`${dia}T23:59:59.999`);
    return { desdeUTC: ini.toISOString(), hastaUTC: fin.toISOString() };
  }, [dia]);

  const { datos, cargando, error, faltaMigracion } = useListaLuz<RegistroAuditoria>(
    'auditoria',
    desbloqueado ? { desde: desdeUTC, hasta: hastaUTC, limite: '2000' } : { limite: '0' }
  );

  const porHora = useMemo(
    () => [...datos].sort((a, b) => b.creado_en.localeCompare(a.creado_en)),
    [datos]
  );

  const resumenDia = useMemo(() => ({
    total: datos.length,
    creados: datos.filter((r) => r.accion === 'INSERT').length,
    cambios: datos.filter((r) => r.accion === 'UPDATE').length,
    borrados: datos.filter((r) => r.accion === 'DELETE').length,
  }), [datos]);

  function comprobarPin(e: React.FormEvent) {
    e.preventDefault();
    if (pin === PIN_ACCESO) {
      sessionStorage.setItem(CLAVE_SESION, '1');
      setDesbloqueado(true);
      setErrorPin('');
    } else {
      setErrorPin('PIN incorrecto.');
      setPin('');
    }
  }

  function moverDia(delta: number) {
    const d = new Date(dia);
    d.setDate(d.getDate() + delta);
    setDia(d.toISOString().slice(0, 10));
  }

  // ── Pantalla de PIN ──
  if (!desbloqueado) {
    return (
      <div className="min-h-[55vh] flex items-center justify-center p-6">
        <Card className="max-w-sm w-full text-center space-y-4 !p-8">
          <div className="w-12 h-12 mx-auto rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center">
            <Lock className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-black text-foreground">Control General</h2>
            <p className="text-xs text-muted mt-1">Zona protegida. Introduce el PIN numérico para ver el registro de actividad.</p>
          </div>
          <form onSubmit={comprobarPin} className="space-y-3">
            <input
              className={`${inputCls} text-center tracking-[0.4em] font-black text-lg`}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={12}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••••"
              autoFocus
            />
            {errorPin && <p className="text-xs text-red-400">{errorPin}</p>}
            <button type="submit" className={`${btnPrimario} w-full justify-center`} disabled={!pin}>
              Entrar
            </button>
          </form>
        </Card>
      </div>
    );
  }

  // ── Panel de actividad ──
  const esHoy = dia === hoyISO();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <History className="w-5 h-5 text-accent" /> Control General
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Registro automático de toda la actividad del panel: qué se hizo, quién y a qué hora.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => moverDia(-1)} className={btnSecundario}><ChevronLeft className="w-4 h-4" /></button>
          <input
            type="date"
            className={`${inputCls} !w-auto !py-1.5 !text-xs font-bold`}
            value={dia}
            max={hoyISO()}
            onChange={(e) => e.target.value && setDia(e.target.value)}
          />
          <button onClick={() => moverDia(1)} disabled={esHoy} className={btnSecundario}><ChevronRight className="w-4 h-4" /></button>
          {!esHoy && <button onClick={() => setDia(hoyISO())} className={btnSecundario}>Hoy</button>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi valor={resumenDia.total} etiqueta="Acciones del día" />
        <Kpi valor={resumenDia.creados} etiqueta="Creaciones" color="text-emerald-400" />
        <Kpi valor={resumenDia.cambios} etiqueta="Cambios" color="text-amber-300" />
        <Kpi valor={resumenDia.borrados} etiqueta="Eliminaciones" color={resumenDia.borrados ? 'text-red-400' : 'text-foreground'} />
      </div>

      <EstadoCarga
        cargando={cargando} error={error} faltaMigracion={faltaMigracion}
        sqlFile="supabase_equipo_usuarios.sql"
        vacio={!cargando && !error && porHora.length === 0}
        textoVacio={`Sin actividad registrada el ${new Date(dia).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}. 👌`}
      />

      {porHora.length > 0 && (
        <Card className="!p-0 divide-y divide-border/20">
          {porHora.map((r) => {
            const ui = ACCION_UI[r.accion] || ACCION_UI.UPDATE;
            const cambios = resumenCambio(r);
            const nombre = nombreRegistro(r);
            return (
              <div key={r.id} className="flex items-start gap-3 px-4 py-2.5">
                <span className="shrink-0 text-[11px] font-bold tabular-nums text-muted w-12 pt-0.5">
                  {new Date(r.creado_en).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${ui.tono}`}>
                  <ui.Icono className="w-3 h-3" /> {ui.nombre}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {NOMBRE_TABLA[r.tabla] || r.tabla}
                    {nombre && <span className="text-muted font-normal"> · {nombre}</span>}
                  </p>
                  {cambios.length > 0 && (
                    <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                      {cambios.slice(0, 4).join(' · ')}
                      {cambios.length > 4 && <span className="text-muted/60"> · +{cambios.length - 4} cambios más</span>}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-[10px] text-muted/70 pt-0.5">{r.usuario || 'sistema'}</span>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
