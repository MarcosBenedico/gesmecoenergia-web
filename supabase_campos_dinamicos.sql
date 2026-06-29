-- ============================================================
-- SISTEMA DE CAMPOS DINÁMICOS - GESMECO ENERGÍA
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Tabla de metadata: define qué campos existen
CREATE TABLE IF NOT EXISTS campos_fotovoltaica (
  id        SERIAL PRIMARY KEY,
  campo_key TEXT UNIQUE NOT NULL,        -- clave única, usada en JSONB y Excel
  label     TEXT NOT NULL,               -- etiqueta visible en el formulario
  tipo      TEXT NOT NULL DEFAULT 'text',-- text | number | select | boolean | textarea
  seccion   TEXT NOT NULL DEFAULT 'extras', -- sección en el formulario: consumo | geometria | instalacion | condiciones | extras
  orden     INTEGER DEFAULT 0,           -- orden dentro de la sección
  opciones  JSONB DEFAULT '[]',          -- para tipo=select: [{"value":"opt1","label":"Opción 1"}]
  unidad    TEXT DEFAULT '',             -- sufijo a mostrar (kWh, m², kg, etc.)
  requerido BOOLEAN DEFAULT FALSE,
  activo    BOOLEAN DEFAULT TRUE,        -- false = oculto sin borrar
  en_excel  BOOLEAN DEFAULT TRUE,        -- incluir en el Excel exportado
  placeholder TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Añadir columna de datos dinámicos a la tabla de proyectos
ALTER TABLE proyectos_fotovoltaicos
  ADD COLUMN IF NOT EXISTS datos_extras JSONB DEFAULT '{}';

-- 3. RLS (mismo patrón que la tabla principal)
ALTER TABLE campos_fotovoltaica ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_campos" ON campos_fotovoltaica;
CREATE POLICY "allow_all_campos" ON campos_fotovoltaica
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- CAMPOS DE EJEMPLO — para demostrar cómo funciona el sistema
-- Borra o edita estos ejemplos libremente desde Supabase
-- ============================================================
INSERT INTO campos_fotovoltaica
  (campo_key, label, tipo, seccion, orden, unidad, placeholder, opciones)
VALUES
  (
    'numero_facturas',
    'Nº facturas eléctricas que aportará',
    'number',
    'consumo',
    10,
    'und',
    'Ej: 3',
    '[]'
  ),
  (
    'potencia_contratada_actual',
    'Potencia contratada actualmente',
    'number',
    'consumo',
    20,
    'kW',
    'Ej: 5.5',
    '[]'
  ),
  (
    'tipo_cubierta_material',
    'Material exacto de la cubierta',
    'text',
    'geometria',
    10,
    '',
    'Ej: teja árabe, chapa grecada...',
    '[]'
  ),
  (
    'acceso_vehiculos_grandes',
    'Acceso para vehículos grandes',
    'select',
    'instalacion',
    10,
    '',
    '',
    '[{"value":"facil","label":"Fácil (camino ancho)"},{"value":"dificil","label":"Difícil (callejón, curvas)"},{"value":"imposible","label":"Imposible (solo a pie)"}]'
  ),
  (
    'tiene_perros_u_animales',
    'Hay animales sueltos en la finca',
    'boolean',
    'instalacion',
    20,
    '',
    '',
    '[]'
  ),
  (
    'observaciones_instalador',
    'Observaciones para el instalador',
    'textarea',
    'extras',
    10,
    '',
    'Notas importantes para el instalador...',
    '[]'
  )
ON CONFLICT (campo_key) DO NOTHING;

-- ============================================================
-- CÓMO AÑADIR UN CAMPO NUEVO (sin tocar código):
--
-- INSERT INTO campos_fotovoltaica
--   (campo_key, label, tipo, seccion, orden, unidad, placeholder, opciones)
-- VALUES
--   (
--     'mi_campo_nuevo',        -- clave única sin espacios
--     'Mi Campo Nuevo',        -- etiqueta visible
--     'text',                  -- text | number | select | boolean | textarea
--     'extras',                -- sección: consumo | geometria | instalacion | condiciones | extras
--     99,                      -- orden (menor = primero)
--     'm²',                    -- unidad (opcional)
--     'Escribe aquí...',       -- placeholder
--     '[]'                     -- opciones (solo para tipo=select)
--   );
--
-- → Se añade automáticamente al formulario y al Excel exportado
-- ============================================================
