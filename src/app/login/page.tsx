'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginUsuario } from '@/lib/auth-usuarios';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await loginUsuario(username, password);

      if (result.error) {
        setError(result.error);
      } else {
        router.push('/gestor');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center py-12 px-4 sm:py-16 sm:px-6"
      style={{
        paddingTop: 'max(2rem, env(safe-area-inset-top))',
      }}
    >
      <div className="w-full max-w-sm sm:max-w-md">
        <div className="card glass rounded-2xl p-6 sm:p-8 space-y-6 sm:space-y-8">
          {/* Logo y título */}
          <div className="text-center space-y-2 sm:space-y-3">
            <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent leading-tight">
              ⚡ Gesmeco
            </h1>
            <p className="text-sm sm:text-base text-muted">Panel de control</p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Username */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-foreground mb-1.5 sm:mb-2">
                Usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Master"
                required
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg bg-surface border border-border text-foreground placeholder-muted/50 focus:border-accent focus:ring-2 focus:ring-accent/20 transition"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-foreground mb-1.5 sm:mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg bg-surface border border-border text-foreground placeholder-muted/50 focus:border-accent focus:ring-2 focus:ring-accent/20 transition"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-xs sm:text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 sm:py-3 text-sm sm:text-base rounded-lg bg-gradient-to-r from-accent to-accent-light text-white font-bold hover:shadow-glow disabled:opacity-50 transition touch-manipulation"
            >
              {loading ? 'Cargando...' : 'Iniciar sesión'}
            </button>
          </form>

          {/* Info colaborativa */}
          <div className="p-3 sm:p-4 rounded-lg bg-secondary/10 border border-secondary/30">
            <p className="text-xs text-muted text-center leading-relaxed">
              💡 <strong>Modo colaborativo:</strong> Todos ven la misma información
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
