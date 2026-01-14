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
    title: "Gestión energética integral",
    description: "Coberturas, riesgo y reporting ejecutivo con KPIs claros.",
    href: "/servicios",
    icon: "spark",
  },
  {
    title: "PPAs y compra a largo plazo",
    description: "Modelos financiero-regulatorios y due diligence completa.",
    href: "/servicios",
    icon: "contract",
  },
  {
    title: "Autoconsumo y generación",
    description: "Proyectos llave en mano con garantías de performance.",
    href: "/servicios",
    icon: "solar",
  },
  {
    title: "Eficiencia y descarbonización",
    description: "Planes ESG, auditorías y reducción real de emisiones.",
    href: "/servicios",
    icon: "leaf",
  },
];

export const sectorsMega: MegaLink[] = [
  {
    title: "Industria y manufactura",
    description: "Cobertura base load, control de picos y fiabilidad 24/7.",
    href: "/sectores",
    icon: "factory",
  },
  {
    title: "Logística y frío",
    description: "Eficiencia térmica, almacenamiento y alarmas en tiempo real.",
    href: "/sectores",
    icon: "snow",
  },
  {
    title: "Agroalimentario",
    description: "Autosuficiencia parcial, mejora de reactiva y ESG.",
    href: "/sectores",
    icon: "leaf",
  },
  {
    title: "Oficinas y retail",
    description: "Gestión multisede y reporting centralizado sin sorpresas.",
    href: "/sectores",
    icon: "building",
  },
];

export const navigation: NavItem[] = [
  { label: "Servicios", href: "/servicios", type: "mega", items: servicesMega, cta: "Ver todos" },
  { label: "Sectores", href: "/sectores", type: "mega", items: sectorsMega, cta: "Ver todos" },
  { label: "Sobre nosotros", href: "/sobre-nosotros", type: "link" },
  { label: "Recursos", href: "/recursos", type: "link" },
];

export const siteConfig = {
  name: "Gesmeco Energía",
  description:
    "Consultoría y gestión energética premium para empresas que buscan eficiencia, control de costes y descarbonización sin perder fiabilidad.",
  contact: {
    email: "energia@gesmeco.com",
    phone: "+34 900 000 000",
    address: "Paseo de la Castellana 120, Madrid",
  },
  actions: {
    primaryCta: "Solicitar auditoría",
    secondaryCta: "Hablar con un experto",
  },
};

export const brandHighlights = {
  headline: "Estrategia, datos y ejecución para una energía sin sobresaltos.",
  subheadline:
    "Acompañamos a empresas intensivas en consumo en todo el ciclo energético: desde la compra y el diseño contractual hasta la eficiencia y la generación distribuida.",
};
