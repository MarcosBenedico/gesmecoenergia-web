/**
 * Tests del panel de seguimiento de preclientes.
 *
 *   npm run test:seguimiento
 *
 * Lo que se protege aquí no es el dibujo de la pantalla, es el CRITERIO: en
 * qué punto está cada cliente, cuánto lleva parado y cuándo eso ya es un
 * problema. Si esto se equivoca, el panel manda a Marcos a llamar al cliente
 * que no toca y deja morir al que sí.
 */
import {
  faseDe, diasEntre, ultimoMovimiento, queFalta, seMuereEstaSemana, relojes, FASES, FASE,
} from '../src/lib/seguimiento.ts';

let ok = 0, fallos = 0;
const comprueba = (n, c, d = '') => {
  if (c) { ok++; console.log(`  ✓ ${n}`); }
  else { fallos++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`); }
};
const titulo = (t) => console.log(`\n${t}`);

const cups = (kwh) => ({ id: 'c1', consumo_anual_kwh: kwh });
const op = (estado) => ({ id: 'o1', estado });
const contrato = (o) => ({ id: 'k1', estado_contrato: 'firmado', ...o });

titulo('En qué punto está cada cliente');
{
  comprueba('sin nada, lo que falta es la factura',
    faseDe({}) === 'esperando_factura');

  comprueba('un CUPS SIN consumo sigue siendo esperar la factura',
    faseDe({ cups: [cups(0)] }) === 'esperando_factura',
    faseDe({ cups: [cups(0)] }));

  comprueba('con consumo cargado, la pelota pasa a ser nuestra',
    faseDe({ cups: [cups(45000)] }) === 'falta_estudio');

  comprueba('oferta enviada = esperando respuesta',
    faseDe({ cups: [cups(45000)], pipeline: [op('oferta_enviada')] }) === 'esperando_respuesta');

  comprueba('pendiente de firma = cerrando',
    faseDe({ pipeline: [op('pendiente_firma')] }) === 'cerrando');

  comprueba('documentación incompleta también es cerrando',
    faseDe({ pipeline: [op('doc_incompleta')] }) === 'cerrando');
}

titulo('Lo firmado y sin activar manda sobre todo');
{
  // Es lo único que ya está vendido: si se cae, se cae dinero cobrado.
  comprueba('firmado sin activar gana a cualquier otra fase',
    faseDe({
      cups: [cups(45000)],
      pipeline: [op('oferta_enviada')],
      contratos: [contrato({ fecha_firma: '2026-08-01', fecha_activacion_real: null })],
    }) === 'esperando_activacion');

  // El caso real que se encontró: contratos con la firma puesta que seguían
  // figurando como "pendiente_firma". Manda el dato, no la etiqueta.
  comprueba('con fecha de firma cuenta como firmado aunque el estado diga otra cosa',
    faseDe({ contratos: [contrato({ estado_contrato: 'pendiente_firma', fecha_firma: '2026-08-01' })] })
      === 'esperando_activacion');

  comprueba('ya activado y sin nada abierto sale del panel',
    faseDe({ contratos: [contrato({ fecha_firma: '2026-07-01', fecha_activacion_real: '2026-07-20' })] })
      === null);

  comprueba('activado pero con otra oportunidad abierta sigue en el panel',
    faseDe({
      contratos: [contrato({ fecha_firma: '2026-07-01', fecha_activacion_real: '2026-07-20' })],
      pipeline: [op('oferta_enviada')],
    }) === 'esperando_respuesta');

  comprueba('una oportunidad ya ganada o perdida no cuenta',
    faseDe({ pipeline: [op('ganado'), op('perdido')] }) === 'esperando_factura');
}

titulo('Los plazos dependen de quién tiene la pelota');
{
  comprueba('lo nuestro aprieta más que lo del cliente',
    FASE.falta_estudio.limiteDias < FASE.esperando_factura.limiteDias,
    `${FASE.falta_estudio.limiteDias} vs ${FASE.esperando_factura.limiteDias}`);

  comprueba('la activación es lo que más aire tiene',
    FASE.esperando_activacion.limiteDias === Math.max(...FASES.map((f) => f.limiteDias)));

  comprueba('seguir una oferta es lo más urgente de todo',
    FASE.esperando_respuesta.limiteDias === Math.min(...FASES.map((f) => f.limiteDias)));

  comprueba('cada fase declara de quién es la pelota',
    FASES.every((f) => ['nuestra', 'del_cliente', 'de_la_comercializadora'].includes(f.pelota)));
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
    queFalta('esperando_factura', false).includes('teléfono'));
  comprueba('con teléfono, lo que falta es reclamar',
    queFalta('esperando_factura', true) === 'Reclamar la factura');
  comprueba('todas las fases dicen algo',
    FASES.every((f) => queFalta(f.id, true).length > 5));
}

titulo('La franja roja es corta a propósito');
{
  const f = (o) => ({
    clienteId: o.id, nombre: o.id, telefono: '600', fase: o.fase || 'esperando_factura',
    diasParado: o.dias ?? 1, enRojo: !!o.rojo, queFalta: '', ultimoApunte: null,
    ultimaFecha: null, comision: o.com ?? 0, diasPreaviso: o.preaviso ?? null,
  });

  const lista = [
    f({ id: 'preaviso-manana', preaviso: 1 }),
    f({ id: 'preaviso-lejos', preaviso: 60 }),
    f({ id: 'oferta-parada', fase: 'esperando_respuesta', rojo: true, dias: 12 }),
    f({ id: 'factura-parada', fase: 'esperando_factura', rojo: true, dias: 30 }),
    f({ id: 'tranquilo' }),
  ];
  const rojo = seMuereEstaSemana(lista).map((x) => x.nombre);

  comprueba('entra el preaviso que vence esta semana', rojo.includes('preaviso-manana'));
  comprueba('no entra el preaviso que vence en dos meses', !rojo.includes('preaviso-lejos'));
  comprueba('entra la oferta parada, que se enfría sola', rojo.includes('oferta-parada'));
  comprueba('NO entra una factura parada por muy vieja que sea, no se muere hoy',
    !rojo.includes('factura-parada'), rojo.join(','));
  comprueba('el que va bien no aparece', !rojo.includes('tranquilo'));
  comprueba('lo que caduca antes va primero', rojo[0] === 'preaviso-manana');
  comprueba('la franja es corta: 2 de 5', rojo.length === 2, `${rojo.length}`);
}

titulo('Relojes de la cabecera');
{
  const f = (fase, dias, rojo, com = 0) => ({
    clienteId: 'x', nombre: 'x', telefono: null, fase, diasParado: dias, enRojo: rojo,
    queFalta: '', ultimoApunte: null, ultimaFecha: null, comision: com, diasPreaviso: null,
  });
  const r = relojes([
    f('esperando_factura', 10, false, 100),
    f('esperando_factura', 20, true, 200),
    f('falta_estudio', 3, false),
  ]);
  const factura = r.find((x) => x.id === 'esperando_factura');

  comprueba('cuenta los de cada fase', factura.total === 2);
  comprueba('cuenta cuántos van en rojo', factura.enRojo === 1);
  comprueba('promedia los días', factura.diasMedios === 15, String(factura.diasMedios));
  comprueba('suma la comisión en juego', factura.comision === 300);

  comprueba('con un solo dato NO enseña media (sería ese dato disfrazado)',
    r.find((x) => x.id === 'falta_estudio').diasMedios === null);

  comprueba('las fases vacías también salen, con cero',
    r.find((x) => x.id === 'cerrando').total === 0);
  comprueba('salen todas las fases, siempre en el mismo orden',
    r.map((x) => x.id).join(',') === FASES.map((x) => x.id).join(','));
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} bien, ${fallos} mal\n`);
process.exit(fallos === 0 ? 0 : 1);
