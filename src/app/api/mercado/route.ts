import { NextRequest, NextResponse } from 'next/server';

/**
 * PRECIO DE LA LUZ — datos de mercado para el panel de dirección.
 *
 * Se piden desde el servidor (no desde el navegador) por dos motivos: ni OMIE
 * ni REE permiten peticiones desde otro dominio, y así se puede cachear una
 * vez para todos en vez de machacar sus servidores en cada recarga.
 *
 * Fuentes, ambas públicas y sin clave:
 *  · OMIE  — precio marginal horario del mercado diario (el mayorista real).
 *            Es el que marca lo que pagan las comercializadoras.
 *  · REE   — PVPC horario (lo que paga un consumidor en tarifa regulada).
 *
 * OMIP (futuros a meses/años vista) NO tiene API pública gratuita: sus curvas
 * son producto de suscripción. Por eso aquí no aparece: prefiero no enseñar un
 * dato inventado en una pantalla que se usa para decidir.
 */

export const revalidate = 1800; // media hora: los precios se publican una vez al día

/** Una hora del día con su precio en €/MWh. */
export interface HoraMercado { hora: number; omie: number | null; pvpc: number | null }

const dosDigitos = (n: number) => String(n).padStart(2, '0');
const aISO = (d: Date) => `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;

/**
 * Fichero público de OMIE: una línea por hora con
 * `año;mes;día;hora;precio_portugal;precio_españa;`
 * Devuelve €/MWh por hora (índice 0 = 00:00).
 */
async function precioOmie(fecha: Date): Promise<(number | null)[]> {
  const nombre = `marginalpdbc_${fecha.getFullYear()}${dosDigitos(fecha.getMonth() + 1)}${dosDigitos(fecha.getDate())}.1`;
  const url = `https://www.omie.es/es/file-download?parents%5B0%5D=marginalpdbc&filename=${nombre}`;
  const res = await fetch(url, { redirect: 'follow', next: { revalidate } });
  if (!res.ok) throw new Error(`OMIE respondió ${res.status}`);

  const texto = await res.text();
  const horas: (number | null)[] = Array(24).fill(null);
  for (const linea of texto.split('\n')) {
    const p = linea.trim().split(';');
    if (p.length < 6) continue;
    const hora = parseInt(p[3], 10);
    const precioEspana = parseFloat(p[5]);
    // OMIE numera las horas de 1 a 24 (25 en el cambio de hora de octubre)
    if (Number.isFinite(hora) && hora >= 1 && hora <= 24 && Number.isFinite(precioEspana)) {
      horas[hora - 1] = precioEspana;
    }
  }
  return horas;
}

/** PVPC horario de REE (lo que paga el consumidor en tarifa regulada), €/MWh. */
async function precioPvpc(fecha: Date): Promise<(number | null)[]> {
  const dia = aISO(fecha);
  const url = `https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real`
    + `?start_date=${dia}T00:00&end_date=${dia}T23:59&time_trunc=hour`;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate } });
  if (!res.ok) throw new Error(`REE respondió ${res.status}`);

  const json = await res.json();
  const serie = (json?.included || []).find((s: { type?: string }) => s.type === 'PVPC') || json?.included?.[0];
  const horas: (number | null)[] = Array(24).fill(null);
  for (const v of serie?.attributes?.values || []) {
    const h = new Date(v.datetime).getHours();
    if (h >= 0 && h < 24 && Number.isFinite(v.value)) horas[h] = v.value;
  }
  return horas;
}

const media = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 100) / 100 : null;
};

/** Resumen de un día: media, mínimo y máximo, con la hora en que ocurren. */
function resumen(horas: (number | null)[]) {
  const validas = horas.map((v, h) => ({ v, h })).filter((x): x is { v: number; h: number } => x.v != null);
  if (validas.length === 0) return { media: null, min: null, minHora: null, max: null, maxHora: null };
  const min = validas.reduce((a, b) => (b.v < a.v ? b : a));
  const max = validas.reduce((a, b) => (b.v > a.v ? b : a));
  return { media: media(horas), min: min.v, minHora: min.h, max: max.v, maxHora: max.h };
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const hoy = params.get('fecha') ? new Date(params.get('fecha')!) : new Date();
  if (Number.isNaN(hoy.getTime())) {
    return NextResponse.json({ error: 'Fecha no válida.' }, { status: 400 });
  }
  const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);
  // Mañana solo existe a partir de las ~14h, cuando OMIE casa la subasta del día siguiente
  const manana = new Date(hoy); manana.setDate(manana.getDate() + 1);

  // Cada fuente por su cuenta: si una falla, la otra sigue sirviendo
  const [oHoy, oAyer, oManana, pHoy] = await Promise.allSettled([
    precioOmie(hoy), precioOmie(ayer), precioOmie(manana), precioPvpc(hoy),
  ]);

  const valor = <T,>(r: PromiseSettledResult<T>, porDefecto: T): T =>
    r.status === 'fulfilled' ? r.value : porDefecto;
  const vacio: (number | null)[] = Array(24).fill(null);

  const omieHoy = valor(oHoy, vacio);
  const omieAyer = valor(oAyer, vacio);
  const omieManana = valor(oManana, vacio);
  const pvpcHoy = valor(pHoy, vacio);

  const rHoy = resumen(omieHoy);
  const rAyer = resumen(omieAyer);
  const rManana = resumen(omieManana);

  // Variación respecto a ayer: es el dato que de verdad se mira de un vistazo
  const variacion = rHoy.media != null && rAyer.media != null && rAyer.media !== 0
    ? Math.round(((rHoy.media - rAyer.media) / rAyer.media) * 1000) / 10
    : null;

  const horas: HoraMercado[] = Array.from({ length: 24 }, (_, h) => ({
    hora: h, omie: omieHoy[h], pvpc: pvpcHoy[h],
  }));

  return NextResponse.json({
    ok: true,
    fecha: aISO(hoy),
    horas,
    hoy: rHoy,
    ayer: rAyer,
    manana: rManana,
    manana_disponible: rManana.media != null,
    variacion_pct: variacion,
    fuentes: {
      omie: oHoy.status === 'fulfilled',
      pvpc: pHoy.status === 'fulfilled',
    },
    actualizado: new Date().toISOString(),
  });
}
