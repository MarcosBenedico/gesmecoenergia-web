/**
 * Tests del MOTOR DE COMPARATIVA Y ESCENARIOS (GL-06).
 *
 *   npm run test:escenarios
 *
 * Aquí lo que se protege es la RECOMENDACIÓN, no la aritmética. La suma la
 * hace `calcularCoste` y ya está probada; lo que puede salir caro es que el
 * sistema recomiende en silencio un indexado porque en la hoja de cálculo
 * ahorra más, y que el cliente firme un año de precio a mercado creyendo que
 * le habíamos garantizado ese ahorro.
 */
import {
  evaluarEscenario, evaluarEscenarios, recomendar, costeActual,
  alertasDeLaComparativa, resumenComparativa,
  TOPE_ESCENARIOS, TIPO_ESCENARIO_LABEL, DIAS_PRECIOS_CADUCADOS, MESES_PERMANENCIA_LARGA,
} from '../src/lib/escenarios.ts';

let ok = 0, fallos = 0;
const comprueba = (n, c, d = '') => {
  if (c) { ok++; console.log(`  ✓ ${n}`); }
  else { fallos++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`); }
};
const titulo = (t) => console.log(`\n${t}`);

const HOY = '2026-08-18';
const hace = (d) => {
  const x = new Date(`${HOY}T00:00:00`);
  x.setDate(x.getDate() - d);
  return x.toISOString().slice(0, 10);
};

/** Una 2.0TD de un negocio pequeño. */
const CTX = {
  tarifa: '2.0',
  consumosMes: [500, 400, 300],
  potencias: [10, 10],
  preciosEnergiaActual: [0.20, 0.18, 0.15],
  preciosPotenciaActual: [0.10, 0.02],
};

const hip = (o = {}) => ({
  fechaPrecios: HOY, margenEurKwh: 0.005, incluyeImpuestos: false,
  ajustesManuales: [], bloqueada: false, ...o,
});

const esc = (o) => ({
  id: o.id, tipo: o.tipo || 'fijo', titulo: o.titulo || o.id,
  preciosEnergia: o.pe || [0.14, 0.13, 0.11],
  preciosPotencia: o.pp || [0.09, 0.018],
  potencias: o.potencias ?? null,
  permanenciaMeses: o.perm ?? null,
  penalizacionSalida: o.penal ?? null,
  ahorroExtraAnual: o.extra ?? null,
  inversion: o.inversion ?? null,
  hipotesis: hip(o.hip),
});

titulo('El listón es el coste de hoy, y sale una sola vez');
{
  const base = costeActual(CTX);
  // 1200 kWh/mes × 12 = 14.400 kWh/año
  comprueba('el coste actual se calcula sobre el consumo real',
    Math.round(base.total) === Math.round(
      (500 * 0.20 + 400 * 0.18 + 300 * 0.15) * 12 + (10 * 0.10 + 10 * 0.02) * 365),
    String(Math.round(base.total)));
  comprueba('separa energía y potencia', base.totalEnergia > 0 && base.totalPotencia > 0);
}

titulo('Todos los escenarios se miden sobre el MISMO consumo');
{
  const e = evaluarEscenario(CTX, esc({ id: 'a' }), HOY);
  comprueba('el ahorro es la diferencia contra el coste actual',
    Math.abs(e.ahorroAnual - (costeActual(CTX).total - e.costeAnual)) < 0.01);
  comprueba('y se expresa también en porcentaje', e.ahorroPct > 0 && e.ahorroPct < 100);
  comprueba('un escenario sin potencias propias usa las de hoy',
    e.coste.potencia[0].consumo === 10);

  const conPot = evaluarEscenario(CTX, esc({ id: 'b', tipo: 'optimizar_potencia', potencias: [7, 7] }), HOY);
  comprueba('el escenario de potencias sí cambia los kW', conPot.coste.potencia[0].consumo === 7);
  comprueba('y por eso ahorra más que el mismo precio sin tocarlas',
    conPot.ahorroAnual > evaluarEscenario(CTX, esc({ id: 'c', pe: e.escenario.preciosEnergia, pp: e.escenario.preciosPotencia }), HOY).ahorroAnual);
}

titulo('El ahorro que no sale de los precios se cuenta aparte');
{
  const sin = evaluarEscenario(CTX, esc({ id: 'x' }), HOY);
  const con = evaluarEscenario(CTX, esc({ id: 'y', extra: 600 }), HOY);
  comprueba('el ahorro extra baja el coste anual',
    Math.abs((sin.costeAnual - con.costeAnual) - 600) < 0.01);
  comprueba('y sube el ahorro en la misma cantidad',
    Math.abs((con.ahorroAnual - sin.ahorroAnual) - 600) < 0.01);
}

titulo('EL INDEXADO NO SE RECOMIENDA POR AHORRAR MÁS');
{
  const ev = evaluarEscenarios(CTX, [
    esc({ id: 'indexado', tipo: 'indexado', titulo: 'Indexado', pe: [0.10, 0.09, 0.08] }),
    esc({ id: 'fijo', tipo: 'fijo', titulo: 'Fijo 12 meses', pe: [0.14, 0.13, 0.11], perm: 12 }),
  ], HOY);

  comprueba('el indexado sale primero por ahorro', ev[0].escenario.id === 'indexado');
  comprueba('y marcado como riesgo alto', ev[0].riesgo === 'alto');
  comprueba('con el motivo escrito', /mercado/.test(ev[0].porqueRiesgo[0]), ev[0].porqueRiesgo[0]);

  const r = recomendar(ev);
  comprueba('pero el recomendado es el fijo', r.elegido.escenario.id === 'fijo');
  comprueba('y se dice cuánto se está dejando en la mesa',
    /ahorraría \d+ € más/.test(r.porque), r.porque);
  comprueba('nombrando la alternativa descartada', r.descartadoPorRiesgo.escenario.id === 'indexado');
  comprueba('la frase lleva el ahorro del recomendado', /€ al año/.test(r.porque));
  comprueba('y si ata, dice cuánto', /12 meses de permanencia/.test(r.porque), r.porque);
}

titulo('Un riesgo alto SÍ se recomienda si es lo único que mejora');
{
  const ev = evaluarEscenarios(CTX, [
    esc({ id: 'indexado', tipo: 'indexado', titulo: 'Indexado', pe: [0.10, 0.09, 0.08] }),
    esc({ id: 'caro', tipo: 'fijo', titulo: 'Fijo caro', pe: [0.30, 0.30, 0.30] }),
  ], HOY);
  const r = recomendar(ev);
  comprueba('se elige el arriesgado', r.elegido.escenario.id === 'indexado');
  comprueba('y la frase advierte de que es la única', /única opción/.test(r.porque), r.porque);
  comprueba('no hay descartado que enseñar', r.descartadoPorRiesgo === null);
}

titulo('Si nada mejora, se dice');
{
  const r = recomendar(evaluarEscenarios(CTX, [
    esc({ id: 'peor', pe: [0.40, 0.40, 0.40] }),
  ], HOY));
  comprueba('no se recomienda nada', r.elegido === null);
  comprueba('y la frase es honesta, no un hueco',
    /bien negociada/.test(r.porque), r.porque);
}

titulo('Lo que sube el riesgo, y por qué');
{
  const larga = evaluarEscenario(CTX, esc({ id: 'l', perm: 24 }), HOY);
  comprueba(`una permanencia por encima de ${MESES_PERMANENCIA_LARGA} meses sube el riesgo`,
    larga.riesgo === 'medio');
  comprueba('y dice que no se podrá volver a mejorar',
    /volver a mejorar/.test(larga.porqueRiesgo[0]), larga.porqueRiesgo[0]);

  comprueba('12 meses justos aún no lo suben',
    evaluarEscenario(CTX, esc({ id: 'j', perm: 12 }), HOY).riesgo === 'bajo');

  comprueba('una penalización por salir sube el riesgo',
    evaluarEscenario(CTX, esc({ id: 'p', penal: 300 }), HOY).riesgo === 'medio');

  comprueba('datos estimados suben el riesgo de cualquier escenario',
    evaluarEscenario({ ...CTX, datosEstimados: true }, esc({ id: 'e' }), HOY).riesgo === 'medio');

  // Bajar potencia con la curva y no con el maxímetro es dejar al cliente
  // corto: la curva es un promedio horario y aplana los picos.
  const sinMax = evaluarEscenario(CTX, esc({ id: 'm', tipo: 'optimizar_potencia', potencias: [6, 6] }), HOY);
  comprueba('bajar potencia sin maxímetro es riesgo ALTO', sinMax.riesgo === 'alto');
  comprueba('y dice exactamente por qué',
    /demanda real pudo ser mayor/.test(sinMax.porqueRiesgo.join(' ')));
  comprueba('con maxímetro deja de serlo',
    evaluarEscenario({ ...CTX, tieneMaximetro: true }, esc({ id: 'm2', tipo: 'optimizar_potencia', potencias: [6, 6] }), HOY).riesgo === 'bajo');

  comprueba('una inversión sin ahorro cuantificado sube el riesgo',
    evaluarEscenario(CTX, esc({ id: 'i', tipo: 'fotovoltaica', inversion: 12000 }), HOY).riesgo === 'medio');
}

titulo('Las alertas: lo que puede torcer el ahorro que se está enseñando');
{
  const ctx = {
    ...CTX,
    permanenciaRestanteMeses: 5,
    penalizacionActual: 400,
    periodosEnExceso: [1, 3],
    datosEstimados: true,
  };
  const e = evaluarEscenario(ctx, esc({ id: 'a' }), HOY);
  const tipos = e.alertas.map((a) => a.tipo);

  comprueba('avisa de la permanencia que le queda', tipos.includes('permanencia'));
  comprueba('la permanencia informa pero no toca el ahorro',
    e.alertas.find((a) => a.tipo === 'permanencia').afectaAlAhorro === false);
  comprueba('avisa de la penalización por salir', tipos.includes('penalizacion'));
  comprueba('y esa SÍ toca al ahorro del primer año',
    e.alertas.find((a) => a.tipo === 'penalizacion').afectaAlAhorro === true);
  comprueba('avisa de los periodos en exceso, nombrándolos',
    /P1, P3/.test(e.alertas.find((a) => a.tipo === 'exceso_potencia').texto));
  comprueba('y dice que ahí toca subir, no bajar',
    /subir, no bajar/.test(e.alertas.find((a) => a.tipo === 'exceso_potencia').texto));
  comprueba('avisa de los datos estimados', tipos.includes('datos_estimados'));

  const fv = evaluarEscenario(CTX, esc({ id: 'fv', tipo: 'fotovoltaica', extra: 900, inversion: 9000 }), HOY);
  comprueba('en fotovoltaica sin curva avisa de que el autoconsumo es una suposición',
    fv.alertas.some((a) => a.tipo === 'falta_curva'));
  comprueba('con curva no lo avisa',
    !evaluarEscenario({ ...CTX, tieneCurva: true }, esc({ id: 'fv2', tipo: 'fotovoltaica', extra: 900 }), HOY)
      .alertas.some((a) => a.tipo === 'falta_curva'));
  comprueba('calcula el retorno de la inversión sobre el ahorro TOTAL, no solo el extra',
    fv.retornoAnios === Math.round((9000 / fv.ahorroAnual) * 10) / 10 && fv.retornoAnios > 0,
    String(fv.retornoAnios));
  comprueba('sin inversión no hay retorno que dar',
    evaluarEscenario(CTX, esc({ id: 'z' }), HOY).retornoAnios === null);
}

titulo('Precios viejos y precios bloqueados');
{
  const viejo = evaluarEscenario(CTX, esc({ id: 'v', hip: { fechaPrecios: hace(DIAS_PRECIOS_CADUCADOS + 5) } }), HOY);
  comprueba('unos precios de hace más de un mes se avisan',
    viejo.alertas.some((a) => a.tipo === 'precios_viejos'));
  comprueba('y dice cuántos días llevan', /35 días/.test(
    viejo.alertas.find((a) => a.tipo === 'precios_viejos').texto));

  // El plan lo pide: una propuesta ya enviada no puede cambiar sola ni
  // empezar a gritar que sus precios caducaron. Se congeló a propósito.
  const bloqueado = evaluarEscenario(CTX,
    esc({ id: 'b', hip: { fechaPrecios: hace(200), bloqueada: true } }), HOY);
  comprueba('unos precios BLOQUEADOS no avisan de caducidad',
    !bloqueado.alertas.some((a) => a.tipo === 'precios_viejos'));

  comprueba('unos precios de hoy tampoco',
    !evaluarEscenario(CTX, esc({ id: 'h' }), HOY).alertas.some((a) => a.tipo === 'precios_viejos'));
}

titulo('Sin ahorro se avisa, no se disimula');
{
  const e = evaluarEscenario(CTX, esc({ id: 'malo', pe: [0.40, 0.40, 0.40] }), HOY);
  comprueba('el ahorro sale negativo y no se recorta a cero', e.ahorroAnual < 0);
  comprueba('y hay un aviso que lo dice', e.alertas.some((a) => a.tipo === 'sin_ahorro'));
}

titulo('Tres alternativas, no cinco');
{
  const muchos = Array.from({ length: 7 }, (_, i) =>
    esc({ id: `e${i}`, pe: [0.14 - i * 0.005, 0.13, 0.11] }));
  const ev = evaluarEscenarios(CTX, muchos, HOY);
  comprueba('se cortan en tres', ev.length === TOPE_ESCENARIOS, String(ev.length));
  comprueba('y son las tres que más ahorran',
    ev[0].ahorroAnual >= ev[1].ahorroAnual && ev[1].ahorroAnual >= ev[2].ahorroAnual);
  comprueba('el tope se puede levantar si hace falta',
    evaluarEscenarios(CTX, muchos, HOY, 99).length === 7);
  comprueba('los cinco tipos tienen nombre en castellano',
    ['fijo', 'indexado', 'optimizar_potencia', 'fotovoltaica', 'servicios']
      .every((t) => TIPO_ESCENARIO_LABEL[t]?.length > 3));
}

titulo('Las alertas del contexto no se repiten una vez por escenario');
{
  const ctx = { ...CTX, permanenciaRestanteMeses: 6, penalizacionActual: 200 };
  const ev = evaluarEscenarios(ctx, [
    esc({ id: 'a' }), esc({ id: 'b', pe: [0.15, 0.14, 0.12] }), esc({ id: 'c', pe: [0.16, 0.15, 0.13] }),
  ], HOY);
  const todas = alertasDeLaComparativa(ev);

  comprueba('la permanencia sale UNA vez, no tres',
    todas.filter((a) => a.tipo === 'permanencia').length === 1,
    String(todas.filter((a) => a.tipo === 'permanencia').length));
  comprueba('lo que toca al ahorro va primero', todas[0].afectaAlAhorro === true);
  comprueba('sin contexto problemático no hay alertas',
    alertasDeLaComparativa(evaluarEscenarios(CTX, [esc({ id: 'a' })], HOY)).length === 0);

  // Salió en pantalla: la comparativa decía «ahorro 189 €» arriba y «no hay
  // ahorro que enseñar» abajo, porque la alerta la generaba la alternativa que
  // perdía. Un informe que se contradice a sí mismo no se cree nadie.
  const mezcla = evaluarEscenarios(CTX, [
    esc({ id: 'buena', pe: [0.14, 0.13, 0.11] }),
    esc({ id: 'mala', pe: [0.40, 0.40, 0.40] }),
  ], HOY);
  comprueba('la alternativa que pierde SÍ lleva su aviso',
    mezcla.some((e) => e.alertas.some((a) => a.tipo === 'sin_ahorro')));
  comprueba('pero NO sale como aviso de toda la comparativa si alguna ahorra',
    !alertasDeLaComparativa(mezcla).some((a) => a.tipo === 'sin_ahorro'),
    JSON.stringify(alertasDeLaComparativa(mezcla)));

  const ningunaAhorra = evaluarEscenarios(CTX, [
    esc({ id: 'mala1', pe: [0.40, 0.40, 0.40] }),
    esc({ id: 'mala2', pe: [0.50, 0.50, 0.50] }),
  ], HOY);
  comprueba('si no ahorra ninguna, ahí sí se dice',
    alertasDeLaComparativa(ningunaAhorra).some((a) => a.tipo === 'sin_ahorro'));
}

titulo('El resumen de portada dice lo mismo que la pantalla');
{
  const ev = evaluarEscenarios(CTX, [
    esc({ id: 'fijo', titulo: 'Fijo 12 meses', perm: 12 }),
  ], HOY);
  const r = recomendar(ev);
  const res = resumenComparativa(CTX, r);

  comprueba('coste actual y propuesto salen del mismo cálculo',
    Math.abs(res.costeActual - costeActual(CTX).total) < 0.01
    && Math.abs(res.costePropuesto - ev[0].costeAnual) < 0.01);
  comprueba('el ahorro cuadra con el escenario elegido',
    Math.abs(res.ahorroAnual - ev[0].ahorroAnual) < 0.01);
  comprueba('lleva la permanencia', res.permanenciaMeses === 12);
  comprueba('lleva el riesgo', res.riesgo === 'bajo');
  comprueba('lleva la tarifa con su nombre real', res.tarifa === '2.0TD');
  comprueba('y el consumo anual', res.consumoAnualKwh === 14400, String(res.consumoAnualKwh));

  const nada = resumenComparativa(CTX, recomendar([]));
  comprueba('sin recomendación, el coste propuesto es el actual y el ahorro cero',
    nada.costePropuesto === nada.costeActual && nada.ahorroAnual === 0);
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} bien, ${fallos} mal\n`);
process.exit(fallos === 0 ? 0 : 1);
