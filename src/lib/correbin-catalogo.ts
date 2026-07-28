/**
 * CORREBIN · Sectores y soluciones.
 *
 * Volumen VI (sectores) y Volumen VII (soluciones por riesgo). Cada entrada
 * tiene contenido propio: exposiciones, datos que se piden y puntos técnicos
 * reales. Los volúmenes prohíben expresamente clonar páginas cambiando el
 * título, así que aquí no hay dos fichas iguales.
 *
 * Nada de esto afirma experiencia, cartera ni acuerdos: describe riesgos y
 * método de trabajo, que es lo único verificable.
 */

export interface Ficha {
  slug: string;
  nombre: string;
  /** Titular de la página. */
  titular: string;
  /** Frase que resume el criterio técnico (de los propios volúmenes). */
  mensaje: string;
  entradilla: string;
  /** Metadatos SEO propios (Volumen VIII): únicos por página. */
  metaTitulo: string;
  metaDescripcion: string;
  /** Bloques de contenido: cada uno con su título y sus puntos. */
  bloques: { titulo: string; subtitulo?: string; puntos: string[] }[];
  /** Datos que hay que reunir para poder trabajar el riesgo. */
  datos?: string[];
  /** Enlaces cruzados: sectores ↔ soluciones (criterio del Volumen VI). */
  relacionadas?: { href: string; texto: string }[];
  cta: string;
}

/* ══════════════════════════ SECTORES (Volumen VI) ══════════════════════════ */

