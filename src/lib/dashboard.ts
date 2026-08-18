/**
 * DASHBOARD DE DIRECCIÓN (GL-03) — un centro de mando, no un mural de cifras.
 *
 * El plan lo dice sin rodeos: «eliminar ocho tarjetas de KPI con el mismo peso,
 * nueve alertas rojas seguidas y contadores sin acción. El dashboard debe
 * mostrar decisiones, no inventario». Y fija el criterio de aceptación: Marcos
 * tiene que identificar en menos de diez segundos las cinco decisiones
 * prioritarias del día.
 *
 * DE DÓNDE SALE EL ORDEN
 *
 * El plan pide ordenar por «impacto económico, fecha y bloqueo». Eso son tres
 * cosas distintas y hay que decidir cuál manda, porque casi nunca coinciden.
 * Aquí manda LO QUE SE PIERDE PARA SIEMPRE si no se toca hoy:
 *
 *   1. Un preaviso que se cierra bloquea al cliente UN AÑO. No hay dinero que
 *      compense eso, porque no es que se gane menos: es que no se puede jugar.
 *   2. Un contrato firmado y sin activar es dinero YA vendido cayéndose. Lo
 *      peor de perderlo es que ya estaba hecho.
 *   3. Una propuesta enviada que nadie sigue se enfría sola.
 *   4. Un estudio que nos toca a nosotros: el cliente ya hizo su parte.
 *   5. Una factura que no llega.
 *
 * Dentro de cada escalón manda el dinero, y a igualdad de dinero, el tiempo
 * parado. Al revés —ordenar primero por importe— pondría arriba una comisión
 * grande que puede esperar y dejaría caducar un preaviso pequeño.
 *
 * NO HAY UN SEGUNDO CRITERIO DE URGENCIA. Los plazos salen de `seguimiento.ts`
 * y las etapas de `etapas.ts`. Si el dashboard tuviera su propia idea de qué
 * es urgente, diría una cosa y el Pipeline otra.
 */

import { etapaDeCliente, ETAPA, ETAPAS_EN_JUEGO, type Etapa } from './etapas.ts';
import { estaEnRojo, diasEntre, ultimoMovimiento } from './seguimiento.ts';

/** Los cinco tipos de decisión, de lo irrecuperable a lo que puede esperar. */
export type TipoPrioridad =
  | 'preaviso'
  | 'activacion'
  | 'propuesta'
  | 'estudio'
  | 'factura';

/**
 * Peso de cada tipo. Separados de sobra entre sí para que el dinero ordene
 * DENTRO de un escalón y nunca salte al de arriba: ninguna comisión debe
 * colarse por delante de un preaviso que se cierra.
 */
const PESO: Record<TipoPrioridad, number> = {
  preaviso: 5000,
  activacion: 4000,
  propuesta: 3000,
  estudio: 2000,
  factura: 1000,
};

export const TITULO_PRIORIDAD: Record<TipoPrioridad, string> = {
  preaviso: 'Se cierra la ventana de preaviso',
  activacion: 'Firmado y sin activar',
  propuesta: 'Propuesta sin respuesta',
  estudio: 'Falta preparar el estudio',
  factura: 'Sin la factura no se puede ofertar',
};

export interface Prioridad {
  clienteId: string;
  cliente: string;
  tipo: TipoPrioridad;
  titulo: string;
  /** El porqué, en una frase, con el número que lo justifica. */
  detalle: string;
  /** Comisión en juego, para que se vea qué hay detrás. */
  importe: number;
  puntos: number;
}

export interface EntradaCliente {
  id: string;
  nombre: string;
  estadoComercial?: string | null;
  telefono?: string | null;
  cups: {
    estado_cups: string;
    fecha_limite_preaviso?: string | null;
    consumo_anual_kwh?: number | null;
  }[];
  pipeline: { estado: string; comision_potencial?: number | null; actualizado_en?: string | null }[];
  contratos: { estado_contrato: string; fecha_firma?: string | null; fecha_activacion_real?: string | null }[];
  ultimoApunte?: string | null;
  ultimoContacto?: string | null;
}

/** Cuántas decisiones caben en la portada. El plan fija cinco. */
export const TOPE_PRIORIDADES = 5;

/**
 * Las decisiones del día.
 *
 * Un cliente aporta como mucho UNA línea: la de su problema más grave. Si
 * aportara una por cada cosa pendiente, el mismo nombre llenaría la lista de
 * cinco y taparía a los otros cuatro clientes que también se están cayendo.
 */
