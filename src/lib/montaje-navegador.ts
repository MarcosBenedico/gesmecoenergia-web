/**
 * Montar vídeo DENTRO DEL NAVEGADOR, sin instalar nada y sin servidor.
 *
 * El reparto es a propósito y cada mitad usa la herramienta que mejor le va:
 *
 *  - ANALIZAR el audio lo hace el propio navegador con Web Audio API. Es código
 *    nativo, va rápido y no necesita descargar nada. Solo hay que sacar la forma
 *    de onda, y para eso `decodeAudioData` sobra.
 *  - CORTAR Y PEGAR lo hace ffmpeg compilado a WebAssembly, porque eso el
 *    navegador no sabe hacerlo solo.
 *
 * El criterio de qué es un buen momento NO vive aquí: está en `montaje-video.ts`,
 * el mismo archivo que usa el prototipo de línea de comandos y el que cubren los
 * tests. Si se toca el criterio, cambian las dos vías a la vez.
 *
 * POR QUÉ EN EL NAVEGADOR Y NO EN EL SERVIDOR: las funciones de Vercel se cortan
 * a los 60 s y recodificar vídeo tarda más que eso en cuanto el material pasa de
 * un par de minutos. Además así el vídeo NUNCA sale del ordenador de quien lo
 * sube, que para material personal no es poca cosa.
 */
import { VENTANA_S, type MomentoElegido } from './montaje-video';

/** Se usa el core de UN SOLO HILO a posta. */
export const FFMPEG_BASE = '/ffmpeg';

export const FORMATOS = {
  vertical: { ancho: 1080, alto: 1920, etiqueta: 'Vertical (TikTok, Reels)' },
  cuadrado: { ancho: 1080, alto: 1080, etiqueta: 'Cuadrado' },
  horizontal: { ancho: 1920, alto: 1080, etiqueta: 'Horizontal (sin recorte)' },
} as const;

export type Formato = keyof typeof FORMATOS;
export const FPS = 30;

/**
 * Energía (RMS) por ventana de medio segundo, sacada con Web Audio API.
 *
 * Se decodifica a 8 kHz mono: para medir dónde hay jaleo sobra de largo, y a
 * 48 kHz estéreo un vídeo de diez minutos ocuparía cientos de megas en memoria
 * y tumbaría la pestaña. La ventana y el resto del criterio son los mismos que
 * en la versión de escritorio, así que el resultado es idéntico.
 */
export async function energiaDeArchivo(archivo: File): Promise<number[]> {
  const datos = await archivo.arrayBuffer();

  // OfflineAudioContext decodifica sin reproducir nada y a la frecuencia que se
  // le pida. Safari aún lo expone con prefijo.
  const Ctx: typeof OfflineAudioContext =
    (window as unknown as { OfflineAudioContext: typeof OfflineAudioContext }).OfflineAudioContext
    || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Ctx) throw new Error('Tu navegador no puede leer el audio de los vídeos (falta Web Audio API).');

  const ctx = new Ctx(1, 1, 8000);
  let audio: AudioBuffer;
  try {
    audio = await ctx.decodeAudioData(datos);
  } catch {
    // Un vídeo sin pista de audio, o con un códec que el navegador no abre.
    // No es un fallo del programa: quien llama decide qué hacer.
    return [];
  }

  const muestras = audio.getChannelData(0);
  const porVentana = Math.round(audio.sampleRate * VENTANA_S);
  const energias: number[] = [];

  for (let i = 0; i + porVentana <= muestras.length; i += porVentana) {
    let suma = 0;
    for (let j = 0; j < porVentana; j++) suma += muestras[i + j] * muestras[i + j];
    energias.push(Math.sqrt(suma / porVentana));
  }
  return energias;
}

/** Duración y medidas, leídas con una etiqueta <video> sin llegar a pintarla. */
export function inspeccionarArchivo(archivo: File): Promise<{ duracion: number; ancho: number; alto: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      const r = { duracion: v.duration, ancho: v.videoWidth, alto: v.videoHeight };
      URL.revokeObjectURL(url);
      resolve(r);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`No puedo abrir «${archivo.name}». ¿Seguro que es un vídeo?`));
    };
    v.src = url;
  });
}

/**
 * Encaja cualquier entrada en el lienzo de salida sin deformar a nadie:
 * se amplía hasta cubrir y se recorta el sobrante por el centro.
 *
 * El recorte central es una apuesta: si quien habla está a un lado del plano,
 * se le puede cortar. Seguir caras es otra liga; por eso está el formato
 * horizontal, que no recorta nada.
 */
export function filtroEscala(formato: Formato): string {
  const { ancho, alto } = FORMATOS[formato];
  return `scale=${ancho}:${alto}:force_original_aspect_ratio=increase,crop=${ancho}:${alto},fps=${FPS},setsar=1`;
}

/**
 * Argumentos para extraer UN trozo ya normalizado.
 *
 * El -ss va DESPUÉS del -i a propósito: antes del -i ffmpeg salta por índice y
 * es más rápido, pero impreciso justo en la escala de segundos con la que se
 * trabaja aquí. Para trozos de tres segundos, un corte que se va dos segundos
 * lo arruina.
 *
 * Los trozos mudos llevan silencio añadido: si unos tienen audio y otros no, la
 * concatenación falla o sale un archivo que solo reproduce el primero.
 */
export function argumentosCorte(
  entrada: string, salida: string, inicio: number, duracion: number, formato: Formato, conAudio: boolean
): string[] {
  const args = [
    '-i', entrada,
    ...(conAudio ? [] : ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000']),
    '-ss', inicio.toFixed(3),
    '-t', duracion.toFixed(3),
    '-vf', filtroEscala(formato),
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
  ];
  if (!conAudio) args.push('-shortest');
  args.push(salida);
  return args;
}

/** Lista para el demuxer `concat`. Las comillas se escapan por si hay apóstrofos. */
export function listaConcat(trozos: string[]): string {
  return trozos.map((t) => `file '${t.replace(/'/g, "'\\''")}'`).join('\n');
}

/** Nombre del archivo temporal de cada trozo dentro del sistema de ficheros virtual. */
export const nombreTrozo = (i: number) => `t${String(i).padStart(3, '0')}.mp4`;

/**
 * Cuánto va a tardar, más o menos, para poder avisar ANTES de empezar.
 *
 * ffmpeg en WebAssembly va del orden de 3-5 veces más lento que nativo, y con un
 * solo hilo. Decir «esto son dos minutos» antes de arrancar evita que se cierre
 * la pestaña a medias pensando que se ha colgado, que es lo que pasa siempre.
 */
export function segundosEstimados(momentos: MomentoElegido[]): number {
  const segundosDeVideo = momentos.reduce((s, m) => s + (m.fin - m.inicio), 0);
  return Math.round(segundosDeVideo * 4 + 8);
}
