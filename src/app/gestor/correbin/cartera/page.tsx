'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { VctPoliza, RAMOS, RAMO_LABEL, diasHasta, urgenciaVencimiento, fmtEur, fmtFecha } from '@/lib/correbin';
import { Card, BadgeVencimiento, Badge, EstadoCarga, useLista, inputCls, labelCls } from '../ui';

const FILTROS_URGENCIA = [
  { clave: 'todas', nombre: 'Todas' },
  { clave: 'vencida', nombre: 'Vencidas' },
  { clave: 'critica', nombre: '≤ 30 días' },
  { clave: 'proxima', nombre: '31-60 días' },
  { clave: 'normal', nombre: '> 60 días' },
] as const;

export default function CarteraPage() {
  const { datos, cargando, error, faltaMigracion } = useLista<VctPoliza>('polizas', { estado: 'viva' });
  const [urgencia, setUrgencia] = useState<string>('todas');
  const [ramo, setRamo] = useState('');
  const [buscar, setBuscar] = useState('');

  const filtradas = useMemo(() => {
    return datos.filter((p) => {
      if (ramo && p.ramo !== ramo) return false;
      if (urgencia !== 'todas' && urgenciaVencimiento(diasHasta(p.fecha_vencimiento)) !== urgencia) return false;
      if (buscar) {
        const q = buscar.toLowerCase();
        const texto = `${p.vct_clientes?.nombre || ''} ${p.compania} ${p.numero_poliza || ''}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }, [datos, urgencia, ramo, buscar]);

  const primaFiltrada = filtradas.reduce((s, p) => s + (Number(p.prima_anual) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Cartera viva</h2>
          <p className="text-xs text-muted mt-0.5">
            {filtradas.length} póliza(s) · prima anual {fmtEur(primaFiltrada)}
          </p>
        </div>
        <p className="text-[11px] text-muted">
          Las pólizas se añaden desde la ficha de cada cliente o por <Link href="/gestor/correbin/importar" className="text-accent hover:underline">importación Excel</Link>.
        </p>
      </div>

      {/* Filtros */}
      <Card className="!p-4">
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Buscar (cliente, compañía, nº póliza)</label>
            <input className={inputCls} value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Escribe para filtrar..." />
          </div>
          <div>
            <label className={labelCls}>Ramo</label>
            <select className={inputCls} value={ramo} onChange={(e) => setRamo(e.target.value)}>
              <option value="">Todos</option>
              {RAMOS.map((r) => <option key={r} value={r}>{RAMO_LABEL[r]}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Vencimiento</label>
            <div className="flex gap-1.5 flex-wrap">
              {FILTROS_URGENCIA.map((f) => (
                <button
                  key={f.clave}
                  onClick={() => setUrgencia(f.clave)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    urgencia === f.clave ? 'bg-accent text-white' : 'bg-card/80 text-muted border border-border/50 hover:text-foreground'
                  }`}
                >
                  {f.nombre}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <EstadoCarga
        cargando={cargando}
        error={error}
        faltaMigracion={faltaMigracion}
        vacio={!cargando && !error && filtradas.length === 0}
        textoVacio="No hay pólizas que cumplan el filtro. Importa la cartera desde Excel para empezar."
      />

      {/* Tabla */}
      {filtradas.length > 0 && (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border/40">
                <th className="px-4 py-3">Vencimiento</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Ramo</th>
                <th className="px-4 py-3">Compañía</th>
                <th className="px-4 py-3">Nº póliza</th>
                <th className="px-4 py-3 text-right">Prima anual</th>
                <th className="px-4 py-3">Responsable</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((p) => (
                <tr key={p.id} className="border-b border-border/20 hover:bg-card/50 transition">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <BadgeVencimiento fecha={p.fecha_vencimiento} />
                    <span className="block text-[10px] text-muted mt-0.5">{fmtFecha(p.fecha_vencimiento)}</span>
                  </td>
                  <td className="px-4 py-2.5 font-semibold">
                    <Link href={`/gestor/correbin/clientes/${p.cliente_id}`} className="hover:text-accent transition">
                      {p.vct_clientes?.nombre || '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5"><Badge>{RAMO_LABEL[p.ramo] || p.ramo}</Badge></td>
                  <td className="px-4 py-2.5">{p.compania}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">{p.numero_poliza || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-bold tabular-nums">{fmtEur(Number(p.prima_anual))}</td>
                  <td className="px-4 py-2.5 text-muted">{p.responsable || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
