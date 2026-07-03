import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gesmeco Energía - App Móvil',
  description: 'Analiza tu factura de luz desde tu móvil',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
  },
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full bg-background">
      {children}
    </div>
  );
}
