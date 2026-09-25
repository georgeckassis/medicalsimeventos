"use client";

import { useEffect, useState } from "react";
import MensajeError from "@/components/MensajeError";
import { mensajeDe, pedir } from "@/lib/cliente";
import { formatoFechaHora } from "@/lib/fechas";
import type { EntradaHistorial } from "@/lib/db/types";

/** Quién hizo qué y cuándo: cada tilde, cambio de horario, firma y reapertura. */
export default function Historial({ eventoId, version }: { eventoId: number; version: number }) {
  const [entradas, setEntradas] = useState<EntradaHistorial[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pedir<EntradaHistorial[]>(`/api/eventos/${eventoId}/historial`)
      .then(setEntradas)
      .catch((e) => setError(mensajeDe(e)));
  }, [eventoId, version]);

  return (
    <section className="tarjeta p-5">
      <h2 className="mb-3 font-bold">Historial</h2>
      {error && <MensajeError mensaje={error} />}
      {entradas.length === 0 ? (
        <p className="text-sm text-zinc-400">Sin movimientos todavía.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {entradas.map((h) => (
            <li key={h.id} className="border-b border-zinc-100 pb-2 dark:border-zinc-800">
              <span className="text-xs text-zinc-500">{formatoFechaHora(h.creadoEn)}</span> ·{" "}
              <span className="font-semibold">{h.usuarioNombre ?? "—"}</span> · {h.accion}
              {h.detalle && <span className="block text-xs text-zinc-600 dark:text-zinc-400">{h.detalle}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
