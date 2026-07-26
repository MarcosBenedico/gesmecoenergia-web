/**
 * CLIENTE DE DATADIS — el consumo real de cada CUPS, sin instalar nada.
 *
 * Datadis es la plataforma de las propias distribuidoras. Con la autorización
 * del titular devuelve, gratis, lo que hasta ahora había que adivinar leyendo
 * una factura: la curva horaria, el maxímetro por periodo y las potencias que
 * tiene contratadas de verdad. Eso convierte el optimizador de potencias de una
 * estimación en un cálculo, y el `pct_autoconsumo` de la FV de una hipótesis en
 * una medida.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TRES COSAS QUE HAY QUE SABER ANTES DE TOCAR ESTO
 *
 * 1. HAY QUE PEDIR PERMISO, Y LO DA EL CLIENTE.
 *    Para leer un CUPS que no es nuestro, el titular tiene que entrar en
 *    datadis.es y autorizar nuestro NIF. No hay atajo por API: si no está la
 *    autorización, `get-supplies` con `authorizedNif` devuelve lista vacía.
 *    Por eso `Autorizacion` es un estado de primera clase en este módulo y la
 *    pantalla lo dice en cristiano en vez de fallar en silencio.
 *
 * 2. DATADIS ES LENTO Y RACIONA LAS PETICIONES.
 *    Respuestas de 30-60 s son normales, y repetir la misma consulta antes de
 *    24 h devuelve 429. No es un error nuestro: es la política del servicio. Se
 *    trata como lo que es —«ya lo pediste, espera»— y se apunta para no volver
 *    a gastar el turno. De ahí que la sincronización vaya por meses y quede
 *    registrada en `luz_datadis_sync`.
 *
 * 3. LOS DATOS VIENEN CON HUECOS Y CON SELLO.
 *    Cada hora trae `obtainMethod`: Real o Estimada. Hay meses incompletos y
 *    horas que no llegan nunca. Aquí NO se rellenan huecos ni se promedia por
 *    encima: se guarda lo que hay con su sello y se informa de la cobertura,
 *    porque un maxímetro inventado se traduce en una potencia mal contratada y
 *    en una penalización real en la factura del cliente.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * AVISO SOBRE LOS ENDPOINTS: las rutas de abajo son las que usan los clientes
 * públicos de la comunidad y las que responden hoy, pero Datadis no publica un
 * contrato estable y las ha movido antes. Si algo empieza a fallar en masa,
 * mirar primero aquí y no en la lógica de negocio. `DATADIS_BASE` es
 * sobreescribible por entorno justo para eso.
 */

/** Raíz del servicio. Sobreescribible por si Datadis vuelve a mover el sitio. */
const DATADIS_BASE = process.env.DATADIS_BASE || 'https://datadis.es';

/** Login: devuelve el JWT en TEXTO PLANO, no en JSON. Es fácil tropezar aquí. */
const RUTA_LOGIN = '/nikola-auth/tokens/login';
const RUTA_SUPPLIES = '/api-private/api/get-supplies';
const RUTA_CONTRATO = '/api-private/api/get-contract-detail';
const RUTA_CONSUMO = '/api-private/api/get-consumption-data';
const RUTA_MAXIMETRO = '/api-private/api/get-max-power';
/** La reactiva no está en todos los puntos de medida: si no existe, se ignora. */
const RUTA_REACTIVA = '/api-private/api/get-reactive-data';

/**
 * Datadis tarda de verdad. Menos de esto y se cortan consultas que iban bien;
 * el `maxDuration` de la ruta de API tiene que ir por encima de este número.
 */
const TIMEOUT_MS = Number(process.env.DATADIS_TIMEOUT_MS || 90_000);

/** El token dura horas. Se guarda en memoria del proceso para no pedirlo por CUPS. */
const MARGEN_TOKEN_MS = 30 * 60 * 1000; // se renueva 30 min antes de caducar
let tokenCache: { token: string; caduca: number } | null = null;

// ── Lo que devuelve Datadis ────────────────────────────────────────────────

