-- ============================================
-- SUMINISTROS MÚLTIPLES POR CLIENTE (con código CUPS)
-- Pega esto en Supabase SQL Editor y pulsa Run:
-- https://supabase.com/dashboard/project/rhsflkemubgigagwmoqb/sql
-- Migra automáticamente los clientes y consumos existentes.
-- ============================================

-- 1. Tabla de suministros: cada punto de suministro con su CUPS
create table if not exists suministros (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes_app(id) on delete cascade,
  cups text unique not null,                     -- código CUPS (ES + 20-22 dígitos)
  alias text,                                    -- nombre para el cliente: "Casa", "Nave", ...
  direccion text,
  tarifa text not null default '2.0',
  precios_energia jsonb not null default '[]',
  precios_potencia jsonb not null default '[]',
  potencias_kw jsonb not null default '[]',
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

alter table suministros enable row level security;
drop policy if exists "suministros_all" on suministros;
create policy "suministros_all" on suministros for all using (true) with check (true);

-- 2. Los consumos pasan a colgar del suministro
alter table consumos_clientes add column if not exists suministro_id uuid references suministros(id) on delete cascade;

-- 3. MIGRACIÓN: crear un suministro por cada cliente existente con sus datos actuales
insert into suministros (cliente_id, cups, alias, tarifa, precios_energia, precios_potencia, potencias_kw)
select
  c.id,
  'PENDIENTE-' || c.usuario,                     -- ⚠️ edita luego con el CUPS real
  'Suministro principal',
  c.tarifa,
  case when jsonb_typeof(c.precios_energia) = 'array' then c.precios_energia else jsonb_build_array(c.precios_energia) end,
  case when jsonb_typeof(c.precios_potencia) = 'array' then c.precios_potencia else jsonb_build_array(c.precios_potencia) end,
  case when jsonb_typeof(c.potencias_kw) = 'array' then c.potencias_kw else jsonb_build_array(c.potencias_kw) end
from clientes_app c
where not exists (select 1 from suministros s where s.cliente_id = c.id);

-- 4. Enlazar los consumos existentes a ese suministro
update consumos_clientes cc
set suministro_id = (select s.id from suministros s where s.cliente_id = cc.cliente_id limit 1)
where suministro_id is null;

-- 5. Cambiar la unicidad: ahora un mes es único por SUMINISTRO (no por cliente)
alter table consumos_clientes drop constraint if exists consumos_clientes_cliente_id_anio_mes_key;
alter table consumos_clientes drop constraint if exists uq_consumo_suministro_mes;
alter table consumos_clientes add constraint uq_consumo_suministro_mes unique (suministro_id, anio, mes);

create index if not exists idx_suministros_cliente on suministros (cliente_id);
