'use client';

import { useEffect, useRef } from 'react';

/**
 * Fondo animado del escaparate: un campo de puntos que derivan despacio y se
 * enlazan con sus vecinos. Se ve en toda la web pública, detrás del contenido.
 *
 * Esto estaba escrito y funcionando, pero medido tenía cinco problemas serios y
 * conviene dejar constancia de cada uno para que no vuelvan:
 *
 * · COLOR. Pintaba índigo (#6366f1 los puntos, #1e1b4b el fondo) sobre un
 *   lienzo OPACO a pantalla completa. O sea: tapaba el degradado de marca del
 *   `body` y el sitio entero se veía morado en una casa de rojo y cian. El
 *   degradado estaba escrito dos veces, en CSS y en JavaScript, que es
 *   justamente cómo se descuadró.
 * · FUGA. El `requestAnimationFrame` no se cancelaba al desmontar: solo se
 *   quitaban los escuchadores. Cada vuelta por la web dejaba atrás un bucle
 *   pintando a 60 fps para siempre.
 * · COSTE. Comparaba los 50 puntos contra los 50 (2.500 medidas por
 *   fotograma), contaba cada pareja dos veces y hacía un `stroke()` por
 *   enlace. Ahora las parejas se miran una sola vez con una rejilla de
 *   casillas y los enlaces se agrupan por tramo de opacidad para dibujarlos
 *   en un puñado de trazos.
 * · NITIDEZ. No miraba el `devicePixelRatio`, así que en cualquier pantalla
 *   moderna los puntos salían borrosos.
 * · Y no paraba con la pestaña oculta, ni atendía a «reducir movimiento».
 *
 * Ahora el lienzo es TRANSPARENTE: el degradado de marca lo pone el `body` en
 * `globals.css` y aquí solo se dibujan los puntos. Una sola fuente de verdad
 * para el color de fondo.
 */

/** Distancia a la que dos puntos se enlazan, en píxeles CSS. */
const ENLACE = 145;
/** Un punto por cada tanta superficie, con techo para no pasarse en 4K. */
const AREA_POR_PUNTO = 30000;
const MAX_PUNTOS = 46;
/** Tramos de opacidad en los que se agrupan los enlaces para dibujarlos. */
const TRAMOS = 5;

type Punto = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Profundidad: 0 = al fondo, 1 = al frente. Escala tamaño y opacidad. */
  z: number;
  r: number;
  /** 0 = cian, 1 = rojo de marca. Casi todos cian; el rojo es el acento. */
  tono: number;
};

