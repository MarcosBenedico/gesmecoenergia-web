/**
 * Tests del foco del día: a quién se aparta del seguimiento y a quién se fija.
 *
 * Cada comprobación lleva el nombre de un fallo que costaría algo:
 * un cliente apartado que sigue apareciendo (la lista se deja de mirar), uno
 * apartado con fecha que no vuelve nunca (se pierde la cartera en un limbo),
 * y una tarea sin cliente que desaparece porque no se sabía de quién era.
 *
 *   node --experimental-strip-types scripts/test-foco.mjs
 */
import {
  pausaDe, estaPausado, estaFijadoPara, partirPorPausa, fijadosDe,
  fechaHasta, cambioPausa, cambioReactivar, cambioFijar, hoyISO,
} from '../src/lib/foco-dia.ts';

let ok = 0, fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fallos++; console.log(`  ✗ ${nombre}${detalle ? ` — ${detalle}` : ''}`); }
}
const titulo = (t) => console.log(`\n${t}`);

const HOY = '2026-10-16';
const cliente = (id, extra = {}) => ({
  id, nombre: id, nif: null, tipo_cliente: 'empresa', persona_contacto: null,
  telefono: null, email: null, direccion_fiscal: null, responsable: 'David',
  prioridad: 'C', estado_comercial: 'detectado', potencial_comercial: null,
  origen_cliente: null, observaciones: null, fecha_ultimo_contacto: null,
  fecha_proxima_accion: null, proxima_accion: null, ...extra,
});
const linea = (clave, clienteId) => ({ clave, clienteId });

titulo('Quién está apartado');
{
  comprueba('sin el SQL ejecutado nadie está apartado',
    !estaPausado(cliente('a'), HOY));
  comprueba('seguimiento_activo = true es estar activo',
    !estaPausado(cliente('b', { seguimiento_activo: true }), HOY));
  comprueba('apartado sin fecha sigue apartado',
    estaPausado(cliente('c', { seguimiento_activo: false }), HOY));
  comprueba('apartado hasta una fecha futura sigue apartado',
    estaPausado(cliente('d', { seguimiento_activo: false, pausado_hasta: '2026-12-01' }), HOY));

  // El fallo que esto evita: guardar una fecha y no hacerle caso. Un cliente
  // apartado hasta el 1 de marzo tiene que volver el 2, o la fecha no sirve
  // de nada y la cartera se queda en un limbo que nadie revisa.
  const vencida = pausaDe(cliente('e', { seguimiento_activo: false, pausado_hasta: '2026-09-01' }), HOY);
  comprueba('la fecha manda sobre la marca: pasada la fecha, vuelve', !vencida.pausado);
  comprueba('y se puede decir en pantalla que ha vuelto solo', vencida.vuelveSolo);

  comprueba('el día de la fecha todavía está apartado',
    estaPausado(cliente('f', { seguimiento_activo: false, pausado_hasta: HOY }), HOY));
  comprueba('el motivo viaja con la pausa',
    pausaDe(cliente('g', { seguimiento_activo: false, motivo_pausa: 'acaba de renovar' }), HOY).motivo === 'acaba de renovar');
}

titulo('Partir la agenda');
{
  const clientes = [
    cliente('c1'),
    cliente('c2', { seguimiento_activo: false }),
    cliente('c3', { seguimiento_activo: false, pausado_hasta: '2026-01-01' }),
  ];
  const items = [linea('l1', 'c1'), linea('l2', 'c2'), linea('l3', 'c3'), linea('suelta', null)];
  const r = partirPorPausa(items, clientes, HOY);

  comprueba('lo del cliente apartado sale de la lista de trabajo',
    r.activo.map((i) => i.clave).join() === 'l1,l3,suelta', r.activo.map((i) => i.clave).join());
  comprueba('no se borra: queda contado aparte',
    r.pausado.length === 1 && r.pausado[0].clave === 'l2');
  // Esconder una línea por no saber de quién es sería perderla en silencio,
  // que es exactamente el fallo que esta pantalla viene a evitar.
  comprueba('una línea sin cliente nunca se aparta',
    r.activo.some((i) => i.clave === 'suelta'));
  comprueba('el que volvió solo trae su trabajo de vuelta',
    r.activo.some((i) => i.clave === 'l3'));
}

titulo('Fijados para el día');
{
  const clientes = [
    cliente('mio', { fijado_para: 'David', prioridad: 'C' }),
    cliente('mio-a', { fijado_para: 'David', prioridad: 'A' }),
    cliente('compartido', { fijado_para: 'Marcos / David' }),
    cliente('de-otro', { fijado_para: 'Nicola' }),
    cliente('ninguno'),
    cliente('fijado-y-apartado', { fijado_para: 'David', seguimiento_activo: false }),
  ];
  const r = fijadosDe(clientes, 'David', HOY);

  comprueba('solo salen los fijados para quien mira',
    !r.some((c) => c.id === 'de-otro') && !r.some((c) => c.id === 'ninguno'));
  comprueba('un cliente compartido «Marcos / David» cuenta para los dos',
    r.some((c) => c.id === 'compartido') && estaFijadoPara(clientes[2], 'Marcos'));
  // Apartar es la decisión más reciente: dejarlo arriba sería desobedecerla.
  comprueba('apartado gana a fijado',
    !r.some((c) => c.id === 'fijado-y-apartado'));
  comprueba('el cliente A sale primero', r[0].id === 'mio-a');
  comprueba('sin persona no hay fijados', fijadosDe(clientes, null, HOY).length === 0);
}

titulo('Lo que se guarda');
{
  const desde = new Date(2026, 9, 16); // 16-oct-2026 local
  comprueba('un mes son 30 días por delante', fechaHasta(30, desde) === '2026-11-15', fechaHasta(30, desde));
  comprueba('sin fecha es null, no una fecha inventada', fechaHasta(null, desde) === null);

  const p = cambioPausa('  pidió no llamar  ', 90, desde);
  comprueba('apartar guarda marca, fecha y motivo',
    p.seguimiento_activo === false && p.pausado_hasta === '2027-01-14' && p.motivo_pausa === 'pidió no llamar',
    JSON.stringify(p));

  const v = cambioReactivar();
  comprueba('reactivar no deja media pausa colgando',
    v.seguimiento_activo === true && v.pausado_hasta === null && v.motivo_pausa === null);

  comprueba('soltar un fijado manda null explícito', cambioFijar('').fijado_para === null);
  comprueba('fijar guarda la persona', cambioFijar('David').fijado_para === 'David');
  comprueba('hoyISO da la fecha local en ISO corto', /^\d{4}-\d{2}-\d{2}$/.test(hoyISO()));
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} correctas, ${fallos} fallos`);
process.exit(fallos === 0 ? 0 : 1);
