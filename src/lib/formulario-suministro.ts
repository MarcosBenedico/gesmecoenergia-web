/**
 * LA FICHA DEL SUMINISTRO: pestañas y formulario por bloques.
 *
 * Dos cosas que el documento de rediseño pide juntas, y que van juntas por el
 * mismo motivo que las vistas guardadas y las columnas del listado: por
 * separado no arreglan nada.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUÉ PESTAÑAS Y NO UNA PÁGINA LARGA
 *
 * Un suministro tiene veintitantos datos y se mira por cinco motivos muy
 * distintos: para saber qué le pasa, para corregir el punto, para mirar lo
 * que consume, para ver cómo va el contrato o para repasar lo que se ha
 * hecho con él. Puestos en una sola columna, quien entra a mirar una fecha
 * de preaviso se traga primero la dirección, la distribuidora y las
 * potencias. Y el dato que se busca todos los días —qué le pasa a esto—
 * queda al mismo nivel que la referencia catastral.
 *
 * LA PRIMERA PESTAÑA NO ES «DATOS», ES «QUÉ PASA». Ese es el orden que
 * importa: primero lo que hay que decidir, después el inventario.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUÉ EL FORMULARIO VA POR BLOQUES
 *
 * El alta de un CUPS eran veinte campos en una rejilla. Una rejilla se
 * rellena de arriba abajo sin pensar, y lo que sale es una ficha con todo
 * puesto y la mitad mal: la tarifa a ojo, el consumo tecleado del recuerdo y
 * la fecha de fin de contrato inventada — que es la que mueve el preaviso y
 * la que cuesta un año si se equivoca.
 *
 * Por bloques, cada uno con su porqué escrito, se puede parar después del
 * segundo y lo guardado sigue siendo verdad. Un dato que falta se ve; un
 * dato inventado, no.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LO ÚNICO OBLIGATORIO ES EL CUPS
 *
 * Un suministro apuntado en la puerta de una granja tiene tres datos, y
 * negarse a guardarlo hasta tenerlos todos es perder la visita entera. Todo
 * lo demás AVISA y no bloquea, igual que en `factura.ts`: se bloquea lo que
 * hace mentir a un cálculo, no lo que simplemente falta.
 */

import { leerConsumo, TARIFAS_ACCESO, TIPOS_CONTRATO } from './luz.ts';
import { leerTarifa, limitePreaviso } from './plantilla-consumos.ts';
import { TARIFA_INFO, numPeriodos } from './tarifas-base.ts';

// ── Pestañas ────────────────────────────────────────────────────────────────

export interface Pestana {
  clave: string;
  titulo: string;
  /** Para qué se abre. No es decoración: es lo que evita buscar en la que no es. */
  para: string;
}

/**
 * Las cinco, EN ORDEN DE CUÁNTAS VECES SE ABREN. «Qué pasa» primero porque
 * es la pregunta diaria; «Historial» al final porque se mira cuando algo ya
 * ha salido mal.
 */
export const PESTANAS: Pestana[] = [
  { clave: 'estado', titulo: 'Qué pasa', para: 'Fase, alerta, qué bloquea y qué toca hacer.' },
  { clave: 'punto', titulo: 'El punto', para: 'CUPS, dirección, tarifa, potencias y distribuidora.' },
  { clave: 'consumo', titulo: 'Consumo y coste', para: 'Lo que gasta al año y lo que le cuesta.' },
  { clave: 'contrato', titulo: 'Contrato', para: 'Comercializadora, fechas, permanencia y preaviso.' },
  { clave: 'historial', titulo: 'Historial', para: 'Tareas, visitas y lo que se ha ido tocando.' },
];

export const PESTANA_POR_DEFECTO = 'estado';

/** Una pestaña que no existe cae en la primera en vez de dejar la página en blanco. */
export function pestanaValida(clave: string | null | undefined): string {
  return PESTANAS.some((p) => p.clave === clave) ? clave! : PESTANA_POR_DEFECTO;
}

// ── Formulario por bloques ──────────────────────────────────────────────────

export type TipoCampo =
  | 'texto' | 'numero' | 'fecha' | 'select' | 'checkbox' | 'potencias' | 'textarea';

export interface Campo {
  clave: string;
  etiqueta: string;
  tipo: TipoCampo;
  /** Qué es y para qué sirve, en una línea. Se enseña bajo el campo. */
  ayuda?: string;
  /** Solo el CUPS. Ver la cabecera. */
  obligatorio?: boolean;
  opciones?: readonly string[];
  sufijo?: string;
  /** Se calcula solo pero se puede pisar a mano. */
  derivado?: boolean;
}

