#!/usr/bin/env node
/**
 * Tests de los huecos de la cartera (src/lib/huecos.ts).
 *
 *   node scripts/test-huecos.mjs
 *
 * Lo que se fija aquí es el CRITERIO de qué falta y en qué orden se rellena. Si
 * esto se descuadra, Nicola abre la pantalla y ve cuarenta emails vacíos por
 * delante de cinco fechas de fin de contrato, que es lo contrario de ayudarla:
 * las fechas paran la Agenda entera y los emails no paran nada.
 */

const {
  detectarHuecos, resumenHuecos, estaVacio, normalizarValor, DEFINICIONES,
} = await import('../src/lib/huecos.ts');

let ok = 0, fallos = 0;
const eq = (nombre, real, esperado) => {
  if (JSON.stringify(real) === JSON.stringify(esperado)) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fallos++; console.log(`  ✗ ${nombre}\n      esperado ${JSON.stringify(esperado)}, salió ${JSON.stringify(real)}`); }
};
const cierto = (nombre, v) => eq(nombre, !!v, true);

console.log('\n── Qué cuenta como vacío ──');
cierto('null', estaVacio(null));
cierto('cadena vacía', estaVacio(''));
cierto('solo espacios', estaVacio('   '));
cierto('una raya, que es como se guarda "no hay"', estaVacio('-'));
cierto('un cero en un consumo no es un consumo', estaVacio(0));
cierto('array vacío', estaVacio([]));
cierto('array de ceros', estaVacio([0, 0, 0]));
cierto('un texto sí vale', !estaVacio('Endesa'));
cierto('un número sí vale', !estaVacio(145000));
cierto('las potencias sí valen', !estaVacio([30, 30]));

console.log('\n── Detección ──');
const clientes = [
  { id: 'c1', nombre: 'Granja Norte', telefono: null, nif: 'B22000001', responsable: 'David', estado_comercial: 'activo' },
  { id: 'c2', nombre: 'Talleres Sur', telefono: null, nif: null, responsable: null, estado_comercial: 'en analisis' },
  { id: 'c3', nombre: 'Perdido SL', telefono: null, nif: null, responsable: null, estado_comercial: 'perdido' },
];
const cups = [
  { id: 's1', cups: 'ES0001', cliente_id: 'c1', fecha_fin_contrato: null, consumo_anual_kwh: 0, distribuidora: 'e-dis', estado_cups: 'pendiente_ofertar' },
  { id: 's2', cups: 'ES0002', cliente_id: 'c2', fecha_fin_contrato: '2027-04-30', consumo_anual_kwh: 145000, distribuidora: null, estado_cups: 'factura_recibida' },
  { id: 's3', cups: 'ES0003', cliente_id: 'c2', fecha_fin_contrato: null, consumo_anual_kwh: null, distribuidora: null, estado_cups: 'perdido' },
];
const huecos = detectarHuecos({ clientes, cups, nombresCliente: { c1: 'Granja Norte', c2: 'Talleres Sur' } });
const por = (clave) => huecos.find((h) => h.clave === clave);

eq('los clientes perdidos no cuentan', por('cli_telefono').cuantos, 2);
eq('...ni los CUPS perdidos', por('cups_fin_contrato').cuantos, 1);
eq('un consumo a 0 se detecta como que falta', por('cups_consumo').cuantos, 1);
eq('el que sí tiene distribuidora no sale', por('cups_distribuidora').cuantos, 1);
cierto('un campo sin ningún hueco no aparece', !por('cli_email') || por('cli_email').cuantos > 0);

console.log('\n── El orden: lo que desbloquea, primero ──');
cierto('la fecha de fin de contrato va por delante del email',
  huecos.findIndex((h) => h.clave === 'cups_fin_contrato') < huecos.findIndex((h) => h.clave === 'cli_email'));
cierto('el teléfono va por delante de la persona de contacto',
  huecos.findIndex((h) => h.clave === 'cli_telefono') < huecos.findIndex((h) => h.clave === 'cli_contacto'));
cierto('el consumo va por delante de la dirección del suministro',
  huecos.findIndex((h) => h.clave === 'cups_consumo') < huecos.findIndex((h) => h.clave === 'cups_direccion'));

