'use client';

import { useState } from 'react';

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
 * Lo suyo sigue siendo un endpoint que guarde el aviso en Supabase y os avise,
 * porque así queda registrado y entra en la Bandeja como cualquier otro trabajo.
 * Eso hay que decidirlo (¿tabla propia? ¿entra como precliente?) y no lo he
 * hecho por mi cuenta.
 */

const WHATSAPP = '34638434970';

const PRIORIDADES = [
  { valor: 'factura', texto: 'Analizar mi factura de luz o gas' },
  { valor: 'solar', texto: 'Placas solares para mi casa o negocio' },
  { valor: 'auditoria', texto: 'Auditoría energética' },
  { valor: 'asesoria', texto: 'Asesoría fiscal, laboral o contable' },
  { valor: 'seguros', texto: 'Seguros (Correbin Asociados)' },
  { valor: 'otro', texto: 'Otra necesidad' },
];

const VACIO = {
  nombre: '',
  empresa: '',
  email: '',
  telefono: '',
  prioridad: '',
  mensaje: '',
};

const etiqueta = 'mb-2 block text-sm font-semibold text-foreground';
const campo = 'w-full px-3 py-2.5';

export function FormularioContacto({ correo }: { correo: string }) {
  const [datos, setDatos] = useState(VACIO);
  const [tocado, setTocado] = useState(false);

  const cambiar = (clave: keyof typeof VACIO) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setDatos((d) => ({ ...d, [clave]: e.target.value }));

  // Lo mínimo para que el aviso sirva de algo: un nombre y una forma de
  // devolverle la llamada. Sin teléfono ni correo, el mensaje no vale.
  const faltaNombre = !datos.nombre.trim();
  const faltaContacto = !datos.telefono.trim() && !datos.email.trim();
  const listo = !faltaNombre && !faltaContacto;

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
  }

  function enviarPorCorreo() {
    setTocado(true);
    if (!listo) return;
    const asunto = `Solicitud web · ${datos.nombre.trim()}`;
    window.location.href = `mailto:${correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto())}`;
  }

  return (
    <div className="card foco rounded-3xl p-8 shadow-soft">
      <div className="relative space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
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
        </div>

        <div className="grid gap-4 md:grid-cols-2">
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
        </div>

        <div>
          <label className={etiqueta} htmlFor="c-prioridad">Prioridad principal</label>
          <select id="c-prioridad" className={campo} value={datos.prioridad} onChange={cambiar('prioridad')}>
            <option value="">Selecciona una opción</option>
            {PRIORIDADES.map((p) => (
              <option key={p.valor} value={p.valor}>{p.texto}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={etiqueta} htmlFor="c-mensaje">Contexto</label>
          <textarea
            id="c-mensaje"
            className={`${campo} h-28`}
            value={datos.mensaje}
            onChange={cambiar('mensaje')}
            placeholder="Cuéntanos tu caso: qué pagas de luz, si tienes negocio o granja, qué te preocupa..."
          />
        </div>

        {/* El aviso solo aparece cuando ya se ha intentado enviar: regañar
            antes de que hayas escrito nada es de mala educación. */}
        {tocado && !listo && (
          <p
            role="alert"
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
          >
            {faltaNombre
              ? 'Nos falta tu nombre para saber con quién hablamos.'
              : 'Déjanos un teléfono o un email; si no, no podemos contestarte.'}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={enviarPorWhatsApp}
            className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-6 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:shadow-[0_0_30px_rgba(37,211,102,0.4)]"
          >
            Enviar por WhatsApp
          </button>
          <button
            type="button"
            onClick={enviarPorCorreo}
            className="inline-flex items-center gap-2 rounded-xl border border-foreground/20 bg-foreground/5 px-6 py-3.5 text-base font-bold text-foreground transition-all hover:border-accent/50 hover:text-accent"
          >
            Enviar por correo
          </button>
        </div>

        <p className="text-sm text-muted">
          Respuesta en 24h. Sin spam, sin cesión de datos a terceros. Se abre tu WhatsApp o tu
          gestor de correo con el mensaje ya escrito: solo tienes que darle a enviar.
        </p>
      </div>
    </div>
  );
}
