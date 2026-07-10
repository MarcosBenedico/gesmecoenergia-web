import { MobileInvoiceAnalyzer } from '@/components/mobile-invoice-analyzer';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'App Móvil | Gesmeco Energía',
  description: 'Analiza tu factura de luz en tu móvil. Escanea o introduce manualmente tus datos.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function MobileApp() {
  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-border/30 z-10 px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <h1 className="text-lg font-bold">Gesmeco Energía</h1>
          <Link
            href="/mobile/consumos"
            className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-secondary transition"
          >
            <BarChart3 className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto">
        <MobileInvoiceAnalyzer />
      </div>
    </div>
  );
}
