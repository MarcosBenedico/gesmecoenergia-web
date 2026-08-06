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
import { zonaMasCercana } from './zonas.ts';

// ── Zona ───────────────────────────────────────────────────────────────────

/**
 * El municipio, sacado de una dirección escrita a mano.
 *
 * En la cartera las direcciones vienen de cuatro sitios distintos y con cuatro
 * formatos: del importador («22550 - TAMARITE DE LITERA»), del catastro
 * («Calle MAYOR 14, 22550, Tamarite de Litera, Huesca»), de la comercializadora
 * («SAN ESTEBAN 23 | Binefar | 22500») y escritas a mano. Lo único fiable que
 * tienen todas es el código postal de cinco cifras, así que se usa como ancla.
 *
 * Tres cosas que costaron 31 clientes cayendo en «sin zona» aun teniendo la
 * dirección completa:
 *
 *   · El municipio va **detrás** del CP en unos formatos y **delante** en otros.
 *     Mirar solo detrás dejaba fuera todo lo que viene de la comercializadora,
 *     que es de donde salen la mayoría de las altas.
 *   · Hay que probar **todos** los grupos de cinco cifras, no el primero. En
 *     «AVENIDA SAN VICENTE DE PAUL 00043 03 A, 22550 TAMARITE» el primero es el
 *     número de portal rellenado con ceros, y al fallar ahí ya no se miraba el
 *     CP de verdad que venía después.
 *   · Provincia no es municipio: «22550, Tamarite, Huesca» tiene que dar
 *     Tamarite, y «… | 22500 | Huesca» no puede dar Huesca.
 */
export function municipioDe(...direcciones: (string | null | undefined)[]): string | null {
  for (const dir of direcciones) {
    const s = String(dir || '').trim().replace(/\s+/g, ' ');
    if (!s) continue;

    for (const m of s.matchAll(/\b\d{5}\b/g)) {
      const i = m.index ?? 0;
      // Detrás del CP: «22550 - TAMARITE DE LITERA», «22550, Tamarite, Huesca»
      const detras = trozo(s.slice(i + 5).replace(/^\s*[-,|]?\s*/, ''));
      if (esMunicipio(detras)) return canonico(detras);
      // Delante del CP: «SAN ESTEBAN 23 | Binefar | 22500»
      const delante = trozo(s.slice(0, i).replace(/\s*[-,|]?\s*$/, ''), true);
      if (esMunicipio(delante)) return canonico(delante);
    }
  }
  return null;
}

/** El primer (o último) campo separado por coma, punto y coma o barra. */
function trozo(s: string, ultimo = false): string {
  const partes = s.split(/[,;|]/).map(p => p.trim()).filter(Boolean);
  return (ultimo ? partes[partes.length - 1] : partes[0]) || '';
}

/** Provincias que se cuelan pegadas al CP y no son el municipio que buscamos. */
const PROVINCIAS = ['huesca', 'lleida', 'lerida', 'zaragoza', 'barcelona', 'teruel', 'espana', 'españa'];

function esMunicipio(nombre: string): boolean {
  if (!nombre || nombre.length < 3) return false;
  // Un número de calle detrás del CP no es un municipio
  if (/^\d/.test(nombre)) return false;
  // «CALLE MAYOR 14» delante del CP tampoco: los municipios no llevan número
  if (/\d/.test(nombre)) return false;
  const limpio = nombre.toLowerCase().replace(/\(.*\)/, '').trim();
  if (PROVINCIAS.includes(limpio)) return false;
  // Tipos de vía: si empieza por uno, es una calle y no un pueblo
  return !/^(c\/|cl |calle |av |avda|avenida|pl |plaza|cr |ctra|carretera|pg |poligono|polígono|pd |partida|urb|camino|cm )/i.test(nombre);
}

/**
 * El mismo pueblo escrito de dos maneras es DOS zonas en la pantalla, y eso
 * rompe justo lo que la vista por zona existe para arreglar: en la cartera hay
 * «Binefar» y «Binéfar», «Tamarite» y «Tamarite de Litera», «Esplus» y
 * «Esplús». Salían dos cajas del mismo sitio, y quien montaba la ruta abría una
 * y se dejaba la otra.
 *
 * Se resuelve contra los pueblos de `zonas.ts`, que ya están normalizados sin
 * acentos: el nombre canónico es el primero que se reconoce.
 */
