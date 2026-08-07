import type { Metadata } from 'next';
import Montador from './montador';

export const metadata: Metadata = {
  title: 'Prueba · Montador de vídeo',
  // Es una prueba colgada del dominio de la empresa, no un servicio. Que no
  // salga en Google ni se asocie a Gesmeco Energía en resultados de búsqueda.
  robots: { index: false, follow: false },
};

export default function PruebaVideoPage() {
  return (
    <main className="min-h-screen px-4 py-12 sm:py-20">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <header className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">Prueba</p>
          <h1>Varios vídeos, un clip</h1>
          <p className="text-white/60">
            Elige varios vídeos y busco los momentos que destacan para pegarlos en un clip
            único, en vertical. Todo ocurre en tu ordenador: los vídeos no se suben a ningún
            sitio ni se guardan en ninguna parte.
          </p>
        </header>

        <Montador />

        <section className="border-t border-white/10 pt-6 space-y-3 text-sm text-white/50">
          <h2 className="text-sm font-bold text-white/70">Cómo decide qué es un buen momento</h2>
          <p>
            Por el sonido. En vídeo de gente, lo interesante casi siempre suena: alguien habla,
            alguien se ríe, algo golpea. Los silencios son el relleno. Medir la imagen suena
            más listo pero engaña: una cámara temblando puntúa altísimo sin que pase nada.
          </p>
          <p>
            Cada vídeo se compara consigo mismo, así que uno grabado bajito no se queda fuera
            frente a otro grabado alto. Ningún vídeo puede acaparar el clip y ninguno se queda
            fuera del todo. Y los cortes van en orden cronológico, no por puntuación.
          </p>
          <h2 className="text-sm font-bold text-white/70 pt-2">Lo que todavía no hace</h2>
          <p>
            No pone subtítulos, no entiende <em>lo que se dice</em> (elige por cómo suena, no por
            el contenido) y al recortar en vertical no sigue las caras: recorta por el centro,
            así que si quien habla está a un lado del plano se le puede cortar. Para eso está el
            formato horizontal, que no recorta nada.
          </p>
        </section>
      </div>
    </main>
  );
}
