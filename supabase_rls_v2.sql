-- ═══════════════════════════════════════════════════════════════════
-- RLS v2 · CIERRE COMPLETO DEL PANEL (Luz + Correbin + usuarios)
--
-- Ejecutar UNA VEZ en Supabase → SQL Editor, DESPUÉS de que los logins
-- individuales funcionen (Marcos entra con su email y contraseña).
--
-- Efecto: sin sesión iniciada, las APIs del panel no devuelven ni
-- aceptan ningún dato. Cada usuario opera según sus permisos.
--
-- Incluye lo del paso 2 (supabase_rls.sql) + TODAS las tablas vct_*
-- del módulo Correbin, que faltaban. Es idempotente: se puede repetir.
--
-- Para DESHACER una tabla:  ALTER TABLE <tabla> DISABLE ROW LEVEL SECURITY;
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    -- Gestión Luz
    'luz_clientes','luz_cups','luz_pipeline','luz_contratos','luz_comisiones',
    'luz_tareas','luz_fechas_criticas','luz_config',
    -- Correbin · Vencimientos y Cartera
    'vct_clientes','vct_polizas','vct_vencimientos','vct_produccion','vct_anulaciones',
    'vct_cambios_mediador','vct_movimientos','vct_oportunidades','vct_tareas',
    'vct_responsables','vct_config'
  ] LOOP
    -- Si la tabla no existe en este proyecto, se salta sin fallar
    IF to_regclass(t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS p_ver ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS p_crear ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS p_modificar ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS p_eliminar ON %I', t);
    EXECUTE format('CREATE POLICY p_ver ON %I FOR SELECT USING (tiene_permiso(''ver''))', t);
    EXECUTE format('CREATE POLICY p_crear ON %I FOR INSERT WITH CHECK (tiene_permiso(''crear''))', t);
    EXECUTE format('CREATE POLICY p_modificar ON %I FOR UPDATE USING (tiene_permiso(''modificar''))', t);
    EXECUTE format('CREATE POLICY p_eliminar ON %I FOR DELETE USING (tiene_permiso(''eliminar''))', t);
  END LOOP;
END $$;

-- Usuarios con "solo_asignados": solo ven los clientes/tareas de su responsable (módulo Luz)
DROP POLICY IF EXISTS p_ver ON luz_clientes;
CREATE POLICY p_ver ON luz_clientes FOR SELECT USING (
  tiene_permiso('ver') AND (
    NOT COALESCE((SELECT (permisos->>'solo_asignados')::boolean FROM app_usuarios WHERE id = auth.uid()), false)
    OR responsable ILIKE '%' || COALESCE((SELECT responsable FROM app_usuarios WHERE id = auth.uid()), '') || '%'
    OR es_admin()
  )
);
DROP POLICY IF EXISTS p_ver ON luz_tareas;
CREATE POLICY p_ver ON luz_tareas FOR SELECT USING (
  tiene_permiso('ver') AND (
    NOT COALESCE((SELECT (permisos->>'solo_asignados')::boolean FROM app_usuarios WHERE id = auth.uid()), false)
    OR responsable ILIKE '%' || COALESCE((SELECT responsable FROM app_usuarios WHERE id = auth.uid()), '') || '%'
    OR es_admin()
  )
);

-- Perfiles: cada uno ve el suyo; solo los admin gestionan usuarios y permisos
ALTER TABLE app_usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_usuarios_ver ON app_usuarios;
DROP POLICY IF EXISTS p_usuarios_admin ON app_usuarios;
CREATE POLICY p_usuarios_ver ON app_usuarios FOR SELECT USING (id = auth.uid() OR es_admin());
CREATE POLICY p_usuarios_admin ON app_usuarios FOR ALL USING (es_admin()) WITH CHECK (es_admin());
DROP POLICY IF EXISTS p_usuarios_alta_propia ON app_usuarios;
CREATE POLICY p_usuarios_alta_propia ON app_usuarios FOR INSERT WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS p_usuarios_propio ON app_usuarios;
CREATE POLICY p_usuarios_propio ON app_usuarios FOR UPDATE USING (id = auth.uid());

-- Auditoría: solo lectura para admin; escriben únicamente los triggers (SECURITY DEFINER)
ALTER TABLE app_auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_auditoria_ver ON app_auditoria;
CREATE POLICY p_auditoria_ver ON app_auditoria FOR SELECT USING (es_admin());
