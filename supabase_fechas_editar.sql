-- ═══════════════════════════════════════════════════════════════════
-- Permitir EDITAR y ELIMINAR FECHAS CRÍTICAS a los usuarios estándar
-- (Nicola y David), igual que ya se hizo con las tareas.
-- Toda modificación/eliminación queda grabada en app_auditoria
-- (Control General), y la app exige apuntar el motivo antes de borrar.
-- Ejecutar en Supabase → SQL Editor. Idempotente.
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS p_modificar ON luz_fechas_criticas;
CREATE POLICY p_modificar ON luz_fechas_criticas FOR UPDATE
  USING (tiene_permiso('crear'));   -- quien puede crear fechas, puede editarlas (auditado)

DROP POLICY IF EXISTS p_eliminar ON luz_fechas_criticas;
CREATE POLICY p_eliminar ON luz_fechas_criticas FOR DELETE
  USING (tiene_permiso('crear'));   -- quien puede crear fechas, puede eliminarlas (auditado)
