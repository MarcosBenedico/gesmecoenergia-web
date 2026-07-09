'use client';

import { Download, FolderOpen, CalendarDays, Users } from 'lucide-react';
import { Card, btnPrimario } from '../ui';

const EXPORTACIONES = [
  {
    tipo: 'cartera',
    icono: FolderOpen,
    nombre: 'Cartera viva completa',
    descripcion: 'Todas las pólizas vivas con cliente, compañía, prima y vencimiento, ordenadas por fecha.',
  },
  {
    tipo: 'vencimientos',
    icono: CalendarDays,
    nombre: 'Vencimientos próximos (90 días)',
    descripcion: 'La lista de trabajo comercial: pólizas que vencen en los próximos 90 días con teléfono del cliente.',
  },
  {
    tipo: 'clientes',
    icono: Users,
    nombre: 'Listado de clientes',
    descripcion: 'Todos los clientes con datos de contacto, tipo y responsable.',
  },
];

export default function ExportarPage() {
  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-xl font-black text-foreground">Exportaciones</h2>
        <p className="text-xs text-muted mt-0.5">Excel listos para trabajar, imprimir o compartir con el equipo.</p>
      </div>

      {EXPORTACIONES.map(({ tipo, icono: Icono, nombre, descripcion }) => (
        <Card key={tipo}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-secondary/15 border border-secondary/30 flex items-center justify-center shrink-0">
                <Icono className="w-4 h-4 text-secondary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm">{nombre}</h3>
                <p className="text-xs text-muted mt-0.5">{descripcion}</p>
              </div>
            </div>
            <a href={`/api/correbin/exportar?tipo=${tipo}`} className={btnPrimario} download>
              <Download className="w-4 h-4" />
              Descargar
            </a>
          </div>
        </Card>
      ))}
    </div>
  );
}
