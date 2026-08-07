/**
 * QUÉ ES UN «MOMENTO BUENO» — la única pieza que decide de verdad.
 *
 * Todo lo demás del montador es fontanería de ffmpeg. Aquí está el criterio, y
 * por eso vive suelto y sin dependencias: se puede testear sin tocar un vídeo.
 *
 * La señal base es el SONIDO, no la imagen, y no es por comodidad. En vídeo de
 * persona hablando o de gente, lo interesante casi siempre suena: alguien habla,
 * alguien se ríe, algo golpea. Los silencios son el relleno. Medir la imagen
 * (movimiento, cambios de plano) suena más listo pero engaña mucho: una cámara
 * en mano temblando puntúa altísimo y no pasa nada.
 *
 * La energía se normaliza POR ARCHIVO. Si no, un vídeo grabado bajito quedaría
 * entero fuera del montaje frente a otro grabado alto, aunque el bajito tenga
 * los mejores momentos. Lo que interesa es «alto PARA ESE vídeo».
 */

/** Ventana de análisis: medio segundo. Más corto es ruido, más largo se pasa los golpes. */
export const VENTANA_S = 0.5;

/** Un momento por debajo de esto no se entiende al verlo: es un parpadeo. */
export const MINIMO_MOMENTO_S = 1.2;

/** Por encima de esto deja de ser un momento y es una escena entera. */
export const MAXIMO_MOMENTO_S = 8;

/**
 * Margen que se añade por delante y por detrás de cada momento.
 *
 * Sin esto los cortes entran con la frase empezada y salen con la última
 * sílaba comida, que es exactamente lo que hace que un montaje automático
 * "suene a robot". Un poco más de aire por delante que por detrás, porque
 * entrar tarde se nota mucho más que salir pronto.
 */
export const AIRE_ANTES_S = 0.4;
export const AIRE_DESPUES_S = 0.25;

/** Media aritmética, o 0 si no hay nada. */
const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Percentil por interpolación lineal. Se usa el percentil y no el máximo
 * porque un solo pico (un portazo, un golpe al micro) dispararía el máximo y
 * dejaría todo lo demás pareciendo silencio al normalizar.
 */
export function percentil(valores, p) {
  if (!valores.length) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  const pos = (orden.length - 1) * p;
  const bajo = Math.floor(pos);
  const alto = Math.ceil(pos);
  if (bajo === alto) return orden[bajo];
  return orden[bajo] + (orden[alto] - orden[bajo]) * (pos - bajo);
}

/** Suelo en dB. Por debajo de esto es silencio digital y no interesa distinguir. */
const SILENCIO_DB = -90;

/**
 * Pasa una energía lineal (RMS) a decibelios.
 *
 * TODO el análisis trabaja en dB, y no es un detalle de presentación: el oído
 * es logarítmico y la aritmética lineal miente. Un golpe al micro puede ser 40
 * veces la voz en lineal —y al normalizar deja toda la conversación pegada al
 * cero, o sea, "aquí no pasa nada"—, pero son solo unos 30 dB por encima, que
 * es una diferencia que la escala absorbe sin borrar el resto.
 */
export function aDb(rms) {
  if (!(rms > 0)) return SILENCIO_DB;
  return Math.max(SILENCIO_DB, 20 * Math.log10(rms));
}

/**
 * Lleva las energías de un archivo a una escala 0-1 comparable con la de
 * cualquier otro archivo.
 *
 * El suelo es el percentil 10 (el ruido de fondo real de esa grabación, que
 * nunca es cero: siempre hay nevera, tráfico o siseo del micro) y el techo el
 * percentil 95, para que un pico aislado no marque el máximo él solo.
 */
export function normalizar(energias) {
  const db = energias.map(aDb);
  const suelo = percentil(db, 0.1);
  const techo = percentil(db, 0.95);
  const rango = techo - suelo;
  // Grabación plana de verdad (o silencio absoluto): nada destaca sobre nada.
  if (rango <= 1e-9) return energias.map(() => 0);
  return db.map((e) => Math.min(1, Math.max(0, (e - suelo) / rango)));
}

/**
 * Junta ventanas seguidas que pasan el listón en momentos continuos.
 *
 * `tolerancia` es cuántas ventanas flojas seguidas se perdonan sin partir el
 * momento en dos. Sin ella, una coma en mitad de una frase parte la frase.
 */
export function agruparEnMomentos(normalizadas, listón, tolerancia = 2) {
  const momentos = [];
  let inicio = null;
  let flojas = 0;

  for (let i = 0; i < normalizadas.length; i++) {
    const fuerte = normalizadas[i] >= listón;
    if (fuerte) {
      if (inicio == null) inicio = i;
      flojas = 0;
    } else if (inicio != null) {
      flojas++;
      if (flojas > tolerancia) {
        momentos.push([inicio, i - flojas]);
        inicio = null;
        flojas = 0;
      }
    }
  }
  if (inicio != null) momentos.push([inicio, normalizadas.length - 1 - flojas]);

  return momentos.filter(([a, b]) => b >= a);
}

