-- ═══════════════════════════════════════════════════════════════════
-- SEGUIMIENTOS · el hilo de lo que se habla con cada cliente
--
-- Ejecutar UNA VEZ en Supabase → SQL Editor. Es idempotente.
--
-- POR QUÉ HACE FALTA UNA TABLA Y NO VALE EL CAMPO DE TEXTO
--
-- Hoy los apuntes se apilan dentro de luz_clientes.observaciones con el
-- formato «[10/8/2026 10:51 · Marcos] gestionando para que nos pase la
-- factura». Eso se lee bien en una ficha y no sirve para nada más: no se
-- puede ordenar, ni contar, ni —lo que de verdad importa— responder a la
-- única pregunta que evita perder un cliente:
--
--     ¿cuántos días lleva este señor sin que nadie le hable?
--
-- Con el texto apilado esa pregunta no tiene respuesta. Con una fila por
-- apunte, es una resta.
--
-- Además separa dos cosas que hoy están mezcladas: las OBSERVACIONES son
-- lo que sabemos del cliente (tiene tres granjas, la hija lleva el tema),
-- y los SEGUIMIENTOS son lo que ha pasado (el martes le llamé y no cogió).
-- Lo primero se corrige, lo segundo se acumula y no se toca nunca.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS luz_seguimientos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    UUID NOT NULL REFERENCES luz_clientes(id) ON DELETE CASCADE,
  -- El suministro concreto, cuando el apunte va de uno en particular.
  cups_id       UUID REFERENCES luz_cups(id) ON DELETE SET NULL,

  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Por dónde se habló. Importa para el seguimiento real: un WhatsApp
  -- leído y sin contestar no es lo mismo que un teléfono que no coge.
  via           TEXT NOT NULL DEFAULT 'telefono'
                CHECK (via IN ('telefono','whatsapp','visita','email','otro')),
  con_quien     TEXT,
  que_se_hablo  TEXT NOT NULL,
  proximo_paso  TEXT,
  -- Si hay compromiso de fecha, aquí. Es lo que alimenta la agenda.
  fecha_proximo DATE,

  -- Quién lo apunta. Texto y no FK, igual que el resto del módulo, porque
  -- los responsables son nombres libres ("Marcos", "Sales", "Marcos / Sales").
  autor         TEXT,

  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  borrado_en    TIMESTAMPTZ,
  borrado_por   TEXT,
  motivo_borrado TEXT,
  borrado_con   TEXT
);

-- El panel pregunta siempre lo mismo: "dame los apuntes de estos clientes,
-- el más nuevo primero". Este índice es exactamente esa consulta.
CREATE INDEX IF NOT EXISTS ix_seguimientos_cliente
  ON luz_seguimientos (cliente_id, fecha DESC) WHERE borrado_en IS NULL;

CREATE INDEX IF NOT EXISTS ix_seguimientos_fecha
  ON luz_seguimientos (fecha DESC) WHERE borrado_en IS NULL;

-- Mismas reglas que el resto del módulo (ver supabase_rls_v2.sql).
ALTER TABLE luz_seguimientos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_ver ON luz_seguimientos;
DROP POLICY IF EXISTS p_crear ON luz_seguimientos;
DROP POLICY IF EXISTS p_modificar ON luz_seguimientos;
DROP POLICY IF EXISTS p_eliminar ON luz_seguimientos;
CREATE POLICY p_ver ON luz_seguimientos FOR SELECT USING (tiene_permiso('ver'));
CREATE POLICY p_crear ON luz_seguimientos FOR INSERT WITH CHECK (tiene_permiso('crear'));
CREATE POLICY p_modificar ON luz_seguimientos FOR UPDATE USING (tiene_permiso('modificar'));
CREATE POLICY p_eliminar ON luz_seguimientos FOR DELETE USING (tiene_permiso('eliminar'));

-- El parte del día lee de app_auditoria, que se llena con triggers. Sin esto
-- los apuntes de seguimiento no saldrían en el parte y justo son la parte que
-- cuenta el trabajo comercial de verdad.
DO $$
BEGIN
  IF to_regprocedure('fn_auditoria()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS tg_auditoria ON luz_seguimientos;
    CREATE TRIGGER tg_auditoria
      AFTER INSERT OR UPDATE OR DELETE ON luz_seguimientos
      FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────
-- CARGA INICIAL: rescatar los apuntes que ya están escritos a mano
--
-- Sin esto la tabla nace vacía y el panel diría que NADIE ha hablado con
-- nadie nunca, que es peor que no tener panel: pondría en rojo la cartera
-- entera el primer día y se dejaría de mirar.
--
-- Se recuperan las notas con el formato «[fecha · autor] texto» que ya se
-- venía usando. Lo que no lleve ese formato se queda donde está: es
-- información del cliente, no un apunte de seguimiento.
-- ───────────────────────────────────────────────────────────────────
INSERT INTO luz_seguimientos (cliente_id, fecha, via, que_se_hablo, autor, creado_en)
SELECT c.id,
       -- La marca viene en dd/mm/yyyy; si no se puede leer, se usa el alta.
       COALESCE(
         to_date(substring(m[1] from '^\d{1,2}/\d{1,2}/\d{4}'), 'DD/MM/YYYY'),
         c.creado_en::date
       ),
       'otro',
       trim(m[3]),
       NULLIF(trim(m[2]), ''),
       c.creado_en
  FROM luz_clientes c,
       LATERAL regexp_matches(
         c.observaciones,
         -- OJO: el primer grupo va GREEDY (+) y no perezoso (+?) a propósito.
         -- En Postgres el primer cuantificador decide la codicia de TODA la
         -- expresión, así que con `+?` el último grupo se volvía perezoso
         -- también y capturaba un solo carácter: el apunte se guardaba como
         -- un espacio en blanco. Comprobado contra los datos reales.
         '\[([^\]·]+)(?:\s*·\s*([^\]]+))?\]\s*([^\n\[]+)', 'g'
       ) AS m
 WHERE c.borrado_en IS NULL
   AND c.observaciones IS NOT NULL
   AND trim(m[3]) <> ''
   -- Las marcas [Fusión 24/7/2026] no son conversaciones: las pone el sistema
   -- al unir fichas duplicadas. Meterlas ensuciaría el historial de todos.
   AND m[1] !~ '^Fusión'
   -- No re-importar si ya se ejecutó antes.
   AND NOT EXISTS (
     SELECT 1 FROM luz_seguimientos s
      WHERE s.cliente_id = c.id AND s.que_se_hablo = trim(m[3])
   );

-- Comprobación: cuántos apuntes se han rescatado y de cuántos clientes.
SELECT count(*) AS apuntes_rescatados,
       count(DISTINCT cliente_id) AS clientes_con_historial
  FROM luz_seguimientos WHERE borrado_en IS NULL;
