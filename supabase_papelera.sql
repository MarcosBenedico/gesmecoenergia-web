-- ═══════════════════════════════════════════════════════════════════════════
--  PAPELERA DE GESTIÓN LUZ
--  Ejecutar entero en el SQL Editor de Supabase. Se puede repetir sin peligro.
--
--  Problema que resuelve: hasta ahora "Eliminar" borraba de verdad, y como
--  luz_cups y luz_fechas_criticas cuelgan del cliente con ON DELETE CASCADE,
--  borrar un cliente se llevaba por delante todos sus suministros y fechas.
--  Sin vuelta atrás: la auditoría te decía qué había pasado, pero no te lo
--  devolvía.
--
--  A partir de aquí nada se borra físicamente: se marca con fecha de borrado
--  y desaparece de las pantallas, pero sigue ahí y se puede restaurar.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Columnas de papelera en las tablas con datos de negocio ──
--    borrado_en    → cuándo se envió a la papelera (NULL = está vivo)
--    borrado_por   → quién lo mandó
--    motivo_borrado→ por qué (se pide al eliminar)
--    borrado_con   → id del registro que lo arrastró en cascada; sirve para
--                    que al restaurar el padre vuelvan exactamente los hijos
--                    que se fueron con él, y no los que ya estaban borrados.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'luz_clientes', 'luz_cups', 'luz_fechas_criticas', 'luz_pipeline',
    'luz_contratos', 'luz_comisiones', 'luz_tareas', 'luz_visitas', 'luz_proyectos'
  ] LOOP
    IF to_regclass(t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS borrado_en TIMESTAMPTZ', t);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS borrado_por TEXT', t);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS motivo_borrado TEXT', t);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS borrado_con TEXT', t);
      -- Índice parcial: las consultas normales solo miran lo vivo
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON %I (borrado_en) WHERE borrado_en IS NULL',
        'idx_' || t || '_vivos', t
      );
    END IF;
  END LOOP;
END $$;

-- ── 2. La auditoría tiene que seguir distinguiendo un borrado ──
-- Antes el trigger miraba TG_OP: un borrado era un DELETE de verdad. Ahora un
-- borrado es un UPDATE que rellena borrado_en, así que hay que detectarlo o el
-- filtro "solo eliminaciones" del Control General se quedaría vacío.
CREATE OR REPLACE FUNCTION fn_auditar()
RETURNS TRIGGER AS $$
DECLARE
  v_usuario TEXT;
  v_accion  TEXT;
BEGIN
  -- Mismo criterio que la versión anterior para identificar al usuario
  -- (con NULLIF para no reventar si el ajuste llega vacío en vez de nulo)
  v_usuario := COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
    'sistema'
  );

  IF TG_OP = 'DELETE' THEN
    INSERT INTO app_auditoria(usuario, accion, tabla, registro_id, antes)
    VALUES (v_usuario, 'DELETE', TG_TABLE_NAME, OLD.id::text, to_jsonb(OLD));
    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    -- jsonb_exists en vez del operador "?": mismo resultado, pero "?" lo
    -- interpretan como marcador de parámetro algunos clientes SQL.
    -- Las tablas sin papelera (responsables, usuarios) caen solas en 'UPDATE'.
    IF jsonb_exists(to_jsonb(OLD), 'borrado_en') THEN
      IF  (to_jsonb(OLD) ->> 'borrado_en') IS NULL
      AND (to_jsonb(NEW) ->> 'borrado_en') IS NOT NULL THEN
        v_accion := 'DELETE';    -- se ha ido a la papelera
      ELSIF (to_jsonb(OLD) ->> 'borrado_en') IS NOT NULL
        AND (to_jsonb(NEW) ->> 'borrado_en') IS NULL THEN
        v_accion := 'RESTORE';   -- ha vuelto de la papelera
      ELSE
        v_accion := 'UPDATE';
      END IF;
    ELSE
      v_accion := 'UPDATE';
    END IF;

    INSERT INTO app_auditoria(usuario, accion, tabla, registro_id, antes, despues)
    VALUES (v_usuario, v_accion, TG_TABLE_NAME, NEW.id::text, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;

  ELSE
    INSERT INTO app_auditoria(usuario, accion, tabla, registro_id, despues)
    VALUES (v_usuario, 'INSERT', TG_TABLE_NAME, NEW.id::text, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. Comprobación ──
-- Debe devolver una fila por tabla con las 4 columnas nuevas a TRUE.
SELECT
  c.relname AS tabla,
  bool_or(a.attname = 'borrado_en')     AS tiene_borrado_en,
  bool_or(a.attname = 'borrado_por')    AS tiene_borrado_por,
  bool_or(a.attname = 'motivo_borrado') AS tiene_motivo,
  bool_or(a.attname = 'borrado_con')    AS tiene_borrado_con
FROM pg_class c
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
WHERE c.relname IN (
  'luz_clientes', 'luz_cups', 'luz_fechas_criticas', 'luz_pipeline',
  'luz_contratos', 'luz_comisiones', 'luz_tareas', 'luz_visitas', 'luz_proyectos'
)
GROUP BY c.relname
ORDER BY c.relname;
