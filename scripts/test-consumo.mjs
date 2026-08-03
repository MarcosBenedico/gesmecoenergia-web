/**
 * Tests de leerConsumo: cómo se lee un consumo escrito a mano.
 *
 * El caso que motiva todo esto: alguien teclea «53.558» (cincuenta y tres mil
 * quinientos cincuenta y ocho) y parseFloat lo guarda como 53,558 kWh. Con eso
 * la calculadora FV, la comparativa y la comisión estimada salen mil veces mal.
 */
const { leerConsumo, CONSUMO_MINIMO_CREIBLE } = await import('../src/lib/luz.ts');

let ok = 0, fallos = 0;
const t = (nombre, cond) => {
  if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fallos++; console.log(`  ✗ ${nombre}`); }
};
const bloque = (n) => console.log(`\n── ${n} ──`);

bloque('Separador de miles: el caso que rompía la cartera');
for (const [texto, esperado] of [
  ['53.558', 53558],
  ['19.565', 19565],
  ['202.099', 202099],
  ['1.775.360', 1775360],
  ['6.092', 6092],
  ['1.041', 1041],
]) {
  const r = leerConsumo(texto);
  t(`${texto} -> ${esperado}`, r.kwh === esperado && !r.sospechoso);
}

bloque('Con coma no hay ambigüedad: la coma manda');
t('53.558,4 -> 53558', leerConsumo('53.558,4').kwh === 53558);
t('1234,56 -> 1235 (redondea)', leerConsumo('1234,56').kwh === 1235);
t('12.345,67 -> 12346', leerConsumo('12.345,67').kwh === 12346);

bloque('Números planos, que son la mayoría');
t('53558', leerConsumo('53558').kwh === 53558 && !leerConsumo('53558').sospechoso);
t('1775360', leerConsumo('1775360').kwh === 1775360);
t('numero nativo', leerConsumo(242670).kwh === 242670);

bloque('Lo ambiguo se avisa, NO se adivina');
{
  const r = leerConsumo('3.42');
  t('3.42 marca sospechoso', r.sospechoso);
  t('3.42 explica por qué', !!r.motivo && r.motivo.includes('3,42'));
  t('3.42 no inventa el valor', r.kwh === 3);
}
{
  const r = leerConsumo('63.30605');
  t('63.30605 marca sospechoso', r.sospechoso);
  t('63.30605 pide mirar la factura', !!r.motivo && r.motivo.includes('factura'));
}

bloque('Un suministro real no baja del mínimo creíble');
for (const bajo of ['2', '21', '29', '447']) {
  const r = leerConsumo(bajo);
  t(`${bajo} avisa`, r.sospechoso && r.kwh === Number(bajo));
}
t('el mínimo está en 500', CONSUMO_MINIMO_CREIBLE === 500);
t('500 ya no avisa', !leerConsumo('500').sospechoso);
t('843 avisa (por debajo de 500 no, pero 843 sí pasa)', !leerConsumo('843').sospechoso);

bloque('Vacío es vacío, no es un error');
for (const nada of ['', '   ', null, undefined]) {
  const r = leerConsumo(nada);
  t(`${JSON.stringify(nada)} -> 0 sin aviso`, r.kwh === 0 && !r.sospechoso);
}

bloque('Basura alrededor del número');
t('«53.558 kWh»', leerConsumo('53.558 kWh').kwh === 53558);
t('«53558 kwh/año»', leerConsumo('53558 kwh').kwh === 53558);
t('espacios', leerConsumo('  242670  ').kwh === 242670);

bloque('Negativos: no existen');
t('-500 se corta a 0 y avisa', leerConsumo('-500').kwh === 0 && leerConsumo('-500').sospechoso);

bloque('Los seis CUPS que entraron mal la semana pasada');
for (const [texto, esperado] of [
  ['53.558', 53558],   // MARIA JOSE BLANC PUEO
  ['19.565', 19565],   // PADEL BAP BINEFAR
  ['6.092', 6092],     // AGROPECUARIA POU SALAT
  ['1.041', 1041],     // AGROPECUARIA POU SALAT (2)
  ['3.004', 3004],     // MARIA FANTOVA SEBASTIA
]) {
  t(`${texto} se recupera`, leerConsumo(texto).kwh === esperado && !leerConsumo(texto).sospechoso);
}
t('3.42 de JOSE MARIA FANTOVA sigue necesitando la factura', leerConsumo('3.42').sospechoso);


console.log(`\n${ok} pasan, ${fallos} fallan`);
process.exit(fallos ? 1 : 0);
