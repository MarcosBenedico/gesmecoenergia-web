-- Tabla para almacenar metadatos de documentos del cliente
CREATE TABLE IF NOT EXISTS documentos_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes_app(id) ON DELETE CASCADE,
  archivo_path TEXT NOT NULL UNIQUE,
  nombre_original TEXT NOT NULL,
  tipo_documento TEXT NOT NULL DEFAULT 'otro',
  descripcion TEXT,
  tamano_bytes INTEGER,
  mime_type TEXT,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  analizado BOOLEAN DEFAULT FALSE,
  notas_analisis TEXT,
  actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_documentos_cliente_id ON documentos_cliente(cliente_id);
CREATE INDEX IF NOT EXISTS idx_documentos_tipo ON documentos_cliente(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_documentos_creado ON documentos_cliente(creado_en DESC);

-- RLS: el endpoint verifica cliente_id, así que no habilitamos RLS
-- (el backend es responsable de validar la propiedad del documento)
