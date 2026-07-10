'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import {
  VctCliente, VctMovimiento, TipoMovimiento, TIPO_MOVIMIENTO_LABEL, fmtEur, fmtFecha,
} from '@/lib/correbin';
import { Card, Kpi, Badge, EstadoCarga, useLista, guardar, inputCls, labelCls, btnPrimario } from './ui';

/**
 * Sección genérica de movimientos (producción, anulaciones/sustituciones/cambios
 * de compañía, cambios de mediador). Distingue cada tipo explícitamente.
 */
export function SeccionMovimientos({
  titulo, descripcion, tipos, tipoPorDefecto, conCompanias, conMediadores,
}: {
  titulo: string;
  descripcion: string;
  tipos: TipoMovimiento[];
  tipoPorDefecto: TipoMovimiento;
  conCompanias?: boolean;
  conMediadores?: boolean;
}) {
  const movimientos = useLista<VctMovimiento>('movimientos');
  const clientes = useLista<VctCliente>('clientes');
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [errorForm, setErrorForm] = useState('');

  const [form, setForm] = useState({
    tipo: tipoPorDefecto as string,
    cliente_id: '',
    fecha: new Date().toISOString().slice(0, 10),
    motivo: '',
    compania_origen: '',
    compania_destino: '',
    mediador_origen: '',
    mediador_destino: '',
    prima: '',
    responsable: '',
    notas: '',
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const lista = useMemo(
    () => movimientos.datos.filter((m) => tipos.includes(m.tipo) && (tipoFiltro === 'todos' || m.tipo === tipoFiltro)),
    [movimientos.datos, tipos, tipoFiltro]
  );

  const inicioMes = new Date();
  inicioMes.setDate(1);
  const delMes = lista.filter((m) => new Date(m.fecha) >= inicioMes);
  const primaMes = delMes.reduce((s, m) => s + (Number(m.prima) || 0), 0);
  const primaTotal = lista.reduce((s, m) => s + (Number(m.prima) || 0), 0);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente_id) { setErrorForm('Selecciona el cliente.'); return; }
    setErrorForm('');
    const err = await guardar('movimientos', 'POST', {
      ...form,
      cliente_id: form.cliente_id || null,
      prima: parseFloat(form.prima) || 0,
    });
    if (err) { setErrorForm(err); return; }
    setMostrarForm(false);
    setForm((f) => ({ ...f, motivo: '', prima: '', notas: '', compania_origen: '', compania_destino: '', mediador_origen: '', mediador_destino: '' }));
    movimientos.recargar();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">{titulo}</h2>
          <p className="text-xs text-muted mt-0.5">{descripcion}</p>
        </div>
        <button onClick={() => setMostrarForm((v) => !v)} className={btnPrimario}>
          {mostrarForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {mostrarForm ? 'Cancelar' : 'Registrar'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi valor={delMes.length} etiqueta="Este mes" />
        <Kpi valor={fmtEur(primaMes)} etiqueta="Prima este mes" color="text-secondary" />
        <Kpi valor={fmtEur(primaTotal)} etiqueta="Prima total registrada" />
      </div>

      {mostrarForm && (
        <Card>
          <form onSubmit={crear} className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              {tipos.length > 1 && (
                <div>
                  <label className={labelCls}>Tipo de movimiento *</label>
                  <select className={inputCls} value={form.tipo} onChange={set('tipo')}>
                    {tipos.map((t) => <option key={t} value={t}>{TIPO_MOVIMIENTO_LABEL[t]}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className={labelCls}>Cliente *</label>
                <select className={inputCls} value={form.cliente_id} onChange={set('cliente_id')}>
                  <option value="">— Selecciona —</option>
                  {clientes.datos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Fecha</label>
                <input className={inputCls} type="date" value={form.fecha} onChange={set('fecha')} />
              </div>
              <div>
                <label className={labelCls}>Prima (€)</label>
                <input className={inputCls} type="number" step="0.01" value={form.prima} onChange={set('prima')} />
              </div>
              {conCompanias && (
                <>
                  <div>
                    <label className={labelCls}>Compañía origen</label>
                    <input className={inputCls} value={form.compania_origen} onChange={set('compania_origen')} />
                  </div>
                  <div>
                    <label className={labelCls}>Compañía destino</label>
                    <input className={inputCls} value={form.compania_destino} onChange={set('compania_destino')} />
                  </div>
                </>
              )}
              {conMediadores && (
                <>
                  <div>
                    <label className={labelCls}>Mediador origen</label>
                    <input className={inputCls} value={form.mediador_origen} onChange={set('mediador_origen')} placeholder="Correbin, otro corredor..." />
                  </div>
                  <div>
                    <label className={labelCls}>Mediador destino</label>
                    <input className={inputCls} value={form.mediador_destino} onChange={set('mediador_destino')} />
                  </div>
                </>
              )}
              <div>
                <label className={labelCls}>Responsable</label>
                <input className={inputCls} value={form.responsable} onChange={set('responsable')} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Motivo real (importante para saber por qué pasa)</label>
              <input className={inputCls} value={form.motivo} onChange={set('motivo')} placeholder="Precio, siniestro mal resuelto, competencia, cierre de negocio..." />
            </div>
            {errorForm && <p className="text-xs text-red-400">{errorForm}</p>}
            <button type="submit" className={btnPrimario}>Guardar movimiento</button>
          </form>
        </Card>
      )}

      {tipos.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setTipoFiltro('todos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${tipoFiltro === 'todos' ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}
          >
            Todos
          </button>
          {tipos.map((t) => (
            <button
              key={t}
              onClick={() => setTipoFiltro(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${tipoFiltro === t ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}
            >
              {TIPO_MOVIMIENTO_LABEL[t]}
            </button>
          ))}
        </div>
      )}

      <EstadoCarga
        cargando={movimientos.cargando}
        error={movimientos.error}
        faltaMigracion={movimientos.faltaMigracion}
        vacio={!movimientos.cargando && !movimientos.error && lista.length === 0}
        textoVacio="Sin movimientos registrados todavía."
      />

      {lista.length > 0 && (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Motivo</th>
                {(conCompanias || conMediadores) && <th className="px-4 py-3">Origen → Destino</th>}
                <th className="px-4 py-3 text-right">Prima</th>
                <th className="px-4 py-3">Responsable</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((m) => (
                <tr key={m.id} className="border-b border-border/20 hover:bg-card/50 transition">
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted">{fmtFecha(m.fecha)}</td>
                  <td className="px-4 py-2.5">
                    <Badge tono={m.tipo === 'produccion' ? 'verde' : m.tipo === 'anulacion' ? 'rojo' : 'ambar'}>
                      {TIPO_MOVIMIENTO_LABEL[m.tipo]}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 font-semibold">
                    {m.cliente_id ? (
                      <Link href={`/gestor/correbin/clientes/${m.cliente_id}`} className="hover:text-accent transition">
                        {m.vct_clientes?.nombre || '—'}
                      </Link>
                    ) : (m.vct_clientes?.nombre || '—')}
                  </td>
                  <td className="px-4 py-2.5 text-muted max-w-56 truncate">{m.motivo || '—'}</td>
                  {(conCompanias || conMediadores) && (
                    <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">
                      {conMediadores
                        ? `${m.mediador_origen || '—'} → ${m.mediador_destino || '—'}`
                        : `${m.compania_origen || '—'} → ${m.compania_destino || '—'}`}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right font-bold tabular-nums">{fmtEur(Number(m.prima))}</td>
                  <td className="px-4 py-2.5 text-muted">{m.responsable || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
