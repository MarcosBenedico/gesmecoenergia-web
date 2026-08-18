/**
 * PREPARAR EL ARCHIVO DE LA FACTURA ANTES DE MANDARLO.
 *
 * Vive aquí y no dentro de cada pantalla porque lo usan dos (Captura y
 * Estudios) y el fallo que evita es el mismo en las dos.
 *
 * POR QUÉ HAY QUE ENCOGER LAS FOTOS
 *
 * Una foto de móvil de hoy son 3-5 MB. El archivo viaja en base64 dentro de un
 * JSON, y base64 abulta un tercio más: esos 4 MB se convierten en 5,3 MB de
 * petición. Por encima del límite del servidor la petición se corta ANTES de
 * llegar a nuestro código, así que el error que ve David en la calle no lo
 * escribimos nosotros y no explica nada — y él está delante del cliente.
 *
 * Encoger la foto antes de mandarla no pierde nada útil: lo que hay que leer
 * son cifras impresas, y a 2000 px de lado largo se leen igual de bien que a
 * 4000. Lo que sí se pierde es la mitad del tiempo de subida con la cobertura
 * de una granja, que es donde de verdad duele.
 *
 * LOS PDF NO SE TOCAN. Encogerlos en el navegador haría falta una librería
 * entera, y un PDF de factura casi nunca pasa de un mega. Si se pasa, el
 * servidor lo dice con una frase que explica qué hacer.
 */

/** Lado largo máximo de una foto, en píxeles. Por encima no se lee mejor. */
export const LADO_MAXIMO = 2000;

/** Calidad del JPEG resultante. 0,85 no deja artefactos sobre texto impreso. */
export const CALIDAD = 0.85;

/** Lo que la API acepta. */
export const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export interface ArchivoPreparado {
  /** base64 sin la cabecera `data:`. */
  data: string;
  mediaType: string;
  /** Tamaño final en bytes, ya encogido si era una foto. */
  bytes: number;
  /** Se ha reducido respecto al original. Se enseña, para que no sorprenda. */
  encogida: boolean;
}

/** Cuántos bytes ocupa realmente una cadena base64. */
export function bytesDeBase64(b64: string): number {
  return Math.floor((b64.length * 3) / 4);
}

/** Lee un archivo a base64 sin la cabecera `data:`. */
function aBase64(f: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1] || '');
    fr.onerror = () => rej(new Error('No se ha podido leer el archivo'));
    fr.readAsDataURL(f);
  });
}

/**
 * Deja el archivo listo para mandar al lector.
 *
 * Si algo del redimensionado falla —un navegador raro, un formato que el
 * canvas no sabe pintar— se manda el original tal cual. Vale más una petición
 * grande que una pantalla que no hace nada.
 */
export async function prepararFactura(archivo: File): Promise<ArchivoPreparado> {
  const esImagen = archivo.type.startsWith('image/');

  if (!esImagen) {
    const data = await aBase64(archivo);
    return { data, mediaType: archivo.type, bytes: bytesDeBase64(data), encogida: false };
  }

  try {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));

    // Ya es pequeña: no se toca. Recomprimir una foto pequeña solo le quita
    // nitidez a los números, que es justo lo que hay que leer.
    if (escala === 1 && archivo.size <= 1.5 * 1024 * 1024) {
      bitmap.close();
      const data = await aBase64(archivo);
      return { data, mediaType: archivo.type, bytes: bytesDeBase64(data), encogida: false };
    }

    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(bitmap.width * escala);
    lienzo.height = Math.round(bitmap.height * escala);
    const ctx = lienzo.getContext('2d');
    if (!ctx) throw new Error('sin canvas');
    ctx.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
    bitmap.close();

    const blob: Blob | null = await new Promise((r) => lienzo.toBlob(r, 'image/jpeg', CALIDAD));
    if (!blob) throw new Error('sin blob');

    const data = await aBase64(blob);
    return { data, mediaType: 'image/jpeg', bytes: bytesDeBase64(data), encogida: true };
  } catch {
    const data = await aBase64(archivo);
    return { data, mediaType: archivo.type, bytes: bytesDeBase64(data), encogida: false };
  }
}
