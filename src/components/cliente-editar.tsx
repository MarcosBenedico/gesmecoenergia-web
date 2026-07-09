'use client';

import { useState } from 'react';
import { TARIFA_INFO, TarifaAcceso } from '@/lib/tarifas';
import { X, Loader, Save, Trash2 } from 'lucide-react';

/**
 * Formularios de autogestión del cliente:
 * - FormSuministro: crear o editar un suministro (CUPS obligatorio, precios opcionales).
 * - FormConsumoMes: añadir o corregir el consumo (y precios) de un mes.
 */

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const inputCls =
  'w-full px-3 py-2.5 rounded-lg border border-border/40 bg-background/60 text-sm tabular-nums';
const labelCls = 'text-xs font-semibold text-muted block mb-1';

function ListaNumeros({
  titulo, labels, valores, onChange, placeholder,
}: {
  titulo: string;
  labels: string[];
  valores: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <p className={labelCls}>{titulo}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {labels.map((label, i) => (
          <div key={label}>
            <p className="text-[10px] text-muted text-center mb-0.5">{label}</p>
            <input
              type="number"
              step="any"
              min="0"
              inputMode="decimal"
              value={valores[i] ?? ''}
              placeholder={placeholder || '0'}
              onChange={(e) => {
                const nuevo = [...valores];
                nuevo[i] = e.target.value;
                onChange(nuevo);
              }}
              className={`${inputCls} text-center !px-1`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const aNumeros = (v: string[]): number[] => v.map((s) => parseFloat(s) || 0);
const aTexto = (v: number[] | undefined, n: number): string[] =>
  Array.from({ length: n }, (_, i) => (v?.[i] != null && v[i] !== 0 ? String(v[i]) : ''));

// ─────────────────────────────────────────────────────────────
// FORMULARIO DE SUMINISTRO (crear / editar)
// ─────────────────────────────────────────────────────────────

export interface SuministroEditable {
  id?: string;
  cups?: string;
  alias?: string | null;
  direccion?: string | null;
  tarifa?: TarifaAcceso;
  precios_energia?: number[];
  precios_potencia?: number[];
  potencias_kw?: number[];
}

export function FormSuministro({
  token, suministro, onGuardado, onCancelar,
}: {
  token: string;
  suministro?: SuministroEditable;
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const editando = !!suministro?.id;
  const [cups, setCups] = useState(suministro?.cups || '');
  const [alias, setAlias] = useState(suministro?.alias || '');
  const [direccion, setDireccion] = useState(suministro?.direccion || '');
  const [tarifa, setTarifa] = useState<TarifaAcceso>(suministro?.tarifa || '2.0');
  const info = TARIFA_INFO[tarifa];

  const [pEnergia, setPEnergia] = useState<string[]>(
    aTexto(suministro?.precios_energia, info.periodosEnergia.length)
  );
  const [pPotencia, setPPotencia] = useState<string[]>(
    aTexto(suministro?.precios_potencia, info.periodosPotencia.length)
  );
  const [potencias, setPotencias] = useState<string[]>(
    aTexto(suministro?.potencias_kw, info.periodosPotencia.length)
  );
  const [verOpcional, setVerOpcional] = useState(editando);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  function cambiarTarifa(t: TarifaAcceso) {
    setTarifa(t);
    const ni = TARIFA_INFO[t];
    setPEnergia((v) => aTexto(aNumeros(v), ni.periodosEnergia.length));
    setPPotencia((v) => aTexto(aNumeros(v), ni.periodosPotencia.length));
    setPotencias((v) => aTexto(aNumeros(v), ni.periodosPotencia.length));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (cups.trim().length < 6) {
      setError('Introduce el código CUPS de tu factura (empieza por ES...).');
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        token,
        ...(editando ? { id: suministro!.id } : {}),
        cups: cups.trim(),
        alias: alias.trim() || null,
        direccion: direccion.trim() || null,
        tarifa,
        precios_energia: aNumeros(pEnergia),
        precios_potencia: aNumeros(pPotencia),
        potencias_kw: aNumeros(potencias),
      };
      const res = await fetch('/api/cliente/suministros', {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'No se pudo guardar.'); return; }
      onGuardado();
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="bg-secondary/40 rounded-xl p-4 space-y-3.5 border border-accent/20">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm">
          {editando ? 'Modificar suministro' : 'Añadir suministro'}
        </h3>
        <button type="button" onClick={onCancelar} className="p-1 rounded hover:bg-card text-muted">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div>
        <label className={labelCls}>Código CUPS * <span className="font-normal">(en tu factura, empieza por ES)</span></label>
        <input
          type="text"
          value={cups}
          onChange={(e) => setCups(e.target.value)}
          placeholder="ES0031XXXXXXXXXXXXXX"
          autoCapitalize="characters"
          className={`${inputCls} font-mono uppercase`}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Nombre identificativo</label>
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Casa, Nave, Local..."
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Tarifa</label>
          <select value={tarifa} onChange={(e) => cambiarTarifa(e.target.value as TarifaAcceso)} className={inputCls}>
            {(Object.keys(TARIFA_INFO) as TarifaAcceso[]).map((t) => (
              <option key={t} value={t}>{TARIFA_INFO[t].nombre} · {TARIFA_INFO[t].descripcion}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Dirección (opcional)</label>
        <input
          type="text"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          placeholder="Calle, número, población"
          className={inputCls}
        />
      </div>

      {!verOpcional ? (
        <button
          type="button"
          onClick={() => setVerOpcional(true)}
          className="text-xs font-semibold text-accent hover:underline"
        >
          + Añadir precios y potencia contratada (opcional)
        </button>
      ) : (
        <div className="space-y-3 rounded-lg bg-background/40 p-3 border border-border/30">
          <p className="text-[11px] text-muted">
            Estos datos están en tu factura. Si no los tienes a mano, déjalos vacíos: los completaremos nosotros.
          </p>
          <ListaNumeros
            titulo="Precio energía (€/kWh)"
            labels={info.periodosEnergia}
            valores={pEnergia}
            onChange={setPEnergia}
            placeholder="0.15"
          />
          <ListaNumeros
            titulo="Precio potencia (€/kW·día)"
            labels={info.periodosPotencia}
            valores={pPotencia}
            onChange={setPPotencia}
            placeholder="0.07"
          />
          <ListaNumeros
            titulo="Potencia contratada (kW)"
            labels={info.periodosPotencia}
            valores={potencias}
            onChange={setPotencias}
            placeholder="4.6"
          />
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">{error}</p>
      )}

      <button
        type="submit"
        disabled={guardando}
        className="w-full py-2.5 bg-accent text-white rounded-lg text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {guardando ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {editando ? 'Guardar cambios' : 'Añadir suministro'}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// FORMULARIO DE CONSUMO MENSUAL (añadir / corregir)
// ─────────────────────────────────────────────────────────────

export function FormConsumoMes({
  token, suministroId, tarifa, preciosContrato, consumoExistente, onGuardado, onCancelar,
}: {
  token: string;
  suministroId: string;
  tarifa: TarifaAcceso;
  preciosContrato: number[];
  consumoExistente?: {
    id?: string;
    anio: number;
    mes: number;
    consumos_kwh: number[];
    precios_energia: number[] | null;
    notas: string | null;
  };
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const editando = !!consumoExistente;
  const info = TARIFA_INFO[tarifa];
  const nE = info.periodosEnergia.length;
  const hoy = new Date();

  const [anio, setAnio] = useState(consumoExistente?.anio || hoy.getFullYear());
  const [mes, setMes] = useState(consumoExistente?.mes || hoy.getMonth() + 1);
  const [consumos, setConsumos] = useState<string[]>(
    aTexto(consumoExistente?.consumos_kwh, nE)
  );
  const [editarPrecios, setEditarPrecios] = useState(
    !!consumoExistente?.precios_energia?.some((p, i) => p !== (preciosContrato[i] || 0))
  );
  const [precios, setPrecios] = useState<string[]>(
    aTexto(consumoExistente?.precios_energia || preciosContrato, nE)
  );
  const [notas, setNotas] = useState(consumoExistente?.notas || '');
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState('');

  const anios = Array.from({ length: 6 }, (_, i) => hoy.getFullYear() - 4 + i);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (aNumeros(consumos).every((c) => c === 0)) {
      setError('Introduce al menos un consumo en kWh.');
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch('/api/cliente/consumos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          suministro_id: suministroId,
          anio,
          mes,
          consumos_kwh: aNumeros(consumos),
          precios_energia: editarPrecios ? aNumeros(precios) : undefined,
          notas: notas.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'No se pudo guardar.'); return; }
      onGuardado();
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!consumoExistente?.id) return;
    if (!confirm(`¿Borrar el consumo de ${MESES[mes - 1]} ${anio}?`)) return;
    setBorrando(true);
    try {
      const res = await fetch('/api/cliente/consumos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, id: consumoExistente.id }),
      });
      if (res.ok) onGuardado();
      else setError('No se pudo borrar.');
    } catch {
      setError('Error de conexión.');
    } finally {
      setBorrando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="bg-secondary/40 rounded-xl p-4 space-y-3.5 border border-accent/20">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm">
          {editando ? `Corregir ${MESES[mes - 1]} ${anio}` : 'Añadir consumo de un mes'}
        </h3>
        <button type="button" onClick={onCancelar} className="p-1 rounded hover:bg-card text-muted">
          <X className="w-4 h-4" />
        </button>
      </div>

      {!editando && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Mes</label>
            <select value={mes} onChange={(e) => setMes(parseInt(e.target.value))} className={inputCls}>
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Año</label>
            <select value={anio} onChange={(e) => setAnio(parseInt(e.target.value))} className={inputCls}>
              {anios.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <ListaNumeros
        titulo="Consumo del mes (kWh) por periodo"
        labels={info.periodosEnergia}
        valores={consumos}
        onChange={setConsumos}
        placeholder="0"
      />

      <label className="flex items-center gap-2 text-xs font-semibold text-muted cursor-pointer">
        <input
          type="checkbox"
          checked={editarPrecios}
          onChange={(e) => setEditarPrecios(e.target.checked)}
          className="accent-[var(--accent,#ff3333)]"
        />
        Este mes pagué un precio distinto al de mi contrato
      </label>

      {editarPrecios && (
        <ListaNumeros
          titulo="Precio energía de este mes (€/kWh)"
          labels={info.periodosEnergia}
          valores={precios}
          onChange={setPrecios}
          placeholder="0.15"
        />
      )}

      <div>
        <label className={labelCls}>Notas (opcional)</label>
        <input
          type="text"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Ej: dato sacado de la factura de Endesa"
          className={inputCls}
        />
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={guardando || borrando}
          className="flex-1 py-2.5 bg-accent text-white rounded-lg text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {guardando ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar
        </button>
        {editando && consumoExistente?.id && (
          <button
            type="button"
            onClick={borrar}
            disabled={guardando || borrando}
            className="px-3.5 py-2.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            title="Borrar este mes"
          >
            {borrando ? <Loader className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        )}
      </div>
    </form>
  );
}
