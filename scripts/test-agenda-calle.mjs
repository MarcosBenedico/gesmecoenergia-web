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
  municipioDe, coordsDe, queLeFalta, enriquecerParaCalle, agruparPorZona,
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
eq('las minúsculas se respetan bien', municipioDe('22500, BINEFAR'), 'Binefar');
eq('sin código postal no se inventa nada', municipioDe('Calle de la Iglesia 4'), null);
eq('sin dirección tampoco', municipioDe(null, '', undefined), null);
eq('si la primera no vale, prueba la siguiente',
  municipioDe(null, 'Polígono 3, 22535, Esplús, Huesca'), 'Esplús');
eq('un número detrás del CP no es un municipio', municipioDe('22500 4 bajo'), null);

console.log('\n── Coordenadas dentro de un texto ──');
eq('de un enlace de Google Maps',
  coordsDe('https://maps.google.com/?q=41.834091,0.534880'), { lat: 41.834091, lon: 0.534880 });
eq('separadas por barra', coordsDe('41.9542572/0.2995116'), { lat: 41.9542572, lon: 0.2995116 });
eq('un texto sin coordenadas', coordsDe('Calle Mayor 4'), null);
eq('una latitud imposible se descarta', coordsDe('99.99999,0.53488'), null);

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
  enlaceMapa({ coords: { lat: 41.8, lon: 0.5 }, direccion: 'Calle X' }).includes('41.8,0.5'));
cierto('...y la dirección si no',
  enlaceMapa({ coords: null, direccion: 'Calle Mayor 4' }).includes('Calle%20Mayor%204'));
eq('sin nada, no hay mapa', enlaceMapa({ coords: null, direccion: null }), null);

console.log('\n── La ruta: lo que convierte la lista en una mañana ──');
const ruta = enlaceRuta(ric.filter((i) => i.ubicable));
cierto('sale de la oficina', ruta.includes('origin=Av.'));
cierto('tiene destino', ruta.includes('destination='));
eq('sin paradas ubicables no hay ruta', enlaceRuta([]), null);
const muchas = Array.from({ length: 15 }, (_, n) => ({ coords: { lat: 41 + n / 100, lon: 0.5 }, direccion: null }));
const rutaLarga = enlaceRuta(muchas);
cierto(`no mete más de ${MAX_PARADAS_RUTA} paradas`,
  (rutaLarga.match(/\|/g) || []).length <= MAX_PARADAS_RUTA - 2 + 1);
cierto('una sola parada también vale', !!enlaceRuta([muchas[0]]));

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} bien, ${fallos} mal\n`);
process.exit(fallos === 0 ? 0 : 1);
