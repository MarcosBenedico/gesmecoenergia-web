'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { VctPoliza, RAMO_LABEL, fmtEur } from '@/lib/correbin';
import { Card, EstadoCarga, useLista, btnSecundario } from '../ui';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function CalendarioVct() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth()); // 0-11

  const desde = `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
  const ultimoDia = new Date(anio, mes + 1, 0).getDate();
  const hasta = `${anio}-${String(mes + 1).padStart(2, '0')}-${ultimoDia}`;

  const { datos, cargando, error, faltaMigracion } = useLista<VctPoliza>('polizas', {
    estado: 'viva', desde, hasta,
  });

  const porDia = useMemo(() => {
    const m = new Map<number, VctPoliza[]>();
    for (const p of datos) {
      const d = new Date(p.fecha_vencimiento).getDate();
      m.set(d, [...(m.get(d) || []), p]);
    }
    return m;
  }, [datos]);

  function cambiarMes(delta: number) {
    const f = new Date(anio, mes + delta, 1);
    setAnio(f.getFullYear());
    setMes(f.getMonth());
  }

  // Lunes = 0
  const primerDiaSemana = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const celdas: (number | null)[] = [
    ...Array.from({ length: primerDiaSemana }, () => null),
    ...Array.from({ length: ultimoDia }, (_, i) => i + 1),
  ];

  const esHoy = (d: number) =>
    d === hoy.getDate() && mes === hoy.getMonth() && anio === hoy.getFullYear();

  const primaMes = datos.reduce((s, p) => s + (Number(p.prima_anual) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Calendario de vencimientos</h2>
          <p className="text-xs text-muted mt-0.5">
            {datos.length} vencimiento(s) en {MESES[mes]} · prima en juego {fmtEur(primaMes)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => cambiarMes(-1)} className={btnSecundario} aria-label="Mes anterior">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-foreground min-w-36 text-center">{MESES[mes]} {anio}</span>
          <button onClick={() => cambiarMes(1)} className={btnSecundario} aria-label="Mes siguiente">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <EstadoCarga cargando={cargando} error={error} faltaMigracion={faltaMigracion} vacio={false} textoVacio="" />

      {!cargando && !error && (
        <Card className="!p-3 md:!p-4">
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="text-center text-[11px] font-bold text-muted py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {celdas.map((dia, i) => {
              if (dia === null) return <div key={`v-${i}`} />;
              const venc = porDia.get(dia) || [];
              return (
                <div
                  key={dia}
                  className={`min-h-20 rounded-lg border p-1.5 ${
                    esHoy(dia)
                      ? 'border-accent bg-accent/10'
                      : venc.length > 0
                      ? 'border-amber-500/40 bg-amber-500/5'
                      : 'border-border/20 bg-card/40'
                  }`}
                >
                  <p className={`text-[11px] font-bold ${esHoy(dia) ? 'text-accent' : 'text-muted'}`}>{dia}</p>
                  <div className="space-y-1 mt-1">
                    {venc.slice(0, 3).map((p) => (
                      <Link
                        key={p.id}
                        href={`/gestor/correbin/clientes/${p.cliente_id}`}
                        className="block text-[10px] leading-tight px-1.5 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25 hover:bg-amber-500/25 transition truncate"
                        title={`${p.vct_clientes?.nombre} · ${p.compania} · ${fmtEur(Number(p.prima_anual))}`}
                      >
                        {p.vct_clientes?.nombre || RAMO_LABEL[p.ramo]}
                      </Link>
                    ))}
                    {venc.length > 3 && (
                      <p className="text-[10px] text-muted px-1">+{venc.length - 3} más</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Lista del mes */}
      {datos.length > 0 && (
        <Card>
          <h3 className="font-bold text-sm mb-3">Detalle del mes</h3>
          <div className="space-y-1.5">
            {datos.map((p) => (
              <Link
                key={p.id}
                href={`/gestor/correbin/clientes/${p.cliente_id}`}
                className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-card/60 hover:bg-card transition text-sm"
              >
                <span className="font-bold tabular-nums w-8 shrink-0 text-amber-400">
                  {new Date(p.fecha_vencimiento).getDate()}
                </span>
                <span className="flex-1 font-semibold truncate">{p.vct_clientes?.nombre || '—'}</span>
                <span className="text-muted text-xs truncate hidden md:block">{RAMO_LABEL[p.ramo]} · {p.compania}</span>
                <span className="font-bold tabular-nums shrink-0">{fmtEur(Number(p.prima_anual))}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
