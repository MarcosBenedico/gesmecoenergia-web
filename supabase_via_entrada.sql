-- ═══════════════════════════════════════════════════════════════════
-- VÍA DE ENTRADA · Dos tipos de cliente en la cartera de Luz
--
--   'facturas'  → ya nos ha facilitado las facturas: hacer el estudio
--                 y quedar en persona para presentarlo.
--   'captacion' → posible cliente contactado por David en sus rutas:
--                 seguimiento de factura y de fotovoltaica.
--
-- Ejecutar UNA VEZ en Supabase → SQL Editor. Idempotente.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE luz_clientes ADD COLUMN IF NOT EXISTS via_entrada TEXT;

-- Relleno inicial razonable para los clientes ya existentes:
-- si ya nos entregaron documentación (o están más adelante), son 'facturas';
-- el resto se consideran 'captacion'. Se puede corregir uno a uno en su ficha.
UPDATE luz_clientes
SET via_entrada = CASE
  WHEN estado_comercial IN ('doc_recibida', 'en_analisis', 'pendiente_decision', 'contrato_tramite', 'activo')
    THEN 'facturas'
  ELSE 'captacion'
END
WHERE via_entrada IS NULL;
