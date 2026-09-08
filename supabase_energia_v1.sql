-- ═══════════════════════════════════════════════════════════════════════════
-- GESTIÓN ENERGÉTICA v1 — el esquema
--
-- ⚠️  REVISAR ANTES DE EJECUTAR. Cuando esté dado por bueno, se lanza entero.
--     Es idempotente: se puede repetir sin romper nada.
--
-- Qué monta: el módulo que describe `Gesmeco_Diseno_Visual_Logica_Gestion_
-- Energetica.pdf` — llevar a un cliente desde «tiene un problema» hasta «esto
-- hemos hecho y esto ha ahorrado», con las evidencias colocadas para poder
-- trabajar las ISO 50002, 50006, 50015 y 50001.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- LAS NUEVE DECISIONES QUE MANDAN SOBRE TODO LO DEMÁS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1. NO SUSTITUYE AL CRM. El cliente sigue siendo `luz_clientes`, el suministro
--    `luz_cups` y las tareas `luz_tareas`. Aquí no hay tabla de clientes ni de
--    tareas: hay una columna nueva en las que ya existen.
--
-- 2. SE LLAMA `energia_`, NO `luz_`. No es luz: la 50001 cubre TODA la energía.
--    Una granja de La Litera tiene electricidad, gasóleo y a menudo propano.
--    Un módulo que solo sepa de electricidad produce una línea base coja y una
--    verificación que no se sostiene delante de nadie.
--
-- 3. LA FASE ENERGÉTICA NO ES LA ETAPA COMERCIAL. El PDF lo pide con esas
--    palabras. Un cliente puede tener la luz activada (etapa comercial:
--    activo) y una actuación técnica en estudio. Si compartieran vocabulario,
--    activar un contrato cerraría un expediente que sigue abierto.
--
-- 4. UN DATO = UNA FILA, CON SU VECTOR, SU UNIDAD, SU PERIODO, SU ORIGEN Y SU
--    ESTADO DE REVISIÓN. Nada de columnas «consumo_enero, consumo_febrero»:
--    eso impide el periodo personalizado que pide la página 6, y sin unidad
--    explícita no se distingue kWp de kW ni kWh de kVArh.
--
-- 5. LA CONVERSIÓN A kWh SE CONGELA CON SU FACTOR. Un litro de gasóleo son
--    ~9,98 kWh, pero ese factor es una referencia que puede afinarse. Si la
--    medida guardara solo litros y el kWh se calculara al vuelo, el día que
--    alguien corrija el factor cambiarían TODAS las líneas base históricas
--    hacia atrás. Se guarda el valor original, el convertido y el factor usado.
--    Misma lección que congelar los precios de un estudio.
--
-- 6. UN HUECO ES UN HUECO, NUNCA UN CERO. Un mes que falta es una fila que no
--    existe. La cobertura se calcula, y con cobertura parcial NO se enseña un
--    consumo anual. Es lo que ya hace `plantilla-consumos.ts`.
--
-- 7. DOS VALORES EN CONFLICTO CONVIVEN. Si la factura dice 49.111 kWh y la
--    curva dice otra cosa, se guardan los dos. El que pierde apunta al que gana
--    y guarda POR QUÉ perdió. Sobrescribirlo borra la única prueba de que hubo
--    discrepancia — que es justo lo que pregunta una verificación de ahorros.
--
-- 8. LA LÍNEA BASE ES UN MODELO, NO UN NÚMERO. Ahorro = (lo que el modelo
--    predice para las condiciones de ESTE año) − (lo realmente consumido). Con
--    «antes menos después», todo cliente que baje producción parece un éxito y
--    todo el que crezca parece un fracaso.
--
-- 9. NADA SE APRUEBA SOLO. `revision` nace en 'pendiente'. Cargar un archivo no
--    convierte su contenido en dato válido (página 6). Aprobar es un acto de
--    una persona, con nombre y fecha.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- LO QUE NO ESTÁ EN LA v1, A PROPÓSITO
-- ═══════════════════════════════════════════════════════════════════════════
--
-- · CAMPOS PERSONALIZABLES (página 11 del PDF). Es la pieza de más riesgo y
--   menos retorno: así se acaba con una base que nadie puede consultar y unos
--   indicadores que se rompen al retirar un campo. Primero plantillas por
--   sector EN CÓDIGO; cuando se sepa qué campos se usan de verdad, se ascienden
--   a columnas. Los campos libres son para 500 clientes y 12 sectores.
--
-- · ALCANCE «GESMECO» COMO ORGANIZACIÓN CERTIFICABLE. El consumo propio es una
--   oficina. El valor está en Gesmeco como CONSULTOR de sus clientes.
--
-- · ACCESO DEL CLIENTE. Primero que funcione para los tres de dentro.
--
-- El modelo está pensado para 30+ clientes y años de histórico. La interfaz se
-- construirá para los primeros: las tablas no cuestan, las pantallas sí.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. EXPEDIENTE ENERGÉTICO
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La carpeta de trabajo de un cliente para un objetivo. «Valquercus / potencia»
-- es un expediente; si mañana se abre reactiva en la otra granja, es otro.

