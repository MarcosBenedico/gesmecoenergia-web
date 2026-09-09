/**
 * Tests de la FICHA DE CLIENTE en cuatro pestañas.
 *
 *   npm run test:ficha-cliente
 *
 * Lo que se protege aquí:
 *
 *   · Un cliente con dos granjas ve DOS centros, y con una ve UNO — sin que
 *     nadie haya tenido que crear un «centro» a mano. El agrupamiento sale de
 *     la dirección del suministro, que ya está.
 *   · La misma dirección escrita de dos maneras NO son dos centros. Si lo
 *     fueran, un cliente con tres naves saldría con siete y la pestaña dejaría
 *     de servir.
 *   · UN TRABAJO SIN SIGUIENTE ACCIÓN VA PRIMERO, aunque su fase parezca
 *     tranquila. Es la regla madre: por ahí es por donde se cae un cliente.
 *   · El historial no mezcla «el cliente dijo que se lo piensa» con «se
 *     modificó el campo observaciones». Lo segundo se marca y se puede apagar.
 */
import {
  PESTANAS_CLIENTE, pestanaValidaCliente, claveDeDireccion, agruparEnCentros,
  CENTRO_SIN_DIRECCION, trabajosAbiertos, trabajosSinAccion, TONO_TRABAJO,
  historialDeCliente, agruparHistorialPorDia, cabeceraDeFicha,
} from '../src/lib/ficha-cliente.ts';

