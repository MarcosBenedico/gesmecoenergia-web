/**
 * Tests del DASHBOARD DE DIRECCIÓN (GL-03).
 *
 *   npm run test:dashboard
 *
 * Lo que hay que proteger aquí no es que las cifras cuadren —eso lo hace una
 * suma— sino que el ORDEN sea el correcto. Un dashboard que pone arriba la
 * comisión más gorda y deja caducar un preaviso pequeño hace perder un cliente
 * un año entero, y encima parece que funciona.
 */
import {
  prioridadesDeHoy, cabecera, embudo, vencimientos, alertasCalidad,
  TOPE_PRIORIDADES, TOPE_ALERTAS, TITULO_PRIORIDAD,
} from '../src/lib/dashboard.ts';
import { ETAPAS_EN_JUEGO } from '../src/lib/etapas.ts';

let ok = 0, fallos = 0;
const comprueba = (n, c, d = '') => {
  if (c) { ok++; console.log(`  ✓ ${n}`); }
  else { fallos++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`); }
};
const titulo = (t) => console.log(`\n${t}`);

const HOY = '2026-08-18';
/** Cliente mínimo; cada test añade solo lo que le importa. */
const cli = (o) => ({
  id: o.id, nombre: o.id, estadoComercial: o.estadoComercial ?? null,
  telefono: o.telefono === undefined ? '600000000' : o.telefono,
  cups: o.cups ?? [], pipeline: o.pipeline ?? [], contratos: o.contratos ?? [],
  ultimoApunte: o.apunte ?? null, ultimoContacto: o.contacto ?? null,
});
/** Un CUPS parado en una etapa desde hace N días. */
const enEtapa = (estado, dias, comision = 0) => ({
  cups: [{ estado_cups: estado, consumo_anual_kwh: 10000 }],
  pipeline: [{ estado: 'x', comision_potencial: comision, actualizado_en: hace(dias) }],
});
const hace = (dias) => {
  const d = new Date(`${HOY}T00:00:00`);
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
};
const dentroDe = (dias) => {
  const d = new Date(`${HOY}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

titulo('El orden: primero lo que NO se recupera');
{
  const p = prioridadesDeHoy([
    cli({ id: 'oferta-gorda', ...enEtapa('oferta_enviada', 40, 9000) }),
    cli({
      id: 'preaviso-pequeno',
      cups: [{ estado_cups: 'activado', fecha_limite_preaviso: dentroDe(3), consumo_anual_kwh: 5000 }],
      pipeline: [{ estado: 'x', comision_potencial: 50, actualizado_en: hace(1) }],
    }),
  ], HOY);

  comprueba('un preaviso de 50 € manda sobre una oferta de 9.000 €',
    p[0].tipo === 'preaviso', p.map((x) => `${x.cliente}:${x.tipo}`).join(' | '));
  comprueba('la oferta parada sigue estando, no se pierde', p.some((x) => x.tipo === 'propuesta'));
  comprueba('el detalle lleva el número que lo justifica', /3 días/.test(p[0].detalle), p[0].detalle);
}

titulo('Dentro del mismo escalón manda el dinero');
{
  const p = prioridadesDeHoy([
    cli({ id: 'poco', ...enEtapa('oferta_enviada', 10, 100) }),
    cli({ id: 'mucho', ...enEtapa('oferta_enviada', 10, 8000) }),
  ], HOY);
  comprueba('a igualdad de tipo y días, primero la comisión mayor',
    p[0].cliente === 'mucho', p.map((x) => x.cliente).join(','));
}

titulo('Un cliente ocupa UNA línea, la de su peor problema');
{
  const p = prioridadesDeHoy([
    cli({
      id: 'multiproblema',
      cups: [
        { estado_cups: 'oferta_enviada', fecha_limite_preaviso: dentroDe(2), consumo_anual_kwh: 1 },
        { estado_cups: 'oferta_enviada', fecha_limite_preaviso: dentroDe(5), consumo_anual_kwh: 1 },
      ],
      pipeline: [{ estado: 'x', comision_potencial: 500, actualizado_en: hace(40) }],
    }),
  ], HOY);

  comprueba('un cliente con tres problemas aparece una sola vez', p.length === 1, String(p.length));
  comprueba('y aparece con el más grave de los suyos', p[0].tipo === 'preaviso', p[0]?.tipo);
  comprueba('de dos preavisos suyos cuenta el que antes caduca',
    /2 días/.test(p[0].detalle), p[0].detalle);
}

titulo('El tope son cinco decisiones, no una lista');
{
  const muchos = Array.from({ length: 12 }, (_, i) =>
    cli({ id: `c${i}`, ...enEtapa('oferta_enviada', 20 + i, 100 * i) }));
  const p = prioridadesDeHoy(muchos, HOY);
  comprueba('nunca salen más de cinco', p.length === TOPE_PRIORIDADES, String(p.length));
  comprueba('el tope se puede levantar para contar', prioridadesDeHoy(muchos, HOY, 999).length === 12);
}

titulo('Lo que NO es una decisión de hoy no gasta un hueco');
{
  const lejos = prioridadesDeHoy([
    cli({ id: 'preaviso-en-3-meses', cups: [{ estado_cups: 'activado', fecha_limite_preaviso: dentroDe(89) }] }),
  ], HOY);
  comprueba('un preaviso a tres meses no sale en las prioridades', lejos.length === 0, String(lejos.length));

  const dentroDePlazo = prioridadesDeHoy([
    cli({ id: 'oferta-de-ayer', ...enEtapa('oferta_enviada', 1, 5000) }),
  ], HOY);
  comprueba('una oferta enviada ayer tampoco: aún no ha pasado su plazo',
    dentroDePlazo.length === 0, String(dentroDePlazo.length));

  const yaCerrado = prioridadesDeHoy([
    cli({ id: 'activo', cups: [{ estado_cups: 'activado' }], pipeline: [{ estado: 'x', actualizado_en: hace(400) }] }),
  ], HOY);
  comprueba('un cliente ya activo no es una decisión, por parado que esté',
    yaCerrado.length === 0, String(yaCerrado.length));

  const preavisoPasado = prioridadesDeHoy([
    cli({ id: 'ventana-cerrada', cups: [{ estado_cups: 'activado', fecha_limite_preaviso: hace(5) }] }),
  ], HOY);
  comprueba('un preaviso YA vencido no se pone como si aún se pudiera hacer algo',
    preavisoPasado.length === 0, String(preavisoPasado.length));
}

titulo('Cada prioridad dice a las claras qué es');
{
  const p = prioridadesDeHoy([
    cli({ id: 'a', ...enEtapa('oferta_enviada', 40, 100) }),
    cli({ id: 'b', ...enEtapa('sin_factura', 40, 100) }),
  ], HOY);
  comprueba('todas llevan título del catálogo',
    p.every((x) => x.titulo === TITULO_PRIORIDAD[x.tipo]));
  comprueba('todas llevan detalle escrito', p.every((x) => x.detalle.length > 10));
  comprueba('todas llevan a un cliente concreto', p.every((x) => !!x.clienteId));

  // El plan lo pide expresamente: una línea que dice qué hacer y no lleva a
  // hacerlo se convierte en texto que se lee y no se ejecuta.
  comprueba('todas llevan a alguna parte', p.every((x) => x.href?.startsWith('/gestor/luz/')));

  const estudio = prioridadesDeHoy([cli({ id: 'e', ...enEtapa('factura_recibida', 40, 100) })], HOY);
  comprueba('«falta el estudio» lleva a preparar el estudio, no a leer una ficha',
    estudio[0]?.tipo === 'estudio' && estudio[0].href === '/gestor/luz/estudios',
    JSON.stringify(estudio[0]));

  const activar = prioridadesDeHoy([
    cli({ id: 'f', cups: [{ estado_cups: 'contrato_firmado' }], contratos: [{ estado_contrato: 'firmado', fecha_firma: hace(60) }], pipeline: [{ estado: 'x', actualizado_en: hace(60) }] }),
  ], HOY);
  comprueba('«firmado sin activar» lleva a contratos',
    activar[0]?.href.startsWith('/gestor/luz/contratos'), JSON.stringify(activar[0]));
}

titulo('Las tres cifras de cabecera');
{
  const c = cabecera([
    cli({ id: 'ofertado', ...enEtapa('oferta_enviada', 2, 1000) }),
    cli({ id: 'ofertado-parado', ...enEtapa('oferta_enviada', 40, 2000) }),
    cli({ id: 'firmado', cups: [{ estado_cups: 'contrato_firmado' }], pipeline: [{ estado: 'x', comision_potencial: 700, actualizado_en: hace(1) }] }),
    cli({ id: 'activo', cups: [{ estado_cups: 'activado' }] }),
  ], HOY);

  comprueba('«requieren decisión» cuenta solo lo que está en rojo, no la cartera',
    c.requierenDecision === 1, String(c.requierenDecision));
  comprueba('el ahorro propuesto suma lo que está encima de la mesa',
    c.ahorroPropuesto === 3000, String(c.ahorroPropuesto));
  comprueba('los contratos por cerrar cuentan los que dijeron que sí',
    c.contratosPorCerrar === 1, String(c.contratosPorCerrar));
  comprueba('y llevan su importe al lado', c.importePorCerrar === 700, String(c.importePorCerrar));
  comprueba('lo ya activo no cuenta como pendiente de cerrar',
    c.contratosPorCerrar === 1);
}

titulo('El embudo lleva valor, no solo cuentas');
{
  const e = embudo([
    cli({ id: 'a', ...enEtapa('oferta_enviada', 1, 1000) }),
    cli({ id: 'b', ...enEtapa('oferta_enviada', 1, 500) }),
    cli({ id: 'c', ...enEtapa('sin_factura', 1, 300) }),
  ], ETAPAS_EN_JUEGO);

  const oferta = e.find((x) => x.etapa === 'propuesta_enviada');
  comprueba('agrupa los clientes por etapa', oferta.clientes === 2, String(oferta.clientes));
  comprueba('y suma lo que hay en juego en cada una', oferta.importe === 1500, String(oferta.importe));
  comprueba('salen todas las etapas pedidas, también las vacías',
    e.length === ETAPAS_EN_JUEGO.length);
  comprueba('en el orden en que se piden',
    e.map((x) => x.etapa).join(',') === ETAPAS_EN_JUEGO.join(','));
  comprueba('cada etapa trae su título y su tono del vocabulario común',
    e.every((x) => x.titulo.length > 2 && x.tono.length > 0));
}

titulo('Vencimientos por tramos');
{
  const v = vencimientos([
    cli({ id: 'ya-mismo', cups: [{ estado_cups: 'activado', fecha_limite_preaviso: dentroDe(5) }] }),
    cli({ id: 'dos-meses', cups: [{ estado_cups: 'activado', fecha_limite_preaviso: dentroDe(45) }] }),
    cli({ id: 'tres-meses', cups: [{ estado_cups: 'activado', fecha_limite_preaviso: dentroDe(80) }] }),
    cli({ id: 'muy-lejos', cups: [{ estado_cups: 'activado', fecha_limite_preaviso: dentroDe(200) }] }),
    cli({ id: 'sin-fecha', cups: [{ estado_cups: 'activado' }] }),
  ], HOY);

  comprueba('caben tres tramos y nada más allá de 90 días', v.length === 3, v.map((x) => x.cliente).join(','));
  comprueba('el más cercano va primero', v[0].cliente === 'ya-mismo');
  comprueba('los días son un número, no la lista de días',
    typeof v[0].dias === 'number' && v[0].dias === 5, JSON.stringify(v[0].dias));
  comprueba('el tramo se asigna por el número de días',
    v.map((x) => x.tramo).join(',') === '30,60,90', v.map((x) => x.tramo).join(','));

  const dos = vencimientos([
    cli({ id: 'dos-cups', cups: [
      { estado_cups: 'activado', fecha_limite_preaviso: dentroDe(70) },
      { estado_cups: 'activado', fecha_limite_preaviso: dentroDe(10) },
    ] }),
  ], HOY);
  comprueba('un cliente con dos suministros sale una vez y por el que antes vence',
    dos.length === 1 && dos[0].dias === 10, JSON.stringify(dos));
}

titulo('Alertas de calidad: solo lo que bloquea, y como mucho tres');
{
  const a = alertasCalidad([
    cli({ id: 'sin-tel', telefono: null, cups: [{ estado_cups: 'sin_factura', consumo_anual_kwh: 100 }], pipeline: [{ estado: 'x', actualizado_en: hace(1) }] }),
    cli({ id: 'sin-consumo', cups: [{ estado_cups: 'sin_factura', consumo_anual_kwh: 0 }] }),
    cli({ id: 'descuadrado', cups: [{ estado_cups: 'contrato_firmado', consumo_anual_kwh: 100 }], contratos: [{ estado_contrato: 'pendiente_firma', fecha_firma: hace(3) }] }),
  ]);

  comprueba('salen las tres cosas que bloquean', a.length === 3, JSON.stringify(a));
  comprueba('cada alerta lleva a dónde arreglarla', a.every((x) => x.href.startsWith('/gestor/luz/')));
  comprueba('ninguna alerta sale con cero', a.every((x) => x.cuantos > 0));
  comprueba('nunca pasan del tope', alertasCalidad([], TOPE_ALERTAS).length <= TOPE_ALERTAS);

  const limpio = alertasCalidad([cli({ id: 'ok', cups: [{ estado_cups: 'activado', consumo_anual_kwh: 9000 }] })]);
  comprueba('sin problemas no se inventa ninguna alerta', limpio.length === 0, JSON.stringify(limpio));

  // Un suministro sin consumo de alguien perdido no para a nadie: si contara,
  // la alerta crecería con la cartera muerta y se dejaría de mirar.
  const muerto = alertasCalidad([
    cli({ id: 'perdido', estadoComercial: 'perdido', cups: [{ estado_cups: 'perdido', consumo_anual_kwh: 0 }] }),
  ]);
  comprueba('un cliente perdido no genera alertas de calidad', muerto.length === 0, JSON.stringify(muerto));
}

titulo('Una cartera vacía no revienta ni miente');
{
  comprueba('sin clientes no hay prioridades', prioridadesDeHoy([], HOY).length === 0);
  const c = cabecera([], HOY);
  comprueba('la cabecera sale a cero', c.requierenDecision === 0 && c.ahorroPropuesto === 0 && c.contratosPorCerrar === 0);
  comprueba('el embudo sale con todas las etapas a cero',
    embudo([], ETAPAS_EN_JUEGO).every((x) => x.clientes === 0 && x.importe === 0));
  comprueba('sin vencimientos, lista vacía', vencimientos([], HOY).length === 0);
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} bien, ${fallos} mal\n`);
process.exit(fallos === 0 ? 0 : 1);
