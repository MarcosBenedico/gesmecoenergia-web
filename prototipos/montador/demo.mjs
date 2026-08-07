#!/usr/bin/env node
/**
 * DEMO — comprobar que todo funciona sin tener vídeos a mano.
 *
 *   node demo.mjs
 *
 * Fabrica tres vídeos de prueba con ffmpeg, los monta y deja el resultado en
 * la carpeta demo/. Los vídeos son rectángulos de colores con pitidos en
 * momentos concretos, así que NO sirven para juzgar si el criterio acierta:
 * sirven para confirmar que ffmpeg está bien instalado y que la cadena entera
 * (analizar → elegir → cortar → pegar) funciona en esta máquina.
 *
 * Cada vídeo se genera con una resolución y unos fps distintos a propósito:
 * es el caso real de material grabado con móviles diferentes, y es justo donde
 * un montaje mal hecho desincroniza el audio o solo reproduce el primer trozo.
 */
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ejecutar, inspeccionar, energiaPorVentana } from './lib/analisis.mjs';
import { momentosDeArchivo, elegirMontaje } from './lib/seleccion.mjs';
import { montar } from './lib/montaje.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const carpeta = join(aqui, 'demo');

/** Dónde suena cada vídeo. Es lo que el montador tiene que encontrar solo. */
const PRUEBAS = [
  { nombre: 'uno.mp4', color: 'red', medida: '1280x720', fps: 30, hz: 400, suena: [[2, 5], [12, 14]] },
  { nombre: 'dos.mp4', color: 'green', medida: '1920x1080', fps: 60, hz: 620, suena: [[5, 9]] },
  { nombre: 'tres.mp4', color: 'blue', medida: '720x1280', fps: 24, hz: 840, suena: [[1, 3], [15, 18]] },
];

const seg = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

async function fabricar({ nombre, color, medida, fps, hz, suena }) {
  const destino = join(carpeta, nombre);
  // Se sube el volumen solo dentro de las ventanas indicadas; el resto queda
  // en un hilo de sonido (no en cero absoluto), que es como es la realidad.
  const cuando = suena.map(([a, b]) => `between(t,${a},${b})`).join('+');

  await ejecutar('ffmpeg', [
    '-v', 'error', '-y',
    '-f', 'lavfi', '-t', '20', '-i', `color=c=${color}:s=${medida}:r=${fps}`,
    '-f', 'lavfi', '-t', '20', '-i', `sine=frequency=${hz}:r=48000`,
    '-af', `volume='if(${cuando},0.8,0.0005)':eval=frame,aformat=channel_layouts=stereo`,
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-t', '20',
    destino,
  ]);

  return destino;
}

async function principal() {
  console.log('\n🎬 Demo del montador\n');

  await mkdir(carpeta, { recursive: true });

  console.log('1. Fabricando tres vídeos de prueba...');
  const rutas = [];
  for (const p of PRUEBAS) {
    rutas.push(await fabricar(p));
    console.log(`   · ${p.nombre} — ${p.medida} a ${p.fps} fps · suena en ${p.suena.map(([a, b]) => `${a}-${b}s`).join(' y ')}`);
  }

  console.log('\n2. Buscando los momentos que destacan...');
  const porArchivo = {};
  for (const ruta of rutas) {
    const info = await inspeccionar(ruta);
    const energias = await energiaPorVentana(ruta);
    const momentos = momentosDeArchivo(energias, { duracion: info.duracion });
    if (momentos.length) porArchivo[ruta] = momentos;
    console.log(`   · ${ruta.split(/[/\\]/).pop()} → ${momentos.length} ${momentos.length === 1 ? 'momento' : 'momentos'}: ` +
      momentos.map((m) => `${m.inicio.toFixed(1)}-${m.fin.toFixed(1)}s`).join(', '));
  }

  const plan = elegirMontaje(porArchivo, { objetivoS: 15 });
  console.log(`\n3. Montaje elegido: ${plan.momentos.length} cortes, ${plan.duracionTotal.toFixed(1)} s`);
  for (const m of plan.momentos) {
    console.log(`   · ${seg(m.inicio)}–${seg(m.fin)}  ${m.archivo.split(/[/\\]/).pop()}`);
  }

  const destino = join(carpeta, 'resultado.mp4');
  console.log('\n4. Cortando y pegando...');
  await montar(plan.momentos, destino, { formato: 'vertical' });

  const final = await inspeccionar(destino);
  console.log(`\n✅ Listo: ${destino}`);
  console.log(`   ${final.ancho}×${final.alto} · ${final.duracion.toFixed(1)} s · ${final.tieneAudio ? 'con audio' : 'SIN AUDIO (mal)'}\n`);
  console.log('   Ábrelo: los tres colores tienen que aparecer en orden (rojo, verde, azul)');
  console.log('   y los pitidos sonar sin cortes raros.\n');
  console.log('   Si esto funciona, ya puedes probar con vídeos de verdad:');
  console.log('   node montar.mjs resultado.mp4 tus/videos/*.mp4 --dry\n');
}

principal().catch((e) => {
  console.error(`\n❌ ${e.message}\n`);
  process.exit(1);
});
