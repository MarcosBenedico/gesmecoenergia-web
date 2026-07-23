-- ═══════════════════════════════════════════════════════════════════
-- PROYECTOS DE LUZ · Automatizador de proyectos de ahorro
--
-- Guarda cada proyecto (CUPS ofertados, consumos e importes por mes,
-- oferta a precio fijo 12 meses y oferta indexada) para poder
-- recuperarlo, editarlo y regenerar el documento del cliente.
--
-- Ejecutar UNA VEZ en Supabase → SQL Editor. Idempotente.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS luz_proyectos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES luz_clientes(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  datos JSONB NOT NULL DEFAULT '{}'::jsonb,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_luz_proyectos_cliente ON luz_proyectos(cliente_id);

-- RLS: mismo patrón que el resto del panel
ALTER TABLE luz_proyectos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_ver ON luz_proyectos;
DROP POLICY IF EXISTS p_crear ON luz_proyectos;
DROP POLICY IF EXISTS p_modificar ON luz_proyectos;
DROP POLICY IF EXISTS p_eliminar ON luz_proyectos;
CREATE POLICY p_ver ON luz_proyectos FOR SELECT USING (tiene_permiso('ver'));
CREATE POLICY p_crear ON luz_proyectos FOR INSERT WITH CHECK (tiene_permiso('crear'));
CREATE POLICY p_modificar ON luz_proyectos FOR UPDATE USING (tiene_permiso('modificar'));
CREATE POLICY p_eliminar ON luz_proyectos FOR DELETE USING (tiene_permiso('crear'));

-- Auditoría (si la función existe)
DO $$
BEGIN
  IF to_regprocedure('fn_auditar()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS tg_auditar_luz_proyectos ON luz_proyectos;
    CREATE TRIGGER tg_auditar_luz_proyectos
      AFTER INSERT OR UPDATE OR DELETE ON luz_proyectos
      FOR EACH ROW EXECUTE FUNCTION fn_auditar();
  END IF;
END $$;
