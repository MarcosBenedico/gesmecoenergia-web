-- ============================================================================
-- INTEGRIDAD DE DATOS v1 — Gestión Luz
--
-- Limpia lo que dejaron dos fallos que ya están corregidos en la aplicación:
--
--   A) El fin de contrato se guardaba en el CUPS Y ADEMÁS como fecha crítica.
--      El mismo vencimiento salía dos veces en la Agenda, y la copia se quedaba
--      desfasada en cuanto alguien corregía la fecha del suministro.
--
--   B) Los contratos creados desde la ficha del cliente nacían SIN CUPS. Luego
--      figuraban como «sin CUPS» y al activarlos el suministro no pasaba a
--      activado, porque la sincronización lo busca por ese campo.
--
-- NADA SE BORRA. Todo se archiva con marca de tiempo y hay vuelta atrás al
-- final del archivo. Ejecutar por bloques y leer el recuento de cada uno antes
-- de seguir con el siguiente.
--
-- Ejecutar en el SQL editor de Supabase.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 0. Copia de seguridad de lo que se va a tocar
--    Se queda en la base de datos: si algo sale mal, el rollback lee de aquí.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists respaldo_integridad_v1 (
  id            bigserial primary key,
  ejecutado_en  timestamptz not null default now(),
  bloque        text        not null,
  tabla         text        not null,
  registro_id   uuid        not null,
  fila          jsonb       not null
);

comment on table respaldo_integridad_v1 is
  'Copia de las filas modificadas por supabase_integridad_v1.sql. No borrar hasta confirmar que todo está bien.';

-- ────────────────────────────────────────────────────────────────────────────
-- A. Fechas críticas de fin de contrato que duplican el dato del CUPS
--
--    Solo se archivan las que cumplen las tres condiciones a la vez:
--      · son de tipo fin_contrato,
--      · siguen pendientes (una ya resuelta es historia y no se toca),
--      · y existe un CUPS del mismo cliente con esa MISMA fecha.
--
--    Si las fechas no coinciden NO se toca: puede que alguien corrigiera una de
--    las dos a mano y hay que mirarlo caso por caso.
-- ────────────────────────────────────────────────────────────────────────────
create temporary table _fechas_dup on commit drop as
select distinct f.id
from luz_fechas_criticas f
join luz_cups u
  on u.cliente_id = f.cliente_id
 and u.borrado_en is null
 and u.fecha_fin_contrato = f.fecha
where f.borrado_en is null
  and f.tipo_fecha = 'fin_contrato'
  and f.estado = 'pendiente';

insert into respaldo_integridad_v1 (bloque, tabla, registro_id, fila)
select 'A_fecha_fin_contrato_duplicada', 'luz_fechas_criticas', f.id, to_jsonb(f)
from luz_fechas_criticas f join _fechas_dup d on d.id = f.id;

update luz_fechas_criticas f
   set borrado_en  = now(),
       borrado_por = 'supabase_integridad_v1',
       motivo_borrado = 'El vencimiento ya está en el CUPS y la Agenda lo calcula desde ahí'
  from _fechas_dup d
 where d.id = f.id;

-- Cuántas se han archivado (debe cuadrar con lo que se veía duplicado)
select 'A · fechas críticas archivadas' as bloque, count(*) from _fechas_dup;

-- Las que NO se han tocado porque la fecha no coincidía: revisar a mano
select 'A · REVISAR a mano (fechas que no cuadran)' as aviso,
       c.nombre, f.fecha as fecha_critica, u.fecha_fin_contrato as fecha_del_cups
  from luz_fechas_criticas f
  join luz_clientes c on c.id = f.cliente_id
  left join luz_cups u on u.cliente_id = f.cliente_id and u.borrado_en is null
 where f.borrado_en is null
   and f.tipo_fecha = 'fin_contrato'
   and f.estado = 'pendiente'
 order by c.nombre;

