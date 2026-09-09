'use client';

/**
 * LA ENTRADA DEL MÓDULO — a quién atender primero.
 *
 * «La entrada sirve para priorizar trabajo. La ficha sirve para resolverlo.»
 * (página 2 del documento). Por eso aquí no se edita nada: se decide a dónde
 * entrar.
 *
 * TRES CONTADORES Y NI UNO MÁS, y los tres FILTRAN LA MISMA TABLA al pulsarlos
 * — un número que no lleva a una lista no se puede accionar, es decoración. Es
 * la misma lección del Dashboard de dirección.
 *
 * El criterio de qué requiere atención vive entero en `expediente.ts`, y los
 * plazos en `energia.ts`. Esta pantalla no decide nada por su cuenta.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Leaf, AlertTriangle, Users, Clock } from 'lucide-react';
import { LuzCliente, LuzCups, LuzTarea } from '@/lib/luz';
import { FASES, FASE, type FaseEnergia } from '@/lib/energia';
import {
  estadoExpediente, cabecera, ordenar, aplicarFiltro, NIVEL,
  type FiltroEnergia,
} from '@/lib/expediente';
import { useUsuario } from '@/lib/usuario';
import {
  Card, EstadoCarga, useListaLuz, guardarLuz,
  inputCls, labelCls, btnPrimario,
} from '../luz/ui';

interface Expediente {
  id: string;
  cliente_id: string;
  objetivo: string;
  titulo_corto: string | null;
  fase: string;
  responsable: string | null;
  actualizado_en?: string;
  luz_clientes?: { nombre: string } | null;
}

interface Medida { expediente_id: string | null; periodo_inicio: string; periodo_fin: string }
interface Actuacion { expediente_id: string | null; estado: string }
interface LineaBase { expediente_id: string; estado: string }

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const FORM_VACIO = { cliente_id: '', objetivo: '', responsable: '', fase: 'diagnostico' };

export default function ListaExpedientes() {
  const { perfil } = useUsuario();
  const yo = perfil?.responsable || perfil?.nombre || '';
  const hoy = hoyISO();

  const expedientes = useListaLuz<Expediente>('expedientes');
  const clientes = useListaLuz<LuzCliente>('clientes');
  const cups = useListaLuz<LuzCups>('cups');
  const tareas = useListaLuz<LuzTarea>('tareas');
  const medidas = useListaLuz<Medida>('medidas');
  const actuaciones = useListaLuz<Actuacion>('actuaciones');
  const lineas = useListaLuz<LineaBase>('lineas_base');

  const [filtro, setFiltro] = useState<FiltroEnergia>('');
  const [fFase, setFFase] = useState('');
  const [buscar, setBuscar] = useState('');
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [msg, setMsg] = useState('');

  const filas = useMemo(() => {
    const abiertas = tareas.datos.filter((t) => !['completada', 'cancelada'].includes(t.estado));
    const cupsPorCliente = new Map<string, number>();
    for (const c of cups.datos) cupsPorCliente.set(c.cliente_id, (cupsPorCliente.get(c.cliente_id) || 0) + 1);

    return expedientes.datos.map((e) => {
      const nombre = e.luz_clientes?.nombre
        || clientes.datos.find((c) => c.id === e.cliente_id)?.nombre
        || 'Cliente';
      const estado = estadoExpediente({
        id: e.id, cliente: nombre, clienteId: e.cliente_id,
        objetivo: e.objetivo, fase: e.fase as FaseEnergia,
        responsable: e.responsable, actualizadoEn: e.actualizado_en,
        medidas: medidas.datos.filter((m) => m.expediente_id === e.id),
        suministros: cupsPorCliente.get(e.cliente_id) || 0,
        actuaciones: actuaciones.datos.filter((a) => a.expediente_id === e.id),
        tieneLineaBaseAprobada: lineas.datos.some((l) => l.expediente_id === e.id && l.estado === 'aprobada'),
        // Tareas del expediente. `expediente_id` lo añade supabase_energia_v1.sql
        // a `luz_tareas`: una sola lista de tareas para todo el mundo.
        tareas: abiertas.filter((t) => (t as { expediente_id?: string }).expediente_id === e.id),
      }, hoy);
      return { e, nombre, estado };
    });
  }, [expedientes.datos, clientes.datos, cups.datos, tareas.datos, medidas.datos,
    actuaciones.datos, lineas.datos, hoy]);

  const conteo = useMemo(() => cabecera(filas.map((f) => f.estado)), [filas]);

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return ordenar(filas.filter((f) => {
      if (!aplicarFiltro(f.estado, f.e.responsable, filtro, yo)) return false;
      if (fFase && f.e.fase !== fFase) return false;
      if (q && !`${f.nombre} ${f.e.objetivo}`.toLowerCase().includes(q)) return false;
      return true;
    }));
  }, [filas, filtro, fFase, buscar, yo]);

  async function crear(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.cliente_id) { setMsg('Elige de qué cliente es el expediente.'); return; }
    if (!form.objetivo.trim()) { setMsg('Escribe el objetivo: es lo primero que se lee y lo que evita que en seis meses nadie sepa para qué se abrió.'); return; }
    const err = await guardarLuz('expedientes', 'POST', { ...form, objetivo: form.objetivo.trim() });
    if (err) { setMsg(err); return; }
    setForm(FORM_VACIO); setCreando(false); setMsg('');
    expedientes.recargar();
  }

  const cargando = expedientes.cargando || clientes.cargando;

  const CONTADORES: { clave: FiltroEnergia; n: number; texto: string; icono: typeof AlertTriangle; tono: string }[] = [
    { clave: 'atencion', n: conteo.requierenAtencion, texto: 'Requieren atención', icono: AlertTriangle,
      tono: 'border-red-500/40 bg-red-500/10 text-red-400' },
    { clave: 'sin_accion', n: conteo.sinProximaAccion, texto: 'Sin próxima acción', icono: Clock,
      tono: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
    { clave: 'del_cliente', n: conteo.pendientesDelCliente, texto: 'Pendientes del cliente', icono: Users,
      tono: 'border-sky-500/40 bg-sky-500/10 text-sky-300' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black flex items-center gap-2">
            <Leaf className="w-5 h-5 text-emerald-400" /> Expedientes energéticos
          </h1>
          <p className="text-xs text-muted mt-0.5">
            {conteo.abiertos} abierto{conteo.abiertos === 1 ? '' : 's'} · ordenados por lo que se está cayendo, no por fecha
          </p>
        </div>
        <button onClick={() => { setCreando((v) => !v); setMsg(''); }} className={btnPrimario}>
          <Plus className="w-4 h-4" /> {creando ? 'Cancelar' : 'Nuevo expediente'}
        </button>
      </div>

      <EstadoCarga
        onReintentar={expedientes.recargar}
        cargando={cargando}
        error={expedientes.error}
        faltaMigracion={expedientes.faltaMigracion}
        vacio={false}
        textoVacio=""
        sqlFile="supabase_energia_v1.sql"
      />

      {creando && (
        <Card>
          {/* ENTRADA CORTA (página 2): cliente, objetivo y responsable. Nada más.
              Para activarlo hará falta una acción con fecha, pero eso se pide
              en la ficha: pedirlo aquí impediría apuntar el expediente en
              caliente, que es cuando se apunta. */}
          <form onSubmit={crear} className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Cliente *</label>
                <select className={inputCls} value={form.cliente_id}
                  onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
                  <option value="">— Elegir —</option>
                  {[...clientes.datos].sort((a, b) => a.nombre.localeCompare(b.nombre))
                    .map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <p className="text-[11px] text-muted mt-1">
                  Se elige de los que ya hay: el cliente es el mismo en los dos módulos.
                </p>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Objetivo *</label>
                <input className={inputCls} value={form.objetivo}
                  onChange={(e) => setForm({ ...form, objetivo: e.target.value })}
                  placeholder="Resolver la necesidad de potencia y comparar alternativas al refuerzo de red" />
                <p className="text-[11px] text-muted mt-1">
                  En cristiano. Es lo primero que se lee al abrir el expediente.
                </p>
              </div>
              <div>
                <label className={labelCls}>Responsable</label>
                <input className={inputCls} value={form.responsable}
                  onChange={(e) => setForm({ ...form, responsable: e.target.value })} />
              </div>
            </div>
            {msg && <p className="text-xs text-red-400">{msg}</p>}
            <button type="submit" className={btnPrimario}>Crear expediente</button>
          </form>
        </Card>
      )}

      {!cargando && !expedientes.error && (
        <>
          {/* Los tres contadores. Pulsar uno filtra la tabla de abajo. */}
          <div className="grid grid-cols-3 gap-3">
            {CONTADORES.map((c) => {
              const activo = filtro === c.clave;
              return (
                <button
                  key={c.clave}
                  onClick={() => setFiltro(activo ? '' : c.clave)}
                  className={`rounded-2xl border p-4 text-left transition ${c.tono} ${
                    activo ? 'ring-2 ring-current' : c.n === 0 ? 'opacity-45' : 'hover:brightness-125'
                  }`}
                >
                  <p className="text-3xl font-black tabular-nums leading-none">{c.n}</p>
                  <p className="text-xs font-bold mt-1.5 flex items-center gap-1.5">
                    <c.icono className="w-3.5 h-3.5" /> {c.texto}
                  </p>
                </button>
              );
            })}
          </div>

          <Card className="!p-3">
            <div className="flex gap-2 flex-wrap items-center">
              <input className={`${inputCls} flex-1 min-w-48`} value={buscar}
                onChange={(e) => setBuscar(e.target.value)} placeholder="🔍 Cliente u objetivo..." />
              <select className="rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 text-xs font-semibold"
                value={fFase} onChange={(e) => setFFase(e.target.value)}>
                <option value="">Fase: todas</option>
                {FASES.map((f) => <option key={f.id} value={f.id}>{f.titulo}</option>)}
              </select>
              <button
                onClick={() => setFiltro(filtro === 'mios' ? '' : 'mios')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                  filtro === 'mios' ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}
              >
                Mis expedientes
              </button>
              {(filtro || fFase || buscar) && (
                <button onClick={() => { setFiltro(''); setFFase(''); setBuscar(''); }}
                  className="text-xs font-bold text-accent hover:underline">Quitar filtros</button>
              )}
            </div>
          </Card>

          {visibles.length === 0 ? (
            <Card>
              <p className="text-sm text-muted py-6 text-center">
                {expedientes.datos.length === 0
                  ? 'Todavía no hay ningún expediente energético. Crea el primero con el botón de arriba.'
                  : 'Ningún expediente con estos filtros.'}
              </p>
            </Card>
          ) : (
            <Card className="!p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
                    <th className="px-3 py-3">Cliente / objetivo</th>
                    <th className="px-3 py-3">Fase</th>
                    <th className="px-3 py-3">Pendiente principal</th>
                    <th className="px-3 py-3">Próxima acción</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map(({ e, nombre, estado }) => (
                    <tr key={e.id} className="border-b border-border/20 hover:bg-card/50 transition">
                      <td className="px-3 py-2.5">
                        <Link href={`/gestor/energia/${e.id}`} className="font-bold hover:text-accent transition">
                          {nombre}
                        </Link>
                        <span className="block text-[11px] text-muted truncate max-w-xs">
                          {e.titulo_corto || e.objetivo}
                        </span>
                        {/* El nivel va SIEMPRE con texto, no solo con color: con
                            sol en la pantalla del móvil el borde no se ve. */}
                        <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-md border text-[10px] font-black ${NIVEL[estado.nivel].tono}`}>
                          {estado.etiqueta}
                          {estado.diasParado != null && estado.diasParado > 0 && ` · ${estado.diasParado} d`}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${FASE[e.fase as FaseEnergia]?.tono || ''}`}>
                          {FASE[e.fase as FaseEnergia]?.titulo || e.fase}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs max-w-sm">
                        {estado.pendientePrincipal}
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                        {estado.proximaAccion ? (
                          <>
                            <span className="font-semibold block truncate max-w-[12rem]">
                              {estado.proximaAccion.texto}
                            </span>
                            <span className={estado.proximaAccion.vencida ? 'text-red-400 font-bold' : 'text-muted'}>
                              {estado.proximaAccion.responsable || 'Sin asignar'}
                              {estado.proximaAccion.fecha
                                ? ` · ${estado.proximaAccion.fecha.split('-').reverse().join('/')}`
                                : ' · sin fecha'}
                            </span>
                          </>
                        ) : (
                          <span className="text-red-400 font-bold">Sin acción: asignar</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          <p className="text-[11px] text-muted">
            Ningún expediente abierto puede quedarse sin siguiente acción, con responsable y con fecha.
            Los que están así salen los primeros y en rojo, aunque se hayan tocado hoy.
          </p>
        </>
      )}
    </div>
  );
}
