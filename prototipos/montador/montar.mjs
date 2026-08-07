#!/usr/bin/env node
/**
 * MONTADOR — de varios vídeos sueltos a un clip único con lo mejor de cada uno.
 *
 *   node montar.mjs salida.mp4 clip1.mp4 clip2.mp4 clip3.mov
 *   node montar.mjs salida.mp4 *.mp4 --duracion 30 --formato vertical
 *
 * Opciones:
 *   --duracion N   segundos que debe durar el clip final (por defecto 45)
 *   --formato F    vertical (por defecto) · cuadrado · horizontal
 *   --listón N     de 0 a 1: cuánto hay que destacar para entrar (por defecto 0.45)
 *   --dry          analiza y enseña qué elegiría, sin llegar a montar nada
 *
 * Lo que NO hace, para que quede dicho: no pone subtítulos, no elige por lo que
 * se dice (solo por cómo suena) y no sigue caras al recortar en vertical.
 */
import { basename, resolve } from 'node:path';
import { inspeccionar, energiaPorVentana } from './lib/analisis.mjs';
import { momentosDeArchivo, elegirMontaje } from './lib/seleccion.mjs';
import { montar, FORMATOS } from './lib/montaje.mjs';

function leerArgumentos(argv) {
  const opciones = { duracion: 45, formato: 'vertical', listón: 0.45, dry: false };
  const sueltos = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') opciones.dry = true;
    else if (a === '--duracion') opciones.duracion = Number(argv[++i]);
    else if (a === '--formato') opciones.formato = argv[++i];
    else if (a === '--listón' || a === '--liston') opciones.listón = Number(argv[++i]);
    else if (a.startsWith('--')) throw new Error(`Opción desconocida: ${a}`);
    else sueltos.push(a);
  }

  if (sueltos.length < 2) {
    throw new Error('Uso: node montar.mjs <salida.mp4> <entrada1> [entrada2 ...] [opciones]');
  }
  if (!FORMATOS[opciones.formato]) {
    throw new Error(`Formato desconocido: ${opciones.formato}. Usa ${Object.keys(FORMATOS).join(', ')}.`);
  }
  if (!(opciones.duracion > 0)) throw new Error('--duracion tiene que ser un número de segundos mayor que 0.');
  if (!(opciones.listón >= 0 && opciones.listón <= 1)) throw new Error('--listón va de 0 a 1.');

  return { salida: sueltos[0], entradas: sueltos.slice(1), opciones };
}

const seg = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

async function principal() {
  const { salida, entradas, opciones } = leerArgumentos(process.argv.slice(2));

  console.log(`\n🎬 ${entradas.length} ${entradas.length === 1 ? 'archivo' : 'archivos'} → clip de ~${opciones.duracion} s en ${opciones.formato}\n`);

  const porArchivo = {};
  const mudos = [];

  for (const entrada of entradas) {
    const ruta = resolve(entrada);
    const info = await inspeccionar(ruta);

    if (!info.tieneVideo) {
      console.log(`  ⚠️  ${basename(entrada)} — no tiene imagen, lo salto`);
      continue;
    }
    if (!info.tieneAudio) {
      // Sin sonido no hay forma de saber qué momento es bueno: el criterio
      // entero se apoya en el audio. Decirlo, en vez de colar un trozo al azar.
      console.log(`  ⚠️  ${basename(entrada)} — sin pista de audio, no puedo puntuarlo`);
      mudos.push(basename(entrada));
      continue;
    }

    const energias = await energiaPorVentana(ruta);
    const momentos = momentosDeArchivo(energias, { listón: opciones.listón, duracion: info.duracion });
    if (momentos.length) porArchivo[ruta] = momentos;

    console.log(
      `  ${momentos.length ? '✓' : '·'}  ${basename(entrada)} — ${seg(info.duracion)} · ` +
      `${info.ancho}×${info.alto} · ${momentos.length} ${momentos.length === 1 ? 'momento' : 'momentos'}`
    );
  }

  if (!Object.keys(porArchivo).length) {
    console.error(
      '\n❌ No he encontrado ningún momento que destaque.\n' +
      '   Suele ser una de dos: los vídeos no tienen sonido, o el sonido es tan\n' +
      '   plano que nada sobresale. Prueba a bajar el listón: --listón 0.3\n'
    );
    process.exit(1);
  }

  const plan = elegirMontaje(porArchivo, { objetivoS: opciones.duracion });

  console.log(`\n📋 Montaje: ${plan.momentos.length} cortes · ${plan.duracionTotal.toFixed(1)} s\n`);
  for (const m of plan.momentos) {
    console.log(
      `   ${seg(m.inicio)}–${seg(m.fin)}  (${(m.fin - m.inicio).toFixed(1)} s)  ` +
      `${basename(m.archivo)}   ${'█'.repeat(Math.round(m.puntos * 10))}`
    );
  }

  const sinUsar = Object.keys(porArchivo).filter((a) => !plan.usados.includes(a));
  if (sinUsar.length) {
    console.log(`\n   Sin usar: ${sinUsar.map((a) => basename(a)).join(', ')}`);
  }
  if (mudos.length) {
    console.log(`   Sin audio (fuera del montaje): ${mudos.join(', ')}`);
  }

  if (opciones.dry) {
    console.log('\n(--dry: no he montado nada)\n');
    return;
  }

  console.log('');
  const { destino, trozos } = await montar(plan.momentos, resolve(salida), {
    formato: opciones.formato,
    alAvanzar: (i, total) => process.stdout.write(`\r   Cortando ${i}/${total}...`),
  });

  console.log(`\r   ✅ ${trozos} cortes pegados\n`);
  console.log(`🎉 ${destino}\n`);
}

principal().catch((e) => {
  console.error(`\n❌ ${e.message}\n`);
  process.exit(1);
});