export interface SuministroDatadis {
  cups: string;
  /** Hace falta en casi todas las demás llamadas. Sin esto no se puede seguir. */
  distributorCode: string;
  /** 1..5. Manda en si hay cuartohorario (tipos 1-2) o solo horario. */
  pointType: number;
  address?: string;
  province?: string;
  municipality?: string;
  postalCode?: string;
  distributor?: string;
  validDateFrom?: string;
  validDateTo?: string;
}

export interface ContratoDatadis {
  cups: string;
  /** '2.0TD' | '3.0TD' | '6.1TD' … tal como lo dice la distribuidora. */
  accessFare?: string;
  marketer?: string;
  tension?: string;
  /** kW contratados por periodo, en orden P1..Pn. La verdad, no lo de la factura. */
  contractedPowerkW: number[];
  startDate?: string;
  endDate?: string;
  /** 1 = maxímetro, 2 = ICP. Cambia cómo se facturan los excesos. */
  modePowerControl?: string;
  cnae?: string;
  selfConsumptionTypeDesc?: string;
}

export interface HoraConsumo {
  cups: string;
  /** ISO 'YYYY-MM-DD'. Datadis lo manda como 'YYYY/MM/DD' y aquí ya viene normalizado. */
  fecha: string;
  /** 'HH:MM'. Datadis usa 24:00 para el último tramo del día; se normaliza a 00:00 del siguiente. */
  hora: string;
  consumo_kwh: number;
  /** Vertido a red, solo si hay autoconsumo. */
  excedente_kwh: number | null;
  /** 'Real' | 'Estimada'. No se mezcla con lo real sin decirlo. */
  metodo: string;
}

export interface MaximetroMes {
  cups: string;
  /** Día concreto en que se alcanzó el máximo, no el mes. Sirve para explicarlo al cliente. */
  fecha: string;
  hora: string;
  potencia_kw: number;
  /** Periodo tal como lo asigna la DISTRIBUIDORA. Es la versión buena: ver nota en potencia.ts. */
  periodo: number;
}

export interface ReactivaMes {
  cups: string;
  fecha: string;
  /** kVArh por periodo P1..P6 (los que vengan). */
  reactiva_por_periodo: number[];
}

/** Por qué no se pudo leer un CUPS. Cada caso tiene un arreglo distinto. */
export type FalloDatadis =
  | { tipo: 'sin_credenciales'; mensaje: string }
  | { tipo: 'login'; mensaje: string }
  | { tipo: 'sin_autorizacion'; mensaje: string }
  | { tipo: 'racionado'; mensaje: string }
  | { tipo: 'no_existe'; mensaje: string }
  | { tipo: 'lento'; mensaje: string }
  | { tipo: 'otro'; mensaje: string };

export class ErrorDatadis extends Error {
  fallo: FalloDatadis;
  constructor(fallo: FalloDatadis) {
    super(fallo.mensaje);
    this.name = 'ErrorDatadis';
    this.fallo = fallo;
  }
}

// ── Utilidades de formato ──────────────────────────────────────────────────

