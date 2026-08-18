import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { revisarFactura } from '@/lib/factura';

/**
 * Lee una foto o PDF de una factura de luz con Claude (visión) y
 * devuelve los datos estructurados que necesita el analizador.
 *
 * Requiere ANTHROPIC_API_KEY en las variables de entorno.
 * Coste aproximado: unos céntimos por factura.
 */

/**
 * PDF de tres páginas contra un modelo de visión no cabe en un minuto siempre.
 * Cada página se convierte a imagen antes de leerla, así que el tiempo crece
 * con las páginas y no con los megas: una foto suelta tarda segundos y una
 * factura de empresa de seis páginas puede irse a dos o tres minutos.
 */
export const maxDuration = 300;

/**
 * Tope de entrada.
 *
 * La API admite 32 MB, pero el archivo llega en base64 dentro de un JSON y eso
 * son 4/3 del tamaño original; por encima de esto la petición se corta ANTES de
 * llegar aquí y el error que ve el usuario no lo escribimos nosotros. Vale más
 * decirlo con nuestras palabras y a tiempo.
 */
const MAX_BYTES = 3 * 1024 * 1024;

const SCHEMA = {
  type: 'object' as const,
  properties: {
    encontrada: {
      type: 'boolean' as const,
      description: 'true si la imagen es una factura de electricidad legible',
    },
    tarifa: {
      type: 'string' as const,
      enum: ['2.0', '3.0', '6.1'],
      description: 'Peaje de acceso: 2.0TD → "2.0", 3.0TD → "3.0", 6.1TD → "6.1"',
    },
    consumos_kwh_mes: {
      type: 'array' as const,
      items: { type: 'number' as const },
      description:
        'Consumo MENSUAL en kWh por periodo (P1, P2, P3...). Si la factura cubre más o menos de un mes, convertir a equivalente mensual (consumo ÷ días × 30.4). 3 valores para tarifa 2.0, 6 para 3.0/6.1.',
    },
    potencias_kw: {
      type: 'array' as const,
      items: { type: 'number' as const },
      description:
        'Potencia contratada en kW por periodo. 2 valores para tarifa 2.0 (punta y valle), 6 para 3.0/6.1.',
    },
    precios_energia_eur_kwh: {
      type: 'array' as const,
      items: { type: 'number' as const },
      description:
        'Precio unitario de la energía en €/kWh por periodo, SIN impuestos. Mismo número de valores que consumos.',
    },
    precios_potencia_eur_kw_dia: {
      type: 'array' as const,
      items: { type: 'number' as const },
      description:
        'Precio de la potencia en €/kW·día por periodo. Si la factura lo da en €/kW·año, dividir entre 365. Mismo número de valores que potencias.',
    },
    nombre_titular: {
      type: 'string' as const,
      description: 'Nombre del titular de la factura si es visible, si no cadena vacía',
    },
    cups: {
      type: 'string' as const,
      description:
        'Código CUPS del suministro (empieza por ES y tiene 20-22 caracteres). Cadena vacía si no se ve.',
    },
    comercializadora: {
      type: 'string' as const,
      description: 'Nombre de la comercializadora que emite la factura. Cadena vacía si no se ve.',
    },
    distribuidora: {
      type: 'string' as const,
      description: 'Nombre de la distribuidora, si aparece. Cadena vacía si no.',
    },
    direccion_suministro: {
      type: 'string' as const,
      description: 'Dirección del punto de suministro, si aparece. Cadena vacía si no.',
    },
    fecha_fin_contrato: {
      type: 'string' as const,
      description:
        'Fecha de fin del contrato o de renovación en formato AAAA-MM-DD, si la factura la indica. Cadena vacía si no.',
    },
    observaciones: {
      type: 'string' as const,
      description:
        'Avisos importantes: datos ilegibles, valores dudosos, conversiones aplicadas. Cadena vacía si todo está claro.',
    },
  },
  required: [
    'encontrada',
    'tarifa',
    'consumos_kwh_mes',
    'potencias_kw',
    'precios_energia_eur_kwh',
    'precios_potencia_eur_kw_dia',
    'nombre_titular',
    'cups',
    'comercializadora',
    'distribuidora',
    'direccion_suministro',
    'fecha_fin_contrato',
    'observaciones',
  ],
  additionalProperties: false,
};

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          'La lectura automática no está activada todavía. Introduce los datos con la calculadora guiada.',
      },
      { status: 503 }
    );
  }

  try {
    const { data, mediaType } = await req.json();
    if (!data || !mediaType) {
      return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 });
    }

    const tiposImagen = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const esPdf = mediaType === 'application/pdf';
    if (!esPdf && !tiposImagen.includes(mediaType)) {
      return NextResponse.json(
        { error: 'Formato no soportado. Sube una foto (JPG/PNG) o un PDF.' },
        { status: 400 }
      );
    }

    // base64 son 4 caracteres por cada 3 bytes: así se recupera el tamaño real
    // sin volver a decodificar el archivo entero en memoria.
    const bytes = Math.floor((String(data).length * 3) / 4);
    if (bytes > MAX_BYTES) {
      return NextResponse.json(
        {
          error: `El archivo ocupa ${(bytes / 1024 / 1024).toFixed(1)} MB y el tope son ${MAX_BYTES / 1024 / 1024} MB. `
            + (esPdf
              ? 'Sube solo la página del desglose de consumos y precios.'
              : 'Haz la foto con menos resolución o recorta el apartado de consumos.'),
        },
        { status: 413 }
      );
    }

    const client = new Anthropic();

    const bloqueArchivo = esPdf
      ? {
          type: 'document' as const,
          source: { type: 'base64' as const, media_type: 'application/pdf' as const, data },
        }
      : {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
            data,
          },
        };

    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      system:
        'Eres un experto en facturas de electricidad españolas (tarifas de acceso 2.0TD, 3.0TD y 6.1TD). ' +
        'Extraes datos con precisión absoluta: si un valor no es legible, usa 0 y anótalo en observaciones. ' +
        'Nunca inventes valores. Los precios de energía suelen estar entre 0.05 y 0.40 €/kWh; ' +
        'los de potencia entre 0.02 y 0.15 €/kW·día. Si un valor extraído queda muy fuera de esos rangos, ' +
        'revisa las unidades y anota la conversión en observaciones.',
      messages: [
        {
          role: 'user',
          content: [
            bloqueArchivo,
            {
              type: 'text',
              text: 'Extrae los datos de esta factura de electricidad según el esquema. Convierte los consumos a equivalente mensual si el periodo de facturación no es de un mes.',
            },
          ],
        },
      ],
      output_config: {
        // Leer una factura es mecánico, no es un problema que haya que pensar:
        // el esfuerzo bajo aquí ahorra tiempo de espera, que es lo que decide
        // si esto se usa en la calle o se acaba tecleando a mano.
        effort: 'low',
        format: { type: 'json_schema', schema: SCHEMA },
      },
    });

    if (response.stop_reason === 'refusal') {
      return NextResponse.json(
        { error: 'No se pudo procesar el documento. Prueba con la calculadora guiada.' },
        { status: 422 }
      );
    }

    const texto = response.content.find((b) => b.type === 'text');
    if (!texto || texto.type !== 'text') {
      return NextResponse.json(
        { error: 'No se pudo leer la factura. Prueba con una foto más nítida.' },
        { status: 422 }
      );
    }

    // Si la respuesta se ha cortado por llegar al tope, el JSON viene a medias
    // y `JSON.parse` revienta. Antes eso caía en el catch de abajo y salía
    // «error al procesar la factura», que no dice nada y manda a probar otra
    // vez lo mismo. Con el tope alto esto no debería pasar; si pasa, se dice.
    if (response.stop_reason === 'max_tokens') {
      return NextResponse.json(
        { error: 'La respuesta se ha cortado a mitad. Prueba con una sola página de la factura (la del desglose).' },
        { status: 422 }
      );
    }

    let datos;
    try {
      datos = JSON.parse(texto.text);
    } catch {
      console.error('leer-factura: respuesta no es JSON:', texto.text.slice(0, 300));
      return NextResponse.json(
        { error: 'La lectura ha devuelto algo que no se entiende. Vuelve a intentarlo.' },
        { status: 422 }
      );
    }

    if (!datos.encontrada) {
      return NextResponse.json(
        {
          error:
            'No parece una factura de luz legible. Prueba con una foto más clara del apartado de consumos y precios.',
        },
        { status: 422 }
      );
    }

    // La revisión viaja con los datos: quien pinta la pantalla no tiene que
    // saber de rangos de precios ni de cuántos periodos lleva cada tarifa, y
    // sobre todo no puede olvidarse de comprobarlo. Ver src/lib/factura.ts.
    const revision = revisarFactura({
      tarifa: datos.tarifa,
      consumosMes: datos.consumos_kwh_mes,
      potencias: datos.potencias_kw,
      preciosEnergia: datos.precios_energia_eur_kwh,
      preciosPotencia: datos.precios_potencia_eur_kw_dia,
      titular: datos.nombre_titular || null,
      cups: datos.cups || null,
      observaciones: datos.observaciones || null,
    });

    return NextResponse.json({ ok: true, datos, revision });
  } catch (e: unknown) {
    /**
     * EL MOTIVO SE ENSEÑA, NO SE ESCONDE.
     *
     * Aquí ponía «Error al procesar la factura. Inténtalo de nuevo» y se
     * tiraba la causa a un console.error que solo se ve entrando en Vercel.
     * Cuando esto falló con un PDF real no se pudo arreglar: no había forma de
     * saber si era el tamaño, el modelo, el formato o la cuenta, y el mensaje
     * invitaba a repetir exactamente lo que acababa de no funcionar.
     *
     * Es el panel interno de la empresa, no una web pública: aquí el detalle
     * no filtra nada a nadie y ahorra media hora de adivinar.
     */
    const err = e as { status?: number; message?: string; request_id?: string;
                       error?: { error?: { type?: string; message?: string } } };
    const tipo = err?.error?.error?.type;
    const detalleApi = err?.error?.error?.message || err?.message || String(e);

    console.error('leer-factura falló:', {
      status: err?.status, tipo, request_id: err?.request_id, mensaje: detalleApi,
    });

    // Los casos que sabemos explicar en cristiano se explican; el resto sale
    // tal cual, que es infinitamente mejor que «inténtalo de nuevo».
    const porStatus: Record<number, string> = {
      400: 'La API ha rechazado el documento',
      401: 'La clave de la API no es válida o ha caducado',
      403: 'La cuenta no tiene permiso para esta operación',
      413: 'El archivo es demasiado grande',
      429: 'Se ha alcanzado el límite de peticiones. Espera un minuto y repite',
      529: 'El servicio está saturado ahora mismo. Repite en un momento',
    };
    const cabeza = porStatus[err?.status ?? 0]
      || (err?.status && err.status >= 500 ? 'El servicio de lectura ha fallado' : 'No se ha podido leer la factura');

    return NextResponse.json(
      {
        error: `${cabeza}: ${detalleApi}`,
        detalle: { status: err?.status ?? null, tipo: tipo ?? null, request_id: err?.request_id ?? null },
      },
      { status: err?.status && err.status < 500 ? err.status : 502 }
    );
  }
}
