# Correbin · Informe de entrega (Volumen X)

Estado de la microsede de seguros de Correbin Asociados dentro de
gesmecoenergia.com. El Volumen X pide una lista de comprobación *verificable*,
no una afirmación de que «todo está listo»: aquí cada línea dice cómo se ha
comprobado y qué falta.

Última actualización: julio de 2026.

---

## 1. Qué se ha implementado

**Fase 1 completa** (el propio Volumen X la define): home de seguros, empresas,
gerencia de riesgos, sectores, soluciones, revisión, siniestros, particulares,
nosotros, contacto, legal y SEO técnico.

Además, adelantado de fase 2: las 11 fichas de sectores y soluciones con
contenido propio.

### Rutas publicadas (22)

| Ruta | Contenido |
|---|---|
| `/seguros` | Home. H1 y subtítulo literales del Volumen IV |
| `/seguros/empresas` | Programa asegurador completo, ocho frentes |
| `/seguros/gerencia-de-riesgos` | Método en 7 pasos + auditoría aseguradora (Vol. V) |
| `/seguros/sectores` | Índice sectorial |
| `/seguros/sectores/transporte-y-logistica` | Vol. VI |
| `/seguros/sectores/agroalimentario` | Vol. VI |
| `/seguros/sectores/agricultura-y-ganaderia` | Vol. VI |
| `/seguros/sectores/industria-comercio-y-servicios` | Vol. VI |
| `/seguros/sectores/administraciones-y-entidades` | Vol. VI |
| `/seguros/soluciones` | Índice por riesgo |
| `/seguros/soluciones/multirriesgo-empresarial` | Vol. VII |
| `/seguros/soluciones/responsabilidad-civil` | Vol. VII |
| `/seguros/soluciones/flotas` | Vol. VII |
| `/seguros/soluciones/transporte-de-mercancias` | Vol. VII |
| `/seguros/soluciones/personas-y-convenio` | Vol. VII |
| `/seguros/soluciones/ciber-directivos-y-credito` | Vol. VII |
| `/seguros/revision-de-polizas` | Landing de captación + formulario |
| `/seguros/siniestros` | Ruta prioritaria + formulario |
| `/seguros/particulares` | Oferta personal |
| `/seguros/nosotros` | Quiénes somos |
| `/seguros/contacto` | Consulta general |
| `/seguros/informacion-legal` | Datos identificativos |

`/correbin` redirige a `/seguros` (la microsede estuvo un día en esa ruta).

### Archivos principales

**Creados**
- `src/lib/correbin-marca.ts` — fuente única: datos corporativos, posicionamiento,
  método, mensajes aprobados y prohibidos, copy de cada página, paleta.
- `src/lib/correbin-catalogo.ts` — 5 sectores y 6 soluciones con contenido propio.
- `src/lib/correbin-medicion.ts` — eventos de analítica y atribución, sin PII.
- `src/app/seguros/` — layout, ui.tsx, ficha.tsx, formulario.tsx, not-found.tsx
  y las 22 páginas.
- `src/app/api/seguros/solicitudes/route.ts` — recepción de formularios.
- `src/app/sitemap.ts`, `src/app/robots.ts`.
- `supabase_correbin_solicitudes.sql` — tabla de solicitudes.

**Modificados**
- `src/app/(site)/privacidad/page.tsx` — sustituido el texto placeholder.
- `src/lib/site.ts`, `src/components/footer.tsx`,
  `src/app/(site)/grupo/page.tsx`, `src/components/grupo-empresas-3d.tsx` —
  enlaces a `/seguros` y corrección del mensaje «Bien cubierto, sin pagar de más».

---

## 2. Comprobaciones ejecutadas

