-- ═══════════════════════════════════════════════════════════════════════════
--  FOTO DEL SITIO (Gestión Luz)
--  Ejecutar entero en el SQL Editor de Supabase. Se puede repetir sin peligro.
--
--  Para qué: David ya manda al grupo una foto del sitio en cada visita. Si esa
--  foto entra en el panel, la ve antes de llegar y reconoce el lugar — que en
--  granjas y naves, desde la carretera, es media visita ganada.
--
--  La foto se guarda en un bucket PRIVADO y en el cliente solo se apunta su
--  ruta. Para verla se genera un enlace firmado de un rato: así una foto de la
--  nave de un cliente no queda accesible con solo saber la URL.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Dónde se apunta la foto de cada cliente ──
ALTER TABLE luz_clientes ADD COLUMN IF NOT EXISTS foto_path TEXT;

COMMENT ON COLUMN luz_clientes.foto_path IS
  'Ruta dentro del bucket fotos_sitio. No es una URL: el enlace se firma al mostrarla.';

-- ── 2. El bucket, privado ──
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos_sitio', 'fotos_sitio', false)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Quién puede subir y ver ──
-- Solo usuarios autenticados: son fotos de instalaciones de clientes reales.
DROP POLICY IF EXISTS "fotos_sitio_leer" ON storage.objects;
CREATE POLICY "fotos_sitio_leer" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'fotos_sitio');

DROP POLICY IF EXISTS "fotos_sitio_subir" ON storage.objects;
CREATE POLICY "fotos_sitio_subir" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fotos_sitio');

DROP POLICY IF EXISTS "fotos_sitio_borrar" ON storage.objects;
CREATE POLICY "fotos_sitio_borrar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'fotos_sitio');

-- ── 4. Comprobación ──
-- Debe devolver una fila con la columna y el bucket a TRUE.
SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'luz_clientes' AND column_name = 'foto_path'
  ) AS columna_foto_path,
  EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'fotos_sitio') AS bucket_creado,
  (SELECT public FROM storage.buckets WHERE id = 'fotos_sitio') AS bucket_publico_debe_ser_false;
