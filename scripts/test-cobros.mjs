/**
 * Tests de la SITUACIÓN DE COBRO de las comisiones.
 *
 *   npm run test:cobros
 *
 * Lo que se protege aquí es que un montón de «pendientes» deje de ser un
 * montón. Medido en la cartera real el 9 de septiembre de 2026: 29 comisiones
 * en estado «prevista» suman 217,34 € ENTRE TODAS, con fechas de enero a
 * junio. Eso no es una cartera de cobro, es el residuo de una importación — y
 * mientras cuente como «pendiente» junto a las de verdad, la lista de cobros
 * no se mira.
 *
 * La regla que sale de ahí: LO QUE NO SE PUEDE JUSTIFICAR NO SE RECLAMA, y
 * tampoco se corrige por nuestra cuenta. Se marca con el motivo escrito.
 */
import {
  situacionDeCobro, resumenDeCobros, sePuedeReclamar,
  SITUACION_COBRO_LABEL, DIAS_PREVISTA_CADUCA,
} from '../src/lib/cobros.ts';

let ok = 0, fallos = 0;
const comprueba = (n, c, d = '') => {
  if (c) { ok++; console.log(`  ✓ ${n}`); }
  else { fallos++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`); }
};
const titulo = (t) => console.log(`\n${t}`);

const HOY = '2026-09-09';
const dia = (n) => {
  const x = new Date(`${HOY}T00:00:00`);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};
const com = (o = {}) => ({
  id: 'm1', cliente_id: 'c1', estado_comision: 'pendiente_cobro',
  importe_previsto: 450, importe_cobrado: 0, fecha_prevista_cobro: dia(-10), ...o,
});

titulo('Una previsión futura NO es una deuda vencida');
{
  const futura = situacionDeCobro(com({ fecha_prevista_cobro: dia(40) }), HOY);
  comprueba('lo de dentro de 40 días no está vencido', futura.situacion === 'no_exigible', futura.situacion);
  comprueba('y lo dice en la frase', /dentro de 40/.test(futura.texto), futura.texto);
  comprueba('no se propone reclamarla', !sePuedeReclamar(com({ fecha_prevista_cobro: dia(40) }), HOY));

  const hoyToca = situacionDeCobro(com({ fecha_prevista_cobro: HOY }), HOY);
  comprueba('la que vence hoy es exigible, no vencida', hoyToca.situacion === 'exigible', hoyToca.situacion);

  const tarde = situacionDeCobro(com(), HOY);
  comprueba('la de hace 10 días está vencida', tarde.situacion === 'vencido', tarde.situacion);
  comprueba('y dice cuántos días lleva', /10 días/.test(tarde.texto), tarde.texto);
}

titulo('Lo que no se puede justificar se marca, nunca se inventa');
{
  const sinImporte = situacionDeCobro(com({ importe_previsto: 0 }), HOY);
  comprueba('sin importe: por revisar', sinImporte.situacion === 'por_revisar', sinImporte.situacion);
  comprueba('con el motivo escrito', /no se sabe cuánto/i.test(sinImporte.motivoRevision || ''), String(sinImporte.motivoRevision));
  comprueba('y NO se corrige el importe por nuestra cuenta', sinImporte.previsto === 0);

  const sinFecha = situacionDeCobro(com({ fecha_prevista_cobro: null }), HOY);
  comprueba('sin fecha: por revisar', sinFecha.situacion === 'por_revisar', sinFecha.situacion);
  comprueba('no se inventa ninguna fecha', sinFecha.diasVencido === null);

  // El caso de los 29 apuntes: siguen como «prevista» y llevan meses pasados.
  const vieja = situacionDeCobro(com({ estado_comision: 'prevista', importe_previsto: 7.5, fecha_prevista_cobro: dia(-(DIAS_PREVISTA_CADUCA + 30)) }), HOY);
  comprueba('una «prevista» caducada va a revisar, no a reclamar', vieja.situacion === 'por_revisar', vieja.situacion);
  comprueba('y el motivo dice que hay que confirmarla',
    /confirmar con la comercializadora/i.test(vieja.motivoRevision || ''), String(vieja.motivoRevision));

  // Una prevista reciente sí es normal: está esperando a la comercializadora.
  const reciente = situacionDeCobro(com({ estado_comision: 'prevista', fecha_prevista_cobro: dia(-5) }), HOY);
  comprueba('una «prevista» de hace 5 días no se pone en duda', reciente.situacion !== 'por_revisar', reciente.situacion);
}

titulo('La pelota separa lo mío de lo que espera a un tercero');
{
  const tercero = situacionDeCobro(com({ estado_comision: 'prevista', fecha_prevista_cobro: dia(-5) }), HOY);
  comprueba('una prevista espera a la comercializadora', tercero.pelota === 'de_la_comercializadora', tercero.pelota);
  comprueba('y por eso no se pinta como vencida', tercero.situacion === 'exigible', tercero.situacion);
  comprueba('pero sí dice que ya debería haber entrado', /falta que la comercializadora/.test(tercero.texto), tercero.texto);

  const mia = situacionDeCobro(com({ estado_comision: 'pendiente_cobro' }), HOY);
  comprueba('una confirmada y vencida la tengo que mover yo', mia.pelota === 'nuestra', mia.pelota);
}

titulo('Un cobro parcial baja el saldo y no duplica nada');
{
  const p = situacionDeCobro(com({ importe_previsto: 450, importe_cobrado: 200 }), HOY);
  comprueba('la situación es parcial', p.situacion === 'parcial', p.situacion);
  comprueba('el saldo son los 250 que faltan', p.saldo === 250, String(p.saldo));

  const completo = situacionDeCobro(com({ importe_previsto: 450, importe_cobrado: 450 }), HOY);
  comprueba('cobrado del todo, aunque el estado no se haya actualizado', completo.situacion === 'cobrado', completo.situacion);
  comprueba('y el saldo es cero', completo.saldo === 0);
  // Un saldo negativo haría que el total exigible bajara al cobrar de más.
  const demas = situacionDeCobro(com({ importe_previsto: 450, importe_cobrado: 600 }), HOY);
  comprueba('cobrar de más no genera saldo negativo', demas.saldo === 0, String(demas.saldo));
}

titulo('El cuadro no mete previsiones en el dinero que se persigue');
{
  const r = resumenDeCobros([
    com({ id: 'a', fecha_prevista_cobro: dia(-30), importe_previsto: 1000 }),          // vencida
    com({ id: 'b', fecha_prevista_cobro: dia(60), importe_previsto: 800 }),            // futura
    com({ id: 'c', estado_comision: 'prevista', fecha_prevista_cobro: dia(-5), importe_previsto: 300 }), // espera al tercero
    com({ id: 'd', importe_previsto: 0 }),                                             // sin dato
    com({ id: 'e', estado_comision: 'cobrada', importe_previsto: 500, importe_cobrado: 500, fecha_cobro: dia(-3) }),
  ], HOY);

  comprueba('lo exigible son los 1000 vencidos + los 300 del tercero', r.exigible === 1300, String(r.exigible));
  // Vencido = confirmado y sin entrar. La «prevista» de hace 5 días se persigue
  // pero no se pinta en rojo: es el ciclo de liquidación de la comercializadora,
  // y un rojo que sale siempre deja de distinguir a la que lleva medio año.
  comprueba('lo vencido son solo los 1000 confirmados', r.vencido === 1000, String(r.vencido));
  // Si los 800 futuros entraran en «exigible», el número invitaría a reclamar
  // algo que aún no toca y quedaría mal con la comercializadora.
  comprueba('los 800 futuros van a previsto, no a exigible', r.previsto === 800, String(r.previsto));
  comprueba('los 300 se marcan además como esperando a un tercero', r.enTerceros === 300, String(r.enTerceros));
  comprueba('lo que no tiene dato se cuenta aparte', r.cuantasPorRevisar === 1, String(r.cuantasPorRevisar));
  comprueba('lo cobrado no se mezcla con lo pendiente', r.cobradoEnPlazo === 500, String(r.cobradoEnPlazo));
}

titulo('Cada situación tiene su texto para pantalla');
{
  comprueba('las siete están etiquetadas',
    Object.values(SITUACION_COBRO_LABEL).filter((t) => t.length > 3).length === 7);
  // «Pendiente» hay que investigarlo; «se puede reclamar» se hace.
  comprueba('ninguna etiqueta dice solo «pendiente»',
    !Object.values(SITUACION_COBRO_LABEL).some((t) => /^pendiente$/i.test(t)));
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} correctos, ${fallos} fallos\n`);
process.exit(fallos === 0 ? 0 : 1);
