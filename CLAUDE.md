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
npm run test:rendimiento                   # tests del juicio del parte (productividad, probabilidad de cierre, pendiente)
npm run test:huecos                        # tests de los huecos de la cartera (rellenar en tanda)
npm run test:dia                           # tests del reparto del día (qué se aparca por viejo y en qué orden sale)
npm run test:clasificacion                 # tests de objetivo / precliente / cliente
npm run test:consumo                       # tests de cómo se lee un consumo escrito a mano
npm run test:integridad                    # tests de integridad: alta sin duplicados y vínculos que no se rompen
npm run test:agenda-calle                  # tests de la agenda por zonas (vista Calle)
npm run test:rutas                         # tests del plan de rutas y del montador de rutas
npm run test:etapas                        # tests del vocabulario único de estados (etapas.ts)
npm run test:seguimiento                   # tests del reloj de seguimiento (cuánto lleva parado y cuándo es problema)
npm run test:dashboard                     # tests del dashboard de dirección (qué se decide hoy y en qué orden)
npm run test:factura                       # tests de la revisión de la factura leída (qué bloquea y qué solo avisa)
npm run test:escenarios                    # tests del motor de comparativa (qué se recomienda y por qué)
npm run test:plantilla                     # tests de la plantilla de consumos (Excel: 12 meses por periodo)
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
    - **Calle** (David) — mi-día, rutas, pipeline.
    - **Oficina** (Nicola) — bandeja, **rellenar**, captura, alta, clientes, cups, contratos, importar, guía.
    - **Dirección** (Marcos) — solo lo que se mira a diario: dashboard, parte, consumo, comisiones, equipo.
    - **Herramientas** — oportunidades, FV, tarifas, proyectos, mercado. **Nace plegado.**
    - **Ajustes** — control, usuarios, configuración, papelera. **Nace plegado.**

    Antes eran 3 bloques con 12 entradas en Dirección y 10 en Oficina. La auditoría enseñó por qué había que partirlo: **el 73 % del trabajo real es clientes y tareas**, y había pantallas con cero uso ocupando sitio en el menú de quien más prisa tiene. **La regla al añadir algo: si no se abre casi todos los días, va a Herramientas.** Una entrada de menú que nadie usa no cuesta servidor, cuesta atención, y la paga cada día quien sí tiene trabajo. Cada uno pliega los bloques que no usa y se recuerda en localStorage.
    - **Dashboard de dirección** (`gestor/luz/page.tsx`, lógica en `src/lib/dashboard.ts`) — la portada de Marcos. Tenía **ocho tarjetas de KPI con el mismo peso**, hasta doce alertas rojas seguidas y una lista de accesos rápidos que repetía el menú: todo cierto y nada accionable. Ahora enseña **decisiones, no inventario**, y el listón es poder señalar en diez segundos lo que hay que hacer hoy.
      - **Las cinco decisiones del día** (`prioridadesDeHoy`) van ordenadas por **lo que se pierde para siempre**, no por importe: preaviso que se cierra → firmado sin activar → propuesta sin seguir → estudio pendiente → factura que no llega. Un preaviso que caduca bloquea al cliente **un año**, así que manda sobre cualquier comisión; el dinero ordena **dentro** de cada escalón y nunca salta al de arriba (por eso los pesos van separados de 1000 en 1000).
      - **Un cliente ocupa una sola línea**, la de su peor problema. Si aportara una por cada cosa pendiente, el mismo nombre llenaría los cinco huecos y taparía a los otros cuatro que también se están cayendo.
      - **Lo que no es una decisión de HOY no gasta un hueco**: un preaviso a tres meses sale en el bloque de vencimientos, no arriba; una oferta enviada ayer aún está en plazo; un preaviso ya vencido no se pinta como si aún se pudiera hacer algo.
      - Tres cifras arriba en vez de ocho (`cabecera`): **qué requiere decisión** —que es lo que está en rojo, no el total de la cartera—, **qué hay propuesto sin respuesta** y **qué está por cerrar**. Debajo, el embudo **con su valor** (`embudo`), los vencimientos por tramos **30/60/90** (`vencimientos`) y **como mucho tres** avisos de calidad (`alertasCalidad`), solo de datos que bloquean trabajo real: un email que falta no impide hacer nada, un teléfono que falta sí.
      - **No tiene criterio propio de urgencia.** Las etapas salen de `etapas.ts` y los plazos de `seguimiento.ts`. Si el dashboard tuviera su propia idea de qué es urgente, diría una cosa y el Pipeline otra, y no habría forma de saber cuál creerse.
      - Cubierto por `npm run test:dashboard`.
    - **Estudios y propuestas** (`gestor/luz/estudios`, tabla `luz_estudios`, lógica en `src/lib/factura.ts` + `src/lib/escenarios.ts`) — el paso que faltaba entre tener la factura y tener una oferta. El CRM decía «falta el estudio» y no había ningún sitio donde el estudio viviera: se leía la factura, se calculaba un ahorro, se hacía un PDF y todo eso se perdía. Lo caro no era repetir el trabajo, era **no poder contestar** cuando el cliente llama dos meses después preguntando por «los 1.400 € que me dijisteis».
      - **El estudio guarda una COPIA de los precios, no una referencia** a la tabla de tarifas. Si apuntara a la tabla, al día siguiente de subir precios la propuesta que el cliente tiene impresa diría otra cosa que la pantalla. Un estudio es una **foto** de lo que se le dijo a alguien un día concreto. Al darlo por enviado se marca `bloqueado` y desde ahí no se recalcula solo ni avisa de que sus precios caducaron: se congeló a propósito. **Las versiones son filas** (`origen_id` + `version`), no un número que se pisa.
      - **La validación de la factura** (`revisarFactura`) solo **bloquea lo que hace mentir al cálculo**. Una factura leída por un modelo no devuelve basura evidente, devuelve **números plausibles**: un 0,18 €/kWh que era 0,018, o tres periodos leídos de los seis que tiene una 3.0TD — y con tres de seis el coste actual sale a la mitad y el ahorro **al doble**, sin que nada lo delate. Eso para la propuesta. Que falte el CUPS o el titular **avisa pero no para**: la oferta se prepara igual y es justo lo que hay que llevar a la visita. Los precios actuales tampoco bloquean, porque sin ellos **se puede ofertar, lo que no se puede es decir cuánto ahorra** — son dos preguntas distintas y tratarlas igual dejaría propuestas sin hacer.
      - **Lo dudoso se marca, nunca se corrige.** Un precio fuera de rango o unas potencias que decrecen en 3.0TD se señalan con el motivo escrito y se dejan tal cual. Inventar el número aquí es el mismo fallo que el punto de los miles de `leerConsumo`.
      - **La recomendación NO es «el que más ahorra»** (`recomendar` en `escenarios.ts`). Un indexado gana casi siempre en la hoja de cálculo porque se compara contra el precio de hoy, pero lo que el cliente firma es un año: si el mercado sube, el ahorro se convierte en un sobrecoste con nuestro nombre. Se recomienda **el que más ahorra entre los que no obligan a explicar un riesgo**, y el arriesgado solo si es lo único que mejora. **Cuando el descartado ahorraba más, la frase lo dice**: la decisión es de Marcos, lo que no puede pasar es que el sistema la tome en silencio.
      - Bajar potencia **sin maxímetro** es riesgo alto por lo mismo que explica `potencia.ts`: la curva horaria es un promedio y aplana los picos, así que la demanda real pudo ser mayor y la penalización la pagaría el cliente.
      - **Cada número dice de dónde sale** (leído de la factura · puesto a mano · calculado), debajo del propio campo y no en una leyenda al pie: la leyenda se lee una vez y el que se olvida es justo el dato dudoso.
      - **Tres alternativas como mucho.** Cinco ofertas con el mismo peso es la lista que hace que el cliente diga «déjamelo mirar» y no vuelva.
      - **«Falta el estudio» es un botón, no una frase** — en el Dashboard (`DESTINO_PRIORIDAD`) y en las tarjetas paradas en análisis. Quien lee «hacer el estudio» y tiene que ir a buscar la pantalla lo hace luego, y luego es nunca.
      - **La vía principal para meter los datos es una PLANTILLA DE EXCEL** (`src/lib/plantilla-consumos.ts`, generada y leída en `/api/luz/plantilla`), no la lectura automática de la factura. Dos motivos y los dos son de fondo: la lectura automática depende de una API de pago —el día que se acaba el saldo deja de funcionar entera, que es exactamente lo que pasó— y, aunque funcione, **de una foto sale UN mes**. Con un mes, el año se estima multiplicando por doce, y aquí eso es falso: una granja con riego en agosto no se parece a la misma granja en febrero. Con doce meses el año no se estima, se suma.
      - **Se anualiza por DÍAS FACTURADOS, no por meses.** Sumar tres meses y multiplicar por cuatro es la clase de número que parece bien y arruina una propuesta. Con los días reales, un periodo incompleto se anualiza con su factor exacto **y se dice** que está extrapolado y desde cuántos días (`extrapolado`, umbral `DIAS_MINIMOS_FIABLES` = 300). Un dato estimado que no se anuncia es peor que no tenerlo: el hueco se ve y el número no.
      - **Hay una plantilla por tarifa** (2.0TD / 3.0TD / 6.1TD) y no una común. Con una común, el de 2.0TD tiene tres columnas que no sabe qué son y el de 3.0TD puede rellenar tres de seis — que es **el error caro**: con tres periodos de seis el coste actual sale a la mitad y el ahorro al doble sin que nada lo delate. Generándola por tarifa, ese error no se puede cometer.
      - **`leerNumero` distingue `cantidad` de `decimal`, y eso es lo que resuelve la ambigüedad**: «0.185» en una casilla de kWh es 185 (punto de miles) y en una de €/kWh son dieciocho céntimos y medio. Sin saber la columna hay que adivinar, y adivinando un precio entraba **mil veces mayor**. Los kW van como `decimal` por lo mismo: `4.6` es la potencia doméstica más común de España, y tratarla como cantidad marcaba como dudosa **toda** plantilla de 2.0TD — un aviso que salta siempre tapa a los que importan.
      - **La fila de TOTAL no es un mes** (`FILAS_NO_MES`). La plantilla la lleva al pie para que se vea si falta un mes; leyéndola como un mes más salían 13 meses, 660 días y una potencia de 300 kW —la suma de las doce— en vez de 40, sin error ninguno.
      - **El maxímetro que trae la plantilla cambia la recomendación**: con un pico medido detrás, proponer bajar potencia deja de ser riesgo alto (ver `potencia.ts` y `escenarios.ts`).
      - Requiere ejecutar `supabase_estudios.sql`.
      - Cubierto por `npm run test:factura`, `npm run test:escenarios` y `npm run test:plantilla`.
    - **Mi Día** (`gestor/luz/mi-dia`, lógica en `src/lib/agenda.ts`) — la única pantalla de trabajo de David, y la única lista del equipo. Sustituye en el menú a «Tareas» + «Fechas Críticas» (esas páginas siguen existiendo para crear y editar en detalle) y **absorbió la Agenda**, que era una entrada aparte.
      - **Mi Día y la Agenda llamaban a la MISMA función** (`construirAgenda`) sobre los mismos registros: Mi Día era la Agenda filtrada por «yo» y por «hoy». No se parecían — una era un subconjunto de la otra —, y por eso se mezclaban en la cabeza de quien las usaba. Ahora son tres vistas de una sola pantalla, y `/gestor/luz/agenda` redirige para no romper enlaces guardados en el móvil.
      - **HOY** (por defecto) · qué hago ahora. Atrasado y de hoy van juntos: para quien está en la calle son lo mismo. Los días de calle sale el aviso de a qué zona toca ir, que lleva a la vista de al lado.
        - **Lo que arrastra mucho retraso se aparca** (`partirPorAtraso` en `agenda.ts`). La importación de julio de 2026 creó **74 líneas de golpe** para David y el número grande de la pantalla —el que existe para decir «esto es lo de hoy»— pasó a marcar 74 cuando su ritmo demostrado son **9 puertas al día**. Un número que no se puede hacer no se prioriza: se ignora, y en cuanto se ignora uno se ignoran todos, incluido el día que de verdad son tres cosas. Lo aparcado **no se borra**: baja a un plegable con su cuenta.
        - **Cuidado con qué significa «viejo».** Medido sobre la cartera real, **nada pasaba de 17 días de retraso**: un corte a 30 días apartaba **1 línea de 74** (y esa era un año tecleado a dos cifras, ver `supabase_fecha_ano_26.sql`). El corte útil está mucho más abajo, así que **se elige desde la pantalla** (3/7/14/30) en vez de quedar clavado en el código: el número bueno depende de cuánta cartera haya entrado de golpe, y eso cambia. Con 7 días la lista de David pasa de 74 a 25.
        - **Lo que vence hoy no se aparca nunca**, por viejo que sea el registro: hoy es su día, y apartarlo sería justo el fallo que esto viene a evitar.
        - **El orden por defecto es por orden de llegada**, no por prioridad. Ordenando por prioridad, un cliente A recién metido adelanta cada día a uno que lleva tres semanas esperando, y ese segundo **no sale nunca** porque cada mañana hay un A nuevo. Por llegada la cola avanza sola según se cierra lo de delante. El orden por urgencia sigue a un toque, y la elección se recuerda en localStorage junto con el corte.
        - Cubierto por `npm run test:dia`.
      - **POR ZONA** (`agenda/calle.tsx`, lógica en `src/lib/agenda-calle.ts`) · para salir. Aquí vive el **montador de ruta**, porque primero se decide adónde se va y luego se mira qué hay allí; al revés se sale sin ruta y se improvisa.
      - **CALENDARIO** · qué me espera. Para mirar la semana, no para trabajar.
      - **La vista elegida se recuerda** en localStorage: quien siempre trabaja por zona no tiene que elegirla cada mañana.
      - Los vencimientos de contrato/permanencia/preaviso **no se guardan**: se calculan en vivo desde el CUPS, así nunca quedan desfasados.
      - **Agrupar por ZONA y no por fecha** es la diferencia entre una lista y un plan: de marzo a julio, los días que David llevaba ruta preparada hizo **9 visitas de media; los días que salía con una lista, 0,7**. Nadie conduce a una fecha: se conduce a Tamarite y allí se hace todo lo de Tamarite, lo que vence mañana y lo que vence en tres semanas, porque volver cuesta 40 km.
      - Las zonas se ordenan **por lo que urge dentro de cada una**, no por número de paradas. La primera se abre sola.
      - **Cada línea dice qué le falta a ese cliente** (`queLeFalta`). El peor resultado de una visita no es un no: es plantarse allí y no poder ofertar porque el consumo no estaba metido.
      - Se marcan paradas y **`enlaceRuta()` saca la ruta en Google Maps** saliendo de la oficina (tope de 10 paradas, que es lo que admite).
      - Todo a un toque y con el pulgar: llamar, WhatsApp con mensaje ya escrito, abrir el mapa, **resolver la visita** y aplazar (con motivo obligatorio, que sin él una lista deja de significar nada al mes).
      - **Marcador de puertas del día** contra el objetivo de 9, que sale de su propio ritmo demostrado.
      - `municipioDe()` saca el municipio de direcciones escritas de tres maneras distintas usando el **código postal como ancla**, que es lo único fiable que tienen todas. Cubierto por `npm run test:agenda-calle`.
    - **Plan de rutas y montador** (`src/lib/plan-rutas.ts` + `src/lib/ruta-optima.ts`, UI en `mi-dia/montar-ruta.tsx`) — los días de calle están **diseñados de antemano** para quitar la decisión de en medio, que es lo que se comía las mañanas.
      - **Rotación de 3 semanas × 3 días de calle** (martes, miércoles, jueves) sobre las 7 zonas de `zonas.ts`. Nueve salidas por ciclo: **lo cercano y denso se pisa dos veces, lo lejano una**. Así ninguna zona queda huérfana y ninguna mañana se va en carretera. La semana ISO hace avanzar el ciclo solo.
      - **Los objetivos de puertas NO son iguales cada día**: cerca 10, media 9, lejos 7. Un día en Fraga se come hora y media en desplazamientos, y pedir diez puertas allí es la forma más rápida de que el plan deje de creerse. Lunes teléfono, viernes cierres, fin de semana `descanso` — no hereda el viernes, que salía «cerrar y firmar» en domingo.
      - **`oportunidadesDePaso()`** es la pieza que más rinde: mide contra **todo el recorrido**, no contra la parada más cercana, así que un sitio a 300 m del tramo Binéfar–Tamarite sale como «de paso» aunque esté a 8 km de las dos paradas. Eso convierte una ruta de seis clientes en una mañana de nueve puertas **sin conducir un kilómetro más**. Solo propone prospectos en `para_visitar`, o sea lo que Marcos ya decidió.
      - `ordenarPorCercania()` es vecino más cercano y sirve **para leer la lista**; la optimización buena la hace Google con `optimize:true`, que conoce las carreteras. `cabeEnLaManana()` avisa si la ruta se pasa de la mañana (20 min por parada, sacados de sus días buenos).
      - Cubierto por `npm run test:rutas`.
    - **Objetivo · Precliente · Cliente** (`src/lib/clasificacion.ts`, campo `luz_clientes.clasificacion`) — la distinción que faltaba: **objetivo** es un sitio al que se puede ir (David mira estos cuando está en una zona), **precliente** nos ha dado su información pero **no ha firmado nada**, y **cliente** ha firmado luz o placas. Se cambia de un clic desde la cabecera de la ficha, hay filtro y columna en la lista, y está en `rellenar` con el peso más alto de todos.
      - **NO confundir con `estado_comercial`**, que es otro eje: ese dice *por dónde va* el viaje (detectado → activo), este dice *qué tipo de relación es*. Conviven y ninguno sustituye al otro.
      - **Es un campo y no un cálculo, a propósito.** Hoy los contratos se llevan en papel y en las apps de las comercializadoras, así que hay clientes de verdad sin un contrato registrado: un cálculo diría que son preclientes y estaría equivocado. Manda lo que marque una persona. El cálculo se queda como **sugerencia** (`clasificacionSugerida`) y solo avisa cuando lo marcado va *por detrás* de los datos — un precliente que ya firmó. Al revés no avisa: un cliente con el contrato en papel es la situación normal hoy, y avisar de eso llenaría la pantalla de falsos positivos.
      - Requiere `supabase_clasificacion.sql`, que además **hace la carga inicial con las mismas reglas**: sin eso toda la cartera nacería como «precliente», incluidos los que llevan meses facturando, y el primer recuento sería mentira.
      - Cubierto por `npm run test:clasificacion`.
    - **Leer un consumo escrito a mano** (`leerConsumo` en `src/lib/luz.ts`, aviso en `AvisoConsumo` de `gestor/luz/ui.tsx`) — en España el punto es separador de miles, pero `parseFloat` lo lee como decimal: quien tecleaba «53.558» guardaba **53,558 kWh, mil veces menos**. Estaba en el formulario de Alta y en el de la ficha del cliente, y llegó a **57 CUPS** — un club de pádel con 19 kWh al año y una agrícola con 202.
      - **El fallo era silencioso, y eso es lo que lo hacía caro.** Al guardar no se veía nada raro; el error aparecía semanas después dentro de una oferta, una comparativa o un estudio FV. Por eso el aviso enseña **siempre** cómo se ha entendido la cifra («Se guardará 53.558 kWh al año»), no solo cuando hay problema: leer el número interpretado debajo de lo que acabas de escribir es lo que evita la equivocación.
      - **Lo ambiguo no se adivina, se pregunta.** `53.558` (tres dígitos detrás) es separador de miles y se recupera sin riesgo; `3.42` puede ser 3,42 o 3.420 y **no hay forma de saberlo sin la factura**, así que se marca `sospechoso` con el motivo escrito y se deja el valor tal cual. Inventar el número aquí sería peor que no tocarlo.
      - Además avisa por debajo de `CONSUMO_MINIMO_CREIBLE` (500 kWh/año): ni un pozo ni un garaje bajan de ahí, así que una cifra menor casi siempre es un punto de miles perdido.
      - El campo es `type="text"` y no `type="number"` **a propósito**: un campo numérico no deja teclear el punto de miles en algunos navegadores y empuja a escribir mal.
      - Cubierto por `npm run test:consumo`.
    - **Integridad del alta y de los vínculos** (`scripts/test-integridad.mjs`, `supabase_integridad_v1.sql`) — tres fallos que corrompían datos en silencio.
      - **El asistente de alta se podía repetir.** Deja volver atrás, y cada pasada volvía a crear la oportunidad, la tarea y la fecha crítica: un cliente acababa con tres tareas iguales que nadie había pedido. Ahora cada paso recuerda lo que ya creó (`opCreada`, `tareaCreada`, `fechasCreadas`) y al repetirlo simplemente avanza.
      - **El cerrojo del doble envío es un `useRef`, no el estado `guardando`.** El estado tarda un render en aplicarse, así que dos toques seguidos en el móvil colaban dos peticiones antes de que el botón se deshabilitara. Un ref se lee y se escribe en el mismo tick.
      - **El fin de contrato vive SOLO en el CUPS.** Se guardaba ahí y además como fecha crítica, en tres sitios distintos (alta, crear CUPS y editar CUPS). El mismo vencimiento salía dos veces en la Agenda y la copia se quedaba desfasada en cuanto alguien corregía el suministro. La Agenda ya lo calcula en vivo desde el CUPS, así que la copia solo podía estorbar. Había **86 fechas críticas** duplicando ese dato.
      - **Un campo vacío no puede romper un vínculo** (`VINCULOS_PROTEGIDOS` en `api/luz/[tabla]/route.ts`). `filtrarCampos` convierte `''` en `null`, así que un desplegable sin seleccionar dejaba el contrato sin `cups_id`: figuraba como «sin CUPS» y al activarlo el suministro no pasaba a activado, porque la sincronización lo busca por ese campo. Había **65 contratos** así. Borrar un vínculo tiene que pedirse a propósito, nunca ser el efecto de un campo en blanco.
      - El formulario de contrato de la ficha del cliente **no mandaba `cups_id` en absoluto**: ahora lleva selector de suministro y es obligatorio.
      - Cubierto por `npm run test:integridad`.
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
    - **Rendimiento del parte** (`src/lib/parte-rendimiento.ts`) — el parte contaba *qué* pasó; esto añade el **juicio**: si eso mueve el negocio o solo mueve la base de datos.
      - **No se cuentan acciones, se cuenta lo que habilitan.** Contar filas de auditoría premia teclear: una tarde rellenando cuarenta teléfonos son cuarenta acciones y cero euros más cerca; una visita que acaba con la factura en la mano es **una** acción y desbloquea toda la oferta. Cada acción se clasifica en `produce · prepara · mantiene · retrocede` y los retrocesos **restan**, porque si sumaran, perder clientes subiría la nota.
      - **La referencia son los 7 días anteriores del propio equipo**, no una cifra inventada. Los días sin actividad **se descartan** antes de promediar: si contaran, un puente hundiría la media y el jueves siguiente saldría «excelente» sin haber hecho nada distinto. Sin días con los que comparar **no se emite veredicto**, se dice que no lo hay.
      - **Probabilidad de cierre**: se parte del estado del embudo y se corrige con el expediente (sin consumo no se puede ofertar, sin teléfono no hay por dónde entrar, días parada). **Nunca se toca el número que puso una persona**: se enseñan los dos y la diferencia es justo la conversación que hay que tener. El suelo es **3 %, no 0**, porque aquí solo entran oportunidades abiertas y un 0 % se lee como «muerta» e invita a cerrarla — están atascadas, que se arregla desatascando.
      - **Trabajo pendiente de días anteriores**, ventana de 7 días. Solo entra lo que tiene fecha y ya pasó: una tarea sin fecha no está retrasada, está sin planificar, y mezclarlas hace la lista inservible. Lo de hoy no cuenta, que hoy aún se puede hacer. **Lo de hace más de 7 días no se lista pero se cuenta**: una lista que calla lo que lleva un mes parado tranquiliza, y eso es peor que no tenerla.
      - El desglose por persona **no sirve para comparar a David con Nicola** —hacen trabajos distintos y las unidades no son las mismas—, sino para ver si a alguien le está tocando solo mantenimiento. La pantalla lo dice.
      - **Todo esto va también en el PDF**, en este orden: veredicto del día en portada (con puntos y % útil), KPIs, reparto por persona, lo que quedó colgando, probabilidad de cierre, calidad del dato y luego las fichas. La calidad del dato bajó de la portada a justo antes de las fichas —habla de esos clientes— porque en portada le comía el sitio al veredicto, que es lo primero que hay que ver. La tabla vieja de «Quién ha hecho qué» **solo sale si no hay reparto por aporte**: con las dos, el informe decía dos veces lo mismo con columnas distintas.
      - Cubierto por `npm run test:rendimiento`.
  - `gestor/luz/fv/` — **Calculadora FV** (solo admin): presupuestador fotovoltaico. Lógica en `src/lib/fv.ts`, UI en `page.tsx` + `energia.tsx`. Dos flujos: "presupuesto de Óscar" (instalador) y "presupuestar desde consumos". Incluye escenarios, algoritmo de batería por amortización (`optimizarBateria`), simulación horaria 24h (`simularDiaFV`), comparador de equipos reales y oferta PDF. `hipotesis.pct_autoconsumo` es la **fuente única** del autoconsumo efectivo en toda la oferta.
  - `gestor/correbin/` — vencimientos de seguros.
  - `gestor/clientes-app/` — App Clientes.
  - `gestor/luz/control/` — panel "Control General" con auditoría (PIN 20082006).
