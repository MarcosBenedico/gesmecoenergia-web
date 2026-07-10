import { Container } from "@/components/container";

export const metadata = {
  title: "Aviso legal | Gesmeco Energía",
  description: "Información legal y datos de la sociedad.",
};

export default function LegalNoticePage() {
  return (
    <div className="pb-16">
      <section className="pt-14">
        <Container className="space-y-4">
          <h1 className="text-3xl font-semibold text-foreground">Aviso legal</h1>
          <p className="text-sm text-muted">
            Este es un texto placeholder de aviso legal. Sustituye este contenido por tu información
            societaria, CIF, domicilio social, datos de contacto y condiciones de uso.
          </p>
        </Container>
      </section>
    </div>
  );
}
