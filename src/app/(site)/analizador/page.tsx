import { InvoiceAnalyzer } from '@/components/invoice-analyzer';
import { Container } from '@/components/container';

export const metadata = {
  title: 'Analizador de Facturas | Gesmeco Energía',
  description:
    'Analiza tu factura de luz y gas en 2 minutos. Descubre cuánto puedes ahorrar con nuestro analizador online gratuito.',
};

export default function AnalyzerPage() {
  return (
    <div className="pb-20">
      {/* ── BACKGROUND ── */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-accent/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/2 right-0 w-96 h-96 bg-secondary/8 rounded-full blur-3xl" />
      </div>

      <Container>
        <InvoiceAnalyzer />
      </Container>
    </div>
  );
}
