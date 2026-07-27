/**
 * LOS HUECOS DE LA CARTERA — lo que falta para poder trabajar.
 *
 * De cada tres cosas que hace Nicola en el sistema, dos son rellenar un campo
 * vacío. Y lo hace de una en una: abrir la ficha, escribir la distribuidora,
 * guardar, cerrar, siguiente. En la auditoría del 17 de julio se ve el bucle a
 * las 10:11, 10:12 y 10:13, tres CUPS seguidos con el mismo campo.
 *
 * Eso no es un problema de que trabaje despacio: es que el sistema le hace dar
 * cuatro vueltas para escribir una palabra. Esto invierte el orden: en vez de ir
 * cliente por cliente mirando qué le falta, se va CAMPO POR CAMPO y se rellenan
 * todos los que lo tienen vacío de una sentada.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL ORDEN NO ES POR CUÁNTOS FALTAN, ES POR QUÉ BLOQUEA
 *
 * Cuarenta clientes sin email no paran nada. Cinco CUPS sin fecha de fin de
 * contrato paran la Agenda entera, porque el preaviso se calcula desde ahí y sin
 * esa fecha la ventana se pasa sin que nadie se entere.
 *
 * Por eso cada hueco lleva su peso y su porqué escrito: para que se rellene
 * primero lo que desbloquea trabajo, y para que quien lo rellena sepa para qué
 * sirve lo que está escribiendo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type EntidadHueco = 'clientes' | 'cups';
export type TipoCampo = 'texto' | 'numero' | 'fecha' | 'lista' | 'telefono';

export interface DefHueco {
  clave: string;
  entidad: EntidadHueco;
  campo: string;
  etiqueta: string;
  /** Para qué sirve rellenarlo. Se enseña siempre: rellenar a ciegas cansa. */
  porque: string;
  tipo: TipoCampo;
  opciones?: string[];
  /** Cuánto desbloquea. Manda sobre la cantidad al ordenar. */
  peso: number;
}

export interface FilaHueco {
  id: string;
  /** Cómo se reconoce la fila: el nombre del cliente o el CUPS. */
  titulo: string;
  /** Lo que ayuda a saber qué escribir: población, cliente al que pertenece... */
  contexto: string;
}

export interface Hueco extends DefHueco {
  filas: FilaHueco[];
  cuantos: number;
  /** Sobre el total de fichas de esa entidad. */
  pct: number;
}

/**
 * Los campos que de verdad bloquean algo. La lista es corta a propósito: si se
 * mete aquí cada columna de la base de datos, la pantalla vuelve a ser una lista
 * larga donde no se sabe por dónde empezar, que es justo lo que se quiere evitar.
 */
export const DEFINICIONES: DefHueco[] = [
  // ── Suministros ──
  {
    clave: 'cups_fin_contrato', entidad: 'cups', campo: 'fecha_fin_contrato',
    etiqueta: 'Fecha de fin de contrato', tipo: 'fecha', peso: 100,
    porque: 'Es de donde sale el preaviso. Sin ella la Agenda no avisa y la ventana para cambiar se pasa sin que nadie lo vea.',
  },
  {
    clave: 'cups_consumo', entidad: 'cups', campo: 'consumo_anual_kwh',
    etiqueta: 'Consumo anual (kWh)', tipo: 'numero', peso: 90,
    porque: 'Sin consumo no se puede hacer una comparativa. Es lo primero que pide David para ofertar.',
  },
  {
    clave: 'cups_comercializadora', entidad: 'cups', campo: 'comercializadora_actual',
    etiqueta: 'Comercializadora actual', tipo: 'texto', peso: 70,
    porque: 'Sin saber con quién está el cliente no hay nada que comparar.',
  },
  {
    clave: 'cups_tarifa', entidad: 'cups', campo: 'tarifa_acceso',
    etiqueta: 'Tarifa de acceso', tipo: 'lista', peso: 65,
    opciones: ['2.0TD', '3.0TD', '6.1TD', '6.2TD'],
    porque: 'Marca con qué precios se compara. Una tarifa mal puesta da un ahorro que no existe.',
  },
  {
    clave: 'cups_distribuidora', entidad: 'cups', campo: 'distribuidora',
    etiqueta: 'Distribuidora', tipo: 'texto', peso: 55,
    porque: 'Hace falta para pedirle a Datadis la curva y el maxímetro de ese suministro.',
  },
  {
    clave: 'cups_direccion', entidad: 'cups', campo: 'direccion_suministro',
    etiqueta: 'Dirección del suministro', tipo: 'texto', peso: 35,
    porque: 'Sin dirección el suministro no se puede meter en una ruta de David.',
  },

  // ── Clientes ──
  {
    // Va el primero de los de cliente y con el peso más alto de todos: mientras
    // no esté puesto, no se sabe cuántos clientes hay de verdad, y ese es el
    // número del que cuelga todo lo demás.
    clave: 'cli_clasificacion', entidad: 'clientes', campo: 'clasificacion',
    etiqueta: 'Objetivo · Precliente · Cliente', tipo: 'lista', peso: 99,
    opciones: ['objetivo', 'precliente', 'cliente'],
    porque: 'Cliente es el que ha FIRMADO. Precliente nos dio su información pero no ha firmado. Objetivo es una puerta a la que ir. Sin esto no se sabe cuántos clientes hay.',
  },
  {
    clave: 'cli_telefono', entidad: 'clientes', campo: 'telefono',
    etiqueta: 'Teléfono', tipo: 'telefono', peso: 95,
    porque: 'Sin teléfono no se puede llamar, y el lunes de David es un día entero de llamadas.',
  },
  {
    clave: 'cli_nif', entidad: 'clientes', campo: 'nif',
    etiqueta: 'NIF', tipo: 'texto', peso: 80,
    porque: 'Hace falta para contratar y para pedirle la autorización de Datadis.',
  },
  {
    clave: 'cli_responsable', entidad: 'clientes', campo: 'responsable',
    etiqueta: 'Responsable', tipo: 'texto', peso: 60,
    porque: 'Un cliente sin responsable no es de nadie, y no aparece en el día de nadie.',
  },
  {
    clave: 'cli_direccion', entidad: 'clientes', campo: 'direccion_fiscal',
    etiqueta: 'Dirección fiscal', tipo: 'texto', peso: 45,
    porque: 'Sin dirección no se le puede visitar ni mandar nada.',
  },
  {
    clave: 'cli_contacto', entidad: 'clientes', campo: 'persona_contacto',
    etiqueta: 'Persona de contacto', tipo: 'texto', peso: 30,
    porque: 'Preguntar por alguien por su nombre cambia por completo cómo te reciben.',
  },
  {
    clave: 'cli_email', entidad: 'clientes', campo: 'email',
    etiqueta: 'Email', tipo: 'texto', peso: 20,
    porque: 'Para mandarle la oferta sin depender de que conteste al WhatsApp.',
  },
];

