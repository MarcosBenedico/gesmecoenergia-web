/**
 * Manejo robusto de tokens OAuth de Google (lado cliente)
 * Refresca automáticamente cuando expiran usando API route
 */

interface TokenResponse {
  access_token: string;
  expires_at?: number;
  error?: string;
}

async function obtenerTokenValido(): Promise<string | null> {
  try {
    console.log('🔐 [Cliente] Obteniendo token válido...');

    const response = await fetch('/api/google/token');
    const data: TokenResponse = await response.json();

    if (!response.ok) {
      console.log('❌ [Cliente] Error:', data.error);
      throw new Error(data.error || 'Error obteniendo token');
    }

    console.log('✅ [Cliente] Token obtenido');
    return data.access_token;
  } catch (err) {
    console.error('❌ [Cliente] Error obteniendo token:', err);
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
    console.log('🔄 [Cliente] Token expirado, refrescando...');
    token = await obtenerTokenValido();

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

  return response;
}
