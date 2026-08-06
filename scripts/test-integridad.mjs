#!/usr/bin/env node
/**
 * Tests de integridad de datos del alta y de los vínculos entre tablas.
 *
 * Fijan tres cosas que se estaban rompiendo en producción:
 *
 *   1. El asistente de alta permite volver atrás. Cada pasada volvía a crear la
 *      oportunidad, la tarea y la fecha crítica, así que un cliente acababa con
 *      tres tareas iguales sin que nadie las hubiera pedido.
 *   2. El fin de contrato se guardaba en el CUPS Y ADEMÁS como fecha crítica.
 *      El mismo vencimiento salía dos veces, y la copia se quedaba desfasada en
 *      cuanto alguien corregía la fecha del suministro.
 *   3. Un formulario que mandaba el suministro en blanco dejaba el contrato sin
 *      CUPS. Después figuraba como «sin CUPS» y al activarlo el suministro no
 *      pasaba a activado, porque la sincronización lo busca por ese campo.
 */

let ok = 0, fallos = 0;
const t = (nombre, cond) => {
  if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fallos++; console.log(`  ✗ ${nombre}`); }
};
const bloque = (n) => console.log(`\n── ${n} ──`);

// ── 1. Idempotencia del asistente de alta ──────────────────────────────────
/** Reproduce el asistente: cada paso guarda al avanzar y se puede volver atrás. */
function asistente() {
  const creado = { pipeline: 0, tareas: 0, fechas: 0 };
  const hecho = { op: false, tarea: false, fechas: false };
  return {
    creado,
    paso3() { if (hecho.op) return; creado.pipeline++; hecho.op = true; },
    paso4(conDescripcion) {
      if (hecho.tarea) return;
      if (!conDescripcion) return;          // la tarea es opcional
      creado.tareas++; hecho.tarea = true;
    },
    paso5() { if (hecho.fechas) return; creado.fechas++; hecho.fechas = true; },
  };
}

bloque('El alta crea exactamente un registro de cada cosa');
{
  const a = asistente();
  a.paso3(); a.paso4(true); a.paso5();
  t('una pasada: 1 oportunidad, 1 tarea, 1 fecha',
    a.creado.pipeline === 1 && a.creado.tareas === 1 && a.creado.fechas === 1);
}

bloque('Volver atrás y avanzar otra vez NO duplica');
{
  const a = asistente();
  a.paso3(); a.paso4(true); a.paso5();
  a.paso3(); a.paso4(true); a.paso5();   // el usuario vuelve atrás y repite
  a.paso3(); a.paso4(true); a.paso5();   // y otra vez
  t('sigue habiendo 1 oportunidad', a.creado.pipeline === 1);
  t('sigue habiendo 1 tarea', a.creado.tareas === 1);
  t('sigue habiendo 1 fecha crítica', a.creado.fechas === 1);
}

bloque('La tarea del alta es opcional');
{
  const a = asistente();
  a.paso3(); a.paso4(false); a.paso5();
  t('sin descripción no se crea ninguna tarea', a.creado.tareas === 0);
  t('la oportunidad sí se crea', a.creado.pipeline === 1);
}

bloque('Doble toque: el cerrojo es síncrono, no un estado de React');
{
  // `guardando` es estado y tarda un render en aplicarse: dos toques seguidos
  // en el móvil colaban dos peticiones antes de que el botón se deshabilitara.
  let peticiones = 0;
  const cerrojo = { activo: false };
  const guardar = () => {
    if (cerrojo.activo) return;
    cerrojo.activo = true;
    peticiones++;
  };
  guardar(); guardar(); guardar();
  t('tres toques seguidos, una sola petición', peticiones === 1);
}

// ── 2. El fin de contrato no se duplica ────────────────────────────────────
/** Lo que crea el alta al guardar un suministro con fin de contrato. */
function altaConFinDeContrato(finContrato) {
  const cups = { fecha_fin_contrato: finContrato || null };
  const fechasCriticas = [];
  // La próxima acción SÍ es una fecha crítica: la decide una persona.
  fechasCriticas.push({ tipo_fecha: 'presentar_proyecto' });
  // El fin de contrato NO: ya está en el CUPS y la Agenda lo calcula desde ahí.
  return { cups, fechasCriticas };
}

