import type { Metadata } from 'next';
import Link from 'next/link';
import { CORREBIN_EMPRESA, CORREBIN_COLORES as C } from '@/lib/correbin-marca';

/**
 * Microsede de Correbin Asociados.
 *
 * Identidad, navegación y conversión propias dentro del dominio del grupo,
 * que es lo que pide el Volumen I. Tiene su propio layout porque el Volumen II
 * exige fondos claros y azul estructural, mientras que la web de energía es
 * de tema oscuro: mezclarlos daría una microsede a medias.
 */

export const metadata: Metadata = {
  title: 'Correbin Asociados · Correduría de seguros para empresas',
  description:
    'Broker técnico y gerente externo de riesgos. Análisis, negociación y defensa del programa de seguros de tu empresa, antes, durante y después del siniestro.',
};

const ENLACES = [
  { href: '/correbin', texto: 'Inicio' },
  { href: '/correbin#metodo', texto: 'Cómo trabajamos' },
  { href: '/correbin#empresa', texto: 'Empresas' },
  { href: '/correbin#particulares', texto: 'Particulares' },
  { href: '/correbin#contacto', texto: 'Contacto' },
];

export default function CorrebinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: C.fondo, color: C.texto }} className="min-h-screen flex flex-col">
      {/* ── Cabecera propia ── */}
      <header className="border-b sticky top-0 z-50" style={{ background: C.fondo, borderColor: C.borde }}>
        <div className="mx-auto max-w-6xl px-5 h-20 flex items-center justify-between gap-6">
          <Link href="/correbin" className="flex flex-col leading-none shrink-0">
            <span className="text-xl font-black tracking-tight" style={{ color: C.azul }}>
              CORREBIN
            </span>
            <span className="text-[10px] font-semibold tracking-[0.28em] uppercase" style={{ color: C.textoSuave }}>
              Asociados · Correduría de seguros
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold">
            {ENLACES.map((e) => (
              <Link key={e.href + e.texto} href={e.href} className="hover:opacity-70 transition" style={{ color: C.azul }}>
                {e.texto}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`tel:${CORREBIN_EMPRESA.telefonoTel}`}
              className="hidden sm:inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-bold border transition hover:opacity-80"
              style={{ borderColor: C.azul, color: C.azul }}
            >
              {CORREBIN_EMPRESA.telefono}
            </a>
            <a
              href="#contacto"
              className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: C.rojo }}
            >
              Solicitar revisión
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* ── Pie propio ── */}
      <footer className="mt-16 border-t" style={{ background: C.azul, borderColor: C.azul }}>
        <div className="mx-auto max-w-6xl px-5 py-12 grid gap-8 md:grid-cols-3 text-white">
          <div>
            <p className="text-lg font-black tracking-tight">CORREBIN</p>
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-white/60 mt-1">
              Asociados · Correduría de seguros
            </p>
            <p className="text-sm text-white/70 mt-4 leading-relaxed">
              {CORREBIN_EMPRESA.razonSocial}
              <br />
              CIF {CORREBIN_EMPRESA.cif}
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-3">Contacto</p>
            <a href={`tel:${CORREBIN_EMPRESA.telefonoTel}`} className="block text-sm text-white/85 hover:text-white transition">
              Teléfono {CORREBIN_EMPRESA.telefono}
            </a>
            <a
              href={CORREBIN_EMPRESA.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-white/85 hover:text-white transition mt-1"
            >
              WhatsApp {CORREBIN_EMPRESA.whatsapp}
            </a>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-3">Grupo Gesmeco</p>
            <Link href="/" className="block text-sm text-white/85 hover:text-white transition">
              Gesmeco Energía
            </Link>
            <Link href="/grupo" className="block text-sm text-white/85 hover:text-white transition mt-1">
              Conocer el grupo
            </Link>
            <Link href="/aviso-legal" className="block text-sm text-white/60 hover:text-white transition mt-3">
              Aviso legal
            </Link>
            <Link href="/privacidad" className="block text-sm text-white/60 hover:text-white transition mt-1">
              Privacidad
            </Link>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-white/50">
            © {new Date().getFullYear()} {CORREBIN_EMPRESA.razonSocial}
          </p>
        </div>
      </footer>
    </div>
  );
}
