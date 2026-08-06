'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Sun, AlertTriangle, Check, Target, ArrowRight, Flame, MapPin, CalendarDays, ChevronDown } from 'lucide-react';
import {
  LuzCliente, LuzCups, LuzFechaCritica, LuzOportunidad, LuzTarea, LuzVisita,
  PIPELINE_CERRADO, diasHasta, fmtFecha,
} from '@/lib/luz';
import { construirAgenda, esDe, ItemAgenda } from '@/lib/agenda';
import { planDelDia, esDiaDeCalle } from '@/lib/plan-rutas';
import { ZONAS } from '@/lib/zonas';
import { fmtEur0 } from '@/lib/correbin';
import { useUsuario } from '@/lib/usuario';
import { Card, EstadoCarga, useListaLuz, guardarLuz, SelectorResponsable } from '../ui';
import { ClientesEnMarcha, contarEnMarcha } from './clientes-en-marcha';
import { AccionesContacto } from '../acciones-contacto';
import { FotoSitio } from '../foto-sitio';
import { BotonRuta } from '../boton-ruta';
import { ResolverVisita } from '../resolver-visita';
import { MontarRuta } from './montar-ruta';
import { VistaCalle } from '../agenda/calle';
import { CalendarioAgenda } from '../agenda/calendario';
import { PanelAplazar } from '../agenda/aplazar';
import { ProspectoGuardado } from '@/lib/prospeccion';

/**
 * MI DÍA — la única pantalla de trabajo de David.
 *
 * Antes esto y la Agenda eran dos entradas de menú distintas que llamaban a la
 * MISMA función (`construirAgenda`) sobre los MISMOS registros. Mi Día era la
 * Agenda filtrada por «yo» y por «hoy»: no se parecían, es que una era un
 * subconjunto de la otra. Por eso se mezclaban, y por eso están juntas.
 *
 * Tres vistas de lo mismo, según lo que se esté haciendo:
 *
 *   HOY        · qué hago ahora. Es la que se abre, porque es la pregunta de
 *                cada mañana. Atrasado y de hoy van juntos: para quien está en
 *                la calle son lo mismo, hay que hacerlo YA.
 *   POR ZONA   · qué hago cuando salgo. Agrupa por municipio, no por fecha:
 *                nadie conduce a una fecha, se conduce a Tamarite. Aquí se
 *                monta la ruta.
 *   CALENDARIO · qué me espera. Para mirar la semana, no para trabajar.
 *
 * La vista elegida se recuerda, así que quien siempre usa la misma no tiene
 * que volver a elegirla cada día.
 *
 * Los clientes A mandan: salen primero y con la banda roja.
 */

/**
 * Acceso plegable del pie de la vista Hoy.
 *
 * Lo de abajo no es trabajo de ahora: es consulta. Antes iban los cuatro
 * bloques desplegados uno detrás de otro y había que bajar media pantalla
 * para llegar al último, así que en la práctica no se veían. Ahora cada uno
 * es una línea con su número y se abre solo si hace falta.
 */
