'use client';

/**
 * PIPELINE · VISTA «PARADOS» — el seguimiento de Marcos.
 *
 * Todo lo que David capta y todo lo que se habla con esa gente, en un sitio,
 * para que no se caiga nadie por olvido.
 *
 * NACIÓ COMO PANTALLA APARTE (/gestor/luz/seguimiento) y vive aquí desde que
 * el plan de optimización pidió no tener dos destinos que responden a la misma
 * pregunta. El Tablero enseña el embudo por etapas —dónde está cada uno— y
 * esta vista enseña lo mismo por TIEMPO PARADO: qué lleva demasiado sin
 * moverse. Son la misma cartera mirada por dos ejes, y por eso son pestañas
 * de una sola pantalla y no dos entradas de menú.
 *
 * CUATRO DECISIONES QUE EXPLICAN CÓMO SE VE
 *
 * 1. LOS NÚMEROS DE ARRIBA SON RELOJES, NO TOTALES. «23 preclientes» no se
 *    puede accionar; «7 esperando factura, 14 días de media» sí. Cada reloj
 *    filtra la lista al tocarlo.
 * 2. LA FRANJA ROJA ES CORTA A PROPÓSITO. Solo lo que se muere esta semana:
 *    preavisos a punto de cerrarse y ofertas enfriándose. Si ahí cabe todo,
 *    deja de ser una alarma y pasa a ser la misma lista otra vez.
 * 3. SE GESTIONA SIN SALIR. Apuntar lo hablado, cambiar el estado del embudo y
 *    poner la fecha de firma o de activación, todo desde la propia tarjeta.
 *    Cada clic de más entre hablar con el cliente y dejarlo escrito es una
 *    nota que no se escribe, y a la semana el panel miente.
 * 4. LOS FAVORITOS VAN ARRIBA Y SE GUARDAN EN EL SERVIDOR. Son «a estos los
 *    llevo yo», y esa lista tiene que verse igual en la oficina y en el móvil.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle, Phone, MessageCircle, Clock, Euro, Search, Check, Loader,
  Star, SlidersHorizontal, PenLine, FileText,
} from 'lucide-react';
import { tokenSesion, useUsuario } from '@/lib/usuario';
import {
  ESTADO_PIPELINE_LABEL,
  type LuzCliente, type LuzCups, type LuzOportunidad, type LuzContrato,
} from '@/lib/luz';
import {
  ETAPA, PELOTA_LABEL, etapaDeCliente, diasEntre, ultimoMovimiento, queFalta,
  estaEnRojo, seMuereEstaSemana, relojes, type Etapa, type FichaSeguimiento,
} from '@/lib/seguimiento';
import { contradicciones, ETAPAS_EN_JUEGO } from '@/lib/etapas';
import { Card, btnPrimario, btnSecundario, useListaLuz, guardarLuz } from '../ui';

interface Seguimiento {
  id: string;
  cliente_id: string;
  fecha: string;
  via: string;
  con_quien: string | null;
  que_se_hablo: string;
  proximo_paso: string | null;
  autor: string | null;
}

/** Lo que la tarjeta necesita para poder EDITAR, no solo para pintar. */
interface Entidades {
  cups: LuzCups[];
  pipeline: LuzOportunidad[];
  contratos: LuzContrato[];
  apuntes: Seguimiento[];
}

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const eur = (n: number) => n ? `${Math.round(n).toLocaleString('es-ES')} €` : '—';

const VIAS = [
  { id: 'telefono', label: 'Teléfono' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'visita', label: 'Visita' },
  { id: 'email', label: 'Email' },
];

/**
 * Los estados que se pueden poner desde aquí, en el orden del viaje.
 *
 * Es la lista completa a propósito, incluidos «perdido» y «revisar más
 * adelante»: si desde el panel solo se pudiera avanzar, la única forma de
 * cerrar un cliente que ha dicho que no sería irse a otra pantalla, y lo que
 * pasaría en realidad es que nadie lo cerraría y seguiría contando como vivo.
 */
