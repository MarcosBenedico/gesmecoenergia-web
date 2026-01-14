# Gesmeco Energía · Web corporativa (Next.js + TypeScript + TailwindCSS)

Proyecto premium con App Router, diseño enterprise, tipografía Inter y tema corporativo basado en variables CSS y Tailwind v4 (postcss).

## Comando de creación

Se generó el proyecto con el comando solicitado:

```bash
npx create-next-app@latest gesmecoenergia-web --ts --app --eslint --tailwind --src-dir --import-alias "@/*"
```

## Arranque local

1) Requisitos: Node.js 18+ y npm.
2) Instala dependencias (si no están instaladas):
```bash
npm install
```
3) Ejecuta en desarrollo:
```bash
npm run dev
```
4) Abre `http://localhost:3000`.

Scripts útiles:
- `npm run lint` · Linter ESLint con configuración Next.
- `npm run build` · Build de producción.
- `npm run start` · Sirve el build (`npm run build` previo).

## Despliegue en Vercel

Opción recomendada: conectar el repositorio en https://vercel.com, seleccionar el proyecto y desplegar. Vercel detecta Next.js (App Router) y aplica los defaults.

Despliegue por CLI:
```bash
npm install -g vercel
vercel          # primer deploy (elige el scope y confirma)
vercel --prod   # para promocionar a producción
```
No se requieren variables de entorno para arrancar.

## Actualizar con git

```bash
git status
git add .
git commit -m "Mensaje descriptivo"
git push origin main
```
Adapta la rama remota si usas otra distinta a `main`.

## Logo

El logo es un placeholder en `public/logo.svg`. Sustitúyelo por tu archivo final manteniendo el mismo nombre para que las referencias funcionen sin cambios.
