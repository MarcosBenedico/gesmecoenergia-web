/**
 * LA BANDEJA DE NICOLA.
 *
 * David tiene Mi Día y Marcos tiene el mapa y el dashboard. Nicola tenía nueve
 * pantallas y ninguna que dijera *qué hago ahora*: para saber qué le quedaba
 * pendiente tenía que abrirlas una a una y deducirlo.
 *
 * Y por ella pasa todo —lo que David manda al grupo, las facturas, las altas,
 * el papeleo de las activaciones—, así que si va atascada se para el resto por
 * buena que sea la captación.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL ORDEN NO ES POR FECHA, ES POR A QUIÉN BLOQUEA
 *
 * Una lista por fecha pone arriba lo viejo, no lo importante. Aquí manda quién
 * está parado esperando:
 *
 *   1. BLOQUEA LA VENTA   — David no puede ofertar hasta que esto se meta.
 *   2. BLOQUEA EL COBRO   — el trabajo está hecho pero el dinero no entra.
 *   3. ESPERANDO AL CLIENTE — le toca a él, pero hay que reclamar.
 *   4. LO SUYO            — sus tareas, que ya tienen su propia fecha.
 *
 * Dentro de cada grupo sí manda el tiempo parado: lo que lleva más tiempo
 * atascado sube, porque es lo que más está costando.
 * ─────────────────────────────────────────────────────────────────────────────
 * LO QUE NO ENTRA AQUÍ, Y ES LA MITAD DEL VALOR
 *
 * Esta bandeja existe para que el trabajo de calle salga bien, no para llevar
 * la cuenta de todo lo que falta. Así que lo que Nicola NO puede resolver, no
 * se le pone delante:
 *
 *   · Un precliente sin CUPS no es un atasco, es que todavía no nos ha dado la
 *     factura. Eso lo desbloquea David yendo, no ella tecleando.
 *   · Un suministro en «sin factura» y sin consumo, igual: no hay nada que
 *     escribir hasta que llegue el papel.
 *
 * Solo salen cuando el propio expediente dice que el dato ya debería estar, o
 * cuando el cliente está marcado como CLIENTE —o sea, que firmó— y aun así le
 * falta. Eso último es un descuadre de verdad.
 *
 * Y al revés: cuando alguien tiene visita esta semana, lo que le falte sube
 * cincuenta puntos y lo dice. Un consumo sin meter de un cliente al que nadie
 * va a ver puede esperar; el de uno al que David va el jueves, no, porque la
 * visita se hará igual y se hará mal.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Con extensión y separando los tipos, para que Node ejecute este archivo tal
// cual en los tests sin compilar nada (igual que en prospeccion.ts).
import type { LuzCliente, LuzComision, LuzContrato, LuzCups, LuzOportunidad, LuzTarea } from './luz.ts';
import { COMISION_PENDIENTE, TAREAS_ABIERTAS, diasHasta } from './luz.ts';

export type GrupoBandeja = 'bloquea_venta' | 'bloquea_cobro' | 'esperando_cliente' | 'mio';

/**
 * QUÉ CLASE DE TRABAJO ES.
 *
 * El grupo dice a quién bloquea; el tipo dice qué hay que hacer con las manos.
 * Sirve para ir por tandas: teclear ocho consumos seguidos se hace en la mitad
 * de tiempo que ir saltando de meter datos a llamar por teléfono y volver.
 */
export type TipoTrabajo = 'meter_datos' | 'preparar' | 'tramitar' | 'reclamar' | 'resolver' | 'tarea';

export const TIPOS_TRABAJO: { clave: TipoTrabajo; texto: string; emoji: string }[] = [
  { clave: 'meter_datos', texto: 'Meter datos', emoji: '⌨️' },
  { clave: 'preparar', texto: 'Preparar ofertas', emoji: '📊' },
  { clave: 'tramitar', texto: 'Tramitar', emoji: '📨' },
  { clave: 'reclamar', texto: 'Reclamar', emoji: '📞' },
  { clave: 'resolver', texto: 'Incidencias', emoji: '⚠️' },
  { clave: 'tarea', texto: 'Mis tareas', emoji: '📋' },
];

export interface DefGrupo {
  clave: GrupoBandeja;
  titulo: string;
  /** Por qué corre prisa, dicho en una frase. */
  porque: string;
  emoji: string;
  tono: string;
}

