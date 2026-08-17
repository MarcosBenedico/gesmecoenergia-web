'use client';

/**
 * PANEL DE SEGUIMIENTO — la pantalla de Marcos.
 *
 * Todo lo que David capta y todo lo que se habla con esa gente, en una sola
 * pantalla, para que no se caiga nadie por olvido.
 *
 * TRES DECISIONES QUE EXPLICAN CÓMO SE VE
 *
 * 1. LOS NÚMEROS DE ARRIBA SON RELOJES, NO TOTALES. «23 preclientes» no se
 *    puede accionar; «7 esperando factura, 14 días de media» sí. Cada reloj
 *    filtra la lista al tocarlo.
 * 2. LA FRANJA ROJA ES CORTA A PROPÓSITO. Solo lo que se muere esta semana:
 *    preavisos a punto de cerrarse y ofertas enfriándose. Si ahí cabe todo,
 *    deja de ser una alarma y pasa a ser la misma lista otra vez.
 * 3. SE APUNTA SIN SALIR. El apunte de lo que se ha hablado se escribe en la
 *    propia tarjeta. Cada clic de más entre hablar con el cliente y dejarlo
 *    escrito es una nota que no se escribe, y a la semana el panel miente.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle, Phone, MessageCircle, Clock, Euro, Search, Plus, Check, Loader,
} from 'lucide-react';
import { useUsuario } from '@/lib/usuario';
import type { LuzCliente, LuzCups, LuzOportunidad, LuzContrato } from '@/lib/luz';
import {
  FASE, PELOTA_LABEL, faseDe, diasEntre, ultimoMovimiento, queFalta,
  seMuereEstaSemana, relojes, type FaseSeguimiento, type FichaSeguimiento,
} from '@/lib/seguimiento';
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

export default function SeguimientoPage() {
  const { esAdmin, cargando: cargandoPerfil, perfil } = useUsuario();

  const clientes = useListaLuz<LuzCliente>('clientes');
  const cups = useListaLuz<LuzCups>('cups');
  const pipeline = useListaLuz<LuzOportunidad>('pipeline');
  const contratos = useListaLuz<LuzContrato>('contratos');
  const seguimientos = useListaLuz<Seguimiento>('seguimientos');

  const [faseElegida, setFaseElegida] = useState<FaseSeguimiento | null>(null);
  const [busca, setBusca] = useState('');
  const [apuntando, setApuntando] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const hoy = hoyISO();
  const cargando = cargandoPerfil || clientes.cargando || cups.cargando || pipeline.cargando;

  /** Índices por cliente: se construyen una vez y no en cada tarjeta. */
  const porCliente = useMemo(() => {
    const m = new Map<string, { cups: LuzCups[]; pipeline: LuzOportunidad[]; contratos: LuzContrato[]; apuntes: Seguimiento[] }>();
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
        const fase = faseDe(e);
        if (!fase) return null;

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
          fase,
          diasParado,
          enRojo: diasParado != null && diasParado > FASE[fase].limiteDias,
          queFalta: queFalta(fase, !!c.telefono),
          ultimoApunte: apuntes[0]?.que_se_hablo || null,
          ultimaFecha: apuntes[0]?.fecha || null,
          comision: e.pipeline.reduce((s, o) => s + (Number(o.comision_potencial) || 0), 0),
          diasPreaviso: preavisos.length ? Math.min(...preavisos) : null,
        };
      })
      .filter((f): f is FichaSeguimiento => !!f);
  }, [clientes.datos, porCliente, hoy]);

  const marcadores = useMemo(() => relojes(fichas), [fichas]);
  const urgentes = useMemo(() => seMuereEstaSemana(fichas), [fichas]);

  const visibles = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return fichas
      .filter((f) => !faseElegida || f.fase === faseElegida)
      .filter((f) => !t || f.nombre.toLowerCase().includes(t))
      // Lo más parado arriba: es lo que se está perdiendo.
      .sort((a, b) => Number(b.enRojo) - Number(a.enRojo) || (b.diasParado ?? -1) - (a.diasParado ?? -1));
  }, [fichas, faseElegida, busca]);

  const apuntar = useCallback(async (clienteId: string, datos: { via: string; que_se_hablo: string; proximo_paso: string }) => {
    if (!datos.que_se_hablo.trim()) return;
    const err = await guardarLuz('seguimientos', 'POST', {
      cliente_id: clienteId,
      fecha: hoy,
      via: datos.via,
      que_se_hablo: datos.que_se_hablo.trim(),
      proximo_paso: datos.proximo_paso.trim() || null,
      autor: perfil?.responsable || null,
    });
    if (err) {
      // El fallo más probable es que falte ejecutar el SQL. Decirlo con nombre
      // y apellidos evita media hora de buscar dónde está el problema.
      setMsg(/relation|does not exist|schema/i.test(err)
        ? '⚠️ Falta ejecutar supabase_seguimientos.sql en Supabase.'
        : `⚠️ ${err}`);
      return;
    }
    setApuntando(null);
    setMsg('✓ Apuntado.');
    seguimientos.recargar?.();
  }, [hoy, perfil, seguimientos]);

  if (!cargandoPerfil && !esAdmin) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-foreground">El seguimiento es solo para dirección</p>
            <p className="text-sm text-muted mt-1">
              Enseña la cartera entera con comisiones y tiempos de cada persona.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-foreground">Seguimiento</h1>
          <p className="text-xs text-muted">Todo lo que está en marcha y qué espera cada uno</p>
        </div>
        {msg && <p className="text-xs font-bold text-accent">{msg}</p>}
      </div>

      {/* ── RELOJES ─────────────────────────────────────────────────
          No son totales: son «cuántos y desde cuándo». Se pueden tocar
          para filtrar, que es lo que convierte un dato en una acción. */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {marcadores.map((m) => {
          const activo = faseElegida === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setFaseElegida(activo ? null : m.id)}
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
        {faseElegida && (
          <button onClick={() => setFaseElegida(null)} className={btnSecundario}>
            Ver todos
          </button>
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

      {/* ── LAS TARJETAS ────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-2">
        {visibles.map((f) => (
          <Tarjeta
            key={f.clienteId}
            f={f}
            abierta={apuntando === f.clienteId}
            onAbrir={() => setApuntando(apuntando === f.clienteId ? null : f.clienteId)}
            onApuntar={(d) => apuntar(f.clienteId, d)}
          />
        ))}
      </div>
    </div>
  );
}

/** Una tarjeta por cliente. Se lee de un vistazo o no se lee. */
function Tarjeta({ f, abierta, onAbrir, onApuntar }: {
  f: FichaSeguimiento;
  abierta: boolean;
  onAbrir: () => void;
  onApuntar: (d: { via: string; que_se_hablo: string; proximo_paso: string }) => void;
}) {
  const [via, setVia] = useState('telefono');
  const [texto, setTexto] = useState('');
  const [paso, setPaso] = useState('');
  const [guardando, setGuardando] = useState(false);

  const tel = (f.telefono || '').replace(/[^\d+]/g, '');

  return (
    <div className={`rounded-xl border bg-card/50 p-3 space-y-2 ${
      f.enRojo ? 'border-red-500/40' : 'border-border/50'
    }`}>
      <div className="flex items-start gap-2">
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
        <span className="px-1.5 py-0.5 rounded-full bg-card border border-border/50 text-[9px] font-bold uppercase text-muted">
          {FASE[f.fase].titulo}
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

      {f.ultimoApunte && (
        <p className="text-[11px] text-muted leading-snug line-clamp-2">
          <Clock className="w-3 h-3 inline -mt-0.5 mr-1" />
          {f.ultimaFecha && <span className="font-semibold">{f.ultimaFecha.slice(8, 10)}/{f.ultimaFecha.slice(5, 7)} · </span>}
          {f.ultimoApunte}
        </p>
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
        <button onClick={onAbrir} className={`${btnSecundario} !min-h-[36px] flex-1 !text-[11px]`}>
          <Plus className="w-3.5 h-3.5" /> Apuntar lo hablado
        </button>
      </div>

      {abierta && (
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
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Qué se ha hablado..."
            rows={2}
            className="w-full !text-[13px]"
            autoFocus
          />
          <input
            value={paso}
            onChange={(e) => setPaso(e.target.value)}
            placeholder="Próximo paso (opcional)"
            className="w-full !text-[13px]"
          />
          <button
            onClick={async () => {
              setGuardando(true);
              await onApuntar({ via, que_se_hablo: texto, proximo_paso: paso });
              setGuardando(false);
              setTexto(''); setPaso('');
            }}
            disabled={guardando || !texto.trim()}
            className={`${btnPrimario} w-full !min-h-[40px] disabled:opacity-40`}
          >
            {guardando ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Guardar apunte
          </button>
        </div>
      )}
    </div>
  );
}
