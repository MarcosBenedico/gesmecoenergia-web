#!/usr/bin/env node
/**
 * Tests de la bandeja de entrada (src/lib/bandeja.ts).
 *
 *   node scripts/test-bandeja.mjs
 *
 * Lo que se fija aquí es el CRITERIO: qué se considera atascado y a quién
 * bloquea. Si esto se descuadra, Nicola abre la bandeja y ve una lista que no
 * se corresponde con lo que de verdad tiene parado el negocio, que es peor que
 * no tener bandeja.
 */

const {
  construirBandeja, resumenBandeja, GRUPOS, esCupsProvisional,
  BANDEJAS, aplicarBandeja, contarBandejas,
} = await import('../src/lib/bandeja.ts');

let ok = 0, fallos = 0;
const eq = (nombre, real, esperado) => {
  if (JSON.stringify(real) === JSON.stringify(esperado)) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fallos++; console.log(`  ✗ ${nombre}\n      esperado ${JSON.stringify(esperado)}, salió ${JSON.stringify(real)}`); }
};
const cierto = (nombre, v) => eq(nombre, !!v, true);

const hace = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
};

/** Fuentes vacías, para ir metiendo solo lo que cada caso necesita. */
const vacio = { clientes: [], cups: [], pipeline: [], contratos: [], comisiones: [], tareas: [] };

console.log('\n── CUPS provisional ──');
cierto('un CUPS de la captura es provisional', esCupsProvisional('PENDIENTE-12345678'));
cierto('sin CUPS también', esCupsProvisional(null));
cierto('uno de verdad no lo es', !esCupsProvisional('ES0031406231891001AB0F'));

console.log('\n── Lo que NO tiene que salir ──');
// Esto es lo que más se nota al abrir la bandeja: antes salía CUALQUIER cliente
// sin CUPS y la llenaba de gente a la que simplemente no le hemos sacado aún la
// factura. Nicola no puede hacer nada con eso, y tapaba lo que sí estaba parado.
eq('un recién detectado sin CUPS NO sale: eso lo desbloquea David',
  construirBandeja({
    ...vacio,
    clientes: [{ id: 'c1', nombre: 'Granja Norte', estado_comercial: 'detectado', clasificacion: 'precliente', creado_en: hace(5) }],
  }).length, 0);

eq('un objetivo del mapa tampoco',
  construirBandeja({
    ...vacio,
    clientes: [{ id: 'c1', nombre: 'Nave del polígono', estado_comercial: 'contacto_iniciado', clasificacion: 'objetivo' }],
  }).length, 0);

eq('un suministro en «sin factura» y sin consumo NO se reclama',
  construirBandeja({
    ...vacio,
    clientes: [{ id: 'c1', nombre: 'X', estado_comercial: 'detectado', clasificacion: 'precliente' }],
    cups: [{ id: 's1', cliente_id: 'c1', cups: 'ES0031406231891001AB0F', estado_cups: 'sin_factura', consumo_anual_kwh: 0 }],
  }).length, 0);

console.log('\n── Lo que SÍ tiene que salir ──');
const yaDeberia = construirBandeja({
  ...vacio,
  clientes: [{ id: 'c1', nombre: 'Granja Norte', estado_comercial: 'doc_recibida', clasificacion: 'precliente', creado_en: hace(5) }],
});
eq('si el expediente dice que ya tenemos la doc, sí sale', yaDeberia.length, 1);
eq('...y bloquea la venta', yaDeberia[0].grupo, 'bloquea_venta');
cierto('...diciendo qué hacer', yaDeberia[0].accion.length > 5);
eq('...con los días que lleva parado', yaDeberia[0].dias, 5);

const firmadoSinCups = construirBandeja({
  ...vacio,
  clientes: [{ id: 'c1', nombre: 'Talleres Sur', estado_comercial: 'detectado', clasificacion: 'cliente' }],
});
eq('un CLIENTE (ha firmado) sin ningún suministro sí sale, mande lo que mande su estado',
  firmadoSinCups.length, 1);
cierto('...y se dice que es un descuadre', /CLIENTE/.test(firmadoSinCups[0].detalle));
cierto('...y pesa más que lo demás', firmadoSinCups[0].peso >= 120);

eq('con la factura ya recibida, el consumo sí se reclama',
  construirBandeja({
    ...vacio,
    clientes: [{ id: 'c1', nombre: 'X', estado_comercial: 'doc_recibida', clasificacion: 'precliente' }],
    cups: [{ id: 's1', cliente_id: 'c1', cups: 'ES0031406231891001AB0F', estado_cups: 'factura_recibida', consumo_anual_kwh: 0 }],
  }).filter((i) => i.accion.includes('consumo')).length, 1);

