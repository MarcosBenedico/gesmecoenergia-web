/**
 * PLANTILLA DE CONSUMOS — meter la factura a mano, bien, sin depender de nadie.
 *
 * POR QUÉ EXISTE
 *
 * La lectura automática de facturas depende de una API de pago: el día que se
 * acaba el saldo, deja de funcionar entera y el trabajo se para. Y aunque
 * funcione, de una foto sale UN mes: el mes que tocara. Con un solo mes, el
 * consumo anual se estima multiplicando por doce, y eso en esta comarca es
 * sencillamente falso — una granja con riego en agosto no se parece en nada a
 * la misma granja en febrero. La comparativa sale redonda y equivocada.
 *
 * Con doce meses desglosados por periodo no hay que estimar nada: el año es la
 * suma. Y de paso se ve la estacionalidad, que es lo que decide si unas placas
 * tienen sentido y si el maxímetro justifica bajar potencia.
 *
 * LA REGLA QUE ORDENA TODO ESTE ARCHIVO: NO INVENTAR EL AÑO.
 *
 * Se anualiza por DÍAS FACTURADOS, no por meses. Sumar tres meses y
 * multiplicar por cuatro es la clase de número que parece bien y arruina una
 * propuesta. Con los días reales, un periodo incompleto se anualiza con su
 * factor exacto y —esto es lo importante— SE DICE que se ha extrapolado y
 * desde cuántos días. Un dato estimado que no se anuncia es peor que no
 * tenerlo, porque el hueco se ve y el número no.
 *
 * LOS NÚMEROS LOS ESCRIBE UNA PERSONA, ASÍ QUE:
 *   · «1.234,56» y «1234.56» son lo mismo y los dos valen.
 *   · «3.42» es ambiguo (¿3,42 o 3.420?) y NO se adivina: se marca.
 * Es el mismo criterio que `leerConsumo` en luz.ts, y por el mismo motivo:
 * ahí un punto de miles mal leído metió 57 CUPS con el consumo mil veces
 * menor y nadie lo vio hasta que salió dentro de una oferta.
 */

import { TARIFA_INFO, type TarifaAcceso } from './tarifas-base.ts';
import type { Reparo } from './factura.ts';

export type { Reparo };

/** Los meses, en el orden en que van en la plantilla. */
export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Días de un año. Se anualiza contra esto, no contra 12 meses. */
export const DIAS_ANIO = 365;

/**
 * Por debajo de esto, el año está extrapolado de un trozo pequeño y la
 * estacionalidad puede con cualquier cálculo. Diez meses cubren invierno y
 * verano; menos, ya depende de cuáles falten.
 */
export const DIAS_MINIMOS_FIABLES = 300;

/** Menos que esto no da ni para un mes: no hay de dónde sacar un año. */
export const DIAS_MINIMOS = 25;

/**
 * Etiquetas que NO son un mes aunque estén en la columna de meses.
 *
 * La plantilla lleva una fila de TOTAL al pie, con fórmulas, para que se vea
 * de un vistazo si falta un mes o sobra un cero. Sin esta lista, esa fila se
 * leía como un mes más: salían 13 meses, 660 días facturados y una potencia
 * contratada de 300 kW (la suma de las doce) en vez de 40. Y todo ello sin
 * error ninguno — el ahorro simplemente salía calculado sobre otro suministro.
 *
 * Se corta al llegar a una de estas, no se salta: lo que hay debajo de los
 * totales son notas, nunca datos.
 */
export const FILAS_NO_MES = ['total', 'totales', 'suma', 'sumatorio', 'media', 'promedio'];

// ── Leer un número escrito por una persona ──────────────────────────────────

export interface NumeroLeido {
  valor: number;
  /** Está escrito de forma que no se puede resolver sin la factura. */
  ambiguo: boolean;
  motivo: string | null;
}

