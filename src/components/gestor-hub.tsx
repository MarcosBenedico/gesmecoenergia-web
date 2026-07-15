'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Smartphone, Shield, Zap, ArrowRight, Users, FolderOpen, Target, Euro,
  CalendarClock, BellRing, TrendingUp, FileSpreadsheet, Calculator, Sun,
  ClipboardList, CalendarDays, Loader,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUsuario, tokenSesion } from '@/lib/usuario';

/**
 * Hub de inicio del Panel de Gestión: las tres áreas de negocio con KPIs en vivo
 * y acceso rápido a las herramientas de energía clásicas.
 */

const eur0 = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €';

interface KpisModulo {
  cargado: boolean;
  activo: boolean;
  lineas: { valor: string; etiqueta: string }[];
  alerta?: string;
}

const SIN_CARGAR: KpisModulo = { cargado: false, activo: false, lineas: [] };

async function api(url: string): Promise<any[] | null> {
  try {
    const token = await tokenSesion();
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) return null;
    const json = await res.json();
    return json.datos || json.clientes || [];
  } catch {
    return null;
  }
}

export function GestorHub({ onIr }: { onIr: (seccion: string) => void }) {
  const { veModulo } = useUsuario();
  const [app, setApp] = useState<KpisModulo>(SIN_CARGAR);
  const [correbin, setCorrebin] = useState<KpisModulo>(SIN_CARGAR);
  const [luz, setLuz] = useState<KpisModulo>(SIN_CARGAR);

  useEffect(() => {
    // App Clientes
    (async () => {
      try {
        const [{ count: nClientes }, { count: nSuministros }, { count: nDocs }] = await Promise.all([
          supabase.from('clientes_app').select('id', { count: 'exact', head: true }),
          supabase.from('suministros').select('id', { count: 'exact', head: true }),
          supabase.from('documentos_cliente').select('id', { count: 'exact', head: true }).eq('analizado', false),
        ]);
        setApp({
          cargado: true, activo: true,
          lineas: [
            { valor: String(nClientes ?? 0), etiqueta: 'clientes' },
            { valor: String(nSuministros ?? 0), etiqueta: 'suministros' },
          ],
          alerta: (nDocs ?? 0) > 0 ? `${nDocs} documento(s) sin analizar` : undefined,
        });
      } catch {
        setApp({ cargado: true, activo: false, lineas: [] });
      }
    })();

    // Correbin · Vencimientos y Cartera
    (async () => {
      const polizas = await api('/api/correbin/polizas');
      if (!polizas) { setCorrebin({ cargado: true, activo: false, lineas: [] }); return; }
      const tareas = (await api('/api/correbin/tareas?estado=pendiente')) || [];
      const vivas = polizas.filter((p: any) => ['activa', 'viva', 'pendiente_revision', 'sin_datos'].includes(p.estado));
      const prima = vivas.reduce((s: number, p: any) => s + (Number(p.prima_anual) || 0), 0);
      const hoy = Date.now();
      const vencen30 = vivas.filter((p: any) => {
        if (!p.fecha_vencimiento) return false;
        const d = (new Date(p.fecha_vencimiento).getTime() - hoy) / 86400000;
        return d >= 0 && d <= 30;
      });
      setCorrebin({
        cargado: true, activo: true,
        lineas: [
          { valor: String(vivas.length), etiqueta: 'pólizas vivas' },
          { valor: eur0(prima), etiqueta: 'prima anual' },
        ],
        alerta: vencen30.length
          ? `${vencen30.length} vencimiento(s) en 30 días`
          : tareas.length ? `${tareas.length} tarea(s) pendientes` : undefined,
      });
    })();

    // Gestión Luz
    (async () => {
      const cups = await api('/api/luz/cups');
      if (!cups) { setLuz({ cargado: true, activo: false, lineas: [] }); return; }
      const [clientes, pipeline, comisiones, tareas] = await Promise.all([
        api('/api/luz/clientes').then((d) => d || []),
        api('/api/luz/pipeline').then((d) => d || []),
        api('/api/luz/comisiones').then((d) => d || []),
        api('/api/luz/tareas').then((d) => d || []),
      ]);
      const abiertas = pipeline.filter((o: any) => !['ganado', 'perdido', 'revisar_adelante'].includes(o.estado));
      const comisionPot = abiertas.reduce((s: number, o: any) => s + (Number(o.comision_potencial) || 0), 0);
      const pendiente = comisiones
        .filter((c: any) => ['prevista', 'pendiente_validar', 'pendiente_cobro', 'reclamada', 'cobrada_parcial'].includes(c.estado_comision))
        .reduce((s: number, c: any) => s + (Number(c.importe_previsto) || 0) - (Number(c.importe_cobrado) || 0), 0);
      const cobrada = comisiones.reduce((s: number, c: any) => s + (Number(c.importe_cobrado) || 0), 0);
      const sinAccion = abiertas.filter((o: any) => !o.proxima_accion);
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const tareasVencidas = tareas.filter((t: any) =>
        ['pendiente', 'en_curso', 'bloqueada'].includes(t.estado) && t.fecha_limite && new Date(t.fecha_limite) < hoy);
      setLuz({
        cargado: true, activo: true,
        lineas: [
          { valor: String(clientes.length), etiqueta: 'clientes' },
          { valor: String(cups.length), etiqueta: 'CUPS' },
          { valor: eur0(cobrada + pendiente), etiqueta: `comisión (${eur0(pendiente)} pte.)` },
        ],
        alerta: tareasVencidas.length
          ? `${tareasVencidas.length} tarea(s) fuera de plazo`
          : sinAccion.length
          ? `${sinAccion.length} oportunidad(es) sin próxima acción`
          : comisionPot > 0 ? `${eur0(comisionPot)} de comisión en pipeline` : undefined,
      });
    })();
  }, []);

  const MODULOS = [
    {
      modulo: 'luz',
      href: '/gestor/luz',
      nombre: 'Gestión Luz',
      sub: 'Cartera energética · CUPS · comisiones',
      icono: Zap,
      kpis: luz,
      grad: 'from-amber-500/20 via-amber-500/5 to-transparent',
      borde: 'border-amber-500/30 hover:border-amber-400/70',
      chip: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      glow: 'group-hover:shadow-[0_20px_60px_rgba(245,158,11,0.15)]',
      accesos: [
        { nombre: 'CUPS', href: '/gestor/luz/cups', icono: ClipboardList },
        { nombre: 'Fechas críticas', href: '/gestor/luz/fechas', icono: CalendarClock },
        { nombre: 'Pipeline', href: '/gestor/luz/pipeline', icono: Target },
        { nombre: 'Comisiones', href: '/gestor/luz/comisiones', icono: Euro },
      ],
      sqlFile: 'supabase_luz.sql',
    },
    {
      modulo: 'correbin',
      href: '/gestor/correbin',
      nombre: 'Vencimientos y Cartera',
      sub: 'Correbin Asociados · seguros',
      icono: Shield,
      kpis: correbin,
      grad: 'from-cyan-500/20 via-cyan-500/5 to-transparent',
      borde: 'border-cyan-500/30 hover:border-cyan-400/70',
      chip: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
      glow: 'group-hover:shadow-[0_20px_60px_rgba(6,182,212,0.15)]',
      accesos: [
        { nombre: 'Cartera', href: '/gestor/correbin/cartera', icono: FolderOpen },
        { nombre: 'Calendario', href: '/gestor/correbin/calendario', icono: CalendarDays },
        { nombre: 'Pipeline', href: '/gestor/correbin/pipeline', icono: Target },
        { nombre: 'Tareas', href: '/gestor/correbin/tareas', icono: BellRing },
      ],
      sqlFile: 'supabase_correbin_v2.sql',
    },
    {
      modulo: 'app_clientes',
      href: '/gestor/clientes-app',
      nombre: 'App Clientes',
      sub: 'Consumos · documentos · suministros',
      icono: Smartphone,
      kpis: app,
      grad: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
      borde: 'border-emerald-500/30 hover:border-emerald-400/70',
      chip: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      glow: 'group-hover:shadow-[0_20px_60px_rgba(16,185,129,0.15)]',
      accesos: [
        { nombre: 'Clientes y consumos', href: '/gestor/clientes-app', icono: Users },
      ],
      sqlFile: '',
    },
  ];

  const HERRAMIENTAS = [
    { seccion: 'view', nombre: 'Ver Tarifas', desc: 'Precios por comercializadora', icono: FileSpreadsheet },
    { seccion: 'create', nombre: 'Crear Tarifa', desc: 'Alta de precios', icono: TrendingUp },
    { seccion: 'margenes', nombre: 'Comparativa', desc: 'Simulador con fee y comisión', icono: Calculator },
    { seccion: 'clientes', nombre: 'Gestionar Clientes', desc: 'Clientes de comparativas', icono: Users },
    { seccion: 'seguimientos', nombre: 'Seguimientos', desc: 'Historial comercial', icono: ClipboardList },
    { seccion: 'calendario', nombre: 'Calendario', desc: 'Agenda y Google Calendar', icono: CalendarDays },
    { seccion: 'fotovoltaico', nombre: 'Generador Fotovoltaico', desc: 'Proyectos solares', icono: Sun },
  ];

  return (
    <div className="space-y-8">
      {/* ── Módulos principales ── */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-muted mb-3">
          Áreas de negocio
        </p>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {MODULOS.filter((mod) => veModulo(mod.modulo)).map((mod) => {
            const Icono = mod.icono;
            return (
              <div
                key={mod.href}
                className={`group relative overflow-hidden rounded-2xl border bg-surface/60 transition-all duration-300 hover:-translate-y-1 ${mod.borde} ${mod.glow}`}
              >
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${mod.grad}`} />
                <div className="relative p-5 space-y-4">
                  <Link href={mod.href} className="block">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${mod.chip}`}>
                          <Icono className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-black text-foreground leading-tight">{mod.nombre}</h3>
                          <p className="text-[11px] text-muted truncate">{mod.sub}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted group-hover:text-foreground group-hover:translate-x-1 transition shrink-0 mt-1" />
                    </div>
                  </Link>

                  {/* KPIs en vivo */}
                  {!mod.kpis.cargado ? (
                    <div className="flex items-center gap-2 text-muted text-xs py-3">
                      <Loader className="w-3.5 h-3.5 animate-spin" /> Cargando datos...
                    </div>
                  ) : !mod.kpis.activo ? (
                    <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-2">
                      Módulo pendiente de activar: ejecuta <code className="font-mono">{mod.sqlFile}</code> en Supabase.
                    </p>
                  ) : (
                    <>
                      <div className="flex gap-5">
                        {mod.kpis.lineas.map((l) => (
                          <div key={l.etiqueta}>
                            <p className="text-xl font-black text-foreground tabular-nums leading-tight">{l.valor}</p>
                            <p className="text-[10px] uppercase tracking-wide font-bold text-muted">{l.etiqueta}</p>
                          </div>
                        ))}
                      </div>
                      {mod.kpis.alerta && (
                        <p className="text-[11px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
                          ⚠️ {mod.kpis.alerta}
                        </p>
                      )}
                    </>
                  )}

                  {/* Accesos directos */}
                  <div className="flex gap-1.5 flex-wrap pt-1 border-t border-border/30">
                    {mod.accesos.map((a) => {
                      const IconoA = a.icono;
                      return (
                        <Link
                          key={a.href + a.nombre}
                          href={a.href}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card/70 border border-border/40 text-[11px] font-semibold text-muted hover:text-foreground hover:border-border transition"
                        >
                          <IconoA className="w-3 h-3" />
                          {a.nombre}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Herramientas de energía (clásicas) ── */}
      <div className={veModulo('herramientas') ? '' : 'hidden'}>
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-muted mb-3">
          Herramientas de energía
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {HERRAMIENTAS.map((h) => {
            const Icono = h.icono;
            return (
              <button
                key={h.seccion}
                onClick={() => onIr(h.seccion)}
                className="group text-left p-4 rounded-xl border border-border/40 bg-surface/50 hover:bg-card/70 hover:border-accent/40 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition">
                    <Icono className="w-4 h-4 text-accent" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground leading-tight">{h.nombre}</h4>
                </div>
                <p className="text-[11px] text-muted leading-snug">{h.desc}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