eq('un CUPS provisional no pide además el consumo: sería la misma cosa dos veces',
  construirBandeja({
    ...vacio,
    clientes: [{ id: 'c1', nombre: 'X', estado_comercial: 'doc_recibida', clasificacion: 'precliente' }],
    cups: [{ id: 's1', cliente_id: 'c1', cups: 'PENDIENTE-999', estado_cups: 'factura_recibida', consumo_anual_kwh: 0 }],
  }).filter((i) => i.clienteId === 'c1').length, 1);

console.log('\n── Si David va esta semana, corre prisa ──');
const dentroDe = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};
const base = {
  ...vacio,
  clientes: [{ id: 'c1', nombre: 'Granja Mir', estado_comercial: 'doc_recibida', clasificacion: 'precliente' }],
  cups: [{ id: 's1', cliente_id: 'c1', cups: 'ES0031406231891001AB0F', estado_cups: 'factura_recibida', consumo_anual_kwh: 0 }],
};
const sinVisita = construirBandeja(base).find((i) => i.accion.includes('consumo'));
const conVisita = construirBandeja({
  ...base,
  tareas: [{ id: 't1', cliente_id: 'c1', descripcion: 'Visitar', estado: 'pendiente', fecha_limite: dentroDe(3), responsable: 'David' }],
}).find((i) => i.accion.includes('consumo'));
cierto('con visita cerca pesa más', conVisita.peso > sinVisita.peso);
cierto('...y lo dice sin rodeos', /manos vacías/i.test(conVisita.detalle));
const visitaLejos = construirBandeja({
  ...base,
  tareas: [{ id: 't1', cliente_id: 'c1', descripcion: 'Visitar', estado: 'pendiente', fecha_limite: dentroDe(30), responsable: 'David' }],
}).find((i) => i.accion.includes('consumo'));
eq('una visita a 30 días no urge nada', visitaLejos.peso, sinVisita.peso);

// Un cliente descartado no es trabajo pendiente: es una decisión ya tomada
eq('un cliente perdido no ensucia la bandeja',
  construirBandeja({ ...vacio, clientes: [{ id: 'c1', nombre: 'X', estado_comercial: 'perdido' }] }).length, 0);

const provisional = construirBandeja({
  ...vacio,
  clientes: [{ id: 'c1', nombre: 'Granja Sur', estado_comercial: 'detectado' }],
  cups: [{ id: 's1', cliente_id: 'c1', cups: 'PENDIENTE-999', consumo_anual_kwh: 0 }],
});
eq('un CUPS provisional sale una sola vez', provisional.length, 1);
cierto('...y lo que pide es el CUPS real, no el consumo', provisional[0].accion.includes('CUPS'));

const sinConsumo = construirBandeja({
  ...vacio,
  clientes: [{ id: 'c1', nombre: 'Nave Este', estado_comercial: 'detectado' }],
  cups: [{ id: 's1', cliente_id: 'c1', cups: 'ES0031406231891001AB0F', consumo_anual_kwh: 0 }],
});
eq('un CUPS real sin consumo también bloquea', sinConsumo.length, 1);
cierto('...y pide el consumo', sinConsumo[0].accion.toLowerCase().includes('consumo'));

eq('un CUPS completo no sale',
  construirBandeja({
    ...vacio,
    clientes: [{ id: 'c1', nombre: 'OK', estado_comercial: 'activo' }],
    cups: [{ id: 's1', cliente_id: 'c1', cups: 'ES003140', consumo_anual_kwh: 45000 }],
  }).length, 0);

console.log('\n── Bloquea el cobro ──');
const firmado = construirBandeja({
  ...vacio,
  clientes: [{ id: 'c1', nombre: 'Cárnicas X', estado_comercial: 'activo' }],
  cups: [{ id: 's1', cliente_id: 'c1', cups: 'ES1', consumo_anual_kwh: 100 }],
  contratos: [{ id: 'k1', cliente_id: 'c1', estado_contrato: 'firmado', fecha_firma: hace(4) }],
});
eq('un contrato firmado y sin tramitar sale', firmado.length, 1);
eq('...y bloquea el cobro', firmado[0].grupo, 'bloquea_cobro');
eq('...con los días desde la firma', firmado[0].dias, 4);

const activacion = construirBandeja({
  ...vacio,
  clientes: [{ id: 'c1', nombre: 'Y', estado_comercial: 'activo' }],
  cups: [{ id: 's1', cliente_id: 'c1', cups: 'ES1', consumo_anual_kwh: 100 }],
  contratos: [{ id: 'k1', cliente_id: 'c1', estado_contrato: 'pendiente_activacion',
    fecha_activacion_prevista: hace(10), fecha_activacion_real: null }],
});
eq('una activación que ya debería estar hecha sale', activacion.length, 1);
cierto('...y pide confirmarla', activacion[0].accion.toLowerCase().includes('activado'));

