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
  const [preciosCustom, setPreciosCustom] = useState({
    energia: 0.15,
    potencia: 0.45,
  });

  const preciosAUssar = clienteSeleccionado
    ? {
        energia:
          clienteSeleccionado.precios_energia?.[0] ||
          (preciosCustom.energia > 0 ? preciosCustom.energia : 0.15),
        potencia:
          clienteSeleccionado.precios_potencia?.[0] ||
          (preciosCustom.potencia > 0 ? preciosCustom.potencia : 0.45),
      }
    : preciosCustom;

  // Consumos estimados (valores por defecto)
  const consumoEnergia = 3000; // kWh/año
  const consumoPotencia = 5; // kW

  // Calcular costes
  const costeClienteEnergia = consumoEnergia * preciosAUssar.energia;
  const costeClientePotencia = consumoPotencia * preciosAUssar.potencia * 365;
  const costeClienteTotal = costeClienteEnergia + costeClientePotencia;

  // Costes con fee
  const precioConFee = {
    energia: preciosAUssar.energia * (1 + fee / 100),
    potencia: preciosAUssar.potencia * (1 + fee / 100),
  };
  const costeConFeeEnergia = consumoEnergia * precioConFee.energia;
  const costeConFeePotencia = consumoPotencia * precioConFee.potencia * 365;
  const costeConFeeTotal = costeConFeeEnergia + costeConFeePotencia;

  const ahorroTotal = costeClienteTotal - costeConFeeTotal;
  const ahorroPorc = costeClienteTotal > 0 ? (ahorroTotal / costeClienteTotal) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Inputs principales */}
      <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
        <h2 className="mb-6 text-2xl font-bold text-foreground">💰 Comparativa de Tarifas</h2>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Cliente */}
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
              <option value="">-- Ingresar precios manualmente --</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.cups})
                </option>
              ))}
            </select>
          </div>

          {/* Comercializadora */}
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

          {/* Precios del cliente */}
          {!clienteSeleccionado && (
            <>
              <div>
                <label className="block text-sm font-bold text-foreground mb-2 uppercase tracking-widest">
                  Precio Energía (€/kWh)
                </label>
                <input
                  type="number"
                  value={preciosCustom.energia}
                  onChange={(e) =>
                    setPreciosCustom({ ...preciosCustom, energia: parseFloat(e.target.value) || 0 })
                  }
                  step="0.001"
                  className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground font-medium focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-foreground mb-2 uppercase tracking-widest">
                  Precio Potencia (€/kW/día)
                </label>
                <input
                  type="number"
                  value={preciosCustom.potencia}
                  onChange={(e) =>
                    setPreciosCustom({ ...preciosCustom, potencia: parseFloat(e.target.value) || 0 })
                  }
                  step="0.001"
                  className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground font-medium focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
                />
              </div>
            </>
          )}

          {/* Fee */}
          <div>
            <label className="block text-sm font-bold text-foreground mb-2 uppercase tracking-widest">
              FEE / Margen (%)
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

      {/* Resultado */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Actual */}
        <div className="card rounded-2xl p-6 md:p-8 bg-card/50 border border-border">
          <div className="text-sm font-bold text-muted uppercase tracking-widest mb-2">Coste Actual</div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Energía:</span>
              <span className="font-semibold text-foreground">€{costeClienteEnergia.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Potencia:</span>
              <span className="font-semibold text-foreground">€{costeClientePotencia.toFixed(2)}</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between">
              <span className="font-bold text-foreground">TOTAL:</span>
              <span className="font-black text-lg text-foreground">€{costeClienteTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Con fee */}
        <div className="card rounded-2xl p-6 md:p-8 bg-accent/10 border border-accent/30">
          <div className="text-sm font-bold text-accent uppercase tracking-widest mb-2">Con {comercializadoras.find(c => c.id === comercializadora)?.nombre}</div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Energía:</span>
              <span className="font-semibold text-accent">€{costeConFeeEnergia.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Potencia:</span>
              <span className="font-semibold text-accent">€{costeConFeePotencia.toFixed(2)}</span>
            </div>
            <div className="border-t border-accent/30 pt-2 flex justify-between">
              <span className="font-bold text-accent">TOTAL:</span>
              <span className="font-black text-lg text-accent">€{costeConFeeTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Ahorro */}
        <div className={`card rounded-2xl p-6 md:p-8 border-2 ${
          ahorroTotal > 0
            ? 'bg-secondary/10 border-secondary/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className={`text-sm font-bold uppercase tracking-widest mb-2 ${
            ahorroTotal > 0 ? 'text-secondary' : 'text-red-400'
          }`}>
            {ahorroTotal > 0 ? '✓ AHORRO' : '✗ COSTE'}
          </div>
          <div className="space-y-2">
            <div className="text-center">
              <div className={`text-3xl font-black ${
                ahorroTotal > 0 ? 'text-secondary' : 'text-red-400'
              }`}>
                €{Math.abs(ahorroTotal).toFixed(2)}
              </div>
              <div className={`text-sm font-bold mt-1 ${
                ahorroTotal > 0 ? 'text-secondary/70' : 'text-red-400/70'
              }`}>
                {ahorroPorc.toFixed(1)}% anual
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
                className="w-full rounded-lg border border-border px-4 py-2.5 focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">CUPS *</label>
              <input
                type="text"
                value={formCliente.cups}
                onChange={(e) => setFormCliente({ ...formCliente, cups: e.target.value })}
                placeholder="ES1234567890123456789012"
                className="w-full rounded-lg border border-border px-4 py-2.5 focus:border-accent focus:outline-none"
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
                className="w-full rounded-lg border border-border px-4 py-2.5 focus:border-accent focus:outline-none"
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
                  className="rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
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
                  className="rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
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
                <tr className="border-b border-border bg-neutral-100">
                  <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                  <th className="px-4 py-3 text-left font-semibold">CUPS</th>
                  <th className="px-4 py-3 text-left font-semibold">Tarifa</th>
                  <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                  <th className="px-4 py-3 text-center font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((cliente) => (
                  <tr key={cliente.id} className="border-b border-border hover:bg-neutral-50">
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
