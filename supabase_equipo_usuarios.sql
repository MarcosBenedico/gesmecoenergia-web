-- ═══════════════════════════════════════════════════════════════════
-- PASO 1 · USUARIOS, PERMISOS Y AUDITORÍA  (seguro: NO activa RLS)
-- Ejecutar en Supabase → SQL Editor. No borra ni cambia datos existentes.
-- ═══════════════════════════════════════════════════════════════════

-- Notas en las tareas de Luz
ALTER TABLE luz_tareas ADD COLUMN IF NOT EXISTS notas TEXT;

-- ── Perfiles de usuario (vinculados a Supabase Auth) ──
CREATE TABLE IF NOT EXISTS app_usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'estandar',        -- admin | estandar | lectura
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  responsable TEXT,                             -- nombre del responsable comercial vinculado
  -- Permisos individuales (ajustables por usuario desde el panel de administración)
  permisos JSONB NOT NULL DEFAULT '{
    "ver": true, "crear": true, "modificar": true, "eliminar": false,
    "exportar": true, "gestionar_usuarios": false, "solo_asignados": false
  }'::jsonb,
  -- Módulos accesibles
  modulos JSONB NOT NULL DEFAULT '["luz","correbin","app_clientes","herramientas"]'::jsonb,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  ultimo_acceso TIMESTAMPTZ
);

-- ── Historial de modificaciones (auditoría) ──
CREATE TABLE IF NOT EXISTS app_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario TEXT,                 -- email del usuario autenticado (o 'sistema')
  accion TEXT NOT NULL,         -- INSERT | UPDATE | DELETE
  tabla TEXT NOT NULL,
  registro_id TEXT,
  antes JSONB,
  despues JSONB,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON app_auditoria(tabla, creado_en DESC);

-- Función genérica de auditoría
CREATE OR REPLACE FUNCTION fn_auditar() RETURNS TRIGGER AS $$
DECLARE
  v_usuario TEXT;
BEGIN
  v_usuario := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'email', 'sistema');
  IF TG_OP = 'DELETE' THEN
    INSERT INTO app_auditoria(usuario, accion, tabla, registro_id, antes)
    VALUES (v_usuario, TG_OP, TG_TABLE_NAME, OLD.id::text, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO app_auditoria(usuario, accion, tabla, registro_id, antes, despues)
    VALUES (v_usuario, TG_OP, TG_TABLE_NAME, NEW.id::text, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    INSERT INTO app_auditoria(usuario, accion, tabla, registro_id, despues)
    VALUES (v_usuario, TG_OP, TG_TABLE_NAME, NEW.id::text, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers en las tablas importantes
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'luz_clientes','luz_cups','luz_pipeline','luz_contratos','luz_comisiones',
    'luz_tareas','luz_fechas_criticas','vct_responsables','app_usuarios'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auditoria ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION fn_auditar()', t);
  END LOOP;
END $$;

-- Funciones de ayuda para las políticas RLS (paso 2)
CREATE OR REPLACE FUNCTION es_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM app_usuarios WHERE id = auth.uid() AND rol = 'admin' AND activo);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION tiene_permiso(p TEXT) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_usuarios
    WHERE id = auth.uid() AND activo
      AND (rol = 'admin' OR COALESCE((permisos->>p)::boolean, false))
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ═══════════════════════════════════════════════════════════════════
-- DESPUÉS DE EJECUTAR ESTO:
-- 1. En Supabase → Authentication → Providers → Email:
--    activa "Email" y DESACTIVA "Confirm email" (para crear usuarios sin correo de confirmación).
-- 2. Crea los usuarios desde la app (Gestión Luz → Usuarios y Permisos) o desde
--    Supabase → Authentication → Users → "Add user" (marca "Auto Confirm User").
-- 3. El perfil de cada usuario se completa desde la app.
-- 4. Cuando los tres logins funcionen, ejecuta supabase_rls.sql (paso 2).
-- ═══════════════════════════════════════════════════════════════════
