'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { obtenerUsuarioActual as obtenerUsuarioAuth, logoutUsuario as logoutAuth, obtenerPreciosComercializadoras } from '@/lib/auth';
import { obtenerUsuarioActual, logoutUsuario, estaAutenticado } from '@/lib/auth-usuarios';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/button';
import { Container } from '@/components/container';
import { SistemaSegumientos } from '@/components/sistema-seguimientos';

type Seccion = 'view' | 'create' | 'margenes' | 'clientes' | 'seguimientos';

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

  // Simulador de comparativa
  const [tarifaSimulador, setTarifaSimulador] = useState('2.0');
  const [comercioComparar, setComerioComparar] = useState(1);
  const [preciosClienteActual, setPreciosClienteActual] = useState({
    energia: [0, 0, 0],
    potencia: [0, 0],
  });
  const [consumosCliente, setConsumosCliente] = useState({
    energia: [100, 100, 100],
    potencia: [2, 2],
  });

  // Gestión de clientes
  const [clientes, setClientes] = useState<any[]>([]);
  const [formCliente, setFormCliente] = useState({
    nombre: '',
    cups: '',
    tarifa: '2.0',
    precios_energia: [0, 0, 0],
    precios_potencia: [0, 0],
  });

  // Seguimientos
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any | null>(null);
  const [seguimientos, setSeguimientos] = useState<any[]>([]);

  useEffect(() => {
    // Verificar autenticación con nuevo sistema
    if (!estaAutenticado()) {
      router.push('/login');
      return;
    }

    const usuario = obtenerUsuarioActual();
    setUsuarioActual(usuario?.nombre || usuario?.username || 'Usuario');
    cargarDatos();
    cargarClientes();
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

  const cargarClientes = async () => {
    try {
      const { data } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false });
      setClientes(data || []);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    }
  };

  const cargarSeguimientos = async (clienteId: number) => {
    try {
      const { data } = await supabase
        .from('seguimientos')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });
      setSeguimientos(data || []);
    } catch (error) {
      console.error('Error al cargar seguimientos:', error);
    }
  };

  const preciosFiltrados = precios.filter((p) => p.tarifa === filtroTarifa);

  const handleLogout = () => {
    logoutUsuario();
    router.push('/login');
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
              Comparativa
            </button>
            <button
              onClick={() => setSeccion('clientes')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                seccion === 'clientes'
                  ? 'bg-accent text-white'
                  : 'bg-neutral-200 text-foreground hover:bg-neutral-300'
              }`}
            >
              Gestionar Clientes
            </button>
            <button
              onClick={() => setSeccion('seguimientos')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                seccion === 'seguimientos'
                  ? 'bg-accent text-white'
                  : 'bg-neutral-200 text-foreground hover:bg-neutral-300'
              }`}
            >
              Seguimientos
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

          {/* Sección: Gestionar Clientes */}
          {seccion === 'clientes' && (
            <GestionarClientes
              clientes={clientes}
              setClientes={setClientes}
              cargarClientes={cargarClientes}
              formCliente={formCliente}
              setFormCliente={setFormCliente}
            />
          )}

          {/* Sección: Seguimientos */}
          {seccion === 'seguimientos' && (
            <SistemaSegumientos
              clientes={clientes}
              clienteSeleccionado={clienteSeleccionado}
              setClienteSeleccionado={setClienteSeleccionado}
              seguimientos={seguimientos}
              cargarSeguimientos={cargarSeguimientos}
            />
          )}

          {/* Sección: Comparativa de Tarifas */}
          {seccion === 'margenes' && (
            <ComparativaSimulador
              precios={precios}
              comercializadoras={comercializadoras}
              tarifaSimulador={tarifaSimulador}
              setTarifaSimulador={setTarifaSimulador}
              comercioComparar={comercioComparar}
              setComerioComparar={setComerioComparar}
              preciosClienteActual={preciosClienteActual}
              setPreciosClienteActual={setPreciosClienteActual}
              consumosCliente={consumosCliente}
              setConsumosCliente={setConsumosCliente}
            />
          )}
        </div>
      </Container>
    </div>
  );
}

