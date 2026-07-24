'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Users, GitMerge, Loader } from 'lucide-react';
import { LuzCliente, LuzCups, fmtFecha } from '@/lib/luz';
import { Card, Badge, BadgePrioridad, EstadoCarga, useListaLuz, guardarLuz, btnPrimario, btnSecundario } from '../../ui';

/**
 * Detector de clientes duplicados + fusión manual.
 * Agrupa sospechosos por: mismo NIF, mismo teléfono o nombre casi idéntico.
 * Tú eliges cuál es la ficha buena y el resto se fusiona en ella:
 * CUPS, oportunidades, contratos, comisiones, tareas, fechas, visitas y
 * proyectos pasan al principal; los datos de contacto rellenan huecos;
 * las notas se conservan; la ficha duplicada se elimina (auditado).
 */

const norm = (t?: string | null) =>
  (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[.,·]/g, ' ')
    .replace(/\b(s\s?l\s?u?|s\s?a\s?u?|sc|scp|cb|sl|sa)\b/g, '')
    .replace(/\s+/g, ' ').trim();

const soloDigitos = (t?: string | null) => (t || '').replace(/\D/g, '');

/** Distancia de edición (Levenshtein) acotada: para nombres casi iguales. */
function distancia(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[a.length];
}

/** ¿Por qué se consideran posibles duplicados? (o null si no lo son) */
function motivoDuplicado(a: LuzCliente, b: LuzCliente): string | null {
  const nifA = norm(a.nif), nifB = norm(b.nif);
  if (nifA && nifA === nifB) return 'Mismo NIF';
  const telA = soloDigitos(a.telefono), telB = soloDigitos(b.telefono);
  if (telA.length >= 9 && telA === telB) return 'Mismo teléfono';
  const nA = norm(a.nombre), nB = norm(b.nombre);
  if (!nA || !nB) return null;
  if (nA === nB) return 'Mismo nombre';
  if (nA.length >= 6 && nB.length >= 6 && (nA.includes(nB) || nB.includes(nA))) return 'Un nombre contiene al otro';
  if (nA.length >= 8 && nB.length >= 8 && distancia(nA, nB, 2) <= 2) return 'Nombres casi idénticos';
  return null;
}

