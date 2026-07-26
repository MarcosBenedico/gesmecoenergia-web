'use client';

import { useCallback, useEffect, useState } from 'react';
import { tokenSesion } from '@/lib/usuario';

/**
 * Kit UI del módulo Gestión Luz.
 * Reutiliza los componentes visuales del módulo Correbin y define
 * el acceso a datos contra /api/luz.
 */

// Componentes visuales compartidos (mismo estilo del panel)
export {
  Card, Kpi, Badge, BadgeVencimiento, BadgePrioridad, EstadoCarga, SelectorResponsable,
  BotonDescarga, inputCls, labelCls, btnPrimario, btnSecundario, btnTactil, btnTactilPrimario,
} from '../correbin/ui';

/** Carga de un recurso del módulo Luz. */
export function useListaLuz<T>(recurso: string, params: Record<string, string> = {}) {
  const [datos, setDatos] = useState<T[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [faltaMigracion, setFaltaMigracion] = useState(false);
  const claveParams = JSON.stringify(params);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const qs = new URLSearchParams(JSON.parse(claveParams)).toString();
      const token = await tokenSesion();
      const res = await fetch(`/api/luz/${recurso}${qs ? `?${qs}` : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) {
        setFaltaMigracion(!!json.falta_migracion);
        setError(json.error || 'Error cargando datos.');
        setDatos([]);
        return;
      }
      setFaltaMigracion(false);
      setDatos(json.datos || []);
    } catch {
      setError('Error de conexión.');
    } finally {
      setCargando(false);
    }
  }, [recurso, claveParams]);

  useEffect(() => { recargar(); }, [recargar]);
  return { datos, cargando, error, faltaMigracion, recargar };
}

/** Guardado genérico contra /api/luz. Devuelve mensaje de error o null. */
export async function guardarLuz(recurso: string, metodo: 'POST' | 'PUT' | 'DELETE' | 'PATCH', body: Record<string, unknown>) {
  try {
    const token = await tokenSesion();
    const res = await fetch(`/api/luz/${recurso}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return res.ok ? null : (json.error as string) || 'No se pudo guardar.';
  } catch {
    return 'Error de conexión.';
  }
}

/** Envía a la papelera (recuperable). Devuelve el error, o cuántos registros arrastró. */
export async function eliminarLuz(recurso: string, id: string, motivo?: string) {
  try {
    const token = await tokenSesion();
    const res = await fetch(`/api/luz/${recurso}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ id, motivo }),
    });
    const json = await res.json();
    if (!res.ok) return { error: (json.error as string) || 'No se pudo eliminar.', arrastrados: 0 };
    return { error: null, arrastrados: (json.arrastrados as number) || 0 };
  } catch {
    return { error: 'Error de conexión.', arrastrados: 0 };
  }
}
