'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

/**
 * Consejo de una línea en la cabecera de una pantalla, con enlace a la Guía rápida.
 * Se puede descartar y no vuelve a aparecer (se recuerda por pantalla en este navegador).
 */
export function Consejo({ clave, children }: { clave: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(localStorage.getItem(`consejo_${clave}`) !== 'oculto');
  }, [clave]);

  if (!visible) return null;

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-secondary/25 bg-secondary/5 px-3 py-2 text-xs text-muted">
      <span className="shrink-0">💡</span>
      <p className="flex-1 leading-snug">
        {children}{' '}
        <Link href="/gestor/luz/guia" className="font-bold text-secondary hover:underline whitespace-nowrap">Ver guía rápida →</Link>
      </p>
      <button
        onClick={() => { localStorage.setItem(`consejo_${clave}`, 'oculto'); setVisible(false); }}
        className="shrink-0 text-muted/60 hover:text-foreground transition"
        title="Entendido, no volver a mostrar"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
