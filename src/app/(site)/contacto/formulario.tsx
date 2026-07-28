'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { AreaSolicitud, destinoDe } from '@/lib/destinatarios';

/**
 * Formulario de contacto.
 *
 * OJO CON ESTO, MARCOS: el formulario que había aquí **no enviaba nada**. El
 * botón era `<Button type="button">` sin `onClick`, y no existe ningún endpoint
 * de contacto en `src/app/api/` ni ninguna librería de correo en el proyecto.
 * O sea: quien rellenaba los seis campos y pulsaba «Enviar solicitud» no
 * mandaba nada a ninguna parte, no recibía ni un aviso, y se iba pensando que
 * ya os había escrito. Cada uno de esos era un cliente perdido en silencio.
 *
 * Mientras no haya endpoint, esto entrega el mensaje por las dos vías que ya
 * usáis y que no necesitan servidor: WhatsApp (el mismo número del botón
 * flotante) y correo. El texto va montado con lo que ha escrito la persona, así
 * que llega completo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A QUIÉN LE LLEGA
 *
 * El correo ya no cae siempre en el mismo buzón: se reparte según lo que pida
 * la persona (ver `src/lib/destinatarios.ts`). Asesoría, seguros y los
 * diagnósticos generales los atiende Fernando; la parte de energía, Marcos.
 * Antes llegaba todo a un sitio y había que reenviarlo a mano, que es donde se
 * pierden las cosas.
 *
 * Y se le DICE a la persona quién le va a contestar. Saber que te atiende
 * alguien con nombre, y no un buzón, es lo que hace que la gente escriba.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NOTA DE ESTILO: `input`, `select`, `textarea` y `button` tienen reglas SIN
 * capa en globals.css (fondo, borde, radio, tipo de letra), así que ahí las
 * clases de Tailwind de esas propiedades no pintan. Por eso el selector de área
 * son `<label>` con un radio escondido y no botones: así el estilo es nuestro,
 * y de paso se navega con el teclado como debe.
 */

const WHATSAPP = '34638434970';

const PRIORIDADES: { valor: AreaSolicitud; texto: string; emoji: string }[] = [
  { valor: 'factura', texto: 'Analizar mi factura de luz o gas', emoji: '📄' },
  { valor: 'solar', texto: 'Placas solares para mi casa o negocio', emoji: '☀️' },
  { valor: 'auditoria', texto: 'Auditoría energética', emoji: '🔎' },
  { valor: 'asesoria', texto: 'Asesoría fiscal, laboral o contable', emoji: '📊' },
  { valor: 'seguros', texto: 'Seguros (Correbin Asociados)', emoji: '🛡️' },
  { valor: 'otro', texto: 'Otra necesidad', emoji: '💬' },
];

const VACIO = {
  nombre: '',
  empresa: '',
  email: '',
  telefono: '',
  prioridad: '' as AreaSolicitud | '',
  mensaje: '',
};

const etiqueta = 'mb-2 block text-sm font-semibold text-foreground';
const campo = 'w-full px-3 py-2.5';

