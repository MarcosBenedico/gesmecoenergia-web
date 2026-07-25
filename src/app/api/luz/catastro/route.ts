import { NextRequest, NextResponse } from 'next/server';

/**
 * FICHA DEL CATASTRO A PARTIR DE UNAS COORDENADAS
 *
 * POST { lat, lon } → uso, metros construidos oficiales, año y dirección.
 *
 * El Catastro publica esto gratis y sin clave, y es dato OFICIAL: mientras que
 * de OpenStreetMap sacamos la forma de las naves (que es una estimación sobre
 * un dibujo hecho por voluntarios), aquí salen los metros construidos de
 * verdad, el uso declarado y el año.
 *
 * El año importa más de lo que parece: una nave de 1997 lleva la instalación
 * eléctrica de 1997 y probablemente cubierta de fibrocemento, que condiciona el
 * montaje. Es un dato con el que se abre una conversación.
 *
 * Son dos llamadas encadenadas: coordenadas → referencia catastral → ficha.
 */

export const maxDuration = 30;

const OVC = 'https://ovc.catastro.meh.es';
const UA = 'GesmecoEnergia/1.0 (gesmecoenergia.com)';

export interface FichaCatastro {
  referencia: string | null;
  /** "Agrario", "Industrial", "Residencial"… tal cual lo declara el Catastro. */
  uso: string | null;
  /** Metros CONSTRUIDOS oficiales. */
  m2_construidos: number | null;
  /** Metros de la parcela. */
  m2_parcela: number | null;
  /** Año de construcción. */
  anio: number | null;
  /** Dirección oficial ("Polígono 8 Parcela 143..."), que da nombre a lo que no lo tiene. */
  direccion: string | null;
  /** Cuántas construcciones hay en la parcela. */
  n_construcciones: number | null;
  /** Enlace a la cartografía oficial. */
  url_cartografia: string | null;
}

const VACIA: FichaCatastro = {
  referencia: null, uso: null, m2_construidos: null, m2_parcela: null,
  anio: null, direccion: null, n_construcciones: null, url_cartografia: null,
};

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** El Catastro devuelve XML con acentos mal codificados; se limpia lo peor. */
function limpiar(texto: string | null): string | null {
  if (!texto) return null;
  return texto.replace(/�/g, '').replace(/\s+/g, ' ').trim() || null;
}

export async function POST(req: NextRequest) {
  try {
    const { lat, lon } = (await req.json()) as { lat?: number; lon?: number };
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ error: 'Faltan las coordenadas.' }, { status: 400 });
    }

    // ── 1. Coordenadas → referencia catastral ──
    const urlRC =
      `${OVC}/ovcservweb/OVCSWLocalizacionRC/OVCCoordenadas.asmx/Consulta_RCCOOR` +
      `?SRS=EPSG:4326&Coordenada_X=${lon}&Coordenada_Y=${lat}`;

    let xml: string;
    try {
      const res = await fetch(urlRC, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) return NextResponse.json({ ok: true, ficha: VACIA, aviso: 'El Catastro no respondió.' });
      xml = await res.text();
    } catch {
      return NextResponse.json({ ok: true, ficha: VACIA, aviso: 'No se pudo consultar el Catastro.' });
    }

    const pc1 = xml.match(/<pc1>([^<]+)<\/pc1>/)?.[1];
    const pc2 = xml.match(/<pc2>([^<]+)<\/pc2>/)?.[1];
    const ldt = limpiar(xml.match(/<ldt>([^<]*)<\/ldt>/)?.[1] || null);

    if (!pc1 || !pc2) {
      // Sin parcela catastral: pasa en caminos, balsas y suelo no edificado
      return NextResponse.json({ ok: true, ficha: { ...VACIA, direccion: ldt }, aviso: 'Aquí no hay parcela catastral.' });
    }
    const referencia = `${pc1}${pc2}`;

    // ── 2. Referencia → ficha con superficies, uso y año ──
    const urlFicha =
      `${OVC}/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/Consulta_DNPRC` +
      `?RefCat=${encodeURIComponent(referencia)}`;

    let json: Record<string, unknown>;
    try {
      const res = await fetch(urlFicha, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
      json = await res.json();
    } catch {
      return NextResponse.json({ ok: true, ficha: { ...VACIA, referencia, direccion: ldt } });
    }

    // La respuesta viene muy anidada; se navega con cuidado porque falta a menudo
    const r = (json?.consulta_dnprcResult || {}) as Record<string, unknown>;
    const bico = (r.bico || {}) as Record<string, unknown>;
    const bi = (bico.bi || {}) as Record<string, unknown>;
    const debi = (bi.debi || {}) as Record<string, unknown>;
    const finca = (bico.finca || {}) as Record<string, unknown>;
    const dff = (finca.dff || {}) as Record<string, unknown>;
    const infgraf = (finca.infgraf || {}) as Record<string, unknown>;
    const lcons = Array.isArray(bico.lcons) ? bico.lcons : [];

    const ficha: FichaCatastro = {
      referencia,
      uso: limpiar((debi.luso as string) || null),
      m2_construidos: num(debi.sfc),
      m2_parcela: num(dff.ss),
      anio: num(debi.ant),
      direccion: limpiar((bi.ldt as string) || null) || ldt,
      n_construcciones: lcons.length || null,
      url_cartografia: (infgraf.igraf as string) || null,
    };

    return NextResponse.json({ ok: true, ficha });
  } catch {
    return NextResponse.json({ error: 'No se pudo consultar el Catastro.' }, { status: 500 });
  }
}
