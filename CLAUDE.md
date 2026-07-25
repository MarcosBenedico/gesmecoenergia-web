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

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` (lectura de facturas), `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` (OAuth Google). Configuradas en Vercel y `.env.local`.
