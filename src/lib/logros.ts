/**
 * Perfil de logros del comercial (Gestión Luz).
 * Todo se calcula a partir de datos REALES ya existentes en Supabase (clientes
 * captados, visitas registradas, ventas cerradas, tareas completadas) — no hay
 * tabla nueva de puntos ni nada que se pueda "hacer trampa": si no está en el
 * CRM, no cuenta. Pensado sobre todo para el perfil comercial (David).
 */

export interface ContadoresComercial {
  clientes: number;    // clientes captados (dados de alta con él de responsable)
  visitas: number;     // visitas registradas
  ventas: number;      // contratos de luz activados
  tareas: number;      // tareas completadas
}

/** Puntos de experiencia por cada acción real. Las ventas son las que más valen: son el resultado final. */
export const XP_POR_CLIENTE = 15;
export const XP_POR_VISITA = 5;
export const XP_POR_VENTA = 80;
export const XP_POR_TAREA = 3;

export function calcularXP(c: ContadoresComercial): number {
  return c.clientes * XP_POR_CLIENTE + c.visitas * XP_POR_VISITA + c.ventas * XP_POR_VENTA + c.tareas * XP_POR_TAREA;
}

/** Umbral de XP para alcanzar cada nivel (índice 0 = nivel 1). Después del nivel 10, +1300 XP por nivel. */
const UMBRALES_NIVEL = [0, 150, 350, 600, 900, 1300, 1800, 2400, 3100, 4000];
const XP_POR_NIVEL_EXTRA = 1300;

export const RANGO_NIVEL: string[] = [
  'Aprendiz de ruta', 'Comercial de campo', 'Cazador de oportunidades', 'Cierra-tratos',
  'Referente de zona', 'Estratega comercial', 'Máquina de captación', 'Comercial de élite',
  'Leyenda de la ruta', 'Leyenda Gesmeco',
];

export interface NivelComercial {
  nivel: number;
  rango: string;
  xp: number;
  xpNivelActual: number;   // XP acumulado desde que empezó este nivel
  xpParaSiguiente: number; // XP que hacen falta para el siguiente nivel
  pctProgreso: number;     // 0-100, progreso dentro del nivel actual
}

function umbralDeNivel(n: number): number {
  if (n <= UMBRALES_NIVEL.length) return UMBRALES_NIVEL[n - 1];
  return UMBRALES_NIVEL[UMBRALES_NIVEL.length - 1] + (n - UMBRALES_NIVEL.length) * XP_POR_NIVEL_EXTRA;
}

export function calcularNivel(xp: number): NivelComercial {
  let nivel = 1;
  while (umbralDeNivel(nivel + 1) <= xp) nivel++;
  const base = umbralDeNivel(nivel);
  const siguiente = umbralDeNivel(nivel + 1);
  const rango = RANGO_NIVEL[Math.min(nivel, RANGO_NIVEL.length) - 1];
  return {
    nivel, rango, xp,
    xpNivelActual: xp - base,
    xpParaSiguiente: siguiente - base,
    pctProgreso: siguiente > base ? Math.min(Math.round(((xp - base) / (siguiente - base)) * 100), 100) : 100,
  };
}

