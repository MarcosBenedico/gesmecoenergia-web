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
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Plus, Zap, UserPlus, MapPin, X } from 'lucide-react';
import { useUsuario } from '@/lib/usuario';
import { VisitaRapida } from './visita-rapida';

const OPCIONES = [
  /*
   * «REGISTRAR VISITA» VA LA PRIMERA, y no es un capricho de orden.
   *
   * La auditoría midió CERO visitas registradas en 30 días. La hoja para
   * hacerlo existía y estaba bien hecha, pero solo se llegaba desde Mi Día >
   * Por zona y exigía que el cliente estuviera YA en la ruta del día — o sea,
   * que era imposible apuntar la mitad de las visitas reales, las que salen
   * de pasar por delante.
   *
   * Es además el dato que más cosas desbloquea: mueve el embudo, programa la
   * siguiente pasada y, si el cliente da la factura, arranca el estudio.
   */
  {
    accion: 'visita' as const,
    icono: MapPin,
    titulo: 'Registrar visita',
    pista: 'Cuatro botones, sin escribir nada',
  },
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
  const [visitando, setVisitando] = useState(false);
  const { perfil } = useUsuario();
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
      {/*
        LA HOJA SALE POR PORTAL A `body`, no aquí dentro.

        Este contenedor es `fixed z-40`, y eso crea un contexto de apilado: todo
        lo que se pinte dentro queda encajonado en el nivel 40 por muy alto que
        sea su propio z-index. La hoja de la visita acabaría por debajo de la
        cabecera pegajosa y del panel del móvil — y se vería como una hoja a
        medio tapar, que es de los fallos que solo aparecen en el teléfono y
        justo cuando hace falta. Es el mismo patrón que ya usa el menú móvil.
      */}
      {visitando && typeof document !== 'undefined'
        ? createPortal(
          <VisitaRapida
            responsable={perfil?.responsable || perfil?.nombre || null}
            onCerrar={() => setVisitando(false)}
          />,
          document.body,
        )
        : null}

      {abierto && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden w-[16.5rem]">
          {OPCIONES.map((o) => {
            const Icono = o.icono;
            const contenido = (
              <>
                <Icono className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-foreground leading-tight">{o.titulo}</span>
                  <span className="block text-[11px] text-muted leading-snug">{o.pista}</span>
                </span>
              </>
            );
            // 48 px de alto mínimo: esto se toca de pie y con una mano.
            const clase = 'w-full min-h-12 flex items-start gap-3 px-3.5 py-3 text-left hover:bg-accent/10 transition border-b border-border/40 last:border-0';

            // La visita abre una hoja aquí mismo; las otras dos navegan. Si la
            // visita también navegara, se perdería la pantalla que se estaba
            // mirando — y eso es la mitad del motivo de que no se registraran.
            return o.accion === 'visita' ? (
              <button
                key={o.titulo}
                onClick={() => { setAbierto(false); setVisitando(true); }}
                className={clase}
              >
                {contenido}
              </button>
            ) : (
              <Link key={o.href} href={o.href!} onClick={() => setAbierto(false)} className={clase}>
                {contenido}
              </Link>
            );
          })}
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
