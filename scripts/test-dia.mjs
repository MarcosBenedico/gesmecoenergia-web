/**
 * Tests del reparto del día en Mi Día: qué se aparta por viejo y en qué orden
 * sale lo que se queda.
 *
 * Lo que se está protegiendo aquí es una cosa muy concreta: que el número
 * grande de la pantalla sea un número que se pueda hacer. La cartera de julio
 * de 2026 metió 74 líneas de golpe al comercial y la pantalla marcaba 74
 * cuando su ritmo demostrado son 9 puertas al día.
 *
 *   node --experimental-strip-types scripts/test-dia.mjs
 */
import { partirPorAtraso, ordenarDia, UMBRALES_ATRASO } from '../src/lib/agenda.ts';

let ok = 0, fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fallos++; console.log(`  ✗ ${nombre}${detalle ? ` — ${detalle}` : ''}`); }
}
const titulo = (t) => console.log(`\n${t}`);

/** Línea de agenda mínima: solo lo que miran estas funciones. */
const linea = (clave, dias, alta, prioridad = 'C') => ({
  clave, dias, alta, prioridad,
  origen: 'tarea', id: clave, tipo: 'llamada', tipoLabel: 'Llamada', tono: '',
  titulo: clave, detalle: null, fecha: null, urgencia: 'vencido',
  responsable: 'Sales', estado: 'pendiente', clienteId: null, clienteNombre: null,
  cupsId: null, cupsTexto: null, editable: true,
});

titulo('Apartar lo viejo');
{
  const items = [
    linea('hoy', 0, '2026-07-01'),
    linea('retraso-3', -3, '2026-07-01'),
    linea('retraso-7', -7, '2026-07-01'),
    linea('retraso-8', -8, '2026-07-01'),
    linea('retraso-17', -17, '2026-07-01'),
  ];

  const r7 = partirPorAtraso(items, 7);
  comprueba('con corte a 7, lo de 8 y 17 días se aparca',
    r7.aparcado.map((i) => i.clave).sort().join(',') === 'retraso-17,retraso-8',
    r7.aparcado.map((i) => i.clave).join(','));
  comprueba('con corte a 7, lo de exactamente 7 días se queda arriba',
    r7.activo.some((i) => i.clave === 'retraso-7'));

  const r30 = partirPorAtraso(items, 30);
  comprueba('con corte a 30 no se aparca nada de esta cartera (era el problema)',
    r30.aparcado.length === 0 && r30.activo.length === 5);

  const r3 = partirPorAtraso(items, 3);
  comprueba('con corte a 3 se aparcan tres y quedan dos',
    r3.aparcado.length === 3 && r3.activo.length === 2);

  comprueba('no se pierde ni se duplica ninguna línea en ningún corte',
    UMBRALES_ATRASO.every((u) => {
      const r = partirPorAtraso(items, u);
      const claves = [...r.activo, ...r.aparcado].map((i) => i.clave).sort().join(',');
      return r.activo.length + r.aparcado.length === items.length
        && claves === items.map((i) => i.clave).sort().join(',');
    }));
}

titulo('Lo que vence hoy nunca se aparta');
{
  // Registro viejo de verdad, pero que vence hoy: hoy es su día.
  const items = [linea('vieja-pero-de-hoy', 0, '2026-01-01')];
  const r = partirPorAtraso(items, 3);
  comprueba('un registro de enero que vence hoy se queda arriba',
    r.activo.length === 1 && r.aparcado.length === 0);
}

titulo('Lo que aún no ha vencido tampoco se aparta');
{
  const items = [linea('futura', 5, '2026-01-01')];
  const r = partirPorAtraso(items, 3);
  comprueba('días positivos (futuro) no cuentan como retraso',
    r.activo.length === 1 && r.aparcado.length === 0);
}

titulo('Orden por llegada (el de por defecto)');
{
  const items = [
    linea('nueva-A', -1, '2026-08-05', 'A'),
    linea('vieja-C', -1, '2026-07-09', 'C'),
    linea('media-B', -1, '2026-07-23', 'B'),
  ];
  const orden = ordenarDia(items).map((i) => i.clave);
  comprueba('lo que entró antes va primero, aunque sea prioridad C',
    orden.join(',') === 'vieja-C,media-B,nueva-A', orden.join(','));

  comprueba('es el orden por defecto (sin pasar modo sale el mismo)',
    ordenarDia(items).map((i) => i.clave).join(',')
      === ordenarDia(items, 'entrada').map((i) => i.clave).join(','));

  const porUrg = ordenarDia(items, 'urgencia').map((i) => i.clave);
  comprueba('el orden por urgencia sigue disponible y pone al cliente A delante',
    porUrg[0] === 'nueva-A', porUrg.join(','));
}

titulo('Empates y datos que faltan');
{
  // Una importación mete decenas de filas con el mismo creado_en: ahí el
  // desempate tiene que ser el retraso, o el orden queda al azar.
  const items = [
    linea('poco-retraso', -1, '2026-07-15'),
    linea('mucho-retraso', -9, '2026-07-15'),
  ];
  comprueba('con la misma fecha de alta manda lo más vencido',
    ordenarDia(items).map((i) => i.clave).join(',') === 'mucho-retraso,poco-retraso');

  const conNulos = [
    linea('sin-alta', -5, null),
    linea('con-alta', -1, '2026-07-20'),
  ];
  comprueba('lo que no tiene fecha de alta va al final, pero no se pierde',
    ordenarDia(conNulos).map((i) => i.clave).join(',') === 'con-alta,sin-alta');
}

titulo('No muta la lista original');
{
  const items = [linea('b', -1, '2026-08-01'), linea('a', -1, '2026-07-01')];
  const antes = items.map((i) => i.clave).join(',');
  ordenarDia(items);
  partirPorAtraso(items, 7);
  comprueba('ordenar y partir dejan la lista de entrada intacta',
    items.map((i) => i.clave).join(',') === antes);
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} bien, ${fallos} mal\n`);
process.exit(fallos === 0 ? 0 : 1);
