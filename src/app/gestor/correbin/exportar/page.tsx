'use client';

import { useState } from 'react';
import {
  Download, FolderOpen, CalendarDays, Users, TrendingUp, FileX, ArrowLeftRight,
  Target, BellRing, AlertTriangle, Crown, FlaskConical, Trash2, Loader,
} from 'lucide-react';
import { Card, btnPrimario, btnSecundario } from '../ui';

const EXPORTACIONES = [
  { tipo: 'cartera', icono: FolderOpen, nombre: 'Cartera viva', desc: 'Todas las pólizas vivas con prima, comisión, vencimiento, responsable y prioridad.' },
  { tipo: 'vencimientos', icono: CalendarDays, nombre: 'Vencimientos', desc: 'Todos los vencimientos con estado comercial, próxima acción y teléfono.' },
  { tipo: 'produccion', icono: TrendingUp, nombre: 'Producción', desc: 'Emisiones clasificadas: distingue cartera nueva real de movimiento técnico.' },
  { tipo: 'anulaciones', icono: FileX, nombre: 'Anulaciones', desc: 'Bajas con motivo y si restan cartera o son técnicas.' },
  { tipo: 'mediador', icono: ArrowLeftRight, nombre: 'Cambios de mediador', desc: 'Prima incorporada y pendiente de entrar a código.' },
  { tipo: 'pipeline', icono: Target, nombre: 'Pipeline', desc: 'Oportunidades con probabilidad y próxima acción.' },
  { tipo: 'tareas', icono: BellRing, nombre: 'Tareas abiertas', desc: 'Pendientes, en curso y bloqueadas con responsable.' },
  { tipo: 'clientes', icono: Users, nombre: 'Clientes por prioridad', desc: 'Todos los clientes ordenados A → D con totales.' },
  { tipo: 'cuentas_a_sin_accion', icono: Crown, nombre: 'Cuentas A sin acción', desc: 'Cuentas estratégicas sin tarea ni próxima acción abierta.' },
  { tipo: 'incompletas', icono: AlertTriangle, nombre: 'Pólizas incompletas', desc: 'Sin prima o sin vencimiento: lo que hay que completar.' },
];

export default function ExportarPage() {
  const [cargando, setCargando] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  async function seed(metodo: 'POST' | 'DELETE') {
    if (metodo === 'DELETE' && !confirm('¿Eliminar TODOS los datos de prueba [DEMO]?')) return;
    setCargando(metodo); setMsg('');
    try {
      const res = await fetch('/api/correbin/seed', { method: metodo });
      const json = await res.json();
      setMsg(res.ok ? (json.mensaje || `✓ Hecho (${json.eliminados ?? ''})`) : (json.error || 'Error'));
    } catch {
      setMsg('Error de conexión.');
    } finally {
      setCargando(null);
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-xl font-black text-foreground">Exportaciones</h2>
        <p className="text-xs text-muted mt-0.5">
          Excel listos para trabajar. En Cartera, Clientes y las demás pantallas, el botón &quot;Exportar&quot; respeta los filtros aplicados.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {EXPORTACIONES.map(({ tipo, icono: Icono, nombre, desc }) => (
          <Card key={tipo} className="!p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-secondary/15 border border-secondary/30 flex items-center justify-center shrink-0">
                  <Icono className="w-4 h-4 text-secondary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm">{nombre}</h3>
                  <p className="text-[11px] text-muted mt-0.5">{desc}</p>
                </div>
              </div>
              <a href={`/api/correbin/exportar?tipo=${tipo}`} className={`${btnSecundario} shrink-0 !px-3`} download title={`Descargar ${nombre}`}>
                <Download className="w-4 h-4" />
              </a>
            </div>
          </Card>
        ))}
      </div>

      {/* Datos de prueba */}
      <Card className="border-dashed">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
              <FlaskConical className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Datos de prueba</h3>
              <p className="text-[11px] text-muted mt-0.5 max-w-md">
                Crea un juego realista: cuenta A de transporte, pyme, ayuntamiento, particular selectivo,
                pólizas incompletas, oportunidad sin acción, anulación real vs técnica y cambio de mediador en trámite.
                Se marcan con [DEMO] y se pueden borrar de golpe.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => seed('POST')} disabled={!!cargando} className={btnPrimario}>
              {cargando === 'POST' ? <Loader className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
              Crear datos de prueba
            </button>
            <button onClick={() => seed('DELETE')} disabled={!!cargando} className={`${btnSecundario} !text-red-400`}>
              {cargando === 'DELETE' ? <Loader className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Eliminar [DEMO]
            </button>
          </div>
        </div>
        {msg && <p className="text-xs mt-3 text-secondary">{msg}</p>}
      </Card>
    </div>
  );
}