// Si ya está activado de verdad, no hay nada que hacer
eq('una activación confirmada no sale',
  construirBandeja({
    ...vacio,
    clientes: [{ id: 'c1', nombre: 'Y', estado_comercial: 'activo' }],
    cups: [{ id: 's1', cliente_id: 'c1', cups: 'ES1', consumo_anual_kwh: 100 }],
    contratos: [{ id: 'k1', cliente_id: 'c1', estado_contrato: 'pendiente_activacion',
      fecha_activacion_prevista: hace(10), fecha_activacion_real: hace(8) }],
  }).length, 0);

const comision = construirBandeja({
  ...vacio,
  comisiones: [{ id: 'm1', cliente_id: null, comercializadora: 'Endesa', estado_comision: 'prevista',
    fecha_prevista_cobro: hace(30), importe_previsto: 450 }],
});
eq('una comisión que no ha entrado sale', comision.length, 1);
cierto('...con el importe en el detalle', comision[0].detalle.includes('450'));

// Lo ya cobrado no es trabajo
eq('una comisión cobrada no sale',
  construirBandeja({ ...vacio, comisiones: [{ id: 'm1', estado_comision: 'cobrada', fecha_prevista_cobro: hace(30) }] }).length, 0);

console.log('\n── Esperando al cliente ──');
const firma = construirBandeja({
  ...vacio,
  clientes: [{ id: 'c1', nombre: 'Z', estado_comercial: 'activo' }],
  cups: [{ id: 's1', cliente_id: 'c1', cups: 'ES1', consumo_anual_kwh: 100 }],
  contratos: [{ id: 'k1', cliente_id: 'c1', estado_contrato: 'pendiente_firma', fecha_envio_contrato: hace(12) }],
});
eq('un contrato sin firmar sale', firma.length, 1);
eq('...esperando al cliente', firma[0].grupo, 'esperando_cliente');
// Cuanto más lleva sin firmar, más se enfría: tiene que subir sola
const firmaVieja = construirBandeja({
  ...vacio,
  clientes: [{ id: 'c1', nombre: 'Z', estado_comercial: 'activo' }],
  cups: [{ id: 's1', cliente_id: 'c1', cups: 'ES1', consumo_anual_kwh: 100 }],
  contratos: [{ id: 'k1', cliente_id: 'c1', estado_contrato: 'pendiente_firma', fecha_envio_contrato: hace(40) }],
});
cierto('una firma de hace 40 días pesa más que una de hace 12',
  firmaVieja[0].peso > firma[0].peso);

console.log('\n── Mis tareas ──');
const conPersona = {
  ...vacio,
  tareas: [
    { id: 't1', cliente_id: null, descripcion: 'Pedir documentación', responsable: 'Nicola', estado: 'pendiente', fecha_limite: hace(2) },
    { id: 't2', cliente_id: null, descripcion: 'Visitar granja', responsable: 'David', estado: 'pendiente', fecha_limite: hace(2) },
    { id: 't3', cliente_id: null, descripcion: 'Ya hecha', responsable: 'Nicola', estado: 'completada', fecha_limite: hace(2) },
  ],
};
const mias = construirBandeja({ ...conPersona, persona: 'Nicola' });
eq('solo salen las suyas y sin completar', mias.length, 1);
eq('...en su grupo', mias[0].grupo, 'mio');
eq('sin decir quién eres, no salen tareas', construirBandeja(conPersona).length, 0);

console.log('\n── El orden es por a quién bloquea ──');
const mezcla = construirBandeja({
  ...vacio,
  // 'doc_recibida': el expediente dice que la documentación ya llegó, así que
  // que no haya CUPS sí es un atasco de oficina y sí tiene que salir.
  clientes: [{ id: 'c1', nombre: 'Bloqueado', estado_comercial: 'doc_recibida', clasificacion: 'precliente', creado_en: hace(1) }],
  contratos: [{ id: 'k1', cliente_id: 'c1', estado_contrato: 'pendiente_firma', fecha_envio_contrato: hace(60) }],
});
eq('primero lo que bloquea la venta, aunque sea lo más reciente',
  mezcla[0].grupo, 'bloquea_venta');
cierto('...y después lo que espera al cliente, aunque lleve dos meses',
  mezcla[mezcla.length - 1].grupo === 'esperando_cliente');

