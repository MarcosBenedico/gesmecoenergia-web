import { ClientePanel } from '@/components/cliente-panel';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Mi cuenta | Gesmeco Energía',
  description: 'Consulta tus consumos, precios y gasto de luz mes a mes.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  maximumScale: 1,
  userScalable: false,
};

export default function ClientePage() {
  return <ClientePanel />;
}
