"use client";

import { useRef, useState } from "react";
import FirmaCanvas, { type FirmaCanvasHandle } from "@/components/FirmaCanvas";
import MensajeError from "@/components/MensajeError";
import { mensajeDe, pedir } from "@/lib/cliente";
import { formatoFechaHora } from "@/lib/fechas";
import type { DetalleEvento } from "@/lib/db/types";

/** El representante de ventas a cargo firma que revisó el evento y está al tanto. */
export default function Validaciones({ detalle, onCambio }: { detalle: DetalleEvento; onCambio: () => void }) {
  const { evento, validaciones, permisos } = detalle;
  const firmaRef = useRef<FirmaCanvasHandle | null>(null);
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function validar() {
    const firma = firmaRef.current?.obtenerFirma();
    if (!firma) {
      setError("Falta la firma.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await pedir(`/api/eventos/${evento.id}/validaciones`, { method: "POST", body: { firma, observaciones } });
      setObservaciones("");
      firmaRef.current?.limpiar();
      onCambio();
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="tarjeta p-5">
      <h2 className="mb-1 font-bold">Validación del representante</h2>
      <p className="mb-4 text-xs text-zinc-500">El representante de ventas a cargo firma que revisó el evento y está atento a que todo se cumpla.</p>

      {validaciones.length === 0 ? (
        <p className="mb-4 text-sm text-amber-700">Todavía no hay validaciones del representante.</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-3">
          {validaciones.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/archivos/${v.firmaId}`} alt="Firma" className="h-14 rounded border border-zinc-300 bg-white" />
              <div>
                <p className="font-semibold">
                  ✔ {v.usuarioNombre ?? "Representante"} — {formatoFechaHora(v.creadoEn)}
                </p>
                {v.observaciones && <p className="text-zinc-600 dark:text-zinc-300">{v.observaciones}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {permisos.validar && (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <label className="etiqueta">Firma</label>
          <FirmaCanvas ref={firmaRef} />
          <label className="etiqueta mt-3">Observaciones (opcional)</label>
          <textarea className="campo" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          {error && (
            <div className="mt-3">
              <MensajeError mensaje={error} />
            </div>
          )}
          <button type="button" className="boton mt-3" disabled={guardando} onClick={validar}>
            {guardando ? "Guardando…" : "Firmar: vi el evento y estoy atento"}
          </button>
        </div>
      )}
    </section>
  );
}
