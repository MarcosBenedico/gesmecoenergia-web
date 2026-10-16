-- ════════════════════════════════════════════════════════════════════════
-- CÓDIGO PROPIO DE CLIENTE (CL-0001): el identificador lo ponemos nosotros
--
-- Hasta ahora el índice era el CIF/NIF. Eso obliga a que el cliente nos dé
-- un dato que muchas veces no tenemos: medido sobre la cartera real, **122
-- de 309 fichas no tienen NIF**. Un posible cliente al que se visita en una
-- granja da un nombre y un teléfono, y el NIF llega — si llega — el día que
-- entrega una factura. Con el NIF como índice, todo ese tramo del embudo no
-- se puede identificar, y el importador cae a emparejar por NOMBRE, que es
-- como nacen los duplicados: «Transportes García SL» y «TRANSPORTES GARCIA,
-- S.L.» no casan, y entran dos veces.
--
-- El código es nuestro, se asigna SIEMPRE y no depende de que nadie nos dé
-- nada. El NIF se queda como dato fiscal (hace falta para contratar), pero
-- deja de ser la llave.
--
-- Lo asigna un TRIGGER y no la aplicación, a propósito: hay cuatro caminos
-- por los que nace un cliente (alta, importación, promover un objetivo del
-- mapa, y el alta rápida del móvil). Si lo pusiera cada uno por su cuenta,
-- el día que se añada un quinto camino nacerán fichas sin código y el fallo
-- será silencioso.
--
-- Seguro de ejecutar más de una vez.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.luz_clientes ADD COLUMN IF NOT EXISTS codigo text;

CREATE SEQUENCE IF NOT EXISTS public.luz_cliente_codigo_seq;

-- ── Backfill: la cartera que ya existe ──────────────────────────────────
-- Por fecha de alta, para que el número cuente la historia en el orden en
-- que pasó: CL-0001 es el primero que entró, no el primero por abecedario.
DO $$
DECLARE n int;
BEGIN
  WITH ordenados AS (
    SELECT id, row_number() OVER (ORDER BY creado_en NULLS LAST, id) AS fila
      FROM public.luz_clientes WHERE codigo IS NULL
  )
  UPDATE public.luz_clientes c
     SET codigo = 'CL-' || lpad(o.fila::text, 4, '0')
    FROM ordenados o WHERE c.id = o.id;

  -- La secuencia arranca por encima del mayor código ya puesto, o el
  -- siguiente cliente reutilizaría un código y chocaría con el índice único.
  SELECT coalesce(max(nullif(regexp_replace(codigo, '\D', '', 'g'), '')::int), 0)
    INTO n FROM public.luz_clientes;
  PERFORM setval('public.luz_cliente_codigo_seq', n + 1, false);
  RAISE NOTICE 'CÓDIGO DE CLIENTE: % fichas numeradas. El próximo será CL-%.', n, lpad((n+1)::text, 4, '0');
END $$;

-- ── Asignación automática ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_codigo_cliente()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Solo rellena el hueco: un código escrito a mano (o traído de una
  -- importación) manda siempre sobre el automático.
  IF NEW.codigo IS NULL OR btrim(NEW.codigo) = '' THEN
    NEW.codigo := 'CL-' || lpad(nextval('public.luz_cliente_codigo_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_codigo_cliente ON public.luz_clientes;
CREATE TRIGGER trg_codigo_cliente
  BEFORE INSERT ON public.luz_clientes
  FOR EACH ROW EXECUTE FUNCTION public.fn_codigo_cliente();

-- Único de verdad: es la llave, y una llave repetida no es una llave.
-- Se ignoran las fichas en la papelera (borrado_en), que conservan el suyo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_luz_clientes_codigo
  ON public.luz_clientes (codigo) WHERE borrado_en IS NULL;

-- ── Comprobación: un guard que no encuentra lo que busca tiene que GRITAR ──
DO $$
DECLARE sin_codigo int; repes int; hay_trigger int;
BEGIN
  SELECT count(*) INTO sin_codigo FROM public.luz_clientes WHERE codigo IS NULL;
  SELECT count(*) INTO repes FROM (
    SELECT codigo FROM public.luz_clientes WHERE borrado_en IS NULL
     GROUP BY codigo HAVING count(*) > 1) x;
  SELECT count(*) INTO hay_trigger FROM pg_trigger
   WHERE tgname = 'trg_codigo_cliente' AND NOT tgisinternal;

  IF sin_codigo > 0 THEN
    RAISE EXCEPTION 'CÓDIGO DE CLIENTE: quedan % fichas sin código.', sin_codigo;
  END IF;
  IF repes > 0 THEN
    RAISE EXCEPTION 'CÓDIGO DE CLIENTE: hay % códigos repetidos.', repes;
  END IF;
  IF hay_trigger <> 1 THEN
    RAISE EXCEPTION 'CÓDIGO DE CLIENTE: el trigger trg_codigo_cliente NO está puesto.';
  END IF;
  RAISE NOTICE 'CÓDIGO DE CLIENTE aplicado: sin huecos, sin repetidos y con el trigger activo.';
END $$;
