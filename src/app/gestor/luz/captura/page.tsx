'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Zap, Camera, Loader, Check, MapPin, Phone, MessageSquareText, RefreshCw } from 'lucide-react';
import {
  LuzCliente, PRIORIDADES, PRIORIDAD_LABEL, TIPOS_CLIENTE, TIPO_CLIENTE_LABEL,
  ResponsableEquipo, normCups, fmtFecha,
} from '@/lib/luz';
import { tokenSesion } from '@/lib/usuario';
import { Card, inputCls, labelCls, btnPrimario, btnSecundario, useListaLuz } from '../ui';

/**
 * CAPTURA RÁPIDA — la pieza que une WhatsApp con el panel.
 *
 * El trabajo real llega en crudo al grupo: una foto del sitio, la ubicación,
 * un audio con la descripción, el teléfono y a veces la factura. Alguien tiene
 * que convertir eso en cliente + suministro + tarea, y hasta ahora la única vía
 * era el Alta guiada: seis pasos, pensada para cuando se tienen todos los datos.
 * Con una foto y un audio a medias, esos seis pasos frenan y no se mete nada.
 *
 * Aquí es una sola pantalla: se pega lo que haya llegado, se sube la factura si
 * la hay (la lee Claude y rellena el suministro solo) y un botón crea de golpe
 * el cliente, el suministro, la oportunidad y la tarea para el comercial.
 *
 * Lo que falte se completa después desde la ficha. Es mejor un cliente con tres
 * datos dentro del panel que uno perfecto en un chat.
 */

