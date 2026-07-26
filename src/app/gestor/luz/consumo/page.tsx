'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity, AlertTriangle, ArrowRight, CheckCircle2, Download, Loader, RefreshCw, ShieldQuestion,
} from 'lucide-react';
import { tokenSesion } from '@/lib/usuario';
import { Badge, Card, Kpi, btnPrimario, btnSecundario } from '../ui';

/**
 * CONSUMO REAL — la pantalla que convierte Datadis en euros.
 *
 * Una sola pregunta: ¿a quién le sobra potencia contratada?
 *
 * No es un panel de gráficas. El orden es por dinero encontrado, porque de eso
 * salen las llamadas de mañana. Y lo primero que se ve no es un gráfico: es
 * cuántos clientes todavía no nos han autorizado en Datadis, que es lo único
 * que hay que resolver para que el resto exista.
 */

interface FilaConsumo {
  cups_id: string;
  cups: string;
  alias: string | null;
  tarifa: string | null;
  cliente_id: string | null;
  cliente: string | null;
  nif: string | null;
  autorizado: boolean;
  autorizacion_comprobada_en: string | null;
  listo_para_sincronizar: boolean;
  ultima_sync: string | null;
  ahorro_anual: number | null;
  penalizacion_estimada: number | null;
  confianza: 'alta' | 'media' | 'baja' | null;
  pct_horas_solares: number | null;
  analizado_en: string | null;
}

interface Resumen {
  cups_total: number; autorizados: number; listos: number;
  analizados: number; con_ahorro: number; ahorro_detectado: number;
}

type Vista = 'dinero' | 'sin_permiso' | 'sin_datos' | 'todos';

const eur = (n: number) => `${Math.round(n).toLocaleString('es-ES')} €`;
const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '—';

const TONO_CONFIANZA: Record<string, 'verde' | 'ambar' | 'rojo'> = {
  alta: 'verde', media: 'ambar', baja: 'rojo',
};

