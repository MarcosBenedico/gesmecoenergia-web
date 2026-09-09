/**
 * MAPA Y AUDITORÍA DEL CRM — genera el PDF de análisis.
 *
 *   node scripts/mapa-crm.mjs [salida.pdf]
 *
 * Es un documento de asesoría, no un volcado del código: cada apartado lleva
 * para qué sirve, qué lógica lo gobierna, con qué está conectado y un veredicto
 * con su motivo. Las cifras de uso salen de la base real (ver la sección 2) y
 * están puestas a mano tras consultarla, con su fecha, para que el informe no
 * mienta si se regenera meses después sin volver a medir.
 *
 * A4 vertical dibujado con jsPDF, como `parte-pdf.ts`: texto vectorial y cada
 * bloque comprueba si cabe antes de pintarse.
 */
import { jsPDF } from 'jspdf';
import { writeFileSync } from 'node:fs';

const SALIDA = process.argv[2] || 'Mapa_CRM_Gesmeco.pdf';

/** Cuándo se midieron las cifras de uso. Si esto envejece, el informe lo dice. */
const MEDIDO = '9 de septiembre de 2026';

// ── Paleta ──────────────────────────────────────────────────────────────────
const TINTA = [17, 24, 39];
const GRIS = [107, 114, 128];
const SUAVE = [156, 163, 175];
const ROJO = [204, 0, 0];
const AMBAR = [180, 83, 9];
const VERDE = [4, 120, 87];
const AZUL = [30, 64, 118];
const LINEA = [226, 232, 240];
const FONDO = [248, 250, 252];

const A4 = { w: 210, h: 297 };
const M = 18;
const ANCHO = A4.w - M * 2;

const doc = new jsPDF({ unit: 'mm', format: 'a4' });
let y = M;
let pagina = 1;

const setFuente = (tam, estilo = 'normal', color = TINTA) => {
  doc.setFont('helvetica', estilo);
  doc.setFontSize(tam);
  doc.setTextColor(...color);
};

function pie() {
  setFuente(7, 'normal', SUAVE);
  doc.text('Gesmeco Energía · Auditoría del CRM · uso medido el ' + MEDIDO, M, A4.h - 10);
  doc.text(String(pagina), A4.w - M, A4.h - 10, { align: 'right' });
}

function nuevaPagina() {
  pie();
  doc.addPage();
  pagina++;
  y = M;
}

/** Reserva alto: si el bloque no cabe entero, salta de página ANTES de pintarlo. */
function asegurar(alto) {
  if (y + alto > A4.h - 18) nuevaPagina();
}

function parrafo(txt, tam = 9, estilo = 'normal', color = TINTA, ancho = ANCHO, x = M) {
  setFuente(tam, estilo, color);
  const lineas = doc.splitTextToSize(txt, ancho);
  asegurar(lineas.length * (tam * 0.42) + 2);
  doc.text(lineas, x, y);
  y += lineas.length * (tam * 0.42) + 2;
}

function h1(txt) {
  asegurar(20);
  y += 4;
  setFuente(16, 'bold', AZUL);
  doc.text(txt, M, y);
  y += 2.5;
  doc.setDrawColor(...ROJO);
  doc.setLineWidth(0.8);
  doc.line(M, y, M + 28, y);
  y += 6;
}

function h2(txt) {
  asegurar(14);
  y += 3;
  setFuente(11, 'bold', TINTA);
  doc.text(txt, M, y);
  y += 5;
}

function separador() {
  asegurar(6);
  doc.setDrawColor(...LINEA);
  doc.setLineWidth(0.2);
  doc.line(M, y, A4.w - M, y);
  y += 4;
}

/** Caja con fondo, para lo que hay que leer sí o sí. */
function destacado(titulo, texto, color = ROJO) {
  setFuente(9, 'normal');
  const lineas = doc.splitTextToSize(texto, ANCHO - 10);
  const alto = 9 + lineas.length * 3.9;
  asegurar(alto + 4);
  doc.setFillColor(...FONDO);
  doc.roundedRect(M, y, ANCHO, alto, 1.5, 1.5, 'F');
  doc.setDrawColor(...color);
  doc.setLineWidth(1.2);
  doc.line(M, y, M, y + alto);
  setFuente(9, 'bold', color);
  doc.text(titulo, M + 5, y + 5.5);
  setFuente(9, 'normal', TINTA);
  doc.text(lineas, M + 5, y + 10);
  y += alto + 4;
}

/** Tabla simple. cols = [{t, w, alin}] */
function tabla(cols, filas, tam = 8) {
  // El alto de fila sigue al tamaño de letra. Con un alto fijo, la línea
  // separadora cortaba por la mitad los descendentes de la fila de arriba
  // («diagnóstico», «empezar») y la tabla parecía mal impresa.
  const alto = Math.max(6, tam * 0.72);
  asegurar(alto * 2 + 2);
  setFuente(tam - 0.5, 'bold', GRIS);
  let x = M;
  for (const c of cols) {
    doc.text(c.t, c.alin === 'r' ? x + c.w - 1 : x + 1, y + 3.6, { align: c.alin === 'r' ? 'right' : 'left' });
    x += c.w;
  }
  y += alto;
  doc.setDrawColor(...LINEA);
  doc.line(M, y - 0.9, A4.w - M, y - 0.9);

  for (const f of filas) {
    asegurar(alto + 2);
    x = M;
    for (let i = 0; i < cols.length; i++) {
      const celda = f.v[i] ?? '';
      setFuente(tam, f.fuerte && i === 0 ? 'bold' : 'normal', f.color || TINTA);
      const txt = doc.splitTextToSize(String(celda), cols[i].w - 2)[0] || '';
      doc.text(txt, cols[i].alin === 'r' ? x + cols[i].w - 1 : x + 1, y + 3.6,
        { align: cols[i].alin === 'r' ? 'right' : 'left' });
      x += cols[i].w;
    }
    y += alto;
    doc.setDrawColor(240, 243, 247);
    doc.line(M, y - 0.9, A4.w - M, y - 0.9);
  }
  y += 3;
}

// ── La ficha de cada apartado ───────────────────────────────────────────────

const TONO = {
  MANTENER: VERDE, REFORZAR: VERDE, FUSIONAR: AMBAR,
  SIMPLIFICAR: AMBAR, DEGRADAR: AMBAR, VIGILAR: GRIS, RETIRAR: ROJO,
};

/**
 * Una ficha por apartado. El orden de los campos no es casual: primero PARA
 * QUÉ —si eso no se puede contestar en una línea, el apartado sobra—, después
 * la lógica, después las conexiones y al final el veredicto.
 */
