#!/usr/bin/env node
/**
 * Tests del rendimiento del parte (src/lib/parte-rendimiento.ts).
 *
 *   node scripts/test-parte-rendimiento.mjs
 *
 * Lo que se fija aquí es el CRITERIO de qué es un día productivo. Si esto se
 * descuadra, el parte le dirá a Marcos que una tarde rellenando teléfonos vale
 * más que una visita que trajo la factura, y a partir de ese día el número deja
 * de creerse — que es la única forma de que un indicador haga daño.
 */

const {
  aporteDe, puntosDe, rendimientoDelDia, rendimientoPorPersona,
  probabilidadesDeCierre, trabajoPendiente, diasEntre,
  PUNTOS_APORTE, BASE_POR_ESTADO,
} = await import('../src/lib/parte-rendimiento.ts');

let ok = 0, fallos = 0;
const eq = (nombre, real, esperado) => {
  if (JSON.stringify(real) === JSON.stringify(esperado)) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fallos++; console.log(`  ✗ ${nombre}\n      esperado ${JSON.stringify(esperado)}, salió ${JSON.stringify(real)}`); }
};
const cierto = (nombre, v) => eq(nombre, !!v, true);

/** Acción del parte de mentira, con lo justo. */
const acc = (o = {}) => ({
  hora: '10:00', usuario: 'x@y.com', persona: 'Nicola', tabla: 'luz_cups',
  entidad: 'Suministro', emoji: '⚡', titulo: 'ES0031...', cliente: 'Granja X',
  operacion: 'UPDATE', tipo: 'dato', cambios: [], frase: '', ...o,
});
const camb = (campo, tipo = 'dato') => ({ campo, etiqueta: campo, de: '—', a: 'algo', tipo });

console.log('\n QUÉ APORTA CADA ACCIÓN');

eq('cobrar una comisión produce',
  aporteDe(acc({ tabla: 'luz_comisiones', cambios: [camb('importe_cobrado', 'dinero')] })), 'produce');
eq('firmar un contrato produce',
  aporteDe(acc({ tabla: 'luz_contratos', cambios: [camb('fecha_firma', 'dinero')] })), 'produce');
eq('dar de alta un cliente produce',
  aporteDe(acc({ tabla: 'luz_clientes', operacion: 'INSERT', tipo: 'alta' })), 'produce');
eq('resolver una visita produce',
  aporteDe(acc({ tabla: 'luz_visitas', cambios: [camb('resultado')] })), 'produce');

eq('meter el consumo prepara el cierre',
  aporteDe(acc({ cambios: [camb('consumo_anual_kwh')] })), 'prepara');
eq('avanzar el estado prepara el cierre',
  aporteDe(acc({ tipo: 'avance', cambios: [camb('estado_cups', 'avance')] })), 'prepara');
eq('poner la fecha de fin de contrato prepara el cierre',
  aporteDe(acc({ cambios: [camb('fecha_fin_contrato')] })), 'prepara');

eq('corregir el teléfono solo mantiene',
  aporteDe(acc({ cambios: [camb('telefono')] })), 'mantiene');
eq('cambiar las observaciones solo mantiene',
  aporteDe(acc({ cambios: [camb('observaciones')] })), 'mantiene');

eq('un retroceso resta', aporteDe(acc({ tipo: 'retroceso' })), 'retrocede');

// El orden de las comprobaciones importa: si un contrato firmado toca además
// el teléfono, sigue siendo lo que cierra y no mantenimiento.
eq('firmar y de paso tocar el teléfono sigue siendo producir',
  aporteDe(acc({ tabla: 'luz_contratos', cambios: [camb('telefono'), camb('fecha_firma', 'dinero')] })), 'produce');

console.log('\n LA CUENTA NO PREMIA TECLEAR');

const cuarentaDatos = Array.from({ length: 40 }, () => acc({ cambios: [camb('telefono')] }));
const unaVisita = [acc({ tabla: 'luz_visitas', cambios: [camb('resultado')] })];
cierto('40 correcciones de teléfono NO valen más que una visita resuelta',
  puntosDe(cuarentaDatos) < puntosDe(unaVisita) * 5);
eq('40 datos = 40 puntos', puntosDe(cuarentaDatos), 40);
eq('una visita resuelta = 10 puntos', puntosDe(unaVisita), 10);

