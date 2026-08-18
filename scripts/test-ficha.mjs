/**
 * Tests del ESTADO DE UN SUMINISTRO en la ficha de cliente.
 *
 *   npm run test:ficha
 *
 * Lo que se protege aquí es lo que el documento de rediseño llama la regla
 * estructural: la fase, la alerta y la próxima acción son TRES cosas
 * distintas. Cuando se mezclan pasa lo de siempre — o un problema cambia el
 * estado del expediente (y entonces el embudo miente) o no se ve por ningún
 * lado (y entonces el cliente se cae).
 *
 * Y la otra regla: ROJO SOLO PARA BLOQUEO, VENCIMIENTO O RIESGO REAL. Si todo
 * lo pendiente sale en rojo, el rojo deja de querer decir nada y la pantalla
 * vuelve a ser una lista.
 */
import {
  estadoDeSuministro, siguienteAccion, resumenOperativo, modoDePresentacion,
  ordenarSuministros, diasHasta, comoSeLee, PRIORIDAD,
  DIAS_PREAVISO_URGENTE, DIAS_SIN_ACTIVAR,
} from '../src/lib/ficha-suministro.ts';

let ok = 0, fallos = 0;
const comprueba = (n, c, d = '') => {
  if (c) { ok++; console.log(`  ✓ ${n}`); }
  else { fallos++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`); }
};
const titulo = (t) => console.log(`\n${t}`);

const HOY = '2026-08-18';
const desplazar = (d) => {
  const x = new Date(`${HOY}T00:00:00`);
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};

/** Un suministro sano, al que cada test le rompe solo lo suyo. */
const sum = (o = {}) => ({
  id: o.id || 's1',
  cups: o.cups ?? 'ES0031406512345678AB',
  alias: o.alias ?? 'Nave de Binéfar',
  direccion: o.direccion ?? 'Pol. La Melusa, 12',
  tarifa: o.tarifa === undefined ? '3.0' : o.tarifa,
  comercializadora: 'IBERDROLA',
  estadoCups: o.estadoCups || 'activado',
  consumoAnual: o.consumoAnual === undefined ? 120000 : o.consumoAnual,
  potencias: [40, 40, 40, 40, 40, 40],
  fechaFinContrato: o.fechaFinContrato === undefined ? desplazar(200) : o.fechaFinContrato,
  fechaLimitePreaviso: o.preaviso ?? null,
  tareas: o.tareas ?? [],
  contratos: o.contratos ?? [],
});

titulo('Las fechas se leen como las lee una persona');
{
  comprueba('hoy', comoSeLee(HOY, HOY) === 'Hoy');
  comprueba('mañana', comoSeLee(desplazar(1), HOY) === 'Mañana');
  comprueba('ayer', comoSeLee(desplazar(-1), HOY) === 'Vencida ayer');
  comprueba('vencida hace días', comoSeLee(desplazar(-5), HOY) === 'Vencida hace 5 días');
  comprueba('esta semana', comoSeLee(desplazar(4), HOY) === 'En 4 días');
  comprueba('más lejos, la fecha', /ago|sept/.test(comoSeLee(desplazar(20), HOY)), comoSeLee(desplazar(20), HOY));
  comprueba('sin fecha lo dice', comoSeLee(null, HOY) === 'Sin fecha');
  comprueba('los días se cuentan con signo',
    diasHasta(desplazar(-3), HOY) === -3 && diasHasta(desplazar(3), HOY) === 3);
}

titulo('LA ALERTA NO CAMBIA LA FASE');
{
  // El ejemplo literal del documento: «un suministro puede estar en Contrato
  // enviado y tener alerta Sin firma desde hace 5 días».
  const e = estadoDeSuministro(sum({
    estadoCups: 'pendiente_firma',
    contratos: [{ estado_contrato: 'enviado_cliente' }],
  }), HOY);

  comprueba('la fase sigue siendo la del expediente', e.etapa === 'pendiente_firma', e.etapa);
  comprueba('y tiene nombre en pantalla', e.fase.length > 3, e.fase);
  comprueba('la alerta va aparte', e.alerta?.tipo === 'sin_firma', JSON.stringify(e.alerta));
  comprueba('sin cambiar la etapa', e.etapa === 'pendiente_firma');

  // La fase sale de etapas.ts, no de un catálogo propio: si aquí hubiera otro,
  // la ficha diría una cosa y el Pipeline otra sobre el mismo suministro.
  comprueba('un CUPS activado es la etapa activo',
    estadoDeSuministro(sum({ estadoCups: 'activado' }), HOY).etapa === 'activo');
  comprueba('y uno sin factura, detectado o factura solicitada',
    ['detectado', 'factura_solicitada'].includes(
      estadoDeSuministro(sum({ estadoCups: 'sin_factura' }), HOY).etapa));
}

titulo('El bloqueo dice QUÉ falta, nunca «pendiente»');
{
  const sinConsumo = estadoDeSuministro(sum({ estadoCups: 'pendiente_ofertar', consumoAnual: 0 }), HOY);
  comprueba('sin consumo, se nombra el consumo',
    /consumo anual/.test(sinConsumo.bloqueo || ''), sinConsumo.bloqueo);
  comprueba('y se explica para qué hace falta',
    /ahorro/.test(sinConsumo.bloqueo || ''), sinConsumo.bloqueo);

  const sinTarifa = estadoDeSuministro(sum({ estadoCups: 'factura_recibida', tarifa: null }), HOY);
  comprueba('sin tarifa, se nombra la tarifa', /tarifa/.test(sinTarifa.bloqueo || ''), sinTarifa.bloqueo);

  const sinFin = estadoDeSuministro(sum({ estadoCups: 'pendiente_ofertar', fechaFinContrato: null }), HOY);
  comprueba('sin fin de contrato, se nombra el preaviso',
    /preaviso/.test(sinFin.bloqueo || ''), sinFin.bloqueo);

  comprueba('ningún bloqueo dice solo «pendiente»',
    [sinConsumo, sinTarifa, sinFin].every((x) => (x.bloqueo || '').length > 25));

  comprueba('un suministro completo no tiene bloqueo',
    estadoDeSuministro(sum({ estadoCups: 'pendiente_ofertar' }), HOY).bloqueo === null);

  // A un suministro ya activo no se le reclama lo que ya no hace falta.
  comprueba('lo ya cerrado no genera bloqueos',
    estadoDeSuministro(sum({ estadoCups: 'activado', consumoAnual: 0, tarifa: null }), HOY).bloqueo === null);
}

titulo('ROJO SOLO PARA BLOQUEO, VENCIMIENTO O RIESGO REAL');
{
  const vencida = estadoDeSuministro(sum({
    estadoCups: 'pendiente_ofertar',
    tareas: [{ descripcion: 'Llamar al cliente', fecha_limite: desplazar(-3) }],
  }), HOY);
  comprueba('una tarea vencida es crítica', vencida.prioridad === 'critica');
  comprueba('y el texto lo dice sin depender del color',
    vencida.etiquetaPrioridad === PRIORIDAD.critica.texto);

  const hoyMismo = estadoDeSuministro(sum({
    estadoCups: 'pendiente_ofertar',
    tareas: [{ descripcion: 'Llamar', fecha_limite: HOY }],
  }), HOY);
  comprueba('lo de hoy es «acción hoy», no crítico', hoyMismo.prioridad === 'hoy');

  const enPlazo = estadoDeSuministro(sum({
    estadoCups: 'pendiente_ofertar',
    tareas: [{ descripcion: 'Llamar', fecha_limite: desplazar(10) }],
  }), HOY);
  comprueba('una tarea futura NO se pinta de rojo', enPlazo.prioridad === 'normal');

  const soloFaltaDato = estadoDeSuministro(sum({ estadoCups: 'pendiente_ofertar', consumoAnual: 0 }), HOY);
  comprueba('un dato que falta es «falta completar», no crítico',
    soloFaltaDato.prioridad === 'incompleta', soloFaltaDato.prioridad);

  const bien = estadoDeSuministro(sum({ estadoCups: 'activado' }), HOY);
  comprueba('un suministro activo y sin nada pendiente está correcto',
    bien.prioridad === 'correcta', bien.prioridad);

  comprueba('los cinco niveles tienen texto obligatorio',
    Object.values(PRIORIDAD).every((p) => p.texto.length > 5));
}

titulo('El preaviso es lo único que bloquea un año');
{
  const cerca = estadoDeSuministro(sum({ preaviso: desplazar(10) }), HOY);
  comprueba('un preaviso a 10 días es crítico', cerca.alerta?.critica === true);
  comprueba('y dice cuántos días quedan', /10 días/.test(cerca.alerta.texto), cerca.alerta?.texto);

  const lejos = estadoDeSuministro(sum({ preaviso: desplazar(DIAS_PREAVISO_URGENTE + 20) }), HOY);
  comprueba('a dos meses todavía no grita', lejos.alerta?.tipo !== 'preaviso_cerrandose');

  const perdido = estadoDeSuministro(sum({ preaviso: desplazar(-5) }), HOY);
  comprueba('un preaviso ya pasado se dice claramente',
    perdido.alerta?.tipo === 'preaviso_perdido');
  comprueba('y explica la consecuencia: se renueva solo',
    /renueva solo/.test(perdido.alerta.texto), perdido.alerta?.texto);

  comprueba('a un suministro perdido no se le persigue el preaviso',
    estadoDeSuministro(sum({ estadoCups: 'perdido', preaviso: desplazar(5) }), HOY).alerta?.tipo !== 'preaviso_cerrandose');

  // Este es EL caso: un cliente que ya es nuestro y se le acaba el contrato.
  // Silenciarlo por estar «activo» es perderlo por no mirar una fecha.
  comprueba('un suministro ACTIVO con el preaviso encima sí grita',
    estadoDeSuministro(sum({ estadoCups: 'activado', preaviso: desplazar(12) }), HOY).alerta?.tipo === 'preaviso_cerrandose');
  comprueba('y por eso deja de estar «correcto»',
    estadoDeSuministro(sum({ estadoCups: 'activado', preaviso: desplazar(12) }), HOY).prioridad === 'critica');
}

titulo('Firmado y sin activar: dinero ya vendido cayéndose');
{
  const e = estadoDeSuministro(sum({
    estadoCups: 'pendiente_activacion',
    contratos: [{ estado_contrato: 'firmado', fecha_firma: desplazar(-(DIAS_SIN_ACTIVAR + 10)) }],
  }), HOY);
  comprueba('se detecta', e.alerta?.tipo === 'sin_activar', JSON.stringify(e.alerta));
  comprueba('y es crítico', e.alerta.critica);
  comprueba('diciendo cuántos días lleva', /30 días/.test(e.alerta.texto), e.alerta?.texto);

  const reciente = estadoDeSuministro(sum({
    estadoCups: 'pendiente_activacion',
    contratos: [{ estado_contrato: 'firmado', fecha_firma: desplazar(-3) }],
  }), HOY);
  comprueba('firmado hace tres días todavía no', reciente.alerta?.tipo !== 'sin_activar');

  const activado = estadoDeSuministro(sum({
    estadoCups: 'activado',
    contratos: [{ estado_contrato: 'activado', fecha_firma: desplazar(-100), fecha_activacion_real: desplazar(-60) }],
  }), HOY);
  comprueba('si ya está activado, no se reclama nada', activado.alerta === null);
}

titulo('La banda «Siguiente acción» dice UNA cosa y cuántas quedan');
{
  const c = {
    suministros: [
      sum({ id: 'a', alias: 'Nave', estadoCups: 'pendiente_ofertar', tareas: [{ descripcion: 'Preparar oferta', fecha_limite: desplazar(-2) }] }),
      sum({ id: 'b', alias: 'Oficina', estadoCups: 'pendiente_ofertar', tareas: [{ descripcion: 'Llamar', fecha_limite: desplazar(5) }] }),
    ],
    tareasGenerales: [{ descripcion: 'Actualizar el NIF', fecha_limite: desplazar(30) }],
  };
  const a = siguienteAccion(c, HOY);

  comprueba('sale lo vencido primero', a.texto === 'Preparar oferta', a?.texto);
  comprueba('con su contexto de suministro', a.contexto === 'Nave', a?.contexto);
  comprueba('y su id, para poder abrirlo', a.suministroId === 'a');
  comprueba('marcada como crítica', a.critica);
  comprueba('diciendo cuándo venció', /Vencida/.test(a.cuando), a?.cuando);
  comprueba('y cuántas cosas más esperan', a.otras === 2, String(a?.otras));

  // Una tarea del cliente sin suministro tiene que distinguirse.
  const soloGeneral = siguienteAccion({ suministros: [], tareasGenerales: [{ descripcion: 'Llamar al gestor', fecha_limite: HOY }] }, HOY);
  comprueba('una tarea del cliente se marca como general',
    soloGeneral.contexto === 'Cliente general' && soloGeneral.suministroId === null);

  // Un bloqueo crítico sale aunque NADIE haya programado una tarea: es justo
  // el caso en que se cae un cliente porque nadie se dio cuenta.
  const sinTarea = siguienteAccion({ suministros: [sum({ id: 'x', preaviso: desplazar(5) })] }, HOY);
  comprueba('un preaviso a punto sale aunque no haya tarea',
    /preavisar/.test(sinTarea.texto), sinTarea?.texto);

  comprueba('sin nada pendiente devuelve null',
    siguienteAccion({ suministros: [sum({ estadoCups: 'activado' })] }, HOY) === null);
  comprueba('un cliente sin nada tampoco revienta',
    siguienteAccion({ suministros: [] }, HOY) === null);
}

titulo('El resumen operativo son CUATRO cosas accionables');
{
  const r = resumenOperativo({
    suministros: [
      sum({ id: 'a', estadoCups: 'pendiente_ofertar', preaviso: desplazar(5) }),
      sum({ id: 'b', estadoCups: 'pendiente_ofertar', consumoAnual: 0 }),
      sum({ id: 'c', estadoCups: 'activado' }),
    ],
  }, HOY);

  comprueba('cuenta los suministros', r.suministros === 3);
  comprueba('cuántos tienen alerta crítica', r.conAlerta === 1, String(r.conAlerta));
  comprueba('cuántos están en gestión', r.enGestion === 2, String(r.enGestion));
  comprueba('cuántos tienen un dato que bloquea', r.bloqueados === 1, String(r.bloqueados));
  comprueba('y el vencimiento más próximo', r.diasProximoVencimiento === 5, String(r.diasProximoVencimiento));

  const vacio = resumenOperativo({ suministros: [] }, HOY);
  comprueba('sin suministros sale todo a cero y sin vencimiento',
    vacio.suministros === 0 && vacio.proximoVencimiento === null);

  // El documento lo prohíbe expresamente: nada de consumo o importes
  // agregados que no cambian lo que se hace hoy.
  comprueba('NO hay consumo ni importe agregado en el resumen',
    !('consumo' in r) && !('importe' in r) && !('ahorro' in r));
}

titulo('Cómo se presentan según cuántos hay');
{
  comprueba('uno solo, tarjeta expandida', modoDePresentacion(1) === 'unica');
  comprueba('ninguno, también', modoDePresentacion(0) === 'unica');
  comprueba('de dos a cuatro, tarjetas', modoDePresentacion(2) === 'tarjetas' && modoDePresentacion(4) === 'tarjetas');
  comprueba('cinco o más, tabla', modoDePresentacion(5) === 'tabla' && modoDePresentacion(12) === 'tabla');
}

titulo('Primero lo que reclama atención');
{
  const orden = ordenarSuministros([
    sum({ id: 'tranquilo', estadoCups: 'activado' }),
    sum({ id: 'urgente', estadoCups: 'pendiente_ofertar', preaviso: desplazar(3) }),
    sum({ id: 'normal', estadoCups: 'pendiente_ofertar', tareas: [{ descripcion: 'x', fecha_limite: desplazar(10) }] }),
  ], HOY).map((s) => s.id);

  comprueba('lo crítico va primero', orden[0] === 'urgente', orden.join(','));
  comprueba('y lo que está bien, al final', orden[orden.length - 1] === 'tranquilo', orden.join(','));
  comprueba('no se pierde ninguno', orden.length === 3);
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} bien, ${fallos} mal\n`);
process.exit(fallos === 0 ? 0 : 1);
