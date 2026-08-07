#!/usr/bin/env node
/**
 * Copia el motor de ffmpeg (WebAssembly) a public/ antes de construir.
 *
 * El .wasm pesa 31 MB. Meterlo en git lo dejaría en el historial PARA SIEMPRE
 * y se lo tragaría cada clon del repo, así que se copia en cada build desde
 * node_modules, que es donde npm ya lo deja.
 *
 * Y se sirve desde nuestro dominio en vez de tirar de un CDN público: si el CDN
 * se cae o cambia la versión, la página deja de funcionar sin que nadie haya
 * tocado nada.
 */
import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const ORIGEN = 'node_modules/@ffmpeg/core/dist/umd';
const DESTINO = 'public/ffmpeg';
const ARCHIVOS = ['ffmpeg-core.js', 'ffmpeg-core.wasm'];

if (!existsSync(ORIGEN)) {
  // No se aborta el build: el resto de la web no depende de esto y tumbar un
  // despliegue de producción por una página de pruebas sería desproporcionado.
  console.warn('⚠️  No encuentro @ffmpeg/core. /pruebavideo no funcionará.');
  process.exit(0);
}

await mkdir(DESTINO, { recursive: true });
for (const a of ARCHIVOS) await copyFile(`${ORIGEN}/${a}`, `${DESTINO}/${a}`);
console.log(`✓ Motor de vídeo copiado a ${DESTINO}`);
