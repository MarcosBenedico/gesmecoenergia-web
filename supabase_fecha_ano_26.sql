-- Arreglar la fecha crítica con el año escrito a dos cifras.
--
-- Una fecha de ESTHER CAMACHO quedó guardada como 0026-07-18: alguien tecleó
-- «26» en vez de «2026». Postgres lo aceptó porque el año 26 existe, así que
-- no saltó ninguna validación y la línea salía en Mi Día con 730.505 días de
-- retraso. Era además el ÚNICO registro de toda la cartera que pasaba de 30
-- días, o sea que cualquier corte por antigüedad lo apartaba a él y a nada más.
--
-- Se corrige solo lo que está claramente mal (año anterior a 2000) y se pone
-- el mismo día y mes con el año 2026, que es lo que se quiso escribir: el
-- registro se dio de alta el 15-7-2026 y el vencimiento era el 18 de julio.

update luz_fechas_criticas
   set fecha = make_date(2026, extract(month from fecha)::int, extract(day from fecha)::int),
       actualizado_en = now()
 where borrado_en is null
   and fecha < '2000-01-01';

-- Comprobación: debe devolver 0 filas.
select id, titulo, fecha
  from luz_fechas_criticas
 where borrado_en is null and fecha < '2000-01-01';
