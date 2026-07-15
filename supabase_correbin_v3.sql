-- ════════════════════════════════════════════════════════════════
-- MÓDULO VENCIMIENTOS Y CARTERA (Correbin) · MIGRACIÓN v3
-- Ejecutar UNA VEZ en Supabase → SQL Editor.
-- Segura e idempotente: solo AÑADE columnas y rellena datos.
-- No borra tablas, columnas, registros ni cambia identificadores.
-- ════════════════════════════════════════════════════════════════

-- 1) Vencimientos: nº de póliza y compañía en el propio evento.
--    (Para vencimientos importados sin póliza vinculada; si hay
--    póliza vinculada, la app también lee de vct_polizas.)
ALTER TABLE vct_vencimientos
  ADD COLUMN IF NOT EXISTS numero_poliza TEXT,
  ADD COLUMN IF NOT EXISTS compania TEXT;

-- 2) Backfill: copiar nº de póliza y compañía desde la póliza vinculada
--    en los vencimientos que ya existen (solo donde están vacíos).
UPDATE vct_vencimientos v
SET numero_poliza = COALESCE(v.numero_poliza, p.numero_poliza),
    compania      = COALESCE(v.compania, p.compania)
FROM vct_polizas p
WHERE v.poliza_id = p.id
  AND (v.numero_poliza IS NULL OR v.compania IS NULL);

-- 3) Tareas: los estados nuevos (pendiente / emitido / bloqueada / exclusion)
--    no requieren cambio de esquema (la columna estado es TEXT).
--    Los estados históricos (en_curso, completada, cancelada) NO se tocan:
--    la aplicación los muestra con su equivalente actual.

-- 4) "Tipo de empresa" en importación de vencimientos: se guarda en el campo
--    ya existente vct_clientes.tipo (sin duplicar información).

-- Índice útil para búsquedas por nº de póliza en vencimientos.
CREATE INDEX IF NOT EXISTS idx_vct_venc_numero_poliza
  ON vct_vencimientos (numero_poliza) WHERE numero_poliza IS NOT NULL;
