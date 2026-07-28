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
  seguros: { src: '/logo-correbin.png', ancho: 558, alto: 150, nombre: 'Correbin Asociados' },
};

export function LogoEmpresa({
  marca,
  alto = 56,
  placa = true,
  className = '',
  prioritario = false,
}: {
  marca: MarcaEmpresa;
  /** Alto del logo en píxeles. El ancho sale solo de su proporción. */
  alto?: number;
  placa?: boolean;
  className?: string;
  prioritario?: boolean;
}) {
  const ancho = Math.round((marca.ancho / marca.alto) * alto);

  return (
    <span
      className={`inline-flex items-center justify-center ${
        placa ? 'rounded-2xl bg-white px-5 py-3.5 shadow-[0_8px_24px_rgba(0,0,0,.28)]' : ''
      } ${className}`}
    >
      <Image
        src={marca.src}
        alt={marca.nombre}
        width={ancho}
        height={alto}
        priority={prioritario}
        style={{ height: alto, width: 'auto' }}
        className="max-w-full object-contain"
      />
    </span>
  );
}