function ficha(a) {
  // Se mide el alto antes de pintar para no partir una ficha entre páginas:
  // media ficha al final de una hoja no se lee, se salta.
  setFuente(8.5, 'normal');
  const lParaQue = doc.splitTextToSize(a.paraQue, ANCHO - 4).length;
  const lLogica = doc.splitTextToSize(a.logica, ANCHO - 4).length;
  const lConecta = doc.splitTextToSize(a.conecta, ANCHO - 4).length;
  const lCambio = doc.splitTextToSize(a.cambio, ANCHO - 30).length;
  asegurar(20 + (lParaQue + lLogica + lConecta + lCambio) * 3.6);

  const arriba = y;
  y += 1;
  setFuente(10.5, 'bold', TINTA);
  doc.text(a.nombre, M + 4, y + 3);
  setFuente(7.5, 'normal', SUAVE);
  doc.text(a.ruta, A4.w - M - 2, y + 3, { align: 'right' });
  y += 7;

  const campo = (etiqueta, texto) => {
    setFuente(7, 'bold', GRIS);
    doc.text(etiqueta, M + 4, y);
    y += 3.4;
    setFuente(8.5, 'normal', TINTA);
    const l = doc.splitTextToSize(texto, ANCHO - 8);
    doc.text(l, M + 4, y);
    y += l.length * 3.6 + 1.8;
  };

  campo('PARA QUÉ', a.paraQue);
  campo('LÓGICA', a.logica);
  campo('CONECTA CON', a.conecta);

  // Veredicto
  const color = TONO[a.veredicto] || GRIS;
  setFuente(7.5, 'bold', color);
  doc.text(a.veredicto, M + 4, y + 0.5);
  setFuente(8.5, 'normal', TINTA);
  const lc = doc.splitTextToSize(a.cambio, ANCHO - 30);
  doc.text(lc, M + 26, y + 0.5);
  y += Math.max(lc.length * 3.6, 4) + 3;

  doc.setDrawColor(...LINEA);
  doc.setLineWidth(0.2);
  doc.roundedRect(M, arriba, ANCHO, y - arriba - 1, 1.5, 1.5, 'S');
  doc.setDrawColor(...color);
  doc.setLineWidth(1.2);
  doc.line(M, arriba + 1, M, y - 2);
  y += 3.5;
}

// ═══════════════════════════════════════════════════════════════════════════
// PORTADA
// ═══════════════════════════════════════════════════════════════════════════
doc.setFillColor(...AZUL);
doc.rect(0, 0, A4.w, 62, 'F');
doc.setFillColor(...ROJO);
doc.rect(0, 62, A4.w, 1.6, 'F');

setFuente(9, 'bold', [255, 255, 255]);
doc.text('GESMECO ENERGÍA', M, 22);
setFuente(23, 'bold', [255, 255, 255]);
doc.text('Auditoría del CRM', M, 36);
setFuente(12, 'normal', [190, 205, 225]);
doc.text('Qué hace cada apartado, cómo encaja y qué sobra', M, 45);
setFuente(8.5, 'normal', [160, 180, 205]);
doc.text('Gestión Luz + Gestión Energética · uso medido el ' + MEDIDO, M, 54);

y = 76;
setFuente(9, 'normal', GRIS);
parrafo('Informe encargado para poder consolidar el sistema antes de seguir ampliándolo. '
  + 'Analiza los 41 apartados publicados, la lógica que gobierna cada uno, cómo están conectados '
  + 'entre sí, y contrasta todo eso contra el uso REAL registrado en la base de datos.', 9.5);

y += 2;
destacado('LO PRIMERO, Y LO MÁS IMPORTANTE',
  'El sistema no tiene un problema de funciones que sobran: tiene un problema de ALIMENTACIÓN. '
  + 'Desde el 18 de agosto —hace tres semanas— prácticamente no ha entrado ni un dato nuevo. '
  + 'Las 90 oportunidades abiertas están las 90 paradas. Hay 89 tareas vencidas sin cerrar. '
  + 'Y 223 de los 306 clientes no tienen teléfono. Ampliar el CRM ahora es construir plantas '
  + 'nuevas encima de un edificio en el que no vive nadie.', ROJO);

destacado('EL VEREDICTO EN UNA FRASE',
  'Retirar 4 apartados, fusionar 3 y ascender 1. El menú baja de 41 destinos a 24, pero eso es '
  + 'lo secundario: lo que de verdad cambia el resultado es que meter un dato cueste menos que '
  + 'no meterlo. Mientras eso no pase, cualquier apartado nuevo nace muerto.', AZUL);

y += 2;
h2('Qué encontrarás dentro');
tabla(
  [{ t: 'SECCIÓN', w: 118 }, { t: 'QUÉ CONTESTA', w: 56 }],
  [
    { v: ['1. El diagnóstico de uso real', 'Qué se usa y qué no'] },
    { v: ['2. Cómo está construido y por qué aguanta', 'La arquitectura'] },
    { v: ['3. Ficha de los 41 apartados', 'Uno a uno'] },
    { v: ['4. Solapes: dónde hay tres pantallas para una pregunta', 'Qué fusionar'] },
    { v: ['5. Decisiones, en una tabla', 'Qué hacer con cada uno'] },
    { v: ['6. Plan de 4 semanas', 'Por dónde empezar'] },
  ], 9);

// ═══════════════════════════════════════════════════════════════════════════
nuevaPagina();
h1('1. El diagnóstico de uso real');

parrafo('Todo lo de esta sección sale de consultar la base de datos de producción el '
  + MEDIDO + ', no de estimaciones. Es la parte del informe que más incomoda y la que más vale.');

h2('La cartera: qué hay dentro');
tabla(
  [{ t: 'CONCEPTO', w: 84 }, { t: 'CANTIDAD', w: 26, alin: 'r' }, { t: 'LECTURA', w: 64 }],
  [
    { v: ['Clientes en el sistema', '306', 'La base es sólida'], fuerte: true },
    { v: ['   de los cuales, clientes de verdad', '68', 'Han firmado algo'] },
    { v: ['   preclientes', '130', 'Nos dieron datos, no firmaron'] },
    { v: ['   objetivos', '108', 'Sitios a los que ir'] },
    { v: ['Suministros (CUPS)', '162', ''] },
    { v: ['Oportunidades abiertas', '90', 'Las 90, paradas'], color: ROJO, fuerte: true },
    { v: ['Contratos en tramitación', '8', 'Dinero a medio camino'] },
    { v: ['Comisiones pendientes de cobro', '30', 'Trabajo hecho sin cobrar'], color: AMBAR },
    { v: ['Prospectos sin trabajar', '719', '259 marcados «para visitar»'], color: AMBAR },
    { v: ['Estudios creados', '1', 'El módulo más caro del sistema'], color: ROJO },
    { v: ['Proyectos de ahorro', '0', 'Nunca se ha usado'], color: ROJO },
    { v: ['Consultas a Datadis', '0', 'Nunca se ha usado'], color: ROJO },
  ]);

h2('La actividad: cuándo se tocó cada cosa por última vez');
tabla(
  [{ t: 'TABLA', w: 60 }, { t: 'ÚLTIMO CAMBIO', w: 42 }, { t: 'MODIFICADOS EN 30 DÍAS', w: 72, alin: 'r' }],
  [
    { v: ['Clientes', '31 de agosto', '22'], color: AMBAR },
    { v: ['Tareas', '18 de agosto', '12'], color: ROJO },
    { v: ['Pipeline', '18 de agosto', '10'], color: ROJO },
    { v: ['Seguimientos', '17 de agosto', '14'], color: ROJO },
    { v: ['Visitas', '8 de agosto', '0'], color: ROJO, fuerte: true },
    { v: ['Suministros', '8 de agosto', '0'], color: ROJO, fuerte: true },
    { v: ['Contratos', '6 de agosto', '0'], color: ROJO, fuerte: true },
  ]);