cierto('perder cosas no sube la nota',
  puntosDe([acc({ tipo: 'retroceso' })]) < 0);

console.log('\n VEREDICTO DEL DÍA');

const dia = (acciones, historico) => rendimientoDelDia(acciones, historico);

eq('sin nada registrado lo dice claro',
  dia([], [10, 20]).veredicto, 'sin_actividad');
cierto('...y no da por hecho que no se trabajó',
  /no se apuntó/i.test(dia([], [10, 20]).porque));

eq('mucho movimiento pero nada que acerque un cierre es flojo',
  dia(cuarentaDatos, [50, 60]).veredicto, 'flojo');
cierto('...y explica que todo fue ordenar datos',
  /ordenar datos/i.test(dia(cuarentaDatos, [50, 60]).porque));

const buenDia = [
  acc({ tabla: 'luz_clientes', operacion: 'INSERT', tipo: 'alta' }),
  acc({ tabla: 'luz_contratos', cambios: [camb('fecha_firma', 'dinero')] }),
  acc({ tabla: 'luz_visitas', cambios: [camb('resultado')] }),
  acc({ cambios: [camb('consumo_anual_kwh')] }),
];
eq('un día por encima del ritmo es productivo', dia(buenDia, [10, 12, 11]).veredicto, 'productivo');
eq('el mismo día sin referencia no se juzga', dia(buenDia, []).veredicto, 'sin_referencia');
cierto('...y lo dice en vez de inventarse una media',
  /no hay días anteriores/i.test(dia(buenDia, []).porque));

eq('un día en la línea sale normal', dia(buenDia, [34, 33, 35]).veredicto, 'normal');

// Los días en blanco no deben hundir la media: un puente haría que el jueves
// siguiente pareciera excepcional sin haber hecho nada distinto.
eq('los días sin actividad no cuentan para la media',
  dia(buenDia, [0, 0, 34, 0, 33]).dias_comparados, 2);
eq('...y la media es la de los días que sí tuvieron algo',
  dia(buenDia, [0, 0, 34, 0, 33]).media_referencia, 33.5);

cierto('los retrocesos se avisan aparte aunque el día sea bueno',
  /hacia atrás/i.test(dia([...buenDia, acc({ tipo: 'retroceso' })], [10, 12]).porque));

eq('el % útil mide cuánto del trabajo movió el negocio',
  dia([...unaVisita, acc({ cambios: [camb('telefono')] })], []).pct_util, 50);

console.log('\n RENDIMIENTO POR PERSONA');

const equipo = rendimientoPorPersona([
  acc({ persona: 'David', tabla: 'luz_visitas', cambios: [camb('resultado')] }),
  acc({ persona: 'Nicola', cambios: [camb('telefono')] }),
  acc({ persona: 'Nicola', cambios: [camb('consumo_anual_kwh')] }),
]);
eq('sale una fila por persona', equipo.length, 2);
eq('ordenado por puntos, no por número de acciones', equipo[0].persona, 'David');
eq('a Nicola se le cuentan sus dos acciones', equipo.find((x) => x.persona === 'Nicola').acciones, 2);
eq('y su mitad útil', equipo.find((x) => x.persona === 'Nicola').pct_util, 50);

console.log('\n PROBABILIDAD DE CIERRE');

const HOY = '2026-07-31';
const opo = (o = {}) => ({
  id: 'o1', cliente_id: 'c1', nombre_oportunidad: 'Luz nave',
  estado: 'oferta_enviada', probabilidad: 60, comision_potencial: 1000,
  actualizado_en: HOY, ...o,
});
const cli = (o = {}) => ({ c1: { nombre: 'Granja X', telefono: '600', email: 'a@b.c', tiene_consumo: true, dias_desde_visita_util: null, ...o } });

const base = probabilidadesDeCierre([opo()], cli(), HOY)[0];
eq('una oferta enviada sin pegas parte del 50', base.probabilidad_estimada, 50);
eq('se respeta lo que puso la persona', base.probabilidad_declarada, 60);
eq('los euros esperados son comisión × probabilidad', base.euros_esperados, 500);
eq('y no la frena nada', base.frena, []);

