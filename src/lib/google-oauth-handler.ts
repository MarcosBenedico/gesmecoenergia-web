/**
 * Manejo robusto de tokens OAuth de Google
 * Refresca automáticamente cuando expiran
 */

import { supabase } from './supabase';

export async function obtenerTokenValido(): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('google_config')
      .select('access_token, refresh_token, expires_at')
      .eq('id', 1)
      .single();

    if (!data?.access_token) {
      console.log('❌ No hay token guardado');
      return null;
    }

    // Si hay expires_at y expiró, refrescar
    if (data.expires_at) {
      const ahora = Date.now() / 1000;
      if (ahora > data.expires_at) {
        console.log('⏰ Token expirado, refrescando...');
        const nuevoToken = await refrescarToken(data.refresh_token);
        if (nuevoToken) return nuevoToken;
      }
    }

    return data.access_token;
  } catch (err) {
    console.error('❌ Error obteniendo token:', err);
    return null;
  }
}

async function refrescarToken(refreshToken: string | null): Promise<string | null> {
  if (!refreshToken) {
    console.log('❌ No hay refresh token disponible');
    return null;
  }

  try {
    console.log('🔄 Refrescando token con refresh_token...');

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    if (!response.ok) {
      console.error('❌ Error refrescando token:', response.status);
      return null;
    }

    const tokens = await response.json();
    console.log('✅ Token refrescado exitosamente');

    // Guardar nuevo access_token y expires_at
    const expiresIn = tokens.expires_in || 3600; // 1 hora por defecto
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    await supabase
      .from('google_config')
      .update({
        access_token: tokens.access_token,
        expires_at: expiresAt,
      })
      .eq('id', 1);

    return tokens.access_token;
  } catch (err) {
    console.error('💥 Error refrescando token:', err);
    return null;
  }
}

/**
 * Hacer una llamada a Google Calendar API con reintentos automáticos
 */
export async function llamarCalendarAPI(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let token = await obtenerTokenValido();

  if (!token) {
    throw new Error('No hay token de Google disponible');
  }

  // Primer intento
  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  // Si falla por autenticación inválida, intentar refrescar
  if (response.status === 401) {
    console.log('🔄 Token probablemente expirado, intentando refrescar...');
    const { data } = await supabase
      .from('google_config')
      .select('refresh_token')
      .eq('id', 1)
      .single();

    if (data?.refresh_token) {
      token = await refrescarToken(data.refresh_token);
      if (token) {
        // Reintentar con nuevo token
        response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${token}`,
          },
        });
      }
    }
  }

  return response;
}
