#!/usr/bin/env node
/**
 * Tests del parte diario (src/lib/parte-diario.ts).
 *
 *   node scripts/test-parte.mjs
 *
 * Lo que se fija aquí es el CRITERIO de qué es una mejora y qué es ruido. Si eso
 * se descuadra, Marcos abre el parte del día y ve una lista larga donde no se
 * distingue un contrato firmado de una errata corregida, que es exactamente
 * igual de inútil que no tener parte.
 */

const {
  construirParte, diferencias, clasificarCambio, formatearValor, personaDe, horaDe,
  ENTIDADES, PESO,
} = await import('../src/lib/parte-diario.ts');

let ok = 0, fallos = 0;
const eq = (nombre, real, esperado) => {
  if (JSON.stringify(real) === JSON.stringify(esperado)) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fallos++; console.log(`  ✗ ${nombre}\n      esperado ${JSON.stringify(esperado)}, salió ${JSON.stringify(real)}`); }
};
const cierto = (nombre, v) => eq(nombre, !!v, true);

const FECHA = '2026-07-24';
const iso = (hhmm) => `${FECHA}T${hhmm}:00`;

/** Fila de auditoría de mentira, con lo justo. */
const aud = (o) => ({
  id: Math.random().toString(36).slice(2),
  usuario: 'nicola@gesmeco.com', accion: 'UPDATE', tabla: 'luz_cups',
  registro_id: 'r1', antes: null, despues: null, creado_en: iso('10:00'), ...o,
});

console.log('\n── Formato de valores ──');
eq('null se ve como raya', formatearValor(null), '—');
eq('vacío también', formatearValor(''), '—');
eq('booleano en cristiano', formatearValor(true), 'sí');
eq('...y el falso', formatearValor(false), 'no');
eq('fecha ISO a española', formatearValor('2026-04-30'), '30/04/2026');
eq('estado con guiones bajos se lee', formatearValor('oferta_enviada'), 'oferta enviada');
eq('array de potencias', formatearValor([30, 30, 15]), '30 · 30 · 15');
eq('array vacío es raya', formatearValor([]), '—');
eq('un texto normal no se toca', formatearValor('Granja Norte SL'), 'Granja Norte SL');

console.log('\n── Nombre de la persona ──');
eq('del email sale el nombre', personaDe('david@gesmeco.com'), 'David');
eq('con puntos se separa', personaDe('marcos.benedico@gesmeco.com'), 'Marcos benedico');
eq('el mapa manda sobre el email', personaDe('n@g.com', { 'n@g.com': 'Nicola' }), 'Nicola');
eq('sin usuario es el sistema', personaDe(null), 'Sistema');

console.log('\n── Hora ──');
eq('saca HH:MM', horaDe('2026-07-24T09:05:00'), '09:05');
eq('una fecha rota no revienta', horaDe('vete a saber'), '--:--');

console.log('\n── Qué es un avance y qué no ──');
eq('el CUPS sube de estado', clasificarCambio('estado_cups', 'oferta_enviada', 'contrato_firmado'), 'avance');
eq('...y si baja, es retroceso', clasificarCambio('estado_cups', 'contrato_firmado', 'oferta_enviada'), 'retroceso');
eq('perder es retroceso aunque venga de atrás', clasificarCambio('estado_cups', 'sin_factura', 'perdido'), 'retroceso');
eq('firmar por primera vez es avance', clasificarCambio('fecha_firma', null, '2026-07-24'), 'avance');
eq('...pero corregir la fecha de firma es rutina', clasificarCambio('fecha_firma', '2026-07-20', '2026-07-24'), 'rutina');
eq('cobrar es dinero', clasificarCambio('importe_cobrado', null, '340'), 'dinero');
eq('marcar la comisión cobrada es dinero', clasificarCambio('estado_comision', 'pendiente', 'cobrada'), 'dinero');
eq('rellenar un dato vacío cuenta como trabajo', clasificarCambio('consumo_anual_kwh', null, '145000'), 'dato');
eq('cambiar una observación es rutina', clasificarCambio('observaciones', 'algo', 'otra cosa'), 'rutina');
eq('el motivo de pérdida es retroceso', clasificarCambio('motivo_perdida', null, 'se queda con la suya'), 'retroceso');
eq('el resultado de una visita es avance', clasificarCambio('resultado', null, 'me dio la factura'), 'avance');

console.log('\n── El diff ──');
const d = diferencias(
  { id: 'x', estado_cups: 'oferta_enviada', observaciones: 'ojo', consumo_anual_kwh: null, actualizado_en: 'a' },
  { id: 'x', estado_cups: 'contrato_firmado', observaciones: 'ojo2', consumo_anual_kwh: 145000, actualizado_en: 'b' }
);
eq('detecta los tres cambios de verdad', d.length, 3);
eq('...y descarta id y actualizado_en', d.some((c) => ['id', 'actualizado_en'].includes(c.campo)), false);
eq('el avance va primero', d[0].campo, 'estado_cups');
eq('...traducido al castellano', d[0].etiqueta, 'Estado del suministro');
eq('...con el antes y el después legibles', [d[0].de, d[0].a], ['oferta enviada', 'contrato firmado']);
eq('la rutina va la última', d[d.length - 1].campo, 'observaciones');
eq('sin antes no hay diff', diferencias(null, { a: 1 }).length, 0);

