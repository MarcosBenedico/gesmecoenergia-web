'use client';

import { useEffect, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * FOTO DEL SITIO — la que David manda al grupo en cada visita.
 *
 * El bucket es privado, así que no se puede poner la ruta en un <img> y ya:
 * hay que pedir un enlace firmado, que caduca. Eso evita que la foto de la
 * nave de un cliente quede accesible con solo conocer la URL.
 *
 * Si el enlace falla (bucket sin crear todavía, permisos, red) no se enseña
 * nada roto: simplemente no aparece la foto.
 */

export const BUCKET_FOTOS = 'fotos_sitio';

/** Sube la foto y devuelve su ruta dentro del bucket, o null si no se pudo. */
export async function subirFotoSitio(archivo: File): Promise<{ path: string | null; error: string | null }> {
  if (!archivo.type.startsWith('image/')) return { path: null, error: 'Eso no es una imagen.' };
  if (archivo.size > 10 * 1024 * 1024) return { path: null, error: 'La foto supera los 10 MB.' };

  const limpio = archivo.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${Date.now()}_${limpio}`;
  const { error } = await supabase.storage.from(BUCKET_FOTOS).upload(path, archivo, { upsert: false });

  if (error) {
    return {
      path: null,
      error: /bucket/i.test(error.message)
        ? 'Falta el almacén de fotos: ejecuta supabase_foto_sitio.sql en Supabase.'
        : `No se pudo subir la foto: ${error.message}`,
    };
  }
  return { path, error: null };
}

/** Miniatura de la foto del sitio. No ocupa sitio si no hay foto. */
export function FotoSitio({ path, alt, className = '' }: {
  path?: string | null;
  alt?: string;
  className?: string;
}) {
  // Se guarda junto a qué ruta pertenece el enlace: así, al cambiar de cliente,
  // no se enseña un instante la foto del anterior mientras se pide la nueva.
  const [firmado, setFirmado] = useState<{ path: string; url: string } | null>(null);

  useEffect(() => {
    if (!path) return;
    let vivo = true;
    // Una hora de validez: de sobra para una jornada de consultas
    supabase.storage.from(BUCKET_FOTOS).createSignedUrl(path, 3600)
      .then(({ data }) => { if (vivo && data?.signedUrl) setFirmado({ path, url: data.signedUrl }); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [path]);

  if (!path) return null;
  const url = firmado?.path === path ? firmado.url : null;

  return (
    <div className={`shrink-0 overflow-hidden rounded-lg bg-card/60 border border-border/30 ${className}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- enlace firmado y temporal: no puede pasar por el optimizador
        <img src={url} alt={alt || 'Foto del sitio'} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="h-full w-full flex items-center justify-center">
          <ImageIcon className="w-4 h-4 text-muted/40" />
        </div>
      )}
    </div>
  );
}
