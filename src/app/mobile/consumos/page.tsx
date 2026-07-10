import { MobileDashboard } from '@/components/mobile-dashboard';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mis Consumos | Gesmeco Energía',
};

export default function MobileConsumosPage() {
  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-border/30 z-10">
        <div className="flex items-center gap-3 p-4">
          <Link
            href="/mobile"
            className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-secondary transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Mis consumos</h1>
            <p className="text-xs text-muted">Histórico de análisis</p>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4">
        <MobileDashboard />
      </div>
    </div>
  );
}
