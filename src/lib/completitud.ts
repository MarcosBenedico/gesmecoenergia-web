/**
 * ¿QUÉ LE FALTA A ESTE CLIENTE?
 *
 * Desde que existe la Captura rápida, entran clientes con tres datos: nombre,
 * teléfono y poco más. Eso es bueno —mejor dentro del panel que en un chat—
 * pero hace falta algo que diga de un vistazo a quién se le puede preparar
 * una oferta ya y a quién hay que reclamarle algo antes.
 *
 * No mide "calidad del cliente": mide si tenemos lo necesario para trabajarlo.
 */

import { LuzCliente, LuzCups } from './luz';

export interface RequisitoCliente {
  clave: string;
  etiqueta: string;
  /** Por qué hace falta, en una frase. Se enseña al pasar por encima. */
  motivo: string;
  cumplido: boolean;
  /** Sin esto no se puede ni empezar a estudiar el caso. */
  bloqueante: boolean;
}

export interface Completitud {
  requisitos: RequisitoCliente[];
  cumplidos: number;
  total: number;
  pct: number;
  /** Falta algo imprescindible: no se puede preparar oferta. */
  bloqueado: boolean;
  /** Lo primero que habría que conseguir. */
  siguienteFalta: RequisitoCliente | null;
}

/**
 * Evalúa a un cliente con los CUPS que tenga. `cupsDelCliente` debe venir ya
 * filtrado: esta función no consulta nada.
 */
export function evaluarCliente(cliente: LuzCliente, cupsDelCliente: LuzCups[]): Completitud {
  const conConsumo = cupsDelCliente.find((c) => Number(c.consumo_anual_kwh) > 0);
  const conVencimiento = cupsDelCliente.find((c) => !!c.fecha_fin_contrato);
  const conComercializadora = cupsDelCliente.find((c) => !!c.comercializadora_actual);
  // Un CUPS provisional (creado en la captura sin el dato real) no cuenta como tener CUPS
  const cupsReal = cupsDelCliente.find((c) => c.cups && !c.cups.startsWith('PENDIENTE-'));

  const requisitos: RequisitoCliente[] = [
    {
      clave: 'telefono',
      etiqueta: 'Teléfono',
      motivo: 'Sin teléfono no se le puede llamar ni escribir.',
      cumplido: !!cliente.telefono?.trim(),
      bloqueante: true,
    },
    {
      clave: 'cups',
      etiqueta: 'CUPS',
      motivo: 'Es el identificador del suministro: sin él no se puede contratar nada.',
      cumplido: !!cupsReal,
      bloqueante: true,
    },
    {
      clave: 'consumo',
      etiqueta: 'Consumo',
      motivo: 'Sin consumo anual no se puede calcular el ahorro ni comparar tarifas.',
      cumplido: !!conConsumo,
      bloqueante: true,
    },
    {
      clave: 'vencimiento',
      etiqueta: 'Fin de contrato',
      motivo: 'Marca cuándo se puede entrar sin penalización, y activa los avisos de la Agenda.',
      cumplido: !!conVencimiento,
      bloqueante: false,
    },
    {
      clave: 'comercializadora',
      etiqueta: 'Comercializadora',
      motivo: 'Saber a quién se le quita el cliente cambia el argumento de venta.',
      cumplido: !!conComercializadora,
      bloqueante: false,
    },
    {
      clave: 'ubicacion',
      etiqueta: 'Dirección',
      motivo: 'Sin dirección el cliente no entra en las rutas de visita.',
      cumplido: !!cliente.direccion_fiscal?.trim(),
      bloqueante: false,
    },
  ];

  const cumplidos = requisitos.filter((r) => r.cumplido).length;
  const pendientes = requisitos.filter((r) => !r.cumplido);

  return {
    requisitos,
    cumplidos,
    total: requisitos.length,
    pct: Math.round((cumplidos / requisitos.length) * 100),
    bloqueado: pendientes.some((r) => r.bloqueante),
    // Primero lo imprescindible; si no falta nada de eso, lo siguiente en la lista
    siguienteFalta: pendientes.find((r) => r.bloqueante) || pendientes[0] || null,
  };
}

/** Tono del semáforo: rojo si falta algo imprescindible, ámbar si falta detalle, verde si está listo. */
export function tonoCompletitud(c: Completitud): 'listo' | 'incompleto' | 'bloqueado' {
  if (c.bloqueado) return 'bloqueado';
  if (c.cumplidos < c.total) return 'incompleto';
  return 'listo';
}