/**
 * Saca los momentos candidatos de UN archivo, ya en segundos y puntuados.
 *
 * La puntuación es la energía MEDIA del tramo, no la máxima. Con la máxima
 * ganaba siempre el trozo que contenía el pico más alto aunque el resto fuera
 * silencio; con la media gana el tramo que se mantiene interesante, que es lo
 * que se quiere ver.
 */
export function momentosDeArchivo(energias, { listón = 0.45, ventana = VENTANA_S, duracion = null } = {}) {
  const norm = normalizar(energias);
  const tope = duracion ?? energias.length * ventana;

  return agruparEnMomentos(norm, listón).map(([a, b]) => {
    const bruto = { inicio: a * ventana, fin: (b + 1) * ventana };
    // El aire se recorta contra los bordes del vídeo: pedirle a ffmpeg que
    // empiece en -0.4 s devuelve un corte vacío.
    const inicio = Math.max(0, bruto.inicio - AIRE_ANTES_S);
    const fin = Math.min(tope, bruto.fin + AIRE_DESPUES_S);
    return {
      inicio,
      fin,
      duracion: fin - inicio,
      puntos: media(norm.slice(a, b + 1)),
    };
  }).filter((m) => m.duracion >= MINIMO_MOMENTO_S);
}

/** Parte los momentos largos en trozos de tamaño visible en vez de descartarlos. */
function recortarLargos(momentos) {
  const salida = [];
  for (const m of momentos) {
    if (m.duracion <= MAXIMO_MOMENTO_S) { salida.push(m); continue; }
    const trozos = Math.ceil(m.duracion / MAXIMO_MOMENTO_S);
    const paso = m.duracion / trozos;
    for (let i = 0; i < trozos; i++) {
      salida.push({
        ...m,
        inicio: m.inicio + i * paso,
        fin: m.inicio + (i + 1) * paso,
        duracion: paso,
      });
    }
  }
  return salida;
}

/**
 * Elige el montaje final de entre los momentos de TODOS los archivos.
 *
 * Dos reglas que no son obvias y que son las que hacen que el resultado se
 * pueda ver:
 *
 * 1. NINGÚN ARCHIVO PUEDE COPAR EL CLIP. Sin reparto, el vídeo grabado más
 *    alto se lleva los diez mejores momentos y los demás no salen. Como el
 *    encargo es "de varios archivos, un clip", que falte un archivo entero es
 *    un fallo, no una optimización. Por eso hay un cupo por archivo.
 * 2. EL ORDEN FINAL ES CRONOLÓGICO, no por puntuación. Ordenar por lo bueno
 *    que es cada trozo destroza cualquier continuidad: se salta del final de
 *    una escena a su principio. Se elige por puntos y se MONTA por orden.
 */
export function elegirMontaje(porArchivo, { objetivoS = 45, cupoPorArchivo = 0.6 } = {}) {
  const archivos = Object.keys(porArchivo);
  if (!archivos.length) return { momentos: [], duracionTotal: 0, usados: [] };

  // Con un solo archivo el cupo no aplica: si no, se limitaría a sí mismo.
  const cupoS = archivos.length === 1 ? Infinity : objetivoS * cupoPorArchivo;

  const candidatos = [];
  for (const archivo of archivos) {
    for (const m of recortarLargos(porArchivo[archivo])) candidatos.push({ ...m, archivo });
  }
  candidatos.sort((a, b) => b.puntos - a.puntos);

  const elegidos = [];
  const gastadoPor = Object.fromEntries(archivos.map((a) => [a, 0]));
  let total = 0;

  // RESERVA: el mejor momento de cada archivo entra antes de repartir el resto.
  //
  // Sin esto, el reparto por puntuación puede dejar un archivo entero fuera —
  // pasa en cuanto un vídeo está grabado más flojo que los demás. Y el encargo
  // es "de varios archivos, un clip con todo": que falte uno es un fallo, no
  // una optimización. El cupo de arriba impide que uno acapare; esto impide
  // que otro desaparezca. Hacen falta los dos.
  for (const archivo of archivos) {
    const mejor = candidatos.find((c) => c.archivo === archivo);
    if (!mejor) continue;
    elegidos.push(mejor);
    gastadoPor[archivo] += mejor.duracion;
    total += mejor.duracion;
  }

  for (const c of candidatos) {
    if (elegidos.includes(c)) continue;
    if (total >= objetivoS) break;
    if (gastadoPor[c.archivo] + c.duracion > cupoS) continue;
    // Solaparse consigo mismo saca la misma imagen dos veces seguidas.
    const solapa = elegidos.some(
      (e) => e.archivo === c.archivo && c.inicio < e.fin && c.fin > e.inicio
    );
    if (solapa) continue;

    elegidos.push(c);
    gastadoPor[c.archivo] += c.duracion;
    total += c.duracion;
  }

  // Cronológico: primero por el orden en que se pasaron los archivos, y dentro
  // de cada uno por el momento en que ocurre.
  elegidos.sort(
    (a, b) => archivos.indexOf(a.archivo) - archivos.indexOf(b.archivo) || a.inicio - b.inicio
  );

  return {
    momentos: elegidos,
    duracionTotal: total,
    usados: archivos.filter((a) => gastadoPor[a] > 0),
  };
}
