'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description: string;
  calendarEmail: string;
}

interface Calendar {
  id: string;
  summary: string;
  email: string;
  selected: boolean;
  color: string;
  bgColor: string;
  borderColor: string;
}

type ViewType = 'mes' | 'semana' | 'dia';

export function Calendario() {
  const [view, setView] = useState<ViewType>('mes');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [googleConectado, setGoogleConectado] = useState(false);
  const [error, setError] = useState('');
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [showCalendarSelector, setShowCalendarSelector] = useState(false);

  // Verificar Google directamente desde Supabase
  const verificarGoogleDirecto = async () => {
    try {
      console.log('🔍 Verificando Google en Supabase...');
      const { data, error } = await supabase
        .from('google_config')
        .select('access_token, email')
        .eq('id', 1)
        .single();

      if (error) {
        console.log('❌ Error en lectura:', error.message);
        setGoogleConectado(false);
        return false;
      }

      if (data?.access_token && data?.email) {
        console.log('✅ Google conectado:', data.email);
        setGoogleConectado(true);
        return true;
      }

      console.log('⚠️ Sin datos de Google');
      setGoogleConectado(false);
      return false;
    } catch (err) {
      console.error('💥 Error al verificar:', err);
      setGoogleConectado(false);
      return false;
    }
  };

  // Colores para cada calendario (máx 4)
  const CALENDAR_COLORS = [
    { color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/40' },
    { color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', borderColor: 'border-cyan-500/40' },
    { color: 'text-purple-400', bgColor: 'bg-purple-500/20', borderColor: 'border-purple-500/40' },
    { color: 'text-amber-400', bgColor: 'bg-amber-500/20', borderColor: 'border-amber-500/40' },
  ];

  // Calendarios a filtrar (exactos)
  const CALENDARS_TO_FILTER = ['tareas diarias', 'festivos', 'holidays in'];

  // Cargar lista de calendarios disponibles
  const cargarCalendarios = async () => {
    try {
      console.log('📅 Cargando lista de calendarios...');
      const { data: googleConfig } = await supabase
        .from('google_config')
        .select('access_token')
        .eq('id', 1)
        .single();

      if (!googleConfig?.access_token) {
        console.log('❌ Sin token');
        return;
      }

      const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: {
          Authorization: `Bearer ${googleConfig.access_token}`,
        },
      });

      const data = await response.json();
      let calendarList: Calendar[] = (data.items || [])
        .filter((item: any) => {
          const summary = item.summary.toLowerCase();
          return !CALENDARS_TO_FILTER.some(filter => summary.includes(filter));
        })
        .map((item: any, index: number) => {
          const colorSet = CALENDAR_COLORS[index % CALENDAR_COLORS.length]; // Cicla colores si hay más de 4
          return {
            id: item.id,
            summary: item.summary,
            email: item.id,
            selected: item.primary || index === 0, // Por defecto, seleccionar el primero
            color: colorSet.color,
            bgColor: colorSet.bgColor,
            borderColor: colorSet.borderColor,
          };
        });

      console.log('✅ Calendarios cargados:', calendarList.length);
      setCalendars(calendarList);
    } catch (err) {
      console.error('Error cargando calendarios:', err);
    }
  };

  const cargarEventos = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: googleConfig } = await supabase
        .from('google_config')
        .select('access_token')
        .eq('id', 1)
        .single();

      if (!googleConfig?.access_token) {
        setError('No hay token de Google.');
        setLoading(false);
        return;
      }

      const selectedCalendars = calendars.filter((c) => c.selected);
      if (selectedCalendars.length === 0) {
        setEvents([]);
        setLoading(false);
        return;
      }

      const timeMin = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const timeMax = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      timeMin.setHours(0, 0, 0, 0);
      timeMax.setHours(23, 59, 59, 999);

      let allEvents: CalendarEvent[] = [];

      // Cargar eventos de cada calendario seleccionado
      for (const calendar of selectedCalendars) {
        try {
          const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
              calendar.id
            )}/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=250`,
            {
              headers: {
                Authorization: `Bearer ${googleConfig.access_token}`,
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            const eventos = (data.items || []).map((item: any) => ({
              id: item.id,
              title: item.summary || 'Sin título',
              start: item.start.dateTime || item.start.date,
              end: item.end.dateTime || item.end.date,
              description: item.description || '',
              calendarEmail: calendar.email,
            }));

            allEvents = [...allEvents, ...eventos];
          }
        } catch (err) {
          console.error(`Error cargando calendario ${calendar.summary}:`, err);
        }
      }

      // Ordenar eventos por fecha
      allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      setEvents(allEvents);
    } catch (error) {
      console.error('Error al cargar eventos:', error);
      setError('Error al cargar eventos.');
    } finally {
      setLoading(false);
    }
  };

  // Cargar Google state y calendarios al montar
  useEffect(() => {
    console.log('📅 Calendario: Inicializando...');

    verificarGoogleDirecto().then((conectado) => {
      if (conectado) {
        cargarCalendarios();
      }
    });

    const interval = setInterval(() => {
      verificarGoogleDirecto();
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Cargar eventos cuando Google se conecta o cambio de calendario/mes
  useEffect(() => {
    if (googleConectado && calendars.length > 0) {
      cargarEventos();
    }
  }, [currentDate, calendars, googleConectado]);

  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const renderMonth = () => {
    const days = [];
    const daysCount = daysInMonth(currentDate);
    const firstDay = firstDayOfMonth(currentDate);

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="bg-card/30 rounded-lg p-2 h-24"></div>);
    }

    for (let day = 1; day <= daysCount; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayEvents = events.filter(
        (e) => new Date(e.start).toLocaleDateString() === date.toLocaleDateString()
      );

      days.push(
        <div
          key={day}
          className="bg-surface rounded-lg p-2 h-24 border border-border hover:border-accent transition overflow-hidden"
        >
          <div className="font-semibold text-foreground text-sm mb-1">{day}</div>
          <div className="space-y-0.5 overflow-y-auto max-h-16">
            {dayEvents.map((event) => {
              const calendar = calendars.find((c) => c.id === event.calendarEmail);
              const colorClass = calendar?.color || 'text-accent';
              const bgClass = calendar?.bgColor || 'bg-accent/20';
              return (
                <div
                  key={event.id}
                  className={`text-xs ${bgClass} ${colorClass} rounded px-1.5 py-0.5 truncate`}
                  title={event.title}
                >
                  {event.title}
                </div>
              );
            })}
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
            (e) => new Date(e.start).toLocaleDateString() === date.toLocaleDateString()
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
                {dayEvents.map((event) => {
                  const calendar = calendars.find((c) => c.id === event.calendarEmail);
                  const colorClass = calendar?.color || 'text-accent';
                  const bgClass = calendar?.bgColor || 'bg-accent/20';
                  const borderClass = calendar?.borderColor || 'border-accent/30';
                  return (
                    <div
                      key={event.id}
                      className={`text-xs ${bgClass} ${colorClass} rounded p-1.5 border ${borderClass}`}
                    >
                      <div className="font-semibold">{event.title}</div>
                      <div className={`text-xs opacity-70`}>
                        {new Date(event.start).toLocaleTimeString('es', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDay = () => {
    const dayEvents = events.filter(
      (e) => new Date(e.start).toLocaleDateString() === currentDate.toLocaleDateString()
    );

    return (
      <div className="space-y-3">
        <div className="text-lg font-semibold text-foreground mb-6">
          {currentDate.toLocaleDateString('es', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
        {dayEvents.length === 0 ? (
          <div className="text-center py-12 text-muted">Sin eventos para hoy</div>
        ) : (
          dayEvents.map((event) => {
            const calendar = calendars.find((c) => c.id === event.calendarEmail);
            const colorClass = calendar?.color || 'text-accent';
            const bgClass = calendar?.bgColor || 'bg-accent/20';
            const borderClass = calendar?.borderColor || 'border-accent/30';
            return (
              <div key={event.id} className={`rounded-lg p-4 border ${bgClass} ${borderClass}`}>
                <div className={`font-semibold ${colorClass} text-lg`}>{event.title}</div>
                <div className="text-sm text-muted mt-2">
                  {new Date(event.start).toLocaleTimeString('es')} -{' '}
                  {new Date(event.end).toLocaleTimeString('es')}
                </div>
                <div className={`text-xs ${colorClass} mt-1 font-semibold`}>{calendar?.summary || event.calendarEmail}</div>
                {event.description && (
                  <div className="text-sm text-muted mt-3">{event.description}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Estado de conexión */}
      {!googleConectado && (
        <div className="rounded-lg p-4 bg-red-500/10 border border-red-500/30">
          <p className="text-sm text-red-400">
            Google Calendar no está conectado. Conecta en la sección de Seguimientos.
          </p>
        </div>
      )}

      {googleConectado && (
        <div className="rounded-lg p-4 bg-secondary/10 border border-secondary/30">
          <p className="text-sm text-secondary">✓ Google Calendar conectado - Mostrando tus eventos</p>
        </div>
      )}

      {/* Selector de calendarios */}
      {googleConectado && calendars.length > 0 && (
        <div className="bg-surface/50 rounded-xl p-4 border border-border">
          <button
            onClick={() => setShowCalendarSelector(!showCalendarSelector)}
            className="w-full flex items-center justify-between text-foreground font-bold mb-3"
          >
            <span>📅 Calendarios ({calendars.filter((c) => c.selected).length}/{calendars.length})</span>
            <span className={`transition transform ${showCalendarSelector ? 'rotate-180' : ''}`}>▼</span>
          </button>

          {showCalendarSelector && (
            <div className="space-y-2 pt-3 border-t border-border">
              {calendars.map((calendar) => (
                <label
                  key={calendar.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-card/50 cursor-pointer transition border border-transparent hover:border-border"
                >
                  <input
                    type="checkbox"
                    checked={calendar.selected}
                    onChange={(e) => {
                      setCalendars(
                        calendars.map((c) =>
                          c.id === calendar.id ? { ...c, selected: e.target.checked } : c
                        )
                      );
                    }}
                    className="w-4 h-4 accent-accent"
                  />
                  <div className={`w-3 h-3 rounded-full ${calendar.color.replace('text-', 'bg-')}`}></div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-foreground">{calendar.summary}</div>
                    <div className="text-xs text-muted">{calendar.email}</div>
                  </div>
                  {calendar.selected && (
                    <span className="text-xs font-bold text-accent">✓</span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Controles */}
      <div className="space-y-4">
        {/* Selectores de vista */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setView('mes')}
            disabled={!googleConectado}
            className={`px-5 py-2.5 rounded-lg font-bold transition ${
              view === 'mes'
                ? 'bg-accent text-white shadow-glow'
                : 'bg-card/80 text-foreground border border-border/50 hover:bg-card/95'
            } ${!googleConectado ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            📅 Mes
          </button>
          <button
            onClick={() => setView('semana')}
            disabled={!googleConectado}
            className={`px-5 py-2.5 rounded-lg font-bold transition ${
              view === 'semana'
                ? 'bg-accent text-white shadow-glow'
                : 'bg-card/80 text-foreground border border-border/50 hover:bg-card/95'
            } ${!googleConectado ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            📆 Semana
          </button>
          <button
            onClick={() => setView('dia')}
            disabled={!googleConectado}
            className={`px-5 py-2.5 rounded-lg font-bold transition ${
              view === 'dia'
                ? 'bg-accent text-white shadow-glow'
                : 'bg-card/80 text-foreground border border-border/50 hover:bg-card/95'
            } ${!googleConectado ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            📄 Día
          </button>
        </div>

        {/* Navegación y fecha */}
        <div className="flex gap-3 items-center justify-between bg-surface/50 rounded-xl p-4 border border-border">
          {/* Botones de navegación */}
          <div className="flex gap-2 items-center">
            <button
              onClick={() => {
                if (view === 'mes') {
                  setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
                } else if (view === 'semana') {
                  const newDate = new Date(currentDate);
                  newDate.setDate(newDate.getDate() - 7);
                  setCurrentDate(newDate);
                } else {
                  const newDate = new Date(currentDate);
                  newDate.setDate(newDate.getDate() - 1);
                  setCurrentDate(newDate);
                }
              }}
              className="px-4 py-2 rounded-lg bg-card/80 text-foreground border border-border/50 hover:bg-card transition font-semibold"
            >
              ← Atrás
            </button>

            <button
              onClick={() => {
                if (view === 'mes') {
                  setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
                } else if (view === 'semana') {
                  const newDate = new Date(currentDate);
                  newDate.setDate(newDate.getDate() + 7);
                  setCurrentDate(newDate);
                } else {
                  const newDate = new Date(currentDate);
                  newDate.setDate(newDate.getDate() + 1);
                  setCurrentDate(newDate);
                }
              }}
              className="px-4 py-2 rounded-lg bg-card/80 text-foreground border border-border/50 hover:bg-card transition font-semibold"
            >
              Adelante →
            </button>
          </div>

          {/* Fecha actual en la vista */}
          <span className="text-foreground font-bold text-lg min-w-56 text-center">
            {view === 'mes' && (
              <span>{currentDate.toLocaleDateString('es', { month: 'long', year: 'numeric' }).toUpperCase()}</span>
            )}
            {view === 'semana' && (() => {
              const start = new Date(currentDate);
              start.setDate(start.getDate() - start.getDay());
              const end = new Date(start);
              end.setDate(end.getDate() + 6);
              return (
                <span>
                  {start.getDate()} - {end.getDate()} {end.toLocaleDateString('es', { month: 'short', year: 'numeric' })}
                </span>
              );
            })()}
            {view === 'dia' && (
              <span>{currentDate.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</span>
            )}
          </span>

          {/* Botones de acción */}
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-5 py-2 rounded-lg bg-secondary text-white font-bold hover:bg-secondary/90 transition"
            >
              🎯 Hoy
            </button>
            <button
              onClick={() => cargarEventos()}
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-accent text-white font-bold hover:bg-accent/90 transition disabled:opacity-50"
            >
              {loading ? '⟳ Cargando...' : '↻ Refrescar'}
            </button>
          </div>
        </div>
      </div>

      {/* Calendario */}
      <div className="bg-surface/50 rounded-2xl p-6">
        {!googleConectado ? (
          <div className="text-center py-12">
            <p className="text-muted text-lg">Conecta tu Google Calendar para ver tus eventos</p>
            <p className="text-muted text-sm mt-2">
              Ve a la sección "Seguimientos" y haz clic en "Conectar Google Calendar"
            </p>
          </div>
        ) : loading ? (
          <div className="text-center py-12 text-muted">Cargando eventos...</div>
        ) : calendars.filter((c) => c.selected).length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted">Selecciona al menos un calendario para ver eventos</p>
          </div>
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
