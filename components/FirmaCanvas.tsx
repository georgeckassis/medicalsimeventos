"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface FirmaCanvasHandle {
  /** PNG en data URL, o null si todavía no se dibujó nada. */
  obtenerFirma: () => string | null;
  limpiar: () => void;
}

/**
 * Pad de firma táctil — dibujo libre con el dedo/mouse sobre un canvas.
 * touch-action: none evita que el navegador intente scrollear la página
 * mientras se firma.
 */
const FirmaCanvas = forwardRef<FirmaCanvasHandle>(function FirmaCanvas(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dibujandoRef = useRef(false);
  const vacioRef = useRef(true);
  const [hayFirma, setHayFirma] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1a1a1a";
    }
  }, []);

  function posicion(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function iniciar(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    e.preventDefault();
    dibujandoRef.current = true;
    const { x, y } = posicion(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // Algunos navegadores tiran error si el puntero ya no está activo; la
    // captura solo mejora el trazo cuando el dedo sale del recuadro.
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // se sigue dibujando igual
    }
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujandoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    e.preventDefault();
    const { x, y } = posicion(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (vacioRef.current) {
      vacioRef.current = false;
      setHayFirma(true);
    }
  }

  function terminar() {
    dibujandoRef.current = false;
  }

  function limpiar() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    vacioRef.current = true;
    setHayFirma(false);
  }

  useImperativeHandle(ref, () => ({
    obtenerFirma: () => (vacioRef.current ? null : (canvasRef.current?.toDataURL("image/png") ?? null)),
    limpiar,
  }));

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="h-40 w-full rounded-md border border-zinc-300 bg-white dark:border-zinc-700"
        style={{ touchAction: "none" }}
        onPointerDown={iniciar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerLeave={terminar}
        onPointerCancel={terminar}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-zinc-500">{hayFirma ? "Firma capturada." : "Firmá acá arriba con el dedo."}</span>
        <button type="button" onClick={limpiar} className="text-xs font-medium text-brand-navy hover:underline dark:text-brand-cyan">
          Limpiar
        </button>
      </div>
    </div>
  );
});

export default FirmaCanvas;