| Comprobación | Resultado | Cómo se ha verificado |
|---|---|---|
| Build de producción | ✅ correcto | `npm run build` — 134 páginas generadas |
| Tipos | ✅ sin errores | `npx tsc --noEmit` |
| Lint | ✅ sin errores ni avisos | `npx eslint` sobre `src/app/seguros` y `src/lib` |
| Mensajes prohibidos (Vol. I) | ✅ ninguno | búsqueda de los seis literales en todo `src/` |
| Clave de mediación | ✅ no aparece | búsqueda en todo `src/app` |
| Correo, dirección y horario | ✅ no publicados | marcados como pendientes, nunca inventados |
| Schema sin datos inventados | ✅ | solo `InsuranceAgency`, `Service`, `BreadcrumbList`; sin `AggregateRating` ni reseñas |
| Regresiones en energía | ✅ ninguna | el módulo de energía y el panel no se han tocado |
| Un H1 por página | ✅ | una única etiqueta `h1` por ruta |
| Metadatos únicos | ✅ | `title` y `description` propios por página, con canonical |

### Pendiente de comprobar en dispositivo real
- **Responsive**: el diseño usa rejillas fluidas y está previsto para móvil
  (barra fija inferior, menú desplazable), pero no se ha probado en un teléfono
  físico.
- **Accesibilidad**: se han aplicado los criterios (etiquetas reales asociadas,
  `role="alert"` en errores, contraste alto, foco por teclado, sin depender del
  color). No se ha pasado un validador automático ni un lector de pantalla.
- **Rendimiento (Core Web Vitals)**: no medido; la microsede es estática y sin
  imágenes pesadas, así que el punto de partida es bueno.

---

## 3. Bloqueos y datos pendientes

Nada de esto se ha inventado. Son decisiones que corresponden a Correbin.

| Pendiente | Efecto mientras no esté | Quién |
|---|---|---|
| **Logotipo original** | La cabecera usa el nombre en tipografía. El Vol. II prohíbe redibujarlo | Correbin |
| **Correo corporativo de seguros** | No se publica ninguno | Correbin |
| **Domicilio social y postal** | No se publica | Correbin |
| **Horario de atención** | No se publica | Correbin |
| **Responsable de privacidad** | La política lo marca como pendiente | Correbin |
| **Servicio de atención al cliente y reclamaciones** | Falta en información legal | Correbin |
| **Organismo supervisor y redacción legal** | Información legal incompleta | Asesor competente |
| **Fotografía real** (empresa, nave, equipo, territorio) | Microsede solo tipográfica | Correbin |
| **Revisión legal de la política de privacidad** | Publicada, pero marcada como sujeta a revisión | Asesor competente |
| **Ejecutar `supabase_correbin_solicitudes.sql`** | Los formularios avisan y ofrecen teléfono en vez de guardar | Marcos |

---

## 4. Seguridad de los formularios (Vol. X)

| Control | Estado |
|---|---|
| Validación en servidor | ✅ tipo, consentimiento, nombre y teléfono obligatorios; campos no declarados se descartan |
| Validación en cliente | ✅ campos requeridos y consentimiento |
| Rate limiting | ✅ 5 envíos por IP cada 10 minutos |
| Cifrado en tránsito | ✅ HTTPS (Vercel) |
| Acceso restringido | ✅ RLS: cualquiera puede insertar, solo el panel autenticado puede leer |
| Registro de consentimiento | ✅ obligatorio para enviar; sin él la API rechaza |
| Aviso sobre datos de salud | ✅ visible en el formulario de siniestros |
| Sin secretos expuestos | ✅ solo se usa la clave anónima, que es pública por diseño |
| **Adjuntos** | ⛔ **no implementados** — ver abajo |
| CAPTCHA no intrusivo | ⛔ no implementado; el rate limiting cubre el caso básico |
| Antivirus de adjuntos | ⛔ no aplica todavía |

### Por qué no hay subida de archivos

El Volumen III pide adjuntar pólizas, recibos y relaciones de flota. El Volumen X
advierte de que **no debe hacerse como un envío inseguro**, y exige límites de
formato, antivirus si hay infraestructura, URLs firmadas y retención definida.

Montar eso a medias sería peor que no tenerlo: documentación empresarial
sensible en un buzón sin control de acceso ni caducidad. De momento el
formulario invita a indicarlo en el mensaje y se acuerda el canal. Cuando se
aborde, el camino técnico correcto es un bucket privado de Supabase Storage con
URLs firmadas temporales, límite de tipo y tamaño, y política de retención
escrita.

