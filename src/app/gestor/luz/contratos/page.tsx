'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, X, Search } from 'lucide-react';
import {
  LuzContrato, LuzCliente, LuzCups, ESTADOS_CONTRATO, ESTADO_CONTRATO_LABEL, CONTRATO_EN_CURSO,
  TARIFAS_ACCESO, diasHasta, fmtFecha,
} from '@/lib/luz';
import { BotonDescarga, Card, Kpi, Badge, EstadoCarga, useListaLuz, guardarLuz, inputCls, labelCls, btnPrimario, btnSecundario, SelectorResponsable } from '../ui';

const CONTRATO_VACIO = { cliente_id: '', cups_id: '', comercializadora_final: '', tarifa_acceso: '2.0TD', estado_contrato: 'pendiente_preparar', fecha_activacion_prevista: '', responsable: '' };

/** Sin acentos y en minúsculas: se busca «Perez» y aparece «Pérez». */
const norm = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Resalta en amarillo los trozos que coinciden con lo buscado.
 * Se aplica sobre el texto ya pintado, sin tocar el dato.
 */
function Resaltado({ texto, busca }: { texto: string; busca: string[] }) {
  if (!busca.length || !texto) return <>{texto}</>;
  const plano = norm(texto);
  // Marcar qué caracteres forman parte de alguna coincidencia
  const marcado = new Array(texto.length).fill(false);
  for (const palabra of busca) {
    let desde = 0;
    for (;;) {
      const i = plano.indexOf(palabra, desde);
      if (i === -1) break;
      for (let j = i; j < i + palabra.length; j++) marcado[j] = true;
      desde = i + palabra.length;
    }
  }
  // Agrupar en tramos seguidos para no crear un <span> por letra
  const trozos: { texto: string; marca: boolean }[] = [];
  for (let i = 0; i < texto.length; i++) {
    const ultimo = trozos[trozos.length - 1];
    if (ultimo && ultimo.marca === marcado[i]) ultimo.texto += texto[i];
    else trozos.push({ texto: texto[i], marca: marcado[i] });
  }
  return (
    <>
      {trozos.map((t, i) =>
        t.marca
          ? <mark key={i} className="bg-amber-400/30 text-amber-200 rounded px-0.5">{t.texto}</mark>
          : <span key={i}>{t.texto}</span>
      )}
    </>
  );
}

