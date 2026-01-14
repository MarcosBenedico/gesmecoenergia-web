import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Gesmeco Energía | Estrategia y gestión energética",
  description:
    "Soluciones premium de gestión energética, PPAs, autoconsumo y descarbonización para empresas que buscan control y resultados.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} bg-background text-foreground antialiased`}>
        {children}
      </body>
    </html>
  );
}