const ESTADOS_EDITABLES = [
  'prospecto', 'factura_solicitada', 'factura_recibida', 'pendiente_ofertar',
  'oferta_enviada', 'seguimiento', 'doc_incompleta', 'pendiente_permanencia',
  'pendiente_firma', 'ganado', 'perdido', 'revisar_adelante',
];

export function VistaParados() {
  const { esAdmin, cargando: cargandoPerfil, perfil } = useUsuario();

  const clientes = useListaLuz<LuzCliente>('clientes');
  const cups = useListaLuz<LuzCups>('cups');
  const pipeline = useListaLuz<LuzOportunidad>('pipeline');
  const contratos = useListaLuz<LuzContrato>('contratos');
  const seguimientos = useListaLuz<Seguimiento>('seguimientos');

  // El Dashboard enlaza aquí con la etapa ya elegida («18 en análisis» →
  // esos 18). Sin leer el parámetro, el enlace llevaría a la lista entera y
  // habría que volver a filtrar a mano justo después de haber pinchado.
  const sp = useSearchParams();
  const etapaUrl = sp.get('etapa');
  const [etapaElegida, setEtapaElegida] = useState<Etapa | null>(
    etapaUrl && ETAPA[etapaUrl as Etapa] ? (etapaUrl as Etapa) : null
  );
  const [busca, setBusca] = useState('');
  const [abierta, setAbierta] = useState<string | null>(null);
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [msg, setMsg] = useState('');

  const hoy = hoyISO();
  const cargando = cargandoPerfil || clientes.cargando || cups.cargando || pipeline.cargando;

  // ── FAVORITOS ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!esAdmin) return;
    (async () => {
      const token = await tokenSesion();
      const r = await fetch('/api/luz/favoritos', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const j = await r.json().catch(() => ({}));
      if (Array.isArray(j?.favoritos)) setFavoritos(j.favoritos);
    })();
  }, [esAdmin]);

  const alternarFavorito = useCallback(async (id: string) => {
    // Se pinta al instante y se guarda detrás: marcar un favorito no puede
    // hacer esperar a nadie. Si el guardado falla, se avisa y se deshace.
    const antes = favoritos;
    const nuevos = favoritos.includes(id) ? favoritos.filter((x) => x !== id) : [...favoritos, id];
    setFavoritos(nuevos);
    const token = await tokenSesion();
    const r = await fetch('/api/luz/favoritos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ ids: nuevos }),
    });
    if (!r.ok) { setFavoritos(antes); setMsg('⚠️ No he podido guardar el favorito.'); }
  }, [favoritos]);

  /** Índices por cliente: se construyen una vez y no en cada tarjeta. */
  const porCliente = useMemo(() => {
    const m = new Map<string, Entidades>();
    const dame = (id: string) => {
      if (!m.has(id)) m.set(id, { cups: [], pipeline: [], contratos: [], apuntes: [] });
      return m.get(id)!;
    };
    for (const c of cups.datos) if (c.cliente_id) dame(c.cliente_id).cups.push(c);
    for (const o of pipeline.datos) if (o.cliente_id) dame(o.cliente_id).pipeline.push(o);
    for (const k of contratos.datos) if (k.cliente_id) dame(k.cliente_id).contratos.push(k);
    for (const s of seguimientos.datos) if (s.cliente_id) dame(s.cliente_id).apuntes.push(s);
    return m;
  }, [cups.datos, pipeline.datos, contratos.datos, seguimientos.datos]);

  /**
   * Las fichas del panel.
   *
   * Entran los preclientes y los clientes que aún tienen algo abierto. Los
   * OBJETIVOS no: nadie ha hablado con ellos todavía, así que no hay
   * seguimiento que hacer — están en el mapa de oportunidades, que es su sitio.
   */
  const fichas = useMemo<FichaSeguimiento[]>(() => {
    return clientes.datos
      .filter((c) => c.clasificacion === 'precliente' || c.clasificacion === 'cliente')
      .map((c) => {
        const e = porCliente.get(c.id) || { cups: [], pipeline: [], contratos: [], apuntes: [] };
        // La etapa la calcula el vocabulario común, no esta pantalla.
        const etapa = etapaDeCliente({
          estadoComercial: c.estado_comercial,
          pipeline: e.pipeline, cups: e.cups, contratos: e.contratos,
        });
        // Solo lo que sigue en juego: lo activo, lo perdido y lo aparcado no
        // se persigue, y meterlo aquí convertiría el panel en la lista entera.
        if (!ETAPAS_EN_JUEGO.includes(etapa)) return null;

        const apuntes = [...e.apuntes].sort((a, b) => b.fecha.localeCompare(a.fecha));
        const movimiento = ultimoMovimiento([
          apuntes[0]?.fecha,
          ...e.pipeline.map((o) => o.actualizado_en),
          c.fecha_ultimo_contacto,
        ]);
        const diasParado = diasEntre(movimiento, hoy);

        // El preaviso se calcula en vivo desde el CUPS, nunca de una copia.
        // Ojo al orden de los argumentos: aquí interesan los días que FALTAN
        // hasta el límite, no los transcurridos, así que va hoy primero.
        const preavisos = e.cups
          .map((s) => (s.fecha_limite_preaviso ? diasEntre(hoy, String(s.fecha_limite_preaviso)) : null))
          .filter((d): d is number => d != null && d >= 0);

        return {
          clienteId: c.id,
          nombre: c.nombre,
          telefono: c.telefono || null,
          etapa,
          diasParado,
          enRojo: estaEnRojo(etapa, diasParado),
          queFalta: queFalta(etapa, !!c.telefono),
          ultimoApunte: apuntes[0]?.que_se_hablo || null,
          ultimaFecha: apuntes[0]?.fecha || null,
          comision: e.pipeline.reduce((s, o) => s + (Number(o.comision_potencial) || 0), 0),
          diasPreaviso: preavisos.length ? Math.min(...preavisos) : null,
          avisos: contradicciones({
            nombre: c.nombre, estadoComercial: c.estado_comercial,
            pipeline: e.pipeline, cups: e.cups, contratos: e.contratos,
          }),
        };
      })
      .filter((f): f is FichaSeguimiento => !!f);
  }, [clientes.datos, porCliente, hoy]);

  const marcadores = useMemo(() => relojes(fichas), [fichas]);
  const urgentes = useMemo(() => seMuereEstaSemana(fichas), [fichas]);
  const misFavoritos = useMemo(
    () => fichas.filter((f) => favoritos.includes(f.clienteId)),
    [fichas, favoritos]
  );

  const visibles = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return fichas
      .filter((f) => !etapaElegida || f.etapa === etapaElegida)
      .filter((f) => !t || f.nombre.toLowerCase().includes(t))
      // Lo más parado arriba: es lo que se está perdiendo.
      .sort((a, b) => Number(b.enRojo) - Number(a.enRojo) || (b.diasParado ?? -1) - (a.diasParado ?? -1));
  }, [fichas, etapaElegida, busca]);

  /** Recarga solo lo que puede haber cambiado, no la pantalla entera. */
  const refrescar = useCallback(() => {
    pipeline.recargar?.();
    contratos.recargar?.();
    seguimientos.recargar?.();
  }, [pipeline, contratos, seguimientos]);

  const avisar = useCallback((err: string) => {
    // El fallo más probable al empezar es que falte ejecutar el SQL. Decirlo
    // con nombre y apellidos evita media hora buscando dónde está el problema.
    setMsg(/relation|does not exist|schema/i.test(err)
      ? '⚠️ Falta ejecutar supabase_seguimientos.sql en Supabase.'
      : `⚠️ ${err}`);
  }, []);

  const apuntar = useCallback(async (clienteId: string, d: { via: string; que_se_hablo: string; proximo_paso: string }) => {
    const err = await guardarLuz('seguimientos', 'POST', {
      cliente_id: clienteId, fecha: hoy, via: d.via,
      que_se_hablo: d.que_se_hablo.trim(),
      proximo_paso: d.proximo_paso.trim() || null,
      autor: perfil?.responsable || null,
    });
    if (err) return avisar(err);
    setMsg('✓ Apuntado.');
    refrescar();
  }, [hoy, perfil, refrescar, avisar]);

  /**
   * Cambiar el estado del embudo.
   *
   * Va por el PUT de /api/luz/pipeline y no por una escritura directa porque
   * ese PUT lleva dentro la sincronización de estados con el CUPS. Saltárselo
   * por ir más rápido dejaría el suministro descuadrado, que es justo el fallo
   * que costó semanas arreglar en su día.
   */
  const cambiarEstado = useCallback(async (oportunidadId: string, estado: string) => {
    const err = await guardarLuz('pipeline', 'PUT', { id: oportunidadId, estado });
    if (err) return avisar(err);
    setMsg('✓ Estado actualizado.');
    refrescar();
  }, [refrescar, avisar]);

  const guardarContrato = useCallback(async (contratoId: string, campos: Record<string, string | null>) => {
    const err = await guardarLuz('contratos', 'PUT', { id: contratoId, ...campos });
    if (err) return avisar(err);
    setMsg('✓ Contrato actualizado.');
    refrescar();
  }, [refrescar, avisar]);

  if (!cargandoPerfil && !esAdmin) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-foreground">La vista de parados es solo para dirección</p>
            <p className="text-sm text-muted mt-1">
              Enseña la cartera entera con comisiones y tiempos de cada persona.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const pintarTarjeta = (f: FichaSeguimiento, compacta = false) => (
    <Tarjeta
      key={f.clienteId}
      f={f}
      entidades={porCliente.get(f.clienteId)}
      compacta={compacta}
      favorito={favoritos.includes(f.clienteId)}
      abierta={abierta === f.clienteId + (compacta ? ':fav' : '')}
      onAbrir={() => setAbierta(abierta === f.clienteId + (compacta ? ':fav' : '') ? null : f.clienteId + (compacta ? ':fav' : ''))}
      onFavorito={() => alternarFavorito(f.clienteId)}
      onApuntar={(d) => apuntar(f.clienteId, d)}
      onEstado={cambiarEstado}
      onContrato={guardarContrato}
    />
  );

  return (
    <div className="space-y-4">
      {msg && <p className="text-xs font-bold text-accent text-right">{msg}</p>}

      {/* ── FAVORITOS ───────────────────────────────────────────────
          Arriba del todo y por delante de los relojes: es la lista de
          «a estos los llevo yo», y para eso tiene que verse sin buscar. */}
      {misFavoritos.length > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.04] p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-amber-300 mb-2 flex items-center gap-1.5">
            <Star className="w-3 h-3 fill-amber-300" /> Favoritos · {misFavoritos.length}
          </p>
          <div className="grid md:grid-cols-2 gap-2">
            {misFavoritos.map((f) => pintarTarjeta(f, true))}
          </div>
        </div>
      )}

      {/* ── RELOJES ─────────────────────────────────────────────────
          No son totales: son «cuántos y desde cuándo». Se pueden tocar
          para filtrar, que es lo que convierte un dato en una acción. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2">
        {marcadores.map((m) => {
          const activo = etapaElegida === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setEtapaElegida(activo ? null : m.id)}
              className={`text-left rounded-xl border p-3 transition min-h-[84px] ${
                activo ? 'border-accent bg-accent/10' : 'border-border/50 bg-card/50 hover:border-accent/40'
              }`}
            >
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black tabular-nums text-foreground">{m.total}</span>
                {m.enRojo > 0 && (
                  <span className="text-[11px] font-black text-red-400">
                    {m.enRojo} {m.enRojo === 1 ? 'parado' : 'parados'}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-bold text-foreground leading-tight mt-0.5">{m.titulo}</p>
              <p className="text-[10px] text-muted leading-tight">
                {m.diasMedios != null ? `${m.diasMedios} días de media` : PELOTA_LABEL[m.pelota]}
              </p>
            </button>
          );
        })}
      </div>

      {/* ── SE MUERE ESTA SEMANA ───────────────────────────────────── */}
      {urgentes.length > 0 && (
        <Card className="!p-4 border-red-500/30 bg-red-500/[0.04]">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-red-300 mb-2">
            Se muere esta semana · {urgentes.length}
          </p>
          <div className="space-y-1.5">
            {urgentes.map((f) => (
              <div key={f.clienteId} className="flex items-center gap-3 text-sm">
                <span className="shrink-0 text-[11px] font-black text-red-400 tabular-nums w-14">
                  {f.diasPreaviso != null ? `${f.diasPreaviso} días` : `+${f.diasParado}d`}
                </span>
                <span className="font-bold text-foreground truncate flex-1 min-w-0">{f.nombre}</span>
                <span className="text-xs text-muted truncate hidden sm:block">
                  {f.diasPreaviso != null ? 'Se cierra la ventana de preaviso' : f.queFalta}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── BUSCADOR ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full !pl-9"
          />
        </div>
        {etapaElegida && (
          <button onClick={() => setEtapaElegida(null)} className={btnSecundario}>Ver todos</button>
        )}
      </div>

      {cargando && (
        <Card><p className="text-sm text-muted flex items-center gap-2">
          <Loader className="w-4 h-4 animate-spin" /> Cargando la cartera...
        </p></Card>
      )}

      {!cargando && visibles.length === 0 && (
        <Card>
          <p className="text-sm text-muted">
            {fichas.length === 0
              ? 'No hay preclientes con nada abierto. Si acabas de instalar el panel, comprueba que ejecutaste supabase_seguimientos.sql.'
              : 'Nada con ese filtro.'}
          </p>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-2">
        {visibles.map((f) => pintarTarjeta(f))}
      </div>
    </div>
  );
}

/** Una tarjeta por cliente. Se lee de un vistazo, y se gestiona sin salir. */
function Tarjeta({ f, entidades, favorito, abierta, compacta, onAbrir, onFavorito, onApuntar, onEstado, onContrato }: {
  f: FichaSeguimiento;
  entidades?: Entidades;
  favorito: boolean;
  abierta: boolean;
  compacta?: boolean;
  onAbrir: () => void;
  onFavorito: () => void;
  onApuntar: (d: { via: string; que_se_hablo: string; proximo_paso: string }) => void;
  onEstado: (oportunidadId: string, estado: string) => void;
  onContrato: (contratoId: string, campos: Record<string, string | null>) => void;
}) {
  const [panel, setPanel] = useState<'nota' | 'estado'>('nota');
  const [via, setVia] = useState('telefono');
  const [texto, setTexto] = useState('');
  const [paso, setPaso] = useState('');
  const [guardando, setGuardando] = useState(false);

  const tel = (f.telefono || '').replace(/[^\d+]/g, '');
  // Manda la oportunidad ABIERTA: una cerrada hace meses describe peor dónde
  // está el cliente hoy que la que sigue en juego.
  const op = entidades?.pipeline.find((o) => !['ganado', 'perdido'].includes(o.estado))
    || entidades?.pipeline[0];
  const contrato = entidades?.contratos.find((k) => !k.fecha_activacion_real) || entidades?.contratos[0];

  return (
    <div className={`rounded-xl border bg-card/50 p-3 space-y-2 ${
      f.enRojo ? 'border-red-500/40' : 'border-border/50'
    }`}>
      <div className="flex items-start gap-2">
        <button
          onClick={onFavorito}
          className="shrink-0 mt-0.5 text-muted hover:text-amber-300 transition"
          title={favorito ? 'Quitar de favoritos' : 'Añadir a favoritos'}
          aria-label={favorito ? 'Quitar de favoritos' : 'Añadir a favoritos'}
        >
          <Star className={`w-4 h-4 ${favorito ? 'fill-amber-300 text-amber-300' : ''}`} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-foreground text-[15px] leading-tight truncate">{f.nombre}</p>
          <p className="text-[11px] text-accent font-semibold">{f.queFalta}</p>
        </div>
        {/* Los días parados en grande: es el dato que decide si actúas */}
        <div className="text-right shrink-0">
          <p className={`text-lg font-black tabular-nums leading-none ${f.enRojo ? 'text-red-400' : 'text-muted'}`}>
            {f.diasParado != null ? `${f.diasParado}d` : '—'}
          </p>
          <p className="text-[9px] text-muted uppercase tracking-wide">parado</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Una sola etiqueta de situación, la del vocabulario común. El estado
            crudo del embudo ya no se enseña aparte: decía lo mismo con otras
            palabras y obligaba a traducir de cabeza. */}
        <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-black uppercase ${ETAPA[f.etapa].tono}`}>
          {ETAPA[f.etapa].titulo}
        </span>
        {f.diasPreaviso != null && f.diasPreaviso <= 30 && (
          <span className="px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-[9px] font-black uppercase text-red-300">
            Preaviso en {f.diasPreaviso} d
          </span>
        )}
        {f.comision > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[9px] font-bold text-emerald-400">
            <Euro className="w-2.5 h-2.5 inline -mt-0.5" /> {eur(f.comision)}
          </span>
        )}
      </div>

      {/* Contradicciones entre la etiqueta y los hechos. Salen aquí y no en un
          informe aparte porque se arreglan justo donde se ven: el panel de
          abajo ya trae el estado y las fechas del contrato. */}
      {f.avisos.length > 0 && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/[0.06] px-2 py-1.5">
          {f.avisos.map((a) => (
            <p key={a} className="text-[10px] text-amber-200/90 leading-snug flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-px" /> {a}
            </p>
          ))}
        </div>
      )}

      {!compacta && f.ultimoApunte && (
        <p className="text-[11px] text-muted leading-snug line-clamp-2">
          <Clock className="w-3 h-3 inline -mt-0.5 mr-1" />
          {f.ultimaFecha && <span className="font-semibold">{f.ultimaFecha.slice(8, 10)}/{f.ultimaFecha.slice(5, 7)} · </span>}
          {f.ultimoApunte}
        </p>
      )}

      {/* «Falta el estudio» tiene que ser un botón y no una frase. Es lo que
          pide el plan y el motivo es práctico: quien lee «hacer el estudio» y
          tiene que ir a buscar la pantalla lo hace luego, y luego es nunca. */}
      {f.etapa === 'en_analisis' && (
        <a href={`/gestor/luz/estudios?cliente=${f.clienteId}`} className={`${btnSecundario} !min-h-[36px] w-full justify-center`}>
          <FileText className="w-3.5 h-3.5" /> Preparar el estudio
        </a>
      )}

      <div className="flex items-center gap-1.5">
        {tel && (
          <>
            <a href={`tel:${tel}`} className={`${btnSecundario} !px-2.5 !min-h-[36px]`} title="Llamar">
              <Phone className="w-3.5 h-3.5" />
            </a>
            <a href={`https://wa.me/${tel.startsWith('+') ? tel.slice(1) : `34${tel}`}`}
               target="_blank" rel="noopener noreferrer"
               className={`${btnSecundario} !px-2.5 !min-h-[36px]`} title="WhatsApp">
              <MessageCircle className="w-3.5 h-3.5" />
            </a>
          </>
        )}
        <button
          onClick={() => { setPanel('nota'); onAbrir(); }}
          className={`${btnSecundario} !min-h-[36px] flex-1 !text-[11px]`}
        >
          <PenLine className="w-3.5 h-3.5" /> Apuntar
        </button>
        <button
          onClick={() => { setPanel('estado'); if (!abierta) onAbrir(); }}
          className={`${btnSecundario} !min-h-[36px] !px-2.5`}
          title="Cambiar estado, firma y activación"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {abierta && panel === 'nota' && (
        <div className="space-y-2 pt-1 border-t border-border/40">
          <div className="flex gap-1">
            {VIAS.map((v) => (
              <button
                key={v.id}
                onClick={() => setVia(v.id)}
                className={`flex-1 min-h-[32px] rounded-lg border text-[10px] font-bold transition ${
                  via === v.id ? 'bg-accent/20 border-accent/50 text-foreground' : 'bg-card/60 border-border/50 text-muted'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <textarea
            value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder="Qué se ha hablado..." rows={2} className="w-full !text-[13px]" autoFocus
          />
          <input
            value={paso} onChange={(e) => setPaso(e.target.value)}
            placeholder="Próximo paso (opcional)" className="w-full !text-[13px]"
          />
          <button
            onClick={async () => {
              setGuardando(true);
              await onApuntar({ via, que_se_hablo: texto, proximo_paso: paso });
              setGuardando(false); setTexto(''); setPaso('');
            }}
            disabled={guardando || !texto.trim()}
            className={`${btnPrimario} w-full !min-h-[40px] disabled:opacity-40`}
          >
            {guardando ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Guardar apunte
          </button>
        </div>
      )}

      {abierta && panel === 'estado' && (
        <div className="space-y-2.5 pt-1 border-t border-border/40">
          {/* ── ESTADO DEL EMBUDO ── */}
          {op ? (
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted">Estado del embudo</span>
              <select
                value={op.estado}
                onChange={(e) => onEstado(op.id, e.target.value)}
                className="w-full mt-1 !text-[13px]"
              >
                {ESTADOS_EDITABLES.map((e) => (
                  <option key={e} value={e}>{ESTADO_PIPELINE_LABEL[e] || e}</option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-[11px] text-amber-300/90 leading-snug">
              Este cliente no tiene ninguna oportunidad en el pipeline, así que no hay
              estado que cambiar. Créala desde su ficha y aparecerá aquí.
            </p>
          )}

          {/* ── CONTRATO ──
              Las dos fechas que de verdad se olvidan. La de firma cierra la
              venta; la de activación es la que dice si el cambio llegó a pasar,
              y es la que más se queda sin poner. */}
          {contrato ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted">Fecha de firma</span>
                <input
                  type="date"
                  defaultValue={contrato.fecha_firma ? String(contrato.fecha_firma).slice(0, 10) : ''}
                  onChange={(e) => onContrato(contrato.id, { fecha_firma: e.target.value || null })}
                  className="w-full mt-1 !text-[13px]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted">Activación real</span>
                <input
                  type="date"
                  defaultValue={contrato.fecha_activacion_real ? String(contrato.fecha_activacion_real).slice(0, 10) : ''}
                  onChange={(e) => onContrato(contrato.id, {
                    fecha_activacion_real: e.target.value || null,
                    // Poner la fecha de activación y dejar el estado en «firmado»
                    // es lo que hace que un contrato ya cerrado siga saliendo
                    // aquí para siempre. Se mueven las dos cosas a la vez.
                    ...(e.target.value ? { estado_contrato: 'activado' } : {}),
                  })}
                  className="w-full mt-1 !text-[13px]"
                />
              </label>
            </div>
          ) : (
            <p className="text-[11px] text-muted leading-snug">
              Todavía no hay contrato. Se crea al pasar la oportunidad a
              «Pendiente firma» desde Contratos y Activaciones.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
