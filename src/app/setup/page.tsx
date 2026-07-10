'use client';

import { useState } from 'react';

export default function SetupPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSetup = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/setup-database');
      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          message: data.message,
        });
      } else {
        setError(data.message || 'Error al crear la base de datos');
        setResult(data);
      }
    } catch (err) {
      setError('Error de conexión: ' + (err instanceof Error ? err.message : 'Desconocido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-surface flex items-center justify-center p-4">
      <div className="card rounded-2xl p-8 md:p-12 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">⚙️</div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Setup Base de Datos</h1>
          <p className="text-muted text-sm">Configura automáticamente Supabase</p>
        </div>

        {!result && !error && (
          <div className="space-y-6">
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 text-sm text-foreground">
              <p>
                Haz clic en el botón para crear la tabla <code className="text-accent font-mono">proyectos_fotovoltaicos</code> en Supabase automáticamente.
              </p>
            </div>

            <button
              onClick={handleSetup}
              disabled={loading}
              className="w-full py-4 rounded-lg bg-gradient-to-r from-accent to-accent/80 text-white font-bold hover:shadow-glow transition disabled:opacity-50"
            >
              {loading ? '⏳ Creando...' : '🚀 Crear Base de Datos'}
            </button>

            <p className="text-xs text-muted text-center">
              Esto tardará unos segundos. No cierres esta página.
            </p>
          </div>
        )}

        {result?.success && (
          <div className="space-y-6">
            <div className="bg-green-500/20 border border-green-500/40 rounded-lg p-6 text-center">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-foreground font-bold mb-2">{result.message}</p>
              <p className="text-sm text-muted">La tabla está lista para usar</p>
            </div>

            <div className="bg-secondary/10 border border-secondary/30 rounded-lg p-4 space-y-2 text-sm text-foreground">
              <p className="font-bold mb-2">📝 Próximos pasos:</p>
              <ol className="space-y-1 text-muted">
                <li>1. Abre <a href="/gestor" className="text-accent hover:underline">el Panel Gestión</a></li>
                <li>2. Ve a: Generador Fotovoltaico</li>
                <li>3. ¡Comienza a usar!</li>
              </ol>
            </div>

            <a
              href="/gestor"
              className="block w-full py-3 rounded-lg bg-accent text-white font-bold text-center hover:bg-accent/90 transition"
            >
              Ir al Panel Gestión →
            </a>
          </div>
        )}

        {error && (
          <div className="space-y-6">
            <div className="bg-orange/10 border border-orange/30 rounded-lg p-6">
              <div className="text-2xl mb-3 text-center">⚠️</div>
              <p className="text-foreground font-bold mb-3">{error}</p>

              <div className="bg-card/50 rounded-lg p-4 text-sm text-muted space-y-2 mb-4">
                <p className="font-bold text-foreground">Alternativa manual:</p>
                <ol className="space-y-1">
                  <li>• Abre <a href="https://app.supabase.com/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">app.supabase.com</a></li>
                  <li>• SQL Editor → New Query</li>
                  <li>• Copia: <code className="text-accent font-mono">SQL_PARA_PEGAR.sql</code></li>
                  <li>• Pega y ejecuta (RUN)</li>
                </ol>
              </div>

              <button
                onClick={handleSetup}
                disabled={loading}
                className="w-full py-2 rounded-lg bg-accent text-white font-semibold hover:bg-accent/90 transition disabled:opacity-50"
              >
                {loading ? '⏳ Reintentando...' : '🔄 Reintentar'}
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-xs text-muted text-center">
            <a href="/" className="text-accent hover:underline">← Volver a inicio</a>
          </p>
        </div>
      </div>
    </div>
  );
}
