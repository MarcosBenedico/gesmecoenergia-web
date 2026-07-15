'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { Loader, ShieldOff } from 'lucide-react';
import { useUsuario } from '@/lib/usuario';

/**
 * Bloquea el acceso a un módulo si el usuario autenticado no lo tiene asignado.
 * - Login maestro (sin perfil Supabase): acceso completo, como siempre.
 * - Usuario con perfil: solo entra si el módulo está en su lista (o es admin).
 */
export function GuardiaModulo({ modulo, nombre, children }: {
  modulo: string;
  nombre: string;
  children: ReactNode;
}) {
  const { perfil, cargando, veModulo } = useUsuario();

  if (cargando) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-muted text-sm">
        <Loader className="w-5 h-5 animate-spin mr-2" /> Comprobando acceso...
      </div>
    );
  }

  if (perfil && !veModulo(modulo)) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4 rounded-2xl border border-border/40 bg-surface/50 p-8">
          <ShieldOff className="w-10 h-10 mx-auto text-muted" />
          <h2 className="text-lg font-black text-foreground">Sin acceso a {nombre}</h2>
          <p className="text-sm text-muted">
            Tu usuario ({perfil.nombre}) no tiene asignado este módulo.
            Si lo necesitas, pídeselo a un administrador en Usuarios y Permisos.
          </p>
          <Link href="/gestor" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition">
            ← Volver al panel
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/** Solo administradores: bloquea la página a usuarios con rol estándar o lectura. */
export function GuardiaAdmin({ nombre, children }: { nombre: string; children: ReactNode }) {
  const { perfil, cargando, esAdmin } = useUsuario();

  if (cargando) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-muted text-sm">
        <Loader className="w-5 h-5 animate-spin mr-2" /> Comprobando acceso...
      </div>
    );
  }

  if (!esAdmin) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4 rounded-2xl border border-border/40 bg-surface/50 p-8">
          <ShieldOff className="w-10 h-10 mx-auto text-muted" />
          <h2 className="text-lg font-black text-foreground">Solo administradores</h2>
          <p className="text-sm text-muted">
            {nombre} está reservado a administradores. Tu usuario{perfil ? ` (${perfil.nombre})` : ''} tiene rol {perfil?.rol === 'lectura' ? 'de solo lectura' : 'estándar'}.
          </p>
          <Link href="/gestor" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition">
            ← Volver al panel
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
