#!/usr/bin/env node
/**
 * Tests de la clasificación objetivo · precliente · cliente
 * (src/lib/clasificacion.ts).
 *
 *   node scripts/test-clasificacion.mjs
 *
 * Lo que se fija aquí es qué convierte a alguien en cliente, que es la
 * distinción más importante del negocio: cliente es el que ha FIRMADO. Si esto
 * se afloja, la cartera se llena de "clientes" que no han firmado nada y los
 * números dejan de significar algo.
 */

const {
  clasificacionSugerida, razonSugerencia, hayQueRevisar, repartoPorTipo,
  CLASIFICACIONES, ES_CLASIFICACION, defDe, avance, ORDEN,
} = await import('../src/lib/clasificacion.ts');

let ok = 0, fallos = 0;
const eq = (nombre, real, esperado) => {
  if (JSON.stringify(real) === JSON.stringify(esperado)) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fallos++; console.log(`  ✗ ${nombre}\n      esperado ${JSON.stringify(esperado)}, salió ${JSON.stringify(real)}`); }
};
const cierto = (nombre, v) => eq(nombre, !!v, true);

console.log('\n── Objetivo: todavía es una puerta ──');
eq('sin nada, es objetivo', clasificacionSugerida({}), 'objetivo');
eq('sin suministros, sigue siendo objetivo',
  clasificacionSugerida({ estado_comercial: 'detectado', cups: [] }), 'objetivo');
cierto('...y se explica por qué',
  razonSugerencia({}).includes('puerta'));

console.log('\n── Precliente: nos dio su información ──');
eq('con un CUPS ya es precliente',
  clasificacionSugerida({ cups: [{ estado_cups: 'factura_recibida' }] }), 'precliente');
eq('con la oferta enviada, sigue siendo precliente',
  clasificacionSugerida({ cups: [{ estado_cups: 'oferta_enviada' }] }), 'precliente');
eq('pendiente de firma TODAVÍA no es cliente',
  clasificacionSugerida({ cups: [{ estado_cups: 'pendiente_firma' }] }), 'precliente');
cierto('...y la razón cuenta cuántos suministros hay',
  razonSugerencia({ cups: [{ estado_cups: 'oferta_enviada' }] }).includes('1 suministro'));
cierto('...en plural cuando son varios',
  razonSugerencia({ cups: [{}, {}] }).includes('2 suministros'));

console.log('\n── Cliente: ha firmado ──');
eq('un CUPS con contrato firmado', clasificacionSugerida({ cups: [{ estado_cups: 'contrato_firmado' }] }), 'cliente');
eq('un CUPS activado', clasificacionSugerida({ cups: [{ estado_cups: 'activado' }] }), 'cliente');
eq('un contrato con fecha de firma',
  clasificacionSugerida({ contratos: [{ fecha_firma: '2026-07-24' }] }), 'cliente');
eq('un contrato ya enviado a la comercializadora',
  clasificacionSugerida({ contratos: [{ estado_contrato: 'enviado_comercializadora' }] }), 'cliente');
eq('fotovoltaica vendida también hace cliente',
  clasificacionSugerida({ tiene_fv: true }), 'cliente');
eq('estado comercial activo', clasificacionSugerida({ estado_comercial: 'activo' }), 'cliente');
eq('basta con que UNO de sus suministros esté firmado',
  clasificacionSugerida({ cups: [{ estado_cups: 'sin_factura' }, { estado_cups: 'activado' }] }), 'cliente');
cierto('...y se dice cuál es el motivo',
  razonSugerencia({ contratos: [{ fecha_firma: '2026-07-24' }] }).includes('firma'));

console.log('\n── Un contrato en trámite no basta ──');
eq('preparar el contrato no es firmarlo',
  clasificacionSugerida({ cups: [{ estado_cups: 'pendiente_ofertar' }], contratos: [{ estado_contrato: 'pendiente_preparar' }] }),
  'precliente');
eq('enviárselo al cliente tampoco',
  clasificacionSugerida({ contratos: [{ estado_contrato: 'enviado_cliente' }] }), 'objetivo');

console.log('\n── Cuándo avisar de que no cuadra ──');
cierto('un precliente que ya firmó hay que revisarlo', hayQueRevisar('precliente', 'cliente'));
cierto('un objetivo del que ya tenemos factura, también', hayQueRevisar('objetivo', 'precliente'));
cierto('un cliente cuyo contrato está en papel NO se avisa', !hayQueRevisar('cliente', 'precliente'));
cierto('...ni un precliente al que no le consta nada', !hayQueRevisar('precliente', 'objetivo'));
cierto('si coinciden, nada que revisar', !hayQueRevisar('cliente', 'cliente'));

console.log('\n── El orden del viaje ──');
eq('objetivo, precliente, cliente', ORDEN, ['objetivo', 'precliente', 'cliente']);
cierto('cliente va por delante de precliente', avance('cliente') > avance('precliente'));
cierto('precliente por delante de objetivo', avance('precliente') > avance('objetivo'));

console.log('\n── Las tres definiciones ──');
eq('hay tres y solo tres', CLASIFICACIONES.length, 3);
cierto('todas se explican en una frase', CLASIFICACIONES.every((c) => c.quees.length > 20));
cierto('todas tienen emoji y tono', CLASIFICACIONES.every((c) => c.emoji && c.tono));
cierto('reconoce las válidas', ['objetivo', 'precliente', 'cliente'].every(ES_CLASIFICACION));
cierto('y rechaza lo demás', !ES_CLASIFICACION('activo') && !ES_CLASIFICACION(null) && !ES_CLASIFICACION(''));
eq('una clasificación desconocida cae en precliente, que es lo prudente', defDe('vete a saber').clave, 'precliente');

console.log('\n── Reparto de la cartera ──');
const r = repartoPorTipo([
  { clasificacion: 'cliente' }, { clasificacion: 'cliente' },
  { clasificacion: 'precliente' }, { clasificacion: 'objetivo' },
  { clasificacion: null }, { clasificacion: 'lo que sea' },
]);
eq('cuenta los clientes', r.cliente, 2);
eq('...los preclientes', r.precliente, 1);
eq('...los objetivos', r.objetivo, 1);
eq('...y los que están sin clasificar', r.sin_clasificar, 2);
eq('una cartera vacía no revienta', repartoPorTipo([]).sin_clasificar, 0);

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} bien, ${fallos} mal\n`);
process.exit(fallos === 0 ? 0 : 1);