console.log('\n── Resumen ──');
const r = resumenBandeja(mezcla);
eq('cuenta por grupo', r.bloquea_venta + r.esperando_cliente, mezcla.length);
eq('hay cuatro grupos definidos', GRUPOS.length, 4);
cierto('todos explican por qué corren prisa', GRUPOS.every((g) => g.porque.length > 10));


console.log('\n── Bandejas guardadas (las tandas con nombre) ──');
{
  const items = construirBandeja({
    ...vacio,
    clientes: [
      { id: 'c1', nombre: 'Firmante', estado_comercial: 'doc_recibida', clasificacion: 'precliente', creado_en: hace(4) },
      { id: 'c2', nombre: 'Con contrato', estado_comercial: 'activo', clasificacion: 'cliente', creado_en: hace(9) },
    ],
    pipeline: [{ id: 'p1', cliente_id: 'c2', estado: 'factura_recibida', nombre_oportunidad: 'Nave', creado_en: hace(6) }],
    contratos: [
      { id: 'k1', cliente_id: 'c2', estado_contrato: 'firmado', fecha_firma: hace(5) },
      { id: 'k2', cliente_id: 'c2', estado_contrato: 'pendiente_firma', fecha_envio_contrato: hace(11) },
      { id: 'k3', cliente_id: 'c2', estado_contrato: 'incidencia', actualizado_en: hace(3) },
    ],
    comisiones: [{ id: 'm1', cliente_id: 'c2', estado_comision: 'pendiente_cobro', fecha_prevista_cobro: hace(30), importe_previsto: 400 }],
    tareas: [
      { id: 't1', cliente_id: 'c2', descripcion: 'Llamar', responsable: 'Nicola', estado: 'pendiente', fecha_limite: hace(3) },
      { id: 't2', cliente_id: 'c2', descripcion: 'Para mañana', responsable: 'Nicola', estado: 'pendiente', fecha_limite: null },
    ],
    persona: 'Nicola',
  });

  cierto('todas las líneas dicen de qué van', items.every((i) => !!i.asunto));
  eq('«Todo» no filtra nada', aplicarBandeja(items, 'todo').length, items.length);
  eq('una bandeja que no existe tampoco filtra', aplicarBandeja(items, 'inventada').length, items.length);

  const vencidas = aplicarBandeja(items, 'mis_vencidas');
  cierto('«Mis vencidas» solo trae tareas', vencidas.every((i) => i.asunto === 'tarea'));
  cierto('...y solo las que ya pasaron de fecha', vencidas.every((i) => i.dias > 0));
  cierto('una tarea SIN fecha no es una vencida: está sin planificar',
    !vencidas.some((i) => i.accion === 'Para mañana'));

  const contratos = aplicarBandeja(items, 'contratos_bloqueados');
  cierto('«Contratos bloqueados» trae el firmado sin enviar y la incidencia',
    contratos.some((i) => i.asunto === 'enviar_comercializadora')
    && contratos.some((i) => i.asunto === 'incidencia'));
  cierto('...y NO trae la comisión', !contratos.some((i) => i.asunto === 'comision'));

  eq('«Cobros pendientes» trae solo comisiones',
    aplicarBandeja(items, 'cobros').every((i) => i.asunto === 'comision'), true);
  eq('«Esperando respuesta» trae solo lo que está en manos del cliente',
    aplicarBandeja(items, 'esperando_respuesta').every((i) => i.grupo === 'esperando_cliente'), true);
  eq('«Ofertas por preparar» trae solo eso',
    aplicarBandeja(items, 'ofertas').every((i) => i.asunto === 'preparar_oferta'), true);

  const cuenta = contarBandejas(items);
  eq('la cuenta de «Todo» es el total', cuenta.todo, items.length);
  eq('cada bandeja cuenta lo que trae',
    BANDEJAS.every((b) => cuenta[b.clave] === aplicarBandeja(items, b.clave).length), true);

  cierto('ninguna bandeja se queda con más de lo que hay',
    BANDEJAS.every((b) => cuenta[b.clave] <= items.length));
  cierto('todas explican para qué son', BANDEJAS.every((b) => b.porque.length > 15));
  eq('los nombres no se repiten', new Set(BANDEJAS.map((b) => b.clave)).size, BANDEJAS.length);
  // Cada línea tiene que caber en alguna tanda: si un asunto no entra en
  // ninguna, existe trabajo que no se puede pedir por su nombre.
  const cubiertos = new Set(BANDEJAS.flatMap((b) => b.asuntos || []));
  cierto('ningún asunto se queda fuera de todas las bandejas',
    items.every((i) => cubiertos.has(i.asunto)),
    items.filter((i) => !cubiertos.has(i.asunto)).map((i) => i.asunto).join(', '));
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} correctos, ${fallos} fallos\n`);
process.exit(fallos === 0 ? 0 : 1);