CREATE TABLE IF NOT EXISTS energia_expedientes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id   UUID NOT NULL REFERENCES luz_clientes(id) ON DELETE CASCADE,

  -- Escrito por una persona y en cristiano. Es lo primero que se lee y lo que
  -- evita que dentro de seis meses nadie sepa para qué se abrió esto.
  objetivo     TEXT NOT NULL,
  titulo_corto TEXT,

  fase         TEXT NOT NULL DEFAULT 'diagnostico'
               CHECK (fase IN ('diagnostico','en_estudio','propuesta',
                               'ejecucion','verificacion','seguimiento',
                               'cerrado','aparcado')),

  -- ── EL ALCANCE (el «límite» de la 50001) ──
  -- Sin frontera declarada no hay verificación posible: es la primera pregunta
  -- de cualquier auditor y la primera que se olvida.
  --
  -- Los VECTORES van aquí como array porque son pocos y fijos. Las SEDES van en
  -- tabla aparte (`energia_expediente_ubicaciones`), porque son muchas y hay
  -- que poder entrar y salir del alcance dejando rastro.
  vectores     TEXT[] NOT NULL DEFAULT ARRAY['electricidad'],
  alcance_nota TEXT,

  responsable  TEXT,
  prioridad    TEXT DEFAULT 'B',

  -- Se conserva como nota, pero MANDA la tarea real de `luz_tareas`. Es la
  -- lección de `reglas-cartera.ts`: dos sitios para «lo siguiente» acaban
  -- contradiciéndose, y quien abre la ficha se queda tranquilo mientras el
  -- cliente se cae.
  nota_situacion TEXT,

  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  borrado_en     TIMESTAMPTZ,
  borrado_por    TEXT,
  motivo_borrado TEXT
);

CREATE INDEX IF NOT EXISTS ix_exp_cliente ON energia_expedientes(cliente_id) WHERE borrado_en IS NULL;
CREATE INDEX IF NOT EXISTS ix_exp_fase    ON energia_expedientes(fase)       WHERE borrado_en IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. INSTALACIONES: DÓNDE ESTÁ LA ENERGÍA
-- ═══════════════════════════════════════════════════════════════════════════
--
-- «Centro, nave, proceso y equipo describen el lugar. El CUPS describe el
-- suministro. Se relacionan, pero no son lo mismo.» (página 5)
--
-- La tabla es un ÁRBOL de profundidad libre porque es barato y no encierra:
-- una granja tiene naves, una industria líneas y un hotel plantas. Pero LA
-- PANTALLA DE LA v1 PINTARÁ SOLO DOS NIVELES (emplazamiento → área), que cubre
-- el 100 % de la comarca. Un árbol libre en pantalla significa widget de árbol,
-- arrastrar y soltar y nodos huérfanos: mucha interfaz para un caso que no hay.

CREATE TABLE IF NOT EXISTS energia_ubicaciones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID NOT NULL REFERENCES luz_clientes(id) ON DELETE CASCADE,
  padre_id    UUID REFERENCES energia_ubicaciones(id) ON DELETE CASCADE,

  nombre      TEXT NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'area'
              CHECK (tipo IN ('emplazamiento','area','proceso','sin_asignar')),

  descripcion TEXT,
  direccion   TEXT,

  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  borrado_en     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_ubi_cliente ON energia_ubicaciones(cliente_id) WHERE borrado_en IS NULL;
CREATE INDEX IF NOT EXISTS ix_ubi_padre   ON energia_ubicaciones(padre_id)   WHERE borrado_en IS NULL;

-- Qué sedes entran en el alcance del expediente, y desde cuándo. Con fechas,
-- porque una nave que se incorpora a mitad de año OBLIGA a ajustar la línea
-- base — y ese es justo el ajuste no rutinario que hay que poder justificar.
--
-- LLEVA `id` PROPIO AUNQUE SEA UNA TABLA PUENTE, y no es capricho: la función
-- de auditoría del sistema (`fn_auditar`) escribe `NEW.id`, así que sin esa
-- columna el trigger revienta CADA INSERCIÓN con «record "new" has no field
-- "id"». Y esta tabla ES el alcance del sistema de gestión: cambiar qué sedes
-- entran es exactamente lo que un auditor pide ver documentado. La clave real
-- sigue siendo el par, ahora como UNIQUE.
CREATE TABLE IF NOT EXISTS energia_expediente_ubicaciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES energia_expedientes(id) ON DELETE CASCADE,
  ubicacion_id  UUID NOT NULL REFERENCES energia_ubicaciones(id) ON DELETE CASCADE,
  desde         DATE,
  hasta         DATE,
  UNIQUE (expediente_id, ubicacion_id)
);