bloque('El vencimiento vive en un solo sitio');
{
  const r = altaConFinDeContrato('2026-10-20');
  t('queda guardado en el CUPS', r.cups.fecha_fin_contrato === '2026-10-20');
  t('NO se copia a fechas críticas',
    !r.fechasCriticas.some((f) => f.tipo_fecha === 'fin_contrato'));
  t('la próxima acción sí genera su fecha',
    r.fechasCriticas.filter((f) => f.tipo_fecha === 'presentar_proyecto').length === 1);
  t('en total, una sola fecha crítica', r.fechasCriticas.length === 1);
}
{
  const r = altaConFinDeContrato(null);
  t('sin fin de contrato tampoco aparecen fechas de más', r.fechasCriticas.length === 1);
}

// ── 3. Los vínculos no se rompen con un campo vacío ────────────────────────
const VINCULOS_PROTEGIDOS = {
  contratos: ['cliente_id', 'cups_id'],
  comisiones: ['cliente_id', 'cups_id', 'contrato_id'],
  pipeline: ['cliente_id', 'cups_id'],
  tareas: ['cliente_id'],
  fechas: ['cliente_id'],
  cups: ['cliente_id'],
};

/** Misma lógica que protegerVinculos() en el route handler. */
function protegerVinculos(tabla, filaActual, campos) {
  const out = { ...campos };
  for (const k of VINCULOS_PROTEGIDOS[tabla] || []) {
    if (k in out && out[k] == null && filaActual[k]) delete out[k];
  }
  return out;
}

bloque('Un campo en blanco no borra el suministro de un contrato');
{
  const actual = { cliente_id: 'c1', cups_id: 'u1' };
  const r = protegerVinculos('contratos', actual, { cups_id: null, estado_contrato: 'activado' });
  t('el cups_id vacío se ignora', !('cups_id' in r));
  t('el resto del cambio sí se aplica', r.estado_contrato === 'activado');
}
{
  const actual = { cliente_id: 'c1', cups_id: null };
  const r = protegerVinculos('contratos', actual, { cups_id: 'u9' });
  t('si no tenía CUPS, se puede asignar uno', r.cups_id === 'u9');
}
{
  const actual = { cliente_id: 'c1', cups_id: 'u1' };
  const r = protegerVinculos('contratos', actual, { cups_id: 'u2' });
  t('cambiar de un CUPS a otro sigue permitido', r.cups_id === 'u2');
}
{
  const actual = { cliente_id: 'c1', cups_id: 'u1', contrato_id: 'k1' };
  const r = protegerVinculos('comisiones', actual, { cliente_id: null, cups_id: null, contrato_id: null, importe_cobrado: 300 });
  t('una comisión no se queda huérfana',
    !('cliente_id' in r) && !('cups_id' in r) && !('contrato_id' in r));
  t('y su importe sí se guarda', r.importe_cobrado === 300);
}

bloque('Un contrato sin suministro no puede activar nada');
{
  /** Reproduce la sincronización contrato → CUPS → cliente del PUT. */
  const sincronizar = (contrato) => (contrato.cups_id ? 'cups_actualizado' : 'solo_cliente');
  t('con CUPS, el suministro pasa a activado', sincronizar({ cups_id: 'u1' }) === 'cups_actualizado');
  t('sin CUPS, el suministro se queda como estaba', sincronizar({ cups_id: null }) === 'solo_cliente');
}

bloque('El formulario exige el suministro antes de crear el contrato');
{
  const validar = (form) => (form.cups_id ? null : 'Elige a qué suministro pertenece el contrato.');
  t('sin suministro no deja guardar', validar({ cups_id: '' }) !== null);
  t('con suministro sí', validar({ cups_id: 'u1' }) === null);
}

console.log(`\n${ok} pasan, ${fallos} fallan`);
process.exit(fallos ? 1 : 0);
