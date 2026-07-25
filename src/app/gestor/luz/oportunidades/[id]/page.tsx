'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Loader, Check, ExternalLink, FileText, Eye, Rocket, Save } from 'lucide-react';
import {
  ProspectoGuardado, EstadoProspecto, ESTADOS_PROSPECTO, ESTADO_PROSPECTO_LABEL,
  ESTADO_PROSPECTO_COLOR, TIPO_PROSPECTO_LABEL, categoriaDeNaves,
} from '@/lib/prospeccion';
import { zonaDeParada } from '@/lib/zonas';
import { tokenSesion } from '@/lib/usuario';
import { Card, useListaLuz, guardarLuz, inputCls, labelCls, btnPrimario, btnSecundario, SelectorResponsable } from '../../ui';
import { FotoAerea } from '../../rutas/foto-aerea';
import { promoverACliente, nombreSugerido } from '../promover';

/**
 * FICHA DE UN OBJETIVO.
 *
 * Todo lo que sabemos de un sitio antes de pisarlo: la foto desde arriba, lo
 * que dice el mapa, lo que dice el Catastro y lo que hayamos anotado nosotros.
 *
 * Y el botón que lo mete en el circuito de la casa —cliente, pipeline y
 * agenda—, que es el momento en que deja de ser una idea y pasa a ser trabajo.
 */

