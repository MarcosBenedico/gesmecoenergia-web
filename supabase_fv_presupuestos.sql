-- ═══════════════════════════════════════════════════════════════════
-- CALCULADORA FV · Presupuestos fotovoltaicos (solo administrador)
-- Ejecutar en Supabase → SQL Editor.
-- Requiere supabase_equipo_usuarios.sql (fn_auditar, es_admin) ya ejecutado.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fv_presupuestos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES luz_clientes(id) ON DELETE SET NULL,
  cliente_nombre TEXT,                       -- copia por si el cliente se borra
  nombre_proyecto TEXT NOT NULL,
  potencia_kw NUMERIC(10,2) NOT NULL CHECK (potencia_kw > 0),
  presupuesto_instalador NUMERIC(12,2) NOT NULL CHECK (presupuesto_instalador > 0),  -- "X" de Óscar, sin IVA
  coste_ingenieria NUMERIC(12,2) NOT NULL DEFAULT 1800 CHECK (coste_ingenieria >= 0),
  ingenieria_modificada BOOLEAN NOT NULL DEFAULT FALSE,   -- ¿se cambió el 1.800 € por defecto?
  otros_costes NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (otros_costes >= 0),
  coste_base NUMERIC(12,2) NOT NULL,
  margen_pct NUMERIC(6,3) NOT NULL CHECK (margen_pct >= 0),
  margen_modificado BOOLEAN NOT NULL DEFAULT FALSE,       -- ¿difiere del predeterminado por potencia?
  motivo_margen TEXT,                                     -- obligatorio si margen_modificado
  margen_importe NUMERIC(12,2) NOT NULL,
  precio_sin_iva NUMERIC(12,2) NOT NULL,
  iva_pct NUMERIC(6,3) NOT NULL DEFAULT 21 CHECK (iva_pct >= 0 AND iva_pct <= 30),
  iva_importe NUMERIC(12,2) NOT NULL,
  precio_con_iva NUMERIC(12,2) NOT NULL,
  estado TEXT NOT NULL DEFAULT 'borrador',
  -- borrador | pendiente_costes | pendiente_ingenieria | pendiente_revision
  -- aprobado | enviado | aceptado | rechazado | cancelado
  responsable TEXT,
  observaciones TEXT,
  documentos JSONB NOT NULL DEFAULT '[]'::jsonb,          -- [{nombre, url, tipo}]
  archivado BOOLEAN NOT NULL DEFAULT FALSE,               -- borrado lógico (nunca físico si está protegido)
  creado_por TEXT,
  modificado_por TEXT,
  aprobado_por TEXT,
  aprobado_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fv_pres_estado ON fv_presupuestos(estado);
CREATE INDEX IF NOT EXISTS idx_fv_pres_cliente ON fv_presupuestos(cliente_id);

-- Desglose de conceptos (el presupuesto de Óscar y la ingeniería son los principales;
-- aquí se añaden baterías, obra civil, legalización, etc.)
CREATE TABLE IF NOT EXISTS fv_conceptos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id UUID NOT NULL REFERENCES fv_presupuestos(id) ON DELETE CASCADE,
  concepto TEXT NOT NULL,
  proveedor TEXT,
  descripcion TEXT,
  cantidad NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (cantidad >= 0),
  precio_unitario NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (precio_unitario >= 0),
  incluido BOOLEAN NOT NULL DEFAULT TRUE,   -- ¿entra en el coste base?
  observaciones TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fv_conc_pres ON fv_conceptos(presupuesto_id);

-- Auditoría (mismo sistema que el resto del panel → sale en Control General)
DROP TRIGGER IF EXISTS trg_auditoria ON fv_presupuestos;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON fv_presupuestos
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();
DROP TRIGGER IF EXISTS trg_auditoria ON fv_conceptos;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON fv_conceptos
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();

-- ── RLS: SOLO ADMINISTRADORES (Marcos) ──
ALTER TABLE fv_presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE fv_conceptos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_fv_admin ON fv_presupuestos;
CREATE POLICY p_fv_admin ON fv_presupuestos FOR ALL USING (es_admin()) WITH CHECK (es_admin());
DROP POLICY IF EXISTS p_fv_admin ON fv_conceptos;
CREATE POLICY p_fv_admin ON fv_conceptos FOR ALL USING (es_admin()) WITH CHECK (es_admin());

-- Prohibir borrado físico de presupuestos aprobados/enviados/aceptados (se archivan)
CREATE OR REPLACE FUNCTION fn_fv_proteger_borrado() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estado IN ('aprobado', 'enviado', 'aceptado') THEN
    RAISE EXCEPTION 'Los presupuestos aprobados o enviados no se eliminan: usa "Cancelar" o archívalo.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_fv_proteger ON fv_presupuestos;
CREATE TRIGGER trg_fv_proteger BEFORE DELETE ON fv_presupuestos
  FOR EACH ROW EXECUTE FUNCTION fn_fv_proteger_borrado();
