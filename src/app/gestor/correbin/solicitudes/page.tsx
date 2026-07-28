'use client';

import { useMemo, useState } from 'react';
import { Inbox, Phone, Mail, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Card, Kpi, Badge, EstadoCarga, useLista, guardar, inputCls, labelCls,
  btnSecundario, SelectorResponsable,
} from '../ui';
import { fmtFecha } from '@/lib/correbin';

/**
 * Bandeja de solicitudes de la web (/seguros).
 *
 * El Volumen XII lo exige: «cada solicitud tiene responsable, estado y
 * siguiente paso». Sin esta pantalla los formularios serían un buzón ciego,
 * y el Volumen XI avisa de que el circuito debe poder atender los leads que
 * genera.
 *
 * Lo que escribió el cliente NO se puede editar: es la fuente. Solo se tocan
 * los campos de gestión interna.
 */

interface Solicitud {
  id: string;
  referencia: string;
  tipo: 'revision' | 'siniestro' | 'contacto';
  nombre: string;
  empresa: string | null;
  nif: string | null;
  telefono: string;
  email: string | null;
  localidad: string | null;
  sector: string | null;
  motivo: string | null;
  mensaje: string | null;
  proximo_vencimiento: string | null;
  empleados: number | null;
  facturacion: number | null;
  centros: number | null;
  vehiculos: number | null;
  siniestralidad: string | null;
  poliza: string | null;
  fecha_siniestro: string | null;
  lugar: string | null;
  tipo_siniestro: string | null;
  danos_personales: boolean | null;
  terceros: boolean | null;
  autoridades: string | null;
  urgente: boolean | null;
  origen: string | null;
  campana: string | null;
  estado: string;
  responsable: string | null;
  siguiente_paso: string | null;
  fecha_siguiente_paso: string | null;
  notas_internas: string | null;
  creado_en: string;
}

/** Estados alineados con el proceso real del Volumen XII. */
const ESTADOS: Record<string, { nombre: string; tono: 'muted' | 'accent' | 'verde' | 'rojo' | 'ambar' }> = {
  nueva: { nombre: 'Nueva', tono: 'rojo' },
  clasificada: { nombre: 'Clasificada', tono: 'ambar' },
  en_analisis: { nombre: 'En análisis', tono: 'accent' },
  propuesta_enviada: { nombre: 'Propuesta enviada', tono: 'accent' },
  cerrada_ganada: { nombre: 'Cerrada · ganada', tono: 'verde' },
  cerrada_perdida: { nombre: 'Cerrada · perdida', tono: 'muted' },
};
const ABIERTAS = ['nueva', 'clasificada', 'en_analisis', 'propuesta_enviada'];

const TIPO_LABEL: Record<string, string> = {
  revision: '📋 Revisión de pólizas',
  siniestro: '⚠️ Siniestro',
  contacto: '💬 Consulta',
};

