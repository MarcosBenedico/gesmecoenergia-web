'use client';

/**
 * FICHA DEL SUMINISTRO — cinco pestañas.
 *
 * Hasta ahora un CUPS no tenía ficha: se editaba en una fila de una tabla de
 * doce columnas o en una rejilla dentro de la ficha del cliente. Eso servía
 * para corregir un dato suelto y para nada más — no había ningún sitio donde
 * mirar QUÉ LE PASA a un suministro concreto.
 *
 * El orden de las pestañas es el de la frecuencia con la que se abren, y por
 * eso la primera no es «Datos» sino «Qué pasa». Ver `formulario-suministro.ts`.
 *
 * NO HAY UN CATÁLOGO DE ESTADOS NUEVO: la fase, la alerta, el bloqueo y la
 * próxima acción salen de `ficha-suministro.ts`, que ya es quien lo decide en
 * la ficha del cliente. Dos pantallas que calculan lo mismo por su cuenta
 * acaban diciendo cosas distintas del mismo suministro.
 */

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Save, Plug, Building2, CheckCircle2, AlertTriangle, Clock, FileText,
} from 'lucide-react';
import {
  LuzCups, LuzCliente, LuzTarea, LuzContrato, LuzVisita,
  ESTADOS_CUPS, ESTADO_CUPS_LABEL, TIPO_TAREA_LABEL, ESTADO_CONTRATO_LABEL,
  TIPO_CONTRATO_LABEL, fmtKwh, fmtFecha, fmtEur,
} from '@/lib/luz';
import { estadoDeSuministro, comoSeLee, PRIORIDAD } from '@/lib/ficha-suministro';
import {
  PESTANAS, pestanaValida, valoresDesde, prepararSuministro,
  type ValoresSuministro,
} from '@/lib/formulario-suministro';
import { ETAPA } from '@/lib/etapas';
import { zonaDeParada } from '@/lib/zonas';
import { Card, EstadoCarga, useListaLuz, guardarLuz, btnPrimario, btnSecundario } from '../../ui';
import FormularioSuministro, { useAvisosSuministro } from '../formulario';

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Dónde se recuerda la última pestaña abierta. */
const CLAVE_PESTANA = 'luz_cups_pestana';

