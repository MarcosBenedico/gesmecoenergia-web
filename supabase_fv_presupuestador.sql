-- ═══════════════════════════════════════════════════════════════════
-- PRESUPUESTADOR FV · Catálogo de precios + históricos de Óscar + partidas
-- Ejecutar en Supabase → SQL Editor (tras supabase_fv_presupuestos.sql).
-- Idempotente: se puede ejecutar varias veces sin duplicar nada.
-- ═══════════════════════════════════════════════════════════════════

-- ── CATÁLOGO DE PRECIOS (editable; los precios no se borran: se desactivan) ──
CREATE TABLE IF NOT EXISTS fv_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  categoria TEXT NOT NULL,        -- paneles|estructuras|inversores|baterias|monitorizacion|instalacion|tramites|ingenieria|linea|otros
  descripcion TEXT NOT NULL,
  marca TEXT,
  modelo TEXT,
  potencia_w NUMERIC(10,2),       -- paneles/inversores (W o kW según unidad)
  capacidad_kwh NUMERIC(10,2),    -- baterías
  unidad TEXT NOT NULL DEFAULT 'ud',   -- ud | por_panel | conjunto
  precio_base NUMERIC(12,2) NOT NULL CHECK (precio_base >= 0),   -- sin IVA
  precio_min NUMERIC(12,2),
  precio_max NUMERIC(12,2),
  proveedor TEXT DEFAULT 'Óscar (instalador)',
  fecha_precio DATE DEFAULT CURRENT_DATE,
  num_referencias INT DEFAULT 1,  -- en cuántos presupuestos reales aparece
  confianza TEXT NOT NULL DEFAULT 'media',   -- alta | media | baja | pendiente
  alcance TEXT,                   -- qué incluye exactamente
  advertencia TEXT,               -- aviso al usarlo
  observaciones TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por TEXT, modificado_por TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(), actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Histórico de cambios de precio (nunca se pierde un precio antiguo)
CREATE TABLE IF NOT EXISTS fv_catalogo_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogo_id UUID REFERENCES fv_catalogo(id) ON DELETE CASCADE,
  codigo TEXT, precio_anterior NUMERIC(12,2), precio_nuevo NUMERIC(12,2),
  motivo TEXT, usuario TEXT, creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION fn_fv_historial_precio() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.precio_base IS DISTINCT FROM OLD.precio_base THEN
    INSERT INTO fv_catalogo_historial (catalogo_id, codigo, precio_anterior, precio_nuevo, usuario)
    VALUES (OLD.id, OLD.codigo, OLD.precio_base, NEW.precio_base,
            COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'email', 'sistema'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_fv_hist_precio ON fv_catalogo;
CREATE TRIGGER trg_fv_hist_precio BEFORE UPDATE ON fv_catalogo
  FOR EACH ROW EXECUTE FUNCTION fn_fv_historial_precio();

-- ── PRESUPUESTOS HISTÓRICOS DE ÓSCAR ──
CREATE TABLE IF NOT EXISTS fv_oscar_presupuestos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL,
  fecha DATE,
  cliente TEXT,
  ubicacion TEXT,
  proveedor TEXT DEFAULT 'Óscar (instalador)',
  potencia_kwp NUMERIC(10,2),
  num_paneles INT,
  inversor TEXT,
  bateria TEXT,
  subtotal NUMERIC(12,2),         -- sin IVA
  iva_pct NUMERIC(6,3) DEFAULT 21,
  total NUMERIC(12,2),
  archivo_url TEXT,
  observaciones TEXT,
  presupuesto_id UUID REFERENCES fv_presupuestos(id) ON DELETE SET NULL,  -- proyecto relacionado
  importado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS fv_oscar_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oscar_id UUID NOT NULL REFERENCES fv_oscar_presupuestos(id) ON DELETE CASCADE,
  codigo_catalogo TEXT,           -- enlaza con fv_catalogo.codigo
  descripcion TEXT NOT NULL,
  cantidad NUMERIC(10,2) NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(12,2) NOT NULL,
  importe NUMERIC(12,2) NOT NULL,
  opcional BOOLEAN NOT NULL DEFAULT FALSE,
  observaciones TEXT
);