export interface BloqueFormulario {
  clave: string;
  titulo: string;
  /** POR QUÉ se piden estos datos. Sin esto, un bloque es una rejilla más. */
  porque: string;
  campos: Campo[];
}

/**
 * Los cuatro bloques, en el orden en que se consiguen los datos EN LA CALLE:
 * primero lo que se ve en la puerta, luego lo que pone la factura, luego lo
 * que hay que preguntar y por último lo interno. Ordenarlo por afinidad
 * temática (todas las fechas juntas, todos los números juntos) obligaría a
 * saltar de bloque con el papel en la mano.
 */
export const BLOQUES_SUMINISTRO: BloqueFormulario[] = [
  {
    clave: 'identificacion',
    titulo: 'Qué punto es',
    porque: 'Sin el CUPS no se puede tramitar nada: es lo único que identifica al suministro ante la distribuidora.',
    campos: [
      { clave: 'cups', etiqueta: 'CUPS', tipo: 'texto', obligatorio: true,
        ayuda: 'Empieza por ES y lleva 20 o 22 caracteres. Si no lo tienes todavía, déjalo como PENDIENTE-…' },
      { clave: 'alias_suministro', etiqueta: 'Nombre corto', tipo: 'texto',
        ayuda: 'Cómo lo llama el cliente: «la nave de arriba», «el pozo». Es lo que se lee en las listas.' },
      { clave: 'direccion_suministro', etiqueta: 'Dirección del suministro', tipo: 'texto',
        ayuda: 'La del punto, que no siempre es la fiscal. De aquí sale la zona para la ruta.' },
    ],
  },
  {
    clave: 'tecnico',
    titulo: 'Lo que pone la factura',
    porque: 'La tarifa decide cuántos periodos tiene todo lo demás. Si está mal, el coste sale a la mitad o al doble y no lo delata nada.',
    campos: [
      { clave: 'tarifa_acceso', etiqueta: 'Tarifa de acceso', tipo: 'select', opciones: TARIFAS_ACCESO,
        ayuda: 'Viene en la factura. 2.0TD son 2 periodos de potencia; 3.0TD y 6.1TD, 6.' },
      { clave: 'potencias_kw', etiqueta: 'Potencias contratadas', tipo: 'potencias', sufijo: 'kW',
        ayuda: 'Una por periodo, en el orden de la factura.' },
      { clave: 'distribuidora', etiqueta: 'Distribuidora', tipo: 'texto',
        ayuda: 'Quien mantiene la red. No se elige y no se cambia al cambiar de comercializadora.' },
      { clave: 'consumo_anual_kwh', etiqueta: 'Consumo anual', tipo: 'texto', sufijo: 'kWh',
        ayuda: 'Sin esto no se puede calcular ningún ahorro. Se puede escribir con punto de miles.' },
      { clave: 'coste_anual_estimado', etiqueta: 'Coste anual', tipo: 'numero', sufijo: '€',
        ayuda: 'Lo que paga hoy al año. Si no se sabe, se deja vacío: mejor un hueco que un número inventado.' },
    ],
  },
  {
    clave: 'contrato',
    titulo: 'Cómo está atado',
    porque: 'De aquí sale el preaviso, y un preaviso que se pasa bloquea al cliente UN AÑO. Es el dato más caro de toda la ficha.',
    campos: [
      { clave: 'comercializadora_actual', etiqueta: 'Comercializadora actual', tipo: 'texto',
        ayuda: 'Con quién tiene el contrato ahora.' },
      { clave: 'tipo_contrato', etiqueta: 'Tipo de contrato', tipo: 'select', opciones: TIPOS_CONTRATO },
      { clave: 'fecha_inicio_contrato', etiqueta: 'Inicio del contrato', tipo: 'fecha' },
      { clave: 'fecha_fin_contrato', etiqueta: 'Fin del contrato', tipo: 'fecha',
        ayuda: 'La fecha que lo mueve todo. Si no se sabe con certeza, es mejor dejarla vacía que aproximarla.' },
      { clave: 'dias_preaviso', etiqueta: 'Días de preaviso', tipo: 'numero', sufijo: 'días',
        ayuda: 'Con cuánta antelación hay que avisar para no renovar. Normalmente 30.' },
      { clave: 'fecha_limite_preaviso', etiqueta: 'Último día para preavisar', tipo: 'fecha', derivado: true,
        ayuda: 'Se calcula solo restando los días de preaviso al fin de contrato. Se puede corregir si el contrato dice otra cosa.' },
      { clave: 'tiene_permanencia', etiqueta: 'Tiene permanencia', tipo: 'checkbox' },
      { clave: 'fecha_fin_permanencia', etiqueta: 'Fin de la permanencia', tipo: 'fecha' },
      { clave: 'penalizacion', etiqueta: 'Penalización por salir', tipo: 'texto',
        ayuda: 'Lo que costaría irse antes de tiempo. Cambia si la oferta compensa o no.' },
    ],
  },
  {
    clave: 'gestion',
    titulo: 'Quién lo lleva',
    porque: 'Un expediente sin responsable no lo mueve nadie: es la regla madre de la cartera.',
    campos: [
      { clave: 'responsable', etiqueta: 'Responsable', tipo: 'texto' },
      { clave: 'observaciones', etiqueta: 'Observaciones', tipo: 'textarea',
        ayuda: 'Lo que hay que saber de este punto. Lo que ha pasado va en el historial, no aquí.' },
    ],
  },
];

