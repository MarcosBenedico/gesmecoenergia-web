'use client';

import { useEffect, useState } from 'react';
import { Save, Loader } from 'lucide-react';
import { ROL_LABEL } from '@/lib/correbin';
import { Card, EstadoCarga, useListaLuz, guardarLuz, inputCls, labelCls, btnPrimario } from '../ui';

interface Config { clave: string; valor: string }
interface Responsable { id: string; nombre: string; rol: string; activo: boolean }

const CAMPOS: { clave: string; nombre: string; tipo: 'numero' | 'texto' }[] = [
  { clave: 'objetivo_mensual_contratos', nombre: 'Objetivo mensual de contratos activados', tipo: 'numero' },
  { clave: 'objetivo_mensual_comision', nombre: 'Objetivo mensual de comisión (€)', tipo: 'numero' },
  { clave: 'dias_alerta_cliente_a', nombre: 'Días para alerta de cliente A sin acción', tipo: 'numero' },
  { clave: 'dias_contrato_sin_firma', nombre: 'Días para alerta de contrato enviado sin firma', tipo: 'numero' },
  { clave: 'dias_firmado_sin_activar', nombre: 'Días para alerta de contrato firmado sin activar', tipo: 'numero' },
  { clave: 'consumo_prioridad_a_kwh', nombre: 'Consumo anual para prioridad A automática (kWh)', tipo: 'numero' },
  { clave: 'consumo_prioridad_b_kwh', nombre: 'Consumo anual para prioridad B automática (kWh)', tipo: 'numero' },
  { clave: 'comercializadoras', nombre: 'Comercializadoras disponibles (separadas por coma)', tipo: 'texto' },
];

export default function ConfiguracionLuz() {
  const config = useListaLuz<Config>('config');
  const responsables = useListaLuz<Responsable>('responsables');
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');
  const [nuevoResp, setNuevoResp] = useState('');
  const [nuevoRol, setNuevoRol] = useState('renovaciones');

  useEffect(() => {
    if (config.datos.length) {
      setValores(Object.fromEntries(config.datos.map((c) => [c.clave, c.valor])));
    }
  }, [config.datos]);

  async function guardarTodo() {
    setGuardando(true);
    for (const campo of CAMPOS) {
      if (valores[campo.clave] != null) {
        await guardarLuz('config', 'PUT', { clave: campo.clave, valor: valores[campo.clave] });
      }
    }
    setGuardando(false);
    setMsg('✓ Configuración guardada.');
    config.recargar();
  }

  async function crearResponsable() {
    if (!nuevoResp.trim()) return;
    const err = await guardarLuz('responsables', 'POST', { nombre: nuevoResp.trim(), rol: nuevoRol });
    if (!err) { setNuevoResp(''); responsables.recargar(); }
    else setMsg(err);
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-xl font-black text-foreground">Configuración</h2>
        <p className="text-xs text-muted mt-0.5">Objetivos, umbrales de alerta y responsables (compartidos con el módulo Correbin).</p>
      </div>

      <EstadoCarga cargando={config.cargando} error={config.error} faltaMigracion={config.faltaMigracion} vacio={false} textoVacio="" sqlFile="supabase_luz.sql" />

      {!config.cargando && !config.faltaMigracion && (
        <>
          <Card className="space-y-3">
            <h3 className="font-bold text-sm">Parámetros</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {CAMPOS.map((c) => (
                <div key={c.clave} className={c.tipo === 'texto' ? 'md:col-span-2' : ''}>
                  <label className={labelCls}>{c.nombre}</label>
                  <input
                    className={inputCls}
                    type={c.tipo === 'numero' ? 'number' : 'text'}
                    value={valores[c.clave] ?? ''}
                    onChange={(e) => setValores((v) => ({ ...v, [c.clave]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            {msg && <p className="text-xs text-emerald-400">{msg}</p>}
            <button onClick={guardarTodo} disabled={guardando} className={btnPrimario}>
              {guardando ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar configuración
            </button>
          </Card>

          <Card className="space-y-3">
            <h3 className="font-bold text-sm">Responsables y roles</h3>
            <p className="text-[11px] text-muted">
              Estructura preparada para permisos: Dirección ve y edita todo; Administración importa, corrige y exporta;
              cada usuario verá sus tareas y vencimientos cuando haya login multiusuario. Los borrados críticos ya piden confirmación.
            </p>
            <div className="space-y-1.5">
              {responsables.datos.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-card/60 text-sm">
                  <span className="font-semibold">{r.nombre}</span>
                  <span className="text-xs text-muted">{ROL_LABEL[r.rol] || r.rol}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <input className={`${inputCls} flex-1 min-w-40`} value={nuevoResp} onChange={(e) => setNuevoResp(e.target.value)} placeholder="Nombre del responsable" />
              <select className={inputCls + ' !w-auto'} value={nuevoRol} onChange={(e) => setNuevoRol(e.target.value)}>
                {Object.entries(ROL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button onClick={crearResponsable} className={btnPrimario}>Añadir</button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
