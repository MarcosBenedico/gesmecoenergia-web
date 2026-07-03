-- Tabla para almacenar metadatos de documentos del cliente
CREATE TABLE IF NOT EXISTS documentos_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes_app(id) ON DELETE CASCADE,
  archivo_path TEXT NOT NULL,
  nombre_original TEXT NOT NULL,
  tipo_documento TEXT NOT NULL DEFAULT 'otro',
  descripcion TEXT,
  tamano_bytes INTEGER,
  mime_type TEXT,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  analizado BOOLEAN DEFAULT FALSE, -- si Gesmeco ya lo revisó
  notas_analisis TEXT, -- lo que encontró el asesor
  actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsqueda eficiente
CREATE INDEX idx_documentos_cliente_id ON documentos_cliente(cliente_id);
CREATE INDEX idx_documentos_tipo ON documentos_cliente(tipo_documento);
CREATE INDEX idx_documentos_creado ON documentos_cliente(creado_en DESC);

-- Vista para el asesor: documentos por cliente con datos del cliente
CREATE OR REPLACE VIEW documentos_con_cliente AS
SELECT
  d.id,
  d.cliente_id,
  c.usuario,
  c.nombre,
  d.archivo_path,
  d.nombre_original,
  d.tipo_documento,
  d.descripcion,
  d.tamaño_bytes,
  d.mime_type,
  d.creado_en,
  d.analizado,
  d.notas_analisis,
  d.actualizado_en
FROM documentos_cliente d
JOIN clientes_app c ON d.cliente_id = c.id
ORDER BY d.creado_en DESC;

-- Política RLS: cliente ve solo sus documentos
ALTER TABLE documentos_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cliente ve sus propios documentos"
  ON documentos_cliente
  FOR SELECT
  USING (cliente_id = (
    SELECT id FROM clientes_app WHERE token = current_setting('app.cliente_token', true)
  ));

CREATE POLICY "Cliente puede insertar sus documentos"
  ON documentos_cliente
  FOR INSERT
  WITH CHECK (cliente_id = (
    SELECT id FROM clientes_app WHERE token = current_setting('app.cliente_token', true)
  ));

CREATE POLICY "Cliente puede eliminar sus documentos"
  ON documentos_cliente
  FOR DELETE
  USING (cliente_id = (
    SELECT id FROM clientes_app WHERE token = current_setting('app.cliente_token', true)
  ));
