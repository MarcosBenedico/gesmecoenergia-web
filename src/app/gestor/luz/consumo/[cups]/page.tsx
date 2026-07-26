'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Download, Info, Loader, Save, Sun, Zap,
} from 'lucide-react';
import { tokenSesion, useUsuario } from '@/lib/usuario';
import { Badge, Card, btnPrimario, btnSecundario } from '../../ui';

/**
 * FICHA DE CONSUMO DE UN SUMINISTRO.
 *
 * Lo que se responde aquí, por orden de lo que vale dinero:
 *
 *   1. ¿Cuántos kW paga y no usa? — la tabla de arriba, periodo a periodo.
 *   2. ¿Se está pasando y pagando penalización? — el mismo sitio, en rojo.
 *   3. ¿Está en la tarifa que le toca? — el aviso de cambio de tarifa.
 *   4. ¿Cuándo consume? — el perfil horario, que además es lo que la FV
 *      necesitaba para dejar de suponer el autoconsumo.
 *   5. ¿Paga reactiva? — el diagnóstico del factor de potencia.
 *
 * La confianza del cálculo viaja pegada a la cifra en todas ellas, porque un
 * ahorro de 900 € con tres meses de datos no se le presenta a un cliente igual
 * que uno con el año entero.
 */

interface Periodo {
  periodo: number; contratada_kw: number; maxima_medida_kw: number; lecturas: number;
  recomendada_kw: number; diferencia_kw: number; ahorro_anual: number; en_exceso: boolean;
}

interface Ficha {
  cups: {
    id: string; cups: string; alias: string | null; tarifa: string | null;
    potencias_kw: number[] | null; cliente: string | null; nif: string | null;
    autorizado: boolean; distribuidora_codigo: string | null;
    point_type: number | null; ultima_sync: string | null;
  };
  maximetros: { fecha: string; hora: string | null; potencia_kw: number; periodo: number }[];
  perfil: {
    total_kwh: number; por_periodo: number[]; pct_por_periodo: number[];
    media_por_hora: number[]; pct_horas_solares: number; cobertura_pct: number;
    horas_estimadas: number; dias_con_dato: number; punta_horaria_kw: number;
  } | null;
  optimizacion: {
    periodos: Periodo[]; coste_actual_anual: number; coste_optimo_anual: number;
    ahorro_anual: number; penalizacion_estimada: number;
    confianza: 'alta' | 'media' | 'baja'; avisos: string[];
    cambio_tarifa: { a: string; porque: string } | null;
    puede_cambiar_desde: string | null;
  } | null;
  reactiva: {
    penaliza: boolean; tan_phi: number; cos_phi: number;
    reactiva_kvarh: number; activa_kwh: number; mensaje: string;
  } | null;
  precios: { anuales: number[]; revisados: boolean };
  dias_analizados: number;
  diario: { tipo: string; mes: string | null; estado: string; filas: number; mensaje: string | null; pedido_en: string }[];
}

