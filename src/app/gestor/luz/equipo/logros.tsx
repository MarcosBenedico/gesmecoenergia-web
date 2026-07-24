'use client';

import { Trophy, Lock } from 'lucide-react';
import { useListaLuz, Card } from '../ui';
import {
  ContadoresComercial, calcularXP, calcularNivel, calcularMedallas,
  RAREZA_COLOR, DefinicionMedalla,
} from '@/lib/logros';

const CATEGORIA_LABEL: Record<DefinicionMedalla['categoria'], string> = {
  clientes: '🤝 Clientes captados', visitas: '🚗 Visitas en ruta', ventas: '💼 Ventas cerradas', tareas: '✅ Tareas completadas',
};

/**
 * Perfil de logros de un comercial: nivel, XP y medallas, calculados en vivo
 * a partir de sus clientes, visitas, ventas y tareas reales en el CRM.
 * Nada se guarda aparte — si mañana cierra una venta, el nivel sube solo.
 */
export function LogrosComercial({ responsable }: { responsable: string }) {
  const clientes = useListaLuz<{ id: string }>('clientes', { responsable });
  const visitas = useListaLuz<{ id: string }>('visitas', { responsable });
  const ventas = useListaLuz<{ id: string }>('contratos', { responsable, estado_contrato: 'activado' });
  const tareas = useListaLuz<{ id: string }>('tareas', { responsable, estado: 'completada' });

  const cargando = clientes.cargando || visitas.cargando || ventas.cargando || tareas.cargando;
  const contadores: ContadoresComercial = {
    clientes: clientes.datos.length, visitas: visitas.datos.length,
    ventas: ventas.datos.length, tareas: tareas.datos.length,
  };
  const xp = calcularXP(contadores);
  const nivel = calcularNivel(xp);
  const medallas = calcularMedallas(contadores);
  const conseguidas = medallas.filter((m) => m.conseguida);

  // Objetivo más cercano: la medalla no conseguida donde falta menos %, para dar siempre una meta clara
  const pendientes = medallas.filter((m) => !m.conseguida).sort((a, b) => b.pctProgreso - a.pctProgreso);
  const siguienteObjetivo = pendientes[0] || null;
  const faltan = siguienteObjetivo ? siguienteObjetivo.umbral - siguienteObjetivo.progresoActual : 0;

  if (cargando) {
    return <Card className="!p-6 text-center text-xs text-muted animate-pulse">Cargando perfil de logros…</Card>;
  }

  return (
    <div className="fv-fade-in space-y-3">
      {/* ── Cabecera: nivel, rango, XP ── */}
      <Card className="!p-5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-secondary/10 pointer-events-none" />
        <div className="relative flex items-center gap-4 flex-wrap">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-secondary text-white shadow-lg">
            <span className="text-3xl font-black tabular-nums">{nivel.nivel}</span>
            <span className="absolute -bottom-1.5 -right-1.5 rounded-full bg-background border-2 border-accent px-1.5 py-0.5 text-[9px] font-black text-accent">NIVEL</span>
          </div>
          <div className="flex-1 min-w-48">
            <p className="text-lg font-black text-foreground leading-tight">{nivel.rango}</p>
            <p className="text-xs text-muted mb-1.5">{responsable} · {xp.toLocaleString('es-ES')} XP acumulados</p>
            <div className="h-2.5 w-full rounded-full bg-card/80 border border-border/40 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-accent to-secondary transition-all duration-700" style={{ width: `${nivel.pctProgreso}%` }} />
            </div>
            <p className="text-[10px] text-muted mt-1">{nivel.xpNivelActual} / {nivel.xpParaSiguiente} XP para nivel {nivel.nivel + 1}</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1.5">
            <Trophy className="w-4 h-4 text-amber-300" />
            <span className="text-sm font-black text-amber-300 tabular-nums">{conseguidas.length}</span>
            <span className="text-[10px] font-bold text-amber-300/80 uppercase">/ {medallas.length} medallas</span>
          </div>
        </div>
      </Card>

      {/* ── Estadísticas reales ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ['🤝', 'Clientes captados', contadores.clientes],
          ['🚗', 'Visitas en ruta', contadores.visitas],
          ['💼', 'Ventas cerradas', contadores.ventas],
          ['✅', 'Tareas completadas', contadores.tareas],
        ].map(([icono, etiqueta, valor]) => (
          <Card key={etiqueta as string} className="!p-3 text-center">
            <p className="text-xl">{icono}</p>
            <p className="text-xl font-black tabular-nums text-foreground">{valor as number}</p>
            <p className="text-[9px] uppercase font-bold text-muted">{etiqueta as string}</p>
          </Card>
        ))}
      </div>

      {/* ── Siguiente objetivo: siempre una meta clara y cercana ── */}
      {siguienteObjetivo && (
        <div className="fv-fade-in rounded-xl border border-accent/30 bg-accent/5 p-3 flex items-center gap-3">
          <span className="text-2xl">{siguienteObjetivo.icono}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground">
              A {faltan} {faltan === 1 ? (siguienteObjetivo.categoria === 'ventas' ? 'venta' : 'paso') : (siguienteObjetivo.categoria === 'clientes' ? 'clientes' : siguienteObjetivo.categoria === 'visitas' ? 'visitas' : siguienteObjetivo.categoria === 'ventas' ? 'ventas' : 'tareas')} de "{siguienteObjetivo.nombre}"
            </p>
            <div className="h-1.5 w-full max-w-xs rounded-full bg-card/80 border border-border/30 overflow-hidden mt-1">
              <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${siguienteObjetivo.pctProgreso}%` }} />
            </div>
          </div>
          <span className="text-[10px] font-black text-accent tabular-nums shrink-0">{siguienteObjetivo.pctProgreso}%</span>
        </div>
      )}

      {/* ── Medallero por categoría ── */}
      {(['clientes', 'visitas', 'ventas', 'tareas'] as const).map((cat) => (
        <Card key={cat} className="!p-4 space-y-2">
          <h3 className="font-bold text-sm">{CATEGORIA_LABEL[cat]}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {medallas.filter((m) => m.categoria === cat).map((m) => {
              const col = RAREZA_COLOR[m.rareza];
              return (
                <div key={m.id}
                  className={`fv-escenario rounded-xl border p-2.5 text-center transition ${
                    m.conseguida ? `${col.bg} ${col.border} ${col.glow}` : 'bg-card/30 border-border/25 opacity-70 grayscale'
                  }`}
                  title={m.descripcion}>
                  <p className="text-2xl leading-none">{m.conseguida ? m.icono : <Lock className="w-5 h-5 mx-auto text-muted/50" />}</p>
                  <p className={`text-[10px] font-black mt-1 leading-tight ${m.conseguida ? col.text : 'text-muted'}`}>{m.nombre}</p>
                  <p className="text-[8px] text-muted mt-0.5">{m.progresoActual}/{m.umbral}</p>
                  {!m.conseguida && (
                    <div className="h-1 w-full rounded-full bg-background/60 overflow-hidden mt-1">
                      <div className="h-full rounded-full bg-muted/40" style={{ width: `${m.pctProgreso}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}
      <p className="text-[10px] text-muted text-center">🏆 Todo se calcula solo, en vivo, a partir de los clientes, visitas, contratos y tareas reales del CRM.</p>
    </div>
  );
}
