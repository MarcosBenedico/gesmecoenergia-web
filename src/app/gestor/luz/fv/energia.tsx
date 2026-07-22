'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import {
  ahorroSimple, numeroPaneles, r2, fmtEur2, POTENCIA_PANEL_W,
  FRANJAS_CONSUMO, FRANJA_LABEL, PERFIL_FRANJA, CAPACIDAD_BATERIA,
  optimizarBateria, siguienteEuro, LineaJustificacion, OpcionBateria, estimarAyudas, IRPF_PCT_DEDUCCION,
  estimarGasoil, produccionMensual, MESES_CORTO, GASOIL_PRECIO_LITRO, GASOIL_KWH_LITRO,
} from '@/lib/fv';
import { Card, inputCls, labelCls, btnSecundario, btnPrimario } from '../ui';

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
  origen: 'manual' | 'plantilla' | 'curva' | 'gasoil' | null;
  aviso_curva?: string | null;
  /** Franja del consumo FUERTE (mañana/mediodía/tarde/diurno/noche/todo el día). */
  franja?: string | null;
  /** Modo granja aislada: gasto mensual de gasoil y parámetros del grupo electrógeno. */
  gasoil?: { gasto_mensual: number; precio_litro: number; kwh_litro: number } | null;
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
  prod_especifica: 800, pct_autoconsumo: 75, precio_kwh: 0.15, precio_compensacion: 0.081,
  mantenimiento_anual: 0, analisis_con_iva: false, // el mantenimiento se calcula solo: nº de placas × 10 €
};

/** Coste de mantenimiento por defecto: 10 € por panel presupuestado. */
export const MANTENIMIENTO_POR_PANEL = 10;

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

