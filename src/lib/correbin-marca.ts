/**
 * CORREBIN · Fuente única de marca (web pública).
 *
 * Todo lo que la microsede de seguros dice sobre sí misma sale de aquí, tal y
 * como exige el Volumen I del proyecto maestro: posicionamiento, públicos,
 * mensajes, tono y datos corporativos en un solo sitio, editable sin tocar
 * las páginas.
 *
 * No confundir con `correbin.ts`, que es el dominio del panel interno
 * (vencimientos y cartera). Este archivo es solo para la web pública.
 *
 * Fuentes: Volumen I (ADN de marca) y Volumen II (Identidad visual).
 * Los volúmenes III a XII se incorporarán aquí a medida que lleguen.
 *
 * REGLAS INNEGOCIABLES (de los propios volúmenes):
 *  · La clave administrativa de mediación NO se muestra.
 *  · Correo, dirección y horario NO se publican hasta confirmación.
 *  · No se inventan cifras, clientes, testimonios, premios ni acuerdos.
 *  · No se promete ahorro, cobertura ni indemnización garantizados.
 */

/** Datos corporativos invariables (Volumen I). */
export const CORREBIN_EMPRESA = {
  nombreComercial: 'Correbin Asociados',
  razonSocial: 'CORREBIN ASOCIADOS CORREDURÍA DE SEGUROS, S.L.',
  cif: 'B22251821',
  telefono: '974 429 935',
  telefonoTel: '+34974429935',
  whatsapp: '634 623 554',
  whatsappLink: 'https://wa.me/34634623554',
  // Pendientes de confirmación: NO publicar hasta que se autoricen.
  email: null as string | null,
  direccion: null as string | null,
  horario: null as string | null,
};

/** Mensaje rector de la marca (Volumen I). Idea central de toda la microsede. */
export const CORREBIN_MENSAJE_RECTOR =
  'No contratamos seguros sin más. Gestionamos los riesgos de tu empresa.';

/** Qué es Correbin y qué no debe parecer (Volumen I · posicionamiento). */
export const CORREBIN_POSICIONAMIENTO = {
  titular: 'Broker técnico y gerente externo de riesgos',
  esto: [
    'Broker de seguros para empresas',
    'Gerencia de riesgos y auditoría de programas aseguradores',
    'Gestión continua de cartera y vencimientos',
    'Defensa y acompañamiento en siniestros',
    'Capacidad para trabajar particulares sin diluir el foco empresarial',
  ],
  estoNo: [
    'Comparador de precios',
    'Agencia monocompañía',
    'Marketplace automático',
    'Web de descuentos',
    'Departamento accesorio de energía',
    'Despacho que aparece únicamente en la renovación',
  ],
};

/**
 * La promesa: qué hace Correbin antes, durante y después de contratar
 * (Volumen I · propuesta de valor). El método, nunca el resultado.
 */
export const CORREBIN_METODO = [
  {
    fase: 'Antes de contratar',
    resumen: 'Se estudia el riesgo antes de mirar una prima.',
    puntos: [
      'Conocimiento del negocio',
      'Auditoría de las pólizas existentes',
      'Detección de carencias, duplicidades e infraseguros',
      'Preparación técnica del riesgo',
      'Acceso y negociación con mercados',
    ],
  },
  {
    fase: 'Durante la vigencia',
    resumen: 'El programa se mantiene vivo, no se archiva.',
    puntos: [
      'Emisiones y suplementos',
      'Certificados y movimientos',
      'Control de vencimientos',
      'Actualización de actividad, facturación, empleados y bienes',
      'Seguimiento de la siniestralidad',
    ],
  },
  {
    fase: 'Cuando hay siniestro',
    resumen: 'Es donde se demuestra el trabajo del corredor.',
    puntos: [
      'Apertura y documentación',
      'Interpretación contractual',
      'Coordinación pericial',
      'Seguimiento de plazos',
      'Defensa de la posición del asegurado',
    ],
  },
];

/** Públicos prioritarios (Volumen I). La empresa manda; el particular tiene su sitio. */
export const CORREBIN_PUBLICOS = {
  empresa: [
    'Empresas industriales y agroalimentarias',
    'Transportistas, operadores logísticos y flotas',
    'Ganaderos, agricultores y explotaciones',
    'Comercios, autónomos y pymes',
    'Ayuntamientos, asociaciones y entidades',
  ],
  particulares: [
    'Familias y particulares',
    'Propietarios de viviendas y vehículos',
    'Vida, salud y ahorro',
    'Comunidades de propietarios',
  ],
};

/** Mensajes aprobados (Volumen I). Usar estos, con este tono. */
export const CORREBIN_MENSAJES = [
  'Seguros de empresa con criterio de gerencia de riesgos',
  'Más que pólizas: análisis, negociación y defensa',
  'Tu programa de seguros, alineado con la realidad de tu empresa',
  'Un único interlocutor para todos los riesgos',
  'Protección antes, durante y después del siniestro',
];

/**
 * Mensajes PROHIBIDOS (Volumen I). No deben aparecer en ninguna página de
 * Correbin, ni siquiera reformulados: prometen resultado en vez de método.
 * Se dejan escritos aquí para que cualquiera que edite textos lo tenga a mano.
 */
export const CORREBIN_MENSAJES_PROHIBIDOS = [
  'El seguro más barato',
  'Te ahorramos hasta X %',
  'Contrata en dos minutos',
  'Tu tranquilidad es lo primero',
  'Todo riesgo sin letra pequeña',
  'Garantizamos la indemnización',
];

/**
 * Identidad visual (Volumen II). Azul estructural, rojo solo para acciones,
 * fondos blancos y grises cálidos, negro suave en textos. Sin paleta por ramo.
 */
export const CORREBIN_COLORES = {
  azul: '#0f2d52',        // estructural: cabeceras, bloques, tipografía fuerte
  azulMedio: '#1c4a80',
  rojo: '#c8102e',        // acciones y acentos, nunca decorativo
  fondo: '#faf9f7',       // blanco cálido
  fondoAlt: '#f2f0ec',    // gris cálido
  texto: '#1a1a1a',       // negro suave, nunca absoluto
  textoSuave: '#55534f',
  borde: '#e2ded7',
};
