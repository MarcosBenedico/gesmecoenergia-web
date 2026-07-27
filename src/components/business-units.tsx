'use client';

import { asesoriaServices, segurosServices, services } from '@/lib/data';
import { ScrollReveal } from './scroll-reveal';

type Area = 'energia' | 'asesoria' | 'seguros';

/**
 * Rejilla de servicios de una de las tres áreas del grupo.
 *
 * Dos cosas cambiaron aquí:
 *
 * · EL COLOR LO PONE EL ÁREA. Antes venía de los datos, y en `data.ts` las tres
 *   áreas tenían escrito el mismo rojo (`from-accent`, `bg-accent/10`,
 *   `border-accent/30`). O sea: pulsabas la pestaña cian de Correbin, o la
 *   naranja de la Asesoría, y las tarjetas seguían saliendo rojas. La pestaña
 *   prometía un color y el contenido daba otro. Ahora la paleta se decide aquí
 *   por área y es imposible que se descuadre.
 * · UNA SOLA RAMA. Había tres bloques `if` casi calcados, así que cualquier
 *   arreglo había que hacerlo tres veces (y por eso se quedaba a medias).
 */

/** Lo único que esta rejilla necesita de un servicio. `services` (energía) no
 *  trae emoji propio y usa el del área. */
type Servicio = { title: string; summary: string; items: readonly string[]; icon?: string };

type Paleta = {
  datos: readonly Servicio[];
  icono: string;
  degradado: string;
  fondo: string;
  borde: string;
  punto: string;
};

const AREAS: Record<Area, Paleta> = {
  energia: {
    datos: services,
    icono: '⚡',
    degradado: 'from-accent to-accent-light',
    fondo: 'bg-accent/[0.07]',
    borde: 'border-accent/30',
    punto: 'from-accent to-accent-light',
  },
  asesoria: {
    datos: asesoriaServices,
    icono: '📋',
    degradado: 'from-tertiary to-amber',
    fondo: 'bg-tertiary/[0.07]',
    borde: 'border-tertiary/30',
    punto: 'from-tertiary to-amber',
  },
  seguros: {
    datos: segurosServices,
    icono: '🛡️',
    degradado: 'from-secondary to-cyan-400',
    fondo: 'bg-secondary/[0.07]',
    borde: 'border-secondary/30',
    punto: 'from-secondary to-cyan-400',
  },
};

function TarjetaServicio({
  titulo,
  icono,
  resumen,
  puntos,
  area,
}: {
  titulo: string;
  icono: string;
  resumen: string;
  puntos: readonly string[];
  area: Paleta;
}) {
  return (
    <div
      className={`foco borde-vivo group relative h-full overflow-hidden rounded-2xl border ${area.borde} ${area.fondo} p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg`}
    >
      {/* Filete superior que se pinta de izquierda a derecha al pasar por encima. */}
      <div
        className={`absolute left-0 right-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r ${area.degradado} transition-transform duration-500 group-hover:scale-x-100`}
      />

      <div className="relative mb-4">
        <div className="mb-2 text-3xl transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:scale-110">
          {icono}
        </div>
        <h3 className="text-lg font-bold text-foreground">{titulo}</h3>
        <p className="mt-1 text-sm text-muted">{resumen}</p>
      </div>

      <ul className="relative space-y-2 text-sm">
        {puntos.map((p) => (
          <li key={p} className="group/item flex items-start gap-2 text-muted">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br ${area.punto}`} />
            <span className="transition-colors group-hover/item:text-foreground">{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BusinessUnits({ selectedTab = 'energia' }: { selectedTab?: Area }) {
  const area = AREAS[selectedTab];
  // En energía solo se muestran los cuatro primeros, como estaba.
  const lista = selectedTab === 'energia' ? area.datos.slice(0, 4) : area.datos;

  return (
    <div className="mx-auto max-w-7xl px-6">
      {/* La `key` con el área es lo que hace que al cambiar de pestaña las
          tarjetas se vuelvan a montar y por tanto se vuelvan a revelar. Sin
          ella React reutilizaba los mismos nodos y el contenido cambiaba de
          golpe mientras la cabecera sí se desvanecía: dos ritmos a la vez. */}
      <div key={selectedTab} className="grid gap-5 md:grid-cols-2">
        {lista.map((servicio, i) => (
          <ScrollReveal key={servicio.title} delay={i * 90} direction={i % 2 === 0 ? 'left' : 'right'}>
            <TarjetaServicio
              titulo={servicio.title}
              icono={servicio.icon || area.icono}
              resumen={servicio.summary}
              puntos={servicio.items}
              area={area}
            />
          </ScrollReveal>
        ))}
      </div>
    </div>
  );
}
