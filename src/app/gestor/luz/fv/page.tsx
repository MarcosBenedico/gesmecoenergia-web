'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calculator, Plus, X, RefreshCw, FileText, Archive, Trash2, ChevronLeft } from 'lucide-react';
import { GuardiaAdmin } from '@/components/guardia-modulo';
import { LuzCliente } from '@/lib/luz';
import {
  calcularFV, validarEntradaFV, advertenciasFV, margenPorDefecto,
  INGENIERIA_DEFECTO, LIMITE_KW, ESTADOS_FV, ESTADO_FV_LABEL, ESTADOS_FV_PROTEGIDOS,
  PartidaFV, importePartida, precioAjustado, costeDirecto, numeroPaneles, confianzaGlobal,
  CONFIANZA_LABEL, POTENCIA_PANEL_W, fmtEur2, r2, PERFIL_FRANJA, FRANJA_LABEL,
  estimarAyudas, IRPF_PCT_DEDUCCION, IRPF_BASE_MAXIMA, IBI_PCT_ORIENTATIVO, IBI_ANIOS_ORIENTATIVO,
  PERFILES_CLIENTE, PERFIL_LABEL, PERFIL_TEXTO, produccionMensual, MESES_CORTO, estimarGasoil,
} from '@/lib/fv';
import { Card, EstadoCarga, useListaLuz, inputCls, labelCls, btnPrimario, btnSecundario, SelectorResponsable } from '../ui';
import { tokenSesion } from '@/lib/usuario';
import { EnergiaEscenarios, EnergiaFV, HipotesisFV, ENERGIA_VACIA, HIPOTESIS_DEFECTO } from './energia';
import { supabase } from '@/lib/supabase';

const BUCKET_FV = 'documentos_fv';

/** Documento adjunto: archivo subido al almacén (path) o enlace externo (url). */
interface DocFV { nombre: string; path?: string; url?: string; tipo?: string; subido_en?: string }

