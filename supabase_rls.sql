-- ═══════════════════════════════════════════════════════════════════
-- PASO 2 · ROW LEVEL SECURITY  ⚠️ EJECUTAR SOLO CUANDO LOS LOGINS FUNCIONEN
--
-- A partir de este momento, la app exige iniciar sesión con un usuario
-- de Supabase Auth que exista en app_usuarios y esté activo.
-- El acceso anónimo (sin sesión) deja de ver ni tocar datos.
-- Requiere haber ejecutado antes supabase_equipo_usuarios.sql (paso 1)
-- y que Marcos, Nicola y David puedan entrar con su email y contraseña.
--
-- Para DESHACER (si algo falla):  ALTER TABLE <tabla> DISABLE ROW LEVEL SECURITY;
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'luz_clientes','luz_cups','luz_pipeline','luz_contratos','luz_comisiones',
    'luz_tareas','luz_fechas_criticas','luz_config','vct_responsables'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS p_ver ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS p_crear ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS p_modificar ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS p_eliminar ON %I', t);
    -- Ver: cualquier usuario activo con permiso "ver"
    EXECUTE format('CREATE POLICY p_ver ON %I FOR SELECT USING (tiene_permiso(''ver''))', t);
    -- Crear / Modificar / Eliminar: según permiso individual (los admin siempre pueden)
    EXECUTE format('CREATE POLICY p_crear ON %I FOR INSERT WITH CHECK (tiene_permiso(''crear''))', t);
    EXECUTE format('CREATE POLICY p_modificar ON %I FOR UPDATE USING (tiene_permiso(''modificar''))', t);
    EXECUTE format('CREATE POLICY p_eliminar ON %I FOR DELETE USING (tiene_permiso(''eliminar''))', t);
  END LOOP;
END $$;

-- Usuarios con "solo_asignados": solo ven los clientes de su responsable
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
-- Permitir que un usuario recién creado inserte su propio perfil al primer acceso
DROP POLICY IF EXISTS p_usuarios_alta_propia ON app_usuarios;
CREATE POLICY p_usuarios_alta_propia ON app_usuarios FOR INSERT WITH CHECK (id = auth.uid());
-- Y que actualice su propio ultimo_acceso
DROP POLICY IF EXISTS p_usuarios_propio ON app_usuarios;
CREATE POLICY p_usuarios_propio ON app_usuarios FOR UPDATE USING (id = auth.uid());

-- Auditoría: solo lectura para admin; nadie la modifica desde la app (escriben los triggers)
ALTER TABLE app_auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_auditoria_ver ON app_auditoria;
CREATE POLICY p_auditoria_ver ON app_auditoria FOR SELECT USING (es_admin());
