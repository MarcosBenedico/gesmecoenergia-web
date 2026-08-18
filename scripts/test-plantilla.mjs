/**
 * Tests de la PLANTILLA DE CONSUMOS.
 *
 *   npm run test:plantilla
 *
 * Lo que se protege aquí es que un año no se invente. La plantilla la rellena
 * una persona, a mano, con doce facturas delante: van a faltar meses, van a
 * escribirse comas donde va el punto y va a haber quien ponga los precios de
 * potencia en €/kW·año. Nada de eso puede acabar en una propuesta sin que se
 * diga.
 */
import {
  leerNumero, leerTarifa, columnasDeConsumo, interpretarPlantilla,
  CAMPOS_SUMINISTRO, MESES, DIAS_ANIO, DIAS_MINIMOS_FIABLES, DIAS_MINIMOS, FILAS_NO_MES,
} from '../src/lib/plantilla-consumos.ts';

let ok = 0, fallos = 0;
const comprueba = (n, c, d = '') => {
  if (c) { ok++; console.log(`  ✓ ${n}`); }
  else { fallos++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`); }
};
const titulo = (t) => console.log(`\n${t}`);

const bloqueos = (r) => r.reparos.filter((x) => x.gravedad === 'bloquea');
const avisos = (r) => r.reparos.filter((x) => x.gravedad === 'revisar');

/** Hoja de suministro con lo mínimo. */
const suministro = (tarifa = '3.0TD', extra = {}) => [
  ['Titular del contrato', extra.titular ?? 'GRANJA LA LITERA SL'],
  ['CUPS', extra.cups ?? 'ES0031406512345678AB'],
  ['Tarifa de acceso', tarifa],
  ['Fin del contrato', '30/04/2027'],
];

/** Doce meses de 30 días con el mismo consumo por periodo. */
const doceMeses = (porPeriodo, nP = 6, pot = 40, max = 35) => {
  const filas = [['Mes', 'Días facturados', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6']];
  for (const m of MESES) {
    filas.push([m, '30', ...porPeriodo,
      ...new Array(nP).fill(String(pot)),
      ...new Array(nP).fill(String(max))]);
  }
  return filas;
};

const precios = (e, p) => [
  ['Periodo', '€/kWh', '€/kW·día'],
  ...e.map((x, i) => [`P${i + 1}`, String(x), String(p[i] ?? '')]),
];

const PRECIOS_OK = precios(
  ['0,18', '0,16', '0,14', '0,12', '0,11', '0,10'],
  ['0,10', '0,08', '0,05', '0,04', '0,03', '0,02']
);

titulo('Leer un número escrito por una persona');
{
  comprueba('coma decimal española', leerNumero('1.234,56').valor === 1234.56);
  comprueba('punto de miles sin decimales', leerNumero('53.558').valor === 53558);
  comprueba('decimal a la inglesa', leerNumero('1234.56').valor === 1234.56);
  comprueba('un precio con punto se lee como decimal',
    leerNumero('0.185', 'decimal').valor === 0.185);
  comprueba('y en una casilla de kWh el mismo texto es un punto de miles',
    leerNumero('0.185').valor === 185);
  comprueba('un precio nunca se lee como miles',
    leerNumero('1.234', 'decimal').valor === 1.234);
  // 4,6 kW es la potencia doméstica más común de España. Si esto se marcara
  // como dudoso, toda plantilla de 2.0TD saldría con un aviso — y un aviso
  // que salta siempre tapa a los que sí importan.
  comprueba('una potencia de 4.6 kW NO es dudosa',
    leerNumero('4.6', 'decimal').valor === 4.6 && !leerNumero('4.6', 'decimal').ambiguo);
  comprueba('un precio con coma', leerNumero('0,185').valor === 0.185);
  comprueba('entero pelado', leerNumero('31').valor === 31);
  comprueba('vacío es cero y no es un problema',
    leerNumero('').valor === 0 && !leerNumero('').ambiguo);
  comprueba('un número ya numérico pasa tal cual', leerNumero(4.6).valor === 4.6);
  comprueba('con unidades pegadas también', leerNumero('1.234 kWh').valor === 1234);

  // El caso que no se puede resolver sin la factura: se marca, no se adivina.
  const dudoso = leerNumero('3.42');
  comprueba('«3.42» se marca como ambiguo', dudoso.ambiguo, JSON.stringify(dudoso));
  comprueba('y el motivo enseña las dos lecturas posibles',
    /3,42/.test(dudoso.motivo) && /3420/.test(dudoso.motivo), dudoso.motivo);
  comprueba('pero devuelve un valor, no rompe', Number.isFinite(dudoso.valor));
  comprueba('«3.420», con tres cifras detrás, es miles como en leerConsumo',
    leerNumero('3.420').valor === 3420 && !leerNumero('3.420').ambiguo);

  comprueba('un texto que no es número no revienta', leerNumero('vete a saber').valor === 0);
  comprueba('los negativos se respetan', leerNumero('-5').valor === -5);
}

titulo('La tarifa se entiende como la escriba quien sea');
{
  comprueba('2.0TD', leerTarifa('2.0TD') === '2.0');
  comprueba('con espacio', leerTarifa('3.0 TD') === '3.0');
  comprueba('sin TD', leerTarifa('6.1') === '6.1');
  comprueba('en minúsculas', leerTarifa('2.0td') === '2.0');
  comprueba('sin punto', leerTarifa('20TD') === '2.0');
  comprueba('lo que no se entiende devuelve null', leerTarifa('la de siempre') === null);
  comprueba('vacío devuelve null', leerTarifa('') === null);
}

titulo('Las columnas dependen de la tarifa (y ahí está el error caro)');
{
  const c20 = columnasDeConsumo('2.0');
  const c30 = columnasDeConsumo('3.0');
  const c61 = columnasDeConsumo('6.1');

  comprueba('la 2.0TD tiene 3 periodos de energía',
    c20.filter((x) => x.grupo === 'energia').length === 3);
  comprueba('y 2 de potencia',
    c20.filter((x) => x.grupo === 'potencia').length === 2);
  comprueba('la 3.0TD tiene 6 y 6',
    c30.filter((x) => x.grupo === 'energia').length === 6
    && c30.filter((x) => x.grupo === 'potencia').length === 6);
  comprueba('la 6.1TD también', c61.length === c30.length);
  comprueba('todas empiezan por mes y días facturados',
    c30[0].clave === 'mes' && c30[1].clave === 'dias');
  comprueba('hay una columna de maxímetro por cada periodo de potencia',
    c30.filter((x) => x.grupo === 'maximetro').length === 6);
  comprueba('cada columna tiene título', c30.every((x) => x.titulo.length > 0));
}

titulo('Un año completo no se estima: se suma');
{
  const r = interpretarPlantilla({
    suministro: suministro(),
    consumos: doceMeses(['4000', '3500', '3000', '2500', '2000', '5000']),
    precios: PRECIOS_OK,
  });

  comprueba('se puede usar', r.utilizable, JSON.stringify(bloqueos(r)));
  comprueba('lee la tarifa', r.tarifa === '3.0');
  comprueba('coge los 12 meses', r.meses.length === 12);
  comprueba('suma los días', r.diasTotales === 360);
  comprueba('NO marca extrapolado', !r.extrapolado);

  // 20.000 kWh/mes × 12 meses de 30 días = 240.000 en 360 días → ×365/360
  const esperado = 240000 * (DIAS_ANIO / 360);
  comprueba('anualiza por días, no por meses',
    Math.abs(r.consumoAnual - esperado) < 1, `${r.consumoAnual} vs ${esperado}`);
  comprueba('reparte el año por periodo',
    r.consumoAnualPorPeriodo.length === 6
    && Math.abs(r.consumoAnualPorPeriodo[0] - 4000 * 12 * (DIAS_ANIO / 360)) < 1);

  // Lo que come calcularCoste es un mes medio: ×12 tiene que dar el año.
  comprueba('el mes medio por 12 devuelve el año exacto',
    Math.abs(r.consumosMes.reduce((s, v) => s + v, 0) * 12 - r.consumoAnual) < 0.01);

  comprueba('coge la potencia contratada', r.potencias.every((p) => p === 40));
  comprueba('y el maxímetro', r.maximetros.every((m) => m === 35));
  comprueba('lee los precios de energía', r.preciosEnergia[0] === 0.18);
  comprueba('y los de potencia', r.preciosPotencia[0] === 0.10);
  comprueba('sin nada que avisar', r.reparos.length === 0, JSON.stringify(r.reparos));
}

titulo('EL AÑO EXTRAPOLADO SE DICE SIEMPRE');
{
  const tres = [['Mes', 'Días', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6']];
  for (const m of ['Junio', 'Julio', 'Agosto']) {
    tres.push([m, '30', '9000', '8000', '7000', '6000', '5000', '4000',
      ...new Array(6).fill('60'), ...new Array(6).fill('55')]);
  }
  const r = interpretarPlantilla({ suministro: suministro(), consumos: tres, precios: PRECIOS_OK });

  comprueba('con 3 meses se puede calcular igual', r.utilizable);
  comprueba('pero queda marcado como extrapolado', r.extrapolado);
  const aviso = avisos(r).find((x) => x.campo === 'consumos');
  comprueba('y se avisa con los días reales', /90 días/.test(aviso.texto), aviso?.texto);
  comprueba('nombrando cuántos meses son', /3 mes/.test(aviso.texto), aviso?.texto);
  comprueba('el arreglo explica el riesgo de estacionalidad',
    /estacionalidad/.test(aviso.arreglo), aviso?.arreglo);

  // Justo en el límite no debe saltar.
  const casiEntero = [['Mes', 'Días', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6']];
  casiEntero.push(['Todo', String(DIAS_MINIMOS_FIABLES), '1000', '0', '0', '0', '0', '0',
    ...new Array(6).fill('40'), ...new Array(6).fill('30')]);
  comprueba(`con ${DIAS_MINIMOS_FIABLES} días ya no se marca`,
    !interpretarPlantilla({ suministro: suministro(), consumos: casiEntero, precios: PRECIOS_OK }).extrapolado);
}

titulo('Lo que impide calcular nada, bloquea');
{
  const sinTarifa = interpretarPlantilla({
    suministro: [['Titular del contrato', 'X'], ['Tarifa de acceso', '']],
    consumos: doceMeses(['1', '1', '1', '1', '1', '1']),
    precios: PRECIOS_OK,
  });
  comprueba('sin tarifa no se puede hacer nada', !sinTarifa.utilizable);
  comprueba('y lo dice señalando la hoja',
    /1\. Suministro/.test(bloqueos(sinTarifa)[0].arreglo), bloqueos(sinTarifa)[0]?.arreglo);

  const vacia = interpretarPlantilla({
    suministro: suministro(),
    consumos: [['Mes', 'Días', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6']],
    precios: PRECIOS_OK,
  });
  comprueba('una plantilla sin meses bloquea', !vacia.utilizable);
  comprueba('y dice dónde rellenar',
    /2\. Consumos/.test(bloqueos(vacia)[0].arreglo), bloqueos(vacia)[0]?.arreglo);

  const pocosDias = [['Mes', 'Días', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6']];
  pocosDias.push(['Enero', '10', '100', '0', '0', '0', '0', '0',
    ...new Array(6).fill('40'), ...new Array(6).fill('30')]);
  const r = interpretarPlantilla({ suministro: suministro(), consumos: pocosDias, precios: PRECIOS_OK });
  comprueba(`con menos de ${DIAS_MINIMOS} días no hay año que sacar`, !r.utilizable);

  const sinPot = [['Mes', 'Días', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6']];
  for (const m of MESES) sinPot.push([m, '30', '1000', '0', '0', '0', '0', '0', ...new Array(12).fill('')]);
  comprueba('sin potencias contratadas también bloquea',
    !interpretarPlantilla({ suministro: suministro(), consumos: sinPot, precios: PRECIOS_OK }).utilizable);
}

titulo('Los precios avisan pero NO bloquean: son otra pregunta');
{
  const r = interpretarPlantilla({
    suministro: suministro(),
    consumos: doceMeses(['4000', '3500', '3000', '2500', '2000', '5000']),
    precios: [['Periodo', '€/kWh', '€/kW·día']],
  });
  comprueba('sin precios se puede preparar la oferta igual', r.utilizable);
  comprueba('pero se avisa de la energía',
    avisos(r).some((x) => x.campo === 'precios_energia'));
  comprueba('y de la potencia', avisos(r).some((x) => x.campo === 'precios_potencia'));
  comprueba('explicando que lo que falta es el ahorro',
    /cuánto ahorra/.test(avisos(r).find((x) => x.campo === 'precios_energia').arreglo));
  comprueba('y recordando lo de los €/kW·año',
    /365/.test(avisos(r).find((x) => x.campo === 'precios_potencia').arreglo));
}

titulo('Rellenar a medias no rompe nada');
{
  // Ocho facturas de doce: las filas vacías se saltan sin protestar.
  const parcial = [['Mes', 'Días', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6']];
  MESES.forEach((m, i) => {
    if (i < 8) parcial.push([m, '30', '3000', '2000', '1000', '500', '500', '1000',
      ...new Array(6).fill('40'), ...new Array(6).fill('30')]);
    else parcial.push([m, '', '', '', '', '', '', '', ...new Array(12).fill('')]);
  });
  const r = interpretarPlantilla({ suministro: suministro(), consumos: parcial, precios: PRECIOS_OK });

  comprueba('solo cuenta los meses rellenados', r.meses.length === 8, String(r.meses.length));
  comprueba('y los días son los suyos', r.diasTotales === 240);
  comprueba('un mes en blanco NO genera aviso: es que no hay factura',
    !avisos(r).some((x) => x.campo === 'dias'));
  comprueba('pero sí se avisa de que el año está estimado', r.extrapolado);

  // Consumo escrito y días olvidados: eso sí es un descuido que hay que decir.
  const sinDias = [['Mes', 'Días', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6']];
  sinDias.push(['Enero', '', '3000', '0', '0', '0', '0', '0', ...new Array(6).fill('40'), ...new Array(6).fill('30')]);
  sinDias.push(['Febrero', '300', '3000', '0', '0', '0', '0', '0', ...new Array(6).fill('40'), ...new Array(6).fill('30')]);
  const r2 = interpretarPlantilla({ suministro: suministro(), consumos: sinDias, precios: PRECIOS_OK });
  comprueba('un mes con consumo y sin días se avisa',
    avisos(r2).some((x) => x.campo === 'dias'), JSON.stringify(r2.reparos));
  comprueba('nombrando el mes', /Enero/.test(avisos(r2).find((x) => x.campo === 'dias').texto));
}

titulo('Los números dudosos viajan hasta arriba');
{
  const dudoso = [['Mes', 'Días', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6']];
  dudoso.push(['Enero', '30', '3.42', '0', '0', '0', '0', '0',
    ...new Array(6).fill('40'), ...new Array(6).fill('30')]);
  const r = interpretarPlantilla({ suministro: suministro(), consumos: dudoso, precios: PRECIOS_OK });

  const a = avisos(r).find((x) => x.campo === 'numeros');
  comprueba('un número ambiguo se avisa', !!a, JSON.stringify(r.reparos));
  comprueba('diciendo en qué mes está', /Enero/.test(a.arreglo), a?.arreglo);
  comprueba('no bloquea: el valor está, solo hay que confirmarlo', r.utilizable);
}

titulo('La 2.0TD tiene su propia forma');
{
  const filas = [['Mes', 'Días', 'P1', 'P2', 'P3']];
  for (const m of MESES) filas.push([m, '30', '300', '200', '150', '4.6', '4.6', '4', '4']);
  const r = interpretarPlantilla({
    suministro: suministro('2.0TD'),
    consumos: filas,
    precios: precios(['0,20', '0,14', '0,10'], ['0,10', '0,02']),
  });

  comprueba('lee 3 periodos de energía', r.consumoAnualPorPeriodo.length === 3);
  comprueba('y 2 de potencia', r.potencias.length === 2, JSON.stringify(r.potencias));
  comprueba('coge las potencias de donde toca', r.potencias[0] === 4.6 && r.potencias[1] === 4.6);
  comprueba('y el maxímetro después', r.maximetros[0] === 4 && r.maximetros[1] === 4);
  comprueba('con sus precios', r.preciosEnergia.length === 3 && r.preciosPotencia.length === 2);
  comprueba('sin reparos', r.reparos.length === 0, JSON.stringify(r.reparos));
}

titulo('La cabecera del suministro llega entera');
{
  const r = interpretarPlantilla({
    suministro: [
      ...suministro(),
      ['Comercializadora actual', 'IBERDROLA'],
      ['Penalización por salir (€)', '450'],
      ['Días de preaviso', '30'],
    ],
    consumos: doceMeses(['1000', '1000', '1000', '1000', '1000', '1000']),
    precios: PRECIOS_OK,
  });

  comprueba('el titular', r.suministro.titular === 'GRANJA LA LITERA SL');
  comprueba('el CUPS', r.suministro.cups === 'ES0031406512345678AB');
  comprueba('la comercializadora', r.suministro.comercializadora === 'IBERDROLA');
  comprueba('la fecha de fin, que es de donde sale el preaviso',
    r.suministro.fecha_fin === '30/04/2027');
  comprueba('la penalización', r.suministro.penalizacion === '450');
  comprueba('todos los campos de la plantilla tienen etiqueta y ayuda declaradas',
    CAMPOS_SUMINISTRO.every((c) => c.clave && c.etiqueta.length > 3));
}

titulo('LA FILA DE TOTALES NO ES UN MES');
{
  // La plantilla lleva totales al pie para que se vea si falta un mes. Leerlos
  // como un mes más daba 13 meses, 660 días y una potencia de 300 kW —la suma
  // de las doce— en vez de 40. Sin error ninguno: el ahorro salía calculado
  // sobre un suministro que no existe.
  const conTotales = doceMeses(['4000', '3500', '3000', '2500', '2000', '5000']);
  conTotales.push(['TOTAL', '360', '48000', '42000', '36000', '30000', '24000', '60000',
    ...new Array(6).fill('480'), ...new Array(6).fill('420')]);
  conTotales.push(['', '', 'Nota al pie que tampoco es un mes']);

  const r = interpretarPlantilla({ suministro: suministro(), consumos: conTotales, precios: PRECIOS_OK });

  comprueba('siguen siendo 12 meses, no 13', r.meses.length === 12, String(r.meses.length));
  comprueba('los días no se cuentan dos veces', r.diasTotales === 360, String(r.diasTotales));
  comprueba('la potencia es la contratada, no la suma del año',
    r.potencias.every((p) => p === 40), JSON.stringify(r.potencias));
  comprueba('y el maxímetro tampoco se infla',
    r.maximetros.every((m) => m === 35), JSON.stringify(r.maximetros));

  comprueba('se corta con «total» lo escriba como lo escriba',
    interpretarPlantilla({
      suministro: suministro(),
      consumos: [...doceMeses(['1', '1', '1', '1', '1', '1']), ['Totales', '360', '12']],
      precios: PRECIOS_OK,
    }).meses.length === 12);

  comprueba('la lista de etiquetas que no son meses está declarada',
    FILAS_NO_MES.includes('total') && FILAS_NO_MES.length >= 4);
}

titulo('Tolerancia a que alguien toque la hoja');
{
  // Una fila de título por encima de la cabecera no debe romper la lectura:
  // la cabecera se busca por la palabra «Mes», no por estar en la fila 1.
  const conTitulo = [
    ['CONSUMOS 2025', '', '', '', '', '', '', ''],
    [],
    ['Mes', 'Días facturados', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
    ['Enero', '31', '4000', '3000', '2000', '1000', '1000', '2000',
      ...new Array(6).fill('40'), ...new Array(6).fill('30')],
  ];
  const r = interpretarPlantilla({ suministro: suministro(), consumos: conTitulo, precios: PRECIOS_OK });
  comprueba('encuentra la cabecera aunque no esté la primera', r.meses.length === 1);
  comprueba('y lee bien la fila', r.meses[0].dias === 31 && r.meses[0].energia[0] === 4000);

  // Las etiquetas del suministro se buscan por nombre, así que el orden da igual.
  const alReves = interpretarPlantilla({
    suministro: [['Tarifa de acceso', '6.1TD'], ['Titular del contrato', 'Z']],
    consumos: doceMeses(['1000', '1000', '1000', '1000', '1000', '1000']),
    precios: PRECIOS_OK,
  });
  comprueba('el orden de la hoja de suministro da igual', alReves.tarifa === '6.1');

  const sinNada = interpretarPlantilla({ suministro: [], consumos: [], precios: [] });
  comprueba('una plantilla en blanco no revienta', !sinNada.utilizable && sinNada.meses.length === 0);
}

titulo('UN NÚMERO DEL ARCHIVO LLEGA COMO NÚMERO, NO COMO TEXTO');
{
  // En el .xlsx un consumo de 473,21 kWh está guardado como el número 473.21.
  // Pasarlo a texto para releerlo daba «473.210» —el formato pinta tres
  // decimales— y eso, bajo las reglas de cantidad, son 473.210 kWh: mil veces
  // más, dentro de una oferta, sin ningún error por ninguna parte.
  const filas = [['Mes', 'Días facturados', 'P1', 'P2', 'P3']];
  filas.push(['Jul-25', 30, 473.21, 420.32, 672.71, 6.928, 6.928, 6.416, 5.828]);
  const r = interpretarPlantilla({
    suministro: suministro('2.0TD'),
    consumos: filas,
    precios: [['Periodo', '€/kWh', '€/kW·día'], ['P1', 0.15374, 0.117686], ['P2', 0.15374, 0.041554], ['P3', 0.15374, '']],
  });

  comprueba('un número se respeta tal cual', r.meses[0].energia[0] === 473.21,
    String(r.meses[0].energia[0]));
  comprueba('y NO se convierte en 473210', r.meses[0].energia[0] < 1000);
  comprueba('las potencias decimales también', r.meses[0].potenciaContratada[0] === 6.928);
  comprueba('y los precios', r.preciosEnergia[0] === 0.15374 && r.preciosPotencia[0] === 0.117686);
  comprueba('el consumo anual sale de un suministro de verdad',
    r.consumoAnual > 15000 && r.consumoAnual < 25000, String(Math.round(r.consumoAnual)));
  comprueba('sin avisos de números dudosos', !avisos(r).some((x) => x.campo === 'numeros'),
    JSON.stringify(r.reparos));
}

titulo('LO QUE NO CABE EN LA POTENCIA CONTRATADA ES IMPOSIBLE, NO IMPROBABLE');
{
  // El tope real es kW × 24 h × días. No es un umbral a ojo: por encima, el
  // dato no puede ser. Es lo único que caza de verdad un punto de miles.
  const filas = [['Mes', 'Días facturados', 'P1', 'P2', 'P3']];
  filas.push(['Julio', 30, 473210, 0, 0, 6.928, 6.928, 6, 6]);
  const r = interpretarPlantilla({
    suministro: suministro('2.0TD'), consumos: filas,
    precios: precios(['0,15', '0,15', '0,15'], ['0,11', '0,04']),
  });

  const a = avisos(r).find((x) => /no caben/.test(x.texto));
  comprueba('un consumo imposible para su potencia se avisa', !!a, JSON.stringify(r.reparos));
  comprueba('diciendo el mes', /Julio/.test(a.texto), a?.texto);
  // 4.988 sin punto: en español no se agrupan los millares de cuatro cifras.
  comprueba('y el máximo físico que sí cabría', /4\.?988/.test(a.texto), a?.texto);
  comprueba('apuntando a la causa habitual',
    /punto de los miles/.test(a.arreglo), a?.arreglo);
  comprueba('no bloquea: se avisa y decide una persona', r.utilizable);

  // Y no salta con datos normales.
  const bien = interpretarPlantilla({
    suministro: suministro('2.0TD'),
    consumos: [['Mes', 'Días', 'P1', 'P2', 'P3'], ['Julio', 30, 473, 420, 672, 6.928, 6.928, 6, 6]],
    precios: precios(['0,15', '0,15', '0,15'], ['0,11', '0,04']),
  });
  comprueba('con datos normales no salta', !avisos(bien).some((x) => /no caben/.test(x.texto)));

  // Sin potencia contratada no hay tope contra el que comparar.
  const sinPot = interpretarPlantilla({
    suministro: suministro('2.0TD'),
    consumos: [['Mes', 'Días', 'P1', 'P2', 'P3'], ['Julio', 30, 999999, 0, 0, '', '', '', '']],
    precios: precios(['0,15', '0,15', '0,15'], ['0,11', '0,04']),
  });
  comprueba('sin potencia no se inventa un tope',
    !avisos(sinPot).some((x) => /no caben/.test(x.texto)));
}

titulo('El maxímetro por encima de lo contratado: ahí toca SUBIR');
{
  const filas = [['Mes', 'Días', 'P1', 'P2', 'P3']];
  filas.push(['Julio', 30, 400, 300, 500, 6.928, 6.928, 8.5, 5.0]);
  const r = interpretarPlantilla({
    suministro: suministro('2.0TD'), consumos: filas,
    precios: precios(['0,15', '0,15', '0,15'], ['0,11', '0,04']),
  });

  comprueba('detecta el periodo en exceso', r.periodosEnExceso.join(',') === '1',
    JSON.stringify(r.periodosEnExceso));
  const a = avisos(r).find((x) => x.campo === 'potencias');
  comprueba('y lo avisa nombrando el periodo', /P1/.test(a.texto), a?.texto);
  comprueba('diciendo que ahí se sube, no se baja',
    /SUBIR/.test(a.arreglo), a?.arreglo);
  comprueba('no bloquea', r.utilizable);

  const sinExceso = interpretarPlantilla({
    suministro: suministro('2.0TD'),
    consumos: [['Mes', 'Días', 'P1', 'P2', 'P3'], ['Julio', 30, 400, 300, 500, 6.928, 6.928, 5, 5]],
    precios: precios(['0,15', '0,15', '0,15'], ['0,11', '0,04']),
  });
  comprueba('sin exceso no se avisa', sinExceso.periodosEnExceso.length === 0);
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} bien, ${fallos} mal\n`);
process.exit(fallos === 0 ? 0 : 1);
