"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Encabezado from "@/components/Encabezado";
import MensajeError from "@/components/MensajeError";
import { useSesion } from "@/components/Sesion";
import { mensajeDe, pedir } from "@/lib/cliente";
import { formatoFechaHora } from "@/lib/fechas";
import type { Alerta } from "@/lib/db/types";

export default function AlertasPage() {
  const { sesion, recargar } = useSesion();
  const gestor = sesion?.usuario.rol === "general" || sesion?.usuario.rol === "superadmin";
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [todas, setTodas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revisando, setRevisando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setAlertas(await pedir<Alerta[]>(`/api/alertas${todas ? "?todas=1" : ""}`));
      setError(null);
    } catch (err) {
      setError(mensajeDe(err));
    }
  }, [todas]);

  useEffect(() => {
    // Carga inicial de datos al montar la página — patrón estándar de fetch-on-mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    const intervalo = setInterval(cargar, 60_000);
    return () => clearInterval(intervalo);
  }, [cargar]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <Encabezado
        titulo="Alertas"
        descripcion="Avisos previos e incumplimientos de carga, descarga, devolución y tareas. Se resuelven solas cuando se cumple lo pendiente."
      >
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} /> Ver también las resueltas
        </label>
        <button
          type="button"
          className="boton-secundario"
          disabled={revisando}
          onClick={async () => {
            setRevisando(true);
            try {
              await pedir("/api/alertas/revisar", { method: "POST" });
              await cargar();
              recargar();
            } catch (err) {
              setError(mensajeDe(err));
            } finally {
              setRevisando(false);
            }
          }}
        >
          {revisando ? "Revisando…" : "Revisar ahora"}
        </button>
      </Encabezado>
      {error && <MensajeError mensaje={error} />}
      {alertas.length === 0 && <p className="text-sm text-zinc-400">No hay alertas {todas ? "" : "activas"}. 👌</p>}
      <ul className="flex flex-col gap-3">
        {alertas.map((a) => {
          const activa = !a.resueltaEn;
          return (
            <li
              key={a.id}
              className={`rounded-lg border p-4 text-sm ${
                !activa
                  ? "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900"
                  : a.severidad === "incumplimiento"
                    ? "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
                    : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold">
                  {activa ? (a.severidad === "incumplimiento" ? "⚠️ Incumplimiento" : "🔔 Aviso") : "✔ Resuelta"}
                  <span className="ml-2 font-normal opacity-70">{formatoFechaHora(a.creadaEn)}</span>
                </p>
                {gestor && activa && (
                  <button
                    type="button"
                    className="text-xs font-medium underline opacity-80 hover:opacity-100"
                    onClick={async () => {
                      if (!confirm("¿Dar esta alerta por atendida? No se va a volver a mostrar.")) return;
                      try {
                        await pedir(`/api/alertas/${a.id}`, { method: "DELETE" });
                        cargar();
                        recargar();
                      } catch (err) {
                        setError(mensajeDe(err));
                      }
                    }}
                  >
                    Dar por atendida
                  </button>
                )}
              </div>
              <p className="mt-1">{a.mensaje}</p>
              <p className="mt-2 text-xs opacity-70">
                {a.eventoId && (
                  <Link href={`/eventos/${a.eventoId}?tab=checklist`} className="mr-3 font-semibold underline">
                    Ir al evento
                  </Link>
                )}
                {a.tareaId && (
                  <Link href="/tareas" className="mr-3 font-semibold underline">
                    Ir a tareas
                  </Link>
                )}
                {a.notificacion}
                {a.resueltaEn && ` · Resuelta ${formatoFechaHora(a.resueltaEn)}`}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
