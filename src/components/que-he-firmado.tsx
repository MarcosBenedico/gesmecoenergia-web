'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/* ────────────────────────────────────────────────────────────
   Tipos: espejo exacto del esquema de /api/que-he-firmado
   ──────────────────────────────────────────────────────────── */

type Paso = { titulo: string; detalle: string; donde: string };
type DatoClave = { etiqueta: string; valor: string; nota: string; alerta: boolean };
type Aviso = { titulo: string; explicacion: string; gravedad: 'alta' | 'media' | 'baja' };

type Analisis = {
  es_documento: boolean;
  tipo: string;
  tipo_detalle: string;
  emisor: string;
  titular: string;
  referencia: string;
  resumen: string;
  que_te_piden: string;
  si_no_haces_nada: string;
  urgencia: 'alta' | 'media' | 'baja' | 'ninguna';
  fecha_limite: string;
  plazo_texto: string;
  pasos: Paso[];
  datos_clave: DatoClave[];
  avisos: Aviso[];
  documentos_necesarios: string[];
  confianza: 'alta' | 'media' | 'baja';
  observaciones: string;
};

/* ────────────────────────────────────────────────────────────
   Utilidades
   ──────────────────────────────────────────────────────────── */

const MAX_BYTES = 18 * 1024 * 1024;

const TIPOS_ADMITIDOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

function formatearTamano(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatearFecha(iso: string) {
  const [a, m, d] = iso.split('-').map(Number);
  if (!a || !m || !d) return iso;
  return new Date(a, m - 1, d).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Días naturales entre hoy y la fecha límite. Negativo = ya ha vencido. */
function diasHasta(iso: string): number | null {
  const [a, m, d] = iso.split('-').map(Number);
  if (!a || !m || !d) return null;
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const fin = new Date(a, m - 1, d);
  return Math.round((fin.getTime() - inicio.getTime()) / 86_400_000);
}

async function aBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binario = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binario);
}

/* ────────────────────────────────────────────────────────────
   Iconografía: trazo fino y uniforme, sin relleno.
   ──────────────────────────────────────────────────────────── */

type IconoProps = { className?: string };

const trazo = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const IconoSubir = ({ className }: IconoProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...trazo}>
    <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
    <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </svg>
);

const IconoDocumento = ({ className }: IconoProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...trazo}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);

const IconoCalendario = ({ className }: IconoProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...trazo}>
    <rect x="3.5" y="5" width="17" height="16" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);

const IconoAlerta = ({ className }: IconoProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...trazo}>
    <path d="M12 4.5 2.8 20h18.4L12 4.5Z" />
    <path d="M12 10v4.5M12 17.5v.01" />
  </svg>
);

const IconoImprimir = ({ className }: IconoProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...trazo}>
    <path d="M7 9V3h10v6M7 19H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
    <rect x="7" y="15" width="10" height="6" />
  </svg>
);

const IconoVolver = ({ className }: IconoProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...trazo}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4v5h5" />
  </svg>
);

const IconoCandado = ({ className }: IconoProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...trazo}>
    <rect x="4.5" y="10" width="15" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

/* ────────────────────────────────────────────────────────────
   Piezas de presentación
   ──────────────────────────────────────────────────────────── */

const ESTILO_URGENCIA: Record<Analisis['urgencia'], { texto: string; color: string; fondo: string }> = {
  alta: { texto: 'Requiere acción inmediata', color: 'var(--qhf-alta)', fondo: 'var(--qhf-alta-fondo)' },
  media: { texto: 'Requiere acción', color: 'var(--qhf-media)', fondo: 'var(--qhf-media-fondo)' },
  baja: { texto: 'Conviene revisarlo', color: 'var(--qhf-baja)', fondo: 'var(--qhf-baja-fondo)' },
  ninguna: { texto: 'Informativo', color: 'var(--qhf-tinta-2)', fondo: 'var(--qhf-panel)' },
};

