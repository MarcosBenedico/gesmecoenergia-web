#!/usr/bin/env node
/**
 * Tests de la agenda vista desde la furgoneta (src/lib/agenda-calle.ts).
 *
 *   node scripts/test-agenda-calle.mjs
 *
 * Lo que se fija aquí es el criterio que hace que una lista se convierta en un
 * plan: agrupar por ZONA y no por fecha, y decir en cada línea qué le falta al
 * cliente. Si esto se descuadra, David sale con una lista otra vez, y ya sabemos
 * lo que pasa: 0,7 visitas al día en vez de 9.
 */

const {
  municipioDe, coordsDe, ubicacionDe, paradaDe, queLeFalta, enriquecerParaCalle, agruparPorZona,
  telefonoMarcable, enlaceWhatsApp, enlaceMapa, enlaceRuta, SIN_ZONA, MAX_PARADAS_RUTA,
} = await import('../src/lib/agenda-calle.ts');

let ok = 0, fallos = 0;
const eq = (nombre, real, esperado) => {
  if (JSON.stringify(real) === JSON.stringify(esperado)) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fallos++; console.log(`  ✗ ${nombre}\n      esperado ${JSON.stringify(esperado)}, salió ${JSON.stringify(real)}`); }
};
const cierto = (nombre, v) => eq(nombre, !!v, true);

console.log('\n── El municipio, de direcciones escritas de tres maneras ──');
eq('formato del catastro',
  municipioDe('Calle MAYOR 14, 22550, Tamarite de Litera, Huesca'), 'Tamarite de Litera');
eq('formato del importador',
  municipioDe('22550 - TAMARITE DE LITERA'), 'Tamarite de Litera');
eq('con bloque y piso por medio',
  municipioDe('Calle OBISPO MIRANDA, 2, BQ . B , Piso 3, 22550, Tamarite de Litera, Huesca'), 'Tamarite de Litera');
eq('otro municipio', municipioDe('Calle DEL ORIENTE 20, 22549, Vencillón, Huesca'), 'Vencillón');
eq('las minúsculas se respetan bien', municipioDe('22500, BINEFAR'), 'Binéfar');
eq('sin código postal no se inventa nada', municipioDe('Calle de la Iglesia 4'), null);
eq('sin dirección tampoco', municipioDe(null, '', undefined), null);
eq('si la primera no vale, prueba la siguiente',
  municipioDe(null, 'Polígono 3, 22535, Esplús, Huesca'), 'Esplús');
eq('un número detrás del CP no es un municipio', municipioDe('22500 4 bajo'), null);

// El formato de la comercializadora, que es de donde vienen la mayoría de altas:
// el municipio va DELANTE del código postal y separado por barras.
eq('municipio delante del CP, con barras',
  municipioDe('SAN ESTEBAN 23 | Binefar | 22500'), 'Binéfar');
eq('lo mismo pero en mayúsculas y con más campos',
  municipioDe('AV SAN VICENTE DE PAUL, 37 NUM 4 3 | TAMARITE DE LITERA | 22550'),
  'Tamarite de Litera');
eq('un portal de cinco cifras no tapa el CP de verdad',
  municipioDe('AVENIDA SAN VICENTE DE PAUL 00043 03 A, 22550 TAMARITE'), 'Tamarite de Litera');
eq('la provincia pegada al CP no es el municipio',
  municipioDe('CL MAYOR 3 | Huesca | 22500'), null);
eq('...ni cuando viene detrás sin municipio delante',
  municipioDe('22550, Tamarite de Litera, Huesca'), 'Tamarite de Litera');
eq('una calle delante del CP no es un municipio',
  municipioDe('POLIGONO INDUSTRIAL NºB-7, B-8 22550'), null);
eq('el CP al final sin nada más tampoco inventa',
  municipioDe('CALLE LA BALSA, 5 22500'), null);

// Un pueblo, un nombre. Escrito de dos maneras salían dos zonas en la pantalla
// y quien montaba la ruta abría una y se dejaba la otra.
eq('Binefar y Binéfar son la misma zona',
  municipioDe('22500 Binefar'), municipioDe('22500 Binéfar'));
eq('Tamarite y Tamarite de Litera también',
  municipioDe('22550 TAMARITE'), municipioDe('22550 TAMARITE DE LITERA'));
eq('Esplus y Esplús también', municipioDe('22535 Esplus'), 'Esplús');
eq('un pueblo que no está en la lista se deja como venga',
  municipioDe('22549, Peralta de Calasanz'), 'Peralta de Calasanz');

console.log('\n── Coordenadas dentro de un texto ──');
eq('de un enlace de Google Maps',
  coordsDe('https://maps.google.com/?q=41.834091,0.534880'), { lat: 41.834091, lon: 0.534880 });