/**
 * Qué clase de número se espera en esa casilla.
 *
 * ESTO NO ES UN ADORNO: ES LO QUE RESUELVE LA AMBIGÜEDAD.
 *
 * «0.185» en una casilla de kWh es 185 (un punto de miles mal escrito); en una
 * casilla de €/kWh son dieciocho céntimos y medio. El mismo texto, dos números
 * que se diferencian en mil veces. Sin saber de qué columna se trata hay que
 * adivinar, y adivinando un precio de 0,185 €/kWh entraba como 185 €/kWh.
 *
 * Como la plantilla sabe qué hay en cada columna, no hay que adivinar nada:
 *
 *  · `cantidad` — kWh y días. Números grandes que la gente escribe con punto
 *     de miles («53.558»), que es justo el fallo que documenta `leerConsumo`.
 *     Aquí un punto con tres cifras detrás es separador de miles.
 *  · `decimal` — €/kWh, €/kW·día, kW contratados y maxímetro. Números
 *     pequeños que se escriben con decimales. El punto es SIEMPRE decimal.
 *
 * Lo segundo no es una comodidad, es necesario: «4.6» es la potencia doméstica
 * más común de España. Tratándola como cantidad salía marcada como dudosa
 * («¿4,6 o 460?») en TODAS las plantillas de 2.0TD, y un aviso que salta
 * siempre deja de leerse — con lo cual dejan de leerse también los de verdad.
 */
export type TipoNumero = 'cantidad' | 'decimal';

export function leerNumero(
  bruto: string | number | null | undefined,
  tipo: TipoNumero = 'cantidad'
): NumeroLeido {
  if (typeof bruto === 'number') {
    return Number.isFinite(bruto)
      ? { valor: bruto, ambiguo: false, motivo: null }
      : { valor: 0, ambiguo: true, motivo: 'No es un número.' };
  }
  const s = String(bruto ?? '').trim();
  if (!s) return { valor: 0, ambiguo: false, motivo: null };

  const negativo = s.startsWith('-');
  const cuerpo = s.replace(/^[+-]/, '').replace(/[^\d.,]/g, '');
  if (!cuerpo) return { valor: 0, ambiguo: false, motivo: null };

  let texto = cuerpo;
  let motivo: string | null = null;

  if (cuerpo.includes(',')) {
    // Con coma no hay duda en ninguno de los dos casos: la coma manda y el
    // punto es separador de miles.
    texto = cuerpo.replace(/\./g, '').replace(',', '.');
  } else if (cuerpo.includes('.')) {
    const grupos = cuerpo.split('.');
    const detras = grupos.slice(1);

    if (tipo === 'decimal') {
      // El punto es decimal y ya está. `Number` lo lee así de serie.
      texto = cuerpo;
      if (detras.length > 1) motivo = `«${cuerpo}» no es un número reconocible.`;
    } else if (detras.every((g) => g.length === 3)) {
      // 53.558 y 1.234.567: separador de miles, se recupera sin riesgo.
      texto = grupos.join('');
    } else if (detras.length === 1 && detras[0].length <= 2) {
      // 3.42 puede ser 3,42 o 3.420 y no hay forma de saberlo sin la factura.
      // Se deja el valor y se avisa; inventarlo sería el fallo que esto evita.
      motivo = `No se sabe si «${cuerpo}» son ${cuerpo.replace('.', ',')} o ${grupos.join('')}0. Míralo en la factura.`;
    } else {
      motivo = `«${cuerpo}» no es un número reconocible.`;
    }
  }

  const n = Number(texto);
  if (!Number.isFinite(n)) return { valor: 0, ambiguo: true, motivo: motivo ?? 'No es un número.' };
  return { valor: negativo ? -n : n, ambiguo: !!motivo, motivo };
}

// ── La forma de la plantilla ────────────────────────────────────────────────

export interface ColumnaMes {
  clave: string;
  titulo: string;
  /** Grupo al que pertenece, para la cabecera de dos pisos. */
  grupo: 'mes' | 'energia' | 'potencia' | 'maximetro';
  ancho: number;
}

/**
 * Las columnas de la hoja de consumos, que dependen de la tarifa.
 *
 * La 2.0TD tiene 3 periodos de energía y 2 de potencia; la 3.0TD y la 6.1TD,
 * 6 y 6. Generar la plantilla con las columnas exactas de SU tarifa evita el
 * error más caro de todos: rellenar tres periodos de los seis que hay, que
 * deja el coste actual a la mitad y el ahorro al doble sin que nada lo delate.
 */
