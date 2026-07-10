-- Normaliza todos los códigos CUPS existentes (mayúsculas, sin espacios)
-- Ejecuta esto en el SQL Editor de Supabase después del fix del código
UPDATE suministros
SET cups = UPPER(TRIM(REGEXP_REPLACE(cups, '\s+', '', 'g')))
WHERE cups IS NOT NULL AND cups != '';

-- Verifica que se normalizaron correctamente (debería mostrar todos los CUPS)
SELECT cups, COUNT(*) as cantidad FROM suministros GROUP BY cups ORDER BY cups;