export default function DuplicadosPage() {
  const clientes = useListaLuz<LuzCliente>('clientes');
  const cups = useListaLuz<LuzCups>('cups');
  const [principalPorGrupo, setPrincipalPorGrupo] = useState<Record<number, string>>({});
  const [fusionando, setFusionando] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [resueltos, setResueltos] = useState<Set<number>>(new Set());

  const cupsPorCliente = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cups.datos) m.set(c.cliente_id, (m.get(c.cliente_id) || 0) + 1);
    return m;
  }, [cups.datos]);

  /** Grupos de sospechosos (union-find sobre las parejas detectadas). */
  const grupos = useMemo(() => {
    const lista = clientes.datos;
    const padre = new Map<string, string>();
    const find = (x: string): string => {
      const p = padre.get(x);
      if (!p || p === x) return x;
      const r = find(p);
      padre.set(x, r);
      return r;
    };
    const unir = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) padre.set(ra, rb); };
    const motivos = new Map<string, Set<string>>();

    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const m = motivoDuplicado(lista[i], lista[j]);
        if (m) {
          unir(lista[i].id, lista[j].id);
          const raiz = find(lista[i].id);
          if (!motivos.has(raiz)) motivos.set(raiz, new Set());
          motivos.get(raiz)!.add(m);
        }
      }
    }

    const porRaiz = new Map<string, LuzCliente[]>();
    for (const c of lista) {
      const r = find(c.id);
      if (!porRaiz.has(r)) porRaiz.set(r, []);
      porRaiz.get(r)!.push(c);
    }
    // Recolocar motivos por raíz final (la raíz puede haber cambiado tras uniones)
    const res: { clientes: LuzCliente[]; motivos: string[] }[] = [];
    for (const [raiz, cs] of porRaiz) {
      if (cs.length < 2) continue;
      const ms = new Set<string>();
      for (const [r, set] of motivos) if (find(r) === find(raiz)) set.forEach((x) => ms.add(x));
      res.push({ clientes: cs.sort((a, b) => (a.creado_en || '').localeCompare(b.creado_en || '')), motivos: Array.from(ms) });
    }
    return res.sort((a, b) => b.clientes.length - a.clientes.length);
  }, [clientes.datos]);

  async function fusionarGrupo(idx: number) {
    const grupo = grupos[idx];
    const principal = principalPorGrupo[idx] || grupo.clientes[0].id;
    const duplicados = grupo.clientes.filter((c) => c.id !== principal);
    const nombrePrincipal = grupo.clientes.find((c) => c.id === principal)?.nombre;
    if (!confirm(
      `Se van a fusionar ${duplicados.length} ficha(s) en "${nombrePrincipal}":\n\n` +
      duplicados.map((d) => `• ${d.nombre}`).join('\n') +
      `\n\nTodo lo suyo (CUPS, oportunidades, tareas, visitas...) pasará a la ficha principal y las duplicadas se eliminarán. ¿Continuar?`
    )) return;

    setFusionando(idx); setMsg('');
    for (const d of duplicados) {
      const err = await guardarLuz('fusionar', 'POST', { principal_id: principal, duplicado_id: d.id });
      if (err) {
        setMsg(`Error fusionando "${d.nombre}": ${err}`);
        setFusionando(null);
        clientes.recargar(); cups.recargar();
        return;
      }
    }
    setMsg(`✅ Fusión completada: ${duplicados.length} ficha(s) unidas a "${nombrePrincipal}".`);
    setResueltos((s) => new Set(s).add(idx));
    setFusionando(null);
    clientes.recargar(); cups.recargar();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2"><GitMerge className="w-5 h-5 text-accent" /> Clientes duplicados</h2>
          <p className="text-xs text-muted mt-0.5">
            Posibles duplicados por NIF, teléfono o nombre casi idéntico. Marca cuál es la ficha buena y fusiona:
            todo lo del resto pasa a ella y las repetidas se eliminan (queda en el Control General).
          </p>
        </div>
        <Link href="/gestor/luz/clientes" className={btnSecundario}><ChevronLeft className="w-4 h-4" /> Clientes</Link>
      </div>

      <EstadoCarga cargando={clientes.cargando} error={clientes.error} faltaMigracion={clientes.faltaMigracion} vacio={false} textoVacio="" sqlFile="supabase_luz.sql" />
      {msg && <p className={`text-xs rounded-lg p-2.5 border ${msg.startsWith('✅') ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-red-400 bg-red-500/10 border-red-500/30'}`}>{msg}</p>}

      {!clientes.cargando && grupos.length === 0 && (
        <Card><p className="text-sm text-emerald-300 text-center py-8">🎉 No se han detectado clientes duplicados. La cartera está limpia.</p></Card>
      )}

      {grupos.map((g, idx) => {
        if (resueltos.has(idx)) return null;
        const principal = principalPorGrupo[idx] || g.clientes[0].id;
        return (
          <Card key={g.clientes.map((c) => c.id).join('-')} className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Users className="w-4 h-4 text-accent" />
                <span className="font-bold text-sm">{g.clientes.length} fichas parecidas</span>
                {g.motivos.map((m) => <Badge key={m} tono="ambar">{m}</Badge>)}
              </div>
              <button
                onClick={() => fusionarGrupo(idx)}
                disabled={fusionando !== null}
                className={btnPrimario}
              >
                {fusionando === idx ? <Loader className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
                {fusionando === idx ? 'Fusionando…' : 'Fusionar en la marcada'}
              </button>
            </div>

            <div className="space-y-1.5">
              {g.clientes.map((c) => (
                <label
                  key={c.id}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition ${
                    principal === c.id ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-border/30 bg-card/50 hover:border-border/60'
                  }`}
                >
                  <input
                    type="radio"
                    name={`grupo-${idx}`}
                    checked={principal === c.id}
                    onChange={() => setPrincipalPorGrupo((p) => ({ ...p, [idx]: c.id }))}
                    className="accent-[#22c55e] w-4 h-4 shrink-0"
                  />
                  <BadgePrioridad prioridad={c.prioridad} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">
                      {c.nombre}
                      {principal === c.id && <span className="ml-2 text-[10px] font-black text-emerald-400">← FICHA PRINCIPAL (se queda)</span>}
                    </p>
                    <p className="text-[10px] text-muted truncate">
                      {c.nif ? `NIF ${c.nif} · ` : ''}{c.telefono ? `📞 ${c.telefono} · ` : ''}{c.direccion_fiscal ? `📍 ${c.direccion_fiscal} · ` : ''}
                      {cupsPorCliente.get(c.id) || 0} CUPS · alta {fmtFecha(c.creado_en?.slice(0, 10))}
                    </p>
                  </div>
                  <Link href={`/gestor/luz/clientes/${c.id}`} target="_blank" onClick={(e) => e.stopPropagation()}
                    className="text-[10px] font-bold text-accent hover:underline shrink-0">
                    ver ficha ↗
                  </Link>
                </label>
              ))}
            </div>
            <p className="text-[10px] text-muted">
              💡 Consejo: deja como principal la que tenga más datos (CUPS, NIF...). Las demás se vaciarán en ella y desaparecerán.
            </p>
          </Card>
        );
      })}
    </div>
  );
}
