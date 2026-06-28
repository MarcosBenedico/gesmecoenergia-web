'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/button';
import { Container } from '@/components/container';
import { obtenerPreciosComercializadoras } from '@/lib/auth';

type TarifaType = '2.0' | '3.0' | '6.1';

type FormData = {
  nombre: string;
  telefono: string;
  tarifa: TarifaType;
  consumos: number[];
  precios: number[];
  potencias: number[];
  preciosPotencia: number[];
};

interface Comercializadora {
  id: number;
  nombre: string;
  precios: {
    energia: number[];
    potencia: number[];
  };
}

interface ResultadoComparativa {
  comercializadora: string;
  costeAnual: number;
  ahorroAnual: number;
  ahorroProducto: string;
}

export default function AnalizadorPage() {
  const [step, setStep] = useState<'select' | 'input' | 'opciones' | 'results'>('select');
  const [selectedTarifa, setSelectedTarifa] = useState<TarifaType | null>(null);
  const [formData, setFormData] = useState<FormData | null>(null);
  const [comercializadoras, setComercializadoras] = useState<Comercializadora[]>([]);
  const [comparativas, setComparativas] = useState<ResultadoComparativa[]>([]);
  const [seleccionadas, setSeleccionadas] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const periodos = selectedTarifa === '2.0' ? 3 : 6;
  const potencias = selectedTarifa === '2.0' ? 2 : 6;

  useEffect(() => {
    cargarComercializadoras();
  }, []);

  const cargarComercializadoras = async () => {
    try {
      const precios = await obtenerPreciosComercializadoras();
      const agrupadas: Record<number, Comercializadora> = {};

      precios.forEach((p: any) => {
        if (!agrupadas[p.comercializadora_id]) {
          agrupadas[p.comercializadora_id] = {
            id: p.comercializadora_id,
            nombre: p.comercializadoras?.nombre || `Comercializadora ${p.comercializadora_id}`,
            precios: { energia: [], potencia: [] },
          };
        }
      });

      setComercializadoras(Object.values(agrupadas));
    } catch (error) {
      console.error('Error cargando comercializadoras:', error);
    }
  };

  const handleSelectTarifa = (tarifa: TarifaType) => {
    setSelectedTarifa(tarifa);
    setFormData({
      nombre: '',
      telefono: '',
      tarifa,
      consumos: Array(tarifa === '2.0' ? 3 : 6).fill(0),
      precios: Array(tarifa === '2.0' ? 3 : 6).fill(0),
      potencias: Array(tarifa === '2.0' ? 2 : 6).fill(0),
      preciosPotencia: Array(tarifa === '2.0' ? 2 : 6).fill(0),
    });
    setStep('input');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (!formData) return;

    if (name === 'nombre' || name === 'telefono') {
      setFormData({ ...formData, [name]: value });
    } else if (name.startsWith('consumo')) {
      const idx = parseInt(name.replace('consumo', '')) - 1;
      const newConsumos = [...formData.consumos];
      newConsumos[idx] = parseFloat(value) || 0;
      setFormData({ ...formData, consumos: newConsumos });
    } else if (name.startsWith('precio') && !name.startsWith('precioPot')) {
      const idx = parseInt(name.replace('precio', '')) - 1;
      const newPrecios = [...formData.precios];
      newPrecios[idx] = parseFloat(value) || 0;
      setFormData({ ...formData, precios: newPrecios });
    } else if (name.startsWith('potencia') && !name.startsWith('precioPot')) {
      const idx = parseInt(name.replace('potencia', '')) - 1;
      const newPotencias = [...formData.potencias];
      newPotencias[idx] = parseFloat(value) || 0;
      setFormData({ ...formData, potencias: newPotencias });
    } else if (name.startsWith('precioPotencia')) {
      const idx = parseInt(name.replace('precioPotencia', '')) - 1;
      const newPreciosPot = [...formData.preciosPotencia];
      newPreciosPot[idx] = parseFloat(value) || 0;
      setFormData({ ...formData, preciosPotencia: newPreciosPot });
    }
  };

  const calcularComparativas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData || !formData.nombre) {
      alert('Por favor ingresa tu nombre');
      return;
    }

    setLoading(true);

    // Calcular coste actual del cliente
    const costeEnergia = formData.consumos.reduce((sum, consumo, idx) => sum + (consumo * formData.precios[idx] * 12), 0);
    const costePotencia = formData.potencias.reduce((sum, pot, idx) => sum + (pot * formData.preciosPotencia[idx] * 12), 0);
    const costeActual = costeEnergia + costePotencia;

    // Calcular comparativas (simuladas con precios al azar por ahora)
    const nuevasComparativas: ResultadoComparativa[] = comercializadoras.slice(0, 3).map((com) => {
      const precioEnergia = (Math.random() * 0.2 + 0.2).toFixed(4); // 0.2-0.4 €/kWh
      const precioPotencia = (Math.random() * 0.5 + 0.4).toFixed(4); // 0.4-0.9 €/kW/mes

      const costeComercializadora =
        formData.consumos.reduce((sum, consumo) => sum + consumo * parseFloat(precioEnergia) * 12, 0) +
        formData.potencias.reduce((sum, pot) => sum + pot * parseFloat(precioPotencia) * 12, 0);

      const ahorroAnual = costeActual - costeComercializadora;
      const ahorroProducto = ahorroAnual > 0 ? ahorroAnual.toFixed(2) : '0.00';

      return {
        comercializadora: com.nombre,
        costeAnual: costeComercializadora,
        ahorroAnual: parseFloat(ahorroProducto),
        ahorroProducto,
      };
    });

    setComparativas(nuevasComparativas.sort((a, b) => b.ahorroAnual - a.ahorroAnual));
    setStep('opciones');
    setLoading(false);
  };

  const handleSeleccionarOpciones = () => {
    if (seleccionadas.length === 0) {
      alert('Selecciona al menos una opción');
      return;
    }
    setStep('results');
  };

  const handleToggleOpcion = (idx: number) => {
    if (seleccionadas.includes(idx)) {
      setSeleccionadas(seleccionadas.filter((i) => i !== idx));
    } else if (seleccionadas.length < 3) {
      setSeleccionadas([...seleccionadas, idx]);
    }
  };

  const handleReset = () => {
    setStep('select');
    setSelectedTarifa(null);
    setFormData(null);
    setComparativas([]);
    setSeleccionadas([]);
  };

  return (
    <div className="space-y-8 pb-20 md:space-y-12">
      <section className="px-4 pt-8 md:pt-14">
        <Container>
          <div className="space-y-3 text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-accent md:text-sm">
              Herramienta gratis
            </div>
            <h1 className="text-2xl font-semibold leading-tight text-foreground md:text-4xl">
              Descubre cuánto puedes ahorrar
            </h1>
            <p className="text-sm text-muted md:text-base">
              Compara tus precios con nuestras mejores opciones. Tarifas 2.0, 3.0 y 6.1.
            </p>
          </div>
        </Container>
      </section>

      {step === 'select' && (
        <section className="px-4 md:py-8">
          <Container className="max-w-2xl">
            <div className="card rounded-2xl p-4 md:rounded-3xl md:p-8">
              <h2 className="mb-4 text-lg font-semibold text-foreground md:mb-6 md:text-xl">
                ¿Qué tipo de tarifa tienes?
              </h2>
              <div className="space-y-3">
                {['2.0', '3.0', '6.1'].map((tarifa) => (
                  <button
                    key={tarifa}
                    onClick={() => handleSelectTarifa(tarifa as TarifaType)}
                    className="w-full rounded-lg border-2 border-neutral-200 p-3 text-left transition hover:border-accent hover:bg-accent/5 md:rounded-xl md:p-4"
                  >
                    <div className="text-base font-semibold text-foreground md:text-lg">
                      Tarifa {tarifa}
                    </div>
                    <div className="text-xs text-muted md:text-sm">
                      {tarifa === '2.0' ? '3 períodos, 2 potencias' : '6 períodos, 6 potencias'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </Container>
        </section>
      )}

      {step === 'input' && formData && (
        <section className="px-4 md:py-8">
          <Container className="max-w-2xl">
            <div className="card rounded-2xl p-4 md:rounded-3xl md:p-8">
              <form onSubmit={calcularComparativas} className="space-y-6 md:space-y-8">
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
                        value={formData.nombre}
                        onChange={handleInputChange}
                        placeholder="Tu nombre"
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
                        value={formData.telefono}
                        onChange={handleInputChange}
                        placeholder="Tu teléfono"
                        className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-base placeholder-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 md:px-4 md:py-3"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-base font-semibold text-foreground md:mb-4 md:text-lg">
                    Energía (kWh y €/kWh)
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2 md:gap-4">
                    {Array.from({ length: periodos }).map((_, idx) => (
                      <div key={`energy-${idx}`} className="space-y-2">
                        <label className="block text-xs font-semibold uppercase text-accent">
                          P{idx + 1}
                        </label>
                        <input
                          type="number"
                          name={`consumo${idx + 1}`}
                          value={formData.consumos[idx]}
                          onChange={handleInputChange}
                          placeholder="kWh"
                          step="0.1"
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 md:py-2.5"
                        />
                        <input
                          type="number"
                          name={`precio${idx + 1}`}
                          value={formData.precios[idx]}
                          onChange={handleInputChange}
                          placeholder="€/kWh"
                          step="0.001"
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 md:py-2.5"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-base font-semibold text-foreground md:mb-4 md:text-lg">
                    Potencia (kW y €/kW/mes)
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2 md:gap-4">
                    {Array.from({ length: potencias }).map((_, idx) => (
                      <div key={`power-${idx}`} className="space-y-2">
                        <label className="block text-xs font-semibold uppercase text-accent">
                          Pot{idx + 1}
                        </label>
                        <input
                          type="number"
                          name={`potencia${idx + 1}`}
                          value={formData.potencias[idx]}
                          onChange={handleInputChange}
                          placeholder="kW"
                          step="0.1"
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 md:py-2.5"
                        />
                        <input
                          type="number"
                          name={`precioPotencia${idx + 1}`}
                          value={formData.preciosPotencia[idx]}
                          onChange={handleInputChange}
                          placeholder="€/mes"
                          step="0.001"
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 md:py-2.5"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Button type="submit" size="lg" className="w-full text-base" disabled={loading}>
                  {loading ? 'Calculando...' : 'Ver comparativas'}
                </Button>
              </form>
            </div>
          </Container>
        </section>
      )}

      {step === 'opciones' && (
        <section className="px-4 md:py-8">
          <Container className="max-w-2xl">
            <div className="card rounded-2xl p-4 md:rounded-3xl md:p-8">
              <h2 className="mb-4 text-lg font-semibold text-foreground md:mb-6 md:text-xl">
                Elige hasta 3 opciones para comparar
              </h2>
              <div className="space-y-3">
                {comparativas.map((comp, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleToggleOpcion(idx)}
                    className={`rounded-lg border-2 p-4 text-left transition ${
                      seleccionadas.includes(idx)
                        ? 'border-accent bg-accent/10'
                        : 'border-neutral-200 hover:border-accent/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-foreground">
                          Opción {idx + 1} - Ahorro €{comp.ahorroProducto}/año
                        </div>
                        <div className="text-sm text-muted">
                          Coste: €{comp.costeAnual.toFixed(2)}/año
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={seleccionadas.includes(idx)}
                        onChange={() => {}}
                        className="h-5 w-5 cursor-pointer accent-accent"
                      />
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex flex-col gap-2">
                <Button onClick={handleSeleccionarOpciones} size="lg" className="w-full">
                  Ver comparativa completa
                </Button>
                <Button onClick={handleReset} variant="ghost" size="lg" className="w-full">
                  Volver atrás
                </Button>
              </div>
            </div>
          </Container>
        </section>
      )}

      {step === 'results' && (
        <section className="px-4 md:py-8">
          <Container className="max-w-3xl">
            <div className="space-y-4 md:space-y-6">
              {seleccionadas.map((idx) => {
                const comp = comparativas[idx];
                return (
                  <div key={idx} className="card rounded-2xl border-2 border-accent/30 bg-accent/5 p-4 md:rounded-3xl md:p-8">
                    <div className="space-y-3 md:space-y-4">
                      <div>
                        <div className="text-sm font-semibold uppercase tracking-[0.16em] text-accent md:text-base">
                          Opción {idx + 1}
                        </div>
                        <div className="mt-2 flex items-baseline gap-3">
                          <div className="text-3xl font-bold text-accent md:text-4xl">
                            €{comp.ahorroProducto}
                          </div>
                          <div className="text-sm text-muted">de ahorro anual</div>
                        </div>
                      </div>
                      <div className="border-t border-accent/20 pt-3 text-sm text-foreground md:pt-4">
                        <div>
                          <span className="font-semibold">Tu coste actual:</span> €
                          {(formData
                            ? formData.consumos.reduce((sum, c, i) => sum + c * formData.precios[i] * 12, 0) +
                              formData.potencias.reduce((sum, p, i) => sum + p * formData.preciosPotencia[i] * 12, 0)
                            : 0
                          ).toFixed(2)}
                          /año
                        </div>
                        <div>
                          <span className="font-semibold">Coste con {comp.comercializadora}:</span> €
                          {comp.costeAnual.toFixed(2)}/año
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="card rounded-2xl border-2 border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-4 md:rounded-3xl md:p-8">
                <div className="space-y-3 md:space-y-4">
                  <h3 className="text-base font-semibold text-foreground md:text-lg">
                    ¿Quieres más información?
                  </h3>
                  <p className="text-xs text-muted md:text-sm">
                    Un asesor energético se pondrá en contacto contigo para explicar todas las opciones y
                    el proceso de cambio.
                  </p>
                  <div className="flex flex-col gap-2 pt-2 md:gap-3">
                    <Button href="/contacto" size="lg" className="w-full text-sm md:text-base">
                      Contactar asesor
                    </Button>
                    <Button onClick={handleReset} variant="ghost" size="lg" className="w-full text-sm md:text-base">
                      Hacer otro análisis
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>
      )}
    </div>
  );
}
