'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Upload, Camera, FileText, Image, X, Trash2, Eye, Loader, CheckCircle2, AlertCircle,
} from 'lucide-react';

interface Documento {
  id: string;
  nombre_original: string;
  tipo_documento: 'factura' | 'contrato' | 'foto' | 'otro';
  descripcion: string | null;
  tamano_bytes: number;
  mime_type: string;
  creado_en: string;
  analizado: boolean;
  notas_analisis: string | null;
  url_descarga: string | null;
}

const TIPOS_LABELS: Record<string, string> = {
  factura: '📄 Factura',
  contrato: '📋 Contrato',
  foto: '📸 Foto',
  otro: '📎 Documento',
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function ClienteDocumentos({ token }: { token: string }) {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);

  // Form
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<'factura' | 'contrato' | 'foto' | 'otro'>('otro');
  const [descripcion, setDescripcion] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  // Cámara
  const [usandoCamara, setUsandoCamara] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    cargarDocumentos();
  }, [token]);

  async function cargarDocumentos() {
    setCargando(true);
    try {
      const res = await fetch(`/api/cliente/documentos?token=${token}`);
      const json = await res.json();
      if (json.ok) {
        setDocumentos(json.documentos || []);
      } else {
        setError(json.error || 'Error cargando documentos');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setCargando(false);
    }
  }

  function aviso(msg: string, esError = false) {
    if (esError) { setError(msg); setExito(''); }
    else { setExito(msg); setError(''); }
    setTimeout(() => { setError(''); setExito(''); }, 5000);
  }

  async function abrirCamara() {
    setUsandoCamara(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      aviso('No se pudo acceder a la cámara', true);
      setUsandoCamara(false);
    }
  }

  function capturarFoto() {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);
      canvasRef.current.toBlob((blob) => {
        if (blob) {
          setArchivo(new File([blob], `foto_${Date.now()}.png`, { type: 'image/png' }));
          setNombre(`Factura ${new Date().toLocaleDateString('es-ES')}`);
          setTipo('factura');
          cerrarCamara();
        }
      }, 'image/png');
    }
  }

  function cerrarCamara() {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    }
    setUsandoCamara(false);
  }

  async function subir(e: React.FormEvent) {
    e.preventDefault();
    if (!archivo) { aviso('Selecciona un archivo', true); return; }

    setSubiendo(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const base64 = (ev.target?.result as string).split(',')[1];
        const res = await fetch('/api/cliente/documentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            nombre: nombre || archivo.name,
            tipo_documento: tipo,
            descripcion: descripcion || null,
            archivo_base64: base64,
            mime_type: archivo.type,
          }),
        });
        const json = await res.json();
        if (!res.ok) { aviso(json.error, true); return; }
        aviso('Documento subido correctamente');
        setNombre('');
        setDescripcion('');
        setArchivo(null);
        setMostrarForm(false);
        await cargarDocumentos();
      } catch (error) {
        aviso('Error subiendo documento', true);
      } finally {
        setSubiendo(false);
      }
    };
    reader.onerror = () => {
      aviso('Error leyendo el archivo', true);
      setSubiendo(false);
    };
    reader.readAsDataURL(archivo);
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este documento?')) return;
    try {
      const res = await fetch('/api/cliente/documentos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, id }),
      });
      if (res.ok) {
        aviso('Documento eliminado');
        cargarDocumentos();
      } else {
        aviso('Error eliminando documento', true);
      }
    } catch {
      aviso('Error de conexión', true);
    }
  }

  return (
    <div className="space-y-4">
      {/* Avisos */}
      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}
      {exito && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{exito}</p>
        </div>
      )}

      {/* Botones de acción */}
      {!mostrarForm && !usandoCamara && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setMostrarForm(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-accent/15 text-accent text-sm font-semibold hover:bg-accent/25 transition"
          >
            <Upload className="w-4 h-4" />
            Subir archivo
          </button>
          <button
            onClick={abrirCamara}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-accent/15 text-accent text-sm font-semibold hover:bg-accent/25 transition"
          >
            <Camera className="w-4 h-4" />
            Capturar foto
          </button>
        </div>
      )}

      {/* Formulario */}
      {mostrarForm && !usandoCamara && (
        <form onSubmit={subir} className="bg-secondary/40 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Subir documento</h3>
            <button
              type="button"
              onClick={() => setMostrarForm(false)}
              className="p-1 hover:bg-card rounded text-muted"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted block mb-1">Tipo de documento</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg border border-border/40 bg-background/50 text-sm"
            >
              <option value="factura">📄 Factura</option>
              <option value="contrato">📋 Contrato</option>
              <option value="foto">📸 Foto</option>
              <option value="otro">📎 Otro documento</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted block mb-1">Nombre/descripción breve</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Factura octubre 2025"
              className="w-full px-3 py-2 rounded-lg border border-border/40 bg-background/50 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted block mb-1">Notas adicionales (opcional)</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Factura corregida después de contactar con comercializadora"
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-border/40 bg-background/50 text-sm resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted block mb-2">Archivo (PDF, PNG, JPG, máx 50 MB)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setArchivo(e.target.files?.[0] || null)}
              className="w-full text-xs"
            />
            {archivo && (
              <p className="mt-1.5 text-xs text-accent">
                ✓ {archivo.name} ({formatSize(archivo.size)})
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={subiendo || !archivo}
            className="w-full px-3 py-2 bg-accent text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-accent/90 transition flex items-center justify-center gap-2"
          >
            {subiendo ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Subir documento
              </>
            )}
          </button>
        </form>
      )}

      {/* Cámara */}
      {usandoCamara && (
        <div className="bg-secondary/40 rounded-lg p-4 space-y-3">
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full"
              style={{ aspectRatio: '4/3' }}
            />
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex gap-2">
            <button
              onClick={capturarFoto}
              className="flex-1 px-3 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent/90"
            >
              Capturar foto
            </button>
            <button
              onClick={cerrarCamara}
              className="flex-1 px-3 py-2 bg-secondary rounded-lg text-sm font-semibold hover:bg-secondary/80"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de documentos */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center justify-between">
          Mis documentos
          {documentos.length > 0 && (
            <span className="text-xs text-muted font-normal">({documentos.length})</span>
          )}
        </h3>

        {cargando ? (
          <div className="text-center py-6 text-muted text-sm">
            <Loader className="w-5 h-5 mx-auto mb-1 animate-spin" />
            Cargando...
          </div>
        ) : documentos.length === 0 ? (
          <div className="text-center py-8 text-muted text-sm rounded-lg bg-secondary/20 border border-border/20">
            No hay documentos aún. Sube tu primera factura o documento.
          </div>
        ) : (
          <div className="space-y-2">
            {documentos.map((doc) => (
              <div
                key={doc.id}
                className="bg-secondary/40 rounded-lg p-3 flex items-start gap-3 group hover:bg-secondary/50 transition"
              >
                <div className="pt-0.5">
                  {doc.mime_type.startsWith('image/') ? (
                    <Image className="w-5 h-5 text-blue-400" />
                  ) : (
                    <FileText className="w-5 h-5 text-amber-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold line-clamp-1">{doc.nombre_original}</p>
                  <div className="flex items-center gap-2 text-[11px] text-muted mt-0.5">
                    <span>{TIPOS_LABELS[doc.tipo_documento]}</span>
                    <span>·</span>
                    <span>{formatSize(doc.tamano_bytes)}</span>
                    <span>·</span>
                    <span>{formatDate(doc.creado_en)}</span>
                  </div>
                  {doc.descripcion && (
                    <p className="text-xs text-muted mt-1 italic line-clamp-1">{doc.descripcion}</p>
                  )}
                  {doc.analizado && (
                    <div className="mt-1.5 text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="line-clamp-2">{doc.notas_analisis || 'Analizado'}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  {doc.url_descarga && (
                    <a
                      href={doc.url_descarga}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded hover:bg-card text-muted hover:text-accent transition"
                      title="Descargar"
                    >
                      <Eye className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => eliminar(doc.id)}
                    className="p-1.5 rounded hover:bg-card text-muted hover:text-red-400 transition"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