-- ── PARTIDAS: ampliar fv_conceptos con las columnas del motor ──
ALTER TABLE fv_conceptos ADD COLUMN IF NOT EXISTS codigo_catalogo TEXT;
ALTER TABLE fv_conceptos ADD COLUMN IF NOT EXISTS marca TEXT;
ALTER TABLE fv_conceptos ADD COLUMN IF NOT EXISTS ajuste_pct NUMERIC(6,3) NOT NULL DEFAULT 0;
ALTER TABLE fv_conceptos ADD COLUMN IF NOT EXISTS ajuste_fijo NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE fv_conceptos ADD COLUMN IF NOT EXISTS opcional BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE fv_conceptos ADD COLUMN IF NOT EXISTS visible_cliente BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE fv_conceptos ADD COLUMN IF NOT EXISTS fuente TEXT;          -- de qué presupuesto/catálogo sale el precio
ALTER TABLE fv_conceptos ADD COLUMN IF NOT EXISTS confianza TEXT DEFAULT 'media';
ALTER TABLE fv_conceptos ADD COLUMN IF NOT EXISTS motivo_ajuste TEXT;

-- fv_presupuestos: modo de cálculo y dimensionado
ALTER TABLE fv_presupuestos ADD COLUMN IF NOT EXISTS modo TEXT NOT NULL DEFAULT 'simple';  -- simple | partidas
ALTER TABLE fv_presupuestos ADD COLUMN IF NOT EXISTS dimensionado JSONB DEFAULT '{}'::jsonb;
-- En modo partidas el coste base sale de las partidas: el importe único puede ser 0
ALTER TABLE fv_presupuestos DROP CONSTRAINT IF EXISTS fv_presupuestos_presupuesto_instalador_check;
ALTER TABLE fv_presupuestos ADD CONSTRAINT fv_presupuestos_presupuesto_instalador_check CHECK (presupuesto_instalador >= 0);

