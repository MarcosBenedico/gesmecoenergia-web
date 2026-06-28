'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description: string;
}

type ViewType = 'mes' | 'semana' | 'dia';

export function Calendario() {
  const [view, setView] = useState<ViewType>('mes');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cargarEventos();
  }, [currentDate]);

  const cargarEventos = async () => {
    setLoading(true);
    try {
      // Obtener el token de Google
      const { data: googleConfig } = await supabase
        .from('google_config')
        .select('access_token')
        .single();

      if (!googleConfig?.access_token) {
        console.error('No hay token de Google');
        setLoading(false);
        return;
      }

      // Obtener eventos del calendario
      const timeMin = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
      const timeMax = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString();

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
        {
          headers: {
            Authorization: `Bearer ${googleConfig.access_token}`,
          },
        }
      );

      const data = await response.json();
      const eventos = (data.items || []).map((item: any) => ({
        id: item.id,
        title: item.summary,
        start: item.start.dateTime || item.start.date,
        end: item.end.dateTime || item.end.date,
        description: item.description || '',
      }));

      setEvents(eventos);
    } catch (error) {
      console.error('Error al cargar eventos:', error);
    } finally {
      setLoading(false);
    }
  };

  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const renderMonth = () => {
    const days = [];
    const daysCount = daysInMonth(currentDate);
    const firstDay = firstDayOfMonth(currentDate);

    // Días vacíos del mes anterior
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="bg-card/30 rounded-lg p-2 h-24"></div>);
    }

    // Días del mes
    for (let day = 1; day <= daysCount; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayEvents = events.filter(
        (e) =>
          new Date(e.start).toLocaleDateString() === date.toLocaleDateString()
      );

      days.push(
        <div
          key={day}
          className="bg-surface rounded-lg p-2 h-24 border border-border hover:border-accent transition overflow-hidden"
        >
          <div className="font-semibold text-foreground text-sm mb-1">{day}</div>
          <div className="space-y-0.5 overflow-y-auto max-h-16">
            {dayEvents.map((event) => (
              <div
                key={event.id}
                className="text-xs bg-accent/20 text-accent rounded px-1.5 py-0.5 truncate"
              >
                {event.title}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return days;
  };

  const getWeekDays = () => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      return date;
    });
  };

  const renderWeek = () => {
    const weekDays = getWeekDays();

    return (
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((date) => {
          const dayEvents = events.filter(
            (e) =>
              new Date(e.start).toLocaleDateString() === date.toLocaleDateString()
          );

          return (
            <div
              key={date.toDateString()}
              className="bg-surface rounded-lg p-3 border border-border min-h-48"
            >
              <div className="font-semibold text-foreground text-sm mb-3">
                {date.toLocaleDateString('es', { weekday: 'short', day: 'numeric' })}
              </div>
              <div className="space-y-2">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="text-xs bg-accent/20 text-accent rounded p-1.5 border border-accent/30"
                  >
                    <div className="font-semibold">{event.title}</div>
                    <div className="text-accent/70 text-xs">
                      {new Date(event.start).toLocaleTimeString('es', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDay = () => {
    const dayEvents = events.filter(
      (e) =>
        new Date(e.start).toLocaleDateString() === currentDate.toLocaleDateString()
    );

    return (
      <div className="space-y-3">
        <div className="text-lg font-semibold text-foreground mb-6">
          {currentDate.toLocaleDateString('es', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        {dayEvents.length === 0 ? (
          <div className="text-center py-12 text-muted">Sin eventos para hoy</div>
        ) : (
          dayEvents.map((event) => (
            <div
              key={event.id}
              className="bg-surface rounded-lg p-4 border border-accent/30"
            >
              <div className="font-semibold text-foreground text-lg">{event.title}</div>
              <div className="text-sm text-muted mt-2">
                {new Date(event.start).toLocaleTimeString('es')} - {new Date(event.end).toLocaleTimeString('es')}
              </div>
              {event.description && (
                <div className="text-sm text-muted mt-3">{event.description}</div>
              )}
            </div>
          ))
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Controles */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setView('mes')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              view === 'mes'
                ? 'bg-accent text-white'
                : 'bg-card/80 text-foreground border border-border/50 hover:bg-card'
            }`}
          >
            Mes
          </button>
          <button
            onClick={() => setView('semana')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              view === 'semana'
                ? 'bg-accent text-white'
                : 'bg-card/80 text-foreground border border-border/50 hover:bg-card'
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setView('dia')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              view === 'dia'
                ? 'bg-accent text-white'
                : 'bg-card/80 text-foreground border border-border/50 hover:bg-card'
            }`}
          >
            Día
          </button>
        </div>

        <div className="flex gap-2 items-center">
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
            className="px-3 py-2 rounded-lg bg-card/80 text-foreground border border-border/50 hover:bg-card transition"
          >
            ←
          </button>
          <span className="text-foreground font-semibold min-w-48 text-center">
            {currentDate.toLocaleDateString('es', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
            className="px-3 py-2 rounded-lg bg-card/80 text-foreground border border-border/50 hover:bg-card transition"
          >
            →
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-2 rounded-lg bg-accent text-white font-semibold hover:bg-accent/90 transition ml-4"
          >
            Hoy
          </button>
        </div>
      </div>

      {/* Calendario */}
      <div className="bg-surface/50 rounded-2xl p-6">
        {loading ? (
          <div className="text-center py-12 text-muted">Cargando eventos...</div>
        ) : view === 'mes' ? (
          <div className="grid grid-cols-7 gap-2">
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
              <div key={day} className="text-center font-semibold text-muted text-sm py-2">
                {day}
              </div>
            ))}
            {renderMonth()}
          </div>
        ) : view === 'semana' ? (
          renderWeek()
        ) : (
          renderDay()
        )}
      </div>
    </div>
  );
}
