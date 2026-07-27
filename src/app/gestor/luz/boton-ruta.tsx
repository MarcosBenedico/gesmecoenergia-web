'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MapPin, Check } from 'lucide-react';
import { LuzCliente } from '@/lib/luz';
import { guardarLuz } from './ui';
import { anadirARutaDia, leerRutaDia, quitarDeRutaDia } from './rutas/ruta-dia';

/**
 * "A la ruta" — mete al cliente en la ruta del día sin salir de donde estás.
 *
 * La ruta del día vive en el navegador (es una selección de trabajo, no un dato
 * de negocio), así que basta con escribirla y avisar: al abrir Rutas ya está.
 *
 * Si el cliente no tiene dirección, se pide aquí mismo y se guarda en su ficha
 * — sin dirección no puede entrar en ninguna ruta, y hacerle volver a la ficha
 * para eso es la clase de rodeo que hace que se deje a medias.
 */
export function BotonRuta({ cliente, tareaId, tareaDesc, compacto }: {
  cliente: Pick<LuzCliente, 'id' | 'nombre' | 'direccion_fiscal'>;
  tareaId?: string;
  tareaDesc?: string;
  /** Solo el icono, para listas apretadas. */
  compacto?: boolean;
  }) {
  const idParada = `c-${cliente.id}`;
  const [enRuta, setEnRuta] = useState(() => leerRutaDia().some((p) => p.id === idParada));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function alPulsar(e: React.MouseEvent) {
    // Estos botones suelen vivir dentro de una tarjeta que es un enlace
    e.preventDefault();
    e.stopPropagation();

    if (enRuta) { quitarDeRutaDia(idParada); setEnRuta(false); return; }

    let dir = cliente.direccion_fiscal?.trim() || '';
    if (!dir) {
      const v = window.prompt(
        `«${cliente.nombre}» no tiene ubicación.\n\nPega su dirección o un enlace de Google Maps y quedará guardada en su ficha:`
      );
      if (!v?.trim()) return;
      dir = v.trim();
      setGuardando(true);
      const err = await guardarLuz('clientes', 'PUT', { id: cliente.id, direccion_fiscal: dir });
      setGuardando(false);
      if (err) { setError(err); return; }
    }

    anadirARutaDia({ id: idParada, nombre: cliente.nombre, direccion: dir, cliente_id: cliente.id, tarea_id: tareaId, tarea_desc: tareaDesc });
    setError('');
    setEnRuta(true);
  }

  if (enRuta) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          onClick={alPulsar}
          title="Quitar de la ruta del día"
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 text-[11px] font-bold hover:bg-emerald-500/25 transition"
        >
          <Check className="w-3.5 h-3.5" />
          {!compacto && 'En la ruta'}
        </button>
        <Link href="/gestor/luz/rutas" onClick={(e) => e.stopPropagation()}
          className="text-[10px] font-bold text-emerald-400 hover:underline">ver →</Link>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        onClick={alPulsar}
        disabled={guardando}
        title="Añadir a la ruta del día"
        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-border/50 bg-card/80 text-[11px] font-bold text-muted hover:text-foreground hover:border-accent/50 transition disabled:opacity-50"
      >
        <MapPin className="w-3.5 h-3.5" />
        {!compacto && (guardando ? 'Guardando…' : 'A la ruta')}
      </button>
      {error && <span className="text-[10px] text-red-400">{error}</span>}
    </span>
  );
}
