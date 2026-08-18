'use client';

/**
 * EL FLUJO DE UN ESTUDIO (GL-04 / GL-05 / GL-06).
 *
 * Factura → Extracción → Validación → Análisis → Comparativa → Propuesta.
 *
 * DOS DECISIONES QUE EXPLICAN CÓMO SE VE
 *
 * 1. LO QUE FALTA NO SE ESCONDE, SE PONE EN EL BOTÓN. El plan lo pide:
 *    «bloquear la propuesta solo cuando falte un dato imprescindible; explicar
 *    cuál». Un botón deshabilitado sin motivo es la forma más rápida de que
 *    alguien cierre la pantalla y lo haga en una hoja de cálculo.
 *
 * 2. CADA NÚMERO DICE DE DÓNDE SALE. Un dato leído de la factura, uno escrito
 *    a mano y uno calculado por el sistema no valen lo mismo, y cuando se
 *    mezclan en la misma tabla dejan de valer todos: si el cliente pilla un
 *    error en uno, deja de fiarse de los otros veinte.
 *
 * TODO EL CRITERIO ESTÁ FUERA DE AQUÍ. La validación es `factura.ts`, la
 * comparativa es `escenarios.ts` y el coste es `tarifas-base.ts`. Esta pantalla
 * solo enseña y guarda: así se puede probar el criterio sin navegador, que es
 * donde de verdad se rompen las cosas.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Camera, Check, Download, FileUp, Loader,
  Lock, PenLine, Save, Table, X,
} from 'lucide-react';
import { tokenSesion } from '@/lib/usuario';
import { fmtEur, type LuzCliente, type LuzCups } from '@/lib/luz';
import {
  revisarFactura, porQueNoSePuedeOfertar, ORIGEN_LABEL,
  type Revision, type FacturaLeida,
} from '@/lib/factura';
import { TARIFA_INFO, type TarifaAcceso } from '@/lib/tarifas-base';
import { prepararFactura } from '@/lib/factura-archivo';
import { type LecturaPlantilla } from '@/lib/plantilla-consumos';
import { compararConComercializadoras } from '@/lib/tarifas';
import {
  evaluarEscenarios, recomendar, alertasDeLaComparativa, resumenComparativa,
  TIPO_ESCENARIO_LABEL, type Escenario, type ContextoEstudio, type EscenarioEvaluado,
} from '@/lib/escenarios';
import { Card, btnPrimario, btnSecundario, inputCls, labelCls, useListaLuz } from '../ui';

export interface Estudio {
  id: string;
  cliente_id: string | null;
  cups_id: string | null;
  version?: number;
  titulo?: string | null;
  tarifa?: string | null;
  estado: string;
  datos_factura?: FacturaLeida | null;
  revision?: unknown;
  escenarios?: unknown;
  hipotesis?: unknown;
  escenario_recomendado?: string | null;
  recomendacion?: string | null;
  coste_actual_anual?: number | null;
  coste_propuesto_anual?: number | null;
  ahorro_anual?: number | null;
  ahorro_pct?: number | null;
  bloqueado?: boolean;
  responsable?: string | null;
  creado_en?: string;
  luz_clientes?: { nombre: string } | null;
  luz_cups?: { cups: string; alias_suministro: string | null } | null;
}

/** Los siete pasos del plan, con el nombre que sale en pantalla. */
export const ESTADO_ESTUDIO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  factura: 'Factura',
  extraccion: 'Extracción',
  validacion: 'Validación',
  analisis: 'Análisis',
  comparativa: 'Comparativa',
  propuesta: 'Propuesta enviada',
  seguimiento: 'En seguimiento',
};

const PASOS = ['Factura', 'Datos', 'Comparativa', 'Propuesta'] as const;

const hoyISO = () => new Date().toISOString().slice(0, 10);

const listaNum = (s: string): number[] =>
  s.split(/[,;\s]+/).map((x) => Number(x.replace(',', '.'))).filter((n) => Number.isFinite(n));