function ContratosContenido() {
  const sp = useSearchParams();
  const { datos, cargando, error, faltaMigracion, recargar } = useListaLuz<LuzContrato>('contratos');
  const clientes = useListaLuz<LuzCliente>('clientes');
  const cups = useListaLuz<LuzCups>('cups');
  const [fEstado, setFEstado] = useState(sp.get('estado_contrato') || '');
  const [fEspecial, setFEspecial] = useState('');
  const [buscar, setBuscar] = useState('');
  const cajaBuscar = useRef<HTMLInputElement>(null);

  // Atajos: «/» enfoca el buscador y Escape lo limpia. Se salta si ya se está
  // escribiendo en otro campo, para no robar teclas mientras se rellena el alta.
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      const enCampo = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName || '');
      if (e.key === '/' && !enCampo) {
        e.preventDefault();
        cajaBuscar.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === cajaBuscar.current) {
        setBuscar('');
        cajaBuscar.current?.blur();
      }
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, []);
  const [msg, setMsg] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(CONTRATO_VACIO);
  const [errorForm, setErrorForm] = useState('');

  const cupsDelCliente = useMemo(() => cups.datos.filter((c) => c.cliente_id === form.cliente_id), [cups.datos, form.cliente_id]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente_id) { setErrorForm('Selecciona el cliente.'); return; }
    setErrorForm('');
    const err = await guardarLuz('contratos', 'POST', {
      ...form,
      cups_id: form.cups_id || null,
      fecha_activacion_prevista: form.fecha_activacion_prevista || null,
      responsable: form.responsable || null,
    });
    if (err) { setErrorForm(err); return; }
    setForm(CONTRATO_VACIO); setMostrarForm(false);
    recargar();
  }

  const mesActual = new Date().toISOString().slice(0, 7);

  /**
   * Todo el texto por el que se puede encontrar un contrato: cliente, NIF,
   * CUPS, alias del suministro, comercializadora, estado, responsable,
   * incidencia y tarifa. El NIF y el alias no están en el contrato, así que
   * se completan con los clientes y CUPS que ya están cargados.
   */
  const textoDe = useMemo(() => {
    const porCliente = new Map(clientes.datos.map((c) => [c.id, c]));
    const porCups = new Map(cups.datos.map((c) => [c.id, c]));
    const m = new Map<string, string>();
    for (const c of datos) {
      const cli = c.cliente_id ? porCliente.get(c.cliente_id) : null;
      const sum = c.cups_id ? porCups.get(c.cups_id) : null;
      m.set(c.id, norm([
        c.luz_clientes?.nombre, cli?.nombre, cli?.nif, cli?.telefono,
        c.luz_cups?.cups, sum?.cups, sum?.alias_suministro, sum?.direccion_suministro,
        c.comercializadora_final, c.tarifa_acceso, c.responsable, c.incidencia,
        c.observaciones, ESTADO_CONTRATO_LABEL[c.estado_contrato],
      ].filter(Boolean).join(' ')));
    }
    return m;
  }, [datos, clientes.datos, cups.datos]);

  /**
   * Atajos de búsqueda: las comercializadoras y responsables que de verdad
   * aparecen en los contratos, ordenados por frecuencia. Nada inventado.
   */
  const sugerencias = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const c of datos) {
      for (const v of [c.comercializadora_final, c.responsable]) {
        const t = v?.trim();
        if (t) cuenta.set(t, (cuenta.get(t) || 0) + 1);
      }
    }
    return Array.from(cuenta.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([t]) => t);
  }, [datos]);

  /** Palabras sueltas: «perez activado» encuentra lo que tenga las dos. */
  const palabras = useMemo(
    () => norm(buscar).split(/\s+/).filter(Boolean),
    [buscar]
  );

  const filtrados = useMemo(() => datos.filter((c) => {
    if (palabras.length) {
      const texto = textoDe.get(c.id) || '';
      if (!palabras.every((p) => texto.includes(p))) return false;
    }
    if (fEstado && c.estado_contrato !== fEstado) return false;
    if (fEspecial === 'firmado_sin_enviar' && !(c.estado_contrato === 'firmado' && !c.fecha_envio_comercializadora)) return false;
    if (fEspecial === 'enviado_sin_validar' && !['enviado_comercializadora', 'pendiente_validacion'].includes(c.estado_contrato)) return false;
    if (fEspecial === 'retrasadas' && !(CONTRATO_EN_CURSO.includes(c.estado_contrato) && (diasHasta(c.fecha_activacion_prevista) ?? 1) < 0)) return false;
    if (fEspecial === 'incidencia' && c.estado_contrato !== 'incidencia' && !c.incidencia) return false;
    if (fEspecial === 'activados_mes' && !c.fecha_activacion_real?.startsWith(mesActual)) return false;
    if (fEspecial === 'rechazados' && c.estado_contrato !== 'rechazado') return false;
    return true;
  }), [datos, fEstado, fEspecial, mesActual, palabras, textoDe]);

  const pendFirma = datos.filter((c) => ['enviado_cliente', 'pendiente_firma'].includes(c.estado_contrato));
  const pendActivacion = datos.filter((c) => ['firmado', 'enviado_comercializadora', 'pendiente_validacion', 'pendiente_activacion'].includes(c.estado_contrato));
  const activadosMes = datos.filter((c) => c.fecha_activacion_real?.startsWith(mesActual));

  async function cambiar(c: LuzContrato, campos: Record<string, unknown>) {
    // Rechazo exige motivo/incidencia
    if (campos.estado_contrato === 'rechazado' && !c.incidencia) {
      const motivo = prompt('Motivo del rechazo / incidencia (obligatorio):');
      if (!motivo?.trim()) return;
      campos.incidencia = motivo.trim();
    }
    const err = await guardarLuz('contratos', 'PUT', { id: c.id, ...campos });
    if (err) { setMsg(err); return; }
    setMsg(campos.estado_contrato === 'activado' ? '✓ Contrato activado — el CUPS pasa a "activado".' : '');
    recargar();
  }

  const selCls = 'rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 text-xs font-semibold';
  const FechaEditable = ({ c, campo }: { c: LuzContrato; campo: keyof LuzContrato }) => (
    <input
      type="date"
      className="rounded-md border border-border/40 bg-background/60 px-1 py-0.5 text-[10px] w-28"
      defaultValue={(c[campo] as string) || ''}
      onBlur={(e) => e.target.value !== ((c[campo] as string) || '') && cambiar(c, { [campo]: e.target.value || null })}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Contratos y Activaciones</h2>
          <p className="text-xs text-muted mt-0.5">Que ninguna venta se pierda después del sí: firma → envío → validación → activación.</p>
        </div>
        <div className="flex gap-2">
          <BotonDescarga href={`/api/luz/exportar?tipo=contratos${fEstado ? `&estado_contrato=${fEstado}` : ''}`} className={btnSecundario}>Exportar</BotonDescarga>
          <button onClick={() => setMostrarForm((v) => !v)} className={btnPrimario}>
            {mostrarForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {mostrarForm ? 'Cancelar' : 'Nuevo contrato'}
          </button>
        </div>
      </div>

      {mostrarForm && (
        <Card>
          <form onSubmit={crear} className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Cliente *</label>
                <select className={inputCls} value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value, cups_id: '' })}>
                  <option value="">— Selecciona —</option>
                  {clientes.datos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>CUPS (opcional)</label>
                <select className={inputCls} value={form.cups_id} onChange={(e) => setForm({ ...form, cups_id: e.target.value })} disabled={!form.cliente_id}>
                  <option value="">— Sin CUPS —</option>
                  {cupsDelCliente.map((c) => <option key={c.id} value={c.id}>{c.alias_suministro || c.cups}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Comercializadora final</label><input className={inputCls} value={form.comercializadora_final} onChange={(e) => setForm({ ...form, comercializadora_final: e.target.value })} /></div>
              <div>
                <label className={labelCls}>Tarifa</label>
                <select className={inputCls} value={form.tarifa_acceso} onChange={(e) => setForm({ ...form, tarifa_acceso: e.target.value })}>
                  {TARIFAS_ACCESO.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Estado inicial</label>
                <select className={inputCls} value={form.estado_contrato} onChange={(e) => setForm({ ...form, estado_contrato: e.target.value })}>
                  {ESTADOS_CONTRATO.map((es) => <option key={es} value={es}>{ESTADO_CONTRATO_LABEL[es]}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Activación prevista</label><input className={inputCls} type="date" value={form.fecha_activacion_prevista} onChange={(e) => setForm({ ...form, fecha_activacion_prevista: e.target.value })} /></div>
              <div>
                <label className={labelCls}>Responsable</label>
                <SelectorResponsable valor={form.responsable} onCambio={(v) => setForm((f) => ({ ...f, responsable: v || '' }))} className={inputCls} />
              </div>
            </div>
            {errorForm && <p className="text-xs text-red-400">{errorForm}</p>}
            <button type="submit" className={btnPrimario}>Crear contrato</button>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Kpi valor={pendFirma.length} etiqueta="Pendientes de firma" color={pendFirma.length ? 'text-amber-400' : 'text-foreground'} />
        <Kpi valor={pendActivacion.length} etiqueta="Pendientes de activación" color={pendActivacion.length ? 'text-amber-400' : 'text-foreground'} />
        <Kpi valor={activadosMes.length} etiqueta="Activados este mes" color="text-emerald-400" />
      </div>

      {msg && <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5">{msg}</p>}

      <Card className="!p-3 space-y-2.5">
        {/* Buscador: cliente, CUPS, comercializadora, responsable o incidencia */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            ref={cajaBuscar}
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar cliente, NIF, CUPS, comercializadora, responsable o incidencia…"
            aria-label="Buscar contratos y activaciones"
            className="w-full rounded-xl border border-border/50 bg-background/70 pl-10 pr-24 py-3 text-sm focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {buscar ? (
              <>
                <span className="text-[11px] font-bold tabular-nums text-muted">
                  {filtrados.length}/{datos.length}
                </span>
                <button
                  onClick={() => { setBuscar(''); cajaBuscar.current?.focus(); }}
                  className="text-muted hover:text-foreground transition"
                  title="Limpiar (Esc)"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <kbd className="hidden sm:block text-[10px] font-bold text-muted/60 border border-border/50 rounded px-1.5 py-0.5">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Sugerencias de un toque: lo que más se busca */}
        {!buscar && datos.length > 0 && (
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-[11px] text-muted">Buscar rápido:</span>
            {sugerencias.map((s) => (
              <button
                key={s}
                onClick={() => setBuscar(s)}
                className="px-2 py-1 rounded-lg bg-card/70 border border-border/40 text-[11px] font-semibold text-muted hover:text-foreground hover:border-border transition"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <select className={selCls} value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
            <option value="">Estado: todos</option>
            {ESTADOS_CONTRATO.map((es) => <option key={es} value={es}>{ESTADO_CONTRATO_LABEL[es]}</option>)}
          </select>
        </div>
        <div className="flex gap-1.5 flex-wrap text-xs">
          {[['', 'Todos'], ['firmado_sin_enviar', 'Firmado sin enviar'], ['enviado_sin_validar', 'Enviado sin validar'],
            ['retrasadas', '🔴 Activaciones retrasadas'], ['incidencia', '⚠️ Con incidencia'],
            ['activados_mes', '✓ Activados este mes'], ['rechazados', 'Rechazados']].map(([v, n]) => (
            <button key={v} onClick={() => setFEspecial(v)} className={`px-2.5 py-1.5 rounded-lg font-semibold ${fEspecial === v ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}>{n}</button>
          ))}
        </div>
      </Card>

      <EstadoCarga cargando={cargando} error={error} faltaMigracion={faltaMigracion}
        vacio={!cargando && !error && filtrados.length === 0 && !buscar}
        textoVacio="Sin contratos con este filtro. Créalos con el botón «Nuevo contrato» o desde el Pipeline (ganado → contrato)." sqlFile="supabase_luz.sql" />

      {/* Búsqueda sin resultados: se dice qué se buscó y cómo salir de ahí */}
      {!cargando && !error && buscar && filtrados.length === 0 && (
        <Card className="text-center py-8 space-y-3">
          <p className="text-sm text-muted">
            Ningún contrato coincide con <b className="text-foreground">«{buscar}»</b>
            {(fEstado || fEspecial) && ' con los filtros puestos'}.
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            <button onClick={() => setBuscar('')} className={btnSecundario}>Limpiar búsqueda</button>
            {(fEstado || fEspecial) && (
              <button onClick={() => { setFEstado(''); setFEspecial(''); }} className={btnSecundario}>
                Quitar los filtros
              </button>
            )}
          </div>
        </Card>
      )}

      {filtrados.length > 0 && (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
                <th className="px-3 py-3">Cliente</th><th className="px-3 py-3">CUPS</th>
                <th className="px-3 py-3">Comercializadora</th><th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">F. envío</th><th className="px-3 py-3">F. firma</th>
                <th className="px-3 py-3">Activación prevista</th><th className="px-3 py-3">Activación real</th>
                <th className="px-3 py-3">Responsable</th><th className="px-3 py-3">Incidencia</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const retrasada = CONTRATO_EN_CURSO.includes(c.estado_contrato) && (diasHasta(c.fecha_activacion_prevista) ?? 1) < 0;
                return (
                  <tr key={c.id} className={`border-b border-border/20 hover:bg-card/50 transition ${retrasada ? 'bg-red-500/5' : ''}`}>
                    <td className="px-3 py-2 font-semibold text-xs">
                      {c.cliente_id
                        ? <Link href={`/gestor/luz/clientes/${c.cliente_id}`} className="hover:text-accent">
                            <Resaltado texto={c.luz_clientes?.nombre || '—'} busca={palabras} />
                          </Link>
                        : <Resaltado texto={c.luz_clientes?.nombre || '—'} busca={palabras} />}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted">
                      <Resaltado texto={c.luz_cups?.cups || '—'} busca={palabras} />
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <Resaltado texto={c.comercializadora_final || '—'} busca={palabras} />
                    </td>
                    <td className="px-3 py-2">
                      <select value={c.estado_contrato} onChange={(e) => cambiar(c, { estado_contrato: e.target.value })}
                        className="rounded-md border border-border/40 bg-background/60 px-1.5 py-0.5 text-[11px] font-semibold max-w-36">
                        {ESTADOS_CONTRATO.map((es) => <option key={es} value={es}>{ESTADO_CONTRATO_LABEL[es]}</option>)}
                      </select>
                      {retrasada && <span className="block text-[10px] text-red-400 font-bold mt-0.5">⏰ retrasada</span>}
                    </td>
                    <td className="px-3 py-2"><FechaEditable c={c} campo="fecha_envio_contrato" /></td>
                    <td className="px-3 py-2"><FechaEditable c={c} campo="fecha_firma" /></td>
                    <td className="px-3 py-2"><FechaEditable c={c} campo="fecha_activacion_prevista" /></td>
                    <td className="px-3 py-2">
                      {c.fecha_activacion_real
                        ? <Badge tono="verde">{fmtFecha(c.fecha_activacion_real)}</Badge>
                        : <FechaEditable c={c} campo="fecha_activacion_real" />}
                    </td>
                    <td className="px-3 py-2">
                      <SelectorResponsable valor={c.responsable} onCambio={(v) => cambiar(c, { responsable: v })} />
                    </td>
                    <td className="px-3 py-2 text-xs text-red-400 max-w-40 truncate">{c.incidencia || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

export default function ContratosPage() {
  return (
    <Suspense fallback={<div className="text-muted text-sm py-8 text-center">Cargando...</div>}>
      <ContratosContenido />
    </Suspense>
  );
}
