'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ChevronLeft, ChevronRight, PartyPopper } from 'lucide-react';
import {
  TIPOS_CLIENTE, TIPO_CLIENTE_LABEL, PRIORIDADES, PRIORIDAD_LABEL, TARIFAS_ACCESO,
  TIPOS_OPORTUNIDAD, TIPO_OPORTUNIDAD_LABEL, TIPOS_TAREA, TIPO_TAREA_LABEL,
  tituloFechaCritica, normCups, fmtFecha,
} from '@/lib/luz';
import { Card, guardarLuz, inputCls, labelCls, btnPrimario, btnSecundario, SelectorResponsable } from '../ui';
import { tokenSesion } from '@/lib/usuario';

/** POST autenticado que devuelve el registro creado (para enlazar los pasos). */
async function crearConId(recurso: string, body: Record<string, unknown>) {
  try {
    const token = await tokenSesion();
    const r = await fetch(`/api/luz/${recurso}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    const json = await r.json();
    return { ok: r.ok, json };
  } catch {
    return null;
  }
}

/**
 * Asistente de alta guiada: cliente → suministro → oportunidad → tarea → fechas críticas.
 * Cada paso guarda al avanzar, así no se pierde nada si se corta a medias.
 * Pensado para que David y Nicola no tengan que recordar qué falta por crear.
 */

const iso = (d: Date) => d.toISOString().slice(0, 10);
const enDias = (n: number) => iso(new Date(Date.now() + n * 86400000));

const PASOS = [
  { n: 1, titulo: 'Cliente', icono: '👤' },
  { n: 2, titulo: 'Suministro', icono: '🔌' },
  { n: 3, titulo: 'Oportunidad', icono: '🎯' },
  { n: 4, titulo: 'Primera tarea', icono: '✅' },
  { n: 5, titulo: 'Fechas clave', icono: '📅' },
  { n: 6, titulo: 'Listo', icono: '🎉' },
];

export default function AltaGuiadaPage() {
  const router = useRouter();
  const [paso, setPaso] = useState(1);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Lo ya creado (para enlazar los siguientes pasos y el resumen final)
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [cupsId, setCupsId] = useState<string | null>(null);
  const [creado, setCreado] = useState<string[]>([]);

  // ── Formularios de cada paso ──
  const [fCliente, setFCliente] = useState({
    nombre: '', telefono: '', direccion_fiscal: '', tipo_cliente: 'pyme',
    prioridad: 'C', responsable: '', persona_contacto: '', via_entrada: 'captacion',
  });
  const [fCups, setFCups] = useState({
    cups: '', alias_suministro: '', direccion_suministro: '', tarifa_acceso: '2.0TD',
    comercializadora_actual: '', consumo_anual_kwh: '', fecha_fin_contrato: '',
  });
  const [fOp, setFOp] = useState({ tipo_oportunidad: 'cambio_comercializadora', comision_potencial: '', proxima_accion: 'Pedir factura para estudio' });
  const [fTarea, setFTarea] = useState({ tipo_tarea: 'pedir_factura', descripcion: 'Pedir factura de luz para hacer el estudio', fecha_limite: enDias(2) });
  const [fFechas, setFFechas] = useState({ presentar_proyecto: enDias(7), fin_contrato: '' });

  const diasProyecto = Math.round((new Date(fFechas.presentar_proyecto).getTime() - Date.now()) / 86400000) + 1;

  // ── Guardado por paso ──
  async function guardarPaso1() {
    if (!fCliente.nombre.trim()) { setError('El nombre del cliente es obligatorio.'); return; }
    setGuardando(true); setError('');
    // Si ya nos ha dado las facturas, el estado arranca en "Documentación recibida"
    const res = await crearConId('clientes', {
      ...fCliente,
      estado_comercial: fCliente.via_entrada === 'facturas' ? 'doc_recibida' : 'contacto_iniciado',
      responsable: fCliente.responsable || null,
    });
    setGuardando(false);
    if (!res?.ok) { setError(res?.json?.error || 'No se pudo crear el cliente.'); return; }
    setClienteId(res.json.dato.id);
    setCreado((c) => [...c, `Cliente "${fCliente.nombre}" creado`]);
    setPaso(2);
  }

  async function guardarPaso2(saltar: boolean) {
    if (saltar) { setPaso(3); return; }
    if (normCups(fCups.cups).length < 10) { setError('Introduce un CUPS válido (empieza por ES, ~20 caracteres) o pulsa "Ahora no lo tengo".'); return; }
    setGuardando(true); setError('');
    const res = await crearConId('cups', {
      ...fCups, cliente_id: clienteId,
      consumo_anual_kwh: parseFloat(fCups.consumo_anual_kwh) || 0,
      fecha_fin_contrato: fCups.fecha_fin_contrato || null,
      estado_cups: fCups.fecha_fin_contrato && parseFloat(fCups.consumo_anual_kwh) ? 'factura_recibida' : 'datos_incompletos',
      prioridad: fCliente.prioridad, responsable: fCliente.responsable || null,
    });
    setGuardando(false);
    if (!res?.ok) { setError(res?.json?.error || 'No se pudo guardar el CUPS.'); return; }
    setCupsId(res.json.dato.id);
    if (fCups.fecha_fin_contrato) setFFechas((f) => ({ ...f, fin_contrato: fCups.fecha_fin_contrato }));
    setCreado((c) => [...c, `Suministro ${normCups(fCups.cups).slice(0, 10)}… guardado`]);
    setPaso(3);
  }

  async function guardarPaso3() {
    setGuardando(true); setError('');
    const err = await guardarLuz('pipeline', 'POST', {
      cliente_id: clienteId, cups_id: cupsId,
      nombre_oportunidad: `${fCliente.nombre} · ${TIPO_OPORTUNIDAD_LABEL[fOp.tipo_oportunidad]}`,
      tipo_oportunidad: fOp.tipo_oportunidad, estado: 'prospecto',
      comision_potencial: parseFloat(fOp.comision_potencial) || 0,
      proxima_accion: fOp.proxima_accion || null,
      fecha_proxima_accion: fTarea.fecha_limite || null,
      responsable: fCliente.responsable || null,
    });
    setGuardando(false);
    if (err) { setError(err); return; }
    setCreado((c) => [...c, 'Oportunidad creada en el Pipeline']);
    setPaso(4);
  }

  async function guardarPaso4() {
    if (!fTarea.descripcion.trim()) { setError('Describe la tarea.'); return; }
    setGuardando(true); setError('');
    const err = await guardarLuz('tareas', 'POST', {
      cliente_id: clienteId, cups_id: cupsId,
      tipo_tarea: fTarea.tipo_tarea, descripcion: fTarea.descripcion,
      fecha_limite: fTarea.fecha_limite || null, prioridad: 'media',
      responsable: fCliente.responsable || null,
    });
    setGuardando(false);
    if (err) { setError(err); return; }
    setCreado((c) => [...c, `Tarea "${fTarea.descripcion.slice(0, 40)}" para el ${fmtFecha(fTarea.fecha_limite)}`]);
    setPaso(5);
  }

  async function guardarPaso5() {
    if (!fFechas.presentar_proyecto) { setError('Indica la fecha para presentar el proyecto.'); return; }
    setGuardando(true); setError('');
    const errores: string[] = [];
    // Fecha crítica: presentar proyecto (máx. 1 semana desde la captación)
    const e1 = await guardarLuz('fechas', 'POST', {
      cliente_id: clienteId, cups_id: cupsId, tipo_fecha: 'presentar_proyecto',
      fecha: fFechas.presentar_proyecto,
      titulo: tituloFechaCritica(fCliente.nombre, fCups.cups ? normCups(fCups.cups) : '', 'presentar_proyecto', fCups.comercializadora_actual || null),
      prioridad: fCliente.prioridad, responsable: fCliente.responsable || null,
    });
    if (e1) errores.push(e1);
    else setCreado((c) => [...c, `Fecha crítica: presentar proyecto el ${fmtFecha(fFechas.presentar_proyecto)}`]);
    // Fecha crítica: fin de contrato (si la sabemos)
    if (fFechas.fin_contrato) {
      const e2 = await guardarLuz('fechas', 'POST', {
        cliente_id: clienteId, cups_id: cupsId, tipo_fecha: 'fin_contrato',
        fecha: fFechas.fin_contrato,
        titulo: tituloFechaCritica(fCliente.nombre, fCups.cups ? normCups(fCups.cups) : '', 'fin_contrato', fCups.comercializadora_actual || null),
        prioridad: fCliente.prioridad, responsable: fCliente.responsable || null,
      });
      if (e2) errores.push(e2);
      else setCreado((c) => [...c, `Fecha crítica: fin de contrato el ${fmtFecha(fFechas.fin_contrato)}`]);
    }
    setGuardando(false);
    if (errores.length) { setError(errores.join(' · ')); return; }
    setPaso(6);
  }

  const btnSiguiente = `${btnPrimario} min-w-36 justify-center`;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-black text-foreground">Alta guiada de cliente</h2>
        <p className="text-xs text-muted mt-0.5">Paso a paso, sin olvidar nada: cliente, suministro, oportunidad, tarea y fechas clave.</p>
      </div>

      {/* ── Barra de progreso ── */}
      <div className="flex items-center gap-1">
        {PASOS.map((p, i) => (
          <div key={p.n} className="flex items-center flex-1 last:flex-none">
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11px] font-bold whitespace-nowrap transition ${
              paso === p.n ? 'bg-accent text-white border-accent'
              : paso > p.n ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : 'bg-card/60 text-muted border-border/40'
            }`}>
              {paso > p.n ? <Check className="w-3 h-3" /> : <span>{p.icono}</span>}
              <span className="hidden sm:inline">{p.titulo}</span>
            </div>
            {i < PASOS.length - 1 && <div className={`h-px flex-1 mx-1 ${paso > p.n ? 'bg-emerald-500/40' : 'bg-border/40'}`} />}
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">{error}</p>}

      {/* ── PASO 1: Cliente ── */}
      {paso === 1 && (
        <Card className="space-y-3">
          <h3 className="font-bold text-foreground">👤 ¿Quién es el cliente?</h3>

          {/* Vía de entrada: la primera decisión — marca qué toca hacer con él */}
          <div className="grid sm:grid-cols-2 gap-2">
            {([
              ['captacion', '🧲 Posible cliente (captación)', 'Contactado por David en sus rutas. Toca hacer seguimiento de la factura y de la fotovoltaica si le interesa.'],
              ['facturas', '📄 Ya nos ha dado las facturas', 'Toca hacerle el estudio y quedar en persona para presentárselo.'],
            ] as const).map(([valor, titulo, texto]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setFCliente({ ...fCliente, via_entrada: valor })}
                className={`text-left rounded-xl border p-3 transition ${
                  fCliente.via_entrada === valor
                    ? 'border-accent bg-accent/10 ring-1 ring-accent/40'
                    : 'border-border/40 bg-card/50 hover:border-border/70'
                }`}
              >
                <p className="text-xs font-bold">{titulo}</p>
                <p className="text-[11px] text-muted mt-0.5">{texto}</p>
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2"><label className={labelCls}>Nombre / Razón social *</label>
              <input className={inputCls} value={fCliente.nombre} onChange={(e) => setFCliente({ ...fCliente, nombre: e.target.value })} autoFocus /></div>
            <div><label className={labelCls}>Teléfono</label>
              <input className={inputCls} value={fCliente.telefono} onChange={(e) => setFCliente({ ...fCliente, telefono: e.target.value })} /></div>
            <div><label className={labelCls}>Persona de contacto</label>
              <input className={inputCls} value={fCliente.persona_contacto} onChange={(e) => setFCliente({ ...fCliente, persona_contacto: e.target.value })} /></div>
            <div className="md:col-span-2"><label className={labelCls}>📍 Ubicación (dirección o enlace de Google Maps — para las rutas)</label>
              <input className={inputCls} value={fCliente.direccion_fiscal} onChange={(e) => setFCliente({ ...fCliente, direccion_fiscal: e.target.value })} placeholder="Ej: Carretera Alta 43, Esplús" /></div>
            <div><label className={labelCls}>Tipo</label>
              <select className={inputCls} value={fCliente.tipo_cliente} onChange={(e) => setFCliente({ ...fCliente, tipo_cliente: e.target.value })}>
                {TIPOS_CLIENTE.map((t) => <option key={t} value={t}>{TIPO_CLIENTE_LABEL[t]}</option>)}
              </select></div>
            <div><label className={labelCls}>Prioridad</label>
              <select className={inputCls} value={fCliente.prioridad} onChange={(e) => setFCliente({ ...fCliente, prioridad: e.target.value })}>
                {PRIORIDADES.map((p) => <option key={p} value={p}>{PRIORIDAD_LABEL[p]}</option>)}
              </select></div>
            <div><label className={labelCls}>Responsable</label>
              <SelectorResponsable valor={fCliente.responsable} onCambio={(v) => setFCliente((f) => ({ ...f, responsable: v || '' }))} className={inputCls} /></div>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={guardarPaso1} disabled={guardando} className={btnSiguiente}>
              Crear y seguir <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </Card>
      )}

      {/* ── PASO 2: Suministro ── */}
      {paso === 2 && (
        <Card className="space-y-3">
          <h3 className="font-bold text-foreground">🔌 ¿Qué suministro tiene?</h3>
          <p className="text-xs text-muted">El CUPS sale en cualquier factura de luz. Si aún no la tenéis, salta este paso: la primera tarea será pedirla.</p>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2"><label className={labelCls}>CUPS</label>
              <input className={`${inputCls} font-mono uppercase`} value={fCups.cups} onChange={(e) => setFCups({ ...fCups, cups: e.target.value })} placeholder="ES0021..." autoFocus /></div>
            <div><label className={labelCls}>Alias (nave, oficina, granja...)</label>
              <input className={inputCls} value={fCups.alias_suministro} onChange={(e) => setFCups({ ...fCups, alias_suministro: e.target.value })} /></div>
            <div><label className={labelCls}>Dirección del suministro</label>
              <input className={inputCls} value={fCups.direccion_suministro} onChange={(e) => setFCups({ ...fCups, direccion_suministro: e.target.value })} /></div>
            <div><label className={labelCls}>Tarifa</label>
              <select className={inputCls} value={fCups.tarifa_acceso} onChange={(e) => setFCups({ ...fCups, tarifa_acceso: e.target.value })}>
                {TARIFAS_ACCESO.map((t) => <option key={t} value={t}>{t}</option>)}
              </select></div>
            <div><label className={labelCls}>Comercializadora actual</label>
              <input className={inputCls} value={fCups.comercializadora_actual} onChange={(e) => setFCups({ ...fCups, comercializadora_actual: e.target.value })} /></div>
            <div><label className={labelCls}>Consumo anual (kWh)</label>
              <input className={inputCls} type="number" value={fCups.consumo_anual_kwh} onChange={(e) => setFCups({ ...fCups, consumo_anual_kwh: e.target.value })} /></div>
            <div><label className={labelCls}>Fin de contrato (si se sabe)</label>
              <input className={inputCls} type="date" value={fCups.fecha_fin_contrato} onChange={(e) => setFCups({ ...fCups, fecha_fin_contrato: e.target.value })} /></div>
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => guardarPaso2(true)} className={btnSecundario}>Ahora no lo tengo →</button>
            <button onClick={() => guardarPaso2(false)} disabled={guardando} className={btnSiguiente}>
              Guardar y seguir <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </Card>
      )}

      {/* ── PASO 3: Oportunidad ── */}
      {paso === 3 && (
        <Card className="space-y-3">
          <h3 className="font-bold text-foreground">🎯 ¿Qué le vamos a ofrecer?</h3>
          <p className="text-xs text-muted">Esto crea la oportunidad en el Pipeline para no perderle la pista.</p>
          <div className="grid md:grid-cols-2 gap-3">
            <div><label className={labelCls}>Tipo de oportunidad</label>
              <select className={inputCls} value={fOp.tipo_oportunidad} onChange={(e) => setFOp({ ...fOp, tipo_oportunidad: e.target.value })}>
                {TIPOS_OPORTUNIDAD.map((t) => <option key={t} value={t}>{TIPO_OPORTUNIDAD_LABEL[t]}</option>)}
              </select></div>
            <div><label className={labelCls}>Comisión potencial (€, aproximada)</label>
              <input className={inputCls} type="number" step="0.01" value={fOp.comision_potencial} onChange={(e) => setFOp({ ...fOp, comision_potencial: e.target.value })} /></div>
            <div className="md:col-span-2"><label className={labelCls}>Próxima acción</label>
              <input className={inputCls} value={fOp.proxima_accion} onChange={(e) => setFOp({ ...fOp, proxima_accion: e.target.value })} /></div>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={guardarPaso3} disabled={guardando} className={btnSiguiente}>
              Crear y seguir <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </Card>
      )}

      {/* ── PASO 4: Primera tarea ── */}
      {paso === 4 && (
        <Card className="space-y-3">
          <h3 className="font-bold text-foreground">✅ ¿Cuál es el primer paso?</h3>
          <p className="text-xs text-muted">La primera tarea, con su fecha. Saldrá en Tareas, en Mi Día y en el calendario.</p>
          <div className="grid md:grid-cols-2 gap-3">
            <div><label className={labelCls}>Tipo</label>
              <select className={inputCls} value={fTarea.tipo_tarea} onChange={(e) => setFTarea({ ...fTarea, tipo_tarea: e.target.value })}>
                {TIPOS_TAREA.map((t) => <option key={t} value={t}>{TIPO_TAREA_LABEL[t]}</option>)}
              </select></div>
            <div><label className={labelCls}>Fecha límite</label>
              <input className={inputCls} type="date" value={fTarea.fecha_limite} onChange={(e) => setFTarea({ ...fTarea, fecha_limite: e.target.value })} /></div>
            <div className="md:col-span-2"><label className={labelCls}>Descripción *</label>
              <input className={inputCls} value={fTarea.descripcion} onChange={(e) => setFTarea({ ...fTarea, descripcion: e.target.value })} /></div>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={guardarPaso4} disabled={guardando} className={btnSiguiente}>
              Crear y seguir <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </Card>
      )}

      {/* ── PASO 5: Fechas clave ── */}
      {paso === 5 && (
        <Card className="space-y-3">
          <h3 className="font-bold text-foreground">📅 Las dos fechas que no se pueden escapar</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Presentar proyecto * (máximo 1 semana)</label>
              <input className={inputCls} type="date" max={enDias(7)} value={fFechas.presentar_proyecto}
                onChange={(e) => setFFechas({ ...fFechas, presentar_proyecto: e.target.value })} />
              {diasProyecto > 7 ? (
                <p className="text-[11px] text-red-400 mt-1">⚠️ Son más de 7 días desde hoy: el proyecto se presenta como mucho 1 semana después de captar al cliente.</p>
              ) : (
                <p className="text-[11px] text-muted mt-1">Dentro de {Math.max(diasProyecto, 0)} día(s).</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Fin de contrato actual (si se sabe)</label>
              <input className={inputCls} type="date" value={fFechas.fin_contrato}
                onChange={(e) => setFFechas({ ...fFechas, fin_contrato: e.target.value })} />
              <p className="text-[11px] text-muted mt-1">Generará su aviso en el calendario de fechas críticas.</p>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={guardarPaso5} disabled={guardando || diasProyecto > 7} className={btnSiguiente}>
              Crear fechas <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </Card>
      )}

      {/* ── PASO 6: Resumen ── */}
      {paso === 6 && (
        <Card className="space-y-4 !border-emerald-500/40">
          <h3 className="font-bold text-foreground flex items-center gap-2"><PartyPopper className="w-5 h-5 text-emerald-400" /> Cliente dado de alta, todo en su sitio</h3>
          <ul className="space-y-1.5">
            {creado.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> {c}
              </li>
            ))}
          </ul>
          <div className="flex gap-2 flex-wrap pt-2">
            <button onClick={() => router.push(`/gestor/luz/clientes/${clienteId}`)} className={btnPrimario}>
              Ver ficha del cliente →
            </button>
            <button onClick={() => window.location.reload()} className={btnSecundario}>
              Dar de alta otro cliente
            </button>
            <Link href="/gestor/luz/tareas" className={btnSecundario}>Ir a Tareas</Link>
          </div>
        </Card>
      )}

      {paso > 1 && paso < 6 && (
        <p className="text-[11px] text-muted text-center">
          <ChevronLeft className="w-3 h-3 inline" /> Lo ya guardado no se pierde: si te falta un dato, puedes completarlo luego desde la ficha del cliente.
        </p>
      )}
    </div>
  );
}
