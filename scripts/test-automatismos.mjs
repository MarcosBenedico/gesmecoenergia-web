/**
 * Tests de las AUTOMATIZACIONES DE FASE.
 *
 *   npm run test:automatismos
 *
 * Lo que se protege aquí no es que las reglas encuentren cosas — eso es lo
 * fácil —, sino que NO hagan de más:
 *
 *   · Ejecutarlas dos veces no puede crear dos tareas iguales.
 *   · Un preaviso no puede abrir seis tareas (120/90/60/45/30 días). Una viva
 *     por suministro y se le mueve la fecha.
 *   · Ninguna regla toca una etapa, un precio ni un contrato. Solo proponen
 *     tareas, y ni siquiera las escriben.
 */
import {
  proponerTareas, agruparPorRegla, PLAZOS, CUPS_SIN_RENOVACION,
} from '../src/lib/automatismos.ts';

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

const base = (o = {}) => ({
  clientes: [{ id: 'c1', nombre: 'GRANJA LA LITERA SL', responsable: 'David' }],
  cups: [], pipeline: [], contratos: [], comisiones: [], tareas: [],
  ...o,
});

/** Convierte una propuesta en la tarea que se guardaría, como haría la pantalla. */
const aplicar = (p, n) => ({ id: `t${n}`, estado: 'pendiente', ...p.tarea });

// ── 1. Que encuentre lo que tiene que encontrar ─────────────────────────────
titulo('Las reglas detectan cada atasco de fase');
{
  const e = base({
    pipeline: [
      { id: 'p1', cliente_id: 'c1', estado: 'factura_solicitada' },
      { id: 'p2', cliente_id: 'c1', estado: 'factura_recibida' },
      { id: 'p3', cliente_id: 'c1', estado: 'oferta_enviada' },
    ],
    contratos: [
      { id: 'k1', cliente_id: 'c1', estado_contrato: 'enviado_cliente' },
      { id: 'k2', cliente_id: 'c1', estado_contrato: 'firmado' },
      { id: 'k3', cliente_id: 'c1', estado_contrato: 'enviado_comercializadora' },
      { id: 'k4', cliente_id: 'c1', estado_contrato: 'activado', fecha_activacion_real: dia(-10) },
    ],
    cups: [{ id: 's1', cliente_id: 'c1', cups: 'ES001', estado_cups: 'activado', fecha_limite_preaviso: dia(30) }],
    comisiones: [{ id: 'm1', cliente_id: 'c1', estado_comision: 'pendiente_cobro', fecha_prevista_cobro: dia(-20) }],
  });
  const ps = proponerTareas(e, HOY);
  const tipos = ps.map((p) => p.tarea.tipo_tarea);
  for (const t of ['pedir_factura', 'preparar_oferta', 'seguimiento', 'reclamar_firma',
    'enviar_comercializadora', 'confirmar_activacion', 'revisar_futuro',
    'revisar_preaviso', 'reclamar_comision']) {
    comprueba(`propone ${t}`, tipos.includes(t), `tipos: ${tipos.join(', ')}`);
  }
  comprueba('todas llevan el porqué escrito', ps.every((p) => p.porque.length > 20));
  comprueba('todas llevan fecha límite', ps.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.tarea.fecha_limite)));
  comprueba('todas heredan responsable del cliente', ps.every((p) => p.tarea.responsable === 'David'));
}

