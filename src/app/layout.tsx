import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
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
    icon: "/gesmeco-logo.png",
    apple: "/gesmeco-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${jakarta.variable} bg-background text-foreground antialiased`}>
        {children}
      </body>
    </html>
  );
}
