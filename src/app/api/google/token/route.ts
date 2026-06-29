import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/google/token
 * Obtiene un token válido, refrescando si es necesario
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔐 [API] Obteniendo token válido...');

    // 1. Obtener token actual de Supabase
    const { data, error } = await supabase
      .from('google_config')
      .select('access_token, refresh_token, expires_at')
      .eq('id', 1)
      .single();

    if (error || !data?.access_token) {
      console.log('❌ [API] No hay token guardado');
      return NextResponse.json(
        { error: 'No hay token de Google disponible. Conecta desde Seguimientos.' },
        { status: 401 }
      );
    }

    // 2. Verificar si está expirado
    const ahora = Math.floor(Date.now() / 1000);
    const tiempoMargen = 5 * 60; // 5 minutos de margen

    if (data.expires_at && ahora > (data.expires_at - tiempoMargen)) {
      console.log('⏰ [API] Token expirado, refrescando...');

      if (!data.refresh_token) {
        console.log('❌ [API] No hay refresh token');
        return NextResponse.json(
          { error: 'Token expirado y no hay refresh token. Reconecta en Seguimientos.' },
          { status: 401 }
        );
      }

      // 3. Refrescar token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          refresh_token: data.refresh_token,
          grant_type: 'refresh_token',
        }).toString(),
      });

      if (!tokenResponse.ok) {
        console.error('❌ [API] Error refrescando token:', tokenResponse.status);
        return NextResponse.json(
          { error: 'No se pudo refrescar el token' },
          { status: 401 }
        );
      }

      const tokens = await tokenResponse.json();
      console.log('✅ [API] Token refrescado');

      // 4. Guardar nuevo token
      const expiresIn = tokens.expires_in || 3600;
      const expiresAt = ahora + expiresIn;

      await supabase
        .from('google_config')
        .update({
          access_token: tokens.access_token,
          expires_at: expiresAt,
        })
        .eq('id', 1);

      return NextResponse.json({
        access_token: tokens.access_token,
        expires_at: expiresAt,
      });
    }

    // Token válido
    console.log('✅ [API] Token válido');
    return NextResponse.json({
      access_token: data.access_token,
      expires_at: data.expires_at,
    });
  } catch (err) {
    console.error('💥 [API] Error:', err);
    return NextResponse.json(
      { error: 'Error obteniendo token' },
      { status: 500 }
    );
  }
}
