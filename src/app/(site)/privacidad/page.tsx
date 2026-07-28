import Link from "next/link";
import { Container } from "@/components/container";
import { CORREBIN_EMPRESA } from "@/lib/correbin-marca";

export const metadata = {
  title: "Privacidad y cookies | Grupo Gesmeco",
  description:
    "Cómo tratamos los datos que nos facilitas: responsable, finalidad, base jurídica, destinatarios, conservación y tus derechos.",
};

/**
 * Política de privacidad.
 *
 * Sustituye al texto de relleno que había, porque el Volumen X lo señala como
 * bloqueo: no se pueden publicar formularios operativos sobre una política
 * placeholder.
 *
 * Dos criterios de los volúmenes que condicionan este texto:
 *  · Hay que identificar correctamente al responsable del tratamiento, y no
 *    vale un único aviso indiscriminado para todo el grupo: los formularios de
 *    energía y los de seguros tienen responsables distintos (Volumen VI).
 *  · No se puede afirmar «sin cesión a terceros» si hay proveedores que actúan
 *    como encargados del tratamiento (Volumen X).
 *
 * Los datos que aún no están confirmados aparecen marcados como pendientes en
 * vez de inventados. Este texto necesita revisión de asesor competente antes
 * de darse por definitivo.
 */

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold text-foreground">{titulo}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

/** Dato pendiente de confirmar: se marca, no se inventa. */
function Pendiente({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-amber-300 font-semibold">{children}</span>
  );
}

export default function PrivacyPage() {
  return (
    <div className="pb-20">
      <section className="pt-14">
        <Container className="max-w-3xl space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold text-foreground">Privacidad y cookies</h1>
            <p className="text-sm text-muted">
              Última actualización: julio de 2026. Esta política explica qué hacemos con los datos que
              nos facilitas a través de esta web.
            </p>
          </div>

          <Bloque titulo="Quién trata tus datos">
            <p>
              Esta web es del Grupo Gesmeco, que reúne tres actividades con responsables distintos. El
              responsable del tratamiento depende de con quién contactes:
            </p>
            <ul className="space-y-3 pl-4">
              <li>
                <b className="text-foreground">Seguros</b> — formularios de la sección{" "}
                <Link href="/seguros" className="text-accent hover:underline">/seguros</Link>{" "}
                (revisión de pólizas, siniestros y contacto de la correduría):
                <br />
                {CORREBIN_EMPRESA.razonSocial}, CIF {CORREBIN_EMPRESA.cif}. Teléfono{" "}
                {CORREBIN_EMPRESA.telefono}.
                <br />
                Domicilio y correo de contacto: <Pendiente>pendientes de confirmación</Pendiente>.
              </li>
              <li>
                <b className="text-foreground">Energía y asesoría</b> — resto de formularios de la web:
                Gesmeco Energía, con domicilio en Avenida de Aragón, 50, 22500 Binéfar (Huesca).
                <br />
                Razón social, CIF y correo de contacto: <Pendiente>pendientes de confirmación</Pendiente>.
              </li>
            </ul>
            <p>
              Cada área trata los datos para su propia finalidad. Que formen parte del mismo grupo no
              implica que tus datos circulen automáticamente entre ellas: si en algún momento resultara
              útil compartirlos, te lo pediríamos antes.
            </p>
          </Bloque>

          <Bloque titulo="Para qué usamos tus datos y con qué base legal">
            <ul className="space-y-2 pl-4">
              <li>
                <b className="text-foreground">Atender tu consulta o solicitud</b> (formularios de
                contacto, revisión de pólizas, comunicación de siniestro, análisis de factura). Base
                legal: tu consentimiento y, cuando ya eres cliente, la ejecución del contrato o las
                gestiones previas que solicitas.
              </li>
              <li>
                <b className="text-foreground">Gestionar la relación</b> si finalmente contratas
                (emisión, movimientos, vencimientos, siniestros). Base legal: ejecución del contrato y
                cumplimiento de obligaciones legales.
              </li>
              <li>
                <b className="text-foreground">Cumplir con la normativa aplicable</b> en materia de
                mediación de seguros, fiscal y contable. Base legal: obligación legal.
              </li>
            </ul>
            <p>
              No usamos tus datos para tomar decisiones automatizadas ni para elaborar perfiles con
              efectos jurídicos sobre ti.
            </p>
          </Bloque>

          <Bloque titulo="Qué datos recogemos">
            <p>
              Los que nos facilitas en cada formulario: identificación y contacto (nombre, empresa,
              NIF/CIF, teléfono, correo, localidad) y la información que necesitamos para el asunto
              concreto —actividad, vencimientos, datos de la póliza o del siniestro, o los consumos y
              facturas en el caso de energía—.
            </p>
            <p>
              Te pedimos que <b className="text-foreground">no envíes datos de salud ni documentación
              médica</b> que no sean imprescindibles para la gestión, ni datos de terceros sin haberles
              informado antes.
            </p>
          </Bloque>

          <Bloque titulo="Quién más puede acceder a ellos">
            <p>
              Para prestarte el servicio trabajamos con proveedores que actúan como encargados del
              tratamiento y solo acceden a lo necesario: alojamiento de la web e infraestructura, base
              de datos y correo. También, cuando corresponde al servicio que has solicitado, las
              entidades aseguradoras o comercializadoras con las que haya que tramitar tu caso, y las
              administraciones públicas cuando la ley lo exija.
            </p>
            <p>
              No vendemos tus datos ni los cedemos con fines publicitarios de terceros.
            </p>
          </Bloque>

          <Bloque titulo="Cuánto tiempo los guardamos">
            <p>
              Las consultas que no acaban en contratación se conservan el tiempo necesario para
              atenderlas y, después, durante el plazo en que puedan derivarse responsabilidades. Si
              llegas a ser cliente, los datos se conservan mientras dure la relación y, una vez
              terminada, durante los plazos de prescripción legal que correspondan.
            </p>
          </Bloque>

          <Bloque titulo="Tus derechos">
            <p>
              Puedes solicitar acceso a tus datos, su rectificación o supresión, la limitación u
              oposición al tratamiento, y la portabilidad. También puedes retirar tu consentimiento en
              cualquier momento, sin que ello afecte a la licitud del tratamiento anterior.
            </p>
            <p>
              Para ejercerlos, escríbenos o llámanos a los datos de contacto indicados arriba. Si
              consideras que no hemos atendido correctamente tu solicitud, puedes reclamar ante la
              Agencia Española de Protección de Datos (
              <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                aepd.es
              </a>
              ).
            </p>
          </Bloque>

          <Bloque titulo="Cookies">
            <p>
              Esta web utiliza las cookies técnicas necesarias para que funcione y para recordar tus
              preferencias. No se cargan cookies de publicidad ni de perfilado.
            </p>
            <p>
              Si en el futuro incorporamos herramientas de analítica o de marketing, se te pedirá
              consentimiento previo mediante un aviso y no se activarán hasta que lo aceptes.
            </p>
          </Bloque>

          <Bloque titulo="Seguridad">
            <p>
              La información viaja cifrada y el acceso a las solicitudes está restringido al personal
              del grupo que necesita gestionarlas. La documentación que nos envíes se trata con la
              misma reserva que cualquier expediente del despacho.
            </p>
          </Bloque>

          <p className="text-xs text-muted/70 border-t border-border/40 pt-5">
            Los apartados marcados como pendientes se completarán en cuanto estén confirmados. Este
            texto está sujeto a revisión por asesor competente antes de considerarse definitivo.
          </p>
        </Container>
      </section>
    </div>
  );
}
