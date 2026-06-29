/**
 * API para crear automáticamente la tabla en Supabase
 *
 * Uso: GET /api/setup-database
 *
 * Esto ejecutará el SQL necesario para crear la tabla proyectos_fotovoltaicos
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// SQL para crear la tabla
const SQL = `
DROP TABLE IF EXISTS proyectos_fotovoltaicos CASCADE;

CREATE TABLE proyectos_fotovoltaicos (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cliente_nombre TEXT NOT NULL,
  cliente_email TEXT,
  cliente_telefono TEXT,
  cliente_ubicacion TEXT NOT NULL,
  cliente_direccion TEXT,
  cliente_ubicacion_gps TEXT,
  cliente_descripcion TEXT,
  consumo_anual NUMERIC,
  potencia_deseada NUMERIC,
  fase_sistema VARCHAR(10),
  tipo_tejado VARCHAR(50),
  espacio_disponible NUMERIC,
  presupuesto_maximo NUMERIC,
  acceso_tejado VARCHAR(50),
  distancia_cuadro_electrico VARCHAR(50),
  espacio_almacenamiento VARCHAR(50),
  andamiaje_necesario VARCHAR(50),
  orientacion_tejado VARCHAR(50),
  inclinacion_tejado VARCHAR(50),
  sombreado VARCHAR(50),
  estado_tejado VARCHAR(50),
  carga_tejado_maxima NUMERIC,
  presencia_amianto VARCHAR(50),
  cuadro_accesible VARCHAR(50),
  tierra_adecuada VARCHAR(50),
  acometida_cambio VARCHAR(50),
  distancia_cableado VARCHAR(50),
  clima_viento BOOLEAN DEFAULT FALSE,
  clima_nieve BOOLEAN DEFAULT FALSE,
  clima_salinidad BOOLEAN DEFAULT FALSE,
  clima_polvo BOOLEAN DEFAULT FALSE,
  dificultades_especiales TEXT,
  consumo_critico VARCHAR(50),
  independencia_prioridad VARCHAR(50),
  ampliacion_futura VARCHAR(50),
  altura_edificio_pisos NUMERIC,
  distancia_cuadro_a_tejado_metros NUMERIC,
  dias_instalacion_estimado NUMERIC,
  necesita_grua BOOLEAN DEFAULT FALSE,
  requiere_refuerzo_estructural BOOLEAN DEFAULT FALSE,
  reparaciones_tejado_previas BOOLEAN DEFAULT FALSE,
  incluir_baterias BOOLEAN DEFAULT FALSE,
  capacidad_baterias NUMERIC,
  num_paneles INTEGER,
  potencia_real NUMERIC,
  espacio_requerido NUMERIC,
  produccion_anual INTEGER,
  inversor_marca VARCHAR(100),
  inversor_modelo VARCHAR(100),
  alertas JSONB,
  estado VARCHAR(50) DEFAULT 'borrador'
);

CREATE INDEX idx_proyectos_cliente_nombre ON proyectos_fotovoltaicos(cliente_nombre);
CREATE INDEX idx_proyectos_cliente_email ON proyectos_fotovoltaicos(cliente_email);
CREATE INDEX idx_proyectos_updated_at ON proyectos_fotovoltaicos(updated_at DESC);
CREATE INDEX idx_proyectos_estado ON proyectos_fotovoltaicos(estado);

ALTER TABLE proyectos_fotovoltaicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_operations" ON proyectos_fotovoltaicos
FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_updated_at
  BEFORE UPDATE ON proyectos_fotovoltaicos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
`;

export async function GET() {
  try {
    // Intentar con Supabase client
    if (SUPABASE_SERVICE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { persistSession: false },
      });

      // Ejecutar SQL usando rpc (si existe función)
      try {
        const { data, error } = await supabase.rpc('exec_sql', {
          query: SQL,
        });

        if (!error) {
          return Response.json({
            success: true,
            message: '✅ Base de datos creada exitosamente',
            data,
          });
        }
      } catch (e) {
        // RPC no existe, intentar de otra forma
      }

      // Intentar crear tabla directamente
      try {
        const { error } = await supabase.from('proyectos_fotovoltaicos').select().limit(1);

        if (!error) {
          // Tabla ya existe
          return Response.json({
            success: true,
            message: '✅ La tabla ya existe y está lista',
          });
        }
      } catch (e) {
        // Tabla no existe
      }
    }

    // Si no hay service key, intentar con fetch directo a Supabase
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`,
      },
      body: JSON.stringify({ query: SQL }),
    });

    if (response.ok) {
      return Response.json({
        success: true,
        message: '✅ Base de datos creada exitosamente',
      });
    }

    // Verificar si la tabla existe
    const verifyResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/proyectos_fotovoltaicos?select=count()&limit=1`,
      {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`,
        },
      }
    );

    if (verifyResponse.ok) {
      return Response.json({
        success: true,
        message: '✅ La tabla ya existe y está lista para usar',
      });
    }

    throw new Error(
      'No se pudo crear la tabla automáticamente. Por favor, pega el SQL en Supabase manualmente.'
    );
  } catch (error) {
    console.error('Error creating database:', error);

    return Response.json(
      {
        success: false,
        message: '⚠️ Error al crear la base de datos automáticamente',
        error: error instanceof Error ? error.message : 'Error desconocido',
        instructions: `
        Por favor, crea la tabla manualmente:

        1. Abre: https://app.supabase.com/
        2. SQL Editor → New Query
        3. Copia el contenido de: SQL_PARA_PEGAR.sql
        4. Pega y ejecuta (RUN)

        O simplemente continúa usando la aplicación,
        la tabla se creará cuando intentes guardar un proyecto.
        `,
      },
      { status: 500 }
    );
  }
}
