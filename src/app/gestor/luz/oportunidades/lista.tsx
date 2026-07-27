'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader } from 'lucide-react';
import {
  ProspectoGuardado, EstadoProspecto, ESTADO_PROSPECTO_LABEL, ESTADO_PROSPECTO_COLOR,
  ESTADOS_PROSPECTO, TIPO_PROSPECTO_LABEL, categoriaDeNaves,
} from '@/lib/prospeccion';
import { zonaDeParada } from '@/lib/zonas';
import { Card } from '../ui';

/**
 * LAS OPORTUNIDADES EN TABLA.
 *
 * El mapa enseña dónde están; la tabla deja compararlas. Aquí lo que se busca
 * es ordenar y decidir en bloque, así que las dos columnas que mandan son la
 * ZONA —porque las visitas se organizan por salidas— y el SECTOR, que es lo
 * que determina de qué se le habla al llegar.
 */

interface Props {
  prospectos: ProspectoGuardado[];
  onCambiarEstado: (p: ProspectoGuardado, estado: EstadoProspecto) => Promise<void>;
}

export function ListaOportunidades({ prospectos, onCambiarEstado }: Props) {
  /**
   * Selección para trabajar en bloque. Es lo que convierte "filtra granjas de
   * 5+ naves en La Litera" en una decisión de un clic en vez de doce.
   */
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [aplicando, setAplicando] = useState(false);

  const alternar = (id: string) =>
    setMarcados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function aplicarATodos(estado: EstadoProspecto) {
    const lista = prospectos.filter((p) => marcados.has(p.id));
    if (!lista.length) return;
    setAplicando(true);
    // En serie: son escrituras y no compensa saturar la base de datos
    for (const p of lista) await onCambiarEstado(p, estado);
    setMarcados(new Set());
    setAplicando(false);
  }

  /** Zona y sector calculados una vez, que se usan para pintar y ordenar. */
  const filas = useMemo(
    () =>
      prospectos.map((p) => {
        const z = zonaDeParada(null, { lat: p.lat, lon: p.lon });
        return {
          p,
          zona: z?.nombre || 'Sin zona',
          zonaColor: z?.color || '#64748b',
          cat: categoriaDeNaves(p.n_edificios),
        };
      }),
    [prospectos]
  );

  if (!filas.length) {
    return <Card><p className="text-sm text-muted">No hay nada con estos filtros.</p></Card>;
  }

  const todosMarcados = marcados.size === filas.length && filas.length > 0;

  return (
    <>
    {/* Barra de acciones: solo aparece cuando hay algo marcado */}
    {marcados.size > 0 && (
      <div className="flex items-center justify-between gap-2 flex-wrap rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 mb-2">
        <p className="text-xs font-black">
          {marcados.size} {marcados.size === 1 ? 'seleccionada' : 'seleccionadas'}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {aplicando && <Loader className="w-3.5 h-3.5 animate-spin text-muted" />}
          {([
            ['interesante', '★ Me interesan', 'border-amber-500/50 bg-amber-500/15 text-amber-300'],
            ['para_visitar', '🚚 Que vaya David', 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400'],
            ['descartado', '✕ Descartar', 'border-red-500/50 bg-red-500/15 text-red-400'],
          ] as const).map(([estado, texto, clases]) => (
            <button key={estado} onClick={() => aplicarATodos(estado as EstadoProspecto)} disabled={aplicando}
              className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition disabled:opacity-50 ${clases}`}>
              {texto}
            </button>
          ))}
          <button onClick={() => setMarcados(new Set())} disabled={aplicando}
            className="px-2 py-1 rounded-lg border border-border/50 bg-card/80 text-[11px] font-bold text-muted hover:text-foreground transition">
            Quitar selección
          </button>
        </div>
      </div>
    )}

    <Card className="!p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-card/70 text-[10px] uppercase text-muted font-bold text-left">
            <tr className="border-b border-border/40">
              <th className="px-3 py-2.5 w-8">
                <input type="checkbox" checked={todosMarcados}
                  onChange={() => setMarcados(todosMarcados ? new Set() : new Set(filas.map((f) => f.p.id)))}
                  title="Marcar todas las de la vista" className="accent-[var(--color-accent,#e11d48)]" />
              </th>
              <th className="px-3 py-2.5">Sitio</th>
              <th className="px-3 py-2.5">Zona</th>
              <th className="px-3 py-2.5">Sector</th>
              <th className="px-3 py-2.5 text-center">Naves</th>
              <th className="px-3 py-2.5 text-right">Metros</th>
              <th className="px-3 py-2.5 text-right">Consumo est.</th>
              <th className="px-3 py-2.5">Estado</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ p, zona, zonaColor, cat }) => (
              <tr key={p.id} className={`border-b border-border/20 transition ${marcados.has(p.id) ? 'bg-accent/10' : 'hover:bg-card/50'}`}>
                <td className="px-3 py-2">
                  <input type="checkbox" checked={marcados.has(p.id)} onChange={() => alternar(p.id)}
                    className="accent-[var(--color-accent,#e11d48)]" />
                </td>
                <td className="px-3 py-2">
                  <Link href={`/gestor/luz/oportunidades/${p.id}`} className="font-semibold hover:text-accent transition">
                    {p.nombre || <span className="text-muted italic">Sin nombre</span>}
                  </Link>
                  {p.municipio && <span className="block text-[10px] text-muted">{p.municipio}</span>}
                  {p.ya_tiene_placas && <span className="block text-[10px] text-amber-400">☀️ Ya tiene placas</span>}
                </td>

                {/* Zona: es lo que decide con quién se agrupa la visita */}
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap"
                    style={{ borderColor: `${zonaColor}66`, color: zonaColor, background: `${zonaColor}14` }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: zonaColor }} />
                    {zona}
                  </span>
                </td>

                {/* Sector: de qué se le habla al llegar */}
                <td className="px-3 py-2">
                  <span className="whitespace-nowrap">{TIPO_PROSPECTO_LABEL[p.tipo]}</span>
                  {p.tiene_balsa && <span className="block text-[10px] text-secondary">💧 con balsa</span>}
                </td>

                <td className="px-3 py-2 text-center">
                  <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-black text-white"
                    style={{ background: cat.color }} title={cat.descripcion}>
                    {p.n_edificios}
                  </span>
                </td>

                <td className="px-3 py-2 text-right tabular-nums">{p.m2_construidos.toLocaleString('es-ES')} m²</td>

                <td className="px-3 py-2 text-right tabular-nums">
                  {p.consumo_estimado_kwh
                    ? <span className="text-emerald-400 font-bold">~{Math.round(p.consumo_estimado_kwh / 1000).toLocaleString('es-ES')} MWh</span>
                    : <span className="text-muted">—</span>}
                </td>

                <td className="px-3 py-2">
                  <select
                    value={p.estado}
                    onChange={(e) => onCambiarEstado(p, e.target.value as EstadoProspecto)}
                    className="rounded-md border border-border/40 bg-background/60 px-1.5 py-0.5 text-[11px] font-semibold"
                    style={{ color: ESTADO_PROSPECTO_COLOR[p.estado] }}
                  >
                    {ESTADOS_PROSPECTO.map((e) => <option key={e} value={e}>{ESTADO_PROSPECTO_LABEL[e]}</option>)}
                  </select>
                </td>

                <td className="px-3 py-2">
                  <Link href={`/gestor/luz/oportunidades/${p.id}`}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-accent hover:underline whitespace-nowrap">
                    Ficha <ExternalLink className="w-3 h-3" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted px-3 py-2 border-t border-border/25">
        El consumo es una estimación por sector y metros, no un dato. El color del número de naves marca el tamaño.
        Marca varias con las casillas para decidirlas de golpe.
      </p>
    </Card>
    </>
  );
}
