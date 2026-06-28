'use client';

import { useState } from 'react';
import { Button } from '@/components/button';
import { Container } from '@/components/container';
import { SectionHeading } from '@/components/section-heading';
import { guardarAnalisis } from '@/lib/supabase';

type TarifaType = '2.0' | '3.0' | '6.1';

interface FormDataTarifa20 {
  tarifa: '2.0';
  nombre: string;
  telefono: string;
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
  nombre: string;
  telefono: string;
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
  const [isSaving, setIsSaving] = useState(false);

  const handleSelectTarifa = (tarifa: TarifaType) => {
    setSelectedTarifa(tarifa);

    if (tarifa === '2.0') {
      setFormData({
        tarifa: '2.0',
        nombre: '',
        telefono: '',
        consumoP1: '', consumoP2: '', consumoP3: '',
        precioP1: '', precioP2: '', precioP3: '',
        potencia1: '', precioPotencia1: '',
        potencia2: '', precioPotencia2: '',
      } as FormDataTarifa20);
    } else {
      setFormData({
        tarifa: tarifa,
        nombre: '',
        telefono: '',
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

  const calculateSavings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    const nombre = (formData as any).nombre?.trim();
    if (!nombre) {
      alert('Por favor ingresa tu nombre');
      return;
    }

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

    const resultados = {
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
    };

    setResults(resultados);

    // Guardar en Supabase
    setIsSaving(true);
    try {
      await guardarAnalisis({
        nombre: nombre,
        telefono: (formData as any).telefono || undefined,
        tarifa: formData.tarifa,
        costeActual: resultados.costeActual,
        costePotencia: resultados.costePotencia,
        costeEnergia: resultados.costeEnergia,
        ahorroTotal: resultados.ahorros.total,
        reduccionPorcentaje: resultados.reduccionPorcentaje,
        consumoAnual: resultados.consumoAnual,
        datos: formData,
      });
    } catch (error) {
      console.error('Error al guardar:', error);
    }
    setIsSaving(false);

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
    <div className="space-y-8 pb-20 md:space-y-12">
      <section className="px-4 pt-8 md:pt-14">
        <Container>
          <div className="space-y-3 text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-accent md:text-sm">
              Herramienta gratis
            </div>
            <h1 className="text-2xl font-semibold leading-tight text-foreground md:text-4xl">
              Analiza tu factura en 5 minutos
            </h1>
            <p className="text-sm text-muted md:text-base">
              Descubre cuánto puedes ahorrar. Tarifas 2.0, 3.0 y 6.1.
            </p>
          </div>
        </Container>
      </section>

      {currentStep === 'select' ? (
        <section className="px-4 py-8 md:py-16">
          <Container className="max-w-2xl">
            <div className="card rounded-2xl p-4 md:rounded-3xl md:p-8">
              <h2 className="mb-4 text-lg font-semibold text-foreground md:mb-6 md:text-xl">
                ¿Qué tipo de tarifa tienes?
              </h2>
              <div className="space-y-3">
                <button
                  onClick={() => handleSelectTarifa('2.0')}
                  className="w-full rounded-lg border-2 border-neutral-200 p-3 text-left transition hover:border-accent hover:bg-accent/5 md:rounded-xl md:p-4"
                >
                  <div className="text-base font-semibold text-foreground md:text-lg">Tarifa 2.0</div>
                  <div className="text-xs text-muted md:text-sm">3 períodos de energía, 2 potencias</div>
                </button>
                <button
                  onClick={() => handleSelectTarifa('3.0')}
                  className="w-full rounded-lg border-2 border-neutral-200 p-3 text-left transition hover:border-accent hover:bg-accent/5 md:rounded-xl md:p-4"
                >
                  <div className="text-base font-semibold text-foreground md:text-lg">Tarifa 3.0</div>
                  <div className="text-xs text-muted md:text-sm">6 períodos de energía, 6 potencias</div>
                </button>
                <button
                  onClick={() => handleSelectTarifa('6.1')}
                  className="w-full rounded-lg border-2 border-neutral-200 p-3 text-left transition hover:border-accent hover:bg-accent/5 md:rounded-xl md:p-4"
                >
                  <div className="text-base font-semibold text-foreground md:text-lg">Tarifa 6.1</div>
                  <div className="text-xs text-muted md:text-sm">6 períodos de energía, 6 potencias</div>
                </button>
              </div>
            </div>
          </Container>
        </section>
      ) : currentStep === 'input' && formData ? (
        <section className="px-4 py-8 md:py-16">
          <Container className="max-w-2xl">
            <div className="card rounded-2xl p-4 md:rounded-3xl md:p-8">
              <form onSubmit={calculateSavings} className="space-y-6 md:space-y-8">
                {/* Sección de Datos Personales */}
                <div>
                  <h3 className="mb-3 text-base font-semibold text-foreground md:mb-4 md:text-lg">
                    Tus datos
                  </h3>
                  <div className="space-y-3 md:space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground md:mb-2 md:text-sm">
                        Nombre *
                      </label>
                      <input
                        type="text"
                        name="nombre"
                        value={(formData as any).nombre}
                        onChange={handleInputChange}
                        placeholder="Tu nombre completo"
                        required
                        className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-base placeholder-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 md:px-4 md:py-3"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground md:mb-2 md:text-sm">
                        Teléfono (opcional)
                      </label>
                      <input
                        type="tel"
                        name="telefono"
                        value={(formData as any).telefono}
                        onChange={handleInputChange}
                        placeholder="Tu número de teléfono"
                        className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-base placeholder-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 md:px-4 md:py-3"
                      />
                    </div>
                  </div>
                </div>

                {/* Sección de Energía */}
                <div>
                  <h3 className="mb-3 text-base font-semibold text-foreground md:mb-4 md:text-lg">
                    Energía (kWh y €/kWh)
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2 md:gap-4">
                    {Array.from({ length: periodos }).map((_, idx) => (
                      <div key={`energy-${idx}`} className="space-y-2">
                        <label className="block text-xs font-semibold uppercase text-rose-700">
                          P{idx + 1}
                        </label>
                        <input
                          type="number"
                          name={`consumoP${idx + 1}`}
                          value={(formData as any)[`consumoP${idx + 1}`]}
                          onChange={handleInputChange}
                          placeholder="kWh"
                          step="0.1"
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 md:py-2.5"
                        />
                        <input
                          type="number"
                          name={`precioP${idx + 1}`}
                          value={(formData as any)[`precioP${idx + 1}`]}
                          onChange={handleInputChange}
                          placeholder="€/kWh"
                          step="0.001"
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 md:py-2.5"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sección de Potencia */}
                <div>
                  <h3 className="mb-3 text-base font-semibold text-foreground md:mb-4 md:text-lg">
                    Potencia (kW y €/kW/mes)
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2 md:gap-4">
                    {Array.from({ length: potencias }).map((_, idx) => (
                      <div key={`power-${idx}`} className="space-y-2">
                        <label className="block text-xs font-semibold uppercase text-rose-700">
                          Pot {idx + 1}
                        </label>
                        <input
                          type="number"
                          name={`potencia${idx + 1}`}
                          value={(formData as any)[`potencia${idx + 1}`]}
                          onChange={handleInputChange}
                          placeholder="kW"
                          step="0.1"
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 md:py-2.5"
                        />
                        <input
                          type="number"
                          name={`precioPotencia${idx + 1}`}
                          value={(formData as any)[`precioPotencia${idx + 1}`]}
                          onChange={handleInputChange}
                          placeholder="€/mes"
                          step="0.001"
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 md:py-2.5"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Button type="submit" size="lg" className="w-full text-base">
                  Analizar
                </Button>

                <p className="text-center text-xs text-muted">
                  ✓ 100% confidencial y sin compromiso
                </p>
              </form>
            </div>
          </Container>
        </section>
      ) : results ? (
        <section className="px-4 py-8 md:py-16">
          <Container className="max-w-2xl">
            <div className="space-y-4 md:space-y-6">
              <div className="card rounded-2xl p-4 md:rounded-3xl md:p-8">
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted md:text-sm">
                    Tu coste anual actual
                  </div>
                  <div className="text-3xl font-bold text-foreground md:text-4xl">
                    €{results.costeActual.toFixed(2)}
                  </div>
                  <div className="grid gap-2 pt-3 text-xs text-muted md:grid-cols-2 md:pt-4 md:text-sm">
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

              <div className="card rounded-2xl border-2 border-accent/30 bg-accent/5 p-4 md:rounded-3xl md:p-8">
                <div className="space-y-3 md:space-y-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-accent md:text-sm">
                      Potencial de ahorro anual
                    </div>
                    <div className="flex items-baseline gap-2 pt-2 md:gap-3">
                      <span className="text-2xl font-bold text-accent md:text-4xl">
                        €{results.ahorros.total.toFixed(2)}
                      </span>
                      <span className="text-lg font-semibold text-accent md:text-2xl">
                        ({results.reduccionPorcentaje}%)
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-accent/20 pt-3 text-xs md:space-y-3 md:pt-4 md:text-sm">
                    <div className="flex justify-between">
                      <span className="text-foreground">1. Reducir potencia</span>
                      <span className="font-semibold text-accent">
                        €{results.ahorros.potencia.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground">2. Solar (50%)</span>
                      <span className="font-semibold text-accent">
                        €{results.ahorros.solar.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground">3. Eficiencia</span>
                      <span className="font-semibold text-accent">
                        €{results.ahorros.eficiencia.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground">4. Almacenamiento</span>
                      <span className="font-semibold text-accent">
                        €{results.ahorros.almacenamiento.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card rounded-2xl border-2 border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-4 md:rounded-3xl md:p-8">
                <div className="space-y-3 md:space-y-4">
                  <h3 className="text-base font-semibold text-foreground md:text-lg">
                    ¿Listo para empezar?
                  </h3>
                  <p className="text-xs text-muted md:text-sm">
                    Un asesor energético revisará tu análisis y te presentará un plan personalizado.
                  </p>
                  <div className="flex flex-col gap-2 pt-2 md:gap-3">
                    <Button href="/contacto" size="lg" className="w-full text-sm md:text-base">
                      Hablar con asesor
                    </Button>
                    <Button onClick={handleReset} variant="ghost" size="lg" className="w-full text-sm md:text-base">
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
