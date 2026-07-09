'use client';

import { useState } from 'react';
import { Download, Upload, Loader, CheckCircle2, AlertCircle, ChevronRight, ChevronLeft, FlaskConical, Trash2 } from 'lucide-react';
import { Card, btnPrimario, btnSecundario, inputCls } from '../ui';

/**
 * Importación / Exportación del módulo Luz.
 * Importación manual Excel con asistente (tipo → archivo → mapeo → previsualización → confirmar → resumen).
 */

const TIPOS_IMPORT = [
  { clave: 'clientes', nombre: 'Clientes energía', desc: 'Titulares con contacto, tipo, prioridad y responsable.' },
  { clave: 'cups', nombre: 'CUPS / suministros', desc: 'La base: genera fechas críticas automáticamente.' },
  { clave: 'pipeline', nombre: 'Pipeline energético', desc: 'Oportunidades vivas con próxima acción.' },
  { clave: 'contratos', nombre: 'Contratos', desc: 'Contratos en trámite o activados.' },
  { clave: 'comisiones', nombre: 'Comisiones', desc: 'Previsto y cobrado por comercializadora.' },
];

const EXPORTS = [
  ['clientes', 'Clientes energía'], ['cups', 'CUPS / suministros'], ['fechas', 'Fechas críticas'],
  ['pipeline', 'Pipeline'], ['contratos', 'Contratos y activaciones'], ['comisiones', 'Comisiones'],
  ['tareas', 'Tareas abiertas'], ['clientes_ab', 'Clientes A/B'], ['cups_incompletos', 'CUPS incompletos'],
  ['contratos_pendientes', 'Contratos pendientes'], ['comisiones_pendientes', 'Comisiones pendientes'],
];

interface Campo { clave: string; nombre: string; obligatorio: boolean }
interface Analisis { cabeceras: string[]; filas: string[][]; total: number; campos: Campo[]; mapeo_sugerido: Record<string, number> }
interface FilaAnotada { estado: string; motivo: string }
interface Resumen { total: number; ok: number; incompletas: number; duplicadas: number; errores: number; importadas?: number; clientes_creados?: number }

const ESTILO: Record<string, string> = {
  ok: 'bg-emerald-500/15 text-emerald-400', incompleta: 'bg-amber-500/15 text-amber-300',
  duplicada: 'bg-blue-500/15 text-blue-300', error: 'bg-red-500/15 text-red-400',
};