-- ── RLS: solo administradores (mismo criterio que el resto del módulo FV) ──
ALTER TABLE fv_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE fv_catalogo_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE fv_oscar_presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE fv_oscar_items ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['fv_catalogo','fv_catalogo_historial','fv_oscar_presupuestos','fv_oscar_items'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS p_fv_admin ON %I', t);
    EXECUTE format('CREATE POLICY p_fv_admin ON %I FOR ALL USING (es_admin()) WITH CHECK (es_admin())', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auditoria ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION fn_auditar()', t);
  END LOOP;
END $$;

-- ═══ SEMILLA DEL CATÁLOGO (precios reales de los presupuestos de Óscar; sin IVA) ═══
INSERT INTO fv_catalogo (codigo, categoria, descripcion, marca, potencia_w, capacidad_kwh, unidad, precio_base, precio_min, precio_max, num_referencias, confianza, alcance, advertencia) VALUES
('PAN-JIN-515','paneles','Panel Solar Jinko 515 W Tiger N-Type bifacial','Jinko',515,NULL,'ud',91,91,91,4,'alta','Panel fotovoltaico',NULL),
('EST-SUN-STD','estructuras','Estructura Sunfer cubierta metálica / carril coplanar','Sunfer',NULL,NULL,'por_panel',41,41,41,4,'alta','Estructura por panel','El precio corresponde a cubierta metálica y coplanar. Confirmar para teja, inclinada especial, suelo, marquesina o estructuras complejas.'),
('INV-FEL-5','inversores','Inversor Felicity híbrido monofásico','Felicity',5000,NULL,'ud',825,825,825,1,'media','Inversor híbrido 5 kW monofásico','No interpolar precios de inversores por €/kW: marca, fases, híbrido, backup e integración cambian mucho el precio.'),
('INV-HOY-10','inversores','Inversor Hoymiles híbrido','Hoymiles',10000,NULL,'ud',1980,1980,1980,1,'media','Inversor híbrido 10 kW','No interpolar precios de inversores por €/kW.'),
('INV-VIC-15','inversores','Conjunto inversor Victron','Victron',15000,NULL,'conjunto',3920,3920,3920,1,'media','Conjunto inversor 15 kW','No interpolar precios de inversores por €/kW.'),
('INV-VIC-FRO-20','inversores','Conjunto Victron + integración Fronius existente','Victron',20000,NULL,'conjunto',3920,3920,3920,1,'baja','Salida 20–21 kW con integración de inversor existente','Precio ligado a la integración con Fronius existente: no extrapolar.'),
('BAT-FEL-16','baterias','Batería Felicity','Felicity',NULL,16,'ud',2515,2480,2550,2,'alta','Batería 16 kWh',NULL),
('BAT-EVE-32','baterias','Batería LiFePO4 EVE','EVE',NULL,32,'ud',5080,5080,5080,2,'alta','Batería 32 kWh',NULL),
('MON-HOY','monitorizacion','Medidores y monitorización Hoymiles','Hoymiles',NULL,NULL,'conjunto',497.50,480,515,2,'media','Solo monitorización','Comprobar alcance: algunas referencias incluyen solo monitorización y otras también cableado y protecciones.'),
('MON-VIC','monitorizacion','Medidores y monitorización Victron','Victron',NULL,NULL,'conjunto',515,515,515,1,'media','Solo monitorización','Comprobar alcance exacto.'),
('MON-CAB-PROT','monitorizacion','Monitorización wifi + cableado + protecciones eléctricas',NULL,NULL,NULL,'conjunto',595,595,595,1,'media','Monitorización, cableado y protecciones','Incluye cableado y protecciones: no sumar además una partida separada de protecciones.'),
('TRA-BASE','tramites','Declaración responsable, memoria y CIE',NULL,NULL,NULL,'conjunto',620,620,620,3,'alta','Trámites del instalador',NULL),
('TRA-AMPL','tramites','Memoria, declaración responsable, certificados energéticos, CIE y RADNE',NULL,NULL,NULL,'conjunto',720,720,720,1,'media','Trámites ampliados del instalador',NULL),
('ING-EXT','ingenieria','Proyecto, dirección de obra y tramitación de ingeniería',NULL,NULL,NULL,'conjunto',1800,1800,1800,1,'pendiente','Ingeniería externa','Independiente de los trámites del instalador: no sumar dos veces conceptos iguales; revisar alcance por proyecto.'),
('INS-VIV-16','instalacion','Instalación y puesta en funcionamiento · vivienda 16 paneles',NULL,NULL,NULL,'conjunto',1350,1350,1350,1,'media','Montaje y puesta en funcionamiento (16 paneles)','En su presupuesto, monitorización/cableado/protecciones iban aparte (595 €).'),
('INS-MET-30','instalacion','Cableado, anclajes, conexiones e instalación · cubierta metálica 30 paneles',NULL,NULL,NULL,'conjunto',2150,2150,2150,1,'media','Instalación completa (30 paneles, cubierta metálica)',NULL),
('INS-MET-32','instalacion','Cableado, anclajes, conexiones e instalación · cubierta metálica 32 paneles',NULL,NULL,NULL,'conjunto',4220,4220,4220,1,'baja','Instalación completa (32 paneles, cubierta metálica)','Importe muy superior al de 30 paneles: no usar sin comprobar dificultad, distancias, protecciones y alcance.'),
('INS-NAVE-50','instalacion','Cableado, anclajes, conexiones e instalación · nave ganadera 50 paneles',NULL,NULL,NULL,'conjunto',5860,5860,5860,1,'media','Instalación completa (50 paneles, nave ganadera)',NULL),
('OPT-LINEA','linea','Duplicación de línea entre cubierta y cuadro general',NULL,NULL,NULL,'conjunto',1260,1260,1260,1,'media','Línea adicional','Opcional: solo añadir cuando sea necesario. No incluido por defecto.')
ON CONFLICT (codigo) DO NOTHING;

-- ═══ SEMILLA DE LOS 4 PRESUPUESTOS HISTÓRICOS DE ÓSCAR ═══
INSERT INTO fv_oscar_presupuestos (numero, cliente, potencia_kwp, num_paneles, inversor, bateria, subtotal, iva_pct, total, observaciones) VALUES
('26071301','Animalate',15.45,30,'Hoymiles híbrido 10 kW','Felicity 16 kWh',13000,21,15730,'La línea adicional de 1.260 € es OPCIONAL: el subtotal de 13.000 € la incluye.'),
('26071303','José Antonio',16.48,32,'Conjunto Victron 15 kW','EVE 32 kWh',18579,21,22480.59,NULL),
('260706','Perlag · nave agrícola',25.75,50,'Victron + Fronius existente (20–21 kW)','EVE 32 kWh',22595,21,27339.95,NULL),
('26072001','Perlag · vivienda',8.24,16,'Felicity híbrido monofásico 5 kW','Felicity 16 kWh',8082,21,9779.22,NULL)
ON CONFLICT (numero) DO NOTHING;

INSERT INTO fv_oscar_items (oscar_id, codigo_catalogo, descripcion, cantidad, precio_unitario, importe, opcional)
SELECT p.id, x.codigo, x.descripcion, x.cantidad, x.precio, x.importe, x.opcional
FROM (VALUES
  ('26071301','PAN-JIN-515','Panel Jinko 515 W',30,91,2730,false),
  ('26071301','EST-SUN-STD','Estructura Sunfer',30,41,1230,false),
  ('26071301','INV-HOY-10','Inversor Hoymiles híbrido 10 kW',1,1980,1980,false),
  ('26071301','BAT-FEL-16','Batería Felicity 16 kWh',1,2550,2550,false),
  ('26071301','MON-HOY','Medidores y monitorización Hoymiles',1,480,480,false),
  ('26071301','TRA-BASE','Trámites del instalador',1,620,620,false),
  ('26071301','OPT-LINEA','Línea adicional (opcional)',1,1260,1260,true),
  ('26071301','INS-MET-30','Cableado, anclajes, conexiones e instalación',1,2150,2150,false),
  ('26071303','PAN-JIN-515','Panel Jinko 515 W',32,91,2912,false),
  ('26071303','EST-SUN-STD','Estructura Sunfer',32,41,1312,false),
  ('26071303','INV-VIC-15','Conjunto inversor Victron 15 kW',1,3920,3920,false),
  ('26071303','BAT-EVE-32','Batería EVE 32 kWh',1,5080,5080,false),
  ('26071303','MON-VIC','Medidores y monitorización',1,515,515,false),
  ('26071303','TRA-BASE','Trámites del instalador',1,620,620,false),
  ('26071303','INS-MET-32','Cableado, anclajes, conexiones e instalación',1,4220,4220,false),
  ('260706','PAN-JIN-515','Panel Jinko 515 W',50,91,4550,false),
  ('260706','EST-SUN-STD','Estructura Sunfer',50,41,2050,false),
  ('260706','INV-VIC-FRO-20','Victron + integración Fronius (20–21 kW)',1,3920,3920,false),
  ('260706','BAT-EVE-32','Batería EVE 32 kWh',1,5080,5080,false),
  ('260706','MON-VIC','Medidores y monitorización Victron',1,515,515,false),
  ('260706','TRA-BASE','Trámites del instalador',1,620,620,false),
  ('260706','INS-NAVE-50','Instalación nave ganadera',1,5860,5860,false),
  ('26072001','PAN-JIN-515','Panel Jinko 515 W',16,91,1456,false),
  ('26072001','EST-SUN-STD','Estructura Sunfer',16,41,656,false),
  ('26072001','INV-FEL-5','Inversor Felicity híbrido monofásico 5 kW',1,825,825,false),
  ('26072001','BAT-FEL-16','Batería Felicity 16 kWh',1,2480,2480,false),
  ('26072001','INS-VIV-16','Instalación y puesta en funcionamiento',1,1350,1350,false),
  ('26072001','MON-CAB-PROT','Monitorización wifi, cableado y protecciones',1,595,595,false),
  ('26072001','TRA-AMPL','Trámites ampliados',1,720,720,false)
) AS x(numero, codigo, descripcion, cantidad, precio, importe, opcional)
JOIN fv_oscar_presupuestos p ON p.numero = x.numero
WHERE NOT EXISTS (
  SELECT 1 FROM fv_oscar_items i WHERE i.oscar_id = p.id AND i.descripcion = x.descripcion
);
