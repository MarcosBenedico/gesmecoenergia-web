# Briefing — Automatizar y personalizar Gesmeco Energía

> Mensaje para pasar a una sesión nueva. Es autónomo: no hace falta contexto previo.
> Todas las cifras están medidas sobre la base de datos de producción el **7 de agosto de 2026**.
> Al empezar, vuelve a medirlas: si han cambiado mucho, manda lo que midas tú, no lo que pone aquí.

---

## 1. Quién es la empresa

**Gesmeco Energía**, asesoría energética en **Binéfar (Huesca)**, comarca de La Litera. Grupo de tres áreas:

| Área | Qué hace |
|---|---|
| Gesmeco Energía | Luz y gas + fotovoltaica |
| Asesoría Gesmeco | Fiscal y laboral |
| Correbin Asociados | Seguros |

**El equipo son tres personas y cada una trabaja de una forma distinta.** Esto es lo más importante del briefing, porque casi todos los problemas de abajo salen de haberlo ignorado:

- **Marcos** — dirección. Mira números y decide prioridades. Trabaja en escritorio.
- **Nicola** — administración/oficina. Mete datos, tramita, reclama. Escritorio, muchas horas seguidas en la misma pantalla.
- **David** — comercial de calle. Visita granjas, naves y negocios de la comarca. **Trabaja en el móvil, de pie, con una mano, a veces con guantes.** Su unidad de trabajo es *ir a un sitio*, no *cerrar un registro*.

Cliente tipo: explotaciones agrícolas y ganaderas, naves industriales y pequeño comercio de la comarca. Gente que no responde emails y sí abre WhatsApp.

## 2. Qué hay montado ya

Producción viva en **https://www.gesmecoenergia.com**

- **Next.js 16** (App Router) + TypeScript + **Tailwind v4** (postcss).
- **Supabase** — auth, datos, storage, RLS activado. Proyecto `rhsflkemubgigagwmoqb`.
- **Vercel** — despliegue automático al hacer push a `main`. No hay que configurar nada.
- **Repo GitHub**: `MarcosBenedico/gesmecoenergia-web`.

Estructura:

- `src/app/(site)/` — web pública (escaparate, analizador de facturas).
- `src/app/gestor/luz/` — el panel interno de la cartera energética. Aquí está el 90 % del trabajo.
- `src/lib/` — toda la lógica de negocio, separada de la UI y **cubierta por tests**.
- `src/app/api/` — route handlers.

Comandos que importan:

```bash
npm run dev            # desarrollo
npm run build          # SIEMPRE antes de commitear
npm run lint
npm run test:bandeja   # y test:estados, test:rutas, test:huecos, test:parte,
                       # test:visitas, test:potencia, test:clasificacion,
                       # test:consumo, test:integridad, test:agenda-calle,
                       # test:rendimiento, test:prospeccion
npm run smoke          # checklist de humo contra producción
```

Lee `CLAUDE.md` en la raíz **antes de tocar nada**. Documenta por qué está tomada cada decisión de diseño; varias parecen raras y tienen un motivo medido detrás.

