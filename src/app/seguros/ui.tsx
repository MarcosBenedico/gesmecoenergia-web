import Link from 'next/link';
import { CORREBIN_COLORES as C } from '@/lib/correbin-marca';

/**
 * Piezas visuales compartidas de la microsede de seguros.
 * Componentes del Volumen II: espacios amplios, jerarquía fuerte, azul
 * estructural, rojo solo para acciones y bordes finos.
 */

/** Antetítulo con filete rojo: marca el inicio de cada bloque. */
export function Antetitulo({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs font-bold uppercase tracking-[0.2em] mb-3 flex items-center gap-2.5"
      style={{ color: C.textoSuave }}
    >
      <span className="inline-block w-6 h-0.5 rounded" style={{ background: C.rojo }} />
      {children}
    </p>
  );
}

/** Sección con ancho de lectura y separación generosa. */
export function Seccion({
  id, children, alt = false, className = '',
}: {
  id?: string;
  children: React.ReactNode;
  /** Fondo alterno (gris cálido) para separar bloques sin usar oscuros. */
  alt?: boolean;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 ${alt ? 'border-y' : ''} ${className}`}
      style={alt ? { background: C.fondoAlt, borderColor: C.borde } : undefined}
    >
      <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">{children}</div>
    </section>
  );
}

/** Encabezado de bloque: antetítulo + H2 + entradilla. */
export function Encabezado({
  ante, titulo, texto,
}: {
  ante?: string;
  titulo: string;
  texto?: string;
}) {
  return (
    <div className="max-w-3xl">
      {ante && <Antetitulo>{ante}</Antetitulo>}
      <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-tight" style={{ color: C.azul }}>
        {titulo}
      </h2>
      {texto && (
        <p className="mt-4 text-base leading-relaxed" style={{ color: C.textoSuave }}>
          {texto}
        </p>
      )}
    </div>
  );
}

/** Lista con viñeta redonda. `tono` decide el color del punto. */
export function Lista({
  puntos, tono = 'rojo', className = '',
}: {
  puntos: readonly string[];
  tono?: 'rojo' | 'azul';
  className?: string;
}) {
  return (
    <ul className={`space-y-2.5 ${className}`}>
      {puntos.map((p) => (
        <li key={p} className="flex gap-2.5 text-sm leading-snug" style={{ color: C.texto }}>
          <span
            className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: tono === 'rojo' ? C.rojo : C.azul }}
          />
          {p}
        </li>
      ))}
    </ul>
  );
}

/** Tarjeta blanca con borde fino. */
export function Tarjeta({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border p-7 ${className}`} style={{ borderColor: C.borde, background: '#fff' }}>
      {children}
    </div>
  );
}

/** Botón de acción (rojo) o secundario (contorno azul). */
export function Boton({
  href, children, variante = 'principal', externo = false, className = '',
}: {
  href: string;
  children: React.ReactNode;
  variante?: 'principal' | 'secundario';
  externo?: boolean;
  className?: string;
}) {
  const estilo =
    variante === 'principal'
      ? { background: C.rojo, color: '#fff', borderColor: C.rojo }
      : { background: 'transparent', color: C.azul, borderColor: C.azul };
  const clases = `inline-flex items-center justify-center px-6 py-3.5 rounded-lg text-base font-bold border transition hover:opacity-85 ${className}`;

  if (externo) {
    return (
      <a href={href} className={clases} style={estilo} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={clases} style={estilo}>
      {children}
    </Link>
  );
}

/** Aviso destacado: para límites contractuales y advertencias de emergencia. */
export function Aviso({
  children, tipo = 'info',
}: {
  children: React.ReactNode;
  tipo?: 'info' | 'urgente';
}) {
  const urgente = tipo === 'urgente';
  return (
    <div
      className="rounded-xl border-l-4 p-4 text-sm leading-relaxed"
      style={{
        borderColor: urgente ? C.rojo : C.azul,
        background: urgente ? '#fdf2f4' : C.fondoAlt,
        color: C.texto,
      }}
      role={urgente ? 'alert' : undefined}
    >
      {children}
    </div>
  );
}

/** Cierre de página: siguiente paso obligatorio (criterio de aceptación del Vol. IV). */
export function SiguientePaso({
  titulo, texto, principal, secundario,
}: {
  titulo: string;
  texto?: string;
  principal: { href: string; texto: string };
  secundario?: { href: string; texto: string };
}) {
  return (
    <Seccion alt>
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight" style={{ color: C.azul }}>
            {titulo}
          </h2>
          {texto && (
            <p className="mt-3 text-base leading-relaxed" style={{ color: C.textoSuave }}>
              {texto}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <Boton href={principal.href}>{principal.texto}</Boton>
          {secundario && (
            <Boton href={secundario.href} variante="secundario">
              {secundario.texto}
            </Boton>
          )}
        </div>
      </div>
    </Seccion>
  );
}
