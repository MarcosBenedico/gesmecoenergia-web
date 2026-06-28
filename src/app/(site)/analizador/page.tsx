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

interface PrecioRegistro {
  comercializadora_id: number;
  nombre: string;
  tarifa: string;
  periodo: number;
  potencia: number;
  precio_energia: number;
  precio_potencia: number;
}

interface DetalleCalculo {
  comercializadora: string;
  costesEnergiaDetalle: { periodo: number; consumo: number; precio: number; total: number }[];
  costoEnergiaTotal: number;
  costesPotenciaDetalle: { potencia: number; cantidad: number; precio: number; total: number }[];
  costoPotenciaTotal: number;
  costeTotal: number;
}

export default function AnalizadorPage() {
  const [step, setStep] = useState<'select' | 'input' | 'results'>('select');
  const [selectedTarifa, setSelectedTarifa] = useState<TarifaType | null>(null);
  const [formData, setFormData] = useState<FormData | null>(null);
  const [preciosDb, setPreciosDb] = useState<PrecioRegistro[]>([]);
  const [detalles, setDetalles] = useState<DetalleCalculo[]>([]);
  const [loading, setLoading] = useState(false);

  const periodos = selectedTarifa === '2.0' ? 3 : 6;
  const potencias = selectedTarifa === '2.0' ? 2 : 6;

  useEffect(() => {
    cargarPreciosDb();
  }, []);

  const cargarPreciosDb = async () => {
    try {
      const precios = await obtenerPreciosComercializadoras();
      setPreciosDb(precios as PrecioRegistro[]);
    } catch (error) {
      console.error('Error cargando precios:', error);
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

  const calcularDetalles = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData || !formData.nombre) {
      alert('Por favor ingresa tu nombre');
      return;
    }

    setLoading(true);

    try {
      // Calcular coste del usuario (su tarifa actual)
      const costesUserEnergiaDetalle = formData.consumos.map((consumo, idx) => ({
        periodo: idx + 1,
        consumo,
        precio: formData.precios[idx],
        total: consumo * formData.precios[idx] * 12,
      }));

      const costoUserEnergia = costesUserEnergiaDetalle.reduce((sum, d) => sum + d.total, 0);

      const costesUserPotenciaDetalle = formData.potencias.map((potencia, idx) => ({
        potencia: idx + 1,
        cantidad: potencia,
        precio: formData.preciosPotencia[idx],
        total: potencia * formData.preciosPotencia[idx] * 12,
      }));

      const costoUserPotencia = costesUserPotenciaDetalle.reduce((sum, d) => sum + d.total, 0);

      const detalleUsuario: DetalleCalculo = {
        comercializadora: 'Tu tarifa actual',
        costesEnergiaDetalle: costesUserEnergiaDetalle,
        costoEnergiaTotal: costoUserEnergia,
        costesPotenciaDetalle: costesUserPotenciaDetalle,
        costoPotenciaTotal: costoUserPotencia,
        costeTotal: costoUserEnergia + costoUserPotencia,
      };

      // Calcular costes de comercializadoras (primero de cada una)
      const comerciosUnicos = new Map<number, { nombre: string; id: number }>();
      preciosDb.forEach((p) => {
        if (p.tarifa === formData.tarifa && !comerciosUnicos.has(p.comercializadora_id)) {
          comerciosUnicos.set(p.comercializadora_id, {
            id: p.comercializadora_id,
            nombre: p.nombre,
          });
        }
      });

      const detallesComercios: DetalleCalculo[] = Array.from(comerciosUnicos.values()).map(
        (comercio) => {
          const preciosComercio = preciosDb.filter(
            (p) =>
              p.comercializadora_id === comercio.id &&
              p.tarifa === formData.tarifa
          );

          // Cálculo de energía período por período
          const costesEnergiaDetalle = formData.consumos.map((consumo, idx) => {
            const precioRecord = preciosComercio.find((p) => p.periodo === idx + 1);
            const precio = precioRecord?.precio_energia || 0;
            return {
              periodo: idx + 1,
              consumo,
              precio,
              total: consumo * precio * 12,
            };
          });

          const costoEnergia = costesEnergiaDetalle.reduce((sum, d) => sum + d.total, 0);

          // Cálculo de potencia potencia por potencia
          const costesPotenciaDetalle = formData.potencias.map((potencia, idx) => {
            const precioRecord = preciosComercio.find((p) => p.potencia === idx + 1);
            const precio = precioRecord?.precio_potencia || 0;
            return {
              potencia: idx + 1,
              cantidad: potencia,
              precio,
              total: potencia * precio * 12,
            };
          });

          const costoPotencia = costesPotenciaDetalle.reduce((sum, d) => sum + d.total, 0);

          return {
            comercializadora: comercio.nombre,
            costesEnergiaDetalle,
            costoEnergiaTotal: costoEnergia,
            costesPotenciaDetalle,
            costoPotenciaTotal: costoPotencia,
            costeTotal: costoEnergia + costoPotencia,
          };
        }
      );

      setDetalles([detalleUsuario, ...detallesComercios]);
      setStep('results');
    } catch (error) {
      console.error('Error al calcular:', error);
      alert('Error al calcular. Verifica los datos e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('select');
    setSelectedTarifa(null);
    setFormData(null);
    setDetalles([]);
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
              Análisis detallado de tu coste actual vs opciones disponibles
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
              <form onSubmit={calcularDetalles} className="space-y-6 md:space-y-8">
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
                  {loading ? 'Calculando...' : 'Ver análisis detallado'}
                </Button>
              </form>
            </div>
          </Container>
        </section>
      )}

      {step === 'results' && detalles.length > 0 && (
        <section className="px-4 md:py-8">
          <Container className="max-w-4xl">
            <div className="space-y-8">
              {detalles.map((detalle, idx) => (
                <div
                  key={idx}
                  className={`card rounded-2xl p-4 md:rounded-3xl md:p-8 ${
                    idx === 0 ? 'border-2 border-neutral-300 bg-neutral-50' : 'border-2 border-accent/30 bg-accent/5'
                  }`}
                >
                  <h2 className="mb-6 text-xl font-bold text-foreground md:text-2xl">
                    {detalle.comercializadora}
                  </h2>

                  {/* Desglose de Energía */}
                  <div className="mb-8">
                    <h3 className="mb-4 text-lg font-semibold text-foreground">Coste de Energía (anual)</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-neutral-200">
                            <th className="px-3 py-2 text-left font-semibold">Período</th>
                            <th className="px-3 py-2 text-right font-semibold">Consumo (kWh)</th>
                            <th className="px-3 py-2 text-right font-semibold">Precio (€/kWh)</th>
                            <th className="px-3 py-2 text-right font-semibold">Total anual</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalle.costesEnergiaDetalle.map((d) => (
                            <tr key={d.periodo} className="border-b border-neutral-100">
                              <td className="px-3 py-2">P{d.periodo}</td>
                              <td className="px-3 py-2 text-right">{(d.consumo * 12).toFixed(2)}</td>
                              <td className="px-3 py-2 text-right">{d.precio.toFixed(4)}</td>
                              <td className="px-3 py-2 text-right font-semibold text-accent">
                                €{d.total.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-neutral-100 font-semibold">
                            <td colSpan={3} className="px-3 py-2 text-right">
                              Total Energía:
                            </td>
                            <td className="px-3 py-2 text-right text-accent">
                              €{detalle.costoEnergiaTotal.toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Desglose de Potencia */}
                  <div className="mb-8">
                    <h3 className="mb-4 text-lg font-semibold text-foreground">Coste de Potencia (anual)</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-neutral-200">
                            <th className="px-3 py-2 text-left font-semibold">Potencia</th>
                            <th className="px-3 py-2 text-right font-semibold">kW</th>
                            <th className="px-3 py-2 text-right font-semibold">Precio (€/kW/mes)</th>
                            <th className="px-3 py-2 text-right font-semibold">Total anual</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalle.costesPotenciaDetalle.map((d) => (
                            <tr key={d.potencia} className="border-b border-neutral-100">
                              <td className="px-3 py-2">Pot{d.potencia}</td>
                              <td className="px-3 py-2 text-right">{d.cantidad.toFixed(2)}</td>
                              <td className="px-3 py-2 text-right">{d.precio.toFixed(4)}</td>
                              <td className="px-3 py-2 text-right font-semibold text-accent">
                                €{d.total.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-neutral-100 font-semibold">
                            <td colSpan={3} className="px-3 py-2 text-right">
                              Total Potencia:
                            </td>
                            <td className="px-3 py-2 text-right text-accent">
                              €{detalle.costoPotenciaTotal.toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Resumen */}
                  <div className={`rounded-lg p-6 ${idx === 0 ? 'bg-white border border-neutral-200' : 'bg-accent/10'}`}>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm text-muted">Coste de Energía (anual)</p>
                        <p className="text-2xl font-bold text-foreground">€{detalle.costoEnergiaTotal.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted">Coste de Potencia (anual)</p>
                        <p className="text-2xl font-bold text-foreground">€{detalle.costoPotenciaTotal.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="mt-4 border-t border-neutral-200 pt-4">
                      <p className="text-sm font-semibold text-muted">Coste Total Anual</p>
                      <p className="text-4xl font-bold text-accent">€{detalle.costeTotal.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Ahorro (solo para comercializadoras, no para usuario) */}
                  {idx > 0 && (
                    <div className="mt-6 border-t border-accent/20 pt-6">
                      <p className="text-center text-sm font-semibold text-muted">Ahorro anual vs tu tarifa actual</p>
                      <p className="text-center text-3xl font-bold text-accent">
                        €{(detalles[0].costeTotal - detalle.costeTotal).toFixed(2)}
                      </p>
                      <p className="text-center text-sm text-muted">
                        Reducción: {(((detalles[0].costeTotal - detalle.costeTotal) / detalles[0].costeTotal) * 100).toFixed(1)}%
                      </p>
                    </div>
                  )}
                </div>
              ))}

              <div className="flex flex-col gap-3 md:gap-4">
                <Button href="/contacto" size="lg" className="w-full">
                  Quiero cambiar de tarifa
                </Button>
                <Button onClick={handleReset} variant="ghost" size="lg" className="w-full">
                  Hacer otro análisis
                </Button>
              </div>
            </div>
          </Container>
        </section>
      )}
    </div>
  );
}
