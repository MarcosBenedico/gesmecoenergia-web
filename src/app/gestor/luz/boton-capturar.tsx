'use client';

/**
 * BOTÓN GLOBAL «+ CAPTURAR» (GL-02).
 *
 * El plan pide sacar «Captura rápida» del menú y dejarla como botón global
 * fijo. Aquí va con «Alta guiada» al lado, porque son las dos formas de meter
 * algo nuevo y separarlas obligaba a saber de antemano cuál tocaba.
 *
 * NO ES SOLO QUITAR DOS ENTRADAS DEL MENÚ. Meter un cliente o una factura es
 * lo que se hace EN MEDIO de otra cosa: estás mirando la bandeja y te llega un
 * WhatsApp con una factura. Si para eso hay que volver al menú, abrir otra
 * pantalla y perder lo que tenías, no se hace en el momento: se apunta en un
 * papel y se mete luego. O no se mete.
 *
 * Va flotante y abajo a la derecha, que es donde llega el pulgar en el móvil.
 * En escritorio estorba menos ahí que en la barra lateral, que es justo lo que
 * el plan quiere despejar.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, Zap, UserPlus, X } from 'lucide-react';

const OPCIONES = [
  {
    href: '/gestor/luz/captura',
    icono: Zap,
    titulo: 'Captura rápida',
    pista: 'Una foto de la factura y poco más',
  },
  {
    href: '/gestor/luz/alta',
    icono: UserPlus,
    titulo: 'Alta guiada de cliente',
    pista: 'Paso a paso, con suministro y oportunidad',
  },
];

export function BotonCapturar() {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  // Cerrar al tocar fuera y con Escape: un menú flotante que se queda abierto
  // tapa justo la pantalla que se estaba mirando.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  return (
    <div ref={caja} className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
      {abierto && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden w-[15.5rem]">
          {OPCIONES.map(({ href, icono: Icono, titulo, pista }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setAbierto(false)}
              className="flex items-start gap-3 px-3.5 py-3 hover:bg-accent/10 transition border-b border-border/40 last:border-0"
            >
              <Icono className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-foreground leading-tight">{titulo}</span>
                <span className="block text-[11px] text-muted leading-snug">{pista}</span>
              </span>
            </Link>
          ))}
        </div>
      )}

      <button
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label={abierto ? 'Cerrar el menú de captura' : 'Capturar algo nuevo'}
        // 56 px: por encima del mínimo cómodo para el pulgar, que es lo que
        // decide si esto se usa en la calle o no.
        className="h-14 min-w-14 px-4 rounded-full bg-accent text-white shadow-2xl flex items-center gap-2 font-bold text-sm hover:opacity-90 active:scale-95 transition"
      >
        {abierto ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
        <span className="hidden sm:inline">{abierto ? 'Cerrar' : 'Capturar'}</span>
      </button>
    </div>
  );
}
