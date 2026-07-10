-- ============================================
-- TABLA PROYECTOS FOTOVOLTAICOS - COMPLETA
-- ============================================

DROP TABLE IF EXISTS proyectos_fotovoltaicos CASCADE;

CREATE TABLE proyectos_fotovoltaicos (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- ===== DATOS DEL CLIENTE =====
  cliente_nombre TEXT NOT NULL,
  cliente_email TEXT,
  cliente_telefono TEXT,
  cliente_ubicacion TEXT NOT NULL,
  cliente_direccion TEXT,
  cliente_ubicacion_gps TEXT,
  cliente_descripcion TEXT,

  -- ===== ESPECIFICACIONES TÉCNICAS =====
  consumo_anual NUMERIC,
  potencia_deseada NUMERIC,
  fase_sistema VARCHAR(10),
  tipo_tejado VARCHAR(50),
  espacio_disponible NUMERIC,
  presupuesto_maximo NUMERIC,

  -- ===== ANÁLISIS TÉCNICO DETALLADO =====
  -- Accesibilidad y Logística
  acceso_tejado VARCHAR(50),
  distancia_cuadro_electrico VARCHAR(50),
  espacio_almacenamiento VARCHAR(50),
  andamiaje_necesario VARCHAR(50),

  -- Condiciones del Tejado
  orientacion_tejado VARCHAR(50),
  inclinacion_tejado VARCHAR(50),
  sombreado VARCHAR(50),
  estado_tejado VARCHAR(50),
  carga_tejado_maxima NUMERIC,
  presencia_amianto VARCHAR(50),

  -- Instalación Eléctrica
  cuadro_accesible VARCHAR(50),
  tierra_adecuada VARCHAR(50),
  acometida_cambio VARCHAR(50),
  distancia_cableado VARCHAR(50),

  -- ===== CONDICIONES CLIMÁTICAS =====
  clima_viento BOOLEAN DEFAULT FALSE,
  clima_nieve BOOLEAN DEFAULT FALSE,
  clima_salinidad BOOLEAN DEFAULT FALSE,
  clima_polvo BOOLEAN DEFAULT FALSE,
  dificultades_especiales TEXT,

  -- ===== NECESIDADES ESPECIALES =====
  consumo_critico VARCHAR(50),
  independencia_prioridad VARCHAR(50),
  ampliacion_futura VARCHAR(50),

  -- ===== INFORMACIÓN DE VALOR PARA INSTALADOR =====
  altura_edificio_pisos NUMERIC,
  distancia_cuadro_a_tejado_metros NUMERIC,
  dias_instalacion_estimado NUMERIC,
  necesita_grua BOOLEAN DEFAULT FALSE,
  requiere_refuerzo_estructural BOOLEAN DEFAULT FALSE,
  reparaciones_tejado_previas BOOLEAN DEFAULT FALSE,

  -- ===== SISTEMA DE ALMACENAMIENTO =====
  incluir_baterias BOOLEAN DEFAULT FALSE,
  capacidad_baterias NUMERIC,

  -- ===== CÁLCULOS REALIZADOS =====
  num_paneles INTEGER,
  potencia_real NUMERIC,
  espacio_requerido NUMERIC,
  produccion_anual INTEGER,
  inversor_marca VARCHAR(100),
  inversor_modelo VARCHAR(100),

  -- ===== COSTOS Y PRESUPUESTO =====
  costos_materiales JSONB,
  costos_mano_obra JSONB,
  costos_dificultad JSONB,
  costos_extra JSONB,

  costo_total_materiales NUMERIC,
  costo_total_mano_obra NUMERIC,
  costo_total_dificultades NUMERIC,
  costo_total_extras NUMERIC,
  costo_total NUMERIC,

  margen_recomendado NUMERIC,
  precio_final_recomendado NUMERIC,

  -- ===== VALIDACIONES Y ALERTAS =====
  alertas JSONB,

  -- ===== ESTADO DEL PROYECTO =====
  estado VARCHAR(50) DEFAULT 'borrador'
);

-- ============================================
-- ÍNDICES PARA BÚSQUEDA RÁPIDA
-- ============================================

CREATE INDEX idx_proyectos_cliente_nombre
  ON proyectos_fotovoltaicos(cliente_nombre);

CREATE INDEX idx_proyectos_cliente_email
  ON proyectos_fotovoltaicos(cliente_email);

CREATE INDEX idx_proyectos_updated_at
  ON proyectos_fotovoltaicos(updated_at DESC);

CREATE INDEX idx_proyectos_estado
  ON proyectos_fotovoltaicos(estado);

CREATE INDEX idx_proyectos_created_at
  ON proyectos_fotovoltaicos(created_at DESC);

-- ============================================
-- SEGURIDAD - ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE proyectos_fotovoltaicos ENABLE ROW LEVEL SECURITY;

-- Política: Permitir operaciones sin restricción (desarrollo)
-- En producción, reemplazar con políticas basadas en auth.uid()
CREATE POLICY "allow_all_operations" ON proyectos_fotovoltaicos
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- DISPARADORES PARA ACTUALIZAR updated_at
-- ============================================

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

-- ============================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================

COMMENT ON TABLE proyectos_fotovoltaicos IS 'Proyectos de instalación fotovoltaica - Generador PRO';
COMMENT ON COLUMN proyectos_fotovoltaicos.estado IS 'borrador, cotizado, contratado, en_instalacion, completado, cancelado';
COMMENT ON COLUMN proyectos_fotovoltaicos.costos_materiales IS 'Array JSON con desglose de materiales';
COMMENT ON COLUMN proyectos_fotovoltaicos.costos_mano_obra IS 'Array JSON con desglose de mano de obra';
COMMENT ON COLUMN proyectos_fotovoltaicos.alertas IS 'Array JSON con validaciones y alertas técnicas';

-- ============================================
-- VERIFICACIÓN FINAL
-- ============================================

SELECT
  COUNT(*) as total_proyectos,
  COUNT(CASE WHEN estado = 'borrador' THEN 1 END) as borradores,
  COUNT(CASE WHEN estado = 'cotizado' THEN 1 END) as cotizados
FROM proyectos_fotovoltaicos;
