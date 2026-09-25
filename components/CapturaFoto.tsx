"use client";

import { useRef, useState } from "react";

const LADO_MAXIMO = 1400;

/** Achica la foto en el celular antes de subirla (una foto de cámara pesa 3-8 MB). */
async function comprimir(archivo: File): Promise<string> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("No se pudo leer la imagen."));
      i.src = url;
    });
    const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.78);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function CapturaFoto({ valor, onCambio }: { valor: string | null; onCambio: (dataUrl: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          const archivo = e.target.files?.[0];
          e.target.value = "";
          if (!archivo) return;
          try {
            setError(null);
            onCambio(await comprimir(archivo));
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo procesar la foto.");
          }
        }}
      />
      {valor ? (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={valor} alt="Foto de la carga" className="h-28 w-auto rounded-md border border-zinc-300 object-cover" />
          <div className="flex flex-col gap-1 text-xs">
            <button type="button" onClick={() => inputRef.current?.click()} className="font-medium text-brand-navy hover:underline">
              Sacar otra
            </button>
            <button type="button" onClick={() => onCambio(null)} className="font-medium text-red-600 hover:underline">
              Quitar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} className="boton-secundario">
          📷 Sacar foto de la carga
        </button>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