export const SECTORES: Ficha[] = [
  {
    slug: 'transporte-y-logistica',
    nombre: 'Transporte y logística',
    titular: 'Transporte y logística',
    mensaje: 'En transporte, una sola exclusión puede dejar fuera el núcleo de la actividad.',
    entradilla:
      'Flota, mercancía, talleres, campas y responsabilidad frente a quien contrata el porte. Son pólizas distintas que tienen que leerse juntas, porque el hueco casi siempre aparece en la frontera entre una y otra.',
    metaTitulo: 'Seguros para transporte y logística · Correbin Asociados',
    metaDescripcion:
      'Flotas, mercancías, responsabilidad contractual, talleres y almacenes. Análisis conjunto de auto, RC y mercancías, con homogeneización de límites y procedimiento de siniestros.',
    bloques: [
      {
        titulo: 'Dónde está la exposición',
        subtitulo: 'Lo que hay que mirar en una empresa de transporte',
        puntos: [
          'Flota y circulación',
          'Mercancías',
          'Responsabilidad contractual',
          'Taller propio o reparación a terceros',
          'Almacenes y campas',
          'Carga y descarga',
          'Empleados y convenio',
          'Internacionalización',
        ],
      },
      {
        titulo: 'Cómo trabajamos el riesgo',
        subtitulo: 'El orden importa: primero el inventario, después el mercado',
        puntos: [
          'Inventario de riesgos',
          'Revisión de las actividades declaradas',
          'Análisis conjunto de auto, RC y mercancías',
          'Homogeneización de límites',
          'Negociación de mercado',
          'Procedimiento de siniestros',
        ],
      },
    ],
    relacionadas: [
      { href: '/seguros/soluciones/flotas', texto: 'Flotas y vehículos de empresa' },
      { href: '/seguros/soluciones/transporte-de-mercancias', texto: 'Transporte de mercancías' },
      { href: '/seguros/soluciones/responsabilidad-civil', texto: 'Responsabilidad civil empresarial' },
    ],
    cta: 'Solicitar estudio de flota y mercancías',
  },
  {
    slug: 'agroalimentario',
    nombre: 'Agroalimentario',
    titular: 'Industria agroalimentaria',
    mensaje:
      'Protección patrimonial, continuidad de actividad y responsabilidad de producto en un mismo programa.',
    entradilla:
      'Mataderos, salas de despiece, secaderos, fábricas de piensos y logística alimentaria. Aquí una avería de maquinaria no es solo el coste de la reparación: es la mercancía que se pierde y los días que se deja de producir.',
    metaTitulo: 'Seguros para industria agroalimentaria · Correbin Asociados',
    metaDescripcion:
      'Frío industrial, avería de maquinaria, pérdida de beneficios, contaminación, responsabilidad y retirada de producto. Programa asegurador para la industria alimentaria.',
    bloques: [
      {
        titulo: 'Subsectores',
        puntos: [
          'Mataderos y salas de despiece',
          'Industrias alimentarias',
          'Almacenes y secaderos',
          'Fábricas de piensos',
          'Frío industrial',
          'Logística alimentaria',
        ],
      },
      {
        titulo: 'Riesgos característicos',
        subtitulo: 'Los tres frentes: daños, continuidad y producto',
        puntos: [
          'Avería de maquinaria',
          'Daños por temperatura',
          'Pérdida de beneficios',
          'Contaminación',
          'Responsabilidad de producto',
          'Retirada de producto',
          'Mercancías',
          'Dependencia energética',
          'Cadena de frío',
        ],
      },
    ],
    relacionadas: [
      { href: '/seguros/soluciones/multirriesgo-empresarial', texto: 'Multirriesgo empresarial e industrial' },
      { href: '/seguros/soluciones/responsabilidad-civil', texto: 'Responsabilidad civil y producto' },
      { href: '/seguros/soluciones/transporte-de-mercancias', texto: 'Transporte de mercancías' },
    ],
    cta: 'Revisar el programa de mi industria',
  },
  {
    slug: 'agricultura-y-ganaderia',
    nombre: 'Agricultura y ganadería',
    titular: 'Explotaciones agrícolas y ganaderas',
    mensaje: 'Los bienes de una explotación están repartidos, y las pólizas suelen ir por su cuenta.',
    entradilla:
      'Naves, ganado, maquinaria, vehículos agrícolas, almacenes y placas en la cubierta. Cada cosa se contrató en un momento distinto y con una compañía distinta: ordenarlo es la mitad del trabajo.',
    metaTitulo: 'Seguros para granjas y explotaciones agrícolas · Correbin Asociados',
    metaDescripcion:
      'Granjas, naves, ganado, maquinaria, vehículos agrícolas e instalaciones fotovoltaicas. Actualización de capitales, cambios de censo y coordinación de pólizas.',
    bloques: [
      {
        titulo: 'Bienes y actividad',
        puntos: [
          'Granjas y naves',
          'Maquinaria',
          'Vehículos agrícolas',
          'Ganado',
          'Instalaciones eléctricas y fotovoltaicas',
          'Almacenes y existencias',
        ],
      },
      {
        titulo: 'Responsabilidades',
        puntos: [
          'RC de explotación',
          'Trabajadores',
          'Contaminación accidental',
          'Daños a terceros',
          'Circulación',
          'Servicios complementarios',
        ],
      },
      {
        titulo: 'Gestión durante el año',
        subtitulo: 'Una explotación cambia de censo y de bienes constantemente',
        puntos: [
          'Actualización de capitales',
          'Cambios de censo o actividad',
          'Siniestros meteorológicos',
          'Coordinación de pólizas',
        ],
      },
    ],
    relacionadas: [
      { href: '/seguros/soluciones/multirriesgo-empresarial', texto: 'Multirriesgo de la explotación' },
      { href: '/seguros/soluciones/responsabilidad-civil', texto: 'Responsabilidad civil de explotación' },
      { href: '/seguros/soluciones/flotas', texto: 'Vehículos y maquinaria' },
    ],
    cta: 'Revisar los seguros de mi explotación',
  },
  {
    slug: 'industria-comercio-y-servicios',
    nombre: 'Industria, comercio y servicios',
    titular: 'Industria, comercio y servicios',
    mensaje: 'No hace falta elegir entre nombres técnicos de pólizas: se empieza por la actividad.',
    entradilla:
      'Una nave con proceso productivo, una tienda a pie de calle y un despacho profesional no comparten casi nada. Cada uno tiene su punto débil, y rara vez es el mismo.',
    metaTitulo: 'Seguros para industria, comercio y servicios · Correbin Asociados',
    metaDescripcion:
      'Maquinaria y proceso, incendio, pérdida de beneficios, producto, robo, RC profesional, equipos y datos. Programas adaptados a pymes de distinta complejidad.',
    bloques: [
      {
        titulo: 'Industria',
        puntos: [
          'Maquinaria y proceso',
          'Incendio',
          'Pérdida de beneficios',
          'Producto',
          'Exportación',
          'Proveedores críticos',
        ],
      },
      {
        titulo: 'Comercio',
        puntos: ['Local y existencias', 'Robo', 'Daños por agua', 'RC', 'Equipos', 'Interrupción'],
      },
      {
        titulo: 'Servicios',
        puntos: ['RC profesional', 'Equipos', 'Datos', 'Defensa', 'Empleados', 'Movilidad'],
      },
    ],
    relacionadas: [
      { href: '/seguros/soluciones/multirriesgo-empresarial', texto: 'Multirriesgo empresarial' },
      { href: '/seguros/soluciones/responsabilidad-civil', texto: 'Responsabilidad civil' },
      { href: '/seguros/soluciones/ciber-directivos-y-credito', texto: 'Ciber, D&O y crédito' },
    ],
    cta: 'Revisar el programa de mi empresa',
  },
  {
    slug: 'administraciones-y-entidades',
    nombre: 'Administraciones y entidades',
    titular: 'Ayuntamientos, asociaciones y entidades',
    mensaje: 'Patrimonio público, actividades abiertas y colectivos que cambian cada temporada.',
    entradilla:
      'Instalaciones de uso público, flotas municipales, eventos y voluntariado. La particularidad no está solo en el riesgo: está en el inventario, los calendarios y la documentación administrativa.',
    metaTitulo: 'Seguros para ayuntamientos y entidades · Correbin Asociados',
    metaDescripcion:
      'Patrimonio, responsabilidad civil, accidentes colectivos, flotas, eventos y voluntariado. Metodología para entidades públicas y asociaciones.',
    bloques: [
      {
        titulo: 'Necesidades',
        puntos: [
          'Patrimonio',
          'Responsabilidad civil',
          'Accidentes colectivos',
          'Flotas',
          'Eventos',
          'Voluntariado',
          'Instalaciones',
          'Defensa jurídica',
        ],
      },
      {
        titulo: 'Particularidades',
        subtitulo: 'Lo que distingue a una entidad de una empresa',
        puntos: [
          'Inventario de bienes',
          'Límites por actividad',
          'Colectivos asegurados',
          'Uso de vehículos y maquinaria',
          'Contratación pública',
          'Calendarios y vencimientos',
          'Documentación administrativa',
        ],
      },
    ],
    relacionadas: [
      { href: '/seguros/soluciones/responsabilidad-civil', texto: 'Responsabilidad civil' },
      { href: '/seguros/soluciones/personas-y-convenio', texto: 'Accidentes colectivos' },
      { href: '/seguros/soluciones/flotas', texto: 'Flotas' },
    ],
    cta: 'Solicitar revisión para la entidad',
  },
];

