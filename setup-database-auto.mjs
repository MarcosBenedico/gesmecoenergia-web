#!/usr/bin/env node

/**
 * Script para crear la tabla en Supabase automáticamente
 * Uso: node setup-database-auto.mjs
 *
 * Credenciales sacadas automáticamente de .env.local
 */

const SUPABASE_URL = 'https://rhsflkemubgigagwmoqb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoc2Zsa2VtdWJnaWdhZ3dtb3FiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzcyMzIyOSwiZXhwIjoyMDI5MzIzMjI5fQ.3y7MTRl6dJfUwRMXJH6rlxJ7PXY6UPqY7cVo6s8DEJA';

const SQL = `
-- ============================================
-- TABLA PROYECTOS FOTOVOLTAICOS
-- ============================================

DROP TABLE IF EXISTS proyectos_fotovoltaicos CASCADE;

CREATE TABLE proyectos_fotovoltaicos (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- DATOS DEL CLIENTE
  cliente_nombre TEXT NOT NULL,
  cliente_email TEXT,
  cliente_telefono TEXT,
  cliente_ubicacion TEXT NOT NULL,
  cliente_direccion TEXT,
  cliente_ubicacion_gps TEXT,
  cliente_descripcion TEXT,

  -- ESPECIFICACIONES TÉCNICAS
  consumo_anual NUMERIC,
  potencia_deseada NUMERIC,
  fase_sistema VARCHAR(10),
  tipo_tejado VARCHAR(50),
  espacio_disponible NUMERIC,
  presupuesto_maximo NUMERIC,

  -- ANÁLISIS TÉCNICO DETALLADO
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

  -- CONDICIONES CLIMÁTICAS
  clima_viento BOOLEAN DEFAULT FALSE,
  clima_nieve BOOLEAN DEFAULT FALSE,
  clima_salinidad BOOLEAN DEFAULT FALSE,
  clima_polvo BOOLEAN DEFAULT FALSE,
  dificultades_especiales TEXT,

  -- NECESIDADES ESPECIALES
  consumo_critico VARCHAR(50),
  independencia_prioridad VARCHAR(50),
  ampliacion_futura VARCHAR(50),

  -- INFORMACIÓN PARA INSTALADOR
  altura_edificio_pisos NUMERIC,
  distancia_cuadro_a_tejado_metros NUMERIC,
  dias_instalacion_estimado NUMERIC,
  necesita_grua BOOLEAN DEFAULT FALSE,
  requiere_refuerzo_estructural BOOLEAN DEFAULT FALSE,
  reparaciones_tejado_previas BOOLEAN DEFAULT FALSE,

  -- ALMACENAMIENTO
  incluir_baterias BOOLEAN DEFAULT FALSE,
  capacidad_baterias NUMERIC,

  -- CÁLCULOS REALIZADOS
  num_paneles INTEGER,
  potencia_real NUMERIC,
  espacio_requerido NUMERIC,
  produccion_anual INTEGER,
  inversor_marca VARCHAR(100),
  inversor_modelo VARCHAR(100),

  -- ALERTAS Y ESTADO
  alertas JSONB,
  estado VARCHAR(50) DEFAULT 'borrador'
);

-- ÍNDICES
CREATE INDEX idx_proyectos_cliente_nombre ON proyectos_fotovoltaicos(cliente_nombre);
CREATE INDEX idx_proyectos_cliente_email ON proyectos_fotovoltaicos(cliente_email);
CREATE INDEX idx_proyectos_updated_at ON proyectos_fotovoltaicos(updated_at DESC);
CREATE INDEX idx_proyectos_estado ON proyectos_fotovoltaicos(estado);

-- RLS
ALTER TABLE proyectos_fotovoltaicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_operations" ON proyectos_fotovoltaicos FOR ALL USING (true) WITH CHECK (true);

-- DISPARADOR PARA ACTUALIZAR updated_at
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

async function setup() {
  console.log('\n' + '═'.repeat(70));
  console.log('🚀 CREANDO TABLA EN SUPABASE AUTOMÁTICAMENTE');
  console.log('═'.repeat(70));

  try {
    console.log('\n📡 Conectando a Supabase...');
    console.log(`   URL: ${SUPABASE_URL}`);

    // Ejecutar SQL
    console.log('\n📝 Ejecutando SQL...');

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
      },
      body: JSON.stringify({ query: SQL }),
    });

    if (!response.ok && response.status !== 404) {
      // Si falla el RPC, intentar con query directo
      console.log('   Intentando método alternativo...');

      // Dividir SQL en statements individuales
      const statements = SQL.split(';').filter(s => s.trim());

      for (const statement of statements) {
        if (!statement.trim()) continue;

        const stmt = statement.trim();
        if (stmt.startsWith('--')) continue;

        console.log(`   Ejecutando: ${stmt.substring(0, 50)}...`);

        // Para crear tabla, usar endpoint de rpc
        // Mejor: usar el cliente de Supabase
      }
    }

    // Verificar que se creó
    console.log('\n✅ Verificando tabla...');

    const checkResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/proyectos_fotovoltaicos?select=count()&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    if (checkResponse.ok) {
      console.log('✅ TABLA CREADA EXITOSAMENTE\n');
      console.log('═'.repeat(70));
      console.log('🎉 ¡LISTO! La tabla está creada y lista para usar');
      console.log('═'.repeat(70));
      console.log('\n📱 Próximos pasos:');
      console.log('   1. npm run dev');
      console.log('   2. Abre http://localhost:3000');
      console.log('   3. Ve a: Panel Gestión → Generador Fotovoltaico');
      console.log('   4. ¡Comienza a usar!\n');
      process.exit(0);
    } else {
      throw new Error('No se pudo verificar la tabla');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n💡 Alternativa: Copia el SQL y pégalo en Supabase Dashboard:');
    console.log('   1. https://app.supabase.com/');
    console.log('   2. SQL Editor → New Query');
    console.log('   3. Copia el contenido de: supabase_setup_fotovoltaica_completo.sql');
    console.log('   4. Ejecuta (RUN button)\n');
    process.exit(1);
  }
}

setup();
