/**
 * GESTIÓN ENERGÉTICA — el vocabulario único.
 *
 * Todo lo que el módulo energético tiene que llamar por su nombre vive aquí:
 * fases, vectores, magnitudes, unidades, factores de conversión y el catálogo
 * de requisitos ISO. Es a la gestión energética lo que `etapas.ts` es al viaje
 * comercial, y por el mismo motivo: en cuanto dos pantallas se inventan su
 * propia lista, acaban diciendo cosas distintas del mismo cliente.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * LAS TRES IDEAS QUE HAY QUE ENTENDER ANTES DE TOCAR ESTE ARCHIVO
 * ═════════════════════════════════════════════════════════════════════════
 *
 * 1. LA ENERGÍA NO ES SOLO LA LUZ. Una granja de La Litera consume
 *    electricidad, gasóleo y a menudo propano. Un indicador que solo mire la
 *    factura eléctrica describe una parte del cliente y la presenta como si
 *    fuera el todo. Por eso cada medida lleva su VECTOR.
 *
 * 2. PARA SUMAR HAY QUE CONVERTIR, Y CONVERTIR ES UNA DECISIÓN. Un litro de
 *    gasóleo son unos 9,98 kWh, pero ese factor es una referencia. Cuando una
 *    medida se convierte, se guarda EL FACTOR USADO junto al resultado: si se
 *    recalculara al vuelo, afinar el factor un martes cambiaría todas las
 *    líneas base históricas hacia atrás sin que nadie lo hubiera pedido. Es la
 *    misma lección que congelar los precios de un estudio.
 *
 * 3. LA ISO NO ES UN SITIO AL QUE IR. Si lo fuera, alguien tendría que «hacer
 *    la ISO», y ese es exactamente el trabajo que nadie hace nunca. El
 *    catálogo de requisitos de aquí abajo no define pantallas: define A QUÉ
 *    REGISTRO YA EXISTENTE apunta cada exigencia de la norma. Pulsar «línea
 *    base» abre su formulario, no un apartado ISO donde volver a teclearlo
 *    todo.
 *
 * Y una advertencia que va en el código porque en la pantalla también va a ir:
 * ESTO NO CERTIFICA NADA. Que un expediente tenga todas sus evidencias
 * colocadas significa que está ordenado, no que el cliente cumpla la norma.
 * Certificar lo hace un organismo acreditado con un auditor delante.
 */

// ── Fases del expediente ────────────────────────────────────────────────────

/**
 * La fase energética. NO es la etapa comercial de `etapas.ts` y no debe
 * mezclarse con ella: un cliente puede tener la luz ya activada y una
 * actuación técnica en estudio. Si compartieran vocabulario, activarle el
 * contrato le cerraría un expediente que sigue abierto.
 */
export type FaseEnergia =
  | 'diagnostico' | 'en_estudio' | 'propuesta' | 'ejecucion'
  | 'verificacion' | 'seguimiento' | 'cerrado' | 'aparcado';

/**
 * Quién tiene que mover ficha. Es lo que separa «vamos tarde» de «estamos
 * esperando»: sin esto, un expediente parado tres semanas porque el cliente no
 * decide sale en la misma lista roja que uno parado porque nadie lo ha tocado,
 * y entonces la lista roja deja de significar nada.
 *
 * Es el mismo concepto que la `Pelota` de `seguimiento.ts`, aplicado al otro
 * eje. Se define aquí, una vez, para que el listado no se lo invente.
 */
export type Pelota = 'nuestra' | 'del_cliente' | 'de_un_tercero';

export const PELOTA_LABEL: Record<Pelota, string> = {
  nuestra: 'Nos toca a nosotros',
  del_cliente: 'Le toca al cliente',
  de_un_tercero: 'Depende de un tercero',
};