const sinConsumo = probabilidadesDeCierre([opo()], cli({ tiene_consumo: false }), HOY)[0];
cierto('sin consumo baja la probabilidad', sinConsumo.probabilidad_estimada < base.probabilidad_estimada);
cierto('...y dice por qué', /no se puede ofertar/i.test(sinConsumo.frena.join(' ')));

const parada = probabilidadesDeCierre([opo({ actualizado_en: '2026-06-20' })], cli(), HOY)[0];
eq('una oportunidad parada 41 días lo dice', parada.dias_parado, 41);
cierto('...y le baja la probabilidad', parada.probabilidad_estimada < base.probabilidad_estimada);

const incontactable = probabilidadesDeCierre([opo()], cli({ telefono: null, email: null }), HOY)[0];
cierto('sin forma de contactar baja y lo dice',
  /no hay por dónde contactar/i.test(incontactable.frena.join(' ')));

const conVisita = probabilidadesDeCierre([opo()], cli({ dias_desde_visita_util: 3 }), HOY)[0];
cierto('una visita útil reciente sube la probabilidad',
  conVisita.probabilidad_estimada > base.probabilidad_estimada);

eq('las cerradas no salen',
  probabilidadesDeCierre([opo({ estado: 'ganado' }), opo({ estado: 'perdido' })], cli(), HOY).length, 0);

cierto('la probabilidad nunca pasa del 95',
  probabilidadesDeCierre([opo({ estado: 'pendiente_firma' })], cli({ dias_desde_visita_util: 1 }), HOY)[0].probabilidad_estimada <= 95);
// Un 0 % se lee como «muerta» e invita a cerrar la oportunidad. Las que entran
// aquí están ABIERTAS: no muertas, atascadas. Y eso se desatasca, no se cierra.
eq('una oportunidad abierta y atascada no sale al 0 %',
  probabilidadesDeCierre([opo({ estado: 'prospecto', actualizado_en: '2026-01-01' })], cli({ tiene_consumo: false, telefono: null, email: null }), HOY)[0].probabilidad_estimada, 3);

// Que falte el importe no hace la oportunidad menos real: baja en la lista,
// pero no desaparece.
const conYSin = probabilidadesDeCierre(
  [opo({ id: 'sin', comision_potencial: null }), opo({ id: 'con', comision_potencial: 2000 })],
  cli(), HOY
);
eq('las que no tienen comisión puesta siguen saliendo', conYSin.length, 2);
eq('...pero después de las que sí', conYSin[0].id, 'con');

console.log('\n TRABAJO PENDIENTE DE DÍAS ANTERIORES');

const pend = (o = {}) => ({ cliente: 'Granja X', que: 'Llamar', origen: 'tarea', para: '2026-07-28', ...o });

const t = trabajoPendiente([pend()], HOY);
eq('lo vencido dentro de la ventana sale', t.items.length, 1);
eq('con sus días de retraso', t.items[0].dias_retraso, 3);

eq('lo de hoy todavía no está pendiente',
  trabajoPendiente([pend({ para: HOY })], HOY).items.length, 0);
eq('lo de mañana tampoco',
  trabajoPendiente([pend({ para: '2026-08-05' })], HOY).items.length, 0);
eq('lo que no tiene fecha no está retrasado, está sin planificar',
  trabajoPendiente([pend({ para: null })], HOY).items.length, 0);

const viejo = trabajoPendiente([pend({ para: '2026-06-01' })], HOY);
eq('lo de hace más de 7 días no se lista', viejo.items.length, 0);
eq('...pero NO se esconde: se cuenta', viejo.mas_viejos, 1);

const varios = trabajoPendiente(
  [pend({ para: '2026-07-30', cliente: 'B' }), pend({ para: '2026-07-25', cliente: 'A' })],
  HOY
);
eq('lo más atrasado primero', varios.items[0].cliente, 'A');

eq('la ventana se puede cambiar y se dice cuál es', trabajoPendiente([], HOY, 3).ventana_dias, 3);

console.log('\n FECHAS');
eq('días entre dos fechas', diasEntre('2026-07-24', '2026-07-31'), 7);
eq('el mismo día son 0', diasEntre(HOY, HOY), 0);
eq('hacia atrás sale negativo', diasEntre('2026-08-02', HOY), -2);

console.log(`\n${fallos === 0 ? '✅' : '❌'}  ${ok} pasan, ${fallos} fallan\n`);
process.exit(fallos === 0 ? 0 : 1);
