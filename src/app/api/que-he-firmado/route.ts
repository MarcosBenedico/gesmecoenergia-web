import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

/**
 * "Qué he firmado" — lee un contrato, una carta de la Administración o una
 * renovación (foto o PDF) y devuelve, en lenguaje llano: qué es, qué te piden,
 * qué pasa si no haces nada, cuándo vence y qué paso dar.
 *
 * Requiere ANTHROPIC_API_KEY. Es un servicio informativo: nunca sustituye a la
 * lectura del documento original ni al asesoramiento profesional, y por eso el
 * modelo tiene prohibido inventar plazos, importes o consecuencias.
 */

export const maxDuration = 120;

const TIPOS = [
  'contrato_suministro',
  'contrato_telefonia',
  'contrato_alquiler',
  'contrato_laboral',
  'seguro',
  'prestamo_o_financiacion',
  'notificacion_administrativa',
  'sancion_o_multa',
  'requerimiento_tributario',
  'factura_o_recibo',
  'renovacion_o_suscripcion',
  'comunicacion_bancaria',
  'escritura_o_notarial',
  'otro',
];

const SCHEMA = {
  type: 'object' as const,
  properties: {
    es_documento: {
      type: 'boolean' as const,
      description:
        'true solo si el archivo contiene un documento legible del que se puede extraer información. false si está en blanco, ilegible o no es un documento (por ejemplo una foto de un paisaje).',
    },
    tipo: {
      type: 'string' as const,
      enum: TIPOS,
      description: 'Categoría del documento. Usa "otro" si ninguna encaja.',
    },
    tipo_detalle: {
      type: 'string' as const,
      description:
        'Nombre concreto del documento en 2-6 palabras, tal y como lo entendería una persona. Ej: "Contrato de luz con permanencia", "Providencia de apremio de la AEAT".',
    },
    emisor: {
      type: 'string' as const,
      description: 'Quién envía o emite el documento (empresa u organismo). Cadena vacía si no consta.',
    },
    titular: {
      type: 'string' as const,
      description: 'Persona o empresa destinataria. Cadena vacía si no consta o no es legible.',
    },
    referencia: {
      type: 'string' as const,
      description:
        'Número de expediente, contrato, póliza o referencia principal. Cadena vacía si no consta.',
    },
    resumen: {
      type: 'string' as const,
      description:
        'Qué es este documento, en 2 o 3 frases y en lenguaje llano, sin tecnicismos ni jerga jurídica. Como se lo explicarías a un vecino.',
    },
    que_te_piden: {
      type: 'string' as const,
      description:
        'Qué se le pide concretamente al destinatario: pagar, alegar, firmar, aportar documentación, no hacer nada... En 1 o 2 frases directas. Si el documento no pide nada, dilo explícitamente.',
    },
    si_no_haces_nada: {
      type: 'string' as const,
      description:
        'Qué ocurre si el destinatario ignora el documento, según lo que dice el propio documento o el procedimiento estándar aplicable. Si no se puede determinar con seguridad, dilo en vez de suponer.',
    },
    urgencia: {
      type: 'string' as const,
      enum: ['alta', 'media', 'baja', 'ninguna'],
      description:
        'alta: hay un plazo corto o consecuencias graves (embargo, corte de suministro, recargo). media: hay plazo pero holgado. baja: conviene revisarlo sin prisa. ninguna: es meramente informativo.',
    },
    fecha_limite: {
      type: 'string' as const,
      description:
        'Fecha límite en formato AAAA-MM-DD. Si el plazo se expresa en días desde la notificación, calcúlala desde la fecha del documento e indícalo en plazo_texto. Cadena vacía si no hay plazo o no se puede determinar. NUNCA inventes una fecha.',
    },
    plazo_texto: {
      type: 'string' as const,
      description:
        'Cómo aparece el plazo en el documento y de dónde sale la fecha calculada. Ej: "15 días hábiles desde la notificación del 3 de junio". Cadena vacía si no hay plazo.',
    },
    pasos: {
      type: 'array' as const,
      description:
        'Pasos concretos a dar, en orden. Entre 1 y 5. Cada uno accionable de verdad: dónde ir, qué presentar, a quién llamar. Si el único paso es "no hacer nada", dilo con un solo paso.',
      items: {
        type: 'object' as const,
        properties: {
          titulo: { type: 'string' as const, description: 'Acción en imperativo, máximo 8 palabras.' },
          detalle: {
            type: 'string' as const,
            description: 'Cómo hacerlo, en 1 o 2 frases prácticas.',
          },
          donde: {
            type: 'string' as const,
            description:
              'Dónde se hace: sede electrónica, oficina, teléfono del documento, etc. Cadena vacía si no aplica.',
          },
        },
        required: ['titulo', 'detalle', 'donde'],
        additionalProperties: false,
      },
    },
    datos_clave: {
      type: 'array' as const,
      description:
        'Entre 2 y 8 datos económicos o contractuales que importan: importe, permanencia, penalización por baja, renovación automática, tipo de interés, duración, preaviso. Solo los que aparezcan realmente en el documento.',
      items: {
        type: 'object' as const,
        properties: {
          etiqueta: { type: 'string' as const, description: 'Nombre del dato. Máximo 4 palabras.' },
          valor: { type: 'string' as const, description: 'El valor, con sus unidades.' },
          nota: {
            type: 'string' as const,
            description: 'Aclaración breve de por qué importa. Cadena vacía si es evidente.',
          },
          alerta: {
            type: 'boolean' as const,
            description: 'true si es un dato que suele perjudicar al firmante y conviene destacar.',
          },
        },
        required: ['etiqueta', 'valor', 'nota', 'alerta'],
        additionalProperties: false,
      },
    },
    avisos: {
      type: 'array' as const,
      description:
        'Cláusulas o detalles que conviene mirar dos veces: permanencias, renovaciones tácitas, penalizaciones, subidas de precio, cesión de datos, recargos. Entre 0 y 6. Array vacío si el documento no tiene nada llamativo.',
      items: {
        type: 'object' as const,
        properties: {
          titulo: { type: 'string' as const, description: 'De qué va el aviso, máximo 8 palabras.' },
          explicacion: {
            type: 'string' as const,
            description: 'Qué dice el documento y por qué conviene fijarse, en lenguaje llano.',
          },
          gravedad: {
            type: 'string' as const,
            enum: ['alta', 'media', 'baja'],
            description: 'Cuánto puede costarle al firmante.',
          },
        },
        required: ['titulo', 'explicacion', 'gravedad'],
        additionalProperties: false,
      },
    },
    documentos_necesarios: {
      type: 'array' as const,
      description:
        'Documentos o datos que hará falta reunir para responder. Entre 0 y 5. Array vacío si no hace falta nada.',
      items: { type: 'string' as const },
    },
    confianza: {
      type: 'string' as const,
      enum: ['alta', 'media', 'baja'],
      description:
        'alta: el documento se lee entero y con claridad. media: hay partes ilegibles o falta contexto. baja: solo se intuye el contenido.',
    },
    observaciones: {
      type: 'string' as const,
      description:
        'Limitaciones de la lectura: páginas que faltan, texto ilegible, datos que no se ven. Cadena vacía si todo está claro.',
    },
  },
  required: [
    'es_documento',
    'tipo',
    'tipo_detalle',
    'emisor',
    'titular',
    'referencia',
    'resumen',
    'que_te_piden',
    'si_no_haces_nada',
    'urgencia',
    'fecha_limite',
    'plazo_texto',
    'pasos',
    'datos_clave',
    'avisos',
    'documentos_necesarios',
    'confianza',
    'observaciones',
  ],
  additionalProperties: false,
};

