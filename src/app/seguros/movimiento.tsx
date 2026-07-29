'use client';

import { motion, useInView, useReducedMotion, useSpring, useTransform, type Variants } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { CORREBIN_COLORES as C } from '@/lib/correbin-marca';

/**
 * MOVIMIENTO DE LA MICROSEDE DE SEGUROS.
 *
 * Correbin no vende impulso, vende criterio: aquí no pega un movimiento
 * llamativo. Lo que da sensación de oficio es lo contrario — entradas lentas,
 * recorridos cortos y una curva que frena sin rebotar. Nada salta, nada gira,
 * nada llama la atención sobre sí mismo.
 *
 * Por eso todo usa la misma curva de salida y desplazamientos de 12-20 px: se
 * nota que la página está viva, pero no se ve la animación.
 *
 * DURACIONES. La primera versión revelaba en 750 ms y quedaba pastosa: al
 * bajar deprisa, el contenido llegaba tarde a su sitio. La referencia de
 * ui-ux-pro-max es 150-300 ms para microinteracciones y nunca pasar de 500 en
 * interfaz, así que los revelados bajan a 420 ms y el escalonado a 380. Se
 * sigue notando la entrada, pero ya no se espera a nada.
 *
 * Todo respeta `prefers-reduced-motion`.
 *
 * Y HAY PLAN B, que es lo que más importa: Motion escribe `opacity: 0` ya en el
 * HTML del servidor, así que sin JavaScript la página se quedaría EN BLANCO.
 * Por eso cada envoltorio lleva `data-revelar` y el layout trae un <noscript>
 * que los fuerza a visibles. Con JavaScript se anima; sin él, se lee igual.
 * Es el mismo cuidado que ya tiene ScrollReveal en la web de energía.
 */

/** La curva de la casa: sale rápido y frena largo. Sin rebote. */
export const SALIDA = [0.16, 1, 0.3, 1] as const;

/**
 * SEGURO DE TIEMPO.
 *
 * `whileInView` depende de IntersectionObserver y de que el navegador esté
 * pintando. Si algo de eso no ocurre —pestaña en segundo plano, el navegador
 * pausa las animaciones, una hidratación lenta— el contenido se queda a
 * opacidad 0 y la página aparece vacía.
 *
 * Así que no se espera indefinidamente: pasado este tiempo se enseña igual.
 * Perder una animación no le importa a nadie; perder la página, sí.
 */
const MS_SEGURO = 1200;

/** Está a la vista, o ya se ha esperado bastante. Lo que llegue antes. */
function useRevelado(ref: React.RefObject<Element | null>) {
  const aLaVista = useInView(ref, { once: true, margin: '-80px' });
  const [porTiempo, setPorTiempo] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPorTiempo(true), MS_SEGURO);
    return () => clearTimeout(t);
  }, []);
  return aLaVista || porTiempo;
}

/* ═══════════════════════════════════════════════════════════
   Revelar al entrar en pantalla
   ═══════════════════════════════════════════════════════════ */

