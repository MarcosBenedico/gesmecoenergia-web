'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CORREBIN_AVISOS, CORREBIN_EMPRESA, CORREBIN_COLORES as C } from '@/lib/correbin-marca';

/**
 * Formulario público de la microsede de seguros (Volumen III).
 *
 * Sirve para revisión de pólizas, siniestros y contacto general: los campos
 * se declaran desde fuera. Guarda en base de datos, muestra el estado de envío
 * y confirma con una referencia. No depende de WhatsApp.
 *
 * Accesibilidad: cada campo tiene su <label> real asociada, el error se
 * anuncia con role="alert" y todo se recorre con el teclado.
 */

export interface CampoForm {
  campo: string;
  etiqueta: string;
  tipo?: 'text' | 'tel' | 'email' | 'date' | 'number' | 'textarea' | 'select' | 'checkbox';
  requerido?: boolean;
  ayuda?: string;
  opciones?: readonly string[];
  /** Ocupa toda la fila. */
  ancho?: boolean;
}

export function FormularioSeguros({
  tipo, campos, opcionales, textoBoton, avisoSalud = false,
}: {
  tipo: 'revision' | 'siniestro' | 'contacto';
  campos: CampoForm[];
  /** Campos que se muestran plegados: no convertir el formulario en un interrogatorio. */
  opcionales?: CampoForm[];
  textoBoton: string;
  avisoSalud?: boolean;
}) {
  // El sector viaja en la URL desde las páginas sectoriales: quien llega desde
  // «Transporte y logística» no debería tener que escribirlo otra vez.
  const params = useSearchParams();
  const sectorHeredado = params.get('sector') || '';
  const [datos, setDatos] = useState<Record<string, string | boolean>>(
    sectorHeredado ? { sector: sectorHeredado } : {}
  );
  const [consentimiento, setConsentimiento] = useState(false);
  const [verOpcionales, setVerOpcionales] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [referencia, setReferencia] = useState('');

  const set = (campo: string, valor: string | boolean) => setDatos((d) => ({ ...d, [campo]: valor }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!consentimiento) {
      setError('Para enviar la solicitud hay que aceptar la política de privacidad.');
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch('/api/seguros/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...datos, tipo, consentimiento }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'No se pudo enviar la solicitud.'); return; }
      setReferencia(json.referencia);
    } catch {
      setError('No hemos podido conectar. Revisa tu conexión o llámanos por teléfono.');
    } finally {
      setEnviando(false);
    }
  }

  // ── Confirmación ──
  if (referencia) {
    return (
      <div className="rounded-2xl border p-8 text-center" style={{ borderColor: C.borde, background: '#fff' }}>
        <p className="text-2xl font-black" style={{ color: C.azul }}>Solicitud recibida</p>
        <p className="mt-3 text-base leading-relaxed" style={{ color: C.textoSuave }}>
          Nos ponemos en contacto contigo lo antes posible. Si prefieres adelantar cualquier cosa,
          llámanos y cita esta referencia:
        </p>
        <p
          className="mt-5 inline-block px-5 py-3 rounded-xl text-lg font-black tracking-wider"
          style={{ background: C.fondoAlt, color: C.azul }}
        >
          {referencia}
        </p>
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <a
            href={`tel:${CORREBIN_EMPRESA.telefonoTel}`}
            className="inline-flex items-center px-5 py-3 rounded-lg text-sm font-bold border transition hover:opacity-80"
            style={{ borderColor: C.azul, color: C.azul }}
          >
            Llamar al {CORREBIN_EMPRESA.telefono}
          </a>
          <a
            href={CORREBIN_EMPRESA.whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-5 py-3 rounded-lg text-sm font-bold border transition hover:opacity-80"
            style={{ borderColor: C.azul, color: C.azul }}
          >
            WhatsApp {CORREBIN_EMPRESA.whatsapp}
          </a>
        </div>
        <p className="mt-5 text-xs leading-relaxed" style={{ color: C.textoSuave }}>
          {CORREBIN_AVISOS.adjuntos}
        </p>
      </div>
    );
  }

  const claseInput = 'w-full rounded-lg border px-3.5 py-2.5 text-sm bg-white';
  const estiloInput = { borderColor: C.borde, color: C.texto };

  const pintarCampo = (c: CampoForm) => {
    const id = `f-${tipo}-${c.campo}`;
    const valor = (datos[c.campo] as string) ?? '';

    if (c.tipo === 'checkbox') {
      return (
        <div key={c.campo} className={c.ancho ? 'sm:col-span-2' : ''}>
          <label htmlFor={id} className="flex items-center gap-2.5 text-sm cursor-pointer" style={{ color: C.texto }}>
            <input
              id={id}
              type="checkbox"
              checked={Boolean(datos[c.campo])}
              onChange={(e) => set(c.campo, e.target.checked)}
              className="w-4 h-4"
            />
            {c.etiqueta}
          </label>
        </div>
      );
    }

    return (
      <div key={c.campo} className={c.ancho || c.tipo === 'textarea' ? 'sm:col-span-2' : ''}>
        <label htmlFor={id} className="block text-xs font-bold mb-1.5" style={{ color: C.azul }}>
          {c.etiqueta} {c.requerido && <span style={{ color: C.rojo }}>*</span>}
        </label>
        {c.tipo === 'textarea' ? (
          <textarea
            id={id}
            rows={4}
            required={c.requerido}
            value={valor}
            onChange={(e) => set(c.campo, e.target.value)}
            className={`${claseInput} resize-y`}
            style={estiloInput}
          />
        ) : c.tipo === 'select' ? (
          <select
            id={id}
            required={c.requerido}
            value={valor}
            onChange={(e) => set(c.campo, e.target.value)}
            className={claseInput}
            style={estiloInput}
          >
            <option value="">— Selecciona —</option>
            {c.opciones?.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input
            id={id}
            type={c.tipo || 'text'}
            required={c.requerido}
            value={valor}
            onChange={(e) => set(c.campo, e.target.value)}
            className={claseInput}
            style={estiloInput}
          />
        )}
        {c.ayuda && <p className="text-[11px] mt-1" style={{ color: C.textoSuave }}>{c.ayuda}</p>}
      </div>
    );
  };

  return (
    <form onSubmit={enviar} className="rounded-2xl border p-6 md:p-8" style={{ borderColor: C.borde, background: '#fff' }}>
      <div className="grid sm:grid-cols-2 gap-4">{campos.map(pintarCampo)}</div>

      {opcionales && opcionales.length > 0 && (
        <div className="mt-5 pt-5 border-t" style={{ borderColor: C.borde }}>
          <button
            type="button"
            onClick={() => setVerOpcionales((v) => !v)}
            className="text-sm font-bold hover:opacity-70 transition"
            style={{ color: C.azul }}
            aria-expanded={verOpcionales}
          >
            {verOpcionales ? '− Ocultar datos adicionales' : '+ Añadir datos que agilizan el análisis (opcional)'}
          </button>
          {verOpcionales && <div className="grid sm:grid-cols-2 gap-4 mt-4">{opcionales.map(pintarCampo)}</div>}
        </div>
      )}

      <div className="mt-6 pt-5 border-t space-y-3" style={{ borderColor: C.borde }}>
        {avisoSalud && (
          <p className="text-xs leading-relaxed" style={{ color: C.textoSuave }}>
            {CORREBIN_AVISOS.salud}
          </p>
        )}
        <label className="flex items-start gap-2.5 text-xs leading-relaxed cursor-pointer" style={{ color: C.texto }}>
          <input
            type="checkbox"
            checked={consentimiento}
            onChange={(e) => setConsentimiento(e.target.checked)}
            className="w-4 h-4 mt-0.5 shrink-0"
            required
          />
          <span>
            {CORREBIN_AVISOS.consentimiento}{' '}
            <Link href="/privacidad" className="underline font-semibold" style={{ color: C.azul }}>
              Ver política de privacidad
            </Link>
          </span>
        </label>

        {error && (
          <p role="alert" className="text-sm font-semibold rounded-lg p-3" style={{ color: C.rojo, background: '#fdf2f4' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-3.5 rounded-lg text-base font-bold text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ background: C.rojo }}
        >
          {enviando ? 'Enviando…' : textoBoton}
        </button>

        <p className="text-xs leading-relaxed" style={{ color: C.textoSuave }}>
          {CORREBIN_AVISOS.adjuntos}
        </p>
      </div>
    </form>
  );
}
