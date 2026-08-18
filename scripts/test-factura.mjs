/**
 * Tests de la REVISIÓN DE LA FACTURA LEÍDA (GL-05).
 *
 *   npm run test:factura
 *
 * Lo que se protege aquí no es que la lectura sea buena —eso depende del
 * documento— sino que UNA LECTURA MALA NO PASE DE LARGO. Una factura leída se
 * equivoca devolviendo números plausibles, y si esto los deja pasar, el error
 * aparece cuando el cliente compara la oferta con su factura, delante de él.
 */
import {
  revisarFactura, porQueNoSePuedeOfertar,
  RANGO_PRECIO_ENERGIA, RANGO_PRECIO_POTENCIA, TOPE_KW_20TD, ORIGEN_LABEL,
} from '../src/lib/factura.ts';

let ok = 0, fallos = 0;
const comprueba = (n, c, d = '') => {
  if (c) { ok++; console.log(`  ✓ ${n}`); }
  else { fallos++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`); }
};
const titulo = (t) => console.log(`\n${t}`);

/** Una 3.0TD correcta y completa. */
const BUENA = {
  tarifa: '3.0',
  consumosMes: [4000, 3500, 3000, 2500, 2000, 5000],
  potencias: [40, 40, 40, 40, 40, 50],
  preciosEnergia: [0.18, 0.16, 0.14, 0.12, 0.11, 0.10],
  preciosPotencia: [0.10, 0.08, 0.05, 0.04, 0.03, 0.02],
  titular: 'GRANJA LA LITERA SL',
  cups: 'ES0031406512345678AB',
  observaciones: '',
};
const con = (cambios) => revisarFactura({ ...BUENA, ...cambios });
const bloqueos = (r) => r.reparos.filter((x) => x.gravedad === 'bloquea');
const campos = (r) => bloqueos(r).map((x) => x.campo);

titulo('Una factura completa pasa limpia');
{
  const r = con({});
  comprueba('se puede ofertar', r.puedeOfertar);
  comprueba('y se puede enseñar el ahorro', r.puedeCompararAhorro);
  comprueba('sin ningún reparo', r.reparos.length === 0, JSON.stringify(r.reparos));
  comprueba('todos los campos marcados como correctos',
    Object.values(r.confianza).every((c) => c === 'correcto'), JSON.stringify(r.confianza));
  comprueba('calcula el consumo anual', r.consumoAnual === 240000, String(r.consumoAnual));
  comprueba('no hay nada que explicar', porQueNoSePuedeOfertar(r) === null);
}

titulo('Solo bloquea lo que hace MENTIR al cálculo');
{
  comprueba('sin tarifa no se puede calcular nada',
    campos(con({ tarifa: null })).includes('tarifa'));
  comprueba('sin consumos tampoco',
    campos(con({ consumosMes: [] })).includes('consumos'));
  comprueba('sin potencias tampoco',
    campos(con({ potencias: null })).includes('potencias'));

  // ESTE ES EL CARO: con 3 de 6 periodos el coste actual sale a la mitad y el
  // ahorro al doble, y no lo delata nada en pantalla.
  const cortos = con({ consumosMes: [4000, 3500, 3000] });
  comprueba('faltan periodos de consumo → bloquea', !cortos.puedeOfertar);
  comprueba('y lo explica con los dos números',
    /3 periodos/.test(bloqueos(cortos)[0].texto) && /6/.test(bloqueos(cortos)[0].texto),
    bloqueos(cortos)[0].texto);
  comprueba('el aviso dice por qué importa',
    /inflado/.test(bloqueos(cortos)[0].arreglo), bloqueos(cortos)[0].arreglo);

  comprueba('faltan potencias → bloquea',
    !con({ potencias: [40, 40, 40] }).puedeOfertar);

  // Una 2.0TD son 3 consumos y 2 potencias, no 6 y 6.
  const veinte = revisarFactura({
    tarifa: '2.0', consumosMes: [300, 200, 150], potencias: [4.6, 4.6],
    preciosEnergia: [0.20, 0.14, 0.10], preciosPotencia: [0.10, 0.02],
    titular: 'X', cups: 'ES1', observaciones: '',
  });
  comprueba('una 2.0TD bien puesta pasa', veinte.puedeOfertar && veinte.reparos.length === 0,
    JSON.stringify(veinte.reparos));
}

titulo('Los precios actuales NO bloquean: son otra pregunta');
{
  const sinPrecios = con({ preciosEnergia: [], preciosPotencia: null });
  comprueba('sin precios actuales SE PUEDE ofertar igual', sinPrecios.puedeOfertar);
  comprueba('lo que no se puede es decir cuánto ahorra', !sinPrecios.puedeCompararAhorro);
  comprueba('y se avisa de las dos cosas que faltan',
    sinPrecios.reparos.filter((x) => x.campo.startsWith('precios')).length === 2);
  comprueba('el aviso explica la diferencia',
    /no se puede decir cuánto ahorra/.test(
      sinPrecios.reparos.find((x) => x.campo === 'precios_energia').arreglo));

  comprueba('con solo los de energía tampoco hay ahorro que enseñar',
    !con({ preciosPotencia: [] }).puedeCompararAhorro);
}

titulo('Números plausibles pero imposibles: se marcan, no se corrigen');
{
  // 0,018 €/kWh es el error clásico del decimal corrido.
  const bajo = con({ preciosEnergia: [0.018, 0.16, 0.14, 0.12, 0.11, 0.10] });
  comprueba('un precio de energía por debajo del rango se marca',
    bajo.confianza.precios_energia === 'dudoso');
  comprueba('pero NO bloquea: no sabemos cuál es el bueno', bajo.puedeOfertar);
  comprueba('el aviso apunta a la causa real',
    /decimal|impuestos/.test(bajo.reparos.find((x) => x.campo === 'precios_energia').arreglo));

  comprueba('un precio de energía por encima del rango también',
    con({ preciosEnergia: [0.9, 0.16, 0.14, 0.12, 0.11, 0.10] }).confianza.precios_energia === 'dudoso');

  // €/kW·año leído como €/kW·día: 30 en vez de 0,08.
  const anual = con({ preciosPotencia: [30, 0.08, 0.05, 0.04, 0.03, 0.02] });
  comprueba('un precio de potencia en €/kW·año se detecta',
    anual.confianza.precios_potencia === 'dudoso');
  comprueba('y el arreglo dice dividir entre 365',
    /365/.test(anual.reparos.find((x) => x.campo === 'precios_potencia').arreglo));

  comprueba('los rangos están declarados y tienen sentido',
    RANGO_PRECIO_ENERGIA.min < RANGO_PRECIO_ENERGIA.max
    && RANGO_PRECIO_POTENCIA.min < RANGO_PRECIO_POTENCIA.max);
}

titulo('Lo que sabe un asesor y no sabe un lector automático');
{
  // En 3.0TD/6.1TD la potencia contratada no puede decrecer de P1 a P6.
  const baja = con({ potencias: [40, 30, 40, 40, 40, 50] });
  comprueba('potencias que decrecen entre periodos se marcan',
    baja.confianza.potencias === 'dudoso');
  comprueba('y apunta a lo que suele ser: periodos cambiados',
    /orden/.test(baja.reparos.find((x) => x.campo === 'potencias').arreglo));
  comprueba('no bloquea, porque puede ser solo el orden', baja.puedeOfertar);

  comprueba('en 2.0TD no se exige eso: son punta y valle, no una escalera',
    revisarFactura({
      tarifa: '2.0', consumosMes: [300, 200, 150], potencias: [5.5, 3.3],
      preciosEnergia: [0.20, 0.14, 0.10], preciosPotencia: [0.10, 0.02],
      titular: 'X', cups: 'ES1',
    }).reparos.length === 0);

  // Una 2.0TD con 40 kW no existe: o la tarifa está mal o el suministro es 3.0.
  const gorda = revisarFactura({
    tarifa: '2.0', consumosMes: [300, 200, 150], potencias: [40, 40],
    preciosEnergia: [0.20, 0.14, 0.10], preciosPotencia: [0.10, 0.02],
    titular: 'X', cups: 'ES1',
  });
  comprueba(`una 2.0TD con más de ${TOPE_KW_20TD} kW se marca`,
    gorda.confianza.tarifa === 'dudoso', JSON.stringify(gorda.reparos));
  comprueba('y ofrece las dos explicaciones posibles sin elegir una',
    /tarifa está mal|3\.0TD/.test(gorda.reparos.find((x) => x.campo === 'tarifa').arreglo));

  // Un consumo mil veces menor: el punto de los miles perdido.
  const enano = revisarFactura({
    tarifa: '2.0', consumosMes: [3, 2, 1], potencias: [4.6, 4.6],
    preciosEnergia: [0.20, 0.14, 0.10], preciosPotencia: [0.10, 0.02],
    titular: 'X', cups: 'ES1',
  });
  comprueba('un consumo anual por debajo de lo creíble se marca',
    enano.confianza.consumos === 'dudoso', String(enano.consumoAnual));
  comprueba('y nombra la causa habitual',
    /punto de los miles/.test(enano.reparos.find((x) => x.campo === 'consumos').arreglo));
}

titulo('Identificación: avisa, no para');
{
  const r = con({ cups: null, titular: null });
  comprueba('sin CUPS se puede preparar la oferta igual', r.puedeOfertar);
  comprueba('pero se avisa de que hace falta para tramitar',
    /tramitar/.test(r.reparos.find((x) => x.campo === 'cups').arreglo));
  comprueba('sin titular también se avisa', r.confianza.titular === 'dudoso');
}

titulo('El aviso del lector se conserva tal cual');
{
  const r = con({ observaciones: '  El periodo P4 estaba borroso  ' });
  const l = r.reparos.find((x) => x.campo === 'lectura');
  comprueba('se guarda su texto sin reinterpretarlo', l.texto === 'El periodo P4 estaba borroso');
  comprueba('marcado como dudoso', r.confianza.lectura === 'dudoso');
  comprueba('y no bloquea por sí solo', r.puedeOfertar);
  comprueba('una observación vacía no genera reparo', con({ observaciones: '   ' }).reparos.length === 0);
}

titulo('El botón sabe qué decir');
{
  comprueba('con un solo bloqueo, dice cuál',
    /tarifa de acceso/.test(porQueNoSePuedeOfertar(con({ tarifa: null }))));
  const dos = porQueNoSePuedeOfertar(con({ tarifa: null, consumosMes: [] }));
  comprueba('con varios, dice el primero y cuántos más', /y 1 más/.test(dos), dos);
  comprueba('sin bloqueos devuelve null', porQueNoSePuedeOfertar(con({})) === null);
}

titulo('El origen de cada dato tiene nombre');
{
  comprueba('los cuatro orígenes están escritos en castellano',
    ['factura', 'introducido', 'calculado', 'estimado']
      .every((k) => ORIGEN_LABEL[k] && ORIGEN_LABEL[k].length > 5));
}

titulo('Una lectura vacía no revienta');
{
  const r = revisarFactura({});
  comprueba('no se puede ofertar', !r.puedeOfertar);
  comprueba('ni comparar ahorro', !r.puedeCompararAhorro);
  comprueba('el consumo anual es cero', r.consumoAnual === 0);
  comprueba('y hay algo que explicar', !!porQueNoSePuedeOfertar(r));
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} bien, ${fallos} mal\n`);
process.exit(fallos === 0 ? 0 : 1);
