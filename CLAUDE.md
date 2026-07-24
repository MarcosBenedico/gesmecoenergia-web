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
  - `gestor/luz/` — Gestión Luz: cartera energética (clientes, cups, contratos, pipeline, tareas, rutas, comisiones, proyectos de ahorro, mi-día…).
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
