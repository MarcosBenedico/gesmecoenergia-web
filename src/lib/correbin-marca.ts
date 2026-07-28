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

/* ═══════════════════════════════════════════════════════════════════════
   VOLUMEN III · Arquitectura UX/UI  ·  VOLUMEN IV · Contenido web
   VOLUMEN V · Gerencia de riesgos
   ═══════════════════════════════════════════════════════════════════════ */

/** Menú de la microsede (Volumen III). Se entra por necesidad, sector o producto. */
export const CORREBIN_MENU = [
  { href: '/seguros/empresas', texto: 'Empresas' },
  { href: '/seguros/gerencia-de-riesgos', texto: 'Gerencia de riesgos' },
  { href: '/seguros/sectores', texto: 'Sectores' },
  { href: '/seguros/soluciones', texto: 'Soluciones' },
  { href: '/seguros/siniestros', texto: 'Siniestros' },
  { href: '/seguros/nosotros', texto: 'Nosotros' },
];

/** Llamadas a la acción principales (Volumen III). */
export const CORREBIN_CTA = {
  revision: { texto: 'Solicitar revisión', href: '/seguros/revision-de-polizas' },
  siniestro: { texto: 'Comunicar siniestro', href: '/seguros/siniestros' },
  corredor: { texto: 'Hablar con un corredor', href: '/seguros/contacto' },
};

/** Home: hero y bloque de método, con el copy del Volumen IV. */
export const CORREBIN_HOME = {
  h1: 'Seguros de empresa con criterio de gerencia de riesgos.',
  subtitulo:
    'Analizamos tu actividad, revisamos tus pólizas, negociamos con las compañías y gestionamos tus seguros durante todo el año.',
  microcopy: ['Atención directa', 'Estudio técnico', 'Acompañamiento en siniestros'],
  tituloMetodo: 'Una correduría no debería aparecer solo cuando vence la póliza.',
};

/** Método de trabajo de la home: la principal prueba de valor (Volumen IV). */
export const CORREBIN_METODO_HOME = [
  {
    fase: 'Analizamos',
    puntos: [
      'Actividad real',
      'Facturación, empleados y convenio',
      'Instalaciones, maquinaria y existencias',
      'Vehículos, mercancías y contratos',
      'Historial de siniestros',
    ],
  },
  {
    fase: 'Diseñamos',
    puntos: [
      'Capitales y límites',
      'Franquicias y sublímites',
      'Distribución entre pólizas',
      'Coberturas complementarias',
      'Prioridades de prevención',
    ],
  },
  {
    fase: 'Negociamos',
    puntos: [
      'Presentación del riesgo',
      'Mercados adecuados',
      'Cláusulas y exclusiones',
      'Prima y condiciones',
      'Renovación',
    ],
  },
  {
    fase: 'Gestionamos',
    puntos: [
      'Emisiones y suplementos',
      'Certificados',
      'Vencimientos',
      'Siniestros',
      'Actualizaciones',
    ],
  },
];

/** Matriz «qué revisamos»: prueba técnica de la home (Volumen IV). */
export const CORREBIN_QUE_REVISAMOS = [
  'Actividad declarada',
  'Capitales de continente, contenido, maquinaria y existencias',
  'Pérdida de beneficios',
  'Responsabilidades y límites por víctima',
  'Franquicias y exclusiones',
  'Ámbito territorial',
  'Mercancías y vehículos',
  'Número de empleados y convenio',
  'Cláusulas particulares',
];

/** Gerencia de riesgos: el diferenciador técnico (Volúmenes IV y V). */
export const CORREBIN_GERENCIA = {
  copyClave: 'El seguro es una parte de la gerencia de riesgos, no el proceso completo.',
  definicion: [
    'Identificar los riesgos que afectan al patrimonio, la actividad, los ingresos y la responsabilidad',
    'Decidir qué prevenir, reducir, transferir o asumir',
    'Diseñar el seguro como parte de un sistema de control, no como una compra aislada',
  ],
  estructura: [
    'Conocimiento del cliente',
    'Mapa de riesgos',
    'Auditoría de pólizas',
    'Diseño y colocación',
    'Seguimiento',
    'Gestión del siniestro',
    'Aprendizaje y mejora',
  ],
  auditoria: {
    entrada: [
      'Pólizas completas y recibos',
      'Suplementos',
      'Siniestralidad',
      'Facturación',
      'Empleados y convenio',
      'Vehículos',
      'Descripción de actividad',
      'Direcciones de riesgo',
      'Capitales, maquinaria y existencias',
    ],
    comprobaciones: [
      'Coherencia entre actividad real y declarada',
      'Adecuación de capitales',
      'Límites y agregados',
      'Sublímites ocultos',
      'Franquicias',
      'Exclusiones críticas',
      'Lagunas entre pólizas',
      'Duplicidades',
      'Regularizaciones',
    ],
    aviso:
      'Una comparación válida exige las condiciones particulares, especiales y generales. Un cuadro de primas, por sí solo, no permite comparar dos ofertas.',
  },
};