// ── 2. IDEMPOTENCIA: la condición que manda sobre todo ──────────────────────
titulo('Ejecutar dos veces no crea dos tareas iguales');
{
  const e = base({
    pipeline: [{ id: 'p1', cliente_id: 'c1', estado: 'oferta_enviada' }],
    contratos: [{ id: 'k1', cliente_id: 'c1', estado_contrato: 'firmado' }],
    cups: [{ id: 's1', cliente_id: 'c1', cups: 'ES001', estado_cups: 'activado', fecha_limite_preaviso: dia(30) }],
    comisiones: [{ id: 'm1', cliente_id: 'c1', estado_comision: 'pendiente_cobro', fecha_prevista_cobro: dia(-20) }],
  });
  const primera = proponerTareas(e, HOY);
  comprueba('la primera pasada propone trabajo', primera.length === 4, `${primera.length}`);

  // Se aplican, tal cual haría una persona desde la pantalla.
  const e2 = { ...e, tareas: primera.map(aplicar) };
  const segunda = proponerTareas(e2, HOY);
  comprueba('la segunda pasada no propone NADA', segunda.length === 0,
    segunda.map((p) => p.clave).join(', '));

  // Y una tercera, y una cuarta.
  const tercera = proponerTareas({ ...e, tareas: primera.map(aplicar) }, HOY);
  comprueba('sigue sin proponer nada a la tercera', tercera.length === 0);
}

titulo('Una tarea COMPLETADA no bloquea, una BLOQUEADA sí');
{
  const e = base({ pipeline: [{ id: 'p1', cliente_id: 'c1', estado: 'oferta_enviada' }] });
  const cerrada = proponerTareas({ ...e, tareas: [{ id: 't1', pipeline_id: 'p1', tipo_tarea: 'seguimiento', estado: 'completada' }] }, HOY);
  comprueba('con la tarea completada vuelve a proponer', cerrada.length === 1);
  const bloqueada = proponerTareas({ ...e, tareas: [{ id: 't1', pipeline_id: 'p1', tipo_tarea: 'seguimiento', estado: 'bloqueada' }] }, HOY);
  comprueba('con la tarea bloqueada NO propone otra', bloqueada.length === 0);
}

titulo('No se crea una tarea por cada día de retraso');
{
  const e = base({
    pipeline: [{ id: 'p1', cliente_id: 'c1', estado: 'oferta_enviada' }],
    tareas: [{ id: 't1', pipeline_id: 'p1', tipo_tarea: 'seguimiento', estado: 'pendiente', fecha_limite: dia(-40) }],
  });
  comprueba('una tarea vencida hace 40 días no genera otra', proponerTareas(e, HOY).length === 0);
}

titulo('Las tareas de OTRO expediente no confunden a la regla');
{
  const e = base({
    pipeline: [
      { id: 'p1', cliente_id: 'c1', estado: 'oferta_enviada' },
      { id: 'p2', cliente_id: 'c1', estado: 'oferta_enviada' },
    ],
    tareas: [{ id: 't1', pipeline_id: 'p1', tipo_tarea: 'seguimiento', estado: 'pendiente' }],
  });
  const ps = proponerTareas(e, HOY);
  comprueba('solo propone para la oportunidad que no la tiene', ps.length === 1 && ps[0].tarea.pipeline_id === 'p2');
}

// ── 3. UNA SOLA TAREA VIVA DE RENOVACIÓN POR CUPS ──────────────────────────
titulo('El preaviso no abre seis tareas: abre una y se le mueve la fecha');
{
  const cups = { id: 's1', cliente_id: 'c1', cups: 'ES001', estado_cups: 'activado', fecha_limite_preaviso: dia(30) };
  const e = base({ cups: [cups] });
  const ps = proponerTareas(e, HOY);
  comprueba('sin tarea previa: crear', ps.length === 1 && ps[0].accion === 'crear');
  comprueba('la fecha va 5 días antes del límite', ps[0].tarea.fecha_limite === dia(25), ps[0].tarea.fecha_limite);

  // Ahora existe, con la fecha buena → silencio.
  const conBuena = proponerTareas({ ...e, tareas: [{ id: 't1', cups_id: 's1', tipo_tarea: 'revisar_preaviso', estado: 'pendiente', fecha_limite: dia(25) }] }, HOY);
  comprueba('con la tarea ya correcta no propone nada', conBuena.length === 0);

  // Existe pero con otra fecha (alguien corrigió el fin de contrato) → actualizar.
  const conVieja = proponerTareas({ ...e, tareas: [{ id: 't1', cups_id: 's1', tipo_tarea: 'revisar_preaviso', estado: 'pendiente', fecha_limite: dia(-3) }] }, HOY);
  comprueba('con la fecha desfasada propone ACTUALIZAR, no crear',
    conVieja.length === 1 && conVieja[0].accion === 'actualizar');
  comprueba('la actualización dice qué tarea mueve', conVieja[0].tareaId === 't1');
  comprueba('nunca hay dos claves de preaviso para el mismo CUPS',
    new Set(conVieja.map((p) => p.clave)).size === conVieja.length);
}