export function prioridadesDeHoy(clientes: EntradaCliente[], hoy: string, tope = TOPE_PRIORIDADES): Prioridad[] {
  const candidatas: Prioridad[] = [];

  for (const c of clientes) {
    const etapa = etapaDeCliente({
      estadoComercial: c.estadoComercial,
      pipeline: c.pipeline, cups: c.cups, contratos: c.contratos,
    });
    const importe = c.pipeline.reduce((s, o) => s + (Number(o.comision_potencial) || 0), 0);
    const movimiento = ultimoMovimiento([
      c.ultimoApunte, c.ultimoContacto, ...c.pipeline.map((o) => o.actualizado_en),
    ]);
    const parado = diasEntre(movimiento, hoy);

    const suyas: Prioridad[] = [];
    const nueva = (tipo: TipoPrioridad, detalle: string, extra = 0) => suyas.push({
      clienteId: c.id, cliente: c.nombre, tipo, titulo: TITULO_PRIORIDAD[tipo],
      detalle, importe, puntos: PESO[tipo] + extra,
    });

    // 1. Preaviso a punto de cerrarse. Lo único con fecha de caducidad real.
    const preavisos = c.cups
      .map((s) => (s.fecha_limite_preaviso ? diasEntre(hoy, String(s.fecha_limite_preaviso)) : null))
      .filter((d): d is number => d != null && d >= 0);
    if (preavisos.length) {
      const dias = Math.min(...preavisos);
      // Solo entra si de verdad aprieta: un preaviso a tres meses no es una
      // decisión de hoy, y meterlo aquí gastaría uno de los cinco huecos.
      if (dias <= 30) {
        // Cuanto menos queda, más arriba. Se resta para que quede por encima
        // dentro del mismo escalón sin salirse de él.
        nueva('preaviso', `Quedan ${dias} ${dias === 1 ? 'día' : 'días'} para poder cambiarlo`, 30 - dias);
      }
    }

    // 2. Firmado sin activar y pasado de plazo.
    if (etapa === 'activacion' && estaEnRojo('activacion', parado)) {
      nueva('activacion', `${parado} días desde la firma sin que conste la activación`, parado ?? 0);
    }

    // 3. Propuesta enviada que nadie ha seguido.
    if ((etapa === 'propuesta_enviada' || etapa === 'pendiente_decision') && estaEnRojo(etapa, parado)) {
      nueva('propuesta', `${parado} días sin saber qué le ha parecido`, parado ?? 0);
    }

    // 4. Estudio pendiente: el cliente ya hizo su parte.
    if (etapa === 'en_analisis' && estaEnRojo('en_analisis', parado)) {
      nueva('estudio', `Tenemos la factura desde hace ${parado} días`, parado ?? 0);
    }

    // 5. Factura que no llega.
    if (etapa === 'factura_solicitada' && estaEnRojo('factura_solicitada', parado)) {
      nueva('factura', `${parado} días esperando la factura`, parado ?? 0);
    }

    // Solo lo más grave de cada cliente.
    if (suyas.length) {
      candidatas.push(suyas.reduce((a, b) => (a.puntos >= b.puntos ? a : b)));
    }
  }

  return candidatas
    .sort((a, b) => b.puntos - a.puntos || b.importe - a.importe)
    .slice(0, tope);
}

// ── Las tres cifras de cabecera ─────────────────────────────────────────────

export interface Cabecera {
  requierenDecision: number;
  ahorroPropuesto: number;
  contratosPorCerrar: number;
  importePorCerrar: number;
}

/**
 * Lo que el plan pide arriba del todo: cuántas decisiones, cuánto ahorro
 * propuesto y cuántos contratos por cerrar. Tres cifras, no ocho.
 */
export function cabecera(clientes: EntradaCliente[], hoy: string): Cabecera {
  // «Requieren decisión» no es el total de la cartera: es lo que está en rojo.
  // Un número grande sin acción detrás es lo que el plan manda quitar.
  const enRojo = prioridadesDeHoy(clientes, hoy, Number.MAX_SAFE_INTEGER);

  let ahorro = 0;
  let porCerrar = 0;
  let importePorCerrar = 0;

  for (const c of clientes) {
    const etapa = etapaDeCliente({
      estadoComercial: c.estadoComercial,
      pipeline: c.pipeline, cups: c.cups, contratos: c.contratos,
    });
    const importe = c.pipeline.reduce((s, o) => s + (Number(o.comision_potencial) || 0), 0);

    // Ahorro propuesto = lo que hay encima de la mesa del cliente ahora mismo.
    if (etapa === 'propuesta_enviada' || etapa === 'pendiente_decision') ahorro += importe;
    // Por cerrar = dicho que sí y pendiente de papeles o de activación.
    if (etapa === 'pendiente_firma' || etapa === 'activacion') {
      porCerrar++;
      importePorCerrar += importe;
    }
  }

  return {
    requierenDecision: enRojo.length,
    ahorroPropuesto: ahorro,
    contratosPorCerrar: porCerrar,
    importePorCerrar,
  };
}

// ── Pipeline por etapas ─────────────────────────────────────────────────────

