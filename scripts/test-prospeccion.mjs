#!/usr/bin/env node
/**
 * Tests de la lógica de prospección (src/lib/prospeccion.ts).
 *
 *   node scripts/test-prospeccion.mjs
 *
 * Sin red: comprueba geometría y puntuación con casos conocidos, sobre el
 * TypeScript real que corre en producción. Sale con código 1 si algo falla.
 */

const {
  areaPoligono, dentroDe, distKm, kmALaRuta, kmAlTramo, kwpDesdeArea, tejadoDesdeArea,
  puntuar, nivelInteres, centroDe, clasificar, procesarElementos,
} = await import('../src/lib/prospeccion.ts');

let ok = 0, fallos = 0;
const eq = (nombre, real, esperado, tol = 0) => {
  const bien = tol ? Math.abs(real - esperado) <= tol : real === esperado;
  if (bien) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fallos++; console.log(`  ✗ ${nombre}\n      esperado ${esperado}, salió ${real}`); }
};
const cierto = (nombre, v) => eq(nombre, !!v, true);

console.log('\n── Geometría ──');
// Cuadrado de ~100 m de lado cerca de Binéfar (41.85 N)
const d = 100 / 111132;                       // grados de latitud en 100 m
const dLon = 100 / (111320 * Math.cos(41.85 * Math.PI / 180));
const cuadrado = [
  { lat: 41.85, lon: 0.29 },
  { lat: 41.85 + d, lon: 0.29 },
  { lat: 41.85 + d, lon: 0.29 + dLon },
  { lat: 41.85, lon: 0.29 + dLon },
];
eq('cuadrado de 100 m → ~10.000 m²', Math.round(areaPoligono(cuadrado)), 10000, 200);
eq('polígono de 2 puntos no tiene área', areaPoligono(cuadrado.slice(0, 2)), 0);

cierto('el centro del cuadrado cae dentro', dentroDe({ lat: 41.8504, lon: 0.2905 }, cuadrado));
cierto('un punto lejano cae fuera', !dentroDe({ lat: 41.9, lon: 0.4 }, cuadrado));

eq('Binéfar → Tamarite son ~11 km', Math.round(distKm({ lat: 41.85, lon: 0.294 }, { lat: 41.87, lon: 0.43 })), 11, 2);

const ruta = [{ lat: 41.85, lon: 0.294 }, { lat: 41.87, lon: 0.43 }];
eq('desvío desde un punto de la propia ruta = 0', Math.round(kmALaRuta({ lat: 41.87, lon: 0.43 }, ruta)), 0);
cierto('el desvío usa la parada más cercana, no la primera',
  kmALaRuta({ lat: 41.869, lon: 0.429 }, ruta) < 1);

// El fallo que dejaba la búsqueda a cero: medir solo a las paradas descartaba
// justo lo que se ve por la ventanilla a mitad de trayecto.
const mitad = { lat: (41.85 + 41.87) / 2, lon: (0.294 + 0.43) / 2 };
cierto('un sitio a pie de ruta a mitad de camino cuenta como "de paso"', kmALaRuta(mitad, ruta) < 0.2);
cierto('...aunque esté a más de 5 km de las dos paradas',
  Math.min(distKm(mitad, ruta[0]), distKm(mitad, ruta[1])) > 5);
eq('un punto sobre el tramo está a 0', Math.round(kmAlTramo(mitad, ruta[0], ruta[1]) * 100) / 100, 0, 0.05);
cierto('la proyección no se sale del tramo',
  kmAlTramo({ lat: 41.85, lon: 0.1 }, ruta[0], ruta[1]) > 15);

console.log('\n── Dónde está cada elemento (Overpass cambia de formato) ──');
eq('con center', centroDe({ type: 'way', id: 1, center: { lat: 41.8, lon: 0.3 } }).lat, 41.8);
eq('un nodo suelto lleva lat/lon propios', centroDe({ type: 'node', id: 1, lat: 41.8, lon: 0.3 }).lat, 41.8);
// Al pedir `geom`, Overpass manda bounds y NO center: si no se cubre, se cae todo en silencio
eq('con bounds (que es lo que llega al pedir geometría)',
  centroDe({ type: 'way', id: 1, bounds: { minlat: 41.8, minlon: 0.3, maxlat: 41.9, maxlon: 0.4 } }).lat, 41.85, 0.001);
eq('sin nada de eso, no hay sitio', centroDe({ type: 'way', id: 1 }), null);

console.log('\n── Clasificación ──');
eq('parcela de granja', clasificar({ landuse: 'farmyard' }), 'granja');
eq('nave de ganado', clasificar({ building: 'cowshed' }), 'granja');
eq('almacén', clasificar({ building: 'warehouse' }), 'nave');
eq('suelo industrial', clasificar({ landuse: 'industrial' }), 'industrial');
eq('una vivienda no interesa', clasificar({ building: 'house' }), null);
eq('un edificio a secas queda por clasificar', clasificar({ building: 'yes' }), 'edificio_grande');

