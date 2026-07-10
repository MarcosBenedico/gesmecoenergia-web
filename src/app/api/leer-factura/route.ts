import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Lee una foto o PDF de una factura de luz con Claude (visión) y
 * devuelve los datos estructurados que necesita el analizador.
 *
 * Requiere ANTHROPIC_API_KEY en las variables de entorno.
 * Coste aproximado: unos céntimos por factura.
 */

export const maxDuration = 60;

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
      model: 'claude-opus-4-8',
      max_tokens: 2048,
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

    const datos = JSON.parse(texto.text);

    if (!datos.encontrada) {
      return NextResponse.json(
        {
          error:
            'No parece una factura de luz legible. Prueba con una foto más clara del apartado de consumos y precios.',
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ ok: true, datos });
  } catch (e: any) {
    console.error('Error leyendo factura:', e?.message || e);
    return NextResponse.json(
      { error: 'Error al procesar la factura. Inténtalo de nuevo o usa la calculadora guiada.' },
      { status: 500 }
    );
  }
}
