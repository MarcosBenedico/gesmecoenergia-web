'use client';

/**
 * SI ALGO REVIENTA EN LA FICHA, QUE NO SE QUEDE LA PANTALLA EN NEGRO.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DE DÓNDE SALE ESTO
 *
 * Un cliente de la cartera real abría la ficha y salía «Application error: a
 * client-side exception has occurred» sobre fondo negro. Nada más: ni el
 * nombre del cliente, ni el menú, ni una pista de qué había fallado ni de qué
 * hacer. Desde fuera eso no se distingue de «la aplicación está rota», así que
 * se deja de usar la aplicación entera por un fallo de UNA ficha.
 *
 * Y para arreglarlo desde aquí tampoco servía: el mensaje del navegador no
 * dice qué componente ni qué dato lo provocó, así que hay que ir adivinando
 * cliente por cliente.
 *
 * Esta pantalla arregla las dos cosas:
 *
 *   · SE SIGUE PUDIENDO TRABAJAR. Hay salida a la lista de clientes y a las
 *     pantallas de siempre, y un botón de reintentar que vuelve a montar la
 *     ficha sin recargar la aplicación.
 *   · SE PUEDE ARREGLAR. Enseña el mensaje real y el `digest`, que es lo que
 *     permite encontrar el fallo en vez de reproducirlo a ciegas.
 *
 * NO INTENTA DISIMULAR EL FALLO. Un error escondido detrás de un «vuelve a
 * intentarlo» amable es el mismo silencio que este CRM lleva evitando en todo
 * lo demás: si algo se ha roto, se dice qué y se da con qué arreglarlo.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, RotateCw } from 'lucide-react';

export default function ErrorFichaCliente({
  error, reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // A la consola del navegador entero, no solo el resumen que pinta Next:
  // ahí sale la traza con el componente que lo provocó.
  useEffect(() => { console.error('Ficha de cliente:', error); }, [error]);

  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/gestor/luz/clientes" className="text-[11px] text-muted hover:text-accent inline-flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Clientes
      </Link>

      <div className="rounded-2xl border border-red-500/40 bg-red-500/[0.06] p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h1 className="text-lg font-black text-foreground">Esta ficha no se ha podido pintar</h1>
            <p className="text-sm text-muted mt-1 leading-relaxed">
              Ha fallado algo al mostrarla. <b className="text-foreground">Los datos del cliente están intactos</b>:
              esto es un fallo de la pantalla, no de la base de datos, y no se ha perdido nada.
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap mt-4">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:opacity-90 transition"
          >
            <RotateCw className="w-4 h-4" /> Volver a intentarlo
          </button>
          <Link
            href="/gestor/luz/clientes"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-card/80 text-foreground border border-border/50 text-sm font-semibold hover:bg-card transition"
          >
            Ir a la lista de clientes
          </Link>
        </div>

        {/*
          El mensaje va EN PANTALLA y no solo en la consola. Quien se encuentra
          esto es quien puede contarlo, y «me sale un error» sin el texto obliga
          a reproducirlo a ciegas cliente por cliente.
        */}
        <details className="mt-4 group">
          <summary className="cursor-pointer list-none text-xs font-bold text-muted hover:text-foreground">
            ▸ Qué ha fallado exactamente (para pasárselo a quien lo arregle)
          </summary>
          <pre className="mt-2 p-3 rounded-lg bg-black/30 border border-border/40 text-[11px] text-red-200 whitespace-pre-wrap break-words">
{error.message || 'Sin mensaje.'}{error.digest ? `\n\nReferencia: ${error.digest}` : ''}
          </pre>
        </details>
      </div>
    </div>
  );
}
