-- ============================================================
-- MÓDULO "VENCIMIENTOS Y CARTERA" · Correbin Asociados
-- Capa interna de control comercial (NO sustituye a Avant/iSegur)
-- Ejecutar en Supabase → SQL Editor. Idempotente.
-- ============================================================

-- Clientes de la correduría
CREATE TABLE IF NOT EXISTS vct_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  nif TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  poblacion TEXT,
  tipo TEXT NOT NULL DEFAULT 'particular',        -- particular | empresa | agrario
  origen TEXT,                                     -- de dónde vino el cliente
  responsable TEXT,                                -- gestor asignado
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vct_clientes_nombre ON vct_clientes(nombre);
CREATE INDEX IF NOT EXISTS idx_vct_clientes_nif ON vct_clientes(nif);
CREATE INDEX IF NOT EXISTS idx_vct_clientes_responsable ON vct_clientes(responsable);

-- Pólizas (referencia de control; la gestión técnica vive en Avant/iSegur)
CREATE TABLE IF NOT EXISTS vct_polizas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES vct_clientes(id) ON DELETE CASCADE,
  numero_poliza TEXT,
  ramo TEXT NOT NULL DEFAULT 'otros',              -- hogar | auto | vida | salud | rc | comercio | agrario | decesos | otros
  compania TEXT NOT NULL,
  prima_anual NUMERIC DEFAULT 0,
  fecha_efecto DATE,
  fecha_vencimiento DATE NOT NULL,
  forma_pago TEXT DEFAULT 'anual',                 -- anual | semestral | trimestral | mensual
  estado TEXT NOT NULL DEFAULT 'viva',             -- viva | anulada | sustituida | vencida | externa
  mediador TEXT NOT NULL DEFAULT 'Correbin',       -- mediador actual de la póliza
  responsable TEXT,
  notas TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vct_polizas_cliente ON vct_polizas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vct_polizas_vencimiento ON vct_polizas(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_vct_polizas_estado ON vct_polizas(estado);
CREATE INDEX IF NOT EXISTS idx_vct_polizas_ramo ON vct_polizas(ramo);

-- Movimientos: producción nueva, anulaciones reales, sustituciones,
-- cambios de compañía y cambios de mediador — cada uno tipado y con motivo
CREATE TABLE IF NOT EXISTS vct_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES vct_clientes(id) ON DELETE SET NULL,
  poliza_id UUID REFERENCES vct_polizas(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,                              -- produccion | anulacion | sustitucion | cambio_compania | cambio_mediador
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  motivo TEXT,                                     -- motivo real (precio, siniestro, competencia...)
  compania_origen TEXT,
  compania_destino TEXT,
  mediador_origen TEXT,
  mediador_destino TEXT,
  prima NUMERIC DEFAULT 0,
  responsable TEXT,
  notas TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vct_mov_tipo ON vct_movimientos(tipo);
CREATE INDEX IF NOT EXISTS idx_vct_mov_fecha ON vct_movimientos(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_vct_mov_cliente ON vct_movimientos(cliente_id);

-- Pipeline comercial (oportunidades)
CREATE TABLE IF NOT EXISTS vct_oportunidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES vct_clientes(id) ON DELETE SET NULL,
  nombre_contacto TEXT NOT NULL,                   -- si aún no es cliente
  telefono TEXT,
  ramo TEXT NOT NULL DEFAULT 'otros',
  compania_actual TEXT,                            -- con quién está ahora
  etapa TEXT NOT NULL DEFAULT 'prospecto',         -- prospecto | contactado | cotizado | negociacion | ganada | perdida
  prima_estimada NUMERIC DEFAULT 0,
  fecha_prevista DATE,                             -- vencimiento de su póliza actual u objetivo de cierre
  responsable TEXT,
  notas TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vct_op_etapa ON vct_oportunidades(etapa);
CREATE INDEX IF NOT EXISTS idx_vct_op_fecha ON vct_oportunidades(fecha_prevista);

-- Tareas y alertas
CREATE TABLE IF NOT EXISTS vct_tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES vct_clientes(id) ON DELETE CASCADE,
  poliza_id UUID REFERENCES vct_polizas(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  fecha_limite DATE,
  prioridad TEXT NOT NULL DEFAULT 'media',         -- alta | media | baja
  estado TEXT NOT NULL DEFAULT 'pendiente',        -- pendiente | hecha
  responsable TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  hecho_en TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_vct_tareas_estado ON vct_tareas(estado);
CREATE INDEX IF NOT EXISTS idx_vct_tareas_fecha ON vct_tareas(fecha_limite);

-- Acceso desde el panel (mismo patrón que el resto del proyecto: sin RLS,
-- el panel gestor es interno y las APIs validan)
ALTER TABLE vct_clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE vct_polizas DISABLE ROW LEVEL SECURITY;
ALTER TABLE vct_movimientos DISABLE ROW LEVEL SECURITY;
ALTER TABLE vct_oportunidades DISABLE ROW LEVEL SECURITY;
ALTER TABLE vct_tareas DISABLE ROW LEVEL SECURITY;
