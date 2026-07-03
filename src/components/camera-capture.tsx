'use client';

import { useState, useRef } from 'react';
import { X, Camera, Upload } from 'lucide-react';

interface CameraCaptureProps {
  onFileSelected: (file: File) => void;
  isLoading?: boolean;
}

export function CameraCapture({ onFileSelected, isLoading }: CameraCaptureProps) {
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setShowCamera(true);
      }
    } catch (err) {
      alert('No se pudo acceder a la cámara. Sube una foto en su lugar.');
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);
    canvasRef.current.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], 'factura.jpg', { type: 'image/jpeg' });
          onFileSelected(file);
          stopCamera();
        }
      },
      'image/jpeg',
      0.9
    );
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
  }

  return (
    <div className="space-y-3">
      {showCamera ? (
        <div className="relative bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full aspect-video object-cover"
          />
          <div className="absolute inset-0 border-2 border-accent/50 m-4 rounded-lg pointer-events-none">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-white text-center">
                <p className="text-sm font-semibold">Centra la factura en el marco</p>
              </div>
            </div>
          </div>
          <div className="absolute bottom-4 left-0 right-0 flex gap-2 justify-center px-4">
            <button
              onClick={capturePhoto}
              disabled={isLoading}
              className="flex-1 bg-accent text-white py-2 rounded-lg font-semibold disabled:opacity-50"
            >
              <Camera className="w-5 h-5 mx-auto" />
            </button>
            <button
              onClick={stopCamera}
              disabled={isLoading}
              className="flex-1 bg-destructive/20 text-destructive py-2 rounded-lg font-semibold"
            >
              <X className="w-5 h-5 mx-auto" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={startCamera}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 bg-accent text-white py-3 rounded-lg font-semibold disabled:opacity-50"
          >
            <Camera className="w-5 h-5" />
            <span>Escanear factura</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 bg-secondary text-secondary-foreground py-3 rounded-lg font-semibold disabled:opacity-50"
          >
            <Upload className="w-5 h-5" />
            <span>Subir foto</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
