/**
 * Tests del ESTADO DE UN EXPEDIENTE ENERGÉTICO.
 *
 *   npm run test:expediente
 *
 * Lo que se protege:
 *
 *   · La regla madre: un expediente abierto SIN siguiente acción es crítico,
 *     lleve el tiempo que lleve. Si no, se queda ahí y nadie se entera.
 *   · Que «esperando al cliente» NO se pinte igual que «vamos tarde». Si un
 *     expediente parado porque el cliente no decide sale en la misma lista
 *     roja que uno que nadie ha tocado, la lista roja deja de significar nada.
 *   · Que el pendiente principal diga QUÉ falta y nunca la palabra «pendiente».
 *   · Que los plazos salgan de energia.ts y no de aquí.
 */
import {
  estadoExpediente, pendienteDe, cabecera, ordenar, aplicarFiltro,
  ventanaAnual, diasEntre, NIVEL,
} from '../src/lib/expediente.ts';
import { FASE, FASES } from '../src/lib/energia.ts';

let ok = 0, fallos = 0;
const comprueba = (n, c, d = '') => {
  if (c) { ok++; console.log(`  ✓ ${n}`); }
  else { fallos++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`); }
};
const titulo = (t) => console.log(`\n${t}`);

const HOY = '2026-09-08';
const dia = (n) => {
  const x = new Date(`${HOY}T00:00:00`);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};

/** Doce meses completos hasta hoy, para tener cobertura buena. */
const anioCompleto = () => {
  const out = [];
  for (let i = 11; i >= 0; i--) {
    const a = new Date(`${HOY}T00:00:00`);
    a.setMonth(a.getMonth() - i - 1);
    const b = new Date(`${HOY}T00:00:00`);
    b.setMonth(b.getMonth() - i);
    out.push({
      periodo_inicio: a.toISOString().slice(0, 10),
      periodo_fin: b.toISOString().slice(0, 10),
    });
  }
  return out;
};

const exp = (o = {}) => ({
  id: 'e1', cliente: 'VALQUERCUS GANADERA', clienteId: 'c1',
  objetivo: 'Resolver la necesidad de potencia',
  fase: 'diagnostico',
  responsable: 'Marcos',
  actualizadoEn: dia(-3),
  medidas: [], suministros: 2, actuaciones: [], tareas: [],
  ...o,
});

const conTarea = (o = {}, t = {}) => exp({
  ...o,
  tareas: [{ descripcion: 'Pedir curva del contador', fecha_limite: dia(5), estado: 'pendiente', responsable: 'David', ...t }],
});

// ── La regla madre ─────────────────────────────────────────────────────────
titulo('Ningún expediente abierto puede quedarse sin siguiente acción');
{
  const sin = estadoExpediente(exp(), HOY);
  comprueba('sin acción es CRÍTICO aunque se tocara ayer', sin.nivel === 'critico');
  comprueba('...y se marca como tal', sin.sinAccion === true);

  const con = estadoExpediente(conTarea(), HOY);
  comprueba('con acción futura ya no es crítico', con.nivel !== 'critico', con.nivel);
  comprueba('...y no está sin acción', con.sinAccion === false);

  // Cerrado y aparcado NO compiten por atención.
  for (const fase of ['cerrado', 'aparcado']) {
    const c = estadoExpediente(exp({ fase }), HOY);
    comprueba(`un expediente ${fase} sin acción no es crítico`, c.nivel === 'cerrado');
    comprueba(`...y no se cuenta como sin acción`, c.sinAccion === false);
  }
}

titulo('Una acción vencida manda sobre todo lo demás');
{
  const v = estadoExpediente(conTarea({}, { fecha_limite: dia(-2) }), HOY);
  comprueba('vencida = crítico', v.nivel === 'critico');
  comprueba('...y se dice que está vencida', v.proximaAccion.vencida === true);
  comprueba('...con su responsable', v.proximaAccion.responsable === 'David');

  const hoy = estadoExpediente(conTarea({}, { fecha_limite: HOY }), HOY);
  comprueba('la de hoy todavía no está vencida', hoy.proximaAccion.vencida === false);
}

titulo('La tarea que sale es la MÁS CERCANA, no la primera que llegó');
{
  const e = exp({
    tareas: [
      { descripcion: 'Lo de dentro de un mes', fecha_limite: dia(30), estado: 'pendiente' },
      { descripcion: 'Lo de mañana', fecha_limite: dia(1), estado: 'pendiente' },
    ],
  });
  comprueba('sale la de mañana', estadoExpediente(e, HOY).proximaAccion.texto === 'Lo de mañana');
}

titulo('Las tareas cerradas no cuentan como siguiente acción');
{
  const e = exp({ tareas: [{ descripcion: 'Ya hecha', fecha_limite: dia(5), estado: 'completada' }] });
  comprueba('una tarea completada deja el expediente sin acción', estadoExpediente(e, HOY).sinAccion);
  const b = exp({ tareas: [{ descripcion: 'Atascada', fecha_limite: dia(5), estado: 'bloqueada' }] });
  comprueba('una bloqueada SÍ cuenta: sigue siendo el siguiente paso', !estadoExpediente(b, HOY).sinAccion);
}

// ── Esperando al cliente no es ir tarde ────────────────────────────────────
titulo('«Esperando al cliente» no se pinta igual que «vamos tarde»');
{
  // propuesta → pelota del cliente, 30 días de plazo.
  const dentro = estadoExpediente(conTarea({ fase: 'propuesta', actualizadoEn: dia(-10) }), HOY);
  comprueba('una propuesta de hace 10 días está esperando, no en rojo', dentro.nivel === 'esperando');
  comprueba('...y dice de quién es la pelota', dentro.pelota === 'del_cliente');

  const pasada = estadoExpediente(conTarea({ fase: 'propuesta', actualizadoEn: dia(-45) }), HOY);
  comprueba('pasados los 30 días sube a atención, NO a crítico', pasada.nivel === 'atencion');

  // en_estudio → pelota nuestra, 21 días.
  const nuestro = estadoExpediente(conTarea({ fase: 'en_estudio', actualizadoEn: dia(-45) }), HOY);
  comprueba('lo nuestro pasado de plazo SÍ es crítico', nuestro.nivel === 'critico');
  comprueba('en plazo y nuestro es «en plazo»',
    estadoExpediente(conTarea({ fase: 'en_estudio', actualizadoEn: dia(-5) }), HOY).nivel === 'en_plazo');
}

titulo('Los plazos salen de energia.ts, no de aquí');
{
  // Si alguien cambia el límite en energia.ts, esto lo sigue.
  const limite = FASE.en_estudio.limiteDias;
  const justo = estadoExpediente(conTarea({ fase: 'en_estudio', actualizadoEn: dia(-limite) }), HOY);
  comprueba(`a los ${limite} días justos todavía no salta`, justo.nivel !== 'critico');
  const pasa = estadoExpediente(conTarea({ fase: 'en_estudio', actualizadoEn: dia(-limite - 1) }), HOY);
  comprueba('un día después sí', pasa.nivel === 'critico');
  comprueba('el diagnóstico tiene MUCHO más plazo que el estudio',
    FASE.diagnostico.limiteDias > FASE.en_estudio.limiteDias);
}

// ── El pendiente principal ─────────────────────────────────────────────────
titulo('El pendiente principal dice QUÉ falta');
{
  const nunca = pendienteDe(exp(), HOY);
  comprueba('sin medidas lo dice claro', /ni una medida/.test(nunca), nunca);

  const sinCups = pendienteDe(exp({ suministros: 0 }), HOY);
  comprueba('sin suministro vinculado, ese es el bloqueo', /suministro/.test(sinCups), sinCups);

  const medio = pendienteDe(exp({ medidas: anioCompleto().slice(0, 5) }), HOY);
  comprueba('con medio año dice cuántos meses faltan', /Faltan unos \d+ meses/.test(medio), medio);
  comprueba('...y da los días concretos', /días/.test(medio));

  const lleno = pendienteDe(exp({ medidas: anioCompleto() }), HOY);
  comprueba('con el año completo, el bloqueo ya no son los datos', /cerrar el diagn/.test(lleno), lleno);

  // El bloqueo más silencioso de todo el módulo.
  const sinLB = pendienteDe(exp({ fase: 'verificacion' }), HOY);
  comprueba('verificar sin línea base aprobada se dice explícitamente',
    /línea base aprobada/.test(sinLB), sinLB);
  const conLB = pendienteDe(exp({ fase: 'verificacion', tieneLineaBaseAprobada: true }), HOY);
  comprueba('con línea base, el pendiente es comparar', /Comparar/.test(conLB), conLB);

  const sinAct = pendienteDe(exp({ fase: 'en_estudio' }), HOY);
  comprueba('en estudio y sin actuaciones, lo dice', /ninguna actuaci/.test(sinAct), sinAct);
}

titulo('La palabra «pendiente» NUNCA es la respuesta');
{
  for (const f of FASES) {
    const texto = pendienteDe(exp({ fase: f.id, medidas: anioCompleto() }), HOY);
    comprueba(`${f.id}: dice algo concreto`, texto.length > 12 && texto.toLowerCase() !== 'pendiente');
  }
}

// ── Cabecera ───────────────────────────────────────────────────────────────
titulo('Los tres contadores de la cabecera');
{
  const estados = [
    estadoExpediente(exp(), HOY),                                                   // sin acción → crítico
    estadoExpediente(conTarea({ fase: 'propuesta', actualizadoEn: dia(-5) }), HOY),  // esperando
    estadoExpediente(conTarea({ fase: 'en_estudio', actualizadoEn: dia(-60) }), HOY),// crítico
    estadoExpediente(conTarea({ fase: 'en_estudio', actualizadoEn: dia(-2) }), HOY), // en plazo
    estadoExpediente(exp({ fase: 'cerrado' }), HOY),                                 // cerrado
  ];
  const c = cabecera(estados);
  comprueba('cuenta los abiertos sin los cerrados', c.abiertos === 4, String(c.abiertos));
  comprueba('requieren atención: los dos críticos', c.requierenAtencion === 2, String(c.requierenAtencion));
  comprueba('sin próxima acción: uno', c.sinProximaAccion === 1, String(c.sinProximaAccion));
  comprueba('pendientes del cliente: uno', c.pendientesDelCliente === 1, String(c.pendientesDelCliente));
  // Un cerrado no puede colarse en ningún contador: si lo hiciera, la lista de
  // lo que requiere acción se llenaría de cosas aparcadas a propósito.
  comprueba('lo cerrado no entra en ningún contador',
    c.requierenAtencion + c.sinProximaAccion <= c.abiertos * 2);
}

titulo('El orden pone delante lo que se está cayendo');
{
  const filas = [
    { id: 'plazo', estado: estadoExpediente(conTarea({ fase: 'en_estudio', actualizadoEn: dia(-1) }), HOY) },
    { id: 'critico', estado: estadoExpediente(exp(), HOY) },
    { id: 'esperando', estado: estadoExpediente(conTarea({ fase: 'propuesta', actualizadoEn: dia(-3) }), HOY) },
  ];
  const o = ordenar(filas).map((f) => f.id);
  comprueba('el crítico va primero', o[0] === 'critico', o.join(','));
  comprueba('el que está en plazo, el último', o[2] === 'plazo', o.join(','));

  // A igual nivel, manda el tiempo parado.
  const empate = [
    { id: 'reciente', estado: estadoExpediente(conTarea({ fase: 'en_estudio', actualizadoEn: dia(-40) }), HOY) },
    { id: 'viejo', estado: estadoExpediente(conTarea({ fase: 'en_estudio', actualizadoEn: dia(-90) }), HOY) },
  ];
  comprueba('a igual nivel, primero el que lleva más parado',
    ordenar(empate)[0].id === 'viejo');
}

titulo('Los filtros cuadran con los contadores');
{
  const critico = estadoExpediente(exp(), HOY);
  const esperando = estadoExpediente(conTarea({ fase: 'propuesta', actualizadoEn: dia(-5) }), HOY);
  const cerrado = estadoExpediente(exp({ fase: 'cerrado' }), HOY);

  comprueba('sin filtro entra todo, incluido lo cerrado',
    aplicarFiltro(cerrado, 'Marcos', '', 'Marcos'));
  comprueba('con filtro, lo cerrado se queda fuera',
    !aplicarFiltro(cerrado, 'Marcos', 'atencion', 'Marcos'));
  comprueba('«atención» coge el crítico', aplicarFiltro(critico, 'Marcos', 'atencion', 'Marcos'));
  comprueba('«atención» no coge al que está esperando', !aplicarFiltro(esperando, 'Marcos', 'atencion', 'Marcos'));
  comprueba('«sin acción» coge el que no la tiene', aplicarFiltro(critico, 'Marcos', 'sin_accion', 'Marcos'));
  comprueba('«del cliente» coge la propuesta', aplicarFiltro(esperando, 'Marcos', 'del_cliente', 'Marcos'));
  comprueba('«míos» compara sin distinguir mayúsculas',
    aplicarFiltro(critico, 'marcos', 'mios', 'Marcos'));
  comprueba('«míos» deja fuera lo de otro', !aplicarFiltro(critico, 'David', 'mios', 'Marcos'));
  comprueba('«míos» sin nombre no coge nada', !aplicarFiltro(critico, 'Marcos', 'mios', ''));
}

titulo('Utilidades de fecha');
{
  const v = ventanaAnual(HOY);
  comprueba('la ventana anual acaba hoy', v.hasta === HOY);
  comprueba('...y empieza hace un año', v.desde === '2025-09-09', v.desde);
  comprueba('son 365 días', diasEntre(v.desde, v.hasta) === 364);
  comprueba('sin fecha devuelve null', diasEntre(null, HOY) === null);
  comprueba('una fecha inválida no revienta', diasEntre('esto-no-es-fecha', HOY) === null);
}

titulo('Todos los niveles llevan texto, no solo color');
{
  comprueba('cada nivel tiene su frase',
    Object.values(NIVEL).every((n) => n.texto.length > 5));
  comprueba('el orden no se repite',
    new Set(Object.values(NIVEL).map((n) => n.orden)).size === Object.keys(NIVEL).length);
}


titulo('Sin siguiente acción NO es «esperando al cliente»');
{
  // Un expediente en diagnóstico tiene la pelota del cliente por fase (se
  // esperan sus facturas), pero si no hay ninguna tarea abierta es que NADIE
  // se las ha pedido. Contarlo como «esperando» es la excusa perfecta para que
  // se quede quieto tres meses.
  const sinPedir = estadoExpediente(exp({ fase: 'diagnostico' }), HOY);
  comprueba('la fase dice que la pelota es del cliente', sinPedir.pelota === 'del_cliente');
  comprueba('...pero sin tarea abierta NO cuenta como pendiente del cliente',
    cabecera([sinPedir]).pendientesDelCliente === 0);
  comprueba('...y sí cuenta como sin próxima acción',
    cabecera([sinPedir]).sinProximaAccion === 1);
  comprueba('el filtro «del cliente» hace lo mismo',
    !aplicarFiltro(sinPedir, 'Marcos', 'del_cliente', 'Marcos'));

  const pedido = estadoExpediente(conTarea({ fase: 'diagnostico' }), HOY);
  comprueba('en cuanto se le pide algo, sí está esperando',
    cabecera([pedido]).pendientesDelCliente === 1);
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} correctos, ${fallos} fallos\n`);
process.exit(fallos === 0 ? 0 : 1);