-- ── El puente ubicación ↔ suministro ───────────────────────────────────────
--
-- TABLA APARTE Y NO UNA COLUMNA `cups_id`: una nave puede alimentarse de dos
-- CUPS y un CUPS puede alimentar tres naves. Con una columna habría que elegir
-- uno y mentir sobre el resto, y luego el reparto de consumo por proceso no
-- cuadra sin que se sepa por qué.
-- `id` propio por lo mismo que la tabla de alcance: `fn_auditar` escribe
-- `NEW.id`. Y aquí la traza importa igual, porque el `reparto_pct` decide qué
-- consumo se le atribuye a cada proceso: cambiarlo mueve todos los
-- indicadores por área sin que se vea de dónde salió el cambio.
CREATE TABLE IF NOT EXISTS energia_ubicacion_cups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ubicacion_id UUID NOT NULL REFERENCES energia_ubicaciones(id) ON DELETE CASCADE,
  cups_id      UUID NOT NULL REFERENCES luz_cups(id) ON DELETE CASCADE,
  -- Qué parte se atribuye aquí, SI se ha llegado a repartir.
  -- NULL = todavía no se sabe, que no es lo mismo que 0.
  reparto_pct  NUMERIC CHECK (reparto_pct IS NULL OR (reparto_pct >= 0 AND reparto_pct <= 100)),
  nota         TEXT,
  UNIQUE (ubicacion_id, cups_id)
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. EQUIPOS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- «Una potencia desconocida queda vacía» y «guardar no equivale a validar el
-- dato» (página 4): casi todo es NULL-able y el estado del DATO va aparte del
-- dato.

CREATE TABLE IF NOT EXISTS energia_equipos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id   UUID NOT NULL REFERENCES luz_clientes(id) ON DELETE CASCADE,
  ubicacion_id UUID REFERENCES energia_ubicaciones(id) ON DELETE SET NULL,

  nombre       TEXT NOT NULL,
  categoria    TEXT,           -- alimentación, ventilación, bombeo, frío, FV…
  cantidad     INTEGER DEFAULT 1,
  vector       TEXT NOT NULL DEFAULT 'electricidad',

  -- TRES POTENCIAS DISTINTAS Y NO UNA (página 5). Un motor de 15 kW mecánicos
  -- NO consume 15 kW eléctricos. En la misma casilla, ese error viaja hasta la
  -- propuesta sin que nadie lo vea.
  potencia_electrica_kw NUMERIC,
  potencia_mecanica_kw  NUMERIC,
  potencia_termica_kw   NUMERIC,
  rendimiento           NUMERIC,   -- para poder pasar de mecánica a eléctrica

  -- FV con sus unidades separadas, que es el ejemplo del propio PDF.
  fv_paneles_kwp   NUMERIC,
  fv_inversor_kw   NUMERIC,
  bateria_kwh      NUMERIC,

  horas_uso_dia    NUMERIC,
  dias_uso_ano     NUMERIC,
  regulacion       TEXT,       -- variador, arranque directo, termostato…

  -- «Marcar ventilación y otros servicios según validación del cliente.»
  -- En una granja, parar la ventilación mata animales. Es una salvaguarda
  -- contra una recomendación automática, no una etiqueta informativa.
  es_carga_critica     BOOLEAN NOT NULL DEFAULT false,
  critica_validada_por TEXT,

  -- El estado del DATO, no del equipo: un equipo puede estar perfecto mientras
  -- su ficha está a medias.
  estado_dato  TEXT NOT NULL DEFAULT 'pendiente'
               CHECK (estado_dato IN ('pendiente','declarado','medido','aprobado')),
  fuente       TEXT,           -- «declaración del cliente», «placa», «medida»…
  notas        TEXT,

  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  borrado_en     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_equipo_cliente   ON energia_equipos(cliente_id)   WHERE borrado_en IS NULL;
CREATE INDEX IF NOT EXISTS ix_equipo_ubicacion ON energia_equipos(ubicacion_id) WHERE borrado_en IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. MEDIDAS — EL CORAZÓN
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Una fila = un vector, una magnitud, un periodo, una unidad, un origen y un
-- estado de revisión. Es lo que hace posibles la 50006 y la 50015, porque las
-- dos preguntan lo mismo: ¿de dónde salió este número y quién dijo que valía?
--
-- POR QUÉ NO REUTILIZO `luz_cups.consumo_anual_kwh`: ese campo es UN número
-- para poder ofertar. Aquí hace falta la serie con su trazabilidad. Conviven, y
-- lo que NO va a pasar es que se copien en silencio: si difieren, la ficha del
-- suministro enseña la diferencia. Una diferencia visible es información; una
-- sincronización callada es una mentira futura.

