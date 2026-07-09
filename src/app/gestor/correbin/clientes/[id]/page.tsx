'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, Plus, Pencil, X } from 'lucide-react';
import {
  VctCliente, VctPoliza, VctTarea, VctMovimiento,
  RAMOS, RAMO_LABEL, ESTADOS_POLIZA, ESTADO_POLIZA_LABEL, TIPO_MOVIMIENTO_LABEL,
  fmtEur, fmtFecha,
} from '@/lib/correbin';
import {
  Card, Badge, BadgeVencimiento, EstadoCarga, useLista, guardar,
  inputCls, labelCls, btnPrimario, btnSecundario,
} from '../../ui';

const POLIZA_VACIA = {
  numero_poliza: '', ramo: 'hogar', compania: '', prima_anual: '',
  fecha_efecto: '', fecha_vencimiento: '', forma_pago: 'anual', responsable: '', notas: '',
};

export default function FichaCliente() {
  const params = useParams<{ id: string }>();
  const clienteId = params.id;

  const clientes = useLista<VctCliente>('clientes');
  const cliente = clientes.datos.find((c) => c.id === clienteId) || null;

  const polizas = useLista<VctPoliza>('polizas', { cliente_id: clienteId });
  const tareas = useLista<VctTarea>('tareas', { cliente_id: clienteId });
  const movimientos = useLista<VctMovimiento>('movimientos', { cliente_id: clienteId });

  // Edición de datos del cliente
  const [editando, setEditando] = useState(false);
  const [formCliente, setFormCliente] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');

  // Alta de póliza
  const [formPoliza, setFormPoliza] = useState<typeof POLIZA_VACIA | null>(null);
  // Nueva tarea
  const [formTarea, setFormTarea] = useState<{ titulo: string; fecha_limite: string; prioridad: string } | null>(null);

  function empezarEdicion() {
    if (!cliente) return;
    setFormCliente({
      nombre: cliente.nombre || '', nif: cliente.nif || '', telefono: cliente.telefono || '',
      email: cliente.email || '', poblacion: cliente.poblacion || '', tipo: cliente.tipo,
      origen: cliente.origen || '', responsable: cliente.responsable || '', notas: cliente.notas || '',
    });
    setEditando(true);
  }

  async function guardarCliente(e: React.FormEvent) {
    e.preventDefault();
    const err = await guardar('clientes', 'PUT', { id: clienteId, ...formCliente });
    if (err) { setMsg(err); return; }
    setEditando(false);
    setMsg('');
    clientes.recargar();
  }

  async function crearPoliza(e: React.FormEvent) {
    e.preventDefault();
    if (!formPoliza) return;
    if (!formPoliza.compania.trim() || !formPoliza.fecha_vencimiento) {
      setMsg('Compañía y fecha de vencimiento son obligatorias.');
      return;
    }
    const err = await guardar('polizas', 'POST', {
      ...formPoliza,
      cliente_id: clienteId,
      prima_anual: parseFloat(formPoliza.prima_anual) || 0,
      fecha_efecto: formPoliza.fecha_efecto || null,
    });
    if (err) { setMsg(err); return; }
    setFormPoliza(null);
    setMsg('');
    polizas.recargar();
  }

  async function cambiarEstadoPoliza(p: VctPoliza, estado: string) {
    const err = await guardar('polizas', 'PUT', { id: p.id, estado });
    if (!err) polizas.recargar();
  }

  async function crearTarea(e: React.FormEvent) {
    e.preventDefault();
    if (!formTarea?.titulo.trim()) return;
    const err = await guardar('tareas', 'POST', { ...formTarea, cliente_id: clienteId, fecha_limite: formTarea.fecha_limite || null });
    if (err) { setMsg(err); return; }
    setFormTarea(null);
    tareas.recargar();
  }

  async function completarTarea(t: VctTarea) {
    const err = await guardar('tareas', 'PUT', { id: t.id, estado: 'hecha', hecho_en: new Date().toISOString() });
    if (!err) tareas.recargar();
  }

  const setC = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFormCliente((f) => ({ ...f, [k]: e.target.value }));
  const setP = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFormPoliza((f) => (f ? { ...f, [k]: e.target.value } : f));

  if (clientes.cargando) {
    return <EstadoCarga cargando error="" vacio={false} textoVacio="" />;
  }
  if (clientes.faltaMigracion || clientes.error) {
    return <EstadoCarga cargando={false} error={clientes.error} faltaMigracion={clientes.faltaMigracion} vacio={false} textoVacio="" />;
  }
  if (!cliente) {
    return (
      <div className="space-y-4">
        <Link href="/gestor/correbin/clientes" className={btnSecundario}>
          <ChevronLeft className="w-4 h-4" /> Volver a clientes
        </Link>
        <Card><p className="text-sm text-muted text-center py-6">Cliente no encontrado.</p></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/gestor/correbin/clientes" className={btnSecundario}>
          <ChevronLeft className="w-4 h-4" /> Clientes
        </Link>
        <Badge tono={cliente.tipo === 'empresa' ? 'accent' : cliente.tipo === 'agrario' ? 'verde' : 'muted'}>{cliente.tipo}</Badge>
      </div>

      {msg && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">{msg}</p>}

      {/* Datos del cliente */}
      <Card>
        {!editando ? (
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-foreground">{cliente.nombre}</h2>
              <div className="mt-2 grid md:grid-cols-2 gap-x-8 gap-y-1 text-sm text-muted">
                <p>NIF: <b className="text-foreground">{cliente.nif || '—'}</b></p>
                <p>Teléfono: <b className="text-foreground">{cliente.telefono || '—'}</b></p>
                <p>Email: <b className="text-foreground">{cliente.email || '—'}</b></p>
                <p>Población: <b className="text-foreground">{cliente.poblacion || '—'}</b></p>
                <p>Origen: <b className="text-foreground">{cliente.origen || '—'}</b></p>
                <p>Responsable: <b className="text-foreground">{cliente.responsable || '—'}</b></p>
              </div>
              {cliente.notas && <p className="mt-2 text-sm text-muted italic">{cliente.notas}</p>}
            </div>
            <button onClick={empezarEdicion} className={btnSecundario}>
              <Pencil className="w-4 h-4" /> Editar
            </button>
          </div>
        ) : (
          <form onSubmit={guardarCliente} className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              {([
                ['nombre', 'Nombre *'], ['nif', 'NIF'], ['telefono', 'Teléfono'],
                ['email', 'Email'], ['poblacion', 'Población'], ['origen', 'Origen'], ['responsable', 'Responsable'],
              ] as const).map(([k, label]) => (
                <div key={k}>
                  <label className={labelCls}>{label}</label>
                  <input className={inputCls} value={formCliente[k] || ''} onChange={setC(k)} />
                </div>
              ))}
              <div>
                <label className={labelCls}>Tipo</label>
                <select className={inputCls} value={formCliente.tipo} onChange={setC('tipo')}>
                  <option value="particular">Particular</option>
                  <option value="empresa">Empresa</option>
                  <option value="agrario">Agrario / Ganadero</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Notas</label>
              <textarea className={`${inputCls} resize-none`} rows={2} value={formCliente.notas || ''} onChange={setC('notas')} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className={btnPrimario}>Guardar</button>
              <button type="button" onClick={() => setEditando(false)} className={btnSecundario}>Cancelar</button>
            </div>
          </form>
        )}
      </Card>

      {/* Pólizas */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-foreground">Pólizas ({polizas.datos.length})</h3>
          <button onClick={() => setFormPoliza(formPoliza ? null : { ...POLIZA_VACIA })} className={btnPrimario}>
            {formPoliza ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {formPoliza ? 'Cancelar' : 'Nueva póliza'}
          </button>
        </div>

        {formPoliza && (
          <form onSubmit={crearPoliza} className="mb-4 p-4 rounded-xl bg-background/40 border border-border/30 space-y-3">
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Ramo *</label>
                <select className={inputCls} value={formPoliza.ramo} onChange={setP('ramo')}>
                  {RAMOS.map((r) => <option key={r} value={r}>{RAMO_LABEL[r]}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Compañía *</label>
                <input className={inputCls} value={formPoliza.compania} onChange={setP('compania')} placeholder="Mapfre, Allianz..." />
              </div>
              <div>
                <label className={labelCls}>Nº póliza</label>
                <input className={inputCls} value={formPoliza.numero_poliza} onChange={setP('numero_poliza')} />
              </div>
              <div>
                <label className={labelCls}>Prima anual (€)</label>
                <input className={inputCls} type="number" step="0.01" value={formPoliza.prima_anual} onChange={setP('prima_anual')} />
              </div>
              <div>
                <label className={labelCls}>Fecha efecto</label>
                <input className={inputCls} type="date" value={formPoliza.fecha_efecto} onChange={setP('fecha_efecto')} />
              </div>
              <div>
                <label className={labelCls}>Vencimiento *</label>
                <input className={inputCls} type="date" value={formPoliza.fecha_vencimiento} onChange={setP('fecha_vencimiento')} />
              </div>
              <div>
                <label className={labelCls}>Forma de pago</label>
                <select className={inputCls} value={formPoliza.forma_pago} onChange={setP('forma_pago')}>
                  <option value="anual">Anual</option>
                  <option value="semestral">Semestral</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="mensual">Mensual</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Responsable</label>
                <input className={inputCls} value={formPoliza.responsable} onChange={setP('responsable')} />
              </div>
            </div>
            <button type="submit" className={btnPrimario}>Guardar póliza</button>
          </form>
        )}

        {polizas.datos.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">Sin pólizas registradas.</p>
        ) : (
          <div className="space-y-2">
            {polizas.datos.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-card/60 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {RAMO_LABEL[p.ramo]} · {p.compania}
                    {p.numero_poliza && <span className="text-muted font-mono text-xs ml-2">{p.numero_poliza}</span>}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {fmtEur(Number(p.prima_anual))} · vence {fmtFecha(p.fecha_vencimiento)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {p.estado === 'viva' && <BadgeVencimiento fecha={p.fecha_vencimiento} />}
                  <select
                    value={p.estado}
                    onChange={(e) => cambiarEstadoPoliza(p, e.target.value)}
                    className="rounded-lg border border-border/40 bg-background/60 px-2 py-1 text-xs font-semibold"
                  >
                    {ESTADOS_POLIZA.map((es) => <option key={es} value={es}>{ESTADO_POLIZA_LABEL[es]}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Tareas del cliente */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-foreground">Tareas</h3>
          <button
            onClick={() => setFormTarea(formTarea ? null : { titulo: '', fecha_limite: '', prioridad: 'media' })}
            className={btnSecundario}
          >
            {formTarea ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {formTarea ? 'Cancelar' : 'Nueva tarea'}
          </button>
        </div>

        {formTarea && (
          <form onSubmit={crearTarea} className="mb-4 flex gap-2 flex-wrap items-end">
            <div className="flex-1 min-w-48">
              <label className={labelCls}>Tarea</label>
              <input className={inputCls} value={formTarea.titulo} onChange={(e) => setFormTarea({ ...formTarea, titulo: e.target.value })} placeholder="Llamar antes del vencimiento..." />
            </div>
            <div>
              <label className={labelCls}>Fecha límite</label>
              <input className={inputCls} type="date" value={formTarea.fecha_limite} onChange={(e) => setFormTarea({ ...formTarea, fecha_limite: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Prioridad</label>
              <select className={inputCls} value={formTarea.prioridad} onChange={(e) => setFormTarea({ ...formTarea, prioridad: e.target.value })}>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
            <button type="submit" className={btnPrimario}>Crear</button>
          </form>
        )}

        {tareas.datos.length === 0 ? (
          <p className="text-sm text-muted text-center py-3">Sin tareas.</p>
        ) : (
          <div className="space-y-1.5">
            {tareas.datos.map((t) => (
              <div key={t.id} className={`flex items-center justify-between gap-3 p-2.5 rounded-lg bg-card/60 ${t.estado === 'hecha' ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={t.estado === 'hecha'}
                    onChange={() => t.estado === 'pendiente' && completarTarea(t)}
                    className="accent-[#22c55e] w-4 h-4 shrink-0"
                  />
                  <p className={`text-sm font-semibold truncate ${t.estado === 'hecha' ? 'line-through' : ''}`}>{t.titulo}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {t.prioridad === 'alta' && t.estado === 'pendiente' && <Badge tono="rojo">alta</Badge>}
                  {t.fecha_limite && t.estado === 'pendiente' && <BadgeVencimiento fecha={t.fecha_limite} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Historial de movimientos */}
      <Card>
        <h3 className="font-bold text-foreground mb-3">Historial de movimientos</h3>
        {movimientos.datos.length === 0 ? (
          <p className="text-sm text-muted text-center py-3">Sin movimientos registrados.</p>
        ) : (
          <div className="space-y-1.5">
            {movimientos.datos.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-card/60 text-sm">
                <div className="min-w-0">
                  <Badge tono={m.tipo === 'produccion' ? 'verde' : m.tipo === 'anulacion' ? 'rojo' : 'ambar'}>
                    {TIPO_MOVIMIENTO_LABEL[m.tipo]}
                  </Badge>
                  {m.motivo && <span className="ml-2 text-muted text-xs">{m.motivo}</span>}
                </div>
                <span className="text-xs text-muted shrink-0">{fmtFecha(m.fecha)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