let ok = 0, fallos = 0;
const comprueba = (n, c, d = '') => {
  if (c) { ok++; console.log(`  ✓ ${n}`); }
  else { fallos++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`); }
};
const titulo = (t) => console.log(`\n${t}`);

const HOY = '2026-09-09';
const dia = (n) => {
  const x = new Date(`${HOY}T00:00:00`);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};

/** Un suministro sano al que cada test le rompe solo lo suyo. */
const sum = (o = {}) => ({
  id: o.id || 's1',
  cups: o.cups || 'ES0031406512345678AB',
  alias: o.alias === undefined ? 'Nave principal' : o.alias,
  direccion: o.direccion === undefined ? 'Ctra. de Toledo, km 12, 45520 Villaluenga (Toledo)' : o.direccion,
  tarifa: '3.0TD',
  comercializadora: 'IBERDROLA',
  estadoCups: o.estadoCups || 'activado',
  consumoAnual: o.consumoAnual === undefined ? 148200 : o.consumoAnual,
  potencias: [40, 40, 40, 40, 40, 40],
  fechaFinContrato: o.fechaFinContrato === undefined ? dia(200) : o.fechaFinContrato,
  fechaLimitePreaviso: o.preaviso === undefined ? dia(150) : o.preaviso,
  tareas: o.tareas || [],
  contratos: o.contratos || [],
});

// ── Pestañas ────────────────────────────────────────────────────────────────
titulo('Las cuatro pestañas y su orden');
{
  comprueba('son cuatro', PESTANAS_CLIENTE.length === 4);
  comprueba('la primera es el resumen', PESTANAS_CLIENTE[0].id === 'resumen');
  comprueba('cada una dice qué se viene a mirar',
    PESTANAS_CLIENTE.every((p) => p.pregunta.includes('?')));
  // Una pestaña guardada que ya no existe NO puede dejar la ficha en blanco.
  comprueba('una guardada que ya no existe degrada al resumen',
    pestanaValidaCliente('inventada') === 'resumen');
  comprueba('null también', pestanaValidaCliente(null) === 'resumen');
  comprueba('y una válida se respeta', pestanaValidaCliente('historial') === 'historial');
}

// ── Centros ─────────────────────────────────────────────────────────────────
titulo('La misma dirección escrita de dos maneras es UN centro');
{
  // Escritas por dos personas distintas, el mismo sitio.
  const a = claveDeDireccion('Ctra. de Toledo, km 12, 45520 Villaluenga (Toledo)');
  const b = claveDeDireccion('CTRA TOLEDO KM 12 - 45520 VILLALUENGA');
  comprueba('coinciden pese a acentos, mayúsculas y puntuación', a === b, `${a} / ${b}`);

  // Y dos kilómetros distintos NO se funden: son dos sitios de verdad.
  const c = claveDeDireccion('Ctra. de Toledo, km 30, 45520 Villaluenga');
  comprueba('kilómetros distintos siguen siendo dos centros', a !== c, `${a} / ${c}`);

  comprueba('sin dirección tiene su propia clave',
    claveDeDireccion('') === CENTRO_SIN_DIRECCION && claveDeDireccion(null) === CENTRO_SIN_DIRECCION);

  // El municipio y la provincia escritos o no escritos no parten el centro:
  // «45520 Villaluenga (Toledo)» y «45520 VILLALUENGA» son el mismo pueblo.
  comprueba('la provincia de más no parte el centro',
    claveDeDireccion('Ctra. de Toledo, km 12, 45520 Villaluenga (Toledo)')
      === claveDeDireccion('Ctra Toledo km 12, 45520 Villaluenga'));

  // DOS SITIOS DISTINTOS NUNCA SE FUNDEN. Fundirlos por listeza sería un fallo
  // silencioso; partir uno en dos se ve en pantalla y se corrige.
  comprueba('dos calles distintas del mismo pueblo son dos centros',
    claveDeDireccion('Camino del Soto, 8, 45520 Villaluenga')
      !== claveDeDireccion('Ctra. de Toledo, km 12, 45520 Villaluenga'));
  comprueba('el mismo número en pueblos distintos también',
    claveDeDireccion('Camino del Soto, 8, 45520 Villaluenga')
      !== claveDeDireccion('Camino del Soto, 8, 22500 Binéfar'));
}

titulo('Un cliente con dos granjas ve dos centros, sin crear ninguno');
{
  const centros = agruparEnCentros([
    sum({ id: 'a', alias: 'Nave principal' }),
    sum({ id: 'b', alias: 'Bombeo' }),
    sum({ id: 'c', alias: 'Oficina' }),
    sum({ id: 'd', alias: 'Nave 1', direccion: 'Camino del Soto, 8, 45520 Villaluenga (Toledo)' }),
    sum({ id: 'e', alias: 'Nave 2', direccion: 'CAMINO DEL SOTO 8 · 45520 Villaluenga' }),
  ], HOY);

  comprueba('salen dos centros', centros.length === 2, String(centros.length));
  comprueba('el de tres suministros va primero', centros[0].suministros.length === 3);
  comprueba('y el de dos después', centros[1].suministros.length === 2);
  comprueba('el nombre sale de la calle, no de un campo nuevo',
    /Toledo/i.test(centros[0].nombre), centros[0].nombre);
  comprueba('lleva el municipio legible', /45520/.test(centros[0].municipio || ''), String(centros[0].municipio));
}

titulo('Con un solo sitio sale UN centro, no cero');
{
  // La pantalla tiene que ser la misma tenga una nave o cinco: si con una no
  // hubiera centro, habría dos diseños distintos que mantener.
  const centros = agruparEnCentros([sum()], HOY);
  comprueba('un suministro, un centro', centros.length === 1);
  comprueba('y se llama como su alias', centros[0].nombre === 'Nave principal', centros[0].nombre);
}

titulo('Lo que no tiene dirección se dice y va al final');
{
  const centros = agruparEnCentros([
    sum({ id: 'x', direccion: null, alias: 'Suelto' }),
    sum({ id: 'a' }),
    sum({ id: 'b', alias: 'Bombeo' }),
  ], HOY);
  comprueba('el sin dirección existe como centro', centros.some((c) => c.clave === CENTRO_SIN_DIRECCION));
  comprueba('y va el último, que es un hueco que rellenar',
    centros[centros.length - 1].clave === CENTRO_SIN_DIRECCION, centros.map((c) => c.nombre).join(' | '));
  comprueba('no se queda sin nombre', centros[centros.length - 1].nombre === 'Sin dirección');
}

titulo('El centro cuenta cuántos suministros suyos reclaman algo');
{
  // Uno con el preaviso encima y otro tranquilo, en el mismo sitio.
  const centros = agruparEnCentros([
    sum({ id: 'a', preaviso: dia(5) }),
    sum({ id: 'b', alias: 'Bombeo' }),
  ], HOY);
  comprueba('un centro', centros.length === 1);
  comprueba('con una alerta contada', centros[0].conAlerta === 1, String(centros[0].conAlerta));
}

// ── Trabajos abiertos ───────────────────────────────────────────────────────
const entradaTrabajos = (o = {}) => {
  const suministros = o.suministros || [sum({ id: 's1' })];
  return {
    pipeline: o.pipeline || [],
    expedientes: o.expedientes || [],
    suministros,
    centros: agruparEnCentros(suministros, HOY),
    tareas: o.tareas || [],
  };
};

titulo('Un trabajo SIN siguiente acción va el primero de todos');
{
  const ts = trabajosAbiertos(entradaTrabajos({
    pipeline: [
      { id: 'p1', estado: 'oferta_enviada', nombre_oportunidad: 'Con tarea al día', cups_id: 's1' },
      { id: 'p2', estado: 'factura_solicitada', nombre_oportunidad: 'Sin nadie detrás', cups_id: 's1' },
    ],
    tareas: [{ pipeline_id: 'p1', descripcion: 'Llamar', fecha_limite: dia(2), responsable: 'A', estado: 'pendiente' }],
  }), HOY);

  comprueba('salen los dos', ts.length === 2, String(ts.length));
  // La regla madre: por ahí es por donde se cae un cliente, así que manda
  // sobre cualquier fase que parezca más avanzada.
  comprueba('el que no tiene acción va primero', ts[0].trabajo === 'Sin nadie detrás', ts[0].trabajo);
  comprueba('y su próximo paso es null, no una frase inventada', ts[0].proximoPaso === null);
  comprueba('se pinta como crítico', ts[0].tono === 'critico', ts[0].tono);
  comprueba('se pueden contar', trabajosSinAccion(ts) === 1, String(trabajosSinAccion(ts)));
}

titulo('Una acción vencida pesa más que una futura');
{
  const ts = trabajosAbiertos(entradaTrabajos({
    pipeline: [
      { id: 'p1', estado: 'oferta_enviada', nombre_oportunidad: 'Al día', cups_id: 's1' },
      { id: 'p2', estado: 'oferta_enviada', nombre_oportunidad: 'Vencida', cups_id: 's1' },
    ],
    tareas: [
      { pipeline_id: 'p1', fecha_limite: dia(5), responsable: 'A', estado: 'pendiente' },
      { pipeline_id: 'p2', fecha_limite: dia(-12), responsable: 'B', estado: 'pendiente' },
    ],
  }), HOY);
  comprueba('la vencida va antes', ts[0].trabajo === 'Vencida', ts[0].trabajo);
  comprueba('y lo dice en el «cuándo»', /Vencida hace 12/.test(ts[0].proximoPaso.cuando), ts[0].proximoPaso.cuando);
  comprueba('la que está en plazo no es crítica', ts[1].tono !== 'critico', ts[1].tono);
}

titulo('La situación NO es un vocabulario nuevo: sale de etapas.ts');
{
  const ts = trabajosAbiertos(entradaTrabajos({
    pipeline: [{ id: 'p1', estado: 'oferta_enviada', nombre_oportunidad: 'Renovación', cups_id: 's1' }],
    tareas: [{ pipeline_id: 'p1', fecha_limite: dia(3), responsable: 'A', estado: 'pendiente' }],
  }), HOY);
  // Si esta pantalla inventara sus propias fases, diría una cosa y el Pipeline
  // otra del mismo cliente y no habría forma de saber cuál creer.
  comprueba('usa el título de la etapa', ts[0].situacion === 'Propuesta enviada', ts[0].situacion);
}

titulo('Lo aparcado no se pinta como una urgencia');
{
  const ts = trabajosAbiertos(entradaTrabajos({
    pipeline: [{ id: 'p1', estado: 'revisar_adelante', nombre_oportunidad: 'Revisión eléctrica', cups_id: 's1' }],
  }), HOY);
  comprueba('sale como pausado', ts[0].tono === 'pausado', ts[0].tono);

  // Se vio mirando la pantalla: un aparcado sin tarea salía SEGUNDO de la
  // lista y en rojo, por encima de trabajos vivos, contradiciendo su propio
  // texto («parado a propósito»).
  const mezcla = trabajosAbiertos(entradaTrabajos({
    pipeline: [
      { id: 'p1', estado: 'revisar_adelante', nombre_oportunidad: 'Aparcada', cups_id: 's1' },
      { id: 'p2', estado: 'oferta_enviada', nombre_oportunidad: 'Viva', cups_id: 's1' },
    ],
    tareas: [{ pipeline_id: 'p2', fecha_limite: dia(4), responsable: 'A', estado: 'pendiente' }],
  }), HOY);
  comprueba('lo aparcado va DESPUÉS de lo vivo', mezcla[1].trabajo === 'Aparcada', mezcla.map((t) => t.trabajo).join(' | '));
  // Aparcar es una decisión: contarlo como descontrol llenaría el contador de
  // cosas que alguien ya decidió y dejaría de mirarse.
  comprueba('y NO cuenta como «sin acción»', trabajosSinAccion(ts) === 0);
}

titulo('Lo ganado y lo perdido ya no es un trabajo abierto');
{
  for (const estado of ['ganado', 'perdido']) {
    const ts = trabajosAbiertos(entradaTrabajos({
      pipeline: [{ id: 'p1', estado, nombre_oportunidad: 'X', cups_id: 's1' }],
    }), HOY);
    comprueba(`«${estado}» no sale en la lista`, ts.length === 0, String(ts.length));
  }
}

titulo('Cada tono lleva TEXTO además de color');
{
  // Con sol en la pantalla del móvil, un punto de color no se ve.
  comprueba('los cuatro tienen texto',
    Object.values(TONO_TRABAJO).every((t) => t.texto.length > 5));
  comprueba('y son cuatro', Object.keys(TONO_TRABAJO).length === 4);
}

// ── Historial ───────────────────────────────────────────────────────────────
titulo('El historial junta gestiones, documentos y acuerdos');
{
  const h = historialDeCliente({
    visitas: [{ id: 'v1', creado_en: `${HOY}T09:20:00Z`, resultado: 'me_dio_factura', notas: 'Estaba el hijo', responsable: 'David', proxima_visita: dia(30) }],
    documentos: [{ id: 'd1', titulo: 'Factura_agosto_2026.pdf', tipo: 'factura', creado_en: `${HOY}T10:35:00Z`, subido_por: 'David', estado: 'por_revisar' }],
    contratos: [{ id: 'k1', comercializadora_final: 'Iberdrola', fecha_firma: dia(-1), responsable: 'Marcos' }],
    estudios: [{ id: 'e1', titulo: 'Ampliación FV', version: 2, estado: 'bloqueado', creado_en: `${dia(-1)}T16:40:00Z`, responsable: 'Marcos' }],
    tareas: [{ id: 't1', descripcion: 'Llamar al gestor', estado: 'completada', actualizado_en: `${dia(-2)}T11:00:00Z`, responsable: 'Marcos' }],
  });

  comprueba('entran los cinco orígenes', h.length === 5, String(h.length));
  comprueba('lo más reciente va primero', h[0].id === 'doc-d1', h[0].id);
  comprueba('el documento lleva su adjunto', h[0].adjunto?.nombre === 'Factura_agosto_2026.pdf');
  comprueba('y dice que está por revisar', /revisión/i.test(h[0].detalle || ''), String(h[0].detalle));

  const visita = h.find((a) => a.tipo === 'visita');
  comprueba('la visita guarda lo que se acordó', /Volver a pasar/.test(visita.siguientePaso || ''), String(visita.siguientePaso));
  // Salía «Volver a pasar el 2026-10-09» dentro de una frase en castellano: se
  // entiende, pero delata que lo escribió una máquina y a partir de ahí el
  // resto del apunte se lee con menos confianza.
  comprueba('con la fecha escrita para leer, no en ISO',
    !/\d{4}-\d{2}-\d{2}/.test(visita.siguientePaso || ''), String(visita.siguientePaso));
  comprueba('y quién la hizo', visita.autor === 'David');

  const prop = h.find((a) => a.tipo === 'propuesta');
  comprueba('un estudio bloqueado es una propuesta ENVIADA', prop.titulo === 'Propuesta enviada', prop.titulo);
  comprueba('y dice la versión', /Versión 2/.test(prop.detalle || ''), String(prop.detalle));
}

titulo('Los cambios del sistema se marcan y no se mezclan');
{
  const h = historialDeCliente({
    visitas: [{ id: 'v1', creado_en: `${HOY}T09:20:00Z`, notas: 'El cliente se lo piensa', responsable: 'David' }],
    cambios: [{ id: 'c1', creado_en: `${HOY}T09:21:00Z`, usuario: 'marcos@x.com', accion: 'UPDATE', resumen: 'observaciones' }],
  });
  const delSistema = h.filter((a) => a.delSistema);
  comprueba('el cambio viene marcado', delSistema.length === 1);
  comprueba('la visita NO', h.find((a) => a.tipo === 'visita').delSistema === false);
  // Se pueden apagar sin perderlos: el día que hay que reconstruir qué pasó son
  // lo único que queda.
  comprueba('apagarlos deja solo lo de personas',
    h.filter((a) => !a.delSistema).length === 1);
}

titulo('Una fecha sin hora no se inventa una hora');
{
  // «00:00» haría parecer que se firmó a medianoche.
  const h = historialDeCliente({ contratos: [{ id: 'k1', fecha_firma: dia(-3) }] });
  comprueba('la hora queda vacía', h[0].hora === '', `«${h[0].hora}»`);
}

titulo('Se agrupa por día, con «Hoy» y «Ayer» como los diría una persona');
{
  const dias = agruparHistorialPorDia(historialDeCliente({
    visitas: [
      { id: 'v1', creado_en: `${HOY}T09:20:00Z`, responsable: 'David' },
      { id: 'v2', creado_en: `${HOY}T11:00:00Z`, responsable: 'David' },
      { id: 'v3', creado_en: `${dia(-1)}T16:40:00Z`, responsable: 'Marcos' },
      { id: 'v4', creado_en: `${dia(-9)}T10:00:00Z`, responsable: 'Marcos' },
    ],
  }), HOY);

  comprueba('tres días', dias.length === 3, String(dias.length));
  comprueba('el de hoy se llama «Hoy»', dias[0].etiqueta === 'Hoy', dias[0].etiqueta);
  comprueba('y agrupa sus dos apuntes', dias[0].apuntes.length === 2);
  comprueba('el de ayer se llama «Ayer»', dias[1].etiqueta === 'Ayer', dias[1].etiqueta);
  comprueba('el viejo lleva su fecha con año', /2026/.test(dias[2].etiqueta), dias[2].etiqueta);
}

// ── Cabecera ────────────────────────────────────────────────────────────────
titulo('La cabecera no lleva ninguna cifra decorativa');
{
  const suministros = [sum({ id: 'a' }), sum({ id: 'b', alias: 'Bombeo' }), sum({ id: 'c', direccion: 'Camino del Soto, 8, 45520 Villaluenga' })];
  const centros = agruparEnCentros(suministros, HOY);
  const ts = trabajosAbiertos(entradaTrabajos({
    suministros,
    pipeline: [{ id: 'p1', estado: 'factura_solicitada', nombre_oportunidad: 'Sin nadie', cups_id: 'a' }],
  }), HOY);

  const c = cabeceraDeFicha({ responsable: 'Marcos', persona_contacto: 'Ana, administración' }, centros, ts);
  comprueba('dice quién lo lleva', c.responsable === 'Marcos');
  comprueba('y a quién se llama', c.contacto === 'Ana, administración');
  comprueba('cuenta los centros', c.centros === 2, String(c.centros));
  comprueba('y los suministros', c.suministros === 3, String(c.suministros));
  comprueba('los trabajos abiertos', c.trabajos === 1);
  comprueba('y cuántos van sin nadie detrás', c.sinAccion === 1);

  const vacio = cabeceraDeFicha({ responsable: '  ', persona_contacto: null }, [], []);
  // Un espacio en blanco NO es un responsable: si contara, la ficha diría que
  // hay alguien detrás cuando no lo hay.
  comprueba('un responsable en blanco cuenta como sin responsable', vacio.responsable === null);
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} correctos, ${fallos} fallos\n`);
process.exit(fallos === 0 ? 0 : 1);