destacado('CÓMO SE LEE ESTA TABLA',
  'Cero visitas registradas en 30 días no significa que David no haya salido: significa que lo que '
  + 'hace en la calle no está entrando en el sistema. Y un CRM que no sabe lo que pasa en la calle '
  + 'no puede priorizar nada — todo lo que se construya encima ordenará una realidad de hace un mes.', ROJO);

h2('La calidad del dato: qué falta para poder trabajar');
tabla(
  [{ t: 'HUECO', w: 96 }, { t: 'CUÁNTOS', w: 24, alin: 'r' }, { t: 'QUÉ BLOQUEA', w: 54 }],
  [
    { v: ['Clientes sin teléfono', '223 de 306', 'No se puede ni llamar'], color: ROJO, fuerte: true },
    { v: ['CUPS sin fecha de fin de contrato', '89 de 162', 'Sin esto no hay preaviso'], color: ROJO, fuerte: true },
    { v: ['Tareas pendientes ya vencidas', '89 de 142', 'La lista dejó de ser creíble'], color: ROJO },
    { v: ['CUPS sin consumo anual', '9 de 162', 'No se puede ofertar'], color: AMBAR },
    { v: ['Clientes sin responsable', '0', 'Esto sí está bien'], color: VERDE },
    { v: ['CUPS sin responsable', '1', 'Esto sí está bien'], color: VERDE },
  ]);

destacado('EL DATO MÁS CARO DE TODO EL INFORME',
  '73 % de la cartera no tiene teléfono, y 55 % de los suministros no tiene fecha de fin de contrato. '
  + 'Ese segundo dato es el que alimenta el preaviso, que es el activo más valioso que tenéis: un '
  + 'preaviso que se pasa bloquea a un cliente UN AÑO ENTERO. Con 89 suministros sin esa fecha, el '
  + 'sistema no puede avisar de algo que ni siquiera sabe que existe.', ROJO);

// ═══════════════════════════════════════════════════════════════════════════
nuevaPagina();
h1('2. Cómo está construido, y por qué aguanta');

parrafo('Antes de decir qué sobra, hay que reconocer lo que está bien hecho, porque es lo que '
  + 'permite recortar sin romper nada. El sistema tiene una arquitectura poco común en un CRM de '
  + 'esta escala, y es su mejor activo.');

h2('Las cuatro capas');
tabla(
  [{ t: 'CAPA', w: 44 }, { t: 'QUÉ HACE', w: 74 }, { t: 'EJEMPLO', w: 56 }],
  [
    { v: ['Vocabularios', 'Definen las palabras. Nadie más decide.', 'etapas.ts, energia.ts'], fuerte: true },
    { v: ['Lógica de negocio', 'Deciden qué está mal y en qué orden', 'dashboard.ts, bandeja.ts'], fuerte: true },
    { v: ['Pantallas', 'Solo pintan. Preguntan, no deciden.', 'gestor/luz/*'], fuerte: true },
    { v: ['API única', 'Un solo CRUD con permisos y papelera', '/api/luz/[tabla]'], fuerte: true },
  ]);

destacado('LA REGLA QUE SOSTIENE TODO',
  'Ninguna pantalla tiene criterio propio de urgencia. El Dashboard, la Bandeja, el Pipeline y la '
  + 'ficha del cliente preguntan los plazos al mismo sitio. Por eso se puede fusionar o retirar una '
  + 'pantalla sin que las demás empiecen a decir cosas distintas del mismo cliente — que es como '
  + 'mueren la mayoría de los CRM hechos a medida.', VERDE);

h2('El flujo real del negocio, y qué apartado lo cubre');
tabla(
  [{ t: 'PASO', w: 62 }, { t: 'APARTADO', w: 60 }, { t: 'ESTADO HOY', w: 52 }],
  [
    { v: ['1. Encontrar a quién ir', 'Mapa de oportunidades', '719 sin trabajar'], color: AMBAR },
    { v: ['2. Planificar la salida', 'Rutas / Mi Día por zona', 'Sin uso en 30 d'], color: ROJO },
    { v: ['3. Visitar y registrar', 'Resultado de la visita', 'Sin uso en 30 d'], color: ROJO },
    { v: ['4. Conseguir la factura', 'Captura / Bandeja', 'Parado'], color: AMBAR },
    { v: ['5. Estudiar y comparar', 'Estudios y propuestas', '1 estudio'], color: AMBAR },
    { v: ['6. Cerrar y firmar', 'Pipeline → Contratos', '8 en curso'], color: VERDE },
    { v: ['7. Activar y cobrar', 'Contratos → Comisiones', '30 por cobrar'], color: AMBAR },
    { v: ['8. Renovar a tiempo', 'Preaviso (Mi Día)', '89 CUPS sin fecha'], color: ROJO },
  ]);

parrafo('La cadena está completa de punta a punta —eso es mérito— pero se rompe en los pasos 2 y 3, '
  + 'que son los que la alimentan. Todo lo que viene después se queda sin materia prima.', 9, 'normal', GRIS);

// ═══════════════════════════════════════════════════════════════════════════
nuevaPagina();
h1('3. Ficha de cada apartado');

parrafo('Los 41 apartados, agrupados como está el menú: por forma de trabajar y no por tipo de dato. '
  + 'Cada ficha lleva su veredicto con el motivo.', 9, 'normal', GRIS);

y += 1;
tabla(
  [{ t: 'VEREDICTO', w: 30 }, { t: 'SIGNIFICA', w: 144 }],
  [
    { v: ['REFORZAR', 'Se usa poco para lo que vale. Hay que darle sitio.'], color: VERDE },
    { v: ['MANTENER', 'Cumple. No tocar.'], color: VERDE },
    { v: ['FUSIONAR', 'Se solapa con otro. Juntarlos.'], color: AMBAR },
    { v: ['SIMPLIFICAR', 'Vale, pero pesa demasiado.'], color: AMBAR },
    { v: ['DEGRADAR', 'Útil de vez en cuando. Fuera del menú diario.'], color: AMBAR },
    { v: ['VIGILAR', 'Nuevo o sin datos. Decidir con uso real.'], color: GRIS },
    { v: ['RETIRAR', 'No aporta o duplica. Quitar del menú.'], color: ROJO },
  ], 8.5);

h2('BLOQUE «INICIO» — qué hay que decidir hoy');