titulo('El preaviso solo suena dentro de la ventana');
{
  const mk = (d, estado = 'activado') => base({
    cups: [{ id: 's1', cliente_id: 'c1', cups: 'ES001', estado_cups: estado, fecha_limite_preaviso: dia(d) }],
  });
  comprueba('a 200 días todavía no', proponerTareas(mk(200), HOY).length === 0);
  comprueba(`a ${PLAZOS.avisoPreaviso} días sí`, proponerTareas(mk(PLAZOS.avisoPreaviso), HOY).length === 1);
  comprueba('hoy mismo sí', proponerTareas(mk(0), HOY).length === 1);
  comprueba('ya pasado no se pinta como si se pudiera hacer algo', proponerTareas(mk(-1), HOY).length === 0);
  comprueba('un CUPS ACTIVADO sí tiene renovación que preparar', proponerTareas(mk(30, 'activado'), HOY).length === 1);
  for (const est of CUPS_SIN_RENOVACION) {
    comprueba(`un CUPS ${est} no`, proponerTareas(mk(30, est), HOY).length === 0);
  }
}

// ── 4. Lo que las reglas NO pueden hacer ───────────────────────────────────
titulo('Ninguna regla toca nada que no sea una tarea');
{
  const e = base({
    pipeline: [{ id: 'p1', cliente_id: 'c1', estado: 'oferta_enviada' }],
    contratos: [{ id: 'k1', cliente_id: 'c1', estado_contrato: 'firmado' }],
    cups: [{ id: 's1', cliente_id: 'c1', cups: 'ES001', estado_cups: 'activado', fecha_limite_preaviso: dia(20) }],
    comisiones: [{ id: 'm1', cliente_id: 'c1', estado_comision: 'pendiente_cobro', fecha_prevista_cobro: dia(-9) }],
  });
  const copia = JSON.parse(JSON.stringify(e));
  const ps = proponerTareas(e, HOY);
  comprueba('la entrada sale intacta (no muta nada)', JSON.stringify(e) === JSON.stringify(copia));

  const prohibidos = ['estado', 'estado_contrato', 'estado_cups', 'estado_comision',
    'precio', 'precios', 'comercializadora', 'comercializadora_final', 'titular', 'oferta'];
  const cuelan = ps.filter((p) => prohibidos.some((k) => k in p.tarea));
  comprueba('ninguna propuesta lleva campos de etapa, precio o contrato', cuelan.length === 0,
    JSON.stringify(cuelan.map((p) => Object.keys(p.tarea))));
  comprueba('todas son propuestas de tarea y nada más',
    ps.every((p) => ['crear', 'actualizar'].includes(p.accion) && !!p.tarea.tipo_tarea));
}

titulo('Una etapa no avanza porque haya pasado el tiempo');
{
  // Una oportunidad lleva medio año en oferta_enviada: se propone seguirla,
  // jamás darla por ganada ni por perdida.
  const e = base({
    pipeline: [{ id: 'p1', cliente_id: 'c1', estado: 'oferta_enviada' }],
  });
  const ps = proponerTareas(e, HOY);
  comprueba('propone seguimiento y no un resultado', ps.length === 1 && ps[0].tarea.tipo_tarea === 'seguimiento');
}

