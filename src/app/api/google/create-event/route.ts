import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { clienteName, cups, estado, notas, fecha } = await request.json();

    // Obtener credenciales de Google desde Supabase
    const { data: config, error: configError } = await supabase
      .from('google_config')
      .select('access_token, refresh_token')
      .single();

    if (configError || !config?.access_token) {
      return NextResponse.json(
        { error: 'No Google credentials found. Please authenticate first.' },
        { status: 401 }
      );
    }

    // Crear evento en Google Calendar
    const event = {
      summary: `Seguimiento - ${clienteName} (${cups})`,
      description: `Estado: ${estado}\nNotas: ${notas}`,
      start: {
        dateTime: fecha,
        timeZone: 'Europe/Madrid',
      },
      end: {
        dateTime: new Date(new Date(fecha).getTime() + 60 * 60 * 1000).toISOString(),
        timeZone: 'Europe/Madrid',
      },
    };

    const calendarResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    if (!calendarResponse.ok) {
      // Si el token expiró, intentar refrescar
      if (calendarResponse.status === 401 && config.refresh_token) {
        // Aquí se podría refrescar el token automáticamente
        return NextResponse.json(
          { error: 'Token expired. Please re-authenticate.' },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to create calendar event' },
        { status: calendarResponse.status }
      );
    }

    const eventData = await calendarResponse.json();

    return NextResponse.json({
      success: true,
      eventId: eventData.id,
      eventLink: eventData.htmlLink,
    });
  } catch (error) {
    console.error('Create event error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