const ESTILO_GRAVEDAD: Record<Aviso['gravedad'], { texto: string; color: string; fondo: string }> = {
  alta: { texto: 'Importante', color: 'var(--qhf-alta)', fondo: 'var(--qhf-alta-fondo)' },
  media: { texto: 'Atención', color: 'var(--qhf-media)', fondo: 'var(--qhf-media-fondo)' },
  baja: { texto: 'Menor', color: 'var(--qhf-tinta-2)', fondo: 'var(--qhf-panel)' },
};

function Seccion({
  numero,
  titulo,
  children,
}: {
  numero: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="qhf-caja p-5 sm:p-6">
      <div className="mb-3 flex items-baseline gap-3 border-b border-[var(--qhf-linea)] pb-3">
        <span
          className="shrink-0 text-sm font-bold tabular-nums"
          style={{ color: 'var(--qhf-marca)' }}
        >
          {numero}
        </span>
        <h2>{titulo}</h2>
      </div>
      {children}
    </section>
  );
}

function FilaCabecera({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  if (!valor) return null;
  return (
    <div className="min-w-0">
      <dt className="qhf-etiqueta">{etiqueta}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-[var(--qhf-tinta)]">{valor}</dd>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Componente principal
   ──────────────────────────────────────────────────────────── */

const MENSAJES_CARGA = [
  'Leyendo el documento…',
  'Identificando emisor y referencia…',
  'Localizando plazos y fechas…',
  'Revisando cláusulas y penalizaciones…',
  'Redactando los pasos a seguir…',
];

export function QueHeFirmado() {
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [tamanoArchivo, setTamanoArchivo] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [pasoCarga, setPasoCarga] = useState(0);
  const [error, setError] = useState('');
  const [datos, setDatos] = useState<Analisis | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [analizadoEl, setAnalizadoEl] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const camaraRef = useRef<HTMLInputElement>(null);
  const resultadoRef = useRef<HTMLDivElement>(null);

  // Los mensajes van rotando para que la espera (30-60 s con un PDF largo) no
  // parezca que se ha colgado.
  useEffect(() => {
    if (!cargando) {
      setPasoCarga(0);
      return;
    }
    const id = setInterval(() => {
      setPasoCarga((n) => Math.min(n + 1, MENSAJES_CARGA.length - 1));
    }, 5000);
    return () => clearInterval(id);
  }, [cargando]);

  useEffect(() => {
    if (datos && resultadoRef.current) {
      resultadoRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [datos]);

  const analizar = useCallback(async (file: File) => {
    setError('');
    setDatos(null);

    if (!TIPOS_ADMITIDOS.includes(file.type)) {
      setError('Formato no admitido. Sube un PDF o una foto en JPG, PNG o WEBP.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`El archivo pesa ${formatearTamano(file.size)}. El máximo son 18 MB.`);
      return;
    }

    setNombreArchivo(file.name);
    setTamanoArchivo(file.size);
    setCargando(true);

    try {
      const base64 = await aBase64(file);
      const res = await fetch('/api/que-he-firmado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: base64, mediaType: file.type }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json?.error || 'No se ha podido analizar el documento.');
        return;
      }

      setDatos(json.datos as Analisis);
      setAnalizadoEl(
        new Date().toLocaleString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    } catch {
      setError('No se ha podido conectar con el servicio. Comprueba tu conexión e inténtalo otra vez.');
    } finally {
      setCargando(false);
    }
  }, []);

  function alSoltar(e: React.DragEvent) {
    e.preventDefault();
    setArrastrando(false);
    const file = e.dataTransfer.files?.[0];
    if (file) analizar(file);
  }

  function reiniciar() {
    setDatos(null);
    setError('');
    setNombreArchivo('');
    setTamanoArchivo(0);
    if (inputRef.current) inputRef.current.value = '';
    if (camaraRef.current) camaraRef.current.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const dias = datos?.fecha_limite ? diasHasta(datos.fecha_limite) : null;

  return (
    <div className="qhf">
      <div className="qhf-franja" />

      {/* ── Cabecera del servicio ── */}
      <header className="qhf-no-imprimir border-b border-[var(--qhf-linea)] bg-[var(--qhf-papel)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-gesmeco.png"
              alt=""
              width={34}
              height={34}
              className="h-[34px] w-auto"
            />
            <div className="border-l border-[var(--qhf-linea)] pl-3 leading-tight">
              <p className="text-[0.9375rem] font-bold text-[var(--qhf-tinta)]">Qué he firmado</p>
              <p className="text-xs text-[var(--qhf-tinta-3)]">
                Servicio informativo de Gesmeco Energía
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="text-sm font-medium text-[var(--qhf-azul)] underline decoration-[var(--qhf-linea-fuerte)] underline-offset-4 hover:decoration-[var(--qhf-azul)]"
          >
            Ir a gesmecoenergia.com
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-8">
        {/* ── Presentación ── */}
        <div className="qhf-no-imprimir max-w-3xl">
          <p className="qhf-etiqueta">Lectura de documentos</p>
          <h1 className="mt-2">
            Sube un documento y te decimos qué dice y qué tienes que hacer
          </h1>
          <p className="mt-4 text-[1.0625rem]">
            Un contrato, una carta de Hacienda, una renovación de seguro, una multa. Lo leemos y te
            devolvemos, en castellano llano: qué es, qué te piden, qué pasa si no haces nada, cuándo
            vence y el paso concreto que toca dar.
          </p>

          <ul className="mt-7 grid gap-px overflow-hidden rounded border border-[var(--qhf-linea)] bg-[var(--qhf-linea)] sm:grid-cols-3">
            {[
              ['Gratuito', 'Sin registro y sin dejar tus datos.'],
              ['No se guarda nada', 'El documento se procesa y se descarta.'],
              ['Con sus límites', 'Es información, no asesoramiento jurídico.'],
            ].map(([titulo, texto]) => (
              <li key={titulo} className="bg-[var(--qhf-papel)] p-4">
                <p className="qhf-fuerte text-sm font-semibold">{titulo}</p>
                <p className="mt-1 text-[0.8125rem] leading-snug">{texto}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Zona de subida ── */}
        {!datos && (
          <div className="qhf-no-imprimir mt-10">
            <div
              className="qhf-zona-soltar px-6 py-12 text-center"
              data-activa={arrastrando}
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={alSoltar}
            >
              {cargando ? (
                <div aria-live="polite">
                  <p className="qhf-fuerte text-base font-semibold">
                    {MENSAJES_CARGA[pasoCarga]}
                  </p>
                  <p className="mt-1 text-sm">
                    {nombreArchivo} · {formatearTamano(tamanoArchivo)}
                  </p>
                  <div className="mx-auto mt-6 h-1 w-full max-w-xs overflow-hidden bg-[var(--qhf-linea)]">
                    <div className="qhf-barrido h-full w-1/4 bg-[var(--qhf-azul)]" />
                  </div>
                  <p className="mt-4 text-xs text-[var(--qhf-tinta-3)]">
                    Puede tardar hasta un minuto. No cierres la página.
                  </p>
                </div>
              ) : (
                <>
                  <IconoSubir className="mx-auto h-9 w-9 text-[var(--qhf-tinta-3)]" />
                  <p className="qhf-fuerte mt-4 text-base font-semibold">
                    Arrastra aquí el documento
                  </p>
                  <p className="mt-1 text-sm">
                    PDF o foto (JPG, PNG, WEBP). Máximo 18 MB.
                  </p>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="rounded-[3px] bg-[var(--qhf-marca)] px-5 py-2.5 text-sm text-white hover:bg-[#7a1616]"
                    >
                      Seleccionar archivo
                    </button>
                    <button
                      type="button"
                      onClick={() => camaraRef.current?.click()}
                      className="rounded-[3px] border border-[var(--qhf-linea-fuerte)] bg-[var(--qhf-papel)] px-5 py-2.5 text-sm text-[var(--qhf-tinta)] hover:bg-[var(--qhf-panel)] sm:hidden"
                    >
                      Hacer una foto
                    </button>
                  </div>

                  <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) analizar(f);
                    }}
                  />
                  <input
                    ref={camaraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) analizar(f);
                    }}
                  />
                </>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="mt-4 flex gap-3 rounded-[3px] border border-[var(--qhf-alta)] bg-[var(--qhf-alta-fondo)] p-4"
              >
                <IconoAlerta className="mt-0.5 h-5 w-5 shrink-0 text-[var(--qhf-alta)]" />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--qhf-alta)' }}>
                    No se ha podido analizar
                  </p>
                  <p className="mt-0.5 text-sm">{error}</p>
                </div>
              </div>
            )}

            <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-[var(--qhf-tinta-3)]">
              <IconoCandado className="mt-px h-4 w-4 shrink-0" />
              <span>
                El documento se envía cifrado, se procesa para generar la ficha y no se almacena en
                ningún servidor de Gesmeco. Aun así, tapa los datos que no quieras compartir antes de
                subirlo.
              </span>
            </p>
          </div>
        )}

        {/* ── Resultado ── */}
        {datos && (
          <div ref={resultadoRef} className="mt-10 space-y-4">
            {/* Cabecera de la ficha */}
            <div className="qhf-caja overflow-hidden">
              <div
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--qhf-linea)] px-5 py-3"
                style={{ background: ESTILO_URGENCIA[datos.urgencia].fondo }}
              >
                <span
                  className="text-xs font-bold uppercase tracking-[0.09em]"
                  style={{ color: ESTILO_URGENCIA[datos.urgencia].color }}
                >
                  {ESTILO_URGENCIA[datos.urgencia].texto}
                </span>
                <span className="text-xs text-[var(--qhf-tinta-3)]">
                  Ficha generada el {analizadoEl}
                </span>
              </div>

              <div className="p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <IconoDocumento className="mt-1 hidden h-8 w-8 shrink-0 text-[var(--qhf-tinta-3)] sm:block" />
                  <div className="min-w-0">
                    <p className="qhf-etiqueta">Documento analizado</p>
                    <h2 className="qhf-h2-ficha mt-1">{datos.tipo_detalle}</h2>
                  </div>
                </div>

                <dl className="mt-5 grid gap-4 border-t border-[var(--qhf-linea)] pt-5 sm:grid-cols-3">
                  <FilaCabecera etiqueta="Emisor" valor={datos.emisor} />
                  <FilaCabecera etiqueta="Titular" valor={datos.titular} />
                  <FilaCabecera etiqueta="Referencia" valor={datos.referencia} />
                </dl>
              </div>
            </div>

            {/* Plazo: lo primero que la gente necesita ver */}
            {datos.fecha_limite && (
              <div
                className="qhf-caja flex flex-wrap items-center gap-x-6 gap-y-3 p-5 sm:p-6"
                style={{
                  borderLeft: `4px solid ${
                    dias !== null && dias < 0
                      ? 'var(--qhf-alta)'
                      : dias !== null && dias <= 7
                        ? 'var(--qhf-alta)'
                        : 'var(--qhf-media)'
                  }`,
                }}
              >
                <IconoCalendario className="h-7 w-7 shrink-0 text-[var(--qhf-tinta-2)]" />
                <div className="min-w-0 flex-1">
                  <p className="qhf-etiqueta">Fecha límite</p>
                  <p className="qhf-fuerte mt-0.5 text-lg font-bold">
                    {formatearFecha(datos.fecha_limite)}
                    {dias !== null && (
                      <span
                        className="ml-2 text-base font-semibold"
                        style={{
                          color: dias < 0 ? 'var(--qhf-alta)' : dias <= 7 ? 'var(--qhf-alta)' : 'var(--qhf-media)',
                        }}
                      >
                        {dias < 0
                          ? `· venció hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`
                          : dias === 0
                            ? '· es hoy'
                            : `· quedan ${dias} ${dias === 1 ? 'día' : 'días'}`}
                      </span>
                    )}
                  </p>
                  {datos.plazo_texto && (
                    <p className="mt-1 text-sm">{datos.plazo_texto}</p>
                  )}
                </div>
              </div>
            )}

            <Seccion numero="1" titulo="Qué es este documento">
              <p className="qhf-fuerte text-[1.0625rem]">{datos.resumen}</p>
            </Seccion>

            <Seccion numero="2" titulo="Qué te piden">
              <p className="qhf-fuerte text-[1.0625rem]">{datos.que_te_piden}</p>
            </Seccion>

            <Seccion numero="3" titulo="Qué pasa si no haces nada">
              <p className="qhf-fuerte text-[1.0625rem]">{datos.si_no_haces_nada}</p>
            </Seccion>

            {datos.pasos.length > 0 && (
              <Seccion numero="4" titulo="Qué hacer, paso a paso">
                <ol className="space-y-4">
                  {datos.pasos.map((paso, i) => (
                    <li key={i} className="flex gap-4">
                      <span
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums text-white"
                        style={{ background: 'var(--qhf-azul)' }}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="qhf-fuerte font-semibold">{paso.titulo}</p>
                        <p className="mt-0.5 text-[0.9375rem]">{paso.detalle}</p>
                        {paso.donde && (
                          <p className="mt-1 text-[0.8125rem] text-[var(--qhf-tinta-3)]">
                            Dónde: {paso.donde}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </Seccion>
            )}

            {datos.datos_clave.length > 0 && (
              <Seccion numero="5" titulo="Datos clave del documento">
                {/* Lista de definición en vez de tabla: en el móvil se apila y
                    no obliga a arrastrar de lado, que es donde más se usa esto */}
                <dl className="text-sm">
                  {datos.datos_clave.map((d, i) => (
                    <div
                      key={i}
                      className="grid gap-0.5 border-b border-[var(--qhf-linea)] py-3 last:border-0 sm:grid-cols-[38%_1fr] sm:gap-4"
                    >
                      <dt className="font-medium text-[var(--qhf-tinta-2)]">{d.etiqueta}</dt>
                      <dd className="min-w-0">
                        <span
                          className="font-semibold tabular-nums"
                          style={{ color: d.alerta ? 'var(--qhf-alta)' : 'var(--qhf-tinta)' }}
                        >
                          {d.valor}
                        </span>
                        {d.alerta && (
                          <IconoAlerta className="ml-1.5 inline-block h-4 w-4 align-text-bottom text-[var(--qhf-alta)]" />
                        )}
                        {d.nota && (
                          <span className="mt-0.5 block text-[0.8125rem] text-[var(--qhf-tinta-3)]">
                            {d.nota}
                          </span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Seccion>
            )}

            {datos.avisos.length > 0 && (
              <Seccion numero="6" titulo="En esto conviene fijarse">
                <ul className="space-y-3">
                  {datos.avisos.map((aviso, i) => (
                    <li
                      key={i}
                      className="rounded-[3px] p-4"
                      style={{
                        background: ESTILO_GRAVEDAD[aviso.gravedad].fondo,
                        borderLeft: `3px solid ${ESTILO_GRAVEDAD[aviso.gravedad].color}`,
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="qhf-fuerte font-semibold">{aviso.titulo}</p>
                        <span
                          className="text-[0.6875rem] font-bold uppercase tracking-[0.08em]"
                          style={{ color: ESTILO_GRAVEDAD[aviso.gravedad].color }}
                        >
                          {ESTILO_GRAVEDAD[aviso.gravedad].texto}
                        </span>
                      </div>
                      <p className="mt-1 text-[0.9375rem]">{aviso.explicacion}</p>
                    </li>
                  ))}
                </ul>
              </Seccion>
            )}

            {datos.documentos_necesarios.length > 0 && (
              <Seccion numero="7" titulo="Lo que necesitarás tener a mano">
                <ul className="space-y-2">
                  {datos.documentos_necesarios.map((doc, i) => (
                    <li key={i} className="flex gap-3 text-[0.9375rem]">
                      <span className="mt-[0.4rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--qhf-linea-fuerte)]" />
                      <span>{doc}</span>
                    </li>
                  ))}
                </ul>
              </Seccion>
            )}

            {/* Fiabilidad de la lectura: honestidad sobre los límites */}
            <div className="qhf-caja bg-[var(--qhf-panel)] p-5 sm:p-6">
              <p className="qhf-etiqueta">Fiabilidad de esta lectura</p>
              <p className="mt-2 text-sm">
                {datos.confianza === 'alta'
                  ? 'El documento se ha leído completo y con claridad.'
                  : datos.confianza === 'media'
                    ? 'Hay partes del documento que no se leen bien o falta contexto. Contrasta la ficha con el original.'
                    : 'La lectura ha sido parcial. Trata esta ficha como una orientación y revisa el documento original.'}
                {datos.observaciones && ` ${datos.observaciones}`}
              </p>
            </div>

            {/* Acciones */}
            <div className="qhf-no-imprimir flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={reiniciar}
                className="flex items-center gap-2 rounded-[3px] bg-[var(--qhf-marca)] px-5 py-2.5 text-sm text-white hover:bg-[#7a1616]"
              >
                <IconoVolver className="h-4 w-4" />
                Analizar otro documento
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-[3px] border border-[var(--qhf-linea-fuerte)] bg-[var(--qhf-papel)] px-5 py-2.5 text-sm text-[var(--qhf-tinta)] hover:bg-[var(--qhf-panel)]"
              >
                <IconoImprimir className="h-4 w-4" />
                Imprimir o guardar en PDF
              </button>
            </div>

            {/* Salida hacia el negocio, sin disfrazarla de consejo */}
            <div className="qhf-no-imprimir qhf-caja border-l-4 border-l-[var(--qhf-azul)] p-5 sm:p-6">
              <h3>¿Es un contrato de luz o gas?</h3>
              <p className="mt-1.5 text-[0.9375rem]">
                Gesmeco Energía revisa contratos de suministro sin coste y te dice si estás pagando de
                más. Somos asesoría energética, así que tenemos interés comercial en que nos llames:
                tenlo en cuenta al leer nuestra recomendación.
              </p>
              <Link
                href="/contacto"
                className="mt-3 inline-block text-sm font-semibold text-[var(--qhf-azul)] underline decoration-[var(--qhf-linea-fuerte)] underline-offset-4 hover:decoration-[var(--qhf-azul)]"
              >
                Hablar con Gesmeco Energía
              </Link>
            </div>
          </div>
        )}

        {/* ── Aviso legal ── */}
        <div className="mt-12 border-t border-[var(--qhf-linea)] pt-6">
          <p className="qhf-etiqueta">Aviso importante</p>
          <p className="mt-2 max-w-3xl text-[0.8125rem] leading-relaxed text-[var(--qhf-tinta-3)]">
            Este es un servicio privado de <strong>Gesmeco Energía S.L.</strong> (Binéfar, Huesca). No
            es un servicio público ni está vinculado a ninguna administración. La ficha que genera es
            información orientativa elaborada por un sistema automático: puede contener errores y no
            sustituye a la lectura del documento original ni al asesoramiento de un abogado, gestor o
            asesor fiscal. Antes de actuar sobre plazos, importes o consecuencias, verifícalos siempre
            en el documento que has recibido. Gesmeco Energía no se responsabiliza de las decisiones
            tomadas a partir de esta ficha.
          </p>
          <p className="mt-4 text-[0.8125rem] text-[var(--qhf-tinta-3)]">
            <Link href="/aviso-legal" className="underline underline-offset-4">
              Aviso legal
            </Link>
            {' · '}
            <Link href="/privacidad" className="underline underline-offset-4">
              Privacidad
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