export const GRUPOS: DefGrupo[] = [
  {
    clave: 'bloquea_venta', titulo: 'Bloquea a David', emoji: '🚧',
    porque: 'No puede ofertar ni cerrar hasta que esto esté metido.',
    tono: 'border-red-500/40 bg-red-500/10 text-red-400',
  },
  {
    clave: 'bloquea_cobro', titulo: 'Bloquea el cobro', emoji: '💶',
    porque: 'El trabajo está hecho pero el dinero no ha entrado.',
    tono: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  },
  {
    clave: 'esperando_cliente', titulo: 'Esperando al cliente', emoji: '⏳',
    porque: 'Le toca a él, pero conviene recordárselo.',
    tono: 'border-blue-500/40 bg-blue-500/10 text-blue-400',
  },
  {
    clave: 'mio', titulo: 'Mis tareas', emoji: '📋',
    porque: 'Lo que tiene fecha y es suyo.',
    tono: 'border-border/50 bg-card/60 text-muted',
  },
];

export interface ItemBandeja {
  clave: string;
  grupo: GrupoBandeja;
  /** Qué clase de trabajo es, para hacerlo por tandas. */
  tipo: TipoTrabajo;
  /** De quién es. Es lo primero que se lee. */
  cliente: string;
  clienteId: string | null;
  /** Qué hay que hacer, en imperativo. */
  accion: string;
  /** Contexto corto, si aporta. */
  detalle?: string;
  /** Dónde se resuelve. */
  href: string;
  /** Días que lleva parado. null si no se puede saber. */
  dias: number | null;
  /** Para ordenar dentro del grupo. Más alto, más arriba. */
  peso: number;
}

/** Días desde una fecha pasada (0 si es hoy o futura). */
function diasParado(fecha?: string | null): number | null {
  if (!fecha) return null;
  const d = diasHasta(fecha);
  return d == null ? null : Math.max(0, -d);
}

interface Fuentes {
  clientes: LuzCliente[];
  cups: LuzCups[];
  pipeline: LuzOportunidad[];
  contratos: LuzContrato[];
  comisiones: LuzComision[];
  tareas: LuzTarea[];
  /** Quién mira la bandeja, para lo de "mis tareas". */
  persona?: string | null;
}

/** Un CUPS provisional no es un CUPS: se creó sin saberlo todavía. */
export const esCupsProvisional = (cups?: string | null) => !cups || cups.startsWith('PENDIENTE-');

/**
 * CUÁNDO NO TENER SUMINISTRO ES UN ATASCO — y cuándo es lo normal.
 *
 * Al principio esto salía para CUALQUIER cliente sin CUPS, y llenaba la bandeja
 * de gente a la que simplemente todavía no le hemos sacado la factura: recién
 * detectados en el mapa, visitados una vez, o a los que se la hemos pedido y no
 * la han dado. Eso no es trabajo de oficina pendiente, es el ritmo normal de la
 * calle, y enterraba lo que sí estaba parado de verdad.
 *
 * Solo es un atasco cuando el propio expediente dice que los datos ya tendrían
 * que estar: porque el cliente ha pasado de "documentación recibida" o porque
 * en el pipeline consta que la factura ya llegó. Ahí sí falta meterlo.
 */
const CLIENTE_YA_DEBERIA_TENER_CUPS = [
  'doc_recibida', 'en_analisis', 'pendiente_decision', 'contrato_tramite', 'activo',
];
const PIPELINE_YA_DEBERIA_TENER_CUPS = [
  'factura_recibida', 'doc_incompleta', 'pendiente_ofertar', 'oferta_enviada', 'pendiente_firma', 'ganado',
];

/**
 * LO MISMO CON EL CONSUMO.
 *
 * El consumo se saca de la factura. Si la factura no ha llegado, no hay nada
 * que teclear, y pedírselo a Nicola es mandarla a una pared: eso lo desbloquea
 * David yendo a por el papel, no ella delante del ordenador.
 *
 * Así que solo se reclama cuando el suministro ya ha pasado de «sin factura».
 */
const CUPS_SIN_FACTURA_TODAVIA = ['sin_factura'];

/**
 * A CUÁNTOS DÍAS VISTA CUENTA COMO «DAVID VA A IR».
 *
 * Una semana. Si tiene la visita el jueves y hoy es lunes, lo que le falte a
 * ese cliente deja de ser un dato pendiente y pasa a ser una urgencia: si no
 * está el jueves por la mañana, David se planta allí con las manos vacías y esa
 * visita se ha perdido.
 */