const CANONICOS: Record<string, string> = {
  binefar: 'Binéfar',
  tamarite: 'Tamarite de Litera',
  'tamarite de litera': 'Tamarite de Litera',
  altorricon: 'Altorricón',
  esplus: 'Esplús',
  monzon: 'Monzón',
  vencillon: 'Vencillón',
  almacelles: 'Almacelles',
  almacellas: 'Almacelles',
  fraga: 'Fraga',
  alcampell: 'Alcampell',
  albelda: 'Albelda',
  castillonroy: 'Castillonroy',
  binaced: 'Binaced',
  'san esteban de litera': 'San Esteban de Litera',
  'albalate de cinca': 'Albalate de Cinca',
  'belver de cinca': 'Belver de Cinca',
  'osso de cinca': 'Osso de Cinca',
  'pomar de cinca': 'Pomar de Cinca',
  zaidin: 'Zaidín',
  alcarras: 'Alcarràs',
  lleida: 'Lleida',
  lerida: 'Lleida',
  barcelona: 'Barcelona',
  mataro: 'Mataró',
};

/** Un mismo pueblo, un solo nombre. Lo que no esté en la lista se deja como venga. */
export function canonico(municipio: string): string {
  const clave = municipio
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\(.*\)/, '').replace(/\s+/g, ' ').trim();
  return CANONICOS[clave] || bonito(municipio);
}

/** TAMARITE DE LITERA → Tamarite de Litera. Se lee mucho mejor en una lista. */
function bonito(s: string): string {
  const menores = ['de', 'del', 'la', 'las', 'los', 'el', 'y', 'i', "d'"];
  return s.toLowerCase().split(' ').map((p, i) =>
    i > 0 && menores.includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)
  ).join(' ');
}

/** Coordenadas metidas dentro de un texto (enlace de Google Maps, por ejemplo). */
const ES_ENLACE = /^https?:\/\//i;

/**
 * Las coordenadas que haya escritas en cualquiera de estos textos.
 *
 * Se admiten los dos formatos que salen de Google Maps al copiar un sitio:
 *
 *   · decimales     41.7946587, 0.5816007   (el `@lat,lon` de la URL, o `?q=`)
 *   · grados/min/s  41°47'40.8"N 0°34'53.8"E   (la parte `/place/` de la URL,
 *     que además viene codificada: `41%C2%B047'40.8%22N+0%C2%B034'53.8%22E`)
 *
 * El segundo formato no se leía y por eso había sitios con la ubicación puesta
 * que salían como «sin ubicación».
 */
export function coordsDe(...textos: (string | null | undefined)[]): { lat: number; lon: number } | null {
  for (const t of textos) {
    const s = decodificar(String(t || ''));

    // 1) Decimales. Dentro de una URL se exigen 4 decimales para no confundirse
    //    con la altura de cámara (`662m`, `z=17`), que también es un número con
    //    punto. En un texto escrito a mano no hay ese ruido, así que bastan 2:
    //    quien teclea «41.79, 0.58» está poniendo una ubicación, no otra cosa.
    const minDec = ES_ENLACE.test(s.trim()) ? 4 : 2;
    const dec = s.match(new RegExp(`(-?\\d{1,2}\\.\\d{${minDec},})[,\\s/]+(-?\\d{1,3}\\.\\d{${minDec},})`));
    if (dec) {
      const c = valida(Number(dec[1]), Number(dec[2]));
      if (c) return c;
    }

    // 2) Grados, minutos y segundos con su letra de hemisferio.
    const dms = s.match(
      /(\d{1,3})°\s*(\d{1,2})'\s*([\d.]+)"?\s*([NS])[\s,+]*(\d{1,3})°\s*(\d{1,2})'\s*([\d.]+)"?\s*([EWO])/i
    );
    if (dms) {
      const lat = aDecimal(dms[1], dms[2], dms[3], dms[4]);
      const lon = aDecimal(dms[5], dms[6], dms[7], dms[8]);
      const c = valida(lat, lon);
      if (c) return c;
    }
  }
  return null;
}

/** Los enlaces traen los símbolos codificados: ° es %C2%B0 y " es %22. */
function decodificar(s: string): string {
  let t = s;
  try { t = decodeURIComponent(s); } catch { /* si no es válido, se usa tal cual */ }
  return t.replace(/%C2%B0/gi, '°').replace(/%22/g, '"').replace(/%27/g, "'");
}

function aDecimal(g: string, m: string, seg: string, hemi: string): number {
  const v = Number(g) + Number(m) / 60 + Number(seg) / 3600;
  // O de «Oeste» en español, W de «West» en inglés: las dos restan.
  return /[SWO]/i.test(hemi) ? -v : v;
}

function valida(lat: number, lon: number): { lat: number; lon: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  if (lat === 0 && lon === 0) return null;   // el 0,0 está en el Atlántico
  return { lat, lon };
}