export function columnasDeConsumo(tarifa: TarifaAcceso): ColumnaMes[] {
  const info = TARIFA_INFO[tarifa];
  const cols: ColumnaMes[] = [
    { clave: 'mes', titulo: 'Mes', grupo: 'mes', ancho: 14 },
    { clave: 'dias', titulo: 'Días facturados', grupo: 'mes', ancho: 16 },
  ];
  info.periodosEnergia.forEach((p, i) => {
    cols.push({ clave: `e${i}`, titulo: p.replace(' · ', ' '), grupo: 'energia', ancho: 13 });
  });
  info.periodosPotencia.forEach((p, i) => {
    cols.push({ clave: `p${i}`, titulo: p.replace(' · ', ' '), grupo: 'potencia', ancho: 13 });
  });
  info.periodosPotencia.forEach((p, i) => {
    cols.push({ clave: `m${i}`, titulo: p.replace(' · ', ' '), grupo: 'maximetro', ancho: 13 });
  });
  return cols;
}

/** Los datos de cabecera del suministro: etiqueta, clave y si es obligatorio. */
export interface CampoSuministro {
  clave: string;
  etiqueta: string;
  ayuda: string;
  obligatorio: boolean;
}

export const CAMPOS_SUMINISTRO: CampoSuministro[] = [
  { clave: 'titular', etiqueta: 'Titular del contrato', ayuda: 'Tal y como aparece en la factura', obligatorio: false },
  { clave: 'nif', etiqueta: 'NIF / CIF', ayuda: '', obligatorio: false },
  { clave: 'cups', etiqueta: 'CUPS', ayuda: 'Empieza por ES y tiene 20 o 22 caracteres', obligatorio: false },
  { clave: 'direccion', etiqueta: 'Dirección del suministro', ayuda: '', obligatorio: false },
  { clave: 'tarifa', etiqueta: 'Tarifa de acceso', ayuda: '2.0TD, 3.0TD o 6.1TD', obligatorio: true },
  { clave: 'comercializadora', etiqueta: 'Comercializadora actual', ayuda: 'Quien le factura hoy', obligatorio: false },
  { clave: 'distribuidora', etiqueta: 'Distribuidora', ayuda: 'La que mantiene la red de la zona', obligatorio: false },
  { clave: 'fecha_inicio', etiqueta: 'Inicio del contrato', ayuda: 'DD/MM/AAAA', obligatorio: false },
  { clave: 'fecha_fin', etiqueta: 'Fin del contrato', ayuda: 'DD/MM/AAAA. De aquí sale el preaviso', obligatorio: false },
  { clave: 'dias_preaviso', etiqueta: 'Días de preaviso', ayuda: 'Normalmente 30', obligatorio: false },
  { clave: 'permanencia', etiqueta: 'Fin de permanencia', ayuda: 'DD/MM/AAAA. En blanco si no tiene', obligatorio: false },
  { clave: 'penalizacion', etiqueta: 'Penalización por salir (€)', ayuda: 'En blanco si no tiene', obligatorio: false },
];

// ── Lo que sale de leer una plantilla rellenada ─────────────────────────────

export interface FilaMes {
  mes: string;
  dias: number;
  energia: number[];
  potenciaContratada: number[];
  maximetro: number[];
}

export interface LecturaPlantilla {
  tarifa: TarifaAcceso | null;
  suministro: Record<string, string>;
  meses: FilaMes[];
  /** Días facturados sumados. Es el divisor de toda la anualización. */
  diasTotales: number;
  /** kWh al año por periodo, anualizados por días. */
  consumoAnualPorPeriodo: number[];
  consumoAnual: number;
  /** Consumo de un mes medio por periodo — lo que come `calcularCoste`. */
  consumosMes: number[];
  /** Potencia contratada por periodo (la mayor declarada). */
  potencias: number[];
  /** Máximo del maxímetro por periodo en todo el año. */
  maximetros: number[];
  preciosEnergia: number[];
  preciosPotencia: number[];
  /** El año NO cubre los días suficientes: está extrapolado. */
  extrapolado: boolean;
  /** Se puede calcular una comparativa con esto. */
  utilizable: boolean;
  reparos: Reparo[];
}