interface ComparativaProps {
  precios: Precio[];
  comercializadoras: any[];
  tarifaSimulador: string;
  setTarifaSimulador: (t: string) => void;
  comercioComparar: number;
  setComerioComparar: (c: number) => void;
  preciosClienteActual: { energia: number[]; potencia: number[] };
  setPreciosClienteActual: (p: { energia: number[]; potencia: number[] }) => void;
  consumosCliente: { energia: number[]; potencia: number[] };
  setConsumosCliente: (c: { energia: number[]; potencia: number[] }) => void;
}

function ComparativaSimulador({
  precios,
  comercializadoras,
  tarifaSimulador,
  setTarifaSimulador,
  comercioComparar,
  setComerioComparar,
  preciosClienteActual,
  setPreciosClienteActual,
  consumosCliente,
  setConsumosCliente,
}: ComparativaProps) {
  const periodos = tarifaSimulador === '2.0' ? 3 : 6;
  const potencias = tarifaSimulador === '2.0' ? 2 : 6;

  const tarifaComercio = precios.find(
    (p) => p.tarifa === tarifaSimulador && p.comercializadora_id === comercioComparar
  );

  if (!tarifaComercio) {
    return (
      <div className="card rounded-2xl p-8 text-center">
        <p className="text-muted">No hay tarifas para esta combinación. Crea una primero.</p>
      </div>
    );
  }

  // Calcular coste actual del cliente
  const costeClienteEnergia = consumosCliente.energia.reduce(
    (sum, consumo, idx) => sum + consumo * preciosClienteActual.energia[idx] * 12,
    0
  );
  const costeClientePotencia = consumosCliente.potencia.reduce(
    (sum, potencia, idx) => sum + potencia * preciosClienteActual.potencia[idx] * 365,
    0
  );
  const costeClienteTotal = costeClienteEnergia + costeClientePotencia;

  // Calcular coste con comercializadora
  const costeComercioEnergia = consumosCliente.energia.reduce(
    (sum, consumo, idx) => sum + consumo * tarifaComercio.precios_energia[idx] * 12,
    0
  );
  const costeComercioPotencia = consumosCliente.potencia.reduce(
    (sum, potencia, idx) => sum + potencia * tarifaComercio.precios_potencia[idx] * 365,
    0
  );
  const costeComercioTotal = costeComercioEnergia + costeComercioPotencia;

  const ahorroTotal = costeClienteTotal - costeComercioTotal;
  const ahorroPorc = costeClienteTotal > 0 ? (ahorroTotal / costeClienteTotal) * 100 : 0;

  const hayPreciosIngresados = preciosClienteActual.energia.some(p => p > 0);

  return (
    <div className="space-y-6">
      {/* Selección */}
      <div className="card rounded-2xl p-6 md:p-8">
        <h2 className="mb-6 text-xl font-semibold text-foreground">Simulador de Comparativa</h2>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Tipo de Tarifa</label>
            <select
              value={tarifaSimulador}
              onChange={(e) => {
                const tarifa = e.target.value;
                setTarifaSimulador(tarifa);
                const newPeriodos = tarifa === '2.0' ? 3 : 6;
                const newPotencias = tarifa === '2.0' ? 2 : 6;
                setPreciosClienteActual({
                  energia: Array(newPeriodos).fill(0),
                  potencia: Array(newPotencias).fill(0),
                });
                setConsumosCliente({
                  energia: Array(newPeriodos).fill(100),
                  potencia: Array(newPotencias).fill(2),
                });
              }}
              className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 focus:border-accent focus:outline-none"
            >
              <option value="2.0">Tarifa 2.0</option>
              <option value="3.0">Tarifa 3.0</option>
              <option value="6.1">Tarifa 6.1</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Comparar con
            </label>
            <select
              value={comercioComparar}
              onChange={(e) => setComerioComparar(parseInt(e.target.value))}
              className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 focus:border-accent focus:outline-none"
            >
              {comercializadoras.map((com) => (
                <option key={com.id} value={com.id}>
                  {com.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Datos del cliente */}
      <div className="card rounded-2xl p-6 md:p-8">
        <h3 className="mb-6 text-lg font-semibold text-foreground">Tarifa Actual del Cliente (Obligatorio)</h3>

        {!hayPreciosIngresados && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-700 font-semibold">⚠️ Ingresa los precios del cliente para calcular</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Energía */}
          <div>
            <h4 className="mb-3 font-semibold text-foreground">Precios Energía (€/kWh)</h4>
            <div className="grid gap-4 md:grid-cols-3">
              {Array.from({ length: periodos }).map((_, idx) => (
                <div key={`energy-${idx}`}>
                  <label className="block text-xs font-semibold text-accent mb-1 uppercase">
                    P{idx + 1} - Consumo (kWh)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={consumosCliente.energia[idx]}
                      onChange={(e) => {
                        const newConsumos = { ...consumosCliente };
                        newConsumos.energia[idx] = parseFloat(e.target.value) || 0;
                        setConsumosCliente(newConsumos);
                      }}
                      placeholder="kWh"
                      className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                    />
                    <input
                      type="number"
                      value={preciosClienteActual.energia[idx]}
                      onChange={(e) => {
                        const newPrecios = { ...preciosClienteActual };
                        newPrecios.energia[idx] = parseFloat(e.target.value) || 0;
                        setPreciosClienteActual(newPrecios);
                      }}
                      placeholder="€/kWh"
                      step="0.001"
                      className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Potencia */}
          <div>
            <h4 className="mb-3 font-semibold text-foreground">Precios Potencia (€/kW/día)</h4>
            <div className="grid gap-4 md:grid-cols-3">
              {Array.from({ length: potencias }).map((_, idx) => (
                <div key={`potencia-${idx}`}>
                  <label className="block text-xs font-semibold text-accent mb-1 uppercase">
                    Pot{idx + 1} - kW
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={consumosCliente.potencia[idx]}
                      onChange={(e) => {
                        const newConsumos = { ...consumosCliente };
                        newConsumos.potencia[idx] = parseFloat(e.target.value) || 0;
                        setConsumosCliente(newConsumos);
                      }}
                      placeholder="kW"
                      step="0.1"
                      className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                    />
                    <input
                      type="number"
                      value={preciosClienteActual.potencia[idx]}
                      onChange={(e) => {
                        const newPrecios = { ...preciosClienteActual };
                        newPrecios.potencia[idx] = parseFloat(e.target.value) || 0;
                        setPreciosClienteActual(newPrecios);
                      }}
                      placeholder="€/día"
                      step="0.001"
                      className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Resultado */}
      {!hayPreciosIngresados ? (
        <div className="card rounded-2xl p-8 text-center bg-neutral-50">
          <p className="text-muted text-lg">Ingresa precios en la sección "Tarifa Actual del Cliente" para ver la comparativa</p>
        </div>
      ) : (
        <>
      {/* Comparativa */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cliente actual */}
        <div className="card rounded-2xl p-6 md:p-8 border-2 border-neutral-200">
          <h3 className="mb-4 text-lg font-semibold text-foreground">Coste Actual</h3>

          <div className="space-y-3 text-sm mb-6">
            <div className="flex justify-between">
              <span className="text-muted">Energía:</span>
              <span className="font-semibold">€{costeClienteEnergia.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Potencia:</span>
              <span className="font-semibold">€{costeClientePotencia.toFixed(2)}</span>
            </div>
            <div className="border-t border-neutral-200 pt-3 flex justify-between text-base font-bold">
              <span>Total anual:</span>
              <span>€{costeClienteTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Con comercializadora */}
        <div className="card rounded-2xl p-6 md:p-8 border-2 border-accent/30 bg-accent/5">
          <h3 className="mb-4 text-lg font-semibold text-accent">Con {comercializadoras.find(c => c.id === comercioComparar)?.nombre}</h3>

          <div className="space-y-3 text-sm mb-6">
            <div className="flex justify-between">
              <span className="text-muted">Energía:</span>
              <span className="font-semibold text-accent">€{costeComercioEnergia.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Potencia:</span>
              <span className="font-semibold text-accent">€{costeComercioPotencia.toFixed(2)}</span>
            </div>
            <div className="border-t border-accent/20 pt-3 flex justify-between text-base font-bold">
              <span>Total anual:</span>
              <span className="text-accent">€{costeComercioTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Resultado */}
      <div className="card rounded-2xl p-8 bg-gradient-to-br from-accent/10 to-accent/5 border-2 border-accent/30 text-center">
        <p className="text-sm text-muted mb-2">Ahorro anual</p>
        <p className="text-5xl font-bold text-accent mb-2">€{ahorroTotal.toFixed(2)}</p>
        <p className="text-lg text-accent font-semibold">{ahorroPorc.toFixed(1)}% de reducción</p>
      </div>
        </>
      )}
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

interface GestionarClientesProps {
  clientes: any[];
  setClientes: (c: any[]) => void;
  cargarClientes: () => Promise<void>;
  formCliente: any;
  setFormCliente: (f: any) => void;
}

function GestionarClientes({
  clientes,
  setClientes,
  cargarClientes,
  formCliente,
  setFormCliente,
}: GestionarClientesProps) {
  const [loading, setLoading] = useState(false);

  const handleAgregarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCliente.nombre || !formCliente.cups) {
      alert('Nombre y CUPS son obligatorios');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('clientes').insert({
        nombre: formCliente.nombre,
        cups: formCliente.cups,
        tarifa: formCliente.tarifa,
        precios_energia: formCliente.precios_energia,
        precios_potencia: formCliente.precios_potencia,
      });

      if (error) throw error;

      alert('Cliente agregado exitosamente');
      setFormCliente({
        nombre: '',
        cups: '',
        tarifa: '2.0',
        precios_energia: [0, 0, 0],
        precios_potencia: [0, 0],
      });
      await cargarClientes();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al agregar cliente: ' + (error as any).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCargarExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter((line) => line.trim());

      const clientesNuevos = lines.map((line) => {
        const [nombre, cups, tarifa, ...precios] = line.split(',').map((v) => v.trim());
        const numPrecios = precios.map((p) => parseFloat(p) || 0);

        let precios_energia: number[] = [];
        let precios_potencia: number[] = [];

        if (tarifa === '2.0') {
          precios_energia = numPrecios.slice(0, 3);
          precios_potencia = numPrecios.slice(3, 5);
        } else {
          precios_energia = numPrecios.slice(0, 6);
          precios_potencia = numPrecios.slice(6, 12);
        }

        return {
          nombre,
          cups,
          tarifa,
          precios_energia,
          precios_potencia,
        };
      });

      const { error } = await supabase.from('clientes').insert(clientesNuevos);
      if (error) throw error;

      alert(`${clientesNuevos.length} clientes cargados exitosamente`);
      await cargarClientes();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cargar Excel: ' + (error as any).message);
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarCliente = async (id: number) => {
    if (!confirm('¿Eliminar este cliente?')) return;

    try {
      const { error } = await supabase.from('clientes').delete().eq('id', id);
      if (error) throw error;
      await cargarClientes();
    } catch (error) {
      alert('Error al eliminar: ' + (error as any).message);
    }
  };

  const periodos = formCliente.tarifa === '2.0' ? 3 : 6;
  const potencias = formCliente.tarifa === '2.0' ? 2 : 6;

  return (
    <div className="space-y-6">
      {/* Agregar cliente */}
      <div className="card rounded-2xl p-6 md:p-8">
        <h2 className="mb-6 text-xl font-semibold text-foreground">Agregar Cliente</h2>

        <form onSubmit={handleAgregarCliente} className="space-y-6">
          {/* Datos básicos */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Nombre *</label>
              <input
                type="text"
                value={formCliente.nombre}
                onChange={(e) =>
                  setFormCliente({ ...formCliente, nombre: e.target.value })
                }
                placeholder="Juan García"
                className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">CUPS *</label>
              <input
                type="text"
                value={formCliente.cups}
                onChange={(e) => setFormCliente({ ...formCliente, cups: e.target.value })}
                placeholder="ES1234567890123456789012"
                className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Tarifa</label>
              <select
                value={formCliente.tarifa}
                onChange={(e) => {
                  const tarifa = e.target.value;
                  const newPeriodos = tarifa === '2.0' ? 3 : 6;
                  const newPotencias = tarifa === '2.0' ? 2 : 6;
                  setFormCliente({
                    ...formCliente,
                    tarifa,
                    precios_energia: Array(newPeriodos).fill(0),
                    precios_potencia: Array(newPotencias).fill(0),
                  });
                }}
                className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 focus:border-accent focus:outline-none"
              >
                <option value="2.0">2.0</option>
                <option value="3.0">3.0</option>
                <option value="6.1">6.1</option>
              </select>
            </div>
          </div>

          {/* Precios energía */}
          <div>
            <h4 className="mb-3 font-semibold text-foreground">Precios Energía (€/kWh)</h4>
            <div className="grid gap-3 md:grid-cols-3">
              {Array.from({ length: periodos }).map((_, idx) => (
                <input
                  key={idx}
                  type="number"
                  step="0.001"
                  value={formCliente.precios_energia[idx]}
                  onChange={(e) => {
                    const newPrecios = [...formCliente.precios_energia];
                    newPrecios[idx] = parseFloat(e.target.value) || 0;
                    setFormCliente({ ...formCliente, precios_energia: newPrecios });
                  }}
                  placeholder={`P${idx + 1}`}
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              ))}
            </div>
          </div>

          {/* Precios potencia */}
          <div>
            <h4 className="mb-3 font-semibold text-foreground">Precios Potencia (€/kW/día)</h4>
            <div className="grid gap-3 md:grid-cols-3">
              {Array.from({ length: potencias }).map((_, idx) => (
                <input
                  key={idx}
                  type="number"
                  step="0.001"
                  value={formCliente.precios_potencia[idx]}
                  onChange={(e) => {
                    const newPrecios = [...formCliente.precios_potencia];
                    newPrecios[idx] = parseFloat(e.target.value) || 0;
                    setFormCliente({ ...formCliente, precios_potencia: newPrecios });
                  }}
                  placeholder={`Pot${idx + 1}`}
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent text-white font-semibold py-3 hover:bg-accent/90 transition"
          >
            {loading ? 'Agregando...' : 'Agregar Cliente'}
          </button>
        </form>
      </div>

      {/* Cargar Excel */}
      <div className="card rounded-2xl p-6 md:p-8 border-2 border-accent/30 bg-accent/5">
        <h3 className="mb-4 font-semibold text-foreground">Cargar Clientes desde CSV</h3>
        <p className="text-sm text-muted mb-4">
          Formato: Nombre, CUPS, Tarifa, P1, P2, P3, (P4, P5, P6), Pot1, Pot2, (Pot3-6)
        </p>
        <input
          type="file"
          accept=".csv"
          onChange={handleCargarExcel}
          disabled={loading}
          className="w-full"
        />
      </div>

      {/* Lista de clientes */}
      <div className="card rounded-2xl p-6 md:p-8">
        <h3 className="mb-4 font-semibold text-foreground">Clientes ({clientes.length})</h3>

        {clientes.length === 0 ? (
          <p className="text-muted text-center py-8">No hay clientes</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-100">
                  <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                  <th className="px-4 py-3 text-left font-semibold">CUPS</th>
                  <th className="px-4 py-3 text-left font-semibold">Tarifa</th>
                  <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                  <th className="px-4 py-3 text-center font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((cliente) => (
                  <tr key={cliente.id} className="border-b border-neutral-200 hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium">{cliente.nombre}</td>
                    <td className="px-4 py-3 text-xs font-mono">{cliente.cups}</td>
                    <td className="px-4 py-3">{cliente.tarifa}</td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {new Date(cliente.created_at).toLocaleDateString()} {new Date(cliente.created_at).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleEliminarCliente(cliente.id)}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
