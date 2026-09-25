"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { pedir } from "@/lib/cliente";
import type { Usuario } from "@/lib/db/types";

interface DatosSesion {
  usuario: Usuario;
  alertasActivas: number;
  incumplimientos: number;
  passwordInicial: boolean;
}

const Contexto = createContext<{ sesion: DatosSesion | null; recargar: () => void }>({ sesion: null, recargar: () => {} });

export function ProveedorSesion({ children, activo }: { children: React.ReactNode; activo: boolean }) {
  const [sesion, setSesion] = useState<DatosSesion | null>(null);

  const recargar = useCallback(() => {
    pedir<DatosSesion>("/api/sesion")
      .then(setSesion)
      .catch(() => setSesion(null));
  }, []);

  useEffect(() => {
    if (!activo) return;
    recargar();
    // El contador de alertas de la barra se refresca solo cada minuto.
    const intervalo = setInterval(recargar, 60_000);
    return () => clearInterval(intervalo);
  }, [activo, recargar]);

  return <Contexto.Provider value={{ sesion, recargar }}>{children}</Contexto.Provider>;
}

export function useSesion() {
  return useContext(Contexto);
}