/** Todos los campos del formulario, sin los bloques. */
export const CAMPOS_SUMINISTRO: Campo[] = BLOQUES_SUMINISTRO.flatMap((b) => b.campos);

/** El bloque al que pertenece un campo, para poder señalar dónde está el error. */
export function bloqueDe(clave: string): BloqueFormulario | null {
  return BLOQUES_SUMINISTRO.find((b) => b.campos.some((c) => c.clave === clave)) || null;
}

// ── Cuántas potencias pide cada tarifa ──────────────────────────────────────

/**
 * LO QUE EVITA EL ERROR CARO.
 *
 * Rellenar tres periodos de los seis que tiene una 3.0TD hace que el coste
 * actual salga a la mitad y el ahorro al doble, sin que nada lo delate. Es el
 * mismo fallo que resolvió tener una plantilla de Excel por tarifa: si el
 * formulario pinta exactamente las casillas que hay, el error no se puede
 * cometer.
 */
export function periodosDePotencia(tarifa: string | null | undefined): number {
  const t = leerTarifa(tarifa);
  return t ? numPeriodos(t).potencia : 1;
}

/** Cómo se llama cada periodo en esa tarifa (P1, P2…), para etiquetar las casillas. */
export function nombresDePeriodo(tarifa: string | null | undefined): string[] {
  const t = leerTarifa(tarifa);
  return t ? [...TARIFA_INFO[t].periodosPotencia] : ['P1'];
}

/**
 * Ajusta la lista de potencias al número de periodos de la tarifa.
 *
 * Al cambiar de 2.0TD a 3.0TD NO se borra lo que ya había: se conserva y se
 * añaden huecos. Vaciarlo obligaría a teclear otra vez lo que ya estaba bien
 * solo por haber corregido un desplegable, y eso es exactamente lo que hace
 * que la gente no corrija los desplegables.
 */
export function ajustarPotencias(potencias: unknown, tarifa: string | null | undefined): (number | null)[] {
  const n = periodosDePotencia(tarifa);
  const previas = Array.isArray(potencias) ? potencias : [];
  return Array.from({ length: n }, (_, i) => {
    const v = Number(previas[i]);
    return Number.isFinite(v) && v > 0 ? v : null;
  });
}

// ── Validación ──────────────────────────────────────────────────────────────

export interface Aviso {
  campo: string;
  texto: string;
  /** true = no se puede guardar. Solo el CUPS y lo que hace mentir a un cálculo. */
  bloquea: boolean;
}

export type ValoresSuministro = Record<string, unknown>;

const texto = (v: unknown) => String(v ?? '').trim();

/** Un CUPS de verdad: ES + 18 o 20 caracteres. Los provisionales se aceptan aparte. */
const FORMA_CUPS = /^ES[0-9A-Z]{16,20}$/i;
export const PREFIJO_PROVISIONAL = 'PENDIENTE-';
export const esProvisional = (cups: string) =>
  texto(cups).toUpperCase().startsWith(PREFIJO_PROVISIONAL);

/**
 * Lo que está mal y lo que solo falta, separado.
 *
 * La regla es la de `factura.ts`: BLOQUEA lo que haría mentir a un cálculo o
 * impediría tramitar; AVISA lo que simplemente no está. Que falte el consumo
 * no puede impedir guardar un suministro apuntado en la puerta — impide
 * ofertar, que es otra cosa y se dice en su sitio.
 */
