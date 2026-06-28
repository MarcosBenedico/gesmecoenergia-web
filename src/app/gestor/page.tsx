'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { obtenerUsuarioActual, logoutUsuario, obtenerPreciosComercializadoras } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/button';
import { Container } from '@/components/container';
import { SistemaSegumientos } from '@/components/sistema-seguimientos';
import { Calendario } from '@/components/calendario';

type Seccion = 'view' | 'create' | 'margenes' | 'clientes' | 'seguimientos' | 'calendario';

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
  const [clienteAbierto, setClienteAbierto] = useState<any | null>(null);
  const [editandoCliente, setEditandoCliente] = useState(false);
  const [seguimientosCliente, setSeguimientosCliente] = useState<any[]>([]);
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
    // Inicializar sesión si no existe
    if (!obtenerUsuarioActual()) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('admin_token', 'master_' + Date.now());
        localStorage.setItem('admin_user', 'UsuarioMaster');
      }
    }

    setUsuarioActual('UsuarioMaster');
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

  const abrirCliente = async (cliente: any) => {
    console.log('Abriendo cliente:', cliente);
    setClienteAbierto(cliente);
    setFormCliente({
      nombre: cliente.nombre,
      cups: cliente.cups,
      tarifa: cliente.tarifa || '2.0',
      precios_energia: cliente.precios_energia || [0, 0, 0],
      precios_potencia: cliente.precios_potencia || [0, 0],
    });
    setEditandoCliente(false);

    // Cargar seguimientos del cliente
    try {
      const { data } = await supabase
        .from('seguimientos')
        .select('*')
        .eq('cliente_id', cliente.id)
        .order('created_at', { ascending: false });
      setSeguimientosCliente(data || []);
    } catch (error) {
      console.error('Error al cargar seguimientos:', error);
    }
  };

  const guardarCambiosCliente = async () => {
    if (!clienteAbierto) return;

    try {
      const { error } = await supabase
        .from('clientes')
        .update({
          nombre: formCliente.nombre,
          cups: formCliente.cups,
          tarifa: formCliente.tarifa,
          precios_energia: formCliente.precios_energia,
          precios_potencia: formCliente.precios_potencia,
        })
        .eq('id', clienteAbierto.id);

      if (error) throw error;

      // Actualizar en la lista
      setClientes(
        clientes.map((c) =>
          c.id === clienteAbierto.id
            ? {
                ...c,
                ...formCliente,
              }
            : c
        )
      );

      setClienteAbierto({ ...clienteAbierto, ...formCliente });
      setEditandoCliente(false);
      alert('✓ Cliente actualizado');
    } catch (error) {
      console.error('Error al guardar:', error);
      alert('Error al guardar los cambios');
    }
  };

  const preciosFiltrados = precios.filter((p) => p.tarifa === filtroTarifa);

  const handleLogout = () => {
    logoutUsuario();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
    }
    router.push('/');
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
    <div className="min-h-screen bg-background py-20">
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
          <div className="rounded-2xl p-6 flex gap-3 flex-wrap bg-gradient-to-r from-surface to-card border border-border">
            <button
              onClick={() => setSeccion('view')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                seccion === 'view'
                  ? 'bg-accent text-white'
                  : 'bg-card/80 text-foreground border border-border/50 hover:bg-card'
              }`}
            >
              Ver Tarifas
            </button>
            <button
              onClick={() => setSeccion('create')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                seccion === 'create'
                  ? 'bg-accent text-white'
                  : 'bg-card/80 text-foreground border border-border/50 hover:bg-card'
              }`}
            >
              Crear Tarifa
            </button>
            <button
              onClick={() => setSeccion('margenes')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                seccion === 'margenes'
                  ? 'bg-accent text-white'
                  : 'bg-card/80 text-foreground border border-border/50 hover:bg-card'
              }`}
            >
              Comparativa
            </button>
            <button
              onClick={() => setSeccion('clientes')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                seccion === 'clientes'
                  ? 'bg-accent text-white'
                  : 'bg-card/80 text-foreground border border-border/50 hover:bg-card'
              }`}
            >
              Gestionar Clientes
            </button>
            <button
              onClick={() => setSeccion('seguimientos')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                seccion === 'seguimientos'
                  ? 'bg-accent text-white'
                  : 'bg-card/80 text-foreground border border-border/50 hover:bg-card'
              }`}
            >
              Seguimientos
            </button>
            <button
              onClick={() => setSeccion('calendario')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                seccion === 'calendario'
                  ? 'bg-accent text-white'
                  : 'bg-card/80 text-foreground border border-border/50 hover:bg-card'
              }`}
            >
              Calendario
            </button>
          </div>

          {/* Sección: Ver Tarifas */}
          {seccion === 'view' && (
            <>
              {/* Filtros */}
              <div className="card rounded-2xl p-6 bg-surface/50">
                <h2 className="mb-4 font-semibold text-foreground">Filtrar por tarifa</h2>
                <div className="flex gap-2">
                  {['2.0', '3.0', '6.1'].map((tarifa) => (
                    <button
                      key={tarifa}
                      onClick={() => setFiltroTarifa(tarifa)}
                      className={`rounded-lg px-4 py-2 font-semibold transition ${
                        filtroTarifa === tarifa
                          ? 'bg-accent text-white'
                          : 'bg-card/80 text-foreground border border-border/50 hover:bg-card'
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
                  <div key={precio.id} className="card rounded-2xl p-6 border-2 border-border">
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
                      className="w-full rounded-lg border border-border px-4 py-2.5 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
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
                      className="w-full rounded-lg border border-border px-4 py-2.5 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
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
                          className="w-full rounded-lg border border-border px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
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
                          className="w-full rounded-lg border border-border px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
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
              clienteAbierto={clienteAbierto}
              setClienteAbierto={setClienteAbierto}
              editandoCliente={editandoCliente}
              setEditandoCliente={setEditandoCliente}
              formCliente={formCliente}
              setFormCliente={setFormCliente}
              abrirCliente={abrirCliente}
              guardarCambiosCliente={guardarCambiosCliente}
              seguimientosCliente={seguimientosCliente}
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

          {/* Sección: Calendario */}
          {seccion === 'calendario' && (
            <Calendario />
          )}

          {/* Sección: Comparativa de Tarifas */}
          {seccion === 'margenes' && (
            <ComparativaSimulador clientes={clientes} comercializadoras={comercializadoras} />
          )}
        </div>
      </Container>
    </div>
  );
}

interface ComparativaProps {
  clientes: any[];
  comercializadoras: any[];
}

function ComparativaSimulador({ clientes, comercializadoras }: ComparativaProps) {
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any | null>(null);
  const [comercializadora, setComercializadora] = useState<number>(1);
  const [fee, setFee] = useState<number>(0);
  const [consumoEnergia, setConsumoEnergia] = useState<number[]>([1000, 1200, 800]);
  const [consumoPotencia, setConsumoPotencia] = useState<number[]>([5, 3]);
  const [preciosCustom, setPreciosCustom] = useState({
    energia: [0.15, 0.16, 0.14],
    potencia: [0.45, 0.35],
  });

  const preciosAUsar = clienteSeleccionado
    ? {
        energia: clienteSeleccionado.precios_energia || [0.15, 0.16, 0.14],
        potencia: clienteSeleccionado.precios_potencia || [0.45, 0.35],
      }
    : preciosCustom;

  const consumosAUsar = {
    energia: consumoEnergia,
    potencia: consumoPotencia,
  };

  // Cálculos detallados
  const detalleEnergia = preciosAUsar.energia.map((precio: number, idx: number) => {
    const consumo = consumosAUsar.energia[idx] || 0;
    const costeActual = consumo * precio * 12;
    const costeConFee = consumo * precio * (1 + fee / 100) * 12;
    return {
      periodo: idx + 1,
      precio,
      consumo,
      costeActual,
      costeConFee,
      ahorro: costeActual - costeConFee,
    };
  });

  const detallePotencia = preciosAUsar.potencia.map((precio: number, idx: number) => {
    const consumo = consumosAUsar.potencia[idx] || 0;
    const costeActual = consumo * precio * 365;
    const costeConFee = consumo * precio * (1 + fee / 100) * 365;
    return {
      potencia: idx + 1,
      precio,
      consumo,
      costeActual,
      costeConFee,
      ahorro: costeActual - costeConFee,
    };
  });

  const totales: any = {
    costeEnergia: detalleEnergia.reduce((sum: number, d: any) => sum + d.costeActual, 0),
    costePotencia: detallePotencia.reduce((sum: number, d: any) => sum + d.costeActual, 0),
    costeConFeeEnergia: detalleEnergia.reduce((sum: number, d: any) => sum + d.costeConFee, 0),
    costeConFeePotencia: detallePotencia.reduce((sum: number, d: any) => sum + d.costeConFee, 0),
  };

  totales.costeTotal = totales.costeEnergia + totales.costePotencia;
  totales.costeConFeeTotal = totales.costeConFeeEnergia + totales.costeConFeePotencia;

  const ahorroTotal = totales.costeTotal - totales.costeConFeeTotal;
  const ahorroPorc = totales.costeTotal > 0 ? (ahorroTotal / totales.costeTotal) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Inputs principales */}
      <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
        <h2 className="mb-6 text-2xl font-bold text-foreground">💰 Comparativa Detallada</h2>

        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <label className="block text-sm font-bold text-foreground mb-2 uppercase tracking-widest">
              Cliente (opcional)
            </label>
            <select
              value={clienteSeleccionado?.id || ''}
              onChange={(e) => {
                const cliente = clientes.find((c) => c.id === parseInt(e.target.value));
                setClienteSeleccionado(cliente || null);
              }}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground font-medium focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
            >
              <option value="">-- Manual --</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-foreground mb-2 uppercase tracking-widest">
              Comercializadora
            </label>
            <select
              value={comercializadora}
              onChange={(e) => setComercializadora(parseInt(e.target.value))}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground font-medium focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
            >
              {comercializadoras.map((com) => (
                <option key={com.id} value={com.id}>
                  {com.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-foreground mb-2 uppercase tracking-widest">
              FEE/Margen (%)
            </label>
            <input
              type="number"
              value={fee}
              onChange={(e) => setFee(parseFloat(e.target.value) || 0)}
              step="0.1"
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground font-medium focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tabla de Consumos */}
      <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
        <h3 className="font-bold text-foreground text-lg mb-4">📊 Consumos Anuales</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="font-bold text-foreground mb-3">Energía (kWh/período)</h4>
            <div className="grid grid-cols-3 gap-2">
              {consumosAUsar.energia.map((consumo: number, idx: number) => (
                <div key={idx} className="bg-card/80 rounded-lg p-3 border border-border/50">
                  <div className="text-xs font-bold text-muted mb-1">P{idx + 1}</div>
                  <input
                    type="number"
                    value={consumo}
                    onChange={(e) => {
                      const newConsumos = [...consumosAUsar.energia];
                      newConsumos[idx] = parseFloat(e.target.value) || 0;
                      setConsumoEnergia(newConsumos);
                    }}
                    className="w-full bg-card/50 rounded px-2 py-1 text-sm text-foreground border border-border/30 focus:border-accent focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-bold text-foreground mb-3">Potencia (kW/grupo)</h4>
            <div className="grid grid-cols-3 gap-2">
              {consumosAUsar.potencia.map((consumo: number, idx: number) => (
                <div key={idx} className="bg-card/80 rounded-lg p-3 border border-border/50">
                  <div className="text-xs font-bold text-muted mb-1">Pot{idx + 1}</div>
                  <input
                    type="number"
                    value={consumo}
                    onChange={(e) => {
                      const newConsumos = [...consumosAUsar.potencia];
                      newConsumos[idx] = parseFloat(e.target.value) || 0;
                      setConsumoPotencia(newConsumos);
                    }}
                    step="0.1"
                    className="w-full bg-card/50 rounded px-2 py-1 text-sm text-foreground border border-border/30 focus:border-accent focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Precios */}
      <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
        <h3 className="font-bold text-foreground text-lg mb-4">💵 Precios por Período</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="font-bold text-foreground mb-3">Energía (€/kWh)</h4>
            <div className="grid grid-cols-3 gap-2">
              {preciosAUsar.energia.map((precio: number, idx: number) => (
                <div key={idx} className="bg-card/80 rounded-lg p-3 border border-border/50">
                  <div className="text-xs font-bold text-muted mb-1">P{idx + 1}</div>
                  <input
                    type="number"
                    value={precio}
                    onChange={(e) => {
                      const newPrecios = [...preciosAUsar.energia];
                      newPrecios[idx] = parseFloat(e.target.value) || 0;
                      setPreciosCustom({ ...preciosCustom, energia: newPrecios });
                    }}
                    step="0.001"
                    className="w-full bg-card/50 rounded px-2 py-1 text-sm text-foreground border border-border/30 focus:border-accent focus:outline-none"
                    disabled={clienteSeleccionado !== null}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-bold text-foreground mb-3">Potencia (€/kW/día)</h4>
            <div className="grid grid-cols-3 gap-2">
              {preciosAUsar.potencia.map((precio: number, idx: number) => (
                <div key={idx} className="bg-card/80 rounded-lg p-3 border border-border/50">
                  <div className="text-xs font-bold text-muted mb-1">Pot{idx + 1}</div>
                  <input
                    type="number"
                    value={precio}
                    onChange={(e) => {
                      const newPrecios = [...preciosAUsar.potencia];
                      newPrecios[idx] = parseFloat(e.target.value) || 0;
                      setPreciosCustom({ ...preciosCustom, potencia: newPrecios });
                    }}
                    step="0.001"
                    className="w-full bg-card/50 rounded px-2 py-1 text-sm text-foreground border border-border/30 focus:border-accent focus:outline-none"
                    disabled={clienteSeleccionado !== null}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Desglose por Período */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Detalles Energía */}
        <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
          <h3 className="font-bold text-foreground text-lg mb-4">⚡ Cálculo Energía</h3>
          <div className="space-y-3 text-sm">
            {detalleEnergia.map((d: any) => (
              <div key={d.periodo} className="p-3 bg-card/80 rounded-lg border border-border/50">
                <div className="flex justify-between mb-2">
                  <span className="font-bold text-foreground">P{d.periodo}</span>
                  <span className="text-xs text-muted">{d.consumo} kWh × €{d.precio.toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Actual:</span>
                  <span className="font-semibold text-foreground">€{d.costeActual.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-muted">Con +{fee}%:</span>
                  <span className={`font-semibold ${d.ahorro > 0 ? 'text-red-400' : 'text-foreground'}`}>€{d.costeConFee.toFixed(2)}</span>
                </div>
              </div>
            ))}
            <div className="border-t border-border pt-3 mt-3 font-bold">
              <div className="flex justify-between">
                <span>TOTAL ENERGÍA:</span>
                <span className="text-foreground">€{totales.costeEnergia.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Detalles Potencia */}
        <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
          <h3 className="font-bold text-foreground text-lg mb-4">💪 Cálculo Potencia</h3>
          <div className="space-y-3 text-sm">
            {detallePotencia.map((d: any) => (
              <div key={d.potencia} className="p-3 bg-card/80 rounded-lg border border-border/50">
                <div className="flex justify-between mb-2">
                  <span className="font-bold text-foreground">Pot{d.potencia}</span>
                  <span className="text-xs text-muted">{d.consumo} kW × €{d.precio.toFixed(4)} × 365</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Actual:</span>
                  <span className="font-semibold text-foreground">€{d.costeActual.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-muted">Con +{fee}%:</span>
                  <span className={`font-semibold ${d.ahorro > 0 ? 'text-red-400' : 'text-foreground'}`}>€{d.costeConFee.toFixed(2)}</span>
                </div>
              </div>
            ))}
            <div className="border-t border-border pt-3 mt-3 font-bold">
              <div className="flex justify-between">
                <span>TOTAL POTENCIA:</span>
                <span className="text-foreground">€{totales.costePotencia.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resumen Final */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="card rounded-2xl p-6 md:p-8 bg-card/50 border border-border">
          <div className="text-sm font-bold text-muted uppercase tracking-widest mb-3">Coste Actual</div>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span>Energía:</span>
              <span className="font-semibold">€{totales.costeEnergia.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Potencia:</span>
              <span className="font-semibold">€{totales.costePotencia.toFixed(2)}</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between font-bold">
              <span>TOTAL ANUAL:</span>
              <span className="text-xl text-foreground">€{totales.costeTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="card rounded-2xl p-6 md:p-8 bg-accent/10 border border-accent/30">
          <div className="text-sm font-bold text-accent uppercase tracking-widest mb-3">Con FEE +{fee}%</div>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span>Energía:</span>
              <span className="font-semibold text-accent">€{totales.costeConFeeEnergia.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Potencia:</span>
              <span className="font-semibold text-accent">€{totales.costeConFeePotencia.toFixed(2)}</span>
            </div>
            <div className="border-t border-accent/30 pt-2 flex justify-between font-bold">
              <span>TOTAL ANUAL:</span>
              <span className="text-xl text-accent">€{totales.costeConFeeTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className={`card rounded-2xl p-6 md:p-8 border-2 ${
          ahorroTotal > 0
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-green-500/10 border-green-500/30'
        }`}>
          <div className={`text-sm font-bold uppercase tracking-widest mb-3 ${
            ahorroTotal > 0 ? 'text-red-400' : 'text-green-400'
          }`}>
            {ahorroTotal > 0 ? '📈 Incremento' : '📉 Ahorro'}
          </div>
          <div className="space-y-2">
            <div className="text-center">
              <div className={`text-4xl font-black mb-2 ${
                ahorroTotal > 0 ? 'text-red-400' : 'text-green-400'
              }`}>
                €{Math.abs(ahorroTotal).toFixed(2)}
              </div>
              <div className={`text-lg font-bold ${
                ahorroTotal > 0 ? 'text-red-400/70' : 'text-green-400/70'
              }`}>
                {Math.abs(ahorroPorc).toFixed(1)}% anual
              </div>
            </div>
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
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
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
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
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
  clienteAbierto: any;
  setClienteAbierto: (c: any) => void;
  editandoCliente: boolean;
  setEditandoCliente: (e: boolean) => void;
  formCliente: any;
  setFormCliente: (f: any) => void;
  abrirCliente: (c: any) => void;
  guardarCambiosCliente: () => Promise<void>;
  seguimientosCliente: any[];
}

function GestionarClientes({
  clientes,
  setClientes,
  cargarClientes,
  clienteAbierto,
  setClienteAbierto,
  editandoCliente,
  setEditandoCliente,
  formCliente,
  setFormCliente,
  abrirCliente,
  guardarCambiosCliente,
  seguimientosCliente,
}: GestionarClientesProps) {
  const [loading, setLoading] = useState(false);

  const handleEliminarCliente = async (id: number) => {
    if (!confirm('¿Eliminar este cliente?')) return;

    try {
      const { error } = await supabase.from('clientes').delete().eq('id', id);
      if (error) throw error;
      setClienteAbierto(null);
      await cargarClientes();
    } catch (error) {
      alert('Error al eliminar: ' + (error as any).message);
    }
  };

  const periodos = formCliente.tarifa === '2.0' ? 3 : 6;
  const potencias = formCliente.tarifa === '2.0' ? 2 : 6;

  const handleCargarExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter((line: string) => line.trim());

      const clientesNuevos = lines.map((line: string) => {
        const partes = line.split(',').map((v: string) => v.trim().replace(/"/g, ''));
        const nombre = partes[0];
        const cups = partes[1];
        let tarifa = partes[2];

        // Detectar tarifa automáticamente según el número de precios
        const preciosCount = partes.length - 3;
        if (preciosCount === 5) tarifa = '2.0'; // 3 energía + 2 potencia
        else if (preciosCount === 12) tarifa = '6.1'; // 6 energía + 6 potencia
        else if (preciosCount === 12) tarifa = '3.0'; // 6 energía + 6 potencia

        let precios_energia: number[] = [];
        let precios_potencia: number[] = [];

        if (tarifa === '2.0') {
          // 3 energía + 2 potencia
          precios_energia = [
            parseFloat(partes[3].replace(',', '.')) || 0,
            parseFloat(partes[4].replace(',', '.')) || 0,
            parseFloat(partes[5].replace(',', '.')) || 0,
          ];
          precios_potencia = [
            parseFloat(partes[6].replace(',', '.')) || 0,
            parseFloat(partes[7].replace(',', '.')) || 0,
          ];
        } else {
          // 6 energía + 6 potencia (para 3.0 y 6.1)
          precios_energia = [
            parseFloat(partes[3].replace(',', '.')) || 0,
            parseFloat(partes[4].replace(',', '.')) || 0,
            parseFloat(partes[5].replace(',', '.')) || 0,
            parseFloat(partes[6].replace(',', '.')) || 0,
            parseFloat(partes[7].replace(',', '.')) || 0,
            parseFloat(partes[8].replace(',', '.')) || 0,
          ];
          precios_potencia = [
            parseFloat(partes[9].replace(',', '.')) || 0,
            parseFloat(partes[10].replace(',', '.')) || 0,
            parseFloat(partes[11].replace(',', '.')) || 0,
            parseFloat(partes[12].replace(',', '.')) || 0,
            parseFloat(partes[13].replace(',', '.')) || 0,
            parseFloat(partes[14].replace(',', '.')) || 0,
          ];
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

      alert(`✅ ${clientesNuevos.length} cliente(s) importado(s) correctamente`);
      await cargarClientes();
      e.target.value = '';
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error al importar: ' + (error as any).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Si hay cliente abierto, mostrar ficha */}
      {clienteAbierto ? (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setClienteAbierto(null)}
              className="px-4 py-2 rounded-lg bg-card/80 text-foreground border border-border/50 hover:bg-card transition font-semibold"
            >
              ◀ Volver
            </button>
            <h2 className="text-3xl font-black text-foreground">📋 {clienteAbierto.nombre}</h2>
            <div className="w-32"></div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Ficha del cliente */}
            <div className="lg:col-span-2 space-y-6">
              <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
                {!editandoCliente ? (
                  <>
                    {/* Modo lectura */}
                    <div className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">
                            Nombre
                          </label>
                          <p className="text-lg font-bold text-foreground">{clienteAbierto.nombre}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">
                            CUPS
                          </label>
                          <p className="text-lg font-bold text-foreground font-mono">{clienteAbierto.cups}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">
                            Tarifa
                          </label>
                          <p className="text-lg font-bold text-accent">{clienteAbierto.tarifa}</p>
                        </div>
                      </div>

                      <div className="border-t border-border pt-6 space-y-4">
                        <div>
                          <h4 className="font-bold text-foreground mb-3">Precios Energía (€/kWh)</h4>
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                            {clienteAbierto.precios_energia?.map((precio: number, idx: number) => (
                              <div key={idx} className="bg-card/80 rounded-lg p-3 text-center border border-border/50">
                                <div className="text-xs font-bold text-muted mb-1">P{idx + 1}</div>
                                <div className="text-lg font-black text-accent">{precio.toFixed(4)}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-bold text-foreground mb-3">Precios Potencia (€/kW/día)</h4>
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                            {clienteAbierto.precios_potencia?.map((precio: number, idx: number) => (
                              <div key={idx} className="bg-card/80 rounded-lg p-3 text-center border border-border/50">
                                <div className="text-xs font-bold text-muted mb-1">Pot{idx + 1}</div>
                                <div className="text-lg font-black text-secondary">{precio.toFixed(4)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-4 border-t border-border">
                        <button
                          onClick={() => setEditandoCliente(true)}
                          className="flex-1 px-4 py-3 rounded-lg bg-accent text-white font-bold hover:bg-accent/90 transition"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => handleEliminarCliente(clienteAbierto.id)}
                          className="px-4 py-3 rounded-lg bg-red-500/20 text-red-400 font-bold hover:bg-red-500/30 transition border border-red-500/40"
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Modo editar */}
                    <div className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="block text-xs font-bold text-foreground uppercase tracking-widest mb-2">
                            Nombre
                          </label>
                          <input
                            type="text"
                            value={formCliente.nombre}
                            onChange={(e) => setFormCliente({ ...formCliente, nombre: e.target.value })}
                            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground font-medium focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-foreground uppercase tracking-widest mb-2">
                            CUPS
                          </label>
                          <input
                            type="text"
                            value={formCliente.cups}
                            onChange={(e) => setFormCliente({ ...formCliente, cups: e.target.value })}
                            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground font-medium focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-foreground uppercase tracking-widest mb-2">
                            Tarifa
                          </label>
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
                            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground font-medium focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
                          >
                            <option value="2.0">2.0</option>
                            <option value="3.0">3.0</option>
                            <option value="6.1">6.1</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-bold text-foreground mb-3">Precios Energía (€/kWh)</h4>
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
                              className="rounded-lg border border-border bg-card px-3 py-2 text-foreground font-medium focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-bold text-foreground mb-3">Precios Potencia (€/kW/día)</h4>
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
                              className="rounded-lg border border-border bg-card px-3 py-2 text-foreground font-medium focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
                            />
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-4 border-t border-border">
                        <button
                          onClick={() => {
                            guardarCambiosCliente();
                          }}
                          className="flex-1 px-4 py-3 rounded-lg bg-secondary text-white font-bold hover:bg-secondary/90 transition"
                        >
                          ✓ Guardar
                        </button>
                        <button
                          onClick={() => {
                            setEditandoCliente(false);
                            setFormCliente({
                              nombre: clienteAbierto.nombre,
                              cups: clienteAbierto.cups,
                              tarifa: clienteAbierto.tarifa || '2.0',
                              precios_energia: clienteAbierto.precios_energia || [0, 0, 0],
                              precios_potencia: clienteAbierto.precios_potencia || [0, 0],
                            });
                          }}
                          className="flex-1 px-4 py-3 rounded-lg bg-card/80 text-foreground font-bold hover:bg-card transition border border-border"
                        >
                          ✗ Cancelar
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Seguimientos (solo en modo lectura) */}
            {!editandoCliente && (
              <div className="card rounded-2xl p-6 md:p-8 bg-surface/50 border border-border">
                <h3 className="font-bold text-foreground text-lg mb-4">📍 Seguimientos ({seguimientosCliente.length})</h3>
                {seguimientosCliente.length === 0 ? (
                  <p className="text-muted text-sm text-center py-6">Sin seguimientos</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {seguimientosCliente.map((seg) => (
                      <div key={seg.id} className="p-3 rounded-lg bg-card/80 border border-border/50">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            seg.estado === 'Contactado'
                              ? 'bg-blue-500/20 text-blue-300'
                              : seg.estado === 'Interesado'
                              ? 'bg-yellow-500/20 text-yellow-300'
                              : seg.estado === 'Contratado'
                              ? 'bg-green-500/20 text-green-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}>
                            {seg.estado}
                          </span>
                          <span className="text-xs text-muted/70">
                            {new Date(seg.created_at).toLocaleDateString('es', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        {seg.notas && (
                          <p className="text-xs text-foreground mb-2">{seg.notas}</p>
                        )}
                        {seg.fecha_proximo_seguimiento && (
                          <p className="text-xs text-secondary font-semibold">
                            📅 {new Date(seg.fecha_proximo_seguimiento).toLocaleDateString('es')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Lista de clientes */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-black text-foreground">👥 Clientes ({clientes.length})</h2>
          </div>

          {/* Importar Excel */}
          <div className="card rounded-2xl p-6 md:p-8 border-2 border-accent/30 bg-accent/5">
            <h3 className="mb-4 font-bold text-foreground text-lg">📥 Importar Clientes desde CSV</h3>
            <div className="space-y-3">
              <p className="text-sm text-muted">
                📋 <strong>Formato esperado:</strong> Nombre, CUPS, Tarifa, P1, P2, P3, (P4, P5, P6), Pot1, Pot2, (Pot3-6)
              </p>
              <p className="text-xs text-muted/70">
                ℹ️ La tarifa se detecta automáticamente según el número de precios (5 = 2.0, 12 = 3.0/6.1)
              </p>
              <p className="text-xs text-muted/70">
                💡 Usa comas (,) como separador de decimales. Ejemplo: 0,171445
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleCargarExcel}
                disabled={loading}
                className="w-full px-4 py-3 rounded-lg border-2 border-dashed border-accent/30 bg-card/50 text-foreground font-medium cursor-pointer hover:border-accent/60 transition"
              />
              {loading && <p className="text-sm text-accent">⏳ Importando...</p>}
            </div>
          </div>

          {clientes.length === 0 ? (
            <div className="card rounded-2xl p-12 text-center bg-surface/50">
              <p className="text-muted text-lg">No hay clientes aún</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {clientes.map((cliente) => (
                <div
                  key={cliente.id}
                  onClick={() => abrirCliente(cliente)}
                  className="card rounded-2xl p-6 bg-surface/50 border border-border hover:border-accent hover:bg-card/80 cursor-pointer transition"
                >
                  <div className="font-bold text-foreground text-lg mb-1">{cliente.nombre}</div>
                  <div className="text-xs text-muted font-mono mb-4">{cliente.cups}</div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-2 py-1 rounded-lg bg-accent/20 text-accent text-xs font-bold">
                      {cliente.tarifa}
                    </span>
                    <span className="text-xs text-muted/70">
                      {new Date(cliente.created_at).toLocaleDateString('es', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted">Abre para editar →</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