export function Revelar({
  children,
  retardo = 0,
  desde = 'abajo',
  className = '',
}: {
  children: React.ReactNode;
  retardo?: number;
  desde?: 'abajo' | 'izquierda' | 'derecha' | 'nada';
  className?: string;
}) {
  const quieto = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const revelado = useRevelado(ref);

  if (quieto) return <div className={className}>{children}</div>;

  const desplazamiento =
    desde === 'izquierda' ? { x: -22, y: 0 } : desde === 'derecha' ? { x: 22, y: 0 } : desde === 'nada' ? { x: 0, y: 0 } : { x: 0, y: 20 };

  return (
    <motion.div
      ref={ref}
      data-revelar
      className={className}
      initial={{ opacity: 0, ...desplazamiento }}
      animate={revelado ? { opacity: 1, x: 0, y: 0 } : undefined}
      transition={{ duration: 0.42, delay: retardo, ease: SALIDA }}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Entrada escalonada de una lista
   ═══════════════════════════════════════════════════════════ */

const CONTENEDOR: Variants = {
  oculto: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
const HIJO: Variants = {
  oculto: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: SALIDA } },
};

export function Escalonado({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const quieto = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const revelado = useRevelado(ref);

  if (quieto) return <div className={className}>{children}</div>;
  return (
    <motion.div
      ref={ref}
      data-revelar
      className={className}
      variants={CONTENEDOR}
      initial="oculto"
      animate={revelado ? 'visible' : 'oculto'}
    >
      {children}
    </motion.div>
  );
}

export function Pieza({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const quieto = useReducedMotion();
  if (quieto) return <div className={className}>{children}</div>;
  return (
    <motion.div data-revelar variants={HIJO} className={className}>
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Tarjeta que se levanta al pasar por encima
   ═══════════════════════════════════════════════════════════ */

/**
 * Elevación mínima —4 px— y sombra que se abre.
 * Con más recorrido parecería un botón de juego; con este, parece papel bueno.
 */
export function TarjetaViva({
  children,
  className = '',
  acento = C.rojo,
}: {
  children: React.ReactNode;
  className?: string;
  /** Color del filete que se enciende arriba. */
  acento?: string;
}) {
  const quieto = useReducedMotion();

  return (
    <motion.div
      className={`group relative overflow-hidden rounded-2xl border p-7 ${className}`}
      style={{ borderColor: C.borde, background: '#fff' }}
      whileHover={quieto ? undefined : { y: -4, boxShadow: '0 18px 44px rgba(15,45,82,.13)' }}
      transition={{ duration: 0.35, ease: SALIDA }}
    >
      {/* Filete superior que se dibuja de izquierda a derecha al acercarse */}
      <span
        className="pointer-events-none absolute left-0 top-0 h-[3px] w-full origin-left scale-x-0 transition-transform duration-500 ease-out group-hover:scale-x-100"
        style={{ background: acento }}
      />
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Cifra que sube hasta su valor
   ═══════════════════════════════════════════════════════════ */

export function Cifra({ hasta, sufijo = '', className = '' }: { hasta: number; sufijo?: string; className?: string }) {
  const quieto = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const aLaVista = useRevelado(ref);
  const [valor, setValor] = useState(quieto ? hasta : 0);

  useEffect(() => {
    if (quieto || !aLaVista) return;
    const duracion = 700;
    const inicio = performance.now();
    let id = 0;
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / duracion);
      // Misma sensación de frenada que el resto
      const suave = 1 - Math.pow(1 - t, 3);
      setValor(Math.round(hasta * suave));
      if (t < 1) id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [aLaVista, hasta, quieto]);

  return (
    <span ref={ref} className={className}>
      {valor}
      {sufijo}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   Línea de progreso de lectura
   ═══════════════════════════════════════════════════════════ */

/**
 * Un hilo rojo finísimo arriba que avanza con el desplazamiento.
 * En una página larga y técnica como esta, saber cuánto queda tranquiliza.
 */
export function HiloDeLectura() {
  const quieto = useReducedMotion();
  const [avance, setAvance] = useState(0);
  const suave = useSpring(avance, { stiffness: 120, damping: 28, restDelta: 0.001 });
  const ancho = useTransform(suave, (v) => `${v * 100}%`);

  useEffect(() => {
    if (quieto) return;
    const alDesplazar = () => {
      const alto = document.documentElement.scrollHeight - window.innerHeight;
      setAvance(alto > 0 ? Math.min(1, window.scrollY / alto) : 0);
    };
    alDesplazar();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    return () => window.removeEventListener('scroll', alDesplazar);
  }, [quieto]);

  if (quieto) return null;

  return (
    <motion.div
      aria-hidden
      className="fixed left-0 top-0 z-[60] h-[2px]"
      style={{ width: ancho, background: C.rojo }}
    />
  );
}