export function revisarSuministro(v: ValoresSuministro): Aviso[] {
  const avisos: Aviso[] = [];
  const cups = texto(v.cups);

  if (!cups) {
    avisos.push({ campo: 'cups', texto: 'Sin CUPS no se puede identificar el suministro ante la distribuidora.', bloquea: true });
  } else if (!esProvisional(cups) && !FORMA_CUPS.test(cups.replace(/\s/g, ''))) {
    // No bloquea: hay CUPS antiguos y hay quien lo copia con la letra final
    // partida. Un formato raro es motivo de mirarlo, no de perder el alta.
    avisos.push({ campo: 'cups', texto: 'No tiene forma de CUPS (ES + 18 o 20 caracteres). Compruébalo contra la factura.', bloquea: false });
  } else if (esProvisional(cups)) {
    avisos.push({ campo: 'cups', texto: 'Es provisional: hasta que no esté el CUPS real no se puede contratar.', bloquea: false });
  }

  const tarifa = texto(v.tarifa_acceso);
  const n = periodosDePotencia(tarifa);
  const pots = (Array.isArray(v.potencias_kw) ? v.potencias_kw : [])
    .map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0);

  if (tarifa && pots.length && pots.length < n) {
    // ESTO SÍ BLOQUEA, y es el único cálculo que puede mentir en silencio:
    // con tres periodos de seis, el coste actual sale a la mitad.
    avisos.push({
      campo: 'potencias_kw',
      texto: `La ${tarifa} tiene ${n} periodos de potencia y solo hay ${pots.length}. Con los periodos a medias el coste sale a la mitad y el ahorro al doble.`,
      bloquea: true,
    });
  }

  // En 3.0TD y 6.1TD las potencias no pueden decrecer entre periodos. No
  // bloquea: se marca y se deja, que es lo que hace `factura.ts` con lo dudoso.
  if (n === 6 && pots.length === 6) {
    for (let i = 1; i < 6; i++) {
      if (pots[i] < pots[i - 1]) {
        avisos.push({
          campo: 'potencias_kw',
          texto: `En ${tarifa} la potencia no puede bajar de un periodo al siguiente (P${i} = ${pots[i - 1]} kW y P${i + 1} = ${pots[i]} kW). Revísalo en la factura.`,
          bloquea: false,
        });
        break;
      }
    }
  }

  // El consumo pasa por el MISMO lector que el resto de la aplicación: aquí
  // es donde entraban los «53.558» que se guardaban como 53 kWh.
  if (texto(v.consumo_anual_kwh)) {
    const c = leerConsumo(v.consumo_anual_kwh as string);
    if (c.sospechoso && c.motivo) {
      avisos.push({ campo: 'consumo_anual_kwh', texto: c.motivo, bloquea: false });
    }
  } else {
    avisos.push({ campo: 'consumo_anual_kwh', texto: 'Sin el consumo anual no se puede calcular ningún ahorro. Se puede guardar, pero no ofertar.', bloquea: false });
  }

  const fin = texto(v.fecha_fin_contrato);
  const ini = texto(v.fecha_inicio_contrato);
  if (fin && ini && fin < ini) {
    avisos.push({ campo: 'fecha_fin_contrato', texto: 'El contrato acabaría antes de empezar. Alguna de las dos fechas está mal.', bloquea: true });
  }
  if (!fin) {
    avisos.push({ campo: 'fecha_fin_contrato', texto: 'Sin el fin de contrato no hay preaviso, y sin preaviso este suministro no aparece en la Agenda.', bloquea: false });
  }

  if (v.tiene_permanencia === true && !texto(v.fecha_fin_permanencia)) {
    avisos.push({ campo: 'fecha_fin_permanencia', texto: 'Dice que tiene permanencia pero no hasta cuándo: así no se sabe si se le puede ofertar.', bloquea: false });
  }

  if (!texto(v.responsable)) {
    avisos.push({ campo: 'responsable', texto: 'Sin responsable no lo mueve nadie.', bloquea: false });
  }

  return avisos;
}

/** ¿Se puede guardar? */
export function sePuedeGuardar(avisos: Aviso[]): boolean {
  return !avisos.some((a) => a.bloquea);
}

