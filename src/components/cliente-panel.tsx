'use client';

import { useState, useEffect, useMemo } from 'react';
import { TARIFA_INFO, TarifaAcceso } from '@/lib/tarifas';
import { Zap, LogOut, TrendingUp, Euro, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';

interface ClienteInfo {
  usuario: string;
  nombre: string;
  telefono: string | null;
  tarifa: TarifaAcceso;
  precios_energia: number[];
  precios_potencia: number[];
  potencias_kw: number[];
}

interface ConsumoMes {
  anio: number;
  mes: number;
  consumos_kwh: number[];
  coste_energia: number | null;
  coste_potencia: number | null;
  coste_total: number | null;
  notas: string | null;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const eur = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const kwh = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' kWh';

export function ClientePanel() {
  const [token, setToken] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // Login
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [entrando, setEntrando] = useState(false);

  // Datos
  const [cliente, setCliente] = useState<ClienteInfo | null>(null);
  const [consumos, setConsumos] = useState<ConsumoMes[]>([]);
  const [anioVisto, setAnioVisto] = useState<number>(new Date().getFullYear());
  const [mesAbierto, setMesAbierto] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('cliente_token');
    if (t) {
      setToken(t);
      cargarDatos(t);
    } else {
      setCargando(false);
    }
  }, []);

  async function cargarDatos(t: string) {
    setCargando(true);
    try {
      const res = await fetch('/api/cliente/datos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t }),
      });
      const json = await res.json();
      if (!res.ok) {
        localStorage.removeItem('cliente_token');
        setToken(null);
        setError(json.error || 'Sesión caducada.');
        return;
      }
      setCliente(json.cliente);
      setConsumos(json.consumos);
      if (json.consumos.length > 0) {
        setAnioVisto(json.consumos[0].anio);
      }
    } catch {
      setError('No se pudieron cargar tus datos. Comprueba tu conexión.');
    } finally {
      setCargando(false);
    }
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEntrando(true);
    try {
      const res = await fetch('/api/cliente/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'No se pudo iniciar sesión.');
        return;
      }
      localStorage.setItem('cliente_token', json.token);
      setToken(json.token);
      await cargarDatos(json.token);
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setEntrando(false);
    }
  }

  function salir() {
    localStorage.removeItem('cliente_token');
    setToken(null);
    setCliente(null);
    setConsumos([]);
    setUsuario('');
    setPassword('');
  }

  const consumosAnio = useMemo(
    () => consumos.filter((c) => c.anio === anioVisto).sort((a, b) => a.mes - b.mes),
    [consumos, anioVisto]
  );

  const anios = useMemo(
    () => Array.from(new Set(consumos.map((c) => c.anio))).sort((a, b) => b - a),
    [consumos]
  );

  const resumenAnio = useMemo(() => {
    const totalKwh = consumosAnio.reduce(
      (s, c) => s + c.consumos_kwh.reduce((a, b) => a + (b || 0), 0), 0
    );
    const totalEur = consumosAnio.reduce((s, c) => s + (c.coste_total || 0), 0);
    const meses = consumosAnio.length;
    return { totalKwh, totalEur, mediaMes: meses > 0 ? totalEur / meses : 0 };
  }, [consumosAnio]);

  const maxCosteMes = useMemo(
    () => Math.max(1, ...consumosAnio.map((c) => c.coste_total || 0)),
    [consumosAnio]
  );

  // ─── PANTALLA DE CARGA ───
  if (cargando) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Zap className="w-10 h-10 mx-auto text-accent animate-pulse" />
          <p className="text-muted text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  // ─── LOGIN ───
  if (!token || !cliente) {
    return (
      <div className="min-h-dvh bg-background flex flex-col justify-center p-6">
        <div className="max-w-sm mx-auto w-full space-y-8">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center">
              <Zap className="w-8 h-8 text-accent" />
            </div>
            <h1 className="text-2xl font-bold">Gesmeco Energía</h1>
            <p className="text-sm text-muted">Accede a tu cuenta de cliente</p>
          </div>

          <form onSubmit={entrar} className="space-y-4">
            <div>
              <label className="text-sm font-semibold block mb-1.5">Usuario</label>
              <input
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="w-full p-3.5 rounded-xl border border-border/40 bg-card/60 text-base"
                placeholder="tu usuario"
              />
            </div>
            <div>
              <label className="text-sm font-semibold block mb-1.5">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3.5 rounded-xl border border-border/40 bg-card/60 text-base"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={entrando || !usuario || !password}
              className="w-full py-3.5 bg-accent text-white rounded-xl font-bold text-base disabled:opacity-50"
            >
              {entrando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-xs text-muted text-center">
            ¿No tienes cuenta? Llámanos y te la creamos: somos tu asesor energético.
          </p>
        </div>
      </div>
    );
  }

  // ─── PANEL ───
  const info = TARIFA_INFO[cliente.tarifa] || TARIFA_INFO['2.0'];

  return (
    <div className="min-h-dvh bg-background pb-10">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-border/30 z-10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center">
              <Zap className="w-4.5 h-4.5 text-accent" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">{cliente.nombre}</p>
              <p className="text-xs text-muted leading-tight">Tarifa {info.nombre}</p>
            </div>
          </div>
          <button onClick={salir} className="p-2 rounded-lg hover:bg-secondary text-muted">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5 max-w-2xl mx-auto">
        {/* Selector de año */}
        {anios.length > 1 && (
          <div className="flex gap-2">
            {anios.map((a) => (
              <button
                key={a}
                onClick={() => setAnioVisto(a)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                  a === anioVisto
                    ? 'bg-accent text-white'
                    : 'bg-secondary/60 text-muted'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        )}

        {consumos.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <BarChart3 className="w-12 h-12 mx-auto text-muted/40" />
            <p className="text-muted">Aún no hay consumos registrados</p>
            <p className="text-xs text-muted/60">
              Iremos añadiendo tus consumos cada mes. Vuelve pronto.
            </p>
          </div>
        ) : (
          <>
            {/* Resumen del año */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-accent/10 border border-accent/25 rounded-xl p-3">
                <Euro className="w-4 h-4 text-accent mb-1.5" />
                <p className="text-lg font-bold leading-tight">{eur(resumenAnio.totalEur)}</p>
                <p className="text-[11px] text-muted">Gasto {anioVisto}</p>
              </div>
              <div className="bg-secondary/60 rounded-xl p-3">
                <Zap className="w-4 h-4 text-accent mb-1.5" />
                <p className="text-lg font-bold leading-tight">{kwh(resumenAnio.totalKwh)}</p>
                <p className="text-[11px] text-muted">Consumo {anioVisto}</p>
              </div>
              <div className="bg-secondary/60 rounded-xl p-3">
                <TrendingUp className="w-4 h-4 text-accent mb-1.5" />
                <p className="text-lg font-bold leading-tight">{eur(resumenAnio.mediaMes)}</p>
                <p className="text-[11px] text-muted">Media/mes</p>
              </div>
            </div>

            {/* Gráfico de barras por mes */}
            <div className="bg-secondary/40 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Gasto por mes · {anioVisto}</h3>
              <div className="flex items-end gap-1.5 h-32">
                {Array.from({ length: 12 }, (_, i) => {
                  const c = consumosAnio.find((x) => x.mes === i + 1);
                  const coste = c?.coste_total || 0;
                  const h = coste > 0 ? Math.max(8, (coste / maxCosteMes) * 100) : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end h-24">
                        <div
                          className={`w-full rounded-t transition-all ${
                            coste > 0 ? 'bg-accent' : 'bg-border/20'
                          }`}
                          style={{ height: coste > 0 ? `${h}%` : '4px' }}
                        />
                      </div>
                      <span className="text-[9px] text-muted">{MESES[i].slice(0, 3)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detalle mes a mes */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold px-1">Detalle mensual</h3>
              {[...consumosAnio].reverse().map((c) => {
                const key = `${c.anio}-${c.mes}`;
                const abierto = mesAbierto === key;
                const totalMesKwh = c.consumos_kwh.reduce((a, b) => a + (b || 0), 0);
                return (
                  <div key={key} className="bg-secondary/40 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setMesAbierto(abierto ? null : key)}
                      className="w-full flex items-center justify-between p-3.5"
                    >
                      <div className="text-left">
                        <p className="font-semibold text-sm">
                          {MESES[c.mes - 1]} {c.anio}
                        </p>
                        <p className="text-xs text-muted">{kwh(totalMesKwh)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-accent">{eur(c.coste_total || 0)}</p>
                        {abierto ? (
                          <ChevronUp className="w-4 h-4 text-muted" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted" />
                        )}
                      </div>
                    </button>

                    {abierto && (
                      <div className="px-3.5 pb-3.5 space-y-3 border-t border-border/20 pt-3">
                        {/* Consumo por periodo */}
                        <div>
                          <p className="text-xs font-semibold text-muted mb-1.5">Consumo por periodo</p>
                          <div className="grid grid-cols-3 gap-1.5">
                            {c.consumos_kwh.map((v, i) => (
                              <div key={i} className="bg-background/50 rounded-lg p-2 text-center">
                                <p className="text-[10px] text-muted">
                                  {info.periodosEnergia[i] || `P${i + 1}`}
                                </p>
                                <p className="text-sm font-bold tabular-nums">
                                  {(v || 0).toLocaleString('es-ES')}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Desglose de coste */}
                        <div className="flex justify-between text-xs">
                          <span className="text-muted">
                            Energía: <b className="text-foreground">{eur(c.coste_energia || 0)}</b>
                          </span>
                          <span className="text-muted">
                            Potencia: <b className="text-foreground">{eur(c.coste_potencia || 0)}</b>
                          </span>
                        </div>
                        {c.notas && <p className="text-xs text-muted italic">{c.notas}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Mis precios */}
            <div className="bg-secondary/40 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold">Mi contrato · Tarifa {info.nombre}</h3>
              <div>
                <p className="text-xs font-semibold text-muted mb-1.5">Precio energía (€/kWh)</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {cliente.precios_energia.map((p, i) => (
                    <div key={i} className="bg-background/50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-muted">{info.periodosEnergia[i] || `P${i + 1}`}</p>
                      <p className="text-sm font-bold tabular-nums">{p}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted mb-1.5">
                  Potencia contratada (kW) · precio (€/kW·día)
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {cliente.potencias_kw.map((kw, i) => (
                    <div key={i} className="bg-background/50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-muted">{info.periodosPotencia[i] || `P${i + 1}`}</p>
                      <p className="text-sm font-bold tabular-nums">{kw} kW</p>
                      <p className="text-[10px] text-muted tabular-nums">
                        {cliente.precios_potencia[i] ?? '—'} €
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
