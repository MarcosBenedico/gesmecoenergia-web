-- ═══════════════════════════════════════════════════════════════════════════
--  QUÉ PASÓ EN LA VISITA (Gestión Luz)
--  Ejecutar entero en el SQL Editor de Supabase. Se puede repetir sin peligro.
--
--  Hasta ahora una visita solo guardaba la fecha: sabíamos que David estuvo,
--  pero no qué le dijeron. Eso dejaba cojo todo lo demás — lo que rechazaba
--  volvía a proponerse a la semana, Nicola se enteraba por el grupo de
--  WhatsApp o no se enteraba, y no se podía medir nada.
--
--  Con el resultado guardado se cierra el círculo: el mapa de oportunidades
--  deja de proponer lo descartado, la agenda se rellena sola cuando hay que
--  volver, y con el tiempo se podrá saber qué tipo de sitio convierte de
--  verdad, que hoy es una suposición mía.
-- ═══════════════════════════════════════════════════════════════════════════

-- no_estaba   → no había nadie. Se vuelve a pasar.
-- no_interesa → dijeron que no. No se insiste.
-- volver      → hay interés pero no era el momento.
-- factura     → nos dieron la factura. Es el resultado que vale oro.
ALTER TABLE luz_visitas ADD COLUMN IF NOT EXISTS resultado TEXT;

-- Cuándo hay que volver a pasar (solo para 'volver' y 'no_estaba')
ALTER TABLE luz_visitas ADD COLUMN IF NOT EXISTS proxima_visita DATE;

-- Quién la resolvió desde el móvil, si difiere del responsable del cliente
ALTER TABLE luz_visitas ADD COLUMN IF NOT EXISTS registrada_por TEXT;

COMMENT ON COLUMN luz_visitas.resultado IS
  'Qué pasó: no_estaba | no_interesa | volver | factura. Nulo en las visitas antiguas, anteriores a que se registrara.';

-- Para los recuentos de conversión por resultado
CREATE INDEX IF NOT EXISTS idx_luz_visitas_resultado ON luz_visitas(resultado);

-- ── Motivo del descarte de una oportunidad ──
-- La columna ya existía en luz_prospectos; este índice es para poder contar
-- por qué se descartan y detectar si el detector se equivoca en algo.
CREATE INDEX IF NOT EXISTS idx_prospectos_motivo_descarte
  ON luz_prospectos(motivo_descarte) WHERE motivo_descarte IS NOT NULL;

-- ── Comprobación ──
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name = 'luz_visitas' AND column_name IN ('resultado', 'proxima_visita', 'registrada_por')) AS columnas_nuevas,
  (SELECT COUNT(*) FROM luz_visitas) AS visitas_registradas,
  (SELECT COUNT(*) FROM luz_visitas WHERE resultado IS NOT NULL) AS con_resultado;
