#!/usr/bin/env node
/**
 * Checklist de humo — verifica en segundos que lo esencial sigue vivo.
 *
 *   npm run smoke                  → comprueba producción (www.gesmecoenergia.com)
 *   BASE=http://localhost:3000 npm run smoke   → comprueba local
 *
 * Sale con código 1 si algo falla (útil para CI o para revisar tras cada deploy).
 */

const BASE = (process.env.BASE || 'https://www.gesmecoenergia.com').replace(/\/$/, '');
const TIMEOUT = 15000;

const pedir = async (ruta, opciones = {}) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    return await fetch(BASE + ruta, { ...opciones, signal: ctrl.signal, redirect: 'manual' });
  } finally {
    clearTimeout(t);
  }
};

/** Cada check devuelve null si pasa, o el motivo del fallo. */
const CHECKS = [
  ['Home carga y lleva el hero nuevo', async () => {
    const r = await pedir('/');
    if (r.status !== 200) return `status ${r.status}`;
    const html = await r.text();
    if (!html.includes('hero-solar')) return 'falta la imagen del hero';
    return null;
  }],
  ['Páginas públicas clave (servicios, sectores, grupo, analizador)', async () => {
    const rutas = ['/servicios', '/sectores', '/grupo', '/analizador'];
    const res = await Promise.all(rutas.map((p) => pedir(p)));
    const mal = res.map((r, i) => (r.status !== 200 ? `${rutas[i]}:${r.status}` : null)).filter(Boolean);
    return mal.length ? mal.join(', ') : null;
  }],
  ['Login del gestor accesible', async () => {
    const r = await pedir('/gestor/login');
    return r.status === 200 ? null : `status ${r.status}`;
  }],
  ['SEGURIDAD · API Correbin no filtra datos sin sesión', async () => {
    const r = await pedir('/api/correbin/clientes');
    if (r.status !== 200) return null; // error también vale: no hay fuga
    const json = await r.json();
    const n = (json.datos || []).length;
    return n === 0 ? null : `¡devuelve ${n} clientes SIN LOGIN! Ejecuta supabase_rls_v2.sql`;
  }],
  ['SEGURIDAD · API Luz no filtra datos sin sesión', async () => {
    const r = await pedir('/api/luz/clientes');
    if (r.status !== 200) return null;
    const json = await r.json();
    const n = (json.datos || []).length;
    return n === 0 ? null : `¡devuelve ${n} clientes SIN LOGIN! Ejecuta supabase_rls_v2.sql`;
  }],
  ['SEGURIDAD · escritura sin sesión rechazada o sin efecto', async () => {
    const r = await pedir('/api/correbin/tareas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: '__smoke__', tipo_tarea: 'seguimiento' }),
    });
    if (r.status >= 400) return null; // rechazada: perfecto
    // Si "entró", limpiar y avisar
    const json = await r.json().catch(() => null);
    if (json?.dato?.id) {
      await pedir('/api/correbin/tareas', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: json.dato.id }),
      });
    }
    return '¡acepta escrituras SIN LOGIN! Ejecuta supabase_rls_v2.sql';
  }],
  ['Plantilla de importación se genera', async () => {
    const r = await pedir('/api/correbin/importar?tipo=vencimientos');
    if (r.status !== 200) return `status ${r.status}`;
    const tipo = r.headers.get('content-type') || '';
    return tipo.includes('spreadsheet') ? null : `content-type raro: ${tipo}`;
  }],
  ['Aviso legal y privacidad (RGPD)', async () => {
    const res = await Promise.all([pedir('/aviso-legal'), pedir('/privacidad')]);
    const mal = res.filter((r) => r.status !== 200).length;
    return mal ? `${mal} página(s) legales caídas` : null;
  }],
];

console.log(`\n🔎 Checklist de humo → ${BASE}\n`);
const inicio = Date.now();
const resultados = await Promise.all(
  CHECKS.map(async ([nombre, fn]) => {
    try {
      return [nombre, await fn()];
    } catch (e) {
      return [nombre, `error: ${e.message}`];
    }
  })
);

let fallos = 0;
for (const [nombre, motivo] of resultados) {
  if (motivo) { fallos++; console.log(`  ❌ ${nombre} — ${motivo}`); }
  else console.log(`  ✅ ${nombre}`);
}
console.log(`\n${fallos === 0 ? '✅ TODO OK' : `❌ ${fallos} fallo(s)`} · ${CHECKS.length} comprobaciones en ${((Date.now() - inicio) / 1000).toFixed(1)}s\n`);
process.exit(fallos === 0 ? 0 : 1);
