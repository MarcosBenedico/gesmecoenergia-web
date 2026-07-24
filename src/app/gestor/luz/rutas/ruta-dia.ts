'use client';

/**
 * "Ruta del día": selección de paradas compartida entre Tareas y Rutas.
 * Se guarda en el navegador (es una selección de trabajo, no un dato de negocio:
 * los clientes, tareas y visitas viven en Supabase). Al añadir una tarea a la
 * ruta se guarda también su id para poder marcarla como hecha desde la ruta.
 */

export interface ParadaRutaDia {
  id: string;             // 'c-<cliente_id>' o 's-<cups_id>'
  nombre: string;
  direccion: string;
  cliente_id: string;
  tarea_id?: string;      // si la parada viene de una tarea
  tarea_desc?: string;    // descripción corta de la tarea (para verla en la ruta)
}

const CLAVE = 'luz_ruta_dia';

export function leerRutaDia(): ParadaRutaDia[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CLAVE);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function guardarRutaDia(paradas: ParadaRutaDia[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(CLAVE, JSON.stringify(paradas)); } catch { /* sin espacio */ }
}

/** Añade una parada (sin duplicar por id; si ya está, completa la tarea asociada). */
export function anadirARutaDia(p: ParadaRutaDia): 'añadida' | 'ya_estaba' {
  const lista = leerRutaDia();
  const existente = lista.find((x) => x.id === p.id);
  if (existente) {
    // Mismo cliente ya en ruta: engancha la tarea si no tenía
    if (p.tarea_id && !existente.tarea_id) {
      existente.tarea_id = p.tarea_id;
      existente.tarea_desc = p.tarea_desc;
      guardarRutaDia(lista);
    }
    return 'ya_estaba';
  }
  guardarRutaDia([...lista, p]);
  return 'añadida';
}

export function quitarDeRutaDia(id: string) {
  guardarRutaDia(leerRutaDia().filter((x) => x.id !== id));
}

/** ¿Esta tarea ya está en la ruta del día? */
export function tareaEnRuta(tareaId: string): boolean {
  return leerRutaDia().some((x) => x.tarea_id === tareaId);
}
