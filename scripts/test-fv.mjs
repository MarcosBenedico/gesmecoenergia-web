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
console.log(fallos ? `\n${fallos} PRUEBA(S) FALLIDA(S)` : '\nTODAS LAS PRUEBAS PASAN ✓');
process.exit(fallos ? 1 : 0);
