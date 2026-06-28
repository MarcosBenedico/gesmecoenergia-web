'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { verificarGoogleConectado } from '@/lib/google-state';

interface SeguimientosProps {
  clientes: any[];
  clienteSeleccionado: any | null;
  setClienteSeleccionado: (c: any | null) => void;
  seguimientos: any[];
  cargarSeguimientos: (id: number) => Promise<void>;
}

export function SistemaSegumientos({
  clientes,
  clienteSeleccionado,
  setClienteSeleccionado,
  seguimientos,
  cargarSeguimientos,
}: SeguimientosProps) {
  const [loading, setLoading] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [formSeguimiento, setFormSeguimiento] = useState({
    estado: 'Contactado',
    notas: '',
    fecha_proximo_seguimiento: '',
  });

  // Verificar directamente a Supabase
  const verificarGoogleDirecto = async () => {
    try {
      console.log('🔍 [SEGUIMIENTOS] Verificando Google en Supabase...');

      const { data, error } = await supabase
        .from('google_config')
        .select('id, access_token, email')
        .eq('id', 1)
        .single();

      if (error) {
        console.log('❌ [SEGUIMIENTOS] Error en lectura:', error.code, error.message);
        setGoogleConnected(false);
        return false;
      }

      if (!data) {
        console.log('⚠️ [SEGUIMIENTOS] Sin datos en google_config');
        setGoogleConnected(false);
        return false;
      }

      if (data.access_token && data.email) {
        console.log('✅ [SEGUIMIENTOS] Google conectado:', data.email);
        setGoogleConnected(true);
        return true;
      }

      console.log('⚠️ [SEGUIMIENTOS] Token incompleto');
      setGoogleConnected(false);
      return false;
    } catch (err) {
      console.error('💥 [SEGUIMIENTOS] Error crítico:', err);
      setGoogleConnected(false);
      return false;
    }
  };

  // Verificar si está conectado a Google
  useEffect(() => {
    console.log('[SEGUIMIENTOS] Inicializando...');
    setGoogleConnected(false); // Iniciar como desconectado

    // Verificación inicial
    const checkConnection = async () => {
      const connected = await verificarGoogleDirecto();
      console.log('[SEGUIMIENTOS] Resultado verificación:', connected);
    };

    checkConnection();

    // Verificar cada 1 segundo (no 500ms, para no saturar)
    const interval = setInterval(() => {
      verificarGoogleDirecto();
    }, 1000);

    // Limpiar parámetros de la URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected') === 'true') {
      console.log('Limpiando parámetro google_connected de la URL');
      window.history.replaceState({}, '', window.location.pathname + '?seccion=seguimientos');
    }

    return () => {
      clearInterval(interval);
      console.log('[SEGUIMIENTOS] Limpiando intervalos');
    };
  }, []);

  const handleAgregarSeguimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteSeleccionado) {
      alert('Selecciona un cliente primero');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('seguimientos').insert({
        cliente_id: clienteSeleccionado.id,
        estado: formSeguimiento.estado,
        notas: formSeguimiento.notas,
        fecha_proximo_seguimiento: formSeguimiento.fecha_proximo_seguimiento || null,
      });

      if (error) throw error;

      // Si está conectado a Google, crear evento automáticamente
      if (googleConnected && formSeguimiento.fecha_proximo_seguimiento) {
        try {
          const response = await fetch('/api/google/create-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clienteName: clienteSeleccionado.nombre,
              cups: clienteSeleccionado.cups,
              estado: formSeguimiento.estado,
              notas: formSeguimiento.notas,
              fecha: formSeguimiento.fecha_proximo_seguimiento,
            }),
          });

          if (response.ok) {
            alert('✅ Seguimiento agregado y evento creado en Google Calendar');
          } else {
            alert('✅ Seguimiento agregado (Google Calendar: fallo)');
          }
        } catch (calError) {
          alert('✅ Seguimiento agregado (Google Calendar: error)');
        }
      } else {
        alert('Seguimiento agregado' + (googleConnected ? '' : '. Conecta Google Calendar para crear eventos automáticamente'));
      }

      setFormSeguimiento({
        estado: 'Contactado',
        notas: '',
        fecha_proximo_seguimiento: '',
      });
      await cargarSeguimientos(clienteSeleccionado.id);
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + (error as any).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCrearEventoGoogle = async (seguimiento: any) => {
    if (!clienteSeleccionado) return;

    const clienteNombre = clienteSeleccionado.nombre;
    const cups = clienteSeleccionado.cups;
    const fecha = new Date(seguimiento.fecha_proximo_seguimiento);
    const evento = `Seguimiento - ${clienteNombre} (${cups})`;
    const descripcion = `Estado: ${seguimiento.estado}\nNotas: ${seguimiento.notas}`;

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: evento,
      details: descripcion,
      dates: `${fecha.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    });

    const googleCalendarUrl = `https://calendar.google.com/calendar/u/0/r/eventedit?${params}`;
    window.open(googleCalendarUrl, '_blank');
  };

  const handleEliminarSeguimiento = async (id: number) => {
    if (!confirm('¿Eliminar este seguimiento?')) return;

    try {
      const { error } = await supabase.from('seguimientos').delete().eq('id', id);
      if (error) throw error;
      if (clienteSeleccionado) {
        await cargarSeguimientos(clienteSeleccionado.id);
      }
    } catch (error) {
      alert('Error: ' + (error as any).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Estado Google Calendar */}
      <div className="card rounded-2xl p-6 md:p-8 border-2">
        <div className="flex items-center justify-between">
          <div>
            {googleConnected ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">✅</span>
                  <h3 className="font-semibold text-green-400">Google Calendar Conectado</h3>
                </div>
                <p className="text-sm text-muted">Los seguimientos crearán eventos automáticamente</p>
              </>
            ) : (
              <>
                <h3 className="font-semibold text-foreground mb-1">Conectar Google Calendar</h3>
                <p className="text-sm text-muted">Crear eventos automáticamente en tu calendario</p>
              </>
            )}
          </div>

          {!googleConnected ? (
            <button
              onClick={() => {
                console.log('🔗 [SEGUIMIENTOS] Iniciando conexión a Google...');
                window.location.href = '/api/google/auth';
              }}
              className="px-6 py-2 rounded-lg bg-accent text-white font-semibold hover:bg-accent/90 transition whitespace-nowrap"
            >
              🔗 Conectar
            </button>
          ) : (
            <div className="px-6 py-2 rounded-lg bg-card/80 border border-border text-muted font-semibold whitespace-nowrap">
              ✅ Conectado
            </div>
          )}
        </div>
      </div>

      {/* Seleccionar cliente */}
      <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
        <h2 className="mb-4 text-xl font-bold text-foreground">👥 Seleccionar Cliente</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <select
            value={clienteSeleccionado?.id || ''}
            onChange={(e) => {
              const cliente = clientes.find((c) => c.id === parseInt(e.target.value));
              if (cliente) {
                setClienteSeleccionado(cliente);
                cargarSeguimientos(cliente.id);
              }
            }}
            className="rounded-lg border border-border bg-card px-4 py-3 text-foreground font-medium focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
          >
            <option value="">-- Selecciona un cliente --</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} ({c.cups})
              </option>
            ))}
          </select>

          {clienteSeleccionado && (
            <div className="rounded-lg bg-gradient-to-r from-accent/20 to-accent/10 p-4 border border-accent/40">
              <p className="text-xs uppercase tracking-widest text-accent font-bold mb-1">Cliente seleccionado</p>
              <p className="font-bold text-foreground text-lg">{clienteSeleccionado.nombre}</p>
              <p className="text-sm text-muted mt-1">{clienteSeleccionado.tarifa} • {clienteSeleccionado.cups}</p>
            </div>
          )}
        </div>
      </div>

      {clienteSeleccionado && (
        <>
          {/* Agregar seguimiento */}
          <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
            <h3 className="mb-6 text-lg font-bold text-foreground">📝 Nuevo Seguimiento</h3>

            <form onSubmit={handleAgregarSeguimiento} className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-bold text-foreground mb-2 uppercase tracking-widest">
                    Estado
                  </label>
                  <select
                    value={formSeguimiento.estado}
                    onChange={(e) =>
                      setFormSeguimiento({ ...formSeguimiento, estado: e.target.value })
                    }
                    className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground font-medium focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
                  >
                    <option value="Contactado">🔵 Contactado</option>
                    <option value="Interesado">🟡 Interesado</option>
                    <option value="Contratado">🟢 Contratado</option>
                    <option value="Cancelado">🔴 Cancelado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-foreground mb-2 uppercase tracking-widest">
                    Próximo Seguimiento
                  </label>
                  <input
                    type="datetime-local"
                    value={formSeguimiento.fecha_proximo_seguimiento}
                    onChange={(e) =>
                      setFormSeguimiento({
                        ...formSeguimiento,
                        fecha_proximo_seguimiento: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground font-medium focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-foreground mb-2 uppercase tracking-widest">
                  Notas
                </label>
                <textarea
                  value={formSeguimiento.notas}
                  onChange={(e) =>
                    setFormSeguimiento({ ...formSeguimiento, notas: e.target.value })
                  }
                  placeholder="Escribe las notas del seguimiento..."
                  rows={3}
                  className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder-muted/50 font-medium focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gradient-to-r from-accent to-accent-light text-white font-bold py-3 hover:shadow-glow transition disabled:opacity-50"
              >
                {loading ? '⏳ Guardando...' : '➕ Agregar Seguimiento'}
              </button>
            </form>
          </div>

          {/* Historial de seguimientos */}
          <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
            <h3 className="mb-6 font-bold text-foreground text-lg">
              📋 Historial ({seguimientos.length})
            </h3>

            {seguimientos.length === 0 ? (
              <div className="text-center py-12 rounded-xl bg-card/30 border border-border">
                <p className="text-muted">Sin seguimientos aún</p>
                <p className="text-xs text-muted/50 mt-2">Agrega el primer seguimiento arriba</p>
              </div>
            ) : (
              <div className="space-y-3">
                {seguimientos.map((seg) => (
                  <div
                    key={seg.id}
                    className="border border-border rounded-lg p-4 bg-card/50 hover:bg-card hover:border-accent/50 transition"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest border ${
                          seg.estado === 'Contactado'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            : seg.estado === 'Interesado'
                            ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                            : seg.estado === 'Contratado'
                            ? 'bg-green-500/20 text-green-300 border-green-500/40'
                            : 'bg-red-500/20 text-red-300 border-red-500/40'
                        }`}>
                          {seg.estado === 'Contactado' && '🔵'}
                          {seg.estado === 'Interesado' && '🟡'}
                          {seg.estado === 'Contratado' && '🟢'}
                          {seg.estado === 'Cancelado' && '🔴'}
                          {' '}{seg.estado}
                        </span>
                        <span className="text-xs text-muted/70 font-medium">
                          {new Date(seg.created_at).toLocaleDateString('es', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <button
                        onClick={() => handleEliminarSeguimiento(seg.id)}
                        className="px-3 py-1 rounded-lg text-xs font-bold text-red-400 hover:bg-red-500/20 hover:text-red-300 border border-red-500/30 transition"
                      >
                        🗑️
                      </button>
                    </div>

                    {seg.notas && (
                      <div className="p-3 rounded-lg bg-card/80 border border-border mb-3">
                        <p className="text-sm text-foreground leading-relaxed">{seg.notas}</p>
                      </div>
                    )}

                    {seg.fecha_proximo_seguimiento && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-accent/10 border border-accent/20">
                        <p className="text-xs text-accent font-bold uppercase tracking-widest">
                          📅 {new Date(seg.fecha_proximo_seguimiento).toLocaleDateString('es')}
                        </p>
                        <button
                          onClick={() => handleCrearEventoGoogle(seg)}
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-accent/20 text-accent hover:bg-accent/30 border border-accent/40 transition"
                        >
                          📆 Google Calendar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
