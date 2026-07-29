import Image from 'next/image';

/**
 * EL LOGO DE CADA EMPRESA DEL GRUPO.
 *
 * Donde antes iba el nombre escrito en grande —«Correbin Asociados» en negrita
 * a 36 px— va la marca de verdad. Un nombre en la tipografía de la web es un
 * titular; el logo es la empresa.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ VAN SOBRE UNA PLACA CLARA
 *
 * Los tres logos están hechos para papel: el icono es rojo pero el texto es
 * NEGRO («Asesoría Gesmeco», «CORREDURIA DE SEGUROS, S. L.»). Sobre el fondo
 * oscuro de la web ese texto desaparece — se vería el icono rojo flotando y
 * media marca invisible.
 *
 * Así que se montan sobre una placa blanca redondeada, que es lo que se hace
 * con una marca que solo existe en versión para fondo claro. Queda deliberado,
 * como una chapa, en vez de un logo a medio ver.
 *
 * Si algún día hay versión en negativo (texto blanco), se cambia `placa` a
 * false y se quita la placa: el resto no hay que tocarlo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface MarcaEmpresa {
  src: string;
  /** Medidas reales del archivo, para que Next reserve el hueco y no baile. */
  ancho: number;
  alto: number;
  /** El nombre, que sigue haciendo falta para buscadores y lectores de pantalla. */
  nombre: string;
  /**
   * Corrección óptica para cuando los tres van JUNTOS (modo `ajusta`).
   *
   * Los dos de Gesmeco son marcas de dos líneas; el de Correbin es de una
   * línea grande con un pie pequeño. Igualando el alto del archivo, la letra
   * de Correbin sale bastante mayor que la de los otros dos y su bloque un
   * 28 % más ancho: en una fila de tres parece que pesa más que las demás.
   * Lo que se iguala aquí es la altura de las mayúsculas, que es lo que el
   * ojo compara. A solas —en su propia web— no se aplica: allí no hay con
   * qué compararlo y solo se vería más pequeño de la cuenta.
   */
  escala?: number;
}

/**
 * Los archivos vienen RECORTADOS a su contenido.
 *
 * Los originales traían márgenes transparentes enormes —en el de Correbin, el
 * 72 % del alto estaba vacío—, así que al pedirle 30 px de alto la marca se
 * quedaba en 12 y no había quien la leyera. Recortados, el alto que se pide es
 * el alto que ocupa la marca.
 */
export const MARCAS: Record<string, MarcaEmpresa> = {
  energia: { src: '/logo-gesmeco.png', ancho: 779, alto: 269, nombre: 'Gesmeco Energía' },
  asesoria: { src: '/logo-asesoria.png', ancho: 886, alto: 292, nombre: 'Asesoría Gesmeco' },
  seguros: { src: '/logo-correbin.png', ancho: 558, alto: 150, nombre: 'Correbin Asociados', escala: 0.84 },
};

export function LogoEmpresa({
  marca,
  alto = 56,
  placa = true,
  ajusta = false,
  className = '',
  prioritario = false,
}: {
  marca: MarcaEmpresa;
  /** Alto del logo en píxeles. El ancho sale solo de su proporción. */
  alto?: number;
  /** `'compacta'` es la placa fina de la cabecera, donde no cabe la normal. */
  placa?: boolean | 'compacta';
  /**
   * Modo «los tres juntos»: trata `alto` como TOPE en vez de como medida
   * exacta, limita el ancho al del hueco y aplica la corrección óptica de
   * `marca.escala`. Sus proporciones son distintas (2,90 · 3,03 · 3,72), así
   * que fijando el alto a secas la fila se ve descuadrada.
   */
  ajusta?: boolean;
  className?: string;
  prioritario?: boolean;
}) {
  const altoFinal = ajusta ? alto * (marca.escala ?? 1) : alto;
  const ancho = Math.round((marca.ancho / marca.alto) * altoFinal);

  const fondo =
    placa === 'compacta'
      ? 'rounded-md bg-white px-2 py-1 shadow-[0_2px_8px_rgba(0,0,0,.28)]'
      : placa
        ? 'rounded-2xl bg-white px-5 py-3.5 shadow-[0_8px_24px_rgba(0,0,0,.28)]'
        : '';

  return (
    <span className={`inline-flex items-center justify-center ${fondo} ${className}`}>
      <Image
        src={marca.src}
        alt={marca.nombre}
        width={ancho}
        height={Math.round(altoFinal)}
        priority={prioritario}
        style={
          ajusta
            ? { maxHeight: altoFinal, maxWidth: '100%', height: 'auto', width: 'auto' }
            : { height: altoFinal, width: 'auto' }
        }
        className="max-w-full object-contain"
      />
    </span>
  );
}
