-- ═══════════════════════════════════════════════════════════════════════════
--  CONSUMO REAL · DATADIS (Gestión Luz)
--  Ejecutar entero en el SQL Editor de Supabase. Se puede repetir sin peligro.
--
--  Para qué: hasta ahora el consumo y las potencias de cada CUPS salían de leer
--  una factura, con lo que eso tiene de foto de un mes suelto y de teclear a
--  mano. Datadis da el dato de la propia distribuidora —curva hora a hora,
--  maxímetro por periodo y las potencias contratadas de verdad— gratis y sin
--  instalar ningún aparato, con la única condición de que el titular nos
--  autorice en su panel de datadis.es.
--
--  Con eso, dos cosas dejan de ser una estimación y pasan a ser un cálculo:
--    · La potencia contratada. Casi todo el mundo paga kW que no ha usado
--      nunca, y eso se ve en un maxímetro pero no en una factura.
--    · El `pct_autoconsumo` de la calculadora FV, que era una hipótesis escrita
--      a mano y ahora puede salir del reparto horario real del cliente.
--
--  QUÉ HACE FALTA ADEMÁS DE ESTE SQL:
--    · Variables de entorno DATADIS_USER y DATADIS_PASSWORD (la cuenta de
--      empresa de Gesmeco en datadis.es).
--    · Que CADA cliente haya autorizado nuestro NIF en su panel de Datadis.
--      Sin eso, Datadis devuelve una lista vacía para ese cliente. No hay
--      atajo por API: es el permiso del titular y lo da él.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── CURVA HORARIA ──────────────────────────────────────────────────────────
-- Una fila por CUPS, día y hora. Es la tabla que crece: ~8.760 filas por CUPS
-- y año. Con 300 CUPS y 2 años son ~5,3 M de filas, que Postgres lleva de sobra
-- con los índices de abajo, pero conviene no traer más años de los que se van
-- a usar.
--
-- `metodo` es el sello de la distribuidora: Real o Estimada. NO se rellenan
-- huecos ni se promedia por encima. Un maxímetro inventado se traduce en una
-- potencia mal contratada y en una penalización real en la factura del cliente.
CREATE TABLE IF NOT EXISTS luz_datadis_curva (
  id BIGSERIAL PRIMARY KEY,
  cups TEXT NOT NULL,
  fecha DATE NOT NULL,
  -- Hora de inicio del tramo, 'HH:MM'. El '24:00' de Datadis se guarda como
  -- '00:00' del día siguiente, que es lo que significa.
  hora TEXT NOT NULL,
  consumo_kwh NUMERIC NOT NULL DEFAULT 0,
  -- Vertido a red. NULL cuando el punto no tiene autoconsumo (distinto de 0).
  excedente_kwh NUMERIC,
  metodo TEXT NOT NULL DEFAULT 'Real',
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Antiduplicados y a la vez lo que hace la sincronización idempotente: volver a
-- pedir un mes ya guardado actualiza, no duplica.
CREATE UNIQUE INDEX IF NOT EXISTS uq_datadis_curva
  ON luz_datadis_curva (cups, fecha, hora);
CREATE INDEX IF NOT EXISTS idx_datadis_curva_cups_fecha
  ON luz_datadis_curva (cups, fecha);

-- ── MAXÍMETRO ──────────────────────────────────────────────────────────────
-- El máximo de potencia por periodo, con el día y la hora en que se alcanzó.
--
-- ESTA ES LA TABLA BUENA PARA AJUSTAR POTENCIAS, y no la curva: el periodo lo
-- asigna la propia distribuidora (sin que tengamos que replicar su calendario
-- de festivos) y el máximo es el cuartohorario que ella factura. De la curva
-- horaria solo se puede deducir un promedio, que aplana los picos.
CREATE TABLE IF NOT EXISTS luz_datadis_maximetro (
  id BIGSERIAL PRIMARY KEY,
  cups TEXT NOT NULL,
  fecha DATE NOT NULL,
  hora TEXT,
  potencia_kw NUMERIC NOT NULL,
  periodo SMALLINT NOT NULL,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_datadis_maximetro
  ON luz_datadis_maximetro (cups, fecha, periodo);
CREATE INDEX IF NOT EXISTS idx_datadis_maximetro_cups
  ON luz_datadis_maximetro (cups, fecha DESC);

-- ── REACTIVA ───────────────────────────────────────────────────────────────
-- Solo la tienen algunos puntos de medida. Si el endpoint no la da, esta tabla
-- se queda vacía para ese CUPS y no pasa nada: el diagnóstico simplemente dice
-- que no hay dato.
CREATE TABLE IF NOT EXISTS luz_datadis_reactiva (
  id BIGSERIAL PRIMARY KEY,
  cups TEXT NOT NULL,
  fecha DATE NOT NULL,
  -- kVArh por periodo, P1..P6 en orden.
  reactiva_por_periodo NUMERIC[] NOT NULL DEFAULT '{}',
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_datadis_reactiva
  ON luz_datadis_reactiva (cups, fecha);

-- ── DIARIO DE SINCRONIZACIÓN ───────────────────────────────────────────────
-- Datadis raciona: la misma consulta repetida antes de 24 h devuelve 429. Sin
-- este diario, la pantalla gastaría el turno del día en volver a pedir meses
-- que ya están, y encima parecería que algo se ha roto.
--
-- Se apunta también lo que SALIÓ MAL y por qué, porque «sin autorización» y
-- «racionado» se arreglan de formas distintas y sin registro no se distinguen.
CREATE TABLE IF NOT EXISTS luz_datadis_sync (
  id BIGSERIAL PRIMARY KEY,
  cups TEXT NOT NULL,
  -- 'curva' | 'maximetro' | 'reactiva' | 'contrato' | 'suministros'
  tipo TEXT NOT NULL,
  -- Mes pedido, 'YYYY/MM'. NULL en lo que no va por meses (contrato).
  mes TEXT,
  -- 'ok' | 'vacio' | 'racionado' | 'sin_autorizacion' | 'error'
  estado TEXT NOT NULL,
  filas INTEGER DEFAULT 0,
  mensaje TEXT,
  pedido_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_datadis_sync_cups
  ON luz_datadis_sync (cups, tipo, mes, pedido_en DESC);
CREATE INDEX IF NOT EXISTS idx_datadis_sync_reciente
  ON luz_datadis_sync (pedido_en DESC);

-- ── ANÁLISIS GUARDADO ──────────────────────────────────────────────────────
-- El resultado del optimizador, congelado con la fecha en que se calculó.
--
-- Se guarda a propósito en vez de recalcularlo siempre: es lo que se le ha
-- ENSEÑADO al cliente. Si mañana cambian los precios o entran más meses de
-- curva, el número cambia, y hace falta poder mirar atrás y ver qué se le dijo
-- y con qué datos. `datos` lleva el detalle completo por periodo.
CREATE TABLE IF NOT EXISTS luz_datadis_analisis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cups_id UUID REFERENCES luz_cups(id) ON DELETE CASCADE,
  cups TEXT NOT NULL,
  tarifa TEXT,
  -- Rango que respalda el análisis
  desde DATE,
  hasta DATE,
  dias_analizados INTEGER,
  -- Lo que se enseña
  ahorro_anual NUMERIC DEFAULT 0,
  coste_actual_anual NUMERIC DEFAULT 0,
  coste_optimo_anual NUMERIC DEFAULT 0,
  penalizacion_estimada NUMERIC DEFAULT 0,
  -- 'alta' | 'media' | 'baja'. Un ahorro con confianza baja no se presenta
  -- como un presupuesto, y por eso viaja pegado a la cifra.
  confianza TEXT DEFAULT 'media',
  potencias_actuales NUMERIC[] DEFAULT '{}',
  potencias_recomendadas NUMERIC[] DEFAULT '{}',
  -- % del consumo en horas de sol: lo que la FV necesita para dejar de suponer
  pct_horas_solares NUMERIC,
  datos JSONB,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  creado_por TEXT
);

CREATE INDEX IF NOT EXISTS idx_datadis_analisis_cups
  ON luz_datadis_analisis (cups, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_datadis_analisis_ahorro
  ON luz_datadis_analisis (ahorro_anual DESC);

-- ── LO QUE HAY QUE AÑADIR A LAS TABLAS QUE YA EXISTEN ──────────────────────
-- El código de distribuidora y el tipo de punto los da Datadis en
-- `get-supplies` y hacen falta en casi todas las demás llamadas. Se guardan en
-- el CUPS para no tener que pedir la lista entera en cada sincronización.
ALTER TABLE luz_cups ADD COLUMN IF NOT EXISTS datadis_distribuidora_codigo TEXT;
ALTER TABLE luz_cups ADD COLUMN IF NOT EXISTS datadis_point_type SMALLINT;
ALTER TABLE luz_cups ADD COLUMN IF NOT EXISTS datadis_ultima_sync TIMESTAMPTZ;

-- La autorización es del cliente, no del CUPS: cuando autoriza nuestro NIF en
-- Datadis, se abren todos sus suministros de golpe.
ALTER TABLE luz_clientes ADD COLUMN IF NOT EXISTS datadis_autorizado BOOLEAN DEFAULT FALSE;
ALTER TABLE luz_clientes ADD COLUMN IF NOT EXISTS datadis_comprobado_en TIMESTAMPTZ;

-- ── Permisos: mismo criterio que el resto de Gestión Luz ───────────────────
-- Si `tiene_permiso` existe (lo crea supabase_rls_v2.sql), se usa el mismo
-- criterio por rol que el resto del panel. Si no, se cierra al menos a usuarios
-- autenticados, para que estas tablas no nazcan abiertas.
DO $$
DECLARE
  t TEXT;
  hay_permisos BOOLEAN := EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'tiene_permiso'
  );
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'luz_datadis_curva','luz_datadis_maximetro','luz_datadis_reactiva',
    'luz_datadis_sync','luz_datadis_analisis'
  ] LOOP
    IF to_regclass(t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS p_ver ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS p_crear ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS p_modificar ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS p_eliminar ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS p_todo_autenticados ON %I', t);

    IF hay_permisos THEN
      EXECUTE format('CREATE POLICY p_ver ON %I FOR SELECT USING (tiene_permiso(''ver''))', t);
      EXECUTE format('CREATE POLICY p_crear ON %I FOR INSERT WITH CHECK (tiene_permiso(''crear''))', t);
      EXECUTE format('CREATE POLICY p_modificar ON %I FOR UPDATE USING (tiene_permiso(''modificar''))', t);
      EXECUTE format('CREATE POLICY p_eliminar ON %I FOR DELETE USING (tiene_permiso(''eliminar''))', t);
    ELSE
      EXECUTE format(
        'CREATE POLICY p_todo_autenticados ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t
      );
    END IF;
  END LOOP;
END $$;

-- ── Comprobación ───────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_name LIKE 'luz_datadis_%') AS tablas_creadas,
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'luz_cups' AND column_name LIKE 'datadis_%') AS columnas_en_cups,
  (SELECT COUNT(*) FROM luz_datadis_curva) AS horas_guardadas,
  (SELECT COUNT(*) FROM luz_datadis_maximetro) AS maximetros_guardados;