console.log('\n── Cada hueco se explica solo ──');
cierto('todos dicen para qué sirve', huecos.every((h) => h.porque.length > 25));
cierto('todos traen las filas que hay que rellenar', huecos.every((h) => h.filas.length === h.cuantos));
cierto('todas las definiciones tienen peso y porqué',
  DEFINICIONES.every((d) => d.peso > 0 && d.porque && d.etiqueta));

const fin = por('cups_fin_contrato');
eq('la fila se reconoce por su CUPS', fin.filas[0].titulo, 'ES0001');
eq('...y dice de quién es', fin.filas[0].contexto, 'Granja Norte');
const tel = por('cli_telefono');
eq('el cliente se reconoce por su nombre', tel.filas[0].titulo, 'Granja Norte');

console.log('\n── Porcentajes ──');
eq('2 de 2 clientes vivos sin teléfono es el 100%', por('cli_telefono').pct, 100);
eq('1 de 2 CUPS vivos sin distribuidora es el 50%', por('cups_distribuidora').pct, 50);

console.log('\n── Resumen ──');
const r = resumenHuecos(huecos);
cierto('cuenta los campos con hueco', r.campos > 0);
eq('...y las celdas que hay que rellenar', r.celdas, huecos.reduce((s, h) => s + h.cuantos, 0));
eq('el más urgente es el primero', r.masUrgente.clave, huecos[0].clave);
eq('sin huecos no hay más urgente', resumenHuecos([]).masUrgente, null);

console.log('\n── Normalizar lo que se teclea ──');
eq('un consumo con puntos de miles', normalizarValor('numero', '145.000'), 145000);
eq('...y con coma decimal', normalizarValor('numero', '1.234,5'), 1234.5);
eq('...y con la unidad pegada', normalizarValor('numero', '145000 kWh'), 145000);
eq('un teléfono con espacios y puntos', normalizarValor('telefono', '974 00 11 22'), '9740011 22'.replace(' ', ''));
eq('...uno demasiado corto no vale', normalizarValor('telefono', '974'), null);
eq('una fecha en español', normalizarValor('fecha', '30/04/2027'), '2027-04-30');
eq('...con un solo dígito', normalizarValor('fecha', '5/1/2027'), '2027-01-05');
eq('...ya en ISO se respeta', normalizarValor('fecha', '2027-04-30'), '2027-04-30');
eq('...una fecha inventada no pasa', normalizarValor('fecha', 'la semana que viene'), null);
eq('el texto se limpia de espacios', normalizarValor('texto', '  Endesa  '), 'Endesa');
eq('vacío es null, no cadena vacía', normalizarValor('texto', '   '), null);

console.log('\n── La clasificación es el hueco que más pesa ──');
// Sin saber quién es cliente de verdad no se sabe ni cuántos clientes hay, así
// que va por delante de cualquier otro dato que falte.
const sinClasificar = detectarHuecos({
  clientes: [{ id: 'c1', nombre: 'X', telefono: '974 000 000', estado_comercial: 'activo' }],
  cups: [],
});
eq('un cliente sin clasificar sale', sinClasificar.find((h) => h.clave === 'cli_clasificacion')?.cuantos, 1);
eq('...y es el primero de la lista', sinClasificar[0].clave, 'cli_clasificacion');
eq('...con las tres opciones puestas',
  sinClasificar[0].opciones, ['objetivo', 'precliente', 'cliente']);
cierto('...y explicando que cliente es el que ha firmado',
  /FIRMADO/i.test(sinClasificar[0].porque));
eq('uno ya clasificado no sale', detectarHuecos({
  clientes: [{ id: 'c1', nombre: 'X', clasificacion: 'cliente', telefono: '974 000 000', estado_comercial: 'activo' }],
  cups: [],
}).find((h) => h.clave === 'cli_clasificacion'), undefined);

console.log('\n── Cartera limpia ──');
eq('sin huecos, lista vacía', detectarHuecos({
  clientes: [{ id: 'c1', nombre: 'X', clasificacion: 'cliente', telefono: '974', nif: 'B1', responsable: 'D', direccion_fiscal: 'C/ 1', persona_contacto: 'P', email: 'a@b.c', estado_comercial: 'activo' }],
  cups: [],
}).length, 0);
eq('sin datos tampoco revienta', detectarHuecos({ clientes: [], cups: [] }).length, 0);

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} bien, ${fallos} mal\n`);
process.exit(fallos === 0 ? 0 : 1);
