import {
  ElementoOSM, Prospecto, densificarRuta, procesarElementos,
} from '@/lib/prospeccion';

/**
 * CONSULTA AL MAPA PÚBLICO (Overpass)
 *
 * Aquí solo está la parte de red: trocear el recorrido, pedir, reintentar y
 * juntar. Qué se considera candidato y cómo se puntúa vive en
 * `src/lib/prospeccion.ts`, que se prueba con `npm run test:prospeccion`.
 *
 * Lo comparten el barrido de una zona (que guarda) y la búsqueda suelta.
 */

/**
 * Overpass es gratuito y comunitario, y a veces el principal va cargado. Se
 * prueban por orden: si el primero contesta 429 o 504, se va al siguiente.
 */
const SERVIDORES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const UA = 'GesmecoEnergia-Prospeccion/1.0 (gesmecoenergia.com)';

/** Perímetro mínimo del contorno para traerse un edificio del mapa. */
const PERIMETRO_MINIMO_M = 100;
const MAX_VERTICES = 40;
/** Puntos por consulta. Con más, Overpass devuelve 504. */
const PUNTOS_POR_TRAMO = 3;
/**
 * Longitud máxima de cada salto. Lo que ahoga a Overpass es la LONGITUD del
 * corredor, no el número de puntos: una ruta de Binéfar a Raimat son tres
 * puntos y 45 km, y trocear "de tres en tres" no partía nada.
 */
const KM_MAX_ENTRE_PUNTOS = 5;
/** Tope de tiempo. Al agotarse se devuelve lo reunido, con aviso. */
const MS_PRESUPUESTO = 45000;
const MS_ESPERA_SERVIDOR = 15000;

function consultaOverpass(puntos: { lat: number; lon: number }[], radioM: number): string {
  const a = `around:${Math.round(radioM)},${puntos.map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join(',')}`;
  // No se filtra por etiqueta: en esta zona las naves de las granjas están
  // como `building=yes` a secas, y buscando etiquetas se pierde lo que más
  // interesa. Se filtra por TAMAÑO, con el perímetro del contorno: 100 m deja
  // fuera las viviendas (una casa de 12×10 tiene 44 m) y deja pasar cualquier
  // nave. Sin este filtro, una ruta larga reventaba la consulta.
  //
  // Las balsas no son candidatos: son la pista de que unas naves son una
  // explotación ganadera. Y `residential` marca los cascos urbanos.
  return `[out:json][timeout:90];
(
  way["building"](if: length() > ${PERIMETRO_MINIMO_M})(${a});
  way["landuse"~"^(farmyard|industrial|greenhouse_horticulture|residential)$"](${a});
  way["man_made"~"^(silo|storage_tank|pumping_station|water_well)$"](${a});
  way["water"="basin"](${a});
  way["landuse"="basin"](${a});
);
out tags geom 6000;`;
}

export interface ResultadoBusqueda {
  prospectos: Prospecto[];
  /** Se ha podido con parte, pero no con todo. */
  aviso: string | null;
  /** No se ha podido con nada. */
  error: string | null;
}

/** Busca candidatos en el corredor de un recorrido. No guarda nada. */
export async function buscarProspectos(
  recorrido: { lat: number; lon: number }[],
  radioKm: number
): Promise<ResultadoBusqueda> {
  // Puntos intermedios para que ningún salto sea largo
  const densa = densificarRuta(recorrido, KM_MAX_ENTRE_PUNTOS);
  const paso = Math.max(1, Math.ceil(densa.length / MAX_VERTICES));
  const vertices = densa.filter((_, i) => i % paso === 0);
  const ultimo = densa[densa.length - 1];
  if (vertices[vertices.length - 1] !== ultimo) vertices.push(ultimo);

  // Tramos solapados en un punto, para que no queden huecos entre ellos
  const tramos: { lat: number; lon: number }[][] = [];
  for (let i = 0; i < vertices.length; i += PUNTOS_POR_TRAMO - 1) {
    const trozo = vertices.slice(i, i + PUNTOS_POR_TRAMO);
    if (trozo.length) tramos.push(trozo);
    if (i + PUNTOS_POR_TRAMO >= vertices.length) break;
  }

  const porId = new Map<string, ElementoOSM>();
  // Un servidor que ya ha dicho que está saturado lo seguirá estando dentro de
  // dos segundos: se aparta en vez de esperarle en cada tramo.
  const quemados = new Set<string>();
  let fallidos = 0;
  let ultimoFallo = '';
  const empezado = Date.now();

  for (const tramo of tramos) {
    // Que la función muera sin responder es lo peor que puede pasar: al
    // navegador le llega una conexión cortada y no se sabe ni por qué.
    if (Date.now() - empezado > MS_PRESUPUESTO) { fallidos++; continue; }

    const consulta = consultaOverpass(tramo, radioKm * 1000);
    let hecho = false;
    for (const servidor of SERVIDORES) {
      if (quemados.has(servidor)) continue;
      const queda = MS_PRESUPUESTO - (Date.now() - empezado);
      if (queda < 3000) break;
      try {
        const res = await fetch(servidor, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
          body: `data=${encodeURIComponent(consulta)}`,
          signal: AbortSignal.timeout(Math.min(MS_ESPERA_SERVIDOR, queda)),
        });
        if (res.ok) {
          const els = ((await res.json()) as { elements?: ElementoOSM[] }).elements || [];
          for (const el of els) porId.set(`${el.type}/${el.id}`, el);
          hecho = true;
          break;
        }
        ultimoFallo = String(res.status);
        if (res.status === 429) quemados.add(servidor);
      } catch {
        ultimoFallo = 'sin respuesta';
        quemados.add(servidor);
      }
    }
    if (!hecho) fallidos++;
  }

  if (fallidos === tramos.length) {
    return {
      prospectos: [],
      aviso: null,
      error: `El mapa público no responde ahora mismo (${ultimoFallo}). Vuelve a intentarlo en un par de minutos.`,
    };
  }

  return {
    prospectos: procesarElementos(Array.from(porId.values()), recorrido, radioKm),
    aviso: fallidos > 0
      ? `Falta un trozo de la zona: ${fallidos} de ${tramos.length} tramos no se han podido consultar. Vuelve a barrer en un rato para completarla.`
      : null,
    error: null,
  };
}
