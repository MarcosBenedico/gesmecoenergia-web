# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Web pública + panel de gestión interno de **Gesmeco Energía** (asesoría energética en Binéfar, Huesca). Grupo de 3 áreas: Gesmeco Energía (luz/gas + fotovoltaica), Asesoría Gesmeco (fiscal/laboral) y Correbin Asociados (seguros).

Stack: Next.js 16 (App Router) + TypeScript + Tailwind v4 (postcss) + Supabase (auth, datos, storage, RLS). Deploy automático en Vercel al hacer push a `main` (repo GitHub `MarcosBenedico/gesmecoenergia-web`). Producción: https://www.gesmecoenergia.com

## Comandos

```bash
npm run dev        # desarrollo en http://localhost:3000
npm run build      # build de producción — SIEMPRE antes de commitear
npm run lint       # ESLint
npm run smoke      # checklist de humo contra producción
BASE=http://localhost:3000 npm run smoke   # smoke contra local
node scripts/test-fv.mjs                   # tests de la lógica FV
npm run test:estados                       # tests de sincronización de estados (Gestión Luz)
npm run test:prospeccion                   # tests de la prospección sobre la ruta
npm run test:visitas                       # tests de qué desencadena cada resultado de visita
npm run test:bandeja                       # tests de la bandeja de entrada (Oficina)
npm run test:potencia                      # tests del optimizador de potencias y la curva (Datadis)
npm run test:parte                         # tests del parte del día (auditoría → qué mejoró en cada cliente)
npm run verify:supabase                    # comprueba conexión Supabase
```

No hay suite de tests formal; la verificación es `npm run build` + `scripts/smoke.mjs` (comprueba rutas clave de producción) + `scripts/test-fv.mjs`.

## Flujo de trabajo acordado con Marcos

- Hacer los cambios → `npm run build` para verificar → commit y push a `main` directamente (Vercel despliega solo).
- Mensajes de commit en español, descriptivos (ver `git log`).
- Ser honesto: si un dato (precios, %, subvenciones) es orientativo y no verificado, decirlo explícitamente.
- Los cambios de esquema de BD se entregan como archivos `supabase_*.sql` en la raíz para que Marcos los ejecute en el SQL editor de Supabase (no hay migraciones automáticas). `supabase_rls_v2.sql` ya está ejecutado.

## Arquitectura

