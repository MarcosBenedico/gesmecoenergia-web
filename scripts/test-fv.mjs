// Pruebas de la Calculadora FV — ejecutar con: node scripts/test-fv.mjs
// Replica exacta de las fórmulas de src/lib/fv.ts (sin IVA como base, margen sobre coste base).
const LIMITE_KW = 10;
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
function calcularFV(e) {
  const aplica = e.potencia_kw > LIMITE_KW;
  const ingenieria = aplica ? e.coste_ingenieria : 0;
  const costeBase = e.presupuesto_instalador + ingenieria + (e.otros_costes || 0);
  const margenImporte = costeBase * (e.margen_pct / 100);
  const precioSinIva = costeBase + margenImporte;
  const ivaImporte = precioSinIva * (e.iva_pct / 100);
  return { coste_base: r2(costeBase), precio_sin_iva: r2(precioSinIva), iva_importe: r2(ivaImporte), precio_con_iva: r2(precioSinIva + ivaImporte) };
}

const casos = [
  { nombre: 'Caso 1 · 8 kW, 10.000 €, margen 25 %', e: { potencia_kw: 8, presupuesto_instalador: 10000, coste_ingenieria: 1800, margen_pct: 25, iva_pct: 21 }, esperado: { precio_sin_iva: 12500 } },
  { nombre: 'Caso 2 · 10 kW justos (sin ingeniería)', e: { potencia_kw: 10, presupuesto_instalador: 10000, coste_ingenieria: 1800, margen_pct: 25, iva_pct: 21 }, esperado: { precio_sin_iva: 12500 } },
  { nombre: 'Caso 3 · 10,01 kW (con ingeniería, 20 %)', e: { potencia_kw: 10.01, presupuesto_instalador: 10000, coste_ingenieria: 1800, margen_pct: 20, iva_pct: 21 }, esperado: { precio_sin_iva: 14160 } },
  { nombre: 'Caso 4 · 15 kW, margen manual 15 %', e: { potencia_kw: 15, presupuesto_instalador: 10000, coste_ingenieria: 1800, margen_pct: 15, iva_pct: 21 }, esperado: { precio_sin_iva: 13570 } },
  { nombre: 'Caso 5 · 15 kW, 20 %, IVA 21 %', e: { potencia_kw: 15, presupuesto_instalador: 10000, coste_ingenieria: 1800, margen_pct: 20, iva_pct: 21 }, esperado: { precio_sin_iva: 14160, iva_importe: 2973.6, precio_con_iva: 17133.6 } },
];

let fallos = 0;
for (const c of casos) {
  const r = calcularFV(c.e);
  const errores = Object.entries(c.esperado).filter(([k, v]) => r[k] !== v);
  if (errores.length) {
    fallos++;
    console.log(`✗ ${c.nombre}`);
    errores.forEach(([k, v]) => console.log(`    ${k}: esperado ${v}, obtenido ${r[k]}`));
  } else {
    console.log(`✓ ${c.nombre} → sin IVA ${r.precio_sin_iva} € · con IVA ${r.precio_con_iva} €`);
  }
}
// ── PRESUPUESTADOR: partidas con precios reales de Óscar ──
const precioAjustado = (p) => p.precio * (1 + (p.pct || 0) / 100) + (p.fijo || 0);
const costeDirecto = (ps) => r2(ps.filter((p) => p.incluido !== false).reduce((s, p) => s + p.cant * precioAjustado(p), 0));

const casosPartidas = [
  { nombre: 'Vivienda 16 paneles (Perlag vivienda)', esperado: 8082, partidas: [
    { cant: 16, precio: 91 }, { cant: 16, precio: 41 }, { cant: 1, precio: 825 },
    { cant: 1, precio: 2480 }, { cant: 1, precio: 1350 }, { cant: 1, precio: 595 }, { cant: 1, precio: 720 }] },
  { nombre: '30 paneles SIN línea opcional (Animalate)', esperado: 11740, partidas: [
    { cant: 30, precio: 91 }, { cant: 30, precio: 41 }, { cant: 1, precio: 1980 }, { cant: 1, precio: 2550 },
    { cant: 1, precio: 480 }, { cant: 1, precio: 620 }, { cant: 1, precio: 1260, incluido: false }, { cant: 1, precio: 2150 }] },
  { nombre: '30 paneles CON línea opcional', esperado: 13000, partidas: [
    { cant: 30, precio: 91 }, { cant: 30, precio: 41 }, { cant: 1, precio: 1980 }, { cant: 1, precio: 2550 },
    { cant: 1, precio: 480 }, { cant: 1, precio: 620 }, { cant: 1, precio: 1260 }, { cant: 1, precio: 2150 }] },
  { nombre: '32 paneles (José Antonio)', esperado: 18579, partidas: [
    { cant: 32, precio: 91 }, { cant: 32, precio: 41 }, { cant: 1, precio: 3920 }, { cant: 1, precio: 5080 },
    { cant: 1, precio: 515 }, { cant: 1, precio: 620 }, { cant: 1, precio: 4220 }] },
  { nombre: '50 paneles nave (Perlag agrícola)', esperado: 22595, partidas: [
    { cant: 50, precio: 91 }, { cant: 50, precio: 41 }, { cant: 1, precio: 3920 }, { cant: 1, precio: 5080 },
    { cant: 1, precio: 515 }, { cant: 1, precio: 620 }, { cant: 1, precio: 5860 }] },
];
for (const c of casosPartidas) {
  const cd = costeDirecto(c.partidas);
  if (cd === c.esperado) console.log(`✓ ${c.nombre} → coste directo ${cd} €`);
  else { fallos++; console.log(`✗ ${c.nombre}: esperado ${c.esperado}, obtenido ${cd}`); }
}

// Nº de paneles: ceil(kWp*1000/515)
const nPan = (kwp) => Math.ceil((kwp * 1000) / 515);
if (nPan(8) === 16 && nPan(15.45) === 30 && nPan(16.48) === 32 && nPan(25.75) === 50) console.log('✓ Nº de paneles ⌈kWp×1000/515⌉ (16/30/32/50)');
else { fallos++; console.log('✗ Nº de paneles incorrecto'); }

// Curva de carga: reparto por intervalo
const rep = (cons, gen) => ({ auto: Math.min(cons, gen), exc: Math.max(gen - cons, 0), red: Math.max(cons - gen, 0) });
const a = rep(2, 5), b = rep(5, 2), c0 = rep(3, 3);
if (a.auto === 2 && a.exc === 3 && a.red === 0 && b.auto === 2 && b.exc === 0 && b.red === 3 && c0.auto === 3 && c0.exc === 0 && c0.red === 0)
  console.log('✓ Curva: autoconsumo=min, excedente=max(g-c,0), red=max(c-g,0)');
else { fallos++; console.log('✗ Reparto de curva incorrecto'); }

console.log(fallos ? `\n${fallos} FALLO(S) EN TOTAL` : '\nPRESUPUESTADOR: TODAS LAS PRUEBAS PASAN ✓');
process.exit(fallos ? 1 : 0);
