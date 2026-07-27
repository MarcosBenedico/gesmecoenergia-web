#!/usr/bin/env node
/**
 * Tests del optimizador de potencias y de la lectura de la curva
 * (src/lib/potencia.ts).
 *
 *   node scripts/test-potencia.mjs
 *
 * Lo que se fija aquí es EL CRITERIO, y en este módulo el criterio tiene
 * consecuencias en dinero ajeno: si el optimizador recomienda una potencia
 * demasiado baja, el cliente empieza a pagar penalizaciones por exceso el mes
 * siguiente y la culpa es nuestra. Por eso hay tantos tests sobre «no bajar por
 * debajo de lo medido» y sobre la confianza del resultado.
 */

const {
  optimizarPotencias, demandaPorPeriodo, penalizacionExcesos, proximoCambioPotencia,
  periodoDeHora, esFestivoNacional, perfilDeCurva, diagnosticarReactiva,
  precioPotenciaDia, PRECIOS_POTENCIA_REFERENCIA, KE_EXCESO_EUR_KW, MARGEN_PRUDENTE,
} = await import('../src/lib/potencia.ts');

let ok = 0, fallos = 0;
const eq = (nombre, real, esperado) => {
  if (JSON.stringify(real) === JSON.stringify(esperado)) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fallos++; console.log(`  ✗ ${nombre}\n      esperado ${JSON.stringify(esperado)}, salió ${JSON.stringify(real)}`); }
};
const cierto = (nombre, v) => eq(nombre, !!v, true);
const cerca = (nombre, real, esperado, tol = 0.01) => {
  if (Math.abs(real - esperado) <= tol) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fallos++; console.log(`  ✗ ${nombre}\n      esperado ~${esperado}, salió ${real}`); }
};

/** Lecturas de maxímetro: un año entero de un CUPS que tiene potencia de sobra. */
const lecturasSobradas = [];
for (let mes = 1; mes <= 12; mes++) {
  const f = `2025-${String(mes).padStart(2, '0')}-15`;
  // Nunca pasa de 40 kW en ningún periodo, pero tiene 100 kW contratados
  lecturasSobradas.push(
    { periodo: 1, potencia_kw: 38, fecha: f }, { periodo: 2, potencia_kw: 36, fecha: f },
    { periodo: 3, potencia_kw: 30, fecha: f }, { periodo: 4, potencia_kw: 28, fecha: f },
    { periodo: 5, potencia_kw: 22, fecha: f }, { periodo: 6, potencia_kw: 20, fecha: f },
  );
}

const precios30 = precioPotenciaDia('3.0');

console.log('\n── Demanda por periodo ──');
const d = demandaPorPeriodo(
  [
    { periodo: 1, potencia_kw: 30 }, { periodo: 1, potencia_kw: 45 }, { periodo: 1, potencia_kw: 12 },
    { periodo: 3, potencia_kw: 20 },
    { periodo: 9, potencia_kw: 999 },   // periodo que no existe: se ignora
    { periodo: 2, potencia_kw: 0 },     // un cero no es una lectura
    { periodo: 2, potencia_kw: NaN },   // basura tampoco
  ],
  6
);
eq('se queda con el máximo de cada periodo', d.max, [45, 0, 20, 0, 0, 0]);
eq('cuenta cuántas lecturas lo sostienen', d.cuenta, [3, 0, 1, 0, 0, 0]);

console.log('\n── Lo que sobra: el caso que paga el módulo ──');
const sobrada = optimizarPotencias({
  tarifa: '3.0',
  potencias_contratadas: [100, 100, 100, 100, 100, 100],
  precios_potencia: precios30,
  lecturas: lecturasSobradas,
  fuente: 'maximetro',
  dias_analizados: 365,
});
cierto('detecta ahorro cuando sobra potencia', sobrada.ahorro_anual > 0);
eq('la confianza es alta con un año de maxímetros', sobrada.confianza, 'alta');
cierto('ningún periodo queda por debajo de lo medido',
  sobrada.periodos.every((p) => p.recomendada_kw >= p.maxima_medida_kw));
