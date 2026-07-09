'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UserPlus, X } from 'lucide-react';
import { VctCliente } from '@/lib/correbin';
import { Card, Badge, EstadoCarga, useLista, guardar, inputCls, labelCls, btnPrimario, btnSecundario } from '../ui';

const FORM_VACIO = {
  nombre: '', nif: '', telefono: '', email: '', poblacion: '',
  tipo: 'particular', origen: '', responsable: '', notas: '',
};

export default function ClientesVct() {
  const [buscar, setBuscar] = useState('');
  const { datos, cargando, error, faltaMigracion, recargar } = useLista<VctCliente>('clientes', buscar ? { buscar } : {});
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) { setErrorForm('El nombre es obligatorio.'); return; }
    setGuardando(true);
    setErrorForm('');
    const err = await guardar('clientes', 'POST', form);
    setGuardando(false);
    if (err) { setErrorForm(err); return; }
    setForm(FORM_VACIO);
    setMostrarForm(false);
    recargar();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Clientes</h2>
          <p className="text-xs text-muted mt-0.5">{datos.length} cliente(s)</p>
        </div>
        <button onClick={() => setMostrarForm((v) => !v)} className={btnPrimario}>
          {mostrarForm ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          {mostrarForm ? 'Cancelar' : 'Nuevo cliente'}
        </button>
      </div>

      {mostrarForm && (
        <Card>
          <form onSubmit={crear} className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className={labelCls}>Nombre / Razón social *</label>
                <input className={inputCls} value={form.nombre} onChange={set('nombre')} placeholder="Nombre completo o empresa" />
              </div>
              <div>
                <label className={labelCls}>NIF / CIF</label>
                <input className={inputCls} value={form.nif} onChange={set('nif')} placeholder="12345678Z" />
              </div>
              <div>
                <label className={labelCls}>Teléfono</label>
                <input className={inputCls} value={form.telefono} onChange={set('telefono')} placeholder="600 000 000" />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input className={inputCls} type="email" value={form.email} onChange={set('email')} placeholder="cliente@email.com" />
              </div>
              <div>
                <label className={labelCls}>Población</label>
                <input className={inputCls} value={form.poblacion} onChange={set('poblacion')} placeholder="Binéfar" />
              </div>
              <div>
                <label className={labelCls}>Tipo</label>
                <select className={inputCls} value={form.tipo} onChange={set('tipo')}>
                  <option value="particular">Particular</option>
                  <option value="empresa">Empresa</option>
                  <option value="agrario">Agrario / Ganadero</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Origen</label>
                <input className={inputCls} value={form.origen} onChange={set('origen')} placeholder="Recomendado, web, oficina..." />
              </div>
              <div>
                <label className={labelCls}>Responsable</label>
                <input className={inputCls} value={form.responsable} onChange={set('responsable')} placeholder="Quién lo lleva" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Notas</label>
              <textarea className={`${inputCls} resize-none`} rows={2} value={form.notas} onChange={set('notas')} />
            </div>
            {errorForm && <p className="text-xs text-red-400">{errorForm}</p>}
            <button type="submit" disabled={guardando} className={btnPrimario}>
              {guardando ? 'Guardando...' : 'Crear cliente'}
            </button>
          </form>
        </Card>
      )}

      <Card className="!p-4">
        <input
          className={inputCls}
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="🔍 Buscar cliente por nombre..."
        />
      </Card>

      <EstadoCarga
        cargando={cargando}
        error={error}
        faltaMigracion={faltaMigracion}
        vacio={!cargando && !error && datos.length === 0}
        textoVacio="Aún no hay clientes. Crea el primero o usa la Importación Excel."
      />

      {datos.length > 0 && (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Población</th>
                <th className="px-4 py-3">Responsable</th>
              </tr>
            </thead>
            <tbody>
              {datos.map((c) => (
                <tr key={c.id} className="border-b border-border/20 hover:bg-card/50 transition">
                  <td className="px-4 py-2.5">
                    <Link href={`/gestor/correbin/clientes/${c.id}`} className="font-semibold hover:text-accent transition">
                      {c.nombre}
                    </Link>
                    {c.nif && <span className="block text-[10px] text-muted font-mono">{c.nif}</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tono={c.tipo === 'empresa' ? 'accent' : c.tipo === 'agrario' ? 'verde' : 'muted'}>{c.tipo}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{c.telefono || '—'}</td>
                  <td className="px-4 py-2.5 text-muted">{c.poblacion || '—'}</td>
                  <td className="px-4 py-2.5 text-muted">{c.responsable || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
