# 🚀 Setup de Supabase - Generador Fotovoltaico PRO

## ⚠️ Estado Actual

La tabla `proyectos_fotovoltaicos` **NO EXISTE** en Supabase.

## ✅ Cómo Crear la Tabla

### Opción 1: Manual (Recomendado)

1. **Abre el Dashboard de Supabase**
   - Dirección: https://app.supabase.com/
   - Inicia sesión con tu cuenta

2. **Selecciona el proyecto**
   - Proyecto: `gesmecoenergia-web`

3. **Ve a SQL Editor**
   - En el menú izquierdo: SQL Editor → New Query

4. **Copia el SQL**
   - Abre el archivo: `supabase_setup_fotovoltaica_completo.sql`
   - Copia TODO el contenido

5. **Ejecuta el SQL**
   - En el editor, pega el SQL
   - Haz click en el botón "RUN"
   - Espera a que se ejecute (debe decir ✅ Success)

6. **Verifica**
   - En el panel izquierdo, bajo "Tables", debes ver:
     - `proyectos_fotovoltaicos` (nueva tabla)

### Opción 2: Automática (en desarrollo)

```bash
# Una vez que crees la tabla manualmente, verifica que todo funcione:
npm run verify:supabase
```

## 📋 SQL Completo

```sql
-- ============================================
-- TABLA PROYECTOS FOTOVOLTAICOS - COMPLETA
-- ============================================

DROP TABLE IF EXISTS proyectos_fotovoltaicos CASCADE;

CREATE TABLE proyectos_fotovoltaicos (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- ===== DATOS DEL CLIENTE =====
  cliente_nombre TEXT NOT NULL,
  cliente_email TEXT,
  cliente_telefono TEXT,
  cliente_ubicacion TEXT NOT NULL,
  cliente_direccion TEXT,
  cliente_ubicacion_gps TEXT,
  cliente_descripcion TEXT,

  -- ===== ESPECIFICACIONES TÉCNICAS =====
  consumo_anual NUMERIC,
  potencia_deseada NUMERIC,
  fase_sistema VARCHAR(10),
  tipo_tejado VARCHAR(50),
  espacio_disponible NUMERIC,
  presupuesto_maximo NUMERIC,

  -- ===== ANÁLISIS TÉCNICO DETALLADO =====
  acceso_tejado VARCHAR(50),
  distancia_cuadro_electrico VARCHAR(50),
  espacio_almacenamiento VARCHAR(50),
  andamiaje_necesario VARCHAR(50),
  orientacion_tejado VARCHAR(50),
  inclinacion_tejado VARCHAR(50),
  sombreado VARCHAR(50),
  estado_tejado VARCHAR(50),
  carga_tejado_maxima NUMERIC,
  presencia_amianto VARCHAR(50),
  cuadro_accesible VARCHAR(50),
  tierra_adecuada VARCHAR(50),
  acometida_cambio VARCHAR(50),
  distancia_cableado VARCHAR(50),

  -- ===== CONDICIONES CLIMÁTICAS =====
  clima_viento BOOLEAN DEFAULT FALSE,
  clima_nieve BOOLEAN DEFAULT FALSE,
  clima_salinidad BOOLEAN DEFAULT FALSE,
  clima_polvo BOOLEAN DEFAULT FALSE,
  dificultades_especiales TEXT,

  -- ===== NECESIDADES ESPECIALES =====
  consumo_critico VARCHAR(50),
  independencia_prioridad VARCHAR(50),
  ampliacion_futura VARCHAR(50),

  -- ===== INFORMACIÓN DE VALOR PARA INSTALADOR =====
  altura_edificio_pisos NUMERIC,
  distancia_cuadro_a_tejado_metros NUMERIC,
  dias_instalacion_estimado NUMERIC,
  necesita_grua BOOLEAN DEFAULT FALSE,
  requiere_refuerzo_estructural BOOLEAN DEFAULT FALSE,
  reparaciones_tejado_previas BOOLEAN DEFAULT FALSE,

  -- ===== SISTEMA DE ALMACENAMIENTO =====
  incluir_baterias BOOLEAN DEFAULT FALSE,
  capacidad_baterias NUMERIC,

  -- ===== CÁLCULOS REALIZADOS =====
  num_paneles INTEGER,
  potencia_real NUMERIC,
  espacio_requerido NUMERIC,
  produccion_anual INTEGER,
  inversor_marca VARCHAR(100),
  inversor_modelo VARCHAR(100),

  -- ===== COSTOS Y PRESUPUESTO =====
  costos_materiales JSONB,
  costos_mano_obra JSONB,
  costos_dificultad JSONB,
  costos_extra JSONB,

  costo_total_materiales NUMERIC,
  costo_total_mano_obra NUMERIC,
  costo_total_dificultades NUMERIC,
  costo_total_extras NUMERIC,
  costo_total NUMERIC,

  margen_recomendado NUMERIC,
  precio_final_recomendado NUMERIC,

  -- ===== VALIDACIONES Y ALERTAS =====
  alertas JSONB,

  -- ===== ESTADO DEL PROYECTO =====
  estado VARCHAR(50) DEFAULT 'borrador'
);

-- ============================================
-- ÍNDICES PARA BÚSQUEDA RÁPIDA
-- ============================================

CREATE INDEX idx_proyectos_cliente_nombre
  ON proyectos_fotovoltaicos(cliente_nombre);

CREATE INDEX idx_proyectos_cliente_email
  ON proyectos_fotovoltaicos(cliente_email);

CREATE INDEX idx_proyectos_updated_at
  ON proyectos_fotovoltaicos(updated_at DESC);

CREATE INDEX idx_proyectos_estado
  ON proyectos_fotovoltaicos(estado);

CREATE INDEX idx_proyectos_created_at
  ON proyectos_fotovoltaicos(created_at DESC);

-- ============================================
-- SEGURIDAD - ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE proyectos_fotovoltaicos ENABLE ROW LEVEL SECURITY;

-- Política: Permitir operaciones sin restricción (desarrollo)
CREATE POLICY "allow_all_operations" ON proyectos_fotovoltaicos
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- DISPARADORES PARA ACTUALIZAR updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_updated_at
  BEFORE UPDATE ON proyectos_fotovoltaicos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================

COMMENT ON TABLE proyectos_fotovoltaicos IS 'Proyectos de instalación fotovoltaica - Generador PRO';
COMMENT ON COLUMN proyectos_fotovoltaicos.estado IS 'borrador, cotizado, contratado, en_instalacion, completado, cancelado';
COMMENT ON COLUMN proyectos_fotovoltaicos.costos_materiales IS 'Array JSON con desglose de materiales';
COMMENT ON COLUMN proyectos_fotovoltaicos.costos_mano_obra IS 'Array JSON con desglose de mano de obra';
COMMENT ON COLUMN proyectos_fotovoltaicos.alertas IS 'Array JSON con validaciones y alertas técnicas';
```

