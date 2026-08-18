/**
 * Tests del RELOJ de seguimiento.
 *
 *   npm run test:seguimiento
 *
 * En qué punto está cada cliente se comprueba en test-etapas (vocabulario
 * único). Aquí se protege lo otro: cuánto lleva ahí y cuándo eso ya es un
 * problema. Si esto se equivoca, el panel manda a Marcos a llamar al cliente
 * que no toca y deja morir al que sí.
 */
import {
  diasEntre, ultimoMovimiento, queFalta, estaEnRojo, seMuereEstaSemana, relojes,
  PLAZOS, ETAPAS_SEGUIMIENTO, ETAPA, etapaDeCliente,
} from '../src/lib/seguimiento.ts';

let ok = 0, fallos = 0;
const comprueba = (n, c, d = '') => {
  if (c) { ok++; console.log(`  ✓ ${n}`); }
  else { fallos++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`); }
};
const titulo = (t) => console.log(`\n${t}`);

titulo('El seguimiento habla el MISMO idioma que el resto');
{
  // Este archivo llegó a tener sus propias cinco fases, parecidas a las
  // etapas pero distintas. La misma tarjeta enseñaba dos etiquetas para lo
  // mismo. Que no vuelva a pasar.
  comprueba('las etapas del panel salen del vocabulario común',
    ETAPAS_SEGUIMIENTO.every((id) => !!ETAPA[id]), ETAPAS_SEGUIMIENTO.join(','));

  comprueba('van en orden de avance del viaje',
    ETAPAS_SEGUIMIENTO.map((id) => ETAPA[id].avance).every((a, i, xs) => i === 0 || a > xs[i - 1]),
    ETAPAS_SEGUIMIENTO.map((id) => ETAPA[id].avance).join(','));

  comprueba('lo cerrado no tiene reloj: no se persigue a quien ya está activo, perdido o aparcado',
    !PLAZOS.activo && !PLAZOS.perdido && !PLAZOS.aparcado);

  comprueba('la etapa la calcula etapas.ts, no este archivo',
    etapaDeCliente({ cups: [{ estado_cups: 'oferta_enviada' }] }) === 'propuesta_enviada');
}

titulo('Los plazos dependen de quién tiene la pelota');
{
  const limites = ETAPAS_SEGUIMIENTO.map((id) => PLAZOS[id].limiteDias);

  comprueba('lo nuestro aprieta más que lo del cliente',
    PLAZOS.en_analisis.limiteDias < PLAZOS.factura_solicitada.limiteDias,
    `${PLAZOS.en_analisis.limiteDias} vs ${PLAZOS.factura_solicitada.limiteDias}`);

  comprueba('la activación es lo que más aire tiene',
    PLAZOS.activacion.limiteDias === Math.max(...limites));

  comprueba('seguir una propuesta es lo más urgente de todo',
    PLAZOS.propuesta_enviada.limiteDias === Math.min(...limites));

  comprueba('cada etapa declara de quién es la pelota',
    ETAPAS_SEGUIMIENTO.every((id) =>
      ['nuestra', 'del_cliente', 'de_la_comercializadora'].includes(PLAZOS[id].pelota)));

  comprueba('cada plazo explica qué se está esperando',
    ETAPAS_SEGUIMIENTO.every((id) => PLAZOS[id].pista.length > 10));

  comprueba('el rojo salta al pasarse del plazo de SU etapa, no de uno general',
    estaEnRojo('propuesta_enviada', 5) && !estaEnRojo('factura_solicitada', 5));

  comprueba('sin días parados no hay rojo', !estaEnRojo('en_analisis', null));
  comprueba('una etapa sin reloj nunca se pone en rojo', !estaEnRojo('activo', 500));
}

titulo('Días parados');
{
  comprueba('cuenta días enteros', diasEntre('2026-08-01', '2026-08-17') === 16);
  comprueba('sin fecha devuelve null', diasEntre(null, '2026-08-17') === null);
  comprueba('aguanta una marca de tiempo completa',
    diasEntre('2026-08-01T10:30:00Z', '2026-08-17') === 16);
  comprueba('una fecha ilegible no revienta', diasEntre('vete a saber', '2026-08-17') === null);

  comprueba('el último movimiento es el más reciente de todas las señales',
    ultimoMovimiento(['2026-07-01', '2026-08-10', null, '2026-07-20']) === '2026-08-10');

  // Si solo contaran los apuntes, un cliente que Nicola está trabajando a
  // diario en el pipeline saldría como abandonado.
  comprueba('un movimiento en el pipeline cuenta como señal de vida',
    ultimoMovimiento([null, '2026-08-16T09:00:00Z']) === '2026-08-16');

  comprueba('sin ninguna señal devuelve null', ultimoMovimiento([null, undefined]) === null);
}

titulo('Qué le falta a cada uno');
{
  comprueba('sin teléfono, lo que falta es el teléfono',
    queFalta('factura_solicitada', false).includes('teléfono'));
  comprueba('con teléfono, lo que falta es reclamar',
    queFalta('factura_solicitada', true) === 'Reclamar la factura');
  comprueba('todas las etapas dicen algo',
    ETAPAS_SEGUIMIENTO.every((id) => queFalta(id, true).length > 5));
  comprueba('una etapa cerrada devuelve su condición y no revienta',
    queFalta('activo', true).length > 5);
}

titulo('La franja roja es corta a propósito');
{
  const f = (o) => ({
    clienteId: o.id, nombre: o.id, telefono: '600', etapa: o.etapa || 'factura_solicitada',
    diasParado: o.dias ?? 1, enRojo: !!o.rojo, queFalta: '', ultimoApunte: null,
    ultimaFecha: null, comision: o.com ?? 0, diasPreaviso: o.preaviso ?? null, avisos: [],
  });

  const lista = [
    f({ id: 'preaviso-manana', preaviso: 1 }),
    f({ id: 'preaviso-lejos', preaviso: 60 }),
    f({ id: 'oferta-parada', etapa: 'propuesta_enviada', rojo: true, dias: 12 }),
    f({ id: 'factura-parada', etapa: 'factura_solicitada', rojo: true, dias: 30 }),
    f({ id: 'tranquilo' }),
  ];
  const rojo = seMuereEstaSemana(lista).map((x) => x.nombre);

  comprueba('entra el preaviso que vence esta semana', rojo.includes('preaviso-manana'));
  comprueba('no entra el preaviso que vence en dos meses', !rojo.includes('preaviso-lejos'));
  comprueba('entra la propuesta parada, que se enfría sola', rojo.includes('oferta-parada'));
  comprueba('NO entra una factura parada por muy vieja que sea, no se muere hoy',
    !rojo.includes('factura-parada'), rojo.join(','));
  comprueba('el que va bien no aparece', !rojo.includes('tranquilo'));
  comprueba('lo que caduca antes va primero', rojo[0] === 'preaviso-manana');
  comprueba('la franja es corta: 2 de 5', rojo.length === 2, String(rojo.length));
}

titulo('Relojes de la cabecera');
{
  const f = (etapa, dias, rojo, com = 0) => ({
    clienteId: 'x', nombre: 'x', telefono: null, etapa, diasParado: dias, enRojo: rojo,
    queFalta: '', ultimoApunte: null, ultimaFecha: null, comision: com, diasPreaviso: null, avisos: [],
  });
  const r = relojes([
    f('factura_solicitada', 10, false, 100),
    f('factura_solicitada', 20, true, 200),
    f('en_analisis', 3, false),
  ]);
  const factura = r.find((x) => x.id === 'factura_solicitada');

  comprueba('cuenta los de cada etapa', factura.total === 2);
  comprueba('cuenta cuántos van en rojo', factura.enRojo === 1);
  comprueba('promedia los días', factura.diasMedios === 15, String(factura.diasMedios));
  comprueba('suma la comisión en juego', factura.comision === 300);

  comprueba('con un solo dato NO enseña media (sería ese dato disfrazado)',
    r.find((x) => x.id === 'en_analisis').diasMedios === null);

  comprueba('las etapas vacías también salen, con cero',
    r.find((x) => x.id === 'pendiente_firma').total === 0);
  comprueba('salen todas las etapas con reloj, siempre en el mismo orden',
    r.map((x) => x.id).join(',') === ETAPAS_SEGUIMIENTO.join(','));
  comprueba('cada reloj lleva su título del vocabulario común',
    r.every((x) => x.titulo === ETAPA[x.id].titulo));
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} bien, ${fallos} mal\n`);
process.exit(fallos === 0 ? 0 : 1);