titulo('Los estados cerrados no generan trabajo');
{
  for (const estado of ['ganado', 'perdido', 'revisar_adelante', 'prospecto']) {
    const e = base({ pipeline: [{ id: 'p1', cliente_id: 'c1', estado }] });
    comprueba(`pipeline ${estado} no propone nada`, proponerTareas(e, HOY).length === 0);
  }
  for (const estado of ['rechazado', 'cancelado', 'pendiente_preparar']) {
    const e = base({ contratos: [{ id: 'k1', cliente_id: 'c1', estado_contrato: estado }] });
    comprueba(`contrato ${estado} no propone nada`, proponerTareas(e, HOY).length === 0);
  }
  const cobrada = base({ comisiones: [{ id: 'm1', cliente_id: 'c1', estado_comision: 'cobrada', fecha_prevista_cobro: dia(-90) }] });
  comprueba('una comisión cobrada no se reclama', proponerTareas(cobrada, HOY).length === 0);
  const alDia = base({ comisiones: [{ id: 'm1', cliente_id: 'c1', estado_comision: 'pendiente_cobro', fecha_prevista_cobro: dia(10) }] });
  comprueba('una comisión que aún no vence no se reclama', proponerTareas(alDia, HOY).length === 0);
}

titulo('La primera factura no se revisa de un contrato viejo');
{
  const reciente = base({ contratos: [{ id: 'k1', cliente_id: 'c1', estado_contrato: 'activado', fecha_activacion_real: dia(-20) }] });
  comprueba('activado hace 20 días: sí', proponerTareas(reciente, HOY).length === 1);
  const viejo = base({ contratos: [{ id: 'k1', cliente_id: 'c1', estado_contrato: 'activado', fecha_activacion_real: dia(-700) }] });
  comprueba('activado hace dos años: no', proponerTareas(viejo, HOY).length === 0);
  const sinFecha = base({ contratos: [{ id: 'k1', cliente_id: 'c1', estado_contrato: 'activado' }] });
  comprueba('activado sin fecha real: no se inventa', proponerTareas(sinFecha, HOY).length === 0);
}

// ── 5. Plazos configurables ────────────────────────────────────────────────
titulo('Los plazos se pueden cambiar sin tocar el código');
{
  const e = base({ pipeline: [{ id: 'p1', cliente_id: 'c1', estado: 'factura_recibida' }] });
  const porDefecto = proponerTareas(e, HOY)[0];
  const otro = proponerTareas(e, HOY, { ...PLAZOS, prepararOferta: 10 })[0];
  comprueba('el plazo por defecto manda si no se pasa nada', porDefecto.tarea.fecha_limite === dia(PLAZOS.prepararOferta));
  comprueba('un plazo distinto cambia la fecha', otro.tarea.fecha_limite === dia(10));
}

// ── 6. Agrupación para la pantalla ─────────────────────────────────────────
titulo('Se agrupa por regla para poder revisarla de una en una');
{
  const e = base({
    pipeline: [
      { id: 'p1', cliente_id: 'c1', estado: 'oferta_enviada' },
      { id: 'p2', cliente_id: 'c1', estado: 'oferta_enviada' },
      { id: 'p3', cliente_id: 'c1', estado: 'factura_recibida' },
    ],
  });
  const g = agruparPorRegla(proponerTareas(e, HOY));
  comprueba('dos reglas distintas', g.length === 2);
  comprueba('la más numerosa va primero', g[0].propuestas.length === 2);
  comprueba('cada grupo tiene nombre de regla', g.every((x) => x.regla.length > 5));
}

titulo('El contexto dice de quién es cada propuesta');
{
  const e = base({
    clientes: [{ id: 'c1', nombre: 'GRANJA LA LITERA SL', responsable: 'David' }],
    contratos: [{ id: 'k1', cliente_id: 'c1', estado_contrato: 'firmado', comercializadora_final: 'Iberdrola' }],
  });
  const p = proponerTareas(e, HOY)[0];
  comprueba('el contexto lleva cliente y comercializadora',
    p.contexto.includes('GRANJA LA LITERA') && p.contexto.includes('Iberdrola'), p.contexto);
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} correctos, ${fallos} fallos\n`);
process.exit(fallos === 0 ? 0 : 1);