CREATE TABLE IF NOT EXISTS energia_medidas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    UUID NOT NULL REFERENCES luz_clientes(id) ON DELETE CASCADE,
  expediente_id UUID REFERENCES energia_expedientes(id) ON DELETE SET NULL,

  -- A qué se refiere. Ninguno es obligatorio: una lectura traída de una visita
  -- se guarda igual y se vincula después. Perder el dato por no saber todavía
  -- dónde va es mucho peor que tenerlo sin colocar.
  cups_id       UUID REFERENCES luz_cups(id) ON DELETE SET NULL,
  ubicacion_id  UUID REFERENCES energia_ubicaciones(id) ON DELETE SET NULL,
  equipo_id     UUID REFERENCES energia_equipos(id) ON DELETE SET NULL,

  -- EL VECTOR. Sin esto no hay 50001: el indicador total de una granja incluye
  -- el gasóleo de la calefacción, no solo la factura de la luz.
  vector        TEXT NOT NULL DEFAULT 'electricidad'
                CHECK (vector IN ('electricidad','gas_natural','gasoleo',
                                  'propano','biomasa','solar_termica','otro')),

  -- MAGNITUDES SEPARADAS (página 6): «sin datos FV no inferir consumo total».
  -- Sumar compra de red y autoconsumo sin tener la producción medida es
  -- inventarse el denominador de todos los indicadores que vengan después.
  magnitud      TEXT NOT NULL
                CHECK (magnitud IN (
                  'consumo','autoconsumo','produccion','excedentes',
                  'reactiva','potencia_max','coste','variable_actividad')),

  -- La unidad SIEMPRE escrita, aunque parezca deducible: `variable_actividad`
  -- puede ser plazas, toneladas, m² o cabezas, y sin unidad un indicador de la
  -- 50006 no significa nada.
  unidad        TEXT NOT NULL,
  concepto      TEXT,          -- para variable_actividad: «plazas ocupadas»
  valor         NUMERIC NOT NULL,

  -- ── LA CONVERSIÓN, CONGELADA (decisión 5) ──
  -- Se guarda el valor en kWh y EL FACTOR CON EL QUE SE OBTUVO. Si el factor
  -- se recalculara al vuelo, afinarlo un día cambiaría todas las líneas base
  -- históricas hacia atrás sin que nadie lo pidiera.
  valor_kwh        NUMERIC,
  factor_kwh_usado NUMERIC,

  -- PERIODO CON FECHAS, NO CON MES (página 6: periodo personalizado). Las
  -- facturas reales no empiezan el día 1, y con fechas se puede anualizar por
  -- días reales — que es lo que ya hace `plantilla-consumos.ts`.
  periodo_inicio DATE NOT NULL,
  periodo_fin    DATE NOT NULL,
  CONSTRAINT periodo_coherente CHECK (periodo_fin >= periodo_inicio),

  -- Para 3.0TD/6.1TD: a qué periodo tarifario pertenece. NULL = el total.
  periodo_tarifa SMALLINT CHECK (periodo_tarifa IS NULL OR periodo_tarifa BETWEEN 1 AND 6),

  origen        TEXT NOT NULL DEFAULT 'manual'
                CHECK (origen IN ('factura','lectura_contador','curva_datadis',
                                  'plantilla_excel','telemedida','estimado','manual')),
  documento_id  UUID,   -- FK más abajo, cuando exista la tabla

  -- NACE EN PENDIENTE. Cargar un archivo no aprueba su contenido.
  revision      TEXT NOT NULL DEFAULT 'pendiente'
                CHECK (revision IN ('pendiente','contrastada','aprobada','descartada')),
  revisado_por  TEXT,
  revisado_en   TIMESTAMPTZ,

  -- CONFLICTOS SIN PERDER NADA (decisión 7). El que pierde apunta al que gana
  -- y guarda por qué perdió.
  sustituida_por  UUID REFERENCES energia_medidas(id) ON DELETE SET NULL,
  motivo_revision TEXT,

  -- Lo que `leerNumero` marque como dudoso llega hasta aquí ESCRITO, nunca
  -- corregido a la brava. Misma regla que la plantilla de consumos.
  aviso         TEXT,
  nota          TEXT,

  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  borrado_en     TIMESTAMPTZ
);

-- Índices pensados para volumen: con 30 clientes, 5 suministros, 4 vectores y
-- años de histórico esto son cientos de miles de filas, y las tres consultas
-- que hace la pantalla son siempre las mismas.
CREATE INDEX IF NOT EXISTS ix_med_serie ON energia_medidas
  (cliente_id, vector, magnitud, periodo_inicio) WHERE borrado_en IS NULL;
CREATE INDEX IF NOT EXISTS ix_med_cups  ON energia_medidas
  (cups_id, periodo_inicio) WHERE borrado_en IS NULL;
CREATE INDEX IF NOT EXISTS ix_med_exp   ON energia_medidas
  (expediente_id, periodo_inicio) WHERE borrado_en IS NULL;
CREATE INDEX IF NOT EXISTS ix_med_pendientes ON energia_medidas
  (revision) WHERE borrado_en IS NULL AND revision = 'pendiente';

-- NO hay índice único sobre (cups, magnitud, periodo) A PROPÓSITO. Dos medias
-- facturas de un mes pueden ser las dos válidas, y dos fuentes del mismo mes es
-- el conflicto que hay que PODER guardar (decisión 7). Los duplicados se
-- detectan al importar y se le enseñan a una persona, que es donde tienen
-- arreglo. Una restricción aquí solo lograría que el importador reventara con
-- datos legítimos.


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. USOS SIGNIFICATIVOS DE LA ENERGÍA (los «USE» de la 50001)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- No basta con decir «la ventilación es significativa»: hay que decir POR QUÉ
-- lo es. La norma lo exige y, más importante, evita que el criterio cambie
-- según quién mire. Es la base del diagnóstico (50002).

