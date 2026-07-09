'use client';

import { useState } from 'react';
import { Download, Upload, Loader, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, btnPrimario, btnSecundario } from '../ui';

interface Resultado {
  clientes_creados: number;
  polizas_creadas: number;
  errores: string[];
}

export default function ImportarPage() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState('');

  async function importar() {
    if (!archivo) return;
    setSubiendo(true);
    setError('');
    setResultado(null);
    try {
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve((ev.target?.result as string).split(',')[1]);
        reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
        reader.readAsDataURL(archivo);
      });
      const res = await fetch('/api/correbin/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archivo_base64: base64 }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Error importando.'); return; }
      setResultado(json);
      setArchivo(null);
    } catch {
      setError('Error procesando el archivo.');
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-xl font-black text-foreground">Importación Excel</h2>
        <p className="text-xs text-muted mt-0.5">
          Vuelca la cartera desde Avant/iSegur u otro origen. Cada fila = una póliza; los clientes
          se crean solos y se emparejan por NIF (o por nombre si no hay NIF).
        </p>
      </div>

      <Card>
        <h3 className="font-bold text-sm mb-2">Paso 1 · Descarga la plantilla</h3>
        <p className="text-xs text-muted mb-3">
          Incluye dos filas de ejemplo. Respeta el formato de fechas (DD/MM/AAAA) y no cambies el orden de las columnas.
        </p>
        <a href="/api/correbin/importar" className={btnSecundario} download>
          <Download className="w-4 h-4" />
          Descargar plantilla_cartera_correbin.xlsx
        </a>
      </Card>

      <Card>
        <h3 className="font-bold text-sm mb-2">Paso 2 · Sube el Excel relleno</h3>
        <div className="space-y-3">
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => { setArchivo(e.target.files?.[0] || null); setResultado(null); setError(''); }}
            className="text-sm"
          />
          {archivo && <p className="text-xs text-emerald-400">✓ {archivo.name}</p>}
          <button onClick={importar} disabled={!archivo || subiendo} className={btnPrimario}>
            {subiendo ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {subiendo ? 'Importando...' : 'Importar cartera'}
          </button>
        </div>
      </Card>

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {resultado && (
        <Card className="border-emerald-500/30">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-2">
            <CheckCircle2 className="w-4 h-4" />
            Importación completada
          </div>
          <p className="text-sm text-foreground">
            {resultado.clientes_creados} cliente(s) nuevo(s) · {resultado.polizas_creadas} póliza(s) creada(s)
          </p>
          {resultado.errores.length > 0 && (
            <div className="mt-3 text-xs text-amber-300 space-y-1">
              <p className="font-bold">{resultado.errores.length} fila(s) con problemas:</p>
              {resultado.errores.slice(0, 15).map((e, i) => <p key={i}>· {e}</p>)}
              {resultado.errores.length > 15 && <p>... y {resultado.errores.length - 15} más</p>}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
