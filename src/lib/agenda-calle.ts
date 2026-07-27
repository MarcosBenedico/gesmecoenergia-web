/**
 * LA AGENDA VISTA DESDE LA FURGONETA.
 *
 * La Agenda ordena por urgencia, y para la oficina está bien. Para la calle no,
 * y los números lo dicen: de marzo a julio, los días que David llevaba una ruta
 * preparada hizo 9 visitas de media; los días que salía con una lista, 0,7.
 * Trece veces más. La diferencia no era ganas, era que **una lista no es un
 * plan**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SE AGRUPA POR ZONA, NO POR FECHA
 *
 * Nadie conduce a una fecha. Se conduce a Tamarite, y una vez allí se hace todo
 * lo de Tamarite: lo que vence mañana y lo que vence en tres semanas, porque
 * volver dentro de tres semanas cuesta cuarenta kilómetros.
 *
 * Una agenda por fecha te manda hoy a Tamarite, mañana a Binéfar y pasado otra
 * vez a Tamarite. Una agenda por zona te llena la mañana.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Y cada línea lleva **qué le falta a ese cliente**, porque el peor resultado de
 * una visita no es que digan que no: es plantarse allí y no poder ofertar porque
 * el consumo no estaba metido. Eso ya pasó, y sale en los partes.
 */

import type { LuzCliente, LuzCups } from './luz.ts';
import type { ItemAgenda, UrgenciaAgenda } from './agenda.ts';
import { ORDEN_URGENCIA } from './agenda.ts';
import type { Clasificacion } from './clasificacion.ts';
import { ES_CLASIFICACION } from './clasificacion.ts';

// ── Zona ───────────────────────────────────────────────────────────────────

/**
 * El municipio, sacado de una dirección escrita a mano.
 *
 * En la cartera las direcciones vienen de tres sitios distintos y con tres
 * formatos: del importador («22550 - TAMARITE DE LITERA»), del catastro
 * («Calle MAYOR 14, 22550, Tamarite de Litera, Huesca») y escritas a mano. Lo
 * único fiable que tienen todas es el código postal de cinco cifras, así que se
 * usa como ancla y se coge lo que va justo detrás.
 */
export function municipioDe(...direcciones: (string | null | undefined)[]): string | null {
  for (const dir of direcciones) {
    const s = String(dir || '').trim();
    if (!s) continue;

    // «22550 - TAMARITE DE LITERA» o «22550, Tamarite de Litera, Huesca»
    const m = s.match(/\b(\d{5})\b\s*[-,]?\s*([^,;]+)/);
    if (m) {
      const nombre = m[2].trim().replace(/\s+/g, ' ');
      // Si detrás del CP viene un número de calle, no es un municipio
      if (nombre && !/^\d/.test(nombre) && nombre.length > 2) return bonito(nombre);
    }
  }
  return null;
}

/** TAMARITE DE LITERA → Tamarite de Litera. Se lee mucho mejor en una lista. */
function bonito(s: string): string {
  const menores = ['de', 'del', 'la', 'las', 'los', 'el', 'y', 'i', "d'"];
  return s.toLowerCase().split(' ').map((p, i) =>
    i > 0 && menores.includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)
  ).join(' ');
}

/** Coordenadas metidas dentro de un texto (enlace de Google Maps, por ejemplo). */
export function coordsDe(...textos: (string | null | undefined)[]): { lat: number; lon: number } | null {
  for (const t of textos) {
    const s = String(t || '');
    const m = s.match(/(-?\d{1,2}\.\d{4,})[,\s/]+(-?\d{1,3}\.\d{4,})/);
    if (m) {
      const lat = Number(m[1]); const lon = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
    }
  }
  return null;
}

// ── Lo que le falta ────────────────────────────────────────────────────────

/**
 * Qué le falta a este cliente para poder ofertarle hoy mismo.
 *
 * Va en cada línea porque el peor resultado de una visita no es un no: es
 * llegar y no poder ofertar. Si sale «falta el consumo», David sabe que ahí va
 * a pedir la factura, no a cerrar, y no se lleva el chasco delante del cliente.
 */
export function queLeFalta(cliente: LuzCliente | undefined, cups: LuzCups[]): string[] {
  const falta: string[] = [];
  if (!cliente) return falta;

  if (!cups.length) falta.push('sin suministro');
  else {
    if (cups.some((s) => !s.cups || s.cups.startsWith('PENDIENTE-'))) falta.push('CUPS provisional');
    if (cups.every((s) => !Number(s.consumo_anual_kwh))) falta.push('falta el consumo');
  }
  if (!String(cliente.telefono || '').trim()) falta.push('sin teléfono');
  return falta;
}

// ── El item enriquecido ────────────────────────────────────────────────────

export interface ItemCalle extends ItemAgenda {
  municipio: string | null;
  coords: { lat: number; lon: number } | null;
  clasificacion: Clasificacion;
  telefono: string | null;
  direccion: string | null;
  /** Qué le falta para poder ofertarle. Vacío = se puede ir a cerrar. */
  falta: string[];
  /** Se puede meter en una ruta: sabemos dónde está. */
  ubicable: boolean;
}

export interface FuentesCalle {
  items: ItemAgenda[];
  clientes: LuzCliente[];
  cups: LuzCups[];
}

