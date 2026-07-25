'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Star, Truck, X, SkipForward, ExternalLink, Undo2, Keyboard } from 'lucide-react';
import {
  ProspectoGuardado, EstadoProspecto, TIPO_PROSPECTO_LABEL, categoriaDeNaves,
} from '@/lib/prospeccion';
import { zonaDeParada } from '@/lib/zonas';
import { urlOrtofoto } from '../rutas/foto-aerea';
import { Card } from '../ui';
import { nombreSugerido } from './promover';

/**
 * REVISIÓN RÁPIDA.
 *
 * Después de barrer una zona quedan ochenta oportunidades sin mirar. Abriendo
 * fichas de una en una eso es una hora larga, y una tarea que cuesta una hora
 * no se hace nunca: el mapa se queda lleno de "sin revisar" y deja de servir.
 *
 * Aquí va una sola a pantalla completa, con la foto grande —que es lo que de
 * verdad decide— y tres botones. Se resuelve una por segundo y medio, así que
 * esas ochenta son diez minutos.
 *
 * Con teclado va todavía más rápido: ←/→ para moverse, 1·2·3 para decidir.
 * Y como se va a fallar alguna yendo deprisa, hay deshacer.
 */

interface Props {
  /** Las que faltan por revisar, en el orden en que se quieren mirar. */
  pendientes: ProspectoGuardado[];
  onDecidir: (p: ProspectoGuardado, estado: EstadoProspecto) => Promise<void>;
  /** Total guardado, para poder decir cuánto queda del conjunto. */
  totalGuardadas: number;
}

