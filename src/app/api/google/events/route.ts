import { NextRequest, NextResponse } from 'next/server';
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
    await supabase.from('google_config').update({ access_token: data.access_token }).eq('id', 1);
    return data.access_token;
  } catch {
    return null;
  }
}

// POST /api/google/events  { calendarIds: string[], timeMin: string, timeMax: string }
export async function POST(req: NextRequest) {
  try {
    const { calendarIds, timeMin, timeMax } = await req.json();

    const { data: cfg, error } = await supabase
      .from('google_config')
      .select('access_token, refresh_token')
      .eq('id', 1)
      .single();

    if (error || !cfg?.access_token) {
      return NextResponse.json({ error: 'No hay credenciales de Google.' }, { status: 401 });
    }

    let token = cfg.access_token;
    let tokenRefrescado = false;

    const allEvents: any[] = [];

    for (const calId of calendarIds) {
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=250`;

      let res = await fetchWithToken(url, token);

      // Si expira el token, refrescar una vez
      if (res.status === 401 && !tokenRefrescado && cfg.refresh_token) {
        const newToken = await refreshToken(cfg.refresh_token);
        if (newToken) {
          token = newToken;
          tokenRefrescado = true;
          res = await fetchWithToken(url, token);
        }
      }

      if (res.ok) {
        const data = await res.json();
        const eventos = (data.items || []).map((item: any) => ({
          id: item.id,
          title: item.summary || 'Sin título',
          start: item.start?.dateTime || item.start?.date || '',
          end: item.end?.dateTime || item.end?.date || '',
          description: item.description || '',
          calendarId: calId,
        }));
        allEvents.push(...eventos);
      }
    }

    allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return NextResponse.json({ events: allEvents });
  } catch (err) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