async function crearConId(recurso: string, body: Record<string, unknown>) {
  try {
    const token = await tokenSesion();
    const r = await fetch(`/api/luz/${recurso}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    return { ok: r.ok, json: await r.json() };
  } catch {
    return null;
  }
}

/** Datos que devuelve el lector de facturas y que aquí interesan. */
interface FacturaLeida {
  tarifa: string;
  consumos_kwh_mes: number[];
  potencias_kw: number[];
  nombre_titular: string;
  observaciones: string;
}

const HOY = () => new Date().toISOString().slice(0, 10);
const EN_DIAS = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const VACIO = {
  nombre: '', telefono: '', ubicacion: '', nota: '',
  tipo_cliente: 'pyme', prioridad: 'C', responsable: '',
  cups: '', accion: 'Llamar para concertar visita y pedir la factura', fecha_accion: EN_DIAS(2),
};

export default function CapturaPage() {
  const equipo = useListaLuz<ResponsableEquipo>('responsables', { activo: 'true' });
  // Los capturados de hoy: sirve de acuse de recibo — se ve qué ha entrado ya
  const clientes = useListaLuz<LuzCliente>('clientes');

  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState(VACIO);
  const [factura, setFactura] = useState<FacturaLeida | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState<string[]>([]);

  // Por defecto la tarea va al comercial: es quien tiene que ir a verlo
  useEffect(() => {
    if (f.responsable) return;
    const comercial = equipo.datos.find((r) => r.rol === 'comercial');
    if (comercial) setF((x) => ({ ...x, responsable: comercial.nombre }));
  }, [equipo.datos]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof typeof VACIO, v: string) => setF((x) => ({ ...x, [k]: v }));

  /** Lee la factura con Claude y rellena lo que pueda del suministro. */
  const leerFactura = useCallback(async (archivo: File) => {
    if (archivo.size > 15 * 1024 * 1024) { setError('El archivo supera los 15 MB.'); return; }
    setLeyendo(true); setError('');
    try {
      const bytes = new Uint8Array(await archivo.arrayBuffer());
      let binario = '';
      for (let i = 0; i < bytes.length; i += 8192) binario += String.fromCharCode(...bytes.subarray(i, i + 8192));

      const res = await fetch('/api/leer-factura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: btoa(binario), mediaType: archivo.type }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'No se pudo leer la factura.'); return; }

      const d = json.datos as FacturaLeida;
      setFactura(d);
      // Si el titular sale legible y aún no hay nombre, se aprovecha
      if (d.nombre_titular && !f.nombre.trim()) set('nombre', d.nombre_titular);
    } catch {
      setError('No se pudo procesar el archivo.');
    } finally {
      setLeyendo(false);
    }
  }, [f.nombre]);

  /** Crea de una vez cliente + suministro + oportunidad + tarea. */
  async function capturar() {
    if (!f.nombre.trim()) { setError('El nombre del cliente es obligatorio.'); return; }
    setGuardando(true); setError(''); setHecho([]);
    const pasos: string[] = [];

    // La nota de voz y la ubicación viven en observaciones: es donde se buscan después
    const observaciones = [
      f.nota.trim(),
      f.ubicacion.trim() ? `📍 Ubicación: ${f.ubicacion.trim()}` : '',
      factura?.observaciones ? `🧾 De la factura: ${factura.observaciones}` : '',
      `— Capturado el ${fmtFecha(HOY())} desde el grupo`,
    ].filter(Boolean).join('\n');

    const rCli = await crearConId('clientes', {
      nombre: f.nombre.trim(),
      telefono: f.telefono.trim() || null,
      tipo_cliente: f.tipo_cliente,
      prioridad: f.prioridad,
      responsable: f.responsable || null,
      via_entrada: factura ? 'facturas' : 'captacion',
      origen_cliente: 'Captación en ruta',
      // Con factura ya hay documentación; sin ella, es un contacto iniciado
      estado_comercial: factura ? 'doc_recibida' : 'contacto_iniciado',
      observaciones,
      fecha_ultimo_contacto: HOY(),
      proxima_accion: f.accion.trim() || null,
      fecha_proxima_accion: f.fecha_accion || null,
    });
    if (!rCli?.ok) {
      setGuardando(false);
      setError(rCli?.json?.error || 'No se pudo crear el cliente.');
      return;
    }
    const clienteId = rCli.json.dato.id as string;
    pasos.push(`Cliente "${f.nombre.trim()}" creado`);

    // Suministro: solo si hay CUPS o si la factura dio datos aprovechables
    let cupsId: string | null = null;
    const consumoAnual = factura ? Math.round((factura.consumos_kwh_mes || []).reduce((s, c) => s + (c || 0), 0) * 12) : 0;
    if (f.cups.trim() || factura) {
      const rCups = await crearConId('cups', {
        cliente_id: clienteId,
        cups: f.cups.trim() ? normCups(f.cups) : `PENDIENTE-${Date.now().toString(36).toUpperCase()}`,
        tarifa_acceso: factura?.tarifa ? `${factura.tarifa}TD` : '2.0TD',
        consumo_anual_kwh: consumoAnual,
        potencias_kw: factura?.potencias_kw?.filter((p) => p > 0) || [],
        direccion_suministro: f.ubicacion.trim() || null,
        estado_cups: factura ? 'factura_recibida' : 'sin_factura',
        prioridad: f.prioridad,
        responsable: f.responsable || null,
      });
      if (rCups?.ok) {
        cupsId = rCups.json.dato.id;
        pasos.push(factura
          ? `Suministro creado con los datos de la factura (${consumoAnual.toLocaleString('es-ES')} kWh/año)`
          : 'Suministro creado, pendiente de datos');
      }
    }

    // Oportunidad: para que aparezca en el embudo desde el minuto uno
    await crearConId('pipeline', {
      cliente_id: clienteId, cups_id: cupsId,
      nombre_oportunidad: `${f.nombre.trim()} · Captación en ruta`,
      tipo_oportunidad: 'cambio_comercializadora',
      estado: factura ? 'factura_recibida' : 'prospecto',
      consumo_anual_kwh: consumoAnual,
      responsable: f.responsable || null,
      proxima_accion: f.accion.trim() || null,
      fecha_proxima_accion: f.fecha_accion || null,
    });
    pasos.push('Oportunidad abierta en el Pipeline');

    // Tarea: es lo que hará que le salga al comercial en su Mi Día
    if (f.accion.trim()) {
      await crearConId('tareas', {
        cliente_id: clienteId, cups_id: cupsId,
        tipo_tarea: factura ? 'preparar_oferta' : 'llamar_cliente',
        descripcion: f.accion.trim(),
        responsable: f.responsable || null,
        fecha_limite: f.fecha_accion || null,
        estado: 'pendiente',
        prioridad: f.prioridad,
      });
      pasos.push(`Tarea asignada a ${f.responsable || 'nadie'} para el ${fmtFecha(f.fecha_accion)}`);
    }

    setGuardando(false);
    setHecho(pasos);
    // Se limpia todo menos el responsable: lo normal es encadenar varias capturas
    setF({ ...VACIO, responsable: f.responsable });
    setFactura(null);
    clientes.recargar();
  }

  // Acuse de recibo: lo que ha entrado hoy, para saber qué queda del grupo
  const hoyISO = HOY();
  const capturadosHoy = clientes.datos.filter((c) => (c.fecha_ultimo_contacto || '').slice(0, 10) === hoyISO);

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h2 className="text-xl font-black text-foreground flex items-center gap-2">
          <Zap className="w-5 h-5 text-accent" /> Captura rápida
        </h2>
        <p className="text-xs text-muted mt-0.5">
          Lo que llega al grupo, dentro del panel en 20 segundos. Con lo que haya: lo que falte se completa después.
        </p>
      </div>

      {error && <p className="fv-fade-in text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">{error}</p>}

      {hecho.length > 0 && (
        <Card className="fv-fade-in !p-4 border-emerald-500/40 bg-emerald-500/5">
          <p className="text-sm font-black text-emerald-400 flex items-center gap-2 mb-1.5">
            <Check className="w-4 h-4" /> Capturado
          </p>
          <ul className="space-y-0.5">
            {hecho.map((p) => <li key={p} className="text-xs text-muted">· {p}</li>)}
          </ul>
          <p className="text-[11px] text-muted/70 mt-2">Listo para el siguiente. El formulario ya está limpio.</p>
        </Card>
      )}

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
        <Card className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className={labelCls}>Nombre del cliente *</label>
              <input className={inputCls} value={f.nombre} autoFocus
                onChange={(e) => set('nombre', e.target.value)}
                placeholder="Como lo diga David: Granja Perlag, Talleres Cinca…" />
            </div>
            <div>
              <label className={labelCls}><Phone className="w-3 h-3 inline mr-1" />Teléfono</label>
              <input className={inputCls} value={f.telefono} inputMode="tel"
                onChange={(e) => set('telefono', e.target.value)} placeholder="974 000 000" />
            </div>
            <div>
              <label className={labelCls}><MapPin className="w-3 h-3 inline mr-1" />Ubicación</label>
              <input className={inputCls} value={f.ubicacion}
                onChange={(e) => set('ubicacion', e.target.value)}
                placeholder="Pega aquí el enlace de Maps o la dirección" />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>
                <MessageSquareText className="w-3 h-3 inline mr-1" />Lo que contó David
              </label>
              <textarea className={`${inputCls} min-h-20`} value={f.nota}
                onChange={(e) => set('nota', e.target.value)}
                placeholder="Pega aquí la transcripción del audio. Si David activa la transcripción de notas de voz en WhatsApp, es copiar y pegar." />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3 pt-1 border-t border-border/30">
            <div>
              <label className={labelCls}>Tipo</label>
              <select className={inputCls} value={f.tipo_cliente} onChange={(e) => set('tipo_cliente', e.target.value)}>
                {TIPOS_CLIENTE.map((t) => <option key={t} value={t}>{TIPO_CLIENTE_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Prioridad</label>
              <select className={inputCls} value={f.prioridad} onChange={(e) => set('prioridad', e.target.value)}>
                {PRIORIDADES.map((p) => <option key={p} value={p}>{PRIORIDAD_LABEL[p]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Se lo asigno a</label>
              <select className={inputCls} value={f.responsable} onChange={(e) => set('responsable', e.target.value)}>
                <option value="">— Sin asignar —</option>
                {equipo.datos.map((r) => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-[1fr_160px] gap-3">
            <div>
              <label className={labelCls}>Qué hay que hacer</label>
              <input className={inputCls} value={f.accion} onChange={(e) => set('accion', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Para cuándo</label>
              <input className={inputCls} type="date" value={f.fecha_accion} onChange={(e) => set('fecha_accion', e.target.value)} />
            </div>
          </div>

          <button onClick={capturar} disabled={guardando || !f.nombre.trim()} className={`${btnPrimario} w-full !py-3 !text-base`}>
            {guardando ? 'Capturando…' : '⚡ Capturar y avisar al comercial'}
          </button>
          <p className="text-[10px] text-muted text-center">
            Crea de una vez el cliente, el suministro, la oportunidad y la tarea. Aparecerá en su Mi Día.
          </p>
        </Card>

        <div className="space-y-4">
          {/* Factura: aquí es donde se ahorra el tecleo de verdad */}
          <Card className="space-y-2">
            <h3 className="font-bold text-sm flex items-center gap-2"><Camera className="w-4 h-4 text-secondary" /> ¿Mandó la factura?</h3>
            <p className="text-[11px] text-muted">
              Sube la foto o el PDF y la lee sola: tarifa, consumos y potencias entran sin teclear nada.
            </p>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
              onChange={(e) => { const a = e.target.files?.[0]; if (a) leerFactura(a); e.target.value = ''; }} />
            <button onClick={() => fileRef.current?.click()} disabled={leyendo} className={`${btnSecundario} w-full justify-center`}>
              {leyendo ? <><Loader className="w-4 h-4 animate-spin" /> Leyendo…</> : <><Camera className="w-4 h-4" /> Subir factura</>}
            </button>

            {factura && (
              <div className="fv-fade-in rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 space-y-1">
                <p className="text-[11px] font-black text-emerald-400">✓ Factura leída</p>
                <p className="text-[11px] text-muted">
                  Tarifa <b className="text-foreground">{factura.tarifa}TD</b> ·{' '}
                  <b className="text-foreground">
                    {Math.round((factura.consumos_kwh_mes || []).reduce((s, c) => s + (c || 0), 0) * 12).toLocaleString('es-ES')} kWh/año
                  </b>
                </p>
                {factura.potencias_kw?.some((p) => p > 0) && (
                  <p className="text-[11px] text-muted">Potencias: {factura.potencias_kw.filter((p) => p > 0).join(' · ')} kW</p>
                )}
                {factura.observaciones && <p className="text-[10px] text-amber-300/90">{factura.observaciones}</p>}
                <button onClick={() => setFactura(null)} className="text-[10px] text-muted hover:text-foreground underline">
                  Descartar y no usarla
                </button>
              </div>
            )}

            <div className="pt-1 border-t border-border/30">
              <label className={labelCls}>CUPS (si lo mandó)</label>
              <input className={`${inputCls} !text-xs`} value={f.cups} onChange={(e) => set('cups', e.target.value)}
                placeholder="ES00…" />
              <p className="text-[10px] text-muted/70 mt-1">
                Si no lo tienes, se crea igual con una referencia provisional y lo completas cuando llegue.
              </p>
            </div>
          </Card>

          {/* Acuse de recibo del día */}
          <Card className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">Entrados hoy · {capturadosHoy.length}</h3>
              <button onClick={() => clientes.recargar()} className="text-muted hover:text-foreground" title="Actualizar">
                <RefreshCw className={`w-3.5 h-3.5 ${clientes.cargando ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {capturadosHoy.length === 0 ? (
              <p className="text-[11px] text-muted">Todavía no ha entrado nada hoy.</p>
            ) : (
              capturadosHoy.slice(0, 8).map((c) => (
                <Link key={c.id} href={`/gestor/luz/clientes/${c.id}`}
                  className="block rounded-lg bg-card/50 border border-border/25 px-2.5 py-1.5 hover:border-accent/40 transition">
                  <p className="text-xs font-bold text-foreground truncate">{c.nombre}</p>
                  <p className="text-[10px] text-muted truncate">
                    {c.telefono || 'sin teléfono'} · {c.responsable || 'sin asignar'}
                  </p>
                </Link>
              ))
            )}
            <p className="text-[10px] text-muted/70 pt-1">
              Sirve de acuse: lo que está aquí ya está dentro y se puede dar por procesado en el grupo.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