function Plegable({ titulo, cuenta, tono = 'normal', abierto, onToggle, children }: {
  titulo: string;
  cuenta: number;
  tono?: 'normal' | 'aviso';
  abierto: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const vacio = cuenta === 0;
  return (
    <div className="rounded-xl border border-border/40 bg-card/40 overflow-hidden">
      <button
        onClick={onToggle}
        disabled={vacio}
        className={`w-full min-h-[44px] flex items-center gap-3 px-3 py-2.5 text-left transition ${
          vacio ? 'opacity-50 cursor-default' : 'hover:bg-card/70'
        }`}
      >
        <span className={`text-lg font-black tabular-nums shrink-0 w-7 text-center ${
          vacio ? 'text-muted/50' : tono === 'aviso' ? 'text-amber-300' : 'text-foreground'
        }`}>
          {cuenta}
        </span>
        <span className="min-w-0 flex-1 text-sm font-bold text-foreground">{titulo}</span>
        {!vacio && (
          <ChevronDown className={`w-4 h-4 text-muted shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} />
        )}
      </button>
      {abierto && !vacio && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

/** Las tres formas de mirar lo mismo. Ninguna trae registros que no traigan las otras. */
type Vista = 'hoy' | 'zona' | 'calendario';

const VISTAS: { id: Vista; nombre: string; icono: typeof Sun; pista: string }[] = [
  { id: 'hoy', nombre: 'Hoy', icono: Sun, pista: 'Qué hago ahora' },
  { id: 'zona', nombre: 'Por zona', icono: MapPin, pista: 'Para salir a la calle' },
  { id: 'calendario', nombre: 'Calendario', icono: CalendarDays, pista: 'Qué me espera' },
];

const CLAVE_VISTA = 'gesmeco:mi-dia:vista';

/** Peso de cada prioridad: A primero. Lo urgente de un cliente A vale más. */
const PESO: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

/** Banda de color lateral según la prioridad del cliente: se reconoce sin leer. */
const BANDA: Record<string, string> = {
  A: 'border-l-4 border-l-red-500',
  B: 'border-l-4 border-l-amber-400',
  C: 'border-l-4 border-l-border/40',
  D: 'border-l-4 border-l-border/20',
};

const saludo = () => {
  const h = new Date().getHours();
  return h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
};

export default function MiDiaPage() {
  const { perfil, cargando: cargandoPerfil, esAdmin } = useUsuario();
  const [verComo, setVerComo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState('');

  const clientes = useListaLuz<LuzCliente>('clientes');
  const cups = useListaLuz<LuzCups>('cups');
  const fechas = useListaLuz<LuzFechaCritica>('fechas', { estado: 'pendiente' });
  const pipeline = useListaLuz<LuzOportunidad>('pipeline');
  const tareas = useListaLuz<LuzTarea>('tareas');
  // Solo los que Marcos ha marcado para que vaya David: el resto del mapa no
  // es trabajo decidido, y meterlo aquí sería devolverle el problema de elegir.
  const prospectos = useListaLuz<ProspectoGuardado>('prospectos', { estado: 'para_visitar' });
  // Las visitas alimentan el marcador de puertas de la vista por zona.
  const visitas = useListaLuz<LuzVisita>('visitas');

  const persona = verComo ?? perfil?.responsable ?? null;
  /** Quién puede mirar el día de otro: administradores y quien tenga el permiso. */
  const puedeVerAOtros = esAdmin || !!perfil?.permisos?.ver_dia_equipo;
  const mirandoAOtro = !!verComo && verComo !== perfil?.responsable;
  const cargando = cargandoPerfil || tareas.cargando || cups.cargando || fechas.cargando;

  const dia = useMemo(() => {
    if (!persona) return null;

    // Misma fuente que la Agenda: tareas + vencimientos calculados del CUPS + fechas manuales
    const todo = construirAgenda({
      tareas: tareas.datos, cups: cups.datos, fechas: fechas.datos, pipeline: pipeline.datos,
    }).filter((i) => esDe(i.responsable, persona));

    const ordenar = (a: ItemAgenda, b: ItemAgenda) =>
      (PESO[a.prioridad] ?? 2) - (PESO[b.prioridad] ?? 2) || (a.dias ?? 99) - (b.dias ?? 99);

    // Atrasado y de hoy van juntos: para quien está en la calle es lo mismo.
    const hoy = todo.filter((i) => i.dias != null && i.dias <= 0).sort(ordenar);
    const manana = todo.filter((i) => i.dias === 1).sort(ordenar);
    const despues = todo.filter((i) => i.dias != null && i.dias > 1);
    const sinFecha = todo.filter((i) => i.dias == null);

    // Cuántas ha cerrado ya hoy (aproximado: tareas completadas con fecha de hoy)
    const hechasHoy = tareas.datos.filter(
      (t) => esDe(t.responsable, persona) && t.estado === 'completada' && diasHasta(t.fecha_limite) === 0
    ).length;

    // Oportunidades suyas que están paradas: sin próxima acción o con la acción pasada
    const miPipe = pipeline.datos.filter(
      (o) => esDe(o.responsable, persona) && !PIPELINE_CERRADO.includes(o.estado) && o.estado !== 'revisar_adelante'
    );
    const paradas = miPipe.filter((o) => !o.proxima_accion || (diasHasta(o.fecha_proxima_accion) ?? 1) < 0);

    return {
      hoy, manana, despues, sinFecha, hechasHoy,
      atrasadas: hoy.filter((i) => (i.dias ?? 0) < 0).length,
      clientesA: hoy.filter((i) => i.prioridad === 'A').length,
      paradas,
      misClientes: clientes.datos.filter((c) => esDe(c.responsable, persona)),
      comisionEnJuego: miPipe.reduce((s, o) => s + (Number(o.comision_potencial) || 0), 0),
    };
  }, [persona, tareas.datos, cups.datos, fechas.datos, pipeline.datos, clientes.datos]);

  // Teléfono, dirección y foto de cada cliente: la agenda no los lleva, y son
  // justo lo que hace falta para llamar o arrancar la navegación desde aquí
  const fichaCliente = useMemo(
    () => new Map(clientes.datos.map((c) => [c.id, c])),
    [clientes.datos]
  );

  // La vista se recuerda: quien siempre trabaja por zona no tiene que elegirla cada día.
  const [vista, setVista] = useState<Vista>('hoy');
  const [aplazando, setAplazando] = useState<string | null>(null);
  // Solo uno abierto a la vez: si se pudieran abrir todos, volvería a ser la
  // misma pantalla larga que había antes.
  const [pieAbierto, setPieAbierto] = useState<string | null>(null);
  const [ancla, setAncla] = useState(new Date());
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  // Todo lo de la persona, sin recortar por fecha: es lo que consumen las
  // vistas por zona y calendario. La vista de Hoy trabaja con `dia`, que es
  // este mismo conjunto partido por días.
  const mios = useMemo(() => {
    if (!persona) return [] as ItemAgenda[];
    return construirAgenda({
      tareas: tareas.datos, cups: cups.datos, fechas: fechas.datos, pipeline: pipeline.datos,
    }).filter((i) => esDe(i.responsable, persona));
  }, [persona, tareas.datos, cups.datos, fechas.datos, pipeline.datos]);

  // Puertas de hoy: visitas registradas con fecha de hoy. Es el único número que
  // mide lo que de verdad depende de David, y por eso va arriba de la vista de zona.
  const visitasHoy = useMemo(() => {
    const h = new Date();
    const iso = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
    return visitas.datos.filter((v) => String(v.fecha || '').slice(0, 10) === iso
      && (!persona || esDe(v.responsable, persona))).length;
  }, [visitas.datos, persona]);

  // En calendario manda el día elegido; en zona van todos.
  const delCalendario = useMemo(() => (
    diaSel === 'sin_fecha' ? mios.filter((i) => !i.fecha)
      : diaSel ? mios.filter((i) => i.fecha?.slice(0, 10) === diaSel)
      : []
  ), [mios, diaSel]);

  /** Cliente cuya visita se está resolviendo, si hay alguno. */
  const [visitando, setVisitando] = useState<{ id: string; nombre: string; responsable?: string | null } | null>(null);

  async function completar(i: ItemAgenda) {
    if (!i.id) return;
    setOcupado(i.clave);
    const err = i.origen === 'tarea'
      ? await guardarLuz('tareas', 'PUT', { id: i.id, estado: 'completada' })
      : await guardarLuz('fechas', 'PUT', { id: i.id, estado: 'completada' });
    setOcupado('');
    if (err) { setMsg(`⚠️ ${err}`); return; }
    setMsg('✓ Hecho.');
    if (i.origen === 'tarea') tareas.recargar(); else fechas.recargar();
  }

  /** Mover de día dejando el motivo escrito en el historial del registro. */
  async function aplazar(item: ItemAgenda, fechaNueva: string, motivo: string) {
    if (!item.id) return;
    setOcupado(item.clave);
    const sello = new Date().toLocaleDateString('es-ES');
    const linea = `[${sello}] Movida ${item.fecha ? `del ${fmtFecha(item.fecha)} ` : ''}al ${fmtFecha(fechaNueva)} · ${motivo}`;
    let err: string | null;
    if (item.origen === 'tarea') {
      const t = tareas.datos.find((x) => x.id === item.id);
      err = await guardarLuz('tareas', 'PUT', {
        id: item.id, fecha_limite: fechaNueva,
        notas: t?.notas ? `${t.notas}\n${linea}` : linea,
      });
    } else {
      const f = fechas.datos.find((x) => x.id === item.id);
      err = await guardarLuz('fechas', 'PUT', {
        id: item.id, fecha: fechaNueva,
        descripcion: f?.descripcion ? `${f.descripcion}\n${linea}` : linea,
      });
    }
    setOcupado(''); setAplazando(null);
    if (err) { setMsg(`⚠️ ${err}`); return; }
    setMsg('✓ Movida de día.');
    if (item.origen === 'tarea') tareas.recargar(); else fechas.recargar();
  }

  // La vista elegida se recuerda entre sesiones. Se lee en un efecto y no en
  // el estado inicial para no romper el render del servidor.
  useEffect(() => {
    const guardada = localStorage.getItem(CLAVE_VISTA);
    if (guardada === 'hoy' || guardada === 'zona' || guardada === 'calendario') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVista(guardada);
    }
  }, []);

  function cambiarVista(v: Vista) {
    setVista(v);
    setMsg('');
    localStorage.setItem(CLAVE_VISTA, v);
  }

  /** Recarga todo lo que puede haber cambiado al resolver una visita. */
  function recargarTodo() {
    tareas.recargar(); fechas.recargar(); pipeline.recargar(); clientes.recargar(); visitas.recargar();
  }

  /**
   * Una acción. El NOMBRE DEL CLIENTE es el titular —así se identifica de un
   * vistazo desde el coche—; lo que hay que hacer va justo debajo.
   * Botón grande, pensado para el dedo.
   */
  const Accion = ({ i, apagado = false }: { i: ItemAgenda; apagado?: boolean }) => {
    const atrasada = (i.dias ?? 0) < 0;
    const conNombre = !!i.clienteNombre;
    const ficha = i.clienteId ? fichaCliente.get(i.clienteId) : null;
    const Contenido = (
      <>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {i.prioridad === 'A' && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30 text-[9px] font-black uppercase">
                <Flame className="w-2.5 h-2.5" /> Cliente A
              </span>
            )}
            {atrasada && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[9px] font-black uppercase">
                {Math.abs(i.dias!)} {Math.abs(i.dias!) === 1 ? 'día' : 'días'} de retraso
              </span>
            )}
          </div>
          {/* Titular: quién. Lo que más rápido tiene que reconocer. */}
          <p className="text-[17px] font-black text-foreground leading-tight truncate">
            {conNombre ? i.clienteNombre : i.titulo}
          </p>
          {/* Debajo: qué hay que hacer con él, y en qué punto del embudo está */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-[13px] font-semibold text-accent leading-snug">
              {conNombre ? i.titulo : i.tipoLabel}
            </p>
            {i.estadoPipelineLabel && (
              <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-black uppercase ${i.estadoPipelineTono}`}>
                {i.estadoPipelineLabel}
              </span>
            )}
          </div>
        </div>
      </>
    );

    return (
      <div className={`fv-fade-in rounded-xl bg-card/60 ${BANDA[i.prioridad] || BANDA.C} ${apagado ? 'opacity-70' : ''} p-3`}>
        <div className="flex items-center gap-3">
        {/* La foto del sitio: reconocer la nave antes de llegar vale media visita */}
        <FotoSitio path={ficha?.foto_path} alt={i.clienteNombre || ''} className="h-14 w-14" />
        {i.clienteId ? (
          <Link href={`/gestor/luz/clientes/${i.clienteId}`} className="min-w-0 flex-1 flex group">
            {Contenido}
          </Link>
        ) : (
          <div className="min-w-0 flex-1 flex">{Contenido}</div>
        )}
        {i.editable ? (
          <button
            onClick={() => completar(i)}
            disabled={ocupado === i.clave}
            className="shrink-0 h-12 w-12 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/25 active:scale-95 transition disabled:opacity-40"
            title="Hecho"
            aria-label="Marcar como hecho"
          >
            <Check className="w-6 h-6" />
          </button>
        ) : (
          <span className="shrink-0 text-[9px] font-bold text-muted/50 uppercase text-center w-12 leading-tight">Aviso<br />auto</span>
        )}
        </div>
        {/* Llamar, WhatsApp y navegación: lo que de verdad se pulsa desde la furgoneta */}
        {ficha && (
          <div className="mt-2 pt-2 border-t border-border/25 flex flex-wrap items-center gap-2">
            <AccionesContacto
              telefono={ficha.telefono}
              ubicacion={ficha.direccion_fiscal}
              nombre={ficha.nombre}
            />
            {/* Si al ver la acción decide ir en persona, la ruta se arma desde aquí */}
            <BotonRuta
              cliente={ficha}
              tareaId={i.origen === 'tarea' ? i.id ?? undefined : undefined}
              tareaDesc={i.titulo}
            />
            {/* Y al salir de la puerta, en qué quedó. Es el dato que mueve
                todo lo demás, así que el botón está donde ya está mirando. */}
            <button
              onClick={() => setVisitando({ id: ficha.id, nombre: ficha.nombre, responsable: ficha.responsable })}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-accent/50 bg-accent/15 text-accent text-[11px] font-bold hover:bg-accent/25 transition"
            >
              ✅ Ya he ido
            </button>
          </div>
        )}
      </div>
    );
  };

  const nada = dia && dia.hoy.length === 0;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Sun className="w-6 h-6 text-amber-400" />
            {persona ? `${saludo()}, ${persona.split(' ')[0]}` : 'Mi Día'}
          </h2>
          <p className="text-xs text-muted mt-0.5 capitalize">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        {/* Ver el día de otro: los administradores siempre, y quien tenga el
            permiso de seguimiento del equipo (quien revisa las rutas necesita
            mirar el día del comercial sin cambiar de cuenta). Es solo lectura:
            lo que se marque desde aquí se guarda a nombre de esa persona. */}
        {puedeVerAOtros && !cargandoPerfil && (
          <div className="flex items-center gap-2">
            {mirandoAOtro && (
              <span className="text-[11px] font-bold text-amber-300 whitespace-nowrap">
                👀 Viendo el día de
              </span>
            )}
            <SelectorResponsable
              valor={persona}
              onCambio={(v) => setVerComo(v)}
              className="rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 text-xs font-semibold"
            />
            {mirandoAOtro && (
              <button
                onClick={() => setVerComo(null)}
                className="text-[11px] font-bold text-accent hover:underline whitespace-nowrap"
              >
                Volver al mío
              </button>
            )}
          </div>
        )}
      </div>

      {/* Las tres formas de mirar lo mismo. Botones de 44 px: se usan desde el
          coche y con el pulgar, así que no pueden ser pastillas pequeñas. */}
      {!cargando && persona && (
        <div className="grid grid-cols-3 gap-2">
          {VISTAS.map((v) => {
            const Ico = v.icono;
            const activa = vista === v.id;
            return (
              <button
                key={v.id}
                onClick={() => cambiarVista(v.id)}
                className={`min-h-[44px] rounded-xl border px-2 py-2 transition text-center ${
                  activa
                    ? 'bg-accent text-white border-accent shadow-sm'
                    : 'bg-card/70 border-border/50 text-muted hover:text-foreground'
                }`}
              >
                <span className="flex items-center justify-center gap-1.5 text-sm font-bold">
                  <Ico className="w-4 h-4" /> {v.nombre}
                </span>
                <span className={`block text-[10px] mt-0.5 ${activa ? 'text-white/80' : 'text-muted'}`}>
                  {v.pista}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {msg && <p className="fv-fade-in text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5">{msg}</p>}

      <EstadoCarga cargando={cargando} error={tareas.error} faltaMigracion={tareas.faltaMigracion} vacio={false} textoVacio="" sqlFile="supabase_luz.sql" />

      {!cargando && !persona && (
        <Card className="text-center py-10 space-y-2">
          <AlertTriangle className="w-8 h-8 mx-auto text-amber-400" />
          <p className="text-sm font-bold">Tu usuario no tiene un responsable comercial vinculado.</p>
          <p className="text-xs text-muted">
            Un administrador debe asignarte en Usuarios y Permisos → tu usuario → &quot;Responsable comercial vinculado&quot;.
          </p>
        </Card>
      )}

      {!cargando && persona && dia && vista === 'hoy' && (
        <>
          {/* El número del día: lo primero y lo único que importa al abrir */}
          <Card className="!p-5 relative overflow-hidden text-center">
            <div className={`absolute inset-0 pointer-events-none bg-gradient-to-br ${
              nada ? 'from-emerald-500/10 to-transparent' : dia.atrasadas > 0 ? 'from-red-500/10 to-transparent' : 'from-accent/10 to-transparent'
            }`} />
            <div className="relative">
              {nada ? (
                <>
                  <p className="text-5xl">🎉</p>
                  <p className="text-lg font-black text-emerald-400 mt-1">Día limpio</p>
                  <p className="text-xs text-muted">No tienes nada pendiente para hoy.</p>
                </>
              ) : (
                <>
                  <p className={`text-6xl font-black tabular-nums leading-none ${dia.atrasadas > 0 ? 'text-red-400' : 'text-foreground'}`}>
                    {dia.hoy.length}
                  </p>
                  <p className="text-sm font-bold text-foreground mt-1">
                    {dia.hoy.length === 1 ? 'cosa para hoy' : 'cosas para hoy'}
                  </p>
                  <div className="flex items-center justify-center gap-2 flex-wrap mt-2">
                    {dia.atrasadas > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30 text-[11px] font-black uppercase">
                        {dia.atrasadas} de días anteriores
                      </span>
                    )}
                    {dia.clientesA > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/25 text-[11px] font-black uppercase">
                        🔥 {dia.clientesA} de cliente A
                      </span>
                    )}
                    {dia.hechasHoy > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-black uppercase">
                        ✓ {dia.hechasHoy} ya hechas
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Los días de calle, adónde toca ir. Va ANTES de la lista porque es
              lo primero que hay que saber al abrir la pantalla por la mañana:
              decide si el día es de coche o de teléfono. */}
          {esDiaDeCalle(new Date()) && (() => {
            const plan = planDelDia(new Date());
            const zona = ZONAS.find((z) => z.id === plan.zonaId);
            return (
              <button onClick={() => cambiarVista('zona')} className="block w-full text-left">
                <Card className="!p-3 border-accent/30 hover:border-accent/50 transition flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-accent shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground">
                      Hoy toca calle{zona ? `: ${zona.nombre}` : ''}
                    </p>
                    <p className="text-[11px] text-muted">
                      {plan.objetivos.puertas} puertas y {plan.objetivos.facturas} facturas · {plan.franja} — monta la ruta en «Por zona»
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted shrink-0" />
                </Card>
              </button>
            );
          })()}

          {/* HOY */}
          {dia.hoy.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-foreground">Hoy</p>
              <div className="space-y-2">{dia.hoy.map((i) => <Accion key={i.clave} i={i} />)}</div>
            </div>
          )}

          {/* ── LO QUE NO ES DE AHORA ────────────────────────────────────
              Cuatro accesos plegados, uno por línea, con su número delante.
              Antes iban los cuatro desplegados y había que bajar media
              pantalla para llegar al último: en la práctica no se veían. */}
          <div className="pt-1 space-y-2">
            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-muted/70 px-1">
              Para mirar, no para hacer ahora
            </p>

            <Plegable
              titulo="Mañana"
              cuenta={dia.manana.length}
              abierto={pieAbierto === 'manana'}
              onToggle={() => setPieAbierto(pieAbierto === 'manana' ? null : 'manana')}
            >
              {dia.manana.map((i) => <Accion key={i.clave} i={i} apagado />)}
            </Plegable>

            <Plegable
              titulo="Clientes en marcha"
              cuenta={contarEnMarcha(dia.misClientes)}
              abierto={pieAbierto === 'marcha'}
              onToggle={() => setPieAbierto(pieAbierto === 'marcha' ? null : 'marcha')}
            >
              <ClientesEnMarcha clientes={dia.misClientes} pipeline={pipeline.datos} />
            </Plegable>

            {/* Las paradas llevan al pipeline, así que no se pliegan: es un salto. */}
            {dia.paradas.length > 0 && (
              <Link href="/gestor/luz/pipeline" className="block">
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition min-h-[44px] flex items-center gap-3 px-3 py-2.5">
                  <span className="text-lg font-black tabular-nums text-amber-300 shrink-0 w-7 text-center">
                    {dia.paradas.length}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground">
                      {dia.paradas.length === 1 ? 'Oportunidad parada' : 'Oportunidades paradas'}
                    </p>
                    <p className="text-[11px] text-muted">
                      Sin próxima acción o con la fecha pasada · {fmtEur0(dia.comisionEnJuego)} en juego
                    </p>
                  </div>
                  <Target className="w-4 h-4 text-amber-300 shrink-0" />
                </div>
              </Link>
            )}

            {/* Lo de más allá de mañana está en otra vista de esta misma pantalla. */}
            <button onClick={() => cambiarVista('calendario')} className="block w-full text-left">
              <div className="rounded-xl border border-border/40 bg-card/40 hover:bg-card/70 transition min-h-[44px] flex items-center gap-3 px-3 py-2.5">
                <span className="text-lg font-black tabular-nums text-foreground shrink-0 w-7 text-center">
                  {dia.despues.length}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">Más adelante</p>
                  {dia.sinFecha.length > 0 && (
                    <p className="text-[11px] text-muted">{dia.sinFecha.length} sin fecha puesta</p>
                  )}
                </div>
                <CalendarDays className="w-4 h-4 text-muted shrink-0" />
              </div>
            </button>
          </div>
        </>
      )}

      {/* La visita se resuelve encima de todo, sin cambiar de pantalla */}
      {visitando && (
        <ResolverVisita
          clienteId={visitando.id}
          clienteNombre={visitando.nombre}
          responsable={visitando.responsable}
          pipelineId={pipeline.datos.find((o) => o.cliente_id === visitando.id && !PIPELINE_CERRADO.includes(o.estado))?.id || null}
          onCerrar={() => setVisitando(null)}
          onHecho={() => {
            setVisitando(null);
            // Todo se mueve a la vez: la visita cambia tareas, pipeline y cliente
            recargarTodo(); cups.recargar();
            setMsg('✓ Visita registrada.');
          }}
        />
      )}

      {/* ── POR ZONA ──────────────────────────────────────────────────────
          Agrupa por municipio y no por fecha, que es la diferencia entre una
          lista y un plan: nadie conduce a una fecha, se conduce a Tamarite, y
          allí se hace todo lo de Tamarite aunque venza dentro de tres semanas,
          porque volver cuesta 40 km. Aquí es donde se monta la ruta. */}
      {!cargando && persona && vista === 'zona' && (
        <div className="space-y-4">
          {/* El plan del día va arriba: primero se decide adónde se va y luego
              se mira qué hay allí. Al revés se sale sin ruta y se improvisa. */}
          <MontarRuta
            clientes={clientes.datos.filter((c) => esDe(c.responsable, persona))}
            cups={cups.datos}
            prospectos={prospectos.datos}
          />
          <VistaCalle
            items={mios}
            clientes={clientes.datos}
            cups={cups.datos}
            visitasHoy={visitasHoy}
            onResolverVisita={(id, nombre) => setVisitando({ id, nombre, responsable: persona })}
            onAplazar={(i) => setAplazando(i.clave)}
            onCompletar={completar}
            ocupado={ocupado}
          />
        </div>
      )}

      {/* ── CALENDARIO ────────────────────────────────────────────────────
          Para mirar la semana, no para trabajar. Al elegir un día se listan
          sus acciones con los mismos botones que en Hoy. */}
      {!cargando && persona && vista === 'calendario' && (
        <div className="space-y-3">
          <CalendarioAgenda items={mios} ancla={ancla} setAncla={setAncla} diaSel={diaSel} setDiaSel={setDiaSel} />
          {diaSel && (
            <div className="space-y-2">
              {delCalendario.length === 0 ? (
                <Card className="text-center py-6">
                  <p className="text-sm text-muted">Nada para ese día.</p>
                </Card>
              ) : (
                delCalendario.map((i) => <Accion key={i.clave} i={i} />)
              )}
            </div>
          )}
          {!diaSel && (
            <p className="text-center text-xs text-muted py-2">Toca un día para ver lo que hay.</p>
          )}
        </div>
      )}

      {/* Aplazar exige motivo: mover una acción de día sin decir por qué es lo
          que hace que una lista deje de significar nada al cabo de un mes. */}
      {aplazando && (() => {
        const item = mios.find((i) => i.clave === aplazando);
        return item ? (
          <PanelAplazar
            item={item}
            onCancelar={() => setAplazando(null)}
            onConfirmar={(fecha, motivo) => aplazar(item, fecha, motivo)}
            ocupado={ocupado === item.clave}
          />
        ) : null;
      })()}
    </div>
  );
}
