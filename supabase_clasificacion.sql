-- ═══════════════════════════════════════════════════════════════════════════
--  OBJETIVO · PRECLIENTE · CLIENTE (Gestión Luz)
--  Ejecutar entero en el SQL Editor de Supabase. Se puede repetir sin peligro.
--
--  Para qué: hasta ahora todo el que tenía ficha era "cliente", y no es verdad.
--  Hay tres cosas distintas y conviene no mezclarlas nunca más:
--
--    · OBJETIVO   — sitio al que se puede ir. No tenemos nada suyo todavía.
--                   Es lo que mira David cuando está en una zona.
--    · PRECLIENTE — nos ha dado su información (factura, CUPS, consumo) pero
--                   NO ha firmado nada. No es cliente.
--    · CLIENTE    — ha firmado luz o placas.
--
--  OJO, NO CONFUNDIR con `estado_comercial`, que ya existe y es otro eje: ese
--  dice POR DÓNDE VA el viaje (detectado, en análisis, activo...). Este dice
--  QUÉ TIPO DE RELACIÓN ES. Los dos conviven y ninguno sustituye al otro.
--
--  POR QUÉ ES UN CAMPO Y NO UN CÁLCULO: hoy los contratos se llevan en papel y
--  en las aplicaciones de las comercializadoras, así que en el sistema hay
--  clientes de verdad sin un solo contrato registrado. Un cálculo diría que son
--  preclientes y estaría equivocado. Manda lo que marque una persona; el
--  cálculo se queda como sugerencia y avisa cuando no cuadra.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE luz_clientes
  ADD COLUMN IF NOT EXISTS clasificacion TEXT NOT NULL DEFAULT 'precliente';

-- Solo estos tres valores. Sin esto, en dos meses hay 'Precliente', 'PRE' y
-- 'pre-cliente' conviviendo y ningún recuento vuelve a cuadrar.
ALTER TABLE luz_clientes DROP CONSTRAINT IF EXISTS chk_luz_clientes_clasificacion;
ALTER TABLE luz_clientes
  ADD CONSTRAINT chk_luz_clientes_clasificacion
  CHECK (clasificacion IN ('objetivo', 'precliente', 'cliente'));

CREATE INDEX IF NOT EXISTS idx_luz_clientes_clasificacion
  ON luz_clientes (clasificacion);

-- ── CARGA INICIAL ──────────────────────────────────────────────────────────
-- Lo importante de todo este archivo. Si se dejara el valor por defecto,
-- TODA la cartera nacería como "precliente", incluidos los que llevan meses
-- facturando, y el primer recuento sería mentira.
--
-- Se aplican las mismas reglas que `clasificacionSugerida()` en
-- src/lib/clasificacion.ts. Si una cambia, hay que cambiar la otra.
--
-- Se ejecuta en orden de menos a más para que la última gane: primero se marca
-- todo como objetivo, luego suben a precliente los que tienen suministros, y
-- por último a cliente los que han firmado.

-- 1. De partida, todos son objetivos.
UPDATE luz_clientes SET clasificacion = 'objetivo';

-- 2. Preclientes: tenemos al menos un suministro suyo. Que nos hayan dado la
--    factura es justo el momento en que dejan de ser una puerta.
UPDATE luz_clientes c
SET clasificacion = 'precliente'
WHERE EXISTS (SELECT 1 FROM luz_cups s WHERE s.cliente_id = c.id);

-- 3. Clientes: hay una firma detrás, por cualquiera de los tres caminos.
UPDATE luz_clientes c
SET clasificacion = 'cliente'
WHERE c.estado_comercial = 'activo'
   OR EXISTS (
        SELECT 1 FROM luz_cups s
        WHERE s.cliente_id = c.id
          AND s.estado_cups IN ('contrato_firmado', 'pendiente_activacion', 'activado')
      )
   OR EXISTS (
        SELECT 1 FROM luz_contratos k
        WHERE k.cliente_id = c.id
          AND (k.fecha_firma IS NOT NULL
               OR k.estado_contrato IN ('firmado', 'enviado_comercializadora',
                                        'pendiente_validacion', 'pendiente_activacion', 'activado'))
      );

-- ── Comprobación ───────────────────────────────────────────────────────────
-- Lo que sale aquí es el primer recuento honesto de la cartera. Si el número de
-- "cliente" parece bajo, no es un fallo del SQL: es que las firmas están en
-- papel y todavía no han llegado al sistema.
SELECT
  clasificacion,
  COUNT(*) AS cuantos,
  ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS pct
FROM luz_clientes
GROUP BY clasificacion
ORDER BY CASE clasificacion
  WHEN 'cliente' THEN 1 WHEN 'precliente' THEN 2 ELSE 3 END;
