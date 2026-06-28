'use client';

import { useState } from 'react';
import { Button } from '@/components/button';
import { Container } from '@/components/container';
import { SectionHeading } from '@/components/section-heading';

type TarifaType = '2.0' | '3.0' | '6.1';

interface FormDataTarifa20 {
  tarifa: '2.0';
  consumoP1: string;
  consumoP2: string;
  consumoP3: string;
  precioP1: string;
  precioP2: string;
  precioP3: string;
  potencia1: string;
  precioPotencia1: string;
  potencia2: string;
  precioPotencia2: string;
}

interface FormDataTarifa30o61 {
  tarifa: '3.0' | '6.1';
  consumoP1: string;
  consumoP2: string;
  consumoP3: string;
  consumoP4: string;
  consumoP5: string;
  consumoP6: string;
  precioP1: string;
  precioP2: string;
  precioP3: string;
  precioP4: string;
  precioP5: string;
  precioP6: string;
  potencia1: string;
  precioPotencia1: string;
  potencia2: string;
  precioPotencia2: string;
  potencia3: string;
  precioPotencia3: string;
  potencia4: string;
  precioPotencia4: string;
  potencia5: string;
  precioPotencia5: string;
  potencia6: string;
  precioPotencia6: string;
}

type FormData = FormDataTarifa20 | FormDataTarifa30o61;

