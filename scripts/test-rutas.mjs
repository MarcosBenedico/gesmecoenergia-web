#!/usr/bin/env node
/**
 * Tests del plan de rutas y del montador de rutas
 * (src/lib/plan-rutas.ts y src/lib/ruta-optima.ts).
 *
 *   node scripts/test-rutas.mjs
 *
 * Lo que se fija aquí es que el plan sea REALISTA. Un plan que pide diez puertas
 * en un día de Fraga no se cumple, y en cuanto se incumple dos veces se deja de
 * mirar. Y que las oportunidades de paso se midan contra el recorrido y no
 * contra las paradas, que es lo que hace que salgan gratis.
 */

const {
  planDelDia, planDeLaSemana, cicloCompleto, objetivoSemanal, letraCiclo,
  esDiaDeCalle, semanaISO, OBJETIVOS, DIAS_DE_CALLE, SEMANAS_CICLO,
} = await import('../src/lib/plan-rutas.ts');
const {
  ordenarPorCercania, kmRuta, minutosConduciendo, cabeEnLaManana,
  oportunidadesDePaso, enlaceRutaOptima, COORD_OFICINA, MAX_PARADAS,
} = await import('../src/lib/ruta-optima.ts');

let ok = 0, fallos = 0;
const eq = (nombre, real, esperado) => {
  if (JSON.stringify(real) === JSON.stringify(esperado)) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fallos++; console.log(`  ✗ ${nombre}\n      esperado ${JSON.stringify(esperado)}, salió ${JSON.stringify(real)}`); }
};
const cierto = (nombre, v) => eq(nombre, !!v, true);

// Lunes 27 de julio de 2026 y los días de esa semana
const L = new Date(2026, 6, 27), M = new Date(2026, 6, 28), X = new Date(2026, 6, 29),
      J = new Date(2026, 6, 30), V = new Date(2026, 6, 31), S = new Date(2026, 7, 1);

console.log('\n── Qué día es de calle ──');
eq('los días de calle son martes, miércoles y jueves', DIAS_DE_CALLE, [2, 3, 4]);
cierto('el martes sí', esDiaDeCalle(M));
cierto('el miércoles sí', esDiaDeCalle(X));
cierto('el jueves sí', esDiaDeCalle(J));
cierto('el lunes no', !esDiaDeCalle(L));
cierto('el viernes no', !esDiaDeCalle(V));
cierto('el sábado tampoco', !esDiaDeCalle(S));

console.log('\n── El lunes y el viernes son de oficina ──');
eq('lunes: teléfono y preparar', planDelDia(L).tipo, 'oficina');
cierto('...y lo explica', planDelDia(L).porque.includes('rutas ya están puestas'));
eq('viernes: cerrar y firmar', planDelDia(V).tipo, 'oficina');
cierto('...y dice que no se prospecta', /no se prospecta/i.test(planDelDia(V).porque));
eq('un día de oficina no pide puertas', planDelDia(L).objetivos.puertas, 0);

console.log('\n── El fin de semana no es día de trabajo ──');
// Antes el sábado y el domingo heredaban el viernes y salía «cerrar y firmar»
// en domingo. Eso le quita credibilidad a todo lo que diga la pantalla.
eq('el sábado es descanso', planDelDia(S).tipo, 'descanso');
eq('...y el domingo también', planDelDia(new Date(2026, 7, 2)).tipo, 'descanso');
eq('...y lo dice sin rodeos', planDelDia(S).que, 'Hoy no toca');
cierto('...recordando que la jornada la respeta también el jefe',
  /el jefe/.test(planDelDia(S).porque));
eq('no pide ninguna puerta', planDelDia(S).objetivos.puertas, 0);
eq('el viernes SÍ sigue siendo de cerrar', planDelDia(V).que, 'Cerrar y firmar');

console.log('\n── Cada día de calle tiene su zona puesta ──');
for (const [nombre, f] of [['martes', M], ['miércoles', X], ['jueves', J]]) {
  const p = planDelDia(f);
  cierto(`el ${nombre} tiene zona asignada`, !!p.zonaId);
  cierto(`...y dice por qué esa zona`, p.porque.length > 20);
}
eq('el miércoles es el día largo', planDelDia(X).tipo, 'lejos');
cierto('...y avisa de que se almuerza allí', planDelDia(X).franja.includes('almuerza'));

