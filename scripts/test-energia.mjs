/**
 * Tests del VOCABULARIO de gestión energética.
 *
 *   npm run test:energia
 *
 * Lo que se protege aquí es el suelo sobre el que se va a construir todo lo
 * demás. Tres cosas:
 *
 *   · Que la conversión a kWh NO adivine. Convertir mal es peor que no
 *     convertir: un total de energía inflado no lo detecta nadie, porque no hay
 *     con qué compararlo.
 *   · Que la cobertura cuente bien, sin contar dos veces lo que se solapa y sin
 *     tapar un hueco. Con cobertura parcial no se da una cifra anual.
 *   · Que el estado ISO devuelva frases accionables y NUNCA un porcentaje.
 */
import {
  FASES, FASE, FASES_ABIERTAS,
  VECTORES, VECTOR, MAGNITUDES, MAGNITUD,
  aKwh, cobertura, DIAS_MINIMOS_ANUAL,
  NORMAS, REQUISITOS, REQUISITO, requisitosDe,
  estadoISO, loQueFaltaISO, AVISO_NO_CERTIFICA,
} from '../src/lib/energia.ts';

let ok = 0, fallos = 0;
const comprueba = (n, c, d = '') => {
  if (c) { ok++; console.log(`  ✓ ${n}`); }
  else { fallos++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`); }
};
const titulo = (t) => console.log(`\n${t}`);
const cerca = (a, b, tol = 0.01) => Math.abs(a - b) < tol;

// ── Fases ──────────────────────────────────────────────────────────────────
titulo('Las fases del expediente son un vocabulario cerrado');
{
  comprueba('no hay ids repetidos', new Set(FASES.map((f) => f.id)).size === FASES.length);
  comprueba('todas dicen qué hace falta para salir de ellas',
    FASES.every((f) => f.condicion.length > 15));
  comprueba('el recorrido avanza sin saltos ni empates',
    FASES.filter((f) => f.avance >= 0).map((f) => f.avance).join(',') === '0,1,2,3,4,5');
  comprueba('cerrado y aparcado están fuera del recorrido',
    FASE.cerrado.avance === -1 && FASE.aparcado.avance === -1);
  comprueba('las abiertas son las seis vivas', FASES_ABIERTAS.length === 6);
  comprueba('el diagnóstico va primero', FASES[0].id === 'diagnostico');
  // Si esto falla es que alguien ha copiado etapas.ts, que es justo lo que no
  // hay que hacer: son dos ejes distintos.
  comprueba('la verificación existe y va antes del seguimiento',
    FASE.verificacion.avance < FASE.seguimiento.avance);
}

// ── Vectores ───────────────────────────────────────────────────────────────
titulo('Los vectores y sus factores');
{
  comprueba('están los que hay en la comarca',
    ['electricidad', 'gasoleo', 'propano', 'biomasa'].every((v) => !!VECTOR[v]));
  comprueba('la electricidad no lleva factor: ya viene en kWh',
    VECTOR.electricidad.kwhPorUnidad === null);
  comprueba('el gasóleo se mide en litros', VECTOR.gasoleo.unidadHabitual === 'l');
  comprueba('el propano en kilos', VECTOR.propano.unidadHabitual === 'kg');
  comprueba('todos tienen unidad habitual', VECTORES.every((v) => !!v.unidadHabitual));
}

titulo('Convertir a kWh: nunca adivinar');
{
  const luz = aKwh(1000, 'kWh', 'electricidad');
  comprueba('kWh se queda igual', luz.kwh === 1000 && luz.factor === 1);
  comprueba('...y sin aviso: no se ha aplicado ningún factor', luz.aviso === null);

  const mwh = aKwh(2, 'MWh', 'electricidad');
  comprueba('MWh pasa a kWh', mwh.kwh === 2000);

  const gas = aKwh(1000, 'l', 'gasoleo');
  comprueba('1.000 l de gasóleo ≈ 9.980 kWh', cerca(gas.kwh, 9980, 1), String(gas.kwh));
  comprueba('devuelve el factor usado, para poder congelarlo', gas.factor === 9.98);
  comprueba('AVISA SIEMPRE de que el factor es de referencia',
    !!gas.aviso && /referencia/.test(gas.aviso));

  // Lo importante: la unidad equivocada NO se convierte a ojo.
  const malo = aKwh(1000, 'kg', 'gasoleo');
  comprueba('gasóleo en kg no se convierte', malo.kwh === null);
  comprueba('...y explica qué se esperaba', /litros|l»|\bl\b/i.test(malo.aviso || '') || /esperaba/.test(malo.aviso || ''));

  const sinFactor = aKwh(100, 'toneladas', 'otro');
  comprueba('un vector sin factor no inventa nada', sinFactor.kwh === null);

  comprueba('un valor que no es número no revienta', aKwh(NaN, 'kWh', 'electricidad').kwh === null);

  // El factor se puede revisar desde luz_config sin tocar código.
  const revisado = aKwh(100, 'l', 'gasoleo', { gasoleo: 10 });
  comprueba('un factor revisado manda sobre el de referencia', revisado.kwh === 1000);
}

// ── Magnitudes ─────────────────────────────────────────────────────────────
titulo('Las magnitudes están separadas a propósito');
{
  comprueba('el coste NO es energía', MAGNITUD.coste.esEnergia === false);
  comprueba('la reactiva NO es energía consumida', MAGNITUD.reactiva.esEnergia === false);
  comprueba('la potencia máxima NO es energía', MAGNITUD.potencia_max.esEnergia === false);
  comprueba('el consumo y el autoconsumo SÍ suman energía',
    MAGNITUD.consumo.esEnergia && MAGNITUD.autoconsumo.esEnergia);
  // Si producción sumara, se contaría dos veces lo autoconsumido.
  comprueba('la producción NO suma: ya está en autoconsumo + excedentes',
    MAGNITUD.produccion.esEnergia === false);
  comprueba('todas explican qué son exactamente',
    MAGNITUDES.every((m) => m.que_es.length > 25));
  comprueba('la variable de actividad no tiene unidad fija',
    MAGNITUD.variable_actividad.unidadEsperada === null);
}

// ── Cobertura ──────────────────────────────────────────────────────────────
titulo('Cobertura: contar los días que de verdad hay');
{
  const anio = (ms) => ms.map(([a, b]) => ({ periodo_inicio: a, periodo_fin: b }));

  // Doce meses seguidos y completos.
  const completo = anio([
    ['2025-01-01', '2025-01-31'], ['2025-02-01', '2025-02-28'], ['2025-03-01', '2025-03-31'],
    ['2025-04-01', '2025-04-30'], ['2025-05-01', '2025-05-31'], ['2025-06-01', '2025-06-30'],
    ['2025-07-01', '2025-07-31'], ['2025-08-01', '2025-08-31'], ['2025-09-01', '2025-09-30'],
    ['2025-10-01', '2025-10-31'], ['2025-11-01', '2025-11-30'], ['2025-12-01', '2025-12-31'],
  ]);
  const c = cobertura(completo, '2025-01-01', '2025-12-31');
  comprueba('un año completo son 365 días', c.diasCubiertos === 365, String(c.diasCubiertos));
  comprueba('...al 100 %', c.pct === 100);
  comprueba('...sin huecos', c.huecos.length === 0);
  comprueba('...y se puede anualizar', c.sePuedeAnualizar && c.motivo === null);

  // Falta un mes: el caso literal del PDF.
  const faltaJulio = completo.filter((m) => !m.periodo_inicio.startsWith('2025-07'));
  const f = cobertura(faltaJulio, '2025-01-01', '2025-12-31');
  comprueba('sin julio, la cobertura baja', f.diasCubiertos === 334, String(f.diasCubiertos));
  comprueba('el hueco sale con sus fechas',
    f.huecos.length === 1 && f.huecos[0].desde === '2025-07-01' && f.huecos[0].hasta === '2025-07-31');
  comprueba('el hueco dice cuántos días son', f.huecos[0].dias === 31);
  // 334 ≥ 300, así que sí se puede — pero el hueco se sigue viendo.
  comprueba('con 334 días todavía se puede anualizar', f.sePuedeAnualizar);

  // Medio año: NO se da cifra anual.
  const medio = completo.slice(0, 6);
  const m = cobertura(medio, '2025-01-01', '2025-12-31');
  comprueba('con medio año NO se anualiza', !m.sePuedeAnualizar);
  comprueba('...y se dice por qué, con los números',
    !!m.motivo && m.motivo.includes(String(DIAS_MINIMOS_ANUAL)));

  // SOLAPES: dos facturas que se pisan no cuentan doble.
  const solapadas = anio([['2025-01-01', '2025-01-31'], ['2025-01-15', '2025-02-15']]);
  const s = cobertura(solapadas, '2025-01-01', '2025-02-15');
  comprueba('un solape no cuenta dos veces', s.diasCubiertos === 46, String(s.diasCubiertos));
  comprueba('...y la cobertura no pasa del 100 %', s.pct <= 100);

  // Facturas que se tocan (31 → 1) no dejan hueco.
  const pegadas = anio([['2025-01-01', '2025-01-31'], ['2025-02-01', '2025-02-28']]);
  comprueba('facturas consecutivas no dejan hueco falso',
    cobertura(pegadas, '2025-01-01', '2025-02-28').huecos.length === 0);

  // Hueco al principio y al final.
  const enmedio = anio([['2025-06-01', '2025-06-30']]);
  const e = cobertura(enmedio, '2025-01-01', '2025-12-31');
  comprueba('sale el hueco de antes y el de después', e.huecos.length === 2);
  comprueba('el primero empieza el 1 de enero', e.huecos[0].desde === '2025-01-01');
  comprueba('el último acaba el 31 de diciembre', e.huecos[1].hasta === '2025-12-31');

  // Sin nada.
  const vacio = cobertura([], '2025-01-01', '2025-12-31');
  comprueba('sin medidas, cobertura cero', vacio.diasCubiertos === 0 && vacio.pct === 0);
  comprueba('...y el hueco es el año entero', vacio.huecos.length === 1 && vacio.huecos[0].dias === 365);
  comprueba('...y no se anualiza', !vacio.sePuedeAnualizar);

  // Datos fuera del intervalo pedido no cuentan.
  const fuera = anio([['2024-01-01', '2024-12-31']]);
  comprueba('lo de otro año no suma', cobertura(fuera, '2025-01-01', '2025-12-31').diasCubiertos === 0);

  // Una medida que entra a medias se recorta.
  const acaballo = anio([['2024-12-15', '2025-01-15']]);
  comprueba('una medida a caballo cuenta solo su parte',
    cobertura(acaballo, '2025-01-01', '2025-12-31').diasCubiertos === 15);
}

// ── Catálogo ISO ───────────────────────────────────────────────────────────
titulo('El catálogo ISO apunta a datos, no a formularios nuevos');
{
  comprueba('están las cuatro normas', NORMAS.length === 4);
  comprueba('todas explican para qué sirven', NORMAS.every((n) => n.para_que.length > 20));
  comprueba('las claves no se repiten',
    new Set(REQUISITOS.map((r) => r.clave)).size === REQUISITOS.length);
  comprueba('la clave lleva su norma delante',
    REQUISITOS.every((r) => r.clave.startsWith(`${r.norma}.`)));
  comprueba('todos dicen qué pide la norma en cristiano',
    REQUISITOS.every((r) => r.que_pide.length > 25));
  // LA CLAVE DE TODO: cada requisito vive en un registro que YA EXISTE.
  comprueba('todos apuntan a un tipo de registro real',
    REQUISITOS.every((r) => ['documento', 'medida', 'actuacion', 'linea_base', 'uso', 'tarea'].includes(r.donde)));
  comprueba('todos llevan a una pantalla', REQUISITOS.every((r) => !!r.destino));
  comprueba('cada norma tiene requisitos', NORMAS.every((n) => requisitosDe(n.id).length > 0));
  comprueba('la línea base está en 50006', REQUISITO['50006.linea_base'].norma === '50006');
  comprueba('el ahorro verificado está en 50015', REQUISITO['50015.resultado'].norma === '50015');
  // Es corto a propósito: una lista que nadie completa deja de mirarse.
  comprueba('el catálogo es corto y manejable', REQUISITOS.length <= 20, String(REQUISITOS.length));
}

titulo('El estado ISO da frases, nunca porcentajes');
{
  const nada = estadoISO([]);
  comprueba('sin evidencias, nada está listo', nada.every((e) => !e.listo));
  comprueba('cada una dice qué falta', nada.every((e) => e.siguiente.startsWith('Falta:')));

  const puesta = estadoISO([{ requisito: '50006.linea_base', estado: 'propuesta' }]);
  const lb = puesta.find((e) => e.requisito.clave === '50006.linea_base');
  comprueba('con evidencia sin revisar, no está listo', !lb.listo);
  comprueba('...y lo dice: falta que alguien la revise', /nadie la ha revisado/.test(lb.siguiente));

  const revisada = estadoISO([{ requisito: '50006.linea_base', estado: 'revisada' }]);
  comprueba('revisada por una persona sí está lista',
    revisada.find((e) => e.requisito.clave === '50006.linea_base').listo);

  // «Sustituir una evidencia deja pendiente su nueva revisión.»
  const caducada = estadoISO([
    { requisito: '50006.linea_base', estado: 'revisada' },
    { requisito: '50006.linea_base', estado: 'caducada' },
  ]);
  const cad = caducada.find((e) => e.requisito.clave === '50006.linea_base');
  comprueba('una evidencia sustituida vuelve a dejar el requisito pendiente', !cad.listo);
  comprueba('...y lo explica', /sustituy/.test(cad.siguiente));

  // Una rechazada no cuenta como evidencia.
  const rechazada = estadoISO([{ requisito: '50006.linea_base', estado: 'rechazada' }]);
  comprueba('una evidencia rechazada no vale',
    !rechazada.find((e) => e.requisito.clave === '50006.linea_base').listo);

  comprueba('se puede pedir solo una norma', estadoISO([], ['50015']).every((e) => e.requisito.norma === '50015'));

  const falta = loQueFaltaISO([{ requisito: '50006.linea_base', estado: 'revisada' }]);
  comprueba('«lo que falta» quita lo ya resuelto',
    !falta.some((e) => e.requisito.clave === '50006.linea_base'));
  comprueba('...y deja el resto', falta.length === REQUISITOS.length - 1);

  // Lo más importante de todo el archivo.
  comprueba('NO existe ninguna función que devuelva un porcentaje de cumplimiento',
    typeof estadoISO([]).pct === 'undefined');
  comprueba('el aviso de que esto no certifica está escrito y es claro',
    /no acredita cumplimiento/.test(AVISO_NO_CERTIFICA) && /certificaci/.test(AVISO_NO_CERTIFICA));
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} correctos, ${fallos} fallos\n`);
process.exit(fallos === 0 ? 0 : 1);