/** Empresas: el programa asegurador completo (Volumen IV). */
export const CORREBIN_EMPRESAS = {
  bloques: [
    'Patrimonio y continuidad',
    'Responsabilidad',
    'Personas',
    'Movilidad y transporte',
    'Riesgos financieros',
    'Ciber y tecnología',
    'Administradores y dirección',
    'Defensa jurídica',
  ],
  mensajes: [
    'No todas las empresas necesitan las mismas pólizas',
    'La combinación de contratos debe evitar lagunas',
    'Los límites se dimensionan según la exposición',
    'La actividad debe describirse con precisión',
    'El programa debe actualizarse cuando cambia la empresa',
  ],
  cta: 'Revisar el programa de seguros de mi empresa',
};

/** Revisión de pólizas: principal herramienta de captación (Volumen IV). */
export const CORREBIN_REVISION = {
  h1: '¿Tus pólizas reflejan cómo funciona hoy tu empresa?',
  argumentos: [
    'La empresa cambia y las pólizas pueden quedar desactualizadas',
    'Aumentos de facturación, empleados o existencias alteran el riesgo',
    'Nuevas actividades o instalaciones deben declararse',
    'Dos ofertas con igual capital pueden no ser equivalentes',
  ],
  entregables: [
    'Mapa de pólizas',
    'Calendario de vencimientos',
    'Carencias y duplicidades',
    'Capitales y límites',
    'Prioridades de actuación',
    'Alternativas de mercado',
  ],
  cta: 'Solicitar diagnóstico inicial',
  // Los entregables son adaptables: no se promete una auditoría completa gratuita.
  matiz:
    'El alcance se acuerda en cada caso, según la documentación disponible y el tamaño del programa.',
};

/** Siniestros: ruta prioritaria, accesible desde cualquier punto (Volumen IV). */
export const CORREBIN_SINIESTROS = {
  h1: 'Cuando ocurre un siniestro, empieza la parte más importante de nuestro trabajo.',
  servicio: [
    'Identificación de póliza',
    'Comunicación a la aseguradora',
    'Recopilación de pruebas',
    'Orientación documental',
    'Coordinación con peritos',
    'Revisión de cobertura y valoración',
    'Seguimiento de plazos',
    'Reclamación cuando corresponda',
  ],
  aviso:
    'En emergencias, daños personales o incendio activo, contacta primero con los servicios de emergencia y con el teléfono de asistencia de tu póliza.',
  // Se promete gestión y defensa dentro del contrato, nunca el resultado.
  limite:
    'No podemos prometer cobertura ni indemnización: eso lo determina el contrato. Sí gestionamos, explicamos, damos seguimiento y defendemos tu posición.',
};

/** Particulares: oferta personal sin desplazar el foco empresarial (Volumen IV). */
export const CORREBIN_PARTICULARES = {
  productos: [
    'Auto y moto',
    'Hogar',
    'Comunidades',
    'Vida',
    'Salud',
    'Accidentes',
    'Decesos',
    'Ahorro y jubilación',
    'Defensa jurídica',
  ],
  metodo: [
    'Revisar límites y franquicias',
    'Capitales de hogar',
    'Asistencia',
    'Defensa jurídica',
    'Beneficiarios',
    'Duplicidades',
    'Adecuación familiar y patrimonial',
  ],
  cta: 'Revisar mis seguros personales',
};

/** Quiénes somos: autoridad por identidad, método y proximidad (Volumen IV). */
export const CORREBIN_NOSOTROS = {
  copy: [
    'Correbin Asociados forma parte de Grupo Gesmeco junto con Asesoría Gesmeco y Gesmeco Energía.',
    'La coordinación entre las tres áreas permite comprender la actividad, los trabajadores, el patrimonio, las instalaciones y los costes de una empresa.',
    'Cada área mantiene su especialización profesional.',
  ],
  valores: ['Independencia', 'Rigor técnico', 'Cercanía', 'Continuidad', 'Defensa', 'Visión empresarial'],
};

/** Tipos de siniestro del formulario (Volumen III). */
export const CORREBIN_TIPOS_SINIESTRO = [
  'Daños en instalaciones o mercancía',
  'Incendio',
  'Agua',
  'Robo',
  'Accidente de circulación',
  'Daños a terceros / responsabilidad civil',
  'Accidente laboral',
  'Avería de maquinaria',
  'Otro',
];

/** Avisos que acompañan a los formularios (Volumen III). */
export const CORREBIN_AVISOS = {
  consentimiento:
    'He leído y acepto la política de privacidad. Autorizo el tratamiento de mis datos para gestionar esta solicitud.',
  salud:
    'No incluyas datos de salud ni documentación médica que no sean imprescindibles para esta gestión.',
  adjuntos:
    'Para hacernos llegar pólizas, recibos, relación de flota o informes, indícalo en el mensaje y te decimos por dónde enviarlos.',
};