const eur = (n: number) => `${Math.round(n).toLocaleString('es-ES')} €`;
const kw = (n: number) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 1 })} kW`;
const TONO_CONFIANZA: Record<string, 'verde' | 'ambar' | 'rojo'> = { alta: 'verde', media: 'ambar', baja: 'rojo' };
const TONO_ESTADO: Record<string, 'verde' | 'ambar' | 'rojo' | 'muted'> = {
  ok: 'verde', vacio: 'muted', racionado: 'ambar', sin_autorizacion: 'rojo', error: 'rojo',
};

export default function FichaConsumoPage() {
  const params = useParams<{ cups: string }>();
  const cupsParam = decodeURIComponent(String(params?.cups || ''));
  const { perfil: usuario } = useUsuario();

  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [recado, setRecado] = useState<{ texto: string; mal: boolean } | null>(null);
  const [potenciasDatadis, setPotenciasDatadis] = useState<number[] | null>(null);
  const [verDiario, setVerDiario] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const token = await tokenSesion();
      const res = await fetch(`/api/luz/datadis?cups=${encodeURIComponent(cupsParam)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'No se ha podido cargar.'); return; }
      setFicha(json);
    } catch {
      setError('Error de conexión.');
    } finally {
      setCargando(false);
    }
  }, [cupsParam]);

  useEffect(() => { cargar(); }, [cargar]);

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
      if (Array.isArray(json.potencias_en_datadis)) setPotenciasDatadis(json.potencias_en_datadis);
      if (res.ok) await cargar();
    } catch {
      setRecado({ texto: 'Error de conexión con Datadis.', mal: true });
    } finally {
      setTrabajando(null);
    }
  };

  if (cargando) {
    return (
      <div className="text-center py-10 text-muted text-sm">
        <Loader className="w-5 h-5 mx-auto mb-2 animate-spin" /> Cargando el suministro...
      </div>
    );
  }

  if (error || !ficha) {
    return (
      <div className="space-y-4">
        <Link href="/gestor/luz/consumo" className={btnSecundario}>
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
        <Card className="!border-red-500/40">
          <p className="text-sm text-red-400">{error || 'No se ha encontrado el suministro.'}</p>
        </Card>
      </div>
    );
  }

  const { cups, optimizacion, perfil, reactiva, maximetros, precios, diario } = ficha;
  const maxHora = perfil ? Math.max(...perfil.media_por_hora, 0.001) : 1;
  // Las potencias de la ficha y las de Datadis deberían coincidir. Cuando no,
  // manda Datadis: es la distribuidora quien factura.
  const desajustePotencias = potenciasDatadis
    && JSON.stringify(potenciasDatadis.map(Number)) !== JSON.stringify((cups.potencias_kw || []).map(Number));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/gestor/luz/consumo" className="text-xs text-muted hover:text-foreground inline-flex items-center gap-1.5 mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Consumo real
          </Link>
          <h1 className="text-3xl font-black flex items-center gap-2.5">
            <Zap className="w-7 h-7 text-accent" /> {cups.cliente || 'Suministro'}
          </h1>
          <p className="text-sm text-muted mt-1 font-mono">
            {cups.cups}
            {cups.alias && <span className="font-sans"> · {cups.alias}</span>}
            {cups.tarifa && <span className="font-sans"> · {cups.tarifa}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={trabajando !== null || !cups.distribuidora_codigo}
            title={cups.distribuidora_codigo ? 'Traer 12 meses de Datadis' : 'Falta comprobar la autorización del cliente'}
            onClick={() => accion({ accion: 'sincronizar', cups_id: cups.id, meses: 12 }, 'sync')}
            className={btnSecundario}
          >
            {trabajando === 'sync' ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Sincronizar 12 meses
          </button>
          {optimizacion && (
            <button
              type="button"
              disabled={trabajando !== null}
              title="Congela este análisis: es lo que se le ha enseñado al cliente"
              onClick={() => accion({ accion: 'guardar_analisis', cups_id: cups.id, creado_por: usuario?.responsable }, 'guardar')}
              className={btnPrimario}
            >
              {trabajando === 'guardar' ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar análisis
            </button>
          )}
        </div>
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

      {desajustePotencias && (
        <Card className="!border-amber-500/40">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold text-foreground">Las potencias de la ficha no son las que tiene contratadas</p>
              <p className="text-muted mt-1">
                En la ficha: <span className="tabular-nums font-mono">{(cups.potencias_kw || []).join(' · ') || '—'}</span>.
                En Datadis: <span className="tabular-nums font-mono text-foreground">{potenciasDatadis!.join(' · ')}</span>.
                Manda Datadis, que es quien factura. Corrígelo en la ficha del CUPS antes de fiarte del ahorro.
              </p>
            </div>
          </div>
        </Card>
      )}

      {!optimizacion ? (
        <Card>
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-bold text-foreground">Todavía no hay maxímetros de este suministro</p>
              <p className="text-muted">
                {!cups.autorizado
                  ? 'El titular no nos ha autorizado en datadis.es. Sin ese permiso Datadis no deja leer nada suyo, y lo tiene que dar él desde su cuenta.'
                  : !cups.distribuidora_codigo
                    ? 'Falta enganchar este CUPS con Datadis: vuelve a la lista y comprueba la autorización del cliente.'
                    : 'Dale a «Sincronizar 12 meses». El maxímetro es lo que produce el euro; la curva es el extra.'}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Card className="lg:col-span-2 !p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-3 flex-wrap">
                <p className="font-bold text-foreground">Potencia: lo que paga contra lo que usa</p>
                <div className="flex items-center gap-2">
                  <Badge tono={TONO_CONFIANZA[optimizacion.confianza]}>confianza {optimizacion.confianza}</Badge>
                  <span className="text-[11px] text-muted tabular-nums">{ficha.dias_analizados} días</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-card/40">
                      {['', 'Contratada', 'Máx. medida', 'Recomendada', 'Sobra', 'Ahorro/año'].map((t) => (
                        <th key={t} className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-wider text-muted whitespace-nowrap">
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {optimizacion.periodos.map((p) => (
                      <tr key={p.periodo} className={`border-b border-border/20 ${p.en_exceso ? 'bg-red-500/5' : ''}`}>
                        <td className="px-3 py-2 font-black text-foreground">P{p.periodo}</td>
                        <td className="px-3 py-2 tabular-nums text-muted">{kw(p.contratada_kw)}</td>
                        <td className="px-3 py-2 tabular-nums">
                          <span className={p.en_exceso ? 'text-red-400 font-bold' : 'text-foreground'}>
                            {p.lecturas ? kw(p.maxima_medida_kw) : '—'}
                          </span>
                          {p.lecturas > 0 && (
                            <span className="block text-[10px] text-muted">{p.lecturas} lecturas</span>
                          )}
                        </td>
                        <td className="px-3 py-2 tabular-nums font-bold text-foreground">{kw(p.recomendada_kw)}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {p.diferencia_kw > 0
                            ? <span className="text-emerald-400">{kw(p.diferencia_kw)}</span>
                            : p.diferencia_kw < 0
                              ? <span className="text-red-400">falta {kw(-p.diferencia_kw)}</span>
                              : <span className="text-muted">—</span>}
                        </td>
                        <td className="px-3 py-2 tabular-nums font-bold">
                          {p.ahorro_anual > 0
                            ? <span className="text-emerald-400">{eur(p.ahorro_anual)}</span>
                            : <span className="text-muted">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-card/40">
                      <td colSpan={5} className="px-3 py-2.5 text-right font-bold text-foreground">
                        Ahorro anual en el término de potencia
                      </td>
                      <td className="px-3 py-2.5 tabular-nums font-black text-lg text-emerald-400">
                        {eur(optimizacion.ahorro_anual)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>

            <div className="space-y-3">
              <Card>
                <p className="text-[11px] uppercase tracking-wide font-bold text-muted">Coste del término de potencia</p>
                <div className="mt-2 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted">Hoy</span>
                    <span className="tabular-nums font-bold text-foreground">{eur(optimizacion.coste_actual_anual)}/año</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted">Ajustado</span>
                    <span className="tabular-nums font-bold text-emerald-400">{eur(optimizacion.coste_optimo_anual)}/año</span>
                  </div>
                  {optimizacion.penalizacion_estimada > 0 && (
                    <div className="flex justify-between gap-3 pt-1.5 border-t border-border/30">
                      <span className="text-muted">Excesos (cota inferior)</span>
                      <span className="tabular-nums font-bold text-red-400">{eur(optimizacion.penalizacion_estimada)}/año</span>
                    </div>
                  )}
                </div>
                {!precios.revisados && (
                  <p className="text-[10px] text-amber-400 mt-2.5 leading-relaxed">
                    Los € usan precios de potencia de referencia, sin validar contra una factura de 2026.
                    Los kW sí son dato de la distribuidora.
                  </p>
                )}
              </Card>

              {optimizacion.cambio_tarifa && (
                <Card className="!border-accent/40">
                  <p className="text-[11px] uppercase tracking-wide font-bold text-accent">
                    Debería estar en {optimizacion.cambio_tarifa.a}TD
                  </p>
                  <p className="text-xs text-muted mt-1.5 leading-relaxed">{optimizacion.cambio_tarifa.porque}</p>
                </Card>
              )}
            </div>
          </div>

          {optimizacion.avisos.length > 0 && (
            <Card>
              <p className="text-[11px] uppercase tracking-wide font-bold text-muted mb-2">Lo que hay que tener en cuenta</p>
              <ul className="space-y-1.5">
                {optimizacion.avisos.map((a, i) => (
                  <li key={i} className="text-xs text-muted flex gap-2 leading-relaxed">
                    <span className="text-amber-400 shrink-0">·</span>{a}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {perfil && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <p className="font-bold text-foreground">Cuándo consume</p>
              <span className="text-[11px] text-muted tabular-nums">
                {perfil.dias_con_dato} días · cobertura {perfil.cobertura_pct}%
                {perfil.horas_estimadas > 0 && ` · ${perfil.horas_estimadas} h estimadas`}
              </span>
            </div>
            {/* Barras a mano y no una librería: son 24 valores y así no entra una
                dependencia de gráficas en un panel que carga desde el móvil. */}
            <div className="flex items-end gap-[3px] h-32">
              {perfil.media_por_hora.map((v, h) => {
                const solar = h >= 8 && h < 18;
                return (
                  <div key={h} className="flex-1 flex flex-col items-center gap-1 group" title={`${h}:00 · ${v.toLocaleString('es-ES', { maximumFractionDigits: 1 })} kWh de media`}>
                    <div
                      className={`w-full rounded-t transition ${solar ? 'bg-amber-400/70 group-hover:bg-amber-400' : 'bg-accent/50 group-hover:bg-accent/80'}`}
                      style={{ height: `${Math.max(2, (v / maxHora) * 100)}%` }}
                    />
                    <span className="text-[8px] text-muted tabular-nums">{h % 3 === 0 ? h : ''}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted mt-2">
              En ámbar, las horas con sol (8-18). La punta horaria más alta fue de{' '}
              <span className="tabular-nums text-foreground">{perfil.punta_horaria_kw} kWh</span> en una hora —{' '}
              que es una media, no la potencia máxima: para eso está el maxímetro.
            </p>
          </Card>

          <div className="space-y-3">
            <Card className="!border-amber-500/30">
              <div className="flex items-start gap-2.5">
                <Sun className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-2xl font-black tabular-nums text-amber-400">{perfil.pct_horas_solares}%</p>
                  <p className="text-[11px] uppercase tracking-wide font-bold text-muted">del consumo con sol</p>
                  <p className="text-[10px] text-muted mt-1.5 leading-relaxed">
                    Este es el número que la calculadora FV venía suponiendo a mano en{' '}
                    <code className="px-1 rounded bg-card/80">pct_autoconsumo</code>. Aquí sale medido.
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <p className="text-[11px] uppercase tracking-wide font-bold text-muted mb-2">Reparto por periodo</p>
              <div className="space-y-1.5">
                {perfil.pct_por_periodo.map((pct, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-muted w-6">P{i + 1}</span>
                    <div className="flex-1 h-2 rounded-full bg-card/80 overflow-hidden">
                      <div className="h-full bg-accent/60 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] tabular-nums text-foreground w-11 text-right">{pct}%</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted mt-2.5 leading-relaxed">
                Reparto calculado con el calendario peninsular de periodos. Para ajustar potencias manda el
                maxímetro, que trae el periodo puesto por la distribuidora.
              </p>
            </Card>
          </div>
        </div>
      )}

      {reactiva && (
        <Card className={reactiva.penaliza ? '!border-red-500/40' : ''}>
          <div className="flex items-start gap-3">
            {reactiva.penaliza
              ? <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              : <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
            <div className="min-w-0">
              <p className="font-bold text-foreground">
                Energía reactiva · cos φ {reactiva.cos_phi.toFixed(2)}
                <span className="font-normal text-muted text-sm"> (tan φ {reactiva.tan_phi})</span>
              </p>
              <p className="text-sm text-muted mt-1 leading-relaxed">{reactiva.mensaje}</p>
              <p className="text-[11px] text-muted mt-1.5 tabular-nums">
                {reactiva.reactiva_kvarh.toLocaleString('es-ES')} kVArh reactiva sobre{' '}
                {reactiva.activa_kwh.toLocaleString('es-ES')} kWh activa en el rango.
              </p>
            </div>
          </div>
        </Card>
      )}

      {maximetros.length > 0 && (
        <Card className="!p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40">
            <p className="font-bold text-foreground">Maxímetros de la distribuidora</p>
            <p className="text-[11px] text-muted mt-0.5">
              El dato en bruto que respalda todo lo de arriba, con el día en que se alcanzó cada punta.
            </p>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border/40">
                  {['Fecha', 'Hora', 'Periodo', 'Potencia'].map((t) => (
                    <th key={t} className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-wider text-muted">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {maximetros.map((m, i) => (
                  <tr key={`${m.fecha}-${m.periodo}-${i}`} className="border-b border-border/20">
                    <td className="px-3 py-1.5 tabular-nums text-muted">{m.fecha}</td>
                    <td className="px-3 py-1.5 tabular-nums text-muted">{m.hora || '—'}</td>
                    <td className="px-3 py-1.5 font-bold text-foreground">P{m.periodo}</td>
                    <td className="px-3 py-1.5 tabular-nums font-bold text-foreground">{kw(Number(m.potencia_kw))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {diario.length > 0 && (
        <Card>
          <button
            type="button"
            onClick={() => setVerDiario((v) => !v)}
            className="text-xs font-bold text-muted hover:text-foreground"
          >
            {verDiario ? '− ' : '+ '}Diario de sincronización ({diario.length})
          </button>
          {verDiario && (
            <div className="mt-3 space-y-1">
              {diario.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] flex-wrap">
                  <Badge tono={TONO_ESTADO[d.estado] || 'muted'}>{d.estado}</Badge>
                  <span className="text-muted">{d.tipo}</span>
                  {d.mes && <span className="text-muted tabular-nums">{d.mes}</span>}
                  <span className="text-muted tabular-nums">{d.filas} filas</span>
                  <span className="text-muted/60 tabular-nums">
                    {new Date(d.pedido_en).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {d.mensaje && <span className="text-muted/70 min-w-0 truncate">— {d.mensaje}</span>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