export function EnergiaEscenarios({ energia, setEnergia, hipotesis, setHipotesis, potenciaActual, precioSinIva, precioConIva, onAplicarPotencia, catalogo, onMontarPresupuesto, clienteNombre, proyecto, perfil }: {
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
  clienteNombre?: string;
  proyecto?: string;
  perfil?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [errImport, setErrImport] = useState('');
  const anual = energia.consumo_anual;
  const esGasoil = perfil === 'granja_aislada';

  /** Modo gasoil: al cambiar el gasto/parámetros, deriva el consumo anual equivalente y el €/kWh evitado. */
  function setGasoil(campos: Partial<NonNullable<EnergiaFV['gasoil']>>) {
    const g = { gasto_mensual: 0, precio_litro: GASOIL_PRECIO_LITRO, kwh_litro: GASOIL_KWH_LITRO, ...(energia.gasoil || {}), ...campos };
    const est = estimarGasoil({ gastoMensual: g.gasto_mensual, precioLitro: g.precio_litro, kwhLitro: g.kwh_litro });
    // La energía anual sale del gasoil; el precio del kWh evitado es el coste real del gasoil (caro)
    setEnergia({ ...energia, gasoil: g, consumo_anual: est.kwh_anio, mensual: produccionMensual(est.kwh_anio), origen: 'gasoil' });
    if (est.coste_kwh > 0) setHipotesis({ ...hipotesis, precio_kwh: est.coste_kwh, precio_compensacion: 0, pct_autoconsumo: 90 });
  }
  const gasoilEst = energia.gasoil ? estimarGasoil({ gastoMensual: energia.gasoil.gasto_mensual, precioLitro: energia.gasoil.precio_litro, kwhLitro: energia.gasoil.kwh_litro }) : null;

  // Mantenimiento por defecto = nº de placas presupuestadas × 10 € (hasta que se edite a mano)
  const [mantTocado, setMantTocado] = useState(false);
  const panelesActuales = numeroPaneles(potenciaActual);
  useEffect(() => {
    if (mantTocado || panelesActuales <= 0) return;
    const mant = panelesActuales * MANTENIMIENTO_POR_PANEL;
    if (mant !== hipotesis.mantenimiento_anual) setHipotesis({ ...hipotesis, mantenimiento_anual: mant });
  }, [panelesActuales, mantTocado]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const franja = energia.franja || null;
  const perfilFranja = franja ? PERFIL_FRANJA[franja] : null;

  /**
   * Escenarios con TODO justificado:
   *  1) Dimensionado de placas para cubrir un % del consumo.
   *  2) Coincidencia solar según la franja del consumo fuerte (o la hipótesis si no hay franja).
   *  3) ALGORITMO batería: prueba sin/16/32 kWh del catálogo y elige la de menor amortización.
   *  4) "Siguiente euro": ¿rinde más ampliar placas o batería?
   */
  const escenarios = useMemo(() => {
    if (anual <= 0 || hipotesis.prod_especifica <= 0) return [];
    const inversionReferencia = potenciaActual > 0 && precioSinIva > 0 ? r2(precioSinIva / potenciaActual) : 1100; // €/kWp
    const fuenteInv = potenciaActual > 0 && precioSinIva > 0 ? 'precio del presupuesto actual ÷ su potencia' : 'referencia orientativa 1.100 €/kWp';
    const baterias = ['BAT-FEL-16', 'BAT-EVE-32']
      .map((c) => catalogo.find((x) => x.codigo === c && x.activo))
      .filter(Boolean)
      .map((b) => ({ codigo: b!.codigo, nombre: b!.descripcion, coste: Number(b!.precio_base) }));

    return ([['Conservador', 0.5], ['Equilibrado', 0.75], ['Máxima cobertura', 1.0]] as const).map(([nombre, factor]) => {
      const kwpObjetivo = r2((anual * factor) / hipotesis.prod_especifica);
      const paneles = numeroPaneles(kwpObjetivo);
      const kwpReal = r2((paneles * POTENCIA_PANEL_W) / 1000);
      const produccion = r2(kwpReal * hipotesis.prod_especifica);

      // Coincidencia directa: franja del consumo fuerte, o la hipótesis general si no se ha indicado
      const coincidencia = perfilFranja ? perfilFranja.coincidencia : Math.min(Math.max(hipotesis.pct_autoconsumo, 10), 95);
      const fuenteCoin = perfilFranja ? `perfil de la franja "${FRANJA_LABEL[franja!]}"` : 'hipótesis "% autoconsumo" (sin franja indicada)';

      const inversionPlacas = r2(kwpReal * inversionReferencia);
      const opt = optimizarBateria({
        produccion_anual_kwh: produccion, coincidencia_pct: coincidencia, inversion_placas: inversionPlacas,
        precio_kwh: hipotesis.precio_kwh, precio_compensacion: hipotesis.precio_compensacion,
        mantenimiento_anual: hipotesis.mantenimiento_anual, baterias,
      });
      const el = opt.elegida;
      const cobertura = Math.min(r2((produccion * (el.pct_auto_efectivo / 100)) / anual * 100), 100);
      const rec = recomendarEquipos(kwpReal, paneles, anual, hipotesis.prod_especifica, el.pct_auto_efectivo, catalogo);

      // ¿El siguiente euro, a placas o a batería?
      const costeKwhBat = baterias.length ? r2(baterias[0].coste / (CAPACIDAD_BATERIA[baterias[0].codigo] || 14.4)) : 400;
      const marginal = siguienteEuro({
        produccion_anual_kwh: produccion, coincidencia_pct: coincidencia, pct_auto_efectivo: el.pct_auto_efectivo,
        precio_kwh: hipotesis.precio_kwh, precio_compensacion: hipotesis.precio_compensacion,
        coste_por_kwp: inversionReferencia, coste_por_kwh_bateria: costeKwhBat, prod_especifica: hipotesis.prod_especifica,
      });

      const autoKwh = r2(produccion * (el.pct_auto_efectivo / 100));
      const excKwh = r2(produccion - autoKwh);
      // Justificación línea a línea: concepto · fórmula · valor · fuente
      const justificacion: LineaJustificacion[] = [
        { concepto: 'Potencia objetivo', formula: `${anual.toLocaleString('es-ES')} kWh × ${factor} ÷ ${hipotesis.prod_especifica}`, valor: `${kwpObjetivo} kWp`, fuente: 'consumo anual del cliente y producción específica de la zona' },
        { concepto: 'Nº de paneles', formula: `⌈${kwpObjetivo} × 1000 ÷ ${POTENCIA_PANEL_W}⌉`, valor: `${paneles} paneles → ${kwpReal} kWp reales`, fuente: `panel Jinko ${POTENCIA_PANEL_W} W (catálogo de Óscar)` },
        { concepto: 'Producción anual', formula: `${kwpReal} kWp × ${hipotesis.prod_especifica} kWh/kWp`, valor: `${produccion.toLocaleString('es-ES')} kWh/año`, fuente: 'hipótesis editable (≈1.500 en Aragón según PVGIS)' },
        { concepto: 'Autoconsumo directo', formula: `${coincidencia} % de la producción`, valor: `${r2(produccion * coincidencia / 100).toLocaleString('es-ES')} kWh/año`, fuente: fuenteCoin },
        ...(el.codigo ? [{ concepto: 'Aporte de la batería', formula: `min(${el.capacidad_util} kWh útiles, excedente diario) × 365`, valor: `+${el.aporte_anual_kwh.toLocaleString('es-ES')} kWh/año → ${el.pct_auto_efectivo} % efectivo`, fuente: `${el.nombre} (algoritmo: menor amortización de las ${opt.opciones.length} opciones)` }] : []),
        { concepto: 'Ahorro por autoconsumo', formula: `${autoKwh.toLocaleString('es-ES')} kWh × ${hipotesis.precio_kwh} €`, valor: fmtEur2(r2(autoKwh * hipotesis.precio_kwh)) + '/año', fuente: 'precio del kWh evitado (hipótesis, de la factura del cliente)' },
        { concepto: 'Compensación excedentes', formula: `${excKwh.toLocaleString('es-ES')} kWh × ${hipotesis.precio_compensacion} €`, valor: fmtEur2(r2(excKwh * hipotesis.precio_compensacion)) + '/año', fuente: 'precio de compensación (hipótesis, según comercializadora)' },
        { concepto: 'Mantenimiento', formula: 'coste fijo anual', valor: `−${fmtEur2(hipotesis.mantenimiento_anual)}/año`, fuente: 'hipótesis editable' },
        { concepto: 'Inversión estimada', formula: `${kwpReal} kWp × ${inversionReferencia} €/kWp${el.coste ? ` + ${fmtEur2(el.coste)} batería` : ''}`, valor: fmtEur2(el.inversion), fuente: fuenteInv },
        { concepto: 'Amortización', formula: `${fmtEur2(el.inversion)} ÷ ${fmtEur2(el.ahorro_neto_anual)}/año`, valor: el.amortizacion != null ? `${el.amortizacion} años` : '—', fuente: 'inversión entre ahorro neto anual (método simple)' },
      ];

      return {
        nombre, factor, kwp: kwpReal, paneles, produccion,
        coincidencia, pctAuto: el.pct_auto_efectivo, cobertura,
        inversion: el.inversion, ahorro: el.ahorro_neto_anual, amortizacion: el.amortizacion,
        opt, marginal, justificacion, rec,
      };
    });
  }, [anual, hipotesis, potenciaActual, precioSinIva, catalogo, franja, perfilFranja]);

  /** Monta el presupuesto completo con la recomendación del escenario (batería = la elegida por el algoritmo). */
  function montar(e: (typeof escenarios)[number]) {
    const notaEscenario = `Escenario ${e.nombre} · ${e.paneles} paneles · autoconsumo ${e.pctAuto} %${franja ? ` · consumo fuerte: ${FRANJA_LABEL[franja]}` : ''}`;
    const codigos: { codigo: string; cantidad: number; confianza?: string; nota?: string }[] = [
      { codigo: 'PAN-JIN-515', cantidad: e.paneles, nota: notaEscenario },
      { codigo: 'EST-SUN-STD', cantidad: e.paneles },
    ];
    if (e.rec.inversor) codigos.push({ codigo: e.rec.inversor.codigo, cantidad: 1 });
    // Batería: la que eligió el algoritmo por amortización (no la heurística genérica)
    if (e.opt.elegida.codigo) {
      codigos.push({
        codigo: e.opt.elegida.codigo, cantidad: 1,
        nota: `Elegida por el algoritmo: aporta ${e.opt.elegida.aporte_anual_kwh.toLocaleString('es-ES')} kWh/año al autoconsumo y deja la amortización en ${e.opt.elegida.amortizacion ?? '—'} años.`,
      });
    }
    if (e.rec.monitorizacion) codigos.push({ codigo: e.rec.monitorizacion.codigo, cantidad: 1 });
    if (e.rec.instalacion) codigos.push({ codigo: e.rec.instalacion.codigo, cantidad: 1, confianza: e.rec.instalacionConfianza, nota: e.rec.instalacionNota || undefined });
    if (e.rec.tramites) codigos.push({ codigo: e.rec.tramites.codigo, cantidad: 1 });
    onMontarPresupuesto(e.kwp, codigos);
  }

  /** Imprime una comparativa de los 3 escenarios para presentársela al cliente. */
  function imprimirComparativa() {
    if (escenarios.length === 0) return;
    const hoy = new Date().toLocaleDateString('es-ES');
    const franjaTxt = franja ? FRANJA_LABEL[franja] : null;
    const col = (e: (typeof escenarios)[number]) =>
      `<td><div class="nom">${e.nombre}</div><div class="cob">cubre el ${Math.round(e.factor * 100)} % de su consumo</div></td>`;
    const fila = (etiqueta: string, val: (e: (typeof escenarios)[number]) => string, destacar = false) =>
      `<tr class="${destacar ? 'dest' : ''}"><th>${etiqueta}</th>${escenarios.map((e) => `<td class="num">${val(e)}</td>`).join('')}</tr>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Comparativa de opciones · ${clienteNombre || 'Cliente'}</title>
<style>
  *{box-sizing:border-box} body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;margin:0;padding:0 0 2rem}
  .banda{background:#131322;color:#fff;padding:1.4rem 2rem;display:flex;justify-content:space-between;align-items:center}
  .banda b{font-size:1.1rem;letter-spacing:.05em} .banda span{font-size:.8rem;color:#c9c9d6}
  .franja{height:5px;background:linear-gradient(90deg,#e11d48,#ff7a45,#00b7d9)}
  .hoja{max-width:900px;margin:0 auto;padding:1.4rem 2rem}
  h1{font-size:1.2rem;margin:.2rem 0} .sub{color:#5c5c6e;font-size:.9rem;margin:0 0 1rem}
  table{width:100%;border-collapse:collapse;margin:1rem 0}
  th,td{padding:.6rem .8rem;text-align:left;font-size:.9rem;border-bottom:1px solid #eee}
  thead td{background:#f8f8fa;text-align:center;vertical-align:top}
  .nom{font-weight:800;font-size:1.05rem;color:#e11d48} .cob{font-size:.75rem;color:#5c5c6e}
  tbody th{font-weight:600;color:#3a3a4a;width:34%} .num{text-align:right;font-variant-numeric:tabular-nums}
  thead td .num{text-align:center}
  tr.dest td,tr.dest th{background:#eafaf0;font-weight:800}
  .nota{background:#f8f8fa;border-left:3px solid #e11d48;border-radius:0 8px 8px 0;padding:.7rem .9rem;font-size:.85rem;color:#3a3a4a;margin:1rem 0}
  .pie{margin-top:1.5rem;padding-top:.7rem;border-top:1px solid #eee;font-size:.72rem;color:#5c5c6e;text-align:center}
  @media print{.noprint{display:none} .banda,.franja,thead td,tr.dest td,tr.dest th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="banda"><b>Gesmeco Energía</b><span>Comparativa de opciones · ${hoy}</span></div>
<div class="franja"></div>
<div class="hoja">
<h1>${proyecto || 'Instalación solar fotovoltaica'}</h1>
<p class="sub">Cliente: <b>${clienteNombre || '—'}</b>${franjaTxt ? ` · consumo principal ${franjaTxt.replace(/^\S+\s/, '').toLowerCase()}` : ''} · consumo anual analizado: <b>${anual.toLocaleString('es-ES')} kWh</b></p>
<p>Le presentamos <b>tres formas de dimensionar</b> su instalación para que elija la que mejor encaja con usted. Todas son llave en mano: nos encargamos de la ingeniería, la legalización y los trámites.</p>
<table>
<thead><tr><td></td>${escenarios.map(col).join('')}</tr></thead>
<tbody>
${fila('Potencia', (e) => `${e.kwp} kWp`)}
${fila('Nº de paneles', (e) => `${e.paneles}`)}
${fila('Batería', (e) => e.opt.elegida.codigo ? 'Sí, incluida' : 'No necesaria')}
${fila('Producción anual', (e) => `${Math.round(e.produccion).toLocaleString('es-ES')} kWh`)}
${fila('Cobertura de su consumo', (e) => `≈ ${e.cobertura} %`)}
${fila('Inversión estimada', (e) => fmtEur2(e.inversion))}
${fila('Deducción IRPF (hasta)', (e) => fmtEur2(estimarAyudas(e.inversion).deduccion_irpf))}
${fila('Ahorro estimado / año', (e) => fmtEur2(e.ahorro), true)}
${fila('Se amortiza en', (e) => e.amortizacion != null ? `${e.amortizacion} años` : '—', true)}
</tbody></table>
<div class="nota">🤝 <b>Nosotros nos encargamos de todo.</b> Ingeniería, legalización, boletines, permisos de conexión, alta de autoconsumo y compensación de excedentes, y la tramitación de su deducción de IRPF y bonificaciones municipales. Usted solo elige la opción y disfruta del ahorro.</div>
<p style="font-size:.78rem;color:#888">Estimaciones orientativas con una producción de ${hipotesis.prod_especifica} kWh/kWp·año (irradiación de la zona) y su perfil de consumo. La deducción de IRPF (${IRPF_PCT_DEDUCCION} %) depende de su situación fiscal. Pendiente de validación técnica del instalador. No incluye subvenciones que pudieran estar abiertas.</p>
<div class="pie">Gesmeco Energía · Avenida de Aragón, 50 · 22500 Binéfar (Huesca) · www.gesmecoenergia.com</div>
<p class="noprint" style="text-align:center;margin-top:1.2rem"><button onclick="window.print()" style="padding:.7rem 1.6rem;font-weight:bold;font-size:1rem;background:#e11d48;color:#fff;border:none;border-radius:8px;cursor:pointer">🖨️ Imprimir / Guardar como PDF</button></p>
</div></body></html>`);
    w.document.close();
  }

  /** Fase 3: ahorro con la potencia y el precio REAL del presupuesto actual (usa la franja si está indicada). */
  const analisis = useMemo(() => {
    if (potenciaActual <= 0) return null;
    const produccion = r2(potenciaActual * hipotesis.prod_especifica);
    const inversion = hipotesis.analisis_con_iva ? precioConIva : precioSinIva;
    const pctUsado = perfilFranja ? perfilFranja.coincidencia : hipotesis.pct_autoconsumo;
    return {
      produccion,
      inversion,
      pctUsado,
      fuentePct: perfilFranja ? `coincidencia de la franja ${FRANJA_LABEL[franja!]}` : 'hipótesis % autoconsumo',
      ...ahorroSimple({
        produccion_anual_kwh: produccion, pct_autoconsumo: pctUsado,
        precio_kwh_evitado: hipotesis.precio_kwh, precio_compensacion: hipotesis.precio_compensacion,
        mantenimiento_anual: hipotesis.mantenimiento_anual, inversion,
      }),
    };
  }, [potenciaActual, precioSinIva, precioConIva, hipotesis, perfilFranja, franja]);

  const maxMes = Math.max(...energia.mensual, 1);
  const setH = (k: keyof HipotesisFV, v: number | boolean) => setHipotesis({ ...hipotesis, [k]: v });

  return (
    <>
      {/* ── FASE 2 · Consumo del cliente ── */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-bold text-sm">{esGasoil ? '⛽ Gasto actual de gasoil (explotación aislada)' : '⚡ Consumo del cliente'}</h3>
          {!esGasoil && (
            <div className="flex gap-2">
              <button type="button" onClick={descargarPlantilla} className={btnSecundario}><Download className="w-4 h-4" /> Plantilla</button>
              <button type="button" onClick={() => fileRef.current?.click()} className={btnSecundario}><Upload className="w-4 h-4" /> Importar CSV / curva</button>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ''; }} />
            </div>
          )}
        </div>

        {/* MODO GASOIL: el consumo se deduce del gasto de gasoil del grupo electrógeno */}
        {esGasoil ? (
          <div className="space-y-2.5">
            <p className="text-[11px] text-muted">Esta explotación no está conectada a red: funciona con un grupo de gasoil. Indica su gasto y calculamos cuánta energía consume y a qué precio real por kWh, para dimensionar el solar + baterías que lo sustituye.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div>
                <label className={labelCls}>Gasto de gasoil al mes (€)</label>
                <input className={inputCls} type="number" min="0" value={energia.gasoil?.gasto_mensual || ''} onChange={(e) => setGasoil({ gasto_mensual: num(e.target.value) })} placeholder="Ej: 600" />
              </div>
              <div>
                <label className={labelCls}>Precio del litro (€)</label>
                <input className={inputCls} type="number" min="0" step="0.01" value={energia.gasoil?.precio_litro ?? GASOIL_PRECIO_LITRO} onChange={(e) => setGasoil({ precio_litro: num(e.target.value) })} />
              </div>
              <div>
                <label className={labelCls}>kWh por litro (grupo)</label>
                <input className={inputCls} type="number" min="0" step="0.1" value={energia.gasoil?.kwh_litro ?? GASOIL_KWH_LITRO} onChange={(e) => setGasoil({ kwh_litro: num(e.target.value) })} />
              </div>
            </div>
            {gasoilEst && gasoilEst.kwh_anio > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                {[['Gasto anual gasoil', fmtEur2(gasoilEst.gasto_anual)], ['Litros/año', `${gasoilEst.litros_anio.toLocaleString('es-ES')} L`],
                  ['Energía equivalente', `${gasoilEst.kwh_anio.toLocaleString('es-ES')} kWh`], ['Coste real', `${gasoilEst.coste_kwh} €/kWh`]].map(([n, v]) => (
                  <div key={n} className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-2">
                    <p className="text-sm font-black tabular-nums text-amber-300">{v}</p>
                    <p className="text-[9px] uppercase font-bold text-muted">{n}</p>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-secondary">💡 El gasoil sale a <b>{gasoilEst?.coste_kwh || '—'} €/kWh</b> — 2 o 3 veces más caro que la red. Por eso en aislada el solar se amortiza mucho antes.</p>
          </div>
        ) : (
          <>
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
          </>
        )}

        {/* ¿Cuándo es el consumo FUERTE? — ajusta la coincidencia solar y el algoritmo de batería */}
        <div className="pt-2 border-t border-border/30 space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">🕐 ¿Cuándo es el consumo fuerte del cliente?</p>
          <div className="flex gap-1.5 flex-wrap">
            {FRANJAS_CONSUMO.map((f) => (
              <button key={f} type="button"
                onClick={() => setEnergia({ ...energia, franja: energia.franja === f ? null : f })}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition ${
                  energia.franja === f ? 'bg-amber-400/20 text-amber-300 border-amber-400/50 ring-1 ring-amber-400/40' : 'bg-card/60 text-muted border-border/40 hover:border-amber-400/40'
                }`}>
                {FRANJA_LABEL[f]}
              </button>
            ))}
          </div>
          {perfilFranja ? (
            <p className="text-[11px] text-amber-200/90 bg-amber-500/5 border border-amber-500/20 rounded-lg p-2">
              💡 <b>Coincidencia solar directa ≈ {perfilFranja.coincidencia} %</b> · batería: utilidad {perfilFranja.utilBateria}. {perfilFranja.explicacion}
            </p>
          ) : (
            <p className="text-[10px] text-muted">Sin franja indicada, los escenarios usan el «% autoconsumo» de las hipótesis. Elegirla afina la coincidencia solar y el cálculo de batería.</p>
          )}
        </div>

        {/* Estacionalidad: producción mes a mes vs consumo (en verano se produce el doble que en invierno) */}
        {potenciaActual > 0 && (() => {
          const prodMes = produccionMensual(potenciaActual * hipotesis.prod_especifica);
          const consMes = anual > 0 && !esGasoil ? energia.mensual : produccionMensual(anual).map(() => anual / 12); // consumo real, o plano si viene de gasoil
          const maxV = Math.max(...prodMes, ...consMes, 1);
          return (
            <div className="pt-2 border-t border-border/30 space-y-1.5">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">📅 Producción mes a mes vs consumo</p>
                <p className="text-[10px] text-muted"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400/70 align-middle"></span> producción solar · <span className="inline-block w-2.5 h-2.5 rounded-sm bg-secondary/60 align-middle"></span> {esGasoil ? 'consumo (estimado)' : 'consumo'}</p>
              </div>
              <div className="grid grid-cols-12 gap-1">
                {MESES_CORTO.map((m, i) => (
                  <div key={m} className="flex flex-col items-center gap-0.5">
                    <div className="w-full h-20 flex items-end justify-center gap-0.5">
                      <div className="w-1/2 bg-amber-400/70 rounded-t" style={{ height: `${(prodMes[i] / maxV) * 100}%` }} title={`Producción ${m}: ${Math.round(prodMes[i]).toLocaleString('es-ES')} kWh`} />
                      <div className="w-1/2 bg-secondary/60 rounded-t" style={{ height: `${(consMes[i] / maxV) * 100}%` }} title={`Consumo ${m}: ${Math.round(consMes[i]).toLocaleString('es-ES')} kWh`} />
                    </div>
                    <p className="text-[8px] text-muted">{m}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted">☀️ En verano se produce más del doble que en invierno. Donde la barra amarilla supera a la azul hay <b>excedente</b> (batería o vertido a red); donde no llega, se completa con red{esGasoil ? ' o grupo' : ''}.</p>
            </div>
          );
        })()}
      </Card>

      {/* ── Hipótesis (visibles y editables) ── */}
      <Card className="space-y-2">
        <h3 className="font-bold text-sm">🔧 Hipótesis de la estimación (editables)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {([['prod_especifica', 'Producción (kWh/kWp/año)'], ['pct_autoconsumo', '% autoconsumo'], ['precio_kwh', '€/kWh evitado'],
            ['precio_compensacion', '€/kWh excedente'], ['mantenimiento_anual', 'Mantenimiento €/año']] as const).map(([k, n]) => (
            <div key={k}>
              <label className={labelCls}>{n}{k === 'mantenimiento_anual' && !mantTocado && panelesActuales > 0 ? ` (auto: ${panelesActuales}×10)` : ''}</label>
              <input className={inputCls} type="number" min="0" step="0.01" value={hipotesis[k]}
                onChange={(e) => { if (k === 'mantenimiento_anual') setMantTocado(true); setH(k, num(e.target.value)); }} />
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
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-bold text-sm">📊 Escenarios de dimensionado</h3>
            <button type="button" onClick={imprimirComparativa} className={`${btnPrimario} !py-1.5 !text-xs`}>
              🖨️ Imprimir comparativa de las 3 opciones
            </button>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {escenarios.map((e) => (
              <div key={e.nombre} className="rounded-xl border border-border/40 bg-card/50 p-3 space-y-1 text-xs">
                <p className="font-black text-sm">{e.nombre} <span className="text-[10px] font-semibold text-muted">(cubre el {Math.round(e.factor * 100)} % del consumo)</span></p>
                <p><b className="tabular-nums">{e.kwp} kWp</b> · {e.paneles} paneles · {r2(e.produccion).toLocaleString('es-ES')} kWh/año</p>
                <p className="text-muted">
                  Autoconsumo directo {e.coincidencia} %{e.opt.elegida.codigo ? <> + batería → <b className="text-foreground">{e.pctAuto} % efectivo</b></> : <> (sin batería)</>} · cobertura ≈{e.cobertura} %
                </p>
                <p>Inversión ≈ <b className="tabular-nums">{fmtEur2(e.inversion)}</b></p>
                <p className="text-emerald-400 font-bold">Ahorro ≈ {fmtEur2(e.ahorro)}/año · amortiza en {e.amortizacion ?? '—'} años</p>

                {/* Decisión del algoritmo: comparación de opciones de batería */}
                <div className="pt-1.5 mt-1 border-t border-border/30 space-y-0.5">
                  <p className="text-[10px] font-bold uppercase text-muted">🔋 Algoritmo batería (elige la menor amortización)</p>
                  {e.opt.opciones.map((o: OpcionBateria) => (
                    <p key={o.nombre} className={`text-[10px] flex justify-between gap-2 ${o.elegida ? 'text-emerald-400 font-bold' : 'text-muted'}`}>
                      <span>{o.elegida ? '✓ ' : ''}{o.nombre}{o.capacidad_util ? ` (${o.capacidad_util} kWh útiles)` : ''}</span>
                      <span className="tabular-nums shrink-0">{o.amortizacion != null ? `${o.amortizacion} años` : '—'}</span>
                    </p>
                  ))}
                  <p className="text-[10px] text-secondary leading-snug">📐 {e.marginal.texto}</p>
                </div>

                {/* Equipos del escenario */}
                <div className="pt-1.5 mt-1 border-t border-border/30 text-[10px] text-muted space-y-0.5">
                  <p>⚡ {e.rec.inversor?.descripcion || 'Inversor a estudiar'}</p>
                  <p>🔧 {e.rec.instalacion?.descripcion || 'Instalación a valorar'}</p>
                  {e.rec.instalacionNota && <p className="text-amber-300">⚠️ {e.rec.instalacionNota}</p>}
                </div>

                {/* Todos los cálculos, línea a línea, con su fuente */}
                <details className="mt-1 rounded-lg bg-background/40 border border-border/30">
                  <summary className="px-2 py-1.5 text-[11px] font-bold cursor-pointer select-none text-secondary">🧮 Ver todos los cálculos y su justificación</summary>
                  <div className="px-2 pb-2 space-y-1.5">
                    {e.justificacion.map((l: LineaJustificacion) => (
                      <div key={l.concepto} className="border-b border-border/20 pb-1 last:border-0">
                        <p className="flex justify-between gap-2"><b>{l.concepto}</b><span className="tabular-nums text-right">{l.valor}</span></p>
                        <p className="text-[10px] text-muted">{l.formula}</p>
                        <p className="text-[9px] text-muted/70">📌 {l.fuente}</p>
                      </div>
                    ))}
                  </div>
                </details>

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
              [`Autoconsumo aplicado (${analisis.fuentePct})`, `${analisis.pctUsado} %`],
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