export default function SolicitudesCorrebin() {
  const { datos, cargando, error, faltaMigracion, recargar } = useLista<Solicitud>('solicitudes');
  const [fTipo, setFTipo] = useState('');
  const [fEstado, setFEstado] = useState('abiertas');
  const [abierta, setAbierta] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const filtradas = useMemo(() => datos.filter((s) => {
    if (fTipo && s.tipo !== fTipo) return false;
    if (fEstado === 'abiertas') return ABIERTAS.includes(s.estado);
    if (fEstado && fEstado !== 'todas') return s.estado === fEstado;
    return true;
  }), [datos, fTipo, fEstado]);

  const nuevas = datos.filter((s) => s.estado === 'nueva').length;
  const siniestrosAbiertos = datos.filter((s) => s.tipo === 'siniestro' && ABIERTAS.includes(s.estado)).length;
  const urgentes = datos.filter((s) => s.urgente && ABIERTAS.includes(s.estado)).length;

  async function cambiar(id: string, campos: Record<string, unknown>) {
    const err = await guardar('solicitudes', 'PUT', { id, ...campos });
    if (err) { setMsg(err); return; }
    setMsg('');
    recargar();
  }

  /** Solo los datos que trajo esta solicitud: no se pintan campos vacíos. */
  function datosDelCliente(s: Solicitud): [string, string][] {
    const pares: [string, string | null | undefined][] = [
      ['Empresa', s.empresa], ['NIF/CIF', s.nif], ['Localidad', s.localidad],
      ['Sector', s.sector], ['Motivo', s.motivo],
      ['Próximo vencimiento', s.proximo_vencimiento ? fmtFecha(s.proximo_vencimiento) : null],
      ['Empleados', s.empleados?.toString()],
      ['Facturación', s.facturacion ? `${s.facturacion.toLocaleString('es-ES')} €` : null],
      ['Centros', s.centros?.toString()], ['Vehículos', s.vehiculos?.toString()],
      ['Siniestralidad', s.siniestralidad],
      ['Póliza', s.poliza],
      ['Fecha del siniestro', s.fecha_siniestro ? fmtFecha(s.fecha_siniestro) : null],
      ['Lugar', s.lugar], ['Tipo de siniestro', s.tipo_siniestro],
      ['Daños personales', s.danos_personales ? 'Sí' : null],
      ['Terceros implicados', s.terceros ? 'Sí' : null],
      ['Autoridades', s.autoridades],
      ['Origen', s.origen], ['Campaña', s.campana],
    ];
    return pares.filter(([, v]) => v != null && v !== '') as [string, string][];
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <Inbox className="w-5 h-5 text-accent" /> Solicitudes de la web
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Lo que llega por los formularios de /seguros. Cada una necesita responsable, estado y siguiente paso.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi valor={nuevas} etiqueta="Sin clasificar" color={nuevas > 0 ? 'text-red-400' : 'text-foreground'} />
        <Kpi valor={siniestrosAbiertos} etiqueta="Siniestros abiertos" color={siniestrosAbiertos > 0 ? 'text-amber-400' : 'text-foreground'} />
        <Kpi valor={urgentes} etiqueta="Marcadas urgentes" color={urgentes > 0 ? 'text-red-400' : 'text-foreground'} />
        <Kpi valor={datos.filter((s) => ABIERTAS.includes(s.estado)).length} etiqueta="Abiertas en total" />
      </div>

      <EstadoCarga
        cargando={cargando} error={error} faltaMigracion={faltaMigracion}
        vacio={!cargando && !error && filtradas.length === 0}
        textoVacio="No hay solicitudes con este filtro."
        sqlFile="supabase_correbin_solicitudes.sql"
      />

      {msg && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">{msg}</p>}

      {!cargando && datos.length > 0 && (
        <Card className="!p-3">
          <div className="flex gap-2 flex-wrap">
            <select className={inputCls + ' !w-auto'} value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
              <option value="">Todos los tipos</option>
              <option value="revision">Revisión de pólizas</option>
              <option value="siniestro">Siniestros</option>
              <option value="contacto">Consultas</option>
            </select>
            <select className={inputCls + ' !w-auto'} value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
              <option value="abiertas">Abiertas</option>
              <option value="todas">Todas</option>
              {Object.entries(ESTADOS).map(([v, e]) => <option key={v} value={v}>{e.nombre}</option>)}
            </select>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {filtradas.map((s) => {
          const est = ESTADOS[s.estado] || ESTADOS.nueva;
          const desplegada = abierta === s.id;
          return (
            <Card key={s.id} className={s.urgente && ABIERTAS.includes(s.estado) ? '!border-red-500/40' : ''}>
              {/* Cabecera: quién, qué y cuándo */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm">{s.nombre}</span>
                    {s.empresa && <span className="text-xs text-muted">· {s.empresa}</span>}
                    <Badge tono={est.tono}>{est.nombre}</Badge>
                    {s.urgente && <Badge tono="rojo">URGENTE</Badge>}
                  </div>
                  <p className="text-[11px] text-muted mt-1">
                    {TIPO_LABEL[s.tipo]} · <span className="font-mono">{s.referencia}</span> · {fmtFecha(s.creado_en)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={`tel:${s.telefono}`} className={btnSecundario} title="Llamar">
                    <Phone className="w-3.5 h-3.5" /> {s.telefono}
                  </a>
                  {s.email && (
                    <a href={`mailto:${s.email}`} className={btnSecundario} title="Escribir">
                      <Mail className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button onClick={() => setAbierta(desplegada ? null : s.id)} className={btnSecundario}>
                    {desplegada ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {desplegada ? 'Cerrar' : 'Ver'}
                  </button>
                </div>
              </div>

              {/* Gestión: responsable, estado y siguiente paso */}
              <div className="grid md:grid-cols-4 gap-2.5 mt-3 pt-3 border-t border-border/30">
                <div>
                  <label className={labelCls}>Responsable</label>
                  <SelectorResponsable valor={s.responsable} onCambio={(v) => cambiar(s.id, { responsable: v })} />
                </div>
                <div>
                  <label className={labelCls}>Estado</label>
                  <select className={inputCls} value={s.estado} onChange={(e) => cambiar(s.id, { estado: e.target.value })}>
                    {Object.entries(ESTADOS).map(([v, e]) => <option key={v} value={v}>{e.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Siguiente paso</label>
                  <input
                    className={inputCls}
                    defaultValue={s.siguiente_paso || ''}
                    placeholder="Pedir pólizas, llamar, preparar propuesta..."
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (s.siguiente_paso || '')) cambiar(s.id, { siguiente_paso: v || null });
                    }}
                  />
                </div>
                <div>
                  <label className={labelCls}>Para cuándo</label>
                  <input
                    className={inputCls}
                    type="date"
                    value={s.fecha_siguiente_paso || ''}
                    onChange={(e) => cambiar(s.id, { fecha_siguiente_paso: e.target.value || null })}
                  />
                </div>
              </div>

              {/* Detalle: lo que escribió el cliente, sin tocar */}
              {desplegada && (
                <div className="mt-3 pt-3 border-t border-border/30 space-y-3">
                  {s.mensaje && (
                    <div>
                      <p className={labelCls}>Lo que nos cuenta</p>
                      <p className="text-sm whitespace-pre-wrap bg-card/50 rounded-lg p-3">{s.mensaje}</p>
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5">
                    {datosDelCliente(s).map(([k, v]) => (
                      <p key={k} className="text-xs">
                        <span className="text-muted">{k}:</span> <b>{v}</b>
                      </p>
                    ))}
                  </div>
                  <div>
                    <label className={labelCls}>Notas internas (no las ve el cliente)</label>
                    <textarea
                      className={inputCls}
                      rows={3}
                      defaultValue={s.notas_internas || ''}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (s.notas_internas || '')) cambiar(s.id, { notas_internas: v || null });
                      }}
                    />
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