/** Datadis quiere 'YYYY/MM' en los rangos. */
export function mesDatadis(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? new Date(fecha + (fecha.length === 7 ? '-01' : '')) : fecha;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 'YYYY/MM/DD' → 'YYYY-MM-DD'. Tolera que ya venga con guiones. */
function fechaISO(v: unknown): string {
  const s = String(v || '').trim();
  return s.replace(/\//g, '-').slice(0, 10);
}

/**
 * Normaliza la hora. Datadis manda '24:00' para el tramo que cierra el día:
 * eso pasa a ser '00:00' del día siguiente, que es lo que significa. Si se
 * dejara tal cual, ese tramo se ordenaría mal y ensuciaría el perfil horario.
 */
function normalizarHora(fecha: string, hora: string): { fecha: string; hora: string } {
  const h = String(hora || '').trim();
  if (h.startsWith('24')) {
    const d = new Date(fecha + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    return { fecha: d.toISOString().slice(0, 10), hora: '00:00' };
  }
  return { fecha, hora: h.slice(0, 5) };
}

/** Lista de meses 'YYYY/MM' entre dos fechas, ambas incluidas. */
export function mesesEntre(desde: string, hasta: string): string[] {
  const [a, b] = [new Date(desde + '-01T00:00:00Z'), new Date(hasta + '-01T00:00:00Z')];
  const meses: string[] = [];
  const cursor = new Date(a);
  while (cursor <= b && meses.length < 60) {
    meses.push(`${cursor.getUTCFullYear()}/${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return meses;
}

/** Los últimos N meses cerrados, del más antiguo al más reciente. */
export function ultimosMeses(n: number): string[] {
  const hoy = new Date();
  const fin = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1, 1));
  const ini = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth() - (n - 1), 1));
  const iso = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return mesesEntre(iso(ini), iso(fin));
}

// ── Transporte ─────────────────────────────────────────────────────────────

/**
 * Traduce el fallo HTTP a algo con arreglo. El 429 de Datadis merece trato
 * aparte: no es un error, es «ya has gastado el turno de este CUPS hoy», y
 * quien lo reciba tiene que dejar de insistir, no reintentar.
 */
function interpretarFallo(status: number, cuerpo: string): FalloDatadis {
  const texto = (cuerpo || '').slice(0, 300);
  if (status === 401 || status === 403) {
    return { tipo: 'login', mensaje: 'Datadis ha rechazado las credenciales. Revisa DATADIS_USER y DATADIS_PASSWORD.' };
  }
  if (status === 429 || /last 24 hours|already performed/i.test(texto)) {
    return { tipo: 'racionado', mensaje: 'Datadis limita a una consulta por CUPS y mes cada 24 h. Ya se pidió: vuelve mañana.' };
  }
  if (status === 404) {
    return { tipo: 'no_existe', mensaje: 'Datadis no encuentra ese CUPS con esos datos. Comprueba el CUPS y el código de distribuidora.' };
  }
  if (status === 408 || status === 504) {
    return { tipo: 'lento', mensaje: 'Datadis ha tardado más de lo que aguanta la petición. Reintenta con menos meses de golpe.' };
  }
  return { tipo: 'otro', mensaje: `Datadis ha respondido ${status}. ${texto}` };
}

async function conTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const reloj = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store' });
  } catch (e) {
    const abortado = e instanceof Error && e.name === 'AbortError';
    throw new ErrorDatadis(
      abortado
        ? { tipo: 'lento', mensaje: `Datadis no ha contestado en ${Math.round(TIMEOUT_MS / 1000)} s. Prueba con menos meses de golpe.` }
        : { tipo: 'otro', mensaje: 'No se ha podido conectar con Datadis.' }
    );
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * Consigue el token. Se reutiliza mientras esté vivo, porque pedirlo por cada
 * CUPS es la forma más rápida de que Datadis nos empiece a racionar.
 */
export async function tokenDatadis(forzar = false): Promise<string> {
  if (!forzar && tokenCache && tokenCache.caduca > Date.now()) return tokenCache.token;

  const usuario = process.env.DATADIS_USER;
  const clave = process.env.DATADIS_PASSWORD;
  if (!usuario || !clave) {
    throw new ErrorDatadis({
      tipo: 'sin_credenciales',
      mensaje: 'Faltan DATADIS_USER y DATADIS_PASSWORD en el entorno. Sin eso no se puede leer nada de Datadis.',
    });
  }

  const res = await conTimeout(DATADIS_BASE + RUTA_LOGIN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: usuario, password: clave }).toString(),
  });

  // Ojo: el token llega como texto plano. Pasarlo por res.json() falla.
  const cuerpo = (await res.text()).trim();
  if (!res.ok || !cuerpo || cuerpo.startsWith('{')) {
    throw new ErrorDatadis(interpretarFallo(res.status, cuerpo));
  }

  // Se lee la caducidad del propio JWT si se puede; si no, se asume una hora.
  let caduca = Date.now() + 60 * 60 * 1000;
  try {
    const carga = JSON.parse(Buffer.from(cuerpo.split('.')[1], 'base64').toString('utf8'));
    if (carga?.exp) caduca = carga.exp * 1000;
  } catch { /* JWT no legible: nos quedamos con la hora por defecto */ }

  tokenCache = { token: cuerpo, caduca: caduca - MARGEN_TOKEN_MS };
  return cuerpo;
}

/** GET autenticado contra la API privada. Reintenta una vez si el token caducó. */
async function pedir<T>(ruta: string, params: Record<string, string | number | undefined>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }

  const lanzar = async (token: string) => {
    const res = await conTimeout(`${DATADIS_BASE}${ruta}?${qs}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      const cuerpo = await res.text().catch(() => '');
      throw new ErrorDatadis(interpretarFallo(res.status, cuerpo));
    }
    const texto = await res.text();
    if (!texto.trim()) return [] as unknown as T; // sin datos ese mes: lista vacía, no error
    try {
      return JSON.parse(texto) as T;
    } catch {
      throw new ErrorDatadis({ tipo: 'otro', mensaje: 'Datadis ha devuelto algo que no es JSON.' });
    }
  };

  try {
    return await lanzar(await tokenDatadis());
  } catch (e) {
    // Token caducado a medio camino: se renueva y se prueba UNA vez más.
    if (e instanceof ErrorDatadis && e.fallo.tipo === 'login') {
      return await lanzar(await tokenDatadis(true));
    }
    throw e;
  }
}

// ── Llamadas de negocio ────────────────────────────────────────────────────

/**
 * Suministros visibles. Sin `nifAutorizado` devuelve los nuestros; con él, los
 * del cliente que nos haya autorizado en su panel de Datadis.
 *
 * Una lista vacía con NIF puesto NO es un error de red: casi siempre significa
 * que ese cliente todavía no ha dado la autorización. Es la causa número uno
 * de que esto «no funcione», así que la pantalla lo dice con esas palabras.
 */
export async function suministros(nifAutorizado?: string): Promise<SuministroDatadis[]> {
  const filas = await pedir<Record<string, unknown>[]>(RUTA_SUPPLIES, { authorizedNif: nifAutorizado });
  return (Array.isArray(filas) ? filas : []).map((f) => ({
    cups: String(f.cups || '').trim().toUpperCase(),
    distributorCode: String(f.distributorCode ?? ''),
    pointType: Number(f.pointType ?? 0),
    address: f.address ? String(f.address) : undefined,
    province: f.province ? String(f.province) : undefined,
    municipality: f.municipality ? String(f.municipality) : undefined,
    postalCode: f.postalCode ? String(f.postalCode) : undefined,
    distributor: f.distributor ? String(f.distributor) : undefined,
    validDateFrom: f.validDateFrom ? fechaISO(f.validDateFrom) : undefined,
    validDateTo: f.validDateTo ? fechaISO(f.validDateTo) : undefined,
  }));
}

/** Detalle del contrato: aquí están las potencias contratadas de verdad. */
export async function contrato(
  cups: string,
  distributorCode: string,
  nifAutorizado?: string
): Promise<ContratoDatadis | null> {
  const filas = await pedir<Record<string, unknown>[]>(RUTA_CONTRATO, {
    cups, distributorCode, authorizedNif: nifAutorizado,
  });
  const f = Array.isArray(filas) ? filas[0] : (filas as Record<string, unknown> | null);
  if (!f) return null;

  const potencias = Array.isArray(f.contractedPowerkW)
    ? (f.contractedPowerkW as unknown[]).map((n) => Number(n) || 0)
    : [];

  return {
    cups: String(f.cups || cups).toUpperCase(),
    accessFare: f.accessFare ? String(f.accessFare) : undefined,
    marketer: f.marketer ? String(f.marketer) : undefined,
    tension: f.tension ? String(f.tension) : undefined,
    contractedPowerkW: potencias,
    startDate: f.startDate ? fechaISO(f.startDate) : undefined,
    endDate: f.endDate ? fechaISO(f.endDate) : undefined,
    modePowerControl: f.modePowerControl ? String(f.modePowerControl) : undefined,
    cnae: f.cnae ? String(f.cnae) : undefined,
    selfConsumptionTypeDesc: f.selfConsumptionTypeDesc ? String(f.selfConsumptionTypeDesc) : undefined,
  };
}

/**
 * Curva de consumo de UN mes. Se pide mes a mes a propósito: rangos largos
 * hacen que Datadis tarde hasta cortar la conexión, y si falla un mes se
 * pierden todos. Así lo que entra, entra.
 *
 * `measurementType` 0 = horario (todos), 1 = cuartohorario (solo tipos 1-2).
 */
export async function curvaMes(
  cups: string,
  distributorCode: string,
  mes: string,
  opciones: { pointType?: number; nifAutorizado?: string; cuartohorario?: boolean } = {}
): Promise<HoraConsumo[]> {
  const filas = await pedir<Record<string, unknown>[]>(RUTA_CONSUMO, {
    cups,
    distributorCode,
    startDate: mes,
    endDate: mes,
    measurementType: opciones.cuartohorario ? 1 : 0,
    pointType: opciones.pointType,
    authorizedNif: opciones.nifAutorizado,
  });

  return (Array.isArray(filas) ? filas : []).flatMap((f) => {
    const bruta = fechaISO(f.date);
    if (!bruta) return [];
    const { fecha, hora } = normalizarHora(bruta, String(f.time || ''));
    const kwh = Number(f.consumptionKWh);
    if (!Number.isFinite(kwh)) return [];
    const excedente = Number(f.surplusEnergyKWh);
    return [{
      cups: cups.toUpperCase(),
      fecha,
      hora,
      consumo_kwh: kwh,
      excedente_kwh: Number.isFinite(excedente) ? excedente : null,
      metodo: String(f.obtainMethod || 'Real'),
    }];
  });
}

/**
 * Maxímetros de un rango de meses. Esto es lo que de verdad manda para
 * optimizar potencias, porque trae el periodo asignado por la distribuidora y
 * el máximo cuartohorario que ella misma factura.
 */
export async function maximetros(
  cups: string,
  distributorCode: string,
  desde: string,
  hasta: string,
  nifAutorizado?: string
): Promise<MaximetroMes[]> {
  const filas = await pedir<Record<string, unknown>[]>(RUTA_MAXIMETRO, {
    cups, distributorCode, startDate: desde, endDate: hasta, authorizedNif: nifAutorizado,
  });

  return (Array.isArray(filas) ? filas : []).flatMap((f) => {
    const kw = Number(f.maxPower);
    const periodo = Number(f.period);
    if (!Number.isFinite(kw) || kw <= 0) return [];
    return [{
      cups: cups.toUpperCase(),
      fecha: fechaISO(f.date),
      hora: String(f.time || '').slice(0, 5),
      potencia_kw: kw,
      // Datadis manda a veces el periodo como '1'..'6' y a veces como 'P1'
      periodo: Number.isFinite(periodo) ? periodo : Number(String(f.period || '').replace(/\D/g, '')) || 0,
    }];
  });
}

/**
 * Energía reactiva, si el punto la mide. Muchos no la tienen y el endpoint
 * responde 404: eso no es un fallo que deba tumbar una sincronización, así que
 * aquí se devuelve lista vacía y ya está.
 */
export async function reactiva(
  cups: string,
  distributorCode: string,
  desde: string,
  hasta: string,
  nifAutorizado?: string
): Promise<ReactivaMes[]> {
  try {
    const bruto = await pedir<Record<string, unknown>>(RUTA_REACTIVA, {
      cups, distributorCode, startDate: desde, endDate: hasta, authorizedNif: nifAutorizado,
    });
    const lista = Array.isArray(bruto) ? bruto : (bruto?.energy as unknown[]) || [];
    return (lista as Record<string, unknown>[]).flatMap((f) => {
      const fecha = fechaISO(f.date);
      if (!fecha) return [];
      const periodos: number[] = [];
      for (let p = 1; p <= 6; p++) {
        const v = Number(f[`energy_p${p}`] ?? f[`energyP${p}`]);
        periodos.push(Number.isFinite(v) ? v : 0);
      }
      return [{ cups: cups.toUpperCase(), fecha, reactiva_por_periodo: periodos }];
    });
  } catch (e) {
    // Solo se traga el «aquí no hay eso». Un problema de credenciales o de
    // racionado sí tiene que subir, porque afecta al resto de la sincronización.
    if (e instanceof ErrorDatadis && (e.fallo.tipo === 'no_existe' || e.fallo.tipo === 'otro')) return [];
    throw e;
  }
}

/** Normaliza un CUPS para comparar: sin espacios, mayúsculas, sin sufijo de punto. */
export function cupsComparable(cups: string | null | undefined): string {
  return String(cups || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
}