---

## 5. Medición (Vol. VIII y XI)

Nombres de evento estables, ya definidos en `src/lib/correbin-medicion.ts`:

`correbin_clic_telefono` · `correbin_clic_whatsapp` · `correbin_envio_revision` ·
`correbin_envio_siniestro` · `correbin_envio_contacto` · `correbin_inicio_siniestro` ·
`correbin_seleccion_sector` · `correbin_clic_desde_grupo`

- **Sin PII**: la función de medición descarta cualquier propiedad cuyo nombre
  contenga nombre, teléfono, correo, NIF, dirección o póliza. Solo viajan tipo
  de acción, origen, campaña y sector.
- **Atribución**: cada solicitud guarda `origen` (UTM o referente) y `campana`.
- **No hay herramienta de analítica instalada todavía**: los eventos se emiten
  solo si existe `gtag` o `dataLayer`. Cuando se instale, debe cargarse **tras**
  el consentimiento, con banner de cookies válido.

---

## 6. Reversión

Cada fase está en un commit propio. Para revertir la microsede completa sin
tocar energía:

```bash
git revert <hash-del-commit>   # o los commits de Correbin, en orden inverso
```

Los cambios en el módulo de energía se limitan a cuatro enlaces y un mensaje de
marca; la funcionalidad no se ha modificado.

---

## 7. Siguiente fase

Pendientes de los volúmenes ya leídos:

- **Casos de trabajo anonimizados** (Vol. XI): la plantilla está definida, pero
  el volumen prohíbe resultados inventados. Hacen falta casos reales aportados
  por Correbin para redactarlos.
- **Lead magnets** (checklist de renovación, inventario de pólizas, guía de
  documentación tras un siniestro): contenido técnico propio, se puede redactar
  cuando se decida el formato.
- **Blog y recursos** (Vol. VIII): nueve artículos prioritarios definidos.
- **Área de cliente** (Vol. IX): fase posterior y separada. Ver
  `CORREBIN_AREA_CLIENTE.md`.
- **Volumen XII** (manual corporativo): no entregado todavía.

---

## 8. Volumen XII · Procesos internos

El manual corporativo exige que **cada solicitud tenga responsable, estado y
siguiente paso**, y que la web solo comunique capacidades operativas reales.

### Bandeja de solicitudes

Los formularios ya no son un buzón ciego: `/gestor/correbin/solicitudes` es la
bandeja donde entra todo lo de `/seguros`.

- Estados alineados con el proceso real del volumen: nueva → clasificada →
  en análisis → propuesta enviada → cerrada ganada / perdida.
- Cada solicitud tiene **responsable**, **siguiente paso** y **fecha** del
  siguiente paso.
- Contadores arriba: sin clasificar, siniestros abiertos y marcadas urgentes.
- Lo que escribió el cliente **no se puede editar**: es la fuente. Solo se
  tocan los campos de gestión interna.
- Notas internas separadas, que el cliente nunca ve.

### Lo que la web NO promete (comprobado)

- Ningún plazo de respuesta ni SLA: la confirmación dice «nos ponemos en
  contacto contigo lo antes posible», sin comprometer horas ni días.
- Ninguna capacidad operativa no aprobada: no se menciona portal de cliente,
  ni tramitación en línea, ni consulta de expedientes, porque todavía no
  existen.
- La página de siniestros deja escrito que no se puede prometer cobertura ni
  indemnización, solo gestión, seguimiento, explicación y defensa.

### Pendiente de este volumen

- **Correo de confirmación** al enviar una solicitud: el volumen lo pide
  «cuando la infraestructura lo permita». Hace falta el correo corporativo
  confirmado y un servicio de envío. La referencia interna ya se genera.
- **Calendario de renovaciones** 120-90-60-30-15 días: el panel ya avisa a
  120, 60, 30 y 15. Falta el hito de 90 días para cuentas complejas.
- **Gobierno documental** (borrador / enviado / aceptado / emitido, sin
  sobrescribir contractuales): es proceso interno; se abordará con el área
  documental.