eq('separadas por barra', coordsDe('41.9542572/0.2995116'), { lat: 41.9542572, lon: 0.2995116 });
eq('un texto sin coordenadas', coordsDe('Calle Mayor 4'), null);
eq('una latitud imposible se descarta', coordsDe('99.99999,0.53488'), null);
eq('el 0,0 del Atlantico no es una ubicacion', coordsDe('0.00000,0.00000'), null);

console.log('\n── Coordenadas escritas a mano ──');
// Marcos las mete a mano en la ficha, asi que tienen que valer con menos
// decimales que las que salen de una URL de Google.
eq('con dos decimales vale', coordsDe('41.79,0.58'), { lat: 41.79, lon: 0.58 });
eq('con espacio despues de la coma tambien', coordsDe('41.7946, 0.5816'), { lat: 41.7946, lon: 0.5816 });
eq('con UN decimal no: son 11 km de error, eso no es una ubicacion',
  coordsDe('41.8,0.5'), null);

console.log('\n── Grados, minutos y segundos: el otro formato de Google ──');
// Al copiar un sitio de Google Maps sale este formato en la parte /place/, y
// ademas codificado. Antes no se leia y esos clientes salian «sin ubicacion».
{
  const r = coordsDe("41°47'40.8\"N 0°34'53.8\"E");
  cierto('grados sin codificar', r && Math.abs(r.lat - 41.7946) < 0.001 && Math.abs(r.lon - 0.5816) < 0.001);
}
{
  const url = "https://www.google.com/maps/place/41%C2%B047'40.8%22N+0%C2%B034'53.8%22E";
  const r = coordsDe(url);
  cierto('grados codificados dentro de una URL', r && Math.abs(r.lat - 41.7946) < 0.001);
}
{
  const r = coordsDe("41°47'40.8\"S 0°34'53.8\"O");
  cierto('sur y oeste restan', r && r.lat < 0 && r.lon < 0);
}
eq('la altura de camara de la URL no se confunde con coordenadas',
  coordsDe('https://www.google.com/maps/place/Algo/@41.7946587,0.5816007,662m/data=x'),
  { lat: 41.7946587, lon: 0.5816007 });

console.log('\n── Qué se puede hacer con cada ubicación ──');
{
  const u = ubicacionDe('https://www.google.com/maps?q=41.81242,0.64731');
  eq('coordenadas → tipo coords', u.tipo, 'coords');
  eq('y sirven de parada', paradaDe(u), '41.81242,0.64731');
}
{
  const u = ubicacionDe('CALLE JOAQUIN COSTA 20, 22540 ALTORRICON');
  eq('dirección postal → tipo texto', u.tipo, 'texto');
  eq('y sirve de parada tal cual', paradaDe(u), 'CALLE JOAQUIN COSTA 20, 22540 ALTORRICON');
}
{
  // Este es el caso de PIRINEOS GLOBAL: un enlace corto sin coordenadas dentro.
  const u = ubicacionDe('https://maps.app.goo.gl/W3hfwvb3gGfyvsuJ9');
  eq('enlace corto → tipo enlace', u.tipo, 'enlace');
  eq('NO sirve de parada: metido en la ruta, Google la descarta entera', paradaDe(u), null);
  eq('pero se guarda para poder abrirlo', u.url, 'https://maps.app.goo.gl/W3hfwvb3gGfyvsuJ9');
}
{
  const u = ubicacionDe('https://www.google.com/maps/place/Av%C3%ADcola+Gimenells+S.L/data=x');
  eq('de un enlace con nombre de sitio se saca el nombre', u.tipo, 'texto');
  cierto('y el nombre está legible', u.texto.includes('Gimenells'));
}
eq('sin nada, no hay ubicación', ubicacionDe('', null, undefined), null);
{
  const u = ubicacionDe(null, 'POLIGONO 3 PARCELA 82, ALBALATE');
  eq('se coge el primero que tenga algo', u.texto, 'POLIGONO 3 PARCELA 82, ALBALATE');
}

console.log('\n── Qué le falta para poder ofertar ──');
const cli = { id: 'c1', nombre: 'Granja Norte', telefono: '974 000 111' };
eq('con todo puesto, no le falta nada',
  queLeFalta(cli, [{ id: 's1', cliente_id: 'c1', cups: 'ES0031', consumo_anual_kwh: 145000 }]), []);
eq('sin suministro', queLeFalta(cli, []), ['sin suministro']);
eq('con el CUPS provisional',
  queLeFalta(cli, [{ id: 's1', cliente_id: 'c1', cups: 'PENDIENTE-9', consumo_anual_kwh: 145000 }]),
  ['CUPS provisional']);
