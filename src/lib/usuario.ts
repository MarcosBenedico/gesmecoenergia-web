'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Usuario de acceso (Supabase Auth) + su perfil de permisos (app_usuarios).
 * Mientras no exista sesión de Supabase (login maestro antiguo), la app
 * funciona como hasta ahora: sin restricciones en la interfaz.
 */

export interface PermisosUsuario {
  ver: boolean;
  crear: boolean;
  modificar: boolean;
  eliminar: boolean;
  exportar: boolean;
  gestionar_usuarios: boolean;
  solo_asignados: boolean;
}

export interface PerfilUsuario {
  id: string;
  email: string;
  nombre: string;
  rol: 'admin' | 'estandar' | 'lectura';
  activo: boolean;
  responsable: string | null;
  permisos: PermisosUsuario;
  modulos: string[];
  creado_en?: string;
  ultimo_acceso?: string | null;
}

export const PERMISOS_POR_ROL: Record<string, PermisosUsuario> = {
  admin: { ver: true, crear: true, modificar: true, eliminar: true, exportar: true, gestionar_usuarios: true, solo_asignados: false },
  estandar: { ver: true, crear: true, modificar: true, eliminar: false, exportar: true, gestionar_usuarios: false, solo_asignados: false },
  lectura: { ver: true, crear: false, modificar: false, eliminar: false, exportar: false, gestionar_usuarios: false, solo_asignados: false },
};

export const MODULOS_APP = [
  ['luz', 'Gestión Luz (cartera energética)'],
  ['correbin', 'Correbin · Seguros'],
  ['app_clientes', 'App Clientes'],
  ['herramientas', 'Herramientas de energía'],
  ['admin', 'Administración (usuarios y permisos)'],
] as const;

/** Token de la sesión Supabase actual (para que la API aplique RLS por usuario). */
export async function tokenSesion(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}

/** Hook: sesión + perfil. Sin sesión Supabase → perfil null (modo compatible). */
export function useUsuario() {
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setPerfil(null); return; }
      const { data } = await supabase.from('app_usuarios').select('*').eq('id', session.user.id).single();
      if (data) {
        setPerfil(data as PerfilUsuario);
        // Registrar último acceso (sin bloquear)
        supabase.from('app_usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', session.user.id).then(() => {});
      } else {
        setPerfil(null);
      }
    } catch {
      setPerfil(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  /** ¿Puede hacer esta acción? Sin perfil (login maestro) → sí, modo compatible. */
  const puede = useCallback((p: keyof PermisosUsuario) => {
    if (!perfil) return true;
    if (!perfil.activo) return false;
    if (perfil.rol === 'admin') return true;
    return !!perfil.permisos?.[p];
  }, [perfil]);

  const veModulo = useCallback((m: string) => {
    if (!perfil) return true;
    if (perfil.rol === 'admin') return true;
    return (perfil.modulos || []).includes(m);
  }, [perfil]);

  return { perfil, cargando, puede, veModulo, esAdmin: !perfil || perfil.rol === 'admin', recargar: cargar };
}
