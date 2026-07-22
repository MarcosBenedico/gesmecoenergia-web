-- ═══════════════════════════════════════════════════════════════════
-- CALCULADORA FV · Almacén de documentos (privado, solo administrador)
-- Ejecutar en Supabase → SQL Editor (después de supabase_fv_presupuestos.sql).
-- Crea el bucket "documentos_fv" y sus permisos: solo los admin pueden
-- subir, ver, descargar y borrar. Los archivos NUNCA son públicos.
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documentos_fv', 'documentos_fv', false, 26214400)   -- 25 MB por archivo
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS p_fv_docs_select ON storage.objects;
DROP POLICY IF EXISTS p_fv_docs_insert ON storage.objects;
DROP POLICY IF EXISTS p_fv_docs_update ON storage.objects;
DROP POLICY IF EXISTS p_fv_docs_delete ON storage.objects;

CREATE POLICY p_fv_docs_select ON storage.objects FOR SELECT
  USING (bucket_id = 'documentos_fv' AND es_admin());
CREATE POLICY p_fv_docs_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documentos_fv' AND es_admin());
CREATE POLICY p_fv_docs_update ON storage.objects FOR UPDATE
  USING (bucket_id = 'documentos_fv' AND es_admin());
CREATE POLICY p_fv_docs_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'documentos_fv' AND es_admin());
