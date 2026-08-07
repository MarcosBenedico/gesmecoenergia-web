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

const DESTINO = 'public/ffmpeg';

/**
 * El motor (el .wasm de 31 MB y su cargador).
 *
 * Se coge el build ESM y NO el UMD. El worker de @ffmpeg/ffmpeg se crea con
 * `type: "module"`, y ahí `importScripts` no existe: la librería lo intenta,
 * falla, y cae a `await import(coreURL)` esperando un módulo con
 * `export default`. Dándole el UMD, ese import no encuentra el default y sale
 * un «failed to import ffmpeg-core.js» que no dice nada de la causa real.
 */
const ORIGEN = 'node_modules/@ffmpeg/core/dist/esm';
const ARCHIVOS = ['ffmpeg-core.js', 'ffmpeg-core.wasm'];

/**
 * El worker, que va aparte y es la parte que se atraganta.
 *
 * @ffmpeg/ffmpeg arranca su worker con `new Worker(new URL('./worker.js',
 * import.meta.url))`. Turbopack no sabe resolver eso al empaquetar y falla en
 * tiempo de ejecución con «Cannot find module as expression is too dynamic»,
 * que además salta al pulsar el botón y no al construir: el build pasa en
 * verde y la página se rompe en las manos del usuario.
 *
 * La salida es `classWorkerURL`, que la propia librería ofrece para esto: se
 * sirve el worker desde nuestro dominio y se le pasa la ruta. Como se crea con
 * `type: "module"` y sus dos imports son relativos, hay que copiar también
 * const.js y errors.js AL LADO para que el navegador los resuelva.
 */
const ORIGEN_WORKER = 'node_modules/@ffmpeg/ffmpeg/dist/esm';
const ARCHIVOS_WORKER = ['worker.js', 'const.js', 'errors.js'];

if (!existsSync(ORIGEN)) {
  // No se aborta el build: el resto de la web no depende de esto y tumbar un
  // despliegue de producción por una página de pruebas sería desproporcionado.
  console.warn('⚠️  No encuentro @ffmpeg/core. /pruebavideo no funcionará.');
  process.exit(0);
}

await mkdir(DESTINO, { recursive: true });
for (const a of ARCHIVOS) await copyFile(`${ORIGEN}/${a}`, `${DESTINO}/${a}`);
for (const a of ARCHIVOS_WORKER) await copyFile(`${ORIGEN_WORKER}/${a}`, `${DESTINO}/${a}`);
console.log(`✓ Motor de vídeo y worker copiados a ${DESTINO}`);
