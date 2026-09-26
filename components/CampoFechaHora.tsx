"use client";

import { useState } from "react";

/**
 * Fecha y hora en dos campos separados, en vez de un único
 * input datetime-local: con ese, si se elegía el día pero no la hora el
 * navegador bloqueaba el guardado con un aviso casi invisible (sobre todo en
 * el celular). Acá, al elegir el día se completa sola la hora por defecto.
 *
 * `valor` / `onCambio` usan el formato de datetime-local ("2026-10-31T09:00",
 * hora Argentina) o "" si no hay fecha.
 */
export default function CampoFechaHora({
  valor,
  onCambio,
  horaPorDefecto = "09:00",
  opcional,
}: {
  valor: string;
  onCambio: (valor: string) => void;
  horaPorDefecto?: string;
  /** Muestra "Borrar" para dejar el campo vacío. */
  opcional?: boolean;
}) {
  // La hora que se elige antes que el día queda guardada acá hasta que haya día.
  const [horaSuelta, setHoraSuelta] = useState("");
  const fecha = valor.slice(0, 10);
  const hora = valor ? valor.slice(11, 16) : horaSuelta;

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="date"
          className="campo min-w-0 flex-[3]"
          value={fecha}
          onChange={(e) => {
            const dia = e.target.value;
            onCambio(dia ? `${dia}T${hora || horaPorDefecto}` : "");
          }}
          aria-label="Día"
        />
        <input
          type="time"
          className="campo min-w-0 flex-[2]"
          value={hora}
          onChange={(e) => {
            const nueva = e.target.value;
            if (fecha) onCambio(`${fecha}T${nueva || horaPorDefecto}`);
            else setHoraSuelta(nueva);
          }}
          aria-label="Hora"
        />
      </div>
      {opcional && valor && (
        <button type="button" className="mt-1 text-xs font-medium text-zinc-500 hover:underline" onClick={() => onCambio("")}>
          Borrar
        </button>
      )}
    </div>
  );
}