export default function FichaObjetivoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const lista = useListaLuz<ProspectoGuardado>('prospectos');

  const p = useMemo(() => lista.datos.find((x) => x.id === id) || null, [lista.datos, id]);

  // Las notas no se copian a estado al cargar: se guarda solo lo que el usuario
  // escriba (`borrador`), y mientras no toque nada se enseña lo que hay en la
  // ficha. Así no hay que sincronizar nada cuando llegan los datos.
  const [borrador, setBorrador] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [promoviendo, setPromoviendo] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const catastroPedido = useRef(false);

  const notas = borrador ?? (p?.notas || '');
  const notasCambiadas = borrador !== null && borrador !== (p?.notas || '');

  /**
   * La ficha del Catastro se pide una sola vez y se GUARDA en la fila: es un
   * dato que no cambia, y así no se molesta al servicio público cada vez que
   * alguien abre esta pantalla.
   */
  useEffect(() => {
    if (!p || p.catastro_referencia || catastroPedido.current) return;
    catastroPedido.current = true;
    (async () => {
      try {
        const res = await fetch('/api/luz/catastro', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: p.lat, lon: p.lon }),
        });
        const json = await res.json();
        const f = json.ficha;
        if (!f?.referencia) return;
        const token = await tokenSesion();
        await fetch('/api/luz/prospectos', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            id: p.id,
            catastro_referencia: f.referencia,
            catastro_uso: f.uso,
            catastro_m2: f.m2_construidos,
            catastro_anio: f.anio,
            catastro_direccion: f.direccion,
          }),
        });
        lista.recargar();
      } catch { /* el Catastro no siempre responde: no es crítico */ }
    })();
  }, [p]); // eslint-disable-line react-hooks/exhaustive-deps

  async function cambiar(campos: Record<string, unknown>) {
    if (!p) return;
    setGuardando(true); setError('');
    const err = await guardarLuz('prospectos', 'PUT', { id: p.id, ...campos });
    setGuardando(false);
    if (err) { setError(err); return; }
    lista.recargar();
  }

  async function pasarAlSistema() {
    if (!p) return;
    setPromoviendo(true); setError(''); setMensaje('');
    const r = await promoverACliente(p, { responsable: p.responsable || 'David' });
    setPromoviendo(false);
    if (r.error) { setError(r.error); if (!r.cliente) return; }
    setMensaje('Ficha de cliente creada, oportunidad en el pipeline y visita en la agenda de David.');
    lista.recargar();
  }

  if (lista.cargando) {
    return <p className="text-sm text-muted flex items-center gap-2"><Loader className="w-4 h-4 animate-spin" /> Cargando…</p>;
  }
  if (!p) {
    return (
      <Card>
        <p className="text-sm text-muted">No encuentro este objetivo. Puede que se haya borrado.</p>
        <Link href="/gestor/luz/oportunidades" className="text-accent text-sm hover:underline mt-2 inline-block">
          ← Volver al mapa de oportunidades
        </Link>
      </Card>
    );
  }

  const cat = categoriaDeNaves(p.n_edificios);
  const zona = zonaDeParada(null, { lat: p.lat, lon: p.lon });
  const yaEsCliente = p.estado === 'convertido';

  return (
    <div className="space-y-4 max-w-4xl">
      <Link href="/gestor/luz/oportunidades" className="inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-foreground">
        <ChevronLeft className="w-4 h-4" /> Mapa de oportunidades
      </Link>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black">{p.nombre || nombreSugerido(p)}</h1>
          <p className="text-sm text-muted mt-0.5">
            {TIPO_PROSPECTO_LABEL[p.tipo]}
            {p.municipio && ` · ${p.municipio}`}
            {zona && <> · <span style={{ color: zona.color }}>{zona.nombre}</span></>}
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full border text-xs font-black"
          style={{
            color: ESTADO_PROSPECTO_COLOR[p.estado],
            borderColor: `${ESTADO_PROSPECTO_COLOR[p.estado]}66`,
            background: `${ESTADO_PROSPECTO_COLOR[p.estado]}18`,
          }}>
          {ESTADO_PROSPECTO_LABEL[p.estado]}
        </span>
      </div>

      {mensaje && <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-lg p-2.5">✓ {mensaje}</p>}
      {error && <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg p-2.5">⚠️ {error}</p>}

      {/* La foto: lo primero, porque es lo que de verdad dice qué hay ahí */}
      <div className="rounded-2xl overflow-hidden border border-border/40">
        <FotoAerea lat={p.lat} lon={p.lon} etiqueta={p.nombre || ''} />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {/* ── Lo que dice el mapa ── */}
        <Card>
          <h2 className="font-bold text-sm mb-2">Lo que se ve desde arriba</h2>
          <dl className="text-xs space-y-1.5">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Tamaño</dt>
              <dd className="font-bold" style={{ color: cat.color }}>{cat.etiqueta}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Metros construidos</dt>
              <dd className="font-bold tabular-nums">{p.m2_construidos.toLocaleString('es-ES')} m²</dd>
            </div>
            {p.nave_largo && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Nave mayor</dt>
                <dd className="font-bold tabular-nums">{p.nave_largo} × {p.nave_ancho} m</dd>
              </div>
            )}
            {p.consumo_estimado_kwh && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Consumo estimado</dt>
                <dd className="font-bold text-emerald-400 tabular-nums">~{p.consumo_estimado_kwh.toLocaleString('es-ES')} kWh/año</dd>
              </div>
            )}
            {p.tiene_balsa && <p className="text-secondary">💧 Tiene balsa al lado</p>}
            {p.ya_tiene_placas && <p className="text-amber-400">☀️ Ya figura con placas</p>}
          </dl>
          <p className="text-[10px] text-muted mt-2 pt-2 border-t border-border/25">
            El consumo es un orden de magnitud por tipo y metros, no un dato: el real no es público.
          </p>
        </Card>

        {/* ── Catastro ── */}
        <Card>
          <h2 className="font-bold text-sm mb-2 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-accent" /> Catastro (oficial)</h2>
          {p.catastro_referencia ? (
            <dl className="text-xs space-y-1.5">
              {p.catastro_direccion && <p className="font-semibold">{p.catastro_direccion}</p>}
              {p.catastro_uso && (
                <div className="flex justify-between gap-2"><dt className="text-muted">Uso</dt><dd className="font-bold">{p.catastro_uso}</dd></div>
              )}
              {p.catastro_m2 && (
                <div className="flex justify-between gap-2"><dt className="text-muted">Construido</dt><dd className="font-bold tabular-nums">{p.catastro_m2.toLocaleString('es-ES')} m²</dd></div>
              )}
              {p.catastro_anio && (
                <div className="flex justify-between gap-2"><dt className="text-muted">Año</dt><dd className="font-bold tabular-nums">{p.catastro_anio}</dd></div>
              )}
              <p className="text-[10px] font-mono text-muted pt-1">{p.catastro_referencia}</p>
              {p.catastro_anio && p.catastro_anio < 2008 && (
                <p className="text-[11px] text-amber-300 pt-1 border-t border-border/25">
                  💬 Nave de {p.catastro_anio}: instalación eléctrica de la época y posible cubierta de fibrocemento.
                  Buena excusa para entrar a hablar, y condiciona el montaje.
                </p>
              )}
            </dl>
          ) : (
            <p className="text-xs text-muted">
              Consultando el Catastro… si no aparece nada, es que aquí no hay parcela catastral con datos.
            </p>
          )}
        </Card>
      </div>

      {/* ── Qué mirar al llegar ── */}
      {p.motivos && (
        <Card>
          <h2 className="font-bold text-sm mb-1.5 flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-secondary" /> Por qué está aquí</h2>
          <ul className="text-xs text-muted space-y-1 pl-4 list-disc marker:text-secondary">
            {p.motivos.split('\n· ').filter(Boolean).map((m, i) => <li key={i}>{m.replace(/^· /, '')}</li>)}
          </ul>
        </Card>
      )}

      {/* ── Trabajo sobre el objetivo ── */}
      <Card>
        <h2 className="font-bold text-sm mb-2">Decisión</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Estado</span>
            <select value={p.estado} disabled={guardando}
              onChange={(e) => cambiar({ estado: e.target.value as EstadoProspecto })}
              className={inputCls}>
              {ESTADOS_PROSPECTO.map((e) => <option key={e} value={e}>{ESTADO_PROSPECTO_LABEL[e]}</option>)}
            </select>
          </label>
          <div>
            <span className={labelCls}>Responsable</span>
            <div className="mt-1">
              <SelectorResponsable valor={p.responsable} onCambio={(v) => cambiar({ responsable: v })} />
            </div>
          </div>
        </div>

        <label className="block mt-3">
          <span className={labelCls}>Notas</span>
          <textarea
            value={notas}
            onChange={(e) => setBorrador(e.target.value)}
            rows={3}
            placeholder="Lo que sepas de este sitio: quién es el dueño, si ya se le visitó, qué se habló…"
            className={inputCls}
          />
        </label>
        {notasCambiadas && (
          <button onClick={async () => { await cambiar({ notas }); setBorrador(null); }}
            disabled={guardando} className={`${btnSecundario} mt-2`}>
            <Save className="w-4 h-4" /> Guardar notas
          </button>
        )}
      </Card>

      {/* ── El paso que convierte una idea en trabajo ── */}
      <Card className={yaEsCliente ? '' : '!border-emerald-500/40'}>
        {yaEsCliente ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
              <Check className="w-4 h-4" /> Ya está en el sistema
            </p>
            {p.cliente_id && (
              <Link href={`/gestor/luz/clientes/${p.cliente_id}`} className={btnSecundario}>
                Ver ficha del cliente →
              </Link>
            )}
          </div>
        ) : (
          <>
            <h2 className="font-bold text-sm flex items-center gap-1.5"><Rocket className="w-4 h-4 text-emerald-400" /> Pasar al sistema</h2>
            <p className="text-[11px] text-muted mt-1 mb-3">
              Le crea la <b className="text-foreground">ficha de cliente</b>, le abre una{' '}
              <b className="text-foreground">oportunidad en el pipeline</b> y le pone a David una{' '}
              <b className="text-foreground">visita en la agenda</b> para pedir la factura. Las tres cosas de una vez:
              sin la tarea, la ficha se crea y no va nadie.
            </p>
            <button onClick={pasarAlSistema} disabled={promoviendo} className={btnPrimario}>
              {promoviendo ? <><Loader className="w-4 h-4 animate-spin" /> Creando…</> : <><Rocket className="w-4 h-4" /> Pasar al sistema</>}
            </button>
          </>
        )}
      </Card>

      <div className="flex gap-2 flex-wrap">
        <a href={`https://www.google.com/maps/@${p.lat},${p.lon},300m/data=!3m1!1e3`}
          target="_blank" rel="noopener noreferrer" className={btnSecundario}>
          <ExternalLink className="w-4 h-4" /> Google Maps (satélite)
        </a>
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`}
          target="_blank" rel="noopener noreferrer" className={btnSecundario}>
          🚗 Cómo llegar
        </a>
        <button onClick={() => router.push('/gestor/luz/oportunidades')} className={btnSecundario}>
          Volver
        </button>
      </div>
    </div>
  );
}
