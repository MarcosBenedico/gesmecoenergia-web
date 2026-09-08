-- ═══════════════════════════════════════════════════════════════════════════
-- GESTIÓN ENERGÉTICA v1 — el esquema
--
-- ⚠️  NO EJECUTAR TODAVÍA. Esto es el MAPA DE DATOS para revisar antes de
--     construir nada encima. Cuando Marcos lo dé por bueno, se ejecuta entero.
--
-- De qué va: el módulo que describe `Gesmeco_Diseno_Visual_Logica_Gestion_
-- Energetica.pdf`, la mesa de trabajo para llevar a un cliente desde «tiene un
-- problema de potencia» hasta «esto es lo que hemos hecho y esto es lo que ha
-- ahorrado», con las evidencias colocadas para poder trabajar las ISO 50001,
-- 50006 y 50015.
--
-- ───────────────────────────────────────────────────────────────────────────
-- LAS SEIS DECISIONES QUE MANDAN SOBRE TODO LO DEMÁS
--
-- 1. NO SUSTITUYE AL CRM. El documento lo dice en la última línea. El cliente
--    sigue siendo `luz_clientes`, las tareas siguen siendo `luz_tareas` y los
--    archivos de venta siguen donde están. Aquí NO hay una tabla de clientes.
--
-- 2. LA FASE ENERGÉTICA NO ES LA ETAPA COMERCIAL. Son dos ejes distintos y el
--    PDF lo pide explícitamente: «no duplicar el estado del contrato en la
--    fase energética». Un cliente puede tener la luz ya activada (etapa
--    comercial: activo) y una actuación técnica en estudio. Si los mezcláramos,
--    activar un contrato cerraría un expediente que sigue abierto. Conviven
--    igual que `clasificacion` y `estado_comercial`.
--
-- 3. UN DATO, UNA FILA, CON SU UNIDAD Y SU PERIODO. `luz_medidas` es el
--    corazón. Nada de columnas «consumo_enero, consumo_febrero»: eso hace
--    imposible un periodo personalizado, que es lo primero que pide la página
--    6. Y sin unidad explícita no se puede distinguir kWp de kW ni kWh de
--    kVArh, que es el error que el PDF señala en la página 5.
--
-- 4. UN HUECO ES UN HUECO. Un mes que falta es una fila que no existe, jamás
--    un cero. La cobertura se calcula contando lo que hay contra lo que
--    debería haber, y con cobertura parcial NO se enseña un consumo anual.
--    Es la misma regla que ya aplica `plantilla-consumos.ts` al anualizar por
--    días facturados, y por el mismo motivo: un número estimado que no se
--    anuncia es peor que no tenerlo.
--
-- 5. DOS VALORES EN CONFLICTO CONVIVEN. Si la factura dice 49.111 kWh y la
--    curva del contador dice otra cosa, se guardan LOS DOS y se abre la
--    comparación. Elegir uno exige motivo y deja rastro. Sobrescribir el
--    perdedor es perder la única prueba de que hubo una discrepancia — y en
--    una verificación de ahorros (50015) eso es justo lo que te preguntan.
--
-- 6. NADA SE APRUEBA SOLO. `revision` nace en 'pendiente'. Cargar un archivo
--    no convierte su contenido en dato válido (página 6). Aprobar es un acto
--    de una persona, con nombre y fecha.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. EL EXPEDIENTE ENERGÉTICO
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La carpeta de trabajo de un cliente para un objetivo concreto. «Valquercus /
-- potencia» es un expediente; si mañana se abre un tema de reactiva en la otra
-- granja, es otro. Por eso no es una columna en `luz_clientes`.