## ✅ Después de Crear la Tabla

1. **Verifica que funciona**
   ```bash
   npm run verify:supabase
   ```

2. **Inicia el servidor de desarrollo**
   ```bash
   npm run dev
   ```

3. **Abre la aplicación**
   - http://localhost:3000

4. **Prueba el generador fotovoltaico**
   - Ve a: Panel Gestión → Generador Fotovoltaico
   - Llena el formulario
   - Haz click en "CALCULAR"
   - Los datos se guardarán automáticamente en Supabase

## 🔍 Verificar que Funciona

En Supabase Dashboard:

1. Ve a: SQL Editor → New Query
2. Ejecuta:
   ```sql
   SELECT COUNT(*) FROM proyectos_fotovoltaicos;
   ```
3. Debería devolver el número de proyectos guardados

## 🔧 Estructura de la Tabla

### Tabla: `proyectos_fotovoltaicos`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | BIGSERIAL | ID único del proyecto |
| `created_at` | TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | Fecha última actualización |
| `cliente_nombre` | TEXT | Nombre del cliente * |
| `cliente_email` | TEXT | Email del cliente |
| `cliente_ubicacion` | TEXT | Ubicación del cliente * |
| `consumo_anual` | NUMERIC | Consumo en kWh/año |
| `potencia_deseada` | NUMERIC | Potencia deseada en kW |
| `fase_sistema` | VARCHAR | mono / tri |
| `tipo_tejado` | VARCHAR | teja, pizarra, chapa, plano, fibrocemento, sandwich |
| `altura_edificio_pisos` | NUMERIC | Altura en número de pisos |
| `distancia_cuadro_a_tejado_metros` | NUMERIC | Distancia en metros |
| `dias_instalacion_estimado` | NUMERIC | Días estimados |
| `necesita_grua` | BOOLEAN | Si necesita grúa |
| `costo_total` | NUMERIC | Costo total estimado |
| `precio_final_recomendado` | NUMERIC | Precio recomendado (con margen) |
| `estado` | VARCHAR | borrador, cotizado, contratado, etc. |
| `costos_materiales` | JSONB | Desglose de materiales |
| `costos_mano_obra` | JSONB | Desglose de mano de obra |
| `alertas` | JSONB | Validaciones técnicas |

* Campos obligatorios

## ❓ Solución de Problemas

### Error: "Table not found"
- La tabla no existe
- Ejecuta el SQL en Supabase Dashboard

### Error: "Permission denied"
- Verifica que RLS está habilitado
- Las políticas RLS permiten todas las operaciones

### Los datos no se guardan
- Abre la consola del navegador (F12)
- Verifica si hay errores de conexión
- Asegúrate que las credenciales en `.env.local` son correctas

## 📱 Variables de Entorno

Asegúrate de que `.env.local` contiene:

```
NEXT_PUBLIC_SUPABASE_URL=https://rhsflkemubgigagwmoqb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_OWi92FE3lAu3qd6YioVGJw_BrmCB_HM
```

## 🎉 ¡Listo!

Una vez creada la tabla, todos los formularios del generador fotovoltaico se guardarán automáticamente en Supabase.

---

**Última actualización:** 2025-06-29
