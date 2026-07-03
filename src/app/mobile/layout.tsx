import type { Metadata } from 'next';
import { ServiceWorkerRegister } from '@/components/service-worker-register';

export const metadata: Metadata = {
  title: 'Gesmeco Energía - App Móvil',
  description: 'Analiza tu factura de luz desde tu móvil',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    minimumScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Gesmeco Energía',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceWorkerRegister />
      <div className="w-full bg-background">
        {children}
      </div>
    </>
  );
}
