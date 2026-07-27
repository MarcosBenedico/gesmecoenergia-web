/**
 * LOS DÍAS DE RUTA DE DAVID, DISEÑADOS DE ANTEMANO.
 *
 * El problema no era la lista de clientes: era que cada mañana había que decidir
 * dónde ir. Y decidir cuesta, así que los días sin decisión tomada se iban en
 * llamadas y papeleo. Los números lo dicen: con ruta preparada, 9 visitas; sin
 * ella, 0,7.
 *
 * Esto quita la decisión de en medio. Cada día de calle tiene su zona asignada
 * de antemano, y David solo tiene que abrir Mi Día y salir.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ UNA ROTACIÓN DE TRES SEMANAS
 *
 * La comarca no es homogénea. Desde Binéfar hay zonas a 10 km y zonas a 35, y
 * tratarlas igual es el error clásico: o no se pisa nunca lo lejano, o se
 * malgastan mañanas conduciendo.
 *
 * Con un ciclo de tres semanas y tres días de calle salen nueve salidas, y da
 * para que **lo cercano y denso se pise dos veces por ciclo y lo lejano una**.
 * Así ninguna zona queda huérfana y ninguna mañana se va en carretera.
 *
 * Y los objetivos de puertas NO son iguales cada día, porque el tiempo útil no
 * es igual: un día lejano se come casi hora y media en desplazamientos.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Todo esto es ORIENTATIVO y está pensado para cambiarse: si una semana hay tres
 * firmas en Fraga, se va a Fraga y ya está. El plan existe para que no haya que
 * pensar los días normales, no para atarse los días raros.
 */

import { ZONAS, type Zona } from './zonas.ts';

/** Jornada real de la casa: de 8 a 15, sin tardes. */
export const HORA_ENTRADA = '08:00';
export const HORA_SALIDA = '15:00';

/** De dónde sale la furgoneta. */
export const ORIGEN_RUTAS = 'Av. de Aragon, 50, 22500 Binéfar, Huesca';

export type TipoDia = 'cerca' | 'media' | 'lejos' | 'oficina' | 'descanso';

export interface ObjetivosDia {
  /** Puertas nuevas. Cambia según lo que se coma la carretera. */
  puertas: number;
  /** Facturas que se intentan traer. */
  facturas: number;
  /** Cubiertas buenas para pasarle a Óscar. */
  cubiertas: number;
}

/**
 * Cuánto cabe según lo lejos que se vaya.
 *
 * Un día cercano deja casi seis horas de puerta; uno lejano, cuatro, porque se
 * van 45 minutos de ida y otros 45 de vuelta. Poner el mismo número en los dos
 * es la forma más rápida de que el plan deje de creerse.
 */
export const OBJETIVOS: Record<TipoDia, ObjetivosDia> = {
  cerca:    { puertas: 10, facturas: 3, cubiertas: 1 },
  media:    { puertas: 9,  facturas: 3, cubiertas: 2 },
  lejos:    { puertas: 7,  facturas: 2, cubiertas: 3 },
  oficina:  { puertas: 0,  facturas: 0, cubiertas: 0 },
  descanso: { puertas: 0,  facturas: 0, cubiertas: 0 },
};

export interface DiaPlan {
  /** 1 = lunes … 5 = viernes. */
  diaSemana: number;
  nombre: string;
  tipo: TipoDia;
  /** id de `ZONAS`. null en los días de oficina. */
  zonaId: string | null;
  /** Franja de calle de ese día. */
  franja: string;
  /** Qué se hace ese día, en una frase. */
  que: string;
  /** Por qué está puesto así. */
  porque: string;
  objetivos: ObjetivosDia;
}

const LUNES: DiaPlan = {
  diaSemana: 1, nombre: 'Lunes', tipo: 'oficina', zonaId: null,
  franja: '08:00 – 15:00',
  que: 'Teléfono y preparar la semana',
  porque: 'Las tres rutas ya están puestas: se llama a los «vuelve a pasar» y se pide cita a los que solo abren por la tarde.',
  objetivos: OBJETIVOS.oficina,
};

/**
 * El fin de semana no es un día de trabajo, y la pantalla no debe decir lo
 * contrario. Antes el sábado y el domingo heredaban el plan del viernes y
 * salía «cerrar y firmar» en domingo, que además de absurdo le quita
 * credibilidad a todo lo demás que diga esta pantalla.
 */
const FIN_DE_SEMANA: DiaPlan = {
  diaSemana: 6, nombre: 'Fin de semana', tipo: 'descanso', zonaId: null,
  franja: '—',
  que: 'Hoy no toca',
  porque: 'Fin de semana. La jornada es de lunes a viernes, de 8 a 15, y eso lo respeta también el jefe.',
  objetivos: OBJETIVOS.descanso,
};

const VIERNES: DiaPlan = {
  diaSemana: 5, nombre: 'Viernes', tipo: 'oficina', zonaId: null,
  franja: '08:00 – 15:00',
  que: 'Cerrar y firmar',
  porque: 'El viernes la gente quiere quitarse cosas de encima antes del fin de semana. No se prospecta: se pide el sí.',
  objetivos: OBJETIVOS.oficina,
};

/**
 * La rotación. Tres semanas (A, B, C) por tres días de calle.
 *
 * El martes es la zona densa y cercana, para arrancar la semana con muchas
 * puertas. El miércoles es el día largo, que es cuando mejor se aguanta
 * conducir. Y el jueves se vuelve a zona media y cerca de casa, para poder
 * atender una firma por la tarde si sale.
 */
