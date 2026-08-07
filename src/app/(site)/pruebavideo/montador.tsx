'use client';

/**
 * MONTADOR EN EL NAVEGADOR — pantalla de la prueba.
 *
 * Todo ocurre en el ordenador de quien la usa: los vídeos no se suben a ningún
 * sitio, no hay servidor y no se guarda nada. Es a la vez la decisión técnica
 * (Vercel no puede recodificar vídeo: sus funciones se cortan a los 60 s) y la
 * mejor respuesta para material personal.
 */
import { useCallback, useRef, useState } from 'react';
import { momentosDeArchivo, elegirMontaje, type MomentoElegido } from '@/lib/montaje-video';
import {
  energiaDeArchivo, inspeccionarArchivo, argumentosCorte, listaConcat,
  nombreTrozo, segundosEstimados, FORMATOS, FFMPEG_BASE, urlAbsoluta, type Formato,
} from '@/lib/montaje-navegador';

type Fase = 'inicio' | 'analizando' | 'plan' | 'montando' | 'listo';

interface Analizado {
  archivo: File;
  duracion: number;
  ancho: number;
  alto: number;
  momentos: ReturnType<typeof momentosDeArchivo>;
  sinAudio: boolean;
}

const seg = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function Montador() {
  const [fase, setFase] = useState<Fase>('inicio');
  const [analizados, setAnalizados] = useState<Analizado[]>([]);
  const [plan, setPlan] = useState<MomentoElegido[]>([]);
  const [duracion, setDuracion] = useState(30);
  const [formato, setFormato] = useState<Formato>('vertical');
  const [aviso, setAviso] = useState('');
  const [paso, setPaso] = useState('');
  const [resultado, setResultado] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // El módulo de ffmpeg pesa 31 MB: se carga una sola vez y se reutiliza.
  const ffmpegRef = useRef<unknown>(null);

  const analizar = useCallback(async (archivos: File[]) => {
    setFase('analizando');
    setAviso('');
    setResultado(null);
    const salida: Analizado[] = [];

    for (const archivo of archivos) {
      setPaso(`Escuchando ${archivo.name}...`);
      try {
        const info = await inspeccionarArchivo(archivo);
        const energias = await energiaDeArchivo(archivo);
        salida.push({
          archivo, ...info, sinAudio: energias.length === 0,
          momentos: energias.length ? momentosDeArchivo(energias, { duracion: info.duracion }) : [],
        });
      } catch (e) {
        setAviso(e instanceof Error ? e.message : String(e));
      }
    }

    setAnalizados(salida);
    rehacerPlan(salida, duracion);
    setFase('plan');
    setPaso('');
  }, [duracion]);

  function rehacerPlan(lista: Analizado[], objetivo: number) {
    const porArchivo: Record<string, ReturnType<typeof momentosDeArchivo>> = {};
    for (const a of lista) if (a.momentos.length) porArchivo[a.archivo.name] = a.momentos;
    setPlan(elegirMontaje(porArchivo, { objetivoS: objetivo }).momentos);
  }

  async function montar() {
    if (!plan.length) return;
    setFase('montando');
    setAviso('');

    try {
      // La carga va aquí dentro y no arriba del archivo: son 31 MB que no tiene
      // sentido descargar a quien solo abre la página a mirar.
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { fetchFile } = await import('@ffmpeg/util');

      if (!ffmpegRef.current) {
        setPaso('Cargando el motor de vídeo (31 MB, solo la primera vez)...');
        const ff = new FFmpeg();
        // Las tres van ABSOLUTAS. Con rutas relativas la librería las resuelve
        // contra `import.meta.url`, que en el paquete de Turbopack es un
        // `file://`, y el navegador rechaza el worker resultante. Ver
        // urlAbsoluta() en montaje-navegador.ts.
        await ff.load({
          coreURL: urlAbsoluta(`${FFMPEG_BASE}/ffmpeg-core.js`),
          wasmURL: urlAbsoluta(`${FFMPEG_BASE}/ffmpeg-core.wasm`),
          classWorkerURL: urlAbsoluta(`${FFMPEG_BASE}/worker.js`),
        });
        ffmpegRef.current = ff;
      }
      const ff = ffmpegRef.current as import('@ffmpeg/ffmpeg').FFmpeg;

      const porNombre = new Map(analizados.map((a) => [a.archivo.name, a]));
      const trozos: string[] = [];

      for (let i = 0; i < plan.length; i++) {
        const m = plan[i];
        const fuente = porNombre.get(m.archivo);
        if (!fuente) continue;

        setPaso(`Cortando ${i + 1} de ${plan.length}...`);
        const entrada = `e${i}_${m.archivo.replace(/[^\w.]/g, '_')}`;
        await ff.writeFile(entrada, await fetchFile(fuente.archivo));

        const destino = nombreTrozo(i);
        await ff.exec(argumentosCorte(
          entrada, destino, m.inicio, m.fin - m.inicio, formato, !fuente.sinAudio
        ));
        trozos.push(destino);
        await ff.deleteFile(entrada);
      }

      setPaso('Pegando los cortes...');
      await ff.writeFile('lista.txt', listaConcat(trozos));
      await ff.exec(['-f', 'concat', '-safe', '0', '-i', 'lista.txt', '-c', 'copy', 'final.mp4']);

      const datos = await ff.readFile('final.mp4');
      const blob = new Blob([datos as unknown as BlobPart], { type: 'video/mp4' });
      setResultado(URL.createObjectURL(blob));
      setFase('listo');
      setPaso('');

      for (const t of trozos) await ff.deleteFile(t).catch(() => {});
    } catch (e) {
      setAviso(
        `No he podido montar el clip: ${e instanceof Error ? e.message : String(e)}. ` +
        'Suele pasar con vídeos muy largos: prueba con material más corto.'
      );
      setFase('plan');
      setPaso('');
    }
  }

  const conMomentos = analizados.filter((a) => a.momentos.length);
  const mudos = analizados.filter((a) => a.sinAudio);

  return (
    <div className="space-y-6">
      {/* ── ELEGIR ARCHIVOS ── */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const f = Array.from(e.target.files || []);
            if (f.length) analizar(f);
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={fase === 'analizando' || fase === 'montando'}
          className="w-full min-h-[56px] rounded-xl bg-white text-black text-base font-bold hover:opacity-90 active:scale-[0.99] transition disabled:opacity-40"
        >
          {analizados.length ? 'Elegir otros vídeos' : 'Elegir vídeos'}
        </button>
        <p className="text-sm text-white/50 mt-3 text-center">
          Puedes seleccionar varios a la vez. No se suben a ningún sitio: todo pasa en tu ordenador.
        </p>
      </div>

      {paso && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-3">
          <span className="inline-block w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin shrink-0" />
          <p className="text-sm text-white/80">{paso}</p>
        </div>
      )}

      {aviso && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
          <p className="text-sm text-amber-200">{aviso}</p>
        </div>
      )}

      {/* ── QUÉ HA ENCONTRADO ── */}
      {analizados.length > 0 && fase !== 'analizando' && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
          <h2 className="text-lg font-bold">Lo que he escuchado</h2>
          <div className="space-y-2">
            {analizados.map((a) => (
              <div key={a.archivo.name} className="flex items-center gap-3 text-sm">
                <span className={a.momentos.length ? 'text-emerald-400' : 'text-white/30'}>
                  {a.momentos.length ? '✓' : '·'}
                </span>
                <span className="flex-1 min-w-0 truncate text-white/80">{a.archivo.name}</span>
                <span className="text-white/40 shrink-0">
                  {seg(a.duracion)} · {a.ancho}×{a.alto}
                </span>
                <span className="text-white/60 shrink-0 w-24 text-right">
                  {a.sinAudio
                    ? 'sin audio'
                    : `${a.momentos.length} ${a.momentos.length === 1 ? 'momento' : 'momentos'}`}
                </span>
              </div>
            ))}
          </div>

          {mudos.length > 0 && (
            <p className="text-xs text-white/40 border-t border-white/10 pt-3">
              Los vídeos sin pista de audio quedan fuera: el criterio se apoya en el sonido,
              así que no hay forma de saber qué momento es bueno.
            </p>
          )}

          {/* ── AJUSTES ── */}
          <div className="grid sm:grid-cols-2 gap-4 border-t border-white/10 pt-4">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                Duración del clip: {duracion} s
              </span>
              <input
                type="range" min={10} max={90} step={5} value={duracion}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setDuracion(v);
                  rehacerPlan(analizados, v);
                }}
                className="w-full mt-2 accent-white"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-white/50">Formato</span>
              <select
                value={formato}
                onChange={(e) => setFormato(e.target.value as Formato)}
                className="w-full mt-2"
              >
                {Object.entries(FORMATOS).map(([k, v]) => (
                  <option key={k} value={k}>{v.etiqueta}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {/* ── EL PLAN ── */}
      {plan.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-bold">El montaje</h2>
            <p className="text-sm text-white/50">
              {plan.length} cortes · {plan.reduce((s, m) => s + (m.fin - m.inicio), 0).toFixed(0)} s
            </p>
          </div>

          <div className="space-y-1.5">
            {plan.map((m, i) => (
              <div key={`${m.archivo}-${m.inicio}`} className="flex items-center gap-3 text-sm">
                <span className="text-white/30 tabular-nums w-5 shrink-0">{i + 1}</span>
                <span className="tabular-nums text-white/70 shrink-0">
                  {seg(m.inicio)}–{seg(m.fin)}
                </span>
                <span className="flex-1 min-w-0 truncate text-white/50">{m.archivo}</span>
                <span className="shrink-0 text-white/30" aria-hidden>
                  {'█'.repeat(Math.max(1, Math.round(m.puntos * 8)))}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={montar}
            disabled={fase === 'montando'}
            className="w-full min-h-[56px] rounded-xl bg-white text-black text-base font-bold hover:opacity-90 active:scale-[0.99] transition disabled:opacity-40"
          >
            {fase === 'montando' ? 'Montando...' : 'Montar el clip'}
          </button>
          <p className="text-xs text-white/40 text-center">
            Tardará alrededor de {segundosEstimados(plan)} s. No cierres la pestaña.
            {!ffmpegRef.current && ' La primera vez se descargan 31 MB del motor de vídeo.'}
          </p>
        </div>
      )}

      {conMomentos.length === 0 && analizados.length > 0 && fase === 'plan' && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
          <p className="text-sm text-amber-200">
            No he encontrado ningún momento que destaque. Suele ser que los vídeos no tienen
            sonido, o que el sonido es tan plano que nada sobresale.
          </p>
        </div>
      )}

      {/* ── RESULTADO ── */}
      {resultado && (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.06] p-6 space-y-4">
          <h2 className="text-lg font-bold text-emerald-300">Listo</h2>
          <video src={resultado} controls playsInline className="w-full rounded-xl max-h-[70vh] bg-black" />
          <a
            href={resultado}
            download="montaje.mp4"
            className="block w-full min-h-[56px] rounded-xl bg-white text-black text-base font-bold hover:opacity-90 transition flex items-center justify-center"
          >
            Descargar
          </a>
        </div>
      )}
    </div>
  );
}
