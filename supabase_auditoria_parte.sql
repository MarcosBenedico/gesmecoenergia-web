-- ═══════════════════════════════════════════════════════════════════════════
--  AUDITORÍA COMPLETA PARA EL PARTE DEL DÍA (Gestión Luz)
--  Ejecutar entero en el SQL Editor de Supabase. Se puede repetir sin peligro.
--
--  Para qué: el parte del día (gestor/luz/parte) sale de `app_auditoria`, que
--  llenan los triggers de la base de datos. Esos triggers ya estaban puestos en
--  las tablas principales por supabase_equipo_usuarios.sql, pero faltaban tres
--  que se añadieron después y que son justo las que cuentan el trabajo de calle:
--
--    · luz_visitas    — lo que hace David cada día
--    · luz_prospectos — el mapa de oportunidades
--    · luz_proyectos  — los proyectos de ahorro
--
--  Sin esto, el parte enseña el papeleo de oficina y se deja fuera la calle.
--
--  IMPORTANTE: la auditoría se llena a partir de AHORA. Los partes de días
--  anteriores a ejecutar esto saldrán incompletos, y eso no es un fallo del
--  parte: es que ese registro no existía todavía.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Comprobación previa: la función de auditoría tiene que existir ─────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_auditar') THEN
    RAISE EXCEPTION
      'Falta la función fn_auditar. Ejecuta antes supabase_equipo_usuarios.sql.';
  END IF;
END $$;

-- ── Los triggers que faltaban ─────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'luz_visitas', 'luz_prospectos', 'luz_proyectos'
  ] LOOP
    -- Si la tabla no existe en este proyecto se salta sin romper nada
    IF to_regclass(t) IS NULL THEN
      RAISE NOTICE 'La tabla % no existe todavía: se salta.', t;
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auditoria ON %I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON %I '
      'FOR EACH ROW EXECUTE FUNCTION fn_auditar()', t);
    RAISE NOTICE 'Auditoría activada en %', t;
  END LOOP;
END $$;

-- ── Índice para que el parte de un día se saque rápido ─────────────────────
-- El parte filtra por rango de fecha y por tabla. Sin este índice, con la
-- auditoría crecida, cada consulta acaba recorriendo la tabla entera.
CREATE INDEX IF NOT EXISTS idx_auditoria_dia
  ON app_auditoria (creado_en DESC, tabla);

-- ── Comprobación ───────────────────────────────────────────────────────────
SELECT
  tabla_objetivo AS tabla,
  EXISTS (
    SELECT 1 FROM pg_trigger g
    JOIN pg_class c ON c.oid = g.tgrelid
    WHERE c.relname = tabla_objetivo AND g.tgname = 'trg_auditoria'
  ) AS auditoria_activa
FROM unnest(ARRAY[
  'luz_clientes','luz_cups','luz_pipeline','luz_contratos','luz_comisiones',
  'luz_tareas','luz_fechas_criticas','luz_visitas','luz_prospectos','luz_proyectos'
]) AS tabla_objetivo;
