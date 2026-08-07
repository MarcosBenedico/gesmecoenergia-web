import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

/**
 * Serif de titulares, solo para la portada del grupo.
 *
 * No es un capricho ni una fuente «bonita» cualquiera: los tres logotipos del
 * grupo —Gesmeco Energía, Asesoría Gesmeco y Correbin— están compuestos en una
 * serif de alto contraste con itálica. Al usar la misma familia para los
 * titulares de la página que los presenta, el texto y las marcas hablan el
 * mismo idioma en vez de convivir a la fuerza.
 *
 * Solo dos pesos y solo donde hace falta: una fuente de titulares que se
 * cargue entera para pintar tres frases es peso tirado.
 */
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-titular",
  display: "swap",
  weight: ["500", "700"],
  style: ["normal", "italic"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  title: "Gesmeco Energía | Tu asesor energético en Binéfar",
  description:
    "Análisis de facturas de luz y gas, auditorías energéticas y solar fotovoltaica en Binéfar. Parte del Grupo Gesmeco: energía, asesoría y seguros.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Gesmeco Energía",
  },
  icons: {
    // Estos dos apuntaban a "/gesmeco-logo.png", que NO existe: el archivo se
    // llama logo-gesmeco.png (las palabras al revés). Resultado: un 404 en
    // TODAS las páginas del sitio y el icono roto en la pestaña y al añadir a
    // la pantalla de inicio. Se usan los iconos hechos para esto, que son los
    // mismos que ya declara manifest.json — el 180 es la medida de Apple.
    icon: "/icon-192.png",
    apple: "/icon-180.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        {/* iOS meta tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Gesmeco Energía" />
        <meta name="apple-itunes-app" content="app-id=123456789" />

        {/* Icons */}
        <link rel="apple-touch-icon" href="/icon-180.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />

        {/* Android */}
        <meta name="theme-color" content="#6366f1" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.variable} ${playfair.variable} bg-background text-foreground antialiased`}>
        {children}
      </body>
    </html>
  );
}
