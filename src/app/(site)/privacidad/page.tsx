import { Container } from "@/components/container";

export const metadata = {
  title: "Privacidad | Gesmeco Energía",
  description: "Política de privacidad y cookies.",
};

export default function PrivacyPage() {
  return (
    <div className="pb-16">
      <section className="pt-14">
        <Container className="space-y-4">
          <h1 className="text-3xl font-semibold text-foreground">Privacidad y cookies</h1>
          <p className="text-sm text-muted">
            Texto placeholder para la política de privacidad y cookies. Añade aquí tus cláusulas de
            tratamiento de datos, derechos ARCO y uso de tecnologías de seguimiento.
          </p>
        </Container>
      </section>
    </div>
  );
}