cerca('P1 se recomienda con el margen prudente sobre 38 kW',
  sobrada.periodos[0].recomendada_kw, 38 * (1 + MARGEN_PRUDENTE), 0.05);
eq('nadie está en exceso', sobrada.periodos.filter((p) => p.en_exceso).length, 0);
cierto('el ahorro cuadra con la diferencia de coste',
  Math.abs(sobrada.ahorro_anual - (sobrada.coste_actual_anual - sobrada.coste_optimo_anual)) < 0.02);

console.log('\n── Nunca bajar a ciegas ──');
const sinDatosEnP1 = optimizarPotencias({
  tarifa: '3.0',
  potencias_contratadas: [80, 80, 80, 80, 80, 80],
  precios_potencia: precios30,
  // No hay ni una lectura de P1
  lecturas: lecturasSobradas.filter((l) => l.periodo !== 1),
  fuente: 'maximetro',
  dias_analizados: 365,
});
eq('un periodo sin lecturas se deja como está', sinDatosEnP1.periodos[0].recomendada_kw, 80);
eq('...y no se le apunta ahorro', sinDatosEnP1.periodos[0].ahorro_anual, 0);
cierto('...y se avisa de que falta ese periodo',
  sinDatosEnP1.avisos.some((a) => a.includes('P1')));
eq('...y la confianza baja a media', sinDatosEnP1.confianza, 'media');

console.log('\n── Curva horaria: sirve para el perfil, no para apurar ──');
const desdeCurva = optimizarPotencias({
  tarifa: '3.0',
  potencias_contratadas: [100, 100, 100, 100, 100, 100],
  precios_potencia: precios30,
  lecturas: lecturasSobradas,
  fuente: 'curva_horaria',
  dias_analizados: 365,
});
eq('la confianza es baja si la demanda viene de la curva', desdeCurva.confianza, 'baja');
cierto('...y se dice por qué, en cristiano',
  desdeCurva.avisos.some((a) => /aplana los picos/i.test(a)));

console.log('\n── Cuando el consejo es SUBIR ──');
const corto = optimizarPotencias({
  tarifa: '3.0',
  potencias_contratadas: [30, 30, 30, 30, 30, 30],
  precios_potencia: precios30,
  // 38 kW medidos en P1 contra 30 kW contratados: se está pasando
  lecturas: lecturasSobradas,
  fuente: 'maximetro',
  dias_analizados: 365,
});
cierto('marca los periodos en exceso', corto.periodos[0].en_exceso);
cierto('avisa de que ahí hay que subir, no bajar',
  corto.avisos.some((a) => /SUBIR/.test(a)));
cierto('estima penalización', corto.penalizacion_estimada > 0);
eq('no inventa ahorro donde falta potencia', corto.periodos[0].ahorro_anual, 0);

console.log('\n── Penalización por excesos ──');
eq('sin excesos no hay penalización',
  penalizacionExcesos([{ periodo: 1, potencia_kw: 20 }], [30, 30, 30, 30, 30, 30]), 0);
cerca('un exceso de 10 kW cuesta el coeficiente por 10',
  penalizacionExcesos([{ periodo: 1, potencia_kw: 40 }], [30, 30, 30, 30, 30, 30]),
  KE_EXCESO_EUR_KW * 10);
eq('una potencia contratada a cero no se considera',
  penalizacionExcesos([{ periodo: 2, potencia_kw: 50 }], [30, 0, 0, 0, 0, 0]), 0);

console.log('\n── Anualizar ──');
const tresMeses = optimizarPotencias({
  tarifa: '3.0',
  potencias_contratadas: [30, 30, 30, 30, 30, 30],
  precios_potencia: precios30,
  lecturas: [{ periodo: 1, potencia_kw: 40, fecha: '2025-01-15' }],
  fuente: 'maximetro',
  dias_analizados: 90,
});
cerca('la penalización de 90 días se lleva a 365',
  tresMeses.penalizacion_estimada, (KE_EXCESO_EUR_KW * 10 * 365) / 90, 0.05);
