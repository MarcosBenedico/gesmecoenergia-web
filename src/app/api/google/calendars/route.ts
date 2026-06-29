import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

async function fetchWithToken(url: string, token: string) {
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function refreshToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;

    // Guardar nuevo token
    await supabase.from('google_config').update({ access_token: data.access_token }).eq('id', 1);
    return data.access_token;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const { data: cfg, error } = await supabase
      .from('google_config')
      .select('access_token, refresh_token')
      .eq('id', 1)
      .single();

    if (error || !cfg?.access_token) {
      return NextResponse.json({ error: 'No hay credenciales de Google. Conecta desde Seguimientos.' }, { status: 401 });
    }

    let token = cfg.access_token;

    // Intentar obtener calendarios
    let res = await fetchWithToken('https://www.googleapis.com/calendar/v3/users/me/calendarList', token);

    // Si el token expiró, refrescar y reintentar
    if (res.status === 401 && cfg.refresh_token) {
      console.log('🔄 Token expirado, refrescando...');
      const newToken = await refreshToken(cfg.refresh_token);
      if (newToken) {
        token = newToken;
        res = await fetchWithToken('https://www.googleapis.com/calendar/v3/users/me/calendarList', token);
      }
    }

    if (!res.ok) {
      const errData = await res.json();
      return NextResponse.json(
        { error: errData.error?.message || 'Error de Google Calendar API' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ items: data.items || [], token });
  } catch (err) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
