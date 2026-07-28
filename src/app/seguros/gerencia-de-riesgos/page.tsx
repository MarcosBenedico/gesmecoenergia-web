import type { Metadata } from 'next';
import { CORREBIN_GERENCIA, CORREBIN_CTA, CORREBIN_COLORES as C } from '@/lib/correbin-marca';
import { Seccion, Encabezado, Lista, Tarjeta, Aviso, SiguientePaso, Antetitulo } from '../ui';

export const metadata: Metadata = {
  title: 'Gerencia de riesgos · Correbin Asociados',
  description:
    'Identificar los riesgos, decidir qué prevenir, reducir, transferir o asumir, y diseñar el seguro como parte de un sistema de control. Método y auditoría aseguradora.',
};

export default function GerenciaDeRiesgos() {
  return (
    <>
      <section className="border-b" style={{ borderColor: C.borde }}>
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <Antetitulo>Gerencia de riesgos</Antetitulo>
          <h1 className="text-4xl md:text-5xl font-black leading-[1.1] tracking-tight max-w-4xl" style={{ color: C.azul }}>
            {CORREBIN_GERENCIA.copyClave}
          </h1>
          <div className="mt-8 max-w-3xl">
            <Lista puntos={CORREBIN_GERENCIA.definicion} />
          </div>
        </div>
      </section>

      {/* El método, en siete pasos. Diagrama accesible: lista ordenada, legible
          por teclado y lector de pantalla, sin depender del color (Volumen V). */}
      <Seccion>
        <Encabezado
          ante="El método"
          titulo="De conocer la empresa a aprender del siniestro"
          texto="Un ciclo, no una gestión puntual. Cada paso alimenta al siguiente y el último vuelve al primero."
        />
        <ol className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CORREBIN_GERENCIA.estructura.map((paso, i) => (
            <li key={paso}>
              <Tarjeta className="!p-5 h-full">
                <span
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-black text-white mb-3"
                  style={{ background: i === CORREBIN_GERENCIA.estructura.length - 1 ? C.rojo : C.azul }}
                >
                  {i + 1}
                </span>
                <p className="text-base font-black leading-snug" style={{ color: C.azul }}>{paso}</p>
              </Tarjeta>
            </li>
          ))}
        </ol>
      </Seccion>

      {/* Auditoría aseguradora (Volumen V) */}
      <Seccion alt>
        <Encabezado
          ante="Auditoría aseguradora"
          titulo="Qué se mira y con qué documentación"
          texto="El análisis solo vale si parte de documentación completa. Con un cuadro de primas no se puede auditar nada."
        />
        <div className="mt-10 grid lg:grid-cols-2 gap-5">
          <Tarjeta>
            <p className="text-sm font-black mb-1" style={{ color: C.azul }}>Documentación de entrada</p>
            <p className="text-xs mb-4" style={{ color: C.textoSuave }}>Lo que hace falta para empezar</p>
            <Lista puntos={CORREBIN_GERENCIA.auditoria.entrada} tono="azul" />
          </Tarjeta>
          <Tarjeta>
            <p className="text-sm font-black mb-1" style={{ color: C.azul }}>Comprobaciones</p>
            <p className="text-xs mb-4" style={{ color: C.textoSuave }}>Dónde suelen aparecer los problemas</p>
            <Lista puntos={CORREBIN_GERENCIA.auditoria.comprobaciones} />
          </Tarjeta>
        </div>

        <div className="mt-6">
          <Aviso>{CORREBIN_GERENCIA.auditoria.aviso}</Aviso>
        </div>
      </Seccion>

      {/* Límite honesto: nada automático */}
      <Seccion>
        <div className="max-w-3xl">
          <Encabezado ante="Cómo lo entregamos" titulo="Orientativo hasta que hay validación técnica" />
          <p className="mt-4 text-base leading-relaxed" style={{ color: C.textoSuave }}>
            Las matrices y los cálculos de un primer análisis sirven para ordenar prioridades y ver dónde
            mirar. No sustituyen al estudio del riesgo ni a la aceptación de una compañía: ninguna
            recomendación de cobertura o de capital se cierra sin revisión de las condiciones y sin
            hablarlo contigo.
          </p>
        </div>
      </Seccion>

      <SiguientePaso
        titulo="Empieza por la auditoría de lo que ya tienes"
        texto="Con las pólizas, los recibos y una descripción de la actividad se puede montar el mapa completo."
        principal={{ href: CORREBIN_CTA.revision.href, texto: 'Solicitar diagnóstico inicial' }}
        secundario={{ href: '/seguros/empresas', texto: 'Ver seguros de empresa' }}
      />
    </>
  );
}
