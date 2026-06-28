'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { obtenerUsuarioActual, logoutUsuario, obtenerPreciosComercializadoras, actualizarPrecio } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/button';
import { Container } from '@/components/container';

type Seccion = 'view' | 'create';

interface Precio {
  id: number;
  comercializadora_id: number;
  comercializadoras?: { nombre: string; codigo: string };
  tarifa: string;
  periodo: number;
  potencia: number;
  precio_potencia: number;
  precio_energia: number;
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

  // Form crear tarifa
  const [formCrear, setFormCrear] = useState<FormCrearTarifa>({
    tarifa: '2.0',
    comercializadora_id: 1,
    precios: { energia: [0, 0, 0], potencia: [0, 0] },
  });

  const [editando, setEditando] = useState<number | null>(null);
  const [cambios, setCambios] = useState<Record<number, { potencia: number; energia: number }>>({});

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
      console.log('Comercializadoras cargadas:', comercios);
      setComercializadoras(comercios || []);

      // Establecer la primera comercializadora como default
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

      const periodos = formCrear.tarifa === '2.0' ? 3 : 6;
      const potencias = formCrear.tarifa === '2.0' ? 2 : 6;

      // Insertar registros para cada período y potencia
      const registros = [];

      for (let p = 1; p <= periodos; p++) {
        for (let pot = 1; pot <= potencias; pot++) {
          registros.push({
            comercializadora_id: formCrear.comercializadora_id,
            tarifa: formCrear.tarifa,
            periodo: p,
            potencia: pot,
            precio_energia: formCrear.precios.energia[p - 1] || 0,
            precio_potencia: formCrear.precios.potencia[pot - 1] || 0,
          });
        }
      }

      const { error } = await supabase.from('precios_comercializadoras').insert(registros);

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

  const handleGuardar = async (id: number) => {
    const cambio = cambios[id];
    if (!cambio) return;

    try {
      await actualizarPrecio(id, cambio.potencia, cambio.energia);
      await cargarDatos();
      setEditando(null);
      setCambios((prev) => {
        const newCambios = { ...prev };
        delete newCambios[id];
        return newCambios;
      });
    } catch (error) {
      console.error('Error al guardar precio:', error);
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
          <div className="card rounded-2xl p-6 flex gap-3">
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

              {/* Tabla de precios */}
              <div className="card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-100">
                        <th className="px-6 py-3 text-left font-semibold">Comercializadora</th>
                        <th className="px-6 py-3 text-left font-semibold">Período</th>
                        <th className="px-6 py-3 text-left font-semibold">Potencia</th>
                        <th className="px-6 py-3 text-right font-semibold">€/kW/mes</th>
                        <th className="px-6 py-3 text-right font-semibold">€/kWh</th>
                        <th className="px-6 py-3 text-center font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preciosFiltrados.map((precio) => (
                        <tr key={precio.id} className="border-b border-neutral-200 hover:bg-neutral-50">
                          <td className="px-6 py-3 font-medium text-foreground">
                            {precio.comercializadoras?.nombre}
                          </td>
                          <td className="px-6 py-3 text-muted">P{precio.periodo}</td>
                          <td className="px-6 py-3 text-muted">Pot{precio.potencia}</td>
                          <td className="px-6 py-3 text-right">
                            {editando === precio.id ? (
                              <input
                                type="number"
                                step="0.0001"
                                value={cambios[precio.id]?.potencia || precio.precio_potencia}
                                onChange={(e) =>
                                  setCambios((prev) => ({
                                    ...prev,
                                    [precio.id]: {
                                      ...(prev[precio.id] || { potencia: 0, energia: 0 }),
                                      potencia: parseFloat(e.target.value),
                                    },
                                  }))
                                }
                                className="w-24 rounded border border-accent px-2 py-1 text-right"
                              />
                            ) : (
                              precio.precio_potencia?.toFixed(4)
                            )}
                          </td>
                          <td className="px-6 py-3 text-right">
                            {editando === precio.id ? (
                              <input
                                type="number"
                                step="0.0001"
                                value={cambios[precio.id]?.energia || precio.precio_energia}
                                onChange={(e) =>
                                  setCambios((prev) => ({
                                    ...prev,
                                    [precio.id]: {
                                      ...(prev[precio.id] || { potencia: 0, energia: 0 }),
                                      energia: parseFloat(e.target.value),
                                    },
                                  }))
                                }
                                className="w-24 rounded border border-accent px-2 py-1 text-right"
                              />
                            ) : (
                              precio.precio_energia?.toFixed(4)
                            )}
                          </td>
                          <td className="px-6 py-3 text-center">
                            {editando === precio.id ? (
                              <div className="flex gap-2 justify-center">
                                <button
                                  onClick={() => handleGuardar(precio.id)}
                                  className="text-xs font-semibold text-accent hover:underline"
                                >
                                  Guardar
                                </button>
                                <button
                                  onClick={() => {
                                    setEditando(null);
                                    setCambios((prev) => {
                                      const newCambios = { ...prev };
                                      delete newCambios[precio.id];
                                      return newCambios;
                                    });
                                  }}
                                  className="text-xs font-semibold text-muted hover:underline"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditando(precio.id)}
                                className="text-xs font-semibold text-accent hover:underline"
                              >
                                Editar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                    {comercializadoras.length === 0 && (
                      <p className="mt-2 text-xs text-red-600">
                        ⚠️ No se cargaron las comercializadoras. Recarga la página.
                      </p>
                    )}
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
                  <h3 className="mb-4 font-semibold text-foreground">Precios de Potencia (€/kW/mes)</h3>
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
        </div>
      </Container>
    </div>
  );
}
