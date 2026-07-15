'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, X, Download } from 'lucide-react';
import {
  VctAnulacion, VctCliente, TIPOS_ANULACION, TIPO_ANULACION_LABEL, ANULACION_RESTA_CARTERA,
  fmtEur0, fmtFecha,
} from '@/lib/correbin';
import { BotonDescarga, Card, Kpi, Badge, EstadoCarga, useLista, guardar, inputCls, labelCls, btnPrimario, btnSecundario } from '../ui';

const FORM_VACIO = {
  cliente_id: '', fecha_anulacion: new Date().toISOString().slice(0, 10),
  prima: '', motivo: '', tipo_anulacion: 'real', observaciones: '',
};

export default function AnulacionesPage() {
  const anio = new Date().getFullYear();
  const { datos, cargando, error, faltaMigracion, recargar } = useLista<VctAnulacion>('anulaciones');
  const clientes = useLista<VctCliente>('clientes');
  const [fTipo, setFTipo] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [errorForm, setErrorForm] = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const filtradas = useMemo(() => datos.filter((a) => !fTipo || a.tipo_anulacion === fTipo), [datos, fTipo]);

  const delAnio = datos.filter((a) => a.fecha_anulacion?.startsWith(String(anio)));
  const reales = delAnio.filter((a) => ANULACION_RESTA_CARTERA.includes(a.tipo_anulacion));
  const tecnicas = delAnio.filter((a) => !ANULACION_RESTA_CARTERA.includes(a.tipo_anulacion));
  const sinMotivo = datos.filter((a) => !a.motivo);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente_id) { setErrorForm('Selecciona el cliente.'); return; }
    setErrorForm('');
    const err = await guardar('anulaciones', 'POST', {
      ...form,
      prima: parseFloat(form.prima) || 0,
      afecta_cartera: ANULACION_RESTA_CARTERA.includes(form.tipo_anulacion),
    });
    if (err) { setErrorForm(err); return; }
    setMostrarForm(false); setForm(FORM_VACIO);
    recargar();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Anulaciones</h2>
          <p className="text-xs text-muted mt-0.5">
            La anulación real resta cartera; la sustitución técnica y el cambio de compañía no son pérdida de cliente.
          </p>
        </div>
        <div className="flex gap-2">
          <BotonDescarga href={`/api/correbin/exportar?tipo=anulaciones${fTipo ? `&tipo_anulacion=${fTipo}` : ''}`} className={btnSecundario}>Exportar</BotonDescarga>
          <button onClick={() => setMostrarForm((v) => !v)} className={btnPrimario}>
            {mostrarForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {mostrarForm ? 'Cancelar' : 'Registrar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi valor={fmtEur0(reales.reduce((s, a) => s + (Number(a.prima) || 0), 0))} etiqueta={`Pérdida REAL ${anio} (${reales.length})`} color="text-red-400" />
        <Kpi valor={`${tecnicas.length}`} etiqueta={`Técnicas / sustituciones ${anio} (no restan)`} color="text-amber-400" />
        <Kpi valor={sinMotivo.length} etiqueta="Sin motivo (alerta)" color={sinMotivo.length ? 'text-red-400' : 'text-emerald-400'} />
      </div>

      {mostrarForm && (
        <Card>
          <form onSubmit={crear} className="space-y-3">
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Cliente *</label>
                <select className={inputCls} value={form.cliente_id} onChange={set('cliente_id')}>
                  <option value="">— Selecciona —</option>
                  {clientes.datos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Tipo *</label>
                <select className={inputCls} value={form.tipo_anulacion} onChange={set('tipo_anulacion')}>
                  {TIPOS_ANULACION.map((t) => <option key={t} value={t}>{TIPO_ANULACION_LABEL[t]}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Fecha</label><input className={inputCls} type="date" value={form.fecha_anulacion} onChange={set('fecha_anulacion')} /></div>
              <div><label className={labelCls}>Prima (€)</label><input className={inputCls} type="number" step="0.01" value={form.prima} onChange={set('prima')} /></div>
            </div>
            <div>
              <label className={labelCls}>Motivo real (obligatorio para saber por qué se pierde)</label>
              <input className={inputCls} value={form.motivo} onChange={set('motivo')} placeholder="Precio, siniestro mal resuelto, banco, cierre de negocio..." />
            </div>
            {errorForm && <p className="text-xs text-red-400">{errorForm}</p>}
            <button type="submit" className={btnPrimario}>Guardar anulación</button>
          </form>
        </Card>
      )}

      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setFTipo('')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${!fTipo ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}>Todas</button>
        {TIPOS_ANULACION.map((t) => (
          <button key={t} onClick={() => setFTipo(t)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${fTipo === t ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50'}`}>
            {TIPO_ANULACION_LABEL[t]}
          </button>
        ))}
      </div>

      <EstadoCarga cargando={cargando} error={error} faltaMigracion={faltaMigracion}
        vacio={!cargando && !error && filtradas.length === 0} textoVacio="Sin anulaciones registradas." />

      {filtradas.length > 0 && (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
                <th className="px-3 py-3">Fecha</th><th className="px-3 py-3">Cliente</th><th className="px-3 py-3">Tipo</th>
                <th className="px-3 py-3">¿Resta cartera?</th><th className="px-3 py-3 text-right">Prima</th><th className="px-3 py-3">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((a) => (
                <tr key={a.id} className="border-b border-border/20 hover:bg-card/50 transition">
                  <td className="px-3 py-2 whitespace-nowrap text-muted">{fmtFecha(a.fecha_anulacion)}</td>
                  <td className="px-3 py-2 font-semibold">
                    {a.cliente_id
                      ? <Link href={`/gestor/correbin/clientes/${a.cliente_id}`} className="hover:text-accent">{a.vct_clientes?.nombre || '—'}</Link>
                      : (a.vct_clientes?.nombre || '—')}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tono={a.afecta_cartera ? 'rojo' : 'ambar'}>{TIPO_ANULACION_LABEL[a.tipo_anulacion]}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs font-bold">{a.afecta_cartera ? <span className="text-red-400">SÍ</span> : <span className="text-muted">No</span>}</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">{fmtEur0(Number(a.prima))}</td>
                  <td className="px-3 py-2 text-xs max-w-64 truncate">
                    {a.motivo || <span className="text-amber-400 font-bold">SIN MOTIVO ⚠️</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