export interface DefFase {
  id: FaseEnergia;
  titulo: string;
  /** Qué tiene que pasar para salir de aquí. Sin esto, una fase es una etiqueta. */
  condicion: string;
  /** Orden de avance. −1 = fuera del recorrido (cerrado, aparcado). */
  avance: number;
  pelota: Pelota;
  /**
   * Días a partir de los cuales estar en esta fase ya es un problema.
   *
   * Son MUY distintos de los de la venta a propósito. Un expediente energético
   * en diagnóstico dos meses es normal —hay que reunir un año de facturas—;
   * una oportunidad comercial parada dos meses está muerta. Usar los plazos
   * comerciales aquí llenaría la pantalla de rojo el primer día, y una alarma
   * que salta siempre se deja de mirar.
   */
  limiteDias: number;
  tono: string;
}

export const FASES: DefFase[] = [
  { id: 'diagnostico', titulo: 'Diagnóstico', avance: 0,
    condicion: 'Reunir datos fiables y ver dónde se va la energía',
    // Dos meses: hay que juntar un año de facturas y eso depende del cliente.
    pelota: 'del_cliente', limiteDias: 60,
    tono: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  { id: 'en_estudio', titulo: 'En estudio', avance: 1,
    condicion: 'Comparar alternativas con números que se sostengan',
    // Tres semanas. Aquí no hay a quién echarle la culpa: los datos ya están.
    pelota: 'nuestra', limiteDias: 21,
    tono: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  { id: 'propuesta', titulo: 'Propuesta presentada', avance: 2,
    condicion: 'El cliente tiene la propuesta y falta su decisión',
    // Una inversión no se decide en una semana, pero al mes hay que llamar.
    pelota: 'del_cliente', limiteDias: 30,
    tono: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  { id: 'ejecucion', titulo: 'En ejecución', avance: 3,
    condicion: 'Aceptada; se está implantando',
    pelota: 'de_un_tercero', limiteDias: 90,
    tono: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  { id: 'verificacion', titulo: 'Verificando', avance: 4,
    condicion: 'Ejecutada; falta comprobar el ahorro contra la línea base',
    // Un año de datos posteriores es lo normal para verificar de verdad, pero
    // a los cuatro meses ya debería haber una primera lectura.
    pelota: 'nuestra', limiteDias: 120,
    tono: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  { id: 'seguimiento', titulo: 'En seguimiento', avance: 5,
    condicion: 'Ahorro verificado; se vigila que se mantenga',
    // Revisión trimestral: si pasa medio año sin mirarlo, no es seguimiento.
    pelota: 'nuestra', limiteDias: 120,
    tono: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  { id: 'cerrado', titulo: 'Cerrado', avance: -1,
    condicion: 'Terminado; no requiere más trabajo',
    pelota: 'nuestra', limiteDias: 0,
    tono: 'bg-card/60 text-muted border-border/40' },
  { id: 'aparcado', titulo: 'Aparcado', avance: -1,
    condicion: 'Parado a propósito, con fecha de reactivación',
    pelota: 'nuestra', limiteDias: 0,
    tono: 'bg-card/60 text-muted/80 border-border/40' },
];

export const FASE = Object.fromEntries(FASES.map((f) => [f.id, f])) as Record<FaseEnergia, DefFase>;

/** Las fases en las que el expediente está vivo y da trabajo. */
export const FASES_ABIERTAS: FaseEnergia[] = FASES.filter((f) => f.avance >= 0).map((f) => f.id);

// ── Vectores energéticos ────────────────────────────────────────────────────

export type Vector =
  | 'electricidad' | 'gas_natural' | 'gasoleo' | 'propano'
  | 'biomasa' | 'solar_termica' | 'otro';

export interface DefVector {
  id: Vector;
  titulo: string;
  /** La unidad en la que llega normalmente la factura de ese vector. */
  unidadHabitual: string;
  /**
   * Cuánta energía hay en una unidad, en kWh. Null = ya viene en kWh.
   *
   * SON VALORES DE REFERENCIA (poder calorífico inferior típico) y ESTÁN
   * PENDIENTES DE QUE MARCOS LOS VALIDE con facturas reales — la biomasa
   * sobre todo, que varía muchísimo con la humedad del pélet o la astilla.
   * Se pueden revisar sin tocar código desde `luz_config`.
   */
  kwhPorUnidad: number | null;
  emoji: string;
}

export const VECTORES: DefVector[] = [
  { id: 'electricidad', titulo: 'Electricidad', unidadHabitual: 'kWh', kwhPorUnidad: null, emoji: '⚡' },
  { id: 'gas_natural', titulo: 'Gas natural', unidadHabitual: 'kWh', kwhPorUnidad: null, emoji: '🔥' },
  // ~9,98 kWh/litro (PCI ~35,9 MJ/l). Es el que más se usa en la comarca.
  { id: 'gasoleo', titulo: 'Gasóleo', unidadHabitual: 'l', kwhPorUnidad: 9.98, emoji: '🛢️' },
  // ~12,8 kWh/kg (PCI ~46 MJ/kg).
  { id: 'propano', titulo: 'Propano', unidadHabitual: 'kg', kwhPorUnidad: 12.8, emoji: '🫙' },
  // ~4,2 kWh/kg para pélet al 8-10 % de humedad. MUY variable: es el factor
  // que más falla si no se contrasta con el albarán.
  { id: 'biomasa', titulo: 'Biomasa', unidadHabitual: 'kg', kwhPorUnidad: 4.2, emoji: '🌾' },
  { id: 'solar_termica', titulo: 'Solar térmica', unidadHabitual: 'kWh', kwhPorUnidad: null, emoji: '☀️' },
  { id: 'otro', titulo: 'Otro', unidadHabitual: 'kWh', kwhPorUnidad: null, emoji: '❓' },
];

export const VECTOR = Object.fromEntries(VECTORES.map((v) => [v.id, v])) as Record<Vector, DefVector>;

/** Clave de `luz_config` desde la que se pueden revisar los factores sin tocar código. */
export const CLAVE_FACTORES = 'energia_factores_kwh';

// ── Magnitudes ──────────────────────────────────────────────────────────────

/**
 * Qué se está midiendo. SEPARADAS A PROPÓSITO: «sin datos FV no inferir
 * consumo total» (página 6 del documento). Sumar la compra de red y el
 * autoconsumo sin tener la producción medida es inventarse el denominador de
 * todos los indicadores que vengan después.
 */
export type Magnitud =
  | 'consumo' | 'autoconsumo' | 'produccion' | 'excedentes'
  | 'reactiva' | 'potencia_max' | 'coste' | 'variable_actividad';

export interface DefMagnitud {
  id: Magnitud;
  titulo: string;
  /** Qué es exactamente, para que nadie meta una cosa por otra. */
  que_es: string;
  unidadEsperada: string | null;
  /** Si suma al consumo total de energía del cliente. */
  esEnergia: boolean;
}

export const MAGNITUDES: DefMagnitud[] = [
  { id: 'consumo', titulo: 'Consumo comprado', unidadEsperada: 'kWh', esEnergia: true,
    que_es: 'Lo que entra de la red o del depósito. Es lo que se factura.' },
  { id: 'autoconsumo', titulo: 'Autoconsumo', unidadEsperada: 'kWh', esEnergia: true,
    que_es: 'Lo producido y consumido en el sitio, que no llega a pasar por el contador.' },
  { id: 'produccion', titulo: 'Producción', unidadEsperada: 'kWh', esEnergia: false,
    que_es: 'Lo que genera la instalación. Autoconsumo + excedentes.' },
  { id: 'excedentes', titulo: 'Excedentes vertidos', unidadEsperada: 'kWh', esEnergia: false,
    que_es: 'Lo producido que se va a la red.' },
  { id: 'reactiva', titulo: 'Energía reactiva', unidadEsperada: 'kVArh', esEnergia: false,
    que_es: 'No es consumo: es lo que se penaliza cuando el factor de potencia es malo.' },
  { id: 'potencia_max', titulo: 'Potencia máxima', unidadEsperada: 'kW', esEnergia: false,
    que_es: 'El maxímetro del periodo. Manda sobre cualquier promedio de la curva.' },
  { id: 'coste', titulo: 'Coste', unidadEsperada: '€', esEnergia: false,
    que_es: 'Lo pagado en ese periodo. No es energía y no entra en los indicadores de kWh.' },
  { id: 'variable_actividad', titulo: 'Variable de actividad', unidadEsperada: null, esEnergia: false,
    que_es: 'Contra qué se normaliza: plazas, toneladas, cabezas, m². Es el denominador del IDEn.' },
];

export const MAGNITUD = Object.fromEntries(MAGNITUDES.map((m) => [m.id, m])) as Record<Magnitud, DefMagnitud>;

// ── Conversión a kWh ────────────────────────────────────────────────────────

export interface Conversion {
  kwh: number | null;
  /** El factor aplicado. Se GUARDA junto al valor: ver la idea 2 de la cabecera. */
  factor: number | null;
  /** Por qué no se ha podido convertir, o qué hay que mirar. */
  aviso: string | null;
}

/**
 * Pasa una medida a kWh para poder sumarla con las de otros vectores.
 *
 * NO ADIVINA. Si la unidad no es la que se espera para ese vector, devuelve
 * null y lo dice, en vez de aplicar un factor que probablemente no toque.
 * Convertir mal aquí es peor que no convertir: un total de energía inflado no
 * lo detecta nadie, porque no hay con qué compararlo.
 */
export function aKwh(
  valor: number,
  unidad: string,
  vector: Vector,
  factores: Partial<Record<Vector, number>> = {}
): Conversion {
  if (!Number.isFinite(valor)) return { kwh: null, factor: null, aviso: 'El valor no es un número.' };

  const u = unidad.trim().toLowerCase();
  const def = VECTOR[vector];
  if (!def) return { kwh: null, factor: null, aviso: `Vector desconocido: ${vector}.` };

  // Ya viene en energía.
  if (u === 'kwh') return { kwh: valor, factor: 1, aviso: null };
  if (u === 'mwh') return { kwh: valor * 1000, factor: 1000, aviso: null };

  const esperada = def.unidadHabitual.toLowerCase();
  const factor = factores[vector] ?? def.kwhPorUnidad;

  if (factor == null) {
    return { kwh: null, factor: null,
      aviso: `${def.titulo} se mide en ${def.unidadHabitual} y ha llegado en «${unidad}». Sin factor de conversión no se puede pasar a kWh.` };
  }
  if (u !== esperada) {
    return { kwh: null, factor: null,
      aviso: `Se esperaba ${def.unidadHabitual} para ${def.titulo} y ha llegado «${unidad}». No se convierte a ojo: revísalo.` };
  }

  return {
    kwh: valor * factor,
    factor,
    // El aviso sale SIEMPRE cuando se ha aplicado un factor de referencia, no
    // solo cuando falla algo. Es la misma regla que `AvisoConsumo`: leer cómo
    // se ha entendido el número, debajo del propio número, es lo que evita la
    // equivocación.
    aviso: `Convertido con ${factor} kWh por ${def.unidadHabitual} (valor de referencia, pendiente de validar con factura).`,
  };
}

// ── Cobertura de datos ──────────────────────────────────────────────────────

export interface PeriodoMedido {
  periodo_inicio: string;
  periodo_fin: string;
}

export interface Cobertura {
  /** Días del intervalo pedido que tienen dato. */
  diasCubiertos: number;
  diasTotales: number;
  pct: number;
  /** Los tramos que faltan, para poder pedirlos. */
  huecos: { desde: string; hasta: string; dias: number }[];
  /**
   * Si se puede dar una cifra anual. La regla del documento: «Cobertura
   * parcial. No mostrar consumo anual».
   */
  sePuedeAnualizar: boolean;
  /** Por qué no, dicho en una frase. */
  motivo: string | null;
}

/** Por debajo de esto, un año no se estima: se dice que faltan datos. */
export const DIAS_MINIMOS_ANUAL = 300;

const dia = 86400000;
const aFecha = (s: string) => new Date(`${String(s).slice(0, 10)}T00:00:00`);

/**
 * Cuánto del intervalo pedido está de verdad medido.
 *
 * SOLAPES: dos facturas que se pisan no cuentan doble. Contar días dos veces
 * daría coberturas del 120 % y, peor, haría creer que hay dato donde no lo hay.
 *
 * HUECOS: se devuelven con sus fechas para poder pedírselos al cliente. Un
 * hueco NUNCA se rellena con cero — un cero es una afirmación («ese mes no
 * consumió») y lo que hay es una ausencia.
 */
export function cobertura(
  medidas: PeriodoMedido[],
  desde: string,
  hasta: string
): Cobertura {
  const ini = aFecha(desde).getTime();
  const fin = aFecha(hasta).getTime();
  const diasTotales = Math.max(0, Math.round((fin - ini) / dia) + 1);
  if (diasTotales === 0) {
    return { diasCubiertos: 0, diasTotales: 0, pct: 0, huecos: [],
      sePuedeAnualizar: false, motivo: 'El intervalo pedido está vacío.' };
  }

  // Recortar al intervalo y ordenar, para poder fusionar solapes.
  const tramos = medidas
    .map((m) => ({
      a: Math.max(ini, aFecha(m.periodo_inicio).getTime()),
      b: Math.min(fin, aFecha(m.periodo_fin).getTime()),
    }))
    .filter((t) => Number.isFinite(t.a) && Number.isFinite(t.b) && t.b >= t.a)
    .sort((x, y) => x.a - y.a);

  const fusionados: { a: number; b: number }[] = [];
  for (const t of tramos) {
    const ultimo = fusionados[fusionados.length - 1];
    // Se fusionan también los que se tocan (un día de separación), porque una
    // factura que acaba el 31 y otra que empieza el 1 no dejan un hueco real.
    if (ultimo && t.a <= ultimo.b + dia) ultimo.b = Math.max(ultimo.b, t.b);
    else fusionados.push({ ...t });
  }

  const diasCubiertos = fusionados.reduce((s, t) => s + Math.round((t.b - t.a) / dia) + 1, 0);

  const huecos: Cobertura['huecos'] = [];
  let cursor = ini;
  for (const t of fusionados) {
    if (t.a > cursor) {
      huecos.push({
        desde: new Date(cursor).toISOString().slice(0, 10),
        hasta: new Date(t.a - dia).toISOString().slice(0, 10),
        dias: Math.round((t.a - cursor) / dia),
      });
    }
    cursor = Math.max(cursor, t.b + dia);
  }
  if (cursor <= fin) {
    huecos.push({
      desde: new Date(cursor).toISOString().slice(0, 10),
      hasta: new Date(fin).toISOString().slice(0, 10),
      dias: Math.round((fin - cursor) / dia) + 1,
    });
  }

  const pct = Math.round((diasCubiertos / diasTotales) * 1000) / 10;
  const sePuedeAnualizar = diasCubiertos >= DIAS_MINIMOS_ANUAL;

  return {
    diasCubiertos, diasTotales, pct, huecos, sePuedeAnualizar,
    motivo: sePuedeAnualizar ? null
      : `Solo hay ${diasCubiertos} días medidos de ${diasTotales}. Con menos de ${DIAS_MINIMOS_ANUAL} no se da una cifra anual: se estimaría lo que falta y no se vería.`,
  };
}

// ── Catálogo de requisitos ISO ──────────────────────────────────────────────

export type Norma = '50002' | '50006' | '50015' | '50001';

export interface DefNorma {
  id: Norma;
  titulo: string;
  /** Para qué sirve, en una frase que se entienda sin haberla leído. */
  para_que: string;
}

/**
 * Las cuatro no son cuatro cosas: son cuatro capas de lo mismo, y todas piden
 * el mismo dato con su unidad, su periodo, su origen y quién lo aprobó.
 */
export const NORMAS: DefNorma[] = [
  { id: '50002', titulo: 'ISO 50002 · Auditoría energética',
    para_que: 'El diagnóstico: dónde se va la energía y qué se puede mejorar.' },
  { id: '50006', titulo: 'ISO 50006 · Indicadores y línea base',
    para_que: 'Contra qué se compara. Define el IDEn y la línea base.' },
  { id: '50015', titulo: 'ISO 50015 · Medición y verificación',
    para_que: 'Cómo se demuestra que el ahorro es real y no una estimación.' },
  { id: '50001', titulo: 'ISO 50001 · Sistema de gestión',
    para_que: 'Cómo se consigue que esto no se pare cuando nadie mira.' },
];

/** Dónde vive de verdad la evidencia de un requisito. */
export type DondeVive =
  | 'documento' | 'medida' | 'actuacion' | 'linea_base' | 'uso' | 'tarea';

export interface RequisitoISO {
  clave: string;
  norma: Norma;
  titulo: string;
  /** Qué pide la norma, en cristiano. */
  que_pide: string;
  /** En qué registro DEL SISTEMA se satisface. La clave de que no haya burocracia extra. */
  donde: DondeVive;
  /** A qué pantalla lleva el botón. */
  destino: string;
}

/**
 * EL CATÁLOGO. Cada línea dice a qué registro ya existente apunta la exigencia
 * de la norma — nunca a un formulario ISO aparte.
 *
 * Es intencionadamente CORTO. No es la norma entera: son los puntos que se
 * pueden sostener con lo que el sistema guarda de verdad. Meter los 40
 * requisitos de la 50001 aquí produciría una lista que nadie completa nunca,
 * y una lista que no se completa deja de mirarse — que es el fallo que este
 * módulo entero viene a evitar.
 */
export const REQUISITOS: RequisitoISO[] = [
  // ── 50002 · el diagnóstico ──
  { clave: '50002.alcance', norma: '50002', titulo: 'Alcance y límites',
    que_pide: 'Qué sedes y qué vectores entran en el análisis, y desde cuándo.',
    donde: 'documento', destino: 'expediente' },
  { clave: '50002.datos', norma: '50002', titulo: 'Datos de consumo',
    que_pide: 'Series de consumo con su origen y su periodo, no un total suelto.',
    donde: 'medida', destino: 'datos' },
  { clave: '50002.inventario', norma: '50002', titulo: 'Inventario de equipos',
    que_pide: 'Qué consume: equipos con su potencia y su régimen de uso.',
    donde: 'documento', destino: 'instalaciones' },
  { clave: '50002.usos', norma: '50002', titulo: 'Usos significativos',
    que_pide: 'Qué se lleva la mayor parte de la energía, y con qué criterio se decidió.',
    donde: 'uso', destino: 'instalaciones' },
  { clave: '50002.oportunidades', norma: '50002', titulo: 'Oportunidades de mejora',
    que_pide: 'Las mejoras detectadas, con su ahorro estimado y su inversión.',
    donde: 'actuacion', destino: 'actuaciones' },

  // ── 50006 · los indicadores ──
  { clave: '50006.variables', norma: '50006', titulo: 'Variables relevantes',
    que_pide: 'De qué depende el consumo: plazas, producción, clima, horas.',
    donde: 'medida', destino: 'datos' },
  { clave: '50006.iden', norma: '50006', titulo: 'Indicadores (IDEn)',
    que_pide: 'Qué se mide y contra qué se normaliza, con su unidad.',
    donde: 'linea_base', destino: 'indicadores' },
  { clave: '50006.linea_base', norma: '50006', titulo: 'Línea base energética',
    que_pide: 'El modelo del consumo y el periodo sobre el que se ajustó, aprobado por alguien.',
    donde: 'linea_base', destino: 'indicadores' },

  // ── 50015 · la verificación ──
  { clave: '50015.plan', norma: '50015', titulo: 'Plan de medición y verificación',
    que_pide: 'Cómo se va a comprobar el ahorro, decidido ANTES de ejecutar.',
    donde: 'documento', destino: 'actuaciones' },
  { clave: '50015.ajustes', norma: '50015', titulo: 'Ajustes registrados',
    que_pide: 'Qué cambió fuera del modelo y cómo se ajustó la línea base.',
    donde: 'linea_base', destino: 'indicadores' },
  { clave: '50015.resultado', norma: '50015', titulo: 'Ahorro verificado',
    que_pide: 'El ahorro comprobado contra la línea base, con quién lo verificó.',
    donde: 'actuacion', destino: 'actuaciones' },

  // ── 50001 · el sistema ──
  { clave: '50001.roles', norma: '50001', titulo: 'Responsabilidades',
    que_pide: 'Quién responde de qué. Un uso significativo sin responsable no se mejora.',
    donde: 'documento', destino: 'expediente' },
  { clave: '50001.objetivos', norma: '50001', titulo: 'Objetivos y metas',
    que_pide: 'A qué se compromete el cliente, con cifra y fecha.',
    donde: 'documento', destino: 'expediente' },
  { clave: '50001.plan', norma: '50001', titulo: 'Plan de acción',
    que_pide: 'Las actuaciones con responsable, plazo y recursos.',
    donde: 'actuacion', destino: 'actuaciones' },
  { clave: '50001.revision', norma: '50001', titulo: 'Revisión por la dirección',
    que_pide: 'Que alguien con mando mire los resultados y decida, con fecha.',
    donde: 'tarea', destino: 'seguimiento' },
];

export const REQUISITO = Object.fromEntries(REQUISITOS.map((r) => [r.clave, r])) as Record<string, RequisitoISO>;

/** Los requisitos de una norma, en el orden del catálogo. */
export function requisitosDe(norma: Norma): RequisitoISO[] {
  return REQUISITOS.filter((r) => r.norma === norma);
}

// ── Estado de las evidencias ────────────────────────────────────────────────

export interface EvidenciaGuardada {
  requisito: string;
  estado: string;
}

export interface EstadoRequisito {
  requisito: RequisitoISO;
  /** Cuántas evidencias hay puestas. */
  evidencias: number;
  /** Cuántas ha revisado una persona. */
  revisadas: number;
  /** Qué hacer ahora: la frase que se enseña. */
  siguiente: string;
  listo: boolean;
}

/**
 * Qué le falta a cada requisito.
 *
 * DEVUELVE FRASES, NO PORCENTAJES. Un «68 % de cumplimiento» invita a jugar
 * con el número y además miente: no existe el 68 % de una norma. Lo que se
 * puede decir con verdad es «falta la línea base aprobada», y eso además se
 * puede resolver.
 */
export function estadoISO(
  guardadas: EvidenciaGuardada[],
  normas: Norma[] = ['50002', '50006', '50015', '50001']
): EstadoRequisito[] {
  return REQUISITOS
    .filter((r) => normas.includes(r.norma))
    .map((r) => {
      const suyas = guardadas.filter((g) => g.requisito === r.clave && g.estado !== 'rechazada');
      const revisadas = suyas.filter((g) => g.estado === 'revisada').length;
      const caducadas = suyas.filter((g) => g.estado === 'caducada').length;

      let siguiente: string;
      if (suyas.length === 0) siguiente = `Falta: ${r.que_pide}`;
      else if (caducadas > 0) siguiente = 'La evidencia se sustituyó y hay que volver a revisarla.';
      else if (revisadas === 0) siguiente = 'Hay evidencia puesta, pero nadie la ha revisado todavía.';
      else siguiente = 'Colocado y revisado.';

      return {
        requisito: r,
        evidencias: suyas.length,
        revisadas,
        siguiente,
        listo: revisadas > 0 && caducadas === 0,
      };
    });
}

/**
 * Lo que falta, y nada más. Es la lista que sustituye al porcentaje: sirve
 * para trabajar, y un porcentaje no.
 */
export function loQueFaltaISO(guardadas: EvidenciaGuardada[], normas?: Norma[]): EstadoRequisito[] {
  return estadoISO(guardadas, normas).filter((e) => !e.listo);
}

/**
 * LA FRASE QUE VA SIEMPRE EN PANTALLA. No es decorativa: es la diferencia
 * entre una herramienta honesta y una que induce a error a quien la enseña a
 * un cliente.
 */
export const AVISO_NO_CERTIFICA =
  'Esto ordena y traza las evidencias: no acredita cumplimiento ni sustituye a una '
  + 'certificación, que la emite un organismo acreditado tras una auditoría.';