export default function ImportarLuzPage() {
  const [paso, setPaso] = useState(1);
  const [tipo, setTipo] = useState('cups');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [mapeo, setMapeo] = useState<Record<string, number>>({});
  const [anotadas, setAnotadas] = useState<FilaAnotada[]>([]);
  const [resumenVal, setResumenVal] = useState<Resumen | null>(null);
  const [final, setFinal] = useState<{ resumen: Resumen; alertas: string[]; errores_importacion: string[] } | null>(null);
  const [msgSeed, setMsgSeed] = useState('');

  async function llamar(body: Record<string, unknown>) {
    const res = await fetch('/api/luz/importar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error');
    return json;
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
      const json = await llamar({ accion: 'analizar', tipo, archivo_base64: base64 });
      setAnalisis(json); setMapeo(json.mapeo_sugerido); setPaso(3);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); } finally { setCargando(false); }
  }

  async function validar() {
    if (!analisis) return;
    setCargando(true); setError('');
    try {
      const json = await llamar({ accion: 'validar', tipo, mapeo, filas: analisis.filas });
      setAnotadas(json.filas_anotadas); setResumenVal(json.resumen); setPaso(4);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); } finally { setCargando(false); }
  }

  async function importar() {
    if (!analisis) return;
    setCargando(true); setError('');
    try {
      const json = await llamar({ accion: 'importar', tipo, mapeo, filas: analisis.filas });
      setFinal(json); setPaso(5);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); } finally { setCargando(false); }
  }

  async function seed(metodo: 'POST' | 'DELETE') {
    if (metodo === 'DELETE' && !confirm('¿Eliminar TODOS los datos de prueba [DEMO] del módulo Luz?')) return;
    setMsgSeed('...');
    const res = await fetch('/api/luz/seed', { method: metodo });
    const json = await res.json();
    setMsgSeed(res.ok ? (json.mensaje || `✓ Eliminados ${json.eliminados}`) : json.error);
  }

  function reiniciar() {
    setPaso(1); setArchivo(null); setAnalisis(null); setMapeo({}); setAnotadas([]); setResumenVal(null); setFinal(null); setError('');
  }

  const tipoDef = TIPOS_IMPORT.find((t) => t.clave === tipo)!;

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h2 className="text-xl font-black text-foreground">Importación / Exportación</h2>
        <p className="text-xs text-muted mt-0.5">Carga manual desde Excel (sin integración automática). Nunca borra datos existentes.</p>
      </div>

      {/* Pasos */}
      <div className="flex items-center gap-1 text-[11px] font-bold flex-wrap">
        {['Tipo', 'Archivo', 'Columnas', 'Previsualizar', 'Resultado'].map((n, i) => (
          <span key={n} className="flex items-center gap-1">
            <span className={`px-2.5 py-1 rounded-full ${paso === i + 1 ? 'bg-accent text-white' : paso > i + 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-card/80 text-muted'}`}>{i + 1}. {n}</span>
            {i < 4 && <ChevronRight className="w-3 h-3 text-muted" />}
          </span>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><p>{error}</p>
        </div>
      )}

      {paso === 1 && (
        <div className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            {TIPOS_IMPORT.map((t) => (
              <button key={t.clave} onClick={() => setTipo(t.clave)}
                className={`text-left p-4 rounded-2xl border transition ${tipo === t.clave ? 'border-accent bg-accent/10' : 'border-border/40 bg-surface/50 hover:border-border'}`}>
                <p className="font-bold text-sm">{t.nombre}</p>
                <p className="text-xs text-muted mt-1">{t.desc}</p>
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <button onClick={() => setPaso(2)} className={btnPrimario}>Continuar con &quot;{tipoDef.nombre}&quot; <ChevronRight className="w-4 h-4" /></button>
            <a href={`/api/luz/importar?tipo=${tipo}`} className={btnSecundario} download><Download className="w-4 h-4" /> Plantilla</a>
          </div>
        </div>
      )}

      {paso === 2 && (
        <Card className="space-y-3">
          <h3 className="font-bold text-sm">Sube el Excel de {tipoDef.nombre}</h3>
          <input type="file" accept=".xlsx,.csv" onChange={(e) => setArchivo(e.target.files?.[0] || null)} className="text-sm" />
          {archivo && <p className="text-xs text-emerald-400">✓ {archivo.name}</p>}
          <div className="flex gap-2">
            <button onClick={() => setPaso(1)} className={btnSecundario}><ChevronLeft className="w-4 h-4" /> Atrás</button>
            <button onClick={analizar} disabled={!archivo || cargando} className={btnPrimario}>
              {cargando ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Leer columnas
            </button>
          </div>
        </Card>
      )}

      {paso === 3 && analisis && (
        <Card className="space-y-3">
          <h3 className="font-bold text-sm">Mapea las columnas ({analisis.total} filas)</h3>
          <div className="grid md:grid-cols-2 gap-2.5">
            {analisis.campos.map((c) => (
              <div key={c.clave} className="flex items-center gap-2">
                <span className={`w-44 shrink-0 text-xs font-semibold ${c.obligatorio ? 'text-foreground' : 'text-muted'}`}>{c.nombre}{c.obligatorio && ' *'}</span>
                <select className={`${inputCls} !py-1.5 !text-xs`} value={mapeo[c.clave] ?? -1}
                  onChange={(e) => setMapeo((m) => ({ ...m, [c.clave]: parseInt(e.target.value) }))}>
                  <option value={-1}>— Sin mapear —</option>
                  {analisis.cabeceras.map((h, i) => <option key={i} value={i}>{h || `(columna ${i + 1})`}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPaso(2)} className={btnSecundario}><ChevronLeft className="w-4 h-4" /> Atrás</button>
            <button onClick={validar} disabled={cargando} className={btnPrimario}>
              {cargando ? <Loader className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />} Validar y previsualizar
            </button>
          </div>
        </Card>
      )}

      {paso === 4 && analisis && resumenVal && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            {[['ok', resumenVal.ok, 'Correctas'], ['incompleta', resumenVal.incompletas, 'Incompletas'], ['duplicada', resumenVal.duplicadas, 'Duplicadas (se saltan)'], ['error', resumenVal.errores, 'Errores (se saltan)']].map(([k, n, nombre]) => (
              <Card key={String(k)} className={`!p-3 text-center ${ESTILO[String(k)]}`}>
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
                  {analisis.campos.filter((c) => (mapeo[c.clave] ?? -1) >= 0).map((c) => <th key={c.clave} className="px-3 py-2">{c.nombre}</th>)}
                  <th className="px-3 py-2">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {analisis.filas.slice(0, 200).map((fila, i) => (
                  <tr key={i} className="border-b border-border/10">
                    <td className="px-3 py-1.5"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ESTILO[anotadas[i]?.estado]}`}>{anotadas[i]?.estado}</span></td>
                    {analisis.campos.filter((c) => (mapeo[c.clave] ?? -1) >= 0).map((c) => (
                      <td key={c.clave} className="px-3 py-1.5 max-w-36 truncate">{fila[mapeo[c.clave]] || ''}</td>
                    ))}
                    <td className="px-3 py-1.5 text-muted max-w-56 truncate">{anotadas[i]?.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="flex gap-2 items-center flex-wrap">
            <button onClick={() => setPaso(3)} className={btnSecundario}><ChevronLeft className="w-4 h-4" /> Cambiar mapeo</button>
            <button onClick={importar} disabled={cargando || resumenVal.ok + resumenVal.incompletas === 0} className={btnPrimario}>
              {cargando ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirmar e importar {resumenVal.ok + resumenVal.incompletas} fila(s)
            </button>
          </div>
        </div>
      )}

      {paso === 5 && final && (
        <Card className="border-emerald-500/30 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold"><CheckCircle2 className="w-5 h-5" /> Importación completada</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div><p className="text-2xl font-black text-emerald-400">{final.resumen.importadas}</p><p className="text-[10px] uppercase font-bold text-muted">Importadas</p></div>
            <div><p className="text-2xl font-black text-secondary">{final.resumen.clientes_creados}</p><p className="text-[10px] uppercase font-bold text-muted">Clientes nuevos</p></div>
            <div><p className="text-2xl font-black text-blue-300">{final.resumen.duplicadas}</p><p className="text-[10px] uppercase font-bold text-muted">Duplicadas saltadas</p></div>
            <div><p className="text-2xl font-black text-red-400">{final.resumen.errores}</p><p className="text-[10px] uppercase font-bold text-muted">Errores</p></div>
          </div>
          {final.alertas.length > 0 && (
            <div className="text-xs text-amber-300 space-y-0.5">
              <p className="font-bold">Alertas generadas:</p>
              {final.alertas.slice(0, 15).map((a, i) => <p key={i}>· {a}</p>)}
            </div>
          )}
          {final.errores_importacion.length > 0 && (
            <div className="text-xs text-red-400 space-y-0.5">
              <p className="font-bold">Errores:</p>
              {final.errores_importacion.map((e, i) => <p key={i}>· {e}</p>)}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={reiniciar} className={btnPrimario}>Importar otro</button>
            <a href="/gestor/luz" className={btnSecundario}>Ir al Dashboard →</a>
          </div>
        </Card>
      )}

      {/* Exportaciones */}
      <Card>
        <h3 className="font-bold text-sm mb-3">Exportaciones Excel</h3>
        <p className="text-[11px] text-muted mb-3">En cada pantalla, el botón &quot;Exportar&quot; respeta los filtros aplicados. Aquí tienes los listados completos:</p>
        <div className="flex gap-2 flex-wrap">
          {EXPORTS.map(([t, n]) => (
            <a key={t} href={`/api/luz/exportar?tipo=${t}`} className={`${btnSecundario} !text-xs`} download>
              <Download className="w-3.5 h-3.5" /> {n}
            </a>
          ))}
        </div>
      </Card>

      {/* Datos de prueba */}
      <Card className="border-dashed">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-bold text-sm">Datos de prueba</h3>
            <p className="text-[11px] text-muted mt-0.5 max-w-lg">
              Carnes Binéfar (industria A, 3 CUPS), Talleres Urgeles (pyme B, permanencia próxima), Comunidad Plaza Mayor
              (contrato pendiente firma), Ayuntamiento (prioridad A) e incidencias: CUPS sin fecha/sin responsable, oportunidad
              sin acción, contrato firmado sin activar y comisión vencida. Marcados [DEMO].
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => seed('POST')} className={btnPrimario}><FlaskConical className="w-4 h-4" /> Crear</button>
            <button onClick={() => seed('DELETE')} className={`${btnSecundario} !text-red-400`}><Trash2 className="w-4 h-4" /> Eliminar [DEMO]</button>
          </div>
        </div>
        {msgSeed && <p className="text-xs mt-3 text-secondary">{msgSeed}</p>}
      </Card>
    </div>
  );
}
