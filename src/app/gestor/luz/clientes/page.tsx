'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { UserPlus, X, Download, Trash2, Columns3, Bookmark, Check } from 'lucide-react';
import {
  LuzCliente, LuzCups, TIPOS_CLIENTE, TIPO_CLIENTE_LABEL, PRIORIDADES, PRIORIDAD_LABEL,
  ESTADOS_CLIENTE, ESTADO_CLIENTE_LABEL, VIA_ENTRADA_CORTA, fmtKwh, fmtFecha,
} from '@/lib/luz';
import { ZONAS, zonaDeParada } from '@/lib/zonas';
import { evaluarCliente, tonoCompletitud } from '@/lib/completitud';
import {
  Card, BadgePrioridad, Badge, EstadoCarga, useListaLuz, guardarLuz,
  inputCls, labelCls, btnPrimario, btnSecundario, SelectorResponsable,
} from '../ui';
import { CLASIFICACIONES, defDe, ES_CLASIFICACION } from '@/lib/clasificacion';
import { PedirMotivo } from '../motivo';
import { MOTIVOS_ELIMINACION } from '@/lib/luz';
import { etapaDeCliente, ultimoMovimiento, diasEntre, ETAPA, type Etapa } from '@/lib/seguimiento';
import { tokenSesion, useUsuario } from '@/lib/usuario';
import {
  COLUMNAS_CLIENTE, COLUMNAS_POR_DEFECTO, normalizarColumnas,
  FILTROS_VACIOS, contarFiltros, estadoSeguimientoDe, ESTADOS_SEGUIMIENTO,
  vistasVisibles, esLaVistaActiva, guardarVista, borrarVista, validarVistas,
  SIN_RESPONSABLE, type FiltrosCliente, type Vista,
} from '@/lib/vistas-listado';

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

/** Dónde se recuerda la última configuración de pantalla de cada persona. */
const CLAVE_LOCAL = 'luz_clientes_vista';

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Estado de seguimiento de un cliente, ya calculado. */
interface Seguimiento { etapa: Etapa; diasParado: number | null; estado: string }

