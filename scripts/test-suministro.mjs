/**
 * Tests de la FICHA DEL SUMINISTRO: pestañas y formulario por bloques.
 *
 *   npm run test:suministro
 *
 * Lo que se protege aquí es lo que ya costó dinero una vez:
 *
 *   · Que un consumo con punto de miles no entre mil veces más pequeño.
 *   · Que no se pueda guardar una 3.0TD con tres periodos de seis, porque
 *     entonces el coste actual sale a la mitad y el ahorro al doble sin que
 *     nada lo delate.
 *   · Que un campo vacío se guarde como null y nunca como cadena vacía.
 *   · Y que faltar un dato AVISE en vez de bloquear: negarse a guardar un
 *     suministro apuntado en una puerta es perder la visita entera.
 */
import {
  PESTANAS, PESTANA_POR_DEFECTO, pestanaValida,
  BLOQUES_SUMINISTRO, CAMPOS_SUMINISTRO, bloqueDe,
  periodosDePotencia, nombresDePeriodo, ajustarPotencias,
  revisarSuministro, sePuedeGuardar, avisosDelBloque,
  prepararSuministro, preavisoSugerido, valoresDesde, completitudPorBloque,
  esProvisional,
} from '../src/lib/formulario-suministro.ts';

let ok = 0, fallos = 0;
const comprueba = (n, c, d = '') => {
  if (c) { ok++; console.log(`  ✓ ${n}`); }
  else { fallos++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`); }
};
const titulo = (t) => console.log(`\n${t}`);

/** Un formulario mínimo pero válido, para ir cambiando solo lo de cada caso. */
const base = (o = {}) => ({
  cups: 'ES0021000000123456AB', tarifa_acceso: '2.0TD',
  potencias_kw: [4.6, 4.6], consumo_anual_kwh: '5300',
  responsable: 'Nicola', ...o,
});

// ── Pestañas ───────────────────────────────────────────────────────────────
titulo('Las cinco pestañas, y la primera es «qué pasa»');
{
  comprueba('son cinco', PESTANAS.length === 5);
  comprueba('la primera es el estado, no los datos', PESTANAS[0].clave === 'estado');
  comprueba('la de por defecto es esa', PESTANA_POR_DEFECTO === 'estado');
  comprueba('el historial va al final', PESTANAS[PESTANAS.length - 1].clave === 'historial');
  comprueba('todas dicen para qué se abren', PESTANAS.every((p) => p.para.length > 15));
  comprueba('los nombres no se repiten', new Set(PESTANAS.map((p) => p.clave)).size === 5);
  comprueba('una pestaña inventada cae en la primera', pestanaValida('inventada') === 'estado');
  comprueba('sin pestaña, la primera', pestanaValida(null) === 'estado');
  comprueba('una buena se respeta', pestanaValida('contrato') === 'contrato');
}

// ── Bloques ────────────────────────────────────────────────────────────────
titulo('Los bloques del formulario');
{
  comprueba('hay cuatro', BLOQUES_SUMINISTRO.length === 4);
  comprueba('todos explican POR QUÉ se piden esos datos',
    BLOQUES_SUMINISTRO.every((b) => b.porque.length > 30));
  comprueba('ningún campo está en dos bloques',
    new Set(CAMPOS_SUMINISTRO.map((c) => c.clave)).size === CAMPOS_SUMINISTRO.length);
  comprueba('el CUPS va en el primer bloque', BLOQUES_SUMINISTRO[0].campos[0].clave === 'cups');
  comprueba('SOLO el CUPS es obligatorio',
    CAMPOS_SUMINISTRO.filter((c) => c.obligatorio).map((c) => c.clave).join(',') === 'cups');
  comprueba('se sabe en qué bloque está cada campo',
    CAMPOS_SUMINISTRO.every((c) => bloqueDe(c.clave) !== null));
  comprueba('un campo que no existe no tiene bloque', bloqueDe('inventado') === null);
  comprueba('el preaviso está marcado como derivado',
    CAMPOS_SUMINISTRO.find((c) => c.clave === 'fecha_limite_preaviso')?.derivado === true);
}

// ── Periodos por tarifa ────────────────────────────────────────────────────
titulo('Cada tarifa pinta exactamente sus periodos');
{
  comprueba('2.0TD son 2', periodosDePotencia('2.0TD') === 2);
  comprueba('3.0TD son 6', periodosDePotencia('3.0TD') === 6);
  comprueba('6.1TD son 6', periodosDePotencia('6.1TD') === 6);
  comprueba('«2.0» sin TD también se entiende', periodosDePotencia('2.0') === 2);
  comprueba('una tarifa desconocida no rompe: una casilla', periodosDePotencia('otra') === 1);
  comprueba('sin tarifa tampoco rompe', periodosDePotencia(null) === 1);
  comprueba('los periodos van etiquetados', nombresDePeriodo('3.0TD').length === 6);
}

titulo('Cambiar de tarifa no borra lo que ya estaba escrito');
{
  const sube = ajustarPotencias([4.6, 5.75], '3.0TD');
  comprueba('de 2.0TD a 3.0TD quedan 6 casillas', sube.length === 6);
  comprueba('...y las dos que había se conservan', sube[0] === 4.6 && sube[1] === 5.75);
  comprueba('...las nuevas nacen vacías, no en cero', sube[2] === null);

  const baja = ajustarPotencias([10, 20, 30, 40, 50, 60], '2.0TD');
  comprueba('de 3.0TD a 2.0TD quedan 2', baja.length === 2 && baja[0] === 10);
  comprueba('una lista vacía da huecos', ajustarPotencias(null, '2.0TD').every((x) => x === null));
  comprueba('un cero no cuenta como potencia', ajustarPotencias([0, 4.6], '2.0TD')[0] === null);
}

// ── Validación: qué bloquea y qué solo avisa ───────────────────────────────
titulo('Sin CUPS no se guarda; lo demás sí');
{
  const sin = revisarSuministro(base({ cups: '' }));
  comprueba('sin CUPS bloquea', !sePuedeGuardar(sin));
  comprueba('...y lo dice en su campo', sin.some((a) => a.campo === 'cups' && a.bloquea));

  comprueba('con lo mínimo se guarda', sePuedeGuardar(revisarSuministro(base())));
  comprueba('sin consumo se guarda igual (avisa, no bloquea)',
    sePuedeGuardar(revisarSuministro(base({ consumo_anual_kwh: '' }))));
  comprueba('sin fin de contrato se guarda igual',
    sePuedeGuardar(revisarSuministro(base({ fecha_fin_contrato: '' }))));
  comprueba('sin responsable se guarda igual',
    sePuedeGuardar(revisarSuministro(base({ responsable: '' }))));

  const flojo = revisarSuministro(base({ consumo_anual_kwh: '', responsable: '' }));
  comprueba('pero los tres huecos se dicen',
    flojo.some((a) => a.campo === 'consumo_anual_kwh')
    && flojo.some((a) => a.campo === 'responsable')
    && flojo.some((a) => a.campo === 'fecha_fin_contrato'));
}

titulo('El CUPS provisional avisa pero no impide guardar');
{
  const p = revisarSuministro(base({ cups: 'PENDIENTE-1234' }));
  comprueba('se reconoce como provisional', esProvisional('PENDIENTE-1234'));
  comprueba('se puede guardar', sePuedeGuardar(p));
  comprueba('se avisa de que así no se puede contratar',
    p.some((a) => a.campo === 'cups' && !a.bloquea && /contratar/.test(a.texto)));
}

titulo('Un CUPS con mala forma se señala, no se rechaza');
{
  const r = revisarSuministro(base({ cups: 'ES123' }));
  comprueba('avisa de la forma', r.some((a) => a.campo === 'cups' && /forma de CUPS/.test(a.texto)));
  comprueba('pero deja guardar: hay CUPS antiguos y erratas al copiar', sePuedeGuardar(r));
}

titulo('EL ERROR CARO: periodos a medias en 3.0TD');
{
  const tres = revisarSuministro(base({ tarifa_acceso: '3.0TD', potencias_kw: [10, 20, 30] }));
  comprueba('tres periodos de seis BLOQUEA', !sePuedeGuardar(tres));
  comprueba('...y explica por qué', tres.some((a) => /mitad/.test(a.texto) && a.bloquea));

  comprueba('los seis completos se guardan',
    sePuedeGuardar(revisarSuministro(base({ tarifa_acceso: '3.0TD', potencias_kw: [10, 20, 30, 40, 50, 60] }))));
  comprueba('ninguna potencia todavía no bloquea: aún no se ha llegado ahí',
    sePuedeGuardar(revisarSuministro(base({ tarifa_acceso: '3.0TD', potencias_kw: [] }))));
}

titulo('Potencias que decrecen en 3.0TD: se marca, no se corrige');
{
  const r = revisarSuministro(base({ tarifa_acceso: '3.0TD', potencias_kw: [30, 20, 30, 40, 50, 60] }));
  comprueba('se avisa', r.some((a) => a.campo === 'potencias_kw' && /no puede bajar/.test(a.texto)));
  comprueba('pero no bloquea: lo dudoso se marca y se deja', sePuedeGuardar(r));
  comprueba('solo se dice una vez, no seis',
    r.filter((a) => /no puede bajar/.test(a.texto)).length === 1);
}

titulo('Fechas imposibles');
{
  const r = revisarSuministro(base({ fecha_inicio_contrato: '2027-01-01', fecha_fin_contrato: '2026-01-01' }));
  comprueba('acabar antes de empezar bloquea', !sePuedeGuardar(r));
  comprueba('en orden correcto no pasa nada',
    sePuedeGuardar(revisarSuministro(base({ fecha_inicio_contrato: '2026-01-01', fecha_fin_contrato: '2027-01-01' }))));
}

titulo('Permanencia dicha a medias');
{
  const r = revisarSuministro(base({ tiene_permanencia: true }));
  comprueba('con permanencia y sin fecha, avisa',
    r.some((a) => a.campo === 'fecha_fin_permanencia'));
  comprueba('sin permanencia no pregunta la fecha',
    !revisarSuministro(base({ tiene_permanencia: false })).some((a) => a.campo === 'fecha_fin_permanencia'));
}

titulo('Los avisos se pintan en su bloque');
{
  const r = revisarSuministro(base({ cups: '', consumo_anual_kwh: '' }));
  comprueba('el del CUPS va en identificación',
    avisosDelBloque(r, 'identificacion').some((a) => a.campo === 'cups'));
  comprueba('el del consumo va en el técnico',
    avisosDelBloque(r, 'tecnico').some((a) => a.campo === 'consumo_anual_kwh'));
  comprueba('en gestión no hay ninguno de esos dos',
    avisosDelBloque(r, 'gestion').every((a) => a.campo === 'responsable'));
}

// ── Lo que se guarda ───────────────────────────────────────────────────────
titulo('EL PUNTO DE MILES: 53.558 son 53.558 kWh, no 53');
{
  const g = prepararSuministro(base({ consumo_anual_kwh: '53.558' }));
  comprueba('53.558 se guarda como 53558', g.consumo_anual_kwh === 53558, String(g.consumo_anual_kwh));
  comprueba('«145.000» igual', prepararSuministro(base({ consumo_anual_kwh: '145.000' })).consumo_anual_kwh === 145000);
  comprueba('un número normal no se toca', prepararSuministro(base({ consumo_anual_kwh: '5300' })).consumo_anual_kwh === 5300);
  comprueba('vacío es 0, no null: la columna es numérica',
    prepararSuministro(base({ consumo_anual_kwh: '' })).consumo_anual_kwh === 0);
}

titulo('Un campo vacío se manda como null, nunca como cadena vacía');
{
  const g = prepararSuministro(base({ comercializadora_actual: '', fecha_fin_contrato: '', penalizacion: '   ' }));
  comprueba('un texto vacío es null', g.comercializadora_actual === null);
  comprueba('una fecha vacía es null', g.fecha_fin_contrato === null);
  comprueba('solo espacios también es null', g.penalizacion === null);
  comprueba('un número vacío es null', g.coste_anual_estimado === null);
  comprueba('un checkbox sin marcar es false, no null', g.tiene_permanencia === false);
  comprueba('las potencias vacías son lista vacía, no null',
    Array.isArray(prepararSuministro(base({ potencias_kw: [] })).potencias_kw));
}

titulo('Los números se leen con coma o con punto');
{
  comprueba('«1.234,50 €» con coma decimal',
    prepararSuministro(base({ coste_anual_estimado: '2347,18' })).coste_anual_estimado === 2347.18);
  comprueba('los huecos de las potencias no se guardan',
    prepararSuministro(base({ potencias_kw: [4.6, null] })).potencias_kw.length === 1);
}

titulo('El preaviso se propone, no se impone');
{
  comprueba('30 días antes del 30/04/2027',
    preavisoSugerido({ fecha_fin_contrato: '2027-04-30', dias_preaviso: 30 }) === '2027-03-31');
  comprueba('sin fin de contrato no propone nada',
    preavisoSugerido({ fecha_fin_contrato: '', dias_preaviso: 30 }) === null);
  comprueba('sin días de preaviso tampoco',
    preavisoSugerido({ fecha_fin_contrato: '2027-04-30', dias_preaviso: 0 }) === null);
  comprueba('si ya coincide, no molesta',
    preavisoSugerido({ fecha_fin_contrato: '2027-04-30', dias_preaviso: 30, fecha_limite_preaviso: '2027-03-31' }) === null);
  comprueba('si alguien puso otra a mano, se propone y ya decidirá',
    preavisoSugerido({ fecha_fin_contrato: '2027-04-30', dias_preaviso: 30, fecha_limite_preaviso: '2027-02-01' }) === '2027-03-31');
}

// ── Cargar y contar ────────────────────────────────────────────────────────
titulo('Cargar un suministro que ya existe');
{
  const v = valoresDesde({
    cups: 'ES0021000000123456AB', tarifa_acceso: '3.0TD', potencias_kw: [10, 20, 30, 40, 50, 60],
    tiene_permanencia: true, consumo_anual_kwh: 145000,
    fecha_fin_contrato: '2027-04-30T00:00:00.000Z', comercializadora_actual: null,
  });
  comprueba('la fecha llega recortada a día', v.fecha_fin_contrato === '2027-04-30');
  comprueba('un null se convierte en campo vacío', v.comercializadora_actual === '');
  comprueba('el checkbox llega como booleano', v.tiene_permanencia === true);
  comprueba('las potencias se ajustan a la tarifa', v.potencias_kw.length === 6);
  comprueba('un número llega como texto para poder editarlo', v.consumo_anual_kwh === '145000');
  comprueba('cargar y volver a guardar no cambia el consumo',
    prepararSuministro(v).consumo_anual_kwh === 145000);
  comprueba('un suministro nuevo (null) da el formulario vacío',
    valoresDesde(null).cups === '');
}

titulo('Se ve cuánto falta de cada bloque');
{
  const c = completitudPorBloque(base());
  comprueba('sale un contador por bloque', c.length === BLOQUES_SUMINISTRO.length);
  const ident = c.find((x) => x.bloque === 'identificacion');
  comprueba('con solo el CUPS, 1 de 3', ident.rellenos === 1 && ident.total === 3);
  const gest = c.find((x) => x.bloque === 'gestion');
  comprueba('con el responsable puesto, 1 de 2', gest.rellenos === 1);
  comprueba('las potencias cuentan como relleno',
    c.find((x) => x.bloque === 'tecnico').rellenos === 3);
  comprueba('un formulario vacío no cuenta nada',
    completitudPorBloque(valoresDesde(null)).every((x) => x.rellenos === 0));
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} correctos, ${fallos} fallos\n`);
process.exit(fallos === 0 ? 0 : 1);