export function FormularioContacto({ correo }: { correo: string }) {
  const [datos, setDatos] = useState(VACIO);
  const [tocado, setTocado] = useState(false);
  const [enviado, setEnviado] = useState<'whatsapp' | 'correo' | null>(null);

  // Quien pide no ver movimiento, no lo ve. El bloque de globals.css apaga las
  // animaciones de CSS, pero las de Motion hay que apagarlas aquí a mano.
  const quieto = useReducedMotion();

  const cambiar = (clave: keyof typeof VACIO) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setDatos((d) => ({ ...d, [clave]: e.target.value }));

  // Lo mínimo para que el aviso sirva de algo: un nombre y una forma de
  // devolverle la llamada. Sin teléfono ni correo, el mensaje no vale.
  const faltaNombre = !datos.nombre.trim();
  const faltaContacto = !datos.telefono.trim() && !datos.email.trim();
  const listo = !faltaNombre && !faltaContacto;

  const destino = destinoDe(datos.prioridad);

  function texto() {
    const p = PRIORIDADES.find((x) => x.valor === datos.prioridad)?.texto;
    return [
      'Solicitud desde la web de Gesmeco Energía',
      '',
      `Nombre: ${datos.nombre.trim()}`,
      datos.empresa.trim() && `Empresa: ${datos.empresa.trim()}`,
      datos.telefono.trim() && `Teléfono: ${datos.telefono.trim()}`,
      datos.email.trim() && `Email: ${datos.email.trim()}`,
      p && `Necesita: ${p}`,
      datos.mensaje.trim() && `\n${datos.mensaje.trim()}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  function enviarPorWhatsApp() {
    setTocado(true);
    if (!listo) return;
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto())}`, '_blank', 'noopener');
    setEnviado('whatsapp');
  }

  function enviarPorCorreo() {
    setTocado(true);
    if (!listo) return;
    // El destinatario sale del área elegida; `correo` es solo el de reserva
    const para = datos.prioridad ? destino.correo : correo;
    const asunto = `${destino.etiqueta} · ${datos.nombre.trim()}`;
    window.location.href = `mailto:${para}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto())}`;
    setEnviado('correo');
  }

  /** Entrada escalonada: cada bloque entra un pelín después que el anterior. */
  const entra = (retardo: number) =>
    quieto
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: '-60px' },
          transition: { duration: 0.5, delay: retardo, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <div className="card foco rounded-3xl p-8 shadow-soft">
      <div className="relative space-y-5">
        <motion.div {...entra(0)} className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={etiqueta} htmlFor="c-nombre">
              Nombre y apellidos <span className="text-accent">*</span>
            </label>
            <input
              id="c-nombre"
              className={campo}
              value={datos.nombre}
              onChange={cambiar('nombre')}
              placeholder="Nombre"
              autoComplete="name"
            />
          </div>
          <div>
            <label className={etiqueta} htmlFor="c-empresa">Empresa</label>
            <input
              id="c-empresa"
              className={campo}
              value={datos.empresa}
              onChange={cambiar('empresa')}
              placeholder="Empresa, granja o explotación"
              autoComplete="organization"
            />
          </div>
        </motion.div>

        <motion.div {...entra(0.07)} className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={etiqueta} htmlFor="c-email">Email</label>
            <input
              id="c-email"
              className={campo}
              type="email"
              value={datos.email}
              onChange={cambiar('email')}
              placeholder="email@empresa.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className={etiqueta} htmlFor="c-telefono">Teléfono</label>
            <input
              id="c-telefono"
              className={campo}
              type="tel"
              value={datos.telefono}
              onChange={cambiar('telefono')}
              placeholder="+34 600 000 000"
              autoComplete="tel"
            />
          </div>
        </motion.div>

        {/* Área: se elige tocando, no desplegando. Seis opciones caben a la
            vista, y así se ve de un golpe todo lo que hace el grupo. */}
        <motion.fieldset {...entra(0.14)}>
          <legend className={etiqueta}>¿Con qué te ayudamos?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {PRIORIDADES.map((p) => {
              const elegida = datos.prioridad === p.valor;
              return (
                <label
                  key={p.valor}
                  /**
                   * El borde de la elegida va en línea, no con clases.
                   *
                   * En este proyecto las reglas sin capa de globals.css ya han
                   * pisado utilidades de Tailwind más de una vez (ver la nota
                   * de estilo de CLAUDE.md sobre input/select/button). Lo que
                   * distingue lo elegido de lo no elegido es la única cosa que
                   * esta pantalla NO se puede permitir que salga mal, así que
                   * se pone donde ninguna hoja de estilos puede alcanzarlo.
                   */
                  style={
                    elegida
                      ? { borderColor: 'var(--color-accent)', boxShadow: '0 0 0 1px var(--color-accent)' }
                      : { borderColor: 'rgba(255,255,255,.12)' }
                  }
                  className={`group relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
                    elegida ? 'text-foreground' : 'text-muted hover:text-foreground'
                  }`}
                >
                  {/* El fondo de la elegida se desliza de una a otra en vez de
                      parpadear: se sigue con la vista sin esfuerzo. */}
                  {elegida && (
                    <motion.span
                      layoutId="area-elegida"
                      className="absolute inset-0 -z-10 bg-accent/12"
                      transition={quieto ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <input
                    type="radio"
                    name="prioridad"
                    value={p.valor}
                    checked={elegida}
                    onChange={cambiar('prioridad')}
                    className="sr-only"
                  />
                  <span className="text-lg leading-none">{p.emoji}</span>
                  <span className="leading-snug">{p.texto}</span>
                </label>
              );
            })}
          </div>

          {/* Quién te va a contestar. Saber que hay una persona detrás, y no un
              buzón, es lo que hace que la gente termine de escribir. */}
          {/* SIN AnimatePresence, a propósito.
              Este texto dice quién te va a llamar, y eso no puede depender de
              que una animación termine. Con AnimatePresence el párrafo viejo
              sigue montado hasta que acaba su salida, y si las animaciones no
              llegan a correr —pestaña en segundo plano, el navegador las pausa,
              o simplemente van lentas— se quedan los dos a la vez diciendo
              nombres distintos. Comprobado: pasaba.
              Así, el `key` remonta el párrafo, React quita el anterior en el
              acto y Motion solo acompaña la entrada. */}
          {datos.prioridad && (
            <motion.p
              key={destino.quien}
              initial={quieto ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="mt-3 flex items-center gap-2 text-sm text-muted"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Te contesta <b className="text-foreground">{destino.quien}</b>, que lleva esta parte.
            </motion.p>
          )}
        </motion.fieldset>

        <motion.div {...entra(0.21)}>
          <label className={etiqueta} htmlFor="c-mensaje">Contexto</label>
          <textarea
            id="c-mensaje"
            className={`${campo} h-28`}
            value={datos.mensaje}
            onChange={cambiar('mensaje')}
            placeholder="Cuéntanos tu caso: qué pagas de luz, si tienes negocio o granja, qué te preocupa..."
          />
        </motion.div>

        {/* El aviso solo aparece cuando ya se ha intentado enviar: regañar
            antes de que hayas escrito nada es de mala educación. */}
        <AnimatePresence>
          {tocado && !listo && (
            <motion.p
              role="alert"
              initial={quieto ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={quieto ? undefined : { opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
            >
              {faltaNombre
                ? 'Nos falta tu nombre para saber con quién hablamos.'
                : 'Déjanos un teléfono o un email; si no, no podemos contestarte.'}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Los botones van envueltos en motion.div y no animados ellos mismos:
            globals.css les pone su propio `transform` al pasar por encima, y
            dos cosas moviendo el mismo transform se pelean. */}
        <motion.div {...entra(0.28)} className="flex flex-wrap items-center gap-3">
          <motion.div whileHover={quieto ? undefined : { scale: 1.03 }} whileTap={quieto ? undefined : { scale: 0.98 }}>
            <button
              type="button"
              onClick={enviarPorWhatsApp}
              className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-6 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:shadow-[0_0_30px_rgba(37,211,102,0.4)]"
            >
              Enviar por WhatsApp
            </button>
          </motion.div>
          <motion.div whileHover={quieto ? undefined : { scale: 1.03 }} whileTap={quieto ? undefined : { scale: 0.98 }}>
            <button
              type="button"
              onClick={enviarPorCorreo}
              className="inline-flex items-center gap-2 rounded-xl border border-foreground/20 bg-foreground/5 px-6 py-3.5 text-base font-bold text-foreground transition-all hover:border-accent/50 hover:text-accent"
            >
              Enviar por correo
            </button>
          </motion.div>
        </motion.div>

        {/* Confirmación: el mensaje se abre en otra aplicación, así que sin
            esto uno se queda sin saber si ha pasado algo. */}
        <AnimatePresence>
          {enviado && (
            <motion.p
              initial={quieto ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={quieto ? undefined : { opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"
            >
              {enviado === 'whatsapp'
                ? 'Se ha abierto WhatsApp con el mensaje escrito. Dale a enviar y te contestamos.'
                : `Se ha abierto tu correo con el mensaje para ${destino.quien}. Dale a enviar y te contestamos.`}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.p {...entra(0.35)} className="text-sm text-muted">
          Respuesta en 24h. Sin spam, sin cesión de datos a terceros. Se abre tu WhatsApp o tu
          gestor de correo con el mensaje ya escrito: solo tienes que darle a enviar.
        </motion.p>
      </div>
    </div>
  );
}
