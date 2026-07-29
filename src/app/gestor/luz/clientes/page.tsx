'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { UserPlus, X, Download, Trash2 } from 'lucide-react';
import {
  LuzCliente, LuzCups, TIPOS_CLIENTE, TIPO_CLIENTE_LABEL, PRIORIDADES, PRIORIDAD_LABEL,
  ESTADOS_CLIENTE, ESTADO_CLIENTE_LABEL, VIA_ENTRADA_CORTA, fmtKwh, fmtFecha,
} from '@/lib/luz';
import { ZONAS, zonaDeParada } from '@/lib/zonas';
import { evaluarCliente, tonoCompletitud } from '@/lib/completitud';
import { Card, BadgePrioridad, Badge, EstadoCarga, useListaLuz, guardarLuz, inputCls, labelCls, btnPrimario, btnSecundario, SelectorResponsable } from '../ui';
import { CLASIFICACIONES, defDe, ES_CLASIFICACION } from '@/lib/clasificacion';
import { PedirMotivo } from '../motivo';
import { MOTIVOS_ELIMINACION } from '@/lib/luz';

/**
 * Semáforo de "qué le falta". Rojo = no se puede ni empezar; ámbar = se puede
 * trabajar pero falta detalle; verde = listo para preparar oferta.
 * Al pasar por encima dice exactamente qué falta y por qué hace falta.
 */
