import {
  CORREBIN_EMPRESA, CORREBIN_HOME, CORREBIN_METODO_HOME, CORREBIN_QUE_REVISAMOS,
  CORREBIN_POSICIONAMIENTO, CORREBIN_CTA, CORREBIN_GERENCIA, CORREBIN_COLORES as C,
} from '@/lib/correbin-marca';
import { Antetitulo, Seccion, Encabezado, Lista, Tarjeta, Boton, SiguientePaso } from './ui';

/**
 * Home de la microsede de seguros.
 * Copy literal de los Volúmenes III y IV. Sin carrusel, sin logos de
 * aseguradoras, sin cifras de cartera ni testimonios: los volúmenes lo
 * prohíben mientras no haya autorización y soporte documental.
 */

export default function SegurosHome() {
  return (
    <>
      {/* ══ Hero: quién es Correbin y cómo trabaja, en diez segundos ══ */}
      <section className="border-b" style={{ borderColor: C.borde }}>
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24 grid lg:grid-cols-[1.15fr_1fr] gap-14 items-start">
          <div>
            <Antetitulo>{CORREBIN_POSICIONAMIENTO.titular}</Antetitulo>
            <h1 className="text-4xl md:text-5xl font-black leading-[1.1] tracking-tight" style={{ color: C.azul }}>
              {CORREBIN_HOME.h1}
            </h1>
            <p className="mt-6 text-lg leading-relaxed" style={{ color: C.textoSuave }}>
              {CORREBIN_HOME.subtitulo}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Boton href={CORREBIN_CTA.revision.href}>Solicitar revisión de pólizas</Boton>
              <Boton href={CORREBIN_CTA.corredor.href} variante="secundario">
                {CORREBIN_CTA.corredor.texto}
              </Boton>
            </div>

            <p className="mt-6 text-sm font-semibold flex flex-wrap gap-x-3 gap-y-1" style={{ color: C.textoSuave }}>
              {CORREBIN_HOME.microcopy.map((m, i) => (
                <span key={m}>
                  {i > 0 && <span className="mr-3" aria-hidden>·</span>}
                  {m}
                </span>
              ))}
            </p>
          </div>

          {/* Qué hacemos / qué no somos: el posicionamiento sin rodeos */}
          <Tarjeta className="!bg-transparent" >
            <p className="text-sm font-black mb-4" style={{ color: C.azul }}>Qué hacemos</p>
            <Lista puntos={CORREBIN_POSICIONAMIENTO.esto} />
            <p className="text-sm font-black mt-7 mb-3" style={{ color: C.azul }}>Lo que no somos</p>
            <p className="text-sm leading-relaxed" style={{ color: C.textoSuave }}>
              {CORREBIN_POSICIONAMIENTO.estoNo.join(' · ')}.
            </p>
          </Tarjeta>
        </div>
      </section>

      {/* ══ Método: la principal prueba de valor ══ */}
      <Seccion id="metodo">
        <Encabezado
          ante="Cómo trabajamos"
          titulo={CORREBIN_HOME.tituloMetodo}
          texto="El programa de seguros de una empresa cambia con ella. Este es el trabajo que hay detrás, durante todo el año."
        />
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {CORREBIN_METODO_HOME.map((f, i) => (
            <Tarjeta key={f.fase}>
              <span
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-black text-white mb-4"
                style={{ background: C.azul }}
              >
                {i + 1}
              </span>
              <h3 className="text-lg font-black mb-3" style={{ color: C.azul }}>{f.fase}</h3>
              <Lista puntos={f.puntos} />
            </Tarjeta>
          ))}
        </div>
      </Seccion>

      {/* ══ Prueba técnica: qué revisamos ══ */}
      <Seccion alt>
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-12 items-start">
          <div>
            <Encabezado
              ante="Prueba técnica"
              titulo="Qué revisamos en una póliza"
              texto="Dos ofertas con el mismo capital pueden no ser equivalentes. Estos son los puntos donde suele estar la diferencia."
            />
            <p className="mt-6 text-sm leading-relaxed font-semibold" style={{ color: C.azul }}>
              {CORREBIN_GERENCIA.auditoria.aviso}
            </p>
          </div>
          <Tarjeta>
            <ul className="grid sm:grid-cols-2 gap-x-6">
              {CORREBIN_QUE_REVISAMOS.map((x) => (
                <li
                  key={x}
                  className="flex gap-2.5 text-sm leading-snug py-2.5 border-b last:border-0"
                  style={{ color: C.texto, borderColor: C.borde }}
                >
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C.rojo }} />
                  {x}
                </li>
              ))}
            </ul>
          </Tarjeta>
        </div>
      </Seccion>

      {/* ══ Gerencia de riesgos: el diferenciador ══ */}
      <Seccion>
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
          <div>
            <Encabezado ante="Gerencia de riesgos" titulo={CORREBIN_GERENCIA.copyClave} />
            <p className="mt-4 text-base leading-relaxed" style={{ color: C.textoSuave }}>
              Antes de contratar hay que decidir qué riesgos se previenen, cuáles se reducen, cuáles se
              transfieren a una aseguradora y cuáles asume la empresa. El seguro es el último paso, no el
              primero.
            </p>
            <div className="mt-7">
              <Boton href="/seguros/gerencia-de-riesgos" variante="secundario">
                Ver el método completo
              </Boton>
            </div>
          </div>
          <Tarjeta>
            <p className="text-sm font-black mb-4" style={{ color: C.azul }}>El proceso, paso a paso</p>
            <ol className="space-y-3">
              {CORREBIN_GERENCIA.estructura.map((x, i) => (
                <li key={x} className="flex gap-3 text-sm items-center" style={{ color: C.texto }}>
                  <span
                    className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-black shrink-0"
                    style={{ background: C.fondoAlt, color: C.azul }}
                  >
                    {i + 1}
                  </span>
                  {x}
                </li>
              ))}
            </ol>
          </Tarjeta>
        </div>
      </Seccion>

      {/* ══ Siniestros: canal siempre accesible ══ */}
      <Seccion alt>
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div>
            <Encabezado
              ante="Siniestros"
              titulo="Cuando ocurre un siniestro, empieza la parte más importante de nuestro trabajo."
              texto="Identificamos la póliza, comunicamos a la aseguradora, coordinamos con los peritos y damos seguimiento a los plazos. Defendiendo tu posición dentro de lo que dice el contrato."
            />
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Boton href={CORREBIN_CTA.siniestro.href}>Comunicar un siniestro</Boton>
            <Boton href={`tel:${CORREBIN_EMPRESA.telefonoTel}`} variante="secundario" externo>
              Llamar al {CORREBIN_EMPRESA.telefono}
            </Boton>
          </div>
        </div>
      </Seccion>

      <SiguientePaso
        titulo="¿Empezamos por revisar lo que ya tienes contratado?"
        texto="Con las pólizas actuales delante se puede decir qué cubren, qué no y qué falta."
        principal={{ href: CORREBIN_CTA.revision.href, texto: 'Solicitar diagnóstico inicial' }}
        secundario={{ href: '/seguros/particulares', texto: 'Soy particular' }}
      />
    </>
  );
}
