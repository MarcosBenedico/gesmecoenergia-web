'use client';

import { useMemo, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { ahorroSimple, numeroPaneles, r2, fmtEur2, POTENCIA_PANEL_W } from '@/lib/fv';
import { Card, inputCls, labelCls, btnSecundario } from '../ui';

/**
 * FASE 2 y 3 del Presupuestador FV:
 *  - Consumo del cliente: mes a mes a mano, plantilla CSV descargable o curva horaria.
 *  - Escenarios de dimensionado (conservador / equilibrado / máxima cobertura).
 *  - Ahorro y rentabilidad con hipótesis visibles y editables.
 * Todo es una ESTIMACIÓN ORIENTATIVA pendiente de validación por el instalador.
 */

export interface EnergiaFV {
  mensual: number[];              // 12 consumos en kWh (ene..dic)
  consumo_anual: number;
  origen: 'manual' | 'plantilla' | 'curva' | null;
  aviso_curva?: string | null;
}
export interface HipotesisFV {
  prod_especifica: number;        // kWh/kWp/año
  pct_autoconsumo: number;        // %
  precio_kwh: number;             // € kWh evitado
  precio_compensacion: number;    // € kWh excedente
  mantenimiento_anual: number;    // €/año
  analisis_con_iva: boolean;
}

export const ENERGIA_VACIA: EnergiaFV = { mensual: Array(12).fill(0), consumo_anual: 0, origen: null };
export const HIPOTESIS_DEFECTO: HipotesisFV = {
  prod_especifica: 1500, pct_autoconsumo: 60, precio_kwh: 0.15, precio_compensacion: 0.06,
  mantenimiento_anual: 100, analisis_con_iva: false,
};

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const num = (s: string) => parseFloat(String(s).replace(',', '.')) || 0;

/** Referencia mínima del catálogo que necesita el recomendador. */
export interface RefCatMin { codigo: string; descripcion: string; precio_base: number; confianza: string; num_referencias: number; activo: boolean }

/**
 * Recomendación automática de equipos desde el catálogo real de Óscar.
 * Son SUGERENCIAS coherentes con sus presupuestos: siempre revisables en las partidas.
 */
export function recomendarEquipos(kwp: number, paneles: number, consumoAnual: number, prodEspecifica: number, pctAuto: number, cat: RefCatMin[]) {
  const busca = (codigo: string) => cat.find((c) => c.codigo === codigo && c.activo) || null;

  // Inversor por potencia (referencias reales; el >18 kW es el caso Victron+Fronius: confianza baja)
  const inversor =
    kwp <= 6 ? busca('INV-FEL-5')
    : kwp <= 12 ? busca('INV-HOY-10')
    : kwp <= 18 ? busca('INV-VIC-15')
    : busca('INV-VIC-FRO-20');

  // Batería según excedente diario estimado (producción no autoconsumida / 365)
  const excedenteDiario = (kwp * prodEspecifica * (1 - pctAuto / 100)) / 365;
  const bateria = excedenteDiario > 18 ? busca('BAT-EVE-32') : excedenteDiario > 8 ? busca('BAT-FEL-16') : null;

  // Monitorización coherente con el inversor (como en los presupuestos de Óscar)
  const monitorizacion =
    inversor?.codigo === 'INV-FEL-5' ? busca('MON-CAB-PROT')
    : inversor?.codigo === 'INV-HOY-10' ? busca('MON-HOY')
    : busca('MON-VIC');

  // Instalación: referencia histórica más cercana por nº de paneles (confianza según distancia)
  const refInst = paneles <= 20 ? busca('INS-VIV-16') : paneles <= 31 ? busca('INS-MET-30') : paneles <= 40 ? busca('INS-MET-32') : busca('INS-NAVE-50');
  const refPaneles = { 'INS-VIV-16': 16, 'INS-MET-30': 30, 'INS-MET-32': 32, 'INS-NAVE-50': 50 }[refInst?.codigo || ''] || paneles;
  const distancia = Math.abs(paneles - refPaneles);

  const tramites = inversor?.codigo === 'INV-FEL-5' ? busca('TRA-AMPL') : busca('TRA-BASE');

  return {
    inversor, bateria, monitorizacion, instalacion: refInst, tramites,
    instalacionConfianza: distancia <= 2 ? 'media' : 'baja',
    instalacionNota: distancia > 2 ? `Referencia de ${refPaneles} paneles para ${paneles}: ajustar tras visita.` : null,
    excedenteDiario: r2(excedenteDiario),
  };
}

export function EnergiaEscenarios({ energia, setEnergia, hipotesis, setHipotesis, potenciaActual, precioSinIva, precioConIva, onAplicarPotencia, catalogo, onMontarPresupuesto }: {
  energia: EnergiaFV;
  setEnergia: (e: EnergiaFV) => void;
  hipotesis: HipotesisFV;
  setHipotesis: (h: HipotesisFV) => void;
  potenciaActual: number;
  precioSinIva: number;
  precioConIva: number;
  onAplicarPotencia: (kw: number) => void;
  catalogo: RefCatMin[];
  onMontarPresupuesto: (kwp: number, codigos: { codigo: string; cantidad: number; confianza?: string; nota?: string }[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [errImport, setErrImport] = useState('');
  const anual = energia.consumo_anual;

  function setMes(i: number, v: number) {
    const mensual = energia.mensual.map((x, j) => (j === i ? Math.max(v, 0) : x));
    setEnergia({ ...energia, mensual, consumo_anual: r2(mensual.reduce((s, x) => s + x, 0)), origen: 'manual' });
  }

  /** Plantilla CSV descargable (se abre en Excel). */
  function descargarPlantilla() {
    const filas = ['Mes;Consumo_kWh', ...MESES.map((m) => `${m};0`)].join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + filas], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'plantilla_consumos_gesmeco.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  /** Importa la plantilla mensual (Mes;kWh) o una curva horaria (fecha;hora;kWh) y la agrega por mes. */
  async function importar(archivo: File) {
    setErrImport('');
    const texto = await archivo.text();
    const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lineas.length < 2) { setErrImport('El archivo está vacío.'); return; }
    const sep = lineas[0].includes(';') ? ';' : ',';
    const cab = lineas[0].toLowerCase();
    const mensual = Array(12).fill(0);
    let negativos = 0;
    const mesesVistos = new Set<number>();

    if (cab.includes('mes')) {
      // Plantilla mensual
      for (const l of lineas.slice(1)) {
        const [mes, kwh] = l.split(sep);
        const i = MESES.findIndex((m) => mes?.toLowerCase().startsWith(m.toLowerCase().slice(0, 3)));
        const v = num(kwh);
        if (i < 0) continue;
        if (v < 0) { negativos++; continue; }
        mensual[i] += v; mesesVistos.add(i);
      }
    } else {
      // Curva: fecha;hora;kwh (o fecha;kwh) — intervalos de 15 min o 1 h
      for (const l of lineas.slice(cab.includes('fecha') || cab.includes('kwh') ? 1 : 0)) {
        const partes = l.split(sep);
        const fecha = partes[0];
        const v = num(partes[partes.length - 1]);
        const m = fecha?.match(/^(\d{4})-(\d{2})/) || fecha?.match(/^\d{1,2}[\/\-](\d{1,2})[\/\-]\d{2,4}/);
        if (!m) continue;
        const mesIdx = (m.length === 3 ? parseInt(m[2]) : parseInt(m[1])) - 1;
        if (mesIdx < 0 || mesIdx > 11) continue;
        if (v < 0) { negativos++; continue; }
        mensual[mesIdx] += v; mesesVistos.add(mesIdx);
      }
    }
    const total = r2(mensual.reduce((s, x) => s + x, 0));
    if (total <= 0) { setErrImport('No se pudo leer ningún consumo. Formatos: "Mes;Consumo_kWh" o "fecha;hora;kWh".'); return; }
    const avisos: string[] = [];
    if (mesesVistos.size < 12) avisos.push(`Solo hay datos de ${mesesVistos.size} mes(es): no cubre un año completo, la estimación anual puede quedar corta.`);
    if (negativos) avisos.push(`${negativos} valor(es) negativos descartados.`);
    setEnergia({ mensual: mensual.map(r2), consumo_anual: total, origen: cab.includes('mes') ? 'plantilla' : 'curva', aviso_curva: avisos.join(' ') || null });
  }

  /** Escenarios: potencia para cubrir un % del consumo con la producción específica indicada. */
  const escenarios = useMemo(() => {
    if (anual <= 0 || hipotesis.prod_especifica <= 0) return [];
    const inversionReferencia = potenciaActual > 0 && precioSinIva > 0 ? precioSinIva / potenciaActual : 1100; // €/kWp orientativo
    return ([['Conservador', 0.5, -10], ['Equilibrado', 0.75, 0], ['Máxima cobertura', 1.0, 10]] as const).map(([nombre, factor, dAuto]) => {
      const kwp = r2((anual * factor) / hipotesis.prod_especifica);
      const paneles = numeroPaneles(kwp);
      const kwpReal = r2((paneles * POTENCIA_PANEL_W) / 1000);
      const produccion = r2(kwpReal * hipotesis.prod_especifica);
      const pctAuto = Math.min(Math.max(hipotesis.pct_autoconsumo + dAuto, 10), 95);
      const inversion = r2(kwpReal * inversionReferencia);
      const a = ahorroSimple({
        produccion_anual_kwh: produccion, pct_autoconsumo: pctAuto,
        precio_kwh_evitado: hipotesis.precio_kwh, precio_compensacion: hipotesis.precio_compensacion,
        mantenimiento_anual: hipotesis.mantenimiento_anual, inversion,
      });
      const cobertura = Math.min(r2((produccion * (pctAuto / 100)) / anual * 100), 100);
      const rec = recomendarEquipos(kwpReal, paneles, anual, hipotesis.prod_especifica, pctAuto, catalogo);
      return { nombre, kwp: kwpReal, paneles, produccion, pctAuto, cobertura, inversion, ahorro: a.ahorro_neto_anual, amortizacion: a.amortizacion_anios, rec };
    });
  }, [anual, hipotesis, potenciaActual, precioSinIva, catalogo]);

  /** Monta el presupuesto completo con la recomendación de un escenario. */
  function montar(e: (typeof escenarios)[number]) {
    const codigos: { codigo: string; cantidad: number; confianza?: string; nota?: string }[] = [
      { codigo: 'PAN-JIN-515', cantidad: e.paneles },
      { codigo: 'EST-SUN-STD', cantidad: e.paneles },
    ];
    if (e.rec.inversor) codigos.push({ codigo: e.rec.inversor.codigo, cantidad: 1 });
    if (e.rec.bateria) codigos.push({ codigo: e.rec.bateria.codigo, cantidad: 1 });
    if (e.rec.monitorizacion) codigos.push({ codigo: e.rec.monitorizacion.codigo, cantidad: 1 });
    if (e.rec.instalacion) codigos.push({ codigo: e.rec.instalacion.codigo, cantidad: 1, confianza: e.rec.instalacionConfianza, nota: e.rec.instalacionNota || undefined });
    if (e.rec.tramites) codigos.push({ codigo: e.rec.tramites.codigo, cantidad: 1 });
    onMontarPresupuesto(e.kwp, codigos);
  }

  /** Fase 3: ahorro con la potencia y el precio REAL del presupuesto actual. */
  const analisis = useMemo(() => {
    if (potenciaActual <= 0) return null;
    const produccion = r2(potenciaActual * hipotesis.prod_especifica);
    const inversion = hipotesis.analisis_con_iva ? precioConIva : precioSinIva;
    return {
      produccion,
      inversion,
      ...ahorroSimple({
        produccion_anual_kwh: produccion, pct_autoconsumo: hipotesis.pct_autoconsumo,
        precio_kwh_evitado: hipotesis.precio_kwh, precio_compensacion: hipotesis.precio_compensacion,
        mantenimiento_anual: hipotesis.mantenimiento_anual, inversion,
      }),
    };
  }, [potenciaActual, precioSinIva, precioConIva, hipotesis]);

  const maxMes = Math.max(...energia.mensual, 1);
  const setH = (k: keyof HipotesisFV, v: number | boolean) => setHipotesis({ ...hipotesis, [k]: v });

  return (
    <>
      {/* ── FASE 2 · Consumo del cliente ── */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-bold text-sm">⚡ Consumo del cliente</h3>
          <div className="flex gap-2">
            <button type="button" onClick={descargarPlantilla} className={btnSecundario}><Download className="w-4 h-4" /> Plantilla</button>
            <button type="button" onClick={() => fileRef.current?.click()} className={btnSecundario}><Upload className="w-4 h-4" /> Importar CSV / curva</button>
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ''; }} />
          </div>
        </div>
        <p className="text-[11px] text-muted">Escribe los consumos mes a mes, o descarga la plantilla, rellénala en Excel y súbela. También acepta una curva horaria o cuarto-horaria (fecha;hora;kWh): se agrega por meses.</p>
        {errImport && <p className="text-[11px] text-red-400">{errImport}</p>}
        {energia.aviso_curva && <p className="text-[11px] text-amber-300">⚠️ {energia.aviso_curva}</p>}

        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-1.5">
          {MESES.map((m, i) => (
            <div key={m}>
              <p className="text-[9px] font-bold uppercase text-muted text-center">{m}</p>
              <input
                className="w-full rounded-md border border-border/40 bg-background/60 px-1 py-1 text-[11px] text-right tabular-nums"
                type="number" min="0" value={energia.mensual[i] || ''}
                onChange={(e) => setMes(i, num(e.target.value))} placeholder="0"
              />
              <div className="h-8 flex items-end mt-0.5"><div className="w-full bg-amber-400/60 rounded-t" style={{ height: `${(energia.mensual[i] / maxMes) * 100}%` }} /></div>
            </div>
          ))}
        </div>
        <p className="text-xs font-bold text-right">Consumo anual: <span className="tabular-nums">{anual.toLocaleString('es-ES')} kWh</span>{energia.origen && <span className="text-muted font-normal"> · origen: {energia.origen}</span>}</p>
      </Card>

      {/* ── Hipótesis (visibles y editables) ── */}
      <Card className="space-y-2">
        <h3 className="font-bold text-sm">🔧 Hipótesis de la estimación (editables)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {([['prod_especifica', 'Producción (kWh/kWp/año)'], ['pct_autoconsumo', '% autoconsumo'], ['precio_kwh', '€/kWh evitado'],
            ['precio_compensacion', '€/kWh excedente'], ['mantenimiento_anual', 'Mantenimiento €/año']] as const).map(([k, n]) => (
            <div key={k}>
              <label className={labelCls}>{n}</label>
              <input className={inputCls} type="number" min="0" step="0.01" value={hipotesis[k]} onChange={(e) => setH(k, num(e.target.value))} />
            </div>
          ))}
          <div>
            <label className={labelCls}>Análisis</label>
            <select className={inputCls} value={hipotesis.analisis_con_iva ? '1' : '0'} onChange={(e) => setH('analisis_con_iva', e.target.value === '1')}>
              <option value="0">Sin IVA</option><option value="1">Con IVA</option>
            </select>
          </div>
        </div>
      </Card>

      {/* ── FASE 2 · Escenarios ── */}
      {escenarios.length > 0 && (
        <Card className="space-y-2">
          <h3 className="font-bold text-sm">📊 Escenarios de dimensionado</h3>
          <div className="grid md:grid-cols-3 gap-3">
            {escenarios.map((e) => (
              <div key={e.nombre} className="rounded-xl border border-border/40 bg-card/50 p-3 space-y-1 text-xs">
                <p className="font-black text-sm">{e.nombre}</p>
                <p><b className="tabular-nums">{e.kwp} kWp</b> · {e.paneles} paneles · {r2(e.produccion).toLocaleString('es-ES')} kWh/año</p>
                <p className="text-muted">Autoconsumo {e.pctAuto} % · cobertura ≈{e.cobertura} %</p>
                <p>Inversión ≈ <b className="tabular-nums">{fmtEur2(e.inversion)}</b></p>
                <p className="text-emerald-400">Ahorro ≈ {fmtEur2(e.ahorro)}/año · amortiza en {e.amortizacion ?? '—'} años</p>
                <div className="pt-1.5 mt-1 border-t border-border/30 text-[10px] text-muted space-y-0.5">
                  <p>⚡ {e.rec.inversor?.descripcion || 'Inversor a estudiar'}</p>
                  <p>🔋 {e.rec.bateria ? e.rec.bateria.descripcion : `Sin batería (excedente ≈${e.rec.excedenteDiario} kWh/día)`}</p>
                  <p>🔧 {e.rec.instalacion?.descripcion || 'Instalación a valorar'}</p>
                  {e.rec.instalacionNota && <p className="text-amber-300">⚠️ {e.rec.instalacionNota}</p>}
                </div>
                <button type="button" onClick={() => montar(e)} className="w-full mt-1.5 px-2 py-1.5 rounded-lg bg-accent text-white text-[11px] font-bold hover:bg-accent/90">
                  🪄 Montar presupuesto con este escenario
                </button>
                <button type="button" onClick={() => onAplicarPotencia(e.kwp)} className="w-full px-2 py-1 rounded-lg border border-border/50 text-muted text-[10px] font-semibold hover:text-foreground">
                  Solo usar la potencia
                </button>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted">Estimación orientativa con las hipótesis de arriba: la inversión usa el €/kWp del presupuesto actual (o 1.100 €/kWp si aún no hay partidas). Pendiente de validación del instalador.</p>
        </Card>
      )}

      {/* ── FASE 3 · Ahorro y rentabilidad del presupuesto actual ── */}
      {analisis && (
        <Card className="space-y-1.5">
          <h3 className="font-bold text-sm">📈 Ahorro y rentabilidad (presupuesto actual)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {([['Producción estimada', `${analisis.produccion.toLocaleString('es-ES')} kWh/año`],
              ['Ahorro por autoconsumo', fmtEur2(analisis.ahorro_autoconsumo) + '/año'],
              ['Compensación excedentes', fmtEur2(analisis.valor_excedentes) + '/año'],
              ['Ahorro neto anual', fmtEur2(analisis.ahorro_neto_anual)],
              [`Inversión (${hipotesis.analisis_con_iva ? 'con' : 'sin'} IVA)`, fmtEur2(analisis.inversion)],
              ['Amortización simple', analisis.amortizacion_anios != null ? `${analisis.amortizacion_anios} años` : '— (ahorro nulo)'],
            ] as [string, string][]).map(([n, v]) => (
              <div key={n} className="rounded-lg bg-card/60 p-2"><p className="text-[10px] uppercase font-bold text-muted">{n}</p><p className="font-black tabular-nums">{v}</p></div>
            ))}
          </div>
          <p className="text-[10px] text-amber-300">⚠️ Estimación orientativa para la propuesta comercial. El ahorro real depende de la curva de consumo y debe validarse con el instalador. No incluye ahorro por reducción de potencia contratada.</p>
        </Card>
      )}
    </>
  );
}
