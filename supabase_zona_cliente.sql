-- ═══════════════════════════════════════════════════════════════════
-- ZONA MANUAL DEL CLIENTE
--
-- Guarda la zona de actuación elegida a mano en la ficha del cliente.
-- Si está rellena, MANDA sobre la detección automática (pueblo de la
-- dirección o cercanía en el mapa). Si está vacía, se sigue detectando sola.
--
-- Valores: binefar · san-esteban-estadilla · tamarite-alcampell ·
--          alfarras-almacelles · alcarras-fraga · esplus-osso · binaced-monzon
--
-- Ejecutar UNA VEZ en Supabase → SQL Editor. Idempotente.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE luz_clientes ADD COLUMN IF NOT EXISTS zona TEXT;

CREATE INDEX IF NOT EXISTS idx_luz_clientes_zona ON luz_clientes(zona);
