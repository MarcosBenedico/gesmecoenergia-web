-- ════════════════════════════════════════════════════════════════════════
-- FOCO DEL DÍA: apartar clientes del seguimiento y fijar los de hoy
--
-- Dos cosas que una persona sabe y el sistema no:
--   · «de este no quiero saber nada por ahora» — sin borrarlo, sin perder
--     el historial y sin que siga molestando cada mañana en Mi Día;
--   · «a este quiero verlo hoy» — tenga tarea con fecha o no la tenga.
--
-- NO se toca `estado_comercial` ni `clasificacion`: apartar a alguien no
-- puede cambiar su embudo, o los informes empezarían a mentir.
--
-- Seguro de ejecutar más de una vez.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.luz_clientes
  ADD COLUMN IF NOT EXISTS seguimiento_activo boolean NOT NULL DEFAULT true,
  -- Hasta cuándo está apartado. NULL = sin fecha, hasta que alguien lo
  -- reactive a mano. Con fecha vuelve solo, que es la diferencia entre
  -- aparcar y olvidar: una pausa sin fecha nadie se acuerda de levantarla.
  ADD COLUMN IF NOT EXISTS pausado_hasta date,
  ADD COLUMN IF NOT EXISTS motivo_pausa text,
  ADD COLUMN IF NOT EXISTS pausado_por text,
  ADD COLUMN IF NOT EXISTS pausado_en timestamptz,
  -- A QUIÉN se le fija en su día. Se guarda el nombre del responsable y no
  -- un sí/no: el día es de alguien, y lo que David decide apretar hoy no
  -- tiene por qué salirle a Nicola en su pantalla.
  ADD COLUMN IF NOT EXISTS fijado_para text,
  ADD COLUMN IF NOT EXISTS fijado_en timestamptz;

-- Mi Día pregunta por estas dos en cada carga, con la cartera entera delante.
CREATE INDEX IF NOT EXISTS idx_luz_clientes_seguimiento
  ON public.luz_clientes (seguimiento_activo, pausado_hasta);
CREATE INDEX IF NOT EXISTS idx_luz_clientes_fijado
  ON public.luz_clientes (fijado_para) WHERE fijado_para IS NOT NULL;

-- Un guard que no encuentra lo que busca tiene que GRITAR, nunca callar:
-- septiembre de 2026 costó dos tablas sin auditar por un IF que dio falso
-- en silencio y aun así dijo «ejecutado correctamente».
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'luz_clientes'
     AND column_name IN ('seguimiento_activo', 'pausado_hasta', 'motivo_pausa',
                         'pausado_por', 'pausado_en', 'fijado_para', 'fijado_en');
  IF n <> 7 THEN
    RAISE EXCEPTION 'FOCO DEL DÍA: esperaba 7 columnas nuevas en luz_clientes y hay %. NO está aplicado.', n;
  END IF;
  RAISE NOTICE 'FOCO DEL DÍA aplicado: % columnas en luz_clientes. Toda la cartera queda en seguimiento activo.', n;
END $$;