/** Llamada autenticada a la API de la calculadora. */
async function apiFV(metodo: string, body?: Record<string, unknown>, qs = '') {
  const token = await tokenSesion();
  const res = await fetch(`/api/fv${qs}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

interface PresupuestoFV {
  id: string; cliente_id: string | null; cliente_nombre: string | null; nombre_proyecto: string;
  potencia_kw: number; presupuesto_instalador: number; coste_ingenieria: number; otros_costes: number;
  coste_base: number; margen_pct: number; motivo_margen: string | null; margen_importe: number;
  precio_sin_iva: number; iva_pct: number; iva_importe: number; precio_con_iva: number;
  estado: string; responsable: string | null; observaciones: string | null;
  documentos: DocFV[]; creado_por: string | null; modificado_por: string | null;
  aprobado_por: string | null; creado_en: string; actualizado_en: string;
}

const PARTIDA_NUEVA: PartidaFV = {
  concepto: 'Otros', proveedor: '', descripcion: '', cantidad: 1, precio_unitario: 0, incluido: true, observaciones: '',
  codigo_catalogo: null, marca: null, ajuste_pct: 0, ajuste_fijo: 0, opcional: false, visible_cliente: true,
  fuente: null, confianza: 'media', motivo_ajuste: null,
};

interface RefCat { id: string; codigo: string; categoria: string; descripcion: string; marca: string | null; unidad: string; precio_base: number; confianza: string; advertencia: string | null; num_referencias: number; activo: boolean }

const FORM_VACIO = {
  cliente_id: '', nombre_proyecto: '', perfil: 'residencial', potencia_kw: '', presupuesto_instalador: '',
  coste_ingenieria: String(INGENIERIA_DEFECTO), margen_pct: '', motivo_margen: '',
  iva_pct: '21', iva_otro: '', responsable: '', observaciones: '',
};

export default function CalculadoraFVPage() {
  return (
    <GuardiaAdmin nombre="Calculadora FV">
      <CalculadoraFV />
    </GuardiaAdmin>
  );
}

function CalculadoraFV() {
  const clientes = useListaLuz<LuzCliente>('clientes');
  const [lista, setLista] = useState<PresupuestoFV[]>([]);
  const [cargando, setCargando] = useState(true);
  const [faltaMigracion, setFaltaMigracion] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const [editandoId, setEditandoId] = useState<string | null>(null); // null = lista · 'nuevo' = alta
  const [eligiendoTipo, setEligiendoTipo] = useState(false);          // pantalla "¿qué quieres hacer?"
  const [mostrarEstudio, setMostrarEstudio] = useState(false);        // estudio de ahorro opcional en el flujo de Óscar
  const [form, setForm] = useState(FORM_VACIO);
  const [conceptos, setConceptos] = useState<PartidaFV[]>([]);
  const [modo, setModo] = useState<'simple' | 'partidas'>('simple');
  const [catalogo, setCatalogo] = useState<RefCat[]>([]);
  const [avisoCat, setAvisoCat] = useState('');
  const [energia, setEnergia] = useState<EnergiaFV>(ENERGIA_VACIA);
  const [hipotesis, setHipotesis] = useState<HipotesisFV>(HIPOTESIS_DEFECTO);

  // Catálogo de precios (para el selector de partidas)
  useEffect(() => {
    (async () => {
      const token = await tokenSesion();
      const res = await fetch('/api/fv/catalogo', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setCatalogo((json.datos || []).filter((c: RefCat) => c.activo));
    })();
  }, []);

  /** Partida desde una referencia del catálogo (precio, fuente y confianza vienen de ahí). */
  function partidaDesdeCatalogo(codigo: string, cantidad = 1): PartidaFV | null {
    const c = catalogo.find((x) => x.codigo === codigo);
    if (!c) return null;
    if (c.advertencia) setAvisoCat(`⚠️ ${c.codigo}: ${c.advertencia}`);
    return {
      ...PARTIDA_NUEVA,
      concepto: c.categoria, codigo_catalogo: c.codigo, descripcion: c.descripcion, marca: c.marca || '',
      cantidad, precio_unitario: Number(c.precio_base),
      fuente: `Catálogo · ${c.num_referencias} presupuesto(s) de Óscar`, confianza: c.confianza,
    };
  }
  const [docs, setDocs] = useState<DocFV[]>([]);
  const [docNuevo, setDocNuevo] = useState({ nombre: '', url: '' });
  const [subiendo, setSubiendo] = useState(false);

  /** Sube un archivo al almacén privado y lo apunta en la lista de documentos. */
  async function subirArchivo(archivo: File) {
    if (!editandoId || editandoId === 'nuevo') { setError('Guarda primero el presupuesto para poder adjuntar archivos.'); return; }
    if (archivo.size > 25 * 1024 * 1024) { setError('El archivo supera los 25 MB.'); return; }
    setSubiendo(true); setError('');
    const limpio = archivo.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${editandoId}/${Date.now()}_${limpio}`;
    const { error: e } = await supabase.storage.from(BUCKET_FV).upload(path, archivo, { upsert: false });
    setSubiendo(false);
    if (e) {
      setError(/bucket/i.test(e.message)
        ? 'Falta el almacén de documentos: ejecuta supabase_fv_storage.sql en el SQL Editor de Supabase.'
        : `No se pudo subir: ${e.message}`);
      return;
    }
    const nuevos = [...docs, { nombre: archivo.name, path, tipo: archivo.type || 'archivo', subido_en: new Date().toISOString() }];
    setDocs(nuevos);
    // Persistir la lista al momento (sin esperar al botón Guardar)
    await apiFV('PUT', { id: editandoId, archivado: false, documentos: nuevos, solo_documentos: true });
    setMsg(`✓ "${archivo.name}" subido y guardado.`);
  }

  /** Descarga segura: enlace firmado de 1 hora (el bucket es privado). */
  async function descargarDoc(d: DocFV) {
    if (d.url) { window.open(d.url, '_blank'); return; }
    if (!d.path) return;
    const { data, error: e } = await supabase.storage.from(BUCKET_FV).createSignedUrl(d.path, 3600, { download: d.nombre });
    if (e || !data?.signedUrl) { setError('No se pudo generar la descarga: ' + (e?.message || 'error')); return; }
    window.open(data.signedUrl, '_blank');
  }

  async function eliminarDoc(i: number) {
    const d = docs[i];
    if (!confirm(`¿Quitar "${d.nombre}" del presupuesto?${d.path ? ' El archivo se borrará del almacén.' : ''}`)) return;
    if (d.path) await supabase.storage.from(BUCKET_FV).remove([d.path]);
    const nuevos = docs.filter((_, j) => j !== i);
    setDocs(nuevos);
    if (editandoId && editandoId !== 'nuevo') {
      await apiFV('PUT', { id: editandoId, archivado: false, documentos: nuevos, solo_documentos: true });
    }
  }
  const [margenTocado, setMargenTocado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const { ok, json } = await apiFV('GET');
    if (!ok) { setFaltaMigracion(!!json.falta_migracion); setError(json.error || 'Error.'); setCargando(false); return; }
    setLista(json.datos); setError(''); setFaltaMigracion(false); setCargando(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  // ── Cálculo en vivo (misma librería que valida el servidor) ──
  const potencia = parseFloat(form.potencia_kw) || 0;
  const margenDefecto = margenPorDefecto(potencia);
  const margenUsado = form.margen_pct === '' ? margenDefecto : parseFloat(form.margen_pct) || 0;
  const ivaUsado = form.iva_pct === 'otro' ? (parseFloat(form.iva_otro) || 0) : parseFloat(form.iva_pct);
  const otros = useMemo(() => costeDirecto(conceptos), [conceptos]);
  const conceptosFuera = conceptos.filter((c) => !c.incluido && c.concepto.trim()).length;
  // Ingeniería duplicada: si ya está como partida, la regla no la vuelve a sumar
  const ingenieriaEnPartidas = conceptos.some((c) => c.incluido && (c.codigo_catalogo === 'ING-EXT' || /ingenier/i.test(c.concepto)));
  const entrada = {
    potencia_kw: potencia,
    presupuesto_instalador: modo === 'partidas' ? 0 : parseFloat(form.presupuesto_instalador) || 0,
    coste_ingenieria: ingenieriaEnPartidas ? 0 : parseFloat(form.coste_ingenieria) || 0,
    margen_pct: margenUsado,
    iva_pct: ivaUsado,
    otros_costes: otros,
  };
  const resultado = useMemo(() => calcularFV(entrada), [entrada.potencia_kw, entrada.presupuesto_instalador, entrada.coste_ingenieria, entrada.margen_pct, entrada.iva_pct, entrada.otros_costes]); // eslint-disable-line react-hooks/exhaustive-deps
  const erroresEntrada = validarEntradaFV(entrada).filter((e) => !(modo === 'partidas' && e.includes('presupuesto del instalador')))
    .concat(modo === 'partidas' && otros <= 0 ? ['Añade al menos una partida incluida en el coste base.'] : []);
  const avisos = advertenciasFV(entrada);
  const margenModificado = margenUsado !== margenDefecto;
  const confianza = confianzaGlobal(conceptos);
  const paneles = numeroPaneles(potencia);

  // Al cambiar la potencia de tramo, el margen vuelve al predeterminado salvo que se haya tocado a mano
  useEffect(() => {
    if (!margenTocado) setForm((f) => ({ ...f, margen_pct: '' }));
  }, [potencia > LIMITE_KW]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Alta nueva con el flujo elegido: 'simple' = presupuesto de Óscar · 'partidas' = dimensionado desde consumos. */
  function abrirNuevo(tipo: 'simple' | 'partidas') {
    setForm(FORM_VACIO); setConceptos([]); setDocs([]); setMargenTocado(false); setModo(tipo); setAvisoCat('');
    setEnergia(ENERGIA_VACIA); setHipotesis(HIPOTESIS_DEFECTO); setMostrarEstudio(false);
    setEligiendoTipo(false); setEditandoId('nuevo'); setMsg(''); setError('');
  }

  async function abrirExistente(p: PresupuestoFV) {
    const { ok, json } = await apiFV('GET', undefined, `?id=${p.id}`);
    if (!ok) { setError(json.error || 'Error.'); return; }
    const d: PresupuestoFV = json.dato;
    setForm({
      cliente_id: d.cliente_id || '', nombre_proyecto: d.nombre_proyecto,
      perfil: (d as unknown as { dimensionado?: { perfil?: string } }).dimensionado?.perfil || 'residencial',
      potencia_kw: String(d.potencia_kw), presupuesto_instalador: String(d.presupuesto_instalador),
      coste_ingenieria: String(d.coste_ingenieria),
      margen_pct: String(d.margen_pct), motivo_margen: d.motivo_margen || '',
      iva_pct: [21, 10].includes(Number(d.iva_pct)) ? String(Number(d.iva_pct)) : 'otro',
      iva_otro: [21, 10].includes(Number(d.iva_pct)) ? '' : String(d.iva_pct),
      responsable: d.responsable || '', observaciones: d.observaciones || '',
    });
    setConceptos((json.conceptos || []).map((c: PartidaFV) => ({ ...PARTIDA_NUEVA, ...c })));
    setModo(((d as unknown as { modo?: string }).modo === 'partidas') ? 'partidas' : 'simple');
    const dim = (d as unknown as { dimensionado?: { energia?: EnergiaFV; hipotesis?: HipotesisFV } }).dimensionado || {};
    setEnergia(dim.energia || ENERGIA_VACIA);
    setHipotesis(dim.hipotesis || HIPOTESIS_DEFECTO);
    // El estudio de ahorro solo se muestra en el flujo de Óscar si ya tiene datos guardados
    setMostrarEstudio(!!dim.energia && (dim.energia.consumo_anual || 0) > 0);
    setDocs(d.documentos || []);
    setMargenTocado(true);
    setEditandoId(p.id); setMsg(''); setError('');
  }

  async function guardar() {
    setGuardando(true); setError(''); setMsg('');
    const body = {
      ...(editandoId !== 'nuevo' ? { id: editandoId } : {}),
      cliente_id: form.cliente_id || null,
      nombre_proyecto: form.nombre_proyecto,
      potencia_kw: potencia,
      presupuesto_instalador: parseFloat(form.presupuesto_instalador) || 0,
      coste_ingenieria: parseFloat(form.coste_ingenieria) || 0,
      margen_pct: margenUsado,
      motivo_margen: form.motivo_margen || null,
      iva_pct: ivaUsado,
      responsable: form.responsable || null,
      observaciones: form.observaciones || null,
      documentos: docs,
      modo,
      dimensionado: { num_paneles: paneles, potencia_panel_w: POTENCIA_PANEL_W, perfil: form.perfil, energia, hipotesis },
      conceptos: conceptos.filter((c) => c.concepto.trim()),
    };
    const { ok, json } = await apiFV(editandoId === 'nuevo' ? 'POST' : 'PUT', body);
    setGuardando(false);
    if (!ok) { setError(json.error || 'No se pudo guardar.'); return; }
    setMsg(json.aviso ? `✓ Guardado. ${json.aviso}` : '✓ Presupuesto guardado.');
    if (editandoId === 'nuevo' && json.dato?.id) setEditandoId(json.dato.id);
    cargar();
  }

  async function cambiarEstado(p: PresupuestoFV, estado: string) {
    const { ok, json } = await apiFV('PUT', { id: p.id, estado });
    if (!ok) { setError(json.error || 'Error.'); return; }
    setError(''); setMsg(`✓ Estado: ${ESTADO_FV_LABEL[estado]}.`);
    cargar();
  }

  async function eliminar(p: PresupuestoFV) {
    if (ESTADOS_FV_PROTEGIDOS.includes(p.estado)) {
      if (!confirm(`"${p.nombre_proyecto}" está ${ESTADO_FV_LABEL[p.estado].toLowerCase()}: no se elimina, se ARCHIVA (queda en el historial). ¿Archivar?`)) return;
      await apiFV('PUT', { id: p.id, archivado: true });
    } else {
      if (!confirm(`¿Eliminar el borrador "${p.nombre_proyecto}"?`)) return;
      const { ok, json } = await apiFV('DELETE', { id: p.id });
      if (!ok) { setError(json.error || 'Error.'); return; }
    }
    cargar();
  }

  /** Vista cliente: documento imprimible SIN costes internos ni márgenes. */
  function generarVistaCliente() {
    const clienteNombre = clientes.datos.find((c) => c.id === form.cliente_id)?.nombre || '';
    const hoy = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    const validez = new Date(Date.now() + 15 * 86400000).toLocaleDateString('es-ES');
    const conIngenieria = potencia > LIMITE_KW;
    const ref = `FV-${new Date().getFullYear()}-${(editandoId && editandoId !== 'nuevo' ? editandoId : Date.now().toString(16)).slice(0, 6).toUpperCase()}`;
    const logo = `${window.location.origin}/logo-gesmeco.png`;
    const entrada60 = fmtEur2(resultado.precio_con_iva * 0.6);
    const resto40 = fmtEur2(resultado.precio_con_iva * 0.4);
    // ── Intro adaptada al perfil del cliente (residencial, empresa, granja...) ──
    const pf = PERFIL_TEXTO[form.perfil] || PERFIL_TEXTO.residencial;
    const bloqueIntro = `<h2>${pf.titular}</h2>
<p style="font-size:.98rem">${pf.intro}</p>
<ul>${pf.puntos.map((p) => `<li>${p}</li>`).join('')}</ul>`;

    // ── Granja aislada: comparación con el grupo de gasoil ──
    let bloqueGasoil = '';
    if (form.perfil === 'granja_aislada' && energia.gasoil && energia.gasoil.gasto_mensual > 0) {
      const g = estimarGasoil({ gastoMensual: energia.gasoil.gasto_mensual, precioLitro: energia.gasoil.precio_litro, kwhLitro: energia.gasoil.kwh_litro });
      bloqueGasoil = `<h2>Su situación actual: grupo de gasoil</h2>
<table><thead><tr><th>Concepto</th><th>Cálculo</th><th class="num">Valor</th></tr></thead><tbody>
<tr><td>Gasto de gasoil</td><td>${fmtEur2(energia.gasoil.gasto_mensual)}/mes × 12</td><td class="num">${fmtEur2(g.gasto_anual)}/año</td></tr>
<tr><td>Litros consumidos</td><td>${fmtEur2(g.gasto_anual)} ÷ ${energia.gasoil.precio_litro} €/L</td><td class="num">${g.litros_anio.toLocaleString('es-ES')} L/año</td></tr>
<tr><td>Energía equivalente</td><td>${g.litros_anio.toLocaleString('es-ES')} L × ${energia.gasoil.kwh_litro} kWh/L</td><td class="num">${g.kwh_anio.toLocaleString('es-ES')} kWh/año</td></tr>
<tr class="total"><td>Coste real de su energía hoy</td><td></td><td class="num">${g.coste_kwh} €/kWh</td></tr>
</tbody></table>
<p class="muted">El gasoil le cuesta <b>${g.coste_kwh} €/kWh</b> —además del ruido, el mantenimiento del grupo y los rellenos—. Cada kWh que produzca el sol es gasoil que deja de quemar. Por eso en una explotación aislada la instalación se amortiza mucho antes que conectada a red.</p>`;
    }

    // ── Gráfico SVG mensual: producción vs consumo real + ahorro mes a mes + proyección 25 años ──
    let bloqueEstacional = '';
    if (potencia > 0) {
      const prodMes = produccionMensual(potencia * hipotesis.prod_especifica);
      const pctAutoE = hipotesis.pct_autoconsumo; // autoconsumo efectivo (incluye batería si se montó escenario)
      const hayConsumo = energia.mensual.some((v) => v > 0);
      const consMes = hayConsumo ? energia.mensual : prodMes.map(() => 0);

      // Balance mes a mes: autoconsumo (limitado por el consumo real), excedente y energía de red evitada
      let ahorroReal = 0, autoTotal = 0, excTotal = 0, consTotal = 0;
      const detalle = prodMes.map((p, i) => {
        const c = consMes[i];
        const auto = hayConsumo ? Math.min(p * (pctAutoE / 100), c) : p * (pctAutoE / 100);
        const exc = Math.max(p - auto, 0);
        ahorroReal += auto * hipotesis.precio_kwh + exc * hipotesis.precio_compensacion;
        autoTotal += auto; excTotal += exc; consTotal += c;
        return { p, c, auto, exc };
      });
      ahorroReal = r2(ahorroReal - hipotesis.mantenimiento_anual);
      const invE = hipotesis.analisis_con_iva ? resultado.precio_con_iva : resultado.precio_sin_iva;
      const amortReal = ahorroReal > 0 ? r2(invE / ahorroReal) : null;
      const kwhE = (n: number) => Math.round(n).toLocaleString('es-ES');
      const coberturaReal = consTotal > 0 ? Math.min(r2((autoTotal / consTotal) * 100), 100) : null;

      // Gráfico de barras en SVG (imprime perfecto): producción (naranja) vs consumo (azul)
      const W = 680, H = 210, ml = 44, mb = 26, mt = 16;
      const plotH = H - mt - mb, plotW = W - ml - 8;
      const maxV = Math.max(...prodMes, ...consMes, 1);
      const niceMax = Math.ceil(maxV / 500) * 500 || 500;
      const gw = plotW / 12;
      const bw = hayConsumo ? Math.min(gw / 3, 16) : Math.min(gw / 2, 22);
      const yAt = (v: number) => mt + plotH - (v / niceMax) * plotH;
      const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = mt + plotH - f * plotH;
        return `<line x1="${ml}" y1="${y}" x2="${W - 8}" y2="${y}" stroke="#eee" stroke-width="1"/><text x="${ml - 6}" y="${y + 3}" text-anchor="end" font-size="9" fill="#9a9aa8">${kwhE(niceMax * f)}</text>`;
      }).join('');
      const barras = detalle.map((d, i) => {
        const cx = ml + i * gw + gw / 2;
        const px = hayConsumo ? cx - bw - 1 : cx - bw / 2;
        const rects = `<rect x="${px}" y="${yAt(d.p)}" width="${bw}" height="${mt + plotH - yAt(d.p)}" rx="2" fill="#ff9500"/>`
          + (hayConsumo ? `<rect x="${cx + 1}" y="${yAt(d.c)}" width="${bw}" height="${mt + plotH - yAt(d.c)}" rx="2" fill="#0088bb"/>` : '');
        return rects + `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="9" fill="#5c5c6e">${MESES_CORTO[i]}</text>`;
      }).join('');
      const chart = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:100%;height:auto">${grid}${barras}</svg>`;

      // Proyección a 25 años (vida útil de los módulos) y CO2 evitado
      const proyeccion25 = amortReal != null ? r2(ahorroReal * 25 - invE) : null;
      const co2Anual = r2((potencia * hipotesis.prod_especifica) * 0.19 / 1000); // t CO2/año (mix eléctrico ~0,19 kg/kWh)

      bloqueEstacional = `<h2>Qué pasará cuando tenga las placas</h2>
<p style="font-size:.92rem;color:#3a3a4a">El sol no produce igual todo el año: en verano genera más del doble que en invierno. ${hayConsumo ? 'Este es el reparto de la producción de sus placas frente a <b>su consumo real</b>, mes a mes:' : 'Este es el reparto de la producción estimada de su instalación:'}</p>
<div style="margin:.5rem 0">${chart}</div>
<p style="font-size:.82rem;margin:.2rem 0 1rem"><span style="display:inline-block;width:12px;height:12px;background:#ff9500;border-radius:2px;vertical-align:middle"></span> Producción solar${hayConsumo ? ' &nbsp;&nbsp; <span style="display:inline-block;width:12px;height:12px;background:#0088bb;border-radius:2px;vertical-align:middle"></span> Su consumo real' : ''}</p>
${hayConsumo ? `<table><thead><tr><th>Qué hará su energía en un año</th><th class="num">kWh/año</th><th class="num">%</th></tr></thead><tbody>
<tr><td>☀️ Producción total de sus placas</td><td class="num">${kwhE(prodMes.reduce((s, p) => s + p, 0))}</td><td class="num">100 %</td></tr>
<tr><td>🏠 Energía que aprovecha usted mismo (deja de comprar a la red)</td><td class="num">${kwhE(autoTotal)}</td><td class="num">${coberturaReal ?? '—'} % de su consumo</td></tr>
<tr><td>🔄 Excedente que vierte a la red (se le compensa en factura)</td><td class="num">${kwhE(excTotal)}</td><td class="num"></td></tr>
</tbody></table>` : ''}
<div class="calc" style="background:#eafaf0;border-color:#bfe6cf">
  <div style="display:flex;gap:1.5rem;flex-wrap:wrap;justify-content:space-around;text-align:center">
    <div><div style="font-size:1.5rem;font-weight:900;color:#0a8a4a">${fmtEur2(ahorroReal)}</div><div style="font-size:.72rem;color:#5c5c6e">AHORRO ESTIMADO AL AÑO</div></div>
    ${amortReal != null ? `<div><div style="font-size:1.5rem;font-weight:900;color:#e11d48">${amortReal} años</div><div style="font-size:.72rem;color:#5c5c6e">EN RECUPERAR LA INVERSIÓN</div></div>` : ''}
    ${proyeccion25 != null ? `<div><div style="font-size:1.5rem;font-weight:900;color:#0a8a4a">${fmtEur2(proyeccion25)}</div><div style="font-size:.72rem;color:#5c5c6e">AHORRO NETO EN 25 AÑOS</div></div>` : ''}
    <div><div style="font-size:1.5rem;font-weight:900;color:#0a8a4a">${co2Anual} t</div><div style="font-size:.72rem;color:#5c5c6e">CO₂ EVITADO AL AÑO</div></div>
  </div>
</div>
<p class="muted">${hayConsumo ? 'El ahorro se calcula cruzando mes a mes la producción de las placas con su consumo real —no con una media—: es la estimación más ajustada a su caso. ' : ''}A partir del año de amortización, todo lo que ahorra es beneficio: los módulos tienen una vida útil de unos 25 años. La proyección a 25 años no aplica inflación de la luz (si sube, ahorrará más). Cifras orientativas pendientes de validación técnica.</p>`;
    }

    // ── Ficha técnica: consumo medido, dimensionado, equipos y por qué de cada uno ──
    let bloqueTecnico = '';
    if (potencia > 0) {
      const nPaneles = paneles || numeroPaneles(potencia);
      const kwpReal = r2((nPaneles * POTENCIA_PANEL_W) / 1000);
      const consumoAnual = energia.consumo_anual || 0;
      const prodAnual = potencia * hipotesis.prod_especifica;
      const franjaT = energia.franja || null;
      const pctAutoT = hipotesis.pct_autoconsumo; // autoconsumo efectivo (incluye batería si se montó escenario)
      const coberturaT = consumoAnual > 0 ? Math.min(r2((prodAnual * (pctAutoT / 100)) / consumoAnual * 100), 100) : null;
      const partidaCat = (cats: string[]) => conceptos.find((c) => c.incluido && cats.includes((c.concepto || '').toLowerCase()));
      const inversorP = partidaCat(['inversores', 'inversor']);
      const bateriaP = partidaCat(['baterias', 'batería', 'bateria']);
      const kwhT = (n: number) => Math.round(n).toLocaleString('es-ES');
      const filas: string[] = [
        consumoAnual > 0 ? `<tr><td>Consumo anual analizado</td><td>Suma de los 12 meses de su factura eléctrica</td><td class="num">${kwhT(consumoAnual)} kWh</td></tr>` : '',
        `<tr><td>Potencia pico propuesta</td><td>Dimensionado para su perfil de consumo</td><td class="num">${potencia.toLocaleString('es-ES')} kWp</td></tr>`,
        `<tr><td>Módulos fotovoltaicos</td><td>⌈${potencia.toLocaleString('es-ES')} kWp × 1000 ÷ ${POTENCIA_PANEL_W} W⌉ · paneles de ${POTENCIA_PANEL_W} W</td><td class="num">${nPaneles} paneles (${kwpReal} kWp)</td></tr>`,
        `<tr><td>Inversor</td><td>${inversorP ? inversorP.descripcion : `Dimensionado para ${potencia.toLocaleString('es-ES')} kWp`} · instalación ${potencia > LIMITE_KW ? 'trifásica con ingeniería' : 'monofásica'}</td><td class="num">${inversorP ? '✓' : 'a confirmar'}</td></tr>`,
        bateriaP ? `<tr><td>Acumulación (batería)</td><td>${bateriaP.descripcion} · traslada el sol a sus horas de consumo</td><td class="num">✓</td></tr>` : `<tr><td>Acumulación (batería)</td><td>No incluida${franjaT ? ` (su consumo ${FRANJA_LABEL[franjaT].replace(/^\S+\s/, '').toLowerCase()} se aprovecha en directo)` : ''}</td><td class="num">—</td></tr>`,
        `<tr><td>Producción anual estimada</td><td>${potencia.toLocaleString('es-ES')} kWp × ${hipotesis.prod_especifica} kWh/kWp·año · irradiación de Binéfar (ref. PVGIS)</td><td class="num">${kwhT(prodAnual)} kWh</td></tr>`,
        coberturaT != null ? `<tr><td>Cobertura de su consumo</td><td>Energía solar autoconsumida ÷ su consumo anual</td><td class="num">≈ ${coberturaT} %</td></tr>` : '',
      ].filter(Boolean);
      bloqueTecnico = `<h2>Configuración técnica y dimensionado</h2>
<p style="font-size:.9rem;color:#3a3a4a">Cada dato de esta propuesta está calculado a partir de ${consumoAnual > 0 ? 'su consumo real' : 'la potencia acordada'} y de la irradiación solar de la zona: así sabe exactamente qué se instala y por qué.</p>
<table><thead><tr><th>Parámetro</th><th>Justificación</th><th class="num">Valor</th></tr></thead><tbody>
${filas.join('\n')}
</tbody></table>`;
    }

    // ── Ayudas, bonificaciones y deducciones (con calculadora para el cliente) ──
    const ay = estimarAyudas(resultado.precio_con_iva);
    const netoTrasAyudas = fmtEur2(r2(resultado.precio_con_iva - ay.deduccion_irpf));
    const bloqueAyudas = `<h2>Ayudas, bonificaciones y deducciones</h2>
<p style="font-size:.9rem;color:#3a3a4a">Una instalación de autoconsumo da derecho a varias ventajas fiscales. Estas son las habituales; el importe exacto depende de su situación, y <b>nosotros se lo calculamos y tramitamos</b> (somos también asesoría).</p>
<table><thead><tr><th>Ayuda</th><th>Cómo funciona</th><th class="num">Estimación</th></tr></thead><tbody>
<tr><td><b>Deducción en el IRPF</b></td><td>Hasta el <b>${IRPF_PCT_DEDUCCION} %</b> de la inversión (sobre una base máxima de ${fmtEur2(IRPF_BASE_MAXIMA)}) por mejora de la eficiencia energética de la vivienda. Se resta de su declaración de la renta. Requiere certificado energético y tener cuota suficiente.</td><td class="num"><b>hasta ${fmtEur2(ay.deduccion_irpf)}</b></td></tr>
<tr><td><b>Bonificación del IBI</b></td><td>Su ayuntamiento puede bonificar parte del recibo del IBI durante varios años (habitual: ${IBI_PCT_ORIENTATIVO} % · ${IBI_ANIOS_ORIENTATIVO} años). Depende de la ordenanza municipal.</td><td class="num">según municipio</td></tr>
<tr><td><b>Bonificación del ICIO</b></td><td>Reducción de hasta el 95 % del impuesto de construcciones de la licencia de obra.</td><td class="num">según municipio</td></tr>
<tr><td><b>Subvenciones</b></td><td>Según convocatorias autonómicas y europeas vigentes en cada momento. Le avisamos si hay alguna abierta que encaje.</td><td class="num">variable</td></tr>
</tbody></table>

<div class="calc noprint">
  <p style="font-weight:800;margin:0 0 .5rem">🧮 Calcule su deducción de IRPF en 10 segundos</p>
  <p style="font-size:.85rem;color:#3a3a4a;margin:.2rem 0 .7rem">La deducción es el ${IRPF_PCT_DEDUCCION} % de lo que invierte (con un máximo de ${fmtEur2(IRPF_BASE_MAXIMA)} de base), y solo se aplica hasta donde llegue la cuota de IRPF que le sale a pagar. Ajuste su cuota y lo verá al instante:</p>
  <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-end">
    <label style="font-size:.82rem">Importe de su instalación (€)<br><input id="inv" type="number" value="${Math.round(resultado.precio_con_iva)}" style="width:150px;padding:.4rem;font-size:1rem;border:1.5px solid #ccc;border-radius:6px"></label>
    <label style="font-size:.82rem">Su cuota de IRPF del año (€)<br><input id="cuota" type="number" value="3000" style="width:150px;padding:.4rem;font-size:1rem;border:1.5px solid #ccc;border-radius:6px"></label>
  </div>
  <p style="margin:.8rem 0 0;font-size:1.05rem">Deducción estimada: <b id="resDed" style="color:#e11d48">${fmtEur2(ay.deduccion_irpf)}</b> · le costaría realmente <b id="resNeto" style="color:#0a8a4a">${netoTrasAyudas}</b></p>
  <p style="font-size:.72rem;color:#888;margin:.4rem 0 0">Cálculo orientativo: deducción = mín(${IRPF_PCT_DEDUCCION} % × mín(inversión, ${fmtEur2(IRPF_BASE_MAXIMA)}), su cuota de IRPF). Confírmelo con nosotros: cada declaración es distinta.</p>
  <script>
    (function(){
      var inv=document.getElementById('inv'),cuota=document.getElementById('cuota'),rD=document.getElementById('resDed'),rN=document.getElementById('resNeto');
      var eur=function(n){return n.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';};
      function calc(){
        var i=parseFloat(inv.value)||0, c=parseFloat(cuota.value)||0;
        var base=Math.min(i, ${IRPF_BASE_MAXIMA});
        var ded=Math.min(base*${IRPF_PCT_DEDUCCION / 100}, c);
        rD.textContent=eur(ded); rN.textContent=eur(Math.max(i-ded,0));
      }
      inv.addEventListener('input',calc); cuota.addEventListener('input',calc);
    })();
  </script>
</div>
<p class="muted">Gesmeco Energía y Asesoría Gesmeco tramitan por usted la deducción del IRPF y las bonificaciones municipales que le correspondan. Estimaciones orientativas sujetas a la normativa vigente y a su situación fiscal.</p>`;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Presupuesto ${ref} · ${form.nombre_proyecto}</title>
<style>
  :root{--rojo:#e11d48;--oscuro:#131322;--gris:#5c5c6e}
  *{box-sizing:border-box} body{font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#1a1a2e;margin:0;background:#fff}
  .hoja{max-width:800px;margin:0 auto;padding:0 2.2rem 2.5rem}
  .banda{background:var(--oscuro);color:#fff;padding:1.6rem 2.2rem;display:flex;justify-content:space-between;align-items:center;gap:1.5rem}
  .banda img{height:52px;width:auto;display:block}
  .banda .ref{text-align:right;font-size:.8rem;color:#c9c9d6;line-height:1.6}
  .banda .ref b{color:#fff;font-size:1rem;display:block;letter-spacing:.06em}
  .franja{height:5px;background:linear-gradient(90deg,var(--rojo),#ff7a45,#00b7d9)}
  h2{font-size:.78rem;letter-spacing:.22em;text-transform:uppercase;color:var(--rojo);margin:1.9rem 0 .5rem;border-bottom:1px solid #eee;padding-bottom:.35rem}
  .dos{display:flex;gap:2rem} .dos>div{flex:1}
  .caja{background:#f8f8fa;border:1px solid #ececf1;border-radius:10px;padding:.9rem 1.1rem;font-size:.92rem;line-height:1.55}
  .caja b{display:block;font-size:1rem}
  p{line-height:1.6}
  table{width:100%;border-collapse:collapse;margin:.6rem 0}
  td,th{padding:.65rem .9rem;text-align:left;font-size:.95rem}
  thead th{background:var(--oscuro);color:#fff;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase}
  tbody td{border-bottom:1px solid #eee}
  .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .total td{background:var(--rojo);color:#fff;font-weight:800;font-size:1.15rem;border:none}
  .pago{display:flex;gap:1rem;margin:.6rem 0}
  .pago>div{flex:1;border:1.5px solid var(--oscuro);border-radius:10px;padding:.8rem 1rem;text-align:center}
  .pago .pct{font-size:1.5rem;font-weight:900;color:var(--rojo)} .pago .cuando{font-size:.78rem;color:var(--gris);text-transform:uppercase;letter-spacing:.06em}
  .pago .imp{font-weight:700;margin-top:.2rem}
  ul{margin:.4rem 0;padding-left:1.2rem} li{margin:.25rem 0;font-size:.88rem;color:#3a3a4a}
  .firma{margin-top:2.6rem;display:flex;gap:2.5rem}
  .firma div{flex:1;border-top:1.5px solid var(--oscuro);padding-top:.45rem;font-size:.82rem;color:var(--gris)}
  .calc{background:#fff8f9;border:1.5px solid #f3c9d2;border-radius:12px;padding:1rem 1.2rem;margin:.8rem 0}
  .pie{margin-top:2rem;padding-top:.8rem;border-top:1px solid #eee;font-size:.75rem;color:var(--gris);text-align:center}
  @media print{.noprint{display:none} .banda{-webkit-print-color-adjust:exact;print-color-adjust:exact} thead th,.total td,.franja{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="banda">
  <img src="${logo}" alt="Gesmeco Energía">
  <div class="ref"><b>PRESUPUESTO ${ref}</b>Fecha: ${hoy}<br>Validez: 15 días (hasta ${validez})</div>
</div>
<div class="franja"></div>
<div class="hoja">

<div class="dos">
  <div><h2>Cliente</h2><div class="caja"><b>${clienteNombre || '—'}</b></div></div>
  <div><h2>Emitido por</h2><div class="caja"><b>Gesmeco Energía</b>Avenida de Aragón, 50 · 22500 Binéfar (Huesca)<br>www.gesmecoenergia.com</div></div>
</div>

<h2>Proyecto</h2>
<p><b style="font-size:1.05rem">${form.nombre_proyecto || 'Instalación fotovoltaica'}</b><br>
Instalación solar fotovoltaica de <b>${potencia.toLocaleString('es-ES')} kW</b> <b>llave en mano</b>: suministro e instalación de módulos
fotovoltaicos, inversor, estructura, cableado y protecciones eléctricas, ${conIngenieria ? 'ingeniería, ' : ''}legalización, tramitación de boletines
y puesta en marcha de la instalación.</p>
<p style="background:#f8f8fa;border-left:3px solid #e11d48;border-radius:0 8px 8px 0;padding:.7rem .9rem;font-size:.9rem;color:#3a3a4a">
🤝 <b>Usted no se preocupa de nada.</b> Nos encargamos de todos los trámites que la ley nos permite gestionar en su nombre —
${conIngenieria ? 'proyecto de ingeniería, ' : ''}legalización, boletines, permisos de acceso y conexión, alta de autoconsumo y solicitud de compensación de excedentes—
para que usted solo tenga que disfrutar del ahorro. Estamos en Binéfar, a un teléfono de distancia, antes, durante y después de la instalación.</p>

${bloqueIntro}
${bloqueGasoil}
${bloqueTecnico}
${bloqueEstacional}
${bloqueAyudas}
<h2>Oferta económica</h2>
<table>
<thead><tr><th>Concepto</th><th class="num">Importe</th></tr></thead>
<tbody>
<tr><td>Instalación fotovoltaica de ${potencia.toLocaleString('es-ES')} kW · llave en mano</td><td class="num">${fmtEur2(resultado.precio_sin_iva)}</td></tr>
<tr><td>IVA (${ivaUsado.toLocaleString('es-ES')} %)</td><td class="num">${fmtEur2(resultado.iva_importe)}</td></tr>
</tbody>
<tr class="total"><td>TOTAL</td><td class="num">${fmtEur2(resultado.precio_con_iva)}</td></tr>
</table>

<h2>Forma de pago</h2>
<div class="pago">
  <div><div class="pct">60 %</div><div class="cuando">A la aceptación · compra de materiales</div><div class="imp">${entrada60}</div></div>
  <div><div class="pct">40 %</div><div class="cuando">Al finalizar el montaje</div><div class="imp">${resto40}</div></div>
</div>

<h2>Condiciones</h2>
<ul>
<li>Presupuesto válido durante 15 días desde la fecha de emisión.</li>
<li>Plazo de ejecución a acordar tras la aceptación del presupuesto.</li>
<li>Instalación llave en mano: incluye ${conIngenieria ? 'ingeniería, ' : ''}legalización y tramitación de boletines. No incluye trabajos no descritos en este documento.</li>
<li>Garantías de fabricante en módulos e inversor; garantía de instalación según normativa vigente.</li>
</ul>

<div class="firma">
  <div><b>Aceptado por el cliente</b><br>Nombre, fecha y firma</div>
  <div><b>Gesmeco Energía</b><br>Fecha y firma</div>
</div>

<div class="pie">Gesmeco Energía · Avenida de Aragón, 50 · 22500 Binéfar (Huesca) · www.gesmecoenergia.com</div>
<p class="noprint" style="margin-top:1.4rem;text-align:center"><button onclick="window.print()" style="padding:.7rem 1.6rem;font-weight:bold;font-size:1rem;background:#e11d48;color:#fff;border:none;border-radius:8px;cursor:pointer">🖨️ Imprimir / Guardar como PDF</button></p>
</div>
</body></html>`);
    w.document.close();
  }

  /** Solicitud de presupuesto al instalador: resumen técnico imprimible (interno, sin margen). */
  function generarSolicitudOscar() {
    const clienteNombre = clientes.datos.find((c) => c.id === form.cliente_id)?.nombre || '—';
    const w = window.open('', '_blank');
    if (!w) return;
    const filas = conceptos.filter((c) => c.incluido && c.concepto.trim())
      .map((c) => `<tr><td>${c.codigo_catalogo || '—'}</td><td>${c.descripcion}</td><td class="num">${Number(c.cantidad)}</td></tr>`).join('');
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Solicitud de presupuesto · ${form.nombre_proyecto}</title>
<style>body{font-family:Arial,sans-serif;max-width:720px;margin:2rem auto;padding:0 1.5rem;color:#1a1a2e;line-height:1.55}
h1{font-size:1.15rem;border-bottom:3px solid #e11d48;padding-bottom:.4rem}h2{font-size:.85rem;text-transform:uppercase;letter-spacing:.15em;color:#e11d48;margin-top:1.4rem}
table{width:100%;border-collapse:collapse}td,th{padding:.4rem .6rem;border-bottom:1px solid #ddd;font-size:.9rem;text-align:left}.num{text-align:right}
.muted{color:#666;font-size:.85rem}@media print{.noprint{display:none}}</style></head><body>
<h1>Solicitud de presupuesto al instalador · Gesmeco Energía</h1>
<p class="muted">Documento interno para Óscar — ${new Date().toLocaleDateString('es-ES')}</p>
<h2>Proyecto</h2>
<p><b>${form.nombre_proyecto || '—'}</b> · Cliente: ${clienteNombre}</p>
<p>Potencia propuesta: <b>${potencia.toLocaleString('es-ES')} kWp</b> · ${paneles} paneles de ${POTENCIA_PANEL_W} W</p>
${form.observaciones ? `<p class="muted">Observaciones: ${form.observaciones}</p>` : ''}
<h2>Configuración prevista (a confirmar por el instalador)</h2>
<table><thead><tr><th>Código</th><th>Concepto</th><th class="num">Cant.</th></tr></thead><tbody>${filas || '<tr><td colspan="3">Sin partidas definidas</td></tr>'}</tbody></table>
<h2>Se solicita</h2>
<ul class="muted"><li>Presupuesto detallado por partidas, sin IVA.</li><li>Confirmación de inversor y batería propuestos.</li>
<li>Alcance de trámites incluidos.</li><li>Necesidades de elevación, línea adicional u obra no contempladas.</li></ul>
<p class="noprint"><button onclick="window.print()" style="padding:.6rem 1.4rem;font-weight:bold">🖨️ Imprimir / PDF</button></p>
</body></html>`);
    w.document.close();
  }

  const selCls = 'rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 text-xs font-semibold';

  // ═══════════ LISTA ═══════════
  if (editandoId === null) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-black text-foreground flex items-center gap-2"><Calculator className="w-5 h-5 text-accent" /> Calculadora FV</h2>
            <p className="text-xs text-muted mt-0.5">Presupuestos fotovoltaicos: del coste de Óscar al precio final del cliente. Solo administrador.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={cargar} className={btnSecundario}><RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} /></button>
            <a href="/gestor/luz/fv/catalogo" className={btnSecundario}>📚 Catálogo de precios</a>
            <button onClick={() => setEligiendoTipo(true)} className={btnPrimario}><Plus className="w-4 h-4" /> Nuevo presupuesto</button>
          </div>
        </div>

        {/* ¿Qué quieres hacer? — cada flujo con su camino */}
        {eligiendoTipo && (
          <div className="grid md:grid-cols-2 gap-3">
            <button onClick={() => abrirNuevo('simple')}
              className="text-left p-5 rounded-2xl border border-accent/40 bg-accent/5 hover:bg-accent/10 hover:border-accent/70 transition space-y-1.5">
              <p className="text-2xl">📄</p>
              <p className="font-black text-sm text-foreground">Tengo el presupuesto de Óscar</p>
              <p className="text-xs text-muted leading-relaxed">
                Metes su importe sin IVA y el sistema añade la ingeniería si supera 10 kW,
                aplica tu margen y el IVA. En 2 minutos tienes la oferta para el cliente.
              </p>
            </button>
            <button onClick={() => abrirNuevo('partidas')}
              className="text-left p-5 rounded-2xl border border-secondary/40 bg-secondary/5 hover:bg-secondary/10 hover:border-secondary/70 transition space-y-1.5">
              <p className="text-2xl">⚡</p>
              <p className="font-black text-sm text-foreground">Presupuestar desde consumos / factura</p>
              <p className="text-xs text-muted leading-relaxed">
                Metes el consumo del cliente, eliges escenario de dimensionado y el sistema
                monta las partidas con el catálogo de Óscar. Estimación con rentabilidad incluida.
              </p>
            </button>
            <button onClick={() => setEligiendoTipo(false)} className="md:col-span-2 text-xs text-muted hover:text-foreground text-center">
              Cancelar
            </button>
          </div>
        )}

        {msg && <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5">{msg}</p>}
        {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">{error}</p>}
        <EstadoCarga cargando={cargando} error={faltaMigracion ? error : ''} faltaMigracion={faltaMigracion} sqlFile="supabase_fv_presupuestos.sql"
          vacio={!cargando && !faltaMigracion && lista.length === 0} textoVacio="Sin presupuestos todavía. Crea el primero." />

        {lista.length > 0 && (
          <Card className="!p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
                  <th className="px-3 py-3">Proyecto</th><th className="px-3 py-3">Cliente</th>
                  <th className="px-3 py-3 text-right">kW</th><th className="px-3 py-3 text-right">Sin IVA</th>
                  <th className="px-3 py-3 text-right">Con IVA</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.id} className="border-b border-border/20 hover:bg-card/50 transition">
                    <td className="px-3 py-2 font-semibold text-xs cursor-pointer" onClick={() => abrirExistente(p)}>
                      {p.nombre_proyecto}
                      <span className={`ml-2 px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase ${
                        (p as unknown as { modo?: string }).modo === 'partidas'
                          ? 'bg-secondary/15 text-secondary border-secondary/30'
                          : 'bg-accent/15 text-accent border-accent/30'
                      }`}>
                        {(p as unknown as { modo?: string }).modo === 'partidas' ? '⚡ Dimensionado' : '📄 Óscar'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{p.cliente_nombre || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">{Number(p.potencia_kw).toLocaleString('es-ES')}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-xs">{fmtEur2(Number(p.precio_sin_iva))}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs text-emerald-400 font-black">{fmtEur2(Number(p.precio_con_iva))}</td>
                    <td className="px-3 py-2">
                      <select value={p.estado} onChange={(e) => cambiarEstado(p, e.target.value)} className={selCls}>
                        {ESTADOS_FV.map((e2) => <option key={e2} value={e2}>{ESTADO_FV_LABEL[e2]}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => abrirExistente(p)} className="text-accent text-xs font-bold hover:underline mr-2">Abrir</button>
                      <button onClick={() => eliminar(p)} className="text-muted hover:text-red-400" title={ESTADOS_FV_PROTEGIDOS.includes(p.estado) ? 'Archivar' : 'Eliminar'}>
                        {ESTADOS_FV_PROTEGIDOS.includes(p.estado) ? <Archive className="w-3.5 h-3.5 inline" /> : <Trash2 className="w-3.5 h-3.5 inline" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* Ejemplo informativo con la regla predeterminada */}
        <Card className="!p-4">
          <p className="text-[11px] font-black uppercase tracking-wide text-muted mb-2">📖 Ejemplo (regla predeterminada, &gt;10 kW)</p>
          <p className="text-xs text-muted leading-relaxed">
            Presupuesto de Óscar <b className="text-foreground">10.000 €</b> + ingeniería <b className="text-foreground">1.800 €</b> ={' '}
            coste base <b className="text-foreground">11.800 €</b> · margen Gesmeco <b className="text-foreground">20 %</b> (2.360 €) →{' '}
            <b className="text-emerald-400">14.160 € sin IVA</b> · con IVA 21 %: <b className="text-emerald-400">17.133,60 €</b>.
            <span className="block mt-1">En instalaciones de 10 kW o menos: sin ingeniería y margen del 25 % (10.000 € → 12.500 € sin IVA).</span>
          </p>
        </Card>
      </div>
    );
  }

  // ═══════════ EDITOR ═══════════
  const p = lista.find((x) => x.id === editandoId);

  /** Bloque de consumo, escenarios y rentabilidad (fases 2 y 3), reutilizado según el flujo. */
  const bloqueEnergia = (
    <EnergiaEscenarios
      energia={energia} setEnergia={setEnergia}
      hipotesis={hipotesis} setHipotesis={setHipotesis}
      potenciaActual={potencia}
      precioSinIva={resultado.precio_sin_iva}
      precioConIva={resultado.precio_con_iva}
      onAplicarPotencia={(kw) => setForm((f) => ({ ...f, potencia_kw: String(kw) }))}
      catalogo={catalogo}
      clienteNombre={clientes.datos.find((c) => c.id === form.cliente_id)?.nombre || ''}
      proyecto={form.nombre_proyecto}
      perfil={form.perfil}
      onMontarPresupuesto={(kwp, codigos, pctAutoEfectivo) => {
        const partidas = codigos
          .map((c) => {
            const pt = partidaDesdeCatalogo(c.codigo, c.cantidad);
            if (!pt) return null;
            return { ...pt, confianza: c.confianza || pt.confianza, observaciones: c.nota || pt.observaciones, fuente: (pt.fuente || '') + ' · recomendación automática' };
          })
          .filter(Boolean) as PartidaFV[];
        setModo('partidas');
        setForm((f) => ({ ...f, potencia_kw: String(kwp) }));
        setConceptos(partidas);
        // Autoconsumo efectivo (con batería) → fuente única para que la oferta cuadre con el escenario
        if (pctAutoEfectivo != null) setHipotesis((h) => ({ ...h, pct_autoconsumo: r2(pctAutoEfectivo) }));
        setMsg('🪄 Presupuesto montado con la recomendación: revisa inversor, batería e instalación antes de aprobar.');
      }}
    />
  );

  // Cabecera de paso (solo en el flujo "desde consumos", para guiar el orden)
  const Paso = ({ n, titulo, desc }: { n: number; titulo: string; desc?: string }) => (
    <div className="flex items-center gap-2.5 pt-1">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-white text-xs font-black">{n}</span>
      <div className="min-w-0">
        <p className="text-sm font-black text-foreground leading-tight">{titulo}</p>
        {desc && <p className="text-[10px] text-muted leading-tight">{desc}</p>}
      </div>
    </div>
  );
  const esDim = modo === 'partidas';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={() => { setEditandoId(null); cargar(); }} className={btnSecundario}><ChevronLeft className="w-4 h-4" /> Presupuestos</button>
          <h2 className="text-lg font-black text-foreground">{editandoId === 'nuevo' ? 'Nuevo presupuesto FV' : form.nombre_proyecto}</h2>
          {p && <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${['aprobado', 'aceptado'].includes(p.estado) ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-card/80 text-muted border-border/50'}`}>{ESTADO_FV_LABEL[p.estado]}</span>}
        </div>
        <div className="flex gap-2">
          <button onClick={generarVistaCliente} disabled={erroresEntrada.length > 0} className={btnSecundario} title="Documento sin costes internos ni márgenes">
            <FileText className="w-4 h-4" /> Generar propuesta orientativa
          </button>
          <button onClick={generarSolicitudOscar} className={btnSecundario} title="Resumen técnico interno para pedir presupuesto a Óscar">
            📨 Solicitud a Óscar
          </button>
          <button onClick={guardar} disabled={guardando} className={btnPrimario}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>

      {msg && <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5">{msg}</p>}
      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">{error}</p>}

      <div className="grid lg:grid-cols-[1fr_380px] gap-4 items-start">
        {/* ── BLOQUE IZQUIERDO: datos del proyecto ── */}
        <div className="space-y-4">
          {esDim && <Paso n={1} titulo="Cliente y tipo de instalación" desc="A quién va y con qué lenguaje le hablamos" />}
          <Card className="space-y-3">
            <h3 className="font-bold text-sm">Datos del proyecto</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Cliente *</label>
                <select className={inputCls} value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
                  <option value="">— Selecciona —</option>
                  {clientes.datos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <p className="text-[10px] text-muted mt-0.5">¿No existe? Créalo en <a href="/gestor/luz/alta" target="_blank" className="text-accent hover:underline">Alta guiada</a> y pulsa ↻ arriba.</p>
              </div>
              <div><label className={labelCls}>Nombre del proyecto *</label>
                <input className={inputCls} value={form.nombre_proyecto} onChange={(e) => setForm({ ...form, nombre_proyecto: e.target.value })} placeholder="Instalación fotovoltaica granja Perlag" /></div>
              <div className="md:col-span-2">
                <label className={labelCls}>Tipo de cliente (adapta el lenguaje de la propuesta)</label>
                <select className={inputCls} value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value })}>
                  {PERFILES_CLIENTE.map((p) => <option key={p} value={p}>{PERFIL_LABEL[p]}</option>)}
                </select>
                <p className="text-[10px] text-muted mt-0.5">{PERFIL_TEXTO[form.perfil]?.intro}</p>
              </div>
              <div>
                <label className={labelCls}>Potencia (kW) *</label>
                <input className={inputCls} type="number" min="0.01" step="0.01" value={form.potencia_kw} onChange={(e) => setForm({ ...form, potencia_kw: e.target.value })} />
                {esDim && potencia <= 0 && (
                  <p className="text-[10px] mt-0.5 text-muted">Se rellena sola al elegir un escenario en el paso 2 (o escríbela a mano).</p>
                )}
                {potencia > 0 && (
                  <p className={`text-[10px] mt-0.5 font-semibold ${potencia > LIMITE_KW ? 'text-amber-300' : 'text-secondary'}`}>
                    {potencia > LIMITE_KW ? '⚙️ Más de 10 kW: se añade ingeniería.' : '✓ 10 kW o menos: no se añade ingeniería.'}
                  </p>
                )}
              </div>
              <div className="md:col-span-2 flex items-end gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${
                  modo === 'partidas' ? 'bg-secondary/15 text-secondary border-secondary/30' : 'bg-accent/15 text-accent border-accent/30'
                }`}>
                  {modo === 'partidas' ? '⚡ Dimensionado desde consumos' : '📄 Desde presupuesto de Óscar'}
                </span>
                <button type="button" onClick={() => setModo(modo === 'simple' ? 'partidas' : 'simple')}
                  className="text-[10px] font-semibold text-muted hover:text-foreground underline underline-offset-2 pb-1">
                  cambiar tipo
                </button>
              </div>
              {modo === 'simple' && (
                <div><label className={labelCls}>Presupuesto instalador Óscar (€, sin IVA) *</label>
                  <input className={inputCls} type="number" min="0.01" step="0.01" value={form.presupuesto_instalador} onChange={(e) => setForm({ ...form, presupuesto_instalador: e.target.value })} /></div>
              )}
              <div>
                <label className={labelCls}>Coste de ingeniería (€, sin IVA)</label>
                <input className={inputCls} type="number" min="0" step="0.01" value={form.coste_ingenieria} onChange={(e) => setForm({ ...form, coste_ingenieria: e.target.value })} disabled={potencia > 0 && potencia <= LIMITE_KW} />
                {parseFloat(form.coste_ingenieria) !== INGENIERIA_DEFECTO && <p className="text-[10px] text-amber-300 mt-0.5">Modificado (por defecto {INGENIERIA_DEFECTO} €) — quedará registrado.</p>}
              </div>
              <div>
                <label className={labelCls}>Margen Gesmeco (%) — predeterminado: {margenDefecto} %</label>
                <input className={inputCls} type="number" min="0" step="0.01" value={form.margen_pct}
                  placeholder={String(margenDefecto)}
                  onChange={(e) => { setMargenTocado(true); setForm({ ...form, margen_pct: e.target.value }); }} />
              </div>
              {margenModificado && (
                <div className="md:col-span-2">
                  <label className={labelCls}>Motivo del cambio de margen * (queda en el historial)</label>
                  <input className={inputCls} value={form.motivo_margen} onChange={(e) => setForm({ ...form, motivo_margen: e.target.value })} placeholder="Ej: acuerdo especial con el cliente, competencia directa..." />
                </div>
              )}
              <div>
                <label className={labelCls}>IVA</label>
                <div className="flex gap-2">
                  <select className={inputCls} value={form.iva_pct} onChange={(e) => setForm({ ...form, iva_pct: e.target.value })}>
                    <option value="21">21 %</option><option value="10">10 %</option><option value="otro">Otro…</option>
                  </select>
                  {form.iva_pct === 'otro' && (
                    <input className={`${inputCls} !w-24`} type="number" min="0" max="30" step="0.1" value={form.iva_otro} onChange={(e) => setForm({ ...form, iva_otro: e.target.value })} placeholder="%" />
                  )}
                </div>
              </div>
              <div>
                <label className={labelCls}>Responsable</label>
                <SelectorResponsable valor={form.responsable} onCambio={(v) => setForm((f) => ({ ...f, responsable: v || '' }))} className={inputCls} />
              </div>
              <div className="md:col-span-2"><label className={labelCls}>Observaciones</label>
                <textarea className={`${inputCls} resize-none`} rows={2} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></div>
            </div>
          </Card>

          {/* Flujo Dimensionado: primero el consumo y los escenarios, que montan las partidas */}
          {esDim && <Paso n={2} titulo="Consumo y escenario" desc="Mete el consumo del cliente y elige un escenario: rellena la potencia y las partidas de golpe" />}
          {modo === 'partidas' && bloqueEnergia}

          {/* Dimensionado + partidas desde el catálogo */}
          {esDim && <Paso n={3} titulo="Revisa los equipos y precios" desc="Ajusta las partidas que montó el escenario, cámbialas o añade del catálogo" />}
          <Card className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-bold text-sm">{modo === 'partidas' ? '🧮 Presupuesto por partidas' : 'Desglose de costes adicionales'}</h3>
              <div className="flex gap-2 flex-wrap">
                <select className={selCls} value="" onChange={(e) => { const p = partidaDesdeCatalogo(e.target.value); if (p) setConceptos((c) => [...c, p]); }}>
                  <option value="">+ Desde catálogo…</option>
                  {catalogo.map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} · {fmtEur2(Number(c.precio_base))}</option>)}
                </select>
                <button onClick={() => setConceptos((c) => [...c, { ...PARTIDA_NUEVA }])} className={btnSecundario}><Plus className="w-4 h-4" /> Manual</button>
              </div>
            </div>

            {/* Dimensionado: nº paneles desde la potencia */}
            {potencia > 0 && (
              <div className="flex items-center gap-3 flex-wrap text-[11px] rounded-lg bg-secondary/5 border border-secondary/25 p-2.5">
                <span>☀️ <b>{paneles} paneles</b> de {POTENCIA_PANEL_W} W para {potencia.toLocaleString('es-ES')} kWp (⌈kWp×1000/{POTENCIA_PANEL_W}⌉)</span>
                {modo === 'partidas' && conceptos.length === 0 && (
                  <span className="text-muted">Aún no hay partidas: usa 🪄 «Montar presupuesto con este escenario» arriba para rellenarlas de golpe, o añádelas del catálogo.</span>
                )}
              </div>
            )}

            {avisoCat && <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg p-2">{avisoCat}</p>}
            {modo === 'simple' && <p className="text-[11px] text-muted">El presupuesto de Óscar y la ingeniería ya cuentan arriba. Aquí van extras (baterías, obra civil…). Lo «incluido» suma al coste base.</p>}

            {conceptos.length > 0 && (
              <div className="space-y-2">
                {conceptos.map((c, i) => {
                  const set = (k: keyof PartidaFV, v: unknown) => setConceptos((arr) => arr.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
                  return (
                    <div key={i} className={`rounded-xl border p-2.5 ${c.incluido ? 'border-border/40 bg-card/40' : 'border-border/20 bg-card/20 opacity-55'}`}>
                      <div className="flex items-start gap-2.5">
                        {/* Incluir / no incluir de un vistazo */}
                        <button type="button" onClick={() => set('incluido', !c.incluido)}
                          className={`mt-1 shrink-0 w-6 h-6 rounded-md border flex items-center justify-center text-xs font-black transition ${c.incluido ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-card/60 text-muted border-border/50'}`}
                          title={c.incluido ? 'Incluida en el presupuesto' : 'No incluida'}>
                          {c.incluido ? '✓' : ''}
                        </button>
                        <div className="min-w-0 flex-1">
                          {/* Nombre de la pieza */}
                          <input className={`${selCls} w-full font-semibold !text-sm`} value={c.descripcion} onChange={(e) => set('descripcion', e.target.value)} placeholder="Nombre de la pieza (ej: Inversor Huawei 10 kW)" />
                          <div className="flex items-center gap-2 mt-1 flex-wrap text-[10px] text-muted">
                            <span className="font-mono">{c.codigo_catalogo || 'manual'}</span>
                            {c.marca && <span>· {c.marca}</span>}
                            {c.fuente && <span>· {c.fuente}</span>}
                          </div>
                        </div>
                        {/* Importe grande a la derecha */}
                        <div className="text-right shrink-0">
                          <p className="font-black text-sm tabular-nums">{fmtEur2(importePartida(c))}</p>
                          <button onClick={() => setConceptos((arr) => arr.filter((_, j) => j !== i))} className="text-[10px] text-muted hover:text-red-400">quitar ✕</button>
                        </div>
                      </div>
                      {/* Controles: cantidad · precio · opcional · confianza */}
                      <div className="flex items-end gap-3 mt-2 flex-wrap pl-8">
                        <label className="text-[10px] text-muted">Cantidad<br /><input className={`${selCls} w-20 text-right`} type="number" min="0" step="1" value={c.cantidad} onChange={(e) => set('cantidad', parseFloat(e.target.value) || 0)} /></label>
                        <label className="text-[10px] text-muted">Precio/ud (€)<br /><input className={`${selCls} w-24 text-right`} type="number" min="0" step="0.01" value={c.precio_unitario} onChange={(e) => set('precio_unitario', parseFloat(e.target.value) || 0)} /></label>
                        <label className="text-[10px] text-muted">Confianza<br /><select className={`${selCls} !px-1.5`} value={c.confianza || 'media'} onChange={(e) => set('confianza', e.target.value)}>{Object.entries(CONFIANZA_LABEL).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
                        <label className="flex items-center gap-1.5 text-[10px] text-muted cursor-pointer pb-1.5">
                          <input type="checkbox" checked={c.opcional} onChange={(e) => set('opcional', e.target.checked)} className="accent-[#f59e0b] w-4 h-4" />
                          Opcional para el cliente
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {modo === 'partidas' && (
              <p className="text-[11px] font-bold text-right">Coste directo (partidas incluidas): <span className="tabular-nums">{fmtEur2(otros)}</span> · Confianza global: {CONFIANZA_LABEL[confianza]}</p>
            )}
          </Card>

          {/* Flujo de Óscar: el estudio de ahorro es opcional y va plegado */}
          {modo === 'simple' && (
            mostrarEstudio ? (
              <>
                <div className="flex justify-end">
                  <button onClick={() => setMostrarEstudio(false)} className="text-[11px] font-semibold text-muted hover:text-foreground underline underline-offset-2">
                    Ocultar estudio de ahorro
                  </button>
                </div>
                {bloqueEnergia}
              </>
            ) : (
              <button onClick={() => setMostrarEstudio(true)}
                className="w-full text-left p-4 rounded-2xl border border-dashed border-secondary/40 text-secondary hover:bg-secondary/5 hover:border-secondary/70 transition text-xs font-bold">
                ➕ Añadir estudio de ahorro al presupuesto (opcional) — consumo, escenarios y amortización
              </button>
            )
          )}

          {/* Documentación (enlaces) */}
          {esDim && <Paso n={4} titulo="Documentación (opcional)" desc="Adjunta factura, planos o el presupuesto de Óscar" />}
          <Card className="space-y-2.5">
            <h3 className="font-bold text-sm">📁 Documentación</h3>
            <p className="text-[11px] text-muted">
              Presupuesto original de Óscar, ingeniería, planos, memoria técnica, facturas, fotografías, oferta final, contrato firmado…
              Los archivos se guardan en un almacén privado: solo el administrador puede verlos y descargarlos.
            </p>

            {/* Subir archivo */}
            {editandoId === 'nuevo' ? (
              <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg p-2">
                💾 Guarda el presupuesto primero para poder adjuntar archivos.
              </p>
            ) : (
              <label className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-4 cursor-pointer transition text-xs font-semibold ${
                subiendo ? 'border-border/40 text-muted' : 'border-accent/40 text-accent hover:bg-accent/5 hover:border-accent/70'
              }`}>
                <input
                  type="file"
                  className="hidden"
                  disabled={subiendo}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) subirArchivo(f); e.target.value = ''; }}
                />
                {subiendo ? <><RefreshCw className="w-4 h-4 animate-spin" /> Subiendo…</> : <>⬆️ Subir archivo (PDF, imagen, Excel… máx. 25 MB)</>}
              </label>
            )}

            {/* Enlace externo (Drive, correo...) como alternativa */}
            <div className="flex gap-2">
              <input className={`${inputCls} !text-xs`} value={docNuevo.nombre} onChange={(e) => setDocNuevo({ ...docNuevo, nombre: e.target.value })} placeholder="…o añade un enlace: nombre" />
              <input className={`${inputCls} !text-xs flex-1`} value={docNuevo.url} onChange={(e) => setDocNuevo({ ...docNuevo, url: e.target.value })} placeholder="https://..." />
              <button onClick={() => { if (docNuevo.nombre.trim() && docNuevo.url.trim()) { setDocs((d) => [...d, { ...docNuevo }]); setDocNuevo({ nombre: '', url: '' }); } }} className={btnSecundario}><Plus className="w-4 h-4" /></button>
            </div>

            {docs.map((d, i) => (
              <div key={i} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-card/60 text-xs">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0">{d.path ? (d.tipo?.includes('pdf') ? '📄' : d.tipo?.includes('image') ? '🖼️' : '📎') : '🔗'}</span>
                  <span className="truncate font-semibold">{d.nombre}</span>
                  {d.subido_en && <span className="text-[10px] text-muted shrink-0">{d.subido_en.slice(0, 10)}</span>}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <button onClick={() => descargarDoc(d)} className="text-accent font-bold hover:underline">
                    {d.path ? '⬇️ Descargar' : 'Abrir'}
                  </button>
                  <button onClick={() => eliminarDoc(i)} className="text-muted hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                </span>
              </div>
            ))}
            {docs.length === 0 && <p className="text-[11px] text-amber-300">⚠️ Sin documentos adjuntos todavía.</p>}
          </Card>
        </div>

        {/* ── BLOQUE DERECHO: resumen económico ── */}
        <div className="space-y-3 lg:sticky lg:top-20">
          <Card className="!p-0 overflow-hidden">
            <p className="px-4 pt-3 pb-2 text-[11px] font-black uppercase tracking-wide text-muted">Resumen económico (interno)</p>
            <div className="px-4 pb-2 space-y-1.5 text-sm">
              {([
                [modo === 'partidas' ? 'Coste directo (partidas)' : 'Presupuesto Óscar', fmtEur2(modo === 'partidas' ? otros : entrada.presupuesto_instalador)],
                ['Ingeniería' + (resultado.aplica_ingenieria ? '' : ' (no aplica ≤10 kW)'), fmtEur2(resultado.coste_ingenieria_aplicado)],
                ...(otros > 0 ? [['Otros costes incluidos', fmtEur2(otros)] as [string, string]] : []),
                ['Coste base', fmtEur2(resultado.coste_base)],
                [`Margen Gesmeco (${margenUsado.toLocaleString('es-ES')} %)`, fmtEur2(resultado.margen_importe)],
              ] as [string, string][]).map(([n, v]) => (
                <div key={n} className="flex justify-between gap-2"><span className="text-muted text-xs">{n}</span><span className="tabular-nums font-semibold">{v}</span></div>
              ))}
              <div className="flex justify-between gap-2 pt-1.5 border-t border-border/30">
                <span className="font-bold text-xs">Total sin IVA</span><span className="tabular-nums font-black">{fmtEur2(resultado.precio_sin_iva)}</span>
              </div>
              <div className="flex justify-between gap-2"><span className="text-muted text-xs">IVA ({ivaUsado.toLocaleString('es-ES')} %)</span><span className="tabular-nums font-semibold">{fmtEur2(resultado.iva_importe)}</span></div>
            </div>
            <div className="px-4 py-3 bg-emerald-500/10 border-t border-emerald-500/30 flex justify-between items-center">
              <span className="font-black text-sm">TOTAL CON IVA</span>
              <span className="tabular-nums font-black text-lg text-emerald-400">{fmtEur2(resultado.precio_con_iva)}</span>
            </div>
          </Card>

          {erroresEntrada.length > 0 && (
            <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/25 rounded-lg p-2.5 space-y-0.5">
              {erroresEntrada.map((e) => <p key={e}>✕ {e}</p>)}
            </div>
          )}
          {avisos.length > 0 && (
            <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg p-2.5 space-y-0.5">
              {avisos.map((a) => <p key={a}>⚠️ {a}</p>)}
            </div>
          )}
          {conceptosFuera > 0 && (
            <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg p-2.5">
              ⚠️ {conceptosFuera} concepto(s) del desglose NO incluidos en el cálculo.
            </p>
          )}
          <p className="text-[10px] text-muted leading-relaxed">
            🔒 El servidor recalcula y valida todos los importes al guardar con estas mismas fórmulas: el margen siempre sobre la
            base sin IVA, la ingeniería solo una vez y solo en &gt;10 kW. Todo cambio queda en el Control General.
          </p>
        </div>
      </div>
    </div>
  );
}