export interface EtapaConValor {
  etapa: Etapa;
  titulo: string;
  tono: string;
  clientes: number;
  importe: number;
}

/**
 * El embudo con su valor, que es lo que el plan pide: «mostrar conversión y
 * valor potencial, no una colección de tarjetas».
 */
export function embudo(clientes: EntradaCliente[], etapas: Etapa[]): EtapaConValor[] {
  return etapas.map((id) => {
    const suyos = clientes.filter((c) => etapaDeCliente({
      estadoComercial: c.estadoComercial,
      pipeline: c.pipeline, cups: c.cups, contratos: c.contratos,
    }) === id);
    return {
      etapa: id,
      titulo: ETAPA[id].titulo,
      tono: ETAPA[id].tono,
      clientes: suyos.length,
      importe: suyos.reduce((s, c) => s + c.pipeline.reduce((t, o) => t + (Number(o.comision_potencial) || 0), 0), 0),
    };
  });
}

// ── Vencimientos ────────────────────────────────────────────────────────────

export interface Vencimiento {
  clienteId: string;
  cliente: string;
  dias: number;
  tramo: 30 | 60 | 90;
}

/**
 * Vencimientos por tramos, «solo los que requieren decisión o preaviso».
 *
 * Lo ya activado no entra: su fecha de fin es información del contrato, no una
 * decisión pendiente. Meterlo llenaría el bloque de clientes con los que no
 * hay nada que hacer.
 */
export function vencimientos(clientes: EntradaCliente[], hoy: string): Vencimiento[] {
  const salida: Vencimiento[] = [];
  for (const c of clientes) {
    const dias = c.cups
      .map((s) => (s.fecha_limite_preaviso ? diasEntre(hoy, String(s.fecha_limite_preaviso)) : null))
      .filter((d): d is number => d != null && d >= 0);
    if (!dias.length) continue;
    const d = Math.min(...dias);
    if (d > 90) continue;
    salida.push({
      clienteId: c.id, cliente: c.nombre, dias: d,
      tramo: d <= 30 ? 30 : d <= 60 ? 60 : 90,
    });
  }
  return salida.sort((a, b) => a.dias - b.dias);
}

// ── Alertas de calidad ──────────────────────────────────────────────────────

export interface AlertaCalidad {
  texto: string;
  cuantos: number;
  /** A dónde ir a arreglarlo. Una alerta sin destino no se arregla. */
  href: string;
}

/** El plan fija tres como máximo. */
export const TOPE_ALERTAS = 3;

/**
 * Datos que faltan y BLOQUEAN TRABAJO REAL.
 *
 * La diferencia con un informe de calidad de datos es esa: aquí no entra que
 * falte un email, porque no impide hacer nada. Entra lo que deja a alguien
 * parado. Y salen las tres peores, no todas: nueve alertas rojas seguidas es
 * exactamente lo que el plan manda quitar.
 */
export function alertasCalidad(clientes: EntradaCliente[], tope = TOPE_ALERTAS): AlertaCalidad[] {
  let sinTelefono = 0;
  let sinConsumo = 0;
  let contratosDescuadrados = 0;

  for (const c of clientes) {
    const etapa = etapaDeCliente({
      estadoComercial: c.estadoComercial,
      pipeline: c.pipeline, cups: c.cups, contratos: c.contratos,
    });
    // Sin teléfono no se puede reclamar nada: es el bloqueo más tonto y el más
    // caro, porque el trabajo de llegar hasta ahí ya está hecho.
    if (!c.telefono && (etapa === 'factura_solicitada' || etapa === 'detectado')) sinTelefono++;
    // Sin consumo no hay oferta posible. Solo cuenta en clientes vivos: un
    // suministro sin consumo de alguien perdido no bloquea nada.
    if (ETAPAS_EN_JUEGO.includes(etapa)) {
      sinConsumo += c.cups.filter((s) => !Number(s.consumo_anual_kwh)).length;
    }
    for (const k of c.contratos) {
      if ((k.fecha_activacion_real && k.estado_contrato !== 'activado')
        || (k.fecha_firma && ['pendiente_preparar', 'enviado_cliente', 'pendiente_firma'].includes(k.estado_contrato))) {
        contratosDescuadrados++;
      }
    }
  }

  return [
    { texto: 'clientes sin teléfono a los que hay que reclamar algo', cuantos: sinTelefono, href: '/gestor/luz/rellenar' },
    { texto: 'suministros dados de alta sin datos de consumo', cuantos: sinConsumo, href: '/gestor/luz/cups' },
    { texto: 'contratos con la fecha puesta y el estado sin actualizar', cuantos: contratosDescuadrados, href: '/gestor/luz/contratos' },
  ]
    .filter((a) => a.cuantos > 0)
    .sort((a, b) => b.cuantos - a.cuantos)
    .slice(0, tope);
}
