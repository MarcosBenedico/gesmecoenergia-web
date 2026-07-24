'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Check, CalendarClock, Lock } from 'lucide-react';
import {
  LuzTarea, LuzCups, LuzFechaCritica, ResponsableEquipo,
  PRIORIDAD_TONO, fmtFecha,
} from '@/lib/luz';
import {
  construirAgenda, resumenAgenda, esDe, ItemAgenda, UrgenciaAgenda,
  ORDEN_URGENCIA, URGENCIA_LABEL, URGENCIA_TONO,
} from '@/lib/agenda';
import { Card, EstadoCarga, useListaLuz, guardarLuz, btnSecundario } from '../ui';
import { useUsuario } from '@/lib/usuario';

/**
 * AGENDA: la única lista de trabajo del equipo.
 *
 * Sustituye a "Tareas y Alertas" + "Fechas Críticas", que se solapaban.
 * Las fechas de contrato / permanencia / preaviso ya no son registros que haya
 * que generar y mantener: se calculan en vivo desde cada CUPS, así que nunca
 * se quedan desfasadas cuando cambia un contrato.
 */
export default function AgendaPage() {
  const { perfil, esAdmin } = useUsuario();
  const tareas = useListaLuz<LuzTarea>('tareas');
  const cups = useListaLuz<LuzCups>('cups');
  const fechas = useListaLuz<LuzFechaCritica>('fechas', { estado: 'pendiente' });
  const equipo = useListaLuz<ResponsableEquipo>('responsables', { activo: 'true' });

  const [verDe, setVerDe] = useState<string>('');   // '' = todo el equipo
  const [filtro, setFiltro] = useState<UrgenciaAgenda | ''>('');
  const [ocupado, setOcupado] = useState('');
  const [msg, setMsg] = useState('');

  const cargando = tareas.cargando || cups.cargando || fechas.cargando;
  // Sin selección explícita, cada uno ve lo suyo; el admin ve todo el equipo.
  const persona = verDe || (esAdmin ? '' : perfil?.responsable || '');

  const todo = useMemo(
    () => construirAgenda({ tareas: tareas.datos, cups: cups.datos, fechas: fechas.datos }),
    [tareas.datos, cups.datos, fechas.datos]
  );
  const mios = useMemo(
    () => (persona ? todo.filter((i) => esDe(i.responsable, persona)) : todo),
    [todo, persona]
  );
  const visibles = filtro ? mios.filter((i) => i.urgencia === filtro) : mios;
  const resumen = useMemo(() => resumenAgenda(mios), [mios]);

  async function completar(item: ItemAgenda) {
    if (!item.id) return;
    setOcupado(item.clave);
    const err = item.origen === 'tarea'
      ? await guardarLuz('tareas', 'PUT', { id: item.id, estado: 'completada' })
      : await guardarLuz('fechas', 'PUT', { id: item.id, estado: 'completada' });
    setOcupado('');
    if (err) { setMsg(`⚠️ ${err}`); return; }
    setMsg('✓ Hecho.');
    if (item.origen === 'tarea') tareas.recargar(); else fechas.recargar();
  }

  function recargarTodo() { tareas.recargar(); cups.recargar(); fechas.recargar(); }

  const grupos = ORDEN_URGENCIA
    .map((u) => ({ urgencia: u, items: visibles.filter((i) => i.urgencia === u) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-accent" /> Agenda
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Todo lo que hay que hacer, en una sola lista. Los vencimientos de contrato, permanencia y preaviso
            se calculan solos desde cada suministro: siempre al día.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {esAdmin && (
            <select
              value={verDe}
              onChange={(e) => setVerDe(e.target.value)}
              className="rounded-lg border border-border/40 bg-background/60 px-2.5 py-2 text-xs font-semibold"
            >
              <option value="">👥 Todo el equipo</option>
              {equipo.datos.map((r) => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
            </select>
          )}
          <button onClick={recargarTodo} className={btnSecundario} disabled={cargando}>
            <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {msg && <p className="fv-fade-in text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5">{msg}</p>}

      {/* Pastillas de urgencia: además de informar, filtran */}
      <div className="flex gap-2 flex-wrap">
        {ORDEN_URGENCIA.filter((u) => resumen[u] > 0).map((u) => (
          <button
            key={u}
            onClick={() => setFiltro(filtro === u ? '' : u)}
            className={`px-3 py-1.5 rounded-full border text-xs font-bold transition ${URGENCIA_TONO[u]} ${
              filtro === u ? 'ring-2 ring-accent/50' : 'opacity-80 hover:opacity-100'
            }`}
          >
            {URGENCIA_LABEL[u]} · {resumen[u]}
          </button>
        ))}
        {filtro && (
          <button onClick={() => setFiltro('')} className="px-3 py-1.5 rounded-full text-xs font-bold text-muted hover:text-foreground">
            Quitar filtro
          </button>
        )}
      </div>

      <EstadoCarga
        cargando={cargando}
        error={tareas.error || cups.error || fechas.error}
        faltaMigracion={tareas.faltaMigracion}
        sqlFile="supabase_luz.sql"
        vacio={!cargando && visibles.length === 0}
        textoVacio={persona ? `Nada pendiente para ${persona}. 🎉` : 'Nada pendiente. Todo al día. 🎉'}
      />

      {grupos.map(({ urgencia, items }) => (
        <div key={urgencia} className="space-y-1.5">
          <p className={`inline-block px-2.5 py-1 rounded-full border text-[11px] font-black uppercase tracking-wide ${URGENCIA_TONO[urgencia]}`}>
            {URGENCIA_LABEL[urgencia]} · {items.length}
          </p>
          <div className="space-y-1.5">
            {items.map((i) => (
              <Card key={i.clave} className="!p-3 fv-fade-in flex items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase ${i.tono}`}>
                      {i.tipoLabel}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-bold ${PRIORIDAD_TONO[i.prioridad] || ''}`}>
                      {i.prioridad}
                    </span>
                    {!i.editable && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-muted/70" title="Sale del suministro: se corrige en la ficha del CUPS">
                        <Lock className="w-2.5 h-2.5" /> automático
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-foreground leading-snug">{i.titulo}</p>
                  <p className="text-[11px] text-muted">
                    {i.clienteId ? (
                      <Link href={`/gestor/luz/clientes/${i.clienteId}`} className="text-accent hover:underline font-semibold">
                        {i.clienteNombre || 'Ver cliente'}
                      </Link>
                    ) : <span className="text-muted/60">Sin cliente</span>}
                    {i.cupsTexto && <span> · {i.cupsTexto}</span>}
                    {i.responsable && <span> · 👤 {i.responsable}</span>}
                    {i.fecha && <span> · 📅 {fmtFecha(i.fecha)}{i.dias != null && i.dias < 0 ? ` (${Math.abs(i.dias)} días de retraso)` : i.dias != null && i.dias <= 31 ? ` (${i.dias} d)` : ''}</span>}
                  </p>
                  {i.detalle && <p className="text-[10px] text-muted/70 line-clamp-2">{i.detalle}</p>}
                </div>
                {i.editable ? (
                  <button
                    onClick={() => completar(i)}
                    disabled={ocupado === i.clave}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold hover:bg-emerald-500/20 transition disabled:opacity-50"
                    title="Marcar como hecho"
                  >
                    <Check className="w-3.5 h-3.5" /> Hecho
                  </button>
                ) : (
                  <Link
                    href={`/gestor/luz/clientes/${i.clienteId || ''}`}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg bg-card/80 border border-border/50 text-[11px] font-bold text-muted hover:text-foreground transition"
                    title="Este aviso sale de los datos del suministro: se corrige ahí"
                  >
                    Ver suministro
                  </Link>
                )}
              </Card>
            ))}
          </div>
        </div>
      ))}

      <div className="pt-2 space-y-1.5 text-center">
        <p className="text-[10px] text-muted">
          Los avisos marcados como <b>automático</b> se leen directamente del suministro (fin de contrato, permanencia y preaviso):
          no se marcan como hechos, desaparecen solos cuando cambia la fecha en el CUPS. Así nunca trabajáis con un aviso caducado.
        </p>
        <p className="text-[10px] text-muted/70">
          ¿Crear o editar en detalle? <Link href="/gestor/luz/tareas" className="text-accent hover:underline">Tareas</Link>
          {' · '}
          <Link href="/gestor/luz/fechas" className="text-accent hover:underline">Fechas críticas</Link>
        </p>
      </div>
    </div>
  );
}