console.log('\n── El parte de un día ──');
const parte = construirParte({
  fecha: FECHA,
  nombresUsuario: { 'nicola@gesmeco.com': 'Nicola', 'david@gesmeco.com': 'David' },
  clientes: { c1: 'Granja Norte SL' },
  auditoria: [
    // Nicola da de alta un cliente
    aud({ accion: 'INSERT', tabla: 'luz_clientes', creado_en: iso('09:12'),
          despues: { id: 'c1', nombre: 'Granja Norte SL', nif: 'B22000000' } }),
    // ...y su suministro
    aud({ accion: 'INSERT', tabla: 'luz_cups', creado_en: iso('09:20'),
          despues: { id: 's1', cliente_id: 'c1', cups: 'ES0031...AB0F' } }),
    // David mueve el CUPS: eso es la mejora
    aud({ usuario: 'david@gesmeco.com', accion: 'UPDATE', tabla: 'luz_cups', creado_en: iso('11:40'),
          antes:   { id: 's1', cliente_id: 'c1', cups: 'ES0031...AB0F', estado_cups: 'sin_factura' },
          despues: { id: 's1', cliente_id: 'c1', cups: 'ES0031...AB0F', estado_cups: 'factura_recibida' } }),
    // Nicola cobra una comisión
    aud({ accion: 'UPDATE', tabla: 'luz_comisiones', creado_en: iso('13:02'),
          antes:   { id: 'k1', cliente_id: 'c1', importe_cobrado: null, estado_comision: 'pendiente' },
          despues: { id: 'k1', cliente_id: 'c1', importe_cobrado: 340.5, estado_comision: 'cobrada' } }),
    // Un guardado que no cambió nada: no debe salir
    aud({ accion: 'UPDATE', tabla: 'luz_cups', creado_en: iso('13:30'),
          antes: { id: 's1', cups: 'ES0031...AB0F' }, despues: { id: 's1', cups: 'ES0031...AB0F' } }),
    // Una tabla que no interesa en el parte
    aud({ accion: 'UPDATE', tabla: 'app_usuarios', creado_en: iso('14:00'),
          antes: { id: 'u1', rol: 'estandar' }, despues: { id: 'u1', rol: 'admin' } }),
  ],
});

cierto('hay movimiento', parte.hay_movimiento);
eq('cuenta solo las acciones con contenido', parte.resumen.acciones, 4);
eq('un cliente nuevo', parte.resumen.clientes_nuevos, 1);
eq('un suministro nuevo', parte.resumen.suministros_nuevos, 1);
eq('una comisión cobrada', parte.resumen.comisiones_cobradas, 1);
eq('...con su importe', parte.resumen.importe_cobrado, 340.5);
eq('dos personas han tocado algo', parte.resumen.personas, 2);

eq('las altas salen aparte', parte.altas.length, 2);
eq('los avances también', parte.avances.length, 1);
eq('...y es el del CUPS de David', parte.avances[0].persona, 'David');
eq('el dinero va a su bloque', parte.dinero.length, 1);
eq('no hay retrocesos hoy', parte.retrocesos.length, 0);

console.log('\n── Por persona ──');
eq('Nicola la primera, que ha hecho más', parte.personas[0].persona, 'Nicola');
eq('...con tres acciones', parte.personas[0].total, 3);
eq('David con una', parte.personas[1].total, 1);
eq('...y le cuenta como avance', parte.personas[1].avances, 1);

console.log('\n── Cada acción se lee sola ──');
const alta = parte.altas[0];
cierto('la frase de un alta lo dice todo', alta.frase.includes('Granja Norte SL'));
cierto('...y dice que es un alta', /Alta de cliente/i.test(alta.frase));
const av = parte.avances[0];
cierto('la de un avance enseña de dónde a dónde', av.frase.includes('›'));
eq('...y cuelga de su cliente', av.cliente, 'Granja Norte SL');
eq('...con la hora', av.hora, '11:40');

console.log('\n── Un día sin nada ──');
const vacio = construirParte({ fecha: FECHA, auditoria: [] });
eq('no hay movimiento', vacio.hay_movimiento, false);
eq('cero acciones', vacio.resumen.acciones, 0);
eq('...y ninguna persona', vacio.personas.length, 0);

console.log('\n── Retroceso ──');
const malo = construirParte({
  fecha: FECHA,
  auditoria: [aud({ accion: 'UPDATE', tabla: 'luz_pipeline', creado_en: iso('16:00'),
    antes:   { id: 'o1', nombre_oportunidad: 'Nave Vico', estado: 'oferta_enviada' },
    despues: { id: 'o1', nombre_oportunidad: 'Nave Vico', estado: 'perdido' } })],
});
eq('perder sale como retroceso', malo.retrocesos.length, 1);
cierto('...y se ve qué se perdió', malo.retrocesos[0].titulo === 'Nave Vico');

console.log('\n── Entidades ──');
cierto('todas las tablas del parte tienen nombre y emoji',
  Object.values(ENTIDADES).every((e) => e.singular && e.emoji));
cierto('un alta pesa más que la rutina', PESO.alta > PESO.rutina);
cierto('un avance pesa más que un dato', PESO.avance > PESO.dato);

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} bien, ${fallos} mal\n`);
process.exit(fallos === 0 ? 0 : 1);
