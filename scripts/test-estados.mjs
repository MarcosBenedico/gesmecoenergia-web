#!/usr/bin/env node
/**
 * Tests de la sincronización de estados del viaje comercial (src/lib/estados-luz.ts).
 *
 *   node scripts/test-estados.mjs
 *
 * Se ejecuta sobre el TypeScript real (Node 24 lo lee directamente), así que
 * prueba EXACTAMENTE el código que corre en producción, no una copia.
 * Sale con código 1 si algo falla.
 */

const {
  estadoClienteDesdeCups, debeAplicarseAlCups,
  PIPELINE_A_CUPS, CONTRATO_A_CUPS, CUPS_A_CLIENTE, ORDEN_ESTADO_CUPS,
} = await import('../src/lib/estados-luz.ts');

let fallos = 0;
const comprobar = (nombre, real, esperado) => {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) { fallos++; console.error(`  ✗ ${nombre}\n      esperado: ${JSON.stringify(esperado)}\n      obtenido: ${JSON.stringify(real)}`); }
  else console.log(`  ✓ ${nombre}`);
};

console.log('\nESTADO DEL CLIENTE DERIVADO DE SUS CUPS');
comprobar('sin suministros no se toca el estado (puede ser un prospecto recién captado)',
  estadoClienteDesdeCups([]), null);
comprobar('un suministro activado → cliente activo',
  estadoClienteDesdeCups(['activado']), 'activo');
comprobar('activo aunque tenga otro perdido (ya factura con nosotros)',
  estadoClienteDesdeCups(['activado', 'perdido']), 'activo');
comprobar('manda el suministro más avanzado de los vivos',
  estadoClienteDesdeCups(['sin_factura', 'oferta_enviada']), 'pendiente_decision');
comprobar('contrato firmado pendiente de activar → cliente en trámite',
  estadoClienteDesdeCups(['contrato_firmado']), 'contrato_tramite');
comprobar('todos cerrados → perdido',
  estadoClienteDesdeCups(['perdido', 'perdido']), 'perdido');
comprobar('a revisar más adelante NO es un cliente perdido',
  estadoClienteDesdeCups(['perdido', 'revisar_adelante']), 'revisar_adelante');
comprobar('no viable gana a perdido, pero pierde contra revisar',
  estadoClienteDesdeCups(['perdido', 'no_viable']), 'no_viable');

console.log('\nPROTECCIÓN CONTRA RETROCESOS');
comprobar('un pipeline viejo movido a seguimiento NO desactiva un suministro activo',
  debeAplicarseAlCups('activado', 'oferta_enviada'), false);
comprobar('avanzar sí se aplica',
  debeAplicarseAlCups('oferta_enviada', 'activado'), true);
comprobar('cerrar como perdido siempre se puede (es una decisión explícita)',
  debeAplicarseAlCups('activado', 'perdido'), true);
comprobar('reabrir un suministro cerrado se puede',
  debeAplicarseAlCups('perdido', 'pendiente_ofertar'), true);
comprobar('el mismo estado no genera escritura',
  debeAplicarseAlCups('oferta_enviada', 'oferta_enviada'), false);
comprobar('estado vacío no hace nada',
  debeAplicarseAlCups('oferta_enviada', ''), false);

console.log('\nINTEGRIDAD DE LAS TRADUCCIONES');
const estadosCupsValidos = new Set([...ORDEN_ESTADO_CUPS, 'perdido', 'no_viable', 'revisar_adelante']);
for (const [origen, destino] of Object.entries(PIPELINE_A_CUPS)) {
  if (!estadosCupsValidos.has(destino)) { fallos++; console.error(`  ✗ pipeline "${origen}" apunta a un estado de CUPS inexistente: "${destino}"`); }
}
console.log(`  ✓ las ${Object.keys(PIPELINE_A_CUPS).length} traducciones de pipeline apuntan a estados de CUPS reales`);
for (const [origen, destino] of Object.entries(CONTRATO_A_CUPS)) {
  if (!estadosCupsValidos.has(destino)) { fallos++; console.error(`  ✗ contrato "${origen}" apunta a un estado de CUPS inexistente: "${destino}"`); }
}
console.log(`  ✓ las ${Object.keys(CONTRATO_A_CUPS).length} traducciones de contrato apuntan a estados de CUPS reales`);
comprobar('todo estado de CUPS sabe traducirse a estado de cliente',
  [...estadosCupsValidos].filter((e) => !CUPS_A_CLIENTE[e]), []);
comprobar('"incidencia" del contrato NO toca el suministro (es un problema del papeleo)',
  CONTRATO_A_CUPS.incidencia, undefined);

console.log(fallos === 0 ? '\n✅ Todo correcto.\n' : `\n❌ ${fallos} fallo(s).\n`);
process.exit(fallos > 0 ? 1 : 0);
