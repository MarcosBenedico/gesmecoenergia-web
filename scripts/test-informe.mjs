/**
 * Tests del ESTUDIO COMPLETO y del INFORME EN PDF.
 *
 *   npm run test:informe
 *
 * Lo que se protege aquí es que el informe NO SE CONTRADIGA. Un PDF que dice
 * arriba «hay que subir potencia» y abajo «las potencias están bien
 * ajustadas» no es un informe con un fallo: es un informe que no se puede
 * enseñar, porque el cliente deja de creerse también lo que sí está bien.
 *
 * Las dos contradicciones que ya salieron impresas están abajo con su nombre.
 */
import { construirEstudio, recomendacionesTecnicas } from '../src/lib/estudio-completo.ts';
import { construirInformePdf, nombreInforme } from '../src/lib/estudio-pdf.ts';
import { evaluarEscenarios, recomendar, alertasDeLaComparativa } from '../src/lib/escenarios.ts';

let ok = 0, fallos = 0;
const comprueba = (n, c, d = '') => {
  if (c) { ok++; console.log(`  ✓ ${n}`); }
  else { fallos++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`); }
};
const titulo = (t) => console.log(`\n${t}`);

const HOY = '2026-08-18';

/** Una lectura de plantilla de 3.0TD ya interpretada. */
const lectura = (o = {}) => {
  const nE = 6, nP = 6;
  const meses = o.meses ?? Array.from({ length: 12 }, (_, i) => ({
    mes: `M${i + 1}`,
    dias: 30,
    energia: [4000, 3500, 3000, 2500, 2000, 5000],
    potenciaContratada: new Array(nP).fill(40),
    maximetro: o.maximetro ?? new Array(nP).fill(28),
    reactiva: o.reactiva ?? 0,
    excedentes: o.excedentes ?? 0,
  }));
  const dias = meses.reduce((s, m) => s + m.dias, 0);
  const factor = dias ? 365 / dias : 0;
  const porPeriodo = new Array(nE).fill(0);
  for (const m of meses) m.energia.forEach((v, i) => { porPeriodo[i] += v; });
  const anualPorPeriodo = porPeriodo.map((v) => v * factor);
  const anual = anualPorPeriodo.reduce((s, v) => s + v, 0);
  return {
    tarifa: '3.0',
    suministro: { titular: 'GRANJA LA LITERA SL', cups: 'ES0031', direccion: 'Camino de la balsa', comercializadora: 'IBERDROLA' },
    meses,
    diasTotales: dias,
    consumoAnualPorPeriodo: anualPorPeriodo,
    consumoAnual: anual,
    consumosMes: anualPorPeriodo.map((v) => v / 12),
    potencias: o.potencias ?? new Array(nP).fill(40),
    maximetros: o.maximetro ?? new Array(nP).fill(28),
    reactivaAnual: (o.reactiva ?? 0) * 12 * factor,
    excedentesAnual: (o.excedentes ?? 0) * 12 * factor,
    periodosEnExceso: [],
    preciosEnergia: [0.18, 0.16, 0.14, 0.12, 0.11, 0.10],
    preciosPotencia: [0.10, 0.08, 0.05, 0.04, 0.03, 0.02],
    extrapolado: false,
    utilizable: true,
    reparos: [],
    ...o.sobre,
  };
};

const hip = { fechaPrecios: HOY, margenEurKwh: 0.005, incluyeImpuestos: false, ajustesManuales: [], bloqueada: false };
const escenariosDe = (l) => evaluarEscenarios({
  tarifa: l.tarifa, consumosMes: l.consumosMes, potencias: l.potencias,
  preciosEnergiaActual: l.preciosEnergia, preciosPotenciaActual: l.preciosPotencia,
}, [
  { id: 'a', tipo: 'fijo', titulo: 'Alcanzia', preciosEnergia: [0.14, 0.13, 0.12, 0.11, 0.10, 0.09], preciosPotencia: l.preciosPotencia, permanenciaMeses: 12, hipotesis: hip },
  { id: 'b', tipo: 'fijo', titulo: 'Nufri', preciosEnergia: [0.16, 0.15, 0.13, 0.12, 0.11, 0.10], preciosPotencia: l.preciosPotencia, permanenciaMeses: 12, hipotesis: hip },
], HOY);

titulo('El estudio se monta con lo que hay');
{
  const l = lectura();
  const e = construirEstudio(l);

  comprueba('sale un estudio', !!e);
  comprueba('con los 12 meses', e.meses.length === 12);
  comprueba('cada mes lleva su coste de energía y de potencia',
    e.meses[0].costeEnergia > 0 && e.meses[0].costePotencia > 0);
  comprueba('el coste del mes es la suma de los dos',
    Math.abs(e.meses[0].costeTotal - (e.meses[0].costeEnergia + e.meses[0].costePotencia)) < 0.02);

  // El término de potencia se paga por DÍAS, así que un mes de 28 tiene que
  // costar menos que uno de 31 con la misma potencia contratada.
  const corto = construirEstudio(lectura({
    meses: [
      { mes: 'Feb', dias: 28, energia: [1000, 0, 0, 0, 0, 0], potenciaContratada: new Array(6).fill(40), maximetro: new Array(6).fill(20), reactiva: 0, excedentes: 0 },
      { mes: 'Mar', dias: 31, energia: [1000, 0, 0, 0, 0, 0], potenciaContratada: new Array(6).fill(40), maximetro: new Array(6).fill(20), reactiva: 0, excedentes: 0 },
    ],
  }));
  comprueba('el término de potencia va por días facturados, no por meses',
    corto.meses[0].costePotencia < corto.meses[1].costePotencia,
    `${corto.meses[0].costePotencia} vs ${corto.meses[1].costePotencia}`);

  comprueba('el reparto por periodo suma el 100 %',
    Math.abs(e.reparto.reduce((s, p) => s + p.porcentaje, 0) - 100) < 0.1);
  comprueba('y cada periodo lleva su precio y su coste',
    e.reparto[0].precio === 0.18 && e.reparto[0].costeAnual > 0);

  comprueba('encuentra el mes de más y el de menos consumo',
    !!e.mesPico && !!e.mesValle);
  comprueba('sin tarifa no hay estudio que montar',
    construirEstudio({ ...l, tarifa: null }) === null);
}

titulo('Potencias: subir, bajar o dejarlo');
{
  // Contratados 40 kW y el contador nunca pasa de 28: sobran kW.
  const sobra = construirEstudio(lectura({ maximetro: new Array(6).fill(28) }));
  comprueba('con maxímetro hay análisis de potencia', !!sobra.potencia);
  comprueba('y sale ahorro por ajustar', sobra.ahorroPotencia > 0, String(sobra.ahorroPotencia));
  const frasesSobra = recomendacionesTecnicas(sobra);
  comprueba('la recomendación dice ajustar y cuánto',
    frasesSobra.some((f) => /Ajustar potencia/.test(f) && /€ al año/.test(f)),
    JSON.stringify(frasesSobra));

  // El contador se pasa de lo contratado: aquí toca SUBIR.
  const exceso = construirEstudio(lectura({ maximetro: new Array(6).fill(46) }));
  const frasesExceso = recomendacionesTecnicas(exceso);
  comprueba('con exceso, la primera frase es SUBIR potencia',
    /Subir potencia/.test(frasesExceso[0]), JSON.stringify(frasesExceso));
  comprueba('y enseña lo medido contra lo contratado',
    /46 kW/.test(frasesExceso[0]) && /40 kW/.test(frasesExceso[0]), frasesExceso[0]);

  // ESTA CONTRADICCIÓN SALIÓ IMPRESA: la tabla decía EN EXCESO en los dos
  // periodos y debajo ponía «las potencias están bien ajustadas».
  comprueba('estar en exceso NO se cuenta como ahorro por ajustar',
    exceso.ahorroPotencia === 0, String(exceso.ahorroPotencia));
  comprueba('y ninguna frase dice que esté bien ajustado',
    !frasesExceso.some((f) => /bien ajustad/.test(f)));

  const sinMax = construirEstudio(lectura({ maximetro: new Array(6).fill(0) }));
  comprueba('sin maxímetro no se inventa un análisis de potencia', sinMax.potencia === null);
  comprueba('y no se promete ningún ahorro', sinMax.ahorroPotencia === 0);
}

titulo('Reactiva y excedentes: solo si vienen en la factura');
{
  const sin = construirEstudio(lectura());
  comprueba('sin reactiva no hay diagnóstico', sin.reactiva === null);
  comprueba('sin excedentes, cero', sin.excedentesAnual === 0);
  comprueba('y no se inventan frases',
    !recomendacionesTecnicas(sin).some((f) => /reactiva|[Vv]ierte/.test(f)));

  // tan φ alto: 8.000 kVArh sobre 20.000 kWh mensuales = 0,4
  const conReactiva = construirEstudio(lectura({ reactiva: 8000 }));
  comprueba('con reactiva se diagnostica', !!conReactiva.reactiva);
  comprueba('y se detecta que penaliza', conReactiva.reactiva.penaliza,
    String(conReactiva.reactiva.tan_phi));
  comprueba('la recomendación menciona la batería de condensadores',
    recomendacionesTecnicas(conReactiva).some((f) => /condensadores/.test(f)));

  const bajaReactiva = construirEstudio(lectura({ reactiva: 500 }));
  comprueba('con tan φ bajo NO se dice que penalice', !bajaReactiva.reactiva.penaliza);
  comprueba('y no se mete en las recomendaciones',
    !recomendacionesTecnicas(bajaReactiva).some((f) => /condensadores/.test(f)));

  const conExcedentes = construirEstudio(lectura({ excedentes: 1500 }));
  comprueba('los excedentes se anualizan', conExcedentes.excedentesAnual > 17000,
    String(conExcedentes.excedentesAnual));
  comprueba('y salen en las recomendaciones',
    recomendacionesTecnicas(conExcedentes).some((f) => /[Vv]ierte/.test(f)));
}

titulo('La estacionalidad se dice cuando es de verdad');
{
  const meses = Array.from({ length: 12 }, (_, i) => ({
    mes: `M${i + 1}`, dias: 30,
    energia: [i === 7 ? 20000 : 2000, 0, 0, 0, 0, 0],
    potenciaContratada: new Array(6).fill(40),
    maximetro: new Array(6).fill(28),
    reactiva: 0, excedentes: 0,
  }));
  const e = construirEstudio(lectura({ meses }));
  const frases = recomendacionesTecnicas(e);
  comprueba('un mes 10 veces mayor se señala',
    frases.some((f) => /muy estacional/.test(f)), JSON.stringify(frases));
  comprueba('nombrando los dos meses', frases.some((f) => /M8/.test(f)));

  const plano = construirEstudio(lectura());
  comprueba('con consumo plano no se dice nada de estacionalidad',
    !recomendacionesTecnicas(plano).some((f) => /estacional/.test(f)));
}

titulo('El PDF se dibuja entero sin reventar');
{
  const l = lectura({ reactiva: 8000, excedentes: 1500, maximetro: new Array(6).fill(28) });
  const e = construirEstudio(l);
  const esc = escenariosDe(l);
  const rec = recomendar(esc);

  const doc = await construirInformePdf({
    lectura: l, estudio: e, escenarios: esc, recomendacion: rec,
    alertas: alertasDeLaComparativa(esc),
    cliente: 'GRANJA LA LITERA SL', responsable: 'Marcos', fecha: HOY,
  });
  comprueba('sale un documento con páginas', doc.getNumberOfPages() >= 1);
  comprueba('y no se va de largo con 12 meses y todo relleno',
    doc.getNumberOfPages() <= 4, String(doc.getNumberOfPages()));

  // Sin maxímetro, sin reactiva y sin excedentes: los apartados no se pintan,
  // así que tiene que salir MÁS CORTO. Un informe con apartados vacíos es más
  // largo y peor.
  const pelado = lectura({ maximetro: new Array(6).fill(0) });
  const docPelado = await construirInformePdf({
    lectura: pelado, estudio: construirEstudio(pelado),
    escenarios: escenariosDe(pelado), recomendacion: recomendar(escenariosDe(pelado)),
    alertas: [], cliente: 'X', responsable: null, fecha: HOY,
  });
  comprueba('sin datos técnicos el informe es más corto o igual',
    docPelado.getNumberOfPages() <= doc.getNumberOfPages());

  // Un solo mes y nada más: el caso de la factura suelta.
  const minimo = lectura({
    meses: [{ mes: 'Julio', dias: 30, energia: [1000, 0, 0, 0, 0, 0], potenciaContratada: new Array(6).fill(40), maximetro: new Array(6).fill(0), reactiva: 0, excedentes: 0 }],
  });
  const docMinimo = await construirInformePdf({
    lectura: { ...minimo, extrapolado: true },
    estudio: construirEstudio(minimo),
    escenarios: [], recomendacion: { elegido: null, porque: 'Nada mejora', descartadoPorRiesgo: null },
    alertas: [], cliente: null, responsable: null, fecha: HOY,
  });
  comprueba('con un solo mes y sin alternativas tampoco revienta',
    docMinimo.getNumberOfPages() >= 1);
}

titulo('El nombre del archivo se puede archivar');
{
  comprueba('lleva cliente y fecha',
    nombreInforme('GRANJA LA LITERA SL', HOY) === 'Estudio-GRANJA-LA-LITERA-SL-2026-08-18.pdf',
    nombreInforme('GRANJA LA LITERA SL', HOY));
  comprueba('quita acentos y signos',
    nombreInforme('Explotación Ñ & Cía, S.L.', HOY).startsWith('Estudio-Explotacion-N-Cia-S-L'),
    nombreInforme('Explotación Ñ & Cía, S.L.', HOY));
  comprueba('sin nombre no deja el archivo sin nombre',
    nombreInforme('', HOY) === 'Estudio-cliente-2026-08-18.pdf');
  comprueba('un nombre kilométrico se recorta',
    nombreInforme('A'.repeat(200), HOY).length < 70);
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} bien, ${fallos} mal\n`);
process.exit(fallos === 0 ? 0 : 1);
