"use client";

import { useState } from "react";

// Sin letras ni números que se confundan al dictarla o copiarla a mano (0/O, 1/l/I).
const ALFABETO = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generarPassword(largo = 10): string {
  const azar = crypto.getRandomValues(new Uint32Array(largo));
  return Array.from(azar, (n) => ALFABETO[n % ALFABETO.length]).join("");
}

/**
 * Campo de contraseña con botón para verla mientras se escribe y, si se
 * pide, para generar una al azar (ya visible, para copiarla y pasársela a
 * la persona).
 */
export default function CampoPassword({
  id,
  valor,
  onCambio,
  autoComplete,
  requerido,
  minimo,
  conGenerar,
}: {
  id?: string;
  valor: string;
  onCambio: (valor: string) => void;
  autoComplete: "current-password" | "new-password";
  requerido?: boolean;
  minimo?: number;
  conGenerar?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <div className="relative">
        <input
          id={id}
          className="campo pr-16"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={requerido}
          minLength={minimo}
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-2 my-auto text-xs font-semibold text-brand-navy hover:underline"
          aria-label={visible ? "Ocultar contraseña" : "Ver contraseña"}
        >
          {visible ? "Ocultar" : "Ver"}
        </button>
      </div>
      {conGenerar && (
        <div className="mt-1 flex gap-3 text-xs">
          <button
            type="button"
            className="font-semibold text-brand-navy hover:underline"
            onClick={() => {
              onCambio(generarPassword());
              setVisible(true);
            }}
          >
            Generar una al azar
          </button>
          {valor && (
            <button type="button" className="font-semibold text-brand-navy hover:underline" onClick={() => navigator.clipboard?.writeText(valor)}>
              Copiar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