ficha({
  nombre: 'Dashboard de dirección', ruta: '/gestor/luz',
  paraQue: 'La portada de Marcos: qué hay que decidir HOY, en cinco líneas.',
  logica: 'Ordena por LO QUE SE PIERDE PARA SIEMPRE, no por importe: preaviso que se cierra > firmado sin activar > propuesta sin seguir > estudio pendiente > factura que no llega. El dinero ordena dentro de cada escalón y nunca salta al de arriba. Un cliente ocupa una sola línea, la de su peor problema.',
  conecta: 'Lee clientes, CUPS, pipeline, contratos y comisiones. Los plazos los pregunta a seguimiento.ts y las etapas a etapas.ts: no decide nada por su cuenta. Cada línea es un botón que lleva a la pantalla donde se resuelve.',
  veredicto: 'MANTENER',
  cambio: 'Es el mejor apartado del sistema. Único cambio: absorber Control de cartera como segunda pestaña (ver ficha siguiente).',
});

ficha({
  nombre: 'Control de cartera', ruta: '/gestor/luz/control-cartera',
  paraQue: 'La vista de excepciones de dirección: dónde se está escapando el control.',
  logica: 'La regla madre — ningún expediente abierto sin siguiente acción, con responsable y fecha. Detecta además la contradicción entre lo que dice la ficha y lo que dice la tarea real, que es el fallo más peligroso porque tranquiliza al que mira.',
  conecta: 'Mismas fuentes que el Dashboard (clientes, CUPS, pipeline, contratos, tareas) y el mismo vocabulario. Lógica en reglas-cartera.ts, que no la usa nadie más.',
  veredicto: 'FUSIONAR',
  cambio: 'Meterlo como pestaña «Excepciones» dentro del Dashboard. Contestan preguntas distintas del mismo momento y las dos son de la misma persona: son dos pestañas, no dos destinos.',
});

h2('BLOQUE «TRABAJO» — lo mío de hoy');

ficha({
  nombre: 'Mi Día', ruta: '/gestor/luz/mi-dia',
  paraQue: 'La única pantalla de trabajo de David: qué hago ahora, por dónde salgo y qué me espera.',
  logica: 'Tres vistas de una sola lista: HOY (atrasado y de hoy juntos, que para quien está en la calle son lo mismo), POR ZONA (donde vive el montador de ruta) y CALENDARIO. Lo que arrastra mucho retraso se aparca en un plegable en vez de inflar el número del día: un número que no se puede hacer no se prioriza, se ignora.',
  conecta: 'La pantalla con más conexiones de todo el sistema: lee clientes, CUPS, fechas, pipeline, prospectos, tareas y visitas. Los vencimientos NO se guardan, se calculan en vivo desde el CUPS.',
  veredicto: 'MANTENER',
  cambio: 'Un arreglo de mantenimiento: su código vive en la carpeta /agenda, cuya ruta redirige aquí. Quien vaya a tocarlo buscará en la carpeta equivocada. Mover los archivos.',
});

ficha({
  nombre: 'Bandeja', ruta: '/gestor/luz/bandeja',
  paraQue: 'La pantalla de Nicola: qué está esperando a que alguien lo meta o lo mueva.',
  logica: 'No ordena por fecha sino por A QUIÉN BLOQUEA: bloquea la venta > bloquea el cobro > esperando al cliente > mis tareas. Y lo que Nicola no puede resolver no se le pone delante. Ocho tandas con nombre para trabajar por lotes.',
  conecta: 'Lee clientes, CUPS, pipeline, contratos, comisiones y tareas. Si hay visita esta semana, lo que falte de ese cliente sube 50 puntos.',
  veredicto: 'MANTENER',
  cambio: 'Bien planteada. Es, junto con Rellenar en tanda, la palanca para arreglar el problema de alimentación de la sección 1.',
});

ficha({
  nombre: 'Rutas de visitas', ruta: '/gestor/luz/rutas',
  paraQue: 'Montar la salida del día sobre el mapa.',
  logica: 'Rotación de 3 semanas x 3 días de calle sobre 7 zonas, con objetivos de puertas distintos según distancia. Mide las oportunidades de paso contra TODO el recorrido y no contra la parada más cercana, que es lo que convierte una ruta de 6 clientes en una mañana de 9 puertas sin conducir más.',
  conecta: 'Lee y escribe clientes, CUPS, pipeline, prospectos y visitas: es la pantalla que más tablas toca. Solapa con Mi Día (vista Por zona) y con el Mapa de oportunidades.',
  veredicto: 'FUSIONAR',
  cambio: 'Es el mayor solape del sistema: tres pantallas contestan «a dónde voy». 1.900 líneas en 6 archivos y cero visitas registradas en 30 días. Unificar con el Mapa de oportunidades en un solo destino «Calle».',
});

ficha({
  nombre: 'Tareas', ruta: '/gestor/luz/tareas',
  paraQue: 'El listado completo de tareas, con su alta y su edición en detalle.',
  logica: 'CRUD sobre luz_tareas con filtros por responsable, estado y tipo. El reparto por rol sugiere responsable según el tipo de tarea (administrativas a Nicola, comerciales a David).',
  conecta: 'La misma tabla que Mi Día y que la Bandeja. Las tres enseñan tareas con recortes distintos.',
  veredicto: 'DEGRADAR',
  cambio: 'Mi Día ya es la lista de trabajo. Esta es el mantenimiento en detalle: bajarla a Herramientas. Tres entradas de menú sobre la misma tabla es lo que hace que nadie sepa cuál mirar.',
});

ficha({
  nombre: 'Fechas críticas', ruta: '/gestor/luz/fechas',
  paraQue: 'Vencimientos guardados a mano (fin de contrato, permanencia, preaviso, otros).',
  logica: 'Tabla propia de fechas. Pero el fin de contrato, la permanencia y el preaviso YA se calculan en vivo desde el CUPS en Mi Día, precisamente para que nunca queden desfasados.',
  conecta: 'Duplica lo que ya calcula la Agenda. Llegó a haber 86 fechas críticas repitiendo un dato que vive en el suministro; hoy quedan 107 vivas.',
  veredicto: 'RETIRAR',
  cambio: 'Quitar del menú. El mismo vencimiento en dos sitios que se pueden contradecir es el fallo que ya se pagó una vez. Lo que no sea contrato/permanencia/preaviso puede ser una tarea normal.',
});

// ── Cartera ──
nuevaPagina();
h2('BLOQUE «CARTERA» — quién es cada uno');

ficha({
  nombre: 'Clientes', ruta: '/gestor/luz/clientes',
  paraQue: 'El listado maestro de la cartera, con vistas guardadas y columnas configurables.',
  logica: 'Seis vistas puestas que son las preguntas que ya se hacían a mano. Las vistas viven en el servidor, no en el navegador, para que la que montas en el ordenador esté en el móvil. Todo lo guardado se valida al leerlo: una vista rota degrada a la de fábrica, nunca deja la tabla en blanco.',
  conecta: 'Lee clientes y CUPS. El filtro de seguimiento pregunta los plazos a seguimiento.ts. El semáforo de «qué falta» sale de completitud.ts.',
  veredicto: 'MANTENER',
  cambio: 'Sin cambios. Añadir una vista de fábrica: «Sin teléfono» (223 clientes), que hoy es el hueco más caro de la cartera.',
});