cierto('...y se avisa de que el rango es corto',
  tresMeses.avisos.some((a) => /90 días/.test(a)));
eq('...y la confianza no puede ser alta', tresMeses.confianza, 'media');

console.log('\n── ¿Es la tarifa que toca? ──');
const pequeno = optimizarPotencias({
  tarifa: '3.0',
  potencias_contratadas: [20, 20, 20, 20, 20, 20],
  precios_potencia: precios30,
  lecturas: [1, 2, 3, 4, 5, 6].flatMap((p) => [
    { periodo: p, potencia_kw: 9, fecha: '2025-03-15' },
    { periodo: p, potencia_kw: 10, fecha: '2025-07-15' },
  ]),
  fuente: 'maximetro',
  dias_analizados: 365,
});
eq('una 3.0TD que nunca pasa de 15 kW debería ser 2.0TD', pequeno.cambio_tarifa?.a, '2.0');

const grande = optimizarPotencias({
  tarifa: '2.0',
  potencias_contratadas: [15, 15],
  precios_potencia: precioPotenciaDia('2.0'),
  lecturas: [{ periodo: 1, potencia_kw: 24, fecha: '2025-07-15' }, { periodo: 2, potencia_kw: 12, fecha: '2025-07-15' }],
  fuente: 'maximetro',
  dias_analizados: 365,
});
eq('una 2.0TD que se pasa de 15 kW debería ser 3.0TD', grande.cambio_tarifa?.a, '3.0');
eq('la 2.0TD solo tiene dos periodos de potencia', grande.periodos.length, 2);

const normal = optimizarPotencias({
  tarifa: '3.0',
  potencias_contratadas: [100, 100, 100, 100, 100, 100],
  precios_potencia: precios30,
  lecturas: lecturasSobradas,
  fuente: 'maximetro',
  dias_analizados: 365,
});
eq('con potencias normales no se propone cambiar de tarifa', normal.cambio_tarifa, null);

console.log('\n── La potencia solo se cambia una vez al año ──');
const hoy = new Date('2026-07-26T00:00:00Z');
cierto('un contrato de hace 3 meses todavía no puede tocarse',
  proximoCambioPotencia('2026-05-01', hoy) === '2027-05-01');
eq('uno de hace dos años sí', proximoCambioPotencia('2024-01-10', hoy), null);
eq('sin fecha de inicio no se afirma nada', proximoCambioPotencia(null, hoy), null);
eq('una fecha corrupta no revienta', proximoCambioPotencia('vete-a-saber', hoy), null);

console.log('\n── Calendario de periodos (3.0TD / 6.1TD) ──');
eq('enero a las 10:00 es P1 (temporada alta, punta)', periodoDeHora('2026-01-15', '10:00', '3.0'), 1);
eq('enero a las 08:00 es P2 (temporada alta, llano)', periodoDeHora('2026-01-15', '08:00', '3.0'), 2);
eq('la madrugada siempre es P6', periodoDeHora('2026-01-15', '03:00', '3.0'), 6);
eq('el sábado entero es P6', periodoDeHora('2026-01-17', '10:00', '3.0'), 6);
eq('marzo a las 10:00 es P2 (media-alta)', periodoDeHora('2026-03-18', '10:00', '3.0'), 2);
eq('junio a las 10:00 es P3 (media)', periodoDeHora('2026-06-15', '10:00', '3.0'), 3);
eq('abril a las 10:00 es P4 (baja)', periodoDeHora('2026-04-15', '10:00', '3.0'), 4);
eq('abril a las 08:00 es P5 (baja, llano)', periodoDeHora('2026-04-15', '08:00', '3.0'), 5);

console.log('\n── Calendario 2.0TD ──');
eq('11:00 de un jueves es punta', periodoDeHora('2026-01-15', '11:00', '2.0'), 1);
eq('09:00 es llano', periodoDeHora('2026-01-15', '09:00', '2.0'), 2);
eq('03:00 es valle', periodoDeHora('2026-01-15', '03:00', '2.0'), 3);
eq('el domingo es valle todo el día', periodoDeHora('2026-01-18', '11:00', '2.0'), 3);

