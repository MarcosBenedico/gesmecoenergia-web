-- ═══════════════════════════════════════════════════════════════════
-- Permitir que los usuarios estándar (Nicola y David) ELIMINEN TAREAS.
-- Solo tareas: el resto de tablas mantiene su política de eliminación.
-- Toda eliminación queda grabada en app_auditoria (Control General),
-- y la app exige apuntar el motivo antes de borrar.
-- Ejecutar en Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS p_eliminar ON luz_tareas;
CREATE POLICY p_eliminar ON luz_tareas FOR DELETE
  USING (tiene_permiso('crear'));  -- quien puede crear tareas, puede eliminarlas (auditado)
