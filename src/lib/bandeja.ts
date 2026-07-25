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
 */

// Con extensión y separando los tipos, para que Node ejecute este archivo tal
// cual en los tests sin compilar nada (igual que en prospeccion.ts).
import type { LuzCliente, LuzComision, LuzContrato, LuzCups, LuzOportunidad, LuzTarea } from './luz.ts';
import { COMISION_PENDIENTE, diasHasta } from './luz.ts';

export type GrupoBandeja = 'bloquea_venta' | 'bloquea_cobro' | 'esperando_cliente' | 'mio';

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

export function construirBandeja(f: Fuentes): ItemBandeja[] {
  const items: ItemBandeja[] = [];
  const nombreDe = new Map(f.clientes.map((c) => [c.id, c.nombre]));
  const cupsDe = new Map<string, LuzCups[]>();
  for (const s of f.cups) {
    const l = cupsDe.get(s.cliente_id);
    if (l) l.push(s); else cupsDe.set(s.cliente_id, [s]);
  }

  // ── 1. BLOQUEA LA VENTA ──

  // Cliente sin ningún suministro: no hay nada que estudiar
  for (const c of f.clientes) {
    if (cupsDe.has(c.id)) continue;
    if (['perdido', 'no_interesado', 'descartado'].includes(c.estado_comercial || '')) continue;
    items.push({
      clave: `sin-cups-${c.id}`, grupo: 'bloquea_venta',
      cliente: c.nombre, clienteId: c.id,
      accion: 'Darle de alta el suministro',
      detalle: 'No tiene ningún CUPS: sin él no se puede estudiar nada.',
      href: `/gestor/luz/clientes/${c.id}`,
      dias: diasParado(c.creado_en?.slice(0, 10)),
      peso: 100,
    });
  }

  for (const s of f.cups) {
    const cliente = nombreDe.get(s.cliente_id) || 'Cliente';

    // CUPS provisional: se creó en la captura o en la puerta, falta el de verdad
    if (esCupsProvisional(s.cups)) {
      items.push({
        clave: `cups-prov-${s.id}`, grupo: 'bloquea_venta',
        cliente, clienteId: s.cliente_id,
        accion: 'Poner el CUPS real',
        detalle: 'Está como provisional: sin el CUPS no se puede contratar.',
        href: `/gestor/luz/cups`,
        dias: diasParado(s.creado_en?.slice(0, 10)),
        peso: 95,
      });
      continue; // sin CUPS real, lo del consumo es secundario
    }

    // Sin consumo no hay comparativa posible
    if (!Number(s.consumo_anual_kwh)) {
      items.push({
        clave: `cups-sin-consumo-${s.id}`, grupo: 'bloquea_venta',
        cliente, clienteId: s.cliente_id,
        accion: 'Meter el consumo anual',
        detalle: 'Sin consumo no se puede comparar ni calcular el ahorro.',
        href: `/gestor/luz/cups`,
        dias: diasParado(s.creado_en?.slice(0, 10)),
        peso: 90,
      });
    }
  }

  // Factura recibida esperando oferta: David está parado con el cliente caliente
  for (const o of f.pipeline) {
    if (o.estado !== 'factura_recibida' && o.estado !== 'pendiente_ofertar') continue;
    items.push({
      clave: `ofertar-${o.id}`, grupo: 'bloquea_venta',
      cliente: nombreDe.get(o.cliente_id || '') || o.nombre_oportunidad,
      clienteId: o.cliente_id,
      accion: 'Preparar la oferta',
      detalle: 'Ya tenemos la factura. Es cuando el cliente está más caliente.',
      href: `/gestor/luz/pipeline`,
      dias: diasParado(o.creado_en?.slice(0, 10)),
      peso: 85,
    });
  }

  // ── 2. BLOQUEA EL COBRO ──

  for (const c of f.contratos) {
    const cliente = nombreDe.get(c.cliente_id || '') || 'Cliente';

    // Firmado pero sin mandar: el cliente ya dijo que sí y nadie lo tramita
    if (c.estado_contrato === 'firmado') {
      items.push({
        clave: `enviar-comer-${c.id}`, grupo: 'bloquea_cobro',
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
        clave: `activacion-${c.id}`, grupo: 'bloquea_cobro',
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
        clave: `incidencia-${c.id}`, grupo: 'bloquea_cobro',
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
      clave: `comision-${m.id}`, grupo: 'bloquea_cobro',
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
      clave: `firma-${c.id}`, grupo: 'esperando_cliente',
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
        clave: `tarea-${t.id}`, grupo: 'mio',
        cliente: nombreDe.get(t.cliente_id || '') || 'Sin cliente',
        clienteId: t.cliente_id,
        accion: t.descripcion,
        detalle: t.notas || undefined,
        href: `/gestor/luz/agenda`,
        dias,
        peso: 30 + Math.min(20, dias ?? 0),
      });
    }
  }

  // Dentro de cada grupo, primero lo que más pesa; a igual peso, lo más parado
  return items.sort((a, b) => b.peso - a.peso || (b.dias ?? 0) - (a.dias ?? 0));
}

/** Cuántos hay en cada grupo, para los contadores de arriba. */
export function resumenBandeja(items: ItemBandeja[]): Record<GrupoBandeja, number> {
  const r = { bloquea_venta: 0, bloquea_cobro: 0, esperando_cliente: 0, mio: 0 };
  for (const i of items) r[i.grupo]++;
  return r;
}