const ROTACION: { zonaId: string; tipo: TipoDia; foco: string }[][] = [
  // ── Semana A ──
  [
    { zonaId: 'binefar', tipo: 'cerca', foco: 'Polígono de Binéfar: naves y talleres, puerta a puerta.' },
    { zonaId: 'alfarras-almacelles', tipo: 'lejos', foco: 'Segrià Nord: explotaciones grandes de regadío.' },
    { zonaId: 'tamarite-alcampell', tipo: 'media', foco: 'Tamarite y Altorricón: comercio y granjas.' },
  ],
  // ── Semana B ──
  [
    { zonaId: 'tamarite-alcampell', tipo: 'cerca', foco: 'Tamarite casco y polígono: es la segunda concentración de la cartera.' },
    { zonaId: 'alcarras-fraga', tipo: 'lejos', foco: 'Bajo Cinca: fruta y almacenes. Día completo, se almuerza allí.' },
    { zonaId: 'esplus-osso', tipo: 'media', foco: 'Ribera del Cinca: granjas de porcino y riego.' },
  ],
  // ── Semana C ──
  [
    { zonaId: 'binefar', tipo: 'cerca', foco: 'Binéfar: repasar lo que quedó pendiente del ciclo y comercio del centro.' },
    { zonaId: 'binaced-monzon', tipo: 'lejos', foco: 'Cinca Medio: industria de Monzón y granjas de Binaced.' },
    { zonaId: 'san-esteban-estadilla', tipo: 'media', foco: 'Litera Alta: pueblos pequeños, ganadería y almazaras.' },
  ],
];

export const SEMANAS_CICLO = ROTACION.length;
/** Martes, miércoles y jueves. Los que rinden. */
export const DIAS_DE_CALLE = [2, 3, 4];
const NOMBRE_DIA = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Semana ISO, para que el ciclo avance solo sin que nadie lo lleve a mano. */
export function semanaISO(f: Date): number {
  const d = new Date(Date.UTC(f.getFullYear(), f.getMonth(), f.getDate()));
  const dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  const inicio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - inicio.getTime()) / 86400000 + 1) / 7);
}

/** A, B o C. */
export function letraCiclo(f: Date): string {
  return ['A', 'B', 'C'][semanaISO(f) % SEMANAS_CICLO];
}

const zonaDe = (id: string): Zona | undefined => ZONAS.find((z) => z.id === id);

/** El plan de un día concreto. */
export function planDelDia(f: Date): DiaPlan {
  const dow = f.getDay() === 0 ? 7 : f.getDay();
  if (dow >= 6) return { ...FIN_DE_SEMANA, diaSemana: dow, nombre: NOMBRE_DIA[dow] };
  if (dow === 1) return LUNES;
  if (dow === 5) return VIERNES;

  const semana = ROTACION[semanaISO(f) % SEMANAS_CICLO];
  const paso = semana[DIAS_DE_CALLE.indexOf(dow)];
  const z = zonaDe(paso.zonaId);

  return {
    diaSemana: dow,
    nombre: NOMBRE_DIA[dow],
    tipo: paso.tipo,
    zonaId: paso.zonaId,
    franja: paso.tipo === 'lejos' ? '08:00 – 14:00 (se almuerza allí)' : '08:15 – 14:00',
    que: `Calle en ${z?.nombre || paso.zonaId}`,
    porque: paso.foco,
    objetivos: OBJETIVOS[paso.tipo],
  };
}

/** Los cinco días laborables de la semana de esa fecha. */
export function planDeLaSemana(f: Date): DiaPlan[] {
  const lunes = new Date(f);
  const dow = lunes.getDay() === 0 ? 7 : lunes.getDay();
  lunes.setDate(lunes.getDate() - (dow - 1));
  return [0, 1, 2, 3, 4].map((n) => {
    const d = new Date(lunes);
    d.setDate(d.getDate() + n);
    return planDelDia(d);
  });
}

/** El ciclo completo, para verlo de un tirón o imprimirlo. */
export function cicloCompleto(): { semana: string; dias: DiaPlan[] }[] {
  // Se ancla en un lunes conocido de cada letra para que salga estable
  const base = new Date(2026, 6, 27); // lunes 27 de julio de 2026
  return ['A', 'B', 'C'].map((_, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + i * 7);
    return { semana: letraCiclo(d), dias: planDeLaSemana(d) };
  });
}

export const esDiaDeCalle = (f: Date) => DIAS_DE_CALLE.includes(f.getDay() === 0 ? 7 : f.getDay());

/** Objetivo semanal, sumando los tres días de calle de esa semana. */
export function objetivoSemanal(f: Date): ObjetivosDia {
  return planDeLaSemana(f).reduce(
    (s, d) => ({
      puertas: s.puertas + d.objetivos.puertas,
      facturas: s.facturas + d.objetivos.facturas,
      cubiertas: s.cubiertas + d.objetivos.cubiertas,
    }),
    { puertas: 0, facturas: 0, cubiertas: 0 }
  );
}

/** ¿Este pueblo es de la zona que toca hoy? Para resaltar en las listas. */
export function esDeLaZonaDeHoy(zonaIdItem: string | null | undefined, f = new Date()): boolean {
  const p = planDelDia(f);
  return !!p.zonaId && p.zonaId === zonaIdItem;
}
