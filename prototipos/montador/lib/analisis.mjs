/**
 * Leer el vídeo y sacar la señal con la que se decide: la energía del sonido.
 *
 * El audio NO se analiza parseando la salida de texto de ffmpeg (que cambia
 * entre versiones y es un infierno de mantener). Se le pide a ffmpeg el audio
 * crudo por la salida estándar —mono, 8 kHz, PCM 16 bits— y la cuenta se hace
 * aquí. Es determinista, no depende de la versión y son 16 KB por segundo:
 * una hora de vídeo son 57 MB de audio, que caben en memoria sin drama.
 */
import { spawn } from 'node:child_process';
import { VENTANA_S } from '../../../src/lib/montaje-video.ts';

const HZ = 8000;

/** Lanza un proceso y devuelve su salida. Rechaza si termina mal. */
function ejecutar(cmd, args, { binario = false } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    const out = [];
    const err = [];
    p.stdout.on('data', (d) => out.push(d));
    p.stderr.on('data', (d) => err.push(d));
    p.on('error', (e) => reject(
      e.code === 'ENOENT'
        ? new Error(`No encuentro «${cmd}». Instala ffmpeg: https://ffmpeg.org/download.html`)
        : e
    ));
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(`${cmd} falló (${code}):\n${Buffer.concat(err).toString().slice(-800)}`));
      resolve(binario ? Buffer.concat(out) : Buffer.concat(out).toString());
    });
  });
}

/** Datos básicos del archivo. Sirve para avisar antes de perder cinco minutos. */
export async function inspeccionar(ruta) {
  const txt = await ejecutar('ffprobe', [
    '-v', 'error', '-print_format', 'json',
    '-show_format', '-show_streams', ruta,
  ]);
  const info = JSON.parse(txt);
  const video = info.streams.find((s) => s.codec_type === 'video');
  const audio = info.streams.find((s) => s.codec_type === 'audio');

  return {
    ruta,
    duracion: Number(info.format?.duration) || 0,
    ancho: video?.width ?? 0,
    alto: video?.height ?? 0,
    tieneVideo: !!video,
    tieneAudio: !!audio,
  };
}

/**
 * Energía (RMS lineal) por ventana de medio segundo.
 *
 * Un archivo sin pista de audio devuelve lista vacía en vez de reventar: es un
 * caso normal (vídeo de dron, time-lapse) y quien llama decide qué hacer.
 */
export async function energiaPorVentana(ruta) {
  const pcm = await ejecutar('ffmpeg', [
    '-v', 'error',
    '-i', ruta,
    '-map', '0:a:0?',      // el ? hace que no falle si no hay pista de audio
    '-ac', '1', '-ar', String(HZ),
    '-f', 's16le', '-',
  ], { binario: true });

  if (pcm.length < 2) return [];

  const muestrasPorVentana = Math.round(HZ * VENTANA_S);
  const total = Math.floor(pcm.length / 2);
  const energias = [];

  for (let inicio = 0; inicio + muestrasPorVentana <= total; inicio += muestrasPorVentana) {
    let suma = 0;
    for (let i = 0; i < muestrasPorVentana; i++) {
      // readInt16LE porque el PCM viene con signo y en little-endian; dividir
      // entre 32768 lo deja en -1..1, que es donde el RMS tiene sentido.
      const v = pcm.readInt16LE((inicio + i) * 2) / 32768;
      suma += v * v;
    }
    energias.push(Math.sqrt(suma / muestrasPorVentana));
  }
  return energias;
}

export { ejecutar };
