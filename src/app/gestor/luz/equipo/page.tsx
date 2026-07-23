'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2, GitMerge, Pencil, X, Trophy } from 'lucide-react';
import { ROL_LABEL } from '@/lib/correbin';
import { Card, guardarLuz, inputCls, labelCls, btnPrimario, btnSecundario } from '../ui';
import { tokenSesion } from '@/lib/usuario';
import { LogrosComercial } from './logros';

async function cabeceraSesion(): Promise<Record<string, string>> {
  const token = await tokenSesion();
  return token ? { Authorization: `Bearer ${token}` } : {};
}


interface Responsable { id: string; nombre: string; rol: string; activo: boolean }
type Uso = Record<string, Record<string, number>>;

const TABLA_LABEL: Record<string, string> = {
  luz_clientes: 'Clientes Luz', luz_cups: 'CUPS', luz_pipeline: 'Pipeline Luz', luz_contratos: 'Contratos',
  luz_comisiones: 'Comisiones', luz_tareas: 'Tareas Luz', luz_fechas_criticas: 'Fechas críticas',
  vct_clientes: 'Clientes Seguros', vct_polizas: 'Pólizas', vct_vencimientos: 'Vencimientos',
  vct_produccion: 'Producción', vct_anulaciones: 'Anulaciones', vct_oportunidades: 'Pipeline Seguros', vct_tareas: 'Tareas Seguros',
};

