'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginUsuario, registroUsuario } from '@/lib/auth-usuarios';
import { Container } from '@/components/container';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    nombre: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result;

      if (isLogin) {
        result = await loginUsuario(formData.username, formData.password);
      } else {
        result = await registroUsuario(
          formData.username,
          formData.password,
          formData.email,
          formData.nombre
        );
      }

      if (result.error) {
        setError(result.error);
      } else {
        // Redirigir al panel gestor
        router.push('/gestor');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center py-8 px-4 sm:py-12 sm:px-6">
      <div className="w-full max-w-sm sm:max-w-md">
        <div className="card glass rounded-2xl p-6 sm:p-8 space-y-6 sm:space-y-8">
          {/* Logo y título */}
          <div className="text-center space-y-2 sm:space-y-3">
            <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent leading-tight">
              ⚡ Gesmeco
            </h1>
            <p className="text-sm sm:text-base text-muted">
              {isLogin ? 'Inicia sesión' : 'Crea tu cuenta'}
            </p>
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
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="tu_usuario"
                required
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg bg-surface border border-border text-foreground placeholder-muted/50 focus:border-accent focus:ring-2 focus:ring-accent/20 transition"
              />
            </div>

            {/* Email (solo registro) */}
            {!isLogin && (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-foreground mb-1.5 sm:mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="tu@email.com"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg bg-surface border border-border text-foreground placeholder-muted/50 focus:border-accent focus:ring-2 focus:ring-accent/20 transition"
                />
              </div>
            )}

            {/* Nombre (solo registro) */}
            {!isLogin && (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-foreground mb-1.5 sm:mb-2">
                  Nombre
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  placeholder="Tu nombre"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg bg-surface border border-border text-foreground placeholder-muted/50 focus:border-accent focus:ring-2 focus:ring-accent/20 transition"
                />
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-foreground mb-1.5 sm:mb-2">
                Contraseña
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
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
              {loading ? 'Cargando...' : isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>
          </form>

          {/* Toggle Login/Registro */}
          <div className="text-center">
            <p className="text-xs sm:text-sm text-muted">
              {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setFormData({ username: '', password: '', email: '', nombre: '' });
                }}
                className="text-accent font-semibold hover:text-accent-light transition"
              >
                {isLogin ? 'Regístrate' : 'Inicia sesión'}
              </button>
            </p>
          </div>

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
