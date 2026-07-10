-- COPIA TODO ESTO Y PÉGALO EN SUPABASE SQL EDITOR
-- Archivo: SQL_PARA_PEGAR.sql
-- Tiempo: 10 segundos

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
