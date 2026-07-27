#!/usr/bin/env node
/**
 * Tests de qué desencadena cada resultado de visita (src/lib/visitas.ts).
 *
 *   node scripts/test-visitas.mjs
 *
 * Estas reglas son las que enlazan la calle con el resto del sistema: si una
 * se rompe, David sigue visitando pero la agenda deja de rellenarse sola o el
 * mapa vuelve a proponer lo ya descartado, y nadie se entera hasta semanas
 * después. Por eso están fijadas aquí.
 */

const {
  RESULTADOS_VISITA, DEF_RESULTADOS, fechaEnDias,
  consumoAnualDesdeFactura, notaDeVisita, resumenConsecuencia,
} = await import('../src/lib/visitas.ts');

let ok = 0, fallos = 0;
const eq = (nombre, real, esperado) => {
  if (JSON.stringify(real) === JSON.stringify(esperado)) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fallos++; console.log(`  ✗ ${nombre}\n      esperado ${JSON.stringify(esperado)}, salió ${JSON.stringify(real)}`); }
};
const cierto = (nombre, v) => eq(nombre, !!v, true);

console.log('\n── Los cuatro resultados ──');
eq('son cuatro, ni uno más', RESULTADOS_VISITA.length, 4);
cierto('todos tienen su definición', RESULTADOS_VISITA.every((r) => !!DEF_RESULTADOS[r]));
cierto('todos dicen qué va a pasar antes de pulsarlos',
  RESULTADOS_VISITA.every((r) => DEF_RESULTADOS[r].consecuencia.length > 10));
cierto('todos traen una nota por defecto, para no obligar a escribir',
  RESULTADOS_VISITA.every((r) => DEF_RESULTADOS[r].notaPorDefecto.length > 3));

console.log('\n── Lo que arrastra cada uno ──');
// Sin esto, lo que David rechaza vuelve a salir en el mapa a la semana
cierto('"no le interesa" descarta la oportunidad del mapa', DEF_RESULTADOS.no_interesa.descartarProspecto);
eq('...y cierra la oportunidad del pipeline', DEF_RESULTADOS.no_interesa.estadoPipeline, 'perdido');
cierto('...y no programa volver', DEF_RESULTADOS.no_interesa.diasParaVolver === null);

cierto('"no estaba" NO descarta nada: no dijeron que no', !DEF_RESULTADOS.no_estaba.descartarProspecto);
cierto('...pero deja apuntado volver a pasar', DEF_RESULTADOS.no_estaba.diasParaVolver > 0);
cierto('...sin tocar el pipeline, porque no hay noticia nueva', DEF_RESULTADOS.no_estaba.estadoPipeline === null);

cierto('"volver otro día" mantiene viva la oportunidad', !DEF_RESULTADOS.volver.descartarProspecto);
eq('...y la pone en seguimiento', DEF_RESULTADOS.volver.estadoPipeline, 'seguimiento');

cierto('"me dio la factura" pide la foto', DEF_RESULTADOS.factura.pideFactura);
eq('...y avanza el pipeline a factura recibida', DEF_RESULTADOS.factura.estadoPipeline, 'factura_recibida');
cierto('solo la factura abre la cámara',
  RESULTADOS_VISITA.filter((r) => DEF_RESULTADOS[r].pideFactura).length === 1);

console.log('\n── Fechas ──');
const hoy = new Date('2026-07-25T10:00:00Z');
eq('a 3 días', fechaEnDias(3, hoy), '2026-07-28');
eq('a 15 días', fechaEnDias(15, hoy), '2026-08-09');
eq('cambio de mes', fechaEnDias(10, new Date('2026-01-25T10:00:00Z')), '2026-02-04');
eq('cambio de año', fechaEnDias(10, new Date('2026-12-28T10:00:00Z')), '2027-01-07');

console.log('\n── Consumo desde la factura ──');
// El lector devuelve el consumo MENSUAL por periodo; el anual es la suma × 12
eq('2.0TD con tres periodos', consumoAnualDesdeFactura([300, 200, 100]), 7200);
eq('un solo periodo', consumoAnualDesdeFactura([1000]), 12000);
eq('se redondea a centenas, que es toda la precisión que hay',
  consumoAnualDesdeFactura([333, 111]) % 100, 0);
eq('sin datos no se inventa nada', consumoAnualDesdeFactura(null), null);
eq('una lista vacía tampoco', consumoAnualDesdeFactura([]), null);
eq('todo a cero no es un consumo', consumoAnualDesdeFactura([0, 0]), null);

console.log('\n── Notas ──');
eq('si no escribe nada, se pone la de por defecto',
  notaDeVisita('no_estaba', ''), DEF_RESULTADOS.no_estaba.notaPorDefecto);
eq('si solo escribe espacios, igual',
  notaDeVisita('no_estaba', '   '), DEF_RESULTADOS.no_estaba.notaPorDefecto);
eq('lo que escriba manda', notaDeVisita('volver', 'Vuelve en septiembre'), 'Vuelve en septiembre');

cierto('al volver se dice la fecha concreta, no "en 15 días"',
  resumenConsecuencia('volver', '2026-09-10').includes('septiembre'));
cierto('los demás explican su consecuencia',
  resumenConsecuencia('no_interesa').includes('mapa'));

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} correctos, ${fallos} fallos\n`);
process.exit(fallos === 0 ? 0 : 1);
