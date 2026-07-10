'use client';

import { useState } from 'react';
import { CameraCapture } from './camera-capture';
import {
  TARIFA_INFO,
  TarifaAcceso,
  DatosSuministro,
  ResultadoComparativa,
  compararConComercializadoras,
  guardarAnalisisWeb,
} from '@/lib/tarifas';
import { AlertCircle, CheckCircle, ChevronDown } from 'lucide-react';

type Paso = 'inicio' | 'camara' | 'formulario' | 'resultados';

const eur = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function MobileInvoiceAnalyzer() {
  const [paso, setPaso] = useState<Paso>('inicio');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  // Datos del formulario
  const [tarifa, setTarifa] = useState<TarifaAcceso>('2.0');
  const [consumos, setConsumos] = useState<string[]>(Array(6).fill(''));
  const [potencias, setPotencias] = useState<string[]>(Array(6).fill(''));
  const [preciosE, setPreciosE] = useState<string[]>(Array(6).fill(''));
  const [preciosP, setPreciosP] = useState<string[]>(Array(6).fill(''));
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [resultado, setResultado] = useState<ResultadoComparativa | null>(null);
  const [avisoLectura, setAvisoLectura] = useState('');

  const info = TARIFA_INFO[tarifa];
  const nE = info.periodosEnergia.length;
  const nP = info.periodosPotencia.length;

  const num = (s: string) => {
    const n = parseFloat((s || '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  };

  const setArr = (setter: React.Dispatch<React.SetStateAction<string[]>>, i: number, v: string) =>
    setter((prev) => prev.map((x, idx) => (idx === i ? v : x)));

  async function analizar() {
    setError('');
    const datos: DatosSuministro = {
      tarifa,
      consumosMes: consumos.slice(0, nE).map(num),
      potencias: potencias.slice(0, nP).map(num),
      preciosEnergia: preciosE.slice(0, nE).map(num),
      preciosPotencia: preciosP.slice(0, nP).map(num),
    };

    if (datos.consumosMes.every((c) => c === 0)) {
      setError('Introduce al menos un consumo.');
      return;
    }

    setCargando(true);
    try {
      const res = await compararConComercializadoras(datos);
      setResultado(res);
      setPaso('resultados');

      // Guardar en Supabase sin bloquear
      guardarAnalisisWeb({
        nombre: nombre || 'App Móvil (sin nombre)',
        telefono,
        datos,
        resultado: res,
      }).catch(() => {});

      // Notificar (fire-and-forget)
      fetch('/api/notificar-analisis', {
        method: 'POST',
        body: JSON.stringify({
          nombre: nombre || 'App Móvil',
          telefono,
          origen: 'app-movil',
          tarifa: datos.tarifa,
          costeActual: Math.round(res.actual.total * 100) / 100,
          consumoAnual: Math.round(datos.consumosMes.reduce((s, c) => s + (c || 0), 0) * 12),
          ahorroMin: res.rangoAhorro ? Math.round(res.rangoAhorro.min * 100) / 100 : 0,
          ahorroMax: res.rangoAhorro ? Math.round(res.rangoAhorro.max * 100) / 100 : 0,
        }),
      }).catch(() => {});
    } catch (e) {
      console.error(e);
      setError('No se pudo completar el análisis. Inténtalo de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  async function procesarFoto(file: File) {
    setError('');
    const tiposOk = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!tiposOk.includes(file.type)) {
      setError('Sube una foto (JPG/PNG) o un PDF.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('El archivo es demasiado grande (máximo 15 MB).');
      return;
    }

    setCargando(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binario = '';
      for (let i = 0; i < bytes.length; i += 8192) {
        binario += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      const base64 = btoa(binario);

      const res = await fetch('/api/leer-factura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: base64, mediaType: file.type }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'No se pudo leer la factura.');
        return;
      }

      const d = json.datos;
      const relleno = (arr: number[]) => {
        const out = Array(6).fill('');
        (arr || []).forEach((v: number, i: number) => {
          out[i] = v.toString();
        });
        return out;
      };

      setTarifa(d.tarifa);
      setConsumos(relleno(d.consumos_kwh_mes));
      setPotencias(relleno(d.potencias_kw));
      setPreciosE(relleno(d.precios_energia_eur_kwh));
      setPreciosP(relleno(d.precios_potencia_eur_kw_dia));
      setNombre(d.nombre_titular || nombre);
      setAvisoLectura(d.observaciones);
      setPaso('formulario');
    } catch (e) {
      console.error(e);
      setError('Error procesando la foto. Inténtalo de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/5 pb-8">
      {/* INICIO */}
      {paso === 'inicio' && (
        <div className="p-4 pt-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analiza tu factura</h1>
            <p className="text-sm text-muted mt-1">Descubre cuánto puedes ahorrar en tu gasto de luz</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setPaso('camara')}
              className="w-full flex items-center gap-3 p-4 bg-accent text-white rounded-lg font-semibold hover:bg-accent/90 transition"
            >
              <div className="text-lg">📱</div>
              <div className="text-left">
                <div>Escanear factura</div>
                <div className="text-xs font-normal opacity-80">Con la cámara</div>
              </div>
            </button>

            <button
              onClick={() => setPaso('formulario')}
              className="w-full flex items-center gap-3 p-4 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-secondary/90 transition"
            >
              <div className="text-lg">🧮</div>
              <div className="text-left">
                <div>Introducir manualmente</div>
                <div className="text-xs font-normal opacity-80">Calculadora guiada</div>
              </div>
            </button>
          </div>

          <div className="bg-secondary/50 rounded-lg p-4 text-sm text-foreground space-y-2">
            <h3 className="font-semibold">Necesitarás:</h3>
            <ul className="space-y-1 text-xs">
              <li>✓ Consumo mensual (kWh)</li>
              <li>✓ Potencia contratada (kW)</li>
              <li>✓ Precio de la energía (€/kWh)</li>
              <li>✓ Precio de la potencia (€/kW·día)</li>
            </ul>
          </div>
        </div>
      )}

      {/* CÁMARA */}
      {paso === 'camara' && (
        <div className="p-4 pt-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setPaso('inicio')}
              className="text-accent hover:underline"
            >
              ← Volver
            </button>
          </div>
          <h2 className="text-xl font-bold">Escanear factura</h2>
          <CameraCapture onFileSelected={procesarFoto} isLoading={cargando} />
          {error && (
            <div className="flex gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}
        </div>
      )}

      {/* FORMULARIO */}
      {paso === 'formulario' && (
        <div className="p-4 pt-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setPaso('inicio')}
              className="text-accent hover:underline"
            >
              ← Volver
            </button>
          </div>

          <h2 className="text-xl font-bold">Datos de tu suministro</h2>

          {/* Datos cliente */}
          <div className="space-y-3 bg-secondary/40 rounded-lg p-4">
            <h3 className="font-semibold text-sm">Tu información (opcional)</h3>
            <input
              type="text"
              placeholder="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-border/40 bg-background/60 text-sm"
            />
            <input
              type="tel"
              placeholder="Teléfono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-border/40 bg-background/60 text-sm"
            />
          </div>

          {/* Tarifa */}
          <div className="space-y-2">
            <label className="text-sm font-semibold">Tarifa de acceso</label>
            <select
              value={tarifa}
              onChange={(e) => setTarifa(e.target.value as TarifaAcceso)}
              className="w-full p-2.5 rounded-lg border border-border/40 bg-background/60 text-sm"
            >
              {Object.entries(TARIFA_INFO).map(([key, v]) => (
                <option key={key} value={key}>
                  {v.nombre} • {v.descripcion}
                </option>
              ))}
            </select>
          </div>

          {avisoLectura && (
            <div className="flex gap-2 p-3 bg-amber-500/10 rounded-lg text-amber-700 text-xs border border-amber-500/30">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{avisoLectura}</p>
            </div>
          )}

          {/* Consumos */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Consumo (kWh/mes)</h3>
            <div className="grid grid-cols-3 gap-2">
              {info.periodosEnergia.map((per, i) => (
                <div key={i}>
                  <label className="text-xs text-muted block mb-1">{per}</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={consumos[i]}
                    onChange={(e) => setArr(setConsumos, i, e.target.value)}
                    className="w-full p-2 rounded-lg border border-border/40 bg-background/60 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Potencias */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Potencia contratada (kW)</h3>
            <div className="grid gap-2">
              {info.periodosPotencia.map((per, i) => (
                <div key={i}>
                  <label className="text-xs text-muted block mb-1">{per}</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={potencias[i]}
                    onChange={(e) => setArr(setPotencias, i, e.target.value)}
                    className="w-full p-2 rounded-lg border border-border/40 bg-background/60 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Precios energía */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Precio energía (€/kWh)</h3>
            <div className="grid grid-cols-3 gap-2">
              {info.periodosEnergia.map((per, i) => (
                <div key={i}>
                  <label className="text-xs text-muted block mb-1">{per}</label>
                  <input
                    type="number"
                    placeholder="0"
                    step="0.01"
                    value={preciosE[i]}
                    onChange={(e) => setArr(setPreciosE, i, e.target.value)}
                    className="w-full p-2 rounded-lg border border-border/40 bg-background/60 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Precios potencia */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Precio potencia (€/kW·día)</h3>
            <div className="grid gap-2">
              {info.periodosPotencia.map((per, i) => (
                <div key={i}>
                  <label className="text-xs text-muted block mb-1">{per}</label>
                  <input
                    type="number"
                    placeholder="0"
                    step="0.01"
                    value={preciosP[i]}
                    onChange={(e) => setArr(setPreciosP, i, e.target.value)}
                    className="w-full p-2 rounded-lg border border-border/40 bg-background/60 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <button
            onClick={analizar}
            disabled={cargando}
            className="w-full py-3 bg-accent text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {cargando ? 'Analizando...' : 'Analizar'}
          </button>
        </div>
      )}

      {/* RESULTADOS */}
      {paso === 'resultados' && resultado && (
        <div className="p-4 pt-6 space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Resultados</h2>

          {/* Coste actual */}
          <div className="bg-gradient-to-br from-secondary/60 to-secondary/30 rounded-lg p-4 space-y-2">
            <p className="text-sm text-muted">Coste actual anual</p>
            <p className="text-3xl font-bold text-foreground">{eur(resultado.actual.total)}</p>
            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/30">
              <div>
                <p className="text-muted">Energía</p>
                <p className="font-semibold">{eur(resultado.actual.totalEnergia)}</p>
              </div>
              <div>
                <p className="text-muted">Potencia</p>
                <p className="font-semibold">{eur(resultado.actual.totalPotencia)}</p>
              </div>
            </div>
          </div>

          {/* Rango de ahorro */}
          {resultado.rangoAhorro && (
            <div className="bg-gradient-to-br from-accent/20 to-accent/10 rounded-lg p-4 space-y-2 border border-accent/30">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-accent">Potencial de ahorro</p>
                  <p className="text-2xl font-bold text-accent">
                    {eur(resultado.rangoAhorro.min)} - {eur(resultado.rangoAhorro.max)}
                  </p>
                  <p className="text-xs text-accent/70 mt-1">
                    {resultado.rangoAhorro.minPct.toFixed(1)}% - {resultado.rangoAhorro.maxPct.toFixed(1)}% anual
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Desglose por periodo */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Coste por periodo</h3>
            <div className="space-y-2">
              {resultado.actual.energia.map((p, i) => (
                <div key={i} className="flex justify-between items-center p-2 bg-secondary/40 rounded-lg text-sm">
                  <span className="font-medium">{p.periodo}</span>
                  <span className="text-muted">{eur(p.costeAnual)}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setPaso('inicio')}
            className="w-full py-3 bg-secondary text-secondary-foreground rounded-lg font-semibold"
          >
            Nuevo análisis
          </button>
        </div>
      )}
    </div>
  );
}
