'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TARIFA_INFO, TarifaAcceso } from '@/lib/tarifas';

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
  'w-full rounded-lg border border-border/40 bg-card/60 px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none';

export default function ClientesAppPage() {
  const router = useRouter();
  const [autorizado, setAutorizado] = useState(false);
  const [clientes, setClientes] = useState<ClienteApp[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

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
    setTimeout(() => { setMensaje(''); setError(''); }, 5000);
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
      aviso(`✅ Cliente "${fUsuario}" creado. Dale el usuario y la contraseña.`);
      setFUsuario(''); setFPassword(''); setFNombre(''); setFTelefono('');
      setFPreciosE(Array(6).fill('')); setFPreciosP(Array(6).fill('')); setFPotencias(Array(6).fill(''));
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
      Array.from({ length: 6 }, (_, i) => (arr[i] != null && arr[i] !== 0 ? String(arr[i]) : arr[i] === 0 ? '0' : ''));
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
      aviso(`✅ Consumo de ${MESES[parseInt(cMes) - 1]} ${cAnio} guardado.`);
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
        `✅ ${json2.guardadas} meses guardados.` +
        (errs.length ? ` ⚠️ ${errs.length} errores: ${errs.slice(0, 3).join('; ')}` : '')
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
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Clientes de la App</h1>
            <p className="text-sm text-muted">Usuarios, precios fijos y consumos mensuales</p>
          </div>
          <Link href="/gestor" className="text-sm text-accent hover:underline">← Panel gestor</Link>
        </div>

        {mensaje && <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">{mensaje}</div>}
        {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}

        {/* ── CREAR CLIENTE ── */}
        <form onSubmit={crearCliente} className="bg-secondary/30 rounded-xl p-5 space-y-4">
          <h2 className="font-bold">➕ Crear cliente nuevo</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <input className={inputCls} placeholder="Usuario (ej: juan.garcia)" value={fUsuario} onChange={(e) => setFUsuario(e.target.value)} required />
            <input className={inputCls} placeholder="Contraseña (mín. 6 caracteres)" value={fPassword} onChange={(e) => setFPassword(e.target.value)} required />
            <input className={inputCls} placeholder="Nombre completo" value={fNombre} onChange={(e) => setFNombre(e.target.value)} required />
            <input className={inputCls} placeholder="Teléfono (opcional)" value={fTelefono} onChange={(e) => setFTelefono(e.target.value)} />
          </div>
          <select className={inputCls} value={fTarifa} onChange={(e) => setFTarifa(e.target.value as TarifaAcceso)}>
            {Object.entries(TARIFA_INFO).map(([k, v]) => (
              <option key={k} value={k}>{v.nombre} · {v.descripcion}</option>
            ))}
          </select>

          <div>
            <p className="text-xs font-semibold text-muted mb-1.5">Precio fijo energía (€/kWh)</p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {infoCrear.periodosEnergia.map((per, i) => (
                <input key={i} className={inputCls} placeholder={per} value={fPreciosE[i]}
                  onChange={(e) => setFPreciosE((p) => p.map((x, j) => j === i ? e.target.value : x))} />
              ))}
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-muted mb-1.5">Potencia contratada (kW)</p>
              <div className="grid grid-cols-3 gap-2">
                {infoCrear.periodosPotencia.map((per, i) => (
                  <input key={i} className={inputCls} placeholder={per} value={fPotencias[i]}
                    onChange={(e) => setFPotencias((p) => p.map((x, j) => j === i ? e.target.value : x))} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted mb-1.5">Precio potencia (€/kW·día)</p>
              <div className="grid grid-cols-3 gap-2">
                {infoCrear.periodosPotencia.map((per, i) => (
                  <input key={i} className={inputCls} placeholder={per} value={fPreciosP[i]}
                    onChange={(e) => setFPreciosP((p) => p.map((x, j) => j === i ? e.target.value : x))} />
                ))}
              </div>
            </div>
          </div>

          <button type="submit" disabled={cargando} className="px-5 py-2.5 bg-accent text-white rounded-lg font-semibold text-sm disabled:opacity-50">
            {cargando ? 'Guardando...' : 'Crear cliente'}
          </button>
        </form>

        {/* ── IMPORTAR EXCEL ── */}
        <div className="bg-secondary/30 rounded-xl p-5 space-y-3">
          <h2 className="font-bold">📊 Importar consumos desde Excel</h2>
          <p className="text-xs text-muted">
            Formato (fila 1 = cabeceras): <code className="bg-background/50 px-1.5 py-0.5 rounded">usuario | año | mes | P1 | P2 | P3 | P4 | P5 | P6</code>.
            Una fila por cliente y mes. El coste se calcula solo con los precios fijos del cliente.
          </p>
          <input
            type="file"
            accept=".xlsx"
            disabled={cargando}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importarExcel(f); e.target.value = ''; }}
            className="text-sm"
          />
        </div>

        {/* ── LISTA DE CLIENTES ── */}
        <div className="space-y-2">
          <h2 className="font-bold">👥 Clientes ({clientes.length})</h2>
          {clientes.map((c) => (
            <div key={c.id} className={`rounded-xl border p-4 transition ${clienteSel?.id === c.id ? 'border-accent bg-accent/5' : 'border-border/30 bg-secondary/20'}`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-semibold">{c.nombre} <span className="text-muted font-normal text-sm">· @{c.usuario}</span></p>
                  <p className="text-xs text-muted">Tarifa {TARIFA_INFO[c.tarifa]?.nombre} {c.telefono ? `· ${c.telefono}` : ''}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => abrirCliente(c)} className="px-3 py-1.5 bg-accent/15 text-accent rounded-lg text-xs font-semibold">
                    Consumos
                  </button>
                  <button onClick={() => borrarCliente(c)} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-semibold">
                    Eliminar
                  </button>
                </div>
              </div>

              {/* Panel de consumos del cliente seleccionado */}
              {clienteSel?.id === c.id && infoSel && (
                <div className="mt-4 pt-4 border-t border-border/20 space-y-4">
                  <form onSubmit={guardarConsumo} className="space-y-4 bg-background/30 rounded-xl p-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="text-sm font-bold">📅 Subir consumo del mes</p>
                      <div className="flex gap-2">
                        <select className={inputCls + ' w-36'} value={cMes} onChange={(e) => setCMes(e.target.value)}>
                          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                        <input className={inputCls + ' w-20'} placeholder="Año" value={cAnio} onChange={(e) => setCAnio(e.target.value)} />
                      </div>
                    </div>

                    {/* Tabla periodo → consumo + precio */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-muted">
                            <th className="text-left pb-1.5 pr-3">Periodo</th>
                            <th className="text-left pb-1.5 pr-3">Consumo (kWh)</th>
                            <th className="text-left pb-1.5">Precio (€/kWh)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {infoSel.periodosEnergia.map((per, i) => (
                            <tr key={i}>
                              <td className="pr-3 py-1 text-xs font-semibold whitespace-nowrap">{per}</td>
                              <td className="pr-3 py-1">
                                <input
                                  className={inputCls}
                                  placeholder="0"
                                  inputMode="decimal"
                                  autoFocus={i === 0}
                                  value={cConsumos[i]}
                                  onChange={(e) => setCConsumos((p) => p.map((x, j) => j === i ? e.target.value : x))}
                                />
                              </td>
                              <td className="py-1">
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
                      <p className="text-[11px] text-muted mt-1">
                        💡 Los precios vienen rellenados con los del último mes (o el contrato). Solo teclea los consumos.
                      </p>
                    </div>

                    {/* Precios de potencia (opcional, plegado) */}
                    <button
                      type="button"
                      onClick={() => setMostrarPreciosPotencia(!mostrarPreciosPotencia)}
                      className="text-xs text-accent hover:underline"
                    >
                      {mostrarPreciosPotencia ? '▾ Ocultar' : '▸ Cambiar'} precios de potencia (€/kW·día)
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

                    <button type="submit" disabled={cargando} className="w-full md:w-auto px-6 py-2.5 bg-accent text-white rounded-lg text-sm font-bold disabled:opacity-50">
                      {cargando ? 'Guardando...' : `💾 Guardar ${MESES[parseInt(cMes) - 1]} ${cAnio}`}
                    </button>
                  </form>

                  {consumosCliente.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold">Meses guardados</p>
                      {consumosCliente.map((cc) => (
                        <div key={cc.id} className="flex items-center justify-between bg-background/40 rounded-lg px-3 py-2 text-sm">
                          <span>{MESES[cc.mes - 1]} {cc.anio}</span>
                          <span className="text-muted text-xs">
                            {(cc.consumos_kwh || []).reduce((a: number, b: number) => a + (b || 0), 0).toLocaleString('es-ES')} kWh
                          </span>
                          <span className="font-semibold">{(cc.coste_total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
                          <button onClick={() => borrarConsumo(cc.id)} className="text-red-400 text-xs">Borrar</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {clientes.length === 0 && <p className="text-sm text-muted">Aún no hay clientes. Crea el primero arriba.</p>}
        </div>
      </div>
    </div>
  );
}
