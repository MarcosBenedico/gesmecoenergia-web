-- ============================================================
-- VENCIMIENTOS Y CARTERA v2 · Correbin Asociados
-- Amplía el esquema v1 (seguro si v1 ya está ejecutado o no).
-- Ejecutar en Supabase → SQL Editor. Idempotente.
-- ============================================================

-- ── v1 por si no existe ──
CREATE TABLE IF NOT EXISTS vct_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  nif TEXT, telefono TEXT, email TEXT, direccion TEXT, poblacion TEXT,
  tipo TEXT NOT NULL DEFAULT 'particular',
  origen TEXT, responsable TEXT, notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS vct_polizas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES vct_clientes(id) ON DELETE CASCADE,
  numero_poliza TEXT, ramo TEXT NOT NULL DEFAULT 'otros', compania TEXT NOT NULL,
  prima_anual NUMERIC DEFAULT 0, fecha_efecto DATE, fecha_vencimiento DATE,
  forma_pago TEXT DEFAULT 'anual', estado TEXT NOT NULL DEFAULT 'activa',
  mediador TEXT NOT NULL DEFAULT 'Correbin', responsable TEXT, notas TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(), actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS vct_oportunidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES vct_clientes(id) ON DELETE SET NULL,
  nombre_contacto TEXT NOT NULL, telefono TEXT, ramo TEXT NOT NULL DEFAULT 'otros',
  compania_actual TEXT, etapa TEXT NOT NULL DEFAULT 'prospecto',
  prima_estimada NUMERIC DEFAULT 0, fecha_prevista DATE, responsable TEXT, notas TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(), actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS vct_tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES vct_clientes(id) ON DELETE CASCADE,
  poliza_id UUID REFERENCES vct_polizas(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL, descripcion TEXT, fecha_limite DATE,
  prioridad TEXT NOT NULL DEFAULT 'media', estado TEXT NOT NULL DEFAULT 'pendiente',
  responsable TEXT, creado_en TIMESTAMPTZ DEFAULT NOW(), hecho_en TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS vct_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES vct_clientes(id) ON DELETE SET NULL,
  poliza_id UUID REFERENCES vct_polizas(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL, fecha DATE NOT NULL DEFAULT CURRENT_DATE, motivo TEXT,
  compania_origen TEXT, compania_destino TEXT, mediador_origen TEXT, mediador_destino TEXT,
  prima NUMERIC DEFAULT 0, responsable TEXT, notas TEXT, creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ── v2: ampliar CLIENTES (prioridad A-D, segmento, potencial, totales) ──
ALTER TABLE vct_clientes
  ADD COLUMN IF NOT EXISTS contacto_principal TEXT,
  ADD COLUMN IF NOT EXISTS prioridad TEXT NOT NULL DEFAULT 'C',
  ADD COLUMN IF NOT EXISTS segmento TEXT NOT NULL DEFAULT 'particular_ordinario',
  ADD COLUMN IF NOT EXISTS potencial_comercial TEXT,
  ADD COLUMN IF NOT EXISTS prima_total NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comision_total NUMERIC DEFAULT 0;

-- ── v2: ampliar PÓLIZAS (comisión, prioridad, segmento, origen) ──
ALTER TABLE vct_polizas
  ADD COLUMN IF NOT EXISTS comision NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prioridad TEXT,
  ADD COLUMN IF NOT EXISTS segmento TEXT,
  ADD COLUMN IF NOT EXISTS origen_importacion TEXT;
ALTER TABLE vct_polizas ALTER COLUMN fecha_vencimiento DROP NOT NULL;

-- Antiduplicados: misma combinación cliente + nº póliza + compañía
CREATE UNIQUE INDEX IF NOT EXISTS uq_vct_poliza_cliente_num_cia
  ON vct_polizas (cliente_id, numero_poliza, compania)
  WHERE numero_poliza IS NOT NULL AND numero_poliza <> '';

-- ── v2: VENCIMIENTOS (entidad propia con estado comercial) ──
CREATE TABLE IF NOT EXISTS vct_vencimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES vct_clientes(id) ON DELETE CASCADE,
  poliza_id UUID REFERENCES vct_polizas(id) ON DELETE CASCADE,
  fecha_vct DATE NOT NULL,
  titulo_evento TEXT NOT NULL,
  segmento TEXT NOT NULL DEFAULT 'particular_ordinario',
  color TEXT NOT NULL DEFAULT 'gris',
  estado_vencimiento TEXT NOT NULL DEFAULT 'pendiente_revisar',
  responsable TEXT,
  fecha_ultimo_contacto DATE,
  proxima_accion TEXT,
  fecha_proxima_accion DATE,
  observaciones TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vct_venc_fecha ON vct_vencimientos(fecha_vct);
CREATE INDEX IF NOT EXISTS idx_vct_venc_estado ON vct_vencimientos(estado_vencimiento);
CREATE INDEX IF NOT EXISTS idx_vct_venc_cliente ON vct_vencimientos(cliente_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vct_venc_poliza_fecha
  ON vct_vencimientos (poliza_id, fecha_vct) WHERE poliza_id IS NOT NULL;

-- ── v2: PRODUCCIÓN (emisiones clasificadas) ──
CREATE TABLE IF NOT EXISTS vct_produccion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES vct_clientes(id) ON DELETE SET NULL,
  poliza_id UUID REFERENCES vct_polizas(id) ON DELETE SET NULL,
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_efecto DATE,
  ramo TEXT NOT NULL DEFAULT 'otros',
  compania TEXT,
  prima NUMERIC DEFAULT 0,
  comision NUMERIC DEFAULT 0,
  tipo_produccion TEXT NOT NULL DEFAULT 'nueva',   -- nueva | ampliacion | sustitucion | cambio_compania | regularizacion
  responsable TEXT,
  observaciones TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vct_prod_fecha ON vct_produccion(fecha_emision DESC);
CREATE INDEX IF NOT EXISTS idx_vct_prod_tipo ON vct_produccion(tipo_produccion);

-- ── v2: ANULACIONES ──
CREATE TABLE IF NOT EXISTS vct_anulaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES vct_clientes(id) ON DELETE SET NULL,
  poliza_id UUID REFERENCES vct_polizas(id) ON DELETE SET NULL,
  fecha_anulacion DATE NOT NULL DEFAULT CURRENT_DATE,
  prima NUMERIC DEFAULT 0,
  motivo TEXT,
  tipo_anulacion TEXT NOT NULL DEFAULT 'real',     -- real | sustitucion_tecnica | impago | venta_riesgo | error_admin | cambio_compania
  poliza_sustituta_id UUID REFERENCES vct_polizas(id) ON DELETE SET NULL,
  afecta_cartera BOOLEAN NOT NULL DEFAULT TRUE,
  responsable TEXT,
  observaciones TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vct_anul_fecha ON vct_anulaciones(fecha_anulacion DESC);
CREATE INDEX IF NOT EXISTS idx_vct_anul_tipo ON vct_anulaciones(tipo_anulacion);

-- ── v2: CAMBIOS DE MEDIADOR ──
CREATE TABLE IF NOT EXISTS vct_cambios_mediador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES vct_clientes(id) ON DELETE SET NULL,
  prima NUMERIC DEFAULT 0,
  compania TEXT,
  ramo TEXT,
  carta_firmada BOOLEAN NOT NULL DEFAULT FALSE,
  estado_compania TEXT,
  fecha_solicitud DATE,
  fecha_envio_compania DATE,
  fecha_entrada DATE,
  estado TEXT NOT NULL DEFAULT 'detectado',        -- detectado | carta_solicitada | carta_firmada | enviado_compania | aceptado | incorporado | rechazado
  responsable TEXT,
  observaciones TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vct_cm_estado ON vct_cambios_mediador(estado);

-- ── v2: ampliar PIPELINE ──
ALTER TABLE vct_oportunidades
  ADD COLUMN IF NOT EXISTS probabilidad INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS documentacion_recibida BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS proxima_accion TEXT,
  ADD COLUMN IF NOT EXISTS fecha_proxima_accion DATE,
  ADD COLUMN IF NOT EXISTS resultado TEXT;

-- ── v2: ampliar TAREAS ──
ALTER TABLE vct_tareas
  ADD COLUMN IF NOT EXISTS vencimiento_id UUID REFERENCES vct_vencimientos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES vct_oportunidades(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_tarea TEXT DEFAULT 'seguimiento';

-- ── v2: RESPONSABLES (estructura de roles preparada) ──
CREATE TABLE IF NOT EXISTS vct_responsables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  rol TEXT NOT NULL DEFAULT 'renovaciones',        -- direccion | renovaciones | auto_particulares | comercial | administracion | derivaciones
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO vct_responsables (nombre, rol) VALUES
  ('Dirección', 'direccion'),
  ('Renovaciones', 'renovaciones'),
  ('Auto / Particulares', 'auto_particulares'),
  ('Administración', 'administracion')
ON CONFLICT (nombre) DO NOTHING;

-- ── v2: CONFIGURACIÓN (objetivo anual, etc.) ──
CREATE TABLE IF NOT EXISTS vct_config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO vct_config (clave, valor) VALUES ('objetivo_anual_produccion', '100000')
ON CONFLICT (clave) DO NOTHING;

-- ── Sin RLS (panel interno, patrón del proyecto) ──
ALTER TABLE vct_clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE vct_polizas DISABLE ROW LEVEL SECURITY;
ALTER TABLE vct_movimientos DISABLE ROW LEVEL SECURITY;
ALTER TABLE vct_oportunidades DISABLE ROW LEVEL SECURITY;
ALTER TABLE vct_tareas DISABLE ROW LEVEL SECURITY;
ALTER TABLE vct_vencimientos DISABLE ROW LEVEL SECURITY;
ALTER TABLE vct_produccion DISABLE ROW LEVEL SECURITY;
ALTER TABLE vct_anulaciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE vct_cambios_mediador DISABLE ROW LEVEL SECURITY;
ALTER TABLE vct_responsables DISABLE ROW LEVEL SECURITY;
ALTER TABLE vct_config DISABLE ROW LEVEL SECURITY;