console.log('\n── Los objetivos son realistas: menos puertas si hay más carretera ──');
cierto('un día cercano pide más puertas que uno lejano',
  OBJETIVOS.cerca.puertas > OBJETIVOS.lejos.puertas);
cierto('...y el medio queda entre los dos',
  OBJETIVOS.media.puertas < OBJETIVOS.cerca.puertas && OBJETIVOS.media.puertas > OBJETIVOS.lejos.puertas);
cierto('en el campo se buscan más cubiertas para Óscar',
  OBJETIVOS.lejos.cubiertas > OBJETIVOS.cerca.cubiertas);
eq('el día lejano pide 7 puertas, no 10', planDelDia(X).objetivos.puertas, 7);

console.log('\n── La semana ──');
const semana = planDeLaSemana(M);
eq('salen los cinco laborables', semana.length, 5);
eq('...empezando en lunes', semana[0].nombre, 'Lunes');
eq('...y acabando en viernes', semana[4].nombre, 'Viernes');
eq('tres días de calle por semana', semana.filter((d) => d.tipo !== 'oficina').length, 3);
const obj = objetivoSemanal(M);
cierto('el objetivo semanal ronda las 26 puertas', obj.puertas >= 24 && obj.puertas <= 28);
cierto('...y sale de sumar los tres días',
  obj.puertas === semana.reduce((s, d) => s + d.objetivos.puertas, 0));
eq('cualquier día de la semana da el mismo plan semanal',
  planDeLaSemana(J).map((d) => d.zonaId), semana.map((d) => d.zonaId));

console.log('\n── La rotación de tres semanas ──');
eq('el ciclo es de tres semanas', SEMANAS_CICLO, 3);
const ciclo = cicloCompleto();
eq('el ciclo completo trae tres semanas', ciclo.length, 3);
const zonasDelCiclo = ciclo.flatMap((s) => s.dias.filter((d) => d.zonaId).map((d) => d.zonaId));
eq('nueve salidas en el ciclo', zonasDelCiclo.length, 9);
eq('...y ninguna zona se queda sin pisar', new Set(zonasDelCiclo).size, 7);
const veces = {};
for (const z of zonasDelCiclo) veces[z] = (veces[z] || 0) + 1;
eq('Binéfar se pisa dos veces por ciclo', veces.binefar, 2);
eq('...y Tamarite también', veces['tamarite-alcampell'], 2);
eq('Fraga, que está lejos, una vez', veces['alcarras-fraga'], 1);
cierto('las semanas van rotando la letra',
  new Set(ciclo.map((s) => s.semana)).size === 3);
cierto('la semana ISO se calcula', semanaISO(M) > 0 && semanaISO(M) <= 53);
cierto('la letra es A, B o C', ['A', 'B', 'C'].includes(letraCiclo(M)));

console.log('\n── Ordenar la ruta por cercanía ──');
// Puestas a propósito en mal orden: lejos, cerca, medio
const paradas = [
  { clave: 'lejos', nombre: 'Fraga', coords: { lat: 41.52, lon: 0.35 } },
  { clave: 'cerca', nombre: 'Binéfar', coords: { lat: 41.855, lon: 0.30 } },
  { clave: 'medio', nombre: 'Tamarite', coords: { lat: 41.87, lon: 0.43 } },
];
const orden = ordenarPorCercania(paradas);
eq('empieza por la más cercana a la oficina', orden[0].clave, 'cerca');
eq('...y sigue por la siguiente más próxima', orden[1].clave, 'medio');
eq('...dejando la lejana al final', orden[2].clave, 'lejos');

const conSinCoords = ordenarPorCercania([
  ...paradas, { clave: 'sinsitio', nombre: 'Sin dirección', coords: null },
]);
eq('las que no tienen coordenadas van al final, pero no se pierden',
  conSinCoords[conSinCoords.length - 1].clave, 'sinsitio');