CREATE TABLE IF NOT EXISTS energia_usos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES energia_expedientes(id) ON DELETE CASCADE,
  ubicacion_id  UUID REFERENCES energia_ubicaciones(id) ON DELETE SET NULL,
  equipo_id     UUID REFERENCES energia_equipos(id) ON DELETE SET NULL,

  nombre        TEXT NOT NULL,
  vector        TEXT NOT NULL DEFAULT 'electricidad',

  -- POR QUÉ es significativo. Sin esto es una opinión.
  criterio      TEXT NOT NULL,
  consumo_kwh_ano NUMERIC,
  pct_del_total   NUMERIC,

  -- Quién puede influir en él: sin responsable, un uso significativo es una
  -- observación y no una palanca.
  responsable   TEXT,
  potencial_mejora TEXT,

  revisado_por  TEXT,
  revisado_en   TIMESTAMPTZ,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  borrado_en    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_uso_exp ON energia_usos(expediente_id) WHERE borrado_en IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. INDICADORES (IDEn / EnPI — ISO 50006)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Un indicador es una DEFINICIÓN: qué se divide entre qué, en qué alcance.
-- «kWh por plaza ocupada y mes», «kWh por tonelada producida».
--
-- SUS VALORES NO SE GUARDAN: se calculan desde `energia_medidas`. Guardarlos
-- sería tener dos verdades y que la de la tabla se quedara vieja en cuanto
-- alguien corrigiera una medida. Es la misma regla que ya rige los vencimientos
-- («se calculan en vivo desde el CUPS»).

CREATE TABLE IF NOT EXISTS energia_indicadores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES energia_expedientes(id) ON DELETE CASCADE,

  nombre        TEXT NOT NULL,          -- «Consumo por plaza»
  -- El numerador: qué energía.
  magnitud      TEXT NOT NULL DEFAULT 'consumo',
  vector        TEXT,                   -- NULL = todos los del alcance
  -- El denominador: contra qué se normaliza. NULL = indicador absoluto.
  variable      TEXT,                   -- «plazas ocupadas»
  unidad_resultado TEXT NOT NULL,       -- «kWh/plaza·mes»

  descripcion   TEXT,
  activo        BOOLEAN NOT NULL DEFAULT true,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  borrado_en    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_ind_exp ON energia_indicadores(expediente_id) WHERE borrado_en IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. LÍNEA BASE (EnB — ISO 50006 / 50015)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- LA PIEZA MÁS DELICADA DEL MÓDULO. Una línea base NO es un número: es un
-- modelo del consumo en función de sus variables, ajustado sobre un periodo
-- concreto. El ahorro es lo que el modelo predice para las condiciones de este
-- año menos lo que de verdad se ha consumido.
--
-- SE CONGELA, como los precios de un estudio. Una línea base aprobada no se
-- recalcula sola: si cambia, es una versión NUEVA con su motivo, y la anterior
-- se conserva. Todo informe de ahorro dice contra qué versión se calculó.
--
-- La calidad del ajuste se guarda (R², CV-RMSE) porque un modelo malo produce
-- ahorros inventados con toda la apariencia de ser ciertos, y el que lo lee
-- tiene derecho a saberlo.

