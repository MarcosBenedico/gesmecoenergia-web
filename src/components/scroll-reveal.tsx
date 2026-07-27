'use client';

import { useEffect, useRef, ReactNode } from 'react';

type Direccion = 'up' | 'down' | 'left' | 'right' | 'scale' | 'blur' | 'none';

interface Props {
  children: ReactNode;
  className?: string;
  /** Retardo en ms. Se aplica como variable CSS, no con setTimeout. */
  delay?: number;
  direction?: Direccion;
}

/** De dónde entra cada variante. `blur` y `scale` además desenfocan/escalan. */
const TRANSFORMES: Record<Direccion, string> = {
  up: 'translateY(26px)',
  down: 'translateY(-26px)',
  left: 'translateX(-26px)',
  right: 'translateX(26px)',
  scale: 'scale(0.96)',
  blur: 'translateY(14px)',
  none: 'none',
};

/**
 * Revela su contenido cuando entra en pantalla.
 *
 * Dos cosas cambiaron respecto a la versión anterior y las dos se notan:
 *
 * · El retardo va en la variable CSS `--sr-delay` en vez de en un `setTimeout`.
 *   Con el temporizador, si el hilo principal estaba ocupado (y en la home lo
 *   está: hay un lienzo animado y varias imágenes cargando), la cascada de
 *   tarjetas llegaba a destiempo y se veía a saltos. El retardo de una
 *   transición CSS lo resuelve el compositor y no se entera del atasco.
 * · Si el navegador no trae `IntersectionObserver`, o si el sistema pide
 *   «reducir movimiento», el contenido se muestra de entrada. Antes, sin
 *   observador, el contenido se quedaba a `opacity: 0` **para siempre**: una
 *   página en blanco. Es el riesgo de revelar con JavaScript y hay que cubrirlo.
 */
export function ScrollReveal({ children, className = '', delay = 0, direction = 'up' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (quieto || typeof IntersectionObserver === 'undefined') {
      el.classList.add('sr-visible');
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.add('sr-visible');
        observer.disconnect();
      },
      // Un pelín dentro de la pantalla: revelar justo en el borde hace que el
      // movimiento se vea por el rabillo del ojo y parezca un salto.
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`sr-element ${className}`}
      style={
        {
          '--sr-transform': TRANSFORMES[direction],
          '--sr-delay': `${delay}ms`,
          ...(direction === 'blur' ? { '--sr-filter': 'blur(7px)' } : null),
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
