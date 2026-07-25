-- ═══════════════════════════════════════════════════════════════════════════
--  MAPA DE OPORTUNIDADES (Gestión Luz)
--  Ejecutar entero en el SQL Editor de Supabase. Se puede repetir sin peligro.
--
--  Para qué: hasta ahora las granjas y naves se buscaban en el mapa público
--  cada vez, y al salir de la pantalla se perdían. Eso obligaba a repetir el
--  trabajo y hacía imposible ir descartando: lo que David rechazaba volvía a
--  aparecer a la semana siguiente.
--
--  Ahora se guardan. El barrido de una zona se hace UNA vez, y a partir de ahí
--  el mapa es vuestro: se va filtrando, marcando y descartando, y solo lo que
--  Marcos apruebe llega a las rutas de David.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS luz_prospectos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificador en OpenStreetMap ('way/123456'). Es lo que evita duplicados:
  -- barrer dos veces la misma zona actualiza, no crea otro.
  osm_id TEXT NOT NULL UNIQUE,

  nombre TEXT,
  tipo TEXT NOT NULL DEFAULT 'sin_clasificar',
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  municipio TEXT,

  -- Lo que se dedujo del mapa
  m2_construidos INTEGER DEFAULT 0,
  n_edificios INTEGER DEFAULT 1,
  nave_largo INTEGER,
  nave_ancho INTEGER,
  tiene_balsa BOOLEAN DEFAULT FALSE,
  ya_tiene_placas BOOLEAN DEFAULT FALSE,
  consumo_estimado_kwh INTEGER,
  puntuacion INTEGER DEFAULT 0,
  motivos TEXT,

  -- Ficha oficial del Catastro, cuando se haya consultado
  catastro_referencia TEXT,
  catastro_uso TEXT,
  catastro_m2 INTEGER,
  catastro_anio INTEGER,
  catastro_direccion TEXT,

  -- ── El trabajo comercial sobre el candidato ──
  -- nuevo      → recién barrido, sin mirar
  -- interesante→ Marcos lo ha revisado y vale la pena
  -- para_visitar → aprobado: aparece en el planificador de rutas de David
  -- descartado → mirado y no vale. No vuelve a molestar.
  -- convertido → ya tiene ficha de cliente
  estado TEXT NOT NULL DEFAULT 'nuevo',
  motivo_descarte TEXT,
  notas TEXT,
  responsable TEXT,

  -- Si se convirtió en cliente, a cuál
  cliente_id UUID REFERENCES luz_clientes(id) ON DELETE SET NULL,

  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW(),
  borrado_en TIMESTAMPTZ,
  borrado_por TEXT,
  borrado_con UUID,
  datos_previos JSONB
);

-- Búsquedas habituales: por estado (la cola de revisión) y por zona del mapa
CREATE INDEX IF NOT EXISTS idx_prospectos_estado ON luz_prospectos(estado);
CREATE INDEX IF NOT EXISTS idx_prospectos_tipo ON luz_prospectos(tipo);
CREATE INDEX IF NOT EXISTS idx_prospectos_zona ON luz_prospectos(lat, lon);
CREATE INDEX IF NOT EXISTS idx_prospectos_vivos ON luz_prospectos(borrado_en) WHERE borrado_en IS NULL;

-- ── Actualizar la marca de tiempo al modificar ──
CREATE OR REPLACE FUNCTION fn_prospectos_touch() RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prospectos_touch ON luz_prospectos;
CREATE TRIGGER trg_prospectos_touch
  BEFORE UPDATE ON luz_prospectos
  FOR EACH ROW EXECUTE FUNCTION fn_prospectos_touch();

-- ── Permisos: mismo criterio que el resto de Gestión Luz ──
ALTER TABLE luz_prospectos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prospectos_todo_autenticados" ON luz_prospectos;
CREATE POLICY "prospectos_todo_autenticados" ON luz_prospectos
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── Comprobación ──
SELECT
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'luz_prospectos') AS tabla_creada,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'luz_prospectos') AS columnas,
  (SELECT COUNT(*) FROM luz_prospectos) AS oportunidades_guardadas;
