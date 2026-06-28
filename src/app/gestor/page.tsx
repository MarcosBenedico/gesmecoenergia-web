'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { obtenerUsuarioActual, logoutUsuario, obtenerPreciosComercializadoras } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/button';
import { Container } from '@/components/container';

type Seccion = 'view' | 'create' | 'margenes';

interface Precio {
  id: number;
  comercializadora_id: number;
  comercializadoras?: { nombre: string; codigo: string };
  tarifa: string;
  precios_energia: number[];
  precios_potencia: number[];
}

interface FormCrearTarifa {
  tarifa: '2.0' | '3.0' | '6.1';
  comercializadora_id: number;
  precios: { energia: number[]; potencia: number[] };
}

export default function GestorPage() {
  const router = useRouter();
  const [usuarioActual, setUsuarioActual] = useState<string | null>(null);
  const [seccion, setSeccion] = useState<Seccion>('view');
  const [precios, setPrecios] = useState<Precio[]>([]);
  const [comercializadoras, setComercializadoras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTarifa, setFiltroTarifa] = useState('2.0');
  const [editando, setEditando] = useState<number | null>(null);

  // Form crear tarifa
  const [formCrear, setFormCrear] = useState<FormCrearTarifa>({
    tarifa: '2.0',
    comercializadora_id: 1,
    precios: { energia: [0, 0, 0], potencia: [0, 0] },
  });

  // Simulador de márgenes
  const [tarifaMargen, setTarifaMargen] = useState('2.0');
  const [comercioMargen, setComerioMargen] = useState(1);
  const [tipoMargen, setTipoMargen] = useState<'porcentaje' | 'fijo'>('porcentaje');
  const [margenValor, setMargenValor] = useState(5);
  const [consumoEjemplo, setConsumoEjemplo] = useState(1000);
  const [potenciaEjemplo, setPotenciaEjemplo] = useState(2);

  useEffect(() => {
    const usuario = obtenerUsuarioActual();
    if (!usuario) {
      router.push('/gestor/login');
      return;
    }

    setUsuarioActual('UsuarioMaster');
    cargarDatos();
  }, [router]);

  const cargarDatos = async () => {
    try {
      const precios = await obtenerPreciosComercializadoras();
      setPrecios(precios);

      const { data: comercios } = await supabase.from('comercializadoras').select('*').order('id');
      setComercializadoras(comercios || []);

      if (comercios && comercios.length > 0) {
        setFormCrear((prev) => ({
          ...prev,
          comercializadora_id: comercios[0].id,
        }));
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const preciosFiltrados = precios.filter((p) => p.tarifa === filtroTarifa);

  const handleLogout = () => {
    logoutUsuario();
    router.push('/gestor/login');
  };

  const handleCrearTarifa = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (!formCrear.comercializadora_id) {
        alert('Por favor selecciona una comercializadora');
        return;
      }

      // Insertar una única fila con arrays de precios
      const { error } = await supabase.from('precios_comercializadoras').insert({
        comercializadora_id: formCrear.comercializadora_id,
        tarifa: formCrear.tarifa,
        precios_energia: formCrear.precios.energia,
        precios_potencia: formCrear.precios.potencia,
      });

      if (error) throw error;

      // Recargar datos
      await cargarDatos();
      setSeccion('view');

      // Resetear form
      setFormCrear({
        tarifa: '2.0',
        comercializadora_id: comercializadoras[0]?.id || 1,
        precios: { energia: [0, 0, 0], potencia: [0, 0] },
      });

      alert('Tarifa creada exitosamente');
    } catch (error) {
      console.error('Error al crear tarifa:', error);
      alert('Error al crear tarifa: ' + (error as any).message);
    }
  };

  const handleGuardar = async (id: number, precios_energia: number[], precios_potencia: number[]) => {
    try {
      const { error } = await supabase
        .from('precios_comercializadoras')
        .update({ precios_energia, precios_potencia, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      await cargarDatos();
      setEditando(null);
      alert('Tarifa actualizada exitosamente');
    } catch (error) {
      console.error('Error al guardar precio:', error);
      alert('Error al guardar: ' + (error as any).message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Cargando...</p>
      </div>
    );
  }

  const periodosForm = formCrear.tarifa === '2.0' ? 3 : 6;
  const potenciasForm = formCrear.tarifa === '2.0' ? 2 : 6;

  return (
    <div className="min-h-screen bg-neutral-50 py-20">
      <Container>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Panel de Gestión</h1>
              <p className="text-sm text-muted">{usuarioActual}</p>
            </div>
            <Button variant="ghost" onClick={handleLogout} size="md">
              Cerrar sesión
            </Button>
          </div>

          {/* Botones de sección */}
          <div className="card rounded-2xl p-6 flex gap-3 flex-wrap">
            <button
              onClick={() => setSeccion('view')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                seccion === 'view'
                  ? 'bg-accent text-white'
                  : 'bg-neutral-200 text-foreground hover:bg-neutral-300'
              }`}
            >
              Ver Tarifas
            </button>
            <button
              onClick={() => setSeccion('create')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                seccion === 'create'
                  ? 'bg-accent text-white'
                  : 'bg-neutral-200 text-foreground hover:bg-neutral-300'
              }`}
            >
              Crear Tarifa
            </button>
            <button
              onClick={() => setSeccion('margenes')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                seccion === 'margenes'
                  ? 'bg-accent text-white'
                  : 'bg-neutral-200 text-foreground hover:bg-neutral-300'
              }`}
            >
              Simulador de Márgenes
            </button>
          </div>

          {/* Sección: Ver Tarifas */}
          {seccion === 'view' && (
            <>
              {/* Filtros */}
              <div className="card rounded-2xl p-6">
                <h2 className="mb-4 font-semibold text-foreground">Filtrar por tarifa</h2>
                <div className="flex gap-2">
                  {['2.0', '3.0', '6.1'].map((tarifa) => (
                    <button
                      key={tarifa}
                      onClick={() => setFiltroTarifa(tarifa)}
                      className={`rounded-lg px-4 py-2 font-semibold transition ${
                        filtroTarifa === tarifa
                          ? 'bg-accent text-white'
                          : 'bg-neutral-200 text-foreground hover:bg-neutral-300'
                      }`}
                    >
                      {tarifa}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cards de tarifas */}
              <div className="space-y-4">
                {preciosFiltrados.map((precio) => (
                  <div key={precio.id} className="card rounded-2xl p-6 border-2 border-neutral-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">
                          {precio.comercializadoras?.nombre} - Tarifa {precio.tarifa}
                        </h3>
                        <p className="text-xs text-muted">ID: {precio.id}</p>
                      </div>
                      <button
                        onClick={() => setEditando(editando === precio.id ? null : precio.id)}
                        className="px-4 py-2 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent/90 transition"
                      >
                        {editando === precio.id ? 'Cancelar' : 'Editar'}
                      </button>
                    </div>

                    {editando === precio.id ? (
                      <EditTarifaForm
                        precio={precio}
                        onSave={(energias, potencias) =>
                          handleGuardar(precio.id, energias, potencias)
                        }
                      />
                    ) : (
                      <ViewTarifaDisplay precio={precio} />
                    )}
                  </div>
                ))}
              </div>

              {preciosFiltrados.length === 0 && (
                <div className="card rounded-2xl p-8 text-center">
                  <p className="text-muted">No hay tarifas creadas para esta categoría</p>
                </div>
              )}
            </>
          )}

          {/* Sección: Crear Tarifa */}
          {seccion === 'create' && (
            <div className="card rounded-2xl p-8">
              <h2 className="mb-6 text-xl font-semibold text-foreground">Crear Nueva Tarifa</h2>

              <form onSubmit={handleCrearTarifa} className="space-y-8">
                {/* Tipo de tarifa y comercializadora */}
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Tipo de Tarifa
                    </label>
                    <select
                      value={formCrear.tarifa}
                      onChange={(e) => {
                        const tarifa = e.target.value as '2.0' | '3.0' | '6.1';
                        const newEnergiaCount = tarifa === '2.0' ? 3 : 6;
                        const newPotenciaCount = tarifa === '2.0' ? 2 : 6;

                        setFormCrear({
                          ...formCrear,
                          tarifa,
                          precios: {
                            energia: Array(newEnergiaCount).fill(0),
                            potencia: Array(newPotenciaCount).fill(0),
                          },
                        });
                      }}
                      className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                    >
                      <option value="2.0">Tarifa 2.0 (3 períodos, 2 potencias)</option>
                      <option value="3.0">Tarifa 3.0 (6 períodos, 6 potencias)</option>
                      <option value="6.1">Tarifa 6.1 (6 períodos, 6 potencias)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Comercializadora
                    </label>
                    <select
                      value={formCrear.comercializadora_id}
                      onChange={(e) =>
                        setFormCrear({ ...formCrear, comercializadora_id: parseInt(e.target.value) })
                      }
                      className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                    >
                      <option value="">-- Selecciona una comercializadora --</option>
                      {comercializadoras && comercializadoras.length > 0 ? (
                        comercializadoras.map((com) => (
                          <option key={com.id} value={com.id}>
                            {com.nombre}
                          </option>
                        ))
                      ) : (
                        <option disabled>No hay comercializadoras disponibles</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Precios de energía */}
                <div>
                  <h3 className="mb-4 font-semibold text-foreground">Precios de Energía (€/kWh)</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    {Array.from({ length: periodosForm }).map((_, idx) => (
                      <div key={`energia-${idx}`}>
                        <label className="block text-xs font-semibold text-accent mb-2 uppercase">
                          Período {idx + 1}
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          value={formCrear.precios.energia[idx]}
                          onChange={(e) => {
                            const newEnergias = [...formCrear.precios.energia];
                            newEnergias[idx] = parseFloat(e.target.value) || 0;
                            setFormCrear({
                              ...formCrear,
                              precios: { ...formCrear.precios, energia: newEnergias },
                            });
                          }}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Precios de potencia */}
                <div>
                  <h3 className="mb-4 font-semibold text-foreground">Precios de Potencia (€/kW/día)</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    {Array.from({ length: potenciasForm }).map((_, idx) => (
                      <div key={`potencia-${idx}`}>
                        <label className="block text-xs font-semibold text-accent mb-2 uppercase">
                          Potencia {idx + 1}
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          value={formCrear.precios.potencia[idx]}
                          onChange={(e) => {
                            const newPotencias = [...formCrear.precios.potencia];
                            newPotencias[idx] = parseFloat(e.target.value) || 0;
                            setFormCrear({
                              ...formCrear,
                              precios: { ...formCrear.precios, potencia: newPotencias },
                            });
                          }}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Button type="submit" size="lg" className="w-full">
                  Crear Tarifa
                </Button>
              </form>
            </div>
          )}

          {/* Sección: Simulador de Márgenes */}
          {seccion === 'margenes' && (
            <SimuladorMargenes
              precios={precios}
              comercializadoras={comercializadoras}
              tarifaMargen={tarifaMargen}
              setTarifaMargen={setTarifaMargen}
              comercioMargen={comercioMargen}
              setComerioMargen={setComerioMargen}
              tipoMargen={tipoMargen}
              setTipoMargen={setTipoMargen}
              margenValor={margenValor}
              setMargenValor={setMargenValor}
              consumoEjemplo={consumoEjemplo}
              setConsumoEjemplo={setConsumoEjemplo}
              potenciaEjemplo={potenciaEjemplo}
              setPotenciaEjemplo={setPotenciaEjemplo}
            />
          )}
        </div>
      </Container>
    </div>
  );
}

interface SimuladorProps {
  precios: Precio[];
  comercializadoras: any[];
  tarifaMargen: string;
  setTarifaMargen: (t: string) => void;
  comercioMargen: number;
  setComerioMargen: (c: number) => void;
  tipoMargen: 'porcentaje' | 'fijo';
  setTipoMargen: (t: 'porcentaje' | 'fijo') => void;
  margenValor: number;
  setMargenValor: (v: number) => void;
  consumoEjemplo: number;
  setConsumoEjemplo: (v: number) => void;
  potenciaEjemplo: number;
  setPotenciaEjemplo: (v: number) => void;
}

function SimuladorMargenes({
  precios,
  comercializadoras,
  tarifaMargen,
  setTarifaMargen,
  comercioMargen,
  setComerioMargen,
  tipoMargen,
  setTipoMargen,
  margenValor,
  setMargenValor,
  consumoEjemplo,
  setConsumoEjemplo,
  potenciaEjemplo,
  setPotenciaEjemplo,
}: SimuladorProps) {
  const precioSeleccionado = precios.find(
    (p) => p.tarifa === tarifaMargen && p.comercializadora_id === comercioMargen
  );

  if (!precioSeleccionado) {
    return (
      <div className="card rounded-2xl p-8 text-center">
        <p className="text-muted">
          No hay tarifas para esta combinación. Crea una primero.
        </p>
      </div>
    );
  }

  // Calcular precios con margen
  const calcularPrecioConMargen = (precioOriginal: number): number => {
    if (tipoMargen === 'porcentaje') {
      return precioOriginal * (1 + margenValor / 100);
    } else {
      return precioOriginal + margenValor;
    }
  };

  const preciosConMargen = {
    energia: precioSeleccionado.precios_energia.map(calcularPrecioConMargen),
    potencia: precioSeleccionado.precios_potencia.map(calcularPrecioConMargen),
  };

  // Calcular costes
  const costeOriginalAnual =
    consumoEjemplo * precioSeleccionado.precios_energia[0] * 12 +
    potenciaEjemplo * precioSeleccionado.precios_potencia[0] * 365;

  const costeConMargenAnual =
    consumoEjemplo * preciosConMargen.energia[0] * 12 +
    potenciaEjemplo * preciosConMargen.potencia[0] * 365;

  const gananciaAnual = costeConMargenAnual - costeOriginalAnual;

  return (
    <div className="space-y-6">
      {/* Configuración */}
      <div className="card rounded-2xl p-6 md:p-8">
        <h2 className="mb-6 text-xl font-semibold text-foreground">Configurar Margen</h2>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {/* Tarifa */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Tarifa
            </label>
            <select
              value={tarifaMargen}
              onChange={(e) => setTarifaMargen(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 focus:border-accent focus:outline-none"
            >
              <option value="2.0">2.0</option>
              <option value="3.0">3.0</option>
              <option value="6.1">6.1</option>
            </select>
          </div>

          {/* Comercializadora */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Comercializadora
            </label>
            <select
              value={comercioMargen}
              onChange={(e) => setComerioMargen(parseInt(e.target.value))}
              className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 focus:border-accent focus:outline-none"
            >
              {comercializadoras.map((com) => (
                <option key={com.id} value={com.id}>
                  {com.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de margen */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Tipo de Margen
            </label>
            <select
              value={tipoMargen}
              onChange={(e) => setTipoMargen(e.target.value as 'porcentaje' | 'fijo')}
              className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 focus:border-accent focus:outline-none"
            >
              <option value="porcentaje">Porcentaje (%)</option>
              <option value="fijo">Cantidad Fija (€)</option>
            </select>
          </div>

          {/* Valor del margen */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Margen {tipoMargen === 'porcentaje' ? '(%)' : '(€)'}
            </label>
            <input
              type="number"
              value={margenValor}
              onChange={(e) => setMargenValor(parseFloat(e.target.value) || 0)}
              step={tipoMargen === 'porcentaje' ? '0.5' : '0.01'}
              className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        {/* Datos de ejemplo */}
        <div className="border-t border-neutral-200 pt-6">
          <h3 className="mb-4 font-semibold text-foreground">Datos de Ejemplo</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Consumo Mensual (kWh)
              </label>
              <input
                type="number"
                value={consumoEjemplo}
                onChange={(e) => setConsumoEjemplo(parseFloat(e.target.value) || 0)}
                step="10"
                className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Potencia Contratada (kW)
              </label>
              <input
                type="number"
                value={potenciaEjemplo}
                onChange={(e) => setPotenciaEjemplo(parseFloat(e.target.value) || 0)}
                step="0.1"
                className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 focus:border-accent focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Comparativa de precios */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Precios originales */}
        <div className="card rounded-2xl p-6 md:p-8">
          <h3 className="mb-4 text-lg font-semibold text-foreground">Precio Original</h3>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted mb-2">Energía (€/kWh)</p>
              <div className="grid gap-2">
                {precioSeleccionado.precios_energia.map((p, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted">P{idx + 1}:</span>
                    <span className="font-semibold">{p.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-neutral-200 pt-4">
              <p className="text-sm text-muted mb-2">Potencia (€/kW/día)</p>
              <div className="grid gap-2">
                {precioSeleccionado.precios_potencia.map((p, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted">Pot{idx + 1}:</span>
                    <span className="font-semibold">{p.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-neutral-200 pt-4 mt-4">
              <p className="text-sm text-muted">Coste anual (ejemplo)</p>
              <p className="text-2xl font-bold text-foreground">€{costeOriginalAnual.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Precios con margen */}
        <div className="card rounded-2xl p-6 md:p-8 border-2 border-accent/30 bg-accent/5">
          <h3 className="mb-4 text-lg font-semibold text-foreground">Con Tu Margen</h3>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted mb-2">Energía (€/kWh)</p>
              <div className="grid gap-2">
                {preciosConMargen.energia.map((p, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted">P{idx + 1}:</span>
                    <span className="font-semibold text-accent">{p.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-neutral-200 pt-4">
              <p className="text-sm text-muted mb-2">Potencia (€/kW/día)</p>
              <div className="grid gap-2">
                {preciosConMargen.potencia.map((p, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted">Pot{idx + 1}:</span>
                    <span className="font-semibold text-accent">{p.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-neutral-200 pt-4 mt-4">
              <p className="text-sm text-muted mb-2">Coste anual (ejemplo)</p>
              <p className="text-2xl font-bold text-accent">€{costeConMargenAnual.toFixed(2)}</p>
              <p className="text-sm text-accent mt-1">
                +€{gananciaAnual.toFixed(2)} de ganancia
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Resumen de ganancias */}
      <div className="card rounded-2xl p-6 md:p-8 bg-gradient-to-br from-accent/10 to-accent/5 border-2 border-accent/30">
        <h3 className="mb-4 text-lg font-semibold text-foreground">Estimación de Ganancias</h3>

        <div className="grid gap-6 md:grid-cols-3 text-center">
          <div>
            <p className="text-sm text-muted mb-1">Margen por Cliente (anual)</p>
            <p className="text-3xl font-bold text-accent">€{gananciaAnual.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted mb-1">Margen Porcentual</p>
            <p className="text-3xl font-bold text-accent">
              {((gananciaAnual / costeOriginalAnual) * 100).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-sm text-muted mb-1">Si contratas 10 clientes/año</p>
            <p className="text-3xl font-bold text-accent">€{(gananciaAnual * 10).toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewTarifaDisplay({ precio }: { precio: Precio }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h4 className="mb-3 font-semibold text-foreground text-sm">Precios de Energía (€/kWh)</h4>
        <div className="space-y-2">
          {precio.precios_energia.map((p, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-muted">Período {idx + 1}:</span>
              <span className="font-semibold text-foreground">{p.toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="mb-3 font-semibold text-foreground text-sm">Precios de Potencia (€/kW/día)</h4>
        <div className="space-y-2">
          {precio.precios_potencia.map((p, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-muted">Potencia {idx + 1}:</span>
              <span className="font-semibold text-foreground">{p.toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface EditFormProps {
  precio: Precio;
  onSave: (energias: number[], potencias: number[]) => void;
}

function EditTarifaForm({ precio, onSave }: EditFormProps) {
  const [energias, setEnergias] = useState(precio.precios_energia);
  const [potencias, setPotencias] = useState(precio.precios_potencia);

  return (
    <div className="space-y-6">
      <div>
        <h4 className="mb-3 font-semibold text-foreground text-sm">Precios de Energía (€/kWh)</h4>
        <div className="grid gap-3 md:grid-cols-3">
          {energias.map((p, idx) => (
            <div key={idx}>
              <label className="block text-xs font-semibold text-accent mb-1 uppercase">P{idx + 1}</label>
              <input
                type="number"
                step="0.0001"
                value={p}
                onChange={(e) => {
                  const newEnergias = [...energias];
                  newEnergias[idx] = parseFloat(e.target.value) || 0;
                  setEnergias(newEnergias);
                }}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="mb-3 font-semibold text-foreground text-sm">Precios de Potencia (€/kW/mes)</h4>
        <div className="grid gap-3 md:grid-cols-3">
          {potencias.map((p, idx) => (
            <div key={idx}>
              <label className="block text-xs font-semibold text-accent mb-1 uppercase">Pot{idx + 1}</label>
              <input
                type="number"
                step="0.0001"
                value={p}
                onChange={(e) => {
                  const newPotencias = [...potencias];
                  newPotencias[idx] = parseFloat(e.target.value) || 0;
                  setPotencias(newPotencias);
                }}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>
      <button
        onClick={() => onSave(energias, potencias)}
        className="w-full px-4 py-2 rounded-lg bg-accent text-white font-semibold hover:bg-accent/90 transition"
      >
        Guardar cambios
      </button>
    </div>
  );
}
