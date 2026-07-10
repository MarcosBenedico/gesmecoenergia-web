-- ============================================
-- PRECIOS POR MES — Pega esto en Supabase SQL Editor
-- https://supabase.com/dashboard/project/rhsflkemubgigagwmoqb/sql
-- Permite guardar el precio que tuvo el cliente cada mes
-- ============================================

alter table consumos_clientes add column if not exists precios_energia jsonb;
alter table consumos_clientes add column if not exists precios_potencia jsonb;