eq('sin consumo',
  queLeFalta(cli, [{ id: 's1', cliente_id: 'c1', cups: 'ES0031', consumo_anual_kwh: 0 }]),
  ['falta el consumo']);
eq('sin teléfono',
  queLeFalta({ ...cli, telefono: null }, [{ id: 's1', cliente_id: 'c1', cups: 'ES0031', consumo_anual_kwh: 1 }]),
  ['sin teléfono']);
eq('si UNO de sus suministros tiene consumo, ya no falta',
  queLeFalta(cli, [
    { id: 's1', cliente_id: 'c1', cups: 'ES0001', consumo_anual_kwh: 0 },
    { id: 's2', cliente_id: 'c1', cups: 'ES0002', consumo_anual_kwh: 8000 },
  ]), []);
eq('sin cliente no se afirma nada', queLeFalta(undefined, []), []);

console.log('\n── Enriquecer ──');
const items = [
  { clave: 'a', clienteId: 'c1', urgencia: 'hoy', dias: 0 },
  { clave: 'b', clienteId: 'c2', urgencia: 'semana', dias: 4 },
  { clave: 'c', clienteId: 'c3', urgencia: 'vencido', dias: -3 },
  { clave: 'd', clienteId: null, urgencia: 'sin_fecha', dias: null },
];
const clientes = [
  { id: 'c1', nombre: 'Granja Norte', telefono: '974000111', clasificacion: 'precliente',
    direccion_fiscal: 'Ctra. de Tamarite km 4, 22550, Tamarite de Litera, Huesca' },
  { id: 'c2', nombre: 'Talleres Sur', telefono: null, clasificacion: 'cliente',
    direccion_fiscal: 'Av. Aragón 12, 22500, Binéfar, Huesca' },
  // Con municipio Y coordenadas: es el caso bueno, el que se puede meter en ruta
  { id: 'c3', nombre: 'Nave Esplús', telefono: '974222333', clasificacion: 'objetivo',
    direccion_fiscal: 'Polígono 2, 22535, Esplús, Huesca https://maps.google.com/?q=41.834091,0.534880' },
];
const cupsTodos = [
  { id: 's1', cliente_id: 'c1', cups: 'ES0001', consumo_anual_kwh: 145000, direccion_suministro: null },
  { id: 's2', cliente_id: 'c2', cups: 'PENDIENTE-2', consumo_anual_kwh: 0, direccion_suministro: null },
];
const ric = enriquecerParaCalle({ items, clientes, cups: cupsTodos });

eq('saca el municipio de cada uno', ric.map((i) => i.municipio),
  ['Tamarite de Litera', 'Binéfar', 'Esplús', null]);
eq('saca la clasificación', ric.map((i) => i.clasificacion),
  ['precliente', 'cliente', 'objetivo', 'precliente']);
eq('al de las coordenadas lo ubica', !!ric[2].coords, true);
eq('el que tiene todo no le falta nada', ric[0].falta, []);
eq('al del CUPS provisional le faltan dos cosas', ric[1].falta.length, 3);
eq('un item sin cliente no es ubicable', ric[3].ubicable, false);
eq('el de la dirección sí lo es', ric[0].ubicable, true);

console.log('\n── Los tres respaldos de la zona, por orden de quién sabe más ──');
{
  // 1) La dirección manda cuando se puede leer.
  const [a] = enriquecerParaCalle({
    items: [{ clave: 'a', clienteId: 'z1', urgencia: 'hoy', dias: 0 }],
    clientes: [{ id: 'z1', nombre: 'A', direccion_fiscal: 'Calle X 1, 22535, Esplús, Huesca',
                 zona: 'binefar' }],
    cups: [],
  });
  eq('la dirección gana a la zona puesta a mano', a.municipio, 'Esplús');

  // 2) Sin dirección legible, la zona que eligió una persona.
  const [b] = enriquecerParaCalle({
    items: [{ clave: 'b', clienteId: 'z2', urgencia: 'hoy', dias: 0 }],
    clientes: [{ id: 'z2', nombre: 'B', direccion_fiscal: 'La torre de siempre', zona: 'binefar' }],
    cups: [],
  });
  eq('sin dirección legible, vale la zona puesta a mano', b.municipio, 'Binéfar');

  // 3) Y si tampoco, las coordenadas. Cae en la MISMA caja que los de dirección.
  const [c] = enriquecerParaCalle({
    items: [{ clave: 'c', clienteId: 'z3', urgencia: 'hoy', dias: 0 }],
    clientes: [{ id: 'z3', nombre: 'C', direccion_fiscal: '41.834091,0.534880' }],
    cups: [],
  });
  cierto('con solo coordenadas ya no cae en «sin dirección»', c.municipio);
  eq('...y cae en una caja de pueblo, no en una etiqueta de zona distinta',
    typeof c.municipio === 'string' && c.municipio.includes('('), false);
}