export type RarezaMedalla = 'bronce' | 'plata' | 'oro' | 'platino';
export const RAREZA_COLOR: Record<RarezaMedalla, { text: string; bg: string; border: string; glow: string }> = {
  bronce: { text: 'text-orange-300', bg: 'bg-orange-500/10', border: 'border-orange-500/30', glow: 'shadow-[0_0_18px_rgba(251,146,60,0.25)]' },
  plata: { text: 'text-slate-200', bg: 'bg-slate-400/10', border: 'border-slate-400/30', glow: 'shadow-[0_0_18px_rgba(203,213,225,0.25)]' },
  oro: { text: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/30', glow: 'shadow-[0_0_18px_rgba(251,191,36,0.3)]' },
  platino: { text: 'text-secondary', bg: 'bg-secondary/10', border: 'border-secondary/30', glow: 'shadow-[0_0_20px_rgba(0,212,255,0.3)]' },
};

export interface DefinicionMedalla {
  id: string;
  categoria: 'clientes' | 'visitas' | 'ventas' | 'tareas';
  rareza: RarezaMedalla;
  icono: string;
  nombre: string;
  descripcion: string;
  umbral: number;
}

export const MEDALLAS: DefinicionMedalla[] = [
  { id: 'cli-1', categoria: 'clientes', rareza: 'bronce', icono: '🤝', nombre: 'Primer contacto', descripcion: 'Capta tu primer cliente.', umbral: 1 },
  { id: 'cli-5', categoria: 'clientes', rareza: 'plata', icono: '📇', nombre: 'Ruta caliente', descripcion: 'Capta 5 clientes.', umbral: 5 },
  { id: 'cli-15', categoria: 'clientes', rareza: 'oro', icono: '🗂️', nombre: 'Cartera en marcha', descripcion: 'Capta 15 clientes.', umbral: 15 },
  { id: 'cli-30', categoria: 'clientes', rareza: 'platino', icono: '🏘️', nombre: 'Motor de cartera', descripcion: 'Capta 30 clientes.', umbral: 30 },
  { id: 'cli-60', categoria: 'clientes', rareza: 'platino', icono: '🚀', nombre: 'Máquina de captación', descripcion: 'Capta 60 clientes.', umbral: 60 },

  { id: 'vis-10', categoria: 'visitas', rareza: 'bronce', icono: '🚗', nombre: 'En ruta', descripcion: 'Registra 10 visitas.', umbral: 10 },
  { id: 'vis-30', categoria: 'visitas', rareza: 'plata', icono: '🧭', nombre: 'Conoce el terreno', descripcion: 'Registra 30 visitas.', umbral: 30 },
  { id: 'vis-75', categoria: 'visitas', rareza: 'oro', icono: '🗺️', nombre: 'Kilómetro cero', descripcion: 'Registra 75 visitas.', umbral: 75 },
  { id: 'vis-150', categoria: 'visitas', rareza: 'platino', icono: '🏆', nombre: 'Rey de la ruta', descripcion: 'Registra 150 visitas.', umbral: 150 },

  { id: 'ven-1', categoria: 'ventas', rareza: 'bronce', icono: '✍️', nombre: 'Primera venta', descripcion: 'Cierra tu primer contrato.', umbral: 1 },
  { id: 'ven-5', categoria: 'ventas', rareza: 'plata', icono: '💼', nombre: 'Cerrador constante', descripcion: 'Cierra 5 contratos.', umbral: 5 },
  { id: 'ven-15', categoria: 'ventas', rareza: 'oro', icono: '🎯', nombre: 'Cerrador nato', descripcion: 'Cierra 15 contratos.', umbral: 15 },
  { id: 'ven-30', categoria: 'ventas', rareza: 'platino', icono: '👑', nombre: 'Referente en cierres', descripcion: 'Cierra 30 contratos.', umbral: 30 },

  { id: 'tar-20', categoria: 'tareas', rareza: 'bronce', icono: '✅', nombre: 'Al día', descripcion: 'Completa 20 tareas.', umbral: 20 },
  { id: 'tar-60', categoria: 'tareas', rareza: 'plata', icono: '📋', nombre: 'Metódico', descripcion: 'Completa 60 tareas.', umbral: 60 },
  { id: 'tar-150', categoria: 'tareas', rareza: 'oro', icono: '🧱', nombre: 'Pilar del equipo', descripcion: 'Completa 150 tareas.', umbral: 150 },
];

export interface MedallaEstado extends DefinicionMedalla {
  conseguida: boolean;
  progresoActual: number;
  pctProgreso: number;
}

export function contadorDe(c: ContadoresComercial, categoria: DefinicionMedalla['categoria']): number {
  return categoria === 'clientes' ? c.clientes : categoria === 'visitas' ? c.visitas : categoria === 'ventas' ? c.ventas : c.tareas;
}

export function calcularMedallas(c: ContadoresComercial): MedallaEstado[] {
  return MEDALLAS.map((m) => {
    const actual = contadorDe(c, m.categoria);
    return {
      ...m,
      conseguida: actual >= m.umbral,
      progresoActual: Math.min(actual, m.umbral),
      pctProgreso: Math.min(Math.round((actual / m.umbral) * 100), 100),
    };
  });
}

/** Siguiente medalla a por la que ir en cada categoría (la primera no conseguida). */
export function proximaMedalla(medallas: MedallaEstado[], categoria: DefinicionMedalla['categoria']): MedallaEstado | null {
  return medallas.filter((m) => m.categoria === categoria && !m.conseguida).sort((a, b) => a.umbral - b.umbral)[0] || null;
}