export default function ConsumoPage() {
  const [filas, setFilas] = useState<FilaConsumo[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [faltaMigracion, setFaltaMigracion] = useState(false);
  const [vista, setVista] = useState<Vista>('dinero');
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [recado, setRecado] = useState<{ texto: string; mal: boolean } | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const token = await tokenSesion();
      const res = await fetch('/api/luz/datadis', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) {
        setFaltaMigracion(!!json.falta_migracion);
        setError(json.error || 'No se ha podido cargar.');
        return;
      }
      setFaltaMigracion(false);
      setFilas(json.datos || []);
      setResumen(json.resumen || null);
    } catch {
      setError('Error de conexión.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  /** Llama a la API y refresca. Devuelve el mensaje para enseñarlo arriba. */
  const accion = async (cuerpo: Record<string, unknown>, clave: string) => {
    setTrabajando(clave);
    setRecado(null);
    try {
      const token = await tokenSesion();
      const res = await fetch('/api/luz/datadis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(cuerpo),
      });
      const json = await res.json();
      setRecado({ texto: json.mensaje || json.error || 'Hecho.', mal: !res.ok || json.ok === false });
      if (res.ok) await cargar();
    } catch {
      setRecado({ texto: 'Error de conexión con Datadis.', mal: true });
    } finally {
      setTrabajando(null);
    }
  };

  // Un cliente puede tener varios CUPS: la autorización se comprueba una vez
  // por cliente, no una por suministro.
  const clientesSinComprobar = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const f of filas) {
      if (f.cliente_id && !f.autorizado && !vistos.has(f.cliente_id)) {
        vistos.set(f.cliente_id, f.cliente || f.cups);
      }
    }
    return [...vistos.entries()].map(([id, nombre]) => ({ id, nombre }));
  }, [filas]);

  const visibles = useMemo(() => {
    const orden = (a: FilaConsumo, b: FilaConsumo) => (b.ahorro_anual ?? -1) - (a.ahorro_anual ?? -1);
    if (vista === 'dinero') return filas.filter((f) => (f.ahorro_anual ?? 0) > 0).sort(orden);
    if (vista === 'sin_permiso') return filas.filter((f) => !f.autorizado).sort(orden);
    if (vista === 'sin_datos') return filas.filter((f) => f.autorizado && !f.ultima_sync).sort(orden);
    return [...filas].sort(orden);
  }, [filas, vista]);

  const PESTANAS: { clave: Vista; texto: string; cuantos: number }[] = [
    { clave: 'dinero', texto: 'Con ahorro detectado', cuantos: filas.filter((f) => (f.ahorro_anual ?? 0) > 0).length },
    { clave: 'sin_permiso', texto: 'Sin autorización', cuantos: filas.filter((f) => !f.autorizado).length },
    { clave: 'sin_datos', texto: 'Autorizados sin datos', cuantos: filas.filter((f) => f.autorizado && !f.ultima_sync).length },
    { clave: 'todos', texto: 'Todos', cuantos: filas.length },
  ];

  if (faltaMigracion) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="font-bold text-foreground">Falta la parte de Datadis en la base de datos</p>
            <p className="text-sm text-muted">
              Ejecuta <code className="px-1.5 py-0.5 rounded bg-card/80 text-accent">supabase_datadis.sql</code> en
              el SQL Editor de Supabase. Se puede repetir sin peligro.
            </p>
            <button type="button" onClick={cargar} className={btnSecundario}>
              <RefreshCw className="w-4 h-4" /> Volver a comprobar
            </button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-black flex items-center gap-2.5">
          <Activity className="w-7 h-7 text-accent" /> Consumo real
        </h1>
        <p className="text-sm text-muted mt-1">
          La curva horaria y el maxímetro que dan las distribuidoras por Datadis, gratis y sin instalar nada.
          Con eso, la potencia contratada deja de ser lo que puso alguien en la factura y pasa a ser un cálculo.
        </p>
      </div>

      {recado && (
        <Card className={recado.mal ? '!border-red-500/40' : '!border-emerald-500/40'}>
          <div className="flex items-start gap-2.5">
            {recado.mal
              ? <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              : <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
            <p className="text-sm text-foreground">{recado.texto}</p>
          </div>
        </Card>
      )}

      {resumen && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi
            valor={eur(resumen.ahorro_detectado)}
            etiqueta="ahorro/año encontrado"
            color={resumen.ahorro_detectado > 0 ? 'text-emerald-400' : 'text-muted'}
          />
          <Kpi valor={`${resumen.con_ahorro}/${resumen.analizados}`} etiqueta="con ahorro / analizados" />
          <Kpi
            valor={`${resumen.autorizados}/${resumen.cups_total}`}
            etiqueta="suministros autorizados"
            color={resumen.autorizados < resumen.cups_total ? 'text-amber-400' : 'text-emerald-400'}
          />
          <Kpi valor={resumen.listos} etiqueta="listos para sincronizar" />
        </div>
      )}

      {/* El cuello de botella no es técnico: es el permiso del titular. Va arriba. */}
      {clientesSinComprobar.length > 0 && (
        <Card>
          <div className="flex items-start gap-3">
            <ShieldQuestion className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-2.5 min-w-0 flex-1">
              <div>
                <p className="font-bold text-foreground">
                  {clientesSinComprobar.length} cliente(s) sin autorización comprobada
                </p>
                <p className="text-sm text-muted mt-0.5">
                  Datadis no deja leer el consumo de nadie sin que el titular autorice nuestro NIF desde su
                  propia cuenta en datadis.es. No hay atajo por API: el permiso lo da él. Aquí solo se comprueba
                  si ya lo dio.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {clientesSinComprobar.slice(0, 12).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={trabajando !== null}
                    onClick={() => accion({ accion: 'comprobar', cliente_id: c.id }, `cli-${c.id}`)}
                    className={`${btnSecundario} !py-1.5 !text-xs`}
                  >
                    {trabajando === `cli-${c.id}`
                      ? <Loader className="w-3.5 h-3.5 animate-spin" />
                      : <ShieldQuestion className="w-3.5 h-3.5" />}
                    {c.nombre}
                  </button>
                ))}
                {clientesSinComprobar.length > 12 && (
                  <span className="text-xs text-muted self-center">
                    y {clientesSinComprobar.length - 12} más
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-1.5">
        {PESTANAS.map((p) => (
          <button
            key={p.clave}
            type="button"
            onClick={() => setVista(p.clave)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
              vista === p.clave
                ? 'bg-accent text-white border-accent'
                : 'bg-card/60 text-muted border-border/40 hover:text-foreground'
            }`}
          >
            {p.texto} <span className="tabular-nums opacity-70">({p.cuantos})</span>
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="text-center py-10 text-muted text-sm">
          <Loader className="w-5 h-5 mx-auto mb-2 animate-spin" /> Cargando la cartera...
        </div>
      ) : error ? (
        <Card className="!border-red-500/40">
          <p className="text-sm text-red-400">{error}</p>
        </Card>
      ) : visibles.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            {vista === 'dinero'
              ? 'Todavía no hay ahorro detectado. Comprueba autorizaciones, sincroniza un CUPS y entra en su ficha para analizarlo.'
              : 'Nada en esta vista.'}
          </p>
        </Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-card/40">
                  {['Cliente', 'Suministro', 'Tarifa', 'Datadis', 'Última sync', 'Ahorro/año', 'Confianza', ''].map((t) => (
                    <th key={t} className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-muted whitespace-nowrap">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => (
                  <tr key={f.cups_id} className="border-b border-border/20 hover:bg-card/40 transition">
                    <td className="px-3 py-2.5">
                      <span className="font-semibold text-foreground">{f.cliente || '—'}</span>
                      {f.nif && <span className="block text-[11px] text-muted tabular-nums">{f.nif}</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block text-[11px] font-mono text-muted">{f.cups}</span>
                      {f.alias && <span className="block text-[11px] text-foreground">{f.alias}</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted text-xs">{f.tarifa || '—'}</td>
                    <td className="px-3 py-2.5">
                      {!f.autorizado ? (
                        <Badge tono="rojo">sin autorización</Badge>
                      ) : !f.listo_para_sincronizar ? (
                        <Badge tono="ambar">sin enganchar</Badge>
                      ) : (
                        <Badge tono="verde">autorizado</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted tabular-nums whitespace-nowrap">
                      {fechaCorta(f.ultima_sync)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {f.ahorro_anual == null ? (
                        <span className="text-muted text-xs">sin analizar</span>
                      ) : (
                        <span className={`font-black tabular-nums ${f.ahorro_anual > 0 ? 'text-emerald-400' : 'text-muted'}`}>
                          {eur(f.ahorro_anual)}
                        </span>
                      )}
                      {(f.penalizacion_estimada ?? 0) > 0 && (
                        <span className="block text-[11px] text-red-400 tabular-nums">
                          +{eur(f.penalizacion_estimada!)} en excesos
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {f.confianza
                        ? <Badge tono={TONO_CONFIANZA[f.confianza]}>{f.confianza}</Badge>
                        : <span className="text-muted text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 justify-end">
                        {f.listo_para_sincronizar && (
                          <button
                            type="button"
                            disabled={trabajando !== null}
                            title="Traer 12 meses de maxímetro y curva de Datadis"
                            onClick={() => accion({ accion: 'sincronizar', cups_id: f.cups_id, meses: 12 }, f.cups_id)}
                            className={`${btnSecundario} !px-2 !py-1.5`}
                          >
                            {trabajando === f.cups_id
                              ? <Loader className="w-3.5 h-3.5 animate-spin" />
                              : <Download className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <Link
                          href={`/gestor/luz/consumo/${encodeURIComponent(f.cups)}`}
                          className={`${btnPrimario} !px-2.5 !py-1.5 !text-xs`}
                        >
                          Ver <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <p className="text-[11px] text-muted leading-relaxed">
          <strong className="text-foreground">Sobre las cifras.</strong> El ahorro en kW sale del maxímetro de la
          distribuidora y es sólido. El ahorro en € usa los precios regulados del término de potencia, que están
          en <code className="px-1 rounded bg-card/80">potencia.ts</code> como valores de referencia y{' '}
          <strong className="text-amber-400">todavía sin validar contra una factura de 2026</strong>: se pueden
          revisar sin tocar código desde la clave <code className="px-1 rounded bg-card/80">precios_potencia_kw_anio</code>{' '}
          de la configuración. La penalización por excesos es una <strong className="text-foreground">cota
          inferior</strong>: se cobra por cada cuarto de hora y el maxímetro solo enseña un máximo por mes.
        </p>
      </Card>
    </div>
  );
}
