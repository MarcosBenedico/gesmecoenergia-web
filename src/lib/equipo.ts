'use client';

/**
 * QUIÉN ES EL EQUIPO — LEÍDO, NUNCA ESCRITO EN EL CÓDIGO.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUÉ EXISTE ESTE ARCHIVO
 *
 * Había `'David'` escrito a mano en siete sitios como responsable por defecto:
 * al resolver una visita, al pasar un objetivo del mapa al sistema, al montar
 * una ruta. Y `['Nicola', 'David', 'Marcos']` como lista fija en la Bandeja.
 *
 * Eso no es un detalle de estilo, es una trampa con dos filos:
 *
 *   · SE LE CREA TRABAJO A ALGUIEN QUE PUEDE NO ESTAR. Si una persona deja el
 *     puesto, el código sigue asignándole tareas y esas tareas no las hace
 *     nadie: la lista se llena de cosas que parecen repartidas y no lo están,
 *     y una lista así se deja de mirar. Es exactamente lo que la
 *     especificación pide evitar — «no diseñar tareas administrativas que
 *     dependan de una persona concreta», «nunca nombres personales escritos
 *     en lógica».
 *   · ENTRA ALGUIEN NUEVO Y NO APARECE POR NINGÚN LADO. Se le da de alta en
 *     Usuarios, se le asigna su nombre de responsable… y los desplegables
 *     siguen enseñando a los tres de siempre.
 *
 * El histórico NO se toca: quien firmó una visita en marzo sigue figurando.
 * Lo que cambia es a quién se le asigna trabajo NUEVO.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LA FUNCIÓN NO ES EL PERMISO
 *
 * `rol` en `app_usuarios` es admin/estándar/lectura: dice qué puede TOCAR. La
 * FUNCIÓN dice qué TRABAJO le toca —calle, oficina, dirección— y son dos ejes
 * distintos: Marcos es admin y hace dirección, y un comercial nuevo sería
 * estándar y de calle. Mezclarlos haría que dar permisos cambiara el reparto
 * del trabajo, que es de los errores que solo se descubren tarde.
 *
 * La función sale del propio perfil (`funcion` en `app_usuarios`) y, si esa
 * columna todavía no está, se deduce del rol y se dice que es una suposición.
 */

import { useEffect, useState } from 'react';
import { supabase } from './supabase.ts';

/** Qué clase de trabajo hace una persona. No es su nivel de permisos. */
export type FuncionEquipo = 'calle' | 'oficina' | 'direccion';

export const FUNCION_LABEL: Record<FuncionEquipo, string> = {
  calle: 'Calle (visitas y rutas)',
  oficina: 'Oficina (datos y tramitación)',
  direccion: 'Dirección',
};

export interface MiembroEquipo {
  id: string;
  nombre: string;
  /** El nombre con el que firma las tareas. Puede no coincidir con `nombre`. */
  responsable: string;
  funcion: FuncionEquipo;
  activo: boolean;
  /** La función no venía del perfil: se ha deducido del rol. */
  funcionSupuesta: boolean;
}

interface FilaUsuario {
  id: string;
  nombre?: string | null;
  email?: string | null;
  rol?: string | null;
  activo?: boolean | null;
  responsable?: string | null;
  funcion?: string | null;
}

const FUNCIONES: FuncionEquipo[] = ['calle', 'oficina', 'direccion'];

/**
 * Convierte una fila de `app_usuarios` en un miembro del equipo.
 *
 * Sin `funcion` guardada se supone por el rol, que es lo único que hay. Es una
 * suposición y va marcada como tal: un reparto de trabajo basado en un permiso
 * acierta a veces, y lo que no puede es presentarse como si fuera un dato.
 */
export function aMiembro(u: FilaUsuario): MiembroEquipo | null {
  const responsable = (u.responsable || u.nombre || '').trim();
  if (!responsable) return null;
  const guardada = FUNCIONES.includes(u.funcion as FuncionEquipo) ? (u.funcion as FuncionEquipo) : null;
  return {
    id: u.id,
    nombre: (u.nombre || u.email || responsable).trim(),
    responsable,
    funcion: guardada || (u.rol === 'admin' ? 'direccion' : 'oficina'),
    activo: u.activo !== false,
    funcionSupuesta: !guardada,
  };
}

/**
 * A quién se le asigna un trabajo nuevo de esta clase.
 *
 * DEVUELVE NULL SI NO HAY NADIE, y eso es a propósito: una tarea sin
 * responsable sale en Control de cartera como excepción y alguien la reparte.
 * Asignársela a un nombre escrito en el código la haría desaparecer del radar
 * — parecería repartida sin estarlo, que es peor que no tener responsable.
 */
export function responsableDe(
  equipo: MiembroEquipo[],
  funcion: FuncionEquipo,
  preferido?: string | null,
): string | null {
  // Quien está haciendo la acción manda: si David registra una visita, es suya.
  if (preferido?.trim()) return preferido.trim();
  const activos = equipo.filter((m) => m.activo);
  return activos.find((m) => m.funcion === funcion)?.responsable
    // Si no hay nadie de esa función, antes que nada cualquiera activo: el
    // trabajo existe igual y hay que poder verlo en la lista de alguien.
    || activos[0]?.responsable
    || null;
}

/** Los nombres de responsable a los que se puede asignar algo hoy. */
export const responsablesActivos = (equipo: MiembroEquipo[]): string[] =>
  [...new Set(equipo.filter((m) => m.activo).map((m) => m.responsable))];

/**
 * El equipo, leído de `app_usuarios`.
 *
 * `cargando` se distingue de «no hay nadie»: si la consulta falla y se pinta
 * una lista vacía, el desplegable de responsables aparece sin opciones y
 * parece que la empresa no tiene empleados. Ver `error`.
 */
export function useEquipo() {
  const [equipo, setEquipo] = useState<MiembroEquipo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data, error: e } = await supabase
        .from('app_usuarios')
        .select('id, nombre, email, rol, activo, responsable, funcion')
        .order('nombre');
      if (!vivo) return;
      if (e) {
        // La columna `funcion` puede no existir todavía: se reintenta sin ella
        // antes de dar el equipo por perdido.
        const { data: d2, error: e2 } = await supabase
          .from('app_usuarios')
          .select('id, nombre, email, rol, activo, responsable')
          .order('nombre');
        if (!vivo) return;
        if (e2) { setError(e2.message); setCargando(false); return; }
        setEquipo(((d2 || []) as FilaUsuario[]).map(aMiembro).filter((m): m is MiembroEquipo => !!m));
        setCargando(false);
        return;
      }
      setEquipo(((data || []) as FilaUsuario[]).map(aMiembro).filter((m): m is MiembroEquipo => !!m));
      setCargando(false);
    })();
    return () => { vivo = false; };
  }, []);

  return { equipo, cargando, error };
}