// ── Entradas ───────────────────────────────────────────────────────────────

export interface ClienteHueco {
  id: string;
  nombre?: string | null;
  estado_comercial?: string | null;
  [campo: string]: unknown;
}

export interface CupsHueco {
  id: string;
  cups?: string | null;
  cliente_id?: string | null;
  alias_suministro?: string | null;
  estado_cups?: string | null;
  [campo: string]: unknown;
}

/** Un valor que, a efectos de trabajo, es como si no estuviera. */
export function estaVacio(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'number') return !Number.isFinite(v) || v === 0;
  if (Array.isArray(v)) return v.length === 0 || v.every((x) => !x);
  const s = String(v).trim();
  return s === '' || s === '-' || s.toLowerCase() === 'null';
}

/**
 * Fichas que ya no se van a trabajar. Rellenarles campos es tiempo tirado, y
 * además inflan los contadores hasta que la pantalla parece inabarcable.
 */
const CLIENTES_CERRADOS = ['perdido', 'no_viable'];
const CUPS_CERRADOS = ['perdido', 'no_viable'];

export interface FuentesHuecos {
  clientes: ClienteHueco[];
  cups: CupsHueco[];
  /** Para poner al lado de cada CUPS de quién es. */
  nombresCliente?: Record<string, string>;
}

export function detectarHuecos({ clientes, cups, nombresCliente = {} }: FuentesHuecos): Hueco[] {
  const clientesVivos = clientes.filter(
    (c) => !CLIENTES_CERRADOS.includes(String(c.estado_comercial || ''))
  );
  const cupsVivos = cups.filter(
    (s) => !CUPS_CERRADOS.includes(String(s.estado_cups || ''))
  );

  const huecos: Hueco[] = [];

  for (const def of DEFINICIONES) {
    const fuente = def.entidad === 'clientes' ? clientesVivos : cupsVivos;
    const total = fuente.length;
    if (!total) continue;

    const filas: FilaHueco[] = [];
    for (const fila of fuente) {
      if (!estaVacio(fila[def.campo])) continue;
      if (def.entidad === 'clientes') {
        const c = fila as ClienteHueco;
        filas.push({
          id: c.id,
          titulo: String(c.nombre || 'Cliente sin nombre'),
          contexto: String(c.estado_comercial || '').replace(/_/g, ' '),
        });
      } else {
        const s = fila as CupsHueco;
        const dueno = s.cliente_id ? nombresCliente[String(s.cliente_id)] : '';
        filas.push({
          id: s.id,
          titulo: String(s.cups || 'Sin CUPS'),
          contexto: [dueno, s.alias_suministro].filter(Boolean).join(' · '),
        });
      }
    }

    if (!filas.length) continue;
    huecos.push({
      ...def,
      filas,
      cuantos: filas.length,
      pct: Math.round((filas.length / total) * 100),
    });
  }

  // Lo que más desbloquea primero; a igual peso, lo que más filas arrastra.
  return huecos.sort((a, b) => b.peso - a.peso || b.cuantos - a.cuantos);
}

/** Un titular honesto para la cabecera de la pantalla. */
export function resumenHuecos(huecos: Hueco[]): {
  campos: number; celdas: number; masUrgente: Hueco | null;
} {
  return {
    campos: huecos.length,
    celdas: huecos.reduce((s, h) => s + h.cuantos, 0),
    masUrgente: huecos[0] || null,
  };
}

/**
 * Normaliza lo que se escribe antes de guardarlo.
 *
 * Se hace aquí y no en la pantalla para que teclear rápido no genere basura:
 * un teléfono con puntos, un consumo con separador de miles o una fecha en
 * formato español entran igual de bien.
 */
export function normalizarValor(tipo: TipoCampo, bruto: string): string | number | null {
  const s = bruto.trim();
  if (!s) return null;

  if (tipo === 'numero') {
    const n = Number(s.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  if (tipo === 'telefono') {
    const limpio = s.replace(/[^\d+]/g, '');
    return limpio.length >= 6 ? limpio : null;
  }
  if (tipo === 'fecha') {
    // Admite 30/04/2027 y 2027-04-30
    const es = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (es) return `${es[3]}-${es[2].padStart(2, '0')}-${es[1].padStart(2, '0')}`;
    const iso = s.match(/^\d{4}-\d{2}-\d{2}$/);
    return iso ? s : null;
  }
  return s;
}