ficha({
  nombre: 'Ficha del cliente', ruta: '/gestor/luz/clientes/[id]',
  paraQue: 'El expediente completo de un cliente: contacto, suministros, oportunidades, contratos, comisiones e historial.',
  logica: 'Orden por lo que se mira: cabecera > siguiente acción > cuatro indicadores > suministros. El resto baja a un plegable. Una información, un sitio: el CUPS, la tarifa y el consumo son del suministro y no salen agregados arriba.',
  conecta: 'El nudo del sistema: lee y escribe NUEVE tablas. Es el punto de encuentro entre la cartera y la gestión energética.',
  veredicto: 'SIMPLIFICAR',
  cambio: '2.426 líneas — el archivo más grande del proyecto. Funciona, pero mezcla la ficha con los formularios de todo. Partir los formularios a sus propios archivos antes de que crezca más.',
});

ficha({
  nombre: 'Suministros (CUPS) + ficha', ruta: '/gestor/luz/cups',
  paraQue: 'El listado de puntos de suministro y la ficha de cada uno, en cinco pestañas.',
  logica: 'La ficha empieza por «Qué pasa» y no por «Datos»: primero lo que hay que decidir, después el inventario. El formulario va por bloques con su porqué escrito, y las casillas de potencia son EXACTAMENTE las de la tarifa, así el error de rellenar 3 de 6 no se puede cometer.',
  conecta: 'El CUPS es la fuente de verdad del viaje comercial: pipeline y contrato empujan su estado aquí, y el estado del cliente se deriva de todos sus CUPS. También es el puente con Gestión energética.',
  veredicto: 'REFORZAR',
  cambio: 'Recién terminada y es donde está el dato que más falta: 89 CUPS sin fecha de fin de contrato. Debería ser el destino de una campaña de relleno esta misma semana.',
});

ficha({
  nombre: 'Duplicados', ruta: '/gestor/luz/clientes/duplicados',
  paraQue: 'Detectar clientes repetidos y fusionarlos sin perder nada.',
  logica: 'Compara por nombre y NIF; la fusión arrastra los vínculos al superviviente.',
  conecta: 'Lee clientes y CUPS, escribe por el endpoint de fusión.',
  veredicto: 'DEGRADAR',
  cambio: 'Se usa después de una importación y luego no se toca en meses. A Herramientas.',
});

h2('BLOQUE «COMERCIAL» — vender y seguir');

ficha({
  nombre: 'Pipeline', ruta: '/gestor/luz/pipeline',
  paraQue: 'El embudo de oportunidades, con la pestaña «Parados» que absorbió el antiguo Seguimiento.',
  logica: 'Estados unificados con el resto del sistema. La pestaña Parados mira la misma cartera por tiempo parado en vez de por etapa: son dos preguntas sobre los mismos registros, no dos pantallas.',
  conecta: 'Lee y escribe pipeline, contratos, seguimientos y tareas. Empuja el estado al CUPS.',
  veredicto: 'MANTENER',
  cambio: 'Sin cambios estructurales. Pero aquí está el síntoma: 90 oportunidades abiertas y las 90 paradas más de 21 días. La pantalla funciona; lo que falta es trabajarla.',
});

ficha({
  nombre: 'Estudios y propuestas', ruta: '/gestor/luz/estudios',
  paraQue: 'El paso entre tener la factura y tener una oferta: comparar, recomendar y sacar el informe.',
  logica: 'El estudio guarda una COPIA de los precios, no una referencia: es una foto de lo que se le dijo a alguien un día concreto. La recomendación NO es la que más ahorra, sino la que más ahorra entre las que no obligan a explicar un riesgo — y cuando la descartada ahorraba más, la frase lo dice.',
  conecta: 'Lee clientes, CUPS y estudios. Usa el motor de comparativa, el de potencias y la plantilla de Excel. Puede crear el suministro si el cliente no lo tiene.',
  veredicto: 'VIGILAR',
  cambio: 'Es el módulo más caro construido y solo tiene 1 estudio. No es que esté mal: es que no llega materia prima (paso 4 de la cadena). Antes de tocarlo, arreglar la entrada de facturas.',
});

// ── Operación y control ──
nuevaPagina();
h2('BLOQUE «OPERACIÓN» y «CONTROL»');

ficha({
  nombre: 'Contratos y activaciones', ruta: '/gestor/luz/contratos',
  paraQue: 'Seguir el papeleo desde la firma hasta que la comercializadora activa.',
  logica: 'Estados de contrato que empujan al CUPS y de ahí al cliente. Cada estado tiene su siguiente paso definido.',
  conecta: 'Lee clientes, CUPS y contratos; escribe contratos. Alimenta las comisiones.',
  veredicto: 'MANTENER',
  cambio: 'Sin cambios. 8 contratos en curso y sin tocar desde el 6 de agosto: revisar si alguno se ha caído por silencio.',
});

ficha({
  nombre: 'Comisiones', ruta: '/gestor/luz/comisiones',
  paraQue: 'Qué se ha ganado y qué falta por cobrar.',
  logica: 'Estados de cobro con fecha prevista. Lo vencido y sin cobrar sube al Dashboard.',
  conecta: 'Cuelga del contrato y del cliente. Las automatizaciones proponen reclamar lo vencido.',
  veredicto: 'MANTENER',
  cambio: 'Sin cambios. 30 comisiones pendientes es dinero vuestro fuera: merece una tarde.',
});

ficha({
  nombre: 'Parte del día', ruta: '/gestor/luz/parte',
  paraQue: 'Qué se movió en la cartera un día concreto, quién lo movió y qué mejoró en cada cliente.',
  logica: 'Sale de la auditoría, que guarda la fila entera antes y después. No cuenta acciones, cuenta lo que HABILITAN: una tarde rellenando 40 teléfonos son 40 acciones y cero euros más cerca; una visita que acaba con la factura en la mano es una acción y desbloquea toda la oferta.',
  conecta: 'Solo la auditoría. Es la pantalla más independiente y también la más cara: unas 2.000 líneas entre pantalla, PDF y motor de juicio.',
  veredicto: 'DEGRADAR',
  cambio: 'Con tres semanas sin actividad, el parte sale vacío todos los días. Bajarlo a Herramientas hasta que haya actividad diaria que contar. La función está bien; le falta materia prima.',
});

ficha({
  nombre: 'Consumo real (Datadis)', ruta: '/gestor/luz/consumo',
  paraQue: 'Traer la curva horaria y el maxímetro que dan las distribuidoras, gratis.',
  logica: 'El maxímetro manda sobre la curva. El criterio por defecto es no bajar nunca de lo medido, porque apurar el límite recomendaría dejar corto al cliente y la penalización la pagaría él.',
  conecta: 'Alimentaría el optimizador de potencias y los estudios. Hoy no alimenta nada.',
  veredicto: 'RETIRAR',
  cambio: 'CERO consultas y CERO filas guardadas. Requiere que cada titular autorice vuestro NIF en datadis.es, y esa autorización no se ha pedido nunca. Quitar del menú hasta que haya UN cliente autorizado; entonces vuelve y vale mucho.',
});