**Variables de entorno** (ya configuradas en Vercel y en `.env.local`, no las pidas ni las imprimas):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`, `DATADIS_USER`/`DATADIS_PASSWORD`.

## 3. Estado real de la cartera (medido, 7-ago-2026)

| Tabla | Registros |
|---|---|
| Clientes | 301 |
| CUPS (suministros) | 162 |
| Contratos | 85 |
| Prospectos del mapa | 794 |
| Proyectos FV | 0 |
| **Visitas registradas (histórico entero)** | **21** |

Clasificación de los 301 clientes: **68 clientes** (han firmado), **125 preclientes** (nos dieron datos, no han firmado), **108 objetivos** (sitios a los que se puede ir).

## 4. El diagnóstico: cinco cosas rotas, con números

Esto ya está analizado. **No hace falta que lo vuelvas a investigar desde cero** — verifícalo y ve al grano.

**a) El menú no está personalizado por persona.**
Nicola y David tienen los mismos módulos en `app_usuarios`, así que ven **el mismo menú de 15 entradas**. El panel está organizado en 5 bloques (Calle / Oficina / Dirección / Herramientas / Ajustes) precisamente para separarlos, pero los bloques se pliegan a mano y se recuerdan en `localStorage`: la separación existe en el código y **cada uno tiene que construírsela él solo**. Nadie lo ha hecho. El comercial de calle abre el móvil y ve las pantallas de contabilidad.

**b) A David la pantalla le pide 8 veces lo que puede hacer.**
`src/app/gestor/luz/mi-dia/page.tsx` pinta como número principal, a `text-6xl` y en rojo, el valor `dia.hoy.length`, que junta *vencido + hoy*. Para David ahora mismo:

| | |
|---|---|
| Vencidas del último mes | 63 |
| De hoy | 7 |
| **Número grande que ve al abrir** | **71** |
| Sin fecha puesta | 19 |
| Futuras | 28 |
| Oportunidades abiertas | 75 |

Su objetivo demostrado son **9 puertas al día**. La pantalla que existe para decirle *qué hago ahora* le abre cada mañana con un 71 en rojo. Eso no es una lista de trabajo, es un marcador de derrota diario, y lo que produce es que se deje de abrir.

Encima esas 71 líneas son **solo 58 clientes**: hay gente repetida porque tiene a la vez una tarea, una fecha crítica y una acción de pipeline. La pantalla lista *registros*; a quien está en la calle le da igual de qué tabla salen — **va a un sitio, no a una fila**.

**c) Nicola tiene 1 tarea asignada. Una.**
De 137 tareas pendientes: 71 de David, 61 de Marcos, **1 de Nicola**. Cero fechas críticas, cero oportunidades. Si Nicola abre *Mi Día*, **le sale vacío**. Su trabajo real no está representado como tareas en ninguna parte: vive calculado en la pantalla *Bandeja* y en lo que le llega por WhatsApp.

> Resumido en una frase, que es el encargo entero:
> **a David la herramienta le enseña ocho veces lo que puede hacer, y a Nicola no le enseña nada.**

**d) Las visitas no se registran.**
20 en julio, 1 en agosto, **21 en todo el histórico**. Con 3 días de calle a la semana y 9 puertas, deberían ser ~108 al mes. Se registra menos del 20 %. De ahí comen el marcador de puertas y el parte diario de Marcos: **los dos van ciegos**, y cualquier métrica de productividad que construyas encima hoy sería falsa.

**e) Hay responsables fantasma.**
`Fernando`, `Administración`, `Marcos / Sales` y 16 registros sin asignar. No existen en `app_usuarios`, así que ese trabajo **no le aparece a nadie** en su pantalla. Está en la base de datos y en la práctica no existe.

## 5. Orientación: lo que hay que entender antes de escribir código

**La web, la base de datos y Vercel ya están conectados.** Push a `main` → Vercel despliega solo; la app lee y escribe en Supabase con RLS. **No hay que montar esa fontanería, ya funciona.** Lo que falta no es conexión, es que el estado del negocio sea **visible y manejable en un solo sitio**. No construyas integraciones nuevas creyendo que faltan: comprueba primero, que casi siempre están.

Cuatro principios, por orden:

1. **Una pantalla por persona, no una pantalla con filtros.** El panel ya tiene los datos; le falta decidir *qué enseña a quién*. Personalizar aquí significa que al entrar cada uno ve su trabajo hecho lista, sin configurar nada.
2. **Automatizar es quitar decisiones, no añadir botones.** Lo que se coma tiempo hoy —repartir, priorizar, recordar— debe salir calculado. Si una automatización obliga a revisarla, no ha ahorrado nada.
3. **Lo que no cabe en un día no va en la pantalla del día.** Lo atrasado no se borra: se baja a un desplegable. Un número imposible se ignora, y en cuanto se ignora uno se ignoran todos.
4. **La calle es móvil y con el pulgar.** Botones de 44 px mínimo (`btnTactil` / `btnTactilPrimario` ya están en el kit de UI). Cada paso que añadas a registrar una visita se paga en visitas que no se registran — mira el punto (d).

## 6. El trabajo, por orden de lo que se nota

**1 — Menú por persona.** Que el panel se abra ya plegado según quién entra: David en *Calle*, Nicola en *Oficina*, Marcos en *Dirección*. Lo demás sigue accesible, pero no de entrada. Sin que nadie configure nada.
*Hecho cuando:* David entra en el móvil y lo primero que ve es su día, no un menú de 15 entradas.

**2 — Mi Día deja de enseñar 71.** Que proponga **el trabajo de un día** (~9-10 paradas), **agrupado por cliente y no por registro** (las 71 líneas son 58 personas). Lo atrasado detrás, en un desplegable que se abre, no borrado.
*Hecho cuando:* el número grande es un número que se puede hacer hoy, y sigue habiendo forma de llegar a lo viejo.

**3 — Mi Día para Nicola.** Que su pantalla se llene con lo que ya calcula `src/lib/bandeja.ts` en vez de salir vacía. Misma pantalla, contenido según quién entra. **Reutiliza la lógica de bandeja, no escribas otra.**
*Hecho cuando:* Nicola entra y tiene una lista suya, ordenada por a quién bloquea.

**4 — Registrar la visita en un toque.** Existe `resolver-visita.tsx` con 4 botones y funciona; el problema es dónde está y cuántos toques cuesta llegar. Que se pueda marcar desde donde David ya está mirando.
*Hecho cuando:* las visitas del mes se parecen a las puertas del mes.

**5 — Limpiar los responsables fantasma.** Reasignar a personas reales de `app_usuarios` o cerrar lo que ya no aplica. Entrégalo como `supabase_*.sql` (ver reglas).

Haz **una cosa por commit** y despliega entre medias. Es un equipo de tres trabajando sobre esto todos los días: es preferible que noten cinco mejoras seguidas a que un lunes les cambie el panel entero.

## 7. Reglas de la casa (no negociables)

- **`npm run build` antes de cada commit**, siempre. Y pasa los tests de lo que toques.
- **Commits en español**, descriptivos. Mira `git log` para el tono.
- **Cambios de esquema = archivo `supabase_*.sql` en la raíz.** No hay migraciones automáticas: los ejecuta Marcos a mano en el editor SQL de Supabase. Avisa de que hay uno pendiente.
- **La lógica va en `src/lib/` con su test**, no dentro del componente. Es lo que hace que este proyecto se pueda seguir tocando.
- **No reintroducir el "acceso maestro"** que se eliminó. Roles: `admin` / `estándar` / `lectura`, con RLS.
- **Estilos:** en el gestor manda Tailwind y las clases `text-*` funcionan. En la web pública los tamaños de titular se cambian en `globals.css`, no en el JSX. Para `input` / `select` / `textarea` / `button` **siguen existiendo reglas sin capa y las clases de Tailwind no pintan** — no las escribas ahí.
- **Regla al añadir una entrada de menú: si no se abre casi todos los días, va a *Herramientas*.** Una entrada que nadie usa no cuesta servidor, cuesta atención, y la paga cada día quien sí tiene trabajo.
- **Honestidad con los números.** Hay precios, coeficientes de consumo y porcentajes en el código marcados como orientativos y pendientes de validar con facturas reales. Si construyes encima de uno, dilo en la pantalla. No los conviertas en dato por el camino.

## 8. Cómo quiero que trabajes

Mide antes de proponer: la base de datos está a un query y casi todas las discusiones se cierran solas con una cifra. Cuando algo no cuadre, **dilo con el número delante**. Si una de estas cinco tareas resulta estar peor planteada de lo que pone aquí, dilo y sigue con las otras — pero no la cambies en silencio.