export default function AnalizadorPage() {
  const [currentStep, setCurrentStep] = useState<'select' | 'input' | 'results'>('select');
  const [selectedTarifa, setSelectedTarifa] = useState<TarifaType | null>(null);
  const [formData, setFormData] = useState<FormData | null>(null);
  const [results, setResults] = useState<any>(null);

  const handleSelectTarifa = (tarifa: TarifaType) => {
    setSelectedTarifa(tarifa);

    if (tarifa === '2.0') {
      setFormData({
        tarifa: '2.0',
        consumoP1: '', consumoP2: '', consumoP3: '',
        precioP1: '', precioP2: '', precioP3: '',
        potencia1: '', precioPotencia1: '',
        potencia2: '', precioPotencia2: '',
      } as FormDataTarifa20);
    } else {
      setFormData({
        tarifa: tarifa,
        consumoP1: '', consumoP2: '', consumoP3: '', consumoP4: '', consumoP5: '', consumoP6: '',
        precioP1: '', precioP2: '', precioP3: '', precioP4: '', precioP5: '', precioP6: '',
        potencia1: '', precioPotencia1: '',
        potencia2: '', precioPotencia2: '',
        potencia3: '', precioPotencia3: '',
        potencia4: '', precioPotencia4: '',
        potencia5: '', precioPotencia5: '',
        potencia6: '', precioPotencia6: '',
      } as FormDataTarifa30o61);
    }

    setCurrentStep('input');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => prev ? { ...prev, [name]: value } : null);
  };

  const calculateSavings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    let costeEnergiaAnual = 0;
    let costePotenciaAnual = 0;
    let consumoTotalAnual = 0;

    if (formData.tarifa === '2.0') {
      const data = formData as FormDataTarifa20;

      const consumos = [
        parseFloat(data.consumoP1) || 0,
        parseFloat(data.consumoP2) || 0,
        parseFloat(data.consumoP3) || 0,
      ];

      const precios = [
        parseFloat(data.precioP1) || 0,
        parseFloat(data.precioP2) || 0,
        parseFloat(data.precioP3) || 0,
      ];

      costeEnergiaAnual = consumos.reduce((sum, consumo, idx) => sum + (consumo * precios[idx] * 12), 0);
      consumoTotalAnual = consumos.reduce((sum, c) => sum + c, 0) * 12;

      const potencias = [
        parseFloat(data.potencia1) || 0,
        parseFloat(data.potencia2) || 0,
      ];

      const preciosPotencia = [
        parseFloat(data.precioPotencia1) || 0,
        parseFloat(data.precioPotencia2) || 0,
      ];

      costePotenciaAnual = potencias.reduce((sum, potencia, idx) => sum + (potencia * preciosPotencia[idx] * 12), 0);
    } else {
      const data = formData as FormDataTarifa30o61;

      const consumos = [
        parseFloat(data.consumoP1) || 0,
        parseFloat(data.consumoP2) || 0,
        parseFloat(data.consumoP3) || 0,
        parseFloat(data.consumoP4) || 0,
        parseFloat(data.consumoP5) || 0,
        parseFloat(data.consumoP6) || 0,
      ];

      const precios = [
        parseFloat(data.precioP1) || 0,
        parseFloat(data.precioP2) || 0,
        parseFloat(data.precioP3) || 0,
        parseFloat(data.precioP4) || 0,
        parseFloat(data.precioP5) || 0,
        parseFloat(data.precioP6) || 0,
      ];

      costeEnergiaAnual = consumos.reduce((sum, consumo, idx) => sum + (consumo * precios[idx] * 12), 0);
      consumoTotalAnual = consumos.reduce((sum, c) => sum + c, 0) * 12;

      const potencias = [
        parseFloat(data.potencia1) || 0,
        parseFloat(data.potencia2) || 0,
        parseFloat(data.potencia3) || 0,
        parseFloat(data.potencia4) || 0,
        parseFloat(data.potencia5) || 0,
        parseFloat(data.potencia6) || 0,
      ];

      const preciosPotencia = [
        parseFloat(data.precioPotencia1) || 0,
        parseFloat(data.precioPotencia2) || 0,
        parseFloat(data.precioPotencia3) || 0,
        parseFloat(data.precioPotencia4) || 0,
        parseFloat(data.precioPotencia5) || 0,
        parseFloat(data.precioPotencia6) || 0,
      ];

      costePotenciaAnual = potencias.reduce((sum, potencia, idx) => sum + (potencia * preciosPotencia[idx] * 12), 0);
    }

    const costeTotal = costeEnergiaAnual + costePotenciaAnual;

    const ahorroReducirPotencia = costePotenciaAnual * 0.15;
    const ahorroSolarConsumo = consumoTotalAnual * (parseFloat(formData.tarifa === '2.0' ? (formData as FormDataTarifa20).precioP1 : (formData as FormDataTarifa30o61).precioP1) || 0) * 0.50;
    const ahorroEficiencia = costeTotal * 0.10;
    const ahorroAlmacenamiento = costeEnergiaAnual * 0.15;

    const ahorroTotal = ahorroReducirPotencia + ahorroSolarConsumo + ahorroEficiencia + ahorroAlmacenamiento;

    setResults({
      costeActual: costeTotal,
      costePotencia: costePotenciaAnual,
      costeEnergia: costeEnergiaAnual,
      ahorros: {
        potencia: ahorroReducirPotencia,
        solar: ahorroSolarConsumo,
        eficiencia: ahorroEficiencia,
        almacenamiento: ahorroAlmacenamiento,
        total: ahorroTotal,
      },
      reduccionPorcentaje: costeTotal > 0 ? ((ahorroTotal / costeTotal) * 100).toFixed(1) : '0',
      consumoAnual: consumoTotalAnual,
    });

    setCurrentStep('results');
  };

  const handleReset = () => {
    setCurrentStep('select');
    setSelectedTarifa(null);
    setFormData(null);
    setResults(null);
  };

  const periodos = selectedTarifa === '2.0' ? 3 : 6;
  const potencias = selectedTarifa === '2.0' ? 2 : 6;

  return (
    <div className="space-y-12 pb-20">
      <section className="pt-14">
        <Container>
          <SectionHeading
            kicker="Herramienta gratis"
            title="Analiza tu factura de luz en 5 minutos"
          >
            Descubre cuánto puedes ahorrar. Soporta tarifas 2.0, 3.0 y 6.1 españolas.
          </SectionHeading>
        </Container>
      </section>

      {currentStep === 'select' ? (
        <section>
          <Container className="max-w-2xl">
            <div className="card rounded-3xl p-6 md:p-10">
              <h2 className="mb-6 text-xl font-semibold text-foreground">
                ¿Qué tipo de tarifa tienes?
              </h2>
              <div className="space-y-3">
                <button
                  onClick={() => handleSelectTarifa('2.0')}
                  className="w-full rounded-xl border-2 border-neutral-200 p-4 text-left transition hover:border-accent hover:bg-accent/5"
                >
                  <div className="font-semibold text-foreground">Tarifa 2.0</div>
                  <div className="text-sm text-muted">3 períodos de energía, 2 potencias</div>
                </button>
                <button
                  onClick={() => handleSelectTarifa('3.0')}
                  className="w-full rounded-xl border-2 border-neutral-200 p-4 text-left transition hover:border-accent hover:bg-accent/5"
                >
                  <div className="font-semibold text-foreground">Tarifa 3.0</div>
                  <div className="text-sm text-muted">6 períodos de energía, 6 potencias</div>
                </button>
                <button
                  onClick={() => handleSelectTarifa('6.1')}
                  className="w-full rounded-xl border-2 border-neutral-200 p-4 text-left transition hover:border-accent hover:bg-accent/5"
                >
                  <div className="font-semibold text-foreground">Tarifa 6.1</div>
                  <div className="text-sm text-muted">6 períodos de energía, 6 potencias</div>
                </button>
              </div>
            </div>
          </Container>
        </section>
      ) : currentStep === 'input' && formData ? (
        <section>
          <Container className="max-w-3xl">
            <div className="card rounded-3xl p-6 md:p-10">
              <form onSubmit={calculateSavings} className="space-y-8">
                {/* Sección de Energía */}
                <div>
                  <h3 className="mb-4 text-lg font-semibold text-foreground">
                    Energía (kWh y €/kWh)
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {Array.from({ length: periodos }).map((_, idx) => (
                      <div key={`energy-${idx}`} className="space-y-2">
                        <label className="block text-xs font-semibold uppercase text-rose-700">
                          Período {idx + 1}
                        </label>
                        <input
                          type="number"
                          name={`consumoP${idx + 1}`}
                          value={(formData as any)[`consumoP${idx + 1}`]}
                          onChange={handleInputChange}
                          placeholder="kWh"
                          step="0.1"
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                        />
                        <input
                          type="number"
                          name={`precioP${idx + 1}`}
                          value={(formData as any)[`precioP${idx + 1}`]}
                          onChange={handleInputChange}
                          placeholder="€/kWh"
                          step="0.001"
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sección de Potencia */}
                <div>
                  <h3 className="mb-4 text-lg font-semibold text-foreground">
                    Potencia (kW y €/kW/mes)
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {Array.from({ length: potencias }).map((_, idx) => (
                      <div key={`power-${idx}`} className="space-y-2">
                        <label className="block text-xs font-semibold uppercase text-rose-700">
                          Potencia {idx + 1}
                        </label>
                        <input
                          type="number"
                          name={`potencia${idx + 1}`}
                          value={(formData as any)[`potencia${idx + 1}`]}
                          onChange={handleInputChange}
                          placeholder="kW"
                          step="0.1"
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                        />
                        <input
                          type="number"
                          name={`precioPotencia${idx + 1}`}
                          value={(formData as any)[`precioPotencia${idx + 1}`]}
                          onChange={handleInputChange}
                          placeholder="€/kW/mes"
                          step="0.001"
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                        />
                      </div>
                    ))}
                  </div>
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
                      <span className="text-sm text-foreground">1. Reducir potencia</span>
                      <span className="font-semibold text-accent">
                        €{results.ahorros.potencia.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-foreground">2. Solar (50% consumo)</span>
                      <span className="font-semibold text-accent">
                        €{results.ahorros.solar.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-foreground">3. Eficiencia</span>
                      <span className="font-semibold text-accent">
                        €{results.ahorros.eficiencia.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-foreground">4. Almacenamiento</span>
                      <span className="font-semibold text-accent">
                        €{results.ahorros.almacenamiento.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card rounded-3xl border-2 border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-6 md:p-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    ¿Listo para empezar?
                  </h3>
                  <p className="text-sm text-muted">
                    Un asesor energético revisará tu análisis y te presentará un plan personalizado.
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