const DIAS_VISITA_CERCA = 7;

export function construirBandeja(f: Fuentes): ItemBandeja[] {
  const items: ItemBandeja[] = [];
  const nombreDe = new Map(f.clientes.map((c) => [c.id, c.nombre]));
  const cupsDe = new Map<string, LuzCups[]>();
  for (const s of f.cups) {
    const l = cupsDe.get(s.cliente_id);
    if (l) l.push(s); else cupsDe.set(s.cliente_id, [s]);
  }

  // ── 1. BLOQUEA LA VENTA ──

  // Clientes con una oportunidad que ya dice que tenemos la factura
  const conFacturaEnPipeline = new Set(
    f.pipeline.filter((o) => PIPELINE_YA_DEBERIA_TENER_CUPS.includes(o.estado)).map((o) => o.cliente_id).filter(Boolean) as string[]
  );

  /**
   * A QUIÉN VA A VER ALGUIEN ESTA SEMANA.
   *
   * Es lo que le da sentido a esta bandeja: el trabajo de oficina no vale por
   * sí mismo, vale porque permite que el de calle salga bien. Un consumo sin
   * meter de un cliente al que nadie va a ver puede esperar; el de uno al que
   * David tiene visita el jueves no puede, porque si no está, la visita se hace
   * igual y se hace mal.
   */
  const visitaCerca = new Set<string>();
  const anotarSiEstaCerca = (clienteId?: string | null, fecha?: string | null) => {
    if (!clienteId || !fecha) return;
    const d = diasHasta(fecha);
    if (d != null && d >= 0 && d <= DIAS_VISITA_CERCA) visitaCerca.add(clienteId);
  };
  for (const t of f.tareas) {
    if (!TAREAS_ABIERTAS.includes(t.estado)) continue;
    anotarSiEstaCerca(t.cliente_id, t.fecha_limite);
  }
  for (const o of f.pipeline) anotarSiEstaCerca(o.cliente_id, o.fecha_proxima_accion);
  for (const c of f.clientes) anotarSiEstaCerca(c.id, c.fecha_proxima_accion);

  /** Sube el ítem y lo dice, cuando hay alguien a punto de plantarse allí. */
  const urgirSiHayVisita = (clienteId: string | null, item: { detalle: string; peso: number }) => {
    if (!clienteId || !visitaCerca.has(clienteId)) return item;
    return {
      detalle: `${item.detalle} HAY VISITA ESTA SEMANA: sin esto, se va con las manos vacías.`,
      peso: item.peso + 50,
    };
  };

  // Sin suministro, pero SOLO si el expediente dice que ya debería estar.
  // Que a un cliente recién captado no le hayamos sacado aún la factura no es
  // un atasco: es el ritmo normal de la calle.
  for (const c of f.clientes) {
    if (cupsDe.has(c.id)) continue;
    // Un CLIENTE es alguien que ha firmado. Que haya firmado y no tenga ni un
    // suministro metido es un descuadre de los gordos, mande lo que mande su
    // estado: por eso esta señal va aparte y pesa más que las otras dos.
    const esCliente = (c as { clasificacion?: string }).clasificacion === 'cliente';
    const porEstado = CLIENTE_YA_DEBERIA_TENER_CUPS.includes(c.estado_comercial || '');
    const porPipeline = conFacturaEnPipeline.has(c.id);
    if (!esCliente && !porEstado && !porPipeline) continue;
    items.push({
      clave: `sin-cups-${c.id}`, grupo: 'bloquea_venta', tipo: 'meter_datos',
      cliente: c.nombre, clienteId: c.id,
      accion: 'Darle de alta el suministro',
      href: `/gestor/luz/clientes/${c.id}`,
      dias: diasParado(c.creado_en?.slice(0, 10)),
      ...urgirSiHayVisita(c.id, {
        detalle: esCliente
          ? 'Está marcado como CLIENTE y no tiene ni un suministro. O falta meterlo, o no era cliente.'
          : porPipeline
            ? 'La oportunidad dice que ya tenemos la factura, pero no hay ningún CUPS metido.'
            : `Está en «${c.estado_comercial}» y no tiene ningún CUPS: a estas alturas debería.`,
        peso: esCliente ? 120 : 100,
      }),
    });
  }

  for (const s of f.cups) {
    const cliente = nombreDe.get(s.cliente_id) || 'Cliente';

    // CUPS provisional: se creó en la captura o en la puerta, falta el de verdad
    if (esCupsProvisional(s.cups)) {
      items.push({
        clave: `cups-prov-${s.id}`, grupo: 'bloquea_venta', tipo: 'meter_datos',
        cliente, clienteId: s.cliente_id,
        accion: 'Poner el CUPS real',
        href: `/gestor/luz/cups`,
        dias: diasParado(s.creado_en?.slice(0, 10)),
        ...urgirSiHayVisita(s.cliente_id, {
          detalle: 'Está como provisional: sin el CUPS no se puede contratar.',
          peso: 95,
        }),
      });
      continue; // sin CUPS real, lo del consumo es secundario
    }

    // Sin consumo no hay comparativa posible. Pero solo se reclama cuando la
    // factura ya ha llegado: si el suministro sigue en «sin factura», no hay
    // nada que teclear y esto lo desbloquea David trayendo el papel.
    // Tampoco se pide si el CUPS es provisional: ya tiene su propio aviso
    // arriba, y dos líneas para el mismo suministro es ruido.
    if (
      !Number(s.consumo_anual_kwh)
      && !CUPS_SIN_FACTURA_TODAVIA.includes(s.estado_cups || '')
      && !esCupsProvisional(s.cups)
    ) {
      items.push({
        clave: `cups-sin-consumo-${s.id}`, grupo: 'bloquea_venta', tipo: 'meter_datos',
        cliente, clienteId: s.cliente_id,
        accion: 'Meter el consumo anual',
        href: `/gestor/luz/cups`,
        dias: diasParado(s.creado_en?.slice(0, 10)),
        ...urgirSiHayVisita(s.cliente_id, {
          detalle: 'La factura ya llegó y falta pasar el consumo. Sin él David no puede ofertar.',
          peso: 90,
        }),
      });
    }
  }

  // Factura recibida esperando oferta: David está parado con el cliente caliente
  for (const o of f.pipeline) {
    if (o.estado !== 'factura_recibida' && o.estado !== 'pendiente_ofertar') continue;
    items.push({
      clave: `ofertar-${o.id}`, grupo: 'bloquea_venta', tipo: 'preparar',
      cliente: nombreDe.get(o.cliente_id || '') || o.nombre_oportunidad,
      clienteId: o.cliente_id,
      accion: 'Preparar la oferta',
      href: `/gestor/luz/pipeline`,
      dias: diasParado(o.creado_en?.slice(0, 10)),
      ...urgirSiHayVisita(o.cliente_id, {
        detalle: 'Ya tenemos la factura. Es cuando el cliente está más caliente.',
        peso: 85,
      }),
    });
  }

  // ── 2. BLOQUEA EL COBRO ──

  for (const c of f.contratos) {
    const cliente = nombreDe.get(c.cliente_id || '') || 'Cliente';

    // Firmado pero sin mandar: el cliente ya dijo que sí y nadie lo tramita
    if (c.estado_contrato === 'firmado') {
      items.push({
        clave: `enviar-comer-${c.id}`, grupo: 'bloquea_cobro', tipo: 'tramitar',
        cliente, clienteId: c.cliente_id,
        accion: 'Enviarlo a la comercializadora',
        detalle: 'Está firmado y sin tramitar: hasta que no entre, no hay activación ni comisión.',
        href: `/gestor/luz/contratos`,
        dias: diasParado(c.fecha_firma),
        peso: 80,
      });
    }

    // Activación prevista que ya pasó y sigue sin confirmar
    if (
      ['enviado_comercializadora', 'pendiente_validacion', 'pendiente_activacion'].includes(c.estado_contrato) &&
      c.fecha_activacion_prevista && !c.fecha_activacion_real &&
      (diasHasta(c.fecha_activacion_prevista) ?? 1) < 0
    ) {
      items.push({
        clave: `activacion-${c.id}`, grupo: 'bloquea_cobro', tipo: 'tramitar',
        cliente, clienteId: c.cliente_id,
        accion: 'Confirmar si ya está activado',
        detalle: 'La fecha prevista ya pasó y no consta la real.',
        href: `/gestor/luz/contratos`,
        dias: diasParado(c.fecha_activacion_prevista),
        peso: 75,
      });
    }

    // Incidencia abierta: se queda parado hasta que alguien la toque
    if (c.estado_contrato === 'incidencia') {
      items.push({
        clave: `incidencia-${c.id}`, grupo: 'bloquea_cobro', tipo: 'resolver',
        cliente, clienteId: c.cliente_id,
        accion: 'Resolver la incidencia',
        detalle: c.incidencia || 'Hay una incidencia abierta en el contrato.',
        href: `/gestor/luz/contratos`,
        dias: diasParado(c.actualizado_en?.slice(0, 10)),
        peso: 88,
      });
    }
  }

  // Comisión con fecha de cobro pasada y sin cobrar: dinero nuestro fuera
  for (const m of f.comisiones) {
    if (!COMISION_PENDIENTE.includes(m.estado_comision)) continue;
    if (!m.fecha_prevista_cobro || (diasHasta(m.fecha_prevista_cobro) ?? 1) >= 0) continue;
    items.push({
      clave: `comision-${m.id}`, grupo: 'bloquea_cobro', tipo: 'reclamar',
      cliente: nombreDe.get(m.cliente_id || '') || m.comercializadora || 'Comercializadora',
      clienteId: m.cliente_id,
      accion: 'Reclamar la comisión',
      detalle: `Se esperaba cobrar${m.importe_previsto ? ` ${Number(m.importe_previsto).toLocaleString('es-ES')} €` : ''} y no ha entrado.`,
      href: `/gestor/luz/comisiones`,
      dias: diasParado(m.fecha_prevista_cobro),
      peso: 70,
    });
  }

  // ── 3. ESPERANDO AL CLIENTE ──

  for (const c of f.contratos) {
    if (!['enviado_cliente', 'pendiente_firma'].includes(c.estado_contrato)) continue;
    const dias = diasParado(c.fecha_envio_contrato);
    items.push({
      clave: `firma-${c.id}`, grupo: 'esperando_cliente', tipo: 'reclamar',
      cliente: nombreDe.get(c.cliente_id || '') || 'Cliente',
      clienteId: c.cliente_id,
      accion: 'Reclamar la firma',
      detalle: dias != null ? `Enviado hace ${dias} ${dias === 1 ? 'día' : 'días'}.` : 'Pendiente de que lo firme.',
      href: `/gestor/luz/contratos`,
      dias,
      // Cuanto más lleva sin firmar, más se enfría: sube sola
      peso: 50 + Math.min(20, dias ?? 0),
    });
  }

  // ── 4. LO SUYO ──

  if (f.persona) {
    const suya = (r?: string | null) => (r || '').toLowerCase().includes(f.persona!.toLowerCase());
    for (const t of f.tareas) {
      if (t.estado === 'completada' || t.estado === 'cancelada') continue;
      if (!suya(t.responsable)) continue;
      const dias = diasParado(t.fecha_limite);
      items.push({
        clave: `tarea-${t.id}`, grupo: 'mio', tipo: 'tarea',
        cliente: nombreDe.get(t.cliente_id || '') || 'Sin cliente',
        clienteId: t.cliente_id,
        accion: t.descripcion,
        detalle: t.notas || undefined,
        href: `/gestor/luz/mi-dia`,
        dias,
        peso: 30 + Math.min(20, dias ?? 0),
      });
    }
  }

  // Dentro de cada grupo, primero lo que más pesa; a igual peso, lo más parado
  return items.sort((a, b) => b.peso - a.peso || (b.dias ?? 0) - (a.dias ?? 0));
}

/** Cuántos hay de cada clase de trabajo, para las pastillas de filtro. */
export function porTipoTrabajo(items: ItemBandeja[]): Record<TipoTrabajo, number> {
  const r = { meter_datos: 0, preparar: 0, tramitar: 0, reclamar: 0, resolver: 0, tarea: 0 };
  for (const i of items) r[i.tipo]++;
  return r;
}

/** Cuántos hay en cada grupo, para los contadores de arriba. */
export function resumenBandeja(items: ItemBandeja[]): Record<GrupoBandeja, number> {
  const r = { bloquea_venta: 0, bloquea_cobro: 0, esperando_cliente: 0, mio: 0 };
  for (const i of items) r[i.grupo]++;
  return r;
}