- `src/app/(site)/` — web pública (home, servicios, sectores, analizador de facturas, etc.).
- `src/app/gestor/` — panel interno, con login Supabase Auth:
  - `gestor/luz/` — Gestión Luz: cartera energética. El menú está organizado en **3 bloques por forma de trabajar** (`layout.tsx`), no por tipo de dato: **Calle** (David: mi-día, agenda, rutas, alta, pipeline, clientes), **Oficina** (Nicola: cups, contratos, proyectos, importar, guía) y **Dirección** (Marcos: dashboard, comisiones, equipo, FV, control, usuarios, configuración). Cada uno puede plegar los bloques que no usa (se recuerda en localStorage).
    - **Agenda** (`gestor/luz/agenda`, lógica en `src/lib/agenda.ts`) — única lista de trabajo del equipo; sustituye en el menú a "Tareas" + "Fechas Críticas" (esas páginas siguen existiendo para crear/editar en detalle). Los vencimientos de contrato/permanencia/preaviso **no se guardan**: se calculan en vivo desde el CUPS, así nunca quedan desfasados.
    - **Estado único del viaje comercial** (`src/lib/estados-luz.ts`) — el **CUPS es la fuente de verdad**; pipeline y contrato empujan su estado (traducción por tabla), y el estado comercial del cliente **se deriva** de todos sus CUPS. La sincronización vive en el PUT/POST de `src/app/api/luz/[tabla]/route.ts`. Nunca retrocede un suministro por accidente (`debeAplicarseAlCups`). Cubierto por `npm run test:estados`.
    - **Bandeja** (`gestor/luz/bandeja`, lógica en `src/lib/bandeja.ts`) — la pantalla de Nicola: qué está esperando a que alguien lo meta o lo mueva. **No ordena por fecha sino por a quién bloquea**: bloquea la venta (David no puede ofertar) → bloquea el cobro → esperando al cliente → sus tareas. Dentro de cada grupo sí manda el tiempo parado. Cubierto por `npm run test:bandeja`.
    - **Resultado de la visita** (`gestor/luz/resolver-visita.tsx`, reglas en `src/lib/visitas.ts`) — hoja móvil con 4 botones: *no estaba · no le interesa · volver otro día · me dio la factura*. Es lo que enlaza la calle con el resto: crea la visita con su resultado, programa la siguiente pasada en la Agenda, mueve el pipeline y **descarta la oportunidad en el mapa si dijeron que no**, para que no vuelva a proponerse. «Me dio la factura» abre la cámara y la lee con `/api/leer-factura` en el sitio, creando el CUPS. Se abre desde Mi Día y desde el mapa de Rutas. Requiere `supabase_visita_resultado.sql`. Cubierto por `npm run test:visitas`.
    - **Mapa de oportunidades** (`gestor/luz/oportunidades`, solo admin; lógica en `src/lib/prospeccion.ts`, tabla `luz_prospectos`) — granjas, naves y negocios de la comarca que aún no son clientes. Se **barre una zona una vez** (`/api/luz/barrer`, que guarda) y a partir de ahí se va filtrando: `nuevo → interesante → para_visitar → descartado / convertido`. **Lo descartado no vuelve a proponerse**, y volver a barrer refresca los datos del mapa pero nunca pisa el estado ni las notas.
      - Los pines llevan **emoji del tipo + número de NAVES** (la medida que usa el sector y la que mejor predice la factura) **+ color del estado**. Filtros por tamaño (`CATEGORIAS_NAVES`), tipo, municipio y estado.
      - Dos vistas: **Mapa** (descubrir y decidir) y **Objetivos** (trabajar lo ya decidido, agrupado **por zona de actuación**, que es como se planifican las salidas).
      - **Ficha por objetivo** en `oportunidades/[id]`: ortofoto, datos del mapa, Catastro (se pide una vez y **se guarda en la fila**), notas y estado.
      - **«Pasar al sistema»** (`oportunidades/promover.ts`) crea de una vez **cliente + oportunidad en el pipeline + tarea de visita**. Las tres: sin la tarea la ficha se crea y no va nadie.
      - Solo lo marcado **«que vaya David»** llega a `gestor/luz/rutas`: él recibe la lista ya decidida, no elige entre cientos de puntos.
      - Requiere ejecutar `supabase_prospectos.sql`.
      - Enseña **ortofoto del PNOA/IGN** de cada sitio y la **ficha oficial del Catastro** (`/api/luz/catastro`: uso, m² construidos, año, referencia) — ambos gratis y sin clave.
      - En la Litera casi ninguna granja está etiquetada en OSM, así que se detectan **por forma**: naves largas y estrechas, varias juntas, aisladas, con balsa al lado. Se agrupan en **sitios** (una granja de 4 naves es una visita).
      - Lo que separa el campo del pueblo es la **densidad de edificios alrededor**, no `landuse=residential` (que no está mapeado en Binéfar). Sin eso, una manzana de casas adosadas salía como granja intensiva.
      - El consumo es un **orden de magnitud** por tipo y m², nunca un dato. Los coeficientes están en `src/lib/consumo-estimado.ts`, en una sola tabla, **pendientes de que Marcos los valide con facturas reales**.
      - Cubierto por `npm run test:prospeccion`.
    - **Consumo real / Datadis** (`gestor/luz/consumo`, solo admin; cliente en `src/lib/datadis.ts`, análisis en `src/lib/potencia.ts`) — el consumo que dan las **distribuidoras** por Datadis, gratis y sin instalar ningún aparato: curva horaria, maxímetro por periodo y las potencias contratadas de verdad. Con eso la potencia contratada deja de ser lo que alguien teclee de una factura y pasa a ser un cálculo.
      - **La autorización la da el cliente, no hay atajo por API.** El titular tiene que autorizar nuestro NIF en datadis.es; sin eso Datadis devuelve lista vacía. Es la causa del 90 % de los «no funciona», así que es un estado de primera clase (`luz_clientes.datadis_autorizado`) y la pantalla lo pone arriba.
      - **El maxímetro manda sobre la curva.** El periodo lo asigna la distribuidora y el máximo es el cuartohorario que ella factura. De la curva horaria solo se deduce un promedio, que **aplana los picos**: sirve para el perfil, nunca para apurar potencias. La confianza (`alta`/`media`/`baja`) viaja pegada a la cifra.
      - **El criterio por defecto es no bajar nunca de lo medido** (`optimizarPotencias`, modo `prudente`). Con maxímetros mensuales la penalización por excesos solo se puede acotar por abajo —se cobra por cada cuarto de hora—, así que apurar el límite recomendaría dejar al cliente corto y la penalización la pagaría él. El ahorro sale de lo que sobra, que es donde está el dinero.
      - Detecta además **excesos** (ahí el consejo es subir, no bajar), **tarifa equivocada** (una 3.0TD que nunca pasa de 15 kW debería ser 2.0TD) y **reactiva** por factor de potencia (tan φ > 0,33).
      - `perfilDeCurva` da el **% de consumo en horas de sol**, que es lo que la calculadora FV venía suponiendo a mano en `hipotesis.pct_autoconsumo`.
      - Datadis es **lento y raciona**: una consulta por CUPS y mes cada 24 h, y repetir devuelve 429. Antes de pedir se mira `luz_datadis_sync`, y un CUPS que falla no tumba la sincronización.
      - Los precios del término de potencia (`PRECIOS_POTENCIA_REFERENCIA`) son de referencia y **están pendientes de que Marcos los valide con una factura de 2026**; se pueden revisar sin tocar código desde la clave `precios_potencia_kw_anio` de `luz_config`. Los kW son dato de la distribuidora; los € son orientativos hasta esa validación.
      - Requiere ejecutar `supabase_datadis.sql` y las variables `DATADIS_USER` / `DATADIS_PASSWORD`.
      - Cubierto por `npm run test:potencia`.
    - **Parte del día** (`gestor/luz/parte`, **solo admin**, lógica en `src/lib/parte-diario.ts`) — qué se movió en la cartera un día concreto, quién lo movió y **qué mejoró en cada cliente**. Se elige la fecha y sale; se imprime o se guarda en PDF desde el navegador.
      - Sale de **`app_auditoria`**, que llenan triggers de BD con la fila **entera antes y después** de cada cambio. Por eso puede decir «el estado pasó de oferta enviada a contrato firmado» en vez del inútil «se modificó un CUPS». No hay que instrumentar nada en la aplicación: si se guarda, queda registrado.
      - `parte-diario.ts` es sobre todo **un traductor**: de nombre de columna a castellano y de un JSON a una frase que se lea en voz alta. Y un **clasificador**: `alta · avance · dinero · retroceso · dato · rutina`, usando `ORDEN_ESTADO_CUPS` para distinguir avanzar de retroceder. Sin esa clasificación el parte sería otra lista larga que nadie lee.
      - Un UPDATE que no cambió nada visible **no se enseña**: es ruido de guardado.
      - **El rol se comprueba en el servidor** (`app_usuarios`), no solo escondiendo el menú: enseña la actividad de todo el equipo persona por persona.
      - **No es un control horario** y la pantalla lo dice: la auditoría marca cuándo se *guardó* algo, no cuándo se hizo. Una visita de las nueve metida a las seis aparece a las seis.
      - Requiere `supabase_auditoria_parte.sql` (añade los triggers que faltaban en `luz_visitas`, `luz_prospectos` y `luz_proyectos` — sin ellos el parte enseña la oficina y se deja fuera la calle). La auditoría se llena **desde que se ejecuta**: los días anteriores saldrán incompletos.
      - Cubierto por `npm run test:parte`.
  - `gestor/luz/fv/` — **Calculadora FV** (solo admin): presupuestador fotovoltaico. Lógica en `src/lib/fv.ts`, UI en `page.tsx` + `energia.tsx`. Dos flujos: "presupuesto de Óscar" (instalador) y "presupuestar desde consumos". Incluye escenarios, algoritmo de batería por amortización (`optimizarBateria`), simulación horaria 24h (`simularDiaFV`), comparador de equipos reales y oferta PDF. `hipotesis.pct_autoconsumo` es la **fuente única** del autoconsumo efectivo en toda la oferta.
  - `gestor/correbin/` — vencimientos de seguros.
  - `gestor/clientes-app/` — App Clientes.
  - `gestor/luz/control/` — panel "Control General" con auditoría (PIN 20082006).
- `src/app/cliente/` y `src/app/mobile/` — área de cliente y versión móvil/PWA.
- `src/app/api/` — route handlers (Supabase server-side, lectura de facturas con Claude vía `ANTHROPIC_API_KEY`, OAuth Google, endpoints de setup/migración).
- `src/lib/` — lógica de negocio: `fv.ts` (fotovoltaica), `luz.ts`, `correbin.ts`, `tarifas.ts`, `auth.ts`/`usuario.ts` (roles), `supabase.ts` (cliente), generadores de PDF/Excel.
- `src/components/` — componentes compartidos (web pública y gestor).

## Usuarios y permisos

Login por Supabase Auth. Roles: `admin` / `estándar` / `lectura`, con módulos asignados por usuario y RLS activado en BD. Equipo real: Marcos (admin), Nicola (administración), David (comercial de calle). Hay reparto automático de tareas por rol. El antiguo "acceso maestro" se eliminó — no reintroducirlo.

## Variables de entorno

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` (lectura de facturas), `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` (OAuth Google), `DATADIS_USER` / `DATADIS_PASSWORD` (consumo real; opcionales `DATADIS_BASE` y `DATADIS_TIMEOUT_MS`). Configuradas en Vercel y `.env.local`.