ficha({
  nombre: 'Equipo y logros', ruta: '/gestor/luz/equipo',
  paraQue: 'Ver el reparto de trabajo del equipo y sus logros.',
  logica: 'Cuenta actividad por persona sobre tareas, visitas y contratos.',
  conecta: 'Lee clientes, contratos, tareas y visitas.',
  veredicto: 'DEGRADAR',
  cambio: 'La gamificación sin actividad registrada es un marcador a cero que desmotiva. A Herramientas hasta que el registro diario sea un hábito.',
});

ficha({
  nombre: 'Mapa de oportunidades', ruta: '/gestor/luz/oportunidades',
  paraQue: 'Granjas y naves de la comarca que aún no son clientes, detectadas por forma sobre el mapa.',
  logica: 'Se barre una zona UNA vez y se va filtrando: nuevo > interesante > para visitar > descartado. Lo descartado no vuelve a proponerse. El consumo estimado es un orden de magnitud, nunca un dato.',
  conecta: 'Crea cliente + oportunidad + tarea de una vez. Solo lo marcado «que vaya David» llega a Rutas.',
  veredicto: 'FUSIONAR',
  cambio: '719 prospectos sin trabajar, 259 ya marcados para visitar. El embudo de captación está lleno y el grifo cerrado. Unir con Rutas en un solo destino «Calle»: hoy hay que pasar por dos pantallas para planificar una mañana.',
});

ficha({
  nombre: 'Importación / Exportación', ruta: '/gestor/luz/importar',
  paraQue: 'Meter cartera desde Excel y sacarla filtrada.',
  logica: 'Revisión por pasos antes de publicar: nada entra hasta confirmar, y los errores conservan el archivo y el motivo.',
  conecta: 'Escribe en casi todas las tablas de la cartera.',
  veredicto: 'MANTENER',
  cambio: 'Sin cambios. Herramienta puntual, ya está en el sitio correcto.',
});

// ── Herramientas ──
nuevaPagina();
h2('BLOQUE «HERRAMIENTAS»');

ficha({
  nombre: 'Rellenar en tanda', ruta: '/gestor/luz/rellenar',
  paraQue: 'Elegir UN campo y rellenarlo de golpe en todos los registros que lo tienen vacío.',
  logica: 'El orden no es por cuántos faltan, es por qué bloquea: 40 clientes sin email no paran nada; 5 CUPS sin fecha de fin paran la Agenda entera. Cada hueco lleva su porqué escrito. Se guarda fila a fila por la API buena, no en bloque, para no saltarse la sincronización de estados.',
  conecta: 'Lee clientes y CUPS, escribe por el mismo camino que el resto.',
  veredicto: 'REFORZAR',
  cambio: 'LA PANTALLA MÁS INFRAVALORADA DEL SISTEMA. Con 223 sin teléfono y 89 CUPS sin fecha, es exactamente la herramienta que hace falta ahora mismo. Subirla al bloque Oficina, visible.',
});

ficha({
  nombre: 'Automatizaciones de fase', ruta: '/gestor/luz/automatismos',
  paraQue: 'Detectar el trabajo que debería existir por la fase de cada expediente y todavía no existe.',
  logica: 'Idempotente por naturaleza: el par (expediente, tipo de tarea) es la llave, así que ejecutarlo 200 veces da lo mismo que una. No escribe nada — propone, y aplica una persona. Ninguna regla toca etapas, precios ni contratos.',
  conecta: 'Lee toda la cartera y propone tareas. Es el único apartado que genera trabajo en vez de consumirlo.',
  veredicto: 'REFORZAR',
  cambio: 'Con 90 oportunidades paradas y 89 tareas vencidas, es la palanca directa para reactivar la cartera. Ejecutarlo y aplicar lo que proponga sería el mejor uso de la próxima hora.',
});

ficha({
  nombre: 'Calculadora FV', ruta: '/gestor/luz/fv',
  paraQue: 'Presupuestar instalaciones fotovoltaicas, con escenarios, baterías y oferta en PDF.',
  logica: 'Dos flujos (presupuesto del instalador y presupuestar desde consumos), algoritmo de batería por amortización y simulación horaria. El porcentaje de autoconsumo es la fuente única en toda la oferta.',
  conecta: 'Prácticamente nada: lee clientes y vive en sus propias tablas fv_*. Es un producto entero dentro del CRM.',
  veredicto: 'MANTENER',
  cambio: '2.800 líneas y 5 presupuestos. Está bien construida y aislada, así que no estorba. Candidata a módulo propio el día que crezca — no ahora.',
});

ficha({
  nombre: 'Tarifas y comparador', ruta: '/gestor/luz/tarifas',
  paraQue: 'Mantener los precios de las comercializadoras que usan los estudios.',
  logica: 'Catálogo de ofertas por tarifa de acceso con su margen.',
  conecta: 'Alimenta directamente el motor de comparativa de Estudios.',
  veredicto: 'MANTENER',
  cambio: 'Sin cambios: sin esto, Estudios no puede comparar nada. Conviene revisar que los precios estén al día antes de la próxima propuesta.',
});

ficha({
  nombre: 'Proyectos de ahorro', ruta: '/gestor/luz/proyectos',
  paraQue: 'Guardar propuestas de ahorro con sus datos en un JSON libre.',
  logica: 'Tabla genérica (título + JSON). Sin estructura, sin estados y sin conexión con el resto.',
  conecta: 'Prácticamente nada.',
  veredicto: 'RETIRAR',
  cambio: 'CERO registros desde que existe. Lo que pretendía hacer lo hacen ahora Estudios (comparativa) y Actuaciones (mejoras técnicas), los dos con estructura de verdad. Quitar.',
});

ficha({
  nombre: 'Precio de la luz', ruta: '/gestor/luz/mercado',
  paraQue: 'Consultar la evolución del precio del mercado mayorista.',
  logica: 'Pantalla informativa. No lee ni escribe ningún dato del CRM.',
  conecta: 'Con nada.',
  veredicto: 'RETIRAR',
  cambio: 'Es información pública que se consulta mejor en su fuente. No decide nada dentro del sistema y ocupa un destino.',
});

ficha({
  nombre: 'Guía rápida', ruta: '/gestor/luz/guia',
  paraQue: 'Explicar cómo se usa el sistema.',
  logica: 'Documentación estática.',
  conecta: 'Con nada, y está bien así.',
  veredicto: 'MANTENER',
  cambio: 'Con un equipo de tres y un sistema de 24 pantallas, esto vale más de lo que parece. Actualizarla tras la consolidación.',
});

ficha({
  nombre: 'Captura rápida y Alta guiada', ruta: '/gestor/luz/captura · /alta',
  paraQue: 'Meter un cliente o una factura en caliente, desde el móvil.',
  logica: 'El alta guiada no se puede repetir: cada paso recuerda lo que ya creó. El cerrojo del doble envío es un ref y no un estado, porque el estado tarda un render y en el móvil daba tiempo a dos toques.',
  conecta: 'Crean cliente, oportunidad, tarea y fecha de una vez.',
  veredicto: 'MANTENER',
  cambio: 'Sin cambios. Son la puerta de entrada del dato y están bien resueltas. El problema no es la puerta, es que no se usa.',
});