CREATE TABLE IF NOT EXISTS energia_lineas_base (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES energia_expedientes(id) ON DELETE CASCADE,
  indicador_id  UUID REFERENCES energia_indicadores(id) ON DELETE SET NULL,

  nombre        TEXT NOT NULL,
  vector        TEXT,
  magnitud      TEXT NOT NULL DEFAULT 'consumo',

  -- EL PERIODO BASE. Congelado y explícito: es contra lo que se compara todo.
  periodo_inicio DATE NOT NULL,
  periodo_fin    DATE NOT NULL,
  CONSTRAINT base_coherente CHECK (periodo_fin > periodo_inicio),

  metodo        TEXT NOT NULL DEFAULT 'media'
                CHECK (metodo IN ('media','regresion_simple','regresion_multiple')),

  -- Qué variables entran y con qué coeficientes. JSON porque el número de
  -- variables cambia por cliente y una tabla de 20 columnas vacías no ayuda.
  variables     JSONB NOT NULL DEFAULT '[]'::jsonb,
  coeficientes  JSONB,

  -- CALIDAD DEL AJUSTE. Un R² bajo no invalida el modelo, pero obliga a
  -- decirlo: sin esto, un ahorro «verificado» sobre un modelo que no explica
  -- nada es indistinguible de uno bueno.
  r2            NUMERIC,
  cv_rmse       NUMERIC,
  n_observaciones INTEGER,

  estado        TEXT NOT NULL DEFAULT 'borrador'
                CHECK (estado IN ('borrador','aprobada','sustituida','descartada')),
  aprobada_por  TEXT,
  aprobada_en   TIMESTAMPTZ,
  sustituida_por UUID REFERENCES energia_lineas_base(id) ON DELETE SET NULL,
  motivo        TEXT,

  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  borrado_en     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_lb_exp ON energia_lineas_base(expediente_id) WHERE borrado_en IS NULL;

-- Solo UNA línea base aprobada por indicador a la vez. Dos aprobadas es dos
-- ahorros distintos para el mismo cliente, y no habría forma de saber cuál se
-- usó en el informe que ya está impreso.
CREATE UNIQUE INDEX IF NOT EXISTS ix_lb_una_aprobada
  ON energia_lineas_base(expediente_id, coalesce(indicador_id, id))
  WHERE estado = 'aprobada' AND borrado_en IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- 8. AJUSTES DE LA LÍNEA BASE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- El cliente monta una nave nueva, cambia un turno o amplía la cabaña. La línea
-- base hay que ajustarla, y si el ajuste no queda escrito CON SU MOTIVO, el
-- ahorro se va deformando solo y nadie sabe cuándo empezó a mentir.
--
--   · RUTINARIO: la variable ya está en el modelo (más plazas → más consumo).
--     Lo absorbe la fórmula, no hace falta tocar nada.
--   · NO RUTINARIO: algo que el modelo no contempla (una nave nueva). Exige
--     una decisión de una persona y queda aquí.

CREATE TABLE IF NOT EXISTS energia_ajustes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linea_base_id  UUID NOT NULL REFERENCES energia_lineas_base(id) ON DELETE CASCADE,

  tipo           TEXT NOT NULL CHECK (tipo IN ('rutinario','no_rutinario')),
  fecha_efecto   DATE NOT NULL,
  -- OBLIGATORIO. Un ajuste sin motivo es un número cambiado a mano.
  motivo         TEXT NOT NULL,
  impacto_kwh    NUMERIC,
  documento_id   UUID,

  aplicado_por   TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_aj_lb ON energia_ajustes(linea_base_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 9. ACTUACIONES
-- ═══════════════════════════════════════════════════════════════════════════
--
-- «Cada una tiene su objetivo, responsable y siguiente paso» (página 8), y
-- estados INDEPENDIENTES del comercial: «una venta de luz activada puede tener
-- una actuación técnica pendiente».

CREATE TABLE IF NOT EXISTS energia_actuaciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    UUID NOT NULL REFERENCES luz_clientes(id) ON DELETE CASCADE,
  expediente_id UUID REFERENCES energia_expedientes(id) ON DELETE SET NULL,
  ubicacion_id  UUID REFERENCES energia_ubicaciones(id) ON DELETE SET NULL,
  cups_id       UUID REFERENCES luz_cups(id) ON DELETE SET NULL,
  uso_id        UUID REFERENCES energia_usos(id) ON DELETE SET NULL,

  titulo        TEXT NOT NULL,
  tipo          TEXT NOT NULL DEFAULT 'otra'
                CHECK (tipo IN ('potencia','reactiva','fotovoltaica','almacenamiento',
                                'gestion_cargas','eficiencia','tarifa','refuerzo_red',
                                'combustible','otra')),

  -- El problema, escrito. Sin esto, en seis meses nadie recuerda por qué se
  -- abrió y la actuación se cierra «porque ya no hacía falta».
  problema      TEXT,
  alternativas  JSONB NOT NULL DEFAULT '[]'::jsonb,

  estado        TEXT NOT NULL DEFAULT 'en_estudio'
                CHECK (estado IN ('en_estudio','presentada','aceptada',
                                  'ejecucion','verificacion','cerrada','descartada')),

  -- ECONOMÍA SIN DUPLICAR (página 8): se ENLAZA el presupuesto que ya existe en
  -- el CRM. Copiar el importe garantiza que en un mes la actuación diga un
  -- número y el estudio otro.
  estudio_id      UUID REFERENCES luz_estudios(id) ON DELETE SET NULL,
  presupuesto_ref TEXT,
  inversion_eur   NUMERIC,

  -- PREVISTO Y COMPROBADO SEPARADOS. Es la línea entre una promesa y un hecho,
  -- y es literalmente lo que verifica la 50015. En el mismo campo, una
  -- estimación se convierte en resultado sin que nadie lo decida.
  ahorro_previsto_eur   NUMERIC,
  ahorro_previsto_kwh   NUMERIC,
  ahorro_comprobado_eur NUMERIC,
  ahorro_comprobado_kwh NUMERIC,
  linea_base_id         UUID REFERENCES energia_lineas_base(id) ON DELETE SET NULL,
  metodo_verificacion   TEXT,
  verificado_por        TEXT,
  verificado_en         TIMESTAMPTZ,

  -- Para los CAE hace falta saber qué actuación se acogió a qué método y con
  -- qué documentación. Se guarda la referencia; el catálogo y sus requisitos
  -- se comprueban fuera, contra el BOE y el IDAE vigentes.
  cae_metodo    TEXT,
  cae_estado    TEXT,

  fecha_ejecucion DATE,
  responsable   TEXT,
  decision_pendiente TEXT,

  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  borrado_en     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_act_cliente ON energia_actuaciones(cliente_id) WHERE borrado_en IS NULL;
CREATE INDEX IF NOT EXISTS ix_act_estado  ON energia_actuaciones(estado)     WHERE borrado_en IS NULL;
CREATE INDEX IF NOT EXISTS ix_act_exp     ON energia_actuaciones(expediente_id) WHERE borrado_en IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- 10. DOCUMENTOS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- OJO: `documentos_cliente` YA EXISTE pero cuelga de `clientes_app` (el área de
-- cliente), no de `luz_clientes`. Para la cartera no hay gestión documental de
-- ningún tipo: esta tabla es nueva de verdad.
--
-- «Guardar una vez, encontrar desde cualquier vista» (página 9): un archivo
-- puede respaldar a la vez un suministro, un equipo y una actuación.

CREATE TABLE IF NOT EXISTS energia_documentos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    UUID NOT NULL REFERENCES luz_clientes(id) ON DELETE CASCADE,
  expediente_id UUID REFERENCES energia_expedientes(id) ON DELETE SET NULL,
  cups_id       UUID REFERENCES luz_cups(id) ON DELETE SET NULL,
  ubicacion_id  UUID REFERENCES energia_ubicaciones(id) ON DELETE SET NULL,
  equipo_id     UUID REFERENCES energia_equipos(id) ON DELETE SET NULL,
  actuacion_id  UUID REFERENCES energia_actuaciones(id) ON DELETE SET NULL,

  titulo        TEXT NOT NULL,
  tipo          TEXT NOT NULL DEFAULT 'otro'
                CHECK (tipo IN ('factura','curva','foto','plano','inventario',
                                'oferta','informe','nota','contrato','acta','otro')),

  -- Una NOTA no tiene archivo, y es la mitad de la bandeja: «pegar nota o
  -- adjuntar foto» desde el móvil, con el cliente ya precargado.
  archivo_path  TEXT,
  texto_nota    TEXT,
  mime_type     TEXT,
  tamano_bytes  INTEGER,

  -- «Pendiente de recibir» es una fila SIN archivo todavía: es lo que convierte
  -- «le pedí la curva» en algo reclamable en vez de en algo que se olvida.
  estado        TEXT NOT NULL DEFAULT 'por_clasificar'
                CHECK (estado IN ('por_clasificar','pendiente_recibir','guardado','descartado')),

  -- Los costes internos NO salen en el informe del cliente (página 9).
  visible_cliente BOOLEAN NOT NULL DEFAULT true,

  subido_por    TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  borrado_en     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_doc_cliente ON energia_documentos(cliente_id) WHERE borrado_en IS NULL;
CREATE INDEX IF NOT EXISTS ix_doc_bandeja ON energia_documentos(estado)
  WHERE borrado_en IS NULL AND estado IN ('por_clasificar','pendiente_recibir');

ALTER TABLE energia_medidas DROP CONSTRAINT IF EXISTS fk_medida_documento;
ALTER TABLE energia_medidas ADD CONSTRAINT fk_medida_documento
  FOREIGN KEY (documento_id) REFERENCES energia_documentos(id) ON DELETE SET NULL;

ALTER TABLE energia_ajustes DROP CONSTRAINT IF EXISTS fk_ajuste_documento;
ALTER TABLE energia_ajustes ADD CONSTRAINT fk_ajuste_documento
  FOREIGN KEY (documento_id) REFERENCES energia_documentos(id) ON DELETE SET NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- 11. EVIDENCIAS ISO
-- ═══════════════════════════════════════════════════════════════════════════
--
-- LO QUE ESTA TABLA ES: un puente entre un requisito de la norma y un registro
-- que YA EXISTE. «Cada pendiente lleva al dato»: pulsar «Línea base» abre su
-- formulario, no un apartado ISO donde volver a teclear lo mismo.
--
-- LO QUE NO ES: un certificado. Que estén todas las casillas llenas significa
-- que el expediente está ordenado — no que el cliente cumpla la norma ni que
-- esté certificado. La pantalla lo dirá con estas palabras y NO habrá ningún
-- porcentaje de cumplimiento: un porcentaje invita a jugar con él y además
-- miente.
--
-- EL CATÁLOGO DE REQUISITOS VIVE EN CÓDIGO (`src/lib/energia.ts`), no aquí.
-- Igual que `etapas.ts`: así se versiona, se testea y no acaban existiendo dos
-- catálogos distintos en dos entornos.

CREATE TABLE IF NOT EXISTS energia_iso_evidencias (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES energia_expedientes(id) ON DELETE CASCADE,

  -- Clave del catálogo: '50006.linea_base', '50015.plan_verificacion',
  -- '50001.roles', '50002.inventario'…
  requisito     TEXT NOT NULL,

  -- A qué registro real apunta. Exactamente uno.
  documento_id  UUID REFERENCES energia_documentos(id)  ON DELETE CASCADE,
  medida_id     UUID REFERENCES energia_medidas(id)     ON DELETE CASCADE,
  actuacion_id  UUID REFERENCES energia_actuaciones(id) ON DELETE CASCADE,
  linea_base_id UUID REFERENCES energia_lineas_base(id) ON DELETE CASCADE,
  uso_id        UUID REFERENCES energia_usos(id)        ON DELETE CASCADE,
  tarea_id      UUID REFERENCES luz_tareas(id)          ON DELETE CASCADE,

  -- «Sustituir una evidencia deja pendiente su nueva revisión»: la revisión es
  -- de la EVIDENCIA y no del requisito, porque cambiar el papel invalida la
  -- revisión anterior.
  estado        TEXT NOT NULL DEFAULT 'propuesta'
                CHECK (estado IN ('propuesta','revisada','rechazada','caducada')),
  revisado_por  TEXT,
  revisado_en   TIMESTAMPTZ,
  nota          TEXT,

  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  borrado_en    TIMESTAMPTZ,

  CONSTRAINT una_sola_referencia CHECK (
    (documento_id IS NOT NULL)::int + (medida_id IS NOT NULL)::int +
    (actuacion_id IS NOT NULL)::int + (linea_base_id IS NOT NULL)::int +
    (uso_id IS NOT NULL)::int + (tarea_id IS NOT NULL)::int = 1
  )
);

CREATE INDEX IF NOT EXISTS ix_iso_exp ON energia_iso_evidencias(expediente_id, requisito)
  WHERE borrado_en IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- 12. UNA SOLA LISTA DE TAREAS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `luz_tareas` gana dos vínculos. NO se crea una tabla de tareas del módulo
-- energético: David no puede tener dos bandejas — el día que las tenga, deja de
-- mirar las dos.

ALTER TABLE luz_tareas ADD COLUMN IF NOT EXISTS expediente_id UUID
  REFERENCES energia_expedientes(id) ON DELETE SET NULL;
ALTER TABLE luz_tareas ADD COLUMN IF NOT EXISTS actuacion_id UUID
  REFERENCES energia_actuaciones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_tareas_expediente ON luz_tareas(expediente_id);
CREATE INDEX IF NOT EXISTS ix_tareas_actuacion  ON luz_tareas(actuacion_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 13. RLS, TOQUES Y AUDITORÍA
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Mismo patrón que el resto (`supabase_rls_v2.sql`). La función de auditoría se
-- llama `fn_auditar` — comprobado contra la base, después de que dos scripts
-- buscaran nombres que no existían y se quedaran callados sin dar error.

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'energia_expedientes','energia_ubicaciones','energia_expediente_ubicaciones',
    'energia_ubicacion_cups','energia_equipos','energia_medidas','energia_usos',
    'energia_indicadores','energia_lineas_base','energia_ajustes',
    'energia_actuaciones','energia_documentos','energia_iso_evidencias'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS p_ver ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS p_crear ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS p_modificar ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS p_eliminar ON %I', t);
    EXECUTE format('CREATE POLICY p_ver ON %I FOR SELECT USING (tiene_permiso(''ver''))', t);
    EXECUTE format('CREATE POLICY p_crear ON %I FOR INSERT WITH CHECK (tiene_permiso(''crear''))', t);
    EXECUTE format('CREATE POLICY p_modificar ON %I FOR UPDATE USING (tiene_permiso(''modificar''))', t);
    EXECUTE format('CREATE POLICY p_eliminar ON %I FOR DELETE USING (tiene_permiso(''eliminar''))', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION energia_touch() RETURNS trigger AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'energia_expedientes','energia_ubicaciones','energia_equipos','energia_medidas',
    'energia_usos','energia_lineas_base','energia_actuaciones','energia_documentos'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_touch ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_touch BEFORE UPDATE ON %I
                    FOR EACH ROW EXECUTE FUNCTION energia_touch()', t);
  END LOOP;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  IF to_regprocedure('fn_auditar()') IS NULL THEN
    RAISE NOTICE 'No existe fn_auditar(): ejecuta antes supabase_equipo_usuarios.sql. Sin auditoría, el trabajo energético no saldrá en el parte del día.';
    RETURN;
  END IF;
  -- TODAS las tablas del módulo, incluidas las puente y los indicadores.
  --
  -- Se quedaron fuera en la primera versión y era un error: cambiar la
  -- definición de un IDEn cambia el significado de todos sus valores
  -- históricos, y cambiar qué sedes entran en el alcance es literalmente lo
  -- primero que pregunta un auditor. Las dos cosas tienen que dejar rastro.
  --
  -- Solo entran tablas con columna `id`: `fn_auditar` escribe `NEW.id` y sin
  -- ella el trigger revienta cada inserción.
  FOREACH t IN ARRAY ARRAY[
    'energia_expedientes','energia_ubicaciones','energia_expediente_ubicaciones',
    'energia_ubicacion_cups','energia_equipos','energia_medidas','energia_usos',
    'energia_indicadores','energia_lineas_base','energia_ajustes',
    'energia_actuaciones','energia_documentos','energia_iso_evidencias'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auditoria ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON %I
                    FOR EACH ROW EXECUTE FUNCTION fn_auditar()', t);
    RAISE NOTICE 'Auditoría activada en %', t;
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- COMPROBACIÓN
-- ═══════════════════════════════════════════════════════════════════════════
SELECT t AS tabla,
       to_regclass(t) IS NOT NULL AS creada,
       (SELECT count(*) FROM pg_policies WHERE tablename = t) AS politicas
  FROM unnest(ARRAY[
    'energia_expedientes','energia_ubicaciones','energia_expediente_ubicaciones',
    'energia_ubicacion_cups','energia_equipos','energia_medidas','energia_usos',
    'energia_indicadores','energia_lineas_base','energia_ajustes',
    'energia_actuaciones','energia_documentos','energia_iso_evidencias'
  ]) AS t
 ORDER BY 1;
