-- ============================================================
-- MÓDULO "GESTIÓN LUZ / CARTERA ENERGÉTICA" · panel gestor
-- Cada CUPS: responsable, estado, fecha clave, próxima acción,
-- contrato, activación y comisión.
-- Ejecutar en Supabase → SQL Editor. Idempotente.
-- ============================================================

-- ── CLIENTES ENERGÍA (el centro: titular con uno o varios CUPS) ──
CREATE TABLE IF NOT EXISTS luz_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  nif TEXT,
  tipo_cliente TEXT NOT NULL DEFAULT 'particular',  -- particular | autonomo | pyme | industria | comunidad | ayuntamiento | gran_cuenta
  persona_contacto TEXT,
  telefono TEXT,
  email TEXT,
  direccion_fiscal TEXT,
  responsable TEXT,
  prioridad TEXT NOT NULL DEFAULT 'C',              -- A | B | C | D
  estado_comercial TEXT NOT NULL DEFAULT 'detectado',
  potencial_comercial TEXT,
  origen_cliente TEXT,
  observaciones TEXT,
  fecha_ultimo_contacto DATE,
  fecha_proxima_accion DATE,
  proxima_accion TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_luz_cli_nombre ON luz_clientes(nombre);
CREATE INDEX IF NOT EXISTS idx_luz_cli_prioridad ON luz_clientes(prioridad);
CREATE INDEX IF NOT EXISTS idx_luz_cli_estado ON luz_clientes(estado_comercial);

-- ── CUPS / SUMINISTROS ──
CREATE TABLE IF NOT EXISTS luz_cups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES luz_clientes(id) ON DELETE CASCADE,
  cups TEXT NOT NULL,
  alias_suministro TEXT,
  direccion_suministro TEXT,
  tarifa_acceso TEXT NOT NULL DEFAULT '2.0TD',      -- 2.0TD | 3.0TD | 6.1TD | 6.2TD | otra
  comercializadora_actual TEXT,
  distribuidora TEXT,
  potencias_kw NUMERIC[] DEFAULT '{}',              -- P1..P6
  consumo_anual_kwh NUMERIC DEFAULT 0,
  coste_anual_estimado NUMERIC DEFAULT 0,
  tipo_contrato TEXT DEFAULT 'desconocido',         -- fijo | indexado | mixto | desconocido
  fecha_inicio_contrato DATE,
  fecha_fin_contrato DATE,
  tiene_permanencia BOOLEAN DEFAULT FALSE,
  fecha_fin_permanencia DATE,
  dias_preaviso INTEGER,
  fecha_limite_preaviso DATE,
  penalizacion TEXT,
  estado_cups TEXT NOT NULL DEFAULT 'sin_factura',
  responsable TEXT,
  prioridad TEXT DEFAULT 'C',
  observaciones TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
-- Antiduplicados: un CUPS no puede repetirse
CREATE UNIQUE INDEX IF NOT EXISTS uq_luz_cups ON luz_cups (cups);
CREATE INDEX IF NOT EXISTS idx_luz_cups_cliente ON luz_cups(cliente_id);
CREATE INDEX IF NOT EXISTS idx_luz_cups_estado ON luz_cups(estado_cups);
CREATE INDEX IF NOT EXISTS idx_luz_cups_fin_contrato ON luz_cups(fecha_fin_contrato);

-- ── FECHAS CRÍTICAS ──
CREATE TABLE IF NOT EXISTS luz_fechas_criticas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES luz_clientes(id) ON DELETE CASCADE,
  cups_id UUID REFERENCES luz_cups(id) ON DELETE CASCADE,
  tipo_fecha TEXT NOT NULL,                         -- fin_contrato | fin_permanencia | limite_preaviso | revision_comercial | seguimiento_oferta | contrato_pendiente_firma | activacion_pendiente | revision_comision | cliente_a_sin_accion
  fecha DATE NOT NULL,
  titulo TEXT NOT NULL,                             -- LUZ - Cliente - CUPS - Tipo - Comercializadora
  descripcion TEXT,
  prioridad TEXT DEFAULT 'C',
  estado TEXT NOT NULL DEFAULT 'pendiente',         -- pendiente | gestionada | descartada
  responsable TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_luz_fc_fecha ON luz_fechas_criticas(fecha);
CREATE INDEX IF NOT EXISTS idx_luz_fc_tipo ON luz_fechas_criticas(tipo_fecha);
CREATE UNIQUE INDEX IF NOT EXISTS uq_luz_fc ON luz_fechas_criticas (cups_id, tipo_fecha, fecha) WHERE cups_id IS NOT NULL;

-- ── PIPELINE ENERGÉTICO ──
CREATE TABLE IF NOT EXISTS luz_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES luz_clientes(id) ON DELETE SET NULL,
  cups_id UUID REFERENCES luz_cups(id) ON DELETE SET NULL,
  nombre_oportunidad TEXT NOT NULL,
  tipo_oportunidad TEXT NOT NULL DEFAULT 'cambio_comercializadora',
  tarifa TEXT,
  comercializadora_actual TEXT,
  consumo_anual_kwh NUMERIC DEFAULT 0,
  importe_anual_estimado NUMERIC DEFAULT 0,
  ahorro_potencial NUMERIC DEFAULT 0,
  comision_potencial NUMERIC DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'prospecto',
  probabilidad INTEGER DEFAULT 50,
  responsable TEXT,
  proxima_accion TEXT,
  fecha_proxima_accion DATE,
  fecha_revision DATE,                              -- para "revisar más adelante"
  motivo_perdida TEXT,
  observaciones TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_luz_pipe_estado ON luz_pipeline(estado);

