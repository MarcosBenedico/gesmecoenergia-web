/**
 * Tests del BORRADOR y del envío por pasos.
 *
 *   npm run test:borrador
 *
 * Lo que se protege: una visita resuelta en la puerta de una granja con una
 * raya de cobertura. Son seis escrituras seguidas, y si la red se cae en la
 * tercera pasaban dos cosas y las dos malas — se perdía lo escrito (y volver a
 * teclearlo de pie no se hace: se cierra la aplicación) y al reintentar se
 * creaban una visita y una tarea DUPLICADAS, que es el mismo fallo que llegó a
 * crear tres tareas iguales en el asistente de alta.
 */

// `borrador.ts` habla con localStorage, que no existe en Node. Se le da uno de
// mentira ANTES de importarlo: probar la lógica contra el almacenamiento real
// del navegador no se puede, y probarla sin él no probaría nada.
const almacen = new Map();
globalThis.localStorage = {
  getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => almacen.set(k, String(v)),
  removeItem: (k) => almacen.delete(k),
  clear: () => almacen.clear(),
};

const {
  guardarBorrador, leerBorrador, borrarBorrador, enviarPorPasos, DIAS_BORRADOR,
} = await import('../src/lib/borrador.ts');

let ok = 0, fallos = 0;
const comprueba = (n, c, d = '') => {
  if (c) { ok++; console.log(`  ✓ ${n}`); }
  else { fallos++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`); }
};
const titulo = (t) => console.log(`\n${t}`);

titulo('Lo escrito se guarda y se recupera');
{
  almacen.clear();
  guardarBorrador('v1', { nota: 'Estaba el hijo', resultado: 'volver' }, ['visita']);
  const b = leerBorrador('v1');
  comprueba('vuelve con los datos', b?.datos.nota === 'Estaba el hijo', JSON.stringify(b));
  comprueba('y con lo que ya entró', b?.hechos.join() === 'visita');
  borrarBorrador('v1');
  comprueba('borrarlo lo borra', leerBorrador('v1') === null);
  comprueba('leer uno que no existe no revienta', leerBorrador('no-existe') === null);
}

titulo('Un borrador viejo no reaparece con datos de otra visita');
{
  almacen.clear();
  guardarBorrador('v1', { nota: 'de hace un mes' }, []);
  // Se le envejece a mano la marca de tiempo.
  const crudo = JSON.parse(almacen.get('gesmeco_borrador_v1'));
  crudo.cuando = new Date(Date.now() - (DIAS_BORRADOR + 2) * 86400000).toISOString();
  almacen.set('gesmeco_borrador_v1', JSON.stringify(crudo));
  comprueba('lo caducado no se devuelve', leerBorrador('v1') === null);
  comprueba('y además se limpia', !almacen.has('gesmeco_borrador_v1'));
}

titulo('Un fallo a mitad no pierde nada Y NO DUPLICA al reintentar');
{
  almacen.clear();
  const enviados = [];
  let caeLaRed = true;
  const pasos = () => [
    { nombre: 'visita', hacer: async () => { enviados.push('visita'); return null; } },
    { nombre: 'tarea', hacer: async () => { enviados.push('tarea'); return null; } },
    {
      nombre: 'pipeline',
      hacer: async () => {
        enviados.push('pipeline');
        return caeLaRed ? 'Error de conexión.' : null;
      },
    },
    { nombre: 'cliente', hacer: async () => { enviados.push('cliente'); return null; } },
  ];

  const primero = await enviarPorPasos('v1', { nota: 'la mía' }, [], pasos());
  comprueba('el intento falla y lo dice', primero.error === 'Error de conexión.', String(primero.error));
  comprueba('los dos primeros pasos constan como hechos', primero.hechos.join() === 'visita,tarea', primero.hechos.join());
  comprueba('el cuarto NO se ha enviado', !enviados.includes('cliente'));
  comprueba('lo escrito sigue guardado', leerBorrador('v1')?.datos.nota === 'la mía');

  // Vuelve la cobertura y se le da otra vez.
  caeLaRed = false;
  enviados.length = 0;
  const segundo = await enviarPorPasos('v1', { nota: 'la mía' }, leerBorrador('v1').hechos, pasos());
  comprueba('el reintento sale bien', segundo.error === null, String(segundo.error));
  // ESTE ES EL TEST QUE IMPORTA: sin esto se creaban una visita y una tarea
  // duplicadas cada vez que se reintentaba.
  comprueba('la visita NO se manda dos veces', !enviados.includes('visita'), enviados.join());
  comprueba('la tarea tampoco', !enviados.includes('tarea'), enviados.join());
  comprueba('y sí se mandan los que faltaban', enviados.join() === 'pipeline,cliente', enviados.join());
  comprueba('al acabar el borrador desaparece', leerBorrador('v1') === null);
}

titulo('Un paso que no aplica no rompe la cadena');
{
  almacen.clear();
  const hechos = [];
  const r = await enviarPorPasos('v2', {}, [], [
    { nombre: 'a', hacer: async () => { hechos.push('a'); return null; } },
    // Devolver null sin hacer nada es lo que hacen los pasos condicionales
    // («solo si hay factura»): cuenta como hecho y se sigue.
    { nombre: 'b', hacer: async () => null },
    { nombre: 'c', hacer: async () => { hechos.push('c'); return null; } },
  ]);
  comprueba('llega hasta el final', r.error === null);
  comprueba('los tres constan', r.hechos.join() === 'a,b,c', r.hechos.join());
}

titulo('Sin almacenamiento la pantalla sigue funcionando');
{
  const bueno = globalThis.localStorage;
  // Modo privado y navegadores que bloquean el almacenamiento: TIRA al leer y
  // al escribir. Un borrador es una comodidad y nunca puede impedir guardar.
  globalThis.localStorage = {
    getItem() { throw new Error('bloqueado'); },
    setItem() { throw new Error('bloqueado'); },
    removeItem() { throw new Error('bloqueado'); },
  };
  let reventó = false;
  try {
    guardarBorrador('v3', { a: 1 });
    comprueba('leer devuelve null en vez de tirar', leerBorrador('v3') === null);
    const r = await enviarPorPasos('v3', {}, [], [{ nombre: 'x', hacer: async () => null }]);
    comprueba('y el envío llega igual al final', r.error === null);
  } catch { reventó = true; }
  comprueba('nada de esto lanza una excepción', !reventó);
  globalThis.localStorage = bueno;
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} correctos, ${fallos} fallos\n`);
process.exit(fallos === 0 ? 0 : 1);