- `src/app/cliente/` y `src/app/mobile/` — área de cliente y versión móvil/PWA.
- `src/app/api/` — route handlers (Supabase server-side, lectura de facturas con Claude vía `ANTHROPIC_API_KEY`, OAuth Google, endpoints de setup/migración).
- `src/lib/` — lógica de negocio: `fv.ts` (fotovoltaica), `luz.ts`, `correbin.ts`, `tarifas.ts`, `auth.ts`/`usuario.ts` (roles), `supabase.ts` (cliente), generadores de PDF/Excel.
- `src/components/` — componentes compartidos (web pública y gestor).

## Estilo: dos sistemas de titulares, a propósito

En `globals.css` los tamaños de titular **estaban sin `@layer`**, y una regla sin capa gana a cualquier utilidad de Tailwind pase lo que pase con la especificidad. Medido antes de arreglarlo: el título del gestor pedía `text-sm` (14 px) y se veía a **56 px, cortado a un quinto de su ancho**; «Agenda» pedía `text-xl` (20 px) y salía a 36. Había **141 titulares en el gestor con una clase de tamaño que no pintaba nada**, y **267 `<p>`/`<li>` con una clase de color que tampoco** (la regla `p, li { color: muted }` iba igual, sin capa).

Ahora hay dos sistemas y cada uno tiene su motivo:

- **La web pública** lleva la clase `web-publica` en su layout, y sus tamaños siguen fijos en CSS **sin capa**. Es un escaparate: interesa que todos los titulares midan lo mismo sin depender de que alguien acierte con la clase. Van con `clamp()`, así que bajan solos en móvil (antes el intento de bajarlos vivía en una media query que nunca ganaba, y un titular de 56 px se salía de una pantalla de 375).
- **El gestor** usa las utilidades de Tailwind. Es una herramienta densa donde cada pantalla necesita su jerarquía y manda quien escribe el JSX. Esto vale también **en móvil**: las reglas `h1`/`h2` que había en las media queries de 768 px se movieron a `@layer base` por lo mismo.

Los defaults de `@layer base` (titulares, `p`, `li`) son solo el valor por defecto: cualquier `text-*` los pisa. Orden de capas resultante: `properties → theme → base → components → utilities`, y sin capa por encima de todas.

**Al tocar estilos del gestor:** las clases `text-*` de tamaño y de color ya funcionan, no hace falta pelearse con el CSS. **Al tocar la web pública:** los tamaños de titular se cambian en `globals.css`, no en el JSX. **Aún quedan reglas sin capa** para `input`, `select`, `textarea` y `button` (fondo, borde, radio, tamaño de letra y el brillo del hover): ahí las clases de Tailwind **siguen sin pintar**, así que no escribirlas.