function ClientesLuzContenido() {
  const sp = useSearchParams();
  const { perfil, esAdmin } = useUsuario();
  const yo = perfil?.responsable || perfil?.nombre || '';

  const [buscar, setBuscar] = useState('');
  const clientes = useListaLuz<LuzCliente>('clientes', buscar ? { buscar } : {});
  const cups = useListaLuz<LuzCups>('cups');

  /**
   * TODOS LOS FILTROS EN UN SOLO OBJETO, y no en once `useState` sueltos.
   * No es cosmética: una vista guardada es exactamente esto —este objeto más
   * la lista de columnas—, y con once estados sueltos guardar o aplicar una
   * vista serían once líneas que se olvidan de actualizar en cuanto se añade
   * un filtro nuevo.
   */
  const [filtros, setFiltros] = useState<FiltrosCliente>({
    ...FILTROS_VACIOS, prioridad: sp.get('prioridad') || '',
  });
  const [columnas, setColumnas] = useState<string[]>(COLUMNAS_POR_DEFECTO);
  const [verColumnas, setVerColumnas] = useState(false);
  const [verVistas, setVerVistas] = useState(false);
  const [guardadas, setGuardadas] = useState<Vista[]>([]);
  const [nombreVista, setNombreVista] = useState('');
  const [compartir, setCompartir] = useState(false);

  const [mostrarForm, setMostrarForm] = useState(false);
  // Eliminar siempre con motivo: va a la papelera y queda en Control General
  const [borrando, setBorrando] = useState<LuzCliente | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [errorForm, setErrorForm] = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setF = (k: keyof FiltrosCliente) => (v: string) => setFiltros((f) => ({ ...f, [k]: v }));

  // ── Vistas guardadas ──────────────────────────────────────────────────────
  // Viven en el servidor (`/api/luz/vistas`) porque la vista que se monta en
  // el ordenador se mira luego en el móvil, y porque las compartidas no
  // existirían si cada navegador tuviera las suyas.
  useEffect(() => {
    (async () => {
      try {
        const token = await tokenSesion();
        const r = await fetch('/api/luz/vistas', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const j = await r.json();
        if (r.ok) setGuardadas(validarVistas(j.vistas));
      } catch { /* sin vistas guardadas se trabaja igual: no es un error que enseñar */ }
    })();
  }, []);

  // La última configuración de pantalla se recuerda en el navegador. Esto sí
  // es de aquí y no del servidor: es «cómo lo dejé», no «cómo trabajo».
  useEffect(() => {
    try {
      const g = JSON.parse(localStorage.getItem(CLAVE_LOCAL) || 'null');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (g?.columnas) setColumnas(normalizarColumnas(g.columnas));
    } catch { /* configuración ilegible: se sigue con la de fábrica */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(CLAVE_LOCAL, JSON.stringify({ columnas })); } catch { /* modo privado */ }
  }, [columnas]);

  const persistirVistas = useCallback(async (lista: Vista[]) => {
    setGuardadas(lista);
    try {
      const token = await tokenSesion();
      await fetch('/api/luz/vistas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ vistas: lista }),
      });
    } catch { /* se queda en pantalla; al recargar volverá lo guardado */ }
  }, []);

  const visibles = useMemo(() => vistasVisibles(guardadas, yo), [guardadas, yo]);

  const aplicarVista = (v: Vista) => {
    setFiltros(v.filtros);
    setColumnas(normalizarColumnas(v.columnas));
    setVerVistas(false);
  };

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

  /**
   * El estado de seguimiento de cada cliente.
   *
   * La etapa se calcula desde sus SUMINISTROS, que es la fuente de verdad del
   * viaje comercial (`estados-luz.ts`): el pipeline y el contrato ya empujan
   * su estado al CUPS, así que mirar el CUPS no es una aproximación, es mirar
   * el sitio donde la verdad vive. Y así esta pantalla no tiene que cargar dos
   * listas más para pintar una columna que casi nadie enciende.
   *
   * Los plazos y el «esto ya es un problema» salen enteros de `seguimiento.ts`.
   * Si el listado tuviera su propia idea de qué está parado, diría una cosa y
   * el panel de Seguimiento otra.
   */
  const seguimientoPorCliente = useMemo(() => {
    const hoy = hoyISO();
    const m = new Map<string, Seguimiento>();
    for (const c of clientes.datos) {
      const suyos = cupsPorCliente.get(c.id) || [];
      const etapa = etapaDeCliente({
        estadoComercial: c.estado_comercial,
        cups: suyos.map((x) => ({ estado_cups: x.estado_cups })),
      });
      const movimiento = ultimoMovimiento([
        c.fecha_ultimo_contacto, c.actualizado_en,
        ...suyos.map((x) => x.actualizado_en),
      ]);
      const diasParado = diasEntre(movimiento, hoy);
      m.set(c.id, { etapa, diasParado, estado: estadoSeguimientoDe(etapa, diasParado) });
    }
    return m;
  }, [clientes.datos, cupsPorCliente]);

  const responsables = useMemo(() => Array.from(new Set(clientes.datos.map((c) => c.responsable).filter(Boolean))) as string[], [clientes.datos]);

  const filtrados = useMemo(() => clientes.datos.filter((c) => {
    const f = filtros;
    if (f.prioridad && c.prioridad !== f.prioridad) return false;
    if (f.estado && c.estado_comercial !== f.estado) return false;
    if (f.clasificacion && ((c as { clasificacion?: string }).clasificacion || 'precliente') !== f.clasificacion) return false;
    if (f.tipo && c.tipo_cliente !== f.tipo) return false;
    if (f.responsable) {
      // «Sin responsable» es una pregunta de verdad y por eso tiene su valor
      // propio: es la lista de lo que no está asignado a nadie.
      if (f.responsable === SIN_RESPONSABLE ? !!c.responsable : c.responsable !== f.responsable) return false;
    }
    if (f.seguimiento && seguimientoPorCliente.get(c.id)?.estado !== f.seguimiento) return false;
    if (f.especial === 'sin_accion' && c.proxima_accion) return false;
    if (f.especial === 'a_sin_seguimiento' && !(c.prioridad === 'A' && !c.proxima_accion)) return false;
    // La cola de trabajo de Nicola: a quién hay que completarle datos antes de poder ofertar
    if (f.especial === 'incompletos' && !evaluarCliente(c, cupsPorCliente.get(c.id) || []).bloqueado) return false;
    if (f.via && (c.via_entrada || 'captacion') !== f.via) return false;
    if (f.zona) {
      const z = zonaDeParada(c.direccion_fiscal, null, c.zona);
      if (f.zona === 'sin' ? z != null : z?.id !== f.zona) return false;
    }
    const alta = (c.creado_en || '').slice(0, 10);
    if (f.desde && alta < f.desde) return false;
    if (f.hasta && alta > f.hasta) return false;
    return true;
  }), [clientes.datos, filtros, cupsPorCliente, seguimientoPorCliente]);

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
  const urlExport = `/api/luz/exportar?tipo=clientes${filtros.prioridad ? `&prioridad=${filtros.prioridad}` : ''}${filtros.estado ? `&estado_comercial=${filtros.estado}` : ''}${filtros.responsable && filtros.responsable !== SIN_RESPONSABLE ? `&responsable=${encodeURIComponent(filtros.responsable)}` : ''}`;

  const puestos = contarFiltros(filtros);
  const ve = (clave: string) => columnas.includes(clave);

  /** La celda de cada columna, para no repetir el `switch` en la cabecera y en el cuerpo. */
  const celda = (clave: string, c: LuzCliente) => {
    const agg = porCliente.get(c.id);
    switch (clave) {
      case 'prioridad':
        return <BadgePrioridad prioridad={c.prioridad} />;
      case 'nombre':
        return (
          <>
            <Link href={`/gestor/luz/clientes/${c.id}`} className="font-semibold hover:text-accent transition">{c.nombre}</Link>
            <span className="block text-[10px] text-muted">{VIA_ENTRADA_CORTA[c.via_entrada || 'captacion']}</span>
            {c.nif && <span className="block text-[10px] font-mono text-muted">{c.nif}</span>}
          </>
        );
      case 'clasificacion': {
        const bruto = (c as { clasificacion?: string }).clasificacion;
        // Sin el SQL ejecutado todavía no hay columna: se enseña como
        // precliente, que es lo prudente, y no se rompe nada.
        const d = defDe(ES_CLASIFICACION(bruto) ? bruto : 'precliente');
        return (
          <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${d.tono}`}>
            {d.emoji} {d.titulo}
          </span>
        );
      }
      case 'completitud':
        return <SemaforoCliente cliente={c} cups={cupsPorCliente.get(c.id) || []} />;
      case 'seguimiento': {
        const s = seguimientoPorCliente.get(c.id);
        if (!s) return <span className="text-muted">—</span>;
        const tono = s.estado === 'parado' ? 'text-red-400'
          : s.estado === 'sin_señales' ? 'text-muted' : 'text-emerald-400';
        return (
          <span className="whitespace-nowrap" title={ETAPA[s.etapa].titulo}>
            <span className={`text-[11px] font-bold ${tono}`}>
              {s.diasParado == null ? 'Sin señales' : `${s.diasParado} d parado`}
            </span>
            <span className="block text-[10px] text-muted">{ETAPA[s.etapa].titulo}</span>
          </span>
        );
      }
      case 'tipo':
        return <Badge>{TIPO_CLIENTE_LABEL[c.tipo_cliente] || c.tipo_cliente}</Badge>;
      case 'cups':
        return <span className="font-bold tabular-nums">{agg?.n || 0}</span>;
      case 'consumo':
        return <span className="tabular-nums">{fmtKwh(agg?.consumo)}</span>;
      case 'comercializadora':
        return <span className="text-xs text-muted">{agg?.comercializadora || '—'}</span>;
      case 'estado':
        return (
          <select
            value={c.estado_comercial}
            onChange={async (e) => { await guardarLuz('clientes', 'PUT', { id: c.id, estado_comercial: e.target.value }); clientes.recargar(); }}
            className="rounded-md border border-border/40 bg-background/60 px-1.5 py-0.5 text-[11px] font-semibold max-w-32"
          >
            {ESTADOS_CLIENTE.map((es) => <option key={es} value={es}>{ESTADO_CLIENTE_LABEL[es]}</option>)}
          </select>
        );
      case 'zona': {
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
      }
      case 'responsable':
        return <SelectorResponsable valor={c.responsable} onCambio={async (v) => { await guardarLuz('clientes', 'PUT', { id: c.id, responsable: v }); clientes.recargar(); }} />;
      case 'accion':
        return <span className="text-xs block max-w-40 truncate">{c.proxima_accion || <span className="text-amber-400">—</span>}</span>;
      case 'telefono':
        return c.telefono
          ? <a href={`tel:${c.telefono}`} className="text-xs font-semibold hover:text-accent whitespace-nowrap">{c.telefono}</a>
          : <span className="text-[11px] text-amber-400">Sin teléfono</span>;
      case 'alta':
        return (
          <span className="whitespace-nowrap">
            <span className="text-xs font-semibold tabular-nums">{fmtFecha(c.creado_en)}</span>
            {c.actualizado_en && c.actualizado_en.slice(0, 10) !== (c.creado_en || '').slice(0, 10) && (
              <span className="block text-[10px] text-muted">mod. {fmtFecha(c.actualizado_en)}</span>
            )}
          </span>
        );
      default:
        return null;
    }
  };

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

      {/* ── Barra de vistas ──────────────────────────────────────────────────
          Lo que convierte «filtros y columnas configurables» en algo que se
          usa dos veces: montar la vista cuesta medio minuto, aplicarla un
          clic. Sin esto, el que tiene prisa se queda siempre con la de
          fábrica y todo lo demás sobra. */}
      <Card className="!p-2.5">
        <div className="flex gap-1.5 flex-wrap items-center">
          <Bookmark className="w-3.5 h-3.5 text-accent shrink-0" />
          {visibles.map((v) => {
            const activa = esLaVistaActiva(v, filtros, columnas);
            return (
              <span key={v.id} className="inline-flex items-center">
                <button
                  onClick={() => aplicarVista(v)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activa ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50 hover:text-foreground'
                  }`}
                  title={v.deFabrica ? 'Vista que viene puesta' : v.compartida ? `Compartida por ${v.autor || 'el equipo'}` : 'Solo tuya'}
                >
                  {!v.deFabrica && (v.compartida ? '👥 ' : '🔒 ')}{v.nombre}
                </button>
                {!v.deFabrica && (esAdmin || v.autor === yo) && (
                  <button
                    onClick={() => persistirVistas(borrarVista(guardadas, v.id, yo, esAdmin))}
                    className="text-muted hover:text-red-400 -ml-0.5 px-1"
                    title="Borrar esta vista"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            );
          })}
          <span className="w-px h-5 bg-border/50 mx-1" />
          <button onClick={() => setVerVistas((v) => !v)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-card/80 text-muted border border-border/50 hover:text-foreground">
            {verVistas ? 'Cancelar' : '+ Guardar esta vista'}
          </button>
          <button onClick={() => setVerColumnas((v) => !v)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-card/80 text-muted border border-border/50 hover:text-foreground inline-flex items-center gap-1">
            <Columns3 className="w-3.5 h-3.5" /> Columnas ({columnas.length})
          </button>
          {puestos > 0 && (
            <button onClick={() => setFiltros(FILTROS_VACIOS)} className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-accent hover:underline">
              Quitar {puestos} filtro{puestos === 1 ? '' : 's'}
            </button>
          )}
        </div>

        {verVistas && (
          <div className="mt-2.5 pt-2.5 border-t border-border/40 flex gap-2 flex-wrap items-center">
            <input
              className={`${inputCls} flex-1 min-w-48`}
              value={nombreVista}
              onChange={(e) => setNombreVista(e.target.value)}
              placeholder="Nombre de la vista (p. ej. «Mis parados de Binéfar»)"
            />
            <label className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              <input type="checkbox" checked={compartir} onChange={(e) => setCompartir(e.target.checked)} />
              Compartir con el equipo
            </label>
            <button
              onClick={() => {
                if (!nombreVista.trim()) return;
                const id = `v${Date.now().toString(36)}`;
                persistirVistas(guardarVista(guardadas, {
                  nombre: nombreVista, filtros, columnas, autor: yo, compartida: compartir,
                }, id));
                setNombreVista(''); setVerVistas(false);
              }}
              className={btnPrimario}
            >
              <Check className="w-4 h-4" /> Guardar
            </button>
            <p className="text-[11px] text-muted w-full">
              Guarda los filtros puestos y las columnas elegidas. Si ya tienes una con ese nombre, se
              sustituye — dos vistas iguales con nombres parecidos es lo que hace que esta barra deje de servir.
            </p>
          </div>
        )}

        {verColumnas && (
          <div className="mt-2.5 pt-2.5 border-t border-border/40">
            <div className="flex gap-1.5 flex-wrap">
              {COLUMNAS_CLIENTE.map((col) => {
                const puesta = columnas.includes(col.clave);
                return (
                  <button
                    key={col.clave}
                    disabled={col.fija}
                    onClick={() => setColumnas(normalizarColumnas(
                      puesta ? columnas.filter((x) => x !== col.clave) : [...columnas, col.clave]))}
                    title={col.fija ? 'Esta no se puede quitar' : col.pista}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      puesta ? 'bg-accent/15 text-accent border-accent/40' : 'bg-card/80 text-muted border-border/50'
                    } ${col.fija ? 'opacity-60 cursor-default' : ''}`}
                  >
                    {puesta ? '✓ ' : ''}{col.titulo}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setColumnas([...COLUMNAS_POR_DEFECTO])} className="text-[11px] font-bold text-accent hover:underline">
                Volver a las de siempre
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card className="!p-3 space-y-2.5">
        <div className="flex gap-2 flex-wrap">
          <input className={`${inputCls} flex-1 min-w-48`} value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="🔍 Buscar cliente..." />
          <select className={selCls} value={filtros.clasificacion} onChange={(e) => setF('clasificacion')(e.target.value)} title="Objetivo, precliente o cliente">
            <option value="">Objetivo · Precliente · Cliente</option>
            {CLASIFICACIONES.map((c) => <option key={c.clave} value={c.clave}>{c.emoji} Solo {c.titulo.toLowerCase()}s</option>)}
          </select>
          <select className={selCls} value={filtros.prioridad} onChange={(e) => setF('prioridad')(e.target.value)}>
            <option value="">Prioridad: todas</option>
            {PRIORIDADES.map((p) => <option key={p} value={p}>Prioridad {p}</option>)}
          </select>
          <select className={selCls} value={filtros.estado} onChange={(e) => setF('estado')(e.target.value)}>
            <option value="">Etapa: todas</option>
            {ESTADOS_CLIENTE.map((es) => <option key={es} value={es}>{ESTADO_CLIENTE_LABEL[es]}</option>)}
          </select>
          {/* El estado de seguimiento: la pregunta «¿a quién estoy dejando
              parado?», que antes había que ir a otra pantalla a contestar. */}
          <select className={selCls} value={filtros.seguimiento} onChange={(e) => setF('seguimiento')(e.target.value)} title="Cuánto llevan parados para lo que toca en su etapa">
            <option value="">Seguimiento: todos</option>
            {ESTADOS_SEGUIMIENTO.map((s) => <option key={s.clave} value={s.clave} title={s.pista}>{s.titulo}</option>)}
          </select>
          <select className={selCls} value={filtros.tipo} onChange={(e) => setF('tipo')(e.target.value)}>
            <option value="">Tipo: todos</option>
            {TIPOS_CLIENTE.map((t) => <option key={t} value={t}>{TIPO_CLIENTE_LABEL[t]}</option>)}
          </select>
          <select className={selCls} value={filtros.zona} onChange={(e) => setF('zona')(e.target.value)}>
            <option value="">Zona: todas</option>
            {ZONAS.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
            <option value="sin">Sin zona</option>
          </select>
          <select className={selCls} value={filtros.responsable} onChange={(e) => setF('responsable')(e.target.value)}>
            <option value="">Responsable: todos</option>
            {responsables.map((r) => <option key={r} value={r}>{r}</option>)}
            <option value={SIN_RESPONSABLE}>⚠️ Sin responsable</option>
          </select>
          <span className="flex items-center gap-1.5 text-xs text-muted font-semibold">
            Alta:
            <input type="date" className={selCls} value={filtros.desde} onChange={(e) => setF('desde')(e.target.value)} title="Entrados desde" />
            —
            <input type="date" className={selCls} value={filtros.hasta} onChange={(e) => setF('hasta')(e.target.value)} title="Entrados hasta" />
            {(filtros.desde || filtros.hasta) && <button onClick={() => setFiltros((f) => ({ ...f, desde: '', hasta: '' }))} className="text-accent font-bold hover:underline">✕</button>}
          </span>
        </div>
        <div className="flex gap-1.5 flex-wrap text-xs items-center">
          {[['', 'Todos'], ['sin_accion', '⚠️ Sin próxima acción'], ['a_sin_seguimiento', '🔴 Clientes A sin seguimiento'], ['incompletos', '📋 Les faltan datos']].map(([v, n]) => (
            <button key={v} onClick={() => setF('especial')(v)} className={`px-2.5 py-1.5 rounded-lg font-semibold ${filtros.especial === v ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}>{n}</button>
          ))}
          <span className="w-px h-5 bg-border/50 mx-1" />
          {[['', 'Vía: todas'], ['facturas', '📄 Con facturas (estudio)'], ['captacion', '🧲 Captación (seguimiento)']].map(([v, n]) => (
            <button key={`via-${v}`} onClick={() => setF('via')(v)} className={`px-2.5 py-1.5 rounded-lg font-semibold ${filtros.via === v ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}>{n}</button>
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
                {COLUMNAS_CLIENTE.filter((c) => ve(c.clave)).map((c) => (
                  <th key={c.clave}
                    className={`px-3 py-3 ${c.clave === 'cups' ? 'text-center' : ''}${c.clave === 'consumo' ? 'text-right' : ''}`}>
                    {c.titulo}
                  </th>
                ))}
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id} className="border-b border-border/20 hover:bg-card/50 transition">
                  {COLUMNAS_CLIENTE.filter((x) => ve(x.clave)).map((x) => (
                    <td key={x.clave}
                      className={`px-3 py-2 ${x.clave === 'cups' ? 'text-center' : ''}${x.clave === 'consumo' ? 'text-right' : ''}`}>
                      {celda(x.clave, c)}
                    </td>
                  ))}
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
              ))}
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
