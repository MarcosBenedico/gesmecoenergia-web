-- ═══════════════════════════════════════════════════════════════════════════
-- ESTUDIOS Y PROPUESTAS (GL-04 / GL-05 / GL-06)
--
-- Ejecutar entero en el SQL editor de Supabase. Es idempotente: se puede
-- volver a lanzar sin romper nada.
--
-- QUÉ RESUELVE
--
-- Hoy el CRM dice «falta el estudio» y no hay ningún sitio donde el estudio
-- viva. La factura se lee, se calcula el ahorro y todo eso se pierde: lo que
-- queda es un número suelto en la oportunidad y un PDF en el escritorio de
-- alguien. Cuando el cliente llama dos meses después preguntando por «los
-- 1.400 € que me dijisteis», no hay forma de saber con qué precios se dijo.
--
-- POR QUÉ EL ESTUDIO GUARDA UNA COPIA DE TODO Y NO REFERENCIAS
--
-- `datos_factura`, `escenarios` e `hipotesis` se guardan como JSON completo,
-- no como punteros a las tablas de precios. Es a propósito, y es la regla que
-- el plan pide: «permitir bloquear precios utilizados para que una propuesta
-- antigua no cambie automáticamente».
--
-- Si el estudio apuntara a la tabla de precios, al día siguiente de subir las
-- tarifas la propuesta que el cliente tiene impresa diría otra cosa que la
-- pantalla. Un estudio es una FOTO de lo que se le dijo a alguien un día
-- concreto, no una consulta en vivo. Ocupa más y no se puede recalcular solo:
-- las dos cosas son exactamente lo que se quiere.
--
-- LAS VERSIONES SON FILAS, NO UN CAMPO QUE SE PISA
--
-- Cuando una propuesta ya enviada se cambia, se crea una fila nueva con
-- `version` + 1 y la anterior se queda como estaba. Guardar la versión en un
-- número que se sobrescribe sería tener el historial y no tenerlo.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists luz_estudios (
  id uuid primary key default gen_random_uuid(),

  cliente_id  uuid references luz_clientes(id) on delete cascade,
  cups_id     uuid references luz_cups(id) on delete set null,
  pipeline_id uuid references luz_pipeline(id) on delete set null,

  -- Encadena las versiones: la v1 tiene esto a null y las siguientes apuntan
  -- a ella. Así se recupera el hilo entero sin adivinar por fechas.
  origen_id   uuid references luz_estudios(id) on delete set null,
  version     int not null default 1,

  titulo      text,
  tarifa      text,

  -- 1 factura · 2 extraccion · 3 validacion · 4 analisis · 5 comparativa
  -- 6 propuesta · 7 seguimiento — los siete pasos del plan.
  estado      text not null default 'borrador',

  -- La factura tal y como llegó y tal y como se leyó. Conservar el original
  -- es lo único que permite discutir un dato meses después.
  factura_path      text,
  datos_factura     jsonb,
  -- Qué se marcó como correcto, dudoso o pendiente, y qué se corrigió a mano.
  revision          jsonb,

  -- Los escenarios evaluados, con sus precios dentro. Ver cabecera.
  escenarios        jsonb,
  hipotesis         jsonb,
  escenario_recomendado text,
  -- La frase de la recomendación. Editable: la escribe el motor y la corrige
  -- quien conoce al cliente.
  recomendacion     text,

  coste_actual_anual   numeric,
  coste_propuesto_anual numeric,
  ahorro_anual         numeric,
  ahorro_pct           numeric,
  comision_estimada    numeric,

  -- Precios congelados: a partir de aquí el estudio no se recalcula solo.
  bloqueado    boolean not null default false,
  fecha_bloqueo timestamptz,

  -- Trazabilidad de la propuesta: generado, descargado, enviado, visto,
  -- aceptado o sustituido. El plan lo pide explícitamente.
  pdf_path        text,
  fecha_generado  timestamptz,
  fecha_enviado   timestamptz,
  fecha_aceptado  timestamptz,
  sustituido_por  uuid references luz_estudios(id) on delete set null,

  responsable  text,
  observaciones text,

  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  borrado_en     timestamptz
);

create index if not exists idx_estudios_cliente on luz_estudios(cliente_id) where borrado_en is null;
create index if not exists idx_estudios_cups    on luz_estudios(cups_id)    where borrado_en is null;
create index if not exists idx_estudios_estado  on luz_estudios(estado)     where borrado_en is null;
create index if not exists idx_estudios_origen  on luz_estudios(origen_id);

-- Solo puede haber una versión viva de cada número dentro de un mismo hilo.
create unique index if not exists idx_estudios_version
  on luz_estudios(coalesce(origen_id, id), version)
  where borrado_en is null;

-- ── actualizado_en ─────────────────────────────────────────────────────────
create or replace function luz_estudios_touch() returns trigger as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_luz_estudios_touch on luz_estudios;
create trigger trg_luz_estudios_touch
  before update on luz_estudios
  for each row execute function luz_estudios_touch();

-- ── Auditoría ──────────────────────────────────────────────────────────────
-- Sin esto, el parte del día no vería el trabajo de preparar estudios, que es
-- justo la parte que el plan quiere hacer visible.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'app_auditar') then
    execute 'drop trigger if exists trg_auditoria_luz_estudios on luz_estudios';
    execute 'create trigger trg_auditoria_luz_estudios
               after insert or update or delete on luz_estudios
               for each row execute function app_auditar()';
  end if;
end $$;

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Mismo patrón que supabase_rls_v2.sql: cualquiera autenticado puede leer y
-- escribir; el control fino de quién ve qué lo hace la aplicación por rol.
alter table luz_estudios enable row level security;

drop policy if exists "luz_estudios_select" on luz_estudios;
create policy "luz_estudios_select" on luz_estudios
  for select to authenticated using (true);

drop policy if exists "luz_estudios_insert" on luz_estudios;
create policy "luz_estudios_insert" on luz_estudios
  for insert to authenticated with check (true);

drop policy if exists "luz_estudios_update" on luz_estudios;
create policy "luz_estudios_update" on luz_estudios
  for update to authenticated using (true) with check (true);

drop policy if exists "luz_estudios_delete" on luz_estudios;
create policy "luz_estudios_delete" on luz_estudios
  for delete to authenticated using (true);

-- ── Comprobación ───────────────────────────────────────────────────────────
select
  (select count(*) from luz_estudios) as estudios,
  (select count(*) from pg_policies where tablename = 'luz_estudios') as politicas;
