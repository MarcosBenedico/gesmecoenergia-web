'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowRight, CalendarDays, ClipboardList, Euro, FileDown, Loader,
  TrendingDown, TrendingUp, UserRound, Sparkles,
} from 'lucide-react';
import { tokenSesion, useUsuario } from '@/lib/usuario';
import type { Accion } from '@/lib/parte-diario';
import type { ParteCompleto } from '@/lib/parte-pdf';
import { Card, btnPrimario, btnSecundario } from '../ui';

/**
 * EL PARTE DEL DÍA.
 *
 * El mismo papel que rellena David a mano, pero sacado del sistema: qué se
 * movió, quién lo movió y qué mejoró en cada cliente. Sirve para cruzar lo que
 * se cuenta con lo que quedó registrado, y para que Marcos no dependa de que
 * alguien se acuerde de contárselo.
 *
 * Se ordena por lo que mueve el negocio, no por la hora: primero las altas y
 * los avances, después el dinero, y el detalle rutinario al final y plegado.
 * Una lista cronológica plana obliga a leerla entera para encontrar lo bueno.
 */

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const sumarDias = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const enLargo = (iso: string) => {
  const d = new Date(iso + 'T12:00:00');
  const s = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const eur = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/** Una acción, con su hora, su frase y el detalle de lo que cambió. */
function Linea({ a, tono }: { a: Accion; tono: string }) {
  return (
    <div className={`flex gap-3 py-2 border-b border-border/20 last:border-0 ${tono}`}>
      <span className="text-[11px] font-mono text-muted tabular-nums pt-0.5 shrink-0 w-10">{a.hora}</span>
      <span className="text-base leading-none pt-0.5 shrink-0">{a.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground leading-snug">
          <span className="font-semibold">{a.titulo}</span>
          {a.cliente && a.cliente !== a.titulo && (
            <span className="text-muted"> · {a.cliente}</span>
          )}
        </p>
        {a.cambios.length > 0 ? (
          <ul className="mt-1 space-y-0.5">
            {a.cambios.map((c, i) => (
              <li key={i} className="text-[11px] text-muted flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-foreground/70">{c.etiqueta}</span>
                <span className="line-through opacity-60">{c.de}</span>
                <ArrowRight className="w-3 h-3 shrink-0" />
                <span className="text-foreground font-semibold">{c.a}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-muted mt-0.5">
            {a.operacion === 'INSERT' ? `Alta de ${a.entidad.toLowerCase()}` : a.entidad}
          </p>
        )}
      </div>
      <span className="text-[11px] text-muted shrink-0 pt-0.5">{a.persona}</span>
    </div>
  );
}

function Seccion({
  titulo, pista, icono: Icono, color, acciones, tono = '',
}: {
  titulo: string; pista: string; icono: typeof TrendingUp; color: string;
  acciones: Accion[]; tono?: string;
}) {
  if (!acciones.length) return null;
  return (
    <Card className="!p-0 overflow-hidden break-inside-avoid">
      <div className="px-4 py-2.5 border-b border-border/40 flex items-center gap-2.5">
        <Icono className={`w-4 h-4 ${color}`} />
        <p className="font-bold text-foreground text-sm">{titulo}</p>
        <span className="text-[11px] text-muted">{pista}</span>
        <span className="ml-auto text-sm font-black tabular-nums text-foreground">{acciones.length}</span>
      </div>
      <div className="px-4">
        {acciones.map((a, i) => <Linea key={i} a={a} tono={tono} />)}
      </div>
    </Card>
  );
}

export default function PartePage() {
  const { esAdmin, cargando: cargandoPerfil } = useUsuario();
  const [fecha, setFecha] = useState(hoyISO());
  const [parte, setParte] = useState<ParteCompleto | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [verResto, setVerResto] = useState(false);
  const [generando, setGenerando] = useState(false);

  /**
   * El PDF se dibuja con jsPDF, no imprimiendo la pantalla. Imprimir el panel
   * mandaba al papel el tema oscuro, el menú y los saltos donde cayeran.
   * La librería se carga solo al pulsar: no tiene por qué viajar en la página.
   */
  const descargarPdf = async () => {
    if (!parte) return;
    setGenerando(true);
    setError('');
    try {
      const { descargarPartePdf } = await import('@/lib/parte-pdf');
      await descargarPartePdf(parte);
    } catch (e) {
      setError(`No se ha podido generar el PDF: ${e instanceof Error ? e.message : 'error desconocido'}`);
    } finally {
      setGenerando(false);
    }
  };

  const sacar = useCallback(async (dia: string) => {
    setCargando(true); setError(''); setParte(null);
    try {
      const token = await tokenSesion();
      const res = await fetch(`/api/luz/parte?fecha=${dia}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'No se ha podido sacar el parte.'); return; }
      setParte(json);
    } catch {
      setError('Error de conexión.');
    } finally {
      setCargando(false);
    }
  }, []);

  // Al entrar, el parte de hoy ya hecho: si hay que darle a un botón para ver
  // lo básico, se acaba no mirando.
  useEffect(() => { if (esAdmin) sacar(hoyISO()); }, [esAdmin, sacar]);

  if (!cargandoPerfil && !esAdmin) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-foreground">El parte del día es solo para dirección</p>
            <p className="text-sm text-muted mt-1">
              Enseña la actividad de todo el equipo persona por persona.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const r = parte?.resumen;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-2.5">
            <ClipboardList className="w-7 h-7 text-accent" /> Parte del día
          </h1>
          <p className="text-sm text-muted mt-1">
            Todo lo que se movió en la cartera ese día, quién lo movió y qué mejoró en cada cliente.
            Sale de la auditoría del sistema, no de que alguien se acuerde de contarlo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <button type="button" onClick={() => { setFecha(hoyISO()); sacar(hoyISO()); }} className={`${btnSecundario} !py-1.5 !text-xs`}>Hoy</button>
          <button type="button" onClick={() => { const a = sumarDias(hoyISO(), -1); setFecha(a); sacar(a); }} className={`${btnSecundario} !py-1.5 !text-xs`}>Ayer</button>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card/80 border border-border/50">
            <CalendarDays className="w-4 h-4 text-muted shrink-0" />
            <input
              type="date"
              value={fecha}
              max={hoyISO()}
              onChange={(e) => setFecha(e.target.value)}
              className="bg-transparent text-sm text-foreground outline-none"
            />
          </div>
          <button type="button" onClick={() => sacar(fecha)} disabled={cargando} className={btnPrimario}>
            {cargando ? <Loader className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Sacar el parte
          </button>
          {parte?.hay_movimiento && (
            <button
              type="button"
              onClick={descargarPdf}
              disabled={generando}
              className={btnSecundario}
              title="Descarga el informe completo con la ficha de cada cliente"
            >
              {generando ? <Loader className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              Descargar PDF
            </button>
          )}
        </div>
      </div>

      <div className="border-b border-border/40 pb-2">
        <p className="text-lg font-bold text-foreground">{enLargo(fecha)}</p>
      </div>

      {error && (
        <Card className="!border-red-500/40">
          <p className="text-sm text-red-400">{error}</p>
        </Card>
      )}

      {cargando && (
        <div className="text-center py-10 text-muted text-sm">
          <Loader className="w-5 h-5 mx-auto mb-2 animate-spin" /> Montando el parte...
        </div>
      )}

      {parte && !parte.hay_movimiento && (
        <Card>
          <p className="text-sm text-muted">
            Ese día no se registró ni un movimiento en la cartera. Si fue un día de trabajo,
            entonces lo que falta no es actividad: es que no llegó al sistema.
          </p>
        </Card>
      )}

      {parte?.hay_movimiento && r && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { v: r.acciones, t: 'movimientos', c: 'text-foreground' },
              { v: r.clientes_nuevos, t: 'clientes nuevos', c: r.clientes_nuevos ? 'text-emerald-400' : 'text-muted' },
              { v: r.suministros_nuevos, t: 'suministros nuevos', c: r.suministros_nuevos ? 'text-emerald-400' : 'text-muted' },
              { v: r.contratos_firmados, t: 'contratos firmados', c: r.contratos_firmados ? 'text-emerald-400' : 'text-muted' },
              { v: r.activaciones, t: 'activaciones', c: r.activaciones ? 'text-emerald-400' : 'text-muted' },
              { v: r.importe_cobrado ? eur(r.importe_cobrado) : '—', t: 'cobrado', c: r.importe_cobrado ? 'text-amber-400' : 'text-muted' },
            ].map((k, i) => (
              <Card key={i} className="!p-3.5 text-center break-inside-avoid">
                <p className={`text-2xl font-black tabular-nums ${k.c}`}>{k.v}</p>
                <p className="text-[10px] text-muted mt-1 uppercase tracking-wide font-semibold">{k.t}</p>
              </Card>
            ))}
          </div>

          {parte.truncado && (
            <Card className="!border-amber-500/40">
              <p className="text-xs text-amber-400">
                Ese día tuvo más de 3.000 movimientos y el parte se ha cortado ahí. Suele significar
                una importación masiva, no un día de trabajo normal.
              </p>
            </Card>
          )}

          <Seccion titulo="Altas nuevas" pista="lo que ha entrado hoy en la cartera"
                   icono={Sparkles} color="text-emerald-400" acciones={parte.altas} />

          <Seccion titulo="Avances" pista="lo que ha mejorado en cada cliente"
                   icono={TrendingUp} color="text-emerald-400" acciones={parte.avances} />

          <Seccion titulo="Dinero" pista="comisiones e importes cobrados"
                   icono={Euro} color="text-amber-400" acciones={parte.dinero} />

          <Seccion titulo="Retrocesos" pista="lo que hay que mirar antes de mañana"
                   icono={TrendingDown} color="text-red-400" acciones={parte.retrocesos} />

          {!!parte.fichas?.length && (
            <Card className="!p-0 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/40 flex items-center gap-2.5">
                <ClipboardList className="w-4 h-4 text-accent" />
                <p className="font-bold text-foreground text-sm">Clientes del día</p>
                <span className="text-[11px] text-muted">
                  {parte.fichas.filter((f) => f.captado_hoy).length} captados ·{' '}
                  {parte.fichas.filter((f) => !f.captado_hoy).length} movidos
                </span>
                <span className="ml-auto text-[11px] text-muted">la ficha completa va en el PDF</span>
              </div>
              <div className="divide-y divide-border/20">
                {parte.fichas.map((f) => {
                  const c = f.cliente as Record<string, string>;
                  const pendiente = c.proxima_accion
                    || (f.tareas[0] as Record<string, string> | undefined)?.descripcion
                    || null;
                  return (
                    <div key={f.id} className="px-4 py-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className={`text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        f.captado_hoy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-accent/15 text-accent'
                      }`}>
                        {f.captado_hoy ? 'captado' : 'movido'}
                      </span>
                      <span className="font-semibold text-foreground text-sm">{c.nombre}</span>
                      <span className="text-[11px] text-muted">
                        {f.cups.length} suministro(s) · {f.pipeline.length} oportunidad(es) · {f.tareas.length} tarea(s) abiertas
                      </span>
                      <span className={`text-[11px] ml-auto ${pendiente ? 'text-muted' : 'text-red-400 font-semibold'}`}>
                        {pendiente ? `Siguiente: ${pendiente}` : 'Sin acción pendiente'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card className="!p-0 overflow-hidden break-inside-avoid">
            <div className="px-4 py-2.5 border-b border-border/40 flex items-center gap-2.5">
              <UserRound className="w-4 h-4 text-accent" />
              <p className="font-bold text-foreground text-sm">Quién ha hecho qué</p>
              <span className="text-[11px] text-muted">{parte.personas.length} personas han tocado el sistema</span>
            </div>
            <div className="divide-y divide-border/20">
              {parte.personas.map((p) => (
                <div key={p.persona} className="px-4 py-3 break-inside-avoid">
                  <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                    <p className="font-bold text-foreground">{p.persona}</p>
                    <span className="text-[11px] text-muted tabular-nums">{p.total} movimientos</span>
                    {p.altas > 0 && <span className="text-[11px] text-emerald-400 font-semibold">{p.altas} altas</span>}
                    {p.avances > 0 && <span className="text-[11px] text-emerald-400 font-semibold">{p.avances} avances</span>}
                    {p.retrocesos > 0 && <span className="text-[11px] text-red-400 font-semibold">{p.retrocesos} retrocesos</span>}
                  </div>
                  <div className="pl-1">
                    {p.acciones.slice(0, 40).map((a, i) => <Linea key={i} a={a} tono="" />)}
                  </div>
                  {p.acciones.length > 40 && (
                    <p className="text-[11px] text-muted mt-1">y {p.acciones.length - 40} movimientos más</p>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {parte.resto.length > 0 && (
            <Card className="!p-0 overflow-hidden no-print">
              <button
                type="button"
                onClick={() => setVerResto((v) => !v)}
                className="w-full px-4 py-2.5 flex items-center gap-2.5 text-left hover:bg-card/40 transition"
              >
                <span className="text-xs font-bold text-muted">{verResto ? '−' : '+'}</span>
                <p className="font-bold text-foreground text-sm">Detalle rutinario</p>
                <span className="text-[11px] text-muted">datos completados, notas y cambios menores</span>
                <span className="ml-auto text-sm font-black tabular-nums text-muted">{parte.resto.length}</span>
              </button>
              {verResto && (
                <div className="px-4 pb-2 border-t border-border/40">
                  {parte.resto.map((a, i) => <Linea key={i} a={a} tono="" />)}
                </div>
              )}
            </Card>
          )}

          <Card>
            <p className="text-[11px] text-muted leading-relaxed">
              <strong className="text-foreground">Cómo leerlo.</strong> La hora es la del momento en que
              se guardó en el sistema, no la del trabajo: una visita de las nueve que se mete a las seis
              aparece a las seis. Esto dice <strong className="text-foreground">qué</strong> pasó y
              <strong className="text-foreground"> quién</strong> lo movió, no cuántas horas echó nadie.
              Un día sin movimientos no significa que no se trabajara: significa que no llegó al sistema.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
