import type { Metadata } from 'next';
import { QueHeFirmado } from '@/components/que-he-firmado';

export const metadata: Metadata = {
  title: 'Qué he firmado | Entiende cualquier contrato o carta oficial',
  description:
    'Sube un contrato, una carta de Hacienda o una renovación y te decimos en lenguaje llano qué es, qué te piden, qué pasa si no haces nada y cuándo vence. Gratuito y sin registro.',
  alternates: { canonical: 'https://www.gesmecoenergia.com/que-he-firmado' },
  openGraph: {
    title: 'Qué he firmado',
    description:
      'Sube un documento y te decimos qué dice y qué tienes que hacer. Servicio informativo de Gesmeco Energía.',
    url: 'https://www.gesmecoenergia.com/que-he-firmado',
    type: 'website',
  },
};

export default function QueHeFirmadoPage() {
  return <QueHeFirmado />;
}
