'use client';

import { useEffect } from 'react';

/**
 * Enciende el brillo que sigue al ratón en cualquier elemento con la clase
 * `.foco` (el degradado vive en `globals.css`).
 *
 * Va con un solo escuchador delegado en toda la página en vez de uno por
 * tarjeta: en la home hay más de veinte tarjetas y veinte escuchadores de
 * `pointermove` es coste que no hace falta pagar. La posición se escribe una
 * vez por fotograma como mucho, y en pantallas táctiles no se monta nada
 * porque allí no hay puntero al que seguir.
 */
export function FocoPuntero() {
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;

    let pendiente = 0;
    let ultimo: { x: number; y: number; destino: HTMLElement } | null = null;

    const escribir = () => {
      pendiente = 0;
      if (!ultimo) return;
      const { x, y, destino } = ultimo;
      const caja = destino.getBoundingClientRect();
      destino.style.setProperty('--mx', `${x - caja.left}px`);
      destino.style.setProperty('--my', `${y - caja.top}px`);
    };

    const alMover = (e: PointerEvent) => {
      const objetivo = e.target as Element | null;
      const destino = objetivo?.closest?.('.foco') as HTMLElement | null;
      if (!destino) return;
      ultimo = { x: e.clientX, y: e.clientY, destino };
      if (!pendiente) pendiente = requestAnimationFrame(escribir);
    };

    window.addEventListener('pointermove', alMover, { passive: true });
    return () => {
      window.removeEventListener('pointermove', alMover);
      if (pendiente) cancelAnimationFrame(pendiente);
    };
  }, []);

  return null;
}
