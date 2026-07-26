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
npm run test:huecos                        # tests de los huecos de la cartera (rellenar en tanda)
npm run test:clasificacion                 # tests de objetivo / precliente / cliente
npm run test:agenda-calle                  # tests de la agenda por zonas (vista Calle)
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
  - `gestor/luz/` — Gestión Luz: cartera energética. El menú está organizado en **5 bloques por forma de trabajar** (`layout.tsx`), no por tipo de dato:
    - **Calle** (David) — mi-día, agenda, rutas, pipeline.
    - **Oficina** (Nicola) — bandeja, **rellenar**, captura, alta, clientes, cups, contratos, importar, guía.
    - **Dirección** (Marcos) — solo lo que se mira a diario: dashboard, parte, consumo, comisiones, equipo.
    - **Herramientas** — oportunidades, FV, tarifas, proyectos, mercado. **Nace plegado.**
    - **Ajustes** — control, usuarios, configuración, papelera. **Nace plegado.**

    Antes eran 3 bloques con 12 entradas en Dirección y 10 en Oficina. La auditoría enseñó por qué había que partirlo: **el 73 % del trabajo real es clientes y tareas**, y había pantallas con cero uso ocupando sitio en el menú de quien más prisa tiene. **La regla al añadir algo: si no se abre casi todos los días, va a Herramientas.** Una entrada de menú que nadie usa no cuesta servidor, cuesta atención, y la paga cada día quien sí tiene trabajo. Cada uno pliega los bloques que no usa y se recuerda en localStorage.
    - **Agenda** (`gestor/luz/agenda`, lógica en `src/lib/agenda.ts`) — única lista de trabajo del equipo; sustituye en el menú a "Tareas" + "Fechas Críticas" (esas páginas siguen existiendo para crear/editar en detalle). Los vencimientos de contrato/permanencia/preaviso **no se guardan**: se calculan en vivo desde el CUPS, así nunca quedan desfasados.
      - Tres vistas: **Calle** (por defecto), Lista (por urgencia) y Calendario (por día).
      - **Vista Calle** (`agenda/calle.tsx`, lógica en `src/lib/agenda-calle.ts`) — **agrupa por ZONA, no por fecha**, y es la diferencia entre una lista y un plan: de marzo a julio, los días que David llevaba ruta preparada hizo **9 visitas de media; los días que salía con una lista, 0,7**. Nadie conduce a una fecha: se conduce a Tamarite y allí se hace todo lo de Tamarite, lo que vence mañana y lo que vence en tres semanas, porque volver cuesta 40 km.
      - Las zonas se ordenan **por lo que urge dentro de cada una**, no por número de paradas: veinte cosas tranquilas en Binéfar no valen más que tres vencidas en Esplús. La primera se abre sola.
      - **Cada línea dice qué le falta a ese cliente** (`queLeFalta`). El peor resultado de una visita no es un no: es plantarse allí y no poder ofertar porque el consumo no estaba metido — eso ya pasó y sale en los partes.
      - Se marcan paradas y **`enlaceRuta()` saca la ruta en Google Maps** saliendo de la oficina (tope de 10 paradas, que es lo que admite). Es exactamente lo que Marcos mandaba a mano los ocho días que rindieron nueve visitas, pero sin depender de que él lo prepare.
      - Todo a un toque y con el pulgar: llamar, WhatsApp con mensaje ya escrito, abrir el mapa, **resolver la visita** (que desde la Agenda no se podía y por eso había cero visitas registradas) y aplazar. Filtros por objetivo/precliente/cliente y por «listos para cerrar».
      - **Marcador de puertas del día** contra el objetivo de 9, que sale de su propio ritmo demostrado.
      - `municipioDe()` saca el municipio de direcciones escritas de tres maneras distintas usando el **código postal como ancla**, que es lo único fiable que tienen todas. Cubierto por `npm run test:agenda-calle`.
    - **Objetivo · Precliente · Cliente** (`src/lib/clasificacion.ts`, campo `luz_clientes.clasificacion`) — la distinción que faltaba: **objetivo** es un sitio al que se puede ir (David mira estos cuando está en una zona), **precliente** nos ha dado su información pero **no ha firmado nada**, y **cliente** ha firmado luz o placas. Se cambia de un clic desde la cabecera de la ficha, hay filtro y columna en la lista, y está en `rellenar` con el peso más alto de todos.
      - **NO confundir con `estado_comercial`**, que es otro eje: ese dice *por dónde va* el viaje (detectado → activo), este dice *qué tipo de relación es*. Conviven y ninguno sustituye al otro.
      - **Es un campo y no un cálculo, a propósito.** Hoy los contratos se llevan en papel y en las apps de las comercializadoras, así que hay clientes de verdad sin un contrato registrado: un cálculo diría que son preclientes y estaría equivocado. Manda lo que marque una persona. El cálculo se queda como **sugerencia** (`clasificacionSugerida`) y solo avisa cuando lo marcado va *por detrás* de los datos — un precliente que ya firmó. Al revés no avisa: un cliente con el contrato en papel es la situación normal hoy, y avisar de eso llenaría la pantalla de falsos positivos.
      - Requiere `supabase_clasificacion.sql`, que además **hace la carga inicial con las mismas reglas**: sin eso toda la cartera nacería como «precliente», incluidos los que llevan meses facturando, y el primer recuento sería mentira.
      - Cubierto por `npm run test:clasificacion`.
    - **Estado único del viaje comercial** (`src/lib/estados-luz.ts`) — el **CUPS es la fuente de verdad**; pipeline y contrato empujan su estado (traducción por tabla), y el estado comercial del cliente **se deriva** de todos sus CUPS. La sincronización vive en el PUT/POST de `src/app/api/luz/[tabla]/route.ts`. Nunca retrocede un suministro por accidente (`debeAplicarseAlCups`). Cubierto por `npm run test:estados`.
    - **Rellenar en tanda** (`gestor/luz/rellenar`, lógica en `src/lib/huecos.ts`) — la pantalla para Nicola. De cada tres cosas que hace en el sistema, **dos son rellenar un campo vacío**, y las hacía de una en una: abrir ficha, escribir una palabra, guardar, cerrar. Aquí se le da la vuelta: se elige **un campo** y se rellenan de golpe todos los registros que lo tienen vacío, en una rejilla.
      - **El orden no es por cuántos faltan, es por qué bloquea.** Cuarenta clientes sin email no paran nada; cinco CUPS sin `fecha_fin_contrato` paran la Agenda entera, porque el preaviso se calcula desde ahí. Cada hueco lleva su `peso` y su `porque` escrito, y el porqué se enseña siempre: rellenar a ciegas cansa.
      - Enter salta a la fila siguiente, **«poner lo mismo en todas»** resuelve el caso más común (veinte suministros con la misma distribuidora) y `normalizarValor` admite `30/04/2027` y `145.000` sin protestar.
      - Se guarda **fila a fila con el PUT de `/api/luz`**, no en bloque: ese PUT lleva dentro la sincronización de estados entre CUPS, pipeline y contrato, y saltárselo por ir más rápido dejaría los estados descuadrados.
      - Distingue **dos vacíos que se parecen y significan lo contrario**: que no falte ningún dato (buena noticia) y que no haya cargado la cartera (problema). Decir «cartera limpia» cuando no se ha leído nada haría cerrar la pantalla pensando que no hay trabajo.
      - Cubierto por `npm run test:huecos`.
    - **Bandeja** (`gestor/luz/bandeja`, lógica en `src/lib/bandeja.ts`) — la pantalla de Nicola: qué está esperando a que alguien lo meta o lo mueva. **No ordena por fecha sino por a quién bloquea**: bloquea la venta (David no puede ofertar) → bloquea el cobro → esperando al cliente → sus tareas. Dentro de cada grupo sí manda el tiempo parado.
      - **La bandeja existe para que la calle salga bien, no para llevar la cuenta de lo que falta.** Por eso **lo que Nicola no puede resolver no se le pone delante**: un precliente sin CUPS no es un atasco, es que todavía no nos ha dado la factura, y eso lo desbloquea David yendo. Un suministro en `sin_factura` sin consumo, igual: no hay nada que teclear hasta que llegue el papel. Antes salía todo eso y enterraba lo que sí estaba parado.
      - Solo salen cuando **el propio expediente dice que el dato ya debería estar** (`CLIENTE_YA_DEBERIA_TENER_CUPS`, `PIPELINE_YA_DEBERIA_TENER_CUPS`) o cuando el cliente está marcado **`clasificacion = 'cliente'`** —o sea, que firmó— y aun así le falta: eso último es un descuadre de verdad y pesa más que nada.
      - **Si hay visita esta semana, lo que falte sube 50 puntos y lo dice**: «HAY VISITA ESTA SEMANA: sin esto, se va con las manos vacías». Un consumo sin meter de un cliente al que nadie va a ver puede esperar; el de uno al que David va el jueves no, porque la visita se hará igual y se hará mal.
      - `TipoTrabajo` (meter datos · preparar · tramitar · reclamar · incidencias · tareas) agrupa **por lo que hay que hacer con las manos**, para ir por tandas: teclear ocho consumos seguidos cuesta la mitad que saltar de meter datos a llamar y volver.
      - Cubierto por `npm run test:bandeja`.
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
      - **El PDF se dibuja con jsPDF** (`src/lib/parte-pdf.ts`), no imprimiendo la pantalla: texto vectorial, A4 y cada bloque comprueba si cabe antes de pintarse. Lleva **ficha completa solo de los captados y de los que han avanzado de verdad** (con 38 clientes tocados, ficha para todos eran 26 páginas y no lo leía nadie); el resto va en una tabla de una línea. Incluye dos bloques que no salen de la auditoría sino del criterio: **«Lo que NO pasó hoy»** —porque un cero no se ve en un informe largo— y **«Calidad del dato»** con lo que falta para poder trabajar (sin teléfono, sin consumo, sin acción, acciones sin fecha).
      - Limpieza obligada por cómo está la cartera real: `separarObservaciones()` aparta la basura del importador (`Origen: cartera-9-7-2026.xlsx | Tipo precio: ...`) de las notas de verdad; `normalizarGritos()` baja el volumen a las tareas escritas en mayúsculas; y `esAccionReal()` evita que salga «Acción pendiente: CERRADA», que es lo que hace que se deje de leer justo el bloque que importa.
      - **Las horas van en Europe/Madrid y la marca llega en UTC.** Si esto se rompe, el parte enseña dos horas menos y parece que el equipo entra a las seis de la mañana con jornada de 8 a 15. Cubierto con tests de verano y de invierno.
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
