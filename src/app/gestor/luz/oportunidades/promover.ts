'use client';

import { ProspectoGuardado, TIPO_PROSPECTO_LABEL } from '@/lib/prospeccion';
import { guardarLuz } from '../ui';

/**
 * PASAR UN OBJETIVO AL SISTEMA
 *
 * Un objetivo del mapa no es un cliente: es un sitio que hemos visto desde
 * arriba y creemos que interesa. Cuando se decide ir a por él, tiene que entrar
 * en el circuito normal de la casa, y eso son tres cosas a la vez:
 *
 *   1. FICHA DE CLIENTE  — para que exista y se le pueda seguir la pista.
 *   2. OPORTUNIDAD en el pipeline — para que cuente en el embudo y no se
 *      quede como un cliente suelto que nadie sabe en qué punto está.
 *   3. TAREA de visita — que es lo que hace que aparezca en la Agenda y en el
 *      Mi Día de David. Sin esto, la ficha se crea y nadie va nunca.
 *
 * Se hace de una vez y no en tres pantallas, porque el paso que se olvida
 * siempre es el tercero, y es justo el que provoca la visita.
 */

export interface ResultadoPromocion {
  error: string | null;
  /** Qué se llegó a crear, para poder decirlo con precisión. */
  cliente: boolean;
  pipeline: boolean;
  tarea: boolean;
}

/** Nombre con el que entra en la cartera si el mapa no le sabe uno. */
export function nombreSugerido(p: ProspectoGuardado): string {
  if (p.nombre) return p.nombre;
  if (p.catastro_direccion) return p.catastro_direccion;
  const tipo = TIPO_PROSPECTO_LABEL[p.tipo].replace(/^\S+\s/, '');
  return `${tipo} sin identificar${p.municipio ? ` · ${p.municipio}` : ''}`;
}

/** Un objetivo grande merece más atención que uno pequeño. */
function prioridadDe(p: ProspectoGuardado): string {
  if (p.n_edificios >= 5 || (p.consumo_estimado_kwh || 0) >= 150000) return 'A';
  if (p.n_edificios >= 3 || (p.consumo_estimado_kwh || 0) >= 50000) return 'B';
  return 'C';
}

/**
 * El tipo de oportunidad con el que entra al pipeline. Si tiene tejado y no
 * tiene placas, la conversación natural es la fotovoltaica —que es donde
 * ahora mismo hay mejor precio de montador—; si ya las tiene, queda el
 * cambio de comercializadora.
 */
function tipoOportunidad(p: ProspectoGuardado): string {
  if (p.ya_tiene_placas) return 'cambio_comercializadora';
  if ((p.consumo_estimado_kwh || 0) >= 100000) return 'alto_consumo';
  return 'derivacion_fotovoltaica';
}

