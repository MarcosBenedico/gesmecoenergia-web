# Montador — varios vídeos → un clip

Prototipo **local**. Le pasas varios archivos, busca los momentos que destacan y
los pega en un clip único, en vertical listo para TikTok/Reels/Shorts.

No tiene nada que ver con la web de Gesmeco: vive aparte, no se despliega y no
forma parte del build de Next.js.

## Qué hace falta

Solo **ffmpeg** (trae `ffprobe` dentro) y Node 18+.

```bash
# macOS
brew install ffmpeg
# Windows
winget install Gyan.FFmpeg
# Ubuntu / Debian
sudo apt install ffmpeg
```

Comprueba que está: `ffmpeg -version`

## Probarlo sin tener vídeos

```bash
node demo.mjs
```

Se fabrica tres vídeos de prueba (con resoluciones y fps distintos, como
salen de móviles distintos), los monta y deja el resultado en `demo/`. Sirve
para confirmar que ffmpeg está bien instalado antes de meter material de
verdad. Los vídeos son rectángulos de colores con pitidos: **no valen para
juzgar si el criterio acierta**, solo para ver que la cadena funciona.

## Cómo se usa

```bash
cd prototipos/montador

# Lo normal
node montar.mjs resultado.mp4 clip1.mp4 clip2.mp4 clip3.mov

# Toda una carpeta, clip de 30 segundos
node montar.mjs resultado.mp4 ~/Videos/*.mp4 --duracion 30

# Ver qué elegiría SIN montar nada (rápido, para tantear)
node montar.mjs resultado.mp4 *.mp4 --dry
```

| Opción | Qué hace |
|---|---|
| `--duracion N` | Segundos del clip final. Por defecto 45. |
| `--formato F` | `vertical` (por defecto), `cuadrado` u `horizontal`. |
| `--listón N` | De 0 a 1, cuánto hay que destacar para entrar. Por defecto 0.45. Baja a 0.3 si sale poca cosa. |
| `--dry` | Analiza y enseña el plan, sin montar. |

Empieza siempre con `--dry`: tarda segundos y te dice si va a acertar antes de
ponerte a codificar.

## Cómo decide qué es un «momento bueno»

**Por el sonido.** En vídeo de gente, lo interesante casi siempre suena: alguien
habla, alguien se ríe, algo golpea. Los silencios son el relleno.

Medir la imagen suena más listo pero engaña: una cámara en mano temblando
puntúa altísimo y no está pasando nada.

Cuatro detalles que son los que hacen que el resultado se pueda ver:

1. **El volumen se mide en decibelios, no en lineal.** Un golpe al micro es 40
   veces la voz en escala lineal, y al normalizar dejaría toda la conversación
   pegada al cero — o sea, «aquí no pasa nada». En dB son unos 30 por encima y
   la escala lo absorbe.
2. **Cada archivo se normaliza contra sí mismo.** Lo que cuenta es «alto para
   ESE vídeo». Si no, el grabado más bajito se quedaría entero fuera aunque
   tenga los mejores momentos.
3. **Ningún archivo copa el clip, y ninguno se queda fuera.** Hay cupo máximo
   por archivo y reserva del mejor momento de cada uno. Hacen falta las dos
   cosas: una impide que uno acapare, la otra que otro desaparezca.
4. **El montaje va en orden cronológico, no por puntuación.** Ordenar por lo
   bueno que es cada trozo rompe cualquier continuidad.

Los cortes llevan **algo de aire** por delante y por detrás (0,4 s y 0,25 s).
Sin eso entran con la frase empezada y salen con la última sílaba comida, que
es lo que hace que un montaje automático suene a robot.

## Lo que NO hace

Dicho claro, para que nadie se lleve una sorpresa:

- **No pone subtítulos.** Es lo siguiente que yo añadiría: es el efecto que más
  se asocia con TikTok y el que más rinde por trabajo invertido.
- **No entiende lo que se dice.** Elige por cómo suena, no por el contenido. Un
  minuto de alguien hablando muy alto sin decir nada puntúa igual que la mejor
  frase del vídeo. El salto de calidad de verdad es transcribir y dejar que un
  modelo elija por significado — ahí ya no es «lo que suena» sino «lo que
  interesa».
- **No sigue caras al recortar en vertical.** El recorte es por el centro, así
  que si quien habla está a un lado del plano se le puede cortar. Con
  `--formato horizontal` no se recorta nada.
- **No baja vídeos de YouTube.** Habría que añadir `yt-dlp` delante.
- **No tiene interfaz web.** Es línea de comandos a propósito: primero hay que
  ver si el criterio acierta con material real. Montar la web es la parte fácil
  y la que menos dudas tiene.

## Tests

```bash
node test-seleccion.mjs
```

29 comprobaciones del criterio de selección. Corren con energías inventadas a
mano y **sin necesitar ningún vídeo**: lo que se comprueba es el criterio, y un
test que necesite un archivo de 200 MB no lo ejecuta nadie.

## Rendimiento

El análisis es rápido (se lee el audio a 8 kHz, unos segundos por vídeo). Lo que
cuesta es recodificar: **tres vídeos de 20 s → clip de 16 s en unos 11 s** en
esta máquina. Con material real de minutos, cuenta en minutos.

Por eso esto **no puede correr en Vercel**: sus funciones se cortan a los 60 s
(300 s como mucho en Pro). Si algún día se convierte en web, la página va en
Vercel y esto tiene que correr en un trabajador aparte.
