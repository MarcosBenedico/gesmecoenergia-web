import Link from 'next/link';
import {
  CORREBIN_EMPRESA, CORREBIN_MENSAJE_RECTOR, CORREBIN_POSICIONAMIENTO,
  CORREBIN_METODO, CORREBIN_PUBLICOS, CORREBIN_COLORES as C,
} from '@/lib/correbin-marca';

/**
 * Portada de la microsede de Correbin.
 *
 * Todo el texto sale de `correbin-marca.ts` (Volumen I). Aquí no se inventa
 * ni un dato: nada de cifras de cartera, clientes, testimonios ni acuerdos con
 * compañías, porque los volúmenes lo prohíben expresamente hasta que existan
 * pruebas reales aprobadas.
 */

/** Marca visual del bloque: filete rojo + antetítulo azul. */
function Antetitulo({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3 flex items-center gap-2.5" style={{ color: C.textoSuave }}>
      <span className="inline-block w-6 h-0.5 rounded" style={{ background: C.rojo }} />
      {children}
    </p>
  );
}

export default function CorrebinHome() {
  return (
    <>
      {/* ══ Portada: el posicionamiento en diez segundos ══ */}
      <section className="border-b" style={{ borderColor: C.borde }}>
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28 grid lg:grid-cols-[1.15fr_1fr] gap-14 items-start">
          <div>
            <Antetitulo>{CORREBIN_POSICIONAMIENTO.titular}</Antetitulo>
            <h1 className="text-4xl md:text-5xl font-black leading-[1.1] tracking-tight" style={{ color: C.azul }}>
              {CORREBIN_MENSAJE_RECTOR}
            </h1>
            <p className="mt-6 text-lg leading-relaxed" style={{ color: C.textoSuave }}>
              Correbin Asociados es una correduría de seguros que trabaja como gerente externo de riesgos:
              analiza el negocio, audita el programa asegurador, negocia con el mercado y defiende la
              posición del asegurado cuando hay siniestro.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#contacto"
                className="inline-flex items-center px-6 py-3.5 rounded-lg text-base font-bold text-white transition hover:opacity-90"
                style={{ background: C.rojo }}
              >
                Solicitar revisión de pólizas
              </a>
              <a
                href={`tel:${CORREBIN_EMPRESA.telefonoTel}`}
                className="inline-flex items-center px-6 py-3.5 rounded-lg text-base font-bold border transition hover:opacity-70"
                style={{ borderColor: C.azul, color: C.azul }}
              >
                Llamar al {CORREBIN_EMPRESA.telefono}
              </a>
            </div>
          </div>

          {/* Qué es y qué no: el posicionamiento sin rodeos */}
          <div className="rounded-2xl border p-7" style={{ borderColor: C.borde, background: C.fondoAlt }}>
            <p className="text-sm font-black mb-4" style={{ color: C.azul }}>Qué hacemos</p>
            <ul className="space-y-2.5">
              {CORREBIN_POSICIONAMIENTO.esto.map((x) => (
                <li key={x} className="flex gap-2.5 text-sm leading-snug" style={{ color: C.texto }}>
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C.rojo }} />
                  {x}
                </li>
              ))}
            </ul>

            <p className="text-sm font-black mt-7 mb-3" style={{ color: C.azul }}>Lo que no somos</p>
            <p className="text-sm leading-relaxed" style={{ color: C.textoSuave }}>
              {CORREBIN_POSICIONAMIENTO.estoNo.join(' · ')}.
            </p>
          </div>
        </div>
      </section>

      {/* ══ El método: antes, durante y después ══ */}
      <section id="metodo" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Antetitulo>Cómo trabajamos</Antetitulo>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight max-w-3xl" style={{ color: C.azul }}>
            Protección antes, durante y después del siniestro
          </h2>
          <p className="mt-4 text-base max-w-2xl leading-relaxed" style={{ color: C.textoSuave }}>
            Lo que se promete es el método, el criterio y la continuidad. Un corredor no garantiza una
            indemnización: prepara técnicamente el riesgo para que la póliza responda cuando toca.
          </p>

          <div className="mt-10 grid md:grid-cols-3 gap-5">
            {CORREBIN_METODO.map((f, i) => (
              <div key={f.fase} className="rounded-2xl border p-7" style={{ borderColor: C.borde, background: '#fff' }}>
                <span
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-black text-white mb-4"
                  style={{ background: C.azul }}
                >
                  {i + 1}
                </span>
                <h3 className="text-lg font-black" style={{ color: C.azul }}>{f.fase}</h3>
                <p className="text-sm mt-1.5 mb-4 leading-snug" style={{ color: C.textoSuave }}>{f.resumen}</p>
                <ul className="space-y-2">
                  {f.puntos.map((p) => (
                    <li key={p} className="flex gap-2.5 text-sm leading-snug" style={{ color: C.texto }}>
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C.rojo }} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Empresas: el público principal ══ */}
      <section id="empresa" className="scroll-mt-24 border-y" style={{ background: C.fondoAlt, borderColor: C.borde }}>
        <div className="mx-auto max-w-6xl px-5 py-20 grid lg:grid-cols-[1fr_1fr] gap-12 items-start">
          <div>
            <Antetitulo>Empresas</Antetitulo>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight" style={{ color: C.azul }}>
              Un único interlocutor para todos los riesgos
            </h2>
            <p className="mt-4 text-base leading-relaxed" style={{ color: C.textoSuave }}>
              El programa de seguros de una empresa cambia con ella: la actividad, la facturación, la
              plantilla, la maquinaria y los bienes no son los mismos que cuando se firmó la póliza. El
              trabajo consiste en mantener esa correspondencia y en revisarla antes de cada vencimiento,
              no en la semana de la renovación.
            </p>
            <a
              href="#contacto"
              className="mt-7 inline-flex items-center px-6 py-3.5 rounded-lg text-base font-bold text-white transition hover:opacity-90"
              style={{ background: C.rojo }}
            >
              Solicitar auditoría del programa
            </a>
          </div>

          <div className="rounded-2xl border p-7" style={{ borderColor: C.borde, background: '#fff' }}>
            <p className="text-sm font-black mb-4" style={{ color: C.azul }}>Con quién trabajamos</p>
            <ul className="space-y-3">
              {CORREBIN_PUBLICOS.empresa.map((x) => (
                <li key={x} className="flex gap-3 text-sm leading-snug pb-3 border-b last:border-0 last:pb-0" style={{ color: C.texto, borderColor: C.borde }}>
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C.azul }} />
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ══ Particulares: sección propia, sin dirigir el relato ══ */}
      <section id="particulares" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Antetitulo>Particulares</Antetitulo>
          <h2 className="text-3xl font-black tracking-tight max-w-3xl" style={{ color: C.azul }}>
            También acompañamos a familias y patrimonios personales
          </h2>
          <p className="mt-4 text-base max-w-2xl leading-relaxed" style={{ color: C.textoSuave }}>
            El mismo criterio técnico, aplicado a lo personal. Con el mismo interlocutor y el mismo
            acompañamiento el día que hay un parte.
          </p>
          <div className="mt-8 flex flex-wrap gap-2.5">
            {CORREBIN_PUBLICOS.particulares.map((x) => (
              <span
                key={x}
                className="inline-flex items-center px-4 py-2.5 rounded-lg border text-sm font-semibold"
                style={{ borderColor: C.borde, color: C.azul, background: '#fff' }}
              >
                {x}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Contacto: solo los canales confirmados ══ */}
      <section id="contacto" className="scroll-mt-24 border-t" style={{ background: C.fondoAlt, borderColor: C.borde }}>
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid lg:grid-cols-[1fr_1fr] gap-12 items-start">
            <div>
              <Antetitulo>Contacto</Antetitulo>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight" style={{ color: C.azul }}>
                Cuéntanos qué tienes contratado
              </h2>
              <p className="mt-4 text-base leading-relaxed" style={{ color: C.textoSuave }}>
                Con las pólizas actuales delante se puede decir qué cubre, qué no y qué falta. Sin
                compromiso y sin cambiar nada hasta que la propuesta tenga sentido.
              </p>
            </div>

            <div className="rounded-2xl border p-7 space-y-3" style={{ borderColor: C.borde, background: '#fff' }}>
              <a
                href={`tel:${CORREBIN_EMPRESA.telefonoTel}`}
                className="flex items-center justify-between gap-4 p-4 rounded-xl border transition hover:opacity-80"
                style={{ borderColor: C.borde }}
              >
                <span>
                  <span className="block text-xs font-bold uppercase tracking-widest" style={{ color: C.textoSuave }}>Teléfono</span>
                  <span className="block text-lg font-black" style={{ color: C.azul }}>{CORREBIN_EMPRESA.telefono}</span>
                </span>
                <span className="text-2xl" aria-hidden>→</span>
              </a>

              <a
                href={CORREBIN_EMPRESA.whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-4 p-4 rounded-xl border transition hover:opacity-80"
                style={{ borderColor: C.borde }}
              >
                <span>
                  <span className="block text-xs font-bold uppercase tracking-widest" style={{ color: C.textoSuave }}>WhatsApp</span>
                  <span className="block text-lg font-black" style={{ color: C.azul }}>{CORREBIN_EMPRESA.whatsapp}</span>
                </span>
                <span className="text-2xl" aria-hidden>→</span>
              </a>

              <Link
                href="/contacto"
                className="flex items-center justify-center gap-2 p-4 rounded-xl text-base font-bold text-white transition hover:opacity-90"
                style={{ background: C.rojo }}
              >
                Escribir por formulario
              </Link>

              <p className="text-xs leading-relaxed pt-1" style={{ color: C.textoSuave }}>
                {CORREBIN_EMPRESA.razonSocial} · CIF {CORREBIN_EMPRESA.cif}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