export async function promoverACliente(
  p: ProspectoGuardado,
  opciones: { nombre?: string; responsable?: string; fechaVisita?: string } = {}
): Promise<ResultadoPromocion> {
  const salida: ResultadoPromocion = { error: null, cliente: false, pipeline: false, tarea: false };

  const nombre = (opciones.nombre || nombreSugerido(p)).trim();
  const responsable = opciones.responsable || 'David';

  const observaciones = [
    'Objetivo del mapa de oportunidades. Visto desde el aire, sin verificar sobre el terreno.',
    `${p.n_edificios} ${p.n_edificios === 1 ? 'nave' : 'naves'} · ${p.m2_construidos.toLocaleString('es-ES')} m² construidos${p.nave_largo ? ` · nave mayor ${p.nave_largo}×${p.nave_ancho} m` : ''}.`,
    ...(p.tiene_balsa ? ['Tiene balsa al lado: confirmar si es de purines (ganadería) o de riego.'] : []),
    ...(p.ya_tiene_placas ? ['⚠️ En el mapa ya figura con placas: comprobar antes de ofrecer nada.'] : []),
    ...(p.catastro_referencia
      ? [`Catastro ${p.catastro_referencia}: ${p.catastro_uso || 'uso sin declarar'}` +
         `${p.catastro_m2 ? `, ${p.catastro_m2.toLocaleString('es-ES')} m² construidos` : ''}` +
         `${p.catastro_anio ? `, de ${p.catastro_anio}` : ''}.`]
      : []),
    ...(p.notas ? [`Notas: ${p.notas}`] : []),
  ].join('\n· ');

  // ── 1. La ficha ──
  const errCliente = await guardarLuz('clientes', 'POST', {
    nombre,
    tipo_cliente: p.tipo === 'industria' || p.tipo === 'nave' ? 'industria' : 'pyme',
    // Las coordenadas valen como ubicación: el planificador y Maps las entienden
    direccion_fiscal: p.catastro_direccion || `${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`,
    via_entrada: 'captacion',
    estado_comercial: 'detectado',
    prioridad: prioridadDe(p),
    responsable,
    potencial_comercial: p.consumo_estimado_kwh
      ? `Consumo estimado del orden de ${p.consumo_estimado_kwh.toLocaleString('es-ES')} kWh/año (por tipo y tamaño, sin factura).`
      : '',
    observaciones: `· ${observaciones}`,
  });
  if (errCliente) return { ...salida, error: errCliente };
  salida.cliente = true;

  // El POST no devuelve el id, así que se busca por nombre: es lo único que
  // tenemos y acaba de crearse, así que será el más reciente que coincida.
  const clienteId = await buscarClienteRecien(nombre);
  if (!clienteId) {
    return {
      ...salida,
      error: 'La ficha se ha creado, pero no he podido enlazarla con el pipeline. Búscala en Clientes Energía y añádele la oportunidad a mano.',
    };
  }

  // ── 2. La oportunidad en el pipeline ──
  const errPipe = await guardarLuz('pipeline', 'POST', {
    cliente_id: clienteId,
    nombre_oportunidad: `${nombre} · captación`,
    tipo_oportunidad: tipoOportunidad(p),
    estado: 'prospecto',
    responsable,
    consumo_anual_kwh: p.consumo_estimado_kwh || null,
    proxima_accion: 'Visitar y pedir la factura',
    observaciones: 'Creada al pasar el objetivo desde el mapa de oportunidades.',
  });
  if (!errPipe) salida.pipeline = true;

  // ── 3. La tarea, que es la que provoca la visita ──
  const errTarea = await guardarLuz('tareas', 'POST', {
    cliente_id: clienteId,
    tipo_tarea: 'pedir_factura',
    descripcion: `Visitar ${nombre} y pedir la factura de la luz`,
    notas: p.tiene_balsa
      ? 'Al llegar: confirmar de qué es la explotación (la balsa dice si hay purines) y cuántas naves están en uso.'
      : 'Al llegar: confirmar qué actividad es y si el tejado está libre.',
    responsable,
    fecha_limite: opciones.fechaVisita || null,
    estado: 'pendiente',
    prioridad: prioridadDe(p),
  });
  if (!errTarea) salida.tarea = true;

  // ── 4. El objetivo queda marcado, para que no se vuelva a proponer ──
  await guardarLuz('prospectos', 'PUT', { id: p.id, estado: 'convertido', cliente_id: clienteId });

  // Si falló algo intermedio se dice, pero sin perder que la ficha SÍ está
  if (!salida.pipeline || !salida.tarea) {
    const faltan = [!salida.pipeline && 'la oportunidad del pipeline', !salida.tarea && 'la tarea de visita']
      .filter(Boolean).join(' ni ');
    salida.error = `La ficha del cliente se ha creado, pero no ${faltan}. Añádelo a mano desde su ficha.`;
  }
  return salida;
}

/** Busca el cliente recién creado por nombre exacto. */
async function buscarClienteRecien(nombre: string): Promise<string | null> {
  try {
    const { tokenSesion } = await import('@/lib/usuario');
    const token = await tokenSesion();
    const res = await fetch(`/api/luz/clientes?buscar=${encodeURIComponent(nombre)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const json = await res.json();
    const lista = (json.datos || []) as { id: string; nombre: string; creado_en?: string }[];
    const exactos = lista.filter((c) => c.nombre === nombre);
    if (!exactos.length) return null;
    // El más reciente: puede haber homónimos de antes
    exactos.sort((a, b) => (b.creado_en || '').localeCompare(a.creado_en || ''));
    return exactos[0].id;
  } catch {
    return null;
  }
}