console.log('\n── Festivos nacionales ──');
cierto('Año Nuevo', esFestivoNacional('2026-01-01'));
cierto('la Hispanidad', esFestivoNacional('2026-10-12'));
cierto('Navidad', esFestivoNacional('2026-12-25'));
cierto('Viernes Santo de 2026 (3 de abril)', esFestivoNacional('2026-04-03'));
cierto('un martes cualquiera no lo es', !esFestivoNacional('2026-04-07'));
eq('un festivo cae en P6 aunque sea hora punta', periodoDeHora('2026-01-01', '11:00', '3.0'), 6);

console.log('\n── Perfil de la curva ──');
// Un día completo: 2 kWh cada hora de noche, 10 kWh cada hora de sol
const unDia = [];
for (let h = 0; h < 24; h++) {
  const solar = h >= 8 && h < 18;
  unDia.push({
    fecha: '2026-01-15',
    hora: `${String(h).padStart(2, '0')}:00`,
    consumo_kwh: solar ? 10 : 2,
    metodo: h === 5 ? 'Estimada' : 'Real',
  });
}
const perfil = perfilDeCurva(unDia, '3.0');
eq('suma el total', perfil.total_kwh, 10 * 10 + 14 * 2);
eq('cuenta un día', perfil.dias_con_dato, 1);
eq('cobertura del 100 % con las 24 horas', perfil.cobertura_pct, 100);
eq('cuenta las horas estimadas', perfil.horas_estimadas, 1);
cerca('el % en horas de sol sale de los kWh, no de las horas',
  perfil.pct_horas_solares, (100 / 128) * 100, 0.1);
eq('la punta horaria es el máximo de kWh en una hora', perfil.punta_horaria_kw, 10);
cierto('los porcentajes por periodo suman ~100',
  Math.abs(perfil.pct_por_periodo.reduce((a, b) => a + b, 0) - 100) < 0.5);
eq('la media por hora tiene 24 valores', perfil.media_por_hora.length, 24);

const conHuecos = perfilDeCurva(unDia.slice(0, 12), '3.0');
cerca('media jornada da media cobertura', conHuecos.cobertura_pct, 50, 0.1);

console.log('\n── Reactiva ──');
const mala = diagnosticarReactiva(500, 1000); // tan φ = 0,5
cierto('tan φ 0,5 penaliza', mala.penaliza);
cerca('...y el cos φ sale sobre 0,894', mala.cos_phi, 0.894, 0.005);
cierto('...y el mensaje manda mirar los condensadores', /condensadores/i.test(mala.mensaje));

const buena = diagnosticarReactiva(200, 1000); // tan φ = 0,2
cierto('tan φ 0,2 no penaliza', !buena.penaliza);
cierto('...y lo dice sin dar trabajo de más', /Nada que hacer/i.test(buena.mensaje));

const vacia = diagnosticarReactiva(100, 0);
cierto('sin energía activa no se inventa un factor de potencia', !vacia.penaliza);
eq('...y lo dice', vacia.cos_phi, 1);

console.log('\n── Precios de referencia ──');
eq('la 3.0TD tiene seis precios de potencia', PRECIOS_POTENCIA_REFERENCIA['3.0'].length, 6);
eq('la 2.0TD tiene dos', PRECIOS_POTENCIA_REFERENCIA['2.0'].length, 2);
cierto('P1 es el periodo más caro en 3.0TD',
  PRECIOS_POTENCIA_REFERENCIA['3.0'][0] === Math.max(...PRECIOS_POTENCIA_REFERENCIA['3.0']));
cierto('P6 es el más barato',
  PRECIOS_POTENCIA_REFERENCIA['3.0'][5] === Math.min(...PRECIOS_POTENCIA_REFERENCIA['3.0']));
cerca('de €/kW·año a €/kW·día se divide entre 365',
  precioPotenciaDia('3.0')[0], PRECIOS_POTENCIA_REFERENCIA['3.0'][0] / 365, 1e-9);

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} bien, ${fallos} mal\n`);
process.exit(fallos === 0 ? 0 : 1);
