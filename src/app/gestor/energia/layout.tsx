'use client';

/**
 * GESTIÓN ENERGÉTICA — el módulo.
 *
 * Está separado de la Cartera de luz a propósito, y el motivo es de negocio y
 * no de software:
 *
 *   · La CARTERA contesta «¿a quién le vendo o le renuevo, y cuándo?». Ciclo de
 *     semanas, ingreso por comisión, ritmo diario. Es de David y de Nicola.
 *   · GESTIÓN ENERGÉTICA contesta «¿cómo usa la energía este cliente y qué le
 *     mejoramos?». Ciclo de meses, ingreso por honorarios, ritmo mensual.
 *
 * Meterlas en la misma pantalla es pedirle que conteste dos preguntas que se
 * hacen en momentos distintos del mes.
 *
 * LA SEPARACIÓN ES DE LAS LISTAS DE TRABAJO, NO DE LA VISTA DEL CLIENTE: la
 * ficha del cliente sigue siendo una sola y enseña las dos cosas. Lo que se
 * separa es a dónde vas por la mañana a ver qué te toca.
 *
 * Y LA ISO NO ES UNA ENTRADA DE MENÚ. Si fuera un sitio al que ir, alguien
 * tendría que «hacer la ISO», y ese es exactamente el trabajo que nadie hace
 * nunca. Es una pestaña DENTRO del expediente, sobre el trabajo real.
 */

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Leaf, Zap, ArrowLeft } from 'lucide-react';

export default function EnergiaLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const enListado = pathname === '/gestor/energia';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/40 sticky top-0 z-20 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3 flex-wrap">
          <Link href="/gestor/energia" className="flex items-center gap-2 font-black text-sm shrink-0">
            <Leaf className="w-5 h-5 text-emerald-400" />
            Gestión energética
          </Link>

          {/* El puente entre los dos módulos, siempre visible. Un cliente es uno
              solo: quien está mirando su energía tiene que poder saltar a su
              contrato sin volver por el menú principal. */}
          <Link
            href="/gestor/luz"
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-accent transition"
          >
            <Zap className="w-3.5 h-3.5" /> Cartera de luz
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5">
        {!enListado && (
          <Link
            href="/gestor/energia"
            className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-accent mb-3"
          >
            <ArrowLeft className="w-3 h-3" /> Todos los expedientes
          </Link>
        )}
        {children}
      </main>
    </div>
  );
}
