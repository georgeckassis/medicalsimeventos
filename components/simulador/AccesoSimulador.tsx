"use client";

import { useSesion } from "@/components/Sesion";
import { puedeUsarSimulador } from "@/lib/auth/permisos";

export default function AccesoSimulador({ children }: { children: React.ReactNode }) {
  const { sesion } = useSesion();
  if (!sesion) return <p className="p-6 text-sm text-zinc-500">Cargando…</p>;
  if (!puedeUsarSimulador(sesion.usuario.rol)) {
    return <p className="p-6 text-sm text-zinc-500">Tu rol todavía no tiene acceso al simulador.</p>;
  }
  return <>{children}</>;
}