const DECISIONES: { estado: EstadoProspecto; texto: string; tecla: string; icono: typeof Star; clases: string }[] = [
  { estado: 'interesante', texto: 'Me interesa', tecla: '1', icono: Star,
    clases: 'border-amber-500/50 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25' },
  { estado: 'para_visitar', texto: 'Que vaya David', tecla: '2', icono: Truck,
    clases: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' },
  { estado: 'descartado', texto: 'Descartar', tecla: '3', icono: X,
    clases: 'border-red-500/50 bg-red-500/15 text-red-400 hover:bg-red-500/25' },
];

export function RevisionRapida({ pendientes, onDecidir, totalGuardadas }: Props) {
  const [i, setI] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  /** Lo último decidido, por si se falla yendo deprisa. */
  const [ultima, setUltima] = useState<{ p: ProspectoGuardado; antes: EstadoProspecto } | null>(null);

  const p = pendientes[i] || null;

  // Al resolver una, la lista se acorta: si el índice se sale, se recoloca
  const total = pendientes.length;
  const indice = Math.min(i, Math.max(0, total - 1));

  const decidir = useCallback(async (estado: EstadoProspecto) => {
    const actual = pendientes[indice];
    if (!actual || ocupado) return;
    setOcupado(true);
    setUltima({ p: actual, antes: actual.estado });
    await onDecidir(actual, estado);
    setOcupado(false);
    // No se avanza el índice: al salir de "pendientes", la siguiente ocupa su
    // sitio sola. Avanzar aquí saltaría una de cada dos.
  }, [pendientes, indice, ocupado, onDecidir]);

  const deshacer = useCallback(async () => {
    if (!ultima || ocupado) return;
    setOcupado(true);
    await onDecidir(ultima.p, ultima.antes);
    setUltima(null);
    setOcupado(false);
  }, [ultima, ocupado, onDecidir]);

  // Teclado: es lo que convierte esto en algo verdaderamente rápido
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '1') decidir('interesante');
      else if (e.key === '2') decidir('para_visitar');
      else if (e.key === '3') decidir('descartado');
      else if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, total - 1));
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
      else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); deshacer(); }
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [decidir, deshacer, total]);

  const zona = useMemo(() => (p ? zonaDeParada(null, { lat: p.lat, lon: p.lon }) : null), [p]);

  if (!p) {
    return (
      <Card>
        <p className="text-sm font-bold text-emerald-400">✓ No queda nada por revisar</p>
        <p className="text-[11px] text-muted mt-1">
          Las {totalGuardadas.toLocaleString('es-ES')} oportunidades guardadas están todas miradas. Barre otra zona
          para seguir, o pásate por <b className="text-foreground">Objetivos</b> a mandar a David.
        </p>
      </Card>
    );
  }

  const cat = categoriaDeNaves(p.n_edificios);

  return (
    <div className="space-y-3">
      {/* Cuánto queda: en una tarea repetitiva, ver el contador bajar ayuda */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-black">
          Quedan <span className="text-secondary tabular-nums">{total}</span> por revisar
        </p>
        <div className="flex items-center gap-2">
          {ultima && (
            <button onClick={deshacer} disabled={ocupado}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border/50 bg-card/80 text-[11px] font-bold text-muted hover:text-foreground transition">
              <Undo2 className="w-3.5 h-3.5" /> Deshacer
            </button>
          )}
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted">
            <Keyboard className="w-3.5 h-3.5" /> 1 · 2 · 3 para decidir, ← → para moverte
          </span>
        </div>
      </div>

      <Card className="!p-0 overflow-hidden">
        {/* La foto manda: grande y lo primero */}
        {/* eslint-disable-next-line @next/next/no-img-element -- servicio WMS externo */}
        <img
          key={p.id}
          src={urlOrtofoto(p.lat, p.lon, 380, 900, 480)}
          alt=""
          className="w-full h-[22rem] object-cover bg-card"
        />

        <div className="p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h2 className="text-lg font-black truncate">{p.nombre || nombreSugerido(p)}</h2>
              <p className="text-xs text-muted">
                {TIPO_PROSPECTO_LABEL[p.tipo]}
                {p.municipio && ` · ${p.municipio}`}
                {zona && <> · <span style={{ color: zona.color }}>{zona.nombre}</span></>}
              </p>
            </div>
            <span className="px-2 py-1 rounded-full text-[11px] font-black text-white shrink-0"
              style={{ background: cat.color }} title={cat.descripcion}>
              {cat.etiqueta}
            </span>
          </div>

          {/* Los cuatro datos que deciden, sin tener que leer nada más */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            {[
              ['Naves', String(p.n_edificios)],
              ['Construido', `${p.m2_construidos.toLocaleString('es-ES')} m²`],
              ['Consumo est.', p.consumo_estimado_kwh ? `~${Math.round(p.consumo_estimado_kwh / 1000)} MWh` : '—'],
              ['Nave mayor', p.nave_largo ? `${p.nave_largo}×${p.nave_ancho} m` : '—'],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta} className="rounded-lg bg-card/60 p-2 text-center">
                <p className="text-sm font-black tabular-nums">{valor}</p>
                <p className="text-[9px] uppercase font-bold text-muted">{etiqueta}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px]">
            {p.tiene_balsa && <span className="text-secondary">💧 Balsa al lado — si es oscura, purines</span>}
            {p.ya_tiene_placas && <span className="text-amber-400">☀️ Ya figura con placas</span>}
            {p.catastro_anio && <span className="text-muted">Catastro: {p.catastro_uso || 'sin uso'} · de {p.catastro_anio}</span>}
          </div>

          {/* Las tres decisiones, grandes y en el orden natural */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            {DECISIONES.map(({ estado, texto, tecla, icono: Icono, clases }) => (
              <button key={estado} onClick={() => decidir(estado)} disabled={ocupado}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 font-black text-xs transition disabled:opacity-50 ${clases}`}>
                <Icono className="w-5 h-5" />
                {texto}
                <span className="text-[9px] opacity-60 font-bold">tecla {tecla}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
            <button
              onClick={() => setI((n) => Math.min(n + 1, total - 1))}
              disabled={ocupado || indice >= total - 1}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-muted hover:text-foreground transition disabled:opacity-40"
            >
              <SkipForward className="w-3.5 h-3.5" /> Ahora no, la siguiente
            </button>
            <div className="flex items-center gap-3">
              <a href={`https://www.google.com/maps/@${p.lat},${p.lon},300m/data=!3m1!1e3`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-muted hover:text-foreground transition">
                <ExternalLink className="w-3.5 h-3.5" /> Mirar de cerca
              </a>
              <Link href={`/gestor/luz/oportunidades/${p.id}`}
                className="text-[11px] font-bold text-accent hover:underline">
                Ficha completa →
              </Link>
            </div>
          </div>
        </div>
      </Card>

      <p className="text-[10px] text-muted">
        Lo que descartes no vuelve a proponerse, aunque se vuelva a barrer la zona. Si te equivocas, deshacer — o
        cámbialo luego desde la lista.
      </p>
    </div>
  );
}
