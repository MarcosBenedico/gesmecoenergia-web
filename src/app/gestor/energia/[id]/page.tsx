'use client';

/**
 * LA FICHA DEL EXPEDIENTE — «decisión a la izquierda, acción a la derecha».
 *
 * Tres preguntas visibles al abrir (página 3 del documento): qué quiere el
 * cliente, qué sabemos y qué hacemos ahora. El resto queda a un clic.
 *
 * LAS PESTAÑAS VAN EN ORDEN DE CUÁNTAS VECES SE ABREN, no por afinidad
 * temática, y la ISO es UNA PESTAÑA MÁS y no un módulo: si fuera un sitio al
 * que ir, alguien tendría que «hacer la ISO», y ese es exactamente el trabajo
 * que nadie hace nunca.
 *
 * NADA DE LO QUE SE VE AQUÍ TIENE CRITERIO PROPIO: la fase y sus plazos salen
 * de `energia.ts`, el estado de `expediente.ts` y la cobertura de datos de
 * `cobertura()`. Dos pantallas calculando lo mismo acaban diciendo cosas
 * distintas del mismo expediente.
 */

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Leaf, Building2, AlertTriangle, CheckCircle2, FileText,
  Gauge, Wrench, FolderOpen, ShieldCheck,
} from 'lucide-react';
import { LuzCliente, LuzCups, LuzTarea, fmtKwh, fmtFecha } from '@/lib/luz';
import {
  FASES, VECTOR, MAGNITUD, cobertura, estadoISO,
  NORMAS, AVISO_NO_CERTIFICA, aKwh,
  type FaseEnergia, type Vector,
} from '@/lib/energia';
import { estadoExpediente, ventanaAnual, NIVEL } from '@/lib/expediente';
import { Card, EstadoCarga, useListaLuz, guardarLuz, btnSecundario } from '../../luz/ui';

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const PESTANAS = [
  { clave: 'resumen', titulo: 'Resumen', icono: Leaf },
  { clave: 'datos', titulo: 'Datos', icono: Gauge },
  { clave: 'actuaciones', titulo: 'Actuaciones', icono: Wrench },
  { clave: 'documentos', titulo: 'Documentos', icono: FolderOpen },
  { clave: 'iso', titulo: 'ISO', icono: ShieldCheck },
] as const;

interface Expediente {
  id: string; cliente_id: string; objetivo: string; titulo_corto: string | null;
  fase: string; vectores: string[] | null; responsable: string | null;
  nota_situacion: string | null; alcance_nota: string | null; actualizado_en?: string;
  luz_clientes?: { nombre: string } | null;
}
interface Medida {
  id: string; expediente_id: string | null; vector: string; magnitud: string;
  unidad: string; valor: number; valor_kwh: number | null; concepto: string | null;
  periodo_inicio: string; periodo_fin: string; origen: string; revision: string;
  aviso: string | null;
}
interface Actuacion {
  id: string; expediente_id: string | null; titulo: string; tipo: string; estado: string;
  problema: string | null; ahorro_previsto_eur: number | null;
  ahorro_comprobado_eur: number | null; responsable: string | null; decision_pendiente: string | null;
}
interface Documento {
  id: string; expediente_id: string | null; titulo: string; tipo: string;
  estado: string; texto_nota: string | null; creado_en?: string;
}
interface Evidencia { id: string; expediente_id: string; requisito: string; estado: string }
interface LineaBase { id: string; expediente_id: string; nombre: string; estado: string; r2: number | null }

