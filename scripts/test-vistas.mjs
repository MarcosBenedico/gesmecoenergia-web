/**
 * Tests de las VISTAS GUARDADAS y las COLUMNAS del listado.
 *
 *   npm run test:vistas
 *
 * Lo que se protege aquí es sobre todo que nada de esto pueda romper el
 * listado de clientes. Una vista guardada hace tres meses puede traer el
 * nombre de una columna que ya no existe, o venir de una fila de `luz_config`
 * que alguien tocó a mano. Eso tiene que degradar a la vista de fábrica, no
 * dejar la pantalla en blanco.
 */
import {
  COLUMNAS_CLIENTE, COLUMNAS_POR_DEFECTO, normalizarColumnas,
  FILTROS_VACIOS, normalizarFiltros, contarFiltros,
  estadoSeguimientoDe, ESTADOS_SEGUIMIENTO,
  VISTAS_DE_FABRICA, vistasVisibles, esLaVistaActiva,
  validarVistas, guardarVista, borrarVista,
} from '../src/lib/vistas-listado.ts';

let ok = 0, fallos = 0;
const comprueba = (n, c, d = '') => {
  if (c) { ok++; console.log(`  ✓ ${n}`); }
  else { fallos++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`); }
};
const titulo = (t) => console.log(`\n${t}`);

// ── Columnas ───────────────────────────────────────────────────────────────
titulo('El catálogo de columnas está sano');
{
  const claves = COLUMNAS_CLIENTE.map((c) => c.clave);
  comprueba('no hay claves repetidas', new Set(claves).size === claves.length);
  comprueba('el nombre del cliente es fija', COLUMNAS_CLIENTE.find((c) => c.clave === 'nombre')?.fija === true);
  comprueba('hay columnas por defecto', COLUMNAS_POR_DEFECTO.length >= 8);
  comprueba('el seguimiento existe pero no viene puesto',
    COLUMNAS_CLIENTE.some((c) => c.clave === 'seguimiento' && !c.porDefecto));
}

titulo('Elegir columnas no puede romper la tabla');
{
  comprueba('el nombre entra aunque no se pida',
    normalizarColumnas(['prioridad', 'zona']).includes('nombre'));
  comprueba('una columna inventada se ignora',
    !normalizarColumnas(['prioridad', 'nombre', 'columna_fantasma']).includes('columna_fantasma'));
  comprueba('las repetidas salen una vez',
    normalizarColumnas(['zona', 'zona', 'nombre']).filter((c) => c === 'zona').length === 1);
  comprueba('se respeta el orden del catálogo, no el de la elección',
    normalizarColumnas(['alta', 'nombre', 'prioridad']).join(',') === 'prioridad,nombre,alta');
  comprueba('una lista vacía vuelve a la de fábrica',
    normalizarColumnas([]).join(',') === COLUMNAS_POR_DEFECTO.join(','));
  comprueba('null vuelve a la de fábrica',
    normalizarColumnas(null).join(',') === COLUMNAS_POR_DEFECTO.join(','));
  comprueba('solo basura vuelve a la de fábrica',
    normalizarColumnas(['nada', 'de', 'esto']).join(',') === COLUMNAS_POR_DEFECTO.join(','));
}

// ── Filtros ────────────────────────────────────────────────────────────────
titulo('Los filtros se normalizan y se cuentan');
{
  comprueba('sin filtros cuenta cero', contarFiltros(FILTROS_VACIOS) === 0);
  comprueba('tres filtros cuentan tres',
    contarFiltros({ ...FILTROS_VACIOS, zona: 'binefar', estado: 'activo', seguimiento: 'parado' }) === 3);
  const n = normalizarFiltros({ zona: 'binefar', invento: 'x', prioridad: 7 });
  comprueba('lo que no es texto se descarta', n.prioridad === '');
  comprueba('lo que sí es texto se queda', n.zona === 'binefar');
  comprueba('las claves que faltan se rellenan',
    Object.keys(FILTROS_VACIOS).every((k) => k in n));
  comprueba('un campo que no es del catálogo no se cuela', !('invento' in n));
  comprueba('normalizar null da los vacíos', contarFiltros(normalizarFiltros(null)) === 0);
}

// ── Estado de seguimiento ──────────────────────────────────────────────────
titulo('El estado de seguimiento sale de seguimiento.ts, no de aquí');
{
  // propuesta_enviada tiene 4 días de plazo en seguimiento.ts.
  comprueba('a los 2 días de una propuesta: al día',
    estadoSeguimientoDe('propuesta_enviada', 2) === 'al_dia');
  comprueba('a los 9 días: parado',
    estadoSeguimientoDe('propuesta_enviada', 9) === 'parado');
  // factura_solicitada tiene 10: los mismos 9 días ahí NO son un problema.
  comprueba('los mismos 9 días en otra etapa con más plazo: al día',
    estadoSeguimientoDe('factura_solicitada', 9) === 'al_dia');
  comprueba('sin ninguna señal es su propio cajón, no «parado»',
    estadoSeguimientoDe('propuesta_enviada', null) === 'sin_señales');
  comprueba('los tres cajones están en la lista de la pantalla',
    ESTADOS_SEGUIMIENTO.length === 3
    && ESTADOS_SEGUIMIENTO.every((e) => e.titulo && e.pista));
}

// ── Vistas ─────────────────────────────────────────────────────────────────
titulo('Las vistas de fábrica son usables tal cual');
{
  comprueba('hay varias', VISTAS_DE_FABRICA.length >= 5);
  comprueba('todas tienen nombre corto', VISTAS_DE_FABRICA.every((v) => v.nombre.length > 2 && v.nombre.length < 30));
  comprueba('todas llevan columnas pintables',
    VISTAS_DE_FABRICA.every((v) => v.columnas.includes('nombre') && v.columnas.length > 1));
  comprueba('todas están marcadas como de fábrica', VISTAS_DE_FABRICA.every((v) => v.deFabrica));
  comprueba('los ids no se repiten',
    new Set(VISTAS_DE_FABRICA.map((v) => v.id)).size === VISTAS_DE_FABRICA.length);
  comprueba('la de «Todos» no filtra nada',
    contarFiltros(VISTAS_DE_FABRICA.find((v) => v.id === 'todos').filtros) === 0);
}

titulo('Una vista personal no la ve otra persona');
{
  const guardadas = [
    { id: 'a', nombre: 'Lo mío', filtros: FILTROS_VACIOS, columnas: COLUMNAS_POR_DEFECTO, autor: 'David', compartida: false },
    { id: 'b', nombre: 'De todos', filtros: FILTROS_VACIOS, columnas: COLUMNAS_POR_DEFECTO, autor: 'Nicola', compartida: true },
  ];
  const deDavid = vistasVisibles(guardadas, 'David').map((v) => v.id);
  const deNicola = vistasVisibles(guardadas, 'Nicola').map((v) => v.id);
  comprueba('David ve la suya', deDavid.includes('a'));
  comprueba('David ve la compartida de Nicola', deDavid.includes('b'));
  comprueba('Nicola NO ve la personal de David', !deNicola.includes('a'));
  comprueba('las de fábrica las ven los dos',
    VISTAS_DE_FABRICA.every((f) => deDavid.includes(f.id) && deNicola.includes(f.id)));
}

titulo('Se sabe qué vista está puesta ahora mismo');
{
  const v = VISTAS_DE_FABRICA.find((x) => x.id === 'clientes_reales');
  comprueba('con sus filtros y columnas: activa', esLaVistaActiva(v, v.filtros, v.columnas));
  comprueba('cambiando un filtro: ya no', !esLaVistaActiva(v, { ...v.filtros, zona: 'binefar' }, v.columnas));
  comprueba('cambiando una columna: ya no',
    !esLaVistaActiva(v, v.filtros, [...v.columnas, 'telefono']));
  comprueba('el orden de las columnas elegidas da igual',
    esLaVistaActiva(v, v.filtros, [...v.columnas].reverse()));
}

titulo('Lo guardado se valida antes de creerlo');
{
  comprueba('lo que no es lista da lista vacía', validarVistas('no soy una lista').length === 0);
  comprueba('null da lista vacía', validarVistas(null).length === 0);
  const v = validarVistas([
    { id: 'a', nombre: 'Buena', filtros: { zona: 'binefar' }, columnas: ['prioridad'], autor: 'David', compartida: true },
    { id: '', nombre: 'Sin id' },
    { nombre: 'Sin id tampoco' },
    { id: 'b', nombre: '   ' },
    { id: 'a', nombre: 'Repetida' },
    'basura',
    null,
  ]);
  comprueba('solo sobrevive la buena', v.length === 1 && v[0].id === 'a', JSON.stringify(v.map((x) => x.id)));
  comprueba('a la buena se le arreglan las columnas', v[0].columnas.includes('nombre'));
  comprueba('a la buena se le rellenan los filtros que faltan',
    Object.keys(FILTROS_VACIOS).every((k) => k in v[0].filtros) && v[0].filtros.zona === 'binefar');
  comprueba('«compartida» solo es true si lo era de verdad',
    validarVistas([{ id: 'x', nombre: 'X', compartida: 'sí' }])[0].compartida === false);
}

titulo('Guardar con el mismo nombre pisa, no duplica');
{
  const base = [];
  const uno = guardarVista(base, {
    nombre: 'Mis parados', filtros: { ...FILTROS_VACIOS, seguimiento: 'parado' },
    columnas: COLUMNAS_POR_DEFECTO, autor: 'David', compartida: false,
  }, 'id1');
  comprueba('se añade la primera', uno.length === 1);

  const dos = guardarVista(uno, {
    nombre: 'mis parados', filtros: { ...FILTROS_VACIOS, zona: 'binefar' },
    columnas: COLUMNAS_POR_DEFECTO, autor: 'David', compartida: false,
  }, 'id2');
  comprueba('el mismo nombre del mismo autor la pisa', dos.length === 1);
  comprueba('conserva el id original', dos[0].id === 'id1');
  comprueba('se queda con los filtros nuevos', dos[0].filtros.zona === 'binefar' && dos[0].filtros.seguimiento === '');

  const tres = guardarVista(dos, {
    nombre: 'Mis parados', filtros: FILTROS_VACIOS,
    columnas: COLUMNAS_POR_DEFECTO, autor: 'Nicola', compartida: false,
  }, 'id3');
  comprueba('el mismo nombre de OTRA persona no la pisa', tres.length === 2);

  comprueba('sin nombre no se guarda nada',
    guardarVista(tres, { nombre: '   ', filtros: FILTROS_VACIOS, columnas: [], autor: 'David', compartida: false }, 'id4').length === 2);
}

titulo('Borrar solo lo propio, salvo dirección');
{
  const g = [
    { id: 'a', nombre: 'De David', filtros: FILTROS_VACIOS, columnas: COLUMNAS_POR_DEFECTO, autor: 'David', compartida: false },
    { id: 'b', nombre: 'De Nicola', filtros: FILTROS_VACIOS, columnas: COLUMNAS_POR_DEFECTO, autor: 'Nicola', compartida: true },
  ];
  comprueba('David borra la suya', borrarVista(g, 'a', 'David').length === 1);
  comprueba('David no borra la de Nicola', borrarVista(g, 'b', 'David').length === 2);
  comprueba('dirección sí puede', borrarVista(g, 'b', 'Marcos', true).length === 1);
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} correctos, ${fallos} fallos\n`);
process.exit(fallos === 0 ? 0 : 1);
