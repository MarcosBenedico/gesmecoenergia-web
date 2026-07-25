#!/usr/bin/env node
/**
 * Tests de la prospección (src/lib/prospeccion.ts + consumo-estimado.ts).
 *
 *   node scripts/test-prospeccion.mjs
 *
 * Sin red. Varios casos vienen de fallos reales encontrados probando el motor
 * contra datos de OpenStreetMap de la Litera: están marcados como tales para
 * que nadie los "simplifique" sin saber qué rompe.
 */

const {
  areaPoligono, dentroDe, distKm, kmALaRuta, kmAlTramo, dimensionesNave, pareceNave,
  centroDe, procesarElementos, puntuar, nivelInteres,
} = await import('../src/lib/prospeccion.ts');
const { estimarConsumo, tramoConsumo, textoRango } = await import('../src/lib/consumo-estimado.ts');

let ok = 0, fallos = 0;
const eq = (nombre, real, esperado, tol = 0) => {
  const bien = tol ? Math.abs(real - esperado) <= tol : JSON.stringify(real) === JSON.stringify(esperado);
  if (bien) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fallos++; console.log(`  ✗ ${nombre}\n      esperado ${JSON.stringify(esperado)}, salió ${JSON.stringify(real)}`); }
};
const cierto = (nombre, v) => eq(nombre, !!v, true);

