'use client';

import { useState } from 'react';
import { Button } from '@/components/button';
import { Container } from '@/components/container';
import { SectionHeading } from '@/components/section-heading';

export default function AnalizadorPage() {
  const [currentStep, setCurrentStep] = useState<'input' | 'results'>('input');
  const [formData, setFormData] = useState({
    precioKw: '',
    precioKwh: '',
    consumoMensual: '',
    potenciaContratada: '',
  });
  const [results, setResults] = useState<any>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const calculateSavings = (e: React.FormEvent) => {
    e.preventDefault();

    const precioKw = parseFloat(formData.precioKw) || 0;
    const precioKwh = parseFloat(formData.precioKwh) || 0;
    const consumoMensual = parseFloat(formData.consumoMensual) || 0;
    const potenciaContratada = parseFloat(formData.potenciaContratada) || 0;

    // Cálculos
    const costePotenciaMensual = precioKw * potenciaContratada * 12; // anual
    const costeEnergiaMensual = precioKwh * consumoMensual * 12; // anual
    const costeTotal = costePotenciaMensual + costeEnergiaMensual;

    // Ahorros estimados
    const ahorroReducirPotencia = (potenciaContratada * 0.15) * precioKw * 12; // 15% reducción
    const ahorroSolarConsumo = consumoMensual * 0.50 * precioKwh * 12; // 50% consumo cubierto
    const ahorroEficiencia = costeTotal * 0.10; // 10% mejora eficiencia
    const ahorroAlmacenamiento = (consumoMensual * precioKwh * 12) * 0.15; // 15% con CAES/batería

    const ahorroTotal =
      ahorroReducirPotencia + ahorroSolarConsumo + ahorroEficiencia + ahorroAlmacenamiento;

    setResults({
      costeActual: costeTotal,
      costePotencia: costePotenciaMensual,
      costeEnergia: costeEnergiaMensual,
      ahorros: {
        potencia: ahorroReducirPotencia,
        solar: ahorroSolarConsumo,
        eficiencia: ahorroEficiencia,
        almacenamiento: ahorroAlmacenamiento,
        total: ahorroTotal,
      },
      reduccionPorcentaje: ((ahorroTotal / costeTotal) * 100).toFixed(1),
      consumoAnual: consumoMensual * 12,
    });

    setCurrentStep('results');
  };

  const handleReset = () => {
    setFormData({
      precioKw: '',
      precioKwh: '',
      consumoMensual: '',
      potenciaContratada: '',
    });
    setResults(null);
    setCurrentStep('input');
  };

  return (
    <div className="space-y-12 pb-20">
      <section className="pt-14">
        <Container>
          <SectionHeading
            kicker="Herramienta gratis"
            title="Analiza tu factura de luz en 5 minutos"
          >
            Descubre cuánto puedes ahorrar con asesoramiento, solar, auditorías y soluciones
            de almacenamiento.
          </SectionHeading>
        </Container>
      </section>

      {currentStep === 'input' ? (
        <section>
          <Container className="max-w-2xl">
            <div className="card rounded-3xl p-6 md:p-10">
              <form onSubmit={calculateSavings} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">
                    Precio en potencia (€/kW/mes)
                  </label>
                  <input
                    type="number"
                    name="precioKw"
                    value={formData.precioKw}
                    onChange={handleInputChange}
                    placeholder="Ej: 0.85"
                    step="0.01"
                    required
                    className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                  <p className="text-xs text-muted">
                    Encuentra este valor en tu factura bajo "Potencia contratada"
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">
                    Precio en energía (€/kWh)
                  </label>
                  <input
                    type="number"
                    name="precioKwh"
                    value={formData.precioKwh}
                    onChange={handleInputChange}
                    placeholder="Ej: 0.35"
                    step="0.001"
                    required
                    className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                  <p className="text-xs text-muted">
                    Busca "Término de energía" o "€/kWh" en tu factura
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">
                    Consumo medio mensual (kWh)
                  </label>
                  <input
                    type="number"
                    name="consumoMensual"
                    value={formData.consumoMensual}
                    onChange={handleInputChange}
                    placeholder="Ej: 450"
                    required
                    className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                  <p className="text-xs text-muted">
                    Suma los kWh de los últimos 3-6 meses y divide entre los meses
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">
                    Potencia contratada (kW)
                  </label>
                  <input
                    type="number"
                    name="potenciaContratada"
                    value={formData.potenciaContratada}
                    onChange={handleInputChange}
                    placeholder="Ej: 4.6"
                    step="0.1"
                    required
                    className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                  <p className="text-xs text-muted">
                    Aparece en la primera página de tu factura
                  </p>
                </div>

                <Button type="submit" size="lg" className="w-full">
                  Analizar factura
                </Button>

                <p className="text-center text-xs text-muted">
                  ✓ Análisis 100% confidencial y sin compromiso
                </p>
              </form>
            </div>
          </Container>
        </section>
      ) : results ? (
        <section>
          <Container className="max-w-2xl">
            <div className="space-y-6">
              {/* Coste actual */}
              <div className="card rounded-3xl p-6 md:p-8">
                <div className="space-y-2">
                  <div className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
                    Tu coste anual actual
                  </div>
                  <div className="text-4xl font-bold text-foreground">
                    €{results.costeActual.toFixed(2)}
                  </div>
                  <div className="grid gap-2 pt-4 text-sm text-muted md:grid-cols-2">
                    <div>
                      <span className="font-semibold text-foreground">Potencia:</span> €
                      {results.costePotencia.toFixed(2)}/año
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">Energía:</span> €
                      {results.costeEnergia.toFixed(2)}/año
                    </div>
                  </div>
                </div>
              </div>

              {/* Potencial de ahorro */}
              <div className="card rounded-3xl border-2 border-accent/30 bg-accent/5 p-6 md:p-8">
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">
                      Potencial de ahorro anual
                    </div>
                    <div className="flex items-baseline gap-2 pt-2">
                      <span className="text-4xl font-bold text-accent">
                        €{results.ahorros.total.toFixed(2)}
                      </span>
                      <span className="text-2xl font-semibold text-accent">
                        ({results.reduccionPorcentaje}%)
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 border-t border-accent/20 pt-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-foreground">
                        1. Reducir potencia contratada
                      </span>
                      <span className="font-semibold text-accent">
                        €{results.ahorros.potencia.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-foreground">
                        2. Solar (50% consumo cubierto)
                      </span>
                      <span className="font-semibold text-accent">
                        €{results.ahorros.solar.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-foreground">3. Mejoras de eficiencia</span>
                      <span className="font-semibold text-accent">
                        €{results.ahorros.eficiencia.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-foreground">
                        4. Almacenamiento (CAES/Batería)
                      </span>
                      <span className="font-semibold text-accent">
                        €{results.ahorros.almacenamiento.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recomendaciones */}
              <div className="card rounded-3xl p-6 md:p-8">
                <h3 className="mb-4 text-lg font-semibold text-foreground">
                  Recomendaciones personalizadas
                </h3>
                <ul className="space-y-3">
                  {results.ahorros.potencia > 0 && (
                    <li className="flex gap-3">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-semibold text-accent">
                        1
                      </span>
                      <div>
                        <p className="font-semibold text-foreground">Auditoría de potencia</p>
                        <p className="text-sm text-muted">
                          Muchos clientes pagan por más potencia de la que necesitan. Podemos
                          reducirla un 15% sin afectar tu servicio.
                        </p>
                      </div>
                    </li>
                  )}
                  {results.ahorros.solar > 0 && (
                    <li className="flex gap-3">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-semibold text-accent">
                        2
                      </span>
                      <div>
                        <p className="font-semibold text-foreground">Instalación solar</p>
                        <p className="text-sm text-muted">
                          Una instalación de {(results.consumoAnual * 0.5) / 1000 > 5 ? '5-8 kW' : '3-5 kW'} cubrirá el 50% de tu consumo.
                          ROI en 2-3 años.
                        </p>
                      </div>
                    </li>
                  )}
                  {results.ahorros.eficiencia > 0 && (
                    <li className="flex gap-3">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-semibold text-accent">
                        3
                      </span>
                      <div>
                        <p className="font-semibold text-foreground">Mejoras de eficiencia</p>
                        <p className="text-sm text-muted">
                          Iluminación LED, aislamientos, optimización de HVAC. Reduce 10% tu
                          consumo sin perder confort.
                        </p>
                      </div>
                    </li>
                  )}
                  {results.ahorros.almacenamiento > 0 && (
                    <li className="flex gap-3">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-semibold text-accent">
                        4
                      </span>
                      <div>
                        <p className="font-semibold text-foreground">
                          Almacenamiento (CAES o baterías)
                        </p>
                        <p className="text-sm text-muted">
                          Acumula energía solar y úsala cuando la red es más cara. Máxima
                          autosuficiencia y ahorro.
                        </p>
                      </div>
                    </li>
                  )}
                </ul>
              </div>

              {/* CTA */}
              <div className="card rounded-3xl border-2 border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-6 md:p-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    ¿Listo para empezar?
                  </h3>
                  <p className="text-sm text-muted">
                    Un asesor energético revisará tu caso y te presentará un plan personalizado
                    en 48h.
                  </p>
                  <div className="flex flex-col gap-2 pt-2">
                    <Button href="/contacto" size="lg" className="w-full">
                      Hablar con asesor
                    </Button>
                    <Button onClick={handleReset} variant="ghost" size="lg" className="w-full">
                      Analizar otro caso
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>
      ) : null}
    </div>
  );
}
