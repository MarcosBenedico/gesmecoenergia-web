'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { llamarCalendarAPI } from '@/lib/google-oauth-handler';

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
  const [statusMessage, setStatusMessage] = useState('Inicializando...');
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [showCalendarSelector, setShowCalendarSelector] = useState(false);

  // Verificar Google directamente desde Supabase
  const verificarGoogleDirecto = async () => {
    try {
      setStatusMessage('🔍 Verificando conexión con Google...');
      console.log('🔍 Verificando Google en Supabase...');

      const { data, error } = await supabase
        .from('google_config')
        .select('access_token, email')
        .eq('id', 1)
        .single();

      if (error) {
        console.log('❌ Error en lectura:', error.message);
        setStatusMessage('❌ No hay credenciales de Google guardadas. Ve a Seguimientos para conectar.');
        setGoogleConectado(false);
        setError('No hay credenciales de Google. Debes conectar tu Google Calendar en la sección Seguimientos.');
        return false;
      }

      if (data?.access_token && data?.email) {
        console.log('✅ Google conectado:', data.email);
        setStatusMessage(`✅ Google conectado: ${data.email}`);
        setError('');
        setGoogleConectado(true);
        return true;
      }

      console.log('⚠️ Sin datos de Google');
      setStatusMessage('⚠️ Credenciales incompletas');
      setGoogleConectado(false);
      setError('Faltan credenciales. Reconecta desde Seguimientos.');
      return false;
    } catch (err) {
      console.error('💥 Error al verificar:', err);
      setStatusMessage('💥 Error verificando Google');
      setGoogleConectado(false);
      setError(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`);
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
        console.log('❌ Sin token de Google en Supabase');
        setCalendars([]);
        setError('No hay token de Google. Conecta primero en Seguimientos.');
        return;
      }

      console.log('✅ Token encontrado, consultando Google Calendar API...');
      setStatusMessage('🔄 Consultando Google Calendar API...');

      const response = await llamarCalendarAPI(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList'
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Error de Google Calendar API:', response.status, errorData);
        setError(`Error al cargar calendarios: ${errorData.error?.message || 'Error desconocido'}`);
        setCalendars([]);
        return;
      }

      const data = await response.json();
      console.log('📋 Respuesta de Google:', data);

      if (!data.items || data.items.length === 0) {
        console.log('⚠️ No hay calendarios disponibles');
        setCalendars([]);
        setError('No hay calendarios disponibles en tu Google Account.');
        return;
      }

      let calendarList: Calendar[] = data.items
        .filter((item: any) => {
          const summary = item.summary.toLowerCase();
          const esFiltrando = CALENDARS_TO_FILTER.some(filter => summary.includes(filter));
          if (esFiltrando) console.log(`  Filtrando: ${item.summary}`);
          return !esFiltrando;
        })
        .map((item: any, index: number) => {
          const colorSet = CALENDAR_COLORS[index % CALENDAR_COLORS.length];
          const cal = {
            id: item.id,
            summary: item.summary,
            email: item.id,
            selected: true, // ⭐ TODOS SELECCIONADOS POR DEFECTO
            color: colorSet.color,
            bgColor: colorSet.bgColor,
            borderColor: colorSet.borderColor,
          };
          console.log(`  ✅ Calendario: ${cal.summary} (ID: ${cal.id}, Selected: ${cal.selected})`);
          return cal;
        });

      console.log('✅ Calendarios cargados:', calendarList.length, calendarList);
      setCalendars(calendarList);
      setError('');
    } catch (err) {
      console.error('💥 Error cargando calendarios:', err);
      setError(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`);
      setCalendars([]);
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
          const response = await llamarCalendarAPI(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
              calendar.id
            )}/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=250`
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

    const inicializar = async () => {
      const conectado = await verificarGoogleDirecto();
      if (conectado) {
        console.log('✅ Google conectado, cargando calendarios...');
        await cargarCalendarios();
      } else {
        console.log('❌ Google no conectado');
        setCalendars([]);
      }
    };

    inicializar();
  }, []);

  // Cargar eventos cuando hay calendarios seleccionados
  useEffect(() => {
    if (googleConectado && calendars.length > 0) {
      const selectedCalendars = calendars.filter((c) => c.selected);
      if (selectedCalendars.length > 0) {
        cargarEventos();
      }
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
          <p className="text-sm text-muted mt-1">{statusMessage}</p>
        </div>
        <div className="flex items-center gap-3">
          {googleConectado && (
            <>
              <button
                onClick={cargarCalendarios}
                className="px-4 py-2 rounded-lg bg-card/80 border border-border/50 text-foreground hover:bg-card transition font-semibold text-sm"
                title="Recargar lista de calendarios"
              >
                📅 Recargar
              </button>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/10 border border-secondary/30">
                <span className="w-2 h-2 bg-secondary rounded-full animate-pulse"></span>
                <span className="text-sm font-semibold text-secondary">Conectado</span>
              </div>
            </>
          )}
          {!googleConectado && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange/10 border border-orange/30">
              <span className="w-2 h-2 bg-orange rounded-full"></span>
              <span className="text-sm font-semibold text-orange">No conectado</span>
            </div>
          )}
        </div>
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

          </div>


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
            className="ml-auto px-5 py-2 rounded-lg bg-card/80 border border-border/50 text-foreground font-bold hover:bg-card transition text-sm"
          >
            📅 Calendarios ({calendars.filter((c) => c.selected).length})
          </button>
        </div>

        {/* Selector de calendarios - Panel deslizable */}
        {showCalendarSelector && (
          <div className="border-t border-border pt-4">
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-orange/10 border border-orange/40 text-xs text-orange">
                ⚠️ {error}
              </div>
            )}
            {calendars.length === 0 && !error && (
              <div className="text-center py-6 text-muted text-sm">
                No hay calendarios disponibles. Haz clic en "📅 Recargar" para intentar de nuevo.
              </div>
            )}
            <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {calendars.map((calendar) => (
                <label
                  key={calendar.id}
                  className={`flex items-center gap-3 p-4 rounded-lg cursor-pointer transition border ${
                    calendar.selected
                      ? `${calendar.bgColor} border-accent/60 ring-1 ring-accent/30`
                      : 'bg-card/50 border-border/50 hover:border-border hover:bg-card'
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
                    className="w-5 h-5 accent-accent cursor-pointer flex-shrink-0"
                  />
                  <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${calendar.bgColor.replace('bg-', 'bg-')} border-2 ${calendar.color.replace('text-', 'border-')}`}></div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold text-sm truncate ${calendar.selected ? 'text-foreground' : 'text-foreground/70'}`}>
                      {calendar.summary}
                    </div>
                    <div className="text-xs text-foreground/50 truncate">{calendar.email}</div>
                  </div>
                  {calendar.selected && (
                    <div className={`text-xl flex-shrink-0 ${calendar.color}`}>✓</div>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Calendario - Contenedor principal */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {!googleConectado ? (
          <div className="h-full flex flex-col items-center justify-center px-6">
            <div className="text-center space-y-6 max-w-lg">
              <div className="text-6xl">🔗</div>
              <div className="space-y-3">
                <h2 className="text-2xl font-bold text-foreground">Google Calendar no conectado</h2>
                <p className="text-muted">Para ver tu calendario y el de tu equipo, necesitas conectar tu Google Account.</p>
              </div>
              <div className="bg-orange/10 border border-orange/30 rounded-lg p-4 text-sm text-orange space-y-2">
                <p className="font-semibold">⚠️ Qué hacer:</p>
                <ol className="list-decimal list-inside space-y-1 text-left">
                  <li>Ve a la sección <span className="font-bold">"Seguimientos"</span></li>
                  <li>Haz clic en <span className="font-bold">"Conectar Google"</span></li>
                  <li>Autoriza el acceso a tu Google Calendar</li>
                  <li>Vuelve aquí y haz clic en <span className="font-bold">"Recargar"</span></li>
                </ol>
              </div>
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                  <p className="font-semibold mb-1">Error técnico:</p>
                  <p>{error}</p>
                </div>
              )}
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
