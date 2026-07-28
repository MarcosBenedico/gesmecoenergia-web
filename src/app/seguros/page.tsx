import type { Metadata } from 'next';
import {
  CORREBIN_EMPRESA, CORREBIN_HOME, CORREBIN_METODO_HOME, CORREBIN_QUE_REVISAMOS,
  CORREBIN_POSICIONAMIENTO, CORREBIN_CTA, CORREBIN_GERENCIA, CORREBIN_COLORES as C,
} from '@/lib/correbin-marca';
import { LogoEmpresa, MARCAS } from '@/components/logo-empresa';
import { Antetitulo, Seccion, Encabezado, Lista, Tarjeta, Boton, SiguientePaso } from './ui';
import { Revelar, Escalonado, Pieza, TarjetaViva, Cifra } from './movimiento';

/** Title y description exactos del Volumen VIII. */
export const metadata: Metadata = {
  title: 'Correbin Asociados | Seguros de empresa y gerencia de riesgos',
  description:
    'Correduría especializada en empresas, flotas, transporte, agroindustria y gerencia de riesgos. Revisión técnica, negociación y gestión de siniestros.',
  alternates: { canonical: '/seguros' },
};

/**
 * Home de la microsede de seguros.
 *
 * Copy literal de los Volúmenes III y IV. Sin carrusel, sin logos de
 * aseguradoras, sin cifras de cartera ni testimonios: los volúmenes lo
 * prohíben mientras no haya autorización y soporte documental.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SOBRE EL DISEÑO
 *
 * Esto vende criterio técnico, no urgencia. Así que la elegancia viene del
 * espacio y de la jerarquía, no de adornos: mucho aire, un solo azul que manda,
 * el rojo reservado a lo que se puede pulsar, y filetes de un píxel en vez de
 * cajas con sombra por todas partes.
 *
 * El movimiento va en la misma dirección — entradas lentas y cortas, nada que
 * salte. Ver `movimiento.tsx`. Todo REVELA contenido que ya está en el HTML:
 * si el JavaScript fallara, la página se lee igual.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export default function SegurosHome() {
  return (
    <>
      {/* ══ Hero: quién es Correbin y cómo trabaja, en diez segundos ══ */}
      <section className="relative overflow-hidden border-b" style={{ borderColor: C.borde }}>
        {/* Fondo: dos halos muy suaves del azul y el rojo de la marca. Se notan
            sin verse, que es justo lo que tiene que hacer un fondo. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full opacity-[0.07] blur-3xl"
            style={{ background: C.azul }}
          />
          <div
            className="absolute -right-32 top-20 h-[26rem] w-[26rem] rounded-full opacity-[0.05] blur-3xl"
            style={{ background: C.rojo }}
          />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-start gap-14 px-5 py-16 md:py-24 lg:grid-cols-[1.15fr_1fr]">
          <div>
            {/* La marca preside. En una correduría, quién firma importa. */}
            <Revelar desde="nada">
              <LogoEmpresa marca={MARCAS.seguros} alto={60} placa={false} prioritario />
            </Revelar>

            <div className="mt-9">
              <Revelar retardo={0.08}>
                <Antetitulo>{CORREBIN_POSICIONAMIENTO.titular}</Antetitulo>
              </Revelar>

              <Revelar retardo={0.14}>
                <h1
                  className="text-4xl font-black leading-[1.08] tracking-tight md:text-5xl"
                  style={{ color: C.azul }}
                >
                  {CORREBIN_HOME.h1}
                </h1>
              </Revelar>

              <Revelar retardo={0.2}>
                <p className="mt-6 max-w-xl text-lg leading-relaxed" style={{ color: C.textoSuave }}>
                  {CORREBIN_HOME.subtitulo}
                </p>
              </Revelar>

              <Revelar retardo={0.26}>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Boton href={CORREBIN_CTA.revision.href}>Solicitar revisión de pólizas</Boton>
                  <Boton href={CORREBIN_CTA.corredor.href} variante="secundario">
                    {CORREBIN_CTA.corredor.texto}
                  </Boton>
                </div>
              </Revelar>

              <Revelar retardo={0.32}>
                <p
                  className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold"
                  style={{ color: C.textoSuave }}
                >
                  {CORREBIN_HOME.microcopy.map((m, i) => (
                    <span key={m} className="flex items-center gap-3">
                      {i > 0 && (
                        <span className="inline-block h-1 w-1 rounded-full" style={{ background: C.rojo }} aria-hidden />
                      )}
                      {m}
                    </span>
                  ))}
                </p>
              </Revelar>
            </div>
          </div>

          {/* Qué hacemos / qué no somos: el posicionamiento sin rodeos */}
          <Revelar desde="derecha" retardo={0.18}>
            <TarjetaViva acento={C.azul} className="!bg-white/70 backdrop-blur-sm">
              <p className="mb-4 text-sm font-black" style={{ color: C.azul }}>Qué hacemos</p>
              <Lista puntos={CORREBIN_POSICIONAMIENTO.esto} />
              <div className="my-6 h-px w-full" style={{ background: C.borde }} />
              <p className="mb-3 text-sm font-black" style={{ color: C.azul }}>Lo que no somos</p>
              <p className="text-sm leading-relaxed" style={{ color: C.textoSuave }}>
                {CORREBIN_POSICIONAMIENTO.estoNo.join(' · ')}.
              </p>
            </TarjetaViva>
          </Revelar>
        </div>
      </section>

      {/* ══ Método: la principal prueba de valor ══ */}
      <Seccion id="metodo">
        <Revelar>
          <Encabezado
            ante="Cómo trabajamos"
            titulo={CORREBIN_HOME.tituloMetodo}
            texto="El programa de seguros de una empresa cambia con ella. Este es el trabajo que hay detrás, durante todo el año."
          />
        </Revelar>

        <Escalonado className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CORREBIN_METODO_HOME.map((f, i) => (
            <Pieza key={f.fase} className="h-full">
              <TarjetaViva className="flex h-full flex-col">
                {/* La cifra sube hasta su número: marca que son pasos en orden */}
                <span
                  className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg text-sm font-black text-white"
                  style={{ background: C.azul }}
                >
                  <Cifra hasta={i + 1} />
                </span>
                <h3 className="mb-3 text-lg font-black" style={{ color: C.azul }}>{f.fase}</h3>
                <Lista puntos={f.puntos} />
              </TarjetaViva>
            </Pieza>
          ))}
        </Escalonado>
      </Seccion>

      {/* ══ Prueba técnica: qué revisamos ══ */}
      <Seccion alt>
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.2fr]">
          <Revelar desde="izquierda">
            <Encabezado
              ante="Prueba técnica"
              titulo="Qué revisamos en una póliza"
              texto="Dos ofertas con el mismo capital pueden no ser equivalentes. Estos son los puntos donde suele estar la diferencia."
            />
            <div
              className="mt-7 rounded-xl border-l-[3px] py-1 pl-5 text-sm font-semibold leading-relaxed"
              style={{ borderColor: C.rojo, color: C.azul }}
            >
              {CORREBIN_GERENCIA.auditoria.aviso}
            </div>
          </Revelar>

          <Revelar desde="derecha" retardo={0.1}>
            <Tarjeta>
              <Escalonado className="grid gap-x-6 sm:grid-cols-2">
                {CORREBIN_QUE_REVISAMOS.map((x) => (
                  <Pieza key={x}>
                    <div
                      className="flex gap-2.5 border-b py-2.5 text-sm leading-snug"
                      style={{ color: C.texto, borderColor: C.borde }}
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: C.rojo }} />
                      {x}
                    </div>
                  </Pieza>
                ))}
              </Escalonado>
            </Tarjeta>
          </Revelar>
        </div>
      </Seccion>

      {/* ══ Gerencia de riesgos: el diferenciador ══ */}
      <Seccion>
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <Revelar desde="izquierda">
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
          </Revelar>

          <Revelar desde="derecha" retardo={0.1}>
            <TarjetaViva acento={C.azul}>
              <p className="mb-5 text-sm font-black" style={{ color: C.azul }}>El proceso, paso a paso</p>
              <Escalonado>
                <ol className="relative space-y-4">
                  {/* Hilo vertical que une los pasos: se ve que es una secuencia */}
                  <span
                    aria-hidden
                    className="absolute bottom-3 left-3 top-3 w-px"
                    style={{ background: C.borde }}
                  />
                  {CORREBIN_GERENCIA.estructura.map((x, i) => (
                    <Pieza key={x}>
                      <li className="relative flex items-center gap-3.5 text-sm" style={{ color: C.texto }}>
                        <span
                          className="z-10 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-black"
                          style={{ background: C.fondoAlt, color: C.azul, boxShadow: `0 0 0 3px ${C.fondo}` }}
                        >
                          {i + 1}
                        </span>
                        {x}
                      </li>
                    </Pieza>
                  ))}
                </ol>
              </Escalonado>
            </TarjetaViva>
          </Revelar>
        </div>
      </Seccion>

      {/* ══ Siniestros: canal siempre accesible ══ */}
      <Seccion alt>
        <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
          <Revelar desde="izquierda">
            <Encabezado
              ante="Siniestros"
              titulo="Cuando ocurre un siniestro, empieza la parte más importante de nuestro trabajo."
              texto="Identificamos la póliza, comunicamos a la aseguradora, coordinamos con los peritos y damos seguimiento a los plazos. Defendiendo tu posición dentro de lo que dice el contrato."
            />
          </Revelar>
          <Revelar desde="derecha" retardo={0.1}>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Boton href={CORREBIN_CTA.siniestro.href}>Comunicar un siniestro</Boton>
              <Boton href={`tel:${CORREBIN_EMPRESA.telefonoTel}`} variante="secundario" externo>
                Llamar al {CORREBIN_EMPRESA.telefono}
              </Boton>
            </div>
          </Revelar>
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