Y para las pantallas de calle hay `btnTactil` / `btnTactilPrimario` en el kit de UI: **44 px de alto mínimo**, que es lo cómodo para el pulgar. En la oficina da igual que un botón mida 30 px porque hay ratón; en la calle se falla y se acaba no usando la pantalla.

## Movimiento en la web pública

Todo el movimiento del escaparate vive en `globals.css`, en la sección «ESCAPARATE — SISTEMA DE MOVIMIENTO», con una sola curva de salida (`--salida`) para que todo frene igual. Piezas reutilizables:

- **`ScrollReveal`** (`src/components/scroll-reveal.tsx`) — revela al entrar en pantalla. Variantes `up` / `down` / `left` / `right` / `scale` / `blur` / `none`. El retardo va en la variable CSS `--sr-delay`, no con `setTimeout`. Si no hay `IntersectionObserver` o el sistema pide reducir movimiento, **muestra el contenido de entrada**: revelar con JavaScript sin plan B deja la página en blanco.
- **`.entra` / `.entra-dcha` / `.entra-escala`** — entrada al cargar, con `--d` como retardo. Para lo que **ya está en pantalla al abrir** (los heros): ahí no se usa `ScrollReveal`, porque esperar a que corra JavaScript para pintar la primera pantalla es lo peor que se puede hacer.
- **`.foco`** — brillo que sigue al ratón. Lo enciende `FocoPuntero`, montado una sola vez en el layout con un escuchador delegado (no uno por tarjeta). El degradado va en un `::after` propio para no pisar el `bg-*` del JSX.
- **`.corriente`**, **`.enlace-vivo`**, **`.borde-vivo`**, **`.baja-la-vista`**, **`.linea-titular`**, **`.cifra`** — separador con pulso de luz, subrayado que crece, borde que se enciende, aviso de que hay más abajo, máscara por línea del titular y cifras tabulares.

**El bloque `prefers-reduced-motion` va al final del archivo y sin capa, para ganar a todo.** El sitio tenía quince animaciones en bucle y ni una línea que atendiera a quien pide no ver movimiento. Al añadir cualquier animación nueva, comprobar que ahí queda apagada **y que lo que dependa de ella siga visible**.

El fondo de puntos (`Background3D`) es un lienzo **transparente**: el degradado de marca lo pone el `body`, en un solo sitio. No volver a pintar el fondo dentro del canvas.

## Usuarios y permisos

Login por Supabase Auth. Roles: `admin` / `estándar` / `lectura`, con módulos asignados por usuario y RLS activado en BD. Equipo real: Marcos (admin), Nicola (administración), David (comercial de calle). Hay reparto automático de tareas por rol. El antiguo "acceso maestro" se eliminó — no reintroducirlo.

## Variables de entorno

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` (lectura de facturas), `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` (OAuth Google), `DATADIS_USER` / `DATADIS_PASSWORD` (consumo real; opcionales `DATADIS_BASE` y `DATADIS_TIMEOUT_MS`). Configuradas en Vercel y `.env.local`.