/** Los avisos de un bloque concreto, para pintarlos donde están. */
export function avisosDelBloque(avisos: Aviso[], bloque: string): Aviso[] {
  return avisos.filter((a) => bloqueDe(a.campo)?.clave === bloque);
}

// ── Lo que se guarda ────────────────────────────────────────────────────────

/**
 * Convierte lo tecleado en lo que espera la base de datos.
 *
 * Dos cosas importan aquí:
 *
 *  · El consumo pasa por `leerConsumo`, nunca por `parseFloat`. En España el
 *    punto es separador de miles y `parseFloat('53.558')` da 53,558 — mil
 *    veces menos. Llegó a 57 CUPS antes de que alguien lo notara.
 *
 *  · Un campo vacío se manda como null, NUNCA como cadena vacía. Una cadena
 *    vacía en un vínculo lo rompe (`VINCULOS_PROTEGIDOS`), y en una fecha
 *    revienta el tipo `date` de Postgres.
 */
export function prepararSuministro(v: ValoresSuministro): Record<string, unknown> {
  const salida: Record<string, unknown> = {};

  for (const campo of CAMPOS_SUMINISTRO) {
    const bruto = v[campo.clave];

    if (campo.tipo === 'checkbox') { salida[campo.clave] = bruto === true; continue; }

    if (campo.tipo === 'potencias') {
      salida[campo.clave] = (Array.isArray(bruto) ? bruto : [])
        .map((x) => Number(x))
        .filter((x) => Number.isFinite(x) && x > 0);
      continue;
    }

    if (campo.clave === 'consumo_anual_kwh') {
      const t = texto(bruto);
      salida[campo.clave] = t ? leerConsumo(t).kwh : 0;
      continue;
    }

    if (campo.tipo === 'numero') {
      const t = texto(bruto).replace(',', '.');
      const n = Number(t);
      salida[campo.clave] = t && Number.isFinite(n) ? n : null;
      continue;
    }

    const t = texto(bruto);
    salida[campo.clave] = t === '' ? null : t;
  }

  return salida;
}

/**
 * El último día para preavisar, calculado desde el fin de contrato.
 *
 * Se propone y no se impone: hay contratos donde el preaviso cuenta distinto,
 * y sobrescribir lo que alguien puso a mano leyendo el contrato de verdad
 * sería cambiarle un dato por su cuenta. Devuelve null cuando no hay nada que
 * proponer, y también cuando lo que hay ya coincide.
 */
export function preavisoSugerido(v: ValoresSuministro): string | null {
  const fin = texto(v.fecha_fin_contrato);
  const dias = Number(v.dias_preaviso);
  if (!fin || !Number.isFinite(dias) || dias <= 0) return null;
  const propuesta = limitePreaviso(fin, dias);
  if (!propuesta) return null;
  return propuesta === texto(v.fecha_limite_preaviso).slice(0, 10) ? null : propuesta;
}

/** Los valores del formulario a partir de un suministro que ya existe. */
export function valoresDesde(cups: Record<string, unknown> | null): ValoresSuministro {
  const v: ValoresSuministro = {};
  for (const campo of CAMPOS_SUMINISTRO) {
    const bruto = cups?.[campo.clave];
    if (campo.tipo === 'checkbox') v[campo.clave] = bruto === true;
    else if (campo.tipo === 'potencias') v[campo.clave] = Array.isArray(bruto) ? bruto : [];
    else if (bruto == null) v[campo.clave] = '';
    else if (campo.tipo === 'fecha') v[campo.clave] = String(bruto).slice(0, 10);
    else v[campo.clave] = String(bruto);
  }
  v.potencias_kw = ajustarPotencias(v.potencias_kw, texto(v.tarifa_acceso));
  return v;
}

/**
 * Cuánto está relleno cada bloque, para poder enseñarlo en la cabecera.
 *
 * Un contador por bloque hace visible el hueco. Con la rejilla de veinte
 * campos, lo que faltaba no se veía: había que repasarla entera.
 */
export function completitudPorBloque(v: ValoresSuministro) {
  return BLOQUES_SUMINISTRO.map((b) => {
    const rellenos = b.campos.filter((c) => {
      const x = v[c.clave];
      if (c.tipo === 'checkbox') return x === true;
      if (c.tipo === 'potencias') return Array.isArray(x) && x.some((n) => Number(n) > 0);
      return texto(x) !== '';
    }).length;
    return { bloque: b.clave, titulo: b.titulo, rellenos, total: b.campos.length };
  });
}