/* ═══════════════════════ SOLUCIONES POR RIESGO (Volumen VII) ═══════════════════════ */

export const SOLUCIONES: Ficha[] = [
  {
    slug: 'multirriesgo-empresarial',
    nombre: 'Multirriesgo empresarial e industrial',
    titular: 'Multirriesgo empresarial e industrial',
    mensaje: 'El capital que se puso el primer año casi nunca es el que hace falta hoy.',
    entradilla:
      'Cubre el edificio, la maquinaria y las existencias, y también lo que se deja de ingresar si hay que parar. Es la póliza donde más daño hace un capital mal calculado.',
    metaTitulo: 'Multirriesgo empresarial e industrial · Correbin Asociados',
    metaDescripcion:
      'Edificios, maquinaria, existencias, avería, pérdida de beneficios y daños eléctricos. Revisión de capitales, regla proporcional y periodos de indemnización.',
    bloques: [
      {
        titulo: 'Qué se cubre',
        puntos: [
          'Edificios e instalaciones',
          'Maquinaria y equipos',
          'Existencias',
          'Daños eléctricos',
          'Robo y daños por agua',
          'Fenómenos atmosféricos',
          'Avería de maquinaria',
          'Pérdida de beneficios',
          'Gastos adicionales',
          'Bienes de terceros',
        ],
      },
      {
        titulo: 'Puntos técnicos que revisamos',
        subtitulo: 'Aquí es donde se decide si la póliza responde o no',
        puntos: [
          'Valor de reconstrucción',
          'Regla proporcional',
          'Primer riesgo',
          'Periodos de indemnización',
          'Dependencia de suministros',
          'Frío industrial',
          'Placas fotovoltaicas',
          'Medidas de protección',
        ],
      },
    ],
    relacionadas: [
      { href: '/seguros/sectores/agroalimentario', texto: 'Industria agroalimentaria' },
      { href: '/seguros/sectores/industria-comercio-y-servicios', texto: 'Industria y comercio' },
    ],
    cta: 'Revisar capitales y pérdida de beneficios',
  },
  {
    slug: 'responsabilidad-civil',
    nombre: 'Responsabilidad civil empresarial',
    titular: 'Responsabilidad civil empresarial',
    mensaje: 'La actividad mal descrita puede ser tan problemática como un límite insuficiente.',
    entradilla:
      'No existe una responsabilidad civil que lo cubra todo: hay modalidades, y cada una responde a una situación distinta. Lo primero es que la actividad esté descrita como es.',
    metaTitulo: 'Responsabilidad civil empresarial · Correbin Asociados',
    metaDescripcion:
      'Explotación, patronal, productos y postrabajos, profesional, contaminación accidental y bienes confiados. Límite por siniestro, por víctima y agregado anual.',
    bloques: [
      {
        titulo: 'Modalidades',
        puntos: [
          'Explotación',
          'Inmobiliaria y locativa',
          'Patronal',
          'Productos y postrabajos',
          'Profesional',
          'Subsidiaria y cruzada',
          'Trabajos fuera de instalaciones',
          'Contaminación accidental',
          'Bienes confiados',
          'Carga y descarga',
        ],
      },
      {
        titulo: 'Qué revisamos',
        puntos: [
          'Facturación',
          'Actividad exacta',
          'Ámbito geográfico',
          'Tipo de clientes',
          'Trabajos subcontratados',
          'Productos',
          'Límite por siniestro',
          'Límite por víctima',
          'Agregado anual',
          'Franquicias y exclusiones',
        ],
      },
    ],
    relacionadas: [
      { href: '/seguros/sectores/transporte-y-logistica', texto: 'Transporte y logística' },
      { href: '/seguros/sectores/agricultura-y-ganaderia', texto: 'Explotaciones agrarias' },
    ],
    cta: 'Revisar mi responsabilidad civil',
  },
  {
    slug: 'flotas',
    nombre: 'Flotas y vehículos de empresa',
    titular: 'Flotas y vehículos de empresa',
    mensaje: 'Una flota no se gestiona por tarifa: se gestiona por siniestralidad y por procedimiento.',
    entradilla:
      'Altas y bajas constantes, garantías distintas según quién contrató cada vehículo y vencimientos repartidos por todo el año. Ordenarlo se nota más que un par de euros en la prima.',
    metaTitulo: 'Seguro de flotas y vehículos de empresa · Correbin Asociados',
    metaDescripcion:
      'Camiones, cabezas tractoras, remolques, maquinaria y vehículos agrícolas. Inventario, altas y bajas, homogeneización de garantías y análisis de siniestralidad.',
    bloques: [
      {
        titulo: 'Vehículos',
        puntos: [
          'Turismos y furgonetas',
          'Camiones y cabezas tractoras',
          'Remolques',
          'Maquinaria y vehículos especiales',
          'Vehículos agrícolas',
        ],
      },
      {
        titulo: 'Qué incluye el servicio',
        puntos: [
          'Inventario de flota',
          'Altas y bajas',
          'Homogeneización de garantías',
          'Análisis de siniestralidad',
          'Conductores y uso',
          'Asistencia',
          'Lunas y defensa',
          'Accidentes del conductor',
          'Calendario y procedimiento interno',
        ],
      },
    ],
    datos: [
      'Relación de vehículos con matrícula, tipo y uso',
      'Siniestralidad de los últimos años',
      'Garantías contratadas actualmente',
      'Conductores habituales y ámbito de circulación',
    ],
    relacionadas: [
      { href: '/seguros/sectores/transporte-y-logistica', texto: 'Transporte y logística' },
      { href: '/seguros/soluciones/transporte-de-mercancias', texto: 'Transporte de mercancías' },
    ],
    cta: 'Solicitar estudio de flota',
  },
  {
    slug: 'transporte-de-mercancias',
    nombre: 'Transporte de mercancías',
    titular: 'Transporte de mercancías',
    mensaje: 'Seguro de mercancías y responsabilidad del transportista no son la misma protección.',
    entradilla:
      'Una cubre la mercancía; la otra, lo que el transportista debe responder según el contrato y la normativa. Confundirlas es de los errores que más caro salen.',
    metaTitulo: 'Seguro de transporte de mercancías y CMR · Correbin Asociados',
    metaDescripcion:
      'Mercancías propias y de terceros, CMR y transporte internacional, robo, mojadura, rotura, temperatura y paralización. Datos necesarios para cotizar bien.',
    bloques: [
      {
        titulo: 'Riesgos',
        puntos: [
          'Mercancías propias',
          'Mercancías de terceros',
          'CMR y transporte internacional',
          'Robo, mojadura y rotura',
          'Carga y descarga',
          'Daños por temperatura',
          'Mercancía refrigerada',
          'Almacenamientos intermedios',
          'Paralización',
        ],
      },
    ],
    datos: [
      'Tipo de mercancía',
      'Valor máximo por vehículo',
      'Ámbito territorial',
      'Medios de transporte',
      'Subcontratación',
      'Sistemas de frío',
      'Medidas antirrobo',
      'Siniestralidad',
      'Condiciones de compraventa',
    ],
    relacionadas: [
      { href: '/seguros/sectores/transporte-y-logistica', texto: 'Transporte y logística' },
      { href: '/seguros/soluciones/flotas', texto: 'Flotas y vehículos' },
    ],
    cta: 'Revisar mercancías y responsabilidad',
  },
  {
    slug: 'personas-y-convenio',
    nombre: 'Personas, convenio y previsión',
    titular: 'Personas, convenio y previsión',
    mensaje: 'El convenio marca capitales obligatorios, y la plantilla cambia todo el año.',
    entradilla:
      'Accidentes de convenio, vida y salud colectivos, y la protección de quien sostiene el negocio. Requiere estar al día de altas, bajas y cambios normativos.',
    metaTitulo: 'Accidentes de convenio y seguros de personas · Correbin Asociados',
    metaDescripcion:
      'Accidentes de convenio, vida y salud colectiva, socios y hombre clave. Control de capitales obligatorios, altas, bajas y beneficiarios.',
    bloques: [
      {
        titulo: 'Soluciones',
        puntos: [
          'Accidentes de convenio',
          'Vida colectivo',
          'Salud colectiva',
          'Accidentes colectivo',
          'Socios y hombre clave',
          'Continuidad empresarial',
          'Beneficios sociales',
        ],
      },
      {
        titulo: 'Qué hay que controlar',
        puntos: [
          'Convenio aplicable',
          'Capitales obligatorios',
          'Número de trabajadores',
          'Ámbito territorial',
          'Altas y bajas',
          'Beneficiarios',
          'Actualización por cambios normativos o de plantilla',
        ],
      },
    ],
    relacionadas: [
      { href: '/seguros/sectores/industria-comercio-y-servicios', texto: 'Industria y servicios' },
      { href: '/seguros/sectores/administraciones-y-entidades', texto: 'Entidades y colectivos' },
    ],
    cta: 'Revisar los seguros de mi plantilla',
  },
  {
    slug: 'ciber-directivos-y-credito',
    nombre: 'Ciber, directivos y crédito',
    titular: 'D&O, ciberriesgos, crédito y caución',
    mensaje: 'Riesgos menos visibles que la nave o el camión, pero que llegan al patrimonio personal.',
    entradilla:
      'Un error de gestión, un secuestro de datos o un impago importante no se parecen a un incendio, pero pueden parar una empresa igual o más.',
    metaTitulo: 'D&O, ciberriesgos, crédito y caución · Correbin Asociados',
    metaDescripcion:
      'Responsabilidad de administradores, incidentes informáticos e interrupción, impago y garantías contractuales para empresas.',
    bloques: [
      {
        titulo: 'Administradores y directivos (D&O)',
        puntos: [
          'Errores de gestión',
          'Gastos de defensa',
          'Investigaciones',
          'Reclamaciones laborales',
          'Protección patrimonial',
        ],
      },
      {
        titulo: 'Ciberriesgos',
        puntos: [
          'Incidentes y secuestro de datos',
          'Interrupción de negocio',
          'Recuperación',
          'Responsabilidad por datos',
          'Fraude y crisis',
        ],
      },
      {
        titulo: 'Crédito y caución',
        puntos: [
          'Impago',
          'Análisis de solvencia',
          'Recobro',
          'Garantías contractuales',
          'Avales y obligaciones',
        ],
      },
    ],
    relacionadas: [
      { href: '/seguros/sectores/industria-comercio-y-servicios', texto: 'Industria, comercio y servicios' },
      { href: '/seguros/empresas', texto: 'El programa completo' },
    ],
    cta: 'Hablar de estos riesgos',
  },
];

export const buscarSector = (slug: string) => SECTORES.find((s) => s.slug === slug);
export const buscarSolucion = (slug: string) => SOLUCIONES.find((s) => s.slug === slug);
