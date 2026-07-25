'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Radar, Loader, Info, Search, Trash2, Map as MapIcon, Target, Crosshair, List, Zap, Layers } from 'lucide-react';
import {
  ProspectoGuardado, EstadoProspecto, ESTADOS_PROSPECTO, ESTADO_PROSPECTO_LABEL,
  ESTADO_PROSPECTO_COLOR, TIPO_PROSPECTO_LABEL, TipoProspecto, CATEGORIAS_NAVES, categoriaDeNaves,
} from '@/lib/prospeccion';
import { ZONAS } from '@/lib/zonas';
import { Card, EstadoCarga, useListaLuz, guardarLuz, inputCls, labelCls, btnPrimario, btnSecundario } from '../ui';
import { tokenSesion } from '@/lib/usuario';
import { Objetivos } from './objetivos';
import { ListaOportunidades } from './lista';
import { RevisionRapida } from './revision';

// Leaflet necesita `window`: solo en el navegador
const MapaOportunidades = dynamic(() => import('./mapa-oportunidades').then((m) => m.MapaOportunidades), {
  ssr: false,
  loading: () => <div className="w-full h-[34rem] rounded-2xl border border-border/40 bg-surface/40 flex items-center justify-center text-xs text-muted">Cargando mapa…</div>,
});

/**
 * MAPA DE OPORTUNIDADES
 *
 * Las granjas y naves detectadas se GUARDAN, en vez de buscarse cada vez. Eso
 * cambia por completo cómo se trabaja: una zona se barre una vez, y a partir de
 * ahí se va revisando y descartando. Lo descartado no vuelve a aparecer, así
 * que el mapa mejora con el uso en lugar de repetir siempre lo mismo.
 *
 * Y solo lo que aquí se marca como "que vaya David" llega al planificador de
 * rutas. La decisión de a quién se visita es de Marcos; David recibe la lista
 * ya filtrada y no tiene que elegir entre trescientos puntos.
 */

const ORDENES = [
  { clave: 'puntuacion', texto: 'Interés' },
  { clave: 'naves', texto: 'Nº de naves' },
  { clave: 'consumo', texto: 'Consumo estimado' },
  { clave: 'metros', texto: 'Metros construidos' },
] as const;

