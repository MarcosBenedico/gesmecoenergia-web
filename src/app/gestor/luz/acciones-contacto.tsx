'use client';

import { Phone, MessageCircle, Navigation } from 'lucide-react';

/**
 * ACCIONES DE UN TOQUE — llamar, WhatsApp y cómo llegar.
 *
 * Antes el teléfono era texto plano: quien estaba en la calle tenía que
 * memorizarlo o copiarlo a mano para marcar, y la dirección no llevaba a
 * ningún sitio. Son tres enlaces que no cuestan nada y se usan en cada visita.
 *
 * Pensado para el móvil: botones grandes, separados, y que no arrastren el
 * clic al enlace que haya debajo (por eso paran la propagación).
 */

/** Teléfono en formato marcable. Los fijos y móviles españoles van con +34. */
export function normalizarTelefono(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const limpio = tel.replace(/[\s.\-()]/g, '');
  if (!limpio) return null;
  if (limpio.startsWith('+')) return limpio;
  if (limpio.startsWith('00')) return `+${limpio.slice(2)}`;
  // 9 dígitos empezando por 6/7 (móvil) u 8/9 (fijo) → número español
  if (/^[6789]\d{8}$/.test(limpio)) return `+34${limpio}`;
  return limpio;
}

/**
 * Enlace de navegación. Si lo que hay guardado ya es un enlace de mapas
 * (lo normal cuando se pega la ubicación de WhatsApp), se usa tal cual;
 * si es una dirección escrita, se construye la ruta.
 */
export function enlaceMapa(ubicacion: string | null | undefined): string | null {
  const u = (ubicacion || '').trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(u)}`;
}

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border font-bold transition active:scale-95';

const TONOS = {
  llamar: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20',
  whatsapp: 'bg-secondary/10 text-secondary border-secondary/30 hover:bg-secondary/20',
  mapa: 'bg-accent/10 text-accent border-accent/30 hover:bg-accent/20',
};

export function AccionesContacto({ telefono, ubicacion, nombre, compacto = false }: {
  telefono?: string | null;
  ubicacion?: string | null;
  nombre?: string | null;
  /** compacto = solo iconos, para las tarjetas de Mi Día */
  compacto?: boolean;
}) {
  const tel = normalizarTelefono(telefono);
  const mapa = enlaceMapa(ubicacion);
  if (!tel && !mapa) return null;

  // Alto generoso: se pulsa con el dedo, muchas veces dentro de un coche
  const tam = compacto ? 'h-9 w-9' : 'h-9 px-3 text-xs';
  const icono = compacto ? 'w-4 h-4' : 'w-3.5 h-3.5';

  // Mensaje de WhatsApp ya empezado: quien lo recibe sabe quién escribe
  const saludo = encodeURIComponent(
    `Hola${nombre ? ` ${nombre}` : ''}, le escribo de Gesmeco Energía.`
  );

  /** Un enlace externo dentro de una tarjeta que ya es enlace: hay que aislarlo. */
  const parar = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="flex items-center gap-1.5" onClick={parar}>
      {tel && (
        <a href={`tel:${tel}`} onClick={parar} title={`Llamar a ${telefono}`} aria-label="Llamar"
          className={`${BASE} ${TONOS.llamar} ${tam}`}>
          <Phone className={icono} />{!compacto && 'Llamar'}
        </a>
      )}
      {tel && (
        <a href={`https://wa.me/${tel.replace('+', '')}?text=${saludo}`}
          target="_blank" rel="noopener noreferrer" onClick={parar}
          title="Escribir por WhatsApp" aria-label="WhatsApp"
          className={`${BASE} ${TONOS.whatsapp} ${tam}`}>
          <MessageCircle className={icono} />{!compacto && 'WhatsApp'}
        </a>
      )}
      {mapa && (
        <a href={mapa} target="_blank" rel="noopener noreferrer" onClick={parar}
          title="Abrir la navegación hasta aquí" aria-label="Cómo llegar"
          className={`${BASE} ${TONOS.mapa} ${tam}`}>
          <Navigation className={icono} />{!compacto && 'Cómo llegar'}
        </a>
      )}
    </div>
  );
}