/**
 * Qué se puede hacer con la ubicación que tiene guardada un cliente.
 *
 * Hay tres cosas distintas y antes se trataban como una sola, que es lo que
 * rompía las rutas:
 *
 *   coords  · lo mejor. Sirve para la ruta y para el mapa.
 *   texto   · una dirección postal. Google la entiende como parada.
 *   enlace  · un enlace corto de Google (`maps.app.goo.gl/...`). Se puede
 *             ABRIR, pero NO vale como parada: metido en la URL de una ruta,
 *             Google no lo entiende y rompe la ruta entera, no solo esa parada.
 */
export type Ubicacion =
  | { tipo: 'coords'; lat: number; lon: number; texto: string }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'enlace'; url: string }
  | null;

export function ubicacionDe(...textos: (string | null | undefined)[]): Ubicacion {
  const c = coordsDe(...textos);
  if (c) return { ...c, tipo: 'coords', texto: `${c.lat},${c.lon}` };

  for (const t of textos) {
    const s = String(t || '').trim();
    if (!s) continue;
    if (ES_ENLACE.test(s)) {
      // Un enlace de Google con nombre de sitio sí lleva algo aprovechable:
      // /place/Avicola+Gimenells+S.L/ → «Avicola Gimenells S.L».
      const sitio = s.match(/\/place\/([^/@]+)/);
      const nombre = sitio ? decodificar(sitio[1]).replace(/\+/g, ' ').trim() : '';
      if (nombre && !/^\d/.test(nombre)) return { tipo: 'texto', texto: nombre };
      return { tipo: 'enlace', url: s };
    }
    return { tipo: 'texto', texto: s };
  }
  return null;
}

/** Lo que se puede meter como parada en una ruta. Un enlace NO vale. */
export function paradaDe(u: Ubicacion): string | null {
  if (!u) return null;
  if (u.tipo === 'enlace') return null;
  return u.texto;
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
  /** Qué se puede hacer con su ubicación: coordenadas, texto o solo un enlace. */
  ubicacion: Ubicacion;
  /** Se puede meter en una RUTA. Un enlace corto de Google no cuenta. */
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
    // El suministro va PRIMERO: es donde está la instalación. El domicilio
    // fiscal de una granja suele ser el piso del dueño en el pueblo, y con eso
    // David acababa llamando a un portal en vez de yendo a la nave.
    const ubicacion = ubicacionDe(dirSuministro, c?.direccion_fiscal);
    const coords = ubicacion?.tipo === 'coords' ? { lat: ubicacion.lat, lon: ubicacion.lon } : null;

    // El suministro también va primero para la zona, por lo mismo: el fiscal
    // suele ser el piso del dueño y puede estar en otro pueblo que la nave.
    // Si la dirección no da municipio pero SÍ hay coordenadas, la zona sale del
    // mapa: 80 clientes con la ubicación puesta caían en «sin dirección» y no
    // aparecían al montar la ruta, que es exactamente lo contrario de lo que
    // pasa cuando alguien se molesta en pegar el punto de Google Maps.
    const municipio =
      municipioDe(dirSuministro, c?.direccion_fiscal) ||
      (coords ? zonaMasCercana(coords.lat, coords.lon).cabecera : null);

    return {
      ...i,
      municipio,
      coords,
      clasificacion: ES_CLASIFICACION(bruta) ? bruta : 'precliente',
      telefono: c?.telefono || null,
      direccion: c?.direccion_fiscal || dirSuministro,
      falta: queLeFalta(c, sus),
      ubicacion,
      // Ubicable = se puede meter en una ruta. Un enlace corto de Google se
      // puede abrir pero NO vale como parada: rompería la ruta entera.
      ubicable: !!paradaDe(ubicacion),
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
export function enlaceMapa(i: Pick<ItemCalle, 'ubicacion'>): string | null {
  const u = i.ubicacion;
  if (!u) return null;
  // Un enlace corto no se puede convertir en búsqueda, pero sí abrirse tal cual:
  // es exactamente lo que alguien pegó ahí para poder llegar.
  if (u.tipo === 'enlace') return u.url;
  // Las coordenadas van sin codificar la coma: Google entiende las dos formas,
  // pero así el enlace se puede leer de un vistazo si hay que depurarlo.
  const q = u.tipo === 'coords' ? u.texto : encodeURIComponent(u.texto);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
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
  // paradaDe() deja fuera los enlaces: uno solo metido en `waypoints` hace que
  // Google descarte la ruta entera, no solo esa parada.
  const paradas = items.map((i) => paradaDe(i.ubicacion)).filter(Boolean) as string[];
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
