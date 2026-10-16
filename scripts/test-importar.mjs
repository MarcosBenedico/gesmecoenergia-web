/**
 * Tests de qué ES cada ficha que entra por la importación.
 *
 * Lo que protegen, con nombre de fallo real:
 *  · «todo entraba como precliente/detectado» — incluidas las filas con fecha
 *    de activación, o sea clientes firmados: la ficha se contradecía sola.
 *  · «la importación degradó a un cliente» — un Excel incompleto no puede
 *    quitarle a nadie la condición de cliente, y menos en silencio.
 *  · «reimportar duplicó las tareas» — la llave tiene que distinguir la misma
 *    acción repetida de una acción nueva del mes siguiente.
 *
 *   node scripts/test-importar.mjs
 */
import {
  clasificacionDeFila, leerClasificacion, clasificacionAGuardar,
  leerEstadoCliente, llaveImportacion,
} from '../src/lib/importar-ficha.ts';
import { ESTADOS_CLIENTE } from '../src/lib/luz.ts';

let ok = 0, fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fallos++; console.log(`  ✗ ${nombre}${detalle ? ` — ${detalle}` : ''}`); }
}
const titulo = (t) => console.log(`\n${t}`);

titulo('Qué se deduce de la fila');
{
  comprueba('una fila con fecha de activación es un CLIENTE',
    clasificacionDeFila({ activacion: true, tieneCups: true }) === 'cliente');
  comprueba('un suministro firmado también',
    clasificacionDeFila({ estadoCups: 'contrato_firmado' }) === 'cliente');
  comprueba('un suministro activado también',
    clasificacionDeFila({ estadoCups: 'activado' }) === 'cliente');
  comprueba('tener CUPS sin firmar es PRECLIENTE',
    clasificacionDeFila({ tieneCups: true, estadoCups: 'factura_recibida' }) === 'precliente');
  comprueba('tener consumo sin CUPS también es precliente',
    clasificacionDeFila({ tieneConsumo: true }) === 'precliente');
  // Un objetivo del mapa y un precliente sin factura se parecen demasiado:
  // adivinarlo mal ensucia el recuento por el que se mira esta columna.
  comprueba('una fila sin nada no se adivina', clasificacionDeFila({}) === null);
}

titulo('Lo que escribe una persona manda');
{
  comprueba('«Cliente» se lee tal cual', leerClasificacion('Cliente') === 'cliente');
  comprueba('«posible cliente» es precliente', leerClasificacion('posible cliente') === 'precliente');
  comprueba('«seguimiento» es precliente', leerClasificacion('seguimiento') === 'precliente');
  comprueba('«prospecto» es objetivo', leerClasificacion('prospecto') === 'objetivo');
  comprueba('lo que no se reconoce no se inventa', leerClasificacion('vete a saber') === null);

  comprueba('lo escrito gana a lo deducido',
    clasificacionAGuardar('objetivo', { activacion: true }, 'cliente') === 'objetivo');
  comprueba('con la casilla vacía se usa la deducción',
    clasificacionAGuardar('', { activacion: true }, 'precliente') === 'cliente');
}

titulo('La deducción no retrocede');
{
  // Degradar a alguien porque su Excel venía incompleto es inventarse una
  // pérdida, y nadie revisa a quién dejó de ser cliente tras una importación.
  comprueba('un cliente no baja a precliente por una fila floja',
    clasificacionAGuardar('', { tieneCups: true }, 'cliente') === null);
  comprueba('un precliente no baja a objetivo',
    clasificacionAGuardar('', {}, 'precliente') === null);
  comprueba('pero sí sube',
    clasificacionAGuardar('', { activacion: true }, 'precliente') === 'cliente');
  comprueba('y una corrección a mano sí puede bajar',
    clasificacionAGuardar('precliente', {}, 'cliente') === 'precliente');
}

titulo('Estado comercial');
{
  comprueba('«Cliente activo» de la exportación es activo',
    leerEstadoCliente('Cliente activo', ESTADOS_CLIENTE) === 'activo');
  comprueba('«Pendiente decisión» con tilde se entiende',
    leerEstadoCliente('Pendiente decisión', ESTADOS_CLIENTE) === 'pendiente_decision');
  comprueba('«Revisar más adelante» también',
    leerEstadoCliente('Revisar más adelante', ESTADOS_CLIENTE) === 'revisar_adelante');
  comprueba('la clave interna vale igual',
    leerEstadoCliente('contacto_iniciado', ESTADOS_CLIENTE) === 'contacto_iniciado');
  comprueba('un estado inventado no entra',
    leerEstadoCliente('medio interesado', ESTADOS_CLIENTE) === null);
  comprueba('vacío es vacío, no un estado por defecto',
    leerEstadoCliente('   ', ESTADOS_CLIENTE) === null);
}

titulo('Llave de idempotencia');
{
  const a = llaveImportacion(['c1', 'accion', 'Llamar', '2026-10-20']);
  comprueba('la misma acción da la misma llave',
    a === llaveImportacion(['c1', 'accion', 'Llamar', '2026-10-20']));
  // Una llave que ignorara la fecha silenciaría el seguimiento del mes que
  // viene sobre el mismo cliente: el mismo fallo que ya costó un repaso en
  // los automatismos con la renovación del año siguiente.
  comprueba('otra fecha es otra acción',
    a !== llaveImportacion(['c1', 'accion', 'Llamar', '2026-11-20']));
  comprueba('otro cliente es otra llave',
    a !== llaveImportacion(['c2', 'accion', 'Llamar', '2026-10-20']));
  comprueba('un hueco vacío no rompe la llave',
    llaveImportacion(['c1', 'accion', 'Llamar', null]).includes('|'));
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} correctas, ${fallos} fallos`);
process.exit(fallos === 0 ? 0 : 1);
