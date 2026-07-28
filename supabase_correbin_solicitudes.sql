-- ═══════════════════════════════════════════════════════════════════
-- CORREBIN · Solicitudes de la web pública
--
-- Guarda lo que llega por los formularios de la microsede de seguros:
--   · revision  → solicitud de revisión de pólizas / diagnóstico inicial
--   · siniestro → comunicación de siniestro
--   · contacto  → consulta general
--
-- El Volumen III exige guardado seguro y confirmación: no vale con abrir
-- WhatsApp. Esta tabla es el destino de esos envíos.
--
-- Ejecutar UNA VEZ en Supabase → SQL Editor. Idempotente.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS correbin_solicitudes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia TEXT NOT NULL,                  -- referencia visible para el cliente
  tipo TEXT NOT NULL,                        -- revision | siniestro | contacto
  nombre TEXT NOT NULL,
  empresa TEXT,
  nif TEXT,
  telefono TEXT NOT NULL,
  email TEXT,
  localidad TEXT,
  sector TEXT,
  motivo TEXT,
  mensaje TEXT,
  -- Revisión de pólizas
  proximo_vencimiento DATE,
  empleados INTEGER,
  facturacion NUMERIC,
  centros INTEGER,
  vehiculos INTEGER,
  siniestralidad TEXT,
  -- Siniestro
  poliza TEXT,
  fecha_siniestro DATE,
  lugar TEXT,
  tipo_siniestro TEXT,
  danos_personales BOOLEAN DEFAULT false,
  terceros BOOLEAN DEFAULT false,
  autoridades TEXT,
  urgente BOOLEAN DEFAULT false,
  -- Atribución comercial: de dónde llegó el contacto (Volumen XI)
  origen TEXT,
  campana TEXT,
  -- Gestión interna: cada solicitud tiene responsable, estado y siguiente
  -- paso, como exige el Volumen XII. Los estados siguen el proceso real:
  -- nueva → clasificada → en_analisis → propuesta_enviada → cerrada_*
  estado TEXT NOT NULL DEFAULT 'nueva',
  responsable TEXT,
  siguiente_paso TEXT,
  fecha_siguiente_paso DATE,
  notas_internas TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_correbin_sol_tipo ON correbin_solicitudes(tipo);
CREATE INDEX IF NOT EXISTS idx_correbin_sol_estado ON correbin_solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_correbin_sol_creado ON correbin_solicitudes(creado_en DESC);

-- ── Seguridad ──
-- La web es pública: cualquiera puede ENVIAR una solicitud, pero NADIE puede
-- leerlas sin haber iniciado sesión en el panel. Por eso hay una política de
-- INSERT abierta y ninguna de SELECT para anónimos.
ALTER TABLE correbin_solicitudes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_enviar_publico ON correbin_solicitudes;
CREATE POLICY p_enviar_publico ON correbin_solicitudes
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS p_ver ON correbin_solicitudes;
CREATE POLICY p_ver ON correbin_solicitudes
  FOR SELECT TO authenticated
  USING (tiene_permiso('ver'));

DROP POLICY IF EXISTS p_modificar ON correbin_solicitudes;
CREATE POLICY p_modificar ON correbin_solicitudes
  FOR UPDATE TO authenticated
  USING (tiene_permiso('modificar'));

DROP POLICY IF EXISTS p_eliminar ON correbin_solicitudes;
CREATE POLICY p_eliminar ON correbin_solicitudes
  FOR DELETE TO authenticated
  USING (es_admin());