CREATE TABLE IF NOT EXISTS luz_expedientes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id   UUID NOT NULL REFERENCES luz_clientes(id) ON DELETE CASCADE,

  -- «Resolver la necesidad de potencia y comparar alternativas al refuerzo de
  -- red.» En cristiano y escrito por una persona: es lo primero que se lee en
  -- el resumen y lo que evita que nadie sepa para qué se abrió esto.
  objetivo     TEXT NOT NULL,
  titulo_corto TEXT,

  -- LA FASE ENERGÉTICA. Vocabulario propio y separado del comercial (ver la
  -- decisión 2 de la cabecera). El catálogo vivirá también en TypeScript
  -- (`src/lib/energia.ts`) para poder testearlo, igual que `etapas.ts`.
  fase         TEXT NOT NULL DEFAULT 'diagnostico'
               CHECK (fase IN ('diagnostico','en_estudio','propuesta',
                               'ejecucion','verificacion','seguimiento',
                               'cerrado','aparcado')),

  -- El alcance de la ISO: de quién es el sistema de gestión que se documenta.
  -- La página 10 lo pide como elección explícita — Valquercus o Gesmeco — y no
  -- como algo que se deduzca.
  alcance      TEXT NOT NULL DEFAULT 'cliente'
               CHECK (alcance IN ('cliente','gesmeco')),

  responsable  TEXT,
  prioridad    TEXT DEFAULT 'B',

  -- Se conserva, pero manda la tarea real de `luz_tareas` — es la lección de
  -- `reglas-cartera.ts`: dos sitios para «lo siguiente» acaban contradiciéndose
  -- y quien abre la ficha se queda tranquilo mientras el cliente se cae.
  nota_situacion TEXT,

  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  borrado_en     TIMESTAMPTZ,
  borrado_por    TEXT,
  motivo_borrado TEXT
);

CREATE INDEX IF NOT EXISTS ix_exp_cliente ON luz_expedientes(cliente_id) WHERE borrado_en IS NULL;
CREATE INDEX IF NOT EXISTS ix_exp_fase    ON luz_expedientes(fase)       WHERE borrado_en IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. INSTALACIONES: DÓNDE ESTÁ LA ENERGÍA
-- ═══════════════════════════════════════════════════════════════════════════
--
-- «Centro, nave, proceso y equipo describen el lugar. El CUPS describe el
-- suministro. Se relacionan, pero no son lo mismo.» (página 5)
--
-- Es un ÁRBOL de profundidad libre y no tres tablas fijas (centro/nave/proceso)
-- porque las explotaciones reales no se parecen entre sí: una granja tiene
-- naves, una industria tiene líneas, y un hotel tiene plantas. Con tres tablas
-- fijas, el primer cliente que no encaje obliga a meter datos donde no van.

CREATE TABLE IF NOT EXISTS luz_ubicaciones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID NOT NULL REFERENCES luz_clientes(id) ON DELETE CASCADE,
  padre_id    UUID REFERENCES luz_ubicaciones(id) ON DELETE CASCADE,

  nombre      TEXT NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'zona'
              CHECK (tipo IN ('centro','nave','zona','proceso','sin_asignar')),

  -- «Una foto puede guardarse en Sin asignar. Después se vincula sin subirla
  -- otra vez.» Ese cajón es un nodo de verdad y no un NULL: un NULL no se
  -- puede listar, y lo que no se lista no se termina de clasificar nunca.
  descripcion TEXT,
  direccion   TEXT,

  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  borrado_en     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_ubi_cliente ON luz_ubicaciones(cliente_id) WHERE borrado_en IS NULL;
CREATE INDEX IF NOT EXISTS ix_ubi_padre   ON luz_ubicaciones(padre_id)   WHERE borrado_en IS NULL;

