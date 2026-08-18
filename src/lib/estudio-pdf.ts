/**
 * INFORME DE ESTUDIO ENERGÉTICO EN PDF.
 *
 * A4 VERTICAL, dibujado con jsPDF y no imprimiendo la pantalla. Es la misma
 * decisión que en `parte-pdf.ts` y por los mismos motivos: texto vectorial que
 * se puede seleccionar y buscar, control real de dónde cae cada cosa, y cada
 * bloque comprueba si cabe antes de empezar a pintarse — imprimiendo el
 * navegador, una tabla se parte por la mitad y el informe parece hecho a
 * prisa justo delante del cliente.
 *
 * QUÉ LLEVA Y EN QUÉ ORDEN, QUE ES LA MITAD DEL TRABAJO
 *
 *   1. Resumen en la primera página. Quien solo lea una hoja tiene que salir
 *      sabiendo cuánto paga, cuánto pagaría y qué le proponemos.
 *   2. Lo que paga HOY, desglosado: precios por periodo, potencias, y el coste
 *      partido en energía y potencia. Sin esto, el ahorro es una promesa.
 *   3. Mes a mes. Doce filas con días, consumo por periodo, maxímetro y coste.
 *      Es lo que demuestra que el año no está estimado a ojo.
 *   4. Potencias: contratada contra medida, y si toca subir, bajar o dejarlo.
 *   5. Reactiva y excedentes, cuando los hay.
 *   6. Las alternativas, con su riesgo y su permanencia.
 *   7. Hipótesis: de qué fecha son los precios y qué está estimado.
 *
 * LA REGLA DE FONDO: NO SE PINTA UN BLOQUE SIN DATOS.
 *
 * Un apartado «Energía reactiva» con guiones no informa de nada y hace el
 * informe más largo y peor. Si no hay reactiva en la factura, ese apartado no
 * existe — y si hace falta decir que falta, se dice en las hipótesis del final.
 */

import { TARIFA_INFO } from './tarifas-base.ts';
import type { EstudioCompleto } from './estudio-completo.ts';
import { recomendacionesTecnicas } from './estudio-completo.ts';
import type { LecturaPlantilla } from './plantilla-consumos.ts';
import type { EscenarioEvaluado, Recomendacion, Alerta } from './escenarios.ts';

export interface DatosInforme {
  lectura: LecturaPlantilla;
  estudio: EstudioCompleto;
  escenarios: EscenarioEvaluado[];
  recomendacion: Recomendacion;
  alertas: Alerta[];
  /** Nombre que sale en portada. Cae al titular de la plantilla. */
  cliente?: string | null;
  /** Quién lo firma. */
  responsable?: string | null;
  /** Fecha del informe, ISO. Se pasa para poder probarlo sin reloj. */
  fecha: string;
}

// ── Paleta ──────────────────────────────────────────────────────────────────
// Sobria a propósito: un informe con seis colores parece una presentación, y
// lo que tiene que parecer es un documento técnico que se puede archivar.
const AZUL: [number, number, number] = [11, 37, 69];
const TINTA: [number, number, number] = [26, 34, 46];
const GRIS: [number, number, number] = [110, 122, 138];
const GRIS_CLARO: [number, number, number] = [214, 221, 230];
const VERDE: [number, number, number] = [22, 128, 84];
const AMBAR: [number, number, number] = [176, 106, 16];
const BLANCO: [number, number, number] = [255, 255, 255];

const A4 = { ancho: 210, alto: 297 };
const M = 15;
const W = A4.ancho - M * 2;
const PIE = 18;

const eur = (n: number) => `${Math.round(n).toLocaleString('es-ES')} €`;
const eur2 = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const kwh = (n: number) => `${Math.round(n).toLocaleString('es-ES')} kWh`;
const num = (n: number, dec = 2) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const fechaLarga = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** jsPDF con helvetica no dibuja bien algunos signos; se normaliza lo justo. */
const limpiar = (t: unknown) => String(t ?? '')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-')
  .replace(/ /g, ' ');

/**
 * Dibuja el informe y devuelve el documento.
 *
 * Separado de la descarga a propósito, igual que en `parte-pdf.ts`: `save()`
 * solo existe en el navegador, y así el dibujo entero se puede ejecutar en
 * Node y comprobar que no revienta antes de hacerlo delante de un cliente.
 */
