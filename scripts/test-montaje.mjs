/**
 * Tests del criterio de selección de momentos.
 *
 *   npm run test:montaje
 *
 * Se testea con energías inventadas a mano y no con vídeos: lo que se está
 * comprobando es el CRITERIO, y un test que necesite un archivo de 200 MB para
 * correr no lo va a correr nadie.
 */
import {
  percentil, normalizar, agruparEnMomentos, momentosDeArchivo, elegirMontaje,
  MINIMO_MOMENTO_S, VENTANA_S,
} from '../src/lib/montaje-video.ts';

let ok = 0, fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fallos++; console.log(`  ✗ ${nombre}${detalle ? ` — ${detalle}` : ''}`); }
}
const titulo = (t) => console.log(`\n${t}`);
const casi = (a, b, tol = 0.001) => Math.abs(a - b) < tol;

titulo('Percentil');
{
  comprueba('el percentil 50 de 1..5 es 3', percentil([1, 2, 3, 4, 5], 0.5) === 3);
  comprueba('interpola entre valores', casi(percentil([0, 10], 0.5), 5));
  comprueba('lista vacía no revienta', percentil([], 0.5) === 0);
}

titulo('Normalizar por archivo');
{
  // Dos grabaciones idénticas salvo el volumen: tienen que dar lo mismo.
  const bajo = [0.01, 0.02, 0.10, 0.02, 0.01];
  const alto = bajo.map((x) => x * 20);
  const nb = normalizar(bajo), na = normalizar(alto);
  comprueba('un vídeo grabado bajito puntúa igual que el mismo grabado alto',
    nb.every((v, i) => casi(v, na[i])), `${nb} vs ${na}`);

  comprueba('el resultado va de 0 a 1',
    normalizar([1, 5, 9, 3, 7]).every((v) => v >= 0 && v <= 1));

  comprueba('una grabación plana no destaca nada (no inventa momentos)',
    normalizar([0.5, 0.5, 0.5, 0.5]).every((v) => v === 0));

  comprueba('silencio absoluto no revienta al dividir',
    normalizar([0, 0, 0]).every((v) => v === 0));

  // Un pico aislado no debe aplastar el resto: por eso el techo es el p95.
  const conPico = normalizar([0.1, 0.5, 0.6, 0.55, 0.1, 40]);
  comprueba('un golpe al micro no deja todo lo demás en cero',
    conPico[2] > 0.3, `medio = ${conPico[2].toFixed(2)}`);
}

titulo('Agrupar ventanas en momentos');
{
  const n = [0, 0, 0.9, 0.9, 0.9, 0, 0, 0, 0.8, 0.8];
  comprueba('dos rachas separadas dan dos momentos',
    JSON.stringify(agruparEnMomentos(n, 0.45)) === JSON.stringify([[2, 4], [8, 9]]),
    JSON.stringify(agruparEnMomentos(n, 0.45)));

  // Una coma en mitad de una frase no debe partir la frase en dos.
  const conComa = [0.9, 0.9, 0.1, 0.9, 0.9];
  comprueba('una pausa corta no parte el momento',
    agruparEnMomentos(conComa, 0.45).length === 1,
    JSON.stringify(agruparEnMomentos(conComa, 0.45)));

  const pausaLarga = [0.9, 0.9, 0.1, 0.1, 0.1, 0.1, 0.9, 0.9];
  comprueba('una pausa larga sí lo parte',
    agruparEnMomentos(pausaLarga, 0.45).length === 2);

  comprueba('todo en silencio no devuelve ningún momento',
    agruparEnMomentos([0, 0, 0, 0], 0.45).length === 0);
}

titulo('Momentos de un archivo, en segundos');
{
  // 20 ventanas de 0,5 s = 10 s. Racha fuerte en el centro.
  const e = Array(20).fill(0.01);
  for (let i = 8; i < 14; i++) e[i] = 1.0;
  const m = momentosDeArchivo(e, { duracion: 10 });

  comprueba('encuentra un momento', m.length === 1, JSON.stringify(m));
  comprueba('el momento cae donde estaba el sonido',
    m[0].inicio < 4.5 && m[0].fin > 6.5, JSON.stringify(m[0]));
  comprueba('deja aire por delante y por detrás',
    m[0].inicio < 8 * VENTANA_S && m[0].fin > 14 * VENTANA_S);
  comprueba('no se sale del final del vídeo', m[0].fin <= 10);

  // Un pico de una sola ventana (0,5 s) es un parpadeo, no un momento.
  const pico = Array(20).fill(0.01);
  pico[10] = 1.0;
  const cortos = momentosDeArchivo(pico, { duracion: 10 })
    .filter((x) => x.duracion < MINIMO_MOMENTO_S);
  comprueba('no devuelve momentos más cortos que el mínimo visible', cortos.length === 0);

  comprueba('no se sale por el principio del vídeo',
    momentosDeArchivo([1, 1, 1, 1, 0, 0], { duracion: 3 }).every((x) => x.inicio >= 0));
}

