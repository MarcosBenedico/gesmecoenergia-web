'use client';

import { useState } from 'react';
import { Download, Upload, Loader, CheckCircle2, AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { Card, btnPrimario, btnSecundario, inputCls } from '../ui';

/**
 * Asistente de importación Excel (manual, exportado desde Avant/iSegur):
 * 1) elegir tipo → 2) subir archivo → 3) mapear columnas → 4) previsualizar/validar → 5) confirmar → resumen.
 * Nunca borra ni sobreescribe datos existentes.
 */

const TIPOS = [
  { clave: 'cartera', nombre: 'Cartera viva', desc: 'Clientes + pólizas + vencimientos. La base del módulo.' },
  { clave: 'movimientos', nombre: 'Movimientos del mes', desc: 'Una sola plantilla: emisiones, anulaciones, suplementos y cambios de mediador. Clasifica cada fila por el motivo.' },
  { clave: 'emisiones', nombre: 'Emisiones año', desc: 'Producción emitida, clasificada por tipo.' },
  { clave: 'anulaciones', nombre: 'Anulaciones año', desc: 'Bajas con motivo; distingue real de sustitución.' },
  { clave: 'vencimientos', nombre: 'Vencimientos', desc: 'Solo fechas VCT (si no vienen en la cartera).' },
  { clave: 'mediador', nombre: 'Cambios de mediador', desc: 'Cartas de mediador y su estado.' },
];

interface Campo { clave: string; nombre: string; obligatorio: boolean }
interface Analisis {
  cabeceras: string[];
  filas: string[][];
  total: number;
  campos: Campo[];
  mapeo_sugerido: Record<string, number>;
}
interface FilaAnotada { estado: 'ok' | 'incompleta' | 'duplicada' | 'error'; motivo: string }
interface ResumenValidacion { total: number; ok: number; incompletas: number; duplicadas: number; errores: number }
interface ResumenFinal extends ResumenValidacion { importadas: number; clientes_creados: number }

const ESTILO_ESTADO: Record<string, string> = {
  ok: 'bg-emerald-500/15 text-emerald-400',
  incompleta: 'bg-amber-500/15 text-amber-300',
  duplicada: 'bg-blue-500/15 text-blue-300',
  error: 'bg-red-500/15 text-red-400',
};

export default function ImportarPage() {
  const [paso, setPaso] = useState(1);
  const [tipo, setTipo] = useState('cartera');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [mapeo, setMapeo] = useState<Record<string, number>>({});
  const [anotadas, setAnotadas] = useState<FilaAnotada[]>([]);
  const [resumenVal, setResumenVal] = useState<ResumenValidacion | null>(null);
  const [resumenFinal, setResumenFinal] = useState<{ resumen: ResumenFinal; alertas: string[]; errores_importacion: string[] } | null>(null);

  function reiniciar() {
    setPaso(1); setArchivo(null); setAnalisis(null); setMapeo({});
    setAnotadas([]); setResumenVal(null); setResumenFinal(null); setError('');
  }

  async function analizar() {
    if (!archivo) return;
    setCargando(true); setError('');
    try {
      const base64: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = (ev) => resolve((ev.target?.result as string).split(',')[1]);
        r.onerror = () => reject(new Error('lectura'));
        r.readAsDataURL(archivo);
      });
      const res = await fetch('/api/correbin/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'analizar', tipo, archivo_base64: base64 }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Error analizando el Excel.'); return; }
      setAnalisis(json);
      setMapeo(json.mapeo_sugerido);
      setPaso(3);
    } catch {
      setError('No se pudo leer el archivo.');
    } finally {
      setCargando(false);
    }
  }

  async function validar() {
    if (!analisis) return;
    // Comprobar obligatorias mapeadas
    const faltan = analisis.campos.filter((c) => c.obligatorio && (mapeo[c.clave] == null || mapeo[c.clave] < 0));
    if (faltan.length) { setError(`Mapea las columnas obligatorias: ${faltan.map((c) => c.nombre).join(', ')}`); return; }
    setCargando(true); setError('');
    try {
      const res = await fetch('/api/correbin/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'validar', tipo, mapeo, filas: analisis.filas }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Error validando.'); return; }
      setAnotadas(json.filas_anotadas);
      setResumenVal(json.resumen);
      setPaso(4);
    } catch {
      setError('Error de conexión.');
    } finally {
      setCargando(false);
    }
  }

  async function importar() {
    if (!analisis) return;
    setCargando(true); setError('');
    try {
      const res = await fetch('/api/correbin/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'importar', tipo, mapeo, filas: analisis.filas }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Error importando.'); return; }
      setResumenFinal(json);
      setPaso(5);
    } catch {
      setError('Error de conexión.');
    } finally {
      setCargando(false);
    }
  }

  const tipoDef = TIPOS.find((t) => t.clave === tipo)!;

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h2 className="text-xl font-black text-foreground">Importación Excel</h2>
        <p className="text-xs text-muted mt-0.5">
          Importación manual desde Avant/iSegur (sin integración automática). Nunca borra datos existentes.
        </p>
      </div>

      {/* Indicador de pasos */}
      <div className="flex items-center gap-1 text-[11px] font-bold flex-wrap">
        {['Tipo', 'Archivo', 'Columnas', 'Previsualizar', 'Resultado'].map((n, i) => (
          <span key={n} className="flex items-center gap-1">
            <span className={`px-2.5 py-1 rounded-full ${paso === i + 1 ? 'bg-accent text-white' : paso > i + 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-card/80 text-muted'}`}>
              {i + 1}. {n}
            </span>
            {i < 4 && <ChevronRight className="w-3 h-3 text-muted" />}
          </span>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* PASO 1: tipo */}
      {paso === 1 && (
        <div className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            {TIPOS.map((t) => (
              <button
                key={t.clave}
                onClick={() => setTipo(t.clave)}
                className={`text-left p-4 rounded-2xl border transition ${tipo === t.clave ? 'border-accent bg-accent/10' : 'border-border/40 bg-surface/50 hover:border-border'}`}
              >
                <p className="font-bold text-sm">{t.nombre}</p>
                <p className="text-xs text-muted mt-1">{t.desc}</p>
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <button onClick={() => setPaso(2)} className={btnPrimario}>
              Continuar con &quot;{tipoDef.nombre}&quot; <ChevronRight className="w-4 h-4" />
            </button>
            <a href={`/api/correbin/importar?tipo=${tipo}`} className={btnSecundario} download>
              <Download className="w-4 h-4" /> Plantilla de {tipoDef.nombre}
            </a>
          </div>
        </div>
      )}

      {/* PASO 2: archivo */}
      {paso === 2 && (
        <Card className="space-y-3">
          <h3 className="font-bold text-sm">Sube el Excel de {tipoDef.nombre}</h3>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => setArchivo(e.target.files?.[0] || null)}
            className="text-sm"
          />
          {archivo && <p className="text-xs text-emerald-400">✓ {archivo.name}</p>}
          <div className="flex gap-2">
            <button onClick={() => setPaso(1)} className={btnSecundario}><ChevronLeft className="w-4 h-4" /> Atrás</button>
            <button onClick={analizar} disabled={!archivo || cargando} className={btnPrimario}>
              {cargando ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {cargando ? 'Leyendo...' : 'Leer columnas'}
            </button>
          </div>
        </Card>
      )}

      {/* PASO 3: mapeo */}
      {paso === 3 && analisis && (
        <Card className="space-y-3">
          <h3 className="font-bold text-sm">Mapea las columnas ({analisis.total} filas detectadas)</h3>
          <p className="text-xs text-muted">
            Hemos sugerido el mapeo automáticamente. Corrige lo que no encaje; los campos con * son obligatorios.
          </p>
          <div className="grid md:grid-cols-2 gap-2.5">
            {analisis.campos.map((c) => (
              <div key={c.clave} className="flex items-center gap-2">
                <span className={`w-40 shrink-0 text-xs font-semibold ${c.obligatorio ? 'text-foreground' : 'text-muted'}`}>
                  {c.nombre}{c.obligatorio && ' *'}
                </span>
                <select
                  className={`${inputCls} !py-1.5 !text-xs`}
                  value={mapeo[c.clave] ?? -1}
                  onChange={(e) => setMapeo((m) => ({ ...m, [c.clave]: parseInt(e.target.value) }))}
                >
                  <option value={-1}>— Sin mapear —</option>
                  {analisis.cabeceras.map((h, i) => (
                    <option key={i} value={i}>{h || `(columna ${i + 1})`}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPaso(2)} className={btnSecundario}><ChevronLeft className="w-4 h-4" /> Atrás</button>
            <button onClick={validar} disabled={cargando} className={btnPrimario}>
              {cargando ? <Loader className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              Validar y previsualizar
            </button>
          </div>
        </Card>
      )}

      {/* PASO 4: previsualización */}
      {paso === 4 && analisis && resumenVal && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            {[
              ['ok', resumenVal.ok, 'Correctas'],
              ['incompleta', resumenVal.incompletas, 'Incompletas (se importan con alerta)'],
              ['duplicada', resumenVal.duplicadas, 'Duplicadas (se saltan)'],
              ['error', resumenVal.errores, 'Con error (se saltan)'],
            ].map(([clave, n, nombre]) => (
              <Card key={String(clave)} className={`!p-3 text-center ${ESTILO_ESTADO[String(clave)]}`}>
                <p className="text-xl font-black tabular-nums">{String(n)}</p>
                <p className="text-[10px] font-bold uppercase">{String(nombre)}</p>
              </Card>
            ))}
          </div>

          <Card className="!p-0 overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-left text-[10px] uppercase text-muted border-b border-border/40">
                  <th className="px-3 py-2">Estado</th>
                  {analisis.campos.filter((c) => (mapeo[c.clave] ?? -1) >= 0).map((c) => (
                    <th key={c.clave} className="px-3 py-2">{c.nombre}</th>
                  ))}
                  <th className="px-3 py-2">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {analisis.filas.slice(0, 200).map((fila, i) => (
                  <tr key={i} className="border-b border-border/10">
                    <td className="px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ESTILO_ESTADO[anotadas[i]?.estado]}`}>
                        {anotadas[i]?.estado}
                      </span>
                    </td>
                    {analisis.campos.filter((c) => (mapeo[c.clave] ?? -1) >= 0).map((c) => (
                      <td key={c.clave} className="px-3 py-1.5 max-w-40 truncate">{fila[mapeo[c.clave]] || ''}</td>
                    ))}
                    <td className="px-3 py-1.5 text-muted max-w-56 truncate">{anotadas[i]?.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {analisis.filas.length > 200 && (
              <p className="text-[11px] text-muted text-center py-2">Mostrando 200 de {analisis.filas.length} filas.</p>
            )}
          </Card>

          <div className="flex gap-2 items-center flex-wrap">
            <button onClick={() => setPaso(3)} className={btnSecundario}><ChevronLeft className="w-4 h-4" /> Cambiar mapeo</button>
            <button onClick={importar} disabled={cargando || resumenVal.ok + resumenVal.incompletas === 0} className={btnPrimario}>
              {cargando ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {cargando ? 'Importando...' : `Confirmar e importar ${resumenVal.ok + resumenVal.incompletas} fila(s)`}
            </button>
            <span className="text-[11px] text-muted">Las duplicadas y con error no se tocan. No se borra nada existente.</span>
          </div>
        </div>
      )}

      {/* PASO 5: resumen final */}
      {paso === 5 && resumenFinal && (
        <Card className="border-emerald-500/30 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <CheckCircle2 className="w-5 h-5" /> Importación completada
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div><p className="text-2xl font-black text-emerald-400">{resumenFinal.resumen.importadas}</p><p className="text-[10px] uppercase font-bold text-muted">Importadas</p></div>
            <div><p className="text-2xl font-black text-secondary">{resumenFinal.resumen.clientes_creados}</p><p className="text-[10px] uppercase font-bold text-muted">Clientes nuevos</p></div>
            <div><p className="text-2xl font-black text-blue-300">{resumenFinal.resumen.duplicadas}</p><p className="text-[10px] uppercase font-bold text-muted">Duplicadas saltadas</p></div>
            <div><p className="text-2xl font-black text-red-400">{resumenFinal.resumen.errores}</p><p className="text-[10px] uppercase font-bold text-muted">Errores saltados</p></div>
          </div>
          {resumenFinal.alertas.length > 0 && (
            <div className="text-xs text-amber-300 space-y-0.5">
              <p className="font-bold">Alertas generadas:</p>
              {resumenFinal.alertas.slice(0, 15).map((a, i) => <p key={i}>· {a}</p>)}
              {resumenFinal.alertas.length > 15 && <p>... y {resumenFinal.alertas.length - 15} más (visibles en el Dashboard)</p>}
            </div>
          )}
          {resumenFinal.errores_importacion.length > 0 && (
            <div className="text-xs text-red-400 space-y-0.5">
              <p className="font-bold">Errores durante la importación:</p>
              {resumenFinal.errores_importacion.map((e, i) => <p key={i}>· {e}</p>)}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={reiniciar} className={btnPrimario}>Importar otro Excel</button>
            <a href="/gestor/correbin" className={btnSecundario}>Ir al Dashboard →</a>
          </div>
        </Card>
      )}
    </div>
  );
}