export default function FichaSuministro({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const cups = useListaLuz<LuzCups>('cups');
  const clientes = useListaLuz<LuzCliente>('clientes');
  const tareas = useListaLuz<LuzTarea>('tareas');
  const contratos = useListaLuz<LuzContrato>('contratos');
  const visitas = useListaLuz<LuzVisita>('visitas');

  const [pestana, setPestana] = useState('estado');
  const [valores, setValores] = useState<ValoresSuministro>({});
  const [tocado, setTocado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');

  const hoy = hoyISO();
  const s = useMemo(() => cups.datos.find((c) => c.id === id) || null, [cups.datos, id]);
  const cliente = useMemo(
    () => clientes.datos.find((c) => c.id === s?.cliente_id) || null, [clientes.datos, s]);

  const misTareas = useMemo(() => tareas.datos.filter((t) => t.cups_id === id), [tareas.datos, id]);
  const misContratos = useMemo(() => contratos.datos.filter((k) => k.cups_id === id), [contratos.datos, id]);
  const misVisitas = useMemo(
    () => visitas.datos.filter((v) => v.cliente_id === s?.cliente_id), [visitas.datos, s]);

  // La pestaña se recuerda: quien entra siempre a mirar el contrato no tiene
  // que volver a elegirla cada vez.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPestana(pestanaValida(localStorage.getItem(CLAVE_PESTANA)));
  }, []);
  const irA = (p: string) => {
    setPestana(p);
    try { localStorage.setItem(CLAVE_PESTANA, p); } catch { /* modo privado */ }
  };

  // Al cargar el suministro se rellena el formulario. Si ya se ha tocado algo,
  // NO se pisa: perder lo escrito porque una lista se recargó sola es la
  // manera más rápida de que se deje de usar una pantalla.
  useEffect(() => {
    if (!s || tocado) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValores(valoresDesde(s as unknown as Record<string, unknown>));
  }, [s, tocado]);

  const { avisos, puedeGuardar } = useAvisosSuministro(valores);

  const estado = useMemo(() => {
    if (!s) return null;
    return estadoDeSuministro({
      id: s.id, cups: s.cups, alias: s.alias_suministro, direccion: s.direccion_suministro,
      tarifa: s.tarifa_acceso, comercializadora: s.comercializadora_actual,
      tipoContrato: s.tipo_contrato, estadoCups: s.estado_cups,
      consumoAnual: s.consumo_anual_kwh, potencias: s.potencias_kw,
      fechaFinContrato: s.fecha_fin_contrato,
      fechaLimitePreaviso: s.fecha_limite_preaviso,
      fechaFinPermanencia: s.fecha_fin_permanencia,
      tareas: misTareas, contratos: misContratos,
    }, hoy);
  }, [s, misTareas, misContratos, hoy]);

  const guardar = useCallback(async () => {
    if (!s || guardando) return;
    setGuardando(true); setMsg('');
    // El PUT de /api/luz lleva dentro la sincronización de estados entre CUPS,
    // pipeline y contrato. Saltárselo por ir más rápido dejaría los estados
    // descuadrados, que es lo que ya se aprendió en «Rellenar en tanda».
    //
    // `version_leida` va SOLO en este formulario, y por lo que tarda en
    // rellenarse: es el de cuatro bloques que se abre y se deja abierto. Si
    // David corrige el teléfono desde la calle mientras esta ficha está en
    // pantalla, guardar aquí borraría su cambio sin decir nada. Con la versión,
    // el servidor rechaza y avisa en vez de pisar. Los guardados de un campo
    // suelto no la mandan: son instantáneos y no da tiempo a chocar.
    const err = await guardarLuz('cups', 'PUT', {
      id: s.id, version_leida: s.actualizado_en || null, ...prepararSuministro(valores),
    });
    setGuardando(false);
    if (err) { setMsg(err); return; }
    setTocado(false);
    setMsg('Guardado.');
    cups.recargar();
  }, [s, valores, guardando, cups]);

  const cargando = cups.cargando || clientes.cargando;

  if (!cargando && !s) {
    return (
      <Card>
        <p className="text-sm font-bold">Este suministro no existe o está en la papelera.</p>
        <Link href="/gestor/luz/cups" className={`${btnSecundario} mt-3 inline-flex`}>
          <ArrowLeft className="w-4 h-4" /> Volver a Suministros
        </Link>
      </Card>
    );
  }

  const zona = s ? zonaDeParada(s.direccion_suministro || cliente?.direccion_fiscal, null, cliente?.zona) : null;

  return (
    <div className="space-y-4">
      <EstadoCarga onReintentar={cups.recargar} cargando={cargando} error={cups.error} faltaMigracion={cups.faltaMigracion}
        vacio={false} textoVacio="" sqlFile="supabase_luz.sql" />

      {s && (
        <>
          {/* ── Cabecera: de quién es y qué punto es ───────────────────── */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <Link href="/gestor/luz/cups" className="text-[11px] text-muted hover:text-accent inline-flex items-center gap-1">
                <ArrowLeft className="w-3 h-3" /> Suministros
              </Link>
              <h1 className="text-xl font-black text-foreground flex items-center gap-2 mt-0.5">
                <Plug className="w-5 h-5 text-accent shrink-0" />
                {s.alias_suministro || s.cups}
              </h1>
              <p className="text-xs text-muted mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {cliente && (
                  <Link href={`/gestor/luz/clientes/${cliente.id}`} className="font-bold text-foreground hover:text-accent inline-flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> {cliente.nombre}
                  </Link>
                )}
                <span className="font-mono">{s.cups}</span>
                {s.tarifa_acceso && <span>· {s.tarifa_acceso}</span>}
                {zona && <span style={{ color: zona.color }}>· {zona.nombre}</span>}
              </p>
            </div>

            {tocado && (
              <div className="flex items-center gap-2">
                {/*
                  El choque de versión se pinta distinto y con salida: decirle
                  a alguien «recarga» sin darle el botón es pedirle que pierda
                  lo que tiene escrito buscándolo en el menú.
                */}
                {msg && (
                  <span className={`text-xs ${msg.includes('mientras lo tenías abierto') ? 'text-amber-300 max-w-xs' : 'text-muted'}`}>
                    {msg}
                    {msg.includes('mientras lo tenías abierto') && (
                      <button onClick={() => cups.recargar()} className="ml-2 underline font-bold">
                        Ver lo que hay ahora
                      </button>
                    )}
                  </span>
                )}
                <button onClick={guardar} disabled={!puedeGuardar || guardando} className={btnPrimario}>
                  <Save className="w-4 h-4" /> {guardando ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            )}
            {!tocado && msg && <span className="text-xs text-emerald-400 font-semibold self-center">{msg}</span>}
          </div>

          {/* Lo que impide guardar se dice ARRIBA, no solo junto al campo: si
              está en una pestaña cerrada, nadie lo encuentra. */}
          {tocado && !puedeGuardar && (
            <Card className="!p-3 border-red-500/40">
              {avisos.filter((a) => a.bloquea).map((a, i) => (
                <p key={i} className="text-xs text-red-300 font-semibold flex gap-1.5">
                  <span aria-hidden>⛔</span> {a.texto}
                </p>
              ))}
            </Card>
          )}

          {/* ── Pestañas ───────────────────────────────────────────────── */}
          <div className="flex gap-1 flex-wrap border-b border-border/40">
            {PESTANAS.map((p) => (
              <button
                key={p.clave}
                onClick={() => irA(p.clave)}
                title={p.para}
                className={`px-3.5 py-2 text-sm font-bold border-b-2 -mb-px transition ${
                  pestana === p.clave
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted hover:text-foreground'
                }`}
              >
                {p.titulo}
              </button>
            ))}
          </div>

          {/* ── 1. QUÉ PASA ────────────────────────────────────────────── */}
          {pestana === 'estado' && estado && (
            <div className="space-y-3">
              <Card className={`!p-4 border ${PRIORIDAD[estado.prioridad].tono}`}>
                <p className="text-[11px] font-black uppercase tracking-wide">
                  {estado.etiquetaPrioridad}
                </p>
                <p className="text-lg font-black text-foreground mt-1">{estado.fase}</p>
                {estado.alerta && (
                  <p className={`text-sm mt-1.5 flex gap-1.5 ${estado.alerta.critica ? 'text-red-300 font-bold' : 'text-amber-300'}`}>
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {estado.alerta.texto}
                  </p>
                )}
                {/* El bloqueo dice QUÉ falta, nunca «pendiente»: lo primero se
                    resuelve, lo segundo hay que investigarlo. */}
                {estado.bloqueo && (
                  <p className="text-sm text-foreground mt-1.5">{estado.bloqueo}</p>
                )}
                {!estado.alerta && !estado.bloqueo && (
                  <p className="text-sm text-muted mt-1 flex gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                    No hay nada esperando en este suministro.
                  </p>
                )}
              </Card>

              <Card className="!p-4">
                <h2 className="text-xs font-black uppercase tracking-wide text-muted mb-2">Lo que toca hacer</h2>
                {estado.proximaAccion ? (
                  <p className="text-sm font-bold text-foreground">
                    {estado.proximaAccion.texto}
                    <span className="block text-xs font-semibold text-muted mt-0.5">
                      {estado.proximaAccion.cuando}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-amber-400 font-semibold">
                    No hay ninguna acción puesta. Ningún expediente abierto puede quedarse sin siguiente paso.
                  </p>
                )}
                <div className="flex gap-2 mt-3 flex-wrap">
                  {cliente && (
                    <Link href={`/gestor/luz/clientes/${cliente.id}`} className={btnSecundario}>
                      Abrir la ficha del cliente
                    </Link>
                  )}
                  <Link href={`/gestor/luz/estudios?cups=${s.id}`} className={btnSecundario}>
                    <FileText className="w-4 h-4" /> Hacer el estudio
                  </Link>
                </div>
              </Card>

              <Card className="!p-4">
                <h2 className="text-xs font-black uppercase tracking-wide text-muted mb-2">Cambiar la fase a mano</h2>
                <select
                  value={s.estado_cups}
                  onChange={async (e) => {
                    await guardarLuz('cups', 'PUT', { id: s.id, estado_cups: e.target.value });
                    cups.recargar();
                  }}
                  className={`${btnSecundario} !px-2`}
                >
                  {ESTADOS_CUPS.map((es) => <option key={es} value={es}>{ESTADO_CUPS_LABEL[es]}</option>)}
                </select>
                <p className="text-[11px] text-muted mt-2">
                  La fase que se ve arriba se deduce de aquí. Cambiarla mueve también al cliente y al
                  contrato — el suministro es la fuente de verdad del viaje comercial.
                </p>
              </Card>
            </div>
          )}

          {/* ── 2. EL PUNTO · 4. CONTRATO — el formulario por bloques ──── */}
          {pestana === 'punto' && (
            <FormularioSuministro
              valores={valores}
              onCambio={(v) => { setValores(v); setTocado(true); setMsg(''); }}
              soloBloques={['identificacion', 'tecnico', 'gestion']}
            />
          )}

          {pestana === 'contrato' && (
            <div className="space-y-3">
              <FormularioSuministro
                valores={valores}
                onCambio={(v) => { setValores(v); setTocado(true); setMsg(''); }}
                soloBloques={['contrato']}
              />

              <Card className="!p-4">
                <h2 className="text-xs font-black uppercase tracking-wide text-muted mb-2">
                  Contratos de este suministro
                </h2>
                {misContratos.length === 0 ? (
                  <p className="text-sm text-muted">Ninguno todavía.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {misContratos.map((k) => (
                      <li key={k.id} className="flex items-center gap-3 text-sm">
                        <span className="font-bold text-foreground flex-1 min-w-0 truncate">
                          {k.comercializadora_final || 'Sin comercializadora'}
                        </span>
                        <span className="text-xs text-muted">{ESTADO_CONTRATO_LABEL[k.estado_contrato] || k.estado_contrato}</span>
                        <span className="text-xs text-muted tabular-nums">{fmtFecha(k.fecha_firma)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/gestor/luz/contratos" className="text-[11px] font-bold text-accent hover:underline mt-2 inline-block">
                  Ir a Contratos
                </Link>
              </Card>
            </div>
          )}

          {/* ── 3. CONSUMO Y COSTE ─────────────────────────────────────── */}
          {pestana === 'consumo' && (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <Card className="!p-4">
                  <p className="text-[11px] font-black uppercase tracking-wide text-muted">Consumo anual</p>
                  <p className="text-2xl font-black tabular-nums mt-1">
                    {s.consumo_anual_kwh ? fmtKwh(Number(s.consumo_anual_kwh)) : '—'}
                  </p>
                  {!s.consumo_anual_kwh && (
                    <p className="text-[11px] text-amber-400 mt-1">Sin esto no se puede calcular ningún ahorro.</p>
                  )}
                </Card>
                <Card className="!p-4">
                  <p className="text-[11px] font-black uppercase tracking-wide text-muted">Coste anual</p>
                  <p className="text-2xl font-black tabular-nums mt-1">
                    {s.coste_anual_estimado ? fmtEur(Number(s.coste_anual_estimado)) : '—'}
                  </p>
                </Card>
                <Card className="!p-4">
                  <p className="text-[11px] font-black uppercase tracking-wide text-muted">Precio medio</p>
                  <p className="text-2xl font-black tabular-nums mt-1">
                    {s.consumo_anual_kwh && s.coste_anual_estimado
                      ? `${(Number(s.coste_anual_estimado) / Number(s.consumo_anual_kwh)).toFixed(3)} €/kWh`
                      : '—'}
                  </p>
                  <p className="text-[11px] text-muted mt-1">
                    Todo incluido. Sirve para oler si algo va mal, no para comparar ofertas.
                  </p>
                </Card>
              </div>

              <Card className="!p-4">
                <h2 className="text-xs font-black uppercase tracking-wide text-muted mb-2">Potencias contratadas</h2>
                {s.potencias_kw?.length ? (
                  <div className="flex gap-2 flex-wrap">
                    {s.potencias_kw.map((p, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-card/70 border border-border/50 text-sm font-bold tabular-nums">
                        P{i + 1} · {p} kW
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">Sin potencias metidas.</p>
                )}
                <p className="text-[11px] text-muted mt-2">
                  Para saber si sobra o falta potencia hace falta el maxímetro, y eso sale del estudio o de Datadis.
                </p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <Link href={`/gestor/luz/estudios?cups=${s.id}`} className={btnSecundario}>
                    <FileText className="w-4 h-4" /> Estudio y comparativa
                  </Link>
                  <Link href="/gestor/luz/consumo" className={btnSecundario}>Consumo real (Datadis)</Link>
                </div>
              </Card>
            </div>
          )}

          {/* ── 5. HISTORIAL ───────────────────────────────────────────── */}
          {pestana === 'historial' && (
            <div className="space-y-3">
              <Card className="!p-4">
                <h2 className="text-xs font-black uppercase tracking-wide text-muted mb-2">
                  Tareas de este suministro
                </h2>
                {misTareas.length === 0 ? (
                  <p className="text-sm text-muted">Ninguna.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {misTareas.map((t) => (
                      <li key={t.id} className="flex items-start gap-3 text-sm">
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold text-foreground">{t.descripcion}</span>
                          <span className="block text-[11px] text-muted">
                            {TIPO_TAREA_LABEL[t.tipo_tarea] || t.tipo_tarea}
                            {t.responsable ? ` · ${t.responsable}` : ''}
                          </span>
                        </span>
                        <span className="text-[11px] text-muted shrink-0 whitespace-nowrap">
                          {t.estado === 'completada' ? 'Hecha' : comoSeLee(t.fecha_limite, hoy)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="!p-4">
                <h2 className="text-xs font-black uppercase tracking-wide text-muted mb-2">
                  Visitas al cliente
                </h2>
                {misVisitas.length === 0 ? (
                  <p className="text-sm text-muted">Ninguna apuntada.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {misVisitas.slice(0, 10).map((v) => (
                      <li key={v.id} className="flex items-center gap-3 text-sm">
                        <span className="text-xs text-muted tabular-nums shrink-0">{fmtFecha(v.fecha)}</span>
                        <span className="min-w-0 flex-1 truncate">{v.notas || 'Visita'}</span>
                        {v.responsable && <span className="text-[11px] text-muted shrink-0">{v.responsable}</span>}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[11px] text-muted mt-2">
                  Las visitas son del cliente, no del punto: se va a un sitio, no a un CUPS.
                </p>
              </Card>

              <Card className="!p-4">
                <h2 className="text-xs font-black uppercase tracking-wide text-muted mb-2">Fechas</h2>
                <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                  {[
                    ['Dado de alta', fmtFecha(s.creado_en)],
                    ['Última modificación', fmtFecha(s.actualizado_en)],
                    ['Inicio del contrato', fmtFecha(s.fecha_inicio_contrato)],
                    ['Fin del contrato', fmtFecha(s.fecha_fin_contrato)],
                    ['Fin de la permanencia', s.tiene_permanencia ? fmtFecha(s.fecha_fin_permanencia) : 'No tiene'],
                    ['Último día para preavisar', fmtFecha(s.fecha_limite_preaviso)],
                    ['Tipo de contrato', TIPO_CONTRATO_LABEL[s.tipo_contrato] || s.tipo_contrato],
                    ['Etapa', ETAPA[estado?.etapa || 'detectado'].titulo],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 border-b border-border/20 py-1">
                      <dt className="text-muted flex items-center gap-1.5">
                        <Clock className="w-3 h-3" /> {k}
                      </dt>
                      <dd className="font-semibold tabular-nums">{v || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