export default function OportunidadesPage() {
  const prospectos = useListaLuz<ProspectoGuardado>('prospectos');

  const [fEstado, setFEstado] = useState<EstadoProspecto | ''>('');
  const [fTipo, setFTipo] = useState<TipoProspecto | ''>('');
  const [fNavesMin, setFNavesMin] = useState(0);
  const [fMunicipio, setFMunicipio] = useState('');
  const [buscar, setBuscar] = useState('');
  const [orden, setOrden] = useState<(typeof ORDENES)[number]['clave']>('puntuacion');
  // Dos formas de mirar lo mismo: el mapa para descubrir y decidir, la lista de
  // objetivos para trabajar lo ya decidido.
  const [vista, setVista] = useState<'revisar' | 'mapa' | 'lista' | 'objetivos'>('mapa');
  /** Zonas ya barridas, para ver los huecos del territorio. */
  const [mostrarCobertura, setMostrarCobertura] = useState(true);

  // ── Barrido de una zona ──
  const [radioBarrido, setRadioBarrido] = useState(3);
  const [barriendo, setBarriendo] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  /** Dónde se va a barrer. Empieza en Binéfar, que es la base. */
  const [centro, setCentro] = useState<{ lat: number; lon: number }>(
    ZONAS.find((z) => z.id === 'binefar')?.centro || ZONAS[0].centro
  );
  /** Con esto activo, pulsar en el mapa recoloca el centro. */
  const [eligiendoCentro, setEligiendoCentro] = useState(false);
  const [nombreCentro, setNombreCentro] = useState(
    ZONAS.find((z) => z.id === 'binefar')?.nombre || ZONAS[0].nombre
  );

  function elegirCentro(punto: { lat: number; lon: number }) {
    setCentro(punto);
    setNombreCentro(`punto elegido (${punto.lat.toFixed(4)}, ${punto.lon.toFixed(4)})`);
    setEligiendoCentro(false);
  }

  async function barrer() {
    setBarriendo(true); setError(''); setMensaje('');
    try {
      // Sin la sesión, Supabase ve la petición como anónima y RLS rechaza el
      // guardado: la política de la tabla es sólo para usuarios autenticados.
      const token = await tokenSesion();
      const res = await fetch('/api/luz/barrer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ centro, radio_km: radioBarrido }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'No se pudo barrer la zona.'); return; }
      setMensaje(
        json.guardados > 0
          ? `${json.guardados} oportunidades nuevas alrededor de ${nombreCentro}` +
            (json.actualizados ? ` · ${json.actualizados} ya las teníamos` : '')
          : `Nada nuevo por ${nombreCentro}: las ${json.actualizados} que hay ya estaban.`
      );
      if (json.ya_clientes > 0) {
        setMensaje((m) => `${m}. Se han dejado fuera ${json.ya_clientes} que ya son clientes vuestros.`);
      }
      if (json.aviso) setError(json.aviso);
      prospectos.recargar();
      config.recargar(); // el barrido queda apuntado en el cuaderno
    } catch {
      setError('No se pudo conectar para barrer la zona.');
    } finally {
      setBarriendo(false);
    }
  }

  async function cambiarEstado(p: ProspectoGuardado, estado: EstadoProspecto) {
    const err = await guardarLuz('prospectos', 'PUT', { id: p.id, estado });
    if (err) { setError(err); return; }
    prospectos.recargar();
  }

  /**
   * Cuaderno de barridos: se guarda en `luz_config` (clave/valor) para no
   * obligar a otra migración por algo que es una simple bitácora.
   */
  const config = useListaLuz<{ clave: string; valor: string }>('config');
  const barridos = useMemo(() => {
    const fila = config.datos.find((c) => c.clave === 'prospeccion_barridos');
    if (!fila?.valor) return [];
    try {
      const arr = JSON.parse(fila.valor);
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }, [config.datos]);

  const municipios = useMemo(
    () => Array.from(new Set(prospectos.datos.map((p) => p.municipio).filter(Boolean))).sort() as string[],
    [prospectos.datos]
  );

  const filtrados = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    const lista = prospectos.datos.filter((p) => {
      if (fEstado && p.estado !== fEstado) return false;
      if (fTipo && p.tipo !== fTipo) return false;
      if (fNavesMin && p.n_edificios < fNavesMin) return false;
      if (fMunicipio && p.municipio !== fMunicipio) return false;
      if (q && !(p.nombre || '').toLowerCase().includes(q) && !(p.municipio || '').toLowerCase().includes(q)) return false;
      return true;
    });
    const valor = (p: ProspectoGuardado) =>
      orden === 'naves' ? p.n_edificios
      : orden === 'consumo' ? (p.consumo_estimado_kwh || 0)
      : orden === 'metros' ? p.m2_construidos
      : p.puntuacion;
    return [...lista].sort((a, b) => valor(b) - valor(a));
  }, [prospectos.datos, fEstado, fTipo, fNavesMin, fMunicipio, buscar, orden]);

  const porEstado = useMemo(() => {
    const m = {} as Record<string, number>;
    for (const p of prospectos.datos) m[p.estado] = (m[p.estado] || 0) + 1;
    return m;
  }, [prospectos.datos]);

  const porCategoria = useMemo(() => {
    const m = {} as Record<string, number>;
    for (const p of filtrados) {
      const c = categoriaDeNaves(p.n_edificios);
      m[c.clave] = (m[c.clave] || 0) + 1;
    }
    return m;
  }, [filtrados]);

  const paraVisitar = porEstado['para_visitar'] || 0;
  const sinRevisar = porEstado['nuevo'] || 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black flex items-center gap-2">🗺️ Mapa de oportunidades</h1>
        <p className="text-sm text-muted mt-0.5">
          Granjas, naves y negocios de la comarca que todavía no son clientes. Se barre una zona una vez y se va
          filtrando: lo que descartes no vuelve a aparecer.
        </p>
      </div>

      {/* ── Barrer una zona nueva ── */}
      <Card className="!border-secondary/40">
        <div className="flex items-start gap-2 mb-3">
          <Radar className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
          <div>
            <h2 className="font-bold text-sm">Barrer una zona</h2>
            <p className="text-[11px] text-muted">
              Busca en el mapa público y guarda lo que encuentre. Solo hace falta una vez por zona.
            </p>
          </div>
        </div>
        {/* Dónde: un atajo por zona conocida, o el dedo en el mapa */}
        <div className="grid sm:grid-cols-[1fr_auto] gap-2 items-end">
          <label className="block">
            <span className={labelCls}>Ir a una zona conocida</span>
            <select
              value=""
              onChange={(e) => {
                const z = ZONAS.find((x) => x.id === e.target.value);
                if (!z) return;
                setCentro(z.centro);
                setNombreCentro(z.nombre);
                setEligiendoCentro(false);
              }}
              className={inputCls}
            >
              <option value="">Elegir zona…</option>
              {ZONAS.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
            </select>
          </label>
          <button
            onClick={() => setEligiendoCentro((v) => !v)}
            className={eligiendoCentro ? btnPrimario : btnSecundario}
          >
            <Crosshair className="w-4 h-4" />
            {eligiendoCentro ? 'Pulsa en el mapa…' : 'Poner el centro a mano'}
          </button>
        </div>

        {eligiendoCentro && (
          <p className="text-[11px] text-secondary mt-2 bg-secondary/10 border border-secondary/25 rounded-lg p-2">
            Pulsa en el mapa el punto exacto desde el que quieres buscar. El círculo te enseña qué se va a barrer.
          </p>
        )}

        {/* Cuánto: el radio se ve dibujado antes de gastar la consulta */}
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2">
            <span className={labelCls}>Radio de búsqueda</span>
            <span className="text-sm font-black text-secondary tabular-nums">{radioBarrido} km</span>
          </div>
          <input
            type="range" min={1} max={6} step={0.5}
            value={radioBarrido}
            onChange={(e) => setRadioBarrido(Number(e.target.value))}
            className="w-full accent-[var(--color-secondary,#8b5cf6)]"
          />
          <div className="flex justify-between text-[10px] text-muted">
            <span>1 km</span><span>6 km</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
          <p className="text-[11px] text-muted">
            Centro: <b className="text-foreground">{nombreCentro}</b>
          </p>
          <button onClick={barrer} disabled={barriendo} className={btnPrimario}>
            {barriendo ? <><Loader className="w-4 h-4 animate-spin" /> Barriendo…</> : <><Radar className="w-4 h-4" /> Barrer esta zona</>}
          </button>
        </div>

        {barriendo && (
          <p className="text-[11px] text-muted mt-2">
            Puede tardar medio minuto: se consulta el mapa público por tramos.
          </p>
        )}
        {radioBarrido >= 5 && !barriendo && (
          <p className="text-[11px] text-amber-300/90 mt-2">
            Con {radioBarrido} km se consulta mucho territorio y el mapa público puede no dar abasto. Si falla algún
            tramo, te lo digo y basta con repetirlo en un rato.
          </p>
        )}
        {mensaje && <p className="text-[11px] text-emerald-400 mt-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2">✓ {mensaje}</p>}
        {error && <p className="text-[11px] text-amber-300 mt-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">⚠️ {error}</p>}
      </Card>

      {/* Descubrir vs. trabajar: son dos tareas distintas y piden pantallas distintas */}
      <div className="flex gap-1.5">
        {([
          ['revisar', `Revisar${sinRevisar ? ` (${sinRevisar})` : ''}`, Zap],
          ['mapa', 'Mapa', MapIcon],
          ['lista', 'Lista', List],
          ['objetivos', `Objetivos${paraVisitar ? ` (${paraVisitar})` : ''}`, Target],
        ] as const).map(([v, texto, Icono]) => (
          <button key={v} onClick={() => setVista(v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              vista === v ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50 hover:text-foreground'
            }`}>
            <Icono className="w-3.5 h-3.5" /> {texto}
          </button>
        ))}
      </div>

      <EstadoCarga
        cargando={prospectos.cargando}
        error={prospectos.error}
        faltaMigracion={prospectos.faltaMigracion}
        vacio={prospectos.datos.length === 0}
        textoVacio="Todavía no hay ninguna oportunidad guardada. Barre una zona ahí arriba para empezar."
        sqlFile="supabase_prospectos.sql"
      />

      {/* Aunque no haya nada guardado, el mapa se enseña: es donde se elige
          dónde buscar, y sin él no se podría empezar. */}
      {prospectos.datos.length === 0 && !prospectos.cargando && (
        <MapaOportunidades
          prospectos={[]}
          onSeleccionar={() => {}}
          onCambiarEstado={async () => {}}
          centroBarrido={centro}
          radioBarridoKm={radioBarrido}
          eligiendoCentro={eligiendoCentro}
          onElegirCentro={elegirCentro}
          barridos={barridos}
          mostrarCobertura={mostrarCobertura}
        />
      )}

      {prospectos.datos.length > 0 && (
        <>
          {/* ── Resumen por estado: la cola de trabajo ── */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {ESTADOS_PROSPECTO.map((e) => (
              <button key={e} onClick={() => setFEstado(fEstado === e ? '' : e)}
                className={`rounded-xl border p-2.5 text-left transition ${
                  fEstado === e ? 'border-accent bg-accent/10' : 'border-border/40 bg-card/50 hover:border-border'
                }`}>
                <p className="text-xl font-black tabular-nums" style={{ color: ESTADO_PROSPECTO_COLOR[e] }}>
                  {porEstado[e] || 0}
                </p>
                <p className="text-[10px] font-bold text-muted uppercase leading-tight">{ESTADO_PROSPECTO_LABEL[e]}</p>
              </button>
            ))}
          </div>

          {paraVisitar > 0 && (
            <p className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2">
              🚚 <b>{paraVisitar}</b> {paraVisitar === 1 ? 'oportunidad aprobada' : 'oportunidades aprobadas'} para visitar.
              Le aparecen a David en <b>Rutas</b> para meterlas en su recorrido.
            </p>
          )}

          {vista === 'revisar' ? (
            <RevisionRapida
              pendientes={prospectos.datos.filter((p) => p.estado === 'nuevo')}
              onDecidir={cambiarEstado}
              totalGuardadas={prospectos.datos.length}
            />
          ) : vista === 'objetivos' ? (
            <Objetivos
              objetivos={prospectos.datos.filter((p) => p.estado === 'para_visitar')}
              onCambio={() => prospectos.recargar()}
            />
          ) : (
          <>
          {/* ── Filtros ── */}
          <Card>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
              <label className="block lg:col-span-2">
                <span className={labelCls}>Buscar</span>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input value={buscar} onChange={(e) => setBuscar(e.target.value)}
                    placeholder="Nombre o municipio…" className={`${inputCls} pl-8`} />
                </div>
              </label>
              <label className="block">
                <span className={labelCls}>Tipo</span>
                <select value={fTipo} onChange={(e) => setFTipo(e.target.value as TipoProspecto | '')} className={inputCls}>
                  <option value="">Todos</option>
                  {(Object.keys(TIPO_PROSPECTO_LABEL) as TipoProspecto[]).map((t) => (
                    <option key={t} value={t}>{TIPO_PROSPECTO_LABEL[t]}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Municipio</span>
                <select value={fMunicipio} onChange={(e) => setFMunicipio(e.target.value)} className={inputCls}>
                  <option value="">Todos</option>
                  {municipios.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Ordenar por</span>
                <select value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)} className={inputCls}>
                  {ORDENES.map((o) => <option key={o.clave} value={o.clave}>{o.texto}</option>)}
                </select>
              </label>
            </div>

            {/* Tamaño por número de naves: la medida que de verdad usa el sector */}
            <div className="mt-3">
              <p className={labelCls}>Tamaño (nº de naves)</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <button onClick={() => setFNavesMin(0)}
                  className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition ${
                    fNavesMin === 0 ? 'border-accent bg-accent/15 text-accent' : 'border-border/40 bg-card/70 text-muted'
                  }`}>Todas</button>
                {CATEGORIAS_NAVES.map((c) => (
                  <button key={c.clave} onClick={() => setFNavesMin(fNavesMin === c.desde ? 0 : c.desde)}
                    title={c.descripcion}
                    className="px-2 py-1 rounded-lg border text-[11px] font-bold transition"
                    style={{
                      borderColor: fNavesMin === c.desde ? c.color : 'rgba(120,120,140,.35)',
                      background: fNavesMin === c.desde ? `${c.color}22` : 'transparent',
                      color: fNavesMin === c.desde ? c.color : undefined,
                    }}>
                    {c.etiqueta}
                    {porCategoria[c.clave] ? <span className="opacity-60 ml-1">{porCategoria[c.clave]}</span> : null}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted mt-1.5">
                Cada nave lleva su ventilación y sus motores: dos granjas de los mismos metros, una con dos naves y otra
                con ocho, no se parecen en la factura.
              </p>
            </div>

            <p className="text-[11px] font-bold text-muted mt-3">
              {filtrados.length} de {prospectos.datos.length} en el mapa
            </p>
          </Card>

          {vista === 'lista' ? (
            <ListaOportunidades prospectos={filtrados} onCambiarEstado={cambiarEstado} />
          ) : (
          <>
          <MapaOportunidades
            prospectos={filtrados}
            onSeleccionar={() => {}}
            onCambiarEstado={cambiarEstado}
            centroBarrido={centro}
            radioBarridoKm={radioBarrido}
            eligiendoCentro={eligiendoCentro}
            onElegirCentro={elegirCentro}
            barridos={barridos}
            mostrarCobertura={mostrarCobertura}
          />

          {/* Cobertura: los huecos son el trabajo pendiente */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
            <label className="inline-flex items-center gap-1.5 font-bold text-muted cursor-pointer">
              <input type="checkbox" checked={mostrarCobertura}
                onChange={(e) => setMostrarCobertura(e.target.checked)}
                className="accent-[var(--color-accent,#e11d48)]" />
              <Layers className="w-3.5 h-3.5" /> Enseñar lo ya barrido
            </label>
            {barridos.length > 0 && (
              <span className="text-muted">
                {barridos.length} {barridos.length === 1 ? 'barrido hecho' : 'barridos hechos'}. Lo gris ya se ha
                mirado; lo que quede en blanco, nunca.
              </span>
            )}
          </div>

          {/* El navegador se atasca antes que la base de datos: hay que decirlo */}
          {filtrados.length > 800 && (
            <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
              ⚠️ {filtrados.length.toLocaleString('es-ES')} pines en el mapa. A partir de unos 800 el mapa se mueve con
              tirones: filtra por estado, tamaño o municipio para trabajar más cómodo.
            </p>
          )}

          </>
          )}

          <div className="flex items-start gap-1.5 text-[10px] text-muted bg-card/60 rounded-lg p-2">
            <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
            <p>
              El pin lleva el <b className="text-foreground">emoji del tipo</b>, el{' '}
              <b className="text-foreground">número de naves</b> en la esquina y el{' '}
              <b className="text-foreground">color del estado</b>. El consumo es una estimación por tipo y metros, no un
              dato: el real no es público. Púlsalos para ver la foto aérea y decidir.
            </p>
          </div>

          </>
          )}

          {/* Papelera: los descartados siguen ahí, apagados, para no volver a mirarlos */}
          {(porEstado['descartado'] || 0) > 0 && (
            <p className="text-[10px] text-muted flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> {porEstado['descartado']} descartados. Se ven apagados en el mapa para que
              no se vuelvan a proponer, y se pueden reactivar pulsándolos.
            </p>
          )}
        </>
      )}
    </div>
  );
}