// ── Ajustes y energía ──
nuevaPagina();
h2('BLOQUE «AJUSTES»');

ficha({
  nombre: 'Control general · Usuarios · Configuración · Papelera', ruta: '/gestor/luz/control · /usuarios · /configuracion · /papelera',
  paraQue: 'Auditoría completa, permisos por rol y módulo, responsables y recuperación de lo borrado.',
  logica: 'La papelera arrastra los hijos marcándolos con el id del padre, para que al restaurar vuelvan exactamente los que se fueron con él. Los roles se comprueban en el servidor, no escondiendo el menú.',
  conecta: 'Transversales a todo el sistema.',
  veredicto: 'MANTENER',
  cambio: 'Sin cambios. Nacen plegados y ese es su sitio: se tocan una vez y se olvidan.',
});

h2('MÓDULO «GESTIÓN ENERGÉTICA» — nuevo');

ficha({
  nombre: 'Expedientes energéticos', ruta: '/gestor/energia',
  paraQue: 'La otra mitad del negocio: no vender un precio mejor, sino consumir menos.',
  logica: 'Tres contadores que filtran la misma tabla. Los plazos son MUY distintos de los comerciales: dos meses en diagnóstico es normal porque hay que juntar un año de facturas; dos meses en una oportunidad comercial es estar muerto.',
  conecta: 'Comparte cliente, suministros, tareas y documentos con la cartera. La ISO es una pestaña dentro del expediente, nunca un módulo aparte.',
  veredicto: 'VIGILAR',
  cambio: 'Base de datos y pantallas listas, CERO expedientes. NO ampliar hasta tener uno real funcionando de punta a punta. Construir más ahora es repetir el error de Estudios: mucha función y nada de uso.',
});

ficha({
  nombre: 'Ficha del expediente', ruta: '/gestor/energia/[id]',
  paraQue: 'Llevar un cliente desde «tiene un problema» hasta «esto ha ahorrado», con las evidencias colocadas.',
  logica: 'Con cobertura parcial NO se da cifra anual: se dice cuántos días faltan y se listan los huecos con fechas para poder pedirlos. El ahorro previsto y el comprobado van en columnas separadas: es la línea entre una promesa y un hecho.',
  conecta: 'Cliente y suministros de la cartera; medidas, actuaciones, documentos y evidencias propias.',
  veredicto: 'VIGILAR',
  cambio: 'Las pestañas Datos, Actuaciones y Documentos enseñan pero aún no dejan meter nada. Completar SOLO cuando haya un cliente real esperando usarlas.',
});

// ═══════════════════════════════════════════════════════════════════════════
nuevaPagina();
h1('4. Los solapes: tres pantallas para una pregunta');

parrafo('Aquí está el «mil cosas y uso dos». No son funciones inútiles: son la misma pregunta '
  + 'contestada desde tres sitios, y eso obliga a elegir cuál mirar cada mañana — que es una '
  + 'decisión que nadie quiere tomar antes del café.');

h2('Solape 1: «¿a dónde voy hoy?» — tres pantallas');
tabla(
  [{ t: 'PANTALLA', w: 52 }, { t: 'QUÉ APORTA', w: 74 }, { t: 'TAMAÑO', w: 48 }],
  [
    { v: ['Rutas de visitas', 'Mapa, plan de rutas, oportunidades de paso', '1.923 líneas'] },
    { v: ['Mi Día > Por zona', 'La misma agrupación por zona', 'dentro de 1.259'] },
    { v: ['Mapa de oportunidades', 'Los prospectos que aún no son clientes', '1.509 líneas'] },
  ]);
parrafo('PROPUESTA: un solo destino «Calle» con dos pestañas — «Mi ruta de hoy» (lo que ya es '
  + 'cliente u oportunidad) y «A quién más visitar» (los 719 prospectos). Se ahorra un destino de '
  + 'menú y, sobre todo, se deja de decidir por dónde empezar.', 9, 'bold');

h2('Solape 2: «¿qué tengo pendiente?» — cuatro pantallas');
tabla(
  [{ t: 'PANTALLA', w: 52 }, { t: 'DESDE QUÉ ÁNGULO', w: 122 }],
  [
    { v: ['Mi Día', 'Por fecha y por persona — lo mío de hoy'] },
    { v: ['Bandeja', 'Por a quién bloquea — lo de oficina'] },
    { v: ['Tareas', 'La tabla entera, para mantener'] },
    { v: ['Control de cartera', 'Lo que no tiene siguiente paso'] },
  ]);
parrafo('Las cuatro leen luz_tareas. Mi Día y Bandeja se justifican: son dos personas con dos '
  + 'formas de trabajar. Tareas y Control de cartera no necesitan destino propio: la primera baja '
  + 'a Herramientas y la segunda entra como pestaña del Dashboard.', 9, 'bold');

h2('Solape 3: «¿cuánto puede ahorrar?» — tres pantallas');
tabla(
  [{ t: 'PANTALLA', w: 52 }, { t: 'ESTADO', w: 122 }],
  [
    { v: ['Estudios y propuestas', 'Estructurado, con versiones y precios congelados — 1 uso'] },
    { v: ['Proyectos de ahorro', 'JSON libre, sin estados — 0 usos'], color: ROJO },
    { v: ['Calculadora FV', 'Producto aparte, bien aislado — 5 usos'] },
  ]);
parrafo('PROPUESTA: retirar Proyectos. Estudios cubre la comparativa y Actuaciones (en Energía) '
  + 'cubre las mejoras técnicas, las dos con estructura de verdad.', 9, 'bold');

// ═══════════════════════════════════════════════════════════════════════════
nuevaPagina();
h1('5. Las decisiones, en una tabla');