export default function FichaExpediente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hoy = hoyISO();

  const expedientes = useListaLuz<Expediente>('expedientes');
  const clientes = useListaLuz<LuzCliente>('clientes');
  const cups = useListaLuz<LuzCups>('cups');
  const tareas = useListaLuz<LuzTarea>('tareas');
  const medidas = useListaLuz<Medida>('medidas', { expediente_id: id });
  const actuaciones = useListaLuz<Actuacion>('actuaciones', { expediente_id: id });
  const documentos = useListaLuz<Documento>('documentos', { expediente_id: id });
  const evidencias = useListaLuz<Evidencia>('evidencias', { expediente_id: id });
  const lineas = useListaLuz<LineaBase>('lineas_base', { expediente_id: id });

  const [pestana, setPestana] = useState<string>('resumen');
  const [msg, setMsg] = useState('');

  const e = useMemo(() => expedientes.datos.find((x) => x.id === id) || null, [expedientes.datos, id]);
  const cliente = useMemo(
    () => clientes.datos.find((c) => c.id === e?.cliente_id) || null, [clientes.datos, e]);
  const susCups = useMemo(
    () => cups.datos.filter((c) => c.cliente_id === e?.cliente_id), [cups.datos, e]);

  const misTareas = useMemo(
    () => tareas.datos.filter((t) => (t as { expediente_id?: string }).expediente_id === id),
    [tareas.datos, id]);

  const estado = useMemo(() => {
    if (!e) return null;
    return estadoExpediente({
      id: e.id, cliente: cliente?.nombre || 'Cliente', clienteId: e.cliente_id,
      objetivo: e.objetivo, fase: e.fase as FaseEnergia,
      responsable: e.responsable, actualizadoEn: e.actualizado_en,
      medidas: medidas.datos,
      suministros: susCups.length,
      actuaciones: actuaciones.datos,
      tieneLineaBaseAprobada: lineas.datos.some((l) => l.estado === 'aprobada'),
      tareas: misTareas.filter((t) => !['completada', 'cancelada'].includes(t.estado)),
    }, hoy);
  }, [e, cliente, medidas.datos, susCups, actuaciones.datos, lineas.datos, misTareas, hoy]);

  /** La cobertura del último año: es lo que decide si se puede dar una cifra anual. */
  const cob = useMemo(() => {
    const { desde, hasta } = ventanaAnual(hoy);
    const consumos = medidas.datos.filter((m) => m.magnitud === 'consumo');
    return { ...cobertura(consumos, desde, hasta), desde, hasta, n: consumos.length };
  }, [medidas.datos, hoy]);

  /**
   * El total de energía del año, sumando TODOS los vectores en kWh.
   *
   * Solo se enseña si la cobertura da: con datos a medias, un total es una
   * cifra que parece un año y no lo es. Y solo suma lo que se ha podido
   * convertir — un litro de gasóleo sin factor no entra y se dice.
   */
  const totalAnual = useMemo(() => {
    let kwh = 0; let sinConvertir = 0;
    for (const m of medidas.datos) {
      if (!MAGNITUD[m.magnitud as keyof typeof MAGNITUD]?.esEnergia) continue;
      if (m.periodo_inicio < cob.desde) continue;
      const v = m.valor_kwh ?? aKwh(Number(m.valor), m.unidad, m.vector as Vector).kwh;
      if (v == null) sinConvertir++; else kwh += v;
    }
    return { kwh, sinConvertir };
  }, [medidas.datos, cob.desde]);

  const cargando = expedientes.cargando || clientes.cargando;

  async function cambiarFase(fase: string) {
    if (!e) return;
    const err = await guardarLuz('expedientes', 'PUT', { id: e.id, fase });
    if (err) { setMsg(err); return; }
    setMsg(''); expedientes.recargar();
  }

  if (!cargando && !e) {
    return (
      <Card>
        <p className="text-sm font-bold">Este expediente no existe o está en la papelera.</p>
        <Link href="/gestor/energia" className={`${btnSecundario} mt-3 inline-flex`}>Volver</Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <EstadoCarga cargando={cargando} error={expedientes.error}
        faltaMigracion={expedientes.faltaMigracion} vacio={false} textoVacio=""
        sqlFile="supabase_energia_v1.sql" />

      {e && estado && (
        <>
          {/* ── Cabecera ─────────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-xl font-black flex items-center gap-2">
                <Leaf className="w-5 h-5 text-emerald-400 shrink-0" />
                {cliente?.nombre || 'Cliente'}
              </h1>
              <p className="text-xs text-muted mt-0.5 flex flex-wrap items-center gap-x-2">
                {cliente && (
                  <Link href={`/gestor/luz/clientes/${cliente.id}`}
                    className="font-bold text-foreground hover:text-accent inline-flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> Ficha del cliente
                  </Link>
                )}
                <span>· {e.responsable || 'Sin responsable'}</span>
                <span>· {susCups.length} suministro{susCups.length === 1 ? '' : 's'}</span>
              </p>
            </div>
            <select
              value={e.fase}
              onChange={(ev) => cambiarFase(ev.target.value)}
              className={`${btnSecundario} !px-2 shrink-0`}
            >
              {FASES.map((f) => <option key={f.id} value={f.id}>{f.titulo}</option>)}
            </select>
          </div>

          {msg && <Card className="!p-3 border-red-500/40"><p className="text-xs text-red-300">{msg}</p></Card>}

          {/* ── La banda de estado: qué pasa y qué toca ─────────────── */}
          <div className={`rounded-2xl border p-4 ${NIVEL[estado.nivel].tono}`}>
            <p className="text-[11px] font-black uppercase tracking-wide">{estado.etiqueta}</p>
            <p className="text-base font-black text-foreground mt-1">{estado.pendientePrincipal}</p>
            <p className="text-xs mt-2">
              {estado.proximaAccion ? (
                <>
                  <span className="font-bold">Siguiente: </span>
                  {estado.proximaAccion.texto}
                  {' · '}{estado.proximaAccion.responsable || 'sin asignar'}
                  {estado.proximaAccion.fecha
                    ? ` · ${estado.proximaAccion.fecha.split('-').reverse().join('/')}`
                    : ' · sin fecha'}
                  {estado.proximaAccion.vencida && <span className="font-black"> · VENCIDA</span>}
                </>
              ) : (
                <span className="font-bold">
                  No hay siguiente acción. Ningún expediente abierto puede quedarse así.
                </span>
              )}
            </p>
          </div>

          {/* El objetivo, escrito por una persona. */}
          <Card className="!p-4">
            <p className="text-[11px] font-black uppercase tracking-wide text-muted">Objetivo del cliente</p>
            <p className="text-sm font-semibold text-foreground mt-1">{e.objetivo}</p>
            {e.nota_situacion && <p className="text-xs text-muted mt-1.5">{e.nota_situacion}</p>}
          </Card>

          {/* ── Pestañas ─────────────────────────────────────────────── */}
          <div className="flex gap-1 flex-wrap border-b border-border/40">
            {PESTANAS.map((p) => (
              <button key={p.clave} onClick={() => setPestana(p.clave)}
                className={`px-3.5 py-2 text-sm font-bold border-b-2 -mb-px transition inline-flex items-center gap-1.5 ${
                  pestana === p.clave ? 'border-accent text-accent'
                    : 'border-transparent text-muted hover:text-foreground'}`}>
                <p.icono className="w-3.5 h-3.5" /> {p.titulo}
              </button>
            ))}
          </div>

          {/* ── RESUMEN ──────────────────────────────────────────────── */}
          {pestana === 'resumen' && (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <Card className="!p-4">
                  <p className="text-[11px] font-black uppercase tracking-wide text-muted">Energía del año</p>
                  {/* CON COBERTURA PARCIAL NO SE DA UNA CIFRA ANUAL. Es la regla
                      del documento y la de plantilla-consumos.ts: un número
                      estimado que no se anuncia es peor que no tenerlo. */}
                  {cob.sePuedeAnualizar ? (
                    <>
                      <p className="text-2xl font-black tabular-nums mt-1">{fmtKwh(totalAnual.kwh)}</p>
                      <p className="text-[11px] text-muted mt-1">
                        Todos los vectores sumados en kWh.
                        {totalAnual.sinConvertir > 0 && (
                          <span className="text-amber-400"> {totalAnual.sinConvertir} medida(s) sin convertir quedan fuera.</span>
                        )}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-black text-amber-400 mt-1">Sin cifra anual</p>
                      <p className="text-[11px] text-amber-300/90 mt-1">{cob.motivo}</p>
                    </>
                  )}
                </Card>
                <Card className="!p-4">
                  <p className="text-[11px] font-black uppercase tracking-wide text-muted">Cobertura de datos</p>
                  <p className="text-2xl font-black tabular-nums mt-1">{cob.pct}%</p>
                  <p className="text-[11px] text-muted mt-1">
                    {cob.diasCubiertos} de {cob.diasTotales} días · {cob.n} medidas de consumo
                  </p>
                </Card>
                <Card className="!p-4">
                  <p className="text-[11px] font-black uppercase tracking-wide text-muted">Actuaciones abiertas</p>
                  <p className="text-2xl font-black tabular-nums mt-1">
                    {actuaciones.datos.filter((a) => !['cerrada', 'descartada'].includes(a.estado)).length}
                  </p>
                  <p className="text-[11px] text-muted mt-1">
                    {lineas.datos.some((l) => l.estado === 'aprobada')
                      ? 'Con línea base aprobada' : 'Sin línea base aprobada todavía'}
                  </p>
                </Card>
              </div>

              {/* Los huecos, con sus fechas: es lo que se le pide al cliente. */}
              {cob.huecos.length > 0 && (
                <Card className="!p-4">
                  <h2 className="text-xs font-black uppercase tracking-wide text-muted mb-2">
                    Lo que falta por pedir
                  </h2>
                  <ul className="space-y-1">
                    {cob.huecos.slice(0, 6).map((h, i) => (
                      <li key={i} className="text-xs flex items-center gap-2">
                        <span className="text-amber-400">▸</span>
                        <span className="font-semibold tabular-nums">
                          {h.desde.split('-').reverse().join('/')} — {h.hasta.split('-').reverse().join('/')}
                        </span>
                        <span className="text-muted">({h.dias} días)</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-muted mt-2">
                    Un hueco se queda vacío. Nunca se rellena con un cero: un cero afirma que ese mes no consumió.
                  </p>
                </Card>
              )}

              <Card className="!p-4">
                <h2 className="text-xs font-black uppercase tracking-wide text-muted mb-2">Suministros del cliente</h2>
                {susCups.length === 0 ? (
                  <p className="text-sm text-amber-400">
                    Ninguno vinculado. Sin CUPS no se puede pedir la curva ni cruzar facturas.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {susCups.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 text-sm">
                        <Link href={`/gestor/luz/cups/${c.id}`} className="font-bold hover:text-accent truncate flex-1">
                          {c.alias_suministro || c.cups}
                        </Link>
                        <span className="text-xs text-muted">{c.tarifa_acceso}</span>
                        <span className="text-xs text-muted tabular-nums">{fmtKwh(Number(c.consumo_anual_kwh))}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[11px] text-muted mt-2">
                  El consumo del CUPS es el de la venta. La serie de medidas es la del expediente.
                  Son dos cosas y no se copian: si difieren, es información.
                </p>
              </Card>
            </div>
          )}

          {/* ── DATOS ────────────────────────────────────────────────── */}
          {pestana === 'datos' && (
            <div className="space-y-3">
              <Card className="!p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h2 className="text-sm font-black">Medidas ({medidas.datos.length})</h2>
                  <Link href={`/gestor/luz/estudios?cliente=${e.cliente_id}`} className={btnSecundario}>
                    <FileText className="w-4 h-4" /> Importar con la plantilla
                  </Link>
                </div>
                {medidas.datos.length === 0 ? (
                  <p className="text-sm text-muted py-4">
                    Todavía no hay ninguna medida. La vía rápida es la plantilla de Excel del módulo
                    de estudios: doce meses por periodo, y de ahí salen las medidas con su origen.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
                          <th className="px-2 py-2">Periodo</th>
                          <th className="px-2 py-2">Vector</th>
                          <th className="px-2 py-2">Magnitud</th>
                          <th className="px-2 py-2 text-right">Valor</th>
                          <th className="px-2 py-2 text-right">kWh</th>
                          <th className="px-2 py-2">Origen</th>
                          <th className="px-2 py-2">Revisión</th>
                        </tr>
                      </thead>
                      <tbody>
                        {medidas.datos.map((m) => (
                          <tr key={m.id} className="border-b border-border/20">
                            <td className="px-2 py-1.5 text-xs tabular-nums whitespace-nowrap">
                              {fmtFecha(m.periodo_inicio)} — {fmtFecha(m.periodo_fin)}
                            </td>
                            <td className="px-2 py-1.5 text-xs">
                              {VECTOR[m.vector as Vector]?.emoji} {VECTOR[m.vector as Vector]?.titulo || m.vector}
                            </td>
                            <td className="px-2 py-1.5 text-xs">
                              {MAGNITUD[m.magnitud as keyof typeof MAGNITUD]?.titulo || m.magnitud}
                              {m.concepto && <span className="block text-[10px] text-muted">{m.concepto}</span>}
                            </td>
                            <td className="px-2 py-1.5 text-xs text-right tabular-nums whitespace-nowrap">
                              {Number(m.valor).toLocaleString('es-ES')} {m.unidad}
                            </td>
                            <td className="px-2 py-1.5 text-xs text-right tabular-nums text-muted">
                              {m.valor_kwh != null ? Number(m.valor_kwh).toLocaleString('es-ES') : '—'}
                            </td>
                            <td className="px-2 py-1.5 text-[11px] text-muted">{m.origen}</td>
                            <td className="px-2 py-1.5">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                                m.revision === 'aprobada' ? 'border-emerald-500/40 text-emerald-400'
                                  : m.revision === 'descartada' ? 'border-border/40 text-muted line-through'
                                  : 'border-amber-500/40 text-amber-300'}`}>
                                {m.revision}
                              </span>
                              {m.aviso && (
                                <span className="block text-[10px] text-amber-400 mt-0.5 max-w-[14rem]">{m.aviso}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="text-[11px] text-muted mt-3">
                  Una medida nace en <b>pendiente</b>: cargar un archivo no convierte su contenido en dato válido.
                  Aprobar es un acto de una persona, con su nombre y su fecha.
                </p>
              </Card>
            </div>
          )}

          {/* ── ACTUACIONES ──────────────────────────────────────────── */}
          {pestana === 'actuaciones' && (
            <div className="space-y-3">
              {actuaciones.datos.length === 0 ? (
                <Card><p className="text-sm text-muted py-4">
                  Todavía no hay ninguna actuación. Una actuación es una decisión completa —potencia,
                  reactiva, FV, gestión de cargas— con su problema, sus alternativas y su verificación.
                </p></Card>
              ) : actuaciones.datos.map((a) => (
                <Card key={a.id} className="!p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-black text-sm">{a.titulo}</h3>
                      {a.problema && <p className="text-xs text-muted mt-0.5">{a.problema}</p>}
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-border/50 bg-card/70 shrink-0">
                      {a.estado}
                    </span>
                  </div>
                  {/* PREVISTO Y COMPROBADO SEPARADOS: es la línea entre una
                      promesa y un hecho, y es lo que verifica la 50015. */}
                  <div className="flex gap-6 mt-3 text-xs">
                    <span>
                      <span className="block text-[10px] uppercase font-bold text-muted">Ahorro previsto</span>
                      <span className="font-black tabular-nums">
                        {a.ahorro_previsto_eur != null ? `${Number(a.ahorro_previsto_eur).toLocaleString('es-ES')} €` : '—'}
                      </span>
                    </span>
                    <span>
                      <span className="block text-[10px] uppercase font-bold text-muted">Ahorro comprobado</span>
                      <span className={`font-black tabular-nums ${a.ahorro_comprobado_eur != null ? 'text-emerald-400' : 'text-muted'}`}>
                        {a.ahorro_comprobado_eur != null ? `${Number(a.ahorro_comprobado_eur).toLocaleString('es-ES')} €` : 'Sin verificar'}
                      </span>
                    </span>
                  </div>
                  {a.decision_pendiente && (
                    <p className="text-xs text-amber-300 mt-2 flex gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {a.decision_pendiente}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}

          {/* ── DOCUMENTOS ───────────────────────────────────────────── */}
          {pestana === 'documentos' && (
            <Card className="!p-4">
              <h2 className="text-sm font-black mb-3">Documentos ({documentos.datos.length})</h2>
              {documentos.datos.length === 0 ? (
                <p className="text-sm text-muted py-4">
                  Nada guardado todavía. La bandeja sirve para capturar en segundos —una foto, una
                  nota— y clasificar después sin perder el archivo.
                </p>
              ) : (
                <ul className="divide-y divide-border/25">
                  {documentos.datos.map((d) => (
                    <li key={d.id} className="py-2 flex items-center gap-3 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold truncate">{d.titulo}</span>
                        {d.texto_nota && <span className="block text-xs text-muted truncate">{d.texto_nota}</span>}
                      </span>
                      <span className="text-[11px] text-muted shrink-0">{d.tipo}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${
                        d.estado === 'guardado' ? 'border-emerald-500/40 text-emerald-400'
                          : d.estado === 'pendiente_recibir' ? 'border-sky-500/40 text-sky-300'
                          : 'border-amber-500/40 text-amber-300'}`}>
                        {d.estado.replace('_', ' ')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {/* ── ISO ──────────────────────────────────────────────────── */}
          {pestana === 'iso' && (
            <div className="space-y-3">
              {/* EL AVISO VA PRIMERO Y SIEMPRE. No es letra pequeña: es la
                  diferencia entre una herramienta honesta y una que induce a
                  error a quien la enseña a un cliente. */}
              <Card className="!p-3 border-amber-500/30">
                <p className="text-xs text-amber-200/90 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {AVISO_NO_CERTIFICA}
                </p>
              </Card>

              {NORMAS.map((n) => {
                const estados = estadoISO(evidencias.datos, [n.id]);
                const faltan = estados.filter((x) => !x.listo).length;
                return (
                  <Card key={n.id} className="!p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <h3 className="text-sm font-black">{n.titulo}</h3>
                        <p className="text-[11px] text-muted">{n.para_que}</p>
                      </div>
                      {/* NO hay porcentaje: un porcentaje invita a jugar con él
                          y además miente, porque no existe el 68 % de una norma.
                          Lo que se dice es cuántas cosas faltan. */}
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                        faltan === 0 ? 'border-emerald-500/40 text-emerald-400'
                          : 'border-border/50 text-muted'}`}>
                        {faltan === 0 ? 'Todo colocado' : `${faltan} por colocar`}
                      </span>
                    </div>
                    <ul className="divide-y divide-border/20">
                      {estados.map((x) => (
                        <li key={x.requisito.clave} className="py-2 flex items-start gap-3">
                          {x.listo
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            : <span className="w-4 h-4 rounded-full border border-border/50 shrink-0 mt-0.5" />}
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-bold">{x.requisito.titulo}</span>
                            <span className={`block text-[11px] ${x.listo ? 'text-muted' : 'text-amber-300'}`}>
                              {x.siguiente}
                            </span>
                          </span>
                          {/* Cada pendiente lleva AL DATO, no a un formulario ISO. */}
                          <button
                            onClick={() => setPestana(
                              x.requisito.destino === 'datos' ? 'datos'
                                : x.requisito.destino === 'actuaciones' ? 'actuaciones'
                                : x.requisito.destino === 'indicadores' ? 'datos'
                                : 'resumen')}
                            className="text-[11px] font-bold text-accent hover:underline shrink-0"
                          >
                            Ir al dato
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Card>
                );
              })}

              <p className="text-[11px] text-muted">
                Las evidencias se vinculan al trabajo real: pulsar «línea base» abre su formulario,
                no un apartado ISO donde volver a teclear la misma información.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