/** Rectángulo de largo×ancho metros, girado `giro` grados, centrado en lat/lon. */
function rect(lat, lon, largo, ancho, giro = 0) {
  const mLat = 111132, mLon = 111320 * Math.cos((lat * Math.PI) / 180);
  const a = (giro * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  return [[-largo / 2, -ancho / 2], [largo / 2, -ancho / 2], [largo / 2, ancho / 2], [-largo / 2, ancho / 2]]
    .map(([x, y]) => ({ lat: lat + (x * sa + y * ca) / mLat, lon: lon + (x * ca - y * sa) / mLon }));
}
const nave = (id, lat, lon, largo, ancho, giro = 0, tags = { building: 'yes' }) =>
  ({ type: 'way', id, tags, geometry: rect(lat, lon, largo, ancho, giro) });

console.log('\n── Geometría ──');
eq('cuadrado de 100 m → ~10.000 m²', Math.round(areaPoligono(rect(41.85, 0.29, 100, 100))), 10000, 300);
cierto('el centro cae dentro del polígono', dentroDe({ lat: 41.85, lon: 0.29 }, rect(41.85, 0.29, 100, 100)));
cierto('un punto lejano cae fuera', !dentroDe({ lat: 41.9, lon: 0.4 }, rect(41.85, 0.29, 100, 100)));
eq('Binéfar → Tamarite son ~11 km', Math.round(distKm({ lat: 41.85, lon: 0.294 }, { lat: 41.87, lon: 0.43 })), 11, 2);

const ruta = [{ lat: 41.85, lon: 0.294 }, { lat: 41.87, lon: 0.43 }];
// FALLO REAL: midiendo solo a las paradas, lo que se ve por la ventanilla a
// mitad de trayecto quedaba fuera y la búsqueda devolvía casi nada.
const mitad = { lat: 41.86, lon: 0.362 };
cierto('un sitio a pie de ruta a mitad de camino cuenta como "de paso"', kmALaRuta(mitad, ruta) < 0.2);
cierto('...aunque esté a más de 5 km de las dos paradas',
  Math.min(distKm(mitad, ruta[0]), distKm(mitad, ruta[1])) > 5);
cierto('la proyección no se sale del tramo', kmAlTramo({ lat: 41.85, lon: 0.1 }, ruta[0], ruta[1]) > 15);

console.log('\n── Medidas reales de la nave ──');
// FALLO REAL: con la caja norte-sur, una nave girada parecía cuadrada.
const d0 = dimensionesNave(rect(41.85, 0.29, 80, 16, 0));
const d45 = dimensionesNave(rect(41.85, 0.29, 80, 16, 45));
eq('nave sin girar: 80 × 16', [d0.largo, d0.ancho], [80, 16], 0);
cierto('nave girada 45°: sigue midiendo 80 × 16', Math.abs(d45.largo - 80) <= 3 && Math.abs(d45.ancho - 16) <= 3);
cierto('una nave de cebo (73×16) parece nave', pareceNave({ largo: 73, ancho: 16 }));
cierto('una casa (12×10) no', !pareceNave({ largo: 12, ancho: 10 }));
cierto('un cobertizo corto (20×8) no', !pareceNave({ largo: 20, ancho: 8 }));

console.log('\n── Dónde está cada elemento (Overpass cambia de formato) ──');
eq('con center', centroDe({ type: 'way', id: 1, center: { lat: 41.8, lon: 0.3 } }).lat, 41.8);
// FALLO REAL: al pedir `geom`, Overpass manda bounds y NO center. Sin cubrirlo
// la búsqueda devolvía cero sin explicar por qué.
eq('con bounds (lo que llega al pedir geometría)',
  centroDe({ type: 'way', id: 1, bounds: { minlat: 41.8, minlon: 0.3, maxlat: 41.9, maxlon: 0.4 } }).lat, 41.85, 0.001);
eq('sin nada de eso, no hay sitio', centroDe({ type: 'way', id: 1 }), null);

console.log('\n── Consumo estimado ──');
const cIntensiva = estimarConsumo('granja_intensiva', 8112);
cierto('una granja de 8.112 m² da un rango, no un número', cIntensiva.min < cIntensiva.max);
cierto('el centro está dentro del rango', cIntensiva.centro > cIntensiva.min && cIntensiva.centro < cIntensiva.max);
cierto('una granja consume más que un almacén de los mismos metros',
  estimarConsumo('granja_intensiva', 2000).centro > estimarConsumo('nave_almacen', 2000).centro);
eq('sin metros no se inventa nada', estimarConsumo('granja_intensiva', 0), null);
eq('el riego no depende de los metros construidos', estimarConsumo('riego', 5000), null);
cierto('el texto del rango se lee', /kWh\/año/.test(textoRango(cIntensiva)));
cierto('más consumo pesa más', tramoConsumo(400000).peso > tramoConsumo(20000).peso);

console.log('\n── Puntuación ──');
const base = { id: 'way/1', nombre: null, lat: 41.85, lon: 0.294, km_desvio: 0, n_edificios: 4,
  nave_mayor: { largo: 80, ancho: 16 }, tiene_balsa: true, ya_tiene_placas: false, municipio: null,
  m2_construidos: 4000, consumo: estimarConsumo('granja_intensiva', 4000) };

const granja = puntuar(base, 2);
const almacen = puntuar({ ...base, tiene_balsa: false, n_edificios: 1, nave_mayor: null,
  consumo: estimarConsumo('nave_almacen', 4000) }, 2);
cierto('a igualdad de metros, la granja gana al almacén', granja.puntuacion > almacen.puntuacion);
cierto('se dice de dónde sale el consumo', granja.motivos.some((m) => m.includes('estimación')));
cierto('la granja entra en "merece la pena"', nivelInteres(granja.puntuacion).tono === 'alto');
cierto('desviarse resta', puntuar({ ...base, km_desvio: 2 }, 2).puntuacion < granja.puntuacion);
cierto('quien ya tiene placas baja mucho',
  puntuar({ ...base, ya_tiene_placas: true }, 2).puntuacion < granja.puntuacion - 30);
cierto('la puntuación nunca se sale de 0-100',
  [granja, almacen].every((r) => r.puntuacion >= 0 && r.puntuacion <= 100));

console.log('\n── Detección sobre el conjunto ──');
// Granja intensiva aislada: 4 naves paralelas + balsa. El patrón de la zona,
// que en OSM casi nunca viene etiquetado como granja.
const granjaOSM = [
  nave(1, 41.8600, 0.3620, 75, 16), nave(2, 41.8603, 0.3620, 75, 16),
  nave(3, 41.8606, 0.3620, 75, 16), nave(4, 41.8609, 0.3620, 75, 16),
  { type: 'way', id: 5, tags: { natural: 'water', water: 'basin' }, geometry: rect(41.8596, 0.3624, 60, 40) },
];
const rGranja = procesarElementos(granjaOSM, ruta, 2);
eq('las 4 naves y la balsa son UN sitio, no cinco', rGranja.length, 1);
eq('se reconoce como granja intensiva aunque no lo diga el mapa', rGranja[0]?.tipo, 'granja_intensiva');
cierto('detecta la balsa', rGranja[0]?.tiene_balsa);
cierto('mide la nave mayor', rGranja[0]?.nave_mayor?.largo >= 70);
cierto('avisa de mirar si ya tiene placas en la foto',
  rGranja[0]?.que_mirar.some((m) => m.includes('placas')));

// FALLO REAL: una manzana de casas adosadas —largas, estrechas y pegadas— salió
// como "granja intensiva" la primera de la lista, con 730 MWh estimados. Y el
// complejo del Servicio Aragonés de Salud, también. El casco urbano no siempre
// está dibujado, así que lo que separa el campo del pueblo es estar SOLO.
const manzana = [];
for (let i = 0; i < 40; i++) {
  manzana.push(nave(100 + i, 41.8500 + (i % 8) * 0.0004, 0.3000 + Math.floor(i / 8) * 0.0006, 60, 12));
}
const rManzana = procesarElementos(manzana, [{ lat: 41.8500, lon: 0.3000 }, { lat: 41.8530, lon: 0.3030 }], 2);
cierto('40 edificios pegados NO son granjas intensivas',
  !rManzana.some((p) => p.tipo === 'granja_intensiva'));
cierto('en pleno casco urbano no se propone nada', rManzana.length <= 2);

// Un centro de salud no es un cliente de puerta fría
const sanitario = procesarElementos(
  [{ type: 'way', id: 900, tags: { building: 'yes', amenity: 'hospital' }, geometry: rect(41.86, 0.362, 120, 40) }],
  ruta, 2
);
eq('los equipamientos públicos se descartan', sanitario.length, 0);

// Una vivienda grande aislada tampoco
const casa = procesarElementos([{ type: 'way', id: 901, tags: { building: 'house' }, geometry: rect(41.86, 0.362, 30, 20) }], ruta, 2);
eq('las viviendas se descartan', casa.length, 0);

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} correctos, ${fallos} fallos\n`);
process.exit(fallos === 0 ? 0 : 1);
