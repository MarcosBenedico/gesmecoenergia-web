'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginUsuario } from '@/lib/auth';
import { Button } from '@/components/button';
import { Container } from '@/components/container';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await loginUsuario(email, password);
      router.push('/gestor');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20">
      <Container className="max-w-md">
        <div className="card rounded-3xl p-8">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Gestor</h1>
          <p className="mb-6 text-sm text-muted">Acceso para administradores</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 placeholder-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 placeholder-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Iniciando...' : 'Iniciar sesión'}
            </Button>
          </form>
        </div>
      </Container>
    </div>
  );
}
