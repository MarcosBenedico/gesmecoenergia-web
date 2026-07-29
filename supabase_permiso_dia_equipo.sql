-- ═══════════════════════════════════════════════════════════════════
-- PERMISO · Ver el «Mi Día» de otro miembro del equipo
--
-- Para quien lleva el seguimiento de las rutas y necesita revisar el
-- trabajo del comercial sin cerrar sesión y entrar con su cuenta.
-- Es solo un permiso de VISUALIZACIÓN: cada usuario mantiene su cuenta
-- y sus permisos.
--
-- Ejecutar en Supabase → SQL Editor. Idempotente.
-- ═══════════════════════════════════════════════════════════════════

-- Dárselo a Nicola (ajusta el correo si el suyo es otro)
UPDATE app_usuarios
SET permisos = COALESCE(permisos, '{}'::jsonb) || '{"ver_dia_equipo": true}'::jsonb
WHERE lower(nombre) LIKE '%nicola%'
   OR lower(email) LIKE '%nicola%';

-- Comprobar a quién se le ha dado
SELECT nombre, email, rol, permisos->>'ver_dia_equipo' AS ve_dia_del_equipo
FROM app_usuarios
ORDER BY nombre;
