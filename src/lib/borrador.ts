'use client';

/**
 * QUE UN FALLO DE RED NO PIERDA LO ESCRITO NI LO DUPLIQUE AL REINTENTAR.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * EL PROBLEMA, QUE ES DE LA CALLE Y NO DE LABORATORIO
 *
 * David resuelve una visita en la puerta de una granja con una raya de
 * cobertura. La hoja guarda SEIS cosas seguidas: la visita, la siguiente
 * pasada, el pipeline, el prospecto, el CUPS de la factura y el cliente. Si la
 * conexión se cae en la tercera, pasaban dos cosas y las dos malas:
 *
 *   · SE PERDÍA LO ESCRITO. La nota, el resultado, la fecha de volver. Y
 *     volver a teclearlo de pie no se hace: se cierra la aplicación.
 *   · AL REINTENTAR SE DUPLICABA. La visita y la tarea ya habían entrado, así
 *     que el segundo intento creaba otra visita y otra tarea. Es exactamente
 *     el fallo del asistente de alta, que llegó a crear tres tareas iguales.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CÓMO SE RESUELVE
 *
 * Un borrador en el navegador con DOS cosas dentro: lo que se estaba
 * escribiendo y QUÉ PASOS YA ENTRARON. Al reintentar, los pasos hechos se
 * saltan. Es la misma idea que la llave natural de `automatismos.ts` —
 * idempotencia sin tocar la base de datos— aplicada a un envío por partes.
 *
 * ESTO NO ES «FUNCIONA SIN CONEXIÓN» Y NO SE PUEDE PRESENTAR COMO TAL. Sin
 * red, el guardado falla y se dice; lo que se conserva es el trabajo para
 * poder reintentar en cuanto haya cobertura. Prometer offline sin implementarlo
 * es peor que no tenerlo: se confía y se pierde.
 *
 * El borrador vive SOLO en ese navegador. En modo privado o con el
 * almacenamiento bloqueado, todo lo de aquí falla en silencio y la pantalla
 * sigue funcionando como antes — un borrador es una comodidad, nunca puede ser
 * lo que impide guardar.
 */

const PREFIJO = 'gesmeco_borrador_';

export interface Borrador<T> {
  /** Lo que se estaba escribiendo. */
  datos: T;
  /** Pasos del envío que YA entraron. No se repiten al reintentar. */
  hechos: string[];
  /** Cuándo se guardó, en ISO. Para poder caducar lo viejo. */
  cuando: string;
}

/** Los borradores caducan a los tres días: pasado eso, es basura. */
export const DIAS_BORRADOR = 3;

export function guardarBorrador<T>(clave: string, datos: T, hechos: string[] = []): void {
  try {
    const b: Borrador<T> = { datos, hechos, cuando: new Date().toISOString() };
    localStorage.setItem(PREFIJO + clave, JSON.stringify(b));
  } catch { /* modo privado o sin espacio: no puede impedir trabajar */ }
}

export function leerBorrador<T>(clave: string): Borrador<T> | null {
  try {
    const crudo = localStorage.getItem(PREFIJO + clave);
    if (!crudo) return null;
    const b = JSON.parse(crudo) as Borrador<T>;
    if (!b || typeof b !== 'object' || !Array.isArray(b.hechos)) return null;
    // Un borrador de hace un mes no es una recuperación, es una confusión:
    // reaparecería con datos de otra visita y nadie sabría de dónde salen.
    const edad = (Date.now() - new Date(b.cuando).getTime()) / 86400000;
    if (!Number.isFinite(edad) || edad > DIAS_BORRADOR) { borrarBorrador(clave); return null; }
    return b;
  } catch { return null; }
}

export function borrarBorrador(clave: string): void {
  try { localStorage.removeItem(PREFIJO + clave); } catch { /* da igual */ }
}

/**
 * Ejecuta los pasos de un envío saltándose los que ya entraron.
 *
 * Cada paso tiene NOMBRE, y ese nombre es la llave: si `guardar-visita` ya
 * entró, no se vuelve a mandar por mucho que se reintente. Se para en el
 * primero que falla y devuelve el error, con los anteriores ya marcados — así
 * el siguiente intento arranca justo donde se quedó.
 *
 * `hechos` se persiste ANTES de seguir con el paso siguiente: si el navegador
 * se cierra en medio, lo que ya entró consta.
 */
export async function enviarPorPasos<T>(
  clave: string,
  datos: T,
  hechos: string[],
  pasos: { nombre: string; hacer: () => Promise<string | null> }[],
): Promise<{ error: string | null; hechos: string[] }> {
  const hechosAhora = [...hechos];
  for (const paso of pasos) {
    if (hechosAhora.includes(paso.nombre)) continue;
    const err = await paso.hacer();
    if (err) {
      guardarBorrador(clave, datos, hechosAhora);
      return { error: err, hechos: hechosAhora };
    }
    hechosAhora.push(paso.nombre);
    guardarBorrador(clave, datos, hechosAhora);
  }
  // Todo dentro: el borrador ya no hace falta y dejarlo reaparecería la
  // próxima vez como si hubiera quedado algo a medias.
  borrarBorrador(clave);
  return { error: null, hechos: hechosAhora };
}
