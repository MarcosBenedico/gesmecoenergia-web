'use client';

import { useCallback, useEffect, useState } from 'react';
import { tokenSesion, esSesionCaducada } from '@/lib/usuario';
import { supabase } from '@/lib/supabase';

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
      const url = `/api/luz/${recurso}${qs ? `?${qs}` : ''}`;
      const pedir = async () => {
        const token = await tokenSesion();
        const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        return { r, json: await r.json() };
      };

      let { r: res, json } = await pedir();

      // Si el token caducó justo en el envío, se renueva y se reintenta una vez
      // antes de dar error: el usuario no tiene por qué enterarse de esto.
      if (!res.ok && esSesionCaducada(json?.error)) {
        const { error: eRenovar } = await supabase.auth.refreshSession();
        if (!eRenovar) ({ r: res, json } = await pedir());
      }

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
    const enviar = async () => {
      const token = await tokenSesion();
      const r = await fetch(`/api/luz/${recurso}`, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      return { r, json: await r.json() };
    };

    let { r: res, json } = await enviar();

    // Un cambio no se puede perder porque el token acabara de caducar:
    // se renueva la sesión y se vuelve a enviar una vez.
    if (!res.ok && esSesionCaducada(json?.error)) {
      const { error: eRenovar } = await supabase.auth.refreshSession();
      if (!eRenovar) ({ r: res, json } = await enviar());
    }

    if (res.ok) return null;
    return esSesionCaducada(json?.error)
      ? 'Tu sesión ha caducado. Vuelve a entrar y repite el cambio.'
      : (json.error as string) || 'No se pudo guardar.';
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