-- ── El puente ubicación ↔ suministro ───────────────────────────────────────
--
-- TABLA APARTE Y NO UNA COLUMNA `cups_id` EN LA UBICACIÓN. Motivo: una nave
-- puede estar alimentada por dos CUPS y un CUPS puede alimentar tres naves.
-- Con una columna habría que elegir uno y mentir sobre el resto, que es justo
-- lo que hace que luego no cuadre el reparto de consumo por proceso.
CREATE TABLE IF NOT EXISTS luz_ubicacion_cups (
  ubicacion_id UUID NOT NULL REFERENCES luz_ubicaciones(id) ON DELETE CASCADE,
  cups_id      UUID NOT NULL REFERENCES luz_cups(id) ON DELETE CASCADE,
  -- Qué parte del suministro se atribuye aquí, si se ha llegado a repartir.
  -- NULL = todavía no se sabe, que es distinto de 0.
  reparto_pct  NUMERIC CHECK (reparto_pct IS NULL OR (reparto_pct >= 0 AND reparto_pct <= 100)),
  nota         TEXT,
  PRIMARY KEY (ubicacion_id, cups_id)
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. EQUIPOS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- «Una potencia desconocida queda vacía» y «guardar no equivale a validar el
-- dato» (página 4). Por eso casi todo es NULL-able y hay un estado de dato
-- separado del propio dato.

CREATE TABLE IF NOT EXISTS luz_equipos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id   UUID NOT NULL REFERENCES luz_clientes(id) ON DELETE CASCADE,
  ubicacion_id UUID REFERENCES luz_ubicaciones(id) ON DELETE SET NULL,

  nombre       TEXT NOT NULL,
  categoria    TEXT,           -- alimentación, ventilación, bombeo, frío, FV…
  cantidad     INTEGER DEFAULT 1,

  -- TRES POTENCIAS DISTINTAS Y NO UNA. La página 5 lo exige: «distinguir
  -- potencia eléctrica, mecánica y térmica». Un motor de 15 kW mecánicos no
  -- consume 15 kW eléctricos, y meterlos en la misma casilla es un error que
  -- se propaga hasta la propuesta sin que nadie lo vea.
  potencia_electrica_kw NUMERIC,
  potencia_mecanica_kw  NUMERIC,
  potencia_termica_kw   NUMERIC,

  -- FV con sus unidades separadas, que es el ejemplo que da el propio PDF.
  fv_paneles_kwp   NUMERIC,
  fv_inversor_kw   NUMERIC,
  bateria_kwh      NUMERIC,

  horas_uso_dia    NUMERIC,
  meses_uso_ano    NUMERIC,
  regulacion       TEXT,       -- variador, arranque directo, termostato…

  -- «Marcar ventilación y otros servicios según validación del cliente.» Una
  -- carga crítica no se apaga para ahorrar aunque el cálculo lo sugiera: en una
  -- granja, parar la ventilación mata animales. Esto es una salvaguarda, no una
  -- etiqueta informativa.
  es_carga_critica BOOLEAN NOT NULL DEFAULT false,
  critica_validada_por TEXT,

  -- El estado del DATO, no del equipo. Un equipo puede existir y estar bien
  -- mientras su ficha está a medias.
  estado_dato  TEXT NOT NULL DEFAULT 'pendiente'
               CHECK (estado_dato IN ('pendiente','declarado','medido','aprobado')),
  fuente       TEXT,           -- «declaración del cliente», «placa», «medida»…
  notas        TEXT,

  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  borrado_en     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_equipo_cliente   ON luz_equipos(cliente_id)   WHERE borrado_en IS NULL;
CREATE INDEX IF NOT EXISTS ix_equipo_ubicacion ON luz_equipos(ubicacion_id) WHERE borrado_en IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. MEDIDAS — EL CORAZÓN
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Una fila = una magnitud, un periodo, una unidad, un origen y un estado de
-- revisión. Es lo que hace posibles la 50006 (indicadores y línea base) y la
-- 50015 (verificación), porque las dos preguntan lo mismo: ¿de dónde salió
-- este número y quién dijo que era bueno?
--
-- POR QUÉ NO REUTILIZO `luz_cups.consumo_anual_kwh`: ese campo es UN número
-- para la venta —sirve para ofertar— y aquí hace falta la serie con su
-- trazabilidad. Conviven: el de `luz_cups` sigue siendo el de la comparativa
-- comercial, y este es el del expediente técnico. Lo que NO va a pasar es que
-- se copien el uno al otro en silencio; si difieren, se enseña la diferencia.

CREATE TABLE IF NOT EXISTS luz_medidas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    UUID NOT NULL REFERENCES luz_clientes(id) ON DELETE CASCADE,
  expediente_id UUID REFERENCES luz_expedientes(id) ON DELETE SET NULL,

  -- A QUÉ se refiere la medida. Al menos uno debería estar puesto, pero no se
  -- obliga: una lectura suelta traída de una visita se guarda igual y se
  -- vincula después. Perder el dato por no saber aún dónde va es peor.
  cups_id       UUID REFERENCES luz_cups(id) ON DELETE SET NULL,
  ubicacion_id  UUID REFERENCES luz_ubicaciones(id) ON DELETE SET NULL,
  equipo_id     UUID REFERENCES luz_equipos(id) ON DELETE SET NULL,

  -- MAGNITUDES SEPARADAS. «Compra de red, consumo de instalación, producción
  -- FV, reactiva, potencia y euros tienen selectores distintos. Sin datos FV no
  -- inferir consumo total.» (página 6). Sumar compra de red y autoconsumo sin
  -- tener la producción medida es inventarse el denominador de todos los
  -- indicadores que vengan después.
  magnitud      TEXT NOT NULL
                CHECK (magnitud IN (
                  'compra_red_kwh','consumo_instalacion_kwh','produccion_fv_kwh',
                  'excedentes_kwh','reactiva_kvarh','potencia_max_kw',
                  'coste_eur','variable_actividad')),

  -- La unidad va escrita SIEMPRE, aunque parezca deducible de la magnitud:
  -- `variable_actividad` puede ser plazas, toneladas, m² o cabezas, y sin la
  -- unidad un indicador de la 50006 no significa nada.
  unidad        TEXT NOT NULL,
  -- Para `variable_actividad`: qué se está midiendo («plazas ocupadas»).
  concepto      TEXT,

  valor         NUMERIC NOT NULL,

  -- PERIODO CON FECHAS, NO CON MES. La página 6 pide periodo personalizado, y
  -- las facturas reales no empiezan el día 1. Con fechas se puede anualizar por
  -- días reales, que es lo que ya hace `plantilla-consumos.ts`.
  periodo_inicio DATE NOT NULL,
  periodo_fin    DATE NOT NULL,
  CONSTRAINT periodo_coherente CHECK (periodo_fin >= periodo_inicio),

  -- Para 3.0TD/6.1TD: a qué periodo tarifario pertenece. NULL = el total.
  periodo_tarifa SMALLINT CHECK (periodo_tarifa IS NULL OR periodo_tarifa BETWEEN 1 AND 6),

  origen        TEXT NOT NULL DEFAULT 'manual'
                CHECK (origen IN ('factura','lectura_contador','curva_datadis',
                                  'plantilla_excel','estimado','manual')),
  documento_id  UUID,   -- FK añadida más abajo, cuando exista la tabla

  -- NACE EN PENDIENTE. Cargar un archivo no aprueba su contenido.
  revision      TEXT NOT NULL DEFAULT 'pendiente'
                CHECK (revision IN ('pendiente','contrastada','aprobada','descartada')),
  revisado_por  TEXT,
  revisado_en   TIMESTAMPTZ,

  -- CONFLICTOS SIN PERDER NADA (decisión 5 de la cabecera). Si dos fuentes
  -- dicen cosas distintas del mismo periodo, las dos filas siguen ahí; la que
  -- pierde apunta a la que gana y guarda POR QUÉ perdió.
  sustituida_por UUID REFERENCES luz_medidas(id) ON DELETE SET NULL,
  motivo_revision TEXT,

  -- Lo que marca `leerNumero` como dudoso llega hasta aquí escrito, nunca
  -- corregido a la brava. Misma regla que en la plantilla de consumos.
  aviso         TEXT,

  nota          TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  borrado_en     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_med_cliente ON luz_medidas(cliente_id, magnitud, periodo_inicio) WHERE borrado_en IS NULL;
CREATE INDEX IF NOT EXISTS ix_med_cups    ON luz_medidas(cups_id, periodo_inicio) WHERE borrado_en IS NULL;
CREATE INDEX IF NOT EXISTS ix_med_exp     ON luz_medidas(expediente_id) WHERE borrado_en IS NULL;

-- NO hay índice único sobre (cups, magnitud, periodo) A PROPÓSITO. Dos medias
-- facturas de un mes pueden ser las dos válidas, y dos fuentes distintas del
-- mismo mes es exactamente el conflicto que hay que poder guardar. La detección
-- de duplicados se hace al importar y se le enseña a una persona (página 7),
-- que es donde tiene arreglo. Una restricción aquí solo lograría que el
-- importador reventara con datos legítimos.


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. ACTUACIONES
-- ═══════════════════════════════════════════════════════════════════════════
--
-- «Potencia, reactiva, FV o ahorro son actuaciones vinculadas al cliente. Cada
-- una tiene su objetivo, responsable y siguiente paso.» (página 8)
--
-- Estados INDEPENDIENTES del comercial: «una venta de luz activada puede tener
-- una actuación técnica pendiente». Es la misma razón que separa la fase
-- energética de la etapa comercial.

CREATE TABLE IF NOT EXISTS luz_actuaciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    UUID NOT NULL REFERENCES luz_clientes(id) ON DELETE CASCADE,
  expediente_id UUID REFERENCES luz_expedientes(id) ON DELETE SET NULL,
  ubicacion_id  UUID REFERENCES luz_ubicaciones(id) ON DELETE SET NULL,
  cups_id       UUID REFERENCES luz_cups(id) ON DELETE SET NULL,

  titulo        TEXT NOT NULL,
  tipo          TEXT NOT NULL DEFAULT 'otra'
                CHECK (tipo IN ('potencia','reactiva','fotovoltaica','almacenamiento',
                                'gestion_cargas','eficiencia','tarifa','refuerzo_red','otra')),

  -- El problema, escrito. Sin esto, dentro de seis meses nadie recuerda por qué
  -- se abrió y la actuación se cierra «porque ya no hace falta».
  problema      TEXT,

  -- Las alternativas que se comparan, con su estado. JSON porque su forma
  -- cambia según el tipo y no tiene sentido una tabla de 20 columnas vacías.
  alternativas  JSONB NOT NULL DEFAULT '[]'::jsonb,

  estado        TEXT NOT NULL DEFAULT 'en_estudio'
                CHECK (estado IN ('en_estudio','presentada','aceptada',
                                  'ejecucion','verificacion','cerrada','descartada')),

  -- ECONOMÍA SIN DUPLICAR (página 8): se ENLAZA el presupuesto que ya existe
  -- en el CRM, no se copia. Copiar el importe aquí garantiza que dentro de un
  -- mes la actuación diga un número y el estudio otro.
  estudio_id    UUID REFERENCES luz_estudios(id) ON DELETE SET NULL,
  presupuesto_ref TEXT,

  -- AHORRO PREVISTO Y COMPROBADO SEPARADOS. Es la línea que separa una promesa
  -- de un hecho, y es literalmente lo que verifica la ISO 50015. Meterlos en
  -- el mismo campo convierte una estimación en un resultado sin que nadie lo
  -- haya decidido.
  ahorro_previsto_eur   NUMERIC,
  ahorro_previsto_kwh   NUMERIC,
  ahorro_comprobado_eur NUMERIC,
  ahorro_comprobado_kwh NUMERIC,
  metodo_verificacion   TEXT,

  responsable   TEXT,
  decision_pendiente TEXT,   -- «confirmar duración de puntas antes de elegir batería»

  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  borrado_en     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_act_cliente ON luz_actuaciones(cliente_id) WHERE borrado_en IS NULL;
CREATE INDEX IF NOT EXISTS ix_act_estado  ON luz_actuaciones(estado)     WHERE borrado_en IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. DOCUMENTOS DE LA CARTERA DE LUZ
-- ═══════════════════════════════════════════════════════════════════════════
--
-- OJO: `documentos_cliente` YA EXISTE pero cuelga de `clientes_app` (el área de
-- cliente), no de `luz_clientes`. Para la cartera de luz no hay gestión
-- documental de ningún tipo. Esta tabla es nueva de verdad.
--
-- «Guardar una vez, encontrar desde cualquier vista» (página 9): un archivo
-- puede respaldar a la vez un suministro, un equipo y una actuación, así que
-- los vínculos son varios y todos opcionales.

CREATE TABLE IF NOT EXISTS luz_documentos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    UUID NOT NULL REFERENCES luz_clientes(id) ON DELETE CASCADE,
  expediente_id UUID REFERENCES luz_expedientes(id) ON DELETE SET NULL,
  cups_id       UUID REFERENCES luz_cups(id) ON DELETE SET NULL,
  ubicacion_id  UUID REFERENCES luz_ubicaciones(id) ON DELETE SET NULL,
  equipo_id     UUID REFERENCES luz_equipos(id) ON DELETE SET NULL,
  actuacion_id  UUID REFERENCES luz_actuaciones(id) ON DELETE SET NULL,

  titulo        TEXT NOT NULL,
  tipo          TEXT NOT NULL DEFAULT 'otro'
                CHECK (tipo IN ('factura','curva','foto','plano','inventario',
                                'oferta','informe','nota','contrato','otro')),

  -- Una NOTA no tiene archivo, y es la mitad de la bandeja: «pegar nota o
  -- adjuntar foto» desde el móvil, con el cliente ya precargado.
  archivo_path  TEXT,
  texto_nota    TEXT,
  mime_type     TEXT,
  tamano_bytes  INTEGER,

  -- LOS TRES ESTADOS DE LA BANDEJA (página 9). «Pendiente de recibir» es una
  -- fila sin archivo todavía: es lo que convierte «le pedí la curva» en algo
  -- que se puede reclamar, en vez de en algo que se olvida.
  estado        TEXT NOT NULL DEFAULT 'por_clasificar'
                CHECK (estado IN ('por_clasificar','pendiente_recibir','guardado','descartado')),

  -- Los costes internos NO salen en el informe del cliente (página 9).
  visible_cliente BOOLEAN NOT NULL DEFAULT true,

  subido_por    TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  borrado_en     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_doc_cliente ON luz_documentos(cliente_id) WHERE borrado_en IS NULL;
CREATE INDEX IF NOT EXISTS ix_doc_estado  ON luz_documentos(estado)     WHERE borrado_en IS NULL;

-- Ahora sí: la medida puede apuntar a su documento de origen.
ALTER TABLE luz_medidas
  DROP CONSTRAINT IF EXISTS fk_medida_documento;
ALTER TABLE luz_medidas
  ADD CONSTRAINT fk_medida_documento
  FOREIGN KEY (documento_id) REFERENCES luz_documentos(id) ON DELETE SET NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. EVIDENCIAS ISO
-- ═══════════════════════════════════════════════════════════════════════════
--
-- LO QUE ESTA TABLA ES: un puente entre un requisito de la norma y un registro
-- que YA EXISTE en el sistema (un documento, una medida, una actuación, una
-- tarea). «Cada pendiente lleva al dato»: pulsar «Línea base» abre su
-- formulario, no un apartado ISO donde volver a teclear lo mismo.
--
-- LO QUE NO ES: un certificado. Que estén todas las casillas en verde
-- significa que el expediente está ordenado, no que el cliente cumpla la norma
-- ni que esté certificado. La pantalla lo dirá con estas palabras.
--
-- EL CATÁLOGO DE REQUISITOS VIVE EN CÓDIGO (`src/lib/iso.ts`), NO AQUÍ. Igual
-- que `etapas.ts`: así se puede versionar, testear y corregir sin migraciones,
-- y no acaba habiendo dos catálogos distintos en dos entornos.

CREATE TABLE IF NOT EXISTS luz_iso_evidencias (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES luz_expedientes(id) ON DELETE CASCADE,

  -- La clave del requisito en el catálogo de código: '50006.linea_base',
  -- '50015.plan_verificacion', '50001.roles', '50002.inventario'…
  requisito     TEXT NOT NULL,

  -- A qué registro real apunta. Solo uno de estos va relleno.
  documento_id  UUID REFERENCES luz_documentos(id)  ON DELETE CASCADE,
  medida_id     UUID REFERENCES luz_medidas(id)     ON DELETE CASCADE,
  actuacion_id  UUID REFERENCES luz_actuaciones(id) ON DELETE CASCADE,
  tarea_id      UUID REFERENCES luz_tareas(id)      ON DELETE CASCADE,

  -- «Mostrar quién revisó, fecha y documento usado. Sustituir una evidencia
  -- deja pendiente su nueva revisión.» Por eso la revisión es de la evidencia
  -- y no del requisito: cambiar el papel invalida la revisión anterior.
  estado        TEXT NOT NULL DEFAULT 'propuesta'
                CHECK (estado IN ('propuesta','revisada','rechazada','caducada')),
  revisado_por  TEXT,
  revisado_en   TIMESTAMPTZ,
  nota          TEXT,

  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  borrado_en    TIMESTAMPTZ,

  CONSTRAINT una_sola_referencia CHECK (
    (documento_id IS NOT NULL)::int + (medida_id IS NOT NULL)::int +
    (actuacion_id IS NOT NULL)::int + (tarea_id IS NOT NULL)::int = 1
  )
);

CREATE INDEX IF NOT EXISTS ix_iso_exp ON luz_iso_evidencias(expediente_id, requisito) WHERE borrado_en IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- 8. CAMPOS PERSONALIZABLES
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La pieza más delicada del documento (página 11), porque es la única que deja
-- a un usuario cambiar la forma de los datos. Las tres reglas del PDF son las
-- que hacen que esto no se convierta en un problema:
--
--   · Ocultar o retirar un campo NO borra sus valores.
--   · Cambiar el tipo exige un campo nuevo, no una conversión al vuelo.
--   · CUPS, unidades base, fórmulas aprobadas y estados esenciales NO se tocan.
--
-- Por eso los valores van en su propia tabla y NO en un JSONB dentro del
-- registro: un JSONB se reescribe entero al guardar, y el día que alguien
-- retire un campo se lleva por delante los valores históricos sin dejar rastro.

CREATE TABLE IF NOT EXISTS luz_campos_extra (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave       TEXT NOT NULL UNIQUE,      -- 'plazas_ocupadas'
  etiqueta    TEXT NOT NULL,             -- 'Plazas ocupadas'
  tipo        TEXT NOT NULL CHECK (tipo IN ('texto','numero','fecha','lista','booleano')),
  unidad      TEXT,                      -- 'plazas'
  opciones    JSONB,                     -- para tipo 'lista'
  ayuda       TEXT,

  -- A qué se le puede poner: 'cliente','expediente','ubicacion','equipo','actuacion'
  aplica_a    TEXT NOT NULL,
  -- Filtro opcional por sector/plantilla, para no enseñarle a una industria los
  -- campos de una granja.
  plantilla   TEXT,

  -- «Obligatorio: al calcular este indicador». No obligatorio siempre — eso
  -- bloquearía altas en la calle —, sino obligatorio para poder calcular algo.
  obligatorio_para TEXT,

  activo      BOOLEAN NOT NULL DEFAULT true,
  orden       INTEGER NOT NULL DEFAULT 0,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS luz_campos_valores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campo_id    UUID NOT NULL REFERENCES luz_campos_extra(id) ON DELETE RESTRICT,
  -- RESTRICT y no CASCADE: borrar una definición de campo NO puede llevarse
  -- por delante los valores. Retirar un campo es `activo = false`.

  entidad     TEXT NOT NULL,   -- 'equipo', 'ubicacion'…
  entidad_id  UUID NOT NULL,

  valor_texto TEXT,
  valor_num   NUMERIC,
  valor_fecha DATE,
  valor_bool  BOOLEAN,

  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (campo_id, entidad, entidad_id)
);

CREATE INDEX IF NOT EXISTS ix_cval_entidad ON luz_campos_valores(entidad, entidad_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 9. RLS, TOQUES Y AUDITORÍA
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Mismo patrón que el resto del módulo (`supabase_rls_v2.sql`) y auditoría con
-- `fn_auditar`, que es como se llama de verdad la función — comprobado contra
-- la base, después de que dos scripts buscaran nombres que no existían y se
-- quedaran callados.

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'luz_expedientes','luz_ubicaciones','luz_ubicacion_cups','luz_equipos',
    'luz_medidas','luz_actuaciones','luz_documentos','luz_iso_evidencias',
    'luz_campos_extra','luz_campos_valores'
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

-- actualizado_en automático
CREATE OR REPLACE FUNCTION luz_energia_touch() RETURNS trigger AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'luz_expedientes','luz_ubicaciones','luz_equipos','luz_medidas',
    'luz_actuaciones','luz_documentos','luz_campos_valores'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_touch ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_touch BEFORE UPDATE ON %I
                    FOR EACH ROW EXECUTE FUNCTION luz_energia_touch()', t);
  END LOOP;
END $$;

-- Auditoría: sin esto, el parte del día no vería el trabajo energético.
DO $$
DECLARE t TEXT;
BEGIN
  IF to_regprocedure('fn_auditar()') IS NULL THEN
    RAISE NOTICE 'No existe fn_auditar(): ejecuta antes supabase_equipo_usuarios.sql.';
    RETURN;
  END IF;
  FOREACH t IN ARRAY ARRAY[
    'luz_expedientes','luz_ubicaciones','luz_equipos','luz_medidas',
    'luz_actuaciones','luz_documentos','luz_iso_evidencias'
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
    'luz_expedientes','luz_ubicaciones','luz_ubicacion_cups','luz_equipos',
    'luz_medidas','luz_actuaciones','luz_documentos','luz_iso_evidencias',
    'luz_campos_extra','luz_campos_valores'
  ]) AS t
 ORDER BY 1;