const SISTEMA = `Eres un experto en documentación administrativa, contractual y de consumo en España: contratos de suministro, telefonía, alquiler y trabajo, pólizas de seguro, préstamos, notificaciones de la AEAT, la Seguridad Social, ayuntamientos y comunidades autónomas, sanciones y renovaciones de servicios.

Tu trabajo es traducir el documento a lenguaje llano para una persona sin formación jurídica, y decirle exactamente qué tiene que hacer y cuándo.

Reglas innegociables:
1. NUNCA inventes. Si un plazo, importe o consecuencia no consta en el documento, dilo abiertamente en vez de suponerlo. Es mejor un campo vacío que un dato falso.
2. Distingue siempre entre lo que dice el documento y lo que sabes del procedimiento general. Si algo lo aportas tú como contexto, dilo con un "normalmente" o "según el procedimiento habitual".
3. Escribe como se habla: frases cortas, sin latinajos, sin "el interesado", sin "a los efectos oportunos". Tutea al destinatario.
4. Sé preciso con las fechas. Si el plazo son días hábiles, cuéntalos como hábiles y explícalo. Si no hay fecha de notificación visible, no calcules una fecha límite.
5. No des asesoramiento jurídico ni fiscal personalizado: describe el documento y los pasos objetivos del procedimiento. Cuando el asunto requiera un profesional, dilo en el paso correspondiente.
6. Si el documento perjudica al firmante (permanencias largas, penalizaciones, renovación tácita, recargos), señálalo con claridad. Ese es el valor del servicio.`;