export function Background3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Las funciones de más abajo son declaraciones (se izan al principio del
    // ámbito), así que TypeScript no les pasa el estrechamiento de tipo que se
    // hace aquí: para él podrían ejecutarse antes del `if`. Se reasigna a dos
    // constantes ya tipadas como no nulas y así vale dentro y fuera.
    const posibleLienzo = canvasRef.current;
    const posibleCtx = posibleLienzo?.getContext('2d');
    if (!posibleLienzo || !posibleCtx) return;
    const lienzo: HTMLCanvasElement = posibleLienzo;
    const ctx: CanvasRenderingContext2D = posibleCtx;

    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const conRaton = window.matchMedia('(pointer: fine)').matches;

    let w = 0;
    let h = 0;
    const puntos: Punto[] = [];

    // La rejilla de casillas se reserva al medir y se reutiliza en cada
    // fotograma: crearla 60 veces por segundo es basura para el recolector.
    let cols = 1;
    let filas = 1;
    let casillas: number[][] = [];

    /** Ratón en píxeles CSS. Fuera de pantalla hasta que se mueva. */
    let rx = -9999;
    let ry = -9999;

    function nuevoPunto(): Punto {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        z: Math.random(),
        r: Math.random() * 1.6 + 0.9,
        tono: Math.random() < 0.22 ? 1 : 0,
      };
    }

    function medir() {
      // El ratio se limita a 2: por encima no se nota y el coste de pintado
      // sube con el cuadrado.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      lienzo.width = Math.round(w * dpr);
      lienzo.height = Math.round(h * dpr);
      lienzo.style.width = `${w}px`;
      lienzo.style.height = `${h}px`;
      // Con el transform se dibuja siempre en píxeles CSS y el ratio deja de
      // aparecer en el resto del código.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const objetivo = Math.max(14, Math.min(MAX_PUNTOS, Math.round((w * h) / AREA_POR_PUNTO)));
      if (puntos.length > objetivo) {
        puntos.length = objetivo;
      } else {
        while (puntos.length < objetivo) puntos.push(nuevoPunto());
      }

      cols = Math.max(1, Math.ceil(w / ENLACE));
      filas = Math.max(1, Math.ceil(h / ENLACE));
      casillas = Array.from({ length: cols * filas }, () => []);
    }

    function mover() {
      for (const p of puntos) {
        p.x += p.vx;
        p.y += p.vy;
        // Deriva hacia el frente: da sensación de profundidad sin mover la
        // cámara. Al llegar delante, el punto renace al fondo en otro sitio.
        p.z += 0.0009;
        if (p.z > 1) {
          p.z = 0;
          p.x = Math.random() * w;
          p.y = Math.random() * h;
        }
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;
      }
    }

    /** Enlaces: cada pareja una sola vez, buscando solo en casillas vecinas. */
    function dibujarEnlaces() {
      for (const c of casillas) c.length = 0;

      for (let i = 0; i < puntos.length; i++) {
        const p = puntos[i];
        const cx = Math.min(cols - 1, Math.max(0, Math.floor(p.x / ENLACE)));
        const cy = Math.min(filas - 1, Math.max(0, Math.floor(p.y / ENLACE)));
        casillas[cy * cols + cx].push(i);
      }

      // Un camino por tramo de opacidad: así todos los enlaces parecidos se
      // pintan con un solo stroke() en vez de uno por enlace.
      const caminos: Path2D[] = Array.from({ length: TRAMOS }, () => new Path2D());
      let hay = false;

      for (let cy = 0; cy < filas; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          const aqui = casillas[cy * cols + cx];
          if (!aqui.length) continue;

          // Solo mitad del vecindario (derecha y abajo): así cada pareja de
          // casillas se visita una vez y no dos.
          const vecinas = [
            [cx, cy],
            [cx + 1, cy],
            [cx - 1, cy + 1],
            [cx, cy + 1],
            [cx + 1, cy + 1],
          ];

          for (const [vx, vy] of vecinas) {
            if (vx < 0 || vy < 0 || vx >= cols || vy >= filas) continue;
            const alla = casillas[vy * cols + vx];
            if (!alla.length) continue;
            const misma = vx === cx && vy === cy;

            for (let a = 0; a < aqui.length; a++) {
              // En la propia casilla se empieza en a+1 para no repetir pareja.
              for (let b = misma ? a + 1 : 0; b < alla.length; b++) {
                const p = puntos[aqui[a]];
                const q = puntos[alla[b]];
                const dx = q.x - p.x;
                const dy = q.y - p.y;
                const d2 = dx * dx + dy * dy;
                if (d2 > ENLACE * ENLACE) continue;

                const cerca = 1 - Math.sqrt(d2) / ENLACE;
                const tramo = Math.min(TRAMOS - 1, Math.floor(cerca * TRAMOS));
                caminos[tramo].moveTo(p.x, p.y);
                caminos[tramo].lineTo(q.x, q.y);
                hay = true;
              }
            }
          }
        }
      }

      if (!hay) return;
      ctx.lineWidth = 1;
      for (let t = 0; t < TRAMOS; t++) {
        // El tramo 0 es el enlace más largo y por tanto el más tenue.
        const alfa = ((t + 0.5) / TRAMOS) * 0.16;
        ctx.strokeStyle = `rgba(120, 190, 225, ${alfa.toFixed(3)})`;
        ctx.stroke(caminos[t]);
      }
    }

    function dibujarPuntos() {
      for (const p of puntos) {
        const escala = 0.35 + p.z * 0.65;
        const alfa = (0.2 + p.z * 0.5) * (p.tono ? 0.9 : 1);
        const color = p.tono ? '255, 71, 71' : '90, 200, 235';
        ctx.fillStyle = `rgba(${color}, ${alfa.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * escala, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function dibujarFocoRaton() {
      if (rx < -1000) return;
      const g = ctx.createRadialGradient(rx, ry, 0, rx, ry, 320);
      g.addColorStop(0, 'rgba(255, 51, 51, 0.055)');
      g.addColorStop(0.55, 'rgba(0, 212, 255, 0.022)');
      g.addColorStop(1, 'rgba(0, 212, 255, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(rx - 320, ry - 320, 640, 640);
    }

    function pintar() {
      // clearRect y no fillRect: el lienzo es transparente y el degradado de
      // marca lo pone el body. Además se ahorra un relleno a pantalla completa.
      ctx.clearRect(0, 0, w, h);
      dibujarFocoRaton();
      dibujarEnlaces();
      dibujarPuntos();
    }

    medir();

    if (quieto) {
      // Un solo fotograma: se ve la textura, no se mueve nada.
      pintar();
      return;
    }

    let bucle = 0;
    function fotograma() {
      mover();
      pintar();
      bucle = requestAnimationFrame(fotograma);
    }
    bucle = requestAnimationFrame(fotograma);

    function alCambiarVisibilidad() {
      cancelAnimationFrame(bucle);
      // Con la pestaña de fondo el navegador ya frena el rAF, pero al volver
      // hay que asegurarse de no dejar dos bucles vivos.
      if (!document.hidden) bucle = requestAnimationFrame(fotograma);
    }

    let temporizador = 0;
    function alRedimensionar() {
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(medir, 150);
    }

    function alMover(e: PointerEvent) {
      rx = e.clientX;
      ry = e.clientY;
    }

    window.addEventListener('resize', alRedimensionar);
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    if (conRaton) window.addEventListener('pointermove', alMover, { passive: true });

    return () => {
      cancelAnimationFrame(bucle);
      window.clearTimeout(temporizador);
      window.removeEventListener('resize', alRedimensionar);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      window.removeEventListener('pointermove', alMover);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-0 h-full w-full"
    />
  );
}