export default function EquipoPage() {
  const [responsables, setResponsables] = useState<Responsable[]>([]);
  const [uso, setUso] = useState<Uso>({});
  const [cargando, setCargando] = useState(true);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const [nuevo, setNuevo] = useState({ nombre: '', rol: 'comercial' });
  const [fusion, setFusion] = useState<{ origen: string; destino: string } | null>(null);
  const [renombrando, setRenombrando] = useState<{ id: string; de: string; a: string } | null>(null);
  const [verLogrosDe, setVerLogrosDe] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch('/api/luz/equipo', { headers: await cabeceraSesion() });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Error cargando equipo.'); return; }
      setResponsables(json.responsables);
      setUso(json.uso || {});
      setError('');
    } catch {
      setError('Error de conexión.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const totalDe = (nombre: string) => Object.values(uso[nombre] || {}).reduce((s, n) => s + n, 0);

  async function accion(body: Record<string, unknown>, exito: string) {
    setOcupado(true); setMsg(''); setError('');
    try {
      const res = await fetch('/api/luz/equipo', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await cabeceraSesion()) }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Error.'); return false; }
      setMsg(exito + (json.registros_actualizados != null ? ` (${json.registros_actualizados} registro(s) actualizados)` : ''));
      await cargar();
      return true;
    } catch {
      setError('Error de conexión.');
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevo.nombre.trim()) return;
    const err = await guardarLuz('responsables', 'POST', { nombre: nuevo.nombre.trim(), rol: nuevo.rol, activo: true });
    if (err) { setError(err); return; }
    setNuevo({ nombre: '', rol: 'comercial' });
    setMsg('✓ Responsable creado.');
    cargar();
  }

  async function eliminar(r: Responsable) {
    const total = totalDe(r.nombre);
    if (total > 0) {
      setError(`"${r.nombre}" tiene ${total} registro(s) vinculados. Usa "Fusionar" para pasarlos a otro responsable, o desactívalo.`);
      return;
    }
    if (!confirm(`¿Eliminar el responsable "${r.nombre}"? No tiene registros vinculados.`)) return;
    await accion({ accion: 'eliminar', id: r.id, nombre: r.nombre }, `✓ "${r.nombre}" eliminado.`);
  }

  // Nombres que aparecen en los datos (incluye los que no están dados de alta como responsable)
  const nombresEnDatos = Object.keys(uso).filter((n) => totalDe(n) > 0).sort((a, b) => totalDe(b) - totalDe(a));
  const nombresAlta = new Set(responsables.map((r) => r.nombre.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Equipo y Responsables</h2>
          <p className="text-xs text-muted mt-0.5">Quién es quién: alta, fusión de duplicados y a qué registros está vinculado cada uno.</p>
        </div>
        <button onClick={cargar} className={btnSecundario} disabled={cargando}>
          <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      {msg && <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5">{msg}</p>}
      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">{error}</p>}

      {/* Alta */}
      <Card className="!p-4">
        <form onSubmit={crear} className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-40">
            <label className={labelCls}>Nuevo responsable</label>
            <input className={inputCls} value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Nombre" />
          </div>
          <div>
            <label className={labelCls}>Rol</label>
            <select className={inputCls} value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}>
              {Object.entries(ROL_LABEL).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </div>
          <button type="submit" className={btnPrimario}><Plus className="w-4 h-4" /> Añadir</button>
        </form>
      </Card>

      {/* Fusión */}
      <Card className="!p-4">
        <h3 className="font-bold text-sm mb-2 flex items-center gap-2"><GitMerge className="w-4 h-4 text-accent" /> Fusionar responsables duplicados</h3>
        <p className="text-xs text-muted mb-3">
          Todos los registros del origen (clientes, tareas, pipeline, pólizas, seguimientos...) pasan al destino,
          incluidos los compartidos tipo «A / B». El origen desaparece de la lista.
        </p>
        <div className="flex gap-2 flex-wrap items-end">
          <div>
            <label className={labelCls}>Origen (desaparece)</label>
            <select className={inputCls} value={fusion?.origen || ''} onChange={(e) => setFusion({ origen: e.target.value, destino: fusion?.destino || '' })}>
              <option value="">— Selecciona —</option>
              {nombresEnDatos.map((n) => <option key={n} value={n}>{n} ({totalDe(n)})</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Destino (se queda todo)</label>
            <select className={inputCls} value={fusion?.destino || ''} onChange={(e) => setFusion({ origen: fusion?.origen || '', destino: e.target.value })}>
              <option value="">— Selecciona —</option>
              {Array.from(new Set([...responsables.map((r) => r.nombre), ...nombresEnDatos])).sort().map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button
            disabled={ocupado || !fusion?.origen || !fusion?.destino || fusion.origen === fusion.destino}
            onClick={async () => {
              if (!fusion) return;
              const total = totalDe(fusion.origen);
              const detalle = Object.entries(uso[fusion.origen] || {}).filter(([, n]) => n > 0)
                .map(([t, n]) => `· ${TABLA_LABEL[t] || t}: ${n}`).join('\n');
              if (!confirm(`Se transferirán ${total} registro(s) de "${fusion.origen}" a "${fusion.destino}":\n\n${detalle}\n\n¿Confirmar fusión?`)) return;
              const ok = await accion({ accion: 'fusionar', origen: fusion.origen, destino: fusion.destino }, `✓ "${fusion.origen}" fusionado en "${fusion.destino}".`);
              if (ok) setFusion(null);
            }}
            className={btnPrimario}
          >
            <GitMerge className="w-4 h-4" /> Fusionar
          </button>
        </div>
        {fusion?.origen && (
          <div className="mt-3 text-xs text-muted flex gap-2 flex-wrap">
            {Object.entries(uso[fusion.origen] || {}).filter(([, n]) => n > 0).map(([t, n]) => (
              <span key={t} className="px-2 py-0.5 rounded-full bg-card/80 border border-border/50">{TABLA_LABEL[t] || t}: <b className="text-foreground">{n}</b></span>
            ))}
          </div>
        )}
      </Card>

      {/* Lista */}
      <Card className="!p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
              <th className="px-4 py-3">Responsable</th><th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3 text-center">Registros vinculados</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {responsables.map((r) => {
              const total = totalDe(r.nombre);
              return (
                <tr key={r.id} className={`border-b border-border/20 hover:bg-card/50 transition ${!r.activo ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2.5 font-semibold">
                    {renombrando?.id === r.id ? (
                      <span className="flex gap-1.5 items-center">
                        <input className="rounded-md border border-border/40 bg-background/70 px-2 py-1 text-xs" value={renombrando.a} onChange={(e) => setRenombrando({ ...renombrando, a: e.target.value })} autoFocus />
                        <button
                          onClick={async () => {
                            if (!renombrando.a.trim() || renombrando.a === renombrando.de) { setRenombrando(null); return; }
                            await accion({ accion: 'renombrar', origen: renombrando.de, destino: renombrando.a.trim() }, `✓ Renombrado a "${renombrando.a.trim()}".`);
                            setRenombrando(null);
                          }}
                          className="text-emerald-400 text-xs font-bold">✓</button>
                        <button onClick={() => setRenombrando(null)} className="text-muted text-xs"><X className="w-3.5 h-3.5" /></button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        {r.nombre}
                        <button onClick={() => setRenombrando({ id: r.id, de: r.nombre, a: r.nombre })} className="text-muted/50 hover:text-accent" title="Renombrar (actualiza todos sus registros)">
                          <Pencil className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={r.rol}
                      onChange={async (e) => { await guardarLuz('responsables', 'PUT', { id: r.id, rol: e.target.value }); cargar(); }}
                      className="rounded-lg border border-border/40 bg-background/60 px-2 py-1 text-xs font-semibold"
                    >
                      {Object.entries(ROL_LABEL).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`font-bold tabular-nums ${total > 0 ? 'text-foreground' : 'text-muted/50'}`}>{total}</span>
                    {total > 0 && (
                      <span className="block text-[10px] text-muted truncate max-w-56 mx-auto">
                        {Object.entries(uso[r.nombre] || {}).filter(([, n]) => n > 0).map(([t, n]) => `${TABLA_LABEL[t] || t} ${n}`).join(' · ')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={async () => { await guardarLuz('responsables', 'PUT', { id: r.id, activo: !r.activo }); cargar(); }}
                      className={`px-2.5 py-1 rounded-full border text-[11px] font-bold ${r.activo ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 'bg-card/80 text-muted border-border/50'}`}
                    >
                      {r.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {r.rol === 'comercial' && (
                      <button
                        onClick={() => setVerLogrosDe(verLogrosDe === r.nombre ? null : r.nombre)}
                        className={`mr-2 inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold transition ${
                          verLogrosDe === r.nombre ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' : 'bg-card/80 text-muted border-border/50 hover:text-amber-300 hover:border-amber-500/40'
                        }`}
                        title="Ver perfil de logros">
                        <Trophy className="w-3 h-3" /> Logros
                      </button>
                    )}
                    <button onClick={() => eliminar(r)} className="text-muted hover:text-red-400 transition" title={total > 0 ? 'Tiene registros: fusiona o desactiva' : 'Eliminar'}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {responsables.length === 0 && !cargando && <p className="text-sm text-muted text-center py-8">Sin responsables dados de alta.</p>}
      </Card>

      {/* Perfil de logros del comercial seleccionado */}
      {verLogrosDe && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm flex items-center gap-1.5"><Trophy className="w-4 h-4 text-amber-300" /> Perfil de logros · {verLogrosDe}</h3>
            <button onClick={() => setVerLogrosDe(null)} className="text-muted hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <LogrosComercial responsable={verLogrosDe} />
        </div>
      )}

      {/* Nombres que aparecen en datos pero no están dados de alta */}
      {nombresEnDatos.filter((n) => !nombresAlta.has(n.toLowerCase())).length > 0 && (
        <Card className="!p-4">
          <h3 className="font-bold text-sm mb-2">⚠️ Nombres usados en los datos sin ficha de responsable</h3>
          <p className="text-xs text-muted mb-2">Aparecen en registros pero no existen en la lista de arriba. Dales de alta o fusiónalos con uno existente.</p>
          <div className="flex gap-2 flex-wrap">
            {nombresEnDatos.filter((n) => !nombresAlta.has(n.toLowerCase())).map((n) => (
              <span key={n} className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/25 text-xs font-semibold">
                {n} · {totalDe(n)} registro(s)
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
