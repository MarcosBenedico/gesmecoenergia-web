# Correbin · Área de cliente (Volumen IX) — diseño previo

El Volumen IX es explícito en dos cosas: es **fase posterior y separada**, y
**antes de programar hay que presentar** modelo de amenazas, roles, permisos,
modelo de datos, autenticación y almacenamiento.

Este documento es esa presentación. **No se ha escrito ni una línea de código
del área de cliente**, y no debería escribirse hasta que esto se apruebe.

---

## 1. Por qué no se ha implementado ya

Un área privada de seguros guarda pólizas, recibos, partes de siniestro y datos
de plantilla: es el material más sensible que maneja una correduría. Montarla
deprisa, aprovechando el panel interno que ya existe, tendría tres problemas
graves:

1. **Aislamiento**: el panel actual está pensado para que el equipo vea *toda*
   la cartera. Un cliente solo puede ver lo suyo, y eso exige aislamiento por
   organización comprobado en cada consulta, no confiado a la interfaz.
2. **Documentos**: hoy no hay almacenamiento con URLs firmadas temporales. Un
   enlace público permanente a una póliza es una fuga esperando a ocurrir.
3. **Trazabilidad**: hace falta registro de accesos, cambios y exportaciones,
   que ahora mismo no cubre este caso.

---

## 2. Modelo de amenazas (resumen)

| Amenaza | Mitigación prevista |
|---|---|
| Un cliente accede a datos de otro | Aislamiento por `organizacion_id` aplicado en base de datos (RLS), no en la interfaz |
| Enlace a documento reenviado o filtrado | URLs firmadas con caducidad corta; sin rutas públicas permanentes |
| Credenciales comprometidas | MFA obligatorio para internos y para el rol administrador de cliente |
| Subida de archivo malicioso | Lista blanca de formatos, límite de tamaño y análisis antivirus si hay infraestructura |
| Abuso del formulario o fuerza bruta | Rate limiting y bloqueo temporal por intentos |
| Un movimiento se da por hecho sin estarlo | Los estados no figuran como efectivos hasta confirmación de la compañía |
| Fuga por copia de seguridad | Backups cifrados y prueba de restauración documentada |

---

## 3. Roles y permisos

| Rol | Qué puede hacer |
|---|---|
| Cliente administrador | Gestiona usuarios de su organización, ve todas sus pólizas y aprueba solicitudes |
| Cliente operativo | Consulta y presenta solicitudes de lo que tenga asignado |
| Solo lectura | Consulta, sin cambios |
| Técnico Correbin | Riesgos, documentos y solicitudes |
| Administración | Pólizas, recibos, certificados y vencimientos |
| Siniestros | Expedientes y comunicaciones |
| Superadministrador | Configuración y auditoría restringida |

Regla base: **un usuario solo accede a su organización**, y eso se comprueba en
cada consulta a la base de datos.

---

## 4. Modelo de datos

| Entidad | Función |
|---|---|
| `organizacion` | Cliente o grupo empresarial |
| `usuario` / `rol` | Identidad y permisos |
| `poliza` / `poliza_version` | Póliza y su histórico de versiones |
| `objeto_riesgo` | Vehículo, ubicación, sociedad o activo |
| `documento` | Archivo, clasificación y permisos |
| `solicitud` | Movimiento, certificado o consulta, con referencia y estado |
| `siniestro` / `siniestro_evento` | Expediente y su cronología |
| `renovacion` / `tarea` | Vencimientos y trabajo asociado |
| `consentimiento` / `registro_auditoria` | Trazabilidad y cumplimiento |

Buena parte de esto ya existe en el panel interno (`vct_clientes`, `vct_polizas`,
`vct_vencimientos`), lo que ahorra trabajo: el área de cliente sería una **vista
restringida** sobre esos datos, nunca una copia paralela.

---

## 5. Alcance del MVP

- Acceso con contraseña y MFA.
- Panel con pólizas, vencimientos, tareas y siniestros.
- Detalle de póliza, con el aviso de que **prevalece el contrato** sobre lo que
  muestre la pantalla.
- Repositorio documental privado y versionado.
- Solicitudes con referencia, estado y responsable.
- Siniestros con cronología y adjuntos.
- Notificaciones que **no** incluyan datos sensibles en el propio aviso.

Fuera del MVP: flota y renovaciones automatizadas (fase 2), integraciones e
informes (fase 3), IA (fase 4, y solo tras gobierno de datos).

---

## 6. Criterios de aceptación

- Un usuario solo accede a los datos de su organización — comprobado con pruebas
  de acceso cruzado, no solo revisando la interfaz.
- Toda solicitud tiene referencia y estado visibles.
- Ningún documento usa una URL pública permanente.
- Ningún movimiento figura como efectivo antes de la confirmación.

---

## 7. Qué hace falta para empezar

1. Decisión sobre **qué se abre primero** (lo más pedido suele ser certificados
   y consulta de pólizas).
2. Confirmación de que la documentación puede vivir en Supabase Storage con
   bucket privado, o si se prefiere otra infraestructura.
3. Política de **retención**: cuánto tiempo se guarda cada tipo de documento.
4. Quién de Correbin valida los estados que ve el cliente, para que no aparezca
   como «tramitado» algo que la compañía aún no ha confirmado.
