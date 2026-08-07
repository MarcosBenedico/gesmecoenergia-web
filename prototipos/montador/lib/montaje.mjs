/**
 * Cortar los momentos elegidos y pegarlos en un solo clip.
 *
 * Se corta RECODIFICANDO, no copiando el flujo. Copiar es instantáneo pero solo
 * puede cortar en fotogramas clave, que van cada 2-10 segundos: pedir el corte
 * en el segundo 12,3 lo deja en el 10 y el momento entra con tres segundos de
 * relleno delante. Para un montaje de trozos de 3 segundos eso lo arruina.
 *
 * Y se normaliza todo a la MISMA resolución, fps y códec antes de pegar. Los
 * vídeos vienen de móviles distintos: uno a 1080p60 y otro a 720p30 no se
 * pueden concatenar sin más, y el resultado es audio desincronizado o un
 * archivo que solo reproduce el primer trozo.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ejecutar } from './analisis.mjs';

/** Formatos de salida. El vertical es el de TikTok/Reels/Shorts. */
export const FORMATOS = {
  vertical: { ancho: 1080, alto: 1920 },
  cuadrado: { ancho: 1080, alto: 1080 },
  horizontal: { ancho: 1920, alto: 1080 },
};

export const FPS = 30;

/**
 * Encaja cualquier entrada en el lienzo de salida sin deformar a nadie.
 *
 * Se amplía hasta cubrir y se recorta el sobrante por el centro. La
 * alternativa —barras negras— es correcta pero en vertical deja el vídeo
 * como un sello en medio de la pantalla, y eso en el móvil no lo ve nadie.
 *
 * Recortar por el centro es una apuesta: si quien habla está a un lado del
 * plano, se le puede cortar. Seguir la cara es harina de otro costal y no
 * entra en un prototipo; por eso el formato se elige y se puede dejar en
 * horizontal, que no recorta nada.
 */
function filtroEscala({ ancho, alto }) {
  return [
    `scale=${ancho}:${alto}:force_original_aspect_ratio=increase`,
    `crop=${ancho}:${alto}`,
    `fps=${FPS}`,
    'setsar=1',
  ].join(',');
}

/**
 * Extrae un trozo ya normalizado.
 *
 * El -ss va DESPUÉS del -i a propósito. Antes del -i ffmpeg salta por índice y
 * es mucho más rápido, pero es impreciso justo en la escala en la que estamos
 * trabajando. Aquí se prefiere que el corte caiga donde se ha pedido.
 */
async function extraer(entrada, inicio, duracion, salida, formato, conAudio) {
  const args = [
    '-v', 'error', '-y',
    '-i', entrada,
    '-ss', inicio.toFixed(3),
    '-t', duracion.toFixed(3),
    '-vf', filtroEscala(formato),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
  ];

  if (conAudio) {
    args.push('-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2');
  } else {
    // Un trozo mudo entre trozos con sonido rompe la concatenación: el pegado
    // necesita que TODOS tengan las mismas pistas. Se le pone silencio.
    args.push(
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-shortest', '-c:a', 'aac', '-b:a', '128k'
    );
  }

  args.push(salida);
  await ejecutar('ffmpeg', args);
}

/**
 * Monta el clip final.
 *
 * `momentos` viene de elegirMontaje() y ya está en orden. Devuelve la ruta del
 * archivo y el parte de lo que ha hecho.
 */
export async function montar(momentos, destino, { formato = 'vertical', alAvanzar = () => {} } = {}) {
  if (!momentos.length) throw new Error('No hay ningún momento que montar.');

  const medidas = FORMATOS[formato];
  if (!medidas) throw new Error(`Formato desconocido: ${formato}. Usa ${Object.keys(FORMATOS).join(', ')}.`);

  const carpeta = await mkdtemp(join(tmpdir(), 'montador-'));
  try {
    const trozos = [];
    for (let i = 0; i < momentos.length; i++) {
      const m = momentos[i];
      const trozo = join(carpeta, `t${String(i).padStart(3, '0')}.mp4`);
      alAvanzar(i + 1, momentos.length, m);
      await extraer(m.archivo, m.inicio, m.fin - m.inicio, trozo, medidas, m.conAudio !== false);
      trozos.push(trozo);
    }

    // El demuxer concat necesita las rutas escapadas: un apóstrofo en el nombre
    // de una carpeta —«Vídeos de Jose's»— rompe el archivo de lista.
    const lista = join(carpeta, 'lista.txt');
    await writeFile(lista, trozos.map((t) => `file '${t.replace(/'/g, "'\\''")}'`).join('\n'));

    await ejecutar('ffmpeg', [
      '-v', 'error', '-y',
      '-f', 'concat', '-safe', '0', '-i', lista,
      '-c', 'copy',          // aquí sí se copia: los trozos ya son idénticos
      '-movflags', '+faststart',
      destino,
    ]);

    return { destino, trozos: trozos.length };
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
}
