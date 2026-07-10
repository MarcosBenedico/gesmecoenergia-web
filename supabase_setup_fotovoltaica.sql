-- Crear tabla para proyectos fotovoltaicos
CREATE TABLE IF NOT EXISTS proyectos_fotovoltaicos (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Datos del cliente
  cliente_nombre TEXT NOT NULL,
  cliente_email TEXT,
  cliente_telefono TEXT,
  cliente_ubicacion TEXT NOT NULL,
  cliente_direccion TEXT,
  cliente_ubicacion_gps TEXT,
  cliente_descripcion TEXT,
  
  -- Especificaciones técnicas
  consumo_anual NUMERIC,
  potencia_deseada NUMERIC,
  fase_sistema VARCHAR(10),
  tipo_tejado VARCHAR(50),
  espacio_disponible NUMERIC,
  presupuesto_maximo NUMERIC,
  
  -- Análisis técnico detallado
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
  
  -- Condiciones climáticas
  clima_viento BOOLEAN DEFAULT FALSE,
  clima_nieve BOOLEAN DEFAULT FALSE,
  clima_salinidad BOOLEAN DEFAULT FALSE,
  clima_polvo BOOLEAN DEFAULT FALSE,
  dificultades_especiales TEXT,
  
  -- Necesidades especiales
  consumo_critico VARCHAR(50),
  independencia_prioridad VARCHAR(50),
  ampliacion_futura VARCHAR(50),
  
  -- Sistema de almacenamiento
  incluir_baterias BOOLEAN DEFAULT FALSE,
  capacidad_baterias NUMERIC,
  
  -- Cálculos realizados
  num_paneles INTEGER,
  potencia_real NUMERIC,
  espacio_requerido NUMERIC,
  produccion_anual INTEGER,
  inversor_marca VARCHAR(100),
  inversor_modelo VARCHAR(100),
  
  -- Costos (guardados como JSONB para flexibilidad)
  costos_fase1 JSONB,
  costos_fase2 JSONB,
  costo_total NUMERIC,
  
  -- Validaciones y alertas
  alertas JSONB,
  
  -- Estado del proyecto
  estado VARCHAR(50) DEFAULT 'borrador'
);

-- Crear índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_proyectos_cliente_nombre ON proyectos_fotovoltaicos(cliente_nombre);
CREATE INDEX IF NOT EXISTS idx_proyectos_updated_at ON proyectos_fotovoltaicos(updated_at DESC);

-- Habilitar RLS
ALTER TABLE proyectos_fotovoltaicos ENABLE ROW LEVEL SECURITY;

-- Política para permitir todos (ajustar según necesidad)
CREATE POLICY "Allow all operations" ON proyectos_fotovoltaicos
  FOR ALL USING (true) WITH CHECK (true);