-- ── CONTRATOS Y ACTIVACIONES ──
CREATE TABLE IF NOT EXISTS luz_contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES luz_clientes(id) ON DELETE SET NULL,
  cups_id UUID REFERENCES luz_cups(id) ON DELETE SET NULL,
  pipeline_id UUID REFERENCES luz_pipeline(id) ON DELETE SET NULL,
  comercializadora_final TEXT,
  tarifa_acceso TEXT,
  tipo_contrato TEXT DEFAULT 'fijo',
  fecha_envio_contrato DATE,
  fecha_firma DATE,
  fecha_envio_comercializadora DATE,
  fecha_activacion_prevista DATE,
  fecha_activacion_real DATE,
  estado_contrato TEXT NOT NULL DEFAULT 'pendiente_preparar',
  documentacion_completa BOOLEAN DEFAULT FALSE,
  incidencia TEXT,
  responsable TEXT,
  observaciones TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_luz_con_estado ON luz_contratos(estado_contrato);

-- ── COMISIONES ──
CREATE TABLE IF NOT EXISTS luz_comisiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES luz_clientes(id) ON DELETE SET NULL,
  cups_id UUID REFERENCES luz_cups(id) ON DELETE SET NULL,
  contrato_id UUID REFERENCES luz_contratos(id) ON DELETE SET NULL,
  comercializadora TEXT,
  tipo_comision TEXT DEFAULT 'desconocida',         -- fija_factura | por_kwh | por_potencia | pago_unico | recurrente_mensual | recurrente_anual | mixta | desconocida
  importe_previsto NUMERIC DEFAULT 0,
  importe_cobrado NUMERIC DEFAULT 0,
  fecha_prevista_cobro DATE,
  fecha_cobro DATE,
  estado_comision TEXT NOT NULL DEFAULT 'prevista', -- prevista | pendiente_validar | pendiente_cobro | cobrada | cobrada_parcial | reclamada | perdida | cancelada
  factura_referencia TEXT,
  observaciones TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_luz_com_estado ON luz_comisiones(estado_comision);
CREATE INDEX IF NOT EXISTS idx_luz_com_fecha ON luz_comisiones(fecha_prevista_cobro);

-- ── TAREAS ──
CREATE TABLE IF NOT EXISTS luz_tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES luz_clientes(id) ON DELETE CASCADE,
  cups_id UUID REFERENCES luz_cups(id) ON DELETE SET NULL,
  pipeline_id UUID REFERENCES luz_pipeline(id) ON DELETE SET NULL,
  contrato_id UUID REFERENCES luz_contratos(id) ON DELETE SET NULL,
  comision_id UUID REFERENCES luz_comisiones(id) ON DELETE SET NULL,
  tipo_tarea TEXT DEFAULT 'seguimiento',
  descripcion TEXT NOT NULL,
  responsable TEXT,
  fecha_limite DATE,
  estado TEXT NOT NULL DEFAULT 'pendiente',         -- pendiente | en_curso | completada | bloqueada | cancelada
  prioridad TEXT DEFAULT 'media',
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_luz_tar_estado ON luz_tareas(estado);

-- ── CONFIGURACIÓN ──
CREATE TABLE IF NOT EXISTS luz_config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO luz_config (clave, valor) VALUES
  ('objetivo_mensual_contratos', '10'),
  ('objetivo_mensual_comision', '3000'),
  ('dias_alerta_cliente_a', '30'),
  ('dias_contrato_sin_firma', '7'),
  ('dias_firmado_sin_activar', '30'),
  ('dias_comision_vencida', '0'),
  ('consumo_prioridad_a_kwh', '100000'),
  ('consumo_prioridad_b_kwh', '30000'),
  ('comercializadoras', 'Endesa, Iberdrola, Naturgy, Repsol, TotalEnergies, Nufri, Alcanzia, Audax')
ON CONFLICT (clave) DO NOTHING;

-- Responsables: se reutiliza vct_responsables del módulo Correbin (roles ya preparados).
-- Si no existe (por orden de ejecución), se crea aquí también:
CREATE TABLE IF NOT EXISTS vct_responsables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  rol TEXT NOT NULL DEFAULT 'renovaciones',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO vct_responsables (nombre, rol) VALUES ('Energía', 'renovaciones')
ON CONFLICT (nombre) DO NOTHING;

-- ── Sin RLS (panel interno, patrón del proyecto) ──
ALTER TABLE luz_clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE luz_cups DISABLE ROW LEVEL SECURITY;
ALTER TABLE luz_fechas_criticas DISABLE ROW LEVEL SECURITY;
ALTER TABLE luz_pipeline DISABLE ROW LEVEL SECURITY;
ALTER TABLE luz_contratos DISABLE ROW LEVEL SECURITY;
ALTER TABLE luz_comisiones DISABLE ROW LEVEL SECURITY;
ALTER TABLE luz_tareas DISABLE ROW LEVEL SECURITY;
ALTER TABLE luz_config DISABLE ROW LEVEL SECURITY;
