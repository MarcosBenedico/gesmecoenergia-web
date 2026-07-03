# 🚀 Inicio Rápido - App Móvil Gesmeco

## ✅ ¿Ya está lista?

Sí. La app móvil está **completamente funcional y lista para usar**.

## 📱 URLs de acceso

### Desarrollo (local)
```
http://localhost:3000/mobile
```

### Producción (Vercel - ya desplegado)
```
https://gesmecoenergia.vercel.app/mobile
```

## 🎯 Lo que tu app móvil hace

1. **Escanear facturas** → La IA lee automáticamente todos los datos
2. **Introducir manualmente** → Formulario guiado si prefieres
3. **Calcular ahorro** → Compara contra todas las comercializadoras
4. **Guardar análisis** → Todo en la misma DB Supabase que tu web
5. **Ver histórico** → Acceso a todos los análisis previos

## 🏃 Primeros pasos

### 1. Abre la app en tu móvil
```
https://gesmecoenergia.vercel.app/mobile
```

### 2. Instálala como app nativa (opcional)
- **iOS**: 
  1. Toca el botón de compartir (↗️)
  2. Selecciona "Añadir a pantalla de inicio"
  
- **Android**: 
  1. Toca el menú (⋯)
  2. Selecciona "Instalar aplicación"

### 3. Prueba las funciones
- **Escanear**: Toca el botón 📱 y captura una factura
- **Manual**: Toca el botón 🧮 e introduce datos
- **Histórico**: Toca el icono 📊 para ver análisis

## 🛠️ Características técnicas

### Backend reutilizado
- ✅ `/api/leer-factura` - IA con Claude Vision
- ✅ `/api/notificar-analisis` - Notificación por email
- ✅ Base de datos Supabase (tabla `analisis`)
- ✅ Lógica de cálculo de tarifas 100% igual a la web

### Frontend optimizado para móvil
- ✅ Interfaz touch-friendly
- ✅ Viewport configuration
- ✅ Cámara nativa del dispositivo
- ✅ Instalable como PWA

### APIs de navegador utilizadas
- 📷 `getUserMedia` - Acceso a cámara
- 💾 `File API` - Lectura de archivos
- 🔄 `Fetch API` - Comunicación con servidor
- 💾 `LocalStorage` - Datos en caché (opcional)

## 📊 Base de datos

Todos los análisis se guardan en la tabla `analisis` de Supabase:

```sql
SELECT 
  nombre, 
  fecha, 
  tarifa, 
  coste_actual, 
  ahorro_total,
  consumo_anual
FROM analisis
WHERE fecha > NOW() - INTERVAL 30 DAY
ORDER BY fecha DESC;
```

## 💡 Ejemplos de uso

### Caso 1: Cliente quiere escanear su factura
1. Abre `/mobile`
2. Toca "Escanear factura"
3. Concede permisos de cámara
4. Captura la factura
5. La IA extrae:
   - Tarifa (2.0, 3.0, 6.1)
   - Consumos por periodo
   - Precios de energía y potencia
6. Revisa los datos (puede editar si hay error)
7. Toca "Analizar"
8. Ve el ahorro potencial

### Caso 2: Cliente introduce datos manualmente
1. Abre `/mobile`
2. Toca "Introducir manualmente"
3. Selecciona su tarifa
4. Rellena consumos en kWh/mes
5. Rellena potencias en kW
6. Rellena precios en €
7. Toca "Analizar"
8. Ve comparativa de comercializadoras

### Caso 3: Cliente quiere ver sus análisis
1. Abre `/mobile`
2. Toca el icono 📊 (arriba a la derecha)
3. Ve lista de análisis previos ordenados por fecha
4. Cada análisis muestra:
   - Nombre/cliente
   - Tarifa contratada
   - Ahorro estimado
   - Fecha del análisis

## 🔒 Privacidad y seguridad

- ✅ Datos guardados en Supabase (HTTPS)
- ✅ Teléfono y nombre son opcionales
- ✅ Notificaciones internas solo para ti (email)
- ✅ No se vende ni se comparte información
- ✅ PWA offline (datos locales del dispositivo)

## 📈 Monitoreo y análisis

Desde tu dashboard de Supabase puedes ver:
- Total de análisis realizados en mobile vs web
- Promedio de ahorro mostrado
- Tarifas más comunes
- Consumo promedio por cliente
- Tendencias de uso

```sql
-- Análisis últimos 7 días
SELECT 
  DATE(fecha) as día,
  COUNT(*) as análisis,
  AVG(coste_actual) as gasto_promedio,
  AVG(ahorro_total) as ahorro_promedio
FROM analisis
WHERE fecha > NOW() - INTERVAL 7 DAY
GROUP BY DATE(fecha)
ORDER BY día DESC;
```

## 🆘 Si algo no funciona

### "La cámara no funciona"
- ✅ Verifica que estés en HTTPS (no HTTP)
- ✅ Concede permisos de cámara en el móvil
- ✅ Prueba en navegador diferente
- ✅ Como alternativa, sube una foto

### "El escaneo no lee bien"
- ✅ Asegúrate de que la foto sea nítida
- ✅ Centra bien los datos de consumo
- ✅ Prueba con otra factura diferente
- ✅ Usa el formulario manual como alternativa

### "No se guardan los análisis"
- ✅ Verifica conexión a internet
- ✅ Comprueba que la tabla `analisis` existe en Supabase
- ✅ Verifica RLS policies en Supabase (deben permitir INSERT)

## 🚀 Siguientes mejoras (opcionales)

```
[ ] Autenticación: Asociar análisis a usuarios
[ ] Gráficos: Evolución de consumo
[ ] PDF: Descargar análisis como PDF
[ ] Push notifications: Alertas de mejores tarifas
[ ] Dark mode: Tema nocturno
[ ] Sincronización: Cargar varios ficheros Excel
[ ] Compartir: Enviar resultados por WhatsApp
[ ] Offline mode: Funcionar sin internet
```

## 📱 Instalación en app stores (futuro)

Si quieres publicar en Google Play y Apple App Store:
1. Usa Capacitor para empaquetar
2. Genera certificados de firma
3. Sube a las tiendas

Para ahora, la PWA es suficiente y funciona como app nativa.

## 💰 Costes

- ✅ **Hosting**: Incluido en Vercel (tu plan actual)
- ✅ **BD**: Incluido en Supabase (tu plan actual)
- ✅ **IA**: €0.003-0.01 por escaneo (reutiliza tu API key)
- ✅ **Email**: Incluido en tu sistema de notificaciones

**Total coste incremental: $0** ✨

---

## 🎉 ¡Listo!

Tu app móvil está **100% funcional** y disponible en:
- 📱 **Desarrollo**: http://localhost:3000/mobile
- 🌐 **Producción**: https://gesmecoenergia.vercel.app/mobile

**Ahora puedes compartir esta URL con tus clientes.**