titulo('Elegir el montaje entre varios archivos');
{
  const fuerte = [
    { inicio: 0, fin: 5, duracion: 5, puntos: 0.99 },
    { inicio: 10, fin: 15, duracion: 5, puntos: 0.98 },
    { inicio: 20, fin: 25, duracion: 5, puntos: 0.97 },
    { inicio: 30, fin: 35, duracion: 5, puntos: 0.96 },
    { inicio: 40, fin: 45, duracion: 5, puntos: 0.95 },
    { inicio: 50, fin: 55, duracion: 5, puntos: 0.94 },
  ];
  const flojo = [
    { inicio: 0, fin: 4, duracion: 4, puntos: 0.50 },
    { inicio: 10, fin: 14, duracion: 4, puntos: 0.45 },
  ];

  const r = elegirMontaje({ 'a.mp4': fuerte, 'b.mp4': flojo }, { objetivoS: 20 });
  comprueba('el archivo flojo también sale (ningún archivo copa el clip)',
    r.usados.includes('b.mp4'), `usados: ${r.usados.join(', ')}`);

  // El caso que de verdad duele: un archivo tan flojo que por puntuación no
  // entraría nunca. Si el encargo es "un clip con todo", tiene que salir.
  const muyFlojo = [{ inicio: 0, fin: 3, duracion: 3, puntos: 0.01 }];
  const conFlojo = elegirMontaje(
    { 'a.mp4': fuerte, 'b.mp4': flojo, 'c.mp4': muyFlojo }, { objetivoS: 20 }
  );
  comprueba('ningún archivo se queda fuera del clip, por flojo que sea',
    ['a.mp4', 'b.mp4', 'c.mp4'].every((f) => conFlojo.usados.includes(f)),
    `usados: ${conFlojo.usados.join(', ')}`);

  comprueba('con la reserva puesta sigue sin repetir ningún trozo',
    (() => {
      const claves = conFlojo.momentos.map((m) => `${m.archivo}:${m.inicio}`);
      return new Set(claves).size === claves.length;
    })());
  comprueba('no se pasa mucho del objetivo',
    r.duracionTotal <= 20 + 5, `${r.duracionTotal.toFixed(1)} s`);

  const orden = r.momentos.map((m) => `${m.archivo}@${m.inicio}`);
  const ordenado = [...r.momentos].sort(
    (x, y) => (x.archivo > y.archivo ? 1 : x.archivo < y.archivo ? -1 : 0) || x.inicio - y.inicio
  ).map((m) => `${m.archivo}@${m.inicio}`);
  comprueba('el montaje va en orden cronológico, no por puntuación',
    JSON.stringify(orden) === JSON.stringify(ordenado), orden.join(' '));

  comprueba('respeta el orden en que se pasaron los archivos',
    r.momentos.findIndex((m) => m.archivo === 'a.mp4') <
    r.momentos.findLastIndex((m) => m.archivo === 'a.mp4') + 1);

  // Con un solo archivo el cupo no debe limitarlo contra sí mismo.
  const solo = elegirMontaje({ 'a.mp4': fuerte }, { objetivoS: 20 });
  comprueba('con un solo archivo se llega al objetivo',
    solo.duracionTotal >= 20, `${solo.duracionTotal} s`);

  comprueba('sin archivos devuelve vacío sin reventar',
    elegirMontaje({}).momentos.length === 0);

  comprueba('nunca elige dos veces el mismo trozo',
    (() => {
      const claves = solo.momentos.map((m) => `${m.archivo}:${m.inicio}`);
      return new Set(claves).size === claves.length;
    })());
}

titulo('Momentos muy largos');
{
  const largo = [{ inicio: 0, fin: 30, duracion: 30, puntos: 0.9 }];
  const r = elegirMontaje({ 'a.mp4': largo }, { objetivoS: 20 });
  comprueba('una escena larga se parte en trozos en vez de descartarse',
    r.momentos.length > 1, `${r.momentos.length} trozos`);
  comprueba('los trozos no se solapan entre sí',
    r.momentos.every((m, i) => i === 0 || m.inicio >= r.momentos[i - 1].fin - 0.001));
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} bien, ${fallos} mal\n`);
process.exit(fallos === 0 ? 0 : 1);
