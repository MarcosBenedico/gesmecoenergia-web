'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { TrendingDown, Calendar, Zap } from 'lucide-react';

interface Analisis {
  id: string;
  nombre: string;
  tarifa: string;
  coste_actual: number;
  ahorro_total: number;
  reduccion_porcentaje: number;
  consumo_anual: number;
  fecha: string;
}

const eur = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fecha = (f: string) => new Date(f).toLocaleDateString('es-ES');

export function MobileDashboard() {
  const [analisis, setAnalisis] = useState<Analisis[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarAnalisis();
  }, []);

  async function cargarAnalisis() {
    try {
      const { data, error } = await supabase
        .from('analisis')
        .select('id, nombre, tarifa, coste_actual, ahorro_total, reduccion_porcentaje, consumo_anual, fecha')
        .order('fecha', { ascending: false })
        .limit(10);

      if (!error && data) {
        setAnalisis(data as Analisis[]);
      }
    } catch (e) {
      console.error('Error cargando análisis:', e);
    } finally {
      setCargando(false);
    }
  }

  if (cargando) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted">Cargando...</p>
      </div>
    );
  }

  if (analisis.length === 0) {
    return (
      <div className="p-4 text-center space-y-3">
        <Zap className="w-12 h-12 mx-auto text-muted/40" />
        <p className="text-muted">Aún no hay análisis guardados</p>
        <p className="text-xs text-muted/60">Realiza tu primer análisis para ver los resultados aquí</p>
      </div>
    );
  }

  // Totales
  const totalAhorroAnual = analisis.reduce((s, a) => s + a.ahorro_total, 0);
  const totalConsumo = analisis.reduce((s, a) => s + a.consumo_anual, 0);
  const ahorroPromedio = analisis.length > 0 ? totalAhorroAnual / analisis.length : 0;

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-accent/10 rounded-lg p-4 border border-accent/30">
          <p className="text-xs text-muted mb-1">Ahorro potencial total</p>
          <p className="text-2xl font-bold text-accent">{eur(totalAhorroAnual)}</p>
        </div>
        <div className="bg-secondary rounded-lg p-4">
          <p className="text-xs text-muted mb-1">Consumo total</p>
          <p className="text-2xl font-bold">{totalConsumo.toLocaleString('es-ES')} kWh</p>
        </div>
      </div>

      {/* Análisis recientes */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm px-2">Análisis realizados</h3>
        <div className="space-y-2">
          {analisis.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg border border-border/30 hover:bg-secondary/70 transition"
            >
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                <TrendingDown className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{a.nombre}</p>
                <div className="flex gap-2 mt-1 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {fecha(a.fecha)}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-background/50 text-foreground font-mono">
                    {a.tarifa}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-accent">{eur(a.ahorro_total)}</p>
                <p className="text-xs text-muted">{a.reduccion_porcentaje.toFixed(1)}%</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
