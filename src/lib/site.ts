export type MegaLink = {
  title: string;
  description: string;
  href: string;
  icon: string;
};

export type NavItem =
  | { label: string; href: string; type?: "link" }
  | { label: string; href: string; type: "mega"; items: MegaLink[]; cta: string };

export const servicesMega: MegaLink[] = [
  {
    title: "Análisis de facturas",
    description: "Desglose completo de consumo, potencia y costes ocultos.",
    href: "/analizador",
    icon: "spark",
  },
  {
    title: "Auditorías energéticas",
    description: "Evaluación técnica de tu instalación y propuestas de mejora.",
    href: "/servicios",
    icon: "contract",
  },
  {
    title: "Instalaciones solares",
    description: "Solar fotovoltaica diseñada para tu caso. ROI detallado.",
    href: "/servicios",
    icon: "solar",
  },
  {
    title: "Almacenamiento y CAES",
    description: "Baterías, almacenamiento térmico y soluciones de aire comprimido.",
    href: "/servicios",
    icon: "leaf",
  },
];

export const sectorsMega: MegaLink[] = [
  {
    title: "Viviendas unifamiliares",
    description: "Solar, baterías y autosuficiencia máxima.",
    href: "/sectores",
    icon: "building",
  },
  {
    title: "Pequeños negocios",
    description: "Optimización de potencia, auditorías y solar.",
    href: "/sectores",
    icon: "factory",
  },
  {
    title: "Industrias medianas",
    description: "Análisis de picos, CAES, solar industrial y gestión energética.",
    href: "/sectores",
    icon: "factory",
  },
  {
    title: "Comercio, agricultura y más",
    description: "Soluciones personalizadas por sector.",
    href: "/sectores",
    icon: "leaf",
  },
];

export const navigation: NavItem[] = [
  { label: "Servicios", href: "/servicios", type: "mega", items: servicesMega, cta: "Ver todos" },
  { label: "Sectores", href: "/sectores", type: "mega", items: sectorsMega, cta: "Ver todos" },
  { label: "Grupo", href: "/grupo", type: "link" },
  { label: "Sobre nosotros", href: "/sobre-nosotros", type: "link" },
];

export const siteConfig = {
  name: "Gesmeco Energía",
  description:
    "Asesoramiento energético, auditorías, análisis de facturas, solar fotovoltaica, CAES y soluciones de ahorro energético.",
  contact: {
    email: "marcos.benedico@correbin.es",
    phone: "",
    address: "Avenida de Aragón, 50, Bínefar, 22500",
  },
  actions: {
    primaryCta: "Analizar factura",
    secondaryCta: "Solicitar auditoría",
  },
};

export const brandHighlights = {
  headline: "Reduce tu factura de luz. Aquí está el cómo.",
  subheadline:
    "Asesoramiento energético, auditorías, análisis de facturas, solar fotovoltaica, CAES y soluciones de ahorro energético.",
};
