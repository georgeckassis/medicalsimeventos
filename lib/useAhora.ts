"use client";

import { useEffect, useState } from "react";

/** Hora actual que se actualiza sola cada 30 s (para marcar vencidos sin recargar). */
export function useAhora(): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const intervalo = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(intervalo);
  }, []);
  return ahora;
}
