-- ═══════════════════════════════════════════════════════════════════
-- VISITAS · Historial de visitas a clientes (módulo Luz)
--
-- Ejecutar UNA VEZ en Supabase → SQL Editor. Es idempotente.
--
-- Guarda cada visita con su fecha (no solo la última), para poder
-- filtrar el mapa de rutas por día de visita y ver el historial
-- en la ficha del cliente.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS luz_visitas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES luz_clientes(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  notas TEXT,
  responsable TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_luz_visitas_cliente ON luz_visitas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_luz_visitas_fecha ON luz_visitas(fecha);

-- RLS: mismo patrón que el resto de tablas del panel
ALTER TABLE luz_visitas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_ver ON luz_visitas;
DROP POLICY IF EXISTS p_crear ON luz_visitas;
DROP POLICY IF EXISTS p_modificar ON luz_visitas;
DROP POLICY IF EXISTS p_eliminar ON luz_visitas;
CREATE POLICY p_ver ON luz_visitas FOR SELECT USING (tiene_permiso('ver'));
CREATE POLICY p_crear ON luz_visitas FOR INSERT WITH CHECK (tiene_permiso('crear'));
CREATE POLICY p_modificar ON luz_visitas FOR UPDATE USING (tiene_permiso('modificar'));
CREATE POLICY p_eliminar ON luz_visitas FOR DELETE USING (tiene_permiso('crear'));

-- Auditoría (si la función existe en este proyecto)
DO $$
BEGIN
  IF to_regprocedure('fn_auditar()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS tg_auditar_luz_visitas ON luz_visitas;
    CREATE TRIGGER tg_auditar_luz_visitas
      AFTER INSERT OR UPDATE OR DELETE ON luz_visitas
      FOR EACH ROW EXECUTE FUNCTION fn_auditar();
  END IF;
END $$;
