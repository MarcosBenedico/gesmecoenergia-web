import type { Metadata } from 'next';
import {
  CORREBIN_EMPRESAS, CORREBIN_PUBLICOS, CORREBIN_CTA, CORREBIN_COLORES as C,
} from '@/lib/correbin-marca';
import { Seccion, Encabezado, Lista, Tarjeta, Boton, SiguientePaso, Antetitulo } from '../ui';

export const metadata: Metadata = {
  title: 'Seguros para empresas · Correbin Asociados',
  description:
    'El programa asegurador completo de una empresa: patrimonio, responsabilidad, personas, movilidad, riesgos financieros, ciber y dirección. Sin lagunas entre pólizas.',
};

export default function Empresas() {
  return (
    <>
      <section className="border-b" style={{ borderColor: C.borde }}>
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <Antetitulo>Empresas</Antetitulo>
          <h1 className="text-4xl md:text-5xl font-black leading-[1.1] tracking-tight max-w-4xl" style={{ color: C.azul }}>
            Un programa de seguros, no una colección de pólizas sueltas
          </h1>
          <p className="mt-6 text-lg leading-relaxed max-w-3xl" style={{ color: C.textoSuave }}>
            Cada contrato cubre una parte. Lo que importa es cómo encajan entre sí: dónde se solapan,
            dónde queda un hueco y si los límites responden a la exposición real de la empresa.
          </p>
          <div className="mt-8">
            <Boton href={CORREBIN_CTA.revision.href}>{CORREBIN_EMPRESAS.cta}</Boton>
          </div>
        </div>
      </section>

      {/* Bloques del programa asegurador */}
      <Seccion>
        <Encabezado
          ante="El programa completo"
          titulo="Los ocho frentes de una empresa"
          texto="No todas las empresas necesitan los ocho, ni con la misma intensidad. La combinación se decide después de conocer la actividad."
        />
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CORREBIN_EMPRESAS.bloques.map((b, i) => (
            <Tarjeta key={b} className="!p-5">
              <span className="block text-xs font-black mb-2" style={{ color: C.rojo }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <p className="text-base font-black leading-snug" style={{ color: C.azul }}>{b}</p>
            </Tarjeta>
          ))}
        </div>
      </Seccion>

      {/* Criterios de dimensionado */}
      <Seccion alt>
        <div className="grid lg:grid-cols-[1fr_1fr] gap-12 items-start">
          <Encabezado
            ante="Criterio"
            titulo="Cómo se decide qué contratar"
            texto="Un programa bien montado se sostiene en cinco ideas. Ninguna tiene que ver con el precio."
          />
          <Tarjeta>
            <ul className="space-y-4">
              {CORREBIN_EMPRESAS.mensajes.map((m, i) => (
                <li key={m} className="flex gap-3.5 pb-4 border-b last:border-0 last:pb-0" style={{ borderColor: C.borde }}>
                  <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[11px] font-black shrink-0"
                    style={{ background: C.fondoAlt, color: C.azul }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm leading-snug" style={{ color: C.texto }}>{m}</span>
                </li>
              ))}
            </ul>
          </Tarjeta>
        </div>
      </Seccion>

      {/* Con quién trabajamos */}
      <Seccion>
        <div className="grid lg:grid-cols-[1fr_1fr] gap-12 items-start">
          <div>
            <Encabezado
              ante="Con quién trabajamos"
              titulo="Empresas con riesgos que no caben en una póliza estándar"
              texto="Actividades donde el patrimonio, la maquinaria, la mercancía o la responsabilidad pesan de verdad."
            />
            <div className="mt-7">
              <Boton href={CORREBIN_CTA.corredor.href} variante="secundario">
                Hablar con un corredor
              </Boton>
            </div>
          </div>
          <Tarjeta>
            <Lista puntos={CORREBIN_PUBLICOS.empresa} tono="azul" />
          </Tarjeta>
        </div>
      </Seccion>

      <SiguientePaso
        titulo="Empecemos por lo que ya tienes contratado"
        texto="Con las pólizas delante se ve enseguida si la actividad declarada, los capitales y los límites siguen encajando con la empresa de hoy."
        principal={{ href: CORREBIN_CTA.revision.href, texto: 'Solicitar diagnóstico inicial' }}
        secundario={{ href: '/seguros/gerencia-de-riesgos', texto: 'Ver el método' }}
      />
    </>
  );
}