export function FlujoEstudio({
  estudio, clientes, alSalir, clientePorDefecto,
}: {
  estudio: Estudio | null;
  clientes: LuzCliente[];
  alSalir: () => void;
  /** Cliente ya decidido al entrar desde «Preparar el estudio». */
  clientePorDefecto?: string | null;
}) {
  const cups = useListaLuz<LuzCups>('cups');

  const [paso, setPaso] = useState(estudio ? 1 : 0);
  const [id, setId] = useState<string | null>(estudio?.id ?? null);
  const [clienteId, setClienteId] = useState(estudio?.cliente_id || clientePorDefecto || '');
  const [cupsId, setCupsId] = useState(estudio?.cups_id || '');

  const [leyendo, setLeyendo] = useState(false);
  const [msg, setMsg] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Los datos del suministro, ya sea leídos de la factura o escritos a mano.
  const d0 = estudio?.datos_factura || null;
  const [tarifa, setTarifa] = useState<TarifaAcceso>((d0?.tarifa as TarifaAcceso) || '3.0');
  const [consumos, setConsumos] = useState((d0?.consumosMes || []).join(', '));
  const [potencias, setPotencias] = useState((d0?.potencias || []).join(', '));
  const [precioE, setPrecioE] = useState((d0?.preciosEnergia || []).join(', '));
  const [precioP, setPrecioP] = useState((d0?.preciosPotencia || []).join(', '));
  const [titular, setTitular] = useState(d0?.titular || '');
  const [cupsTexto, setCupsTexto] = useState(d0?.cups || '');
  const [obsLectura, setObsLectura] = useState(d0?.observaciones || '');

  /** Qué campos vinieron de la factura y cuáles se han escrito. */
  const [origenes, setOrigenes] = useState<Record<string, 'factura' | 'introducido'>>({});
  const marcaMano = (campo: string) =>
    setOrigenes((o) => (o[campo] === 'introducido' ? o : { ...o, [campo]: 'introducido' }));

  // Lo que sale de la plantilla de Excel: 12 meses desglosados por periodo.
  // Se guarda entero aunque el motor de comparativa solo necesite el mes medio,
  // porque la estacionalidad es lo que decide si unas placas tienen sentido.
  const [plantilla, setPlantilla] = useState<LecturaPlantilla | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  const [comparado, setComparado] = useState<EscenarioEvaluado[] | null>(null);
  const [comparando, setComparando] = useState(false);
  const [frase, setFrase] = useState(estudio?.recomendacion || '');

  const cupsDelCliente = useMemo(
    () => cups.datos.filter((c) => c.cliente_id === clienteId),
    [cups.datos, clienteId]
  );

  const factura: FacturaLeida = useMemo(() => ({
    tarifa,
    consumosMes: listaNum(consumos),
    potencias: listaNum(potencias),
    preciosEnergia: listaNum(precioE),
    preciosPotencia: listaNum(precioP),
    titular: titular || null,
    cups: cupsTexto || null,
    observaciones: obsLectura || null,
  }), [tarifa, consumos, potencias, precioE, precioP, titular, cupsTexto, obsLectura]);

  const revision: Revision = useMemo(() => revisarFactura(factura), [factura]);
  const bloqueo = porQueNoSePuedeOfertar(revision);

  const ctx: ContextoEstudio = useMemo(() => {
    const suministro = cups.datos.find((c) => c.id === cupsId);
    return {
      tarifa,
      consumosMes: listaNum(consumos),
      potencias: listaNum(potencias),
      preciosEnergiaActual: listaNum(precioE),
      preciosPotenciaActual: listaNum(precioP),
      permanenciaRestanteMeses: null,
      penalizacionActual: Number(suministro?.penalizacion)
        || Number(plantilla?.suministro?.penalizacion) || null,
      // Doce meses desglosados son un perfil de consumo real, no una curva
      // horaria: sirven para el reparto por periodos, no para el autoconsumo.
      tieneCurva: false,
      // ESTO ES LO QUE MÁS CAMBIA con la plantilla. Con maxímetro, proponer
      // bajar potencia deja de ser riesgo alto: hay un pico medido detrás en
      // vez de un promedio que aplana los picos.
      tieneMaximetro: !!plantilla?.maximetros?.some((m) => m > 0),
      // Un año extrapolado desde tres meses ES un dato estimado, y el motor de
      // escenarios tiene que saberlo para subir el riesgo y decirlo.
      datosEstimados: plantilla
        ? plantilla.extrapolado
        : Object.values(origenes).some((o) => o === 'introducido'),
    };
  }, [tarifa, consumos, potencias, precioE, precioP, cupsId, cups.datos, origenes, plantilla]);

  // ── Leer la factura ──────────────────────────────────────────────────────
  const leerArchivo = useCallback(async (file: File) => {
    setLeyendo(true);
    setMsg('');
    try {
      // Una foto de móvil son 4 MB y en base64 se convierte en 5,3: por
      // encima del límite la petición se corta antes de llegar al servidor y
      // el error que sale no lo escribimos nosotros. Se encoge antes.
      const { data, mediaType } = await prepararFactura(file);
      const r = await fetch('/api/leer-factura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, mediaType }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        // El motivo real, tal como lo cuenta el servidor. Un «no se pudo» a
        // secas obliga a repetir lo mismo esperando otro resultado.
        setMsg(j.error || `No se pudo leer la factura (error ${r.status}).`);
        return;
      }

      const x = j.datos || {};
      if (x.tarifa) setTarifa(x.tarifa);
      if (x.consumos_kwh_mes?.length) setConsumos(x.consumos_kwh_mes.join(', '));
      if (x.potencias_kw?.length) setPotencias(x.potencias_kw.join(', '));
      if (x.precios_energia_eur_kwh?.length) setPrecioE(x.precios_energia_eur_kwh.join(', '));
      if (x.precios_potencia_eur_kw_dia?.length) setPrecioP(x.precios_potencia_eur_kw_dia.join(', '));
      if (x.nombre_titular) setTitular(x.nombre_titular);
      if (x.cups) setCupsTexto(x.cups);
      setObsLectura(x.observaciones || '');

      // Todo lo que ha venido del documento queda marcado como tal. A partir
      // de aquí, lo que se toque pasa a «puesto a mano» y se ve en pantalla.
      setOrigenes({
        tarifa: 'factura', consumos: 'factura', potencias: 'factura',
        precios_energia: 'factura', precios_potencia: 'factura',
        titular: 'factura', cups: 'factura',
      });
      setPaso(1);
    } catch {
      setMsg('No se pudo leer el archivo.');
    } finally {
      setLeyendo(false);
    }
  }, []);

  // ── Leer la plantilla de Excel ───────────────────────────────────────────
  const leerPlantilla = useCallback(async (file: File) => {
    setSubiendo(true);
    setMsg('');
    try {
      const { data } = await prepararFactura(file);
      const r = await fetch('/api/luz/plantilla', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archivo: data }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(j.error || `No se ha podido leer el Excel (error ${r.status}).`); return; }

      const l = j.lectura as LecturaPlantilla;
      setPlantilla(l);

      if (l.tarifa) setTarifa(l.tarifa);
      // El mes medio es lo que come el motor de coste; sale del año completo,
      // así que no se pierde nada por el camino.
      if (l.consumosMes?.length) setConsumos(l.consumosMes.map((x) => Math.round(x)).join(', '));
      if (l.potencias?.length) setPotencias(l.potencias.join(', '));
      if (l.preciosEnergia?.some((x) => x)) setPrecioE(l.preciosEnergia.join(', '));
      if (l.preciosPotencia?.some((x) => x)) setPrecioP(l.preciosPotencia.join(', '));
      if (l.suministro?.titular) setTitular(l.suministro.titular);
      if (l.suministro?.cups) setCupsTexto(l.suministro.cups);

      // Todo esto lo ha escrito una persona con la factura delante: es dato
      // introducido, no leído. La diferencia se enseña en cada campo.
      setOrigenes({
        tarifa: 'introducido', consumos: 'introducido', potencias: 'introducido',
        precios_energia: 'introducido', precios_potencia: 'introducido',
        titular: 'introducido', cups: 'introducido',
      });
      setPaso(1);
    } catch {
      setMsg('No se ha podido abrir el archivo.');
    } finally {
      setSubiendo(false);
    }
  }, []);

  // ── Comparar ─────────────────────────────────────────────────────────────
  const comparar = useCallback(async () => {
    setComparando(true);
    setMsg('');
    try {
      const res = await compararConComercializadoras({
        tarifa,
        consumosMes: listaNum(consumos),
        potencias: listaNum(potencias),
        preciosEnergia: listaNum(precioE),
        preciosPotencia: listaNum(precioP),
      });

      if (!res.ofertas.length) {
        setMsg('No hay precios de comercializadoras cargados para esta tarifa. Revisa Tarifas.');
        setComparado([]);
        return;
      }

      // Un escenario por comercializadora, con NUESTRO margen ya dentro del
      // precio: lo que se compara es lo que el cliente pagaría, no el precio
      // de compra. Se guardan los precios en el escenario y no una referencia,
      // que es lo que permite congelar la propuesta después.
      const escenarios: Escenario[] = res.ofertas.slice(0, 5).map((o, i) => ({
        id: `of-${i}`,
        tipo: 'fijo',
        titulo: o.comercializadora,
        comercializadora: o.comercializadora,
        preciosEnergia: o.preciosEnergia.map((p) => p + res.feeAplicado.paraAhorroMax),
        preciosPotencia: o.preciosPotencia,
        permanenciaMeses: 12,
        hipotesis: {
          fechaPrecios: hoyISO(),
          margenEurKwh: res.feeAplicado.paraAhorroMax,
          incluyeImpuestos: false,
          ajustesManuales: res.feeAplicado.ajustado
            ? ['Margen ajustado para dejar el ahorro dentro de la banda del 20-30 %']
            : [],
          bloqueada: false,
        },
      }));

      const ev = evaluarEscenarios(ctx, escenarios, hoyISO());
      setComparado(ev);
      const rec = recomendar(ev);
      if (!frase) setFrase(rec.porque);
      setPaso(2);
    } catch {
      setMsg('No se pudo cargar la comparativa.');
    } finally {
      setComparando(false);
    }
  }, [tarifa, consumos, potencias, precioE, precioP, ctx, frase]);

  const rec = useMemo(() => (comparado ? recomendar(comparado) : null), [comparado]);
  const alertas = useMemo(() => (comparado ? alertasDeLaComparativa(comparado) : []), [comparado]);
  const resumen = useMemo(() => (rec ? resumenComparativa(ctx, rec) : null), [ctx, rec]);

  // ── Guardar ──────────────────────────────────────────────────────────────
  const guardar = useCallback(async (opciones: { bloquear?: boolean; estado?: string } = {}) => {
    if (!clienteId) { setMsg('Elige un cliente antes de guardar.'); return; }
    setGuardando(true);
    setMsg('');

    const cuerpo: Record<string, unknown> = {
      cliente_id: clienteId,
      cups_id: cupsId || null,
      titulo: clientes.find((c) => c.id === clienteId)?.nombre || 'Estudio',
      tarifa,
      estado: opciones.estado || (comparado ? 'comparativa' : 'validacion'),
      datos_factura: factura,
      revision,
      escenarios: comparado?.map((e) => e.escenario) ?? null,
      hipotesis: comparado?.[0]?.escenario.hipotesis ?? null,
      escenario_recomendado: rec?.elegido?.escenario.id || null,
      recomendacion: frase || null,
      coste_actual_anual: resumen?.costeActual ?? null,
      coste_propuesto_anual: resumen?.costePropuesto ?? null,
      ahorro_anual: resumen?.ahorroAnual ?? null,
      ahorro_pct: resumen?.ahorroPct ?? null,
    };
    if (opciones.bloquear) {
      // Congelar los precios es lo que hace que la propuesta que el cliente
      // tiene impresa siga diciendo lo mismo dentro de dos meses.
      cuerpo.bloqueado = true;
      cuerpo.fecha_bloqueo = new Date().toISOString();
      cuerpo.fecha_enviado = new Date().toISOString();
    }

    const token = await tokenSesion();
    const cabeceras = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const r = await fetch('/api/luz/estudios', {
      method: id ? 'PUT' : 'POST',
      headers: cabeceras,
      body: JSON.stringify(id ? { id, ...cuerpo } : cuerpo),
    });
    const j = await r.json().catch(() => ({}));
    setGuardando(false);

    if (!r.ok) { setMsg(j.error || 'No se pudo guardar el estudio.'); return; }
    if (!id && j.dato?.id) setId(j.dato.id);
    setMsg(opciones.bloquear ? '✅ Propuesta guardada con los precios congelados.' : '✅ Guardado.');
  }, [clienteId, cupsId, clientes, tarifa, comparado, factura, revision, rec, frase, resumen, id]);

  const info = TARIFA_INFO[tarifa];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button onClick={alSalir} className={btnSecundario}>
          <ArrowLeft className="w-4 h-4" /> Volver a la lista
        </button>
        {id && <span className="text-[11px] text-muted">Estudio guardado</span>}
      </div>

      {/* Los pasos, siempre visibles: saber en cuál estás y cuántos quedan */}
      <ol className="flex items-center gap-1 flex-wrap text-[11px] font-bold">
        {PASOS.map((p, i) => (
          <li key={p} className="flex items-center gap-1">
            <button
              onClick={() => setPaso(i)}
              className={`px-2.5 py-1 rounded-full border transition ${
                i === paso ? 'bg-accent text-white border-accent'
                  : i < paso ? 'border-emerald-500/40 text-emerald-400'
                  : 'border-border/40 text-muted'
              }`}
              aria-current={i === paso ? 'step' : undefined}
            >
              {i < paso ? <Check className="w-3 h-3 inline mr-1" /> : `${i + 1}. `}{p}
            </button>
            {i < PASOS.length - 1 && <ArrowRight className="w-3 h-3 text-muted" />}
          </li>
        ))}
      </ol>

      {msg && (
        <p className={`text-sm font-semibold ${msg.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>
          {msg}
        </p>
      )}

      {/* ── 0. FACTURA ──────────────────────────────────────────────────── */}
      {paso === 0 && (
        <>
          {/* ── LA VÍA PRINCIPAL: LA PLANTILLA ──────────────────────────── */}
          <Card>
            <h2 className="font-bold text-sm mb-1 flex items-center gap-2">
              <Table className="w-4 h-4 text-accent" /> Rellena la plantilla de consumos
            </h2>
            <p className="text-xs text-muted mb-4">
              Doce meses desglosados por periodo. Con el año entero, el consumo no se estima:
              se suma. Es la diferencia entre una comparativa que aguanta y una que se cae
              cuando el cliente la mira con su factura al lado.
            </p>

            <div className="grid sm:grid-cols-3 gap-2 mb-4">
              {(['2.0', '3.0', '6.1'] as TarifaAcceso[]).map((t) => (
                <a
                  key={t}
                  href={`/api/luz/plantilla?tarifa=${t}`}
                  className="flex items-center gap-2.5 p-3 rounded-xl border border-border/50 hover:border-accent/50 transition"
                >
                  <Download className="w-4 h-4 text-accent shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{TARIFA_INFO[t].nombre}</span>
                    <span className="block text-[10px] text-muted leading-snug">
                      {TARIFA_INFO[t].periodosEnergia.length} periodos · {TARIFA_INFO[t].descripcion}
                    </span>
                  </span>
                </a>
              ))}
            </div>

            {/* Cada tarifa tiene su plantilla y ese es el motivo, no un capricho */}
            <p className="text-[11px] text-muted mb-4">
              Descarga la de <b>su</b> tarifa: las columnas son exactamente los periodos que tiene.
              Rellenar tres de los seis que lleva una 3.0TD deja el ahorro calculado al doble del real
              y nada en pantalla lo delata.
            </p>

            <label className="flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border-2 border-dashed border-accent/40 bg-accent/[0.04] cursor-pointer hover:border-accent transition">
              {subiendo ? <Loader className="w-6 h-6 animate-spin text-accent" /> : <FileUp className="w-6 h-6 text-accent" />}
              <span className="text-sm font-bold">
                {subiendo ? 'Leyendo la plantilla…' : 'Subir la plantilla rellenada'}
              </span>
              <span className="text-[11px] text-muted">Archivo .xlsx</span>
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                disabled={subiendo}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) leerPlantilla(f); }}
              />
            </label>
          </Card>

          {/* ── LAS OTRAS DOS VÍAS ──────────────────────────────────────── */}
          <Card className="!p-4">
            <h3 className="font-bold text-xs uppercase text-muted mb-3">Si no tienes los doce meses</h3>

            <div className="grid sm:grid-cols-2 gap-2">
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/50 hover:border-accent/50 transition cursor-pointer">
                {leyendo ? <Loader className="w-4 h-4 animate-spin text-accent shrink-0" /> : <Camera className="w-4 h-4 text-accent shrink-0" />}
                <span className="min-w-0">
                  <span className="block text-sm font-bold">
                    {leyendo ? 'Leyendo…' : 'Leer una factura suelta'}
                  </span>
                  <span className="block text-[10px] text-muted leading-snug">
                    Foto o PDF. Sale un mes, así que el año se estima
                  </span>
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  disabled={leyendo}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) leerArchivo(f); }}
                />
              </label>

              <button
                onClick={() => setPaso(1)}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-border/50 hover:border-accent/50 transition text-left"
              >
                <PenLine className="w-4 h-4 text-accent shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold">Meter los datos a mano</span>
                  <span className="block text-[10px] text-muted leading-snug">
                    Directamente en el paso siguiente
                  </span>
                </span>
              </button>
            </div>

            <p className="text-[11px] text-muted mt-3">
              Con una sola factura, el año sale de multiplicar ese mes por doce. En esta comarca
              eso no vale: una granja con riego en agosto no se parece a la misma granja en febrero.
              Sirve para una primera cifra, no para firmar.
            </p>
          </Card>
        </>
      )}

      {/* ── 1. DATOS Y VALIDACIÓN ───────────────────────────────────────── */}
      {paso === 1 && (
        <>
          <Card>
            <h2 className="font-bold text-sm mb-3">De quién es</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="est-cliente">Cliente</label>
                <select
                  id="est-cliente"
                  className={inputCls}
                  value={clienteId}
                  onChange={(e) => { setClienteId(e.target.value); setCupsId(''); }}
                >
                  <option value="">Elegir cliente…</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="est-cups">Suministro</label>
                <select
                  id="est-cups"
                  className={inputCls}
                  value={cupsId}
                  onChange={(e) => setCupsId(e.target.value)}
                  disabled={!clienteId}
                >
                  <option value="">{clienteId ? 'Sin asignar todavía' : 'Elige antes el cliente'}</option>
                  {cupsDelCliente.map((c) => (
                    <option key={c.id} value={c.id}>{c.alias_suministro || c.cups}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3 mb-1">
              <h2 className="font-bold text-sm">Datos del suministro</h2>
              <span className="text-[11px] text-muted">{info.nombre} · {info.descripcion}</span>
            </div>
            <p className="text-xs text-muted mb-4">
              Los valores van separados por comas, en el orden de los periodos.
            </p>

            <div className="space-y-3">
              <div>
                <label className={labelCls} htmlFor="est-tarifa">Tarifa de acceso</label>
                <select
                  id="est-tarifa"
                  className={inputCls}
                  value={tarifa}
                  onChange={(e) => { setTarifa(e.target.value as TarifaAcceso); marcaMano('tarifa'); }}
                >
                  {(Object.keys(TARIFA_INFO) as TarifaAcceso[]).map((t) => (
                    <option key={t} value={t}>{TARIFA_INFO[t].nombre}</option>
                  ))}
                </select>
                <Pista origen={origenes.tarifa} confianza={revision.confianza.tarifa} />
              </div>

              <CampoLista
                id="est-consumos" etiqueta={`Consumo mensual por periodo (kWh) · ${info.periodosEnergia.join(' · ')}`}
                valor={consumos} alCambiar={(v) => { setConsumos(v); marcaMano('consumos'); }}
                origen={origenes.consumos} confianza={revision.confianza.consumos}
                pie={revision.consumoAnual > 0 ? `Salen ${Math.round(revision.consumoAnual).toLocaleString('es-ES')} kWh al año` : undefined}
              />
              <CampoLista
                id="est-potencias" etiqueta={`Potencia contratada (kW) · ${info.periodosPotencia.join(' · ')}`}
                valor={potencias} alCambiar={(v) => { setPotencias(v); marcaMano('potencias'); }}
                origen={origenes.potencias} confianza={revision.confianza.potencias}
              />
              <CampoLista
                id="est-pe" etiqueta="Precio de la energía que paga hoy (€/kWh)"
                valor={precioE} alCambiar={(v) => { setPrecioE(v); marcaMano('precios_energia'); }}
                origen={origenes.precios_energia} confianza={revision.confianza.precios_energia}
              />
              <CampoLista
                id="est-pp" etiqueta="Precio de la potencia que paga hoy (€/kW·día)"
                valor={precioP} alCambiar={(v) => { setPrecioP(v); marcaMano('precios_potencia'); }}
                origen={origenes.precios_potencia} confianza={revision.confianza.precios_potencia}
              />

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} htmlFor="est-titular">Titular</label>
                  <input id="est-titular" className={inputCls} value={titular}
                    onChange={(e) => { setTitular(e.target.value); marcaMano('titular'); }} />
                  <Pista origen={origenes.titular} confianza={revision.confianza.titular} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="est-cupstxt">CUPS</label>
                  <input id="est-cupstxt" className={inputCls} value={cupsTexto}
                    onChange={(e) => { setCupsTexto(e.target.value); marcaMano('cups'); }} />
                  <Pista origen={origenes.cups} confianza={revision.confianza.cups} />
                </div>
              </div>
            </div>
          </Card>

          {plantilla && <ResumenPlantilla lectura={plantilla} />}

          <Reparos revision={revision} />

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={comparar}
              disabled={!revision.puedeOfertar || comparando}
              className={`${btnPrimario} disabled:opacity-50`}
            >
              {comparando ? <Loader className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Comparar y preparar la oferta
            </button>
            <button onClick={() => guardar()} disabled={guardando || !clienteId} className={`${btnSecundario} disabled:opacity-50`}>
              <Save className="w-4 h-4" /> Guardar como borrador
            </button>
          </div>

          {/* El motivo va pegado al botón, no escondido en una pestaña. */}
          {bloqueo && (
            <p className="text-xs font-semibold text-amber-300">
              No se puede ofertar todavía: {bloqueo}
            </p>
          )}
        </>
      )}

      {/* ── 2. COMPARATIVA ──────────────────────────────────────────────── */}
      {paso === 2 && comparado && (
        <>
          {resumen && (
            <Card>
              <h2 className="font-bold text-sm mb-3">Resumen</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <Cifra etiqueta="Paga hoy" valor={fmtEur(resumen.costeActual)} />
                <Cifra etiqueta="Pagaría" valor={fmtEur(resumen.costePropuesto)} />
                <Cifra etiqueta="Ahorro al año" valor={fmtEur(resumen.ahorroAnual)} tono="text-emerald-400" />
                <Cifra etiqueta="Sobre lo que paga" valor={`${resumen.ahorroPct.toFixed(1)} %`} tono="text-emerald-400" />
              </div>
              <p className="text-[11px] text-muted mt-3">
                {resumen.tarifa} · {resumen.consumoAnualKwh.toLocaleString('es-ES')} kWh al año ·
                {resumen.permanenciaMeses ? ` ${resumen.permanenciaMeses} meses de permanencia` : ' sin permanencia'} ·
                riesgo {resumen.riesgo}
              </p>
            </Card>
          )}

          <Card>
            <h2 className="font-bold text-sm mb-3">Alternativas</h2>
            {comparado.length === 0 ? (
              <p className="text-sm text-muted">No hay precios cargados para esta tarifa.</p>
            ) : (
              <div className="space-y-2">
                {comparado.map((e) => {
                  const esRecomendado = rec?.elegido?.escenario.id === e.escenario.id;
                  return (
                    <div
                      key={e.escenario.id}
                      className={`p-3 rounded-xl border ${esRecomendado ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-border/40'}`}
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="font-bold text-sm flex items-center gap-2">
                          {e.escenario.titulo}
                          <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full border border-border/50 text-muted">
                            {TIPO_ESCENARIO_LABEL[e.escenario.tipo]}
                          </span>
                          {esRecomendado && (
                            <span className="text-[10px] font-black uppercase text-emerald-400">recomendada</span>
                          )}
                        </span>
                        <span className="text-sm font-black tabular-nums text-emerald-400">
                          {fmtEur(e.ahorroAnual)} <span className="text-muted font-semibold">/ año</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-muted mt-1">
                        Riesgo {e.riesgo}
                        {e.escenario.permanenciaMeses ? ` · ${e.escenario.permanenciaMeses} meses de permanencia` : ''}
                        {e.retornoAnios ? ` · se recupera en ${e.retornoAnios} años` : ''}
                      </p>
                      {/* El motivo del riesgo va siempre: un semáforo sin
                          explicación no lo usa nadie para decidir. */}
                      {e.porqueRiesgo.map((p, i) => (
                        <p key={i} className="text-[11px] text-amber-300 mt-0.5">· {p}</p>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {alertas.length > 0 && (
            <Card className="!p-4">
              <h2 className="font-bold text-sm mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Antes de enseñar esto
              </h2>
              <ul className="space-y-1">
                {alertas.map((a, i) => (
                  <li key={i} className="text-xs text-muted">
                    <span className={a.afectaAlAhorro ? 'text-amber-300 font-semibold' : ''}>
                      {a.afectaAlAhorro ? '⚠ ' : '· '}{a.texto}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <label className={labelCls} htmlFor="est-frase">Qué le decimos y por qué</label>
            <textarea
              id="est-frase"
              className={`${inputCls} min-h-24`}
              value={frase}
              onChange={(e) => setFrase(e.target.value)}
            />
            <p className="text-[11px] text-muted mt-1">
              Lo escribe el sistema y lo corrige quien conoce al cliente. Esta frase es la que
              va en la propuesta.
            </p>
          </Card>

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => guardar()} disabled={guardando} className={`${btnSecundario} disabled:opacity-50`}>
              <Save className="w-4 h-4" /> Guardar sin enviar
            </button>
            <button
              onClick={() => guardar({ bloquear: true, estado: 'propuesta' })}
              disabled={guardando || !rec?.elegido}
              className={`${btnPrimario} disabled:opacity-50`}
            >
              <Lock className="w-4 h-4" /> Dar por enviada y congelar precios
            </button>
          </div>
          <p className="text-[11px] text-muted">
            Congelar los precios es lo que hace que, dentro de dos meses, esta propuesta siga
            diciendo lo mismo que el papel que tiene el cliente.
          </p>
        </>
      )}

      {paso === 2 && !comparado && (
        <Card>
          <p className="text-sm text-muted">
            Todavía no hay comparativa. Vuelve al paso de datos y pulsa «Comparar».
          </p>
        </Card>
      )}

      {paso === 3 && (
        <Card>
          <h2 className="font-bold text-sm mb-2">Después de enviarla</h2>
          <p className="text-sm text-muted">
            El seguimiento de la propuesta se lleva desde el Pipeline, en la vista de parados:
            allí es donde se ve cuántos días lleva sin respuesta. Esta pantalla es para
            prepararla, no para perseguirla.
          </p>
        </Card>
      )}
    </div>
  );
}

// ── Piezas ───────────────────────────────────────────────────────────────────

function Cifra({ etiqueta, valor, tono = 'text-foreground' }: { etiqueta: string; valor: string; tono?: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted font-bold">{etiqueta}</p>
      <p className={`text-lg font-black tabular-nums ${tono}`}>{valor}</p>
    </div>
  );
}

/**
 * De dónde sale este dato y cuánto nos fiamos.
 *
 * Va debajo de cada campo, no en una leyenda aparte: una leyenda al pie se lee
 * una vez y se olvida, y el que se olvida es justo el dato dudoso.
 */
function Pista({ origen, confianza }: { origen?: string; confianza?: string }) {
  if (!origen && !confianza) return null;
  const dudoso = confianza === 'dudoso';
  const falta = confianza === 'falta';
  return (
    <p className={`text-[10px] mt-0.5 ${falta ? 'text-red-400' : dudoso ? 'text-amber-300' : 'text-muted'}`}>
      {origen ? ORIGEN_LABEL[origen as keyof typeof ORIGEN_LABEL] : ''}
      {origen && confianza ? ' · ' : ''}
      {falta ? 'falta' : dudoso ? 'conviene comprobarlo' : confianza ? 'comprobado' : ''}
    </p>
  );
}

function CampoLista({
  id, etiqueta, valor, alCambiar, origen, confianza, pie,
}: {
  id: string; etiqueta: string; valor: string; alCambiar: (v: string) => void;
  origen?: string; confianza?: string; pie?: string;
}) {
  return (
    <div>
      <label className={labelCls} htmlFor={id}>{etiqueta}</label>
      {/* type="text" a propósito: un campo numérico no deja escribir comas ni
          separar valores, y aquí van varios periodos seguidos. */}
      <input id={id} type="text" inputMode="decimal" className={inputCls}
        value={valor} onChange={(e) => alCambiar(e.target.value)} />
      {pie && <p className="text-[10px] text-muted mt-0.5">{pie}</p>}
      <Pista origen={origen} confianza={confianza} />
    </div>
  );
}

/**
 * Lo que ha aportado la plantilla: cuántos meses reales hay detrás.
 *
 * Se enseña porque cambia lo que vale la comparativa. «12 meses, 365 días» es
 * un año medido; «3 meses, 90 días» es un año estimado desde el verano, y
 * quien firme tiene derecho a saber sobre qué está construido el ahorro.
 */
function ResumenPlantilla({ lectura }: { lectura: LecturaPlantilla }) {
  return (
    <Card className="!p-4">
      <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
        <Table className="w-4 h-4 text-accent" /> Lo que trae la plantilla
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <Cifra etiqueta="Meses" valor={String(lectura.meses.length)} />
        <Cifra etiqueta="Días facturados" valor={String(lectura.diasTotales)} />
        <Cifra
          etiqueta="Consumo al año"
          valor={`${Math.round(lectura.consumoAnual).toLocaleString('es-ES')} kWh`}
        />
        <Cifra
          etiqueta="El año es"
          valor={lectura.extrapolado ? 'estimado' : 'medido'}
          tono={lectura.extrapolado ? 'text-amber-300' : 'text-emerald-400'}
        />
      </div>
      {lectura.extrapolado && (
        <p className="text-[11px] text-amber-300 mt-3">
          Con {lectura.meses.length} mes(es) el año se calcula extrapolando por días. Sirve, pero la
          estacionalidad puede desviarlo: si puedes conseguir el resto de facturas, la propuesta
          aguantará mucho mejor delante del cliente.
        </p>
      )}
      {lectura.maximetros.some((m) => m > 0) && (
        <p className="text-[11px] text-muted mt-2">
          Hay maxímetro ({lectura.maximetros.map((m) => `${m} kW`).join(' · ')}): con eso la potencia
          recomendada deja de ser una suposición y se puede afinar de verdad.
        </p>
      )}
    </Card>
  );
}

/** Lo que falta y lo que conviene mirar, separado por gravedad. */
function Reparos({ revision }: { revision: Revision }) {
  if (!revision.reparos.length) {
    return (
      <Card className="!p-4">
        <p className="text-sm text-emerald-400 font-semibold flex items-center gap-2">
          <Check className="w-4 h-4" /> Los datos están completos y dentro de lo normal.
        </p>
      </Card>
    );
  }
  const bloquean = revision.reparos.filter((r) => r.gravedad === 'bloquea');
  const revisar = revision.reparos.filter((r) => r.gravedad === 'revisar');

  return (
    <Card className="!p-4 space-y-3">
      {bloquean.length > 0 && (
        <div>
          <h3 className="text-xs font-black uppercase text-red-400 mb-1.5">Sin esto no se puede ofertar</h3>
          <ul className="space-y-1.5">
            {bloquean.map((r, i) => (
              <li key={i} className="text-xs">
                <span className="font-semibold text-red-300 flex items-start gap-1.5">
                  <X className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {r.texto}
                </span>
                <span className="block text-muted ml-5">{r.arreglo}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {revisar.length > 0 && (
        <div>
          <h3 className="text-xs font-black uppercase text-amber-300 mb-1.5">Conviene mirarlo</h3>
          <ul className="space-y-1.5">
            {revisar.map((r, i) => (
              <li key={i} className="text-xs">
                <span className="font-semibold text-amber-200">{r.texto}</span>
                <span className="block text-muted">{r.arreglo}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!revision.puedeCompararAhorro && (
        <p className="text-[11px] text-muted">
          Sin los precios que paga hoy se puede preparar la oferta, pero no se puede decir
          cuánto ahorra. Son dos cosas distintas.
        </p>
      )}
    </Card>
  );
}