tabla(
  [{ t: 'APARTADO', w: 62 }, { t: 'DECISIÓN', w: 28 }, { t: 'POR QUÉ', w: 84 }],
  [
    { v: ['Fechas críticas', 'RETIRAR', 'Duplica un vencimiento que ya se calcula'], color: ROJO, fuerte: true },
    { v: ['Proyectos de ahorro', 'RETIRAR', '0 registros; lo cubre Estudios'], color: ROJO, fuerte: true },
    { v: ['Precio de la luz', 'RETIRAR', 'No decide nada dentro del sistema'], color: ROJO, fuerte: true },
    { v: ['Consumo (Datadis)', 'RETIRAR', 'Sin autorizaciones, no puede funcionar'], color: ROJO, fuerte: true },
    { v: ['Control de cartera', 'FUSIONAR', 'Pestaña del Dashboard'], color: AMBAR, fuerte: true },
    { v: ['Rutas + Oportunidades', 'FUSIONAR', 'Un solo destino «Calle»'], color: AMBAR, fuerte: true },
    { v: ['Tareas', 'DEGRADAR', 'Mi Día ya es la lista'], color: AMBAR },
    { v: ['Parte del día', 'DEGRADAR', 'Sin actividad sale vacío'], color: AMBAR },
    { v: ['Equipo y logros', 'DEGRADAR', 'Un marcador a cero desmotiva'], color: AMBAR },
    { v: ['Duplicados', 'DEGRADAR', 'Se usa tras importar y nada más'], color: AMBAR },
    { v: ['Rellenar en tanda', 'REFORZAR', 'Es la herramienta que hace falta HOY'], color: VERDE, fuerte: true },
    { v: ['Automatizaciones', 'REFORZAR', 'Reactiva 90 oportunidades paradas'], color: VERDE, fuerte: true },
    { v: ['Ficha de suministro', 'REFORZAR', 'Ahí están los 89 CUPS sin fecha'], color: VERDE, fuerte: true },
    { v: ['Ficha del cliente', 'SIMPLIFICAR', '2.426 líneas: partir los formularios'], color: AMBAR },
    { v: ['Mi Día', 'MANTENER', 'Mover su código fuera de /agenda'], color: VERDE },
    { v: ['Dashboard, Bandeja, Clientes', 'MANTENER', 'El núcleo. No tocar.'], color: VERDE },
    { v: ['Pipeline, Contratos, Comisiones', 'MANTENER', 'La cadena del dinero'], color: VERDE },
    { v: ['Estudios', 'VIGILAR', 'Bien hecho, sin materia prima'], color: GRIS },
    { v: ['Calculadora FV', 'MANTENER', 'Aislada; no estorba'], color: VERDE },
    { v: ['Gestión energética', 'VIGILAR', 'No ampliar sin un caso real'], color: GRIS },
    { v: ['Ajustes (4 pantallas)', 'MANTENER', 'Ya están plegados'], color: VERDE },
  ], 8.5);

destacado('EL RESULTADO',
  'De 41 apartados publicados a 24 destinos en el menú diario. Ninguna función se pierde: lo '
  + 'retirado o duplicaba un dato o nunca se usó, y lo degradado sigue existiendo un clic más '
  + 'abajo. Lo que se gana no es espacio, es no tener que elegir cada mañana entre cuatro '
  + 'pantallas que contestan casi lo mismo.', AZUL);

// ═══════════════════════════════════════════════════════════════════════════
nuevaPagina();
h1('6. El plan: cuatro semanas');

destacado('EL ORDEN IMPORTA',
  'Primero se arregla la alimentación, después se limpia el menú y solo al final se amplía. Al '
  + 'revés —que es lo que se venía haciendo— cada función nueva nace sin datos que la sostengan.', AZUL);

h2('Semana 1 — Reactivar (sin tocar una línea de código)');
tabla(
  [{ t: 'ACCIÓN', w: 108 }, { t: 'DÓNDE', w: 66 }],
  [
    { v: ['Ejecutar las automatizaciones y aplicar lo que proponga', 'Automatizaciones'], fuerte: true },
    { v: ['Cerrar o reprogramar las 89 tareas vencidas', 'Mi Día'], fuerte: true },
    { v: ['Rellenar la fecha de fin de contrato de los 89 CUPS', 'Rellenar en tanda'], fuerte: true },
    { v: ['Revisar los 8 contratos parados desde el 6 de agosto', 'Contratos'] },
    { v: ['Reclamar las 30 comisiones pendientes', 'Comisiones'] },
  ], 9);
parrafo('Esto no necesita desarrollo: el sistema ya lo hace. Es una tarde de Nicola y una mañana '
  + 'de Marcos, y devuelve la cartera a un estado en el que el CRM vuelve a decir la verdad.', 9, 'normal', GRIS);

h2('Semana 2 — Consolidar el menú');
tabla(
  [{ t: 'ACCIÓN', w: 108 }, { t: 'EFECTO', w: 66 }],
  [
    { v: ['Retirar Fechas, Proyectos, Mercado y Consumo', '4 destinos menos'], fuerte: true },
    { v: ['Control de cartera pasa a pestaña del Dashboard', '1 destino menos'] },
    { v: ['Tareas, Parte, Equipo y Duplicados a Herramientas', 'Menú diario más corto'] },
    { v: ['Rellenar en tanda sube a Oficina, visible', 'Se usa la que hace falta'] },
    { v: ['Añadir la vista «Sin teléfono» a Clientes', 'Ataca el hueco mayor'] },
  ], 9);

h2('Semana 3 — Cerrar la fuga de la calle');
tabla(
  [{ t: 'ACCIÓN', w: 108 }, { t: 'POR QUÉ', w: 66 }],
  [
    { v: ['Unir Rutas y Oportunidades en un destino «Calle»', 'Una sola decisión'], fuerte: true },
    { v: ['Comprobar que registrar una visita cuesta 2 toques', 'Cero visitas en 30 días'], fuerte: true },
    { v: ['Mover el código de Mi Día fuera de /agenda', 'Mantenimiento'] },
  ], 9);
parrafo('El paso 3 de la cadena —visitar y registrar— es donde se rompe todo. Si registrar una '
  + 'visita cuesta más que no registrarla, no se registra, y el resto del sistema se queda ciego.',
  9, 'normal', GRIS);

h2('Semana 4 — Solo entonces, ampliar');
tabla(
  [{ t: 'ACCIÓN', w: 108 }, { t: 'CONDICIÓN', w: 66 }],
  [
    { v: ['Cargar medidas en Gestión energética desde Excel', 'Con UN cliente real'], fuerte: true },
    { v: ['Completar Datos, Actuaciones y Documentos', 'Solo si el anterior se usa'] },
    { v: ['Pedir la primera autorización de Datadis', 'Devuelve el módulo Consumo'] },
  ], 9);

y += 3;
separador();
h2('Y una recomendación que no es de software');

parrafo('El sistema está por delante de la operación. Eso no es un defecto del sistema — está bien '
  + 'construido, es coherente y no se contradice a sí mismo, que es más de lo que se puede decir de '
  + 'la mayoría de los CRM a medida. El problema es que se ha construido más rápido de lo que tres '
  + 'personas pueden adoptar.', 9.5);

parrafo('La pregunta útil para las próximas semanas no es «qué le falta al CRM», sino «qué es lo '
  + 'único que David y Nicola van a hacer todos los días sin falta». Sea lo que sea, esa pantalla '
  + 'tiene que ser la mejor del sistema y las demás pueden esperar. Todo lo que se construya antes '
  + 'de contestar esa pregunta se va a quedar, como Estudios, esperando materia prima que no llega.', 9.5);

y += 3;
destacado('SI SOLO SE HACE UNA COSA DE TODO ESTE INFORME',
  'Rellenar la fecha de fin de contrato de los 89 suministros que no la tienen. Es media tarde de '
  + 'trabajo con la pantalla de Rellenar en tanda, y convierte 89 clientes invisibles en 89 avisos '
  + 'de renovación que el sistema dará solo, a tiempo, durante años. No hay ninguna otra acción en '
  + 'este documento con esa relación entre esfuerzo y retorno.', VERDE);

pie();
writeFileSync(SALIDA, Buffer.from(doc.output('arraybuffer')));
console.log(`PDF generado: ${SALIDA} · ${pagina} páginas`);