function SemaforoCliente({ cliente, cups }: { cliente: LuzCliente; cups: LuzCups[] }) {
  const c = evaluarCliente(cliente, cups);
  const tono = tonoCompletitud(c);

  const estilo = {
    bloqueado: 'bg-red-500/15 text-red-400 border-red-500/30',
    incompleto: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    listo: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  }[tono];

  const pendientes = c.requisitos.filter((r) => !r.cumplido);
  const titulo = pendientes.length === 0
    ? 'Tiene todo lo necesario para preparar la oferta.'
    : pendientes.map((r) => `${r.etiqueta}: ${r.motivo}`).join('\n');

  return (
    <div className="min-w-28" title={titulo}>
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-black ${estilo}`}>
        {c.cumplidos}/{c.total}
        {tono === 'listo' ? ' · listo' : c.siguienteFalta ? ` · falta ${c.siguienteFalta.etiqueta.toLowerCase()}` : ''}
      </span>
      {/* Barra de puntos: se lee el avance sin tener que sumar */}
      <span className="flex gap-0.5 mt-1">
        {c.requisitos.map((r) => (
          <span key={r.clave}
            className={`h-1 flex-1 rounded-full ${
              r.cumplido ? 'bg-emerald-500/70' : r.bloqueante ? 'bg-red-500/50' : 'bg-border/50'
            }`} />
        ))}
      </span>
    </div>
  );
}

const FORM_VACIO = {
  nombre: '', nif: '', tipo_cliente: 'particular', persona_contacto: '', telefono: '', email: '',
  direccion_fiscal: '', responsable: '', prioridad: 'C', estado_comercial: 'detectado', via_entrada: 'captacion',
  potencial_comercial: '', origen_cliente: '', observaciones: '',
};

function ClientesLuzContenido() {
  const sp = useSearchParams();
  const [buscar, setBuscar] = useState('');
  const clientes = useListaLuz<LuzCliente>('clientes', buscar ? { buscar } : {});
  const cups = useListaLuz<LuzCups>('cups');

  const [fPrioridad, setFPrioridad] = useState(sp.get('prioridad') || '');
  const [fEstado, setFEstado] = useState('');
  // Objetivo / precliente / cliente: es el filtro que más se va a usar, porque
  // responde a «¿cuántos clientes tengo de verdad?» y a «¿a quién puede ir a ver David?».
  const [fClasif, setFClasif] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [fResp, setFResp] = useState('');
  const [fEspecial, setFEspecial] = useState('');
  const [fVia, setFVia] = useState('');
  const [fZona, setFZona] = useState('');
  const [fDesde, setFDesde] = useState('');
  const [fHasta, setFHasta] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  // Eliminar siempre con motivo: va a la papelera y queda en Control General
  const [borrando, setBorrando] = useState<LuzCliente | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [errorForm, setErrorForm] = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Agregados por cliente desde sus CUPS
  const porCliente = useMemo(() => {
    const m = new Map<string, { n: number; consumo: number; comercializadora: string }>();
    for (const c of cups.datos) {
      const prev = m.get(c.cliente_id) || { n: 0, consumo: 0, comercializadora: '' };
      m.set(c.cliente_id, {
        n: prev.n + 1,
        consumo: prev.consumo + (Number(c.consumo_anual_kwh) || 0),
        comercializadora: prev.comercializadora || c.comercializadora_actual || '',
      });
    }
    return m;
  }, [cups.datos]);

  // Los CUPS enteros de cada cliente, para el semáforo de "qué falta"
  const cupsPorCliente = useMemo(() => {
    const m = new Map<string, LuzCups[]>();
    for (const c of cups.datos) {
      const lista = m.get(c.cliente_id);
      if (lista) lista.push(c); else m.set(c.cliente_id, [c]);
    }
    return m;
  }, [cups.datos]);

  const responsables = useMemo(() => Array.from(new Set(clientes.datos.map((c) => c.responsable).filter(Boolean))) as string[], [clientes.datos]);

  const filtrados = useMemo(() => clientes.datos.filter((c) => {
    if (fPrioridad && c.prioridad !== fPrioridad) return false;
    if (fEstado && c.estado_comercial !== fEstado) return false;
    if (fClasif && ((c as { clasificacion?: string }).clasificacion || 'precliente') !== fClasif) return false;
    if (fTipo && c.tipo_cliente !== fTipo) return false;
    if (fResp && c.responsable !== fResp) return false;
    if (fEspecial === 'sin_accion' && c.proxima_accion) return false;
    if (fEspecial === 'a_sin_seguimiento' && !(c.prioridad === 'A' && !c.proxima_accion)) return false;
    // La cola de trabajo de Nicola: a quién hay que completarle datos antes de poder ofertar
    if (fEspecial === 'incompletos' && !evaluarCliente(c, cupsPorCliente.get(c.id) || []).bloqueado) return false;
    if (fVia && (c.via_entrada || 'captacion') !== fVia) return false;
    if (fZona) {
      const z = zonaDeParada(c.direccion_fiscal, null, c.zona);
      if (fZona === 'sin' ? z != null : z?.id !== fZona) return false;
    }
    const alta = (c.creado_en || '').slice(0, 10);
    if (fDesde && alta < fDesde) return false;
    if (fHasta && alta > fHasta) return false;
    return true;
  }), [clientes.datos, fPrioridad, fEstado, fClasif, fTipo, fResp, fEspecial, fVia, fZona, fDesde, fHasta, cupsPorCliente]);

  /** Enviar a la papelera con motivo: arrastra CUPS, tareas y demás, y se puede devolver. */
  async function eliminarConMotivo(motivo: string) {
    if (!borrando) return;
    const err = await guardarLuz('clientes', 'DELETE', { id: borrando.id, motivo });
    setBorrando(null);
    if (err) { setErrorForm(`No se pudo eliminar: ${err}`); return; }
    setErrorForm('');
    clientes.recargar();
    cups.recargar();
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) { setErrorForm('El nombre es obligatorio.'); return; }
    setErrorForm('');
    const err = await guardarLuz('clientes', 'POST', form);
    if (err) { setErrorForm(err); return; }
    setForm(FORM_VACIO); setMostrarForm(false);
    clientes.recargar();
  }

  const selCls = 'rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 text-xs font-semibold';
  const urlExport = `/api/luz/exportar?tipo=clientes${fPrioridad ? `&prioridad=${fPrioridad}` : ''}${fEstado ? `&estado_comercial=${fEstado}` : ''}${fResp ? `&responsable=${encodeURIComponent(fResp)}` : ''}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Clientes Energía</h2>
          <p className="text-xs text-muted mt-0.5">{filtrados.length} cliente(s) · el centro es el cliente, debajo sus CUPS</p>
        </div>
        <div className="flex gap-2">
          <Link href="/gestor/luz/clientes/duplicados" className={btnSecundario} title="Detectar clientes repetidos y fusionarlos">
            🧬 Duplicados
          </Link>
          <a href={urlExport} className={btnSecundario} download><Download className="w-4 h-4" /> Exportar</a>
          <button onClick={() => setMostrarForm((v) => !v)} className={btnSecundario} title="Solo crea el cliente, sin pasos guiados">
            {mostrarForm ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {mostrarForm ? 'Cancelar' : 'Alta rápida'}
          </button>
          <Link href="/gestor/luz/alta" className={btnPrimario}>
            <UserPlus className="w-4 h-4" /> Nuevo cliente (guiado)
          </Link>
        </div>
      </div>

      {mostrarForm && (
        <Card>
          <form onSubmit={crear} className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2"><label className={labelCls}>Nombre / Razón social *</label><input className={inputCls} value={form.nombre} onChange={set('nombre')} /></div>
              <div><label className={labelCls}>CIF/NIF</label><input className={inputCls} value={form.nif} onChange={set('nif')} /></div>
              <div>
                <label className={labelCls}>Tipo de cliente</label>
                <select className={inputCls} value={form.tipo_cliente} onChange={set('tipo_cliente')}>
                  {TIPOS_CLIENTE.map((t) => <option key={t} value={t}>{TIPO_CLIENTE_LABEL[t]}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Persona de contacto</label><input className={inputCls} value={form.persona_contacto} onChange={set('persona_contacto')} /></div>
              <div><label className={labelCls}>Teléfono</label><input className={inputCls} value={form.telefono} onChange={set('telefono')} /></div>
              <div><label className={labelCls}>Email</label><input className={inputCls} type="email" value={form.email} onChange={set('email')} /></div>
              <div>
                <label className={labelCls}>Prioridad</label>
                <select className={inputCls} value={form.prioridad} onChange={set('prioridad')}>
                  {PRIORIDADES.map((p) => <option key={p} value={p}>{PRIORIDAD_LABEL[p]}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Estado</label>
                <select className={inputCls} value={form.estado_comercial} onChange={set('estado_comercial')}>
                  {ESTADOS_CLIENTE.map((es) => <option key={es} value={es}>{ESTADO_CLIENTE_LABEL[es]}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Vía de entrada</label>
                <select className={inputCls} value={form.via_entrada} onChange={set('via_entrada')}>
                  <option value="captacion">🧲 Captación en ruta · seguimiento</option>
                  <option value="facturas">📄 Con facturas · estudio pendiente</option>
                </select>
              </div>
              <div><label className={labelCls}>Origen</label><input className={inputCls} value={form.origen_cliente} onChange={set('origen_cliente')} placeholder="Web, oficina, derivación..." /></div>
              <div className="md:col-span-3"><label className={labelCls}>Potencial comercial</label><input className={inputCls} value={form.potencial_comercial} onChange={set('potencial_comercial')} /></div>
            </div>
            {errorForm && <p className="text-xs text-red-400">{errorForm}</p>}
            <button type="submit" className={btnPrimario}>Crear cliente</button>
          </form>
        </Card>
      )}

      <Card className="!p-3 space-y-2.5">
        <div className="flex gap-2 flex-wrap">
          <input className={`${inputCls} flex-1 min-w-48`} value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="🔍 Buscar cliente..." />
          <select className={selCls} value={fClasif} onChange={(e) => setFClasif(e.target.value)} title="Objetivo, precliente o cliente">
            <option value="">Objetivo · Precliente · Cliente</option>
            {CLASIFICACIONES.map((c) => <option key={c.clave} value={c.clave}>{c.emoji} Solo {c.titulo.toLowerCase()}s</option>)}
          </select>
          <select className={selCls} value={fPrioridad} onChange={(e) => setFPrioridad(e.target.value)}>
            <option value="">Prioridad: todas</option>
            {PRIORIDADES.map((p) => <option key={p} value={p}>Prioridad {p}</option>)}
          </select>
          <select className={selCls} value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
            <option value="">Estado: todos</option>
            {ESTADOS_CLIENTE.map((es) => <option key={es} value={es}>{ESTADO_CLIENTE_LABEL[es]}</option>)}
          </select>
          <select className={selCls} value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
            <option value="">Tipo: todos</option>
            {TIPOS_CLIENTE.map((t) => <option key={t} value={t}>{TIPO_CLIENTE_LABEL[t]}</option>)}
          </select>
          <select className={selCls} value={fZona} onChange={(e) => setFZona(e.target.value)}>
            <option value="">Zona: todas</option>
            {ZONAS.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
            <option value="sin">Sin zona</option>
          </select>
          <select className={selCls} value={fResp} onChange={(e) => setFResp(e.target.value)}>
            <option value="">Responsable: todos</option>
            {responsables.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <span className="flex items-center gap-1.5 text-xs text-muted font-semibold">
            Alta:
            <input type="date" className={selCls} value={fDesde} onChange={(e) => setFDesde(e.target.value)} title="Entrados desde" />
            —
            <input type="date" className={selCls} value={fHasta} onChange={(e) => setFHasta(e.target.value)} title="Entrados hasta" />
            {(fDesde || fHasta) && <button onClick={() => { setFDesde(''); setFHasta(''); }} className="text-accent font-bold hover:underline">✕</button>}
          </span>
        </div>
        <div className="flex gap-1.5 flex-wrap text-xs items-center">
          {[['', 'Todos'], ['sin_accion', '⚠️ Sin próxima acción'], ['a_sin_seguimiento', '🔴 Clientes A sin seguimiento'], ['incompletos', '📋 Les faltan datos']].map(([v, n]) => (
            <button key={v} onClick={() => setFEspecial(v)} className={`px-2.5 py-1.5 rounded-lg font-semibold ${fEspecial === v ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}>{n}</button>
          ))}
          <span className="w-px h-5 bg-border/50 mx-1" />
          {[['', 'Vía: todas'], ['facturas', '📄 Con facturas (estudio)'], ['captacion', '🧲 Captación (seguimiento)']].map(([v, n]) => (
            <button key={`via-${v}`} onClick={() => setFVia(v)} className={`px-2.5 py-1.5 rounded-lg font-semibold ${fVia === v ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}>{n}</button>
          ))}
        </div>
      </Card>

      <EstadoCarga cargando={clientes.cargando} error={clientes.error} faltaMigracion={clientes.faltaMigracion}
        vacio={!clientes.cargando && !clientes.error && filtrados.length === 0}
        textoVacio="Sin clientes con este filtro. Crea uno o usa la Importación." sqlFile="supabase_luz.sql" />

      {filtrados.length > 0 && (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
                <th className="px-3 py-3">Pr.</th>
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3">Qué es</th>
                <th className="px-3 py-3">Qué falta</th>
                <th className="px-3 py-3">Tipo</th>
                <th className="px-3 py-3 text-center">CUPS</th>
                <th className="px-3 py-3 text-right">Consumo anual</th>
                <th className="px-3 py-3">Comercializadora</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Zona</th>
                <th className="px-3 py-3">Responsable</th>
                <th className="px-3 py-3">Próxima acción</th>
                <th className="px-3 py-3">Alta</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const agg = porCliente.get(c.id);
                return (
                  <tr key={c.id} className="border-b border-border/20 hover:bg-card/50 transition">
                    <td className="px-3 py-2"><BadgePrioridad prioridad={c.prioridad} /></td>
                    <td className="px-3 py-2">
                      <Link href={`/gestor/luz/clientes/${c.id}`} className="font-semibold hover:text-accent transition">{c.nombre}</Link>
                      <span className="block text-[10px] text-muted">{VIA_ENTRADA_CORTA[c.via_entrada || 'captacion']}</span>
                      {c.nif && <span className="block text-[10px] font-mono text-muted">{c.nif}</span>}
                    </td>
                    <td className="px-3 py-2">
                      {(() => {
                        const bruto = (c as { clasificacion?: string }).clasificacion;
                        // Sin el SQL ejecutado todavía no hay columna: se enseña
                        // como precliente, que es lo prudente, y no se rompe nada.
                        const d = defDe(ES_CLASIFICACION(bruto) ? bruto : 'precliente');
                        return (
                          <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${d.tono}`}>
                            {d.emoji} {d.titulo}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2"><SemaforoCliente cliente={c} cups={cupsPorCliente.get(c.id) || []} /></td>
                    <td className="px-3 py-2"><Badge>{TIPO_CLIENTE_LABEL[c.tipo_cliente] || c.tipo_cliente}</Badge></td>
                    <td className="px-3 py-2 text-center font-bold tabular-nums">{agg?.n || 0}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtKwh(agg?.consumo)}</td>
                    <td className="px-3 py-2 text-xs text-muted">{agg?.comercializadora || '—'}</td>
                    <td className="px-3 py-2">
                      <select
                        value={c.estado_comercial}
                        onChange={async (e) => { await guardarLuz('clientes', 'PUT', { id: c.id, estado_comercial: e.target.value }); clientes.recargar(); }}
                        className="rounded-md border border-border/40 bg-background/60 px-1.5 py-0.5 text-[11px] font-semibold max-w-32"
                      >
                        {ESTADOS_CLIENTE.map((es) => <option key={es} value={es}>{ESTADO_CLIENTE_LABEL[es]}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      {(() => {
                        const z = zonaDeParada(c.direccion_fiscal, null, c.zona);
                        return (
                          <select
                            value={c.zona || ''}
                            onChange={async (e) => { await guardarLuz('clientes', 'PUT', { id: c.id, zona: e.target.value || null }); clientes.recargar(); }}
                            className="rounded-md border bg-background/60 px-1.5 py-0.5 text-[11px] font-semibold max-w-32"
                            style={z ? { borderColor: `${z.color}66`, color: z.color } : undefined}
                            title={c.zona ? 'Zona fijada a mano' : z ? `Detectada automáticamente: ${z.nombre}` : 'Sin zona'}
                          >
                            <option value="">{z ? `🤖 ${z.nombre}` : '— Sin zona —'}</option>
                            {ZONAS.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                          </select>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2">
                      <SelectorResponsable valor={c.responsable} onCambio={async (v) => { await guardarLuz('clientes', 'PUT', { id: c.id, responsable: v }); clientes.recargar(); }} />
                    </td>
                    <td className="px-3 py-2 text-xs max-w-40 truncate">
                      {c.proxima_accion || <span className="text-amber-400">—</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="text-xs font-semibold tabular-nums">{fmtFecha(c.creado_en)}</span>
                      {c.actualizado_en && c.actualizado_en.slice(0, 10) !== (c.creado_en || '').slice(0, 10) && (
                        <span className="block text-[10px] text-muted">mod. {fmtFecha(c.actualizado_en)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 w-8">
                      <button
                        onClick={() => setBorrando(c)}
                        className="text-muted hover:text-red-400 transition"
                        title="Enviar a la papelera (se puede recuperar)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {borrando && (
        <PedirMotivo
          titulo={`¿Por qué se elimina a ${borrando.nombre}?`}
          subtitulo={
            `Se va a la papelera con todo lo suyo (CUPS, oportunidades, contratos, comisiones, tareas y fechas). ` +
            `Se puede recuperar entero desde la Papelera, y el motivo queda en el Control General.`
          }
          sugerencias={MOTIVOS_ELIMINACION}
          onGuardar={eliminarConMotivo}
          onCancelar={() => setBorrando(null)}
        />
      )}
    </div>
  );
}

export default function ClientesLuz() {
  return (
    <Suspense fallback={<div className="text-muted text-sm py-8 text-center">Cargando...</div>}>
      <ClientesLuzContenido />
    </Suspense>
  );
}