const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'El servicio de lectura no está activado en este momento. Inténtalo más tarde.' },
      { status: 503 }
    );
  }

  let data: string | undefined;
  let mediaType: string | undefined;

  try {
    const body = await req.json();
    data = body?.data;
    mediaType = body?.mediaType;
  } catch {
    return NextResponse.json({ error: 'Petición mal formada.' }, { status: 400 });
  }

  if (!data || !mediaType) {
    return NextResponse.json({ error: 'No se ha recibido ningún archivo.' }, { status: 400 });
  }

  const esPdf = mediaType === 'application/pdf';
  if (!esPdf && !TIPOS_IMAGEN.includes(mediaType)) {
    return NextResponse.json(
      { error: 'Formato no admitido. Sube un PDF o una foto en JPG, PNG o WEBP.' },
      { status: 400 }
    );
  }

  // base64 ocupa 4/3 del original; el límite de la API es 32 MB por petición.
  if (data.length > 26_000_000) {
    return NextResponse.json(
      { error: 'El archivo es demasiado grande. El máximo son 18 MB.' },
      { status: 413 }
    );
  }

  try {
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

    const hoy = new Date().toISOString().slice(0, 10);

    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      system: SISTEMA,
      messages: [
        {
          role: 'user',
          content: [
            bloqueArchivo,
            {
              type: 'text',
              text: `Analiza este documento y rellena el esquema.

La fecha de hoy es ${hoy}: úsala para valorar la urgencia y para comprobar si un plazo ya ha vencido (si ha vencido, dilo en plazo_texto).

Prioriza, por este orden: qué es, qué te piden, qué pasa si no haces nada, cuándo vence y qué paso dar mañana por la mañana.`,
            },
          ],
        },
      ],
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema: SCHEMA },
      },
    });

    if (response.stop_reason === 'refusal') {
      return NextResponse.json(
        { error: 'No se ha podido procesar este documento. Prueba con otro archivo.' },
        { status: 422 }
      );
    }

    const texto = response.content.find((b) => b.type === 'text');
    if (!texto || texto.type !== 'text') {
      return NextResponse.json(
        { error: 'No se ha podido leer el documento. Prueba con una copia más nítida.' },
        { status: 422 }
      );
    }

    const datos = JSON.parse(texto.text);

    if (!datos.es_documento) {
      return NextResponse.json(
        {
          error:
            'No se ha reconocido un documento legible. Asegúrate de que la foto recoge la página completa y de que el texto se lee bien.',
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ ok: true, datos });
  } catch (e: unknown) {
    const mensaje = e instanceof Error ? e.message : String(e);
    console.error('Error en qué-he-firmado:', mensaje);
    return NextResponse.json(
      { error: 'Error al procesar el documento. Vuelve a intentarlo en unos minutos.' },
      { status: 500 }
    );
  }
}
