-- ═══════════════════════════════════════════════════════════════════
-- CORREBIN · Solicitudes: campos de gestión interna (Volumen XII)
--
-- Añade a la tabla de solicitudes lo que exige el manual corporativo:
-- cada solicitud debe tener responsable, estado y SIGUIENTE PASO.
-- También la atribución comercial (de dónde vino el contacto).
--
-- Ejecutar DESPUÉS de supabase_correbin_solicitudes.sql. Idempotente:
-- si ya creaste la tabla con la versión nueva, esto no rompe nada.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE correbin_solicitudes ADD COLUMN IF NOT EXISTS siguiente_paso TEXT;
ALTER TABLE correbin_solicitudes ADD COLUMN IF NOT EXISTS fecha_siguiente_paso DATE;
ALTER TABLE correbin_solicitudes ADD COLUMN IF NOT EXISTS origen TEXT;
ALTER TABLE correbin_solicitudes ADD COLUMN IF NOT EXISTS campana TEXT;

CREATE INDEX IF NOT EXISTS idx_correbin_sol_responsable ON correbin_solicitudes(responsable);