-- ────────────────────────────────────────────────────────────────────────────
-- B. Contratos sin CUPS
--
--    NO se inventa el vínculo. Solo se rellena cuando no hay ninguna duda:
--    el cliente tiene EXACTAMENTE UN suministro vivo. Con dos o más, la
--    decisión es de una persona y el contrato se deja como está.
-- ────────────────────────────────────────────────────────────────────────────
create temporary table _contratos_arreglables on commit drop as
select k.id as contrato_id, u.id as cups_id
from luz_contratos k
join lateral (
  select u.id
    from luz_cups u
   where u.cliente_id = k.cliente_id and u.borrado_en is null
) u on true
where k.borrado_en is null
  and k.cups_id is null
  and k.cliente_id is not null
group by k.id, u.id
having (select count(*) from luz_cups x
         where x.cliente_id = k.cliente_id and x.borrado_en is null) = 1;

insert into respaldo_integridad_v1 (bloque, tabla, registro_id, fila)
select 'B_contrato_sin_cups', 'luz_contratos', k.id, to_jsonb(k)
from luz_contratos k join _contratos_arreglables a on a.contrato_id = k.id;

update luz_contratos k
   set cups_id = a.cups_id,
       actualizado_en = now()
  from _contratos_arreglables a
 where a.contrato_id = k.id;

select 'B · contratos vinculados automáticamente' as bloque, count(*) from _contratos_arreglables;

-- Los que siguen sin CUPS: el cliente tiene 0 o varios suministros
select 'B · REVISAR a mano (elegir suministro)' as aviso,
       c.nombre, k.comercializadora_final, k.estado_contrato,
       (select count(*) from luz_cups u where u.cliente_id = k.cliente_id and u.borrado_en is null) as suministros
  from luz_contratos k
  join luz_clientes c on c.id = k.cliente_id
 where k.borrado_en is null and k.cups_id is null
 order by suministros desc, c.nombre;

-- ────────────────────────────────────────────────────────────────────────────
-- C. Red de seguridad para que no vuelva a pasar
--
--    Índice único parcial: un cliente no puede tener dos fechas críticas
--    pendientes del mismo tipo y la misma fecha. Es parcial a propósito —
--    solo sobre lo vivo y pendiente — para no estorbar al histórico.
-- ────────────────────────────────────────────────────────────────────────────
create unique index if not exists ux_fecha_critica_sin_duplicar
  on luz_fechas_criticas (cliente_id, tipo_fecha, fecha)
  where borrado_en is null and estado = 'pendiente';

commit;

-- ============================================================================
-- COMPROBACIÓN — ejecutar después y verificar que los tres salen a 0 o al
-- número que se ha decidido dejar para revisión manual.
-- ============================================================================
-- select count(*) as fechas_fin_contrato_pendientes
--   from luz_fechas_criticas f
--   join luz_cups u on u.cliente_id = f.cliente_id and u.fecha_fin_contrato = f.fecha
--  where f.borrado_en is null and f.tipo_fecha = 'fin_contrato' and f.estado = 'pendiente';
--
-- select count(*) as contratos_sin_cups
--   from luz_contratos where borrado_en is null and cups_id is null;

-- ============================================================================
-- VUELTA ATRÁS — deshace todo lo anterior leyendo del respaldo.
-- Ejecutar SOLO si hay que revertir.
-- ============================================================================
-- begin;
--
-- -- A: devolver las fechas críticas archivadas
-- update luz_fechas_criticas f
--    set borrado_en = null, borrado_por = null, motivo_borrado = null
--   from respaldo_integridad_v1 r
--  where r.bloque = 'A_fecha_fin_contrato_duplicada'
--    and r.tabla = 'luz_fechas_criticas'
--    and r.registro_id = f.id;
--
-- -- B: devolver los contratos a su cups_id anterior (que era null)
-- update luz_contratos k
--    set cups_id = (r.fila ->> 'cups_id')::uuid,
--        actualizado_en = now()
--   from respaldo_integridad_v1 r
--  where r.bloque = 'B_contrato_sin_cups'
--    and r.tabla = 'luz_contratos'
--    and r.registro_id = k.id;
--
-- drop index if exists ux_fecha_critica_sin_duplicar;
--
-- commit;
