'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { obtenerUsuarioActual, obtenerEmailActual, logoutUsuario, obtenerPreciosComercializadoras, actualizarPrecio } from '@/lib/auth';
import { Button } from '@/components/button';
import { Container } from '@/components/container';

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

export default function GestorPage() {
  const router = useRouter();
  const [usuarioActual, setUsuarioActual] = useState<string | null>(null);
  const [precios, setPrecios] = useState<Precio[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTarifa, setFiltroTarifa] = useState('2.0');
  const [editando, setEditando] = useState<number | null>(null);
  const [cambios, setCambios] = useState<Record<number, { potencia: number; energia: number }>>({});

  useEffect(() => {
    const usuario = obtenerUsuarioActual();
    if (!usuario) {
      router.push('/gestor/login');
      return;
    }

    setUsuarioActual('UsuarioMaster');
    cargarPrecios();
  }, [router]);

  const cargarPrecios = async () => {
    try {
      const datos = await obtenerPreciosComercializadoras();
      setPrecios(datos);
    } catch (error) {
      console.error('Error al cargar precios:', error);
    } finally {
      setLoading(false);
    }
  };

  const preciosFiltrados = precios.filter((p) => p.tarifa === filtroTarifa);

  const handleLogout = () => {
    logoutUsuario();
    router.push('/gestor/login');
  };

  const handleGuardar = async (id: number) => {
    const cambio = cambios[id];
    if (!cambio) return;

    try {
      await actualizarPrecio(id, cambio.potencia, cambio.energia);
      await cargarPrecios();
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
              <p className="text-muted">No hay precios para esta tarifa</p>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