export function enriquecerParaCalle({ items, clientes, cups }: FuentesCalle): ItemCalle[] {
  const porId = new Map(clientes.map((c) => [c.id, c]));
  const cupsDe = new Map<string, LuzCups[]>();
  for (const s of cups) {
    const l = cupsDe.get(s.cliente_id);
    if (l) l.push(s); else cupsDe.set(s.cliente_id, [s]);
  }

  return items.map((i) => {
    const c = i.clienteId ? porId.get(i.clienteId) : undefined;
    const sus = i.clienteId ? cupsDe.get(i.clienteId) || [] : [];
    const dirSuministro = sus.find((s) => s.direccion_suministro)?.direccion_suministro || null;
    const bruta = (c as { clasificacion?: string } | undefined)?.clasificacion;
    const coords = coordsDe(c?.direccion_fiscal, dirSuministro);

    return {
      ...i,
      municipio: municipioDe(c?.direccion_fiscal, dirSuministro),
      coords,
      clasificacion: ES_CLASIFICACION(bruta) ? bruta : 'precliente',
      telefono: c?.telefono || null,
      direccion: c?.direccion_fiscal || dirSuministro,
      falta: queLeFalta(c, sus),
      // Con coordenadas o con una dirección se puede llegar; sin nada, no.
      ubicable: !!coords || !!(c?.direccion_fiscal || dirSuministro),
    };
  });
}

// ── Zonas ──────────────────────────────────────────────────────────────────

export interface ZonaCalle {
  municipio: string;
  items: ItemCalle[];
  total: number;
  /** Vencidos + para hoy. Es lo que decide a qué zona ir primero. */
  urge: number;
  /** Cuántos se pueden meter en una ruta. */
  ubicables: number;
  /** Cuántos están listos para cerrar (no les falta nada). */
  listos: number;
}

/** El cajón de los que no se sabe dónde están. Va siempre al final. */
export const SIN_ZONA = 'Sin dirección';

const pesoUrgencia = (u: UrgenciaAgenda) => ORDEN_URGENCIA.indexOf(u);

/**
 * Agrupa por municipio y ordena las zonas por lo que urge dentro de cada una.
 *
 * No por número de paradas: veinte cosas tranquilas en Binéfar no valen más que
 * tres vencidas en Esplús. Lo que decide a qué zona ir es qué se está pasando
 * de plazo allí.
 */
export function agruparPorZona(items: ItemCalle[]): ZonaCalle[] {
  const mapa = new Map<string, ItemCalle[]>();
  for (const i of items) {
    const z = i.municipio || SIN_ZONA;
    const l = mapa.get(z);
    if (l) l.push(i); else mapa.set(z, [i]);
  }

  const zonas: ZonaCalle[] = [...mapa.entries()].map(([municipio, lista]) => ({
    municipio,
    items: [...lista].sort(
      (a, b) => pesoUrgencia(a.urgencia) - pesoUrgencia(b.urgencia) || (a.dias ?? 999) - (b.dias ?? 999)
    ),
    total: lista.length,
    urge: lista.filter((i) => i.urgencia === 'vencido' || i.urgencia === 'hoy').length,
    ubicables: lista.filter((i) => i.ubicable).length,
    listos: lista.filter((i) => i.falta.length === 0).length,
  }));

  return zonas.sort((a, b) => {
    if (a.municipio === SIN_ZONA) return 1;
    if (b.municipio === SIN_ZONA) return -1;
    return b.urge - a.urge || b.total - a.total || a.municipio.localeCompare(b.municipio);
  });
}

// ── Enlaces de acción ──────────────────────────────────────────────────────

/** Número en formato marcable. Devuelve null si no hay nada usable. */
export function telefonoMarcable(t: string | null | undefined): string | null {
  const s = String(t || '').replace(/[^\d+]/g, '');
  return s.length >= 6 ? s : null;
}

/** Enlace de WhatsApp con el prefijo de España si no lo trae. */
export function enlaceWhatsApp(t: string | null | undefined, texto?: string): string | null {
  const n = telefonoMarcable(t);
  if (!n) return null;
  const conPrefijo = n.startsWith('+') ? n.slice(1) : (n.length === 9 ? `34${n}` : n);
  return `https://wa.me/${conPrefijo}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
}

/** Enlace de mapas: por coordenadas si las hay, y si no por dirección. */
export function enlaceMapa(i: Pick<ItemCalle, 'coords' | 'direccion'>): string | null {
  if (i.coords) return `https://www.google.com/maps/search/?api=1&query=${i.coords.lat},${i.coords.lon}`;
  if (i.direccion) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(i.direccion)}`;
  return null;
}

/**
 * Ruta de Google Maps con las paradas elegidas, saliendo de la oficina.
 *
 * Es lo que cierra el círculo: David elige en la lista, le da a un botón y sale
 * con la ruta puesta en el móvil. Es exactamente lo que Marcos le mandaba a mano
 * los ocho días que rindió nueve visitas.
 */
export const OFICINA = 'Av. de Aragon, 50, 22500 Binéfar, Huesca';

export function enlaceRuta(items: ItemCalle[], origen = OFICINA): string | null {
  const paradas = items
    .map((i) => (i.coords ? `${i.coords.lat},${i.coords.lon}` : i.direccion))
    .filter(Boolean) as string[];
  if (!paradas.length) return null;

  // Google admite origen + destino + hasta 9 intermedias
  const usables = paradas.slice(0, 10);
  const destino = usables[usables.length - 1];
  const medias = usables.slice(0, -1);
  const q = new URLSearchParams({ api: '1', origin: origen, destination: destino });
  if (medias.length) q.set('waypoints', medias.join('|'));
  return `https://www.google.com/maps/dir/?${q}`;
}

/** Cuántas paradas caben de verdad en un enlace de ruta. */
export const MAX_PARADAS_RUTA = 10;
