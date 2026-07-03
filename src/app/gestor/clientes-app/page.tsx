'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TARIFA_INFO, TarifaAcceso } from '@/lib/tarifas';
import {
  UserPlus, FileSpreadsheet, Download, Upload, ChevronLeft, Users,
  CalendarPlus, Trash2, X, Smartphone, CheckCircle2, AlertCircle,
} from 'lucide-react';

interface ClienteApp {
  id: string;
  usuario: string;
  nombre: string;
  telefono: string | null;
  tarifa: TarifaAcceso;
  precios_energia: number[];
  precios_potencia: number[];
  potencias_kw: number[];
  activo: boolean;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const num = (s: string) => {
  const n = parseFloat((s || '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

const inputCls =
  'w-full rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-sm text-foreground placeholder-muted/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30';

const labelCls = 'text-[11px] font-semibold uppercase tracking-wide text-muted mb-1 block';

export default function ClientesAppPage() {
  const router = useRouter();
  const [autorizado, setAutorizado] = useState(false);
  const [clientes, setClientes] = useState<ClienteApp[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mostrarCrear, setMostrarCrear] = useState(false);

  // Form crear cliente
  const [fUsuario, setFUsuario] = useState('');
  const [fPassword, setFPassword] = useState('');
  const [fNombre, setFNombre] = useState('');
  const [fTelefono, setFTelefono] = useState('');
  const [fTarifa, setFTarifa] = useState<TarifaAcceso>('2.0');
  const [fPreciosE, setFPreciosE] = useState<string[]>(Array(6).fill(''));
  const [fPreciosP, setFPreciosP] = useState<string[]>(Array(6).fill(''));
  const [fPotencias, setFPotencias] = useState<string[]>(Array(6).fill(''));

  // Consumos
  const [clienteSel, setClienteSel] = useState<ClienteApp | null>(null);
  const [consumosCliente, setConsumosCliente] = useState<any[]>([]);
  const [cAnio, setCAnio] = useState(String(new Date().getFullYear()));
  const [cMes, setCMes] = useState(String(new Date().getMonth() + 1));
  const [cConsumos, setCConsumos] = useState<string[]>(Array(6).fill(''));
  const [cPrecios, setCPrecios] = useState<string[]>(Array(6).fill(''));
  const [cPreciosP, setCPreciosP] = useState<string[]>(Array(6).fill(''));
  const [mostrarPreciosPotencia, setMostrarPreciosPotencia] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) {
      router.replace('/gestor/login');
      return;
    }
    setAutorizado(true);
    cargarClientes();
  }, [router]);

  async function cargarClientes() {
    const res = await fetch('/api/gestor/clientes-app');
    const json = await res.json();
    if (json.ok) setClientes(json.clientes);
  }

  function aviso(msg: string, esError = false) {
    if (esError) { setError(msg); setMensaje(''); }
    else { setMensaje(msg); setError(''); }
    setTimeout(() => { setMensaje(''); setError(''); }, 6000);
  }

  async function crearCliente(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    const info = TARIFA_INFO[fTarifa];
    try {
      const res = await fetch('/api/gestor/clientes-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: fUsuario,
          password: fPassword,
          nombre: fNombre,
          telefono: fTelefono,
          tarifa: fTarifa,
          precios_energia: fPreciosE.slice(0, info.periodosEnergia.length).map(num),
          precios_potencia: fPreciosP.slice(0, info.periodosPotencia.length).map(num),
          potencias_kw: fPotencias.slice(0, info.periodosPotencia.length).map(num),
        }),
      });
      const json = await res.json();
      if (!res.ok) { aviso(json.error, true); return; }
      aviso(`Cliente "${fUsuario}" creado correctamente. Entrégale su usuario y contraseña.`);
      setFUsuario(''); setFPassword(''); setFNombre(''); setFTelefono('');
      setFPreciosE(Array(6).fill('')); setFPreciosP(Array(6).fill('')); setFPotencias(Array(6).fill(''));
      setMostrarCrear(false);
      cargarClientes();
    } finally {
      setCargando(false);
    }
  }

  const aLista = (v: unknown): number[] =>
    Array.isArray(v) ? v.map((n) => Number(n) || 0) : isNaN(Number(v)) || v == null ? [] : [Number(v)];

  async function abrirCliente(c: ClienteApp) {
    setClienteSel(c);
    setCConsumos(Array(6).fill(''));
    const res = await fetch(`/api/gestor/consumos-app?cliente_id=${c.id}`);
    const json = await res.json();
    const consumos = json.ok ? json.consumos : [];
    setConsumosCliente(consumos);

    // Precarga precios: los del último mes guardado, o los fijos del contrato
    const ultimo = consumos[0];
    const preciosBase = ultimo?.precios_energia?.length
      ? aLista(ultimo.precios_energia)
      : aLista(c.precios_energia);
    const preciosPBase = ultimo?.precios_potencia?.length
      ? aLista(ultimo.precios_potencia)
      : aLista(c.precios_potencia);
    const relleno = (arr: number[]) =>
      Array.from({ length: 6 }, (_, i) => (arr[i] != null ? String(arr[i]) : ''));
    setCPrecios(relleno(preciosBase));
    setCPreciosP(relleno(preciosPBase));

    // Sugiere el mes siguiente al último guardado
    if (ultimo) {
      const sigMes = ultimo.mes === 12 ? 1 : ultimo.mes + 1;
      const sigAnio = ultimo.mes === 12 ? ultimo.anio + 1 : ultimo.anio;
      setCMes(String(sigMes));
      setCAnio(String(sigAnio));
    }
  }

  async function guardarConsumo(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteSel) return;
    setCargando(true);
    const nP = TARIFA_INFO[clienteSel.tarifa].periodosEnergia.length;
    const nPot = TARIFA_INFO[clienteSel.tarifa].periodosPotencia.length;
    try {
      const res = await fetch('/api/gestor/consumos-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filas: [{
            cliente_id: clienteSel.id,
            anio: cAnio,
            mes: cMes,
            consumos_kwh: cConsumos.slice(0, nP).map(num),
            precios_energia: cPrecios.slice(0, nP).map(num),
            precios_potencia: cPreciosP.slice(0, nPot).map(num),
          }],
        }),
      });
      const json = await res.json();
      if (!res.ok || (json.errores || []).length > 0) {
        aviso(json.error || json.errores?.[0] || 'Error', true);
        return;
      }
      aviso(`Consumo de ${MESES[parseInt(cMes) - 1]} ${cAnio} guardado. El cliente ya lo ve en su app.`);
      setCConsumos(Array(6).fill(''));
      abrirCliente(clienteSel);
    } finally {
      setCargando(false);
    }
  }

  async function importarExcel(file: File) {
    setCargando(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binario = '';
      for (let i = 0; i < bytes.length; i += 8192) {
        binario += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      const base64 = btoa(binario);

      const res = await fetch('/api/gestor/importar-excel-consumos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: base64 }),
      });
      const json = await res.json();
      if (!res.ok) { aviso(json.error, true); return; }

      const res2 = await fetch('/api/gestor/consumos-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filas: json.filas }),
      });
      const json2 = await res2.json();
      if (!res2.ok) { aviso(json2.error, true); return; }

      const errs = json2.errores || [];
      aviso(
        `${json2.guardadas} meses importados correctamente.` +
        (errs.length ? ` Atención, ${errs.length} filas con error: ${errs.slice(0, 3).join('; ')}` : ''),
        errs.length > 0 && json2.guardadas === 0
      );
      if (clienteSel) abrirCliente(clienteSel);
    } finally {
      setCargando(false);
    }
  }

  async function borrarConsumo(id: string) {
    if (!confirm('¿Borrar este mes?')) return;
    await fetch('/api/gestor/consumos-app', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (clienteSel) abrirCliente(clienteSel);
  }

  async function borrarCliente(c: ClienteApp) {
    if (!confirm(`¿Eliminar al cliente "${c.usuario}" y TODOS sus consumos? No se puede deshacer.`)) return;
    await fetch('/api/gestor/clientes-app', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id }),
    });
    if (clienteSel?.id === c.id) setClienteSel(null);
    cargarClientes();
  }

  if (!autorizado) return null;

  const infoSel = clienteSel ? TARIFA_INFO[clienteSel.tarifa] : null;
  const infoCrear = TARIFA_INFO[fTarifa];

  return (
    <div className="min-h-screen bg-background">
      {/* ── CABECERA ── */}
      <header className="border-b border-border/30 bg-surface/40 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/gestor"
              className="flex items-center justify-center w-9 h-9 rounded-lg border border-border/40 hover:bg-card transition"
            >
              <ChevronLeft className="w-4.5 h-4.5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Smartphone className="w-4.5 h-4.5 text-accent" />
                App de Clientes
              </h1>
              <p className="text-xs text-muted">Cuentas, precios y consumos mensuales</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Users className="w-4 h-4" />
            <span className="font-semibold text-foreground">{clientes.length}</span>
            <span className="hidden md:inline">clientes</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* Avisos */}
        {mensaje && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
            <CheckCircle2 className="w-4.5 h-4.5 shrink-0 mt-0.5" />
            <p>{mensaje}</p>
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* ── ACCIONES PRINCIPALES ── */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Nuevo cliente */}
          <button
            onClick={() => setMostrarCrear(!mostrarCrear)}
            className={`flex items-center gap-3.5 p-5 rounded-2xl border text-left transition ${
              mostrarCrear
                ? 'border-accent bg-accent/10'
                : 'border-border/40 bg-surface/40 hover:border-accent/50'
            }`}
          >
            <div className="w-11 h-11 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="font-bold text-sm">Nuevo cliente</p>
              <p className="text-xs text-muted">Crear cuenta con usuario y contraseña</p>
            </div>
          </button>

          {/* Importar Excel */}
          <div className="flex items-center gap-3.5 p-5 rounded-2xl border border-border/40 bg-surface/40">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Importar consumos</p>
              <p className="text-xs text-muted">Varios clientes y meses a la vez</p>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <a
                href="/api/gestor/plantilla-consumos"
                download
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/40 text-xs font-semibold hover:bg-card transition"
              >
                <Download className="w-3.5 h-3.5" />
                Plantilla
              </a>
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Subir Excel
                <input
                  type="file"
                  accept=".xlsx"
                  disabled={cargando}
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) importarExcel(f); e.target.value = ''; }}
                />
              </label>
            </div>
          </div>
        </div>

        {/* ── FORMULARIO NUEVO CLIENTE (plegable) ── */}
        {mostrarCrear && (
          <form onSubmit={crearCliente} className="rounded-2xl border border-border/40 bg-surface/40 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Datos del nuevo cliente</h2>
              <button type="button" onClick={() => setMostrarCrear(false)} className="p-1.5 rounded-lg hover:bg-card text-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Usuario *</label>
                <input className={inputCls} placeholder="juan.garcia" value={fUsuario} onChange={(e) => setFUsuario(e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Contraseña * (mín. 6 caracteres)</label>
                <input className={inputCls} placeholder="••••••" value={fPassword} onChange={(e) => setFPassword(e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Nombre completo *</label>
                <input className={inputCls} placeholder="Juan García López" value={fNombre} onChange={(e) => setFNombre(e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Teléfono</label>
                <input className={inputCls} placeholder="600 000 000" value={fTelefono} onChange={(e) => setFTelefono(e.target.value)} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Tarifa de acceso</label>
              <select className={inputCls} value={fTarifa} onChange={(e) => setFTarifa(e.target.value as TarifaAcceso)}>
                {Object.entries(TARIFA_INFO).map(([k, v]) => (
                  <option key={k} value={k}>{v.nombre} · {v.descripcion}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Precio fijo energía (€/kWh)</label>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {infoCrear.periodosEnergia.map((per, i) => (
                  <div key={i}>
                    <p className="text-[10px] text-muted mb-0.5 text-center">{per.split(' ')[0]}</p>
                    <input className={inputCls} placeholder="0.00" inputMode="decimal" value={fPreciosE[i]}
                      onChange={(e) => setFPreciosE((p) => p.map((x, j) => j === i ? e.target.value : x))} />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Potencia contratada (kW)</label>
                <div className="grid grid-cols-3 gap-2">
                  {infoCrear.periodosPotencia.map((per, i) => (
                    <div key={i}>
                      <p className="text-[10px] text-muted mb-0.5 text-center">{per.split(' ')[0]}</p>
                      <input className={inputCls} placeholder="0.0" inputMode="decimal" value={fPotencias[i]}
                        onChange={(e) => setFPotencias((p) => p.map((x, j) => j === i ? e.target.value : x))} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Precio potencia (€/kW·día)</label>
                <div className="grid grid-cols-3 gap-2">
                  {infoCrear.periodosPotencia.map((per, i) => (
                    <div key={i}>
                      <p className="text-[10px] text-muted mb-0.5 text-center">{per.split(' ')[0]}</p>
                      <input className={inputCls} placeholder="0.00" inputMode="decimal" value={fPreciosP[i]}
                        onChange={(e) => setFPreciosP((p) => p.map((x, j) => j === i ? e.target.value : x))} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button type="submit" disabled={cargando} className="px-6 py-2.5 bg-accent text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-accent/90 transition">
              {cargando ? 'Creando...' : 'Crear cliente'}
            </button>
          </form>
        )}

        {/* ── LISTA DE CLIENTES ── */}
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted px-1">
            Clientes registrados
          </h2>

          {clientes.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/40 p-10 text-center">
              <Users className="w-8 h-8 mx-auto text-muted/40 mb-2" />
              <p className="text-sm text-muted">Aún no hay clientes. Crea el primero con el botón de arriba.</p>
            </div>
          )}

          {clientes.map((c) => (
            <div
              key={c.id}
              className={`rounded-2xl border transition overflow-hidden ${
                clienteSel?.id === c.id ? 'border-accent/60 bg-accent/5' : 'border-border/40 bg-surface/40'
              }`}
            >
              {/* Fila del cliente */}
              <div className="flex items-center gap-3.5 p-4">
                <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center shrink-0 font-bold text-accent text-sm uppercase">
                  {c.nombre.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{c.nombre}</p>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span>@{c.usuario}</span>
                    <span className="px-1.5 py-0.5 rounded bg-card/80 border border-border/30 font-mono text-[10px]">
                      {TARIFA_INFO[c.tarifa]?.nombre}
                    </span>
                    {c.telefono && <span className="hidden md:inline">{c.telefono}</span>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => clienteSel?.id === c.id ? setClienteSel(null) : abrirCliente(c)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                      clienteSel?.id === c.id
                        ? 'bg-accent text-white'
                        : 'bg-accent/10 text-accent hover:bg-accent/20'
                    }`}
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                    Consumos
                  </button>
                  <button
                    onClick={() => borrarCliente(c)}
                    className="p-2 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition"
                    title="Eliminar cliente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Panel de consumos */}
              {clienteSel?.id === c.id && infoSel && (
                <div className="border-t border-border/30 bg-background/40 p-4 md:p-5 space-y-5">
                  <form onSubmit={guardarConsumo} className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="text-sm font-bold flex items-center gap-2">
                        <CalendarPlus className="w-4 h-4 text-accent" />
                        Subir consumo del mes
                      </p>
                      <div className="flex gap-2">
                        <select className={inputCls + ' w-36'} value={cMes} onChange={(e) => setCMes(e.target.value)}>
                          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                        <input className={inputCls + ' w-20'} placeholder="Año" value={cAnio} onChange={(e) => setCAnio(e.target.value)} />
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-border/30">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[11px] uppercase tracking-wide text-muted bg-card/40">
                            <th className="text-left px-3 py-2 font-semibold">Periodo</th>
                            <th className="text-left px-3 py-2 font-semibold">Consumo (kWh)</th>
                            <th className="text-left px-3 py-2 font-semibold">Precio (€/kWh)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {infoSel.periodosEnergia.map((per, i) => (
                            <tr key={i} className="border-t border-border/20">
                              <td className="px-3 py-1.5 text-xs font-semibold whitespace-nowrap">{per}</td>
                              <td className="px-3 py-1.5">
                                <input
                                  className={inputCls}
                                  placeholder="0"
                                  inputMode="decimal"
                                  autoFocus={i === 0}
                                  value={cConsumos[i]}
                                  onChange={(e) => setCConsumos((p) => p.map((x, j) => j === i ? e.target.value : x))}
                                />
                              </td>
                              <td className="px-3 py-1.5">
                                <input
                                  className={inputCls}
                                  placeholder="0.00"
                                  inputMode="decimal"
                                  value={cPrecios[i]}
                                  onChange={(e) => setCPrecios((p) => p.map((x, j) => j === i ? e.target.value : x))}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[11px] text-muted -mt-2">
                      Los precios vienen rellenados con los del último mes (o el contrato). Solo teclea los consumos.
                    </p>

                    <button
                      type="button"
                      onClick={() => setMostrarPreciosPotencia(!mostrarPreciosPotencia)}
                      className="text-xs text-accent hover:underline"
                    >
                      {mostrarPreciosPotencia ? 'Ocultar' : 'Cambiar'} precios de potencia (€/kW·día)
                    </button>
                    {mostrarPreciosPotencia && (
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                        {infoSel.periodosPotencia.map((per, i) => (
                          <div key={i}>
                            <p className="text-[10px] text-muted mb-0.5">{per}</p>
                            <input className={inputCls} placeholder="0.00" inputMode="decimal" value={cPreciosP[i]}
                              onChange={(e) => setCPreciosP((p) => p.map((x, j) => j === i ? e.target.value : x))} />
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={cargando}
                      className="w-full md:w-auto px-6 py-2.5 bg-accent text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-accent/90 transition"
                    >
                      {cargando ? 'Guardando...' : `Guardar ${MESES[parseInt(cMes) - 1]} ${cAnio}`}
                    </button>
                  </form>

                  {consumosCliente.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">
                        Meses guardados ({consumosCliente.length})
                      </p>
                      <div className="rounded-xl border border-border/30 divide-y divide-border/20 overflow-hidden">
                        {consumosCliente.map((cc) => (
                          <div key={cc.id} className="flex items-center gap-3 px-3.5 py-2.5 text-sm bg-card/20">
                            <span className="font-medium w-32 shrink-0">{MESES[cc.mes - 1]} {cc.anio}</span>
                            <span className="text-muted text-xs flex-1">
                              {(cc.consumos_kwh || []).reduce((a: number, b: number) => a + (b || 0), 0).toLocaleString('es-ES')} kWh
                            </span>
                            <span className="font-bold tabular-nums">
                              {(cc.coste_total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                            </span>
                            <button
                              onClick={() => borrarConsumo(cc.id)}
                              className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition"
                              title="Borrar mes"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
