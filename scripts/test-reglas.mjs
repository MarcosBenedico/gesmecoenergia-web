/**
 * Tests de la REGLA MADRE y de la higiene de la cartera.
 *
 *   npm run test:reglas
 *
 * Lo que se protege aquí es que el sistema no deje tranquilo a nadie sin
 * motivo. El caso que da nombre a todo esto:
 *
 *     La ficha pone «llamar mañana». La tarea real venció hace ocho días.
 *
 * Nadie miente — uno se actualizó y el otro no. Pero quien abre la ficha se
 * queda tranquilo y el cliente se cae. Eso ahora se detecta y se dice.
 */
import {
  proximaAccionReal, excepcionValida, incidenciasDe, controlDireccion,
  porResponsable, dias, estaAbierta,
  ESTADOS_SIN_ACCION_OK, DIAS_SIN_ACTIVIDAD, BLOQUES_CONTROL,
} from '../src/lib/reglas-cartera.ts';

let ok = 0, fallos = 0;
const comprueba = (n, c, d = '') => {
  if (c) { ok++; console.log(`  ✓ ${n}`); }
  else { fallos++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`); }
};
const titulo = (t) => console.log(`\n${t}`);

const HOY = '2026-08-18';
const dia = (n) => {
  const x = new Date(`${HOY}T00:00:00`);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};

const exp = (o = {}) => ({
  id: o.id || 'e1',
  nombre: o.nombre || 'GRANJA LA LITERA SL',
  tipo: o.tipo || 'oportunidad',
  estado: o.estado || 'oferta_enviada',
  responsable: o.responsable === undefined ? 'David' : o.responsable,
  accionManual: o.accionManual ?? null,
  fechaAccionManual: o.fechaAccionManual ?? null,
  tareas: o.tareas ?? [{ descripcion: 'Llamar', fecha_limite: dia(3), estado: 'pendiente', responsable: 'David' }],
  ultimaActividad: o.ultimaActividad === undefined ? dia(-1) : o.ultimaActividad,
  fechaReactivacion: o.fechaReactivacion ?? null,
  motivo: o.motivo ?? null,
});

const tipos = (is) => is.map((i) => i.tipo);

titulo('La próxima acción sale de la TAREA, no de un campo de texto');
{
  const a = proximaAccionReal([
    { descripcion: 'Llamar', fecha_limite: dia(5), estado: 'pendiente', responsable: 'David' },
    { descripcion: 'Pedir factura', fecha_limite: dia(1), estado: 'pendiente', responsable: 'Nicola' },
  ], HOY);

  comprueba('coge la más cercana', a.texto === 'Pedir factura', a?.texto);
  comprueba('con su fecha y sus días', a.dias === 1);
  comprueba('y con SU responsable, no el del expediente', a.responsable === 'Nicola');

  comprueba('las completadas no cuentan',
    proximaAccionReal([{ descripcion: 'Ya está', fecha_limite: dia(-9), estado: 'completada' }], HOY) === null);
  comprueba('las canceladas tampoco',
    proximaAccionReal([{ descripcion: 'X', estado: 'cancelada' }], HOY) === null);

  // Una tarea bloqueada SIGUE abierta: si no contara, el expediente saldría
  // como «sin acción» y nadie iría a desbloquearla.
  comprueba('una bloqueada sí cuenta como abierta',
    estaAbierta({ estado: 'bloqueada' }) && proximaAccionReal([{ descripcion: 'X', estado: 'bloqueada' }], HOY) !== null);
  comprueba('y se marca como bloqueada',
    proximaAccionReal([{ descripcion: 'X', estado: 'bloqueada', fecha_limite: dia(2) }], HOY).bloqueada);

  // A igualdad de fecha, primero la que se puede hacer.
  const empate = proximaAccionReal([
    { descripcion: 'Bloqueada', fecha_limite: dia(2), estado: 'bloqueada' },
    { descripcion: 'Se puede hacer', fecha_limite: dia(2), estado: 'pendiente' },
  ], HOY);
  comprueba('a igualdad de fecha manda la que se puede hacer',
    empate.texto === 'Se puede hacer', empate?.texto);

  comprueba('una tarea sin fecha va la última',
    proximaAccionReal([
      { descripcion: 'Sin fecha', estado: 'pendiente' },
      { descripcion: 'Con fecha', fecha_limite: dia(30), estado: 'pendiente' },
    ], HOY).texto === 'Con fecha');

  comprueba('sin tareas no hay acción', proximaAccionReal([], HOY) === null);
  comprueba('los días se cuentan con signo', dias(dia(-4), HOY) === -4);
}

titulo('LA CONTRADICCIÓN: la ficha tranquiliza y la tarea está vencida');
{
  const e = exp({
    accionManual: 'Llamar mañana',
    fechaAccionManual: dia(1),
    tareas: [{ descripcion: 'Presentar la oferta', fecha_limite: dia(-8), estado: 'pendiente', responsable: 'David' }],
  });
  const is = incidenciasDe(e, HOY);
  const c = is.find((i) => i.tipo === 'contradiccion');

  comprueba('se detecta', !!c, JSON.stringify(tipos(is)));
  comprueba('es crítica: es la que hace que nadie actúe', c.critica);
  comprueba('enseña lo que pone la ficha', /Llamar mañana/.test(c.texto), c?.texto);
  comprueba('y cuántos días lleva vencida la tarea', /8 días/.test(c.texto), c?.texto);
  comprueba('y dice cuál manda', /Manda la tarea/.test(c.arreglo), c?.arreglo);

  // Fechas que no coinciden pero sin nadie vencido: avisa, no es crítico.
  const leve = incidenciasDe(exp({
    accionManual: 'Llamar', fechaAccionManual: dia(2),
    tareas: [{ descripcion: 'Llamar', fecha_limite: dia(5), estado: 'pendiente' }],
  }), HOY).find((i) => i.tipo === 'contradiccion');
  comprueba('fechas distintas sin vencer: avisa pero no es crítico',
    leve && !leve.critica, JSON.stringify(leve));

  comprueba('si coinciden, no hay contradicción',
    !incidenciasDe(exp({
      accionManual: 'Llamar', fechaAccionManual: dia(3),
      tareas: [{ descripcion: 'Llamar', fecha_limite: dia(3), estado: 'pendiente' }],
    }), HOY).some((i) => i.tipo === 'contradiccion'));

  comprueba('sin nota en la ficha no hay nada que contradecir',
    !incidenciasDe(exp({ tareas: [{ descripcion: 'X', fecha_limite: dia(-3), estado: 'pendiente' }] }), HOY)
      .some((i) => i.tipo === 'contradiccion'));

  // La regla NO corrige el dato: el documento lo prohíbe expresamente.
  comprueba('la nota de la ficha NO se toca', e.accionManual === 'Llamar mañana');
}

titulo('Ningún expediente abierto sin siguiente acción');
{
  const sin = incidenciasDe(exp({ tareas: [] }), HOY);
  comprueba('se detecta', tipos(sin).includes('sin_accion'));
  comprueba('y es crítico', sin.find((i) => i.tipo === 'sin_accion').critica);
  comprueba('con la salida escrita',
    /responsable y fecha/.test(sin.find((i) => i.tipo === 'sin_accion').arreglo));

  // Las excepciones válidas del documento.
  comprueba('un ganado sin acción no es un problema',
    !tipos(incidenciasDe(exp({ estado: 'ganado', tareas: [] }), HOY)).includes('sin_accion'));
  comprueba('un activo tampoco',
    !tipos(incidenciasDe(exp({ estado: 'activo', tareas: [] }), HOY)).includes('sin_accion'));
  comprueba('un perdido tampoco',
    !tipos(incidenciasDe(exp({ estado: 'perdido', motivo: 'Se quedó con su comercializadora', tareas: [] }), HOY)).includes('sin_accion'));

  comprueba('los estados de excepción están declarados',
    ESTADOS_SIN_ACCION_OK.includes('ganado') && ESTADOS_SIN_ACCION_OK.includes('perdido'));
}

titulo('Una excepción a medias NO es una excepción');
{
  // «Pospuesto» sin fecha de reactivación es un olvido con nombre bonito.
  const sinFecha = exp({ estado: 'revisar_adelante', tareas: [], fechaReactivacion: null });
  comprueba('pospuesto sin fecha no es excepción válida', !excepcionValida(sinFecha));
  comprueba('y se avisa',
    tipos(incidenciasDe(sinFecha, HOY)).includes('pospuesto_sin_fecha'));
  comprueba('diciendo que no volverá solo',
    /no volverá solo/.test(incidenciasDe(sinFecha, HOY).find((i) => i.tipo === 'pospuesto_sin_fecha').texto));

  const conFecha = exp({ estado: 'revisar_adelante', tareas: [], fechaReactivacion: dia(90) });
  comprueba('con fecha de reactivación sí lo es', excepcionValida(conFecha));
  comprueba('y no se avisa', !tipos(incidenciasDe(conFecha, HOY)).includes('pospuesto_sin_fecha'));

  const perdidoMudo = exp({ estado: 'perdido', tareas: [], motivo: null });
  comprueba('perdido sin motivo no es excepción válida', !excepcionValida(perdidoMudo));
  comprueba('y se avisa, aunque no sea crítico',
    incidenciasDe(perdidoMudo, HOY).find((i) => i.tipo === 'perdido_sin_motivo')?.critica === false);
  comprueba('explicando qué se pierde: no se aprende de la pérdida',
    /no se aprende/.test(incidenciasDe(perdidoMudo, HOY).find((i) => i.tipo === 'perdido_sin_motivo').arreglo));

  comprueba('perdido con motivo sí es excepción',
    excepcionValida(exp({ estado: 'perdido', tareas: [], motivo: 'Precio' })));
}

titulo('Sin responsable no se puede reclamar nada');
{
  const is = incidenciasDe(exp({ responsable: null }), HOY);
  comprueba('se detecta', tipos(is).includes('sin_responsable'));
  comprueba('y es crítico', is.find((i) => i.tipo === 'sin_responsable').critica);
  comprueba('con el motivo escrito',
    /de todos.*de nadie/i.test(is.find((i) => i.tipo === 'sin_responsable').arreglo));

  comprueba('a un cerrado ya no se le exige responsable',
    !tipos(incidenciasDe(exp({ estado: 'ganado', responsable: null, tareas: [] }), HOY)).includes('sin_responsable'));
}

titulo('Parado: el umbral depende de la etapa');
{
  // Tres días en un contrato es mucho; catorce en captación es normal. Un
  // umbral único o se llena de ruido o se calla donde importa.
  const contrato = incidenciasDe(exp({ tipo: 'contrato', ultimaActividad: dia(-5) }), HOY);
  comprueba('un contrato parado 5 días ya se avisa',
    tipos(contrato).includes('sin_actividad'), JSON.stringify(tipos(contrato)));

  const cliente = incidenciasDe(exp({ tipo: 'cliente', ultimaActividad: dia(-5) }), HOY);
  comprueba('un cliente parado 5 días todavía no',
    !tipos(cliente).includes('sin_actividad'));

  const clienteViejo = incidenciasDe(exp({ tipo: 'cliente', ultimaActividad: dia(-40) }), HOY);
  comprueba('a los 40 días sí', tipos(clienteViejo).includes('sin_actividad'));
  comprueba('y dice cuántos días lleva',
    /40 días/.test(clienteViejo.find((i) => i.tipo === 'sin_actividad').texto));

  comprueba('los umbrales están declarados por tipo',
    DIAS_SIN_ACTIVIDAD.contrato < DIAS_SIN_ACTIVIDAD.cliente);

  comprueba('a un cerrado no se le mide la inactividad',
    !tipos(incidenciasDe(exp({ estado: 'ganado', tareas: [], ultimaActividad: dia(-400) }), HOY)).includes('sin_actividad'));
}

titulo('Una tarea bloqueada se ve, pero no es lo mismo que una vencida');
{
  const b = incidenciasDe(exp({
    tareas: [{ descripcion: 'Esperar el DNI', fecha_limite: dia(4), estado: 'bloqueada', responsable: 'Nicola' }],
  }), HOY);
  comprueba('se detecta', tipos(b).includes('bloqueada'));
  comprueba('pero NO como crítica: está esperando a alguien',
    b.find((i) => i.tipo === 'bloqueada').critica === false);
  comprueba('y no sale como «sin acción»', !tipos(b).includes('sin_accion'));
  comprueba('el responsable es el de la tarea',
    b.find((i) => i.tipo === 'bloqueada').responsable === 'Nicola');
}

titulo('El Control de Dirección es una vista de EXCEPCIONES');
{
  const cartera = [
    exp({ id: '1', nombre: 'A', tareas: [] }),
    exp({ id: '2', nombre: 'B', tareas: [{ descripcion: 'X', fecha_limite: dia(-3), estado: 'pendiente', responsable: 'David' }] }),
    exp({ id: '3', nombre: 'C', responsable: null }),
    exp({ id: '4', nombre: 'D' }),
  ];
  const bloques = controlDireccion(cartera, HOY);

  comprueba('solo salen bloques con algo dentro',
    bloques.every((b) => b.incidencias.length > 0), bloques.map((b) => `${b.tipo}:${b.incidencias.length}`).join(' '));
  comprueba('cada bloque contesta una pregunta',
    bloques.every((b) => b.pregunta.endsWith('?')));
  comprueba('cada bloque trae su lista, no solo un número',
    bloques.every((b) => b.incidencias.every((i) => i.nombre && i.texto)));
  comprueba('el expediente sano no aparece por ningún lado',
    !bloques.some((b) => b.incidencias.some((i) => i.nombre === 'D')));

  const primero = bloques[0];
  comprueba('lo vencido va antes que lo demás', primero.tipo === 'accion_vencida', primero?.tipo);

  comprueba('una cartera limpia deja el control vacío',
    controlDireccion([exp({ id: 'x' })], HOY).length === 0);

  comprueba('todos los bloques declarados tienen título y pregunta',
    BLOQUES_CONTROL.every((b) => b.titulo.length > 3 && b.pregunta.length > 10));
}

titulo('Repartir por responsable, para poder reclamar');
{
  const r = porResponsable([
    exp({ id: '1', responsable: 'David', tareas: [] }),
    exp({ id: '2', responsable: 'David', tareas: [{ descripcion: 'X', fecha_limite: dia(-2), estado: 'pendiente', responsable: 'David' }] }),
    exp({ id: '3', responsable: 'Nicola', tareas: [{ descripcion: 'Y', fecha_limite: dia(4), estado: 'bloqueada', responsable: 'Nicola' }] }),
  ], HOY);

  comprueba('quien más críticas tiene va primero', r[0].responsable === 'David', JSON.stringify(r));
  comprueba('cuenta críticas y total por separado',
    r[0].criticas > 0 && r[0].total >= r[0].criticas);
  comprueba('lo que no tiene dueño se agrupa con nombre',
    porResponsable([exp({ id: 'z', responsable: null })], HOY)[0].responsable === 'Sin asignar');
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} bien, ${fallos} mal\n`);
process.exit(fallos === 0 ? 0 : 1);
