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
    console.log('Calendario: Inicializando...');

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
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="bg-surface/80 backdrop-blur-xl border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-foreground">Calendario</h1>
          <p className="text-sm text-muted mt-1">Actividad de tu equipo en tiempo real</p>
        </div>
        {googleConectado && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/10 border border-secondary/30">
            <span className="w-2 h-2 bg-secondary rounded-full animate-pulse"></span>
            <span className="text-sm font-semibold text-secondary">Conectado</span>
          </div>
        )}
      </div>

      {/* Controles principales */}
      <div className="bg-surface/50 border-b border-border px-6 py-4 space-y-3">
        {/* Selector de vista */}
        <div className="flex gap-2">
          <button
            onClick={() => setView('mes')}
            disabled={!googleConectado}
            className={`px-6 py-2.5 rounded-lg font-bold transition text-sm ${
              view === 'mes'
                ? 'bg-accent text-white shadow-glow scale-105'
                : 'bg-card/80 text-foreground border border-border/50 hover:bg-card/95'
            } ${!googleConectado ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            📅 Mes
          </button>
          <button
            onClick={() => setView('semana')}
            disabled={!googleConectado}
            className={`px-6 py-2.5 rounded-lg font-bold transition text-sm ${
              view === 'semana'
                ? 'bg-accent text-white shadow-glow scale-105'
                : 'bg-card/80 text-foreground border border-border/50 hover:bg-card/95'
            } ${!googleConectado ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            📆 Semana
          </button>
          <button
            onClick={() => setView('dia')}
            disabled={!googleConectado}
            className={`px-6 py-2.5 rounded-lg font-bold transition text-sm ${
              view === 'dia'
                ? 'bg-accent text-white shadow-glow scale-105'
                : 'bg-card/80 text-foreground border border-border/50 hover:bg-card/95'
            } ${!googleConectado ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            📄 Día
          </button>

          {/* Selector de calendarios */}
          {googleConectado && calendars.length > 0 && (
            <div className="ml-auto">
              <button
                onClick={() => setShowCalendarSelector(!showCalendarSelector)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-card/80 text-foreground border border-border/50 hover:bg-card transition font-semibold text-sm"
              >
                <span>Calendarios ({calendars.filter((c) => c.selected).length})</span>
                <span className={`transition transform ${showCalendarSelector ? 'rotate-180' : ''}`}>▼</span>
              </button>
            </div>
          )}
        </div>

        {/* Selector expandible */}
        {showCalendarSelector && googleConectado && calendars.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-3 border-t border-border">
            {calendars.map((calendar) => (
              <label
                key={calendar.id}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-card/80 border border-border/50 hover:border-accent/50 hover:bg-card cursor-pointer transition group"
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
                <div className={`w-2.5 h-2.5 rounded-full ${calendar.color.replace('text-', 'bg-')} group-hover:scale-125 transition`}></div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">{calendar.summary}</div>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Navegación de fechas */}
        <div className="flex items-center gap-3 bg-gradient-to-r from-card/50 to-card/30 rounded-xl p-3 border border-border/50">
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
            className="px-4 py-2 rounded-lg bg-card/80 text-foreground border border-border/50 hover:bg-card transition font-bold text-sm hover:scale-105"
          >
            ◀ Atrás
          </button>

          <div className="flex-1 text-center">
            <p className="text-foreground font-black text-xl tracking-wide">
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
                    {start.getDate()} - {end.getDate()} {end.toLocaleDateString('es', { month: 'short', year: 'numeric' }).toUpperCase()}
                  </span>
                );
              })()}
              {view === 'dia' && (
                <span>{currentDate.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</span>
              )}
            </p>
          </div>

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
            className="px-4 py-2 rounded-lg bg-card/80 text-foreground border border-border/50 hover:bg-card transition font-bold text-sm hover:scale-105"
          >
            Adelante ▶
          </button>

          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-5 py-2 rounded-lg bg-secondary text-white font-bold hover:bg-secondary/90 hover:scale-105 transition text-sm"
          >
            🎯 Hoy
          </button>
          <button
            onClick={() => cargarEventos()}
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-accent text-white font-bold hover:bg-accent/90 hover:scale-105 transition disabled:opacity-50 text-sm"
          >
            {loading ? '⟳' : '↻'}
          </button>
          <button
            onClick={() => setShowCalendarSelector(!showCalendarSelector)}
            className="px-5 py-2 rounded-lg bg-card/80 border border-border text-foreground font-bold hover:bg-card transition text-sm"
          >
            Calendarios ({calendars.filter((c) => c.selected).length})
          </button>
        </div>

        {/* Selector de calendarios */}
        {showCalendarSelector && (
          <div className="bg-surface/50 rounded-2xl p-6 border border-border mx-6 mb-4">
            <h3 className="font-bold text-foreground mb-4">Seleccionar Calendarios:</h3>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {calendars.map((calendar) => (
                <label
                  key={calendar.id}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${
                    calendar.selected ? 'bg-accent/10 border border-accent' : 'bg-card/50 border border-border/30'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={calendar.selected}
                    onChange={(e) => {
                      const updated = calendars.map((c) =>
                        c.id === calendar.id ? { ...c, selected: e.target.checked } : c
                      );
                      setCalendars(updated);
                    }}
                    className="w-4 h-4 rounded accent cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold text-sm truncate ${calendar.selected ? 'text-foreground' : 'text-foreground/70'}`}>
                      {calendar.summary}
                    </div>
                    <div className="text-xs text-foreground/50 truncate">{calendar.email}</div>
                  </div>
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${calendar.bgColor}`}></div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Calendario - Contenedor principal */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {!googleConectado ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="text-center space-y-4">
              <div className="text-6xl">📅</div>
              <p className="text-muted text-lg">Conecta tu Google Calendar para ver tus eventos</p>
              <p className="text-muted text-sm">Ve a "Seguimientos" y autoriza el acceso</p>
            </div>
          </div>
        ) : loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="inline-block animate-spin text-4xl">⟳</div>
              <p className="text-muted">Cargando eventos...</p>
            </div>
          </div>
        ) : calendars.filter((c) => c.selected).length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-muted text-lg">Selecciona al menos un calendario</p>
          </div>
        ) : view === 'mes' ? (
          <div className="bg-surface/50 rounded-2xl p-6 border border-border h-full overflow-hidden flex flex-col">
            <div className="grid grid-cols-7 gap-3 flex-1 overflow-hidden">
              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
                <div key={day} className="text-center font-bold text-accent text-sm py-2">
                  {day}
                </div>
              ))}
              <div className="grid grid-cols-7 gap-3 col-span-7 overflow-y-auto">
                {renderMonth()}
              </div>
            </div>
          </div>
        ) : view === 'semana' ? (
          <div className="bg-surface/50 rounded-2xl p-6 border border-border h-full overflow-hidden">
            {renderWeek()}
          </div>
        ) : (
          <div className="bg-surface/50 rounded-2xl p-6 border border-border h-full overflow-auto">
            {renderDay()}
          </div>
        )}
      </div>
    </div>
  );
}