eq('sin paradas no revienta', ordenarPorCercania([]).length, 0);

console.log('\n── Kilómetros y si cabe la mañana ──');
const km = kmRuta(orden);
cierto('cuenta ida, paradas y vuelta a la oficina', km > 70);
eq('sin coordenadas no hay kilómetros', kmRuta([{ clave: 'x', nombre: 'X', coords: null }]), 0);
cierto('los minutos crecen con los kilómetros',
  minutosConduciendo(60) > minutosConduciendo(20));
const cabe = cabeEnLaManana([paradas[1], paradas[2]]);
cierto('dos paradas cerca caben de sobra', cabe.cabe);
const noCabe = cabeEnLaManana(Array.from({ length: 14 }, (_, n) => ({
  clave: `p${n}`, nombre: `P${n}`, coords: { lat: 41.5 + n / 20, lon: 0.3 + n / 20 },
})));
cierto('catorce paradas repartidas por la comarca NO caben', !noCabe.cabe);
cierto('...y dice cuántos minutos se pasa', noCabe.sobran < 0);

console.log('\n── Oportunidades de paso: gratis porque ya vas ──');
const rutaTamarite = [
  { clave: 'a', nombre: 'Cliente Tamarite', coords: { lat: 41.87, lon: 0.43 } },
];
const prospectos = [
  // Mismas coordenadas a propósito: así el desvío es idéntico y lo que decide
  // el orden es la puntuación, que es justo lo que se quiere comprobar.
  { id: 'p1', lat: 41.862, lon: 0.36, puntuacion: 80 },
  { id: 'p2', lat: 41.862, lon: 0.36, puntuacion: 95 },
  { id: 'p3', lat: 41.20, lon: 0.90, puntuacion: 99 },    // lejísimos
];
const cerca = oportunidadesDePaso(rutaTamarite, prospectos);
eq('solo las que están de paso', cerca.length, 2);
cierto('...ninguna se desvía más de lo permitido', cerca.every((c) => c.km_desvio <= 2.5));
eq('a igual desvío, primero la de más puntuación', cerca[0].prospecto.id, 'p2');
eq('sin paradas no se propone nada', oportunidadesDePaso([], prospectos).length, 0);
eq('se puede apretar el margen',
  oportunidadesDePaso(rutaTamarite, prospectos, { kmMax: 0.05 }).length, 0);
eq('y limitar cuántas se enseñan',
  oportunidadesDePaso(rutaTamarite, prospectos, { tope: 1 }).length, 1);
cierto('se mide contra el RECORRIDO, no contra la parada',
  // p1 está a ~6 km de la parada de Tamarite, pero casi encima del camino
  oportunidadesDePaso(rutaTamarite, [prospectos[0]]).length === 1);

console.log('\n── El enlace de Google ──');
const url = enlaceRutaOptima(orden);
cierto('sale de la oficina', url.includes('origin=Av.'));
cierto('y vuelve a la oficina', url.includes('destination=Av.'));
cierto('deja que Google optimice el orden', url.includes('optimize%3Atrue'));
cierto('va en coche', url.includes('travelmode=driving'));
eq('sin paradas no hay enlace', enlaceRutaOptima([]), null);
cierto('sin vuelta, el destino es la última parada',
  !enlaceRutaOptima(orden, { volver: false }).includes('destination=Av.'));
const muchas = Array.from({ length: 16 }, (_, n) => ({
  clave: `p${n}`, nombre: `P${n}`, coords: { lat: 41 + n / 100, lon: 0.5 },
}));
cierto(`no manda más de ${MAX_PARADAS} paradas`,
  (enlaceRutaOptima(muchas).match(/%7C/g) || []).length <= MAX_PARADAS);
cierto('una parada sin coordenadas se manda por dirección',
  // URLSearchParams codifica el espacio como '+'; Google lo acepta igual.
  /Calle(\+|%20)Mayor/.test(
    enlaceRutaOptima([{ clave: 'd', nombre: 'X', coords: null, direccion: 'Calle Mayor 4, Binéfar' }])));

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} bien, ${fallos} mal\n`);
process.exit(fallos === 0 ? 0 : 1);