console.log('\n── Tejado y kWp ──');
eq('un edificio es todo tejado', tejadoDesdeArea(1000, false), 1000);
eq('de una parcela solo cuenta lo construido', tejadoDesdeArea(1000, true), 250);
eq('nave de 1.000 m² → ~109 kWp', kwpDesdeArea(1000, false), 109);
// El caso que motivó la corrección: una parcela de granja de 23.734 m²
eq('granja de 23.734 m² de recinto NO son 2.500 kWp', kwpDesdeArea(23734, true), 647);
eq('sin superficie no hay estimación', kwpDesdeArea(0, false), 0);

console.log('\n── Puntuación ──');
const base = {
  id: 'way/1', nombre: null, lat: 41.85, lon: 0.294, km_desvio: 0,
  ya_tiene_placas: false, municipio: null,
};
const granja = puntuar({ ...base, tipo: 'granja', area_m2: 20000, es_parcela: true }, 2);
const tienda = puntuar({ ...base, tipo: 'comercio', area_m2: 120, es_parcela: false }, 2);
cierto('una granja grande de paso puntúa más que una tienda pequeña', granja.puntuacion > tienda.puntuacion);
cierto('la granja entra en "merece la pena"', nivelInteres(granja.puntuacion).tono === 'alto');
cierto('siempre se explica por qué', granja.motivos.length >= 2);

const lejos = puntuar({ ...base, tipo: 'granja', area_m2: 20000, es_parcela: true, km_desvio: 2 }, 2);
cierto('desviarse resta', lejos.puntuacion < granja.puntuacion);

const conPlacas = puntuar({ ...base, tipo: 'granja', area_m2: 20000, es_parcela: true, ya_tiene_placas: true }, 2);
cierto('quien ya tiene placas baja mucho', conPlacas.puntuacion < granja.puntuacion - 30);
cierto('pero no desaparece del todo', conPlacas.puntuacion > 0);
cierto('y se avisa de por qué', conPlacas.motivos.some((m) => m.includes('ya figura con placas')));

const conNombre = puntuar({ ...base, tipo: 'nave', area_m2: 800, es_parcela: false, nombre: 'Cárnicas X' }, 2);
const sinNombre = puntuar({ ...base, tipo: 'nave', area_m2: 800, es_parcela: false }, 2);
cierto('tener nombre en el mapa suma', conNombre.puntuacion > sinNombre.puntuacion);

cierto('la puntuación nunca se sale de 0-100',
  [granja, tienda, lejos, conPlacas, conNombre].every((r) => r.puntuacion >= 0 && r.puntuacion <= 100));

cierto('de una parcela NO se da un kWp como bueno', !granja.kwp_fiable);
cierto('de un tejado medido sí', puntuar({ ...base, tipo: 'nave', area_m2: 900, es_parcela: false }, 2).kwp_fiable);
cierto('y en el motivo de la parcela se dice que hay que ir a verlo',
  granja.motivos.some((m) => m.includes('hay que verla')));

console.log('\n── Filtrado del conjunto ──');
const pueblo = [
  { lat: 41.849, lon: 0.293 }, { lat: 41.851, lon: 0.293 },
  { lat: 41.851, lon: 0.296 }, { lat: 41.849, lon: 0.296 },
];
const gordo = (n) => Array.from({ length: n }, (_, i) => ({
  lat: 41.85 + i * 0.0002, lon: 0.294 + (i % 2) * 0.0002,
}));
const salida = procesarElementos([
  { type: 'way', id: 1, tags: { landuse: 'residential' }, geometry: pueblo },
  // Bloque de pisos dentro del casco urbano: no es una nave
  { type: 'way', id: 2, tags: { building: 'yes' }, bounds: { minlat: 41.8499, minlon: 0.2939, maxlat: 41.8501, maxlon: 0.2951 } },
  // Granja de camino, con nombre
  { type: 'way', id: 3, tags: { building: 'cowshed', name: 'Granja Test' }, bounds: { minlat: 41.8600, minlon: 0.3600, maxlat: 41.8606, maxlon: 0.3610 } },
  // Otra nave de la MISMA granja, 300 m más allá
  { type: 'way', id: 4, tags: { building: 'cowshed', name: 'Granja Test' }, bounds: { minlat: 41.8630, minlon: 0.3600, maxlat: 41.8634, maxlon: 0.3608 } },
  // El recinto del polígono entero: no es un cliente
  { type: 'way', id: 5, tags: { landuse: 'industrial' }, geometry: gordo(4).concat([{ lat: 41.87, lon: 0.30 }, { lat: 41.87, lon: 0.29 }]) },
], ruta, 2);

cierto('el bloque de pisos del pueblo se descarta', !salida.some((p) => p.id === 'way/2'));
eq('la granja repetida cuenta una sola vez', salida.filter((p) => p.nombre === 'Granja Test').length, 1);
cierto('la granja de camino sí sale', salida.some((p) => p.nombre === 'Granja Test'));
cierto('no se cuela el recinto del polígono entero',
  !salida.some((p) => p.id === 'way/5' && p.area_m2 > 30000));

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} correctos, ${fallos} fallos\n`);
process.exit(fallos === 0 ? 0 : 1);
