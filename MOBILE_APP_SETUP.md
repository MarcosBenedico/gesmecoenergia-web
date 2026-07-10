# App Móvil Gesmeco Energía

## 📱 Descripción

La app móvil Gesmeco Energía permite a tus clientes:
- **Escanear facturas** directamente desde la cámara del móvil (IA automática)
- **Introducir datos manualmente** con formulario guiado
- **Ver análisis de consumos** y ahorros potenciales
- **Acceso offline** a datos previamente analizados
- **Instalable como app** nativa en iOS y Android

## 🚀 Acceso

### Opción 1: Desde el navegador móvil (inmediato)
```
https://tudominio.com/mobile
```

### Opción 2: Instalar como app (PWA)
1. Abre en navegador móvil: `https://tudominio.com/mobile`
2. Toca el menú (⋯) o compartir (↗️)
3. Selecciona "Instalar app" o "Add to Home Screen"
4. La app aparecerá en tu pantalla de inicio

## 🎯 Características principales

### 1. Escaneo de facturas (IA)
- Abre la cámara del móvil
- Centra la factura en el cuadro
- La IA lee automáticamente:
  - Tarifa de acceso
  - Consumos por periodo
  - Precios de energía y potencia
  - Nombre del cliente (opcional)

### 2. Análisis de tarifas
- Compara con todas las comercializadoras
- Calcula ahorro potencial anual
- Muestra rango de 20%-30% de ahorro
- Desglose por periodo (punta, llano, valle)

### 3. Histórico de consumos
- Guarda automáticamente cada análisis en Supabase
- Ve todos tus análisis previos
- Visualiza tendencias de consumo y gasto

## 📊 Base de datos

Todos los análisis se guardan en **Supabase** en la tabla `analisis`:
- `nombre`: Cliente (o "App Móvil" si no lo proporciona)
- `telefono`: Contacto opcional
- `tarifa`: 2.0, 3.0 o 6.1
- `coste_actual`: Coste anual actual
- `coste_energia`: Desglose de energía
- `coste_potencia`: Desglose de potencia
- `ahorro_total`: Rango máximo de ahorro anual
- `reduccion_porcentaje`: Porcentaje de ahorro
- `consumo_anual`: kWh consumidos al año
- `datos_json`: Detalles completos del análisis
- `fecha`: Timestamp del análisis

## 🛠️ Configuración técnica

### 1. Manifest PWA
El archivo `/public/manifest.json` configura:
- Nombre y descripción de la app
- Iconos (192x192 y 512x512)
- Color tema (indigo/accent)
- Shortcuts para acciones rápidas

### 2. Rutas de la app
```
/mobile                    # Dashboard principal
/mobile/analizador        # Analizador (interno, redirige desde /mobile)
/mobile/consumos          # Histórico de análisis
/api/leer-factura         # IA para OCR de facturas (reutilizado)
/api/notificar-analisis   # Notificación por email (reutilizado)
```

### 3. APIs utilizadas
- **Claude Vision** (`/api/leer-factura`): Lee facturas con IA
- **Supabase**: Almacena y recupera análisis
- **Browser APIs**: Acceso a cámara (getUserMedia)

## 💡 Optimizaciones para móvil

- ✅ Interfaz touch-optimizada (botones grandes)
- ✅ Formulario responsive con grid adaptivo
- ✅ Viewport configurado para apps nativas
- ✅ Sin scroll innecesario (vh units)
- ✅ Captura de cámara nativa del dispositivo
- ✅ Colores legibles en sol directo

## 📝 Uso desde el lado del cliente

### Para escanear una factura:
1. Abre `/mobile` en el móvil
2. Toca "Escanear factura"
3. Concede permisos de cámara
4. Centra la factura y captura
5. Revisa los datos extraídos
6. Confirma para ver el análisis

### Para introducir manualmente:
1. Abre `/mobile` en el móvil
2. Toca "Introducir manualmente"
3. Rellena tarifa y consumos
4. Toca "Analizar"
5. Ve el resultado y ahorro potencial

### Para ver consumos previos:
1. Desde `/mobile` toca el icono 📊 arriba a la derecha
2. Ve todos tus análisis guardados
3. Ordena por fecha o ahorro

## 🔒 Consideraciones de privacidad

- Los datos se guardan en Supabase (misma DB que web)
- El teléfono es opcional
- Se envía una notificación interna (email) por cada análisis
- Puedes controlar qué datos se guardan

## 🚀 Despliegue

La app está completamente integrada en tu proyecto Next.js:

```bash
# Desarrollo
npm run dev
# Accede a http://localhost:3000/mobile

# Producción
npm run build && npm start
# Se despliega automáticamente en Vercel
```

## 📊 Monitoreo

En tu dashboard de Supabase, puedes ver:
- Total de análisis realizados
- Consumo promedio por usuario
- Ahorro estimado total
- Distribución de tarifas

## 🆘 Troubleshooting

### La cámara no funciona
- Asegúrate de estar en HTTPS (no HTTP)
- Verifica permisos de cámara en el móvil
- Intenta recargar la página

### Los datos no se guardan
- Verifica conexión a Supabase
- Comprueba que la tabla `analisis` existe
- Revisa permisos RLS en Supabase

### El escaneo no lee bien la factura
- Asegúrate de que la foto sea nítida
- Centra bien los datos de consumo y precios
- Prueba con otra factura
- Como alternativa, introduce los datos manualmente

## 📈 Siguientes pasos opcionales

1. **Autenticación**: Añadir login para asociar análisis a usuarios
2. **Notificaciones push**: Alertas cuando haya mejores tarifas
3. **Exportar PDF**: Descargar análisis como documento
4. **Comparativa histórica**: Gráficos de evolución de consumo
5. **Sincronización**: Cargar datos desde fichero XLSX
6. **Dark mode**: Tema oscuro para la noche
7. **Offline mode**: Guardar análisis sin internet (via Service Worker)
8. **Share**: Compartir resultados vía WhatsApp/Email

---

**¡Tu app móvil está lista para usar!**
