-- ============================================
-- PANEL DE CLIENTE — Pega esto en Supabase SQL Editor
-- https://supabase.com/dashboard/project/rhsflkemubgigagwmoqb/sql
-- ============================================

-- 1. Tabla de clientes de la app (usuario + contraseña + contrato)
create table if not exists clientes_app (
  id uuid primary key default gen_random_uuid(),
  usuario text unique not null,
  password_hash text not null,
  token text not null,
  nombre text not null,
  telefono text,
  tarifa text not null default '2.0',            -- 2.0 / 3.0 / 6.1
  precios_energia jsonb not null default '[]',   -- €/kWh por periodo (precio fijo elegido)
  precios_potencia jsonb not null default '[]',  -- €/kW·día por periodo
  potencias_kw jsonb not null default '[]',      -- kW contratados por periodo
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- 2. Consumos mensuales (una fila por cliente + año + mes)
create table if not exists consumos_clientes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes_app(id) on delete cascade,
  anio int not null,
  mes int not null check (mes between 1 and 12),
  consumos_kwh jsonb not null default '[]',      -- kWh por periodo (P1, P2, P3...)
  coste_energia numeric,                          -- € calculado del mes
  coste_potencia numeric,
  coste_total numeric,
  notas text,
  actualizado_en timestamptz not null default now(),
  unique (cliente_id, anio, mes)
);

-- 3. RLS: acceso solo vía las API del servidor (anon key)
alter table clientes_app enable row level security;
alter table consumos_clientes enable row level security;

drop policy if exists "clientes_app_all" on clientes_app;
create policy "clientes_app_all" on clientes_app for all using (true) with check (true);

drop policy if exists "consumos_clientes_all" on consumos_clientes;
create policy "consumos_clientes_all" on consumos_clientes for all using (true) with check (true);

-- Índices
create index if not exists idx_consumos_cliente on consumos_clientes (cliente_id, anio, mes);
