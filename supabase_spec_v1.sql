-- ═══════════════════════════════════════════════════════════════════════════
-- GESMECO · CAMBIOS DE LA ESPECIFICACIÓN FUNCIONAL (v1.0, 9 sept 2026)
--
-- Todo lo de aquí es ADITIVO: añade columnas con valor por defecto y no toca
-- ni borra ningún dato existente. Se puede ejecutar dos veces sin efecto.
--
-- Qué hace y por qué:
--
--   1. `app_usuarios.funcion` — la clase de trabajo (calle / oficina /
--      dirección), que NO es lo mismo que el rol de permisos. Había nombres de
--      personas escritos en el código como responsable por defecto, y eso le
--      crea trabajo a alguien que puede no estar: la lista parece repartida y
--      no lo está, y entonces se deja de mirar.
--
--   2. `fv_presupuestos.descuento` — el descuento comercial deja de hacerse
--      bajando el recargo. Mezclarlos borra cuánto se ha regalado y descuadra
--      el margen de todos los informes.
--
--   3. Índices para las dos consultas que más van a crecer: el preaviso por
--      suministro y las comisiones por fecha de cobro.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. La función de cada persona ──────────────────────────────────────────
ALTER TABLE app_usuarios ADD COLUMN IF NOT EXISTS funcion text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'app_usuarios' AND constraint_name = 'app_usuarios_funcion_valida'
  ) THEN
    ALTER TABLE app_usuarios
      ADD CONSTRAINT app_usuarios_funcion_valida
      CHECK (funcion IS NULL OR funcion IN ('calle', 'oficina', 'direccion'));
    RAISE NOTICE 'app_usuarios.funcion: restricción creada.';
  ELSE
    RAISE NOTICE 'app_usuarios.funcion: la restricción ya existía, no se toca.';
  END IF;
END $$;

COMMENT ON COLUMN app_usuarios.funcion IS
  'Clase de trabajo: calle | oficina | direccion. NO es el rol de permisos '
  '(admin/estandar/lectura), que dice qué puede tocar. Sin este valor, la '
  'aplicación la supone a partir del rol y lo marca como suposición.';

-- ── 2. El descuento comercial de FV ────────────────────────────────────────
ALTER TABLE fv_presupuestos ADD COLUMN IF NOT EXISTS descuento numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN fv_presupuestos.descuento IS
  'Descuento comercial en €, sin IVA, restado DESPUÉS del recargo y ANTES del '
  'IVA. Va aparte del recargo a propósito: bajar el recargo para hacer un '
  'precio esconde cuánto se ha regalado.';

-- El nombre de la columna se conserva por compatibilidad, pero conviene que
-- diga lo que es: 10.000 € + 25 % = 12.500 €, y el margen sobre venta es 20 %.
COMMENT ON COLUMN fv_presupuestos.margen_pct IS
  'RECARGO SOBRE COSTE en %, no margen sobre venta. Coste 10.000 € + 25 % = '
  '12.500 € netos, cuyo margen sobre venta es del 20 %. Los dos números '
  'describen el mismo trato y no son intercambiables.';

-- ── 3. Índices de lo que más se consulta ───────────────────────────────────
-- El preaviso se recalcula en vivo desde el CUPS en la Agenda, el Dashboard y
-- las automatizaciones: sin índice, cada pantalla recorre la tabla entera.
CREATE INDEX IF NOT EXISTS idx_luz_cups_preaviso
  ON luz_cups (fecha_limite_preaviso)
  WHERE fecha_limite_preaviso IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_luz_comisiones_cobro
  ON luz_comisiones (fecha_prevista_cobro, estado_comision)
  WHERE borrado_en IS NULL;

-- ── Comprobación final ─────────────────────────────────────────────────────
-- Un guard que no encuentra lo que busca tiene que GRITAR, nunca callar: es el
-- fallo que dejó dos tablas sin auditar diciendo «ejecutado correctamente».
DO $$
DECLARE faltan text := '';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'app_usuarios' AND column_name = 'funcion')
    THEN faltan := faltan || ' app_usuarios.funcion'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'fv_presupuestos' AND column_name = 'descuento')
    THEN faltan := faltan || ' fv_presupuestos.descuento'; END IF;

  IF faltan <> '' THEN
    RAISE EXCEPTION 'NO SE APLICÓ TODO. Faltan:%', faltan;
  END IF;
  RAISE NOTICE 'OK: funcion, descuento e índices en su sitio.';
END $$;