const vacio = (n: number) => new Array(n).fill(0);
const norm = (s: string) => String(s ?? '').trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '');

/** De «2.0TD», «2.0 TD», «20TD» o «2.0» a la clave interna. */
export function leerTarifa(bruto: string | null | undefined): TarifaAcceso | null {
  const s = norm(bruto || '').replace(/\s|td|\./g, '');
  if (s === '20') return '2.0';
  if (s === '30') return '3.0';
  if (s === '61') return '6.1';
  return null;
}

/**
 * Convierte las hojas de la plantilla (ya leídas como texto) en datos.
 *
 * Recibe matrices de texto y no un archivo a propósito: así se prueba entero
 * sin abrir un Excel, que es donde de verdad se rompen estas cosas.
 */
export function interpretarPlantilla(hojas: {
  suministro: string[][];
  consumos: string[][];
  precios: string[][];
}): LecturaPlantilla {
  const reparos: Reparo[] = [];
  const pega = (campo: string, gravedad: 'bloquea' | 'revisar', texto: string, arreglo: string) =>
    reparos.push({ campo, gravedad, texto, arreglo });

  // ── Suministro: pares etiqueta → valor en las dos primeras columnas ──
  const suministro: Record<string, string> = {};
  for (const fila of hojas.suministro || []) {
    const etiqueta = norm(fila[0] || '');
    if (!etiqueta) continue;
    const campo = CAMPOS_SUMINISTRO.find((c) => norm(c.etiqueta) === etiqueta);
    if (campo) suministro[campo.clave] = String(fila[1] ?? '').trim();
  }

  const tarifa = leerTarifa(suministro.tarifa);
  if (!tarifa) {
    pega('tarifa', 'bloquea',
      'No se ha entendido la tarifa de acceso',
      'En la hoja «1. Suministro», escribe 2.0TD, 3.0TD o 6.1TD');
  }

  const nE = tarifa ? TARIFA_INFO[tarifa].periodosEnergia.length : 0;
  const nP = tarifa ? TARIFA_INFO[tarifa].periodosPotencia.length : 0;

  // ── Consumos: se busca la fila de cabecera por la palabra «Mes» ──
  const filas = hojas.consumos || [];
  const iCab = filas.findIndex((f) => norm(f[0] || '') === 'mes');
  const cuerpo = iCab >= 0 ? filas.slice(iCab + 1) : [];

  const meses: FilaMes[] = [];
  const ambiguos: string[] = [];

  for (const f of cuerpo) {
    const nombre = String(f[0] ?? '').trim();
    if (!nombre) continue;
    // La fila de totales cierra la tabla. Ver FILAS_NO_MES.
    if (FILAS_NO_MES.includes(norm(nombre))) break;
    // Una fila sin días ni consumo es un mes que no se ha rellenado. No es un
    // error: es que solo se tienen ocho facturas. Se salta en silencio.
    const dias = leerNumero(f[1]);
    const lee = (desde: number, cuantos: number, tipo: 'cantidad' | 'decimal') => {
      const salida: number[] = [];
      for (let i = 0; i < cuantos; i++) {
        const n = leerNumero(f[desde + i], tipo);
        if (n.ambiguo && n.motivo) ambiguos.push(`${nombre}: ${n.motivo}`);
        salida.push(n.valor);
      }
      return salida;
    };
    // Los kWh van con punto de miles; los kW, con decimales. Ver `leerNumero`.
    const energia = lee(2, nE, 'cantidad');
    if (dias.valor <= 0 && energia.every((x) => x === 0)) continue;

    if (dias.valor <= 0) {
      pega('dias', 'revisar',
        `${nombre} tiene consumo pero no días facturados`,
        'Sin los días no se puede anualizar bien ese mes: míralos en la factura');
    }

    meses.push({
      mes: nombre,
      dias: dias.valor,
      energia,
      potenciaContratada: lee(2 + nE, nP, 'decimal'),
      maximetro: lee(2 + nE + nP, nP, 'decimal'),
    });
  }

  if (ambiguos.length) {
    pega('numeros', 'revisar',
      `Hay ${ambiguos.length} número(s) que se pueden leer de dos formas`,
      ambiguos.slice(0, 3).join(' · '));
  }

  // ── Anualizar por días ──
  const diasTotales = meses.reduce((s, m) => s + m.dias, 0);
  const sumaE = vacio(nE);
  for (const m of meses) m.energia.forEach((v, i) => { sumaE[i] += v; });

  let consumoAnualPorPeriodo = vacio(nE);
  let extrapolado = false;

  if (!meses.length) {
    pega('consumos', 'bloquea',
      'No hay ningún mes con datos',
      'Rellena al menos un mes en la hoja «2. Consumos y potencias»');
  } else if (diasTotales < DIAS_MINIMOS) {
    pega('consumos', 'bloquea',
      `Solo hay ${diasTotales} días facturados`,
      'Con menos de un mes no hay de dónde sacar un consumo anual');
  } else {
    const factor = DIAS_ANIO / diasTotales;
    consumoAnualPorPeriodo = sumaE.map((v) => v * factor);
    extrapolado = diasTotales < DIAS_MINIMOS_FIABLES;
    if (extrapolado) {
      // Se dice SIEMPRE. Un año estimado desde cuatro meses puede irse muy
      // lejos si esos cuatro son los de riego, y quien lea la propuesta tiene
      // derecho a saber sobre qué se ha construido.
      pega('consumos', 'revisar',
        `El año se ha estimado a partir de ${diasTotales} días (${meses.length} mes/es)`,
        'Con menos de 10 meses la estacionalidad puede desviar bastante el resultado');
    }
  }

  const consumoAnual = consumoAnualPorPeriodo.reduce((s, v) => s + v, 0);

  // La potencia contratada debería ser la misma todo el año; si cambió, manda
  // la mayor, que es la que marca lo que se está pagando de término fijo.
  const potencias = vacio(nP);
  const maximetros = vacio(nP);
  for (const m of meses) {
    m.potenciaContratada.forEach((v, i) => { potencias[i] = Math.max(potencias[i], v); });
    m.maximetro.forEach((v, i) => { maximetros[i] = Math.max(maximetros[i], v); });
  }
  if (meses.length && potencias.every((p) => p === 0)) {
    pega('potencias', 'bloquea',
      'No hay ninguna potencia contratada',
      'El término de potencia es la mitad de la factura de muchos negocios');
  }

  // ── Precios actuales: filas «periodo | €/kWh | €/kW·día» ──
  const preciosEnergia = vacio(nE);
  const preciosPotencia = vacio(nP);
  const fp = hojas.precios || [];
  const iCabP = fp.findIndex((f) => norm(f[0] || '').startsWith('periodo'));
  fp.slice(iCabP + 1).forEach((f, i) => {
    // 'decimal': aquí el punto es decimal SIEMPRE. Leerlo como miles convertía
    // 0.185 €/kWh en 185 €/kWh y la comparativa salía sin sentido.
    if (i < nE) preciosEnergia[i] = leerNumero(f[1], 'decimal').valor;
    if (i < nP) preciosPotencia[i] = leerNumero(f[2], 'decimal').valor;
  });

  // No bloquean: sin ellos se puede ofertar, lo que no se puede es decir
  // cuánto ahorra. Mismo criterio que `revisarFactura`.
  if (preciosEnergia.every((p) => p === 0)) {
    pega('precios_energia', 'revisar',
      'No están los precios de la energía que paga hoy',
      'Sin ellos se puede preparar la oferta, pero no se puede decir cuánto ahorra');
  }
  if (preciosPotencia.every((p) => p === 0)) {
    pega('precios_potencia', 'revisar',
      'No están los precios de la potencia que paga hoy',
      'Si en la factura vienen en €/kW·año, divídelos entre 365');
  }

  return {
    tarifa,
    suministro,
    meses,
    diasTotales,
    consumoAnualPorPeriodo,
    consumoAnual,
    // Lo que come `calcularCoste`, que multiplica por 12. Al venir del total
    // anual, no se pierde nada: el año exacto entra y el año exacto sale.
    consumosMes: consumoAnualPorPeriodo.map((v) => v / 12),
    potencias,
    maximetros,
    preciosEnergia,
    preciosPotencia,
    extrapolado,
    utilizable: !reparos.some((r) => r.gravedad === 'bloquea'),
    reparos,
  };
}