export async function construirInformePdf(d: DatosInforme) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  const { lectura, estudio, escenarios, recomendacion, alertas } = d;
  const info = TARIFA_INFO[estudio.tarifa];
  const cliente = d.cliente || lectura.suministro.titular || 'Cliente';

  let y = 0;
  let pagina = 1;

  // ── Utilidades ──
  const fuente = (estilo: 'normal' | 'bold' | 'italic', tam: number, color: [number, number, number] = TINTA) => {
    doc.setFont('helvetica', estilo);
    doc.setFontSize(tam);
    doc.setTextColor(...color);
  };
  const escribir = (t: string, x: number, yy: number, opts?: { align?: 'left' | 'right' | 'center' }) =>
    doc.text(limpiar(t), x, yy, opts);

  const parrafo = (t: string, x: number, yy: number, ancho: number, alto = 4.4): number => {
    const lineas = doc.splitTextToSize(limpiar(t), ancho) as string[];
    lineas.forEach((l, i) => doc.text(l, x, yy + i * alto));
    return lineas.length * alto;
  };

  const pie = () => {
    fuente('normal', 6.5, GRIS);
    escribir('Gesmeco Energía · Binéfar (Huesca) · www.gesmecoenergia.com', M, A4.alto - 9);
    escribir(String(pagina), A4.ancho - M, A4.alto - 9, { align: 'right' });
  };

  const cabecera = () => {
    doc.setFillColor(...AZUL);
    doc.rect(0, 0, A4.ancho, 8, 'F');
    fuente('bold', 7, BLANCO);
    escribir('ESTUDIO ENERGÉTICO', M, 5.3);
    fuente('normal', 7, [190, 202, 216]);
    escribir(`${cliente}  ·  ${fechaLarga(d.fecha)}`, A4.ancho - M, 5.3, { align: 'right' });
    y = 18;
  };

  const nuevaPagina = () => { pie(); doc.addPage(); pagina++; cabecera(); };
  const asegurar = (alto: number) => { if (y + alto > A4.alto - PIE) nuevaPagina(); };

  const titulo = (t: string) => {
    asegurar(16);
    y += 4;
    fuente('bold', 11.5, AZUL);
    escribir(t, M, y);
    y += 2.2;
    doc.setDrawColor(...AZUL);
    doc.setLineWidth(0.5);
    doc.line(M, y, M + W, y);
    y += 5.5;
  };

  const nota = (t: string) => {
    fuente('italic', 7.4, GRIS);
    const alto = parrafo(t, M, y, W, 3.8);
    y += alto + 2;
  };

  /** Tabla con cabecera oscura y filas alternas. */
  const tabla = (
    cabs: string[], filas: string[][], anchos: number[],
    alinear: ('left' | 'right')[] = []
  ) => {
    if (!filas.length) return;
    const altoFila = 5.2;

    const pintarCabecera = () => {
      doc.setFillColor(...AZUL);
      doc.rect(M, y, W, 5.4, 'F');
      fuente('bold', 6, BLANCO);
      let x = M + 1.6;
      cabs.forEach((c, i) => {
        const der = alinear[i] === 'right';
        escribir(c.toUpperCase(), der ? x + anchos[i] - 3.2 : x, y + 3.7,
          der ? { align: 'right' } : undefined);
        x += anchos[i];
      });
      y += 5.4;
    };

    asegurar(5.4 + altoFila * 2);
    pintarCabecera();

    filas.forEach((f, idx) => {
      // La fuente se fija ANTES de medir: `splitTextToSize` parte según el
      // tamaño activo, y midiendo con el de la cabecera las celdas se salían
      // de su columna. Es la misma cicatriz que `parte-pdf.ts`.
      fuente('normal', 6.8, TINTA);
      const trozos = f.map((celda, i) =>
        doc.splitTextToSize(limpiar(celda) || '-', anchos[i] - 3.2) as string[]);
      const lineas = Math.max(...trozos.map((t) => t.length));
      const alto = Math.max(altoFila, lineas * 3.4 + 1.8);

      if (y + alto > A4.alto - PIE) { nuevaPagina(); pintarCabecera(); }

      if (idx % 2 === 1) {
        doc.setFillColor(246, 248, 251);
        doc.rect(M, y, W, alto, 'F');
      }
      fuente('normal', 6.8, TINTA);
      let x = M + 1.6;
      trozos.forEach((t, i) => {
        const der = alinear[i] === 'right';
        t.forEach((linea, k) => {
          doc.text(linea, der ? x + anchos[i] - 3.2 : x, y + 3.6 + k * 3.4,
            der ? { align: 'right' } : undefined);
        });
        x += anchos[i];
      });
      y += alto;
    });

    doc.setDrawColor(...GRIS_CLARO);
    doc.setLineWidth(0.2);
    doc.line(M, y, M + W, y);
    y += 4;
  };

  // ═══════════════════ PORTADA ═══════════════════
  cabecera();

  fuente('bold', 22, AZUL);
  escribir('Estudio energético', M, y + 6);
  y += 14;
  fuente('normal', 12, TINTA);
  escribir(cliente, M, y);
  y += 7;

  fuente('normal', 8, GRIS);
  const ident = [
    lectura.suministro.cups ? `CUPS ${lectura.suministro.cups}` : null,
    lectura.suministro.direccion || null,
    `${info.nombre} · ${info.descripcion}`,
    lectura.suministro.comercializadora ? `Comercializadora actual: ${lectura.suministro.comercializadora}` : null,
  ].filter(Boolean) as string[];
  ident.forEach((t) => { y += parrafo(t, M, y, W, 4.2) + 0.6; });
  y += 4;

  // ── El resumen, en una caja que se lee sola ──
  const altoCaja = 34;
  asegurar(altoCaja + 4);
  doc.setFillColor(...AZUL);
  doc.roundedRect(M, y, W, altoCaja, 2, 2, 'F');

  const res = recomendacion.elegido;
  const cifras: [string, string, [number, number, number]][] = [
    ['PAGA HOY', eur(estudio.actual.total), BLANCO],
    ['PAGARÍA', res ? eur(res.costeAnual) : '—', BLANCO],
    ['AHORRO AL AÑO', res ? eur(res.ahorroAnual) : '—', [126, 231, 178]],
    ['SOBRE LO QUE PAGA', res ? `${res.ahorroPct.toFixed(1)} %` : '—', [126, 231, 178]],
  ];
  const anchoCol = W / cifras.length;
  cifras.forEach(([et, val, color], i) => {
    const cx = M + anchoCol * i + anchoCol / 2;
    fuente('normal', 6.2, [170, 186, 206]);
    escribir(et, cx, y + 9, { align: 'center' });
    fuente('bold', 15, color);
    escribir(val, cx, y + 20, { align: 'center' });
  });
  fuente('normal', 6.8, [170, 186, 206]);
  escribir(
    `${kwh(lectura.consumoAnual)} al año  ·  ${lectura.meses.length} meses analizados  ·  `
    + `${lectura.diasTotales} días facturados${lectura.extrapolado ? '  ·  AÑO ESTIMADO' : ''}`,
    M + W / 2, y + 29, { align: 'center' }
  );
  y += altoCaja + 6;

  // ── La recomendación, en palabras ──
  titulo('Qué le recomendamos');
  fuente('normal', 9.5, TINTA);
  y += parrafo(recomendacion.porque, M, y, W, 4.8) + 3;

  const tecnicas = recomendacionesTecnicas(estudio);
  if (tecnicas.length) {
    fuente('bold', 7, GRIS);
    escribir('ADEMÁS DEL CAMBIO DE TARIFA', M, y);
    y += 4.5;
    tecnicas.forEach((t) => {
      asegurar(10);
      fuente('bold', 9, AZUL);
      escribir('·', M, y);
      fuente('normal', 8.4, TINTA);
      y += parrafo(t, M + 4, y, W - 4, 4.2) + 2;
    });
  }

  // ═══════════════════ LO QUE PAGA HOY ═══════════════════
  titulo('Lo que paga hoy, desglosado');

  tabla(
    ['Periodo', 'Consumo al año', '% del total', 'Precio €/kWh', 'Coste al año'],
    estudio.reparto.map((p) => [
      p.periodo, kwh(p.consumoAnual), `${p.porcentaje.toFixed(1)} %`,
      num(p.precio, 4), eur2(p.costeAnual),
    ]),
    [38, 34, 24, 32, 34],
    ['left', 'right', 'right', 'right', 'right']
  );

  tabla(
    ['Potencia', 'Contratada', 'Precio €/kW·día', 'Coste al año'],
    info.periodosPotencia.map((p, i) => [
      p, `${num(lectura.potencias[i] || 0, 3)} kW`,
      num(lectura.preciosPotencia[i] || 0, 6),
      eur2((lectura.potencias[i] || 0) * (lectura.preciosPotencia[i] || 0) * 365),
    ]),
    [46, 38, 44, 34],
    ['left', 'right', 'right', 'right']
  );

  asegurar(20);
  const totales: [string, string][] = [
    ['Término de energía', eur2(estudio.actual.totalEnergia)],
    ['Término de potencia', eur2(estudio.actual.totalPotencia)],
    ['TOTAL AL AÑO', eur2(estudio.actual.total)],
  ];
  totales.forEach(([et, val], i) => {
    const ultimo = i === totales.length - 1;
    fuente(ultimo ? 'bold' : 'normal', ultimo ? 9 : 8, ultimo ? AZUL : TINTA);
    escribir(et, M, y);
    escribir(val, M + W, y, { align: 'right' });
    y += ultimo ? 6 : 4.8;
  });
  nota('Precios sin impuestos, tal y como figuran en el desglose de sus facturas. El término de potencia se calcula sobre 365 días.');

  // ═══════════════════ MES A MES ═══════════════════
  if (estudio.meses.length) {
    titulo('Consumo mes a mes');
    nota(`El año no está estimado: sale de sumar ${estudio.meses.length} facturas reales con ${lectura.diasTotales} días facturados.`);

    const nE = info.periodosEnergia.length;
    const anchoP = Math.min(15, 62 / nE);
    tabla(
      ['Mes', 'Días', ...info.periodosEnergia.map((p) => p.split(' · ')[0]), 'Total kWh', 'Pico kW', 'Coste'],
      estudio.meses.map((m) => [
        m.mes, String(m.dias),
        ...m.energia.map((v) => Math.round(v).toLocaleString('es-ES')),
        Math.round(m.consumoTotal).toLocaleString('es-ES'),
        m.picoMes ? num(m.picoMes, 2) : '—',
        eur(m.costeTotal),
      ]),
      [20, 12, ...new Array(nE).fill(anchoP), 24, 18, 20].slice(0, 5 + nE),
      ['left', 'right', ...new Array(nE).fill('right' as const), 'right', 'right', 'right']
    );
  }

  // ═══════════════════ POTENCIAS ═══════════════════
  if (estudio.potencia) {
    titulo('Potencia contratada frente a la registrada');

    tabla(
      ['Periodo', 'Contratada', 'Máx. medido', 'Lecturas', 'Recomendada', 'Diferencia', 'Ahorro/año'],
      estudio.potencia.periodos.map((p) => [
        `P${p.periodo}`,
        `${num(p.contratada_kw, 2)} kW`,
        p.maxima_medida_kw ? `${num(p.maxima_medida_kw, 2)} kW` : '—',
        String(p.lecturas),
        `${num(p.recomendada_kw, 2)} kW`,
        p.en_exceso ? 'EN EXCESO' : (p.diferencia_kw > 0 ? `sobran ${num(p.diferencia_kw, 2)}` : '—'),
        p.ahorro_anual > 0 ? eur(p.ahorro_anual) : '—',
      ]),
      [18, 24, 24, 16, 26, 30, 24],
      ['left', 'right', 'right', 'right', 'right', 'right', 'right']
    );

    /**
     * TRES ESTADOS, NO DOS.
     *
     * Aquí ponía «hay ahorro» o «están bien ajustadas», y salió impreso
     * «las potencias están bien ajustadas» justo debajo de una tabla que
     * decía EN EXCESO en los dos periodos. Estar en exceso no es estar bien
     * ajustado: es lo contrario, y encima es lo que hay que arreglar primero.
     *
     * Un informe que se contradice a sí mismo en la misma página no lo
     * defiende nadie delante de un cliente.
     */
    const enExceso = estudio.potencia.periodos.filter((p) => p.en_exceso);
    asegurar(16);
    if (enExceso.length) {
      fuente('bold', 9, AMBAR);
      y += parrafo(
        `Hay que SUBIR potencia en ${enExceso.map((p) => `P${p.periodo}`).join(', ')}: `
        + 'el contador registra más de lo contratado, así que la potencia actual se queda corta.',
        M, y, W, 4.4) + 2;
    } else if (estudio.ahorroPotencia > 0) {
      fuente('bold', 9, VERDE);
      escribir(`Ajustando las potencias: ${eur(estudio.ahorroPotencia)} al año, sin cambiar de comercializadora.`, M, y);
      y += 6;
    } else {
      fuente('bold', 9, TINTA);
      escribir('Las potencias contratadas están bien ajustadas a lo que registra el contador.', M, y);
      y += 6;
    }

    estudio.potencia.avisos.forEach((a) => {
      asegurar(9);
      fuente('normal', 7.6, AMBAR);
      y += parrafo(`· ${a}`, M, y, W, 3.9) + 1.4;
    });

    nota(
      `Fiabilidad del análisis: ${estudio.potencia.confianza}. `
      + 'La potencia recomendada nunca baja del máximo registrado más un margen de seguridad: '
      + 'apurar el límite sale barato en la hoja de cálculo y lo paga el cliente en penalizaciones.'
    );
  } else {
    titulo('Potencia contratada');
    nota(
      'No hay lecturas de maxímetro en la documentación aportada, así que no se puede decir si sobra o falta '
      + 'potencia sin arriesgarse a dejar el suministro corto. Con los maxímetros de doce facturas, este apartado '
      + 'suele ser el segundo ahorro más grande del estudio.'
    );
  }

  // ═══════════════════ REACTIVA ═══════════════════
  if (estudio.reactiva) {
    titulo('Energía reactiva');
    tabla(
      ['Concepto', 'Valor'],
      [
        ['Energía reactiva al año', `${Math.round(estudio.reactiva.reactiva_kvarh).toLocaleString('es-ES')} kVArh`],
        ['Energía activa al año', kwh(estudio.reactiva.activa_kwh)],
        ['tan φ', num(estudio.reactiva.tan_phi, 3)],
        ['cos φ', num(estudio.reactiva.cos_phi, 3)],
        ['¿Se penaliza?', estudio.reactiva.penaliza ? 'SÍ' : 'No'],
      ],
      [90, 72],
      ['left', 'right']
    );
    fuente('normal', 8.2, estudio.reactiva.penaliza ? AMBAR : TINTA);
    y += parrafo(estudio.reactiva.mensaje, M, y, W, 4.2) + 3;
    nota('No se pone importe a la penalización porque depende de tramos y de la tarifa; decir una cifra inventada aquí sería peor que no decir nada.');
  }

  // ═══════════════════ EXCEDENTES ═══════════════════
  if (estudio.excedentesAnual > 0) {
    titulo('Excedentes de autoconsumo');
    fuente('normal', 8.6, TINTA);
    y += parrafo(
      `La instalación vierte ${kwh(estudio.excedentesAnual)} al año a la red, un `
      + `${((estudio.excedentesAnual / Math.max(1, lectura.consumoAnual)) * 100).toFixed(1)} % `
      + 'de lo que consume. Conviene comprobar que la compensación de excedentes está bien aplicada en cada '
      + 'factura y que el precio de compensación es competitivo: es un concepto que se revisa poco y en el que '
      + 'las diferencias entre comercializadoras son grandes.',
      M, y, W, 4.4) + 4;
  }

  // ═══════════════════ ALTERNATIVAS ═══════════════════
  if (escenarios.length) {
    titulo('Alternativas estudiadas');

    tabla(
      ['Alternativa', 'Tipo', 'Coste al año', 'Ahorro', '%', 'Permanencia', 'Riesgo'],
      escenarios.map((e) => [
        e.escenario.titulo,
        e.escenario.tipo === 'indexado' ? 'Indexado' : 'Fijo',
        eur(e.costeAnual),
        eur(e.ahorroAnual),
        `${e.ahorroPct.toFixed(1)} %`,
        e.escenario.permanenciaMeses ? `${e.escenario.permanenciaMeses} meses` : 'Sin permanencia',
        e.riesgo,
      ]),
      [40, 20, 26, 24, 16, 26, 18],
      ['left', 'left', 'right', 'right', 'right', 'right', 'left']
    );

    // Los motivos del riesgo van enteros: un semáforo sin explicación no lo
    // usa nadie para decidir, y menos un cliente.
    escenarios.filter((e) => e.porqueRiesgo.length).forEach((e) => {
      asegurar(12);
      fuente('bold', 7.4, TINTA);
      escribir(e.escenario.titulo, M, y);
      y += 4;
      e.porqueRiesgo.forEach((p) => {
        fuente('normal', 7.2, AMBAR);
        y += parrafo(`· ${p}`, M + 3, y, W - 3, 3.8) + 1;
      });
      y += 1.5;
    });
  }

  // ═══════════════════ HIPÓTESIS ═══════════════════
  titulo('Hipótesis y trazabilidad');

  const hip = recomendacion.elegido?.escenario.hipotesis;
  const filasHip: string[][] = [
    ['Periodo analizado', `${lectura.meses.length} meses · ${lectura.diasTotales} días facturados`],
    ['Consumo anual', `${kwh(lectura.consumoAnual)}${lectura.extrapolado ? ' (estimado por días, no medido en año completo)' : ' (suma de las facturas aportadas)'}`],
    ['Origen de los datos', 'Facturas del cliente, transcritas a la plantilla de consumos'],
    ['Precios actuales', 'Los del desglose de sus facturas, sin impuestos'],
  ];
  if (hip) {
    filasHip.push(['Fecha de los precios ofertados', fechaLarga(hip.fechaPrecios)]);
    filasHip.push(['Impuestos', hip.incluyeImpuestos ? 'Incluidos en los precios' : 'No incluidos: se aplican igual en todas las alternativas']);
    if (hip.bloqueada) filasHip.push(['Vigencia', 'Precios congelados a la fecha de este informe']);
    hip.ajustesManuales.forEach((a) => filasHip.push(['Ajuste aplicado', a]));
  }
  if (estudio.potencia) {
    filasHip.push(['Análisis de potencia', `Sobre ${estudio.potencia.periodos.reduce((s, p) => s + p.lecturas, 0)} lecturas de maxímetro · fiabilidad ${estudio.potencia.confianza}`]);
  } else {
    filasHip.push(['Análisis de potencia', 'No se ha podido hacer: la documentación no incluye maxímetros']);
  }
  // Lo que NO se ha aportado se dice, y no se calla dejando el apartado fuera.
  // Un hueco silencioso parece que no aplica; dicho, es una cosa que pedir en
  // la próxima visita y suele valer dinero.
  if (!estudio.reactiva) {
    filasHip.push(['Energía reactiva', 'No aportada en la documentación: no se ha podido comprobar el factor de potencia']);
  }
  if (!estudio.excedentesAnual) {
    filasHip.push(['Excedentes de autoconsumo', 'Sin excedentes declarados: se entiende que no hay instalación de autoconsumo']);
  }
  tabla(['Concepto', 'Detalle'], filasHip, [58, 104], ['left', 'left']);

  if (alertas.length) {
    asegurar(14);
    fuente('bold', 7.4, AMBAR);
    escribir('A TENER EN CUENTA', M, y);
    y += 4.5;
    alertas.forEach((a) => {
      asegurar(9);
      fuente('normal', 7.6, a.afectaAlAhorro ? AMBAR : GRIS);
      y += parrafo(`· ${a.texto}`, M, y, W, 3.9) + 1.2;
    });
    y += 2;
  }

  nota(
    'Este estudio se basa en la documentación aportada por el cliente. Los precios ofertados están sujetos a la '
    + 'confirmación de la comercializadora y a la vigencia indicada. El ahorro es una estimación sobre el consumo '
    + 'del periodo analizado: un cambio en los hábitos de consumo lo modifica.'
  );

  if (d.responsable) {
    asegurar(12);
    fuente('normal', 8, TINTA);
    escribir(`Preparado por ${d.responsable} · Gesmeco Energía`, M, y);
    y += 5;
  }

  pie();
  return doc;
}

/** Nombre de archivo legible y ordenable. */
export function nombreInforme(cliente: string, fecha: string): string {
  const limpio = cliente.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'cliente';
  return `Estudio-${limpio}-${fecha.slice(0, 10)}.pdf`;
}

export async function descargarInformePdf(d: DatosInforme): Promise<void> {
  const doc = await construirInformePdf(d);
  doc.save(nombreInforme(d.cliente || d.lectura.suministro.titular || 'cliente', d.fecha));
}
