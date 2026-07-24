-- ═══════════════════════════════════════════════════════════════════
-- TARIFAS CON VIGENCIA · Varias ofertas de precios por comercializadora
--
-- Cada fila de precios puede tener su periodo de validez
-- (p. ej. del 01/08/2026 al 31/07/2027), y una misma comercializadora
-- puede tener varias ofertas de la misma tarifa con fechas distintas.
--
-- Ejecutar UNA VEZ en Supabase → SQL Editor. Idempotente.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE precios_comercializadoras ADD COLUMN IF NOT EXISTS fecha_inicio DATE;
ALTER TABLE precios_comercializadoras ADD COLUMN IF NOT EXISTS fecha_fin DATE;

-- Si existiera una restricción única (una sola oferta por comercializadora
-- y tarifa), se elimina para permitir varias ofertas con fechas distintas.
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'precios_comercializadoras'::regclass AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE precios_comercializadoras DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
