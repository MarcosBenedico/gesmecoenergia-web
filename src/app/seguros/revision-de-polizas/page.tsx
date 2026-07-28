import type { Metadata } from 'next';
import { CORREBIN_REVISION, CORREBIN_COLORES as C } from '@/lib/correbin-marca';
import { Seccion, Encabezado, Lista, Tarjeta, Antetitulo } from '../ui';
import { Suspense } from 'react';
import { FormularioSeguros, CampoForm } from '../formulario';

export const metadata: Metadata = {
  title: 'Revisión de pólizas · Correbin Asociados',
  description:
    'Diagnóstico inicial del programa de seguros: mapa de pólizas, calendario de vencimientos, carencias, duplicidades, capitales y límites.',
};

/** Campos iniciales del Volumen III: lo justo para poder trabajar. */
const CAMPOS: CampoForm[] = [
  { campo: 'nombre', etiqueta: 'Nombre y apellidos', tipo: 'text', requerido: true },
  { campo: 'empresa', etiqueta: 'Empresa', tipo: 'text' },
  { campo: 'nif', etiqueta: 'NIF / CIF', tipo: 'text' },
  { campo: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', requerido: true },
  { campo: 'email', etiqueta: 'Correo electrónico', tipo: 'email' },
  { campo: 'localidad', etiqueta: 'Localidad', tipo: 'text' },
  { campo: 'sector', etiqueta: 'Sector de actividad', tipo: 'text' },
  { campo: 'proximo_vencimiento', etiqueta: 'Próximo vencimiento', tipo: 'date', ayuda: 'Si lo sabes, aunque sea aproximado' },
  { campo: 'motivo', etiqueta: 'Motivo de la consulta', tipo: 'text', ancho: true },
  { campo: 'mensaje', etiqueta: 'Cuéntanos lo que quieras', tipo: 'textarea' },
];

/** Campos que agilizan el análisis, plegados para no abrumar. */
const OPCIONALES: CampoForm[] = [
  { campo: 'empleados', etiqueta: 'Nº de empleados', tipo: 'number' },
  { campo: 'facturacion', etiqueta: 'Facturación aproximada (€)', tipo: 'number' },
  { campo: 'centros', etiqueta: 'Nº de centros', tipo: 'number' },
  { campo: 'vehiculos', etiqueta: 'Nº de vehículos', tipo: 'number' },
  { campo: 'siniestralidad', etiqueta: 'Siniestralidad relevante', tipo: 'text', ancho: true },
];

export default function RevisionDePolizas() {
  return (
    <>
      <section className="border-b" style={{ borderColor: C.borde }}>
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <Antetitulo>Revisión de pólizas</Antetitulo>
          <h1 className="text-4xl md:text-5xl font-black leading-[1.1] tracking-tight max-w-4xl" style={{ color: C.azul }}>
            {CORREBIN_REVISION.h1}
          </h1>
          <div className="mt-8 max-w-3xl">
            <Lista puntos={CORREBIN_REVISION.argumentos} />
          </div>
        </div>
      </section>

      <Seccion alt>
        <div className="grid lg:grid-cols-[1fr_1fr] gap-12 items-start">
          <div>
            <Encabezado
              ante="Qué recibes"
              titulo="Un diagnóstico que se entiende"
              texto="Documentos que sirven para decidir, no para archivar."
            />
            <p className="mt-5 text-sm leading-relaxed font-semibold" style={{ color: C.azul }}>
              {CORREBIN_REVISION.matiz}
            </p>
          </div>
          <Tarjeta>
            <Lista puntos={CORREBIN_REVISION.entregables} tono="azul" />
          </Tarjeta>
        </div>
      </Seccion>

      <Seccion id="formulario">
        <div className="max-w-3xl">
          <Encabezado
            ante="Solicitar"
            titulo={CORREBIN_REVISION.cta}
            texto="Con estos datos podemos preparar la primera conversación. Lo demás lo vemos por teléfono o en persona."
          />
        </div>
        <div className="mt-8 max-w-3xl">
          <Suspense fallback={<div className="rounded-2xl border p-8" style={{ borderColor: C.borde }} />}>
            <FormularioSeguros
              tipo="revision"
              campos={CAMPOS}
              opcionales={OPCIONALES}
              textoBoton={CORREBIN_REVISION.cta}
            />
          </Suspense>
        </div>
      </Seccion>
    </>
  );
}
