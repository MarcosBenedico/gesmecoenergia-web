/**
 * OBJETIVO · PRECLIENTE · CLIENTE — de qué tipo es cada ficha.
 *
 * Es la distinción que faltaba y la que más se nota al hablar del negocio:
 *
 *   · OBJETIVO   — está en el mapa o tiene ficha, pero no tenemos nada suyo.
 *                  Sirve para que cuando David esté en una zona sepa a qué
 *                  puerta puede llamar.
 *   · PRECLIENTE — nos ha dado su información (la factura, el CUPS, el
 *                  consumo) pero NO ha firmado nada. No es cliente.
 *   · CLIENTE    — ha firmado luz o placas.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ES UN CAMPO Y NO UN CÁLCULO
 *
 * En este panel casi todo se deriva: el estado del cliente sale de sus CUPS, los
 * vencimientos salen del contrato. Aquí no, y por un motivo concreto: hoy los
 * contratos se llevan en papel y en las aplicaciones de las comercializadoras,
 * así que en el sistema hay clientes de verdad sin un solo contrato registrado.
 * Un cálculo diría que son preclientes y estaría equivocado.
 *
 * Así que manda lo que diga una persona. Pero el cálculo no se tira: se guarda
 * como SUGERENCIA, y cuando no cuadra con lo marcado se avisa. El día que los
 * contratos entren en el sistema, esa discrepancia se apagará sola.
 *
 * OJO CON NO CONFUNDIRLO con `estado_comercial` (estados-luz.ts): ese es el
 * peldaño del viaje —detectado, en análisis, activo...—, un eje distinto. Uno
 * dice POR DÓNDE VA y el otro QUÉ TIPO DE RELACIÓN ES.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type Clasificacion = 'objetivo' | 'precliente' | 'cliente';

export interface DefClasificacion {
  clave: Clasificacion;
  titulo: string;
  /** Qué es, en una frase que se pueda leer en voz alta. */
  quees: string;
  emoji: string;
  /** Clases de Tailwind para la pastilla. */
  tono: string;
}

export const CLASIFICACIONES: DefClasificacion[] = [
  {
    clave: 'objetivo', titulo: 'Objetivo', emoji: '🎯',
    quees: 'Sitio al que se puede ir. No tenemos nada suyo todavía.',
    tono: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  },
  {
    clave: 'precliente', titulo: 'Precliente', emoji: '📄',
    quees: 'Nos ha dado su información pero no ha firmado nada. Todavía no es cliente.',
    tono: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  {
    clave: 'cliente', titulo: 'Cliente', emoji: '🤝',
    quees: 'Ha firmado luz o placas.',
    tono: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
];

export const ES_CLASIFICACION = (v: unknown): v is Clasificacion =>
  v === 'objetivo' || v === 'precliente' || v === 'cliente';

export const defDe = (c: Clasificacion): DefClasificacion =>
  CLASIFICACIONES.find((x) => x.clave === c) || CLASIFICACIONES[1];

/** Orden del viaje: objetivo → precliente → cliente. */
export const ORDEN: Clasificacion[] = ['objetivo', 'precliente', 'cliente'];
export const avance = (c: Clasificacion) => ORDEN.indexOf(c);

// ── La sugerencia ──────────────────────────────────────────────────────────

/** Estados de CUPS que solo se alcanzan con una firma detrás. */
const CUPS_FIRMADO = ['contrato_firmado', 'pendiente_activacion', 'activado'];
/** Estados de contrato que significan que ya hay firma. */
const CONTRATO_FIRMADO = ['firmado', 'enviado_comercializadora', 'pendiente_validacion', 'pendiente_activacion', 'activado'];

export interface EntradaSugerencia {
  estado_comercial?: string | null;
  /** Sus suministros, con el estado de cada uno. */
  cups?: { estado_cups?: string | null; consumo_anual_kwh?: number | null }[];
  contratos?: { estado_contrato?: string | null; fecha_firma?: string | null }[];
  /** ¿Se ha vendido fotovoltaica? Hoy no está en el sistema; se deja abierto. */
  tiene_fv?: boolean;
}

/**
 * Lo que los datos dicen que debería ser. No manda: manda lo que marque una
 * persona. Sirve para proponer al crear y para avisar cuando algo no cuadra.
 */
export function clasificacionSugerida(e: EntradaSugerencia): Clasificacion {
  const cups = e.cups || [];
  const contratos = e.contratos || [];

  const firmoContrato = contratos.some(
    (c) => c.fecha_firma || CONTRATO_FIRMADO.includes(String(c.estado_contrato || ''))
  );
  const firmoCups = cups.some((c) => CUPS_FIRMADO.includes(String(c.estado_cups || '')));
  if (firmoContrato || firmoCups || e.tiene_fv || e.estado_comercial === 'activo') return 'cliente';

  // «Tenemos su información» es tener un suministro suyo con algo dentro: el
  // CUPS es lo que llega cuando entregan la factura, que es el momento en que
  // dejan de ser una puerta y pasan a ser un precliente.
  const tenemosDatos = cups.length > 0;
  return tenemosDatos ? 'precliente' : 'objetivo';
}

/** Por qué se sugiere eso, dicho para leerlo en pantalla. */
export function razonSugerencia(e: EntradaSugerencia): string {
  const s = clasificacionSugerida(e);
  if (s === 'cliente') {
    if ((e.contratos || []).some((c) => c.fecha_firma)) return 'Tiene un contrato con fecha de firma.';
    if ((e.cups || []).some((c) => CUPS_FIRMADO.includes(String(c.estado_cups || '')))) {
      return 'Tiene un suministro firmado o activado.';
    }
    if (e.tiene_fv) return 'Tiene fotovoltaica vendida.';
    return 'Su estado comercial es activo.';
  }
  if (s === 'precliente') {
    const n = (e.cups || []).length;
    return `Tenemos ${n} suministro${n === 1 ? '' : 's'} suyo${n === 1 ? '' : 's'}, pero nada firmado.`;
  }
  return 'No tenemos ningún suministro suyo: todavía es una puerta a la que llamar.';
}

/**
 * ¿Merece una mirada?
 *
 * Solo se avisa cuando lo marcado va POR DETRÁS de lo que dicen los datos: un
 * precliente que ya tiene un contrato firmado es un cliente al que nadie ha
 * movido de sitio, y eso descuadra los números del negocio.
 *
 * Al revés NO se avisa, y es deliberado: alguien marcado como cliente cuyo
 * contrato está en papel es exactamente la situación normal hoy. Avisar de eso
 * sería llenar la pantalla de falsos positivos hasta que se dejen de mirar.
 */
export function hayQueRevisar(actual: Clasificacion, sugerida: Clasificacion): boolean {
  return avance(sugerida) > avance(actual);
}

/** Reparto de la cartera por tipo, para el titular de una pantalla. */
export function repartoPorTipo(
  clientes: { clasificacion?: string | null }[]
): Record<Clasificacion, number> & { sin_clasificar: number } {
  const r = { objetivo: 0, precliente: 0, cliente: 0, sin_clasificar: 0 };
  for (const c of clientes) {
    const v = c.clasificacion;
    if (ES_CLASIFICACION(v)) r[v]++;
    else r.sin_clasificar++;
  }
  return r;
}
