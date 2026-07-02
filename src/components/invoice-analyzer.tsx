'use client';

import { useState } from 'react';
import { ScrollReveal } from './scroll-reveal';
import {
  TARIFA_INFO,
  TarifaAcceso,
  DatosSuministro,
  ResultadoComparativa,
  compararConComercializadoras,
  guardarAnalisisWeb,
} from '@/lib/tarifas';
import { generarPlantillaAnalisis, leerPlantillaAnalisis } from '@/lib/plantilla-analisis';

type Paso = 'intro' | 'metodo' | 'excel' | 'formulario' | 'resultados';

const eur = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const inputClass =
  'w-full rounded-lg border border-border/40 bg-card/60 px-3 py-2.5 text-foreground placeholder-muted/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 tabular-nums';

function SeccionNumero({ n, titulo, ayuda }: { n: number; titulo: string; ayuda: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-black text-accent border border-accent/30">
        {n}
      </div>
      <div>
        <h3 className="text-base font-bold text-foreground">{titulo}</h3>
        <p className="text-xs text-muted">{ayuda}</p>
      </div>
    </div>
  );
}

export function InvoiceAnalyzer() {
  const [paso, setPaso] = useState<Paso>('intro');
  const [dragActive, setDragActive] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  // Datos del formulario
  const [tarifa, setTarifa] = useState<TarifaAcceso>('2.0');
  const [consumos, setConsumos] = useState<string[]>(Array(6).fill(''));
  const [potencias, setPotencias] = useState<string[]>(Array(6).fill(''));
  const [preciosE, setPreciosE] = useState<string[]>(Array(6).fill(''));
  const [preciosP, setPreciosP] = useState<string[]>(Array(6).fill(''));
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');

  const [resultado, setResultado] = useState<ResultadoComparativa | null>(null);
  const [guardado, setGuardado] = useState(false);

  const info = TARIFA_INFO[tarifa];
  const nE = info.periodosEnergia.length;
  const nP = info.periodosPotencia.length;

  const num = (s: string) => {
    const n = parseFloat((s || '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  };

  const setArr = (setter: React.Dispatch<React.SetStateAction<string[]>>, i: number, v: string) =>
    setter((prev) => prev.map((x, idx) => (idx === i ? v : x)));

  async function analizar(datos: DatosSuministro, nombreCliente: string, tel: string) {
    setCargando(true);
    setError('');
    try {
      const res = await compararConComercializadoras(datos);
      setResultado(res);
      setPaso('resultados');
      // Guardar en Supabase (no bloquea los resultados si falla)
      const ok = await guardarAnalisisWeb({
        nombre: nombreCliente,
        telefono: tel,
        datos,
        resultado: res,
      });
      setGuardado(ok);
    } catch (e) {
      console.error(e);
      setError('No se pudo completar el análisis. Inténtalo de nuevo o llámanos.');
    } finally {
      setCargando(false);
    }
  }

  function handleSubmitFormulario(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const datos: DatosSuministro = {
      tarifa,
      consumosMes: consumos.slice(0, nE).map(num),
      potencias: potencias.slice(0, nP).map(num),
      preciosEnergia: preciosE.slice(0, nE).map(num),
      preciosPotencia: preciosP.slice(0, nP).map(num),
    };

    if (datos.consumosMes.every((c) => c === 0)) {
      setError('Introduce al menos un consumo de energía.');
      return;
    }
    if (datos.preciosEnergia.every((p) => p === 0)) {
      setError('Introduce los precios de energía de tu factura actual.');
      return;
    }
    if (!nombre.trim()) {
      setError('Escribe tu nombre para poder enviarte el estudio.');
      return;
    }
    analizar(datos, nombre.trim(), telefono.trim());
  }

  async function procesarArchivo(file: File) {
    setError('');
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('Sube la plantilla en formato Excel (.xlsx). Puedes descargarla aquí abajo.');
      return;
    }
    setCargando(true);
    try {
      const datos = await leerPlantillaAnalisis(file);
      setNombre(datos.nombre);
      setTelefono(datos.telefono);
      setTarifa(datos.suministro.tarifa);
      await analizar(datos.suministro, datos.nombre || 'Web (plantilla Excel)', datos.telefono);
    } catch (e: any) {
      setError(e?.message || 'No se pudo leer el archivo. Revisa que sea la plantilla oficial.');
      setCargando(false);
    }
  }

  function reiniciar() {
    setPaso('intro');
    setResultado(null);
    setGuardado(false);
    setError('');
    setConsumos(Array(6).fill(''));
    setPotencias(Array(6).fill(''));
    setPreciosE(Array(6).fill(''));
    setPreciosP(Array(6).fill(''));
  }

  return (
    <div className="space-y-12 py-16">
      {/* ══════════ INTRO ══════════ */}
      {paso === 'intro' && (
        <ScrollReveal>
          <div className="mx-auto max-w-2xl px-6 space-y-8 text-center">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-black text-foreground">
                ¿Cuánto puedes ahorrar?
              </h1>
              <p className="text-lg text-muted">
                Compara tu factura actual con las tarifas que negociamos para nuestros clientes.
                Cálculo real por periodos, en 2 minutos y gratis.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { value: 'Real', label: 'Comparativa', subtext: 'con tarifas negociadas' },
                { value: '2 min', label: 'Tiempo', subtext: '100% online' },
                { value: 'Gratis', label: 'Sin compromiso', subtext: 'y sin permanencia' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-accent/20 bg-accent/5 p-4">
                  <div className="text-2xl font-black text-accent">{stat.value}</div>
                  <div className="text-xs font-bold text-muted uppercase tracking-wider mt-1">
                    {stat.label}
                  </div>
                  <div className="text-[10px] text-muted/60">{stat.subtext}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setPaso('metodo')}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-light px-8 py-4 text-lg font-black text-white shadow-lg transition-all hover:scale-[1.04] hover:shadow-[0_0_30px_rgba(255,51,51,0.4)]"
            >
              Empezar análisis →
            </button>
          </div>
        </ScrollReveal>
      )}

      {/* ══════════ MÉTODO ══════════ */}
      {paso === 'metodo' && (
        <ScrollReveal>
          <div className="mx-auto max-w-3xl px-6 space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black text-foreground">Elige cómo introducir tus datos</h2>
              <p className="text-muted">Necesitarás tu última factura de luz a mano</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <button
                onClick={() => setPaso('formulario')}
                className="group relative overflow-hidden rounded-2xl border-2 border-accent/30 bg-gradient-to-br from-accent/10 to-transparent p-8 text-left transition-all hover:border-accent/60 hover:shadow-[0_0_30px_rgba(255,51,51,0.2)]"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent to-transparent scale-x-0 group-hover:scale-x-100 transition-transform" />
                <div className="space-y-4">
                  <div className="text-5xl">🧮</div>
                  <h3 className="text-lg font-bold text-foreground">Calculadora guiada</h3>
                  <p className="text-sm text-muted">
                    Te pedimos los datos paso a paso: tarifa, potencias, consumos y precios.
                    Con ayudas para encontrar cada dato en tu factura.
                  </p>
                  <div className="text-xs text-accent font-semibold pt-2">
                    ✓ Recomendado · ✓ Guiado paso a paso
                  </div>
                </div>
              </button>

              <button
                onClick={() => setPaso('excel')}
                className="group relative overflow-hidden rounded-2xl border-2 border-secondary/30 bg-gradient-to-br from-secondary/10 to-transparent p-8 text-left transition-all hover:border-secondary/60 hover:shadow-[0_0_30px_rgba(0,212,255,0.2)]"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-secondary to-transparent scale-x-0 group-hover:scale-x-100 transition-transform" />
                <div className="space-y-4">
                  <div className="text-5xl">📊</div>
                  <h3 className="text-lg font-bold text-foreground">Plantilla Excel</h3>
                  <p className="text-sm text-muted">
                    Descarga nuestra plantilla, rellénala con calma y súbela.
                    Ideal si gestionas varios suministros.
                  </p>
                  <div className="text-xs text-secondary font-semibold pt-2">
                    ✓ Plantilla incluida · ✓ Lectura automática
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={() => setPaso('intro')}
              className="w-full text-sm text-muted hover:text-foreground transition"
            >
              ← Volver
            </button>
          </div>
        </ScrollReveal>
      )}

      {/* ══════════ EXCEL ══════════ */}
      {paso === 'excel' && (
        <ScrollReveal>
          <div className="mx-auto max-w-2xl px-6 space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black text-foreground">Plantilla Excel</h2>
              <p className="text-muted">Dos pasos: descarga y rellena · luego súbela aquí</p>
            </div>

            {/* Paso 1: descargar */}
            <div className="rounded-2xl border border-secondary/30 bg-secondary/5 p-6 space-y-4">
              <SeccionNumero
                n={1}
                titulo="Descarga la plantilla"
                ayuda="Incluye instrucciones y las celdas exactas que necesitamos"
              />
              <button
                onClick={() => generarPlantillaAnalisis()}
                className="inline-flex items-center gap-2 rounded-lg border border-secondary/40 bg-secondary/10 px-5 py-3 font-bold text-secondary transition-all hover:bg-secondary/20"
              >
                ⬇ Descargar Plantilla_Analisis_Gesmeco.xlsx
              </button>
            </div>

            {/* Paso 2: subir */}
            <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6 space-y-4">
              <SeccionNumero
                n={2}
                titulo="Sube la plantilla rellenada"
                ayuda="La leemos automáticamente y calculamos tu ahorro"
              />
              <label
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) procesarArchivo(f);
                }}
                className={`block rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-accent bg-accent/10 scale-[1.02]'
                    : 'border-border/40 bg-surface/40 hover:border-accent/50 hover:bg-surface/60'
                }`}
              >
                <input
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) procesarArchivo(f);
                    e.target.value = '';
                  }}
                />
                <div className="space-y-2">
                  <div className="text-4xl">📤</div>
                  <p className="text-base font-bold text-foreground">
                    {cargando ? 'Leyendo plantilla…' : 'Arrastra el Excel aquí'}
                  </p>
                  <p className="text-sm text-muted">o haz clic para seleccionarlo (.xlsx)</p>
                </div>
              </label>
            </div>

            {error && (
              <div className="rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm font-semibold text-accent">
                ⚠ {error}
              </div>
            )}

            <button
              onClick={() => {
                setError('');
                setPaso('metodo');
              }}
              className="w-full text-sm text-muted hover:text-foreground transition"
            >
              ← Volver
            </button>
          </div>
        </ScrollReveal>
      )}

      {/* ══════════ CALCULADORA ══════════ */}
      {paso === 'formulario' && (
        <ScrollReveal>
          <div className="mx-auto max-w-3xl px-6 space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black text-foreground">Calculadora de ahorro</h2>
              <p className="text-muted">
                Todos los datos aparecen en tu factura, en el apartado de detalle
              </p>
            </div>

            <form onSubmit={handleSubmitFormulario} className="space-y-6">
              {/* 1 · Tarifa */}
              <div className="rounded-2xl border border-border/30 bg-surface/40 p-6 space-y-4">
                <SeccionNumero
                  n={1}
                  titulo="Tu tarifa de acceso"
                  ayuda='Aparece en tu factura como "Peaje de acceso" o "Tarifa": 2.0TD, 3.0TD o 6.1TD'
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(Object.keys(TARIFA_INFO) as TarifaAcceso[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTarifa(t)}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${
                        tarifa === t
                          ? 'border-accent/60 bg-accent/10 shadow-[0_0_20px_rgba(255,51,51,0.15)]'
                          : 'border-border/40 bg-card/50 hover:border-accent/30'
                      }`}
                    >
                      <div className={`text-lg font-black ${tarifa === t ? 'text-accent' : 'text-foreground'}`}>
                        {TARIFA_INFO[t].nombre}
                      </div>
                      <div className="text-xs text-muted mt-1">{TARIFA_INFO[t].descripcion}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2 · Potencias contratadas */}
              <div className="rounded-2xl border border-border/30 bg-surface/40 p-6 space-y-4">
                <SeccionNumero
                  n={2}
                  titulo="Potencia contratada (kW)"
                  ayuda='En el apartado "Potencia" de tu factura, un valor por periodo'
                />
                <div className={`grid gap-3 ${nP <= 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
                  {info.periodosPotencia.map((p, i) => (
                    <div key={p}>
                      <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                        {p}
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        inputMode="decimal"
                        placeholder="ej: 4.6"
                        value={potencias[i]}
                        onChange={(e) => setArr(setPotencias, i, e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 3 · Consumos */}
              <div className="rounded-2xl border border-border/30 bg-surface/40 p-6 space-y-4">
                <SeccionNumero
                  n={3}
                  titulo="Consumo mensual por periodo (kWh)"
                  ayuda='En "Detalle de consumo": la energía de un mes normal, por periodo'
                />
                <div className={`grid gap-3 ${nE <= 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
                  {info.periodosEnergia.map((p, i) => (
                    <div key={p}>
                      <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                        {p}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        placeholder="ej: 120"
                        value={consumos[i]}
                        onChange={(e) => setArr(setConsumos, i, e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 4 · Precios actuales */}
              <div className="rounded-2xl border border-border/30 bg-surface/40 p-6 space-y-5">
                <SeccionNumero
                  n={4}
                  titulo="Lo que pagas ahora"
                  ayuda="Los precios unitarios de tu factura actual, por periodo"
                />

                <div>
                  <p className="text-sm font-bold text-foreground mb-2">
                    Precio de la energía <span className="text-muted font-normal">(€/kWh)</span>
                  </p>
                  <div className={`grid gap-3 ${nE <= 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
                    {info.periodosEnergia.map((p, i) => (
                      <div key={p}>
                        <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                          {p}
                        </label>
                        <input
                          type="number"
                          step="0.000001"
                          min="0"
                          inputMode="decimal"
                          placeholder="ej: 0.145"
                          value={preciosE[i]}
                          onChange={(e) => setArr(setPreciosE, i, e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold text-foreground mb-2">
                    Precio de la potencia <span className="text-muted font-normal">(€/kW·día)</span>
                  </p>
                  <div className={`grid gap-3 ${nP <= 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
                    {info.periodosPotencia.map((p, i) => (
                      <div key={p}>
                        <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                          {p}
                        </label>
                        <input
                          type="number"
                          step="0.000001"
                          min="0"
                          inputMode="decimal"
                          placeholder="ej: 0.089"
                          value={preciosP[i]}
                          onChange={(e) => setArr(setPreciosP, i, e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 5 · Contacto */}
              <div className="rounded-2xl border border-border/30 bg-surface/40 p-6 space-y-4">
                <SeccionNumero
                  n={5}
                  titulo="Tus datos"
                  ayuda="Para guardar tu estudio y poder enviarte la propuesta completa"
                />
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Nombre y apellidos"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                      Teléfono (opcional)
                    </label>
                    <input
                      type="tel"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="600 000 000"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm font-semibold text-accent">
                  ⚠ {error}
                </div>
              )}

              <button
                type="submit"
                disabled={cargando}
                className="w-full rounded-xl bg-gradient-to-r from-accent to-accent-light px-4 py-4 text-lg font-black text-white transition-all hover:scale-[1.01] hover:shadow-[0_0_30px_rgba(255,51,51,0.4)] disabled:opacity-60"
              >
                {cargando ? 'Calculando…' : 'Calcular mi ahorro →'}
              </button>
            </form>

            <button
              onClick={() => {
                setError('');
                setPaso('metodo');
              }}
              className="w-full text-sm text-muted hover:text-foreground transition"
            >
              ← Volver
            </button>
          </div>
        </ScrollReveal>
      )}

      {/* ══════════ RESULTADOS ══════════ */}
      {paso === 'resultados' && resultado && (
        <ScrollReveal>
          <div className="mx-auto max-w-4xl px-6 space-y-8">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2">
                <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest text-accent">
                  Análisis completado{guardado ? ' · Estudio guardado' : ''}
                </span>
              </div>
              <h2 className="text-4xl font-black text-foreground">
                {nombre ? `${nombre.split(' ')[0]}, este` : 'Este'} es tu resultado
              </h2>
            </div>

            {/* Ahorro principal */}
            {resultado.mejorOferta && resultado.mejorOferta.ahorroAnual > 0 ? (
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30 p-8 md:p-12">
                <div className="absolute top-0 right-0 w-40 h-40 bg-accent/10 rounded-full -mr-20 -mt-20" />
                <div className="relative space-y-2">
                  <p className="text-sm font-bold uppercase tracking-widest text-accent">
                    Podrías ahorrar cada año
                  </p>
                  <div className="text-5xl md:text-7xl font-black text-accent tabular-nums">
                    {eur(resultado.mejorOferta.ahorroAnual)} €
                  </div>
                  <p className="text-base text-muted">
                    Un {resultado.mejorOferta.ahorroPorcentaje.toFixed(1)}% menos, con la tarifa{' '}
                    <span className="font-bold text-foreground">
                      {resultado.mejorOferta.comercializadora}
                    </span>{' '}
                    que negociamos para nuestros clientes
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-secondary/30 bg-secondary/5 p-8 text-center space-y-2">
                <div className="text-3xl">👏</div>
                <h3 className="text-xl font-black text-foreground">
                  Tu tarifa actual está bien negociada
                </h3>
                <p className="text-sm text-muted">
                  {resultado.ofertas.length === 0
                    ? 'Ahora mismo no tenemos una oferta comparable cargada para tu tarifa. Te contactaremos con un estudio manual.'
                    : 'Con los precios que manejamos hoy no mejoramos tu factura. Y te lo decimos tal cual: si no vale la pena, no lo vendemos.'}
                </p>
              </div>
            )}

            {/* Tu coste actual: desglose por periodos */}
            <div className="rounded-2xl border border-border/30 bg-surface/40 p-6 space-y-4">
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <h3 className="text-lg font-black text-foreground">Tu coste actual (anual)</h3>
                <div className="text-2xl font-black text-foreground tabular-nums">
                  {eur(resultado.actual.total)} €
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Energía */}
                <div className="rounded-xl border border-border/30 bg-card/40 p-4">
                  <div className="flex justify-between text-sm font-bold text-foreground mb-3">
                    <span>⚡ Energía</span>
                    <span className="tabular-nums">{eur(resultado.actual.totalEnergia)} €</span>
                  </div>
                  <div className="space-y-2">
                    {resultado.actual.energia.map((p) => (
                      <div key={p.periodo} className="flex items-center justify-between text-xs">
                        <span className="text-muted">{p.periodo}</span>
                        <span className="text-muted tabular-nums">
                          {p.consumo} kWh/mes × {p.precio} €
                        </span>
                        <span className="font-bold text-foreground tabular-nums">
                          {eur(p.costeAnual)} €
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Potencia */}
                <div className="rounded-xl border border-border/30 bg-card/40 p-4">
                  <div className="flex justify-between text-sm font-bold text-foreground mb-3">
                    <span>🔌 Potencia</span>
                    <span className="tabular-nums">{eur(resultado.actual.totalPotencia)} €</span>
                  </div>
                  <div className="space-y-2">
                    {resultado.actual.potencia.map((p) => (
                      <div key={p.periodo} className="flex items-center justify-between text-xs">
                        <span className="text-muted">{p.periodo}</span>
                        <span className="text-muted tabular-nums">
                          {p.consumo} kW × {p.precio} €/día
                        </span>
                        <span className="font-bold text-foreground tabular-nums">
                          {eur(p.costeAnual)} €
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted/70">
                * Coste de energía y potencia antes de impuestos (impuesto eléctrico e IVA se aplican
                igual en todas las comercializadoras).
              </p>
            </div>

            {/* Comparativa de ofertas */}
            {resultado.ofertas.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-black text-foreground">
                  Comparativa con nuestras tarifas
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {resultado.ofertas.map((oferta, i) => {
                    const esMejor = i === 0 && oferta.ahorroAnual > 0;
                    return (
                      <div
                        key={oferta.comercializadora}
                        className={`relative rounded-2xl border p-6 space-y-3 ${
                          esMejor
                            ? 'border-accent/50 bg-accent/10 shadow-[0_0_30px_rgba(255,51,51,0.15)]'
                            : 'border-border/40 bg-card/50'
                        }`}
                      >
                        {esMejor && (
                          <div className="absolute -top-3 left-4 rounded-full bg-gradient-to-r from-accent to-accent-light px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                            Mejor opción
                          </div>
                        )}
                        <div className="flex items-baseline justify-between">
                          <h4 className="text-base font-black text-foreground">
                            {oferta.comercializadora}
                          </h4>
                          <div className="text-xl font-black text-foreground tabular-nums">
                            {eur(oferta.coste.total)} €<span className="text-xs text-muted">/año</span>
                          </div>
                        </div>
                        <div className="h-px bg-border/30" />
                        <div className="flex justify-between text-xs text-muted">
                          <span>Energía: {eur(oferta.coste.totalEnergia)} €</span>
                          <span>Potencia: {eur(oferta.coste.totalPotencia)} €</span>
                        </div>
                        <div
                          className={`rounded-lg px-3 py-2 text-sm font-bold tabular-nums ${
                            oferta.ahorroAnual > 0
                              ? 'bg-accent/15 text-accent'
                              : 'bg-border/30 text-muted'
                          }`}
                        >
                          {oferta.ahorroAnual > 0
                            ? `↓ Ahorras ${eur(oferta.ahorroAnual)} €/año (${oferta.ahorroPorcentaje.toFixed(1)}%)`
                            : 'No mejora tu tarifa actual'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="rounded-2xl bg-gradient-to-br from-accent/15 to-secondary/15 border border-accent/20 p-8 text-center space-y-4">
              <h3 className="text-2xl font-black text-foreground">
                ¿Lo hacemos realidad?
              </h3>
              <p className="text-muted">
                Tu estudio ya está guardado. Un asesor lo revisará y te llamará para confirmar los
                números y gestionar el cambio, sin cortes de suministro y sin papeleo para ti.
              </p>
              <a
                href="/contacto"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-light px-8 py-4 font-bold text-white shadow-lg transition-all hover:scale-[1.04] hover:shadow-[0_0_30px_rgba(255,51,51,0.4)]"
              >
                Hablar con mi asesor →
              </a>
            </div>

            <button
              onClick={reiniciar}
              className="w-full text-sm text-muted hover:text-foreground transition font-semibold"
            >
              ← Hacer otro análisis
            </button>
          </div>
        </ScrollReveal>
      )}
    </div>
  );
}