console.log('\n── Zonas: se conduce a un sitio, no a una fecha ──');
const zonas = agruparPorZona(ric);
eq('tres zonas más el cajón de los que no se sabe dónde están', zonas.length, 4);
eq('primero la zona con algo vencido', zonas[0].items[0].urgencia, 'vencido');
eq('...y el cajón sin dirección va al final', zonas[zonas.length - 1].municipio, SIN_ZONA);
cierto('cada zona cuenta lo que urge', zonas.every((z) => typeof z.urge === 'number'));
eq('cuenta cuántos están listos para cerrar',
  agruparPorZona(ric).find((z) => z.municipio === 'Tamarite de Litera').listos, 1);
eq('...y cuántos se pueden meter en ruta',
  agruparPorZona(ric).find((z) => z.municipio === 'Binéfar').ubicables, 1);

console.log('\n── Dentro de una zona manda la urgencia ──');
const mismaZona = enriquecerParaCalle({
  items: [
    { clave: 'x', clienteId: 'c1', urgencia: 'mes', dias: 20 },
    { clave: 'y', clienteId: 'c1', urgencia: 'vencido', dias: -5 },
    { clave: 'z', clienteId: 'c1', urgencia: 'hoy', dias: 0 },
  ],
  clientes: [clientes[0]], cups: cupsTodos,
});
eq('vencido, hoy y luego el resto',
  agruparPorZona(mismaZona)[0].items.map((i) => i.urgencia), ['vencido', 'hoy', 'mes']);

console.log('\n── Acciones desde la lista ──');
eq('un teléfono con espacios se limpia', telefonoMarcable('974 00 11 22'), '9740011 22'.replace(' ', ''));
eq('uno corto no vale', telefonoMarcable('974'), null);
cierto('WhatsApp añade el prefijo de España',
  enlaceWhatsApp('974000111').includes('34974000111'));
cierto('...y no lo dobla si ya lo trae',
  enlaceWhatsApp('+34974000111').includes('wa.me/34974000111'));
eq('sin teléfono no hay enlace', enlaceWhatsApp(null), null);
cierto('el mapa usa las coordenadas si las hay',
  enlaceMapa({ ubicacion: ubicacionDe('41.8046,0.5312') }).includes('41.8046,0.5312'));
cierto('...y la dirección si no',
  enlaceMapa({ ubicacion: ubicacionDe('Calle Mayor 4') }).includes('Calle%20Mayor%204'));
cierto('un enlace corto se abre tal cual, sin convertirlo en búsqueda',
  enlaceMapa({ ubicacion: ubicacionDe('https://maps.app.goo.gl/W3hfw') }) === 'https://maps.app.goo.gl/W3hfw');
eq('sin nada, no hay mapa', enlaceMapa({ ubicacion: null }), null);

console.log('\n── La ruta: lo que convierte la lista en una mañana ──');
const ruta = enlaceRuta(ric.filter((i) => i.ubicable));
cierto('sale de la oficina', ruta.includes('origin=Av.'));
cierto('tiene destino', ruta.includes('destination='));
eq('sin paradas ubicables no hay ruta', enlaceRuta([]), null);
eq('un enlace corto NO entra en la ruta: la rompería entera',
  enlaceRuta([{ ubicacion: ubicacionDe('https://maps.app.goo.gl/W3hfw') }]), null);
{
  // Mezclado: el enlace se descarta y la ruta se monta igual con el resto.
  const mixta = enlaceRuta([
    { ubicacion: ubicacionDe('https://maps.app.goo.gl/W3hfw') },
    { ubicacion: ubicacionDe('41.8046,0.5312') },
  ]);
  cierto('la parada buena entra', mixta.includes('41.8046'));
  cierto('y el enlace se queda fuera', !mixta.includes('goo.gl'));
}
const muchas = Array.from({ length: 15 }, (_, n) => ({ ubicacion: ubicacionDe(`${(41 + n / 100).toFixed(4)},0.5312`) }));
const rutaLarga = enlaceRuta(muchas);
cierto(`no mete más de ${MAX_PARADAS_RUTA} paradas`,
  (rutaLarga.match(/\|/g) || []).length <= MAX_PARADAS_RUTA - 2 + 1);
cierto('una sola parada también vale', !!enlaceRuta([muchas[0]]));

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} bien, ${fallos} mal\n`);
process.exit(fallos === 0 ? 0 : 1);
